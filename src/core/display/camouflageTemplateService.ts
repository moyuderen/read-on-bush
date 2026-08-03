import type { TerminalCamouflageTemplateSettings } from '../settings';
import { resolveBuiltinTemplate } from './camouflageRender';
import { parseCustomTerminalTemplate } from './camouflageTemplates/customTemplate';
import type { ResolvedTerminalTemplate } from './camouflageTemplates';

export class CamouflageTemplateService {
  // 上一次成功解析的自定义模板。canonicalJson 不变时复用同一个 template 对象，
  // 让 camouflageRender 的 WeakMap 调试行缓存能跨翻页命中；解析失败时也作为「上一次有效」回退。
  private cachedCustom?: ResolvedTerminalTemplate;
  private cachedCanonicalJson?: string;
  // 原始输入的指纹（JSON.stringify）。VS Code 对 object 配置每次返回新克隆，
  // 引用相等永远不成立，所以用值指纹短路掉对未变更配置的重复解析/编译。
  private cachedInputKey?: string;

  resolve(settings: TerminalCamouflageTemplateSettings): ResolvedTerminalTemplate {
    if (settings.style !== 'custom') {
      return resolveBuiltinTemplate(settings.style);
    }

    const inputKey = fingerprint(settings.customTemplate);
    if (inputKey !== undefined && inputKey === this.cachedInputKey && this.cachedCustom) {
      return this.cachedCustom;
    }

    const parsed = parseCustomTerminalTemplate(settings.customTemplate);
    if (parsed.ok) {
      this.cachedInputKey = inputKey;
      if (parsed.value.canonicalJson !== this.cachedCanonicalJson || !this.cachedCustom) {
        this.cachedCanonicalJson = parsed.value.canonicalJson;
        this.cachedCustom = {
          key: `custom:${parsed.value.canonicalJson}`,
          requestedStyle: 'custom',
          template: parsed.value.template
        };
      }
      return this.cachedCustom;
    }

    // 无效配置：沿用上一次有效的 custom；进程内从未成功过则回退 buildLog。
    return this.cachedCustom ?? {
      ...resolveBuiltinTemplate('buildLog'),
      requestedStyle: 'custom'
    };
  }
}

function fingerprint(value: unknown): string | undefined {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}
