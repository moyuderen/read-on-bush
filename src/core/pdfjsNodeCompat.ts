/**
 * pdfjs-dist 在 VS Code 扩展宿主里的兼容垫片。解决打开/导入 PDF 时的
 * "Setting up fake worker failed: document is not defined"。
 *
 * 根因：pdfjs 用 isNodeJS 决定走 Node 路径还是 DOM 路径。在 Electron 扩展宿主里
 * process.type 不是 'browser' 且常不可写，导致 isNodeJS=false → 加载 worker 时走
 * loadScript（DOM，引用 document）→ 崩溃。
 *
 * 两道保险：
 * 1. 预加载 pdf.worker.js 挂到 globalThis.pdfjsWorker —— pdfjs 的 _setupFakeWorkerGlobal
 *    会直接复用主线程上这份 WorkerMessageHandler（pdf.js 里 _mainThreadWorkerMessageHandler
 *    读取 globalThis.pdfjsWorker），完全绕开「按 isNodeJS 决定如何加载 worker」的分支。
 * 2. 用 Object.defineProperty 把 process.type 强制为 'browser'（普通赋值在不可写时静默失败），
 *    让 isNodeJS=true，解析与图片走 Node 工厂；加载完即还原 process.type（isNodeJS 已缓存）。
 */

type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.js');

interface ProcessLike {
  type?: string;
}

const proc = process as ProcessLike;
const originalType = proc.type;
const originalDescriptor = Object.getOwnPropertyDescriptor(proc, 'type');

function forceProcessType(value: string | undefined): void {
  try {
    Object.defineProperty(proc, 'type', {
      value,
      writable: true,
      configurable: true,
      enumerable: true
    });
    return;
  } catch {
    // 部分环境下 defineProperty 仍可能失败，退回普通赋值
  }
  try {
    proc.type = value;
  } catch {
    // 实在不可写只能放弃——下方预加载 worker 仍能兜底
  }
}

function restoreProcessType(): void {
  if (originalDescriptor) {
    try {
      Object.defineProperty(proc, 'type', originalDescriptor);
      return;
    } catch {
      forceProcessType(originalType);
      return;
    }
  }
  forceProcessType(originalType);
}

const pdfjsLib: PdfjsModule = (() => {
  forceProcessType('browser');
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const lib: PdfjsModule = require('pdfjs-dist/legacy/build/pdf.js');

    // 预加载 worker 模块并挂到 globalThis，让 pdfjs 直接复用，绕开 DOM worker 加载分支。
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfjsWorker = require('pdfjs-dist/legacy/build/pdf.worker.js');
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;
    return lib;
  } finally {
    // require 任一步失败也必须还原，避免污染整个 VS Code 扩展宿主。
    // isNodeJS 已在 pdfjs 加载时计算并缓存，成功路径还原后不影响其 Node 分支选择。
    restoreProcessType();
  }
})();

export { pdfjsLib };
