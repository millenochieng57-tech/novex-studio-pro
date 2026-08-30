/* =========================================================
   NOVEX STUDIO PRO
   Broadcast Studio Engine
   ========================================================= */

let previewStream = null;
let selectedCamera = null;
let selectedMic = null;

let scenes = [
  {
    id: 1,
    name: "Main",
    layers: []
  }
];

let activeSceneId = 1;
let layers = [];
let selectedId = null;
let dragState = null;

let resW = 1280;
let resH = 720;

let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let recordingStart = 0;
let recordingTimer = null;

let whipPC = null;

let bg = {
  type: "black",
  value: "#000",
  blur: 18
};

let bgImg = null;
let currentSource = "camera";

let audioContext = null;
let micAnalyser = null;
let micAnimation = null;


/* =========================================================
   ELEMENTS
   ========================================================= */

const bgVideoEl = document.getElementById("bgVideo");
const bgAudioEl = document.getElementById("bgAudio");

const previewCanvas = document.getElementById("previewCanvas");
const previewCtx = previewCanvas.getContext("2d");

const liveCanvas = document.getElementById("liveCanvas");
const liveCtx = liveCanvas.getContext("2d");

const camVideo = document.getElementById("camVideo");

const layersContainer =
  document.getElementById("layersContainer");

const bgColor =
  document.getElementById("bgColor");

const bgImageInput =
  document.getElementById("bgImageInput");

const bgVideoInput =
  document.getElementById("bgVideoInput");

const bgAudioInput =
  document.getElementById("bgAudioInput");

const logoInput =
  document.getElementById("logoInput");

const recBtn =
  document.getElementById("recBtn");

const bottomRecBtn =
  document.getElementById("bottomRecBtn");

const recTime =
  document.getElementById("recTime");

const liveBadge =
  document.getElementById("liveBadge");

const micMeter =
  document.getElementById("micMeter");

const micDb =
  document.getElementById("micDb");


/* =========================================================
   SCENES
   ========================================================= */

function getActiveScene() {
  return scenes.find(
    scene => scene.id === activeSceneId
  );
}


function serializeLayer(layer) {

  const data = { ...layer.data };

  if (layer.type === "image") {
    data.url =
      layer.data.img
        ? layer.data.img.src
        : layer.data.url || "";
    
    delete data.img;
  }

  return {
    type: layer.type,
    x: layer.x,
    y: layer.y,
    w: layer.w,
    h: layer.h,
    order: layer.order,
    data
  };
}


function saveSceneLayers() {

  const scene = getActiveScene();

  if (!scene) return;

  scene.layers =
    layers.map(serializeLayer);
}


function loadSceneLayers() {

  const scene = getActiveScene();

  layers = [];

  if (!scene || !scene.layers) {
    buildAll();
    return;
  }

  scene.layers.forEach(saved => {

    if (
      saved.type === "image" &&
      saved.data &&
      saved.data.url
    ) {

      const img = new Image();

      img.src = saved.data.url;

      img.onload = () => {

        layers.push({
          id: Date.now() + Math.random(),
          type: saved.type,
          x: saved.x,
          y: saved.y,
          w: saved.w,
          h: saved.h,
          order: saved.order,
          data: {
            ...saved.data,
            img
          },
          scrollX: 0
        });

        buildAll();
      };

    } else {

      layers.push({
        id: Date.now() + Math.random(),
        type: saved.type,
        x: saved.x,
        y: saved.y,
        w: saved.w,
        h: saved.h,
        order: saved.order,
        data: saved.data || {},
        scrollX: 0
      });

    }

  });

  buildAll();
}


function renderScenes() {

  const list =
    document.getElementById("sceneList");

  list.innerHTML =
    scenes.map(scene => {

      return `
        <div
          class="scene-item ${
            scene.id === activeSceneId
              ? "active"
              : ""
          }"
          onclick="switchScene(${scene.id})"
        >
          <span>🎬 ${escapeHTML(scene.name)}</span>
        </div>
      `;

    }).join("");
}


function addScene() {

  const name =
    prompt("Scene name?");

  if (!name || !name.trim()) return;

  saveSceneLayers();

  const id =
    Date.now();

  scenes.push({
    id,
    name: name.trim(),
    layers: []
  });

  activeSceneId = id;
  layers = [];
  selectedId = null;

  renderScenes();
  buildAll();
  saveLayout(false);
}


function switchScene(id) {

  if (id === activeSceneId) return;

  saveSceneLayers();

  activeSceneId = id;
  selectedId = null;

  renderScenes();
  loadSceneLayers();
}


/* =========================================================
   DEVICE MANAGEMENT
   ========================================================= */

async function initDevices() {

  try {

    const permissionStream =
      await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

    permissionStream
      .getTracks()
      .forEach(track => track.stop());

  } catch (error) {

    console.warn(
      "Device permission:",
      error.message
    );

  }

  const devices =
    await navigator.mediaDevices.enumerateDevices();

  const cameras =
    devices.filter(
      device => device.kind === "videoinput"
    );

  const microphones =
    devices.filter(
      device => device.kind === "audioinput"
    );

  cameras.sort((a, b) => {

    const aPhone =
      a.label.toLowerCase().includes("droid");

    const bPhone =
      b.label.toLowerCase().includes("droid");

    if (aPhone && !bPhone) return 1;
    if (!aPhone && bPhone) return -1;

    return 0;
  });

  const cameraSelect =
    document.getElementById("cameraSelect");

  const micSelect =
    document.getElementById("micSelect");

  cameraSelect.innerHTML =
    cameras.map(camera => `
      <option value="${camera.deviceId}">
        ${escapeHTML(
          camera.label ||
          "Camera " + camera.deviceId.slice(0, 5)
        )}
      </option>
    `).join("");

  micSelect.innerHTML =
    microphones.map(mic => `
      <option value="${mic.deviceId}">
        ${escapeHTML(
          mic.label ||
          "Microphone " + mic.deviceId.slice(0, 5)
        )}
      </option>
    `).join("");

  if (!selectedCamera && cameras.length) {

    const preferred =
      cameras.find(camera =>
        !camera.label
          .toLowerCase()
          .includes("droid")
      );

    selectedCamera =
      preferred
        ? preferred.deviceId
        : cameras[0].deviceId;
  }

  if (!selectedMic && microphones.length) {
    selectedMic =
      microphones[0].deviceId;
  }

  if (selectedCamera) {
    cameraSelect.value = selectedCamera;
  }

  if (selectedMic) {
    micSelect.value = selectedMic;
  }

  return cameras;
}


async function forcePCcam() {

  const cameras =
    await initDevices();

  const pc =
    cameras.find(camera =>
      !camera.label
        .toLowerCase()
        .includes("droid")
    );

  if (!pc) {

    alert(
      "No PC camera was found."
    );

    return;
  }

  selectedCamera =
    pc.deviceId;

  await previewSource("camera");

  closeSettings();
}


function openSettings() {

  initDevices();

  document
    .getElementById("settingsOverlay")
    .classList.add("active");
}


function closeSettings() {

  const cameraSelect =
    document.getElementById("cameraSelect");

  const micSelect =
    document.getElementById("micSelect");

  if (cameraSelect.value) {
    selectedCamera =
      cameraSelect.value;
  }

  if (micSelect.value) {
    selectedMic =
      micSelect.value;
  }

  document
    .getElementById("settingsOverlay")
    .classList.remove("active");

  if (currentSource === "camera") {
    previewSource("camera");
  }
}


/* =========================================================
   MODALS
   ========================================================= */

function openTextModal() {

  document
    .getElementById("textOverlay")
    .classList.add("active");
}


function closeTextModal() {

  document
    .getElementById("textOverlay")
    .classList.remove("active");
}


function openLowerThird() {

  document
    .getElementById("lowerOverlay")
    .classList.add("active");
}


function closeLowerThird() {

  document
    .getElementById("lowerOverlay")
    .classList.remove("active");
}


function openGoLiveModal() {

  document
    .getElementById("goLiveOverlay")
    .classList.add("active");
}


function closeGoLiveModal() {

  document
    .getElementById("goLiveOverlay")
    .classList.remove("active");
}


/* =========================================================
   BACKGROUND
   ========================================================= */

function setBg(type, value) {

  bg.type = type;

  if (type === "color") {
    bg.value = value;
  }

  if (type === "gradient") {
    bg.value = "gradient";
  }

  if (type === "blur") {
    bg.blur =
      parseInt(value) || 18;
  }

  updateBgStatus();

  saveLayout(false);
}


function updateBgStatus() {

  const status =
    document.getElementById("bgStatus");

  if (!status) return;

  let label =
    "BG: " + bg.type;

  if (bg.type === "image") {
    label = "BG: Image";
  }

  if (bg.type === "video") {
    label = "BG: Video";
  }

  if (bg.type === "gradient") {
    label = "BG: Gradient";
  }

  status.textContent = label;
}


function loadPresetBg(url) {

  const img =
    new Image();

  img.crossOrigin =
    "anonymous";

  img.src = url;

  img.onload = () => {

    bgImg = img;
    bg.type = "image";

    updateBgStatus();
    saveLayout(false);
  };

  img.onerror = () => {

    alert(
      "Unable to load this background image."
    );
  };
}


bgImageInput.onchange = event => {

  const file =
    event.target.files[0];

  if (!file) return;

  const reader =
    new FileReader();

  reader.onload = e => {

    const img =
      new Image();

    img.src =
      e.target.result;

    img.onload = () => {

      bgImg = img;
      bg.type = "image";

      updateBgStatus();
      saveLayout(false);
    };

  };

  reader.readAsDataURL(file);
};


bgVideoInput.onchange = event => {

  const file =
    event.target.files[0];

  if (!file) return;

  bgVideoEl.src =
    URL.createObjectURL(file);

  bgVideoEl.play();

  bg.type = "video";

  updateBgStatus();
};


bgAudioInput.onchange = event => {

  const file =
    event.target.files[0];

  if (!file) return;

  bgAudioEl.src =
    URL.createObjectURL(file);

  bgAudioEl.volume =
    document.getElementById(
      "bgMusicVol"
    ).value / 100;

  bgAudioEl.play();
};


function setBgMusicVol(value) {

  bgAudioEl.volume =
    value / 100;
}


function stopBgAudio() {

  bgAudioEl.pause();
  bgAudioEl.currentTime = 0;
}


function drawBackground(ctx) {

  if (bg.type === "color") {

    ctx.fillStyle =
      bg.value;

    ctx.fillRect(
      0,
      0,
      resW,
      resH
    );

    return;
  }


  if (bg.type === "gradient") {

    const gradient =
      ctx.createLinearGradient(
        0,
        0,
        resW,
        resH
      );

    gradient.addColorStop(
      0,
      "#7c5cff"
    );

    gradient.addColorStop(
      1,
      "#22c55e"
    );

    ctx.fillStyle =
      gradient;

    ctx.fillRect(
      0,
      0,
      resW,
      resH
    );

    return;
  }


  if (
    bg.type === "image" &&
    bgImg &&
    bgImg.complete
  ) {

    drawCover(
      ctx,
      bgImg,
      0,
      0,
      resW,
      resH
    );

    return;
  }


  if (
    bg.type === "video" &&
    bgVideoEl.readyState >= 2
  ) {

    drawCover(
      ctx,
      bgVideoEl,
      0,
      0,
      resW,
      resH
    );

    return;
  }


  if (
    bg.type === "blur" &&
    camVideo.readyState >= 2
  ) {

    ctx.save();

    ctx.filter =
      `blur(${bg.blur}px)`;

    ctx.drawImage(
      camVideo,
      0,
      0,
      resW,
      resH
    );

    ctx.restore();

    return;
  }


  ctx.fillStyle =
    "#000";

  ctx.fillRect(
    0,
    0,
    resW,
    resH
  );
}


function drawCover(
  ctx,
  source,
  x,
  y,
  width,
  height
) {

  const sw =
    source.videoWidth ||
    source.naturalWidth ||
    width;

  const sh =
    source.videoHeight ||
    source.naturalHeight ||
    height;

  if (!sw || !sh) {

    ctx.drawImage(
      source,
      x,
      y,
      width,
      height
    );

    return;
  }

  const scale =
    Math.max(
      width / sw,
      height / sh
    );

  const dw =
    sw * scale;

  const dh =
    sh * scale;

  const dx =
    x + (width - dw) / 2;

  const dy =
    y + (height - dh) / 2;

  ctx.drawImage(
    source,
    dx,
    dy,
    dw,
    dh
  );
}


/* =========================================================
   LAYERS
   ========================================================= */

function createLayer(type, data = {}) {

  const id =
    Date.now() + Math.random();

  let layer = {
    id,
    type,
    x: 5,
    y: 5,
    w: 40,
    h: 35,
    data: {
      ...data,
      opacity: 100,
      blur: 0
    },
    scrollX: 0,
    order: layers.length
  };


  if (type === "camera") {

    layer.x = 0;
    layer.y = 0;
    layer.w = 100;
    layer.h = 100;
  }


  if (type === "image") {

    layer.x = 60;
    layer.y = 10;
    layer.w = 35;
    layer.h = 35;
  }


  if (type === "text") {

    layer.x = 5;
    layer.y = 70;
    layer.w = 50;
    layer.h = 15;

    if (data.scroll) {

      layer.x = 0;
      layer.y = 85;
      layer.w = 100;
    }
  }


  if (type === "lowerThird") {

    layer.x = 2;
    layer.y = 76;
    layer.w = 55;
    layer.h = 18;
  }


  layers.push(layer);

  selectedId = id;

  buildAll();
  saveSceneLayers();
}


/* =========================================================
   LAYER UI
   ========================================================= */

function buildAll() {

  layersContainer.innerHTML = "";

  const sorted =
    [...layers].sort(
      (a, b) => a.order - b.order
    );


  sorted.forEach(layer => {

    const div =
      document.createElement("div");

    div.className =
      "layer" +
      (layer.id === selectedId
        ? " selected"
        : "");

    div.style.left =
      layer.x + "%";

    div.style.top =
      layer.y + "%";

    div.style.width =
      layer.w + "%";

    div.style.height =
      layer.h + "%";


    div.innerHTML = `
      <div class="handle tl"></div>
      <div class="handle tr"></div>
      <div class="handle bl"></div>
      <div class="handle br"></div>
      <div class="handle ml"></div>
      <div class="handle mr"></div>
    `;


    div.onmousedown =
      event => {

        if (
          event.target.classList
            .contains("handle")
        ) {
          return;
        }

        startDrag(
          event,
          layer,
          "move"
        );
      };


    div.querySelectorAll(
      ".handle"
    ).forEach(handle => {

      handle.onmousedown =
        event => {

          event.stopPropagation();

          const mode =
            [...handle.classList]
              .find(
                c =>
                  [
                    "tl",
                    "tr",
                    "bl",
                    "br",
                    "ml",
                    "mr"
                  ].includes(c)
              );

          startDrag(
            event,
            layer,
            "resize-" + mode
          );
        };

    });


    div.onclick =
      event => {

        event.stopPropagation();

        selectedId =
          layer.id;

        updateStyleControls();
        buildAll();
      };


    layersContainer.appendChild(div);

  });


  const layerList =
    document.getElementById(
      "layerList"
    );


  layerList.innerHTML =
    sorted.map(layer => {

      return `
        <div
          class="layer-item ${
            layer.id === selectedId
              ? "selected"
              : ""
          }"
          onclick="selectLayer(${layer.id})"
        >
          <span>
            ${layerIcon(layer.type)}
            ${escapeHTML(layer.type)}
            ${Math.round(layer.w)}%
          </span>

          <button
            onclick="event.stopPropagation();deleteLayer('${layer.id}')"
            style="
              background:transparent;
              border:none;
              color:#ff2d55;
              cursor:pointer;
            "
          >
            🗑️
          </button>
        </div>
      `;

    }).join("");


  updateSelectedInfo();
}


function selectLayer(id) {

  selectedId = id;

  updateStyleControls();

  buildAll();
}


function layerIcon(type) {

  const icons = {
    camera: "📷",
    image: "🖼️",
    text: "📝",
    lowerThird: "🔻"
  };

  return icons[type] || "◼️";
}


function updateSelectedInfo() {

  const info =
    document.getElementById(
      "selectedInfo"
    );

  const layer =
    layers.find(
      l => l.id === selectedId
    );

  if (!layer) {

    info.textContent =
      "No layer selected";

    return;
  }

  info.textContent =
    `${layer.type} • X ${Math.round(layer.x)}% • Y ${Math.round(layer.y)}% • ${Math.round(layer.w)}% × ${Math.round(layer.h)}%`;
}


function updateStyleControls() {

  const layer =
    layers.find(
      l => l.id === selectedId
    );

  if (!layer) return;

  document.getElementById(
    "opacityRange"
  ).value =
    layer.data.opacity ?? 100;

  document.getElementById(
    "blurRange"
  ).value =
    layer.data.blur ?? 0;
}


/* =========================================================
   DRAG + RESIZE
   ========================================================= */

function startDrag(
  event,
  layer,
  mode
) {

  event.preventDefault();

  selectedId =
    layer.id;

  const rect =
    document
      .getElementById(
        "previewWrap"
      )
      .getBoundingClientRect();

  dragState = {
    layer,
    mode,
    startX: event.clientX,
    startY: event.clientY,
    origX: layer.x,
    origY: layer.y,
    origW: layer.w,
    origH: layer.h,
    rect
  };

  window.addEventListener(
    "mousemove",
    onDrag
  );

  window.addEventListener(
    "mouseup",
    stopDrag
  );

  buildAll();
}


function onDrag(event) {

  if (!dragState) return;

  const dx =
    ((event.clientX -
      dragState.startX) /
      dragState.rect.width) *
    100;

  const dy =
    ((event.clientY -
      dragState.startY) /
      dragState.rect.height) *
    100;

  const layer =
    dragState.layer;

  const mode =
    dragState.mode;


  if (mode === "move") {

    layer.x =
      clamp(
        dragState.origX + dx,
        0,
        100 - dragState.origW
      );

    layer.y =
      clamp(
        dragState.origY + dy,
        0,
        100 - dragState.origH
      );

  } else {

    if (mode.includes("br")) {

      layer.w =
        Math.max(
          5,
          dragState.origW + dx
        );

      layer.h =
        Math.max(
          5,
          dragState.origH + dy
        );
    }


    if (mode.includes("tr")) {

      layer.w =
        Math.max(
          5,
          dragState.origW + dx
        );

      layer.h =
        Math.max(
          5,
          dragState.origH - dy
        );

      layer.y =
        dragState.origY + dy;
    }


    if (mode.includes("bl")) {

      layer.w =
        Math.max(
          5,
          dragState.origW - dx
        );

      layer.h =
        Math.max(
          5,
          dragState.origH + dy
        );

      layer.x =
        dragState.origX + dx;
    }


    if (mode.includes("tl")) {

      layer.w =
        Math.max(
          5,
          dragState.origW - dx
        );

      layer.h =
        Math.max(
          5,
          dragState.origH - dy
        );

      layer.x =
        dragState.origX + dx;

      layer.y =
        dragState.origY + dy;
    }


    if (mode.includes("mr")) {

      layer.w =
        Math.max(
          5,
          dragState.origW + dx
        );
    }


    if (mode.includes("ml")) {

      layer.w =
        Math.max(
          5,
          dragState.origW - dx
        );

      layer.x =
        dragState.origX + dx;
    }


    layer.x =
      clamp(layer.x, 0, 95);

    layer.y =
      clamp(layer.y, 0, 95);

    layer.w =
      clamp(
        layer.w,
        5,
        100 - layer.x
      );

    layer.h =
      clamp(
        layer.h,
        5,
        100 - layer.y
      );
  }

  buildAll();
}


function stopDrag() {

  window.removeEventListener(
    "mousemove",
    onDrag
  );

  window.removeEventListener(
    "mouseup",
    stopDrag
  );

  dragState = null;

  saveSceneLayers();
}


/* =========================================================
   LAYER CONTROLS
   ========================================================= */

function fillSelected() {

  const layer =
    layers.find(
      l => l.id === selectedId
    );

  if (!layer) return;

  layer.x = 0;
  layer.y = 0;
  layer.w = 100;
  layer.h = 100;

  buildAll();
  saveSceneLayers();
}


function centerSelected() {

  const layer =
    layers.find(
      l => l.id === selectedId
    );

  if (!layer) return;

  layer.x =
    (100 - layer.w) / 2;

  layer.y =
    (100 - layer.h) / 2;

  buildAll();
  saveSceneLayers();
}


function bringForward() {

  const layer =
    layers.find(
      l => l.id === selectedId
    );

  if (!layer) return;

  const highest =
    Math.max(
      ...layers.map(
        l => l.order
      ),
      0
    );

  layer.order =
    highest + 1;

  buildAll();
  saveSceneLayers();
}


function sendBack() {

  const layer =
    layers.find(
      l => l.id === selectedId
    );

  if (!layer) return;

  const lowest =
    Math.min(
      ...layers.map(
        l => l.order
      ),
      0
    );

  layer.order =
    lowest - 1;

  buildAll();
  saveSceneLayers();
}


function deleteLayer(id) {

  layers =
    layers.filter(
      layer =>
        String(layer.id) !==
        String(id)
    );

  if (
    String(selectedId) ===
    String(id)
  ) {
    selectedId = null;
  }

  buildAll();
  saveSceneLayers();
}


function updateStyle() {

  const layer =
    layers.find(
      l => l.id === selectedId
    );

  if (!layer) return;

  layer.data.opacity =
    parseInt(
      document.getElementById(
        "opacityRange"
      ).value
    );

  layer.data.blur =
    parseInt(
      document.getElementById(
        "blurRange"
      ).value
    );

  buildAll();
}


/* =========================================================
   TEXT + LOWER THIRD
   ========================================================= */

function applyText() {

  const text =
    document
      .getElementById(
        "textInput"
      )
      .value
      .trim();

  if (!text) return;

  createLayer(
    "text",
    {
      text,
      size: parseInt(
        document.getElementById(
          "fontSize"
        ).value
      ),
      color:
        document.getElementById(
          "textColor"
        ).value,
      scroll:
        document.getElementById(
          "scrollCheck"
        ).checked,
      speed:
        parseInt(
          document.getElementById(
            "scrollSpeed"
          ).value
        )
    }
  );

  document.getElementById(
    "textInput"
  ).value = "";

  closeTextModal();
}


function applyLowerThird() {

  createLayer(
    "lowerThird",
    {
      name:
        document.getElementById(
          "ltName"
        ).value ||
        "NOVEX STUDIO PRO",

      title:
        document.getElementById(
          "ltTitle"
        ).value ||
        "LIVE",

      c1:
        document.getElementById(
          "ltColor1"
        ).value,

      c2:
        document.getElementById(
          "ltColor2"
        ).value,

      style:
        document.getElementById(
          "ltStyle"
        ).value
    }
  );

  closeLowerThird();
}


/* =========================================================
   LOGO
   ========================================================= */

logoInput.onchange = event => {

  const file =
    event.target.files[0];

  if (!file) return;

  const reader =
    new FileReader();

  reader.onload = e => {

    const img =
      new Image();

    img.src =
      e.target.result;

    img.onload = () => {

      createLayer(
        "image",
        {
          img
        }
      );

    };

  };

  reader.readAsDataURL(file);
};


/* =========================================================
   CAMERA / SCREEN
   ========================================================= */

async function previewSource(type) {

  try {

    stopPreviewStream();

    currentSource = type;


    if (type === "camera") {

      const constraints = {

        video:
          selectedCamera
            ? {
                deviceId: {
                  exact:
                    selectedCamera
                }
              }
            : true,

        audio:
          selectedMic
            ? {
                deviceId: {
                  exact:
                    selectedMic
                }
              }
            : true
      };


      const stream =
        await navigator.mediaDevices
          .getUserMedia(
            constraints
          );

      previewStream =
        stream;

      camVideo.srcObject =
        stream;

      await camVideo.play();

      removeCameraLayers();

      createLayer(
        "camera",
        {}
      );

      startMicMeter(stream);

      updateSourceStatus(
        "📷 CAMERA ACTIVE"
      );

      return;
    }


    if (type === "screen") {

      const stream =
        await navigator.mediaDevices
          .getDisplayMedia({

            video: {
              cursor: "always"
            },

            audio: true
          });

      previewStream =
        stream;

      camVideo.srcObject =
        stream;

      await camVideo.play();

      removeCameraLayers();

      createLayer(
        "camera",
        {}
      );

      startMicMeter(
        stream
      );

      updateSourceStatus(
        "🖥️ SCREEN ACTIVE"
      );


      const videoTrack =
        stream.getVideoTracks()[0];

      if (videoTrack) {

        videoTrack.onended = () => {

          stopPreviewStream();

          updateSourceStatus(
            "SCREEN ENDED"
          );
        };
      }
    }

  } catch (error) {

    console.error(error);

    updateSourceStatus(
      "SOURCE ERROR"
    );

    alert(
      "Unable to start source:\n\n" +
      error.message
    );
  }
}


function removeCameraLayers() {

  layers =
    layers.filter(
      layer =>
        layer.type !== "camera"
    );

  selectedId = null;

  buildAll();
}


function stopPreviewStream() {

  if (previewStream) {

    previewStream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );

    previewStream = null;
  }

  stopMicMeter();
}


/* =========================================================
   MICROPHONE LEVEL METER
   ========================================================= */

async function startMicMeter(stream) {

  stopMicMeter();

  const audioTracks =
    stream.getAudioTracks();

  if (!audioTracks.length) {

    micMeter.style.width =
      "0%";

    micDb.textContent =
      "-inf";

    return;
  }


  try {

    audioContext =
      new (
        window.AudioContext ||
        window.webkitAudioContext
      )();

    const source =
      audioContext.createMediaStreamSource(
        stream
      );

    micAnalyser =
      audioContext.createAnalyser();

    micAnalyser.fftSize =
      256;

    source.connect(
      micAnalyser
    );

    const data =
      new Uint8Array(
        micAnalyser.fftSize
      );


    function updateMeter() {

      if (!micAnalyser) return;

      micAnalyser.getByteTimeDomainData(
        data
      );

      let sum = 0;

      for (
        let i = 0;
        i < data.length;
        i++
      ) {

        const normalized =
          (data[i] - 128) / 128;

        sum +=
          normalized *
          normalized;
      }

      const rms =
        Math.sqrt(
          sum / data.length
        );

      const db =
        rms > 0
          ? 20 * Math.log10(rms)
          : -60;

      const level =
        clamp(
          ((db + 60) / 60) * 100,
          0,
          100
        );

      micMeter.style.width =
        level + "%";

      micDb.textContent =
        db <= -59
          ? "-inf"
          : Math.round(db) + " dB";

      micAnimation =
        requestAnimationFrame(
          updateMeter
        );
    }

    updateMeter();

  } catch (error) {

    console.warn(
      "Microphone meter:",
      error
    );
  }
}


function stopMicMeter() {

  if (micAnimation) {

    cancelAnimationFrame(
      micAnimation
    );

    micAnimation = null;
  }

  if (audioContext) {

    audioContext.close()
      .catch(() => {});

    audioContext = null;
  }

  micAnalyser = null;

  micMeter.style.width =
    "0%";

  micDb.textContent =
    "-inf";
}


/* =========================================================
   RESOLUTION
   ========================================================= */

function setRes(width, height, button) {

  saveSceneLayers();

  resW = width;
  resH = height;

  previewCanvas.width =
    width;

  previewCanvas.height =
    height;

  liveCanvas.width =
    width;

  liveCanvas.height =
    height;


  document
    .querySelectorAll(
      ".res-group .btn-small"
    )
    .forEach(
      element =>
        element.classList.remove(
          "active"
        )
    );

  if (button) {
    button.classList.add(
      "active"
    );
  }

  buildAll();
}


/* =========================================================
   RENDER ENGINE
   ========================================================= */

function render() {

  drawBackground(
    previewCtx
  );


  const sorted =
    [...layers].sort(
      (a, b) =>
        a.order - b.order
    );


  sorted.forEach(layer => {

    const x =
      (layer.x / 100) *
      resW;

    const y =
      (layer.y / 100) *
      resH;

    const width =
      (layer.w / 100) *
      resW;

    const height =
      (layer.h / 100) *
      resH;


    previewCtx.save();

    previewCtx.globalAlpha =
      (layer.data.opacity ?? 100) /
      100;


    if (layer.data.blur) {

      previewCtx.filter =
        `blur(${layer.data.blur}px)`;
    }


    /* CAMERA */

    if (
      layer.type === "camera" &&
      camVideo.readyState >= 2
    ) {

      drawCover(
        previewCtx,
        camVideo,
        x,
        y,
        width,
        height
      );
    }


    /* IMAGE / LOGO */

    if (
      layer.type === "image" &&
      layer.data.img
    ) {

      previewCtx.drawImage(
        layer.data.img,
        x,
        y,
        width,
        height
      );
    }


    /* TEXT */

    if (
      layer.type === "text"
    ) {

      renderText(
        previewCtx,
        layer,
        x,
        y,
        width,
        height
      );
    }


    /* LOWER THIRD */

    if (
      layer.type === "lowerThird"
    ) {

      renderLowerThird(
        previewCtx,
        layer,
        x,
        y,
        width,
        height
      );
    }


    previewCtx.restore();

  });


  if (
    liveCanvas.dataset.live ===
    "true"
  ) {

    liveCtx.clearRect(
      0,
      0,
      resW,
      resH
    );

    liveCtx.drawImage(
      previewCanvas,
      0,
      0
    );
  }


  requestAnimationFrame(
    render
  );
}


/* =========================================================
   TEXT RENDERING
   ========================================================= */

function renderText(
  ctx,
  layer,
  x,
  y,
  width,
  height
) {

  const size =
    parseInt(
      layer.data.size
    ) || 56;

  ctx.fillStyle =
    layer.data.color ||
    "#fff";

  ctx.font =
    `800 ${size}px Inter, Arial, sans-serif`;

  ctx.textBaseline =
    "middle";


  if (layer.data.scroll) {

    if (
      typeof layer.scrollX !==
      "number"
    ) {
      layer.scrollX =
        resW;
    }

    layer.scrollX -=
      Number(
        layer.data.speed || 5
      ) * 0.35;

    const textWidth =
      ctx.measureText(
        layer.data.text
      ).width;

    if (
      layer.scrollX <
      -textWidth
    ) {

      layer.scrollX =
        resW;
    }

    ctx.fillText(
      layer.data.text,
      layer.scrollX,
      y + height / 2
    );

  } else {

    ctx.textAlign =
      "center";

    ctx.fillText(
      layer.data.text,
      x + width / 2,
      y + height / 2
    );

    ctx.textAlign =
      "left";
  }
}


/* =========================================================
   LOWER THIRD RENDERING
   ========================================================= */

function renderLowerThird(
  ctx,
  layer,
  x,
  y,
  width,
  height
) {

  const style =
    layer.data.style ||
    "gradient";


  let background;


  if (style === "solid") {

    background =
      layer.data.c1 ||
      "#7c5cff";

  } else if (
    style === "news"
  ) {

    background =
      "#c91f3a";

  } else if (
    style === "gold"
  ) {

    background =
      "#b8860b";

  } else {

    background =
      ctx.createLinearGradient(
        x,
        y,
        x + width,
        y
      );

    background.addColorStop(
      0,
      layer.data.c1 ||
        "#7c5cff"
    );

    background.addColorStop(
      1,
      layer.data.c2 ||
        "#22c55e"
    );
  }


  ctx.fillStyle =
    background;

  ctx.fillRect(
    x,
    y,
    width,
    height
  );


  const name =
    layer.data.name ||
    "NOVEX STUDIO PRO";

  const title =
    layer.data.title ||
    "LIVE";


  ctx.fillStyle =
    "#ffffff";

  ctx.textAlign =
    "left";

  ctx.textBaseline =
    "middle";


  ctx.font =
    `900 ${Math.max(
      18,
      height * 0.34
    )}px Inter, Arial`;

  ctx.fillText(
    name,
    x + 18,
    y + height * 0.38
  );


  ctx.font =
    `600 ${Math.max(
      12,
      height * 0.19
    )}px Inter, Arial`;

  ctx.globalAlpha =
    0.85;

  ctx.fillText(
    title,
    x + 18,
    y + height * 0.72
  );

  ctx.globalAlpha =
    1;
}


/* =========================================================
   LIVE
   ========================================================= */

function goLive() {

  liveCanvas.dataset.live =
    "true";

  liveBadge.textContent =
    "● LIVE";

  updateSourceStatus(
    "LIVE OUTPUT ACTIVE"
  );
}


/* =========================================================
   RECORDING
   ========================================================= */

function getSupportedMimeType() {

  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];

  return (
    types.find(
      type =>
        MediaRecorder.isTypeSupported(
          type
        )
    ) || ""
  );
}


function toggleRecord() {

  if (isRecording) {

    stopRecording();

  } else {

    startRecording();
  }
}


function startRecording() {

  if (
    !window.MediaRecorder
  ) {

    alert(
      "Your browser does not support video recording."
    );

    return;
  }


  try {

    const canvasStream =
      previewCanvas.captureStream(
        30
      );


    if (previewStream) {

      previewStream
        .getAudioTracks()
        .forEach(
          track =>
            canvasStream.addTrack(
              track.clone()
            )
        );
    }


    const mimeType =
      getSupportedMimeType();


    mediaRecorder =
      mimeType
        ? new MediaRecorder(
            canvasStream,
            { mimeType }
          )
        : new MediaRecorder(
            canvasStream
          );


    recordedChunks = [];


    mediaRecorder.ondataavailable =
      event => {

        if (
          event.data &&
          event.data.size > 0
        ) {

          recordedChunks.push(
            event.data
          );
        }
      };


    mediaRecorder.onerror =
      event => {

        console.error(
          "Recorder error:",
          event
        );

        stopRecording();
      };


    mediaRecorder.onstop =
      downloadRecording;


    mediaRecorder.start(
      1000
    );

    isRecording = true;

    recordingStart =
      Date.now();

    recBtn.textContent =
      "■ STOP";

    bottomRecBtn.textContent =
      "■ STOP";

    recTime.style.display =
      "inline";

    updateRecordingTimer();

    recordingTimer =
      setInterval(
        updateRecordingTimer,
        1000
      );

  } catch (error) {

    console.error(error);

    alert(
      "Unable to start recording:\n\n" +
      error.message
    );
  }
}


function stopRecording() {

  if (
    mediaRecorder &&
    mediaRecorder.state !==
      "inactive"
  ) {

    mediaRecorder.stop();
  }


  isRecording = false;


  if (recordingTimer) {

    clearInterval(
      recordingTimer
    );

    recordingTimer = null;
  }


  recBtn.textContent =
    "● REC";

  bottomRecBtn.textContent =
    "● REC";
}


function updateRecordingTimer() {

  if (!isRecording) return;

  const seconds =
    Math.floor(
      (Date.now() -
        recordingStart) /
      1000
    );

  const minutes =
    Math.floor(
      seconds / 60
    );

  const remaining =
    seconds % 60;


  recTime.textContent =
    `● REC ${String(
      minutes
    ).padStart(2, "0")}:${String(
      remaining
    ).padStart(2, "0")}`;
}


function downloadRecording() {

  if (!recordedChunks.length) {

    alert(
      "No recording data was captured."
    );

    return;
  }


  const blob =
    new Blob(
      recordedChunks,
      {
        type:
          mediaRecorder.mimeType ||
          "video/webm"
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement("a");

  link.href =
    url;

  link.download =
    `NOVEX-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.webm`;

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();


  setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    5000
  );
}


/* =========================================================
   SAVE / LOAD
   ========================================================= */

function saveLayout(showMessage = true) {

  saveSceneLayers();

  try {

    localStorage.setItem(
      "novexStudioPro",
      JSON.stringify({
        version: 2,
        scenes,
        activeSceneId,
        bg
      })
    );

    if (showMessage) {

      alert(
        "NOVEX STUDIO PRO layout saved."
      );
    }

  } catch (error) {

    console.error(
      "Save failed:",
      error
    );

    if (showMessage) {

      alert(
        "Unable to save the layout."
      );
    }
  }
}


function loadLayout() {

  try {

    const saved =
      localStorage.getItem(
        "novexStudioPro"
      );

    if (!saved) return;

    const data =
      JSON.parse(saved);


    if (
      Array.isArray(
        data.scenes
      ) &&
      data.scenes.length
    ) {

      scenes =
        data.scenes;
    }


    if (data.activeSceneId) {

      activeSceneId =
        data.activeSceneId;
    }


    if (data.bg) {

      bg = {
        ...bg,
        ...data.bg
      };
    }


    renderScenes();

    loadSceneLayers();

    updateBgStatus();

  } catch (error) {

    console.warn(
      "Could not load saved layout:",
      error
    );
  }
}


/* =========================================================
   WHIP LIVE STREAMING
   ========================================================= */

async function startRealWHIP() {

  const url =
    document
      .getElementById(
        "whipUrl"
      )
      .value
      .trim();

  const token =
    document
      .getElementById(
        "whipToken"
      )
      .value
      .trim();


  if (!url) {

    alert(
      "Paste your WHIP URL first."
    );

    return;
  }


  try {

    const stream =
      previewCanvas.captureStream(
        30
      );


    if (previewStream) {

      previewStream
        .getAudioTracks()
        .forEach(
          track =>
            stream.addTrack(
              track.clone()
            )
        );
    }


    whipPC =
      new RTCPeerConnection();


    stream
      .getTracks()
      .forEach(
        track =>
          whipPC.addTrack(
            track,
            stream
          )
      );


    const offer =
      await whipPC.createOffer();


    await whipPC.setLocalDescription(
      offer
    );


    const headers = {
      "Content-Type":
        "application/sdp"
    };


    if (token) {

      headers.Authorization =
        "Bearer " + token;
    }


    const response =
      await fetch(
        url,
        {
          method: "POST",
          headers,
          body: offer.sdp
        }
      );


    if (!response.ok) {

      throw new Error(
        `WHIP server returned HTTP ${response.status}`
      );
    }


    const answer =
      await response.text();


    await whipPC.setRemoteDescription({
      type: "answer",
      sdp: answer
    });


    liveCanvas.dataset.live =
      "true";

    liveBadge.textContent =
      "● LIVE FB/YT/TIKTOK";

    recTime.style.display =
      "inline";

    recTime.textContent =
      "● LIVE NOVEX";


    closeGoLiveModal();

  } catch (error) {

    console.error(
      "WHIP error:",
      error
    );

    alert(
      "Unable to start live stream:\n\n" +
      error.message
    );
  }
}


function stopWHIP() {

  if (whipPC) {

    whipPC.close();
    whipPC = null;
  }

  liveCanvas.dataset.live =
    "false";

  liveBadge.textContent =
    "● OFF";

  if (!isRecording) {

    recTime.style.display =
      "none";
  }
}


/* =========================================================
   HELPERS
   ========================================================= */

function clamp(
  value,
  min,
  max
) {

  return Math.min(
    Math.max(
      value,
      min
    ),
    max
  );
}


function escapeHTML(value) {

  return String(value)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


function updateSourceStatus(
  message
) {

  const info =
    document.getElementById(
      "selectedInfo"
    );

  if (info) {
    info.textContent =
      message;
  }
}


/* =========================================================
   STARTUP
   ========================================================= */

renderScenes();

loadLayout();

setTimeout(
  async () => {

    try {

      await initDevices();

      if (
        !previewStream
      ) {

        await previewSource(
          "camera"
        );
      }

    } catch (error) {

      console.warn(
        "Startup camera:",
        error
      );
    }

  },
  800
);

render();
