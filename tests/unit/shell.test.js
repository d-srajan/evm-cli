import { describe, it, expect, afterEach } from 'vitest';
import { detectShell, readManagedVars, setVar, removeVar, getVar } from '../../src/shell.js';
import { createTmpConfig } from '../helpers/tmpShellConfig.js';

describe('detectShell', () => {
  it('detects zsh from override', () => {
    expect(detectShell('zsh')).toBe('zsh');
  });

  it('detects bash from override', () => {
    expect(detectShell('bash')).toBe('bash');
  });

  it('detects fish from override', () => {
    expect(detectShell('fish')).toBe('fish');
  });

  it('uses $SHELL env var', () => {
    const original = process.env.SHELL;
    process.env.SHELL = '/usr/bin/fish';
    expect(detectShell()).toBe('fish');
    process.env.SHELL = original;
  });

  it('defaults to zsh when $SHELL is empty', () => {
    const original = process.env.SHELL;
    process.env.SHELL = '';
    expect(detectShell()).toBe('zsh');
    process.env.SHELL = original;
  });
});

describe('config file operations (zsh/bash)', () => {
  let tmp;
  afterEach(() => tmp?.cleanup());

  it('reads empty config', () => {
    tmp = createTmpConfig('');
    expect(readManagedVars(tmp.configPath, 'zsh')).toEqual([]);
  });

  it('reads managed vars from evm block', () => {
    tmp = createTmpConfig([
      '# some user config',
      '# >>> evm managed >>>',
      'export FOO="bar"',
      'export BAZ="qux"',
      '# <<< evm managed <<<',
      '# more user config',
    ].join('\n'));

    const vars = readManagedVars(tmp.configPath, 'zsh');
    expect(vars).toEqual([
      { key: 'FOO', value: 'bar' },
      { key: 'BAZ', value: 'qux' },
    ]);
  });

  it('ignores exports outside evm block', () => {
    tmp = createTmpConfig([
      'export OUTSIDE="ignore"',
      '# >>> evm managed >>>',
      'export INSIDE="keep"',
      '# <<< evm managed <<<',
    ].join('\n'));

    const vars = readManagedVars(tmp.configPath, 'zsh');
    expect(vars).toEqual([{ key: 'INSIDE', value: 'keep' }]);
  });

  it('setVar creates evm block in empty file', () => {
    tmp = createTmpConfig('');
    setVar(tmp.configPath, 'zsh', 'FOO', 'bar');
    const content = tmp.read();
    expect(content).toContain('# >>> evm managed >>>');
    expect(content).toContain('export FOO="bar"');
    expect(content).toContain('# <<< evm managed <<<');
  });

  it('setVar appends to existing block', () => {
    tmp = createTmpConfig([
      '# >>> evm managed >>>',
      'export FOO="bar"',
      '# <<< evm managed <<<',
    ].join('\n'));

    setVar(tmp.configPath, 'zsh', 'BAZ', 'qux');
    const vars = readManagedVars(tmp.configPath, 'zsh');
    expect(vars).toEqual([
      { key: 'FOO', value: 'bar' },
      { key: 'BAZ', value: 'qux' },
    ]);
  });

  it('setVar replaces existing key', () => {
    tmp = createTmpConfig([
      '# >>> evm managed >>>',
      'export FOO="old"',
      '# <<< evm managed <<<',
    ].join('\n'));

    const result = setVar(tmp.configPath, 'zsh', 'FOO', 'new');
    expect(result.replaced).toBe(true);
    const vars = readManagedVars(tmp.configPath, 'zsh');
    expect(vars).toEqual([{ key: 'FOO', value: 'new' }]);
  });

  it('setVar preserves content outside evm block', () => {
    tmp = createTmpConfig([
      '# user stuff before',
      '# >>> evm managed >>>',
      'export FOO="bar"',
      '# <<< evm managed <<<',
      '# user stuff after',
    ].join('\n'));

    setVar(tmp.configPath, 'zsh', 'BAZ', 'qux');
    const content = tmp.read();
    expect(content).toContain('# user stuff before');
    expect(content).toContain('# user stuff after');
  });

  it('removeVar removes a key', () => {
    tmp = createTmpConfig([
      '# >>> evm managed >>>',
      'export FOO="bar"',
      'export BAZ="qux"',
      '# <<< evm managed <<<',
    ].join('\n'));

    const removed = removeVar(tmp.configPath, 'zsh', 'FOO');
    expect(removed).toBe(true);
    const vars = readManagedVars(tmp.configPath, 'zsh');
    expect(vars).toEqual([{ key: 'BAZ', value: 'qux' }]);
  });

  it('removeVar returns false for non-existent key', () => {
    tmp = createTmpConfig([
      '# >>> evm managed >>>',
      'export FOO="bar"',
      '# <<< evm managed <<<',
    ].join('\n'));

    expect(removeVar(tmp.configPath, 'zsh', 'NOPE')).toBe(false);
  });

  it('removeVar returns false for missing file', () => {
    expect(removeVar('/tmp/evm-nonexistent-file', 'zsh', 'FOO')).toBe(false);
  });

  it('getVar retrieves a value', () => {
    tmp = createTmpConfig([
      '# >>> evm managed >>>',
      'export FOO="bar"',
      '# <<< evm managed <<<',
    ].join('\n'));

    expect(getVar(tmp.configPath, 'zsh', 'FOO')).toBe('bar');
  });

  it('getVar returns null for missing key', () => {
    tmp = createTmpConfig([
      '# >>> evm managed >>>',
      'export FOO="bar"',
      '# <<< evm managed <<<',
    ].join('\n'));

    expect(getVar(tmp.configPath, 'zsh', 'NOPE')).toBeNull();
  });
});

describe('config file operations (fish)', () => {
  let tmp;
  afterEach(() => tmp?.cleanup());

  it('reads fish-style vars', () => {
    tmp = createTmpConfig([
      '# >>> evm managed >>>',
      'set -gx FOO "bar"',
      'set -gx BAZ "qux"',
      '# <<< evm managed <<<',
    ].join('\n'));

    const vars = readManagedVars(tmp.configPath, 'fish');
    expect(vars).toEqual([
      { key: 'FOO', value: 'bar' },
      { key: 'BAZ', value: 'qux' },
    ]);
  });

  it('setVar writes fish syntax', () => {
    tmp = createTmpConfig('');
    setVar(tmp.configPath, 'fish', 'FOO', 'bar');
    const content = tmp.read();
    expect(content).toContain('set -gx FOO "bar"');
  });

  it('setVar replaces fish-style var', () => {
    tmp = createTmpConfig([
      '# >>> evm managed >>>',
      'set -gx FOO "old"',
      '# <<< evm managed <<<',
    ].join('\n'));

    setVar(tmp.configPath, 'fish', 'FOO', 'new');
    const vars = readManagedVars(tmp.configPath, 'fish');
    expect(vars).toEqual([{ key: 'FOO', value: 'new' }]);
  });

  it('removeVar removes fish-style var', () => {
    tmp = createTmpConfig([
      '# >>> evm managed >>>',
      'set -gx FOO "bar"',
      '# <<< evm managed <<<',
    ].join('\n'));

    expect(removeVar(tmp.configPath, 'fish', 'FOO')).toBe(true);
    expect(readManagedVars(tmp.configPath, 'fish')).toEqual([]);
  });
});
