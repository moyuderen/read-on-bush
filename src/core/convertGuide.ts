import path from 'path';

// CloudConvert 转换入口。用通用首页而非按扩展名映射的页面：目录导入常多格式混合，
// 单格式映射不准；首页让用户自行上传转换。
export const CLOUDCONVERT_URL = 'https://cloudconvert.com';

/**
 * 汇总需转换文件的去重扩展名列表（保留发现顺序），供通知文案使用。
 * 哪些扩展名算 convertible 由 BookFormatRegistry.classifyPath 判断，本模块只管文案。
 * 纯函数、无副作用，便于单测。
 */
export function summarizeConvertible(paths: string[]): string[] {
  const formats: string[] = [];
  const seen = new Set<string>();

  for (const filePath of paths) {
    const ext = path.extname(filePath).toLowerCase().replace(/^\./, '');
    if (!ext || seen.has(ext)) {
      continue;
    }
    seen.add(ext);
    formats.push(ext);
  }

  return formats;
}
