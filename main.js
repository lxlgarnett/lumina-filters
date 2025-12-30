(() => {
  // -----------------------------
  // Router Logic
  // -----------------------------
  function handleRoute() {
    const hash = window.location.hash || "#home";

    document
      .querySelectorAll(".view")
      .forEach((el) => el.classList.remove("active"));
    document
      .querySelectorAll("nav a")
      .forEach((el) => el.classList.remove("active"));

    if (hash === "#editor") {
      document.getElementById("view-editor").classList.add("active");
      document.getElementById("nav-editor").classList.add("active");
      requestMainRender();
    } else {
      document.getElementById("view-home").classList.add("active");
      document.getElementById("nav-home").classList.add("active");
    }
  }

  window.addEventListener("hashchange", handleRoute);
  window.addEventListener("DOMContentLoaded", handleRoute);

  // -----------------------------
  // WebGL Setup & Helpers
  // -----------------------------
  const $ = (id) => document.getElementById(id);

  const vsSource = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() {
       gl_Position = vec4(a_position, 0, 1);
       v_texCoord = a_texCoord;
    }
  `;

  const fsSource = `
    precision mediump float;
    uniform sampler2D u_image;
    uniform vec2 u_resolution;
    uniform float u_strength;
    uniform float u_exposure;
    uniform float u_contrast;
    uniform float u_saturation;
    uniform float u_temp;
    uniform float u_tint;
    uniform float u_fade;
    uniform float u_vignette;
    uniform float u_grain;
    uniform float u_seed;

    varying vec2 v_texCoord;

    // Utils
    float clamp01(float x) { return clamp(x, 0.0, 1.0); }
    float hash12(vec2 p) {
        vec3 p3  = fract(vec3(p.xyx) * .1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
        vec4 texColor = texture2D(u_image, v_texCoord);
        vec3 col = texColor.rgb;
        vec3 originalCol = col;

        col = clamp(col + u_exposure, 0.0, 1.0);
        col = clamp((col - 0.5) * u_contrast + 0.5, 0.0, 1.0);

        float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(lum), col, u_saturation);
        col = clamp(col, 0.0, 1.0);

        col.r = clamp(col.r * (1.0 + u_temp), 0.0, 1.0);
        col.b = clamp(col.b * (1.0 - u_temp), 0.0, 1.0);

        col.r = clamp(col.r * (1.0 + u_tint * 0.5), 0.0, 1.0);
        col.g = clamp(col.g * (1.0 - u_tint), 0.0, 1.0);
        col.b = clamp(col.b * (1.0 + u_tint * 0.5), 0.0, 1.0);

        if (u_fade > 0.0) {
            vec3 y = col * (1.0 - 0.25 * u_fade) + 0.08 * u_fade;
            vec3 y_pow = pow(y, vec3(0.9));
            col = mix(y, y_pow, 0.35 * u_fade);
            col = clamp(col, 0.0, 1.0);
        }

        vec2 coord = v_texCoord * 2.0 - 1.0;
        float d = length(coord);
        float v = 1.0 - u_vignette * pow(min(1.0, d), 1.7);
        col *= max(0.0, v);

        if (u_grain > 0.0) {
            float n = hash12(v_texCoord * u_resolution + u_seed) * 2.0 - 1.0;
            float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
            float midW = 1.0 - abs(l - 0.5) * 2.0;
            float gn = n * (0.03 + 0.12 * u_grain) * midW;
            col = clamp(col + gn, 0.0, 1.0);
        }

        col = mix(originalCol, col, u_strength);
        gl_FragColor = vec4(col, 1.0);
    }
  `;

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(gl, vs, fs) {
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  function initGLContext(canvas) {
    const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
    if (!gl) return null;

    const program = createProgram(
      gl,
      createShader(gl, gl.VERTEX_SHADER, vsSource),
      createShader(gl, gl.FRAGMENT_SHADER, fsSource),
    );

    const positionLoc = gl.getAttribLocation(program, "a_position");
    const texCoordLoc = gl.getAttribLocation(program, "a_texCoord");

    const locs = {
      u_image: gl.getUniformLocation(program, "u_image"),
      u_resolution: gl.getUniformLocation(program, "u_resolution"),
      u_strength: gl.getUniformLocation(program, "u_strength"),
      u_exposure: gl.getUniformLocation(program, "u_exposure"),
      u_contrast: gl.getUniformLocation(program, "u_contrast"),
      u_saturation: gl.getUniformLocation(program, "u_saturation"),
      u_temp: gl.getUniformLocation(program, "u_temp"),
      u_tint: gl.getUniformLocation(program, "u_tint"),
      u_fade: gl.getUniformLocation(program, "u_fade"),
      u_vignette: gl.getUniformLocation(program, "u_vignette"),
      u_grain: gl.getUniformLocation(program, "u_grain"),
      u_seed: gl.getUniformLocation(program, "u_seed"),
    };

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
      gl.STATIC_DRAW,
    );

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return {
      gl,
      program,
      locs,
      buffers: { position: positionBuffer, texCoord: texCoordBuffer },
      attribs: { position: positionLoc, texCoord: texCoordLoc },
      texture,
    };
  }

  // -----------------------------
  // Initialization
  // -----------------------------
  const THUMB_SIZE = 100;
  const mainCtx = initGLContext($("cv"));
  
  // Thumbnails context
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = THUMB_SIZE;
  thumbCanvas.height = THUMB_SIZE;
  const thumbCtx = initGLContext(thumbCanvas);

  if (!mainCtx || !thumbCtx) {
    const editorView = $("view-editor");
    if (editorView) {
      editorView.innerHTML = `<div class="wrap"><div class="card" style="padding: 20px; text-align: center;">Error: WebGL is not supported by your browser, which is required for this editor.</div></div>`;
    }
    throw new Error("WebGL not supported");
  }

  // -----------------------------
  // UI wiring
  // -----------------------------
  const ui = {
    file: $("file"),
    scroller: $("filter-scroller"),
    reset: $("reset"),
    save: $("save"),
    fps: $("fps"),
    strength: $("strength"),
    exposure: $("exposure"),
    contrast: $("contrast"),
    saturation: $("saturation"),
    temp: $("temp"),
    tint: $("tint"),
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
    tintV: $("tintV"),
    fadeV: $("fadeV"),
    vignetteV: $("vignetteV"),
    grainV: $("grainV"),
  };

  // Presets definition (Same as before)
  const PRESETS = {
    Normal: {
      strength: 1.0,
      exposure: 0.0,
      contrast: 1.0,
      saturation: 1.0,
      temp: 0.0,
      tint: 0.0,
      fade: 0.0,
      vignette: 0.0,
      grain: 0.0,
    },
    "Clarendon-ish": {
      strength: 0.85,
      exposure: 0.03,
      contrast: 1.22,
      saturation: 1.18,
      temp: 0.05,
      tint: 0.0,
      fade: 0.06,
      vignette: 0.18,
      grain: 0.06,
    },
    "Gingham-ish": {
      strength: 0.9,
      exposure: 0.06,
      contrast: 0.98,
      saturation: 0.92,
      temp: 0.02,
      tint: -0.02,
      fade: 0.2,
      vignette: 0.15,
      grain: 0.07,
    },
    "Juno-ish": {
      strength: 0.85,
      exposure: 0.04,
      contrast: 1.1,
      saturation: 1.28,
      temp: 0.1,
      tint: 0.0,
      fade: 0.08,
      vignette: 0.18,
      grain: 0.07,
    },
    "Lark-ish": {
      strength: 0.85,
      exposure: 0.08,
      contrast: 1.05,
      saturation: 1.06,
      temp: -0.02,
      tint: 0.0,
      fade: 0.1,
      vignette: 0.12,
      grain: 0.05,
    },
    "Valencia-ish": {
      strength: 0.9,
      exposure: 0.05,
      contrast: 0.96,
      saturation: 1.1,
      temp: 0.12,
      tint: 0.02,
      fade: 0.16,
      vignette: 0.1,
      grain: 0.06,
    },
    "Lo-Fi-ish": {
      strength: 0.9,
      exposure: 0.02,
      contrast: 1.4,
      saturation: 1.25,
      temp: 0.04,
      tint: 0.0,
      fade: 0.04,
      vignette: 0.38,
      grain: 0.08,
    },
    "Inkwell-ish(BW)": {
      strength: 1.0,
      exposure: 0.02,
      contrast: 1.35,
      saturation: 0.0,
      temp: 0.0,
      tint: 0.0,
      fade: 0.1,
      vignette: 0.22,
      grain: 0.08,
    },
    "X-Pro-ish": {
      strength: 0.9,
      exposure: 0.0,
      contrast: 1.25,
      saturation: 1.12,
      temp: 0.06,
      tint: 0.04,
      fade: 0.06,
      vignette: 0.3,
      grain: 0.1,
    },
    "Reyes-ish": {
      strength: 0.9,
      exposure: 0.1,
      contrast: 0.9,
      saturation: 0.75,
      temp: 0.1,
      tint: -0.02,
      fade: 0.0,
      vignette: 0.0,
      grain: 0.0,
    },
    "Slumber-ish": {
      strength: 0.9,
      exposure: 0.05,
      contrast: 0.95,
      saturation: 0.66,
      temp: 0.05,
      tint: 0.05,
      fade: 0.15,
      vignette: 0.2,
      grain: 0.0,
    },
    "Crema-ish": {
      strength: 0.9,
      exposure: 0.05,
      contrast: 1.0,
      saturation: 0.9,
      temp: -0.05,
      tint: 0.0,
      fade: 0.1,
      vignette: 0.2,
      grain: 0.05,
    },
    "Ludwig-ish": {
      strength: 0.9,
      exposure: 0.05,
      contrast: 1.05,
      saturation: 0.95,
      temp: 0.03,
      tint: 0.0,
      fade: 0.05,
      vignette: 0.05,
      grain: 0.0,
    },
    "Aden-ish": {
      strength: 0.9,
      exposure: 0.04,
      contrast: 0.9,
      saturation: 0.85,
      temp: 0.08,
      tint: 0.08,
      fade: 0.12,
      vignette: 0.1,
      grain: 0.0,
    },
    "Perpetua-ish": {
      strength: 0.9,
      exposure: 0.0,
      contrast: 1.1,
      saturation: 1.1,
      temp: -0.05,
      tint: 0.0,
      fade: 0.05,
      vignette: 0.15,
      grain: 0.05,
    },
    "West-ish": {
      strength: 0.9,
      exposure: 0.05,
      contrast: 1.15,
      saturation: 0.9,
      temp: 0.08,
      tint: 0.02,
      fade: 0.1,
      vignette: 0.15,
      grain: 0.05,
    },
    "Palma-ish": {
      strength: 0.9,
      exposure: 0.1,
      contrast: 1.05,
      saturation: 1.3,
      temp: 0.06,
      tint: -0.02,
      fade: 0.0,
      vignette: 0.05,
      grain: 0.0,
    },
    "Metro-ish": {
      strength: 0.95,
      exposure: 0.02,
      contrast: 1.2,
      saturation: 1.05,
      temp: -0.05,
      tint: 0.08,
      fade: 0.0,
      vignette: 0.1,
      grain: 0.0,
    },
    "Eiffel-ish": {
      strength: 0.9,
      exposure: 0.0,
      contrast: 1.1,
      saturation: 0.95,
      temp: -0.04,
      tint: 0.04,
      fade: 0.12,
      vignette: 0.15,
      grain: 0.04,
    },
    "Blush-ish": {
      strength: 0.9,
      exposure: 0.05,
      contrast: 0.95,
      saturation: 1.1,
      temp: 0.05,
      tint: 0.12,
      fade: 0.05,
      vignette: 0.0,
      grain: 0.0,
    },
    "Modena-ish": {
      strength: 0.9,
      exposure: 0.08,
      contrast: 1.15,
      saturation: 0.9,
      temp: 0.1,
      tint: 0.0,
      fade: 0.0,
      vignette: 0.1,
      grain: 0.0,
    },
    "Reel-ish": {
      strength: 0.9,
      exposure: 0.05,
      contrast: 1.1,
      saturation: 1.0,
      temp: 0.0,
      tint: 0.0,
      fade: 0.0,
      vignette: 0.0,
      grain: 0.12,
    },
    "Vogue-ish (BW)": {
      strength: 1.0,
      exposure: 0.05,
      contrast: 1.3,
      saturation: 0.0,
      temp: 0.0,
      tint: 0.0,
      fade: 0.05,
      vignette: 0.15,
      grain: 0.0,
    },
    "Ollie-ish (BW)": {
      strength: 1.0,
      exposure: 0.0,
      contrast: 1.05,
      saturation: 0.0,
      temp: 0.0,
      tint: 0.0,
      fade: 0.25,
      vignette: 0.1,
      grain: 0.08,
    },
    "Bazaar-ish": {
      strength: 0.95,
      exposure: 0.02,
      contrast: 1.25,
      saturation: 1.15,
      temp: 0.02,
      tint: -0.05,
      fade: 0.0,
      vignette: 0.2,
      grain: 0.0,
    },
  };

  let activePresetName = "Normal";
  let activeThumbEl = null;
  let thumbElementsMap = {};

  function setSlider(name, value) {
    if (ui[name]) {
      ui[name].value = value;
      uiVals[name + "V"].textContent = (+value).toFixed(2);
    }
  }

  function applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return;
    activePresetName = name;
    
    for (const k of Object.keys(p)) {
      if (ui[k]) setSlider(k, p[k]);
    }

    // Update active state in UI efficiently
    if (activeThumbEl) activeThumbEl.classList.remove("active");
    activeThumbEl = thumbElementsMap[name];
    if (activeThumbEl) activeThumbEl.classList.add("active");

    requestMainRender();
  }

  // -----------------------------
  // Rendering
  // -----------------------------
  let mainAnimationFrameId;
  let mainImageLoaded = false;

  function loadTexture(ctx, image) {
    ctx.gl.bindTexture(ctx.gl.TEXTURE_2D, ctx.texture);
    ctx.gl.texImage2D(ctx.gl.TEXTURE_2D, 0, ctx.gl.RGBA, ctx.gl.RGBA, ctx.gl.UNSIGNED_BYTE, image);
  }

  function render(ctx, params, width, height) {
    const gl = ctx.gl;
    gl.useProgram(ctx.program);

    gl.enableVertexAttribArray(ctx.attribs.position);
    gl.bindBuffer(gl.ARRAY_BUFFER, ctx.buffers.position);
    gl.vertexAttribPointer(ctx.attribs.position, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(ctx.attribs.texCoord);
    gl.bindBuffer(gl.ARRAY_BUFFER, ctx.buffers.texCoord);
    gl.vertexAttribPointer(ctx.attribs.texCoord, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    gl.uniform1i(ctx.locs.u_image, 0);
    gl.uniform2f(ctx.locs.u_resolution, width, height);
    gl.uniform1f(ctx.locs.u_strength, params.strength);
    gl.uniform1f(ctx.locs.u_exposure, params.exposure);
    gl.uniform1f(ctx.locs.u_contrast, params.contrast);
    gl.uniform1f(ctx.locs.u_saturation, params.saturation);
    gl.uniform1f(ctx.locs.u_temp, params.temp);
    gl.uniform1f(ctx.locs.u_tint, params.tint);
    gl.uniform1f(ctx.locs.u_fade, params.fade);
    gl.uniform1f(ctx.locs.u_vignette, params.vignette);
    gl.uniform1f(ctx.locs.u_grain, params.grain);
    gl.uniform1f(ctx.locs.u_seed, ctx.gl.canvas.id === "cv" ? Math.random() : 0.5);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function getUIParams() {
    return {
      strength: +ui.strength.value,
      exposure: +ui.exposure.value,
      contrast: +ui.contrast.value,
      saturation: +ui.saturation.value,
      temp: +ui.temp.value,
      tint: +ui.tint.value,
      fade: +ui.fade.value,
      vignette: +ui.vignette.value,
      grain: +ui.grain.value,
    };
  }

  function renderMain() {
    if (!mainImageLoaded) return;
    const t0 = performance.now();
    render(mainCtx, getUIParams(), mainCtx.gl.canvas.width, mainCtx.gl.canvas.height);
    const dt = Math.round(performance.now() - t0);
    ui.fps.textContent = `Render: ${dt}ms (WebGL)`;
    mainAnimationFrameId = null;
  }

  function requestMainRender() {
    if (!mainAnimationFrameId) {
      mainAnimationFrameId = requestAnimationFrame(renderMain);
    }
  }

  // -----------------------------
  // Thumbnails
  // -----------------------------
  let currentThumbGenId = 0;

  function generateThumbnails(sourceImage) {
    currentThumbGenId++;
    const myId = currentThumbGenId;

    // 1. Create a small version of sourceImage
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = THUMB_SIZE;
    tempCanvas.height = THUMB_SIZE;
    const ctx = tempCanvas.getContext("2d");
    
    // Draw center crop or fit? Fit is better for preview.
    // Actually, center crop square looks nice for Instagram style.
    const ratio = sourceImage.width / sourceImage.height;
    let sx, sy, sSize;
    if (ratio > 1) {
       sSize = sourceImage.height;
       sx = (sourceImage.width - sSize) / 2;
       sy = 0;
    } else {
       sSize = sourceImage.width;
       sx = 0;
       sy = (sourceImage.height - sSize) / 2;
    }
    ctx.drawImage(sourceImage, sx, sy, sSize, sSize, 0, 0, THUMB_SIZE, THUMB_SIZE);

    // 2. Upload to thumb WebGL
    loadTexture(thumbCtx, tempCanvas);

    // 3. Prepare container
    thumbElementsMap = {}; // Clear cache
    const fragment = document.createDocumentFragment();

    // 4. Async loop presets
    const entries = Object.entries(PRESETS);
    let index = 0;

    function processNext() {
      if (myId !== currentThumbGenId) return; // Cancelled
      if (index >= entries.length) {
          // Done, update DOM in one go
          ui.scroller.replaceChildren(fragment);
          return;
      }

      const [name, params] = entries[index];
      render(thumbCtx, params, THUMB_SIZE, THUMB_SIZE);
      const dataURL = thumbCtx.gl.canvas.toDataURL("image/jpeg", 0.8);

      const div = document.createElement("div");
      div.className = "filter-item";
      if(name === activePresetName) {
        div.classList.add("active");
        activeThumbEl = div;
      }
      div.dataset.name = name;
      thumbElementsMap[name] = div;

      const img = document.createElement("img");
      img.src = dataURL;
      
      const span = document.createElement("span");
      span.textContent = name.replace("-ish", "").replace("Normal", "Original");

      div.appendChild(img);
      div.appendChild(span);
      fragment.appendChild(div);

      index++;
      requestAnimationFrame(processNext);
    }

    processNext();
  }


  // -----------------------------
  // Image Loading
  // -----------------------------
  const img = new Image();
  img.crossOrigin = "anonymous";

  function drawPlaceholder() {
    const w = 1200, h = 800;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext("2d");

    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#2b5876");
    g.addColorStop(0.45, "#4e4376");
    g.addColorStop(1, "#f7971e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "48px system-ui";
    ctx.fillText("Upload an image to test filters", 70, 120);
    ctx.font = "22px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText("This is a placeholder canvas.", 70, 170);

    mainCtx.gl.canvas.width = w;
    mainCtx.gl.canvas.height = h;
    mainCtx.gl.viewport(0, 0, w, h);

    loadTexture(mainCtx, tempCanvas);
    mainImageLoaded = true;
    requestMainRender();

    // Also generate thumbnails for placeholder
    generateThumbnails(tempCanvas);
  }

  function fitToCanvas(image, maxW = 1600) {
    const ratio = image.naturalWidth / image.naturalHeight;
    let w = image.naturalWidth;
    let h = image.naturalHeight;

    if (w > maxW) {
      w = maxW;
      h = Math.round(w / ratio);
    }

    mainCtx.gl.canvas.width = w;
    mainCtx.gl.canvas.height = h;
    mainCtx.gl.viewport(0, 0, w, h);

    loadTexture(mainCtx, image);
    mainImageLoaded = true;
    generateThumbnails(image);
  }

  ui.file.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    img.onload = () => {
      fitToCanvas(img);
      URL.revokeObjectURL(url);
      requestMainRender();
    };
    img.src = url;
  });

  // Slider updates
  for (const k of [
    "strength", "exposure", "contrast", "saturation", 
    "temp", "tint", "fade", "vignette", "grain"
  ]) {
    ui[k].addEventListener("input", () => {
      uiVals[k + "V"].textContent = (+ui[k].value).toFixed(2);
      requestMainRender();
    });
  }

  ui.reset.addEventListener("click", () => {
    applyPreset("Normal");
  });

  ui.save.addEventListener("click", () => {
    const a = document.createElement("a");
    a.download = "filtered.png";
    a.href = mainCtx.gl.canvas.toDataURL("image/png");
    a.click();
  });

  ui.scroller.addEventListener("click", (e) => {
    const item = e.target.closest(".filter-item");
    if (item && item.dataset.name) {
      applyPreset(item.dataset.name);
    }
  });

  // Init
  applyPreset("Normal");
  drawPlaceholder();
})();