export const AppName = 'readOnBush';

export const LineWidth = {
  Default: 45,
  Min: 10,
  Max: 200
} as const;

export enum StatusBarPriority {
  Process = 90,
  PrevLine = 80,
  Start = 70,
  Stop = 71,
  NextLine = 60,
  JumpLine = 50,
  TerminalCamouflage = 45,
  DisableKeyBind = 40,
  ActiveKeyBind = 41,
  ImportBook = 30
}
