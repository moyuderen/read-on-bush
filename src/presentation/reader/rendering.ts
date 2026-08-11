export {
  clearScreen,
  computeResolvedEffectiveLineWidth,
  formatResolvedCamouflageScreen,
  formatResolvedDebugCamouflageScreen,
  formatResolvedTerminalIdleScreen,
  formatResolvedTerminalTitle,
  getResolvedDebugContentLines,
  getTextWidth,
  sanitizeContent,
  splitContent,
  updateTerminalTemplate,
  resolveBuiltinTemplate,
  type TerminalCamouflageContentMode
} from './CamouflageRenderer';
export { getCharWidth } from '../../domain/books/TextWidth';
export { KEYS_HINT } from '../readerTemplates/TemplateKeys';
export { terminalScreenToPreviewLines } from './CamouflagePreview';
export { CamouflageTemplateService } from './CamouflageTemplateService';
export type { CamouflagePreviewLine } from './CamouflagePreview';
