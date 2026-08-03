import type { BuiltinTerminalCamouflageStyle } from '../../settings';
import { buildLogTemplate } from './buildLog';
import { createClaudeCliTemplate } from './claudeCli';
import { dockerTemplate } from './docker';
import { serverLogTemplate } from './serverLog';
import type { TemplateHelpers, TerminalTemplate } from './types';
import { viteTemplate } from './vite';

export {
  CUSTOM_TEMPLATE_LINE_STYLE_OPTIONS,
  SAFE_SGR_CODE_ALTERNATION,
  STYLE_SGR_ENTRIES,
  type CustomTemplateDiagnostic,
  type CustomTemplateLine,
  type CustomTemplateLineStyle,
  type CustomTerminalTemplateConfig,
  type ResolvedTerminalTemplate,
  type TemplateHelpers,
  type TerminalTemplate
} from './types';

export function createBuiltinTemplates(helpers: TemplateHelpers): Record<BuiltinTerminalCamouflageStyle, TerminalTemplate> {
  return {
    buildLog: buildLogTemplate,
    claudeCli: createClaudeCliTemplate(helpers),
    serverLog: serverLogTemplate,
    vite: viteTemplate,
    docker: dockerTemplate
  };
}
