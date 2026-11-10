import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePlan,analyze,compare,createSession,previewRepair,applyRepair,undoRepair} from './core.mjs';
import {samplePlan,missedDay,earlyRepair,lateRepair} from './sample.mjs';
const copy=x=>structuredClone(x);
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
const small=()=>({horizon:{startDay:'2026-11-10',endDay:'2026-11-10'},tasks:[{id:'a',title:'Task',units:1,deadline:{day:'2026-11-10',time:'10:00'}}],blocks:[{id:'b',label:'Study',day:'2026-11-10',start:'09:30',end:'10:00'}],commitments:[]});
test('synthetic missed-day explanation catches an early deadline despite enough total hours',()=>{
 const {baseline,disrupted}=compare(samplePlan,missedDay);
 assert.equal(baseline.feasible,true);assert.equal(baseline.usableUnits,14);
 assert.equal(disrupted.usableUnits,10);assert.equal(disrupted.demandUnits,10);assert.equal(disrupted.feasible,false);
 assert.deepEqual(disrupted.earliestBottleneck,{deadline:{day:'2026-11-13',time:'18:00'},demandUnits:6,capacityUnits:2,deficitUnits:4,taskIds:['practice']});
 assert.equal(disrupted.protectedUnits,2);assert.equal(disrupted.missedUnits,4);
});
test('later capacity cannot repair Friday but an explicitly earlier block can',()=>{
 const s=createSession(samplePlan,missedDay);const before=copy(s);
 assert.equal(previewRepair(s,lateRepair).after.feasible,false);
 assert.equal(previewRepair(s,earlyRepair).after.feasible,true);assert.deepEqual(s,before);
 const repaired=applyRepair(s,earlyRepair,0);
 assert.deepEqual(repaired.plan.commitments,s.plan.commitments);assert.deepEqual(repaired.plan.tasks,s.plan.tasks);
 assert.deepEqual(undoRepair(repaired).plan,s.plan);assert.deepEqual(analyze(undoRepair(repaired).plan,missedDay),analyze(s.plan,missedDay));
});
test('exact deadline is inclusive but later finishing slot is unavailable',()=>{
 const p=small();assert.equal(analyze(p).feasible,true);
 p.tasks[0].deadline.time='09:30';assert.equal(analyze(p).feasible,false);
 p.tasks[0].deadline.time='24:00';p.blocks[0].start='23:30';p.blocks[0].end='24:00';assert.equal(analyze(p).feasible,true);
});
test('protected time subtracts capacity and is never moved or double-counted',()=>{
 const p=small();p.commitments=[{id:'c',label:'Class',day:'2026-11-10',start:'09:30',end:'10:00'}];
 const a=analyze(p,'2026-11-10');assert.equal(a.protectedUnits,1);assert.equal(a.missedUnits,0);assert.equal(a.usableUnits,0);
 const s=createSession(p);assert.deepEqual(previewRepair(s,{type:'setTaskUnits',taskId:'a',units:2}).plan.commitments,p.commitments);
});
test('same-deadline ordering is stable and input ordering cannot affect result',()=>{
 const p=small();p.tasks.push({...copy(p.tasks[0]),id:'b'});p.blocks[0].start='09:00';
 assert.deepEqual(analyze(p),analyze({...p,tasks:[...p.tasks].reverse()}));
 assert.deepEqual(analyze(p).allocations.map(x=>x.taskId),['a','b']);assert.equal(analyze(p).checks.length,1);
});
test('preview/apply/undo do not mutate frozen inputs, and returned objects are detached',()=>{
 const p=freeze(copy(samplePlan));const s=freeze(createSession(p,missedDay));const change=freeze(copy(earlyRepair));
 const preview=previewRepair(s,change);preview.plan.tasks[0].title='Changed';assert.equal(s.plan.tasks[0].title,'Practice problem set');
 const applied=applyRepair(s,change,0);const undone=undoRepair(freeze(applied));assert.deepEqual(undone.plan,p);assert.equal(undone.revision,2);
 const validated=validatePlan(p);validated.tasks[0].units=100;assert.equal(p.tasks[0].units,6);
});
test('stale apply is refused, including after undo; no-op does not advance revision',()=>{
 const s=createSession(samplePlan,missedDay);const repaired=applyRepair(s,earlyRepair,0);
 assert.throws(()=>applyRepair(repaired,lateRepair,0),/Stale/);const undone=undoRepair(repaired);
 assert.throws(()=>applyRepair(undone,earlyRepair,0),/Stale/);
 assert.deepEqual(applyRepair(s,{type:'setTaskUnits',taskId:'practice',units:6},0),s);
 assert.deepEqual(undoRepair(s),s);
});
test('explicit effort change is visible and reversible, invalid drafts do not change session',()=>{
 const s=createSession(samplePlan,missedDay);const before=copy(s);const change={type:'setTaskUnits',taskId:'practice',units:2};
 const preview=previewRepair(s,change);assert.equal(preview.after.feasible,true);assert.deepEqual(preview.change,change);
 assert.deepEqual(undoRepair(applyRepair(s,change,0)).plan,s.plan);
 for(const bad of [{type:'setTaskUnits',taskId:'missing',units:1},{type:'setTaskUnits',taskId:'practice',units:0},{type:'moveDeadline'},{type:'addBlock',block:{...earlyRepair.block,day:missedDay}}])assert.throws(()=>previewRepair(s,bad));
 assert.deepEqual(s,before);
});
test('schema, duplicate identifiers and malformed effort fail explicitly',()=>{
 for(const units of [0,-1,1.5,NaN,Infinity,'1',true,1489]){const p=small();p.tasks[0].units=units;assert.throws(()=>analyze(p));}
 for(const mutate of [p=>p.extra=1,p=>p.tasks.push(copy(p.tasks[0])),p=>p.blocks.push(copy(p.blocks[0])),p=>p.tasks[0].title='',p=>p.tasks[0].deadline.extra=1,p=>p.tasks=null]){const p=small();mutate(p);assert.throws(()=>analyze(p));}
});
test('date, half-hour, horizon and interval errors fail explicitly',()=>{
 for(const mutate of [p=>p.horizon.startDay='2026-02-30',p=>p.horizon.startDay='0000-01-01',p=>p.horizon.endDay='2026-12-11',p=>p.blocks[0].start='09:15',p=>p.blocks[0].end='09:00',p=>p.blocks[0].end='25:00',p=>p.tasks[0].deadline.day='2026-11-09',p=>p.blocks[0].start='24:00']){const p=small();mutate(p);assert.throws(()=>analyze(p));}
 assert.throws(()=>analyze(small(),'2026-11-11'));
});
test('overlapping study or protected intervals reject; adjacent blocks are allowed',()=>{
 let p=small();p.blocks.push({...copy(p.blocks[0]),id:'b2'});assert.throws(()=>analyze(p),/overlap/);
 p=small();p.blocks.push({...copy(p.blocks[0]),id:'b2',start:'10:00',end:'10:30'});assert.equal(analyze(p).usableUnits,2);
 p=small();p.commitments=[{id:'c',label:'Class',day:'2026-11-10',start:'09:00',end:'10:00'},{id:'c2',label:'Appointment',day:'2026-11-10',start:'09:30',end:'10:30'}];assert.throws(()=>analyze(p),/overlap/);
});
test('empty tasks are trivially feasible; absent capacity explains all remaining demand',()=>{
 const p=small();p.blocks=[];assert.equal(analyze(p).earliestBottleneck.deficitUnits,1);
 p.tasks=[];assert.equal(analyze(p).feasible,true);assert.equal(analyze(p).demandUnits,0);
});
