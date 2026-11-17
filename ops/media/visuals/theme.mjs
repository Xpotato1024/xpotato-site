import {createHash} from 'node:crypto';
export {technicalVisualTheme as visualTheme} from '../../../packages/design-system/src/theme.mjs';
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const repository=new URL('../../../',import.meta.url);
