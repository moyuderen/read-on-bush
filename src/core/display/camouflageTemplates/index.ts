import type { TerminalCamouflageStyle } from '../../settings';
import { buildLogTemplate } from './buildLog';
import { createClaudeCliTemplate } from './claudeCli';
import { dockerTemplate } from './docker';
import { serverLogTemplate } from './serverLog';
import type { TemplateHelpers, TerminalTemplate } from './types';
import { viteTemplate } from './vite';

export type { TemplateHelpers, TerminalTemplate } from './types';

export function createBuiltinTemplates(helpers: TemplateHelpers): Record<TerminalCamouflageStyle, TerminalTemplate> {
  return {
    buildLog: buildLogTemplate,
    claudeCli: createClaudeCliTemplate(helpers),
    serverLog: serverLogTemplate,
    vite: viteTemplate,
    docker: dockerTemplate
  };
}
