import {createSession,analyze,previewRepair,applyRepair,undoRepair,validatePlan} from './core.mjs';
export function controller(plan) {
 let session=createSession(plan), pending=null, planDraft=null;
 return {
  get session(){return structuredClone(session)}, get pending(){return structuredClone(pending)},
  get editing(){return planDraft!==null},
  analysis(){return analyze(session.plan,session.missedDay)},
  lose(day){const next=createSession(session.plan,day);next.revision=session.revision+1;session=next;pending=null},
  preview(change){pending=null;pending=previewRepair(session,change);return structuredClone(pending)},
  clearPreview(){pending=null},
  apply(){if(!pending)throw Error('Preview this change first');session=applyRepair(session,pending.change,pending.revision);pending=null},
  undo(){session=undoRepair(session);pending=null},
  begin(){planDraft=structuredClone(session.plan);return structuredClone(planDraft)},
  cancel(){planDraft=null},
  save(plan){validatePlan(plan);const next=createSession(plan,session.missedDay);next.revision=session.revision+1;session=next;pending=null;planDraft=null}
 };
}

/** Explain the first deadline failure without hiding behind weekly totals. */
export function explainDeadline(analysis) {
 const b=analysis.earliestBottleneck;
 if(!b)return 'Every deadline has enough usable time before it under the current estimates. This is a capacity check, not a promise of completion.';
 const later=analysis.usableUnits-b.capacityUnits;
 return `Across the whole plan, ${analysis.usableUnits/2}h is usable for ${analysis.demandUnits/2}h of work. But by ${b.deadline.day} at ${b.deadline.time}, ${b.demandUnits/2}h is due and only ${b.capacityUnits/2}h is usable. The shortfall is ${b.deficitUnits/2}h.${later>0?` The other ${later/2}h comes after this deadline and cannot cover that shortfall.`:''} Protected commitments are not moved.`;
}
