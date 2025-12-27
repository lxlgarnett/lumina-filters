(() => {
  // -----------------------------
  // Router Logic
  // -----------------------------
  function handleRoute() {
    const hash = window.location.hash || "#home";

    // Hide all views
    document
      .querySelectorAll(".view")
      .forEach((el) => el.classList.remove("active"));
    document
      .querySelectorAll("nav a")
      .forEach((el) => el.classList.remove("active"));

    // Show target view
    if (hash === "#editor") {
      document.getElementById("view-editor").classList.add("active");
      document.getElementById("nav-editor").classList.add("active");
      // Refresh canvas if needed (sometimes canvas needs redraw when unhidden)
      requestRender();
    } else {
      document.getElementById("view-home").classList.add("active");
      document.getElementById("nav-home").classList.add("active");
    }
  }

  window.addEventListener("hashchange", handleRoute);
  window.addEventListener("DOMContentLoaded", handleRoute);

  // -----------------------------
  // WebGL Setup
  // -----------------------------
  const $ = (id) => document.getElementById(id);
  const canvas = $("cv");
  const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });

  if (!gl) {
    alert("WebGL not supported");
    return;
  }

  // Shaders
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

    // Pseudo-random noise
    float hash12(vec2 p) {
        vec3 p3  = fract(vec3(p.xyx) * .1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
        vec4 texColor = texture2D(u_image, v_texCoord);
        vec3 col = texColor.rgb;
        vec3 originalCol = col;

        // Exposure (Add)
        col = clamp(col + u_exposure, 0.0, 1.0);

        // Contrast
        col = clamp((col - 0.5) * u_contrast + 0.5, 0.0, 1.0);

        // Saturation (Luma mix)
        float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(lum), col, u_saturation);
        col = clamp(col, 0.0, 1.0);

        // Temperature
        // warm -> raise R, lower B
        col.r = clamp(col.r * (1.0 + u_temp), 0.0, 1.0);
        col.b = clamp(col.b * (1.0 - u_temp), 0.0, 1.0);

        // Tint
        // magenta -> raise R/B, lower G; green -> raise G, lower R/B
        col.r = clamp(col.r * (1.0 + u_tint * 0.5), 0.0, 1.0);
        col.g = clamp(col.g * (1.0 - u_tint), 0.0, 1.0);
        col.b = clamp(col.b * (1.0 + u_tint * 0.5), 0.0, 1.0);

        // Fade
        // y = x * (1 - 0.25 * a) + 0.08 * a;
        // y = lerp(y, pow(y, 0.9), 0.35 * a);
        if (u_fade > 0.0) {
            vec3 y = col * (1.0 - 0.25 * u_fade) + 0.08 * u_fade;
            // vector pow is component-wise
            vec3 y_pow = pow(y, vec3(0.9));
            col = mix(y, y_pow, 0.35 * u_fade);
            col = clamp(col, 0.0, 1.0);
        }

        // Vignette
        // coord -1..1
        vec2 coord = v_texCoord * 2.0 - 1.0;
        // Correct aspect ratio for circular vignette if needed, but original code was simple distance
        // The original code calculated distance in normalized space 0..1 then *2-1, so just simple distance from center in UV space
        // However, standard vignette is usually circular.
        // Original: (x / (w - 1)) * 2 - 1
        float d = length(coord);
        float v = 1.0 - u_vignette * pow(min(1.0, d), 1.7);
        col *= max(0.0, v);

        // Grain
        if (u_grain > 0.0) {
            float n = hash12(v_texCoord * u_resolution + u_seed) * 2.0 - 1.0; // -1..1
            float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
            float midW = 1.0 - abs(l - 0.5) * 2.0;
            float gn = n * (0.03 + 0.12 * u_grain) * midW;
            col = clamp(col + gn, 0.0, 1.0);
        }

        // Strength (Mix with original)
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

  const program = createProgram(
    gl,
    createShader(gl, gl.VERTEX_SHADER, vsSource),
    createShader(gl, gl.FRAGMENT_SHADER, fsSource),
  );

  // Locations
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

  // Buffer setup (Quad)
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

  // Create texture
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  // Default filtering
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // -----------------------------
  // UI wiring
  // -----------------------------
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

  // Presets definition
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
    // Instagram-ish
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

    // Google Photos-ish
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
    }, // Film grain focus
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

  function setSlider(name, value) {
    if (ui[name]) {
      ui[name].value = value;
      uiVals[name + "V"].textContent = (+value).toFixed(2);
    }
  }

  function applyPreset(p) {
    for (const k of Object.keys(p)) {
      if (ui[k]) setSlider(k, p[k]);
    }
    requestRender();
  }

  // Populate presets
  for (const name of Object.keys(PRESETS)) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    ui.preset.appendChild(opt);
  }
  ui.preset.value = "Normal";

  // -----------------------------
  // Image loading + scaling
  // -----------------------------
  const img = new Image();
  img.crossOrigin = "anonymous";
  let imageLoaded = false;

  function loadTexture(image) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  }

  function drawPlaceholder() {
    const w = 1200,
      h = 800;
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

    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);

    loadTexture(tempCanvas);
    imageLoaded = true;
    requestRender();
  }

  function fitToCanvas(image, maxW = 2000) {
    // WebGL can handle larger images easily
    const ratio = image.naturalWidth / image.naturalHeight;
    let w = Math.min(maxW, image.naturalWidth);
    let h = Math.round(w / ratio);

    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);

    loadTexture(image);
    imageLoaded = true;
  }

  ui.file.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    img.onload = () => {
      fitToCanvas(img);
      URL.revokeObjectURL(url);
      requestRender();
    };
    img.src = url;
  });

  // -----------------------------
  // Rendering
  // -----------------------------
  let animationFrameId;

  function render() {
    if (!imageLoaded) return;

    const t0 = performance.now();

    gl.useProgram(program);

    gl.enableVertexAttribArray(positionLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(texCoordLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    gl.uniform1i(locs.u_image, 0);
    gl.uniform2f(locs.u_resolution, canvas.width, canvas.height);
    gl.uniform1f(locs.u_strength, +ui.strength.value);
    gl.uniform1f(locs.u_exposure, +ui.exposure.value);
    gl.uniform1f(locs.u_contrast, +ui.contrast.value);
    gl.uniform1f(locs.u_saturation, +ui.saturation.value);
    gl.uniform1f(locs.u_temp, +ui.temp.value);
    gl.uniform1f(locs.u_tint, +ui.tint.value);
    gl.uniform1f(locs.u_fade, +ui.fade.value);
    gl.uniform1f(locs.u_vignette, +ui.vignette.value);
    gl.uniform1f(locs.u_grain, +ui.grain.value);
    gl.uniform1f(locs.u_seed, Math.random() * 1000.0); // Simple random seed for grain noise

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    const dt = Math.round(performance.now() - t0);
    ui.fps.textContent = `Render: ${dt}ms (WebGL)`;

    animationFrameId = null;
  }

  function requestRender() {
    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(render);
    }
  }

  // Slider updates
  for (const k of [
    "strength",
    "exposure",
    "contrast",
    "saturation",
    "temp",
    "tint",
    "fade",
    "vignette",
    "grain",
  ]) {
    ui[k].addEventListener("input", () => {
      uiVals[k + "V"].textContent = (+ui[k].value).toFixed(2);
      requestRender();
    });
  }

  ui.preset.addEventListener("change", () =>
    applyPreset(PRESETS[ui.preset.value]),
  );
  ui.reset.addEventListener("click", () => {
    ui.preset.value = "Normal";
    applyPreset(PRESETS["Normal"]);
  });

  ui.save.addEventListener("click", () => {
    // WebGL canvas needs to be drawn with preserveDrawingBuffer:true to grab dataURL
    // or just grab it right after render. We set preserveDrawingBuffer:true in init.
    const a = document.createElement("a");
    a.download = "filtered.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
  });

  // Init
  applyPreset(PRESETS["Normal"]);
  drawPlaceholder();
})();
