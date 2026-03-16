import { describe, it, expect } from 'vitest';
import { parseKeyValue, parseExportLine, buildExportLine, isSensitiveKey, maskValue } from '../../src/utils.js';

describe('parseKeyValue', () => {
  it('parses simple KEY=value', () => {
    expect(parseKeyValue('FOO=bar')).toEqual({ key: 'FOO', value: 'bar' });
  });

  it('handles value with equals sign', () => {
    expect(parseKeyValue('URL=https://x.com?a=1&b=2')).toEqual({
      key: 'URL',
      value: 'https://x.com?a=1&b=2',
    });
  });

  it('handles empty value', () => {
    expect(parseKeyValue('EMPTY=')).toEqual({ key: 'EMPTY', value: '' });
  });

  it('handles value with spaces', () => {
    expect(parseKeyValue('MSG=hello world')).toEqual({ key: 'MSG', value: 'hello world' });
  });

  it('handles underscores in key', () => {
    expect(parseKeyValue('MY_VAR=123')).toEqual({ key: 'MY_VAR', value: '123' });
  });

  it('returns null for missing equals', () => {
    expect(parseKeyValue('NOVALUE')).toBeNull();
  });

  it('returns null for invalid key (starts with number)', () => {
    expect(parseKeyValue('123=bad')).toBeNull();
  });

  it('returns null for empty key', () => {
    expect(parseKeyValue('=value')).toBeNull();
  });
});

describe('parseExportLine', () => {
  it('parses double-quoted export', () => {
    expect(parseExportLine('export FOO="bar"', 'zsh')).toEqual({ key: 'FOO', value: 'bar' });
  });

  it('parses single-quoted export', () => {
    expect(parseExportLine("export FOO='bar'", 'bash')).toEqual({ key: 'FOO', value: 'bar' });
  });

  it('parses unquoted export', () => {
    expect(parseExportLine('export FOO=bar', 'zsh')).toEqual({ key: 'FOO', value: 'bar' });
  });

  it('parses fish set -gx', () => {
    expect(parseExportLine('set -gx FOO "bar"', 'fish')).toEqual({ key: 'FOO', value: 'bar' });
  });

  it('parses fish set -gx unquoted', () => {
    expect(parseExportLine('set -gx FOO bar', 'fish')).toEqual({ key: 'FOO', value: 'bar' });
  });

  it('returns null for non-export line', () => {
    expect(parseExportLine('# comment', 'zsh')).toBeNull();
  });

  it('handles leading whitespace', () => {
    expect(parseExportLine('  export FOO="bar"', 'zsh')).toEqual({ key: 'FOO', value: 'bar' });
  });
});

describe('buildExportLine', () => {
  it('builds zsh export', () => {
    expect(buildExportLine('FOO', 'bar', 'zsh')).toBe('export FOO="bar"');
  });

  it('builds bash export', () => {
    expect(buildExportLine('FOO', 'bar', 'bash')).toBe('export FOO="bar"');
  });

  it('builds fish set -gx', () => {
    expect(buildExportLine('FOO', 'bar', 'fish')).toBe('set -gx FOO "bar"');
  });
});

describe('isSensitiveKey', () => {
  it('detects SECRET', () => expect(isSensitiveKey('MY_SECRET')).toBe(true));
  it('detects TOKEN', () => expect(isSensitiveKey('AUTH_TOKEN')).toBe(true));
  it('detects PASSWORD', () => expect(isSensitiveKey('DB_PASSWORD')).toBe(true));
  it('detects API_KEY', () => expect(isSensitiveKey('API_KEY')).toBe(true));
  it('ignores non-sensitive', () => expect(isSensitiveKey('DATABASE_URL')).toBe(false));
  it('ignores HOME', () => expect(isSensitiveKey('HOME')).toBe(false));
});

describe('maskValue', () => {
  it('masks long value showing last 4 chars', () => {
    expect(maskValue('sk-1234567890abcdef')).toBe('••••cdef');
  });

  it('fully masks short value', () => {
    expect(maskValue('abc')).toBe('••••');
  });

  it('masks exactly 4 chars', () => {
    expect(maskValue('abcd')).toBe('••••');
  });

  it('masks 5+ chars showing last 4', () => {
    expect(maskValue('12345')).toBe('••••2345');
  });
});
