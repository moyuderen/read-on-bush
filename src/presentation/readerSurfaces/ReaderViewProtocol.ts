import type { TerminalCamouflageContentMode } from '../reader/rendering';
import type { CamouflagePreviewLine } from '../reader/rendering';
import { isRecord } from '../../utils/isRecord';

export const readerViewProtocolVersion = 1 as const;

export type ReaderViewDimensions = {
  columns: number;
  rows: number;
};

export type ReaderViewFrame = {
  type: 'frame';
  protocol: typeof readerViewProtocolVersion;
  mode: TerminalCamouflageContentMode;
  terminalName: string;
  lines: CamouflagePreviewLine[];
};

export type ReaderViewMessage =
  | {
      type: 'ready';
      protocol: typeof readerViewProtocolVersion;
    }
  | {
      type: 'resize';
      protocol: typeof readerViewProtocolVersion;
      columns: number;
      rows: number;
    }
  | {
      type: 'input';
      protocol: typeof readerViewProtocolVersion;
      data: string;
    };

export type ReaderViewHostMessage =
  | ReaderViewFrame
  | {
      type: 'clear';
      protocol: typeof readerViewProtocolVersion;
    }
  | {
      type: 'focus';
      protocol: typeof readerViewProtocolVersion;
    };

function isProtocol(value: unknown): value is typeof readerViewProtocolVersion {
  return value === readerViewProtocolVersion;
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
}

function isValidDimension(value: unknown, maximum: number): value is number {
  return isFiniteInteger(value) && value > 0 && value <= maximum;
}

export function isReaderViewMessage(value: unknown): value is ReaderViewMessage {
  if (!isRecord(value) || !isProtocol(value.protocol) || typeof value.type !== 'string') {
    return false;
  }

  if (value.type === 'ready') {
    return true;
  }

  if (value.type === 'resize') {
    return isValidDimension(value.columns, 1000) && isValidDimension(value.rows, 500);
  }

  return value.type === 'input' && typeof value.data === 'string' && value.data.length <= 3;
}
