(() => {
  // -----------------------------
  // UI wiring
  // -----------------------------
  const $ = (id) => document.getElementById(id);
  const canvas = $("cv");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  
  // Worker setup
  const worker = new Worker('worker.js');
  let isProcessing = false;
  let pendingRender = false;

  const ui = {
    file: $("file"),
    preset: $("preset"),
    reset: $("reset"),
    save: $("save"),
    fps: $("fps"),
    strength: $("strength"),
    exposure: $("exposure"),
    contrast: $("contrast"),
    saturation: $("saturation"),
    temp: $("temp"),
    fade: $("fade"),
    vignette: $("vignette"),
    grain: $("grain"),
  };

  const uiVals = {
    strengthV: $("strengthV"),
    exposureV: $("exposureV"),
    contrastV: $("contrastV"),
    saturationV: $("saturationV"),
    tempV: $("tempV"),
    fadeV: $("fadeV"),
    vignetteV: $("vignetteV"),
    grainV: $("grainV"),
  };
  
  // Presets definition
  const PRESETS = {
    "Clarendon-ish": { strength:0.85, exposure:0.03, contrast:1.22, saturation:1.18, temp:0.05, fade:0.06, vignette:0.18, grain:0.06 },
    "Gingham-ish":   { strength:0.90, exposure:0.06, contrast:0.98, saturation:0.92, temp:0.02, fade:0.20, vignette:0.15, grain:0.07 },
    "Juno-ish":      { strength:0.85, exposure:0.04, contrast:1.10, saturation:1.28, temp:0.10, fade:0.08, vignette:0.18, grain:0.07 },
    "Lark-ish":      { strength:0.85, exposure:0.08, contrast:1.05, saturation:1.06, temp:-0.02, fade:0.10, vignette:0.12, grain:0.05 },
    "Valencia-ish":  { strength:0.90, exposure:0.05, contrast:0.96, saturation:1.10, temp:0.12, fade:0.16, vignette:0.10, grain:0.06 },
    "Lo-Fi-ish":     { strength:0.90, exposure:0.02, contrast:1.40, saturation:1.25, temp:0.04, fade:0.04, vignette:0.38, grain:0.08 },
    "Inkwell-ish(BW)":{strength:1.00, exposure:0.02, contrast:1.35, saturation:0.00, temp:0.00, fade:0.10, vignette:0.22, grain:0.08 },
    "X-Pro-ish":     { strength:0.90, exposure:0.00, contrast:1.25, saturation:1.12, temp:0.06, fade:0.06, vignette:0.30, grain:0.10 },
    "Reyes-ish":     { strength:0.90, exposure:0.10, contrast:0.90, saturation:0.75, temp:0.10, fade:0.00, vignette:0.00, grain:0.00 },
    "Slumber-ish":   { strength:0.90, exposure:0.05, contrast:0.95, saturation:0.66, temp:0.05, fade:0.15, vignette:0.20, grain:0.00 },
    "Crema-ish":     { strength:0.90, exposure:0.05, contrast:1.00, saturation:0.90, temp:-0.05, fade:0.10, vignette:0.20, grain:0.05 },
  };

  function setSlider(name, value){
    if (ui[name]) {
      ui[name].value = value;
      uiVals[name+"V"].textContent = (+value).toFixed(2);
    }
  }

  function getParams(){
    return {
      strength: +ui.strength.value,
      exposure: +ui.exposure.value,
      contrast: +ui.contrast.value,
      saturation: +ui.saturation.value,
      temp: +ui.temp.value,
      fade: +ui.fade.value,
      vignette: +ui.vignette.value,
      grain: +ui.grain.value,
    };
  }

  function applyPreset(p){
    for(const k of Object.keys(p)){
      if(ui[k]) setSlider(k, p[k]);
    }
    requestRender();
  }

  // Populate presets
  for(const name of Object.keys(PRESETS)){
    const opt = document.createElement("option");
    opt.value = name; opt.textContent = name;
    ui.preset.appendChild(opt);
  }
  ui.preset.value = "Clarendon-ish";

  // -----------------------------
  // Image loading + scaling
  // -----------------------------
  const img = new Image();
  img.crossOrigin = "anonymous";
  let originalImageData = null;

  function drawPlaceholder(){
    const w = 1200, h = 800;
    canvas.width = w; canvas.height = h;
    const g = ctx.createLinearGradient(0,0,w,h);
    g.addColorStop(0, "#2b5876");
    g.addColorStop(0.45, "#4e4376");
    g.addColorStop(1, "#f7971e");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "48px system-ui";
    ctx.fillText("Upload an image to test filters", 70, 120);
    ctx.font = "22px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText("This is a placeholder canvas.", 70, 170);
    
    originalImageData = ctx.getImageData(0,0,w,h);
    requestRender();
  }

  function fitToCanvas(image, maxW=1400){
    const ratio = image.naturalWidth / image.naturalHeight;
    let w = Math.min(maxW, image.naturalWidth);
    let h = Math.round(w / ratio);
    if(h > 1000){
      h = 1000;
      w = Math.round(h * ratio);
    }
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(image, 0, 0, w, h);
    originalImageData = ctx.getImageData(0, 0, w, h);
  }

  ui.file.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if(!f) return;
    const url = URL.createObjectURL(f);
    img.onload = () => {
      fitToCanvas(img);
      URL.revokeObjectURL(url);
      requestRender();
    };
    img.src = url;
  });

  // -----------------------------
  // Rendering (Web Worker)
  // -----------------------------
  let t0 = 0;

  function requestRender(){
    if (isProcessing) {
      pendingRender = true;
      return;
    }
    if (!originalImageData) return;

    isProcessing = true;
    t0 = performance.now();
    ui.fps.textContent = "Processing...";
    
    const params = getParams();
    // 1337 is the seed, could be random if desired
    worker.postMessage({ 
      imageData: originalImageData, 
      params: params,
      seed: 1337 
    });
  }

  worker.onmessage = function(e) {
    const { imageData } = e.data;
    ctx.putImageData(imageData, 0, 0);
    
    const dt = Math.round(performance.now() - t0);
    ui.fps.textContent = `Render: ${dt}ms`;
    
    isProcessing = false;
    
    if (pendingRender) {
      pendingRender = false;
      requestRender();
    }
  };

  worker.onerror = function(e) {
    console.error("Worker error:", e);
    ui.fps.textContent = "Error processing image";
    isProcessing = false;
  };

  // Slider updates
  for(const k of ["strength","exposure","contrast","saturation","temp","fade","vignette","grain"]){
    ui[k].addEventListener("input", () => {
      uiVals[k+"V"].textContent = (+ui[k].value).toFixed(2);
      requestRender();
    });
  }

  ui.preset.addEventListener("change", () => applyPreset(PRESETS[ui.preset.value]));
  ui.reset.addEventListener("click", () => {
    ui.preset.value = "Clarendon-ish";
    applyPreset(PRESETS["Clarendon-ish"]);
  });

  ui.save.addEventListener("click", () => {
    const a = document.createElement("a");
    a.download = "filtered.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
  });

  // Init
  applyPreset(PRESETS["Clarendon-ish"]);
  drawPlaceholder();
})();
