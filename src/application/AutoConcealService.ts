import { window } from 'vscode';
import type { Disposable } from 'vscode';
import type { ApplicationContext } from './ApplicationContext';
import { getAutoConcealOnFocusLoss, getAutoRevealOnFocus } from '../config/settings';

/**
 * 监听 VS Code 窗口焦点变化，实现失焦自动隐蔽与获焦自动恢复。
 *
 * - 失焦时：将当前活跃的伪装显示切换为占位内容（来源标记 'auto'）。
 * - 获焦时：若配置开启自动恢复，仅恢复因失焦自动隐蔽的内容（来源 'auto'），
 *   不影响用户手动按 q/d 隐蔽的内容。
 *
 * 双路径覆盖三种格式：
 * - TXT 伪装终端 / 状态栏 → displayManager.concealActive() / revealActive()
 * - EPUB / PDF 伪装终端   → readingSession.current?.concealContent() / revealContent()
 *
 * 同一时刻最多只有一个路径处于活跃状态。未开启（opened=false）的伪装显示，
 * 其 concealContent/revealContent 会直接返回 false（幂等空操作），不会触发回调。
 */
export class AutoConcealService implements Disposable {
  private readonly subscription: Disposable;

  constructor(private readonly app: ApplicationContext) {
    this.subscription = window.onDidChangeWindowState((state) => this.handleWindowState(state));
  }

  private handleWindowState(state: { focused: boolean }): void {
    if (!state.focused) {
      if (getAutoConcealOnFocusLoss()) {
        this.concealActive();
      }
      return;
    }

    if (getAutoRevealOnFocus()) {
      this.revealActive();
    }
  }

  private concealActive(): void {
    this.app.displayManager.concealActive();
    this.app.readingSession.current?.concealContent?.();
  }

  private revealActive(): void {
    this.app.displayManager.revealActive();
    this.app.readingSession.current?.revealContent?.();
  }

  dispose(): void {
    this.subscription.dispose();
  }
}
