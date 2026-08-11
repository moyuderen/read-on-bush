import type { BuiltinTerminalCamouflageStyle } from '../../config/settings';
import { buildLogTemplate } from './BuildLogTemplate';
import { createClaudeCliTemplate } from './ClaudeCliTemplate';
import { dockerTemplate } from './DockerTemplate';
import { serverLogTemplate } from './ServerLogTemplate';
import type { TemplateHelpers, TerminalTemplate } from './TemplateTypes';
import { viteTemplate } from './ViteTemplate';

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
} from './TemplateTypes';

export function createBuiltinTemplates(helpers: TemplateHelpers): Record<BuiltinTerminalCamouflageStyle, TerminalTemplate> {
  return {
    buildLog: buildLogTemplate,
    claudeCli: createClaudeCliTemplate(helpers),
    serverLog: serverLogTemplate,
    vite: viteTemplate,
    docker: dockerTemplate
  };
}
