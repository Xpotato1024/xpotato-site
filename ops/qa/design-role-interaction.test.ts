import { it, expect } from 'vitest';
import { boundaryContrast } from './design-role-interaction.mjs';
it('computes unrounded boundary contrast without assuming transparent backgrounds', () => {
  expect(boundaryContrast('rgb(0, 0, 0)', 'rgb(255, 255, 255)')).toBe(21);
  expect(boundaryContrast('rgb(120, 120, 120)', 'rgb(120, 120, 120)')).toBe(1);
  expect(boundaryContrast('rgba(143, 135, 153, 1)', 'rgb(250, 249, 247)')).toBeGreaterThanOrEqual(3);
  expect(boundaryContrast('rgb(216, 212, 220)', 'rgb(250, 249, 247)')).toBeLessThan(3);
  expect(() => boundaryContrast('rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)')).toThrow('Opaque sRGB');
  expect(() => boundaryContrast('rgb(0, 0, 0)', 'transparent')).toThrow('Opaque sRGB');
});
