import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const app=await readFile(new URL('./app.mjs',import.meta.url),'utf8');
const snippet=app.slice(app.indexOf('function keepFocusClear()'),app.indexOf('function act('));
function harness(){
 const state={box:{top:164,bottom:242,left:18,right:370,height:78},rect:{top:239,bottom:253,left:30,right:45},padding:null,scrolls:[],frames:[],events:{}};
 const target={getBoundingClientRect:()=>state.rect,matches:()=>state.checkbox===true,closest:()=>state.label?{getBoundingClientRect:()=>state.label}:null};
 const status={getBoundingClientRect:()=>state.box,contains:t=>t===status,textContent:''};
 const root={style:{setProperty:(key,value)=>{assert.equal(key,'scroll-padding-block-end');state.padding=value}}};
 const document={documentElement:root,body:{},activeElement:target,addEventListener:(name,fn)=>state.events[name]=fn};
 const window={scrollBy:args=>state.scrolls.push(args.top),addEventListener:(name,fn)=>state.events[name]=fn};
 class ResizeObserver{constructor(fn){state.resize=fn}observe(el){assert.equal(el,status)}}
 const ctx=vm.createContext({$:id=>{assert.equal(id,'status');return status},document,window,ResizeObserver,requestAnimationFrame:fn=>state.frames.push(fn)});
 vm.runInContext(snippet,ctx);return {...state,state,status,target,document,ctx,run:()=>ctx.keepFocusClear()};
}
test('measures banner and moves partly covered control above it',()=>{const h=harness();h.run();assert.equal(h.state.padding,'100px');assert.deepEqual(h.state.scrolls,[97])});
test('does not move already clear, horizontal-disjoint, or status focus',()=>{for(const mode of ['clear','disjoint','status']){const h=harness();if(mode==='clear')h.state.rect={top:90,bottom:140,left:30,right:45};if(mode==='disjoint')h.state.rect.left=400;if(mode==='status')h.document.activeElement=h.status;h.run();assert.deepEqual(h.state.scrolls,[])}});
test('empty status releases reservation without scrolling',()=>{const h=harness();h.state.box.height=0;h.run();assert.equal(h.state.padding,'0px');assert.deepEqual(h.state.scrolls,[])});
test('notify updates feedback and fixes existing focus synchronously',()=>{const h=harness();h.ctx.notify('Draft kept: invalid time');assert.equal(h.status.textContent,'Draft kept: invalid time');assert.deepEqual(h.state.scrolls,[97])});
test('resize and keyboard focus each recalculate, including deferred native scrolling',()=>{const h=harness();h.state.box={...h.state.box,top:103,bottom:179,height:76};h.state.rect={top:170,bottom:183,left:30,right:45};h.state.resize();assert.equal(h.state.padding,'98px');assert.equal(h.state.scrolls[0],88);h.state.events.focusin();assert.equal(h.state.frames.length,1);h.state.frames[0]();assert.equal(h.state.scrolls.length,3);assert.equal(typeof h.state.events.resize,'function')});
test('large focused target is not moved above top focus clearance',()=>{const h=harness();h.state.rect.top=12;h.run();assert.deepEqual(h.state.scrolls,[4])});
test('capped region is keyboard-scrollable, remains polite, and no experimental fixed padding remains',async()=>{const css=await readFile(new URL('./style.css',import.meta.url),'utf8'),html=await readFile(new URL('./index.html',import.meta.url),'utf8');assert.match(css,/#status\{max-height:40vh;overflow-y:auto\}/);assert.doesNotMatch(css,/scroll-padding-block-end:8rem/);assert.match(html,/<p id="status" role="status" aria-live="polite" tabindex="0">/)});

test('new notification starts at top after scrolling a previous long message',()=>{const h=harness();h.status.scrollTop=76.25;h.ctx.notify('Validated plan saved');assert.equal(h.status.scrollTop,0);assert.equal(h.status.textContent,'Validated plan saved')});
test('narrow action controls wrap instead of becoming taller than the available focus area',async()=>{const css=await readFile(new URL('./style.css',import.meta.url),'utf8');assert.match(css,/\.controls button\{flex:1 1 12rem\}/);assert.doesNotMatch(css,/\.controls button\{flex:1\}/)});
test('zoom or resize returns above-viewport focus to the top clearance',()=>{const h=harness();h.state.rect={top:-134,bottom:-87,left:18,right:120};h.run();assert.deepEqual(h.state.scrolls,[-142])});
test('zoom or resize brings below-viewport focus above the status',()=>{const h=harness();h.state.box={top:104,bottom:179,left:18,right:273,height:76};h.state.rect={top:209,bottom:256,left:18,right:120};h.run();assert.deepEqual(h.state.scrolls,[160])});

function wrappedCheckbox(){const h=harness();h.state.checkbox=true;h.state.rect={top:82.62109375,bottom:95.62109375,left:46,right:59};h.state.label={top:79.62109375,bottom:119.91796875,left:42,right:249.25,width:207.25,height:40.296875};h.state.box={top:103.55078125,bottom:179.25,left:18,right:273.25,height:75.69921875};return h}
test('wrapped checkbox label clears status using captured 400 percent geometry',()=>{const h=wrappedCheckbox();h.run();assert.deepEqual(h.state.scrolls,[24.3671875])});
test('window resize, status resize and deferred focus use checkbox label bounds',()=>{const h=wrappedCheckbox();h.state.events.resize();h.state.resize();h.state.events.focusin();h.state.frames[0]();assert.deepEqual(h.state.scrolls,[24.3671875,24.3671875,24.3671875,24.3671875])});
test('already clear and one-line checkbox labels do not scroll',()=>{for(const height of [20,40]){const h=wrappedCheckbox();h.state.rect={top:39,bottom:52,left:46,right:59};h.state.label={top:36,bottom:36+height,left:42,right:249,width:207,height};h.run();assert.deepEqual(h.state.scrolls,[])}});
test('checkbox label above viewport is brought into view with its control',()=>{const h=wrappedCheckbox();h.state.rect={top:2,bottom:15,left:46,right:59};h.state.label={top:-1,bottom:39,left:42,right:249,width:207,height:40};h.run();assert.deepEqual(h.state.scrolls,[-9])});
test('missing, hidden and non-checkbox labels retain control-only clearance',()=>{for(const mode of ['missing','hidden','other']){const h=wrappedCheckbox();if(mode==='missing')h.state.label=null;if(mode==='hidden')h.state.label={top:0,bottom:0,left:0,right:0,width:0,height:0};if(mode==='other')h.state.checkbox=false;h.run();assert.deepEqual(h.state.scrolls,[0.0703125])}});
test('oversized checkbox label preserves focused control instead of moving it offscreen',()=>{const h=wrappedCheckbox();h.state.label={top:79,bottom:300,left:42,right:249,width:207,height:221};h.run();assert.deepEqual(h.state.scrolls,[0.0703125])});
test('label union includes input outside its bounds and ignores horizontally disjoint choice',()=>{const h=wrappedCheckbox();h.state.label={top:79,bottom:100,left:60,right:249,width:189,height:21};h.state.rect.bottom=120;h.run();assert.deepEqual(h.state.scrolls,[24.44921875]);const d=wrappedCheckbox();d.state.rect.left=400;d.state.rect.right=413;d.state.label={...d.state.label,left:400,right:600,width:200};d.run();assert.deepEqual(d.state.scrolls,[])});
test('checkbox handling leaves status focus and empty feedback exempt',()=>{for(const mode of ['status','empty']){const h=wrappedCheckbox();if(mode==='status')h.document.activeElement=h.status;else h.state.box.height=0;h.run();assert.deepEqual(h.state.scrolls,[])}});
