// NOVEX STUDIO PRO - FULL FIXED - WHIP MULTI-STREAM PATCH
let previewCanvas, previewCtx, liveCanvas, liveCtx;
let previewStream, whipPC=null;
let isRecording=false, mediaRecorder, recordedChunks=[];
let activeSource=null;
let sources={
  cam:{active:false, stream:null, videoEl:null},
  screen:{active:false, stream:null, videoEl:null},
  guest:{active:false, stream:null, videoEl:null}
};

window.addEventListener('DOMContentLoaded',()=>{
  previewCanvas=document.getElementById('previewCanvas');
  liveCanvas=document.getElementById('liveCanvas');
  if(!previewCanvas||!liveCanvas) return;
  previewCtx=previewCanvas.getContext('2d');
  liveCtx=liveCanvas.getContext('2d');

  // Setup canvases
  const resize=()=>{
    [previewCanvas, liveCanvas].forEach(c=>{
      c.width=1280; c.height=720;
    });
    draw();
  };
  resize();

  // Start cam auto
  startCamera();

  // Loop draw
  setInterval(draw, 1000/30);
});

async function startCamera(){
  try{
    const s=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
    sources.cam.stream=s;
    sources.cam.active=true;
    const v=document.createElement('video');
    v.srcObject=s; v.muted=true; v.play();
    sources.cam.videoEl=v;
    activeSource='cam';
    previewStream=s;
  }catch(e){console.error('Cam failed',e);}
}

function draw(){
  if(!previewCtx||!liveCtx) return;
  // PREVIEW
  previewCtx.fillStyle='#0a0f1c';
  previewCtx.fillRect(0,0,previewCanvas.width,previewCanvas.height);

  let src=sources[activeSource]?.videoEl || sources.cam.videoEl;
  if(src && src.readyState>=2){
    previewCtx.drawImage(src,0,0,previewCanvas.width,previewCanvas.height);
  } else {
    previewCtx.fillStyle='#fff';
    previewCtx.font='24px Arial';
    previewCtx.fillText('NOVEX PREVIEW - Click CAM / SCREEN / GUEST',20,40);
  }

  // LIVE (mirror preview for now)
  liveCtx.drawImage(previewCanvas,0,0);
}

// SOURCE SWITCH
window.cutToLive=()=>{
  if(activeSource) liveCtx.drawImage(previewCanvas,0,0);
}
window.switchSource=(type)=>{
  if(sources[type]?.active) activeSource=type;
}

// GO LIVE MODAL
window.openGoLiveModal=()=>{
  document.getElementById('goLiveModal').style.display='flex';
}
window.closeGoLiveModal=()=>{
  document.getElementById('goLiveModal').style.display='none';
}

// --- THIS IS THE FIXED FUNCTION YOU ASKED FOR ---
async function startRealWHIP(){
  const urlEl=document.getElementById('whipUrl');
  const tokenEl=document.getElementById('whipToken');
  const url=urlEl.value.trim();
  const token=tokenEl.value.trim();

  if(!url){
    return alert('Paste WHIP URL from Restream -> WHIP BETA tab');
  }

  const liveBadge=document.getElementById('liveBadge');
  const btn=document.getElementById('realLiveBtn');

  try{
    liveBadge.textContent='● CONNECTING...';
    btn.textContent='Connecting...';
    btn.disabled=true;

    // Get stream from preview canvas + mic
    const cs=previewCanvas.captureStream(30);
    if(previewStream) {
      previewStream.getAudioTracks().forEach(t=>cs.addTrack(t));
    } else {
      const mic=await navigator.mediaDevices.getUserMedia({audio:true});
      mic.getAudioTracks().forEach(t=>cs.addTrack(t));
    }

    whipPC=new RTCPeerConnection();
    cs.getTracks().forEach(t=>whipPC.addTrack(t,cs));

    const offer=await whipPC.createOffer();
    await whipPC.setLocalDescription(offer);

    // Wait ICE
    await new Promise(res=>{
      if(whipPC.iceGatheringState==='complete') return res();
      whipPC.onicegatheringstatechange=()=>{
        if(whipPC.iceGatheringState==='complete') res();
      };
      setTimeout(res,2000);
    });

    const headers={'Content-Type':'application/sdp'};
    // Only add Bearer if user pasted rk_... token (Restream new format)
    // If URL already has re_... key, NO token needed
    if(token && token.length>10){
      headers['Authorization']='Bearer '+token;
    }

    console.log('Sending WHIP to:', url);
    const r=await fetch(url,{
      method:'POST',
      headers:headers,
      body:whipPC.localDescription.sdp
    });

    const text=await r.text();
    console.log('WHIP Response:', r.status, text);

    if(!r.ok){
      // Show real Restream error
      throw new Error(`Restream rejected (${r.status}): ${text.substring(0,300)} \n\nFIX: In Restream -> Toggle your YouTube ON -> Add Channel if empty -> Free plan max 30min`);
    }

    if(!text.trim().startsWith('v=')){
      throw new Error('Restream did not return SDP. Response: '+text.substring(0,300));
    }

    await whipPC.setRemoteDescription({type:'answer',sdp:text});

    liveBadge.textContent='● LIVE FB/YT/TIKTOK';
    liveBadge.style.color='#00ff88';
    document.getElementById('recTime').style.display='inline';
    document.getElementById('recTime').textContent='● LIVE NOVEX';
    btn.textContent='🔴 LIVE NOW!';
    btn.disabled=false;
    closeGoLiveModal();
    alert('✅ YOU ARE LIVE! Check YouTube Studio -> Go Live dashboard');

  }catch(e){
    console.error(e);
    liveBadge.textContent='● OFFLINE - FAILED';
    btn.textContent='🔴 GO LIVE NOW - ALL';
    btn.disabled=false;
    if(whipPC){ whipPC.close(); whipPC=null; }
    alert('LIVE FAILED:\n'+e.message);
  }
}

window.stopRealWHIP=()=>{
  if(whipPC){ whipPC.close(); whipPC=null; }
  document.getElementById('liveBadge').textContent='● OFFLINE';
  document.getElementById('recTime').style.display='none';
  document.getElementById('realLiveBtn').textContent='🔴 GO LIVE NOW - ALL';
  closeGoLiveModal();
}

// RECORDING
window.toggleRec=()=>{
  if(!isRecording){
    const s=liveCanvas.captureStream(30);
    if(previewStream) previewStream.getAudioTracks().forEach(t=>s.addTrack(t));
    recordedChunks=[];
    mediaRecorder=new MediaRecorder(s,{mimeType:'video/webm'});
    mediaRecorder.ondataavailable=e=>{ if(e.data.size>0) recordedChunks.push(e.data); };
    mediaRecorder.onstop=()=>{
      const blob=new Blob(recordedChunks,{type:'video/webm'});
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download=`NOVEX-${Date.now()}.webm`;
      a.click();
    };
    mediaRecorder.start();
    isRecording=true;
    document.getElementById('recBtn').textContent='■ STOP REC';
  } else {
    mediaRecorder.stop();
    isRecording=false;
    document.getElementById('recBtn').textContent='● REC';
  }
}

// Make global
window.startRealWHIP=startRealWHIP;
window.stopRealWHIP=stopRealWHIP;
