import {controller,explainDeadline} from './ui-state.mjs';
import {analyze} from './core.mjs';
import {samplePlan,earlyRepair,lateRepair} from './sample.mjs';
const $=id=>document.getElementById(id), app=controller(samplePlan);
let draft=null, serial=0;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const hours=n=>`${n} units / ${n/2}h`;
// Reserve the measured live-region height and keep keyboard focus above it.
// The status itself remains keyboard-scrollable and is exempt from avoidance.
function keepFocusClear(){
 const status=$('status'), root=document.documentElement;
 const box=status.getBoundingClientRect();
 root.style.setProperty('scroll-padding-block-end',`${box.height?Math.ceil(box.height)+22:0}px`);
 const target=document.activeElement;
 if(!box.height||!target||target===document.body||target===root||status.contains(target))return;
 let rect=target.getBoundingClientRect();
 const edge=box.top-8;
 // A wrapping checkbox label is part of its visible choice. Prefer its full
 // bounds only when they fit; oversized labels must not displace the control.
 const label=target.matches?.('input[type="checkbox"]')?target.closest('label.checkbox'):null;
 if(label){const bounds=label.getBoundingClientRect();
  if(bounds.width>0&&bounds.height>0){const combined={top:Math.min(rect.top,bounds.top),bottom:Math.max(rect.bottom,bounds.bottom),left:Math.min(rect.left,bounds.left),right:Math.max(rect.right,bounds.right)};
   if(combined.bottom-combined.top<=edge-8)rect=combined;
  }
 }
 if(rect.right<=box.left||rect.left>=box.right)return;
 if(rect.top<8){window.scrollBy({top:rect.top-8,behavior:'instant'});return}
 if(rect.bottom<=edge)return;
 const distance=Math.min(rect.bottom-edge,Math.max(0,rect.top-8));
 if(distance>0)window.scrollBy({top:distance,behavior:'instant'});
}
const statusResize=new ResizeObserver(keepFocusClear);
statusResize.observe($('status'));
window.addEventListener('resize',keepFocusClear);
document.addEventListener('focusin',()=>{keepFocusClear();requestAnimationFrame(keepFocusClear)});
function notify(text){const status=$('status');status.textContent=text;status.scrollTop=0;keepFocusClear()}
function act(fn,message){try{fn();render();notify(typeof message==='function'?message():message)}catch(e){render();notify(`Not saved: ${e.message}`)}}
function outcome(a){return a.feasible?'Fits under these assumptions':`${a.earliestBottleneck.deficitUnits/2}h short before ${a.earliestBottleneck.deadline.day} ${a.earliestBottleneck.deadline.time}`}
function card(label,a){const n=el('article',undefined,a.feasible?'':'warning');n.append(el('h3',label),el('p',outcome(a),'big'),el('p',`${hours(a.usableUnits)} usable · ${hours(a.demandUnits)} needed`),el('p',`${hours(a.protectedUnits)} excluded for protected overlap · ${hours(a.missedUnits)} lost`));return n}
function render(){const s=app.session,a=app.analysis();$('range').textContent=`${s.plan.horizon.startDay} → ${s.plan.horizon.endDay} · 1 unit = 30 minutes`;
 const summary=$('plan-summary');summary.replaceChildren();for(const [title,rows] of [['Tasks',s.plan.tasks.map(t=>`${t.title}: ${hours(t.units)}, due ${t.deadline.day} ${t.deadline.time}`)],['Study time',s.plan.blocks.map(b=>`${b.label}: ${b.day}, ${b.start}–${b.end}`)],['Protected. Never moved.',s.plan.commitments.map(b=>`${b.label}: ${b.day}, ${b.start}–${b.end}`)]]){const box=el('article');box.append(el('h3',title));const ul=el('ul');for(const row of rows)ul.append(el('li',row));if(!rows.length)ul.append(el('li','None entered'));box.append(ul);summary.append(box)}
 $('comparison').replaceChildren(card('Without a lost day',analyze(s.plan)),card(s.missedDay?`After losing ${s.missedDay}`:'Current plan · no day lost',a));
 $('checks').replaceChildren(el('p',explainDeadline(a),'deadline-explanation'));for(const c of a.checks){const row=el('div',undefined,'check');row.append(el('strong',`By ${c.deadline.day} ${c.deadline.time}`),el('span',`${c.demandUnits} units needed / ${c.capacityUnits} available · ${c.deficitUnits?`${c.deficitUnits} short`:'fits'}`));$('checks').append(row)}
 $('witness-note').textContent=a.feasible?'Complete allocation witness under the model. These are not calendar bookings.':'Partial allocation witness only. The complete workload does not fit; this is NOT a complete schedule.';
 $('allocations').replaceChildren();for(const x of a.allocations)$('allocations').append(el('li',`${x.day} ${x.start}–${x.end}: ${s.plan.tasks.find(t=>t.id===x.taskId).title}`));for(const x of a.remaining)$('allocations').append(el('li',`Unallocated: ${s.plan.tasks.find(t=>t.id===x.taskId).title}, ${hours(x.units)}`));
 const old=$('task-id').value;$('task-id').replaceChildren();for(const t of s.plan.tasks){const o=el('option',t.title);o.value=t.id;$('task-id').append(o)}if(s.plan.tasks.some(t=>t.id===old))$('task-id').value=old;
 $('undo').disabled=!s.history.length||app.editing;$('apply').disabled=!app.pending||app.editing;
 $('preview').hidden=!app.pending;if(app.pending){const p=app.pending;$('preview').replaceChildren(el('h3','Preview only · not applied'),el('p',p.change.type==='addBlock'?`Add ${p.change.block.label}: ${p.change.block.day} ${p.change.block.start}–${p.change.block.end}`:`Set ${s.plan.tasks.find(t=>t.id===p.change.taskId).title} to ${hours(p.change.units)} remaining`),el('p',`Before: ${outcome(p.before)}`),el('p',`After: ${outcome(p.after)}`),el('p','Apply changes this in-page plan only. It does not reserve time or complete work.'))}
 for(const id of ['lose','restore','early','late','edit'])$(id).disabled=app.editing;
 $('repair').querySelectorAll('input,select,button').forEach(n=>n.disabled=app.editing);
 for(const id of ['block-fields','effort-fields'])$(id).querySelectorAll('input,select').forEach(n=>n.disabled=app.editing||$(id).hidden);
}
$('missed').value='2026-11-11';
$('lose').onclick=()=>act(()=>app.lose($('missed').value),'Lost-day comparison updated. Repair history reset.');
$('restore').onclick=()=>act(()=>app.lose(null),'Missed day cleared. Existing plan retained; repair history reset.');
$('early').onclick=()=>act(()=>app.preview({...earlyRepair,block:{...earlyRepair.block,id:`repair-${++serial}`}}),'Thursday repair preview ready. Not applied.');
$('late').onclick=()=>act(()=>app.preview({...lateRepair,block:{...lateRepair.block,id:`repair-${++serial}`}}),'Saturday repair preview ready. Not applied.');
$('repair-type').onchange=()=>{const block=$('repair-type').value==='block';$('block-fields').hidden=!block;$('effort-fields').hidden=block;for(const i of $('block-fields').querySelectorAll('input'))i.required=block;app.clearPreview();render()};
$('repair').addEventListener('input',()=>{app.clearPreview();$('preview').hidden=true;$('apply').disabled=true});
$('repair').onsubmit=e=>{e.preventDefault();act(()=>app.preview($('repair-type').value==='block'?{type:'addBlock',block:{id:`repair-${++serial}`,label:$('block-label').value,day:$('block-day').value,start:$('block-start').value,end:$('block-end').value}}:{type:'setTaskUnits',taskId:$('task-id').value,units:Number($('task-units').value)}),'Preview ready. No saved plan change yet.')};
$('apply').onclick=()=>{const revision=app.session.revision;act(()=>app.apply(),()=>app.session.revision===revision?'No change was applied. Existing Undo history was preserved.':'Repair applied to this in-page plan. Undo is available.')};
$('undo').onclick=()=>act(()=>app.undo(),'Previous plan restored. Any preview was cleared.');
function field(name,value,type='text'){const label=el('label',name),input=el('input');input.type=type;input.value=value;input.required=true;if(type==='number'){input.min='1';input.max='1488';input.step='1'}else if(type==='text')input.maxLength=160;label.append(input);return {label,input}}
function drawEditor(focusKey=null,focusIndex=0){const host=$('edit-rows');host.replaceChildren();for(const key of ['tasks','blocks','commitments']){const section=el('fieldset');section.id=`editor-${key}`;section.append(el('legend',key==='commitments'?'Protected commitments':key==='blocks'?'Study blocks':'Tasks'));
 for(const [index,row] of draft[key].entries()){const group=el('div',undefined,'row'),fields=el('div',undefined,'fields');const defs=key==='tasks'?[['Title',row.title,'text','title'],['30-minute units',row.units,'number','units'],['Due day',row.deadline.day,'date','day'],['Due time',row.deadline.time,'text','time']]:[['Label',row.label,'text','label'],['Day',row.day,'date','day'],['Start',row.start,'text','start'],['End',row.end,'text','end']];for(const [label,value,type,prop] of defs){const f=field(label,value,type);f.input.oninput=()=>{const target=key==='tasks'&&['day','time'].includes(prop)?row.deadline:row;target[prop]=type==='number'?Number(f.input.value):f.input.value};fields.append(f.label)}const remove=el('button','Remove this row');remove.type='button';remove.onclick=()=>{draft[key].splice(index,1);drawEditor(key,Math.min(index,draft[key].length-1))};group.append(fields,remove);section.append(group)}
 const add=el('button',`Add ${key==='tasks'?'task':key==='blocks'?'study block':'protected commitment'}`);add.type='button';add.onclick=()=>{const date=$('start-day').value;draft[key].push(key==='tasks'?{id:`manual-${++serial}`,title:'',units:1,deadline:{day:date,time:'18:00'}}:{id:`manual-${++serial}`,label:'',day:date,start:'09:00',end:'10:00'});drawEditor(key,draft[key].length-1)};section.append(add);host.append(section)}
 if(focusKey){const group=$(`editor-${focusKey}`), rows=group.querySelectorAll('.row');const target=rows[focusIndex]?.querySelector('input')||group.querySelector(':scope > button');target?.focus()}}
$('edit').onclick=()=>{draft=app.begin();app.clearPreview();$('start-day').value=draft.horizon.startDay;$('end-day').value=draft.horizon.endDay;const missed=app.session.missedDay;$('clear-missed').checked=false;$('clear-missed-option').hidden=missed===null;$('clear-missed-note').textContent=missed===null?'':`Current missed day: ${missed}. Saving keeps this comparison unless you choose to clear it. Clear it if your new horizon excludes this date.`;drawEditor();$('editor').hidden=false;render();$('start-day').focus();notify('Editing a staged copy. The saved plan has not changed.')};
$('cancel').onclick=()=>{app.cancel();draft=null;$('editor').hidden=true;render();$('edit').focus();notify('Draft discarded. Saved plan unchanged.')};
$('plan-form').onsubmit=e=>{e.preventDefault();try{draft.horizon={startDay:$('start-day').value,endDay:$('end-day').value};const clearMissedDay=$('clear-missed').checked;app.save(draft,{clearMissedDay});draft=null;$('editor').hidden=true;render();$('edit').focus();notify(`Validated plan saved in page memory.${clearMissedDay?' Missed-day comparison cleared.':''} Repair history reset. Reloading will lose this plan.`)}catch(error){notify(`Draft kept; saved plan unchanged: ${error.message}`)}};
render();
