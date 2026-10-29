export function initMobileControls({onMove,onRun,onAttack,onInteract,onZoom}){
 const $=id=>document.getElementById(id), pad=$('mobile-joystick'),ring=$('mobile-joystick-ring'),knob=$('mobile-knob');
 if(!pad||!ring||!knob)return;
 let pointer=null,running=false;
 const reset=()=>{pointer=null;knob.style.transform='translate(0,0)';onMove(0,0)};
 function move(e){const r=ring.getBoundingClientRect(),rad=r.width*.32,dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,d=Math.hypot(dx,dy),m=Math.min(rad,d),scale=d?m/d:0;
 knob.style.transform=`translate(${dx*scale}px,${dy*scale}px)`;
 const strength=d/rad<.15?0:(Math.min(1,d/rad)-.15)/.85;
 onMove(d?dx/d*strength:0,d?-dy/d*strength:0);}
 pad.addEventListener('pointerdown',e=>{if(pointer!==null)return;e.preventDefault();pointer=e.pointerId;pad.setPointerCapture(pointer);move(e)});
 pad.addEventListener('pointermove',e=>{if(e.pointerId===pointer){e.preventDefault();move(e)}});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(type,e=>{if(pointer===e.pointerId)reset()});
 const run=$('mobile-run');
 run?.addEventListener('click',()=>{running=!running;run.classList.toggle('active',running);run.setAttribute('aria-pressed',String(running));onRun(running)});
 $('mobile-attack')?.addEventListener('click',onAttack);
 $('mobile-interact')?.addEventListener('click',onInteract);
 $('mobile-zoom-in')?.addEventListener('click',()=>onZoom(-1.6));
 $('mobile-zoom-out')?.addEventListener('click',()=>onZoom(1.6));
 const settings=$('mobile-settings');
 const close=()=>{document.body.classList.remove('mobile-settings-open');settings?.setAttribute('aria-expanded','false')};
 settings?.addEventListener('click',()=>{const open=document.body.classList.toggle('mobile-settings-open');settings.setAttribute('aria-expanded',String(open))});
 const clear=()=>{reset();if(running){running=false;run?.classList.remove('active');run?.setAttribute('aria-pressed','false');onRun(false)}close()};
 document.addEventListener('topweb:menu-open',clear);
 window.addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear()});
}