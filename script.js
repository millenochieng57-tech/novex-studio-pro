//... KEEP EVERYTHING ABOVE setupDrag SAME AS BEFORE, ONLY REPLACE setupDrag FUNCTION AT BOTTOM WITH THIS...

function setupDrag(){
  let drag=null, mode="move", off={x:0,y:0}, startW=0, startH=0, handleSize=20;
  if(!previewCanvas) return;

  function getMouse(e){
    let rect=previewCanvas.getBoundingClientRect();
    return {
      x:(e.clientX-rect.left)/rect.width*currentRes.w,
      y:(e.clientY-rect.top)/rect.height*currentRes.h
    };
  }

  function getHandle(mx,my,l){
    // 4 corners + edges
    if(Math.abs(mx - l.x) < handleSize && Math.abs(my - l.y) < handleSize) return "tl";
    if(Math.abs(mx - (l.x+l.w)) < handleSize && Math.abs(my - l.y) < handleSize) return "tr";
    if(Math.abs(mx - l.x) < handleSize && Math.abs(my - (l.y+l.h)) < handleSize) return "bl";
    if(Math.abs(mx - (l.x+l.w)) < handleSize && Math.abs(my - (l.y+l.h)) < handleSize) return "br";
    return null;
  }

  previewCanvas.addEventListener("mousedown", (e)=>{
    let {x:mx, y:my} = getMouse(e);
    let list=[...scenes[activeScene].layers].reverse();
    for(let l of list){
      // Check resize handles first if selected
      if(l.id===selectedId){
        let h=getHandle(mx,my,l);
        if(h){ drag=l; mode=h; startW=l.w; startH=l.h; off={x:mx, y:my}; return; }
      }
      // Check inside for move
      if(mx>=l.x && mx<=l.x+l.w && my>=l.y && my<=l.y+l.h){
        selectedId=l.id; drag=l; mode="move"; off={x:mx-l.x, y:my-l.y}; renderLayers(); break;
      }
    }
  });

  window.addEventListener("mousemove", (e)=>{
    if(!drag) return;
    let {x:mx, y:my} = getMouse(e);
    if(mode==="move"){
      drag.x=mx-off.x; drag.y=my-off.y;
    } else if(mode==="br"){
      drag.w = Math.max(50, startW + (mx - off.x));
      drag.h = Math.max(50, startH + (my - off.y));
    } else if(mode==="tr"){
      drag.w = Math.max(50, startW + (mx - off.x));
      drag.h = Math.max(50, startH - (my - off.y));
      drag.y = drag.y + (startH - drag.h);
    } else if(mode==="bl"){
      drag.w = Math.max(50, startW - (mx - off.x));
      drag.h = Math.max(50, startH + (my - off.y));
      drag.x = drag.x + (startW - drag.w);
    } else if(mode==="tl"){
      drag.w = Math.max(50, startW - (mx - off.x));
      drag.h = Math.max(50, startH - (my - off.y));
      drag.x = drag.x + (startW - drag.w);
      drag.y = drag.y + (startH - drag.h);
    }
    // Show cursor
    if(mode!=="move") previewCanvas.style.cursor="nwse-resize";
    else previewCanvas.style.cursor="grabbing";
  });

  window.addEventListener("mouseup", ()=>{
    drag=null; mode="move";
    previewCanvas.style.cursor="default";
  });

  // DOUBLE CLICK TO MINIMIZE / MAXIMIZE
  previewCanvas.addEventListener("dblclick", (e)=>{
    let {x:mx, y:my} = getMouse(e);
    let l=scenes[activeScene].layers.find(l=> mx>=l.x && mx<=l.x+l.w && my>=l.y && my<=l.y+l.h);
    if(l){
      if(l.w > 300){ // minimize to PIP
        l._prev={x:l.x,y:l.y,w:l.w,h:l.h};
        l.x=currentRes.w - 320; l.y=20; l.w=300; l.h=170;
      } else if(l._prev){ // restore
        l.x=l._prev.x; l.y=l._prev.y; l.w=l._prev.w; l.h=l._prev.h;
      }
    }
  });
}

// ALSO ADD THIS - FIXES OVERLAP AUTOMATICALLY
window.makePIP = function(){
  let cam=scenes[activeScene].layers.find(l=>l.type==="cam");
  let img=scenes[activeScene].layers.find(l=>l.type==="image");
  if(cam && img){
    // Put image full, cam small corner
    img.x=0; img.y=0; img.w=currentRes.w; img.h=currentRes.h;
    cam.x=currentRes.w-340; cam.y=currentRes.h-200; cam.w=320; cam.h=180;
    // Ensure cam on top
    let arr=scenes[activeScene].layers;
    let camIdx=arr.indexOf(cam); arr.splice(camIdx,1); arr.push(cam);
    renderLayers();
  }
};
