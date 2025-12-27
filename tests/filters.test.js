const {
  clamp01,
  lerp,
  rgbToHsl,
  hslToRgb,
  applyContrast,
  applyFade,
  applyTemperature
} = require('../filters');

describe('Image Filter Utilities', () => {
  describe('clamp01', () => {
    test('should clamp values greater than 1 to 1', () => {
      expect(clamp01(1.5)).toBe(1);
    });
    test('should clamp values less than 0 to 0', () => {
      expect(clamp01(-0.5)).toBe(0);
    });
    test('should return values between 0 and 1 as is', () => {
      expect(clamp01(0.5)).toBe(0.5);
    });
  });

  describe('lerp', () => {
    test('should interpolate between two values', () => {
      expect(lerp(0, 10, 0.5)).toBe(5);
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 1)).toBe(10);
    });
  });

  describe('rgbToHsl and hslToRgb', () => {
    test('should convert RGB to HSL and back correctly (Red)', () => {
      const rgb = [1, 0, 0];
      const hsl = rgbToHsl(...rgb);
      expect(hsl[0]).toBeCloseTo(0); // Hue 0
      expect(hsl[1]).toBeCloseTo(1); // Saturation 100%
      expect(hsl[2]).toBeCloseTo(0.5); // Lightness 50%
      
      const rgbBack = hslToRgb(...hsl);
      expect(rgbBack[0]).toBeCloseTo(1);
      expect(rgbBack[1]).toBeCloseTo(0);
      expect(rgbBack[2]).toBeCloseTo(0);
    });

    test('should convert RGB to HSL and back correctly (White)', () => {
        const rgb = [1, 1, 1];
        const hsl = rgbToHsl(...rgb);
        expect(hsl[2]).toBeCloseTo(1); // Lightness 100%
        
        const rgbBack = hslToRgb(...hsl);
        expect(rgbBack[0]).toBeCloseTo(1);
        expect(rgbBack[1]).toBeCloseTo(1);
        expect(rgbBack[2]).toBeCloseTo(1);
      });
  });

  describe('applyContrast', () => {
    test('should increase contrast (darker gets darker, lighter gets lighter)', () => {
      // Contrast > 1
      expect(applyContrast(0.2, 1.5)).toBeLessThan(0.2);
      expect(applyContrast(0.8, 1.5)).toBeGreaterThan(0.8);
    });

    test('should decrease contrast (values move towards 0.5)', () => {
        // Contrast < 1
        expect(applyContrast(0.2, 0.5)).toBeGreaterThan(0.2);
        expect(applyContrast(0.8, 0.5)).toBeLessThan(0.8);
      });
  });

  describe('applyFade', () => {
      test('should lift blacks', () => {
          expect(applyFade(0, 0.5)).toBeGreaterThan(0);
      });
  });

  describe('applyTemperature', () => {
    test('should increase Red and decrease Blue for positive temp (Warm)', () => {
        const [r, g, b] = applyTemperature(0.5, 0.5, 0.5, 0.1);
        expect(r).toBeGreaterThan(0.5);
        expect(g).toBe(0.5);
        expect(b).toBeLessThan(0.5);
    });

    test('should decrease Red and increase Blue for negative temp (Cool)', () => {
        const [r, g, b] = applyTemperature(0.5, 0.5, 0.5, -0.1);
        expect(r).toBeLessThan(0.5);
        expect(g).toBe(0.5);
        expect(b).toBeGreaterThan(0.5);
    });
  });

});
