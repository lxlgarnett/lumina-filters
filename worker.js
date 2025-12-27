// Import utilities
importScripts('filters.js');

const {
  clamp01,
  lerp,
  rgbToHsl,
  hslToRgb,
  applyContrast,
  applyFade,
  applyTemperature,
  vignetteFactor,
  noise2D
} = self.ImageFilters;

self.onmessage = function(e) {
  const { imageData, params, seed } = e.data;
  const processedData = processImage(imageData, params, seed);
  
  // Send back the processed ImageData. 
  // We transfer the buffer to avoid copying, which is faster.
  self.postMessage({ imageData: processedData }, [processedData.data.buffer]);
};

function processImage(originalImageData, params, seed) {
  const w = originalImageData.width;
  const h = originalImageData.height;
  
  // Create a new ImageData object (or copy) to avoid mutating the original passed in
  // In a worker, we might receive a raw buffer, but here we assume standard ImageData structure
  // We'll create a new buffer for the output
  const src = originalImageData.data;
  const len = src.length;
  const outData = new Uint8ClampedArray(len);
  
  const grainAmt = params.grain;
  const vigAmt = params.vignette;
  const strength = params.strength;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r0 = src[i] / 255;
      const g0 = src[i + 1] / 255;
      const b0 = src[i + 2] / 255;

      // --- Cooked pipeline ---
      let r = r0, g = g0, b = b0;

      // Exposure
      const ex = params.exposure;
      r = clamp01(r + ex);
      g = clamp01(g + ex);
      b = clamp01(b + ex);

      // Contrast
      r = applyContrast(r, params.contrast);
      g = applyContrast(g, params.contrast);
      b = applyContrast(b, params.contrast);

      // Saturation
      let [hh, ss, ll] = rgbToHsl(r, g, b);
      ss = clamp01(ss * params.saturation);
      [r, g, b] = hslToRgb(hh, ss, ll);

      // Temperature
      [r, g, b] = applyTemperature(r, g, b, params.temp);

      // Fade / matte
      r = applyFade(r, params.fade);
      g = applyFade(g, params.fade);
      b = applyFade(b, params.fade);

      // Vignette
      const v = vignetteFactor(x, y, w, h, vigAmt);
      r *= v;
      g *= v;
      b *= v;

      // Grain
      if (grainAmt > 0) {
        const n = noise2D(x, y, seed) * 2 - 1; // [-1,1]
        // midtone-weighted grain
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const midW = 1 - Math.abs(lum - 0.5) * 2; // 0..1
        const gn = n * (0.03 + 0.12 * grainAmt) * midW;
        r = clamp01(r + gn);
        g = clamp01(g + gn);
        b = clamp01(b + gn);
      }

      // --- Blend with original by strength ---
      r = lerp(r0, r, strength);
      g = lerp(g0, g, strength);
      b = lerp(b0, b, strength);

      outData[i] = (r * 255) | 0;
      outData[i + 1] = (g * 255) | 0;
      outData[i + 2] = (b * 255) | 0;
      outData[i + 3] = 255; // Alpha
    }
  }

  return new ImageData(outData, w, h);
}
