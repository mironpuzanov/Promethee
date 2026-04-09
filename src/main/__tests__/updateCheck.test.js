import { describe, expect, it } from 'vitest';
import { compareVersions, pickBestUpdateRow } from '../updateCheck.js';

describe('updateCheck helpers', () => {
  it('compares semver-style versions correctly', () => {
    expect(compareVersions('1.2.0', '1.1.9')).toBe(1);
    expect(compareVersions('v1.1.0', '1.1.0')).toBe(0);
    expect(compareVersions('1.1.0', '1.1.1')).toBe(-1);
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
  });

  it('prefers the exact platform row over the all-platform fallback', () => {
    const rows = [
      { platform: 'all', version: '1.1.2', download_url: 'https://example.com/all.dmg' },
      { platform: 'darwin', version: '1.1.3', download_url: 'https://example.com/mac.dmg' },
    ];

    expect(pickBestUpdateRow(rows, 'darwin')?.version).toBe('1.1.3');
    expect(pickBestUpdateRow(rows, 'linux')?.version).toBe('1.1.2');
  });
});
