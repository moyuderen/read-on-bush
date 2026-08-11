import type { CamouflageTemplateService } from './rendering';
import {
  getShowChapterTitle,
  getTerminalCamouflageLineCount,
  getTerminalCamouflageLineWidth,
  getTerminalCamouflageTemplateSettings
} from '../../config/settings';
import type { ResolvedTerminalTemplate } from '../readerTemplates';
import type { ReaderDisplaySettings } from './PaginatedReaderDisplay';

type ReaderPrivacy = {
  readonly isPrivate: boolean;
  applyTerminalPrivacy(template: ResolvedTerminalTemplate): ResolvedTerminalTemplate;
};

export function getReaderDisplaySettings(
  templateService: CamouflageTemplateService,
  privacyDisplay: ReaderPrivacy
): ReaderDisplaySettings {
  const template = templateService.resolve(getTerminalCamouflageTemplateSettings());
  return {
    template: privacyDisplay.applyTerminalPrivacy(template),
    lineWidth: getTerminalCamouflageLineWidth(),
    lineCount: getTerminalCamouflageLineCount(),
    showChapterTitle: getShowChapterTitle() && !privacyDisplay.isPrivate
  };
}
