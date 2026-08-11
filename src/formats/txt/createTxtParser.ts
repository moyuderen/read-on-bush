import { createBookParser } from '../../infrastructure/parsers';
import { getLineWidth, getTxtEncoding } from '../../config/settings';

export function createConfiguredTxtParser(filePath: string) {
  return createBookParser(filePath, {
    lineWidth: getLineWidth(),
    encoding: getTxtEncoding()
  });
}
