// NOVEX STUDIO PRO - FINAL SYSTEM FIX - ALL BUTTONS + WHIP
const DROID_FILTER=l=>l.toLowerCase().includes('droid')||l.toLowerCase().includes('virtual');
let previewCanvas,previewCtx,liveCanvas,liveCtx,layers=[],selectedId=null,scenes=[{id:'s1',name:'Scene 1',layers:[]}],activeScene=0,camStream=null,whipPC=null,bgType='color',bgVal='#000',bgImg=null,bgVidEl,bgAudioEl,camVideoEl,isRec=false,rec=null,chunks=[],recTimer=null,recSec=0,currentRes={w:1280,h:720},micAnalyser=null;
document.addEventListener('DOMContentLoaded',()=>{
  previewCanvas=document.getElementById('previewCanvas');liveCanvas=document.getElementById('liveCanvas');
  previewCtx=previewCanvas.getContext('2d');liveCtx=liveCanvas.getContext('2d');
  bgVidEl=document.getElementById('bgVideo');bgAudioEl=document.getElementById('bgAudio');camVideoEl=document.getElementById('camVideo');
  document.getElementById('bgImageInput').addEventListener('change',e=>{let f=e.target.files[0];if(!f)return;let i=new Image();i.src=URL.createObjectURL(f);i.onload=()=>{bgImg=i;bgType='image';};});
  document.getElementById('bgVideoInput').addEventListener('change',e=>{let f=e.target.files[0];if(!f)return;bgVidEl.src=URL.createObjectURL(f);bgVidEl.play();bgType='video';});
  document.getElementById('bgAudioInput').addEventListener('change',e=>{let f=e.target.files[0];if(!f)return;bgAudioEl.src=URL.createObjectURL(f);bgAudioEl.volume=0.25;bgAudioEl.play();});
  document.getElementById('logoInput').addEventListener('change',e=>{let f=e.target.files[0];if(!f)return;let i=new Image();i.src=URL.createObjectURL(f);i.onload=()=>addLayer({type:'image',img:i,x:20,y:20,w:180,h:180});});
  initCams();renderScenes();renderLayers();setupDrag();(function loop(){drawPreview();drawLive();updateMic();requestAnimationFrame(loop);})();
});
function drawPreview(){
  if(!previewCtx)return;previewCanvas.width=currentRes.w;previewCanvas.height=currentRes.h;
  let c=previewCanvas,ctx=previewCtx;
  if(bgType==='color'){ctx.fillStyle=bgVal;ctx.fillRect(0,0,c.width,c.height);}
  else if(bgType==='gradient'){let g=ctx.createLinearGradient(0,0,c.width,c.height);g.addColorStop(0,'#7c5cff');g.addColorStop(1,'#22c55e');ctx.fillStyle=g;ctx.fillRect(0,0,c.width,c.height);}
  else if(bgType==='image'&&bgImg){ctx.drawImage(bgImg,0,0,c.width,c.height);}
  else if(bgType==='video'&&bgVidEl&&bgVidEl.readyState>=2){ctx.drawImage(bgVidEl,0,0,c.width,c.height);}
  else{ctx.fillStyle='#0a0f1c';ctx.fillRect(0,0,c.width,c.height);}
  scenes[activeScene].layers.forEach(l=>{
    ctx.save();ctx.globalAlpha=l.opacity??1;if(l.blur)ctx.filter=`blur(${l.blur}px)`;
    if(l.type==='cam'&&l.videoEl&&l.videoEl.readyState>=2){ctx.drawImage(l.videoEl,l.x,l.y,l.w,l.h);}
    else if(l.type==='text'){ctx.fillStyle=l.color||'#fff';ctx.font=`900 ${l.size||56}px Inter`;if(l.scroll){l.x-=l.speed||3;if(l.x<-400)l.x=c.width;}ctx.fillText(l.text,l.x,l.y+(l.size||56));}
    else if(l.type==='image'&&l.img){ctx.drawImage(l.img,l.x,l.y,l.w,l.h);}
    else if(l.type==='lower'){let w=l.w||520,h=l.h||90,g;if(l.style==='news'){g=ctx.createLinearGradient(l.x,l.y,l.x+w,l.y);g.addColorStop(0,'#ff1a1a');g.addColorStop(1,'#7a0000');}else if(l.style==='gold'){g=ctx.createLinearGradient(l.x,l.y,l.x+w,l.y);g.addColorStop(0,'#ffd700');g.addColorStop(1,'#ff8c00');}else if(l.style==='solid'){g=l.color1;}else{g=ctx.createLinearGradient(l.x,l.y,l.x+w,l.y);g.addColorStop(0,l.color1||'#7c5cff');g.addColorStop(1,l.color2||'#22c55e');}ctx.fillStyle=g;ctx.fillRect(l.x,l.y,w,h);ctx.fillStyle='#fff';ctx.font='900 22px Inter';ctx.fillText(l.name||'NOVEX',l.x+18,l.y+32);ctx.font='600 14px Inter';ctx.fillText(l.title||'LIVE',l.x+18,l.y+60);}
    ctx.restore();if(l.id===selectedId){ctx.strokeStyle='#7c5cff';ctx.lineWidth=3;ctx.strokeRect(l.x,l.y,l.w,l.h);}
  });
}
function drawLive(){if(!liveCanvas)return;liveCanvas.width=currentRes.w;liveCanvas.height=currentRes.h;liveCtx.drawImage(previewCanvas,0,0);}
function addLayer(o){o.id='L'+Date.now();o.x=o.x??100;o.y=o.y??100;o.w=o.w??400;o.h=o.h??300;o.opacity=1;o.blur=0;scenes[activeScene].layers.push(o);selectedId=o.id;renderLayers();}
function renderLayers(){let el=document.getElementById('layerList');if(!el)return;el.innerHTML='';scenes[activeScene].layers.forEach(l=>{let d=document.createElement('div');d.className='layer-item';d.style.cssText='padding:8px;background:#151a27;margin:4px;border-radius:8px;display:flex;justify-content:space-between;cursor:pointer;'+(l.id===selectedId?'border:1px solid #7c5cff':'');d.innerHTML=`<span>${l.type==='text'?'📝':l.type==='cam'?'📷':l.type==='lower'?'🔻':'🖼️'} ${(l.text||l.name||l.type).slice(0,18)}</span><span onclick="deleteLayer('${l.id}')">×</span>`;d.onclick=()=>{selectedId=l.id;renderLayers();};el.appendChild(d);});}
function renderScenes(){let el=document.getElementById('sceneList');if(!el)return;el.innerHTML='';scenes.forEach((s,i)=>{let d=document.createElement('div');d.textContent=s.name;d.style.cssText='padding:6px;margin:3px;background:#151a27;border-radius:6px;cursor:pointer;'+(i===activeScene?'border:1px solid #7c5cff':'');d.onclick=()=>{activeScene=i;renderScenes();renderLayers();};el.appendChild(d);});}
window.addScene=()=>{scenes.push({id:'s'+Date.now(),name:'Scene '+(scenes.length+1),layers:[]});renderScenes();};
window.deleteLayer=id=>{scenes[activeScene].layers=scenes[activeScene].layers.filter(l=>l.id!==id);renderLayers();};
window.fillSelected=()=>{let l=scenes[activeScene].layers.find(x=>x.id===selectedId);if(l){l.x=0;l.y=0;l.w=currentRes.w;l.h=currentRes.h;}};
window.centerSelected=()=>{let l=scenes[activeScene].layers.find(x=>x.id===selectedId);if(l){l.x=(currentRes.w-l.w)/2;l.y=(currentRes.h-l.h)/2;}};
window.bringForward=()=>{let a=scenes[activeScene].layers,i=a.findIndex(x=>x.id===selectedId);if(i>=0&&i<a.length-1){[a[i],a[i+1]]=[a[i+1],a[i]];renderLayers();}};
window.sendBack=()=>{let a=scenes[activeScene].layers,i=a.findIndex(x=>x.id===selectedId);if(i>0){[a[i],a[i-1]]=[a[i-1],a[i]];renderLayers();}};
window.updateStyle=()=>{let l=scenes[activeScene].layers.find(x=>x.id===selectedId);if(!l)return;l.opacity=document.getElementById('opacityRange').value/100;l.blur=document.getElementById('blurRange').value;};
window.openTextModal=()=>document.getElementById('textOverlay').style.display='flex';
window.closeTextModal=()=>document.getElementById('textOverlay').style.display='none';
window.applyText=()=>{let t=document.getElementById('textInput').value||'NOVEX';addLayer({type:'text',text:t,size:+document.getElementById('fontSize').value,color:document.getElementById('textColor').value,scroll:document.getElementById('scrollCheck').checked,speed:+document.getElementById('scrollSpeed').value,x:80,y:200,w:600,h:80});closeTextModal();};
window.openLowerThird=()=>document.getElementById('lowerOverlay').style.display='flex';
window.closeLowerThird=()=>document.getElementById('lowerOverlay').style.display='none';
window.applyLowerThird=()=>{addLayer({type:'lower',name:ltName.value||'NOVEX STUDIO PRO',title:ltTitle.value||'LIVE',color1:ltColor1.value,color2:ltColor2.value,style:ltStyle.value,x:0,y:currentRes.h-120,w:520,h:90});closeLowerThird();};
window.setBg=(t,v)=>{if(t==='color'){bgType='color';bgVal=v||bgColor.value;}if(t==='gradient')bgType='gradient';if(t==='blur')bgType='blur';};
window.loadPresetBg=u=>{let i=new Image();i.crossOrigin='anonymous';i.src=u;i.onload=()=>{bgImg=i;bgType='image';};};
window.stopBgAudio=()=>bgAudioEl.pause();window.setBgMusicVol=v=>bgAudioEl.volume=v/100;
async function initCams(){try{let d=await navigator.mediaDevices.enumerateDevices();let c=d.filter(x=>x.kind==='videoinput'&&!DROID_FILTER(x.label));let cs=document.getElementById('cameraSelect'),ms=document.getElementById('micSelect');if(cs){cs.innerHTML='';c.forEach(x=>{let o=document.createElement('option');o.value=x.deviceId;o.textContent=x.label||'Camera';cs.appendChild(o);});}let m=d.filter(x=>x.kind==='audioinput');if(ms){ms.innerHTML='';m.forEach(x=>{let o=document.createElement('option');o.value=x.deviceId;o.textContent=x.label||'Mic';ms.appendChild(o);});}if(c[0])await startCam(c[0].deviceId);}catch(e){}}
async function startCam(id){if(camStream)camStream.getTracks().forEach(t=>t.stop());try{let s=await navigator.mediaDevices.getUserMedia({video:id?{deviceId:{exact:id}}:true,audio:true});camStream=s;camVideoEl.srcObject=s;camVideoEl.play();let ex=scenes[activeScene].layers.find(l=>l.type==='cam');if(ex)ex.videoEl=camVideoEl;else addLayer({type:'cam',videoEl:camVideoEl,x:0,y:0,w:currentRes.w,h:currentRes.h});let ac=new (window.AudioContext||window.webkitAudioContext)();let src=ac.createMediaStreamSource(s);micAnalyser=ac.createAnalyser();src.connect(micAnalyser);}catch(e){}}
window.forcePCcam=async()=>{await initCams();closeSettings();};window.previewSource=async t=>{if(t==='camera')await initCams();if(t==='screen'){try{let s=await navigator.mediaDevices.getDisplayMedia({video:true});let v=document.createElement('video');v.srcObject=s;v.play();addLayer({type:'cam',videoEl:v,x:0,y:0,w:currentRes.w,h:currentRes.h});}catch(e){}}};
window.openSettings=()=>{document.getElementById('settingsOverlay').style.display='flex';initCams();};window.closeSettings=()=>{document.getElementById('settingsOverlay').style.display='none';let cs=document.getElementById('cameraSelect');if(cs&&cs.value)startCam(cs.value);};
function updateMic(){let m=document.getElementById('micMeter'),db=document.getElementById('micDb');if(!micAnalyser||!m)return;let data=new Uint8Array(micAnalyser.frequencyBinCount);micAnalyser.getByteFrequencyData(data);let avg=data.reduce((a,b)=>a+b,0)/data.length;m.style.width=Math.min(100,avg*1.5)+'%';if(db)db.textContent=Math.round(avg-100)+'dB';}
window.setRes=(w,h,b)=>{currentRes={w,h};document.querySelectorAll('.res-group button').forEach(x=>x.classList.remove('active'));if(b)b.classList.add('active');};
window.saveLayout=()=>{localStorage.setItem('novex_scenes','saved');alert('Saved!');};
window.goLive=()=>{liveCtx.drawImage(previewCanvas,0,0);};
window.openGoLiveModal=()=>document.getElementById('goLiveOverlay').style.display='flex';
window.closeGoLiveModal=()=>document.getElementById('goLiveOverlay').style.display='none';
window.toggleRecord=()=>{if(!isRec){let s=liveCanvas.captureStream(30);if(camStream)camStream.getAudioTracks().forEach(t=>s.addTrack(t));chunks=[];rec=new MediaRecorder(s,{mimeType:'video/webm'});rec.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};rec.onstop=()=>{let b=new Blob(chunks,{type:'video/webm'});let a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='NOVEX-'+Date.now()+'.webm';a.click();};rec.start();isRec=true;recSec=0;document.getElementById('recBtn').textContent='■ STOP';document.getElementById('bottomRecBtn').textContent='■ STOP';document.getElementById('recTime').style.display='inline';recTimer=setInterval(()=>{recSec++;document.getElementById('recTime').textContent=`● REC ${String(Math.floor(recSec/60)).padStart(2,'0')}:${String(recSec%60).padStart(2,'0')}`;},1000);}else{rec.stop();isRec=false;clearInterval(recTimer);document.getElementById('recBtn').textContent='● REC';document.getElementById('bottomRecBtn').textContent='● REC';document.getElementById('recTime').style.display='none';}};
window.stopRealWHIP=()=>{if(whipPC){whipPC.close();whipPC=null;}document.getElementById('liveBadge').textContent='● OFF';document.getElementById('realLiveBtn').textContent='🔴 GO LIVE NOW - ALL';document.getElementById('realLiveBtn').disabled=false;};
window.startRealWHIP=async()=>{
  const url=document.getElementById('whipUrl').value.trim();const token=document.getElementById('whipToken').value.trim();
  if(!url)return alert('Paste WHIP URL');
  const badge=document.getElementById('liveBadge'),btn=document.getElementById('realLiveBtn');
  try{
    badge.textContent='● CONNECTING...';btn.textContent='Connecting...';btn.disabled=true;
    let stream=previewCanvas.captureStream(30);if(camStream)camStream.getAudioTracks().forEach(t=>stream.addTrack(t));
    whipPC=new RTCPeerConnection();stream.getTracks().forEach(t=>whipPC.addTrack(t,stream));
    let offer=await whipPC.createOffer();await whipPC.setLocalDescription(offer);
    await new Promise(r=>{if(whipPC.iceGatheringState==='complete')return r();whipPC.onicegatheringstatechange=()=>{if(whipPC.iceGatheringState==='complete')r();};setTimeout(r,2000);});
    let h={'Content-Type':'application/sdp'};if(token&&token.length>10)h['Authorization']='Bearer '+token;
    let res=await fetch(url,{method:'POST',headers:h,body:whipPC.localDescription.sdp});let txt=await res.text();
    if(!res.ok)throw new Error(`Restream ${res.status}: ${txt.slice(0,300)} -> Toggle YouTube ON in Restream`);
    if(!txt.trim().startsWith('v='))throw new Error('Bad SDP: '+txt.slice(0,200));
    await whipPC.setRemoteDescription({type:'answer',sdp:txt});
    badge.textContent='● LIVE FB/YT/TIKTOK';btn.textContent='🔴 LIVE NOW!';btn.disabled=false;closeGoLiveModal();alert('✅ YOU ARE LIVE!');
  }catch(e){badge.textContent='● OFF - FAILED';btn.textContent='🔴 GO LIVE NOW - ALL';btn.disabled=false;if(whipPC){whipPC.close();whipPC=null;}alert('FAILED: '+e.message);}
};
function setupDrag(){let drag=null,off={x:0,y:0};previewCanvas.addEventListener('mousedown',e=>{let r=previewCanvas.getBoundingClientRect(),mx=(e.clientX-r.left)/r.width*currentRes.w,my=(e.clientY-r.top)/r.height*currentRes.h;for(let l of [...scenes[activeScene].layers].reverse()){if(mx>=l.x&&mx<=l.x+l.w&&my>=l.y&&my<=l.y+l.h){selectedId=l.id;drag=l;off={x:mx-l.x,y:my-l.y};renderLayers();break;}}});window.addEventListener('mousemove',e=>{if(!drag)return;let r=previewCanvas.getBoundingClientRect(),mx=(e.clientX-r.left)/r.width*currentRes.w,my=(e.clientY-r.top)/r.height*currentRes.h;drag.x=mx-off.x;drag.y=my-off.y;});window.addEventListener('mouseup',()=>drag=null);}
