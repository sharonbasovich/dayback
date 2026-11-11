import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {controller,explainDeadline} from './ui-state.mjs';
import {analyze,applyRepair} from './core.mjs';
import {samplePlan,earlyRepair,lateRepair} from './sample.mjs';
// Minimal in-memory DOM to exercise the actual app handlers, not browser layout
// or native HTML validity. Invalid submissions below intentionally reach model validation.
function harness({staleApply=false}={}){
 const ids=new Map();let document;
 class Element {
  constructor(tag){this.tagName=tag;this.children=[];this.events={};this.value='';this.hidden=false;this.disabled=false;this.style={setProperty(){}};}
  set id(v){this._id=v;ids.set(v,this)} get id(){return this._id}
  append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);if(this.tagName==='select'&&this.children.length===1)this.value=n.value}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);if(this.tagName==='select')this.value=this.children[0]?.value||''}
  querySelectorAll(s){const direct=s.startsWith(':scope > ');if(direct)s=s.slice(9);const choices=s.split(',');const result=[];for(const n of this.children){if(choices.some(x=>x.startsWith('.')?n.className===x.slice(1):n.tagName===x))result.push(n);if(!direct)result.push(...n.querySelectorAll(s))}return result}
  querySelector(s){return this.querySelectorAll(s)[0]||null}
  addEventListener(name,fn){this.events[name]=fn}
  focus(){document.activeElement=this}
  getBoundingClientRect(){return {top:0,bottom:0,left:0,right:0,height:0}}
  contains(n){return n===this||this.children.some(c=>c.contains(n))}
 }
 const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 // Static relevant controls grouped exactly as in the source form.
 for(const match of html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g)){const n=new Element(match[1]);n.id=match[2];n.value=match[0].match(/\bvalue="([^"]*)"/)?.[1]||'';n.hidden=/\bhidden\b/.test(match[0]);}
 const $=id=>ids.get(id);
 for(const id of ['block-label','block-day','block-start','block-end'])$('block-fields').append($(id));
 for(const id of ['task-id','task-units'])$('effort-fields').append($(id));
 $('repair').append($('repair-type'),$('block-fields'),$('effort-fields'));$('repair-type').value='block';
 document={getElementById:$,createElement:t=>new Element(t),documentElement:new Element('html'),body:new Element('body'),addEventListener(){},activeElement:null};
 const ctx=vm.createContext({document,window:{addEventListener(){},scrollBy(){}},ResizeObserver:class{observe(){}},requestAnimationFrame(){},controller:plan=>{
   const real=controller(plan);
   if(!staleApply)return real;
   // Fault injection: normal UI clears stale previews. Exercise the actual
   // handler's failure feedback using the core's real stale-revision rejection.
   return new Proxy(real,{get(target,key){if(key==='apply')return ()=>applyRepair(real.session,real.pending.change,real.pending.revision-1);return target[key]}});
  },explainDeadline,analyze,samplePlan,earlyRepair,lateRepair,structuredClone});
 let code=readFileSync(new URL('./app.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 vm.runInContext(code+'\nglobalThis.inspect=()=>({session:app.session,pending:app.pending,editing:app.editing,draft:structuredClone(draft)});',ctx);
 return {$,state:ctx.inspect,click:id=>$(id).onclick(),submit:id=>$(id).onsubmit({preventDefault(){}}),change:(id,value)=>{$(id).value=value;$(id).onchange()},input:(node,value)=>{node.value=value;node.oninput?.();},rows:key=>$('editor-'+key).querySelectorAll('.row'),add:key=>$('editor-'+key).querySelector(':scope > button').onclick()};
}
const noopMessage='No change was applied. Existing Undo history was preserved.';
const appliedMessage='Repair applied to this in-page plan. Undo is available.';
function previewUnchanged(h){h.change('repair-type','effort');h.$('task-id').value='practice';h.$('task-units').value='6';h.submit('repair');assert.ok(h.state().pending)}
test('fresh no-op Apply reports no change and does not offer nonexistent Undo',()=>{
 const h=harness(),before=h.state().session;previewUnchanged(h);h.click('apply');
 assert.deepEqual(h.state().session,before);assert.equal(h.state().pending,null);
 assert.equal(h.$('undo').disabled,true);assert.equal(h.$('apply').disabled,true);
 assert.equal(h.$('status').textContent,noopMessage);
});
test('no-op Apply preserves history and Undo still targets the earlier real repair',()=>{
 const h=harness(),original=h.state().session;h.click('early');h.click('apply');const repaired=h.state().session;
 previewUnchanged(h);h.click('apply');assert.deepEqual(h.state().session,repaired);
 assert.equal(h.$('status').textContent,noopMessage);assert.equal(h.$('undo').disabled,false);
 h.click('undo');assert.deepEqual(h.state().session.plan,original.plan);assert.equal(h.state().session.history.length,0);
});
test('actual effort change retains applied feedback and creates undoable history',()=>{
 const h=harness(),before=h.state().session;h.change('repair-type','effort');h.$('task-units').value='4';h.submit('repair');h.click('apply');
 assert.equal(h.$('status').textContent,appliedMessage);assert.equal(h.state().session.revision,before.revision+1);
 assert.equal(h.state().session.history.length,1);assert.equal(h.$('undo').disabled,false);
 h.click('undo');assert.deepEqual(h.state().session.plan,before.plan);
});
test('failed Apply with no preview reports error rather than success or no-op',()=>{
 const h=harness(),before=h.state().session;h.click('apply');
 assert.deepEqual(h.state().session,before);assert.equal(h.$('status').textContent,'Not saved: Preview this change first');
});
test('core stale-revision rejection through Apply handler reports failure and preserves session',()=>{
 const h=harness({staleApply:true}),before=h.state().session;h.click('early');h.click('apply');
 assert.deepEqual(h.state().session,before);assert.equal(h.$('status').textContent,'Not saved: Stale repair; preview the current plan again');
 assert.equal(h.$('undo').disabled,true);
});
