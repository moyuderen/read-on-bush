import type { CamouflageTemplateService } from './camouflageTemplateService';
import {
  getShowChapterTitle,
  getTerminalCamouflageLineCount,
  getTerminalCamouflageLineWidth,
  getTerminalCamouflageTemplateSettings
} from '../settings';
import type { PrivacyDisplayService } from '../privacy/PrivacyDisplayService';
import type { PaginatedTerminalDisplaySettings } from './paginatedTerminalDisplay';

export function getPaginatedTerminalDisplaySettings(
  templateService: CamouflageTemplateService,
  privacyDisplay: PrivacyDisplayService
): PaginatedTerminalDisplaySettings {
  const template = templateService.resolve(getTerminalCamouflageTemplateSettings());
  return {
    template: privacyDisplay.applyTerminalPrivacy(template),
    lineWidth: getTerminalCamouflageLineWidth(),
    lineCount: getTerminalCamouflageLineCount(),
    showChapterTitle: getShowChapterTitle() && !privacyDisplay.isPrivate
  };
}
