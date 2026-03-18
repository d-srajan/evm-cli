import { describe, it, expect } from 'vitest';
import { parseDotEnvFile, serializeDotEnv } from '../../src/utils.js';

describe('parseDotEnvFile', () => {
  it('parses simple KEY=value pairs', () => {
    expect(parseDotEnvFile('FOO=bar\nBAZ=qux\n')).toEqual([
      { key: 'FOO', value: 'bar' },
      { key: 'BAZ', value: 'qux' },
    ]);
  });

  it('skips blank lines', () => {
    expect(parseDotEnvFile('\nFOO=bar\n\n')).toEqual([{ key: 'FOO', value: 'bar' }]);
  });

  it('skips comment lines', () => {
    expect(parseDotEnvFile('# comment\nFOO=bar\n')).toEqual([{ key: 'FOO', value: 'bar' }]);
  });

  it('handles values with = signs', () => {
    const result = parseDotEnvFile('URL=https://x.com?a=1&b=2\n');
    expect(result).toEqual([{ key: 'URL', value: 'https://x.com?a=1&b=2' }]);
  });

  it('handles empty file', () => {
    expect(parseDotEnvFile('')).toEqual([]);
  });

  it('skips invalid lines', () => {
    expect(parseDotEnvFile('NOEQUALSSIGN\nFOO=bar\n')).toEqual([{ key: 'FOO', value: 'bar' }]);
  });
});

describe('serializeDotEnv', () => {
  it('serializes vars to .env format', () => {
    const result = serializeDotEnv([
      { key: 'FOO', value: 'bar' },
      { key: 'BAZ', value: 'qux' },
    ]);
    expect(result).toBe('FOO=bar\nBAZ=qux\n');
  });

  it('serializes empty array to empty string with newline', () => {
    expect(serializeDotEnv([])).toBe('\n');
  });

  it('handles values with special chars', () => {
    const result = serializeDotEnv([{ key: 'URL', value: 'https://x.com?a=1' }]);
    expect(result).toBe('URL=https://x.com?a=1\n');
  });
});
