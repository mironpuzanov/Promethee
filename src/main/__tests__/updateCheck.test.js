import { describe, expect, it } from 'vitest';
import { compareVersions, pickReleaseAsset } from '../updateCheck.js';

describe('updateCheck helpers', () => {
  it('compares semver-style versions correctly', () => {
    expect(compareVersions('1.2.0', '1.1.9')).toBe(1);
    expect(compareVersions('v1.1.0', '1.1.0')).toBe(0);
    expect(compareVersions('1.1.0', '1.1.1')).toBe(-1);
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
  });

  it('prefers platform-native release assets', () => {
    const assets = [
      { name: 'Promethee-mac.zip', browser_download_url: 'https://example.com/mac.zip' },
      { name: 'Promethee.dmg', browser_download_url: 'https://example.com/mac.dmg' },
      { name: 'Promethee.exe', browser_download_url: 'https://example.com/win.exe' },
    ];

    expect(pickReleaseAsset(assets, 'darwin')?.name).toBe('Promethee.dmg');
    expect(pickReleaseAsset(assets, 'win32')?.name).toBe('Promethee.exe');
  });
});
