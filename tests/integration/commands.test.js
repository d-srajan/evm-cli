import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { createTmpConfig } from '../helpers/tmpShellConfig.js';
import { setCommand, getCommand, rmCommand, listCommand } from '../../src/commands.js';
import { readManagedVars } from '../../src/shell.js';

describe('setCommand', () => {
  let tmp;
  let logs;

  beforeEach(() => {
    tmp = createTmpConfig('');
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    process.exitCode = 0;
  });

  afterEach(() => {
    tmp?.cleanup();
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it('sets a new variable', () => {
    setCommand(['FOO=bar'], { shell: 'zsh', config: tmp.configPath });
    const vars = readManagedVars(tmp.configPath, 'zsh');
    expect(vars).toEqual([{ key: 'FOO', value: 'bar' }]);
    expect(logs.some(l => l.includes('Set'))).toBe(true);
  });

  it('updates an existing variable', () => {
    setCommand(['FOO=old'], { shell: 'zsh', config: tmp.configPath });
    setCommand(['FOO=new'], { shell: 'zsh', config: tmp.configPath });
    const vars = readManagedVars(tmp.configPath, 'zsh');
    expect(vars).toEqual([{ key: 'FOO', value: 'new' }]);
    expect(logs.some(l => l.includes('Updated'))).toBe(true);
  });

  it('handles value with equals sign', () => {
    setCommand(['URL=https://x.com?a=1'], { shell: 'zsh', config: tmp.configPath });
    const vars = readManagedVars(tmp.configPath, 'zsh');
    expect(vars[0].value).toBe('https://x.com?a=1');
  });

  it('rejects invalid format', () => {
    setCommand(['NOVALUEPAIR'], { shell: 'zsh', config: tmp.configPath });
    expect(process.exitCode).toBe(1);
    expect(logs.some(l => l.includes('Invalid format'))).toBe(true);
  });

  it('works with fish shell', () => {
    setCommand(['FOO=bar'], { shell: 'fish', config: tmp.configPath });
    const content = tmp.read();
    expect(content).toContain('set -gx FOO "bar"');
  });
});

describe('getCommand', () => {
  let tmp;
  let logs;

  beforeEach(() => {
    tmp = createTmpConfig([
      '# >>> evm managed >>>',
      'export MY_VAR="hello"',
      '# <<< evm managed <<<',
    ].join('\n'));
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    process.exitCode = 0;
  });

  afterEach(() => {
    tmp?.cleanup();
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it('gets a variable from config file', () => {
    getCommand('MY_VAR', { shell: 'zsh', config: tmp.configPath });
    expect(logs.some(l => l.includes('MY_VAR') && l.includes('hello'))).toBe(true);
  });

  it('gets a variable from process.env', () => {
    const original = process.env.TEST_EVM_VAR;
    process.env.TEST_EVM_VAR = 'from_env';
    getCommand('TEST_EVM_VAR', { shell: 'zsh', config: tmp.configPath });
    expect(logs.some(l => l.includes('from_env'))).toBe(true);
    expect(logs.some(l => l.includes('current environment'))).toBe(true);
    if (original === undefined) delete process.env.TEST_EVM_VAR;
    else process.env.TEST_EVM_VAR = original;
  });

  it('reports missing variable', () => {
    getCommand('NOPE', { shell: 'zsh', config: tmp.configPath });
    expect(process.exitCode).toBe(1);
    expect(logs.some(l => l.includes('not set'))).toBe(true);
  });

  it('errors on missing key argument', () => {
    getCommand(undefined, { shell: 'zsh', config: tmp.configPath });
    expect(process.exitCode).toBe(1);
  });
});

describe('rmCommand', () => {
  let tmp;
  let logs;

  beforeEach(() => {
    tmp = createTmpConfig([
      '# >>> evm managed >>>',
      'export FOO="bar"',
      'export BAZ="qux"',
      '# <<< evm managed <<<',
    ].join('\n'));
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    process.exitCode = 0;
  });

  afterEach(() => {
    tmp?.cleanup();
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it('removes a variable', () => {
    rmCommand('FOO', { shell: 'zsh', config: tmp.configPath });
    const vars = readManagedVars(tmp.configPath, 'zsh');
    expect(vars).toEqual([{ key: 'BAZ', value: 'qux' }]);
    expect(logs.some(l => l.includes('Removed'))).toBe(true);
  });

  it('warns for non-existent variable', () => {
    rmCommand('NOPE', { shell: 'zsh', config: tmp.configPath });
    expect(logs.some(l => l.includes('not found'))).toBe(true);
  });

  it('errors on missing key argument', () => {
    rmCommand(undefined, { shell: 'zsh', config: tmp.configPath });
    expect(process.exitCode).toBe(1);
  });
});

describe('listCommand', () => {
  let tmp;
  let logs;

  beforeEach(() => {
    tmp = createTmpConfig([
      '# >>> evm managed >>>',
      'export DATABASE_URL="postgres://localhost:5432"',
      'export API_KEY="sk-secret-1234567890"',
      'export NODE_ENV="production"',
      '# <<< evm managed <<<',
    ].join('\n'));
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
  });

  afterEach(() => {
    tmp?.cleanup();
    vi.restoreAllMocks();
  });

  it('lists all variables', () => {
    listCommand({ shell: 'zsh', config: tmp.configPath });
    const output = logs.join('\n');
    expect(output).toContain('DATABASE_URL');
    expect(output).toContain('API_KEY');
    expect(output).toContain('NODE_ENV');
    expect(output).toContain('3 variables');
  });

  it('masks sensitive values by default', () => {
    listCommand({ shell: 'zsh', config: tmp.configPath });
    const output = logs.join('\n');
    // API_KEY should be masked
    expect(output).toContain('••••');
    // DATABASE_URL should not be masked
    expect(output).toContain('postgres://localhost:5432');
  });

  it('unmasks with --unmask flag', () => {
    listCommand({ shell: 'zsh', config: tmp.configPath, unmask: true });
    const output = logs.join('\n');
    expect(output).toContain('sk-secret-1234567890');
  });

  it('filters with --grep', () => {
    listCommand({ shell: 'zsh', config: tmp.configPath, grep: 'NODE' });
    const output = logs.join('\n');
    expect(output).toContain('NODE_ENV');
    expect(output).toContain('1 variable');
  });

  it('shows message when no variables exist', () => {
    const emptyTmp = createTmpConfig('');
    listCommand({ shell: 'zsh', config: emptyTmp.configPath });
    const output = logs.join('\n');
    expect(output).toContain('No environment variables');
    emptyTmp.cleanup();
  });
});
