export type IconName =
  | 'home'
  | 'drop'
  | 'check-square'
  | 'star'
  | 'star-outline'
  | 'alert-triangle'
  | 'bell'
  | 'bell-ring'
  | 'clipboard-check'
  | 'file-text'
  | 'sliders'
  | 'search'
  | 'menu'
  | 'sidebar-layout'
  | 'sidebar-fixed'
  | 'sidebar-icons'
  | 'sidebar-hidden'
  | 'plus'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'close'
  | 'money'
  | 'flag'
  | 'check'
  | 'shield-check'
  | 'copy'
  | 'download'
  | 'eye'
  | 'eye-off'
  | 'table'
  | 'bar-chart'
  | 'trend-up'
  | 'user'
  | 'lock';

export interface SvgNodePath {
  kind: 'path';
  d: string;
  fill?: string;
}

export interface SvgNodeRect {
  kind: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
}

export interface SvgNodeCircle {
  kind: 'circle';
  cx: number;
  cy: number;
  r: number;
}

export type SvgNode = SvgNodePath | SvgNodeRect | SvgNodeCircle;

export interface IconDefinition {
  viewBox?: string;
  strokeWidth?: number;
  nodes: readonly SvgNode[];
}

export const ICON_REGISTRY: Record<IconName, IconDefinition> = {
  home: {
    nodes: [{ kind: 'path', d: 'M3 10.5L12 3l9 7.5V21H3z' }],
  },
  drop: {
    nodes: [{ kind: 'path', d: 'M12 2s6 7 6 12a6 6 0 0 1-12 0c0-5 6-12 6-12z' }],
  },
  'check-square': {
    nodes: [
      {
        kind: 'path',
        d: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
      },
    ],
  },
  star: {
    nodes: [
      {
        kind: 'path',
        d: 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z',
        fill: 'currentColor',
      },
    ],
  },
  'star-outline': {
    nodes: [
      {
        kind: 'path',
        d: 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z',
      },
    ],
  },
  'alert-triangle': {
    nodes: [
      { kind: 'path', d: 'M12 3l9 16H3z' },
      { kind: 'path', d: 'M12 10v4M12 17h.01' },
    ],
  },
  bell: {
    nodes: [{ kind: 'path', d: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9' }],
  },
  'bell-ring': {
    nodes: [
      {
        kind: 'path',
        d: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
      },
    ],
  },
  'clipboard-check': {
    nodes: [
      {
        kind: 'path',
        d: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2',
      },
      { kind: 'rect', x: 8, y: 2, width: 8, height: 4, rx: 1 },
      { kind: 'path', d: 'M9 13l2 2 4-4' },
    ],
  },
  'file-text': {
    nodes: [
      {
        kind: 'path',
        d: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z',
      },
      { kind: 'path', d: 'M14 3v6h6M8 13h8M8 17h6' },
    ],
  },
  sliders: {
    nodes: [
      {
        kind: 'path',
        d: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
      },
    ],
  },
  search: {
    nodes: [
      { kind: 'circle', cx: 11, cy: 11, r: 7 },
      { kind: 'path', d: 'M21 21l-4.3-4.3' },
    ],
  },
  menu: {
    nodes: [{ kind: 'path', d: 'M4 6h16M4 12h16M4 18h16' }],
  },
  'sidebar-layout': {
    nodes: [
      { kind: 'rect', x: 3, y: 4, width: 18, height: 16, rx: 2 },
      { kind: 'path', d: 'M9 4v16' },
    ],
  },
  'sidebar-fixed': {
    nodes: [
      { kind: 'rect', x: 3, y: 4, width: 18, height: 16, rx: 2 },
      { kind: 'path', d: 'M10 4v16' },
    ],
  },
  'sidebar-icons': {
    nodes: [
      { kind: 'rect', x: 3, y: 4, width: 18, height: 16, rx: 2 },
      { kind: 'path', d: 'M7 4v16' },
    ],
  },
  'sidebar-hidden': {
    nodes: [
      { kind: 'rect', x: 3, y: 4, width: 18, height: 16, rx: 2 },
      { kind: 'path', d: 'M3 12h4M5 10l2 2-2 2' },
    ],
  },
  plus: {
    nodes: [{ kind: 'path', d: 'M12 5v14M5 12h14' }],
  },
  'chevron-left': {
    strokeWidth: 2.4,
    nodes: [{ kind: 'path', d: 'M15 18l-6-6 6-6' }],
  },
  'chevron-right': {
    strokeWidth: 2.4,
    nodes: [{ kind: 'path', d: 'M9 18l6-6-6-6' }],
  },
  'chevron-down': {
    strokeWidth: 2.4,
    nodes: [{ kind: 'path', d: 'M6 9l6 6 6-6' }],
  },
  close: {
    nodes: [{ kind: 'path', d: 'M18 6L6 18M6 6l12 12' }],
  },
  money: {
    nodes: [
      { kind: 'rect', x: 2, y: 6, width: 20, height: 12, rx: 2 },
      { kind: 'circle', cx: 12, cy: 12, r: 3 },
    ],
  },
  flag: {
    nodes: [{ kind: 'path', d: 'M4 21V4h12l-2 4 2 4H4' }],
  },
  check: {
    nodes: [{ kind: 'path', d: 'M20 6L9 17l-5-5' }],
  },
  'shield-check': {
    nodes: [
      { kind: 'path', d: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z' },
      { kind: 'path', d: 'M9 12l2 2 4-4' },
    ],
  },
  copy: {
    nodes: [
      { kind: 'rect', x: 9, y: 9, width: 12, height: 12, rx: 2 },
      { kind: 'path', d: 'M5 15V5a2 2 0 0 1 2-2h10' },
    ],
  },
  download: {
    nodes: [{ kind: 'path', d: 'M12 3v12M7 10l5 5 5-5M4 21h16' }],
  },
  eye: {
    nodes: [
      { kind: 'path', d: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z' },
      { kind: 'circle', cx: 12, cy: 12, r: 3 },
    ],
  },
  'eye-off': {
    nodes: [
      {
        kind: 'path',
        d: 'M17.94 17.94A10.07 10.07 0 0 1 12 19c-6 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c6 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24',
      },
      { kind: 'path', d: 'M1 1l22 22' },
    ],
  },
  table: {
    nodes: [
      { kind: 'rect', x: 3, y: 4, width: 18, height: 16, rx: 2 },
      { kind: 'path', d: 'M3 10h18M9 10v10' },
    ],
  },
  'bar-chart': {
    nodes: [{ kind: 'path', d: 'M4 20V10M10 20V4M16 20v-7M22 20H2' }],
  },
  'trend-up': {
    strokeWidth: 2.2,
    nodes: [{ kind: 'path', d: 'M3 17l6-6 4 4 8-8M14 7h7v7' }],
  },
  user: {
    nodes: [
      { kind: 'path', d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' },
      { kind: 'circle', cx: 12, cy: 7, r: 4 },
    ],
  },
  lock: {
    nodes: [
      { kind: 'rect', x: 3, y: 11, width: 18, height: 11, rx: 2 },
      { kind: 'path', d: 'M7 11V7a5 5 0 0 1 10 0v4' },
    ],
  },
};
