import { terminalScreenToPreviewLines } from '../reader/CamouflagePreview';
import type { ResolvedTerminalTemplate } from '../readerTemplates';
import type { TerminalCamouflageContentMode } from '../reader/rendering';
import type { ReaderSurfaceFrame } from './ReaderSurface';

export function createReaderSurfaceFrame(
  screen: string,
  template: ResolvedTerminalTemplate,
  mode: TerminalCamouflageContentMode
): ReaderSurfaceFrame {
  return { screen, lines: terminalScreenToPreviewLines(screen), template, mode };
}
