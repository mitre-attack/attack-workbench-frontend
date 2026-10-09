import { describe, expect, it } from 'vitest';

import { serializeJsonForDownload } from './json-download';

describe('JSON download utilities', () => {
  it('serializes the exact indented JSON content expected by backend hashes', () => {
    const content = serializeJsonForDownload({ type: 'bundle', objects: [] });

    expect(content).toBe(
      ['{', '    "type": "bundle",', '    "objects": []', '}'].join('\n')
    );
  });
});
