/** DayBack: civil-time, single-student, divisible half-hour planning. No I/O. */
export const UNIT_MINUTES = 30;
const clone = value => structuredClone(value);
const fail = message => { throw new TypeError(message); };
const cmp = (a,b) => a < b ? -1 : a > b ? 1 : 0;
function object(value, keys, where) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) fail(`${where}: unexpected fields`);
}
function label(value, where) {
  if (typeof value !== 'string' || !value.trim() || value.length > 160 || /[\u0000-\u001f]/u.test(value)) fail(`${where}: use nonempty text up to 160 characters`);
}
function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) fail('Use a civil date YYYY-MM-DD, years 0001–9999');
  const n = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(n) || new Date(n).toISOString().slice(0,10) !== value) fail('Invalid civil date');
  return n / 86400000;
}
function minute(value, allowEnd = false) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) fail('Use HH:MM on a 30-minute boundary');
  const h = Number(value.slice(0,2)), m = Number(value.slice(3));
  if (m > 59 || m % 30 !== 0 || h > 23 && !(allowEnd && h === 24 && m === 0)) fail('Use HH:MM on a 30-minute boundary; only interval ends/deadlines allow 24:00');
  return h * 60 + m;
}
function instant(d,t,allowEnd=false) { return day(d)*1440+minute(t,allowEnd); }
function clock(m) { return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`; }
function unique(rows, where) {
  if (!Array.isArray(rows)) fail(`${where}: expected array`);
  const ids = new Set();
  for (const r of rows) {
    if (!r || typeof r !== 'object') fail(`${where}: invalid row`);
    label(r.id, `${where} id`);
    if (ids.has(r.id)) fail(`${where}: duplicate id`);
    ids.add(r.id);
  }
}
function intervals(rows, where, startDay, endDay) {
  unique(rows,where);
  const result = rows.map(r => {
    object(r,['id','label','day','start','end'],where); label(r.label,where);
    const d = day(r.day), start = minute(r.start), end = minute(r.end,true);
    if (d < startDay || d > endDay || end <= start) fail(`${where}: use positive same-day intervals within horizon`);
    return {...r, from:d*1440+start, to:d*1440+end};
  }).sort((a,b)=>a.from-b.from || cmp(a.id,b.id));
  for (let i=1;i<result.length;i++) if(result[i].from < result[i-1].to) fail(`${where}: overlapping intervals must be corrected explicitly`);
  return result;
}
function normalized(plan) {
  object(plan,['horizon','tasks','blocks','commitments'],'plan');
  object(plan.horizon,['startDay','endDay'],'horizon');
  const start = day(plan.horizon.startDay), end=day(plan.horizon.endDay);
  if(end < start || end-start > 30) fail('Horizon must cover 1–31 inclusive civil days');
  const blocks=intervals(plan.blocks,'study blocks',start,end);
  const commitments=intervals(plan.commitments,'protected commitments',start,end);
  unique(plan.tasks,'tasks');
  const tasks=plan.tasks.map(t=>{
    object(t,['id','title','units','deadline'],'task');label(t.title,'task title');
    object(t.deadline,['day','time'],'deadline');
    if(!Number.isSafeInteger(t.units)||t.units<1||t.units>1488) fail('Task effort must be 1–1488 whole 30-minute units');
    const at=instant(t.deadline.day,t.deadline.time,true);
    if(day(t.deadline.day)<start || day(t.deadline.day)>end) fail('Deadline must be within horizon; overdue tasks need explicit replanning');
    return {...t,at};
  }).sort((a,b)=>a.at-b.at||cmp(a.id,b.id));
  return {start,end,blocks,commitments,tasks};
}
export function validatePlan(plan) { normalized(plan); return clone(plan); }

export function analyze(plan, missedDay = null) {
  const p=normalized(plan);
  if(missedDay!==null && (day(missedDay)<p.start||day(missedDay)>p.end)) fail('Missed day must be within horizon');
  const slots=[];let protectedUnits=0, missedUnits=0;
  for(const block of p.blocks) {
    for(let from=block.from;from<block.to;from+=UNIT_MINUTES) {
      if(p.commitments.some(c=>c.from<from+UNIT_MINUTES&&c.to>from)){protectedUnits++;continue;}
      if(block.day===missedDay){missedUnits++;continue;}
      slots.push({day:block.day,start:clock(from-day(block.day)*1440),end:clock(from+UNIT_MINUTES-day(block.day)*1440),blockId:block.id,from,to:from+UNIT_MINUTES});
    }
  }
  const checks=[];let demand=0;
  for(let i=0;i<p.tasks.length;i++) {
    demand+=p.tasks[i].units;
    if(i+1<p.tasks.length&&p.tasks[i+1].at===p.tasks[i].at)continue;
    const t=p.tasks[i],capacity=slots.filter(s=>s.to<=t.at).length;
    checks.push({deadline:clone(t.deadline),demandUnits:demand,capacityUnits:capacity,deficitUnits:Math.max(0,demand-capacity),taskIds:p.tasks.slice(0,i+1).map(x=>x.id)});
  }
  let cursor=0;const allocations=[],remaining=[];
  for(const t of p.tasks) {
    let assigned=0;
    while(assigned<t.units&&cursor<slots.length&&slots[cursor].to<=t.at) {
      const {from,to,...slot}=slots[cursor++];allocations.push({...slot,taskId:t.id});assigned++;
    }
    if(assigned<t.units) remaining.push({taskId:t.id,units:t.units-assigned});
  }
  const first=checks.find(c=>c.deficitUnits>0)||null;
  return {feasible:first===null,checks,earliestBottleneck:first?clone(first):null,
    demandUnits:demand,usableUnits:slots.length,protectedUnits,missedUnits,
    allocations,remaining,missedDay};
}
export function compare(plan, missedDay) { return {baseline:analyze(plan),disrupted:analyze(plan,missedDay)}; }

// Repair sessions are plain in-memory values. Revisions are local UI guards, not storage locks.
export function createSession(plan, missedDay = null) {
  analyze(plan,missedDay);return {plan:clone(plan),missedDay,revision:0,history:[]};
}
function checkSession(s) {
  object(s,['plan','missedDay','revision','history'],'session');
  if(!Number.isSafeInteger(s.revision)||s.revision<0||!Array.isArray(s.history))fail('Invalid session');
  analyze(s.plan,s.missedDay);
}
export function previewRepair(session, change) {
  checkSession(session);const plan=clone(session.plan);
  if(change?.type==='addBlock') {
    object(change,['type','block'],'repair');
    if(change.block?.day===session.missedDay) fail('Cannot add capacity to the missed day');
    plan.blocks.push(clone(change.block));
  } else if(change?.type==='setTaskUnits') {
    object(change,['type','taskId','units'],'repair');
    const task=plan.tasks.find(t=>t.id===change.taskId);
    if(!task)fail('Unknown task');task.units=change.units;
  } else fail('Only explicit added study blocks or remaining-effort changes are supported');
  return {revision:session.revision,change:clone(change),plan,before:analyze(session.plan,session.missedDay),after:analyze(plan,session.missedDay)};
}
export function applyRepair(session,change,expectedRevision) {
  checkSession(session);
  if(expectedRevision!==session.revision)fail('Stale repair; preview the current plan again');
  const preview=previewRepair(session,change);
  if(JSON.stringify(preview.plan)===JSON.stringify(session.plan))return clone(session);
  if(session.revision===Number.MAX_SAFE_INTEGER)fail('Session revision exhausted');
  return {...clone(session),plan:preview.plan,revision:session.revision+1,history:[...clone(session.history),clone(session.plan)]};
}
export function undoRepair(session) {
  checkSession(session);
  if(!session.history.length)return clone(session);
  if(session.revision===Number.MAX_SAFE_INTEGER)fail('Session revision exhausted');
  const history=clone(session.history),plan=history.pop();analyze(plan,session.missedDay);
  return {...clone(session),plan,history,revision:session.revision+1};
}
