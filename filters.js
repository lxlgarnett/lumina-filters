// -----------------------------
// Utilities
// -----------------------------
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;

function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [r, g, b];
}

// S-curve-ish contrast around 0.5
function applyContrast(x, c) {
  return clamp01((x - 0.5) * c + 0.5);
}

// "Fade / matte" lifts shadows and slightly compresses highlights
function applyFade(x, amount) {
  // amount 0..0.5
  const a = amount;
  // Lift blacks
  let y = x * (1 - 0.25 * a) + 0.08 * a;
  // Compress highlights a bit
  y = lerp(y, Math.pow(y, 0.9), 0.35 * a);
  return clamp01(y);
}

// Temp shift: warm -> raise R, lower B (simple)
function applyTemperature(r, g, b, t) {
  // t -0.3..0.3
  const rr = clamp01(r * (1 + t));
  const bb = clamp01(b * (1 - t));
  return [rr, g, bb];
}

// Tint shift: magenta -> raise R&B, lower G; green -> raise G, lower R&B
function applyTint(r, g, b, t) {
  // t -0.3..0.3
  // t > 0: Magenta (increase R/B, decrease G)
  // t < 0: Green (increase G, decrease R/B)
  const rr = clamp01(r * (1 + t * 0.5));
  const gg = clamp01(g * (1 - t));
  const bb = clamp01(b * (1 + t * 0.5));
  return [rr, gg, bb];
}

function vignetteFactor(x, y, w, h, strength) {
  if (strength <= 0) return 1;
  const nx = (x / (w - 1)) * 2 - 1;
  const ny = (y / (h - 1)) * 2 - 1;
  const d = Math.sqrt(nx * nx + ny * ny);
  // smooth falloff
  const v = 1 - strength * Math.pow(Math.min(1, d), 1.7);
  return Math.max(0, v);
}

// Deterministic pseudo-random for grain
function noise2D(x, y, seed) {
  // cheap hash
  let n = x * 374761393 + y * 668265263 + seed * 1442695041;
  n = (n ^ (n >> 13)) * 1274126177;
  n = n ^ (n >> 16);
  // [0,1)
  return (n >>> 0) / 4294967296;
}

// Export for Node.js (Jest) and Browser (Window/Worker)
(function(root) {
  const ImageFilters = {
    clamp01,
    lerp,
    rgbToHsl,
    hslToRgb,
    applyContrast,
    applyFade,
    applyTemperature,
    applyTint,
    vignetteFactor,
    noise2D
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageFilters;
  } else {
    root.ImageFilters = ImageFilters;
  }
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : this);
