/** Invented teaching fixture, not a real student's calendar. */
export const samplePlan = {
  horizon: {startDay:'2026-11-09',endDay:'2026-11-15'},
  tasks: [
    {id:'practice',title:'Practice problem set',units:6,deadline:{day:'2026-11-13',time:'18:00'}},
    {id:'outline',title:'Draft essay outline',units:4,deadline:{day:'2026-11-15',time:'18:00'}}
  ],
  blocks: [
    {id:'mon',label:'Monday study',day:'2026-11-09',start:'16:00',end:'18:00'},
    {id:'wed',label:'Wednesday study',day:'2026-11-11',start:'16:00',end:'18:00'},
    {id:'sun',label:'Sunday study',day:'2026-11-15',start:'12:00',end:'16:00'}
  ],
  commitments:[{id:'appointment',label:'Protected appointment',day:'2026-11-09',start:'17:00',end:'18:00'}]
};
export const missedDay='2026-11-11';
export const earlyRepair={type:'addBlock',block:{id:'thu',label:'Explicit extra Thursday time',day:'2026-11-12',start:'16:00',end:'18:00'}};
export const lateRepair={type:'addBlock',block:{id:'sat',label:'Extra Saturday time (too late)',day:'2026-11-14',start:'16:00',end:'18:00'}};
