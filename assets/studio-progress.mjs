export function formatElapsed(ms){
 const seconds=Math.floor(Math.max(0,ms)/1000);
 return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
}
// Wall-clock timestamps stay accurate when a background tab throttles intervals.
// This measures elapsed time, not a server heartbeat or an estimated completion.
export function createProgressClock(now=()=>Date.now()){
 let start=null,stageStart=null,end=null,stage='';
 return {
  start(){start=stageStart=now();end=null;stage='';},
  stage(label){if(end===null&&start!==null&&label!==stage){stage=label;stageStart=now();}},
  stop(){if(start!==null&&end===null)end=now();},
  read(){const at=end??now();return {started:start!==null,running:start!==null&&end===null,total:start===null?0:at-start,stage:stageStart===null?0:at-stageStart};}
 };
}
