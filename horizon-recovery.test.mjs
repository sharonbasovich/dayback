import test from 'node:test';
import assert from 'node:assert/strict';
import {controller} from './ui-state.mjs';
import {samplePlan,earlyRepair,missedDay} from './sample.mjs';

function futurePlan(){return {
  horizon:{startDay:'2026-12-01',endDay:'2026-12-02'},
  tasks:[{id:'essay',title:'December essay',units:2,deadline:{day:'2026-12-02',time:'18:00'}}],
  blocks:[{id:'study',label:'December study',day:'2026-12-01',start:'16:00',end:'17:00'}],
  commitments:[]
};}
function withHistory(){const c=controller(samplePlan);c.lose(missedDay);c.preview(earlyRepair);c.apply();return c;}

test('explicit missed-day reset saves an otherwise blocked new horizon',()=>{
  const c=withHistory(), before=c.session;c.begin();const draft=futurePlan();
  assert.throws(()=>c.save(draft),/Missed day must be within horizon/);
  assert.deepEqual(c.session,before);assert.equal(c.editing,true);
  c.save(draft,{clearMissedDay:true});
  assert.deepEqual(c.session.plan,draft);assert.equal(c.session.missedDay,null);
  assert.equal(c.session.revision,before.revision+1);assert.deepEqual(c.session.history,[]);
  assert.equal(c.pending,null);assert.equal(c.editing,false);assert.equal(c.analysis().feasible,true);
  draft.tasks[0].title='changed after save';assert.equal(c.session.plan.tasks[0].title,'December essay');
});
test('failed explicit reset keeps saved inputs, history, comparison and open draft',()=>{
  const c=withHistory(), before=c.session;c.begin();const draft=futurePlan();draft.tasks[0].units=0;
  assert.throws(()=>c.save(draft,{clearMissedDay:true}),/Task effort/);
  assert.deepEqual(c.session,before);assert.equal(c.editing,true);
  draft.tasks[0].units=2;c.save(draft,{clearMissedDay:true});assert.equal(c.session.missedDay,null);
});
test('ordinary save and explicit false continue to preserve missed-day comparison',()=>{
  for(const options of [undefined,{clearMissedDay:false}]){
    const c=withHistory(), draft=c.begin();draft.tasks[0].title='Revised title';c.save(draft,options);
    assert.equal(c.session.missedDay,missedDay);assert.equal(c.session.plan.tasks[0].title,'Revised title');
    assert.equal(c.session.history.length,0);
  }
});
test('cancel after failed save does not clear comparison or saved repair history',()=>{
  const c=withHistory(), before=c.session;c.begin();assert.throws(()=>c.save(futurePlan()));c.cancel();
  assert.deepEqual(c.session,before);assert.equal(c.editing,false);
});
test('reset requires a boolean and never treats arbitrary truthy values as consent',()=>{
  const c=withHistory(), before=c.session;c.begin();
  for(const clearMissedDay of ['false','true',1,null]){
    assert.throws(()=>c.save(futurePlan(),{clearMissedDay}),/Choose whether/);assert.deepEqual(c.session,before);
  }
});
test('explicit reset also preserves a validated plan when no missed day exists',()=>{
  const c=controller(samplePlan);c.begin();c.save(futurePlan(),{clearMissedDay:true});
  assert.deepEqual(c.session.plan,futurePlan());assert.equal(c.session.missedDay,null);
});
