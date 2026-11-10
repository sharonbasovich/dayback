import {compare,createSession,previewRepair,applyRepair,undoRepair,analyze} from './core.mjs';
import {samplePlan,missedDay,earlyRepair,lateRepair} from './sample.mjs';
const session=createSession(samplePlan,missedDay);
const applied=applyRepair(session,earlyRepair,session.revision);
const summary=r=>({feasible:r.feasible,usableUnits:r.usableUnits,demandUnits:r.demandUnits,earliestBottleneck:r.earliestBottleneck});
const comparison=compare(samplePlan,missedDay);
console.log(JSON.stringify({synthetic:true,unitMinutes:30,baseline:summary(comparison.baseline),missedWednesday:summary(comparison.disrupted),lateRepair:summary(previewRepair(session,lateRepair).after),earlyRepair:summary(analyze(applied.plan,applied.missedDay)),undoRestoresInputs:JSON.stringify(undoRepair(applied).plan)===JSON.stringify(samplePlan)},null,2));
