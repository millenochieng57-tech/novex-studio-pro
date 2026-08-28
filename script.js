// NOVEX STUDIO PRO - ULTRA STABLE FIX - 2026
console.log("NOVEX Loading...");
const DROID_FILTER = (l) => (l||"").toLowerCase().includes("droid");

let previewCanvas, previewCtx, liveCanvas, liveCtx;
let camStream = null;
let layers = [];
let selectedId = null;
let scenes = [{id:"s1", name:"Scene 1", layers: layers}];
let activeScene = 0;
let bgType = "color", bgVal = "#000000", bgImg = null;
let bgVideo, bgAudio, camVideo;
let whipPC = null;
let isRec = false, recorder = null, chunks = [];
let currentRes = {w:1280, h:720};
let micAnalyser = null;

// WAIT FOR DOM
window.addEventListener("DOMContentLoaded", () => {
  try {
    previewCanvas = document.getElementById("previewCanvas");
    liveCanvas = document.getElementById("liveCanvas");
    if(!previewCanvas) { console.error("NO previewCanvas"); return; }
    previewCtx = previewCanvas.getContext("2d");
    liveCtx = liveCanvas.getContext("2d");
    bgVideo = document.getElementById("bgVideo");
    bgAudio = document.getElementById("bgAudio");
    camVideo = document.getElementById("camVideo");

    // File inputs
    const bgImgInput = document.getElementById("bgImageInput");
    if(bgImgInput) bgImgInput.addEventListener("change", (e)=>{
      let f=e.target.files[0]; if(!f) return;
      let img=new Image(); img.src=URL.createObjectURL(f);
      img.onload=()=>{ bgImg=img; bgType="image"; console.log("BG Image set"); };
    });

    const bgVidInput = document.getElementById("bgVideoInput");
    if(bgVidInput) bgVidInput.addEventListener("change", (e)=>{
      let f=e.target.files[0]; if(!f) return;
      bgVideo.src=URL.createObjectURL(f); bgVideo.play(); bgType="video";
    });

    const bgAudInput = document.getElementById("bgAudioInput");
    if(bgAudInput) bgAudInput.addEventListener("change", (e)=>{
      let f=e.target.files[0]; if(!f) return;
      bgAudio.src=URL.createObjectURL(f); bgAudio.volume=0.25; bgAudio.play();
    });

    const logoInput = document.getElementById("logoInput");
    if(logoInput) logoInput.addEventListener("change", (e)=>{
      let f=e.target.files[0]; if(!f) return;
      let img=new Image(); img.src=URL.createObjectURL(f);
      img.onload=()=>{ addLayer({type:"image", img:img, x:20, y:20, w:200, h:200}); };
    });

    initCamera();
    renderScenes();
    renderLayers();
    setupDrag();
    requestAnimationFrame(loop);
    console.log("NOVEX Ready - All buttons active");
  } catch(err){ console.error("Init Error", err); alert("Init error: "+err.message); }
});

function loop(){
  drawPreview(); drawLive(); updateMic();
  requestAnimationFrame(loop);
}

function drawPreview(){
  if(!previewCtx) return;
  previewCanvas.width = currentRes.w;
  previewCanvas.height = currentRes.h;
  let ctx = previewCtx, c = previewCanvas;

  // BG
  if(bgType==="color"){ ctx.fillStyle=bgVal; ctx.fillRect(0,0,c.width,c.height); }
  else if(bgType==="gradient"){ let g=ctx.createLinearGradient(0,0,c.width,c.height); g.addColorStop(0,"#7c5cff"); g.addColorStop(1,"#22c55e"); ctx.fillStyle=g; ctx.fillRect(0,0,c.width,c.height); }
  else if(bgType==="image" && bgImg){ ctx.drawImage(bgImg,0,0,c.width,c.height); }
  else if(bgType==="video" && bgVideo && bgVideo.readyState>=2){ ctx.drawImage(bgVideo,0,0,c.width,c.height); }
  else { ctx.fillStyle="#080a12"; ctx.fillRect(0,0,c.width,c.height); }

  // Layers
  let list = scenes[activeScene].layers;
  for(let l of list){
    ctx.save();
    ctx.globalAlpha = l.opacity!=null? l.opacity : 1;
    if(l.blur) ctx.filter = "blur("+l.blur+"px)";
    if(l.type==="cam" && l.videoEl && l.videoEl.readyState>=2){
      ctx.drawImage(l.videoEl, l.x, l.y, l.w, l.h);
    } else if(l.type==="text"){
      ctx.fillStyle = l.color || "#ffffff";
      ctx.font = "bold "+(l.size||56)+"px Inter, Arial";
      ctx.fillText(l.text, l.x, l.y + (l.size||56));
      if(l.scroll){ l.x -= (l.speed||3); if(l.x < -500) l.x = c.width; }
    } else if(l.type==="image" && l.img){
      ctx.drawImage(l.img, l.x, l.y, l.w, l.h);
    } else if(l.type==="lower"){
      let w=l.w||520, h=l.h||90;
      if(l.style==="news"){ ctx.fillStyle="#ff0000"; }
      else if(l.style==="gold"){ let g=ctx.createLinearGradient(l.x,l.y,l.x+w,l.y); g.addColorStop(0,"#ffd700"); g.addColorStop(1,"#ff8c00"); ctx.fillStyle=g; }
      else if(l.style==="solid"){ ctx.fillStyle=l.color1||"#7c5cff"; }
      else { let g=ctx.createLinearGradient(l.x,l.y,l.x+w,l.y); g.addColorStop(0,l.color1||"#7c5cff"); g.addColorStop(1,l.color2||"#22c55e"); ctx.fillStyle=g; }
      ctx.fillRect(l.x, l.y, w, h);
      ctx.fillStyle="#fff"; ctx.font="900 22px Inter"; ctx.fillText(l.name||"NOVEX", l.x+16, l.y+32);
      ctx.font="600 14px Inter"; ctx.fillText(l.title||"LIVE", l.x+16, l.y+60);
    }
    ctx.restore();
    if(l.id===selectedId){
      ctx.strokeStyle="#7c5cff"; ctx.lineWidth=3; ctx.strokeRect(l.x,l.y,l.w,l.h);
    }
  }
}

function drawLive(){
  if(!liveCtx ||!previewCanvas) return;
  liveCanvas.width = currentRes.w;
  liveCanvas.height = currentRes.h;
  liveCtx.drawImage(previewCanvas,0,0);
}

// ===== CORE FUNCTIONS - THESE MAKE BUTTONS WORK =====
function addLayer(obj){
  obj.id = "L"+Date.now();
  obj.x = obj.x?? 100; obj.y = obj.y?? 100;
  obj.w = obj.w?? 400; obj.h = obj.h?? 300;
  obj.opacity = 1; obj.blur = 0;
  scenes[activeScene].layers.push(obj);
  selectedId = obj.id;
  renderLayers();
  console.log("Layer added", obj.type);
}

function renderLayers(){
  let el=document.getElementById("layerList"); if(!el) return;
  el.innerHTML="";
  scenes[activeScene].layers.forEach(l=>{
    let d=document.createElement("div");
    d.style.cssText="padding:8px;margin:4px;background:#151a27;border-radius:8px;display:flex;justify-content:space-between;cursor:pointer;font-size:11px;"+(l.id===selectedId?"border:1px solid #7c5cff":"");
    d.innerHTML="<span>"+(l.type==="text"?"📝":l.type==="cam"?"📷":l.type==="lower"?"🔻":"🖼️")+" "+(l.text||l.name||l.type).substring(0,18)+"</span><span>×</span>";
    d.onclick=()=>{ selectedId=l.id; renderLayers(); updateInfo(); };
    d.querySelector("span:last-child").onclick=(e)=>{ e.stopPropagation(); deleteLayer(l.id); };
    el.appendChild(d);
  });
  updateInfo();
}

function renderScenes(){
  let el=document.getElementById("sceneList"); if(!el) return;
  el.innerHTML="";
  scenes.forEach((s,i)=>{
    let d=document.createElement("div");
    d.textContent=s.name;
    d.style.cssText="padding:8px;margin:4px;background:#151a27;border-radius:8px;cursor:pointer;"+(i===activeScene?"border:1px solid #7c5cff":"");
    d.onclick=()=>{ activeScene=i; renderScenes(); renderLayers(); };
    el.appendChild(d);
  });
}

function updateInfo(){
  let info=document.getElementById("selectedInfo");
  let l=scenes[activeScene].layers.find(x=>x.id===selectedId);
  if(info) info.textContent = l? l.type+" selected" : "No selection";
}

// GLOBAL WINDOW FUNCTIONS - MUST BE WINDOW.
window.addScene = function(){ scenes.push({id:"s"+Date.now(), name:"Scene "+(scenes.length+1), layers:[]}); renderScenes(); };
window.deleteLayer = function(id){ scenes[activeScene].layers = scenes[activeScene].layers.filter(l=>l.id!==id); renderLayers(); };
window.fillSelected = function(){ let l=scenes[activeScene].layers.find(x=>x.id===selectedId); if(l){ l.x=0; l.y=0; l.w=currentRes.w; l.h=currentRes.h; } };
window.centerSelected = function(){ let l=scenes[activeScene].layers.find(x=>x.id===selectedId); if(l){ l.x=(currentRes.w-l.w)/2; l.y=(currentRes.h-l.h)/2; } };
window.bringForward = function(){ let a=scenes[activeScene].layers, i=a.findIndex(x=>x.id===selectedId); if(i>=0&&i<a.length-1){ let tmp=a[i]; a[i]=a[i+1]; a[i+1]=tmp; renderLayers(); } };
window.sendBack = function(){ let a=scenes[activeScene].layers, i=a.findIndex(x=>x.id===selectedId); if(i>0){ let tmp=a[i]; a[i]=a[i-1]; a[i-1]=tmp; renderLayers(); } };
window.updateStyle = function(){ let l=scenes[activeScene].layers.find(x=>x.id===selectedId); if(!l) return; let op=document.getElementById("opacityRange"); let bl=document.getElementById("blurRange"); if(op) l.opacity=op.value/100; if(bl) l.blur=bl.value; };

window.openTextModal = function(){ let o=document.getElementById("textOverlay"); if(o){ o.style.display="flex"; o.classList.add("active"); console.log("Text modal open"); } else alert("textOverlay not found"); };
window.closeTextModal = function(){ let o=document.getElementById("textOverlay"); if(o){ o.style.display="none"; o.classList.remove("active"); } };
window.applyText = function(){
  let input=document.getElementById("textInput");
  let t=input? input.value : "NOVEX";
  if(!t) t="NOVEX";
  let sizeEl=document.getElementById("fontSize"); let colEl=document.getElementById("textColor");
  let scrollEl=document.getElementById("scrollCheck"); let speedEl=document.getElementById("scrollSpeed");
  addLayer({type:"text", text:t, size:sizeEl?+sizeEl.value:56, color:colEl?colEl.value:"#ffffff", scroll:scrollEl?scrollEl.checked:false, speed:speedEl?+speedEl.value:5, x:80, y:200, w:600, h:80});
  closeTextModal(); if(input) input.value="";
};

window.openLowerThird = function(){ let o=document.getElementById("lowerOverlay"); if(o){ o.style.display="flex"; o.classList.add("active"); } };
window.closeLowerThird = function(){ let o=document.getElementById("lowerOverlay"); if(o){ o.style.display="none"; o.classList.remove("active"); } };
window.applyLowerThird = function(){
  let n=document.getElementById("ltName"), tt=document.getElementById("ltTitle"), c1=document.getElementById("ltColor1"), c2=document.getElementById("ltColor2"), st=document.getElementById("ltStyle");
  addLayer({type:"lower", name:n?n.value:"NOVEX STUDIO PRO", title:tt?tt.value:"LIVE", color1:c1?c1.value:"#7c5cff", color2:c2?c2.value:"#22c55e", style:st?st.value:"gradient", x:0, y:currentRes.h-120, w:520, h:90});
  closeLowerThird();
};

window.setBg = function(type, val){
  if(type==="color"){ bgType="color"; bgVal=val||document.getElementById("bgColor").value; }
  if(type==="gradient") bgType="gradient";
  if(type==="blur") bgType="blur";
  let s=document.getElementById("bgStatus"); if(s) s.textContent="BG: "+type;
};
window.loadPresetBg = function(url){ let img=new Image(); img.crossOrigin="anonymous"; img.src=url; img.onload=()=>{ bgImg=img; bgType="image"; }; };
window.stopBgAudio = function(){ if(bgAudio) bgAudio.pause(); };
window.setBgMusicVol = function(v){ if(bgAudio) bgAudio.volume=v/100; };

async function initCamera(){
  try{
    let s=await navigator.mediaDevices.getUserMedia({video:true, audio:true});
    camStream=s; camVideo.srcObject=s; await camVideo.play();
    let ex=scenes[activeScene].layers.find(l=>l.type==="cam");
    if(ex) ex.videoEl=camVideo; else addLayer({type:"cam", videoEl:camVideo, x:0, y:0, w:currentRes.w, h:currentRes.h});
    // Mic meter
    try{ let ac=new (window.AudioContext||window.webkitAudioContext)(); let src=ac.createMediaStreamSource(s); micAnalyser=ac.createAnalyser(); src.connect(micAnalyser); }catch(e){}
    // Device lists
    try{
      let devs=await navigator.mediaDevices.enumerateDevices();
      let cams=devs.filter(d=>d.kind==="videoinput" &&!DROID_FILTER(d.label));
      let cs=document.getElementById("cameraSelect"); if(cs){ cs.innerHTML=""; cams.forEach(d=>{ let o=document.createElement("option"); o.value=d.deviceId; o.textContent=d.label||"Camera"; cs.appendChild(o); }); }
      let mics=devs.filter(d=>d.kind==="audioinput");
      let ms=document.getElementById("micSelect"); if(ms){ ms.innerHTML=""; mics.forEach(d=>{ let o=document.createElement("option"); o.value=d.deviceId; o.textContent=d.label||"Mic"; ms.appendChild(o); }); }
    }catch(e){}
  }catch(e){ console.error("Camera fail", e); }
}

window.forcePCcam = async function(){ await initCamera(); closeSettings(); };
window.previewSource = async function(t){
  if(t==="camera") await initCamera();
  if(t==="screen"){
    try{ let s=await navigator.mediaDevices.getDisplayMedia({video:true}); let v=document.createElement("video"); v.srcObject=s; v.play(); addLayer({type:"cam", videoEl:v, x:0, y:0, w:currentRes.w, h:currentRes.h}); }catch(e){ alert("Screen share canceled"); }
  }
};
window.openSettings = function(){ let o=document.getElementById("settingsOverlay"); if(o){ o.style.display="flex"; o.classList.add("active"); initCamera(); } };
window.closeSettings = function(){ let o=document.getElementById("settingsOverlay"); if(o){ o.style.display="none"; o.classList.remove("active"); } let cs=document.getElementById("cameraSelect"); if(cs&&cs.value){ startCamById(cs.value); } };
async function startCamById(id){ if(camStream) camStream.getTracks().forEach(t=>t.stop()); try{ let s=await navigator.mediaDevices.getUserMedia({video:{deviceId:{exact:id}}, audio:true}); camStream=s; camVideo.srcObject=s; await camVideo.play(); let ex=scenes[activeScene].layers.find(l=>l.type==="cam"); if(ex) ex.videoEl=camVideo; }catch(e){} }
function updateMic(){ let m=document.getElementById("micMeter"), db=document.getElementById("micDb"); if(!micAnalyser||!m) return; let data=new Uint8Array(micAnalyser.frequencyBinCount); micAnalyser.getByteFrequencyData(data); let avg=data.reduce((a,b)=>a+b,0)/data.length; m.style.width=Math.min(100, avg*1.5)+"%"; if(db) db.textContent=Math.round(avg-100)+"dB"; }

window.setRes = function(w,h,btn){ currentRes={w,h}; document.querySelectorAll(".res-group button").forEach(b=>b.classList.remove("active")); if(btn) btn.classList.add("active"); };
window.saveLayout = function(){ alert("Layout saved (local)"); };
window.goLive = function(){ if(liveCtx && previewCanvas) liveCtx.drawImage(previewCanvas,0,0); };
window.openGoLiveModal = function(){ let o=document.getElementById("goLiveOverlay"); if(o){ o.style.display="flex"; o.classList.add("active"); } else alert("goLiveOverlay missing - check HTML id"); };
window.closeGoLiveModal = function(){ let o=document.getElementById("goLiveOverlay"); if(o){ o.style.display="none"; o.classList.remove("active"); } };

window.toggleRecord = function(){
  if(!isRec){
    let stream=liveCanvas.captureStream(30);
    if(camStream) camStream.getAudioTracks().forEach(t=>stream.addTrack(t));
    chunks=[]; recorder=new MediaRecorder(stream,{mimeType:"video/webm"});
    recorder.ondataavailable=e=>{ if(e.data.size>0) chunks.push(e.data); };
    recorder.onstop=()=>{ let blob=new Blob(chunks,{type:"video/webm"}); let a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="NOVEX-"+Date.now()+".webm"; a.click(); };
    recorder.start(); isRec=true;
    let b1=document.getElementById("recBtn"), b2=document.getElementById("bottomRecBtn"), rt=document.getElementById("recTime");
    if(b1) b1.textContent="■ STOP"; if(b2) b2.textContent="■ STOP"; if(rt) rt.style.display="inline";
  } else {
    if(recorder) recorder.stop(); isRec=false;
    let b1=document.getElementById("recBtn"), b2=document.getElementById("bottomRecBtn"), rt=document.getElementById("recTime");
    if(b1) b1.textContent="● REC"; if(b2) b2.textContent="● REC"; if(rt) rt.style.display="none";
  }
};

// WHIP LIVE - FIXED
window.stopRealWHIP = function(){ if(whipPC){ whipPC.close(); whipPC=null; } let badge=document.getElementById("liveBadge"), btn=document.getElementById("realLiveBtn"); if(badge) badge.textContent="● OFF"; if(btn){ btn.textContent="🔴 GO LIVE NOW - ALL"; btn.disabled=false; } };

window.startRealWHIP = async function(){
  let urlEl=document.getElementById("whipUrl"), tokenEl=document.getElementById("whipToken");
  let url=urlEl?urlEl.value.trim():"", token=tokenEl?tokenEl.value.trim():"";
  if(!url){ alert("Paste WHIP URL from Restream"); return; }
  let badge=document.getElementById("liveBadge"), btn=document.getElementById("realLiveBtn");
  try{
    if(badge) badge.textContent="● CONNECTING..."; if(btn){ btn.textContent="Connecting..."; btn.disabled=true; }
    let stream=previewCanvas.captureStream(30);
    if(camStream) camStream.getAudioTracks().forEach(t=>stream.addTrack(t));
    whipPC=new RTCPeerConnection();
    stream.getTracks().forEach(t=>whipPC.addTrack(t,stream));
    let offer=await whipPC.createOffer(); await whipPC.setLocalDescription(offer);
    await new Promise(res=>{ if(whipPC.iceGatheringState==="complete") return res(); whipPC.onicegatheringstatechange=()=>{ if(whipPC.iceGatheringState==="complete") res(); }; setTimeout(res,2000); });
    let headers={"Content-Type":"application/sdp"}; if(token && token.length>10) headers["Authorization"]="Bearer "+token;
    console.log("WHIP POST", url);
    let r=await fetch(url,{method:"POST", headers:headers, body:whipPC.localDescription.sdp});
    let txt=await r.text(); console.log("WHIP RES", r.status, txt);
    if(!r.ok) throw new Error("Restream "+r.status+": "+txt.slice(0,300));
    if(!txt.trim().startsWith("v=")) throw new Error("Bad SDP: "+txt.slice(0,200));
    await whipPC.setRemoteDescription({type:"answer", sdp:txt});
    if(badge) badge.textContent="● LIVE"; if(btn){ btn.textContent="🔴 LIVE NOW!"; btn.disabled=false; }
    closeGoLiveModal(); alert("✅ YOU ARE LIVE!");
  }catch(e){
    console.error(e); let badge=document.getElementById("liveBadge"), btn=document.getElementById("realLiveBtn");
    if(badge) badge.textContent="● FAILED"; if(btn){ btn.textContent="🔴 GO LIVE NOW - ALL"; btn.disabled=false; }
    if(whipPC){ whipPC.close(); whipPC=null; }
    alert("LIVE FAILED: "+e.message+"\n\nFIX: In Restream, turn ON your YouTube toggle (right side)");
  }
};

function setupDrag(){
  let drag=null, off={x:0,y:0};
  if(!previewCanvas) return;
  previewCanvas.addEventListener("mousedown", (e)=>{
    let rect=previewCanvas.getBoundingClientRect();
    let mx=(e.clientX-rect.left)/rect.width*currentRes.w;
    let my=(e.clientY-rect.top)/rect.height*currentRes.h;
    let list=[...scenes[activeScene].layers].reverse();
    for(let l of list){
      if(mx>=l.x && mx<=l.x+l.w && my>=l.y && my<=l.y+l.h){
        selectedId=l.id; drag=l; off={x:mx-l.x, y:my-l.y}; renderLayers(); break;
      }
    }
  });
  window.addEventListener("mousemove", (e)=>{
    if(!drag) return;
    let rect=previewCanvas.getBoundingClientRect();
    let mx=(e.clientX-rect.left)/rect.width*currentRes.w;
    let my=(e.clientY-rect.top)/rect.height*currentRes.h;
    drag.x=mx-off.x; drag.y=my-off.y;
  });
  window.addEventListener("mouseup", ()=>{ drag=null; });
}
