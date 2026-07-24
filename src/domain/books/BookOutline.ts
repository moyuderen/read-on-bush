export type BookNavigationTarget =
  | { kind: 'section'; sectionIndex: number; offset?: number }
  | { kind: 'page'; pageIndex: number }
  | { kind: 'location'; locator: string };

export type BookOutlineItem = {
  id: string;
  title: string;
  target: BookNavigationTarget;
  children?: BookOutlineItem[];
};
