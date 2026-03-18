import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTmpConfig } from '../helpers/tmpShellConfig.js';
import { importCommand, exportCommand, copyCommand, renameCommand, backupCommand, restoreCommand } from '../../src/commands.js';
import { readManagedVars, listBackups } from '../../src/shell.js';

function makeTmpDir() {
  const dir = mkdtempSync(join(tmpdir(), 'evm-p2-test-'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe('importCommand', () => {
  let tmp, dotenvDir, logs;

  beforeEach(() => {
    tmp = createTmpConfig('');
    dotenvDir = makeTmpDir();
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    process.exitCode = 0;
  });
  afterEach(() => { tmp.cleanup(); dotenvDir.cleanup(); vi.restoreAllMocks(); process.exitCode = 0; });

  it('imports all vars from a .env file', () => {
    const envFile = join(dotenvDir.dir, '.env');
    writeFileSync(envFile, 'FOO=bar\nBAZ=qux\n');
    importCommand(envFile, { shell: 'zsh', config: tmp.configPath });
    const vars = readManagedVars(tmp.configPath, 'zsh');
    expect(vars).toEqual([{ key: 'FOO', value: 'bar' }, { key: 'BAZ', value: 'qux' }]);
    expect(logs.some(l => l.includes('Imported 2 variables'))).toBe(true);
  });

  it('skips existing vars without --overwrite', () => {
    const envFile = join(dotenvDir.dir, '.env');
    writeFileSync(envFile, 'FOO=new\n');
    // pre-set FOO
    writeFileSync(tmp.configPath, '# >>> evm managed >>>\nexport FOO="old"\n# <<< evm managed <<<\n');
    importCommand(envFile, { shell: 'zsh', config: tmp.configPath });
    const vars = readManagedVars(tmp.configPath, 'zsh');
    expect(vars.find(v => v.key === 'FOO').value).toBe('old');
    expect(logs.some(l => l.includes('Skipped'))).toBe(true);
  });

  it('overwrites existing vars with --overwrite', () => {
    const envFile = join(dotenvDir.dir, '.env');
    writeFileSync(envFile, 'FOO=new\n');
    writeFileSync(tmp.configPath, '# >>> evm managed >>>\nexport FOO="old"\n# <<< evm managed <<<\n');
    importCommand(envFile, { shell: 'zsh', config: tmp.configPath, overwrite: true });
    const vars = readManagedVars(tmp.configPath, 'zsh');
    expect(vars.find(v => v.key === 'FOO').value).toBe('new');
  });

  it('errors on missing file', () => {
    importCommand('/nonexistent/.env', { shell: 'zsh', config: tmp.configPath });
    expect(process.exitCode).toBe(1);
    expect(logs.some(l => l.includes('not found'))).toBe(true);
  });

  it('warns on empty .env file', () => {
    const envFile = join(dotenvDir.dir, 'empty.env');
    writeFileSync(envFile, '# just a comment\n');
    importCommand(envFile, { shell: 'zsh', config: tmp.configPath });
    expect(logs.some(l => l.includes('No valid'))).toBe(true);
  });

  it('skips comments and blank lines in .env', () => {
    const envFile = join(dotenvDir.dir, '.env');
    writeFileSync(envFile, '# comment\n\nFOO=bar\n  \nBAZ=qux\n');
    importCommand(envFile, { shell: 'zsh', config: tmp.configPath });
    const vars = readManagedVars(tmp.configPath, 'zsh');
    expect(vars).toEqual([{ key: 'FOO', value: 'bar' }, { key: 'BAZ', value: 'qux' }]);
  });
});

describe('exportCommand', () => {
  let tmp, outDir, logs;

  beforeEach(() => {
    tmp = createTmpConfig('# >>> evm managed >>>\nexport FOO="bar"\nexport BAZ="qux"\n# <<< evm managed <<<\n');
    outDir = makeTmpDir();
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    process.exitCode = 0;
  });
  afterEach(() => { tmp.cleanup(); outDir.cleanup(); vi.restoreAllMocks(); process.exitCode = 0; });

  it('exports to a file', () => {
    const outFile = join(outDir.dir, 'out.env');
    exportCommand(outFile, { shell: 'zsh', config: tmp.configPath });
    const content = readFileSync(outFile, 'utf-8');
    expect(content).toContain('FOO=bar');
    expect(content).toContain('BAZ=qux');
    expect(logs.some(l => l.includes('Exported 2 variables'))).toBe(true);
  });

  it('warns when no vars to export', () => {
    const emptyTmp = createTmpConfig('');
    exportCommand(join(outDir.dir, 'x.env'), { shell: 'zsh', config: emptyTmp.configPath });
    expect(logs.some(l => l.includes('No evm-managed'))).toBe(true);
    emptyTmp.cleanup();
  });
});

describe('copyCommand', () => {
  let tmp, logs;

  beforeEach(() => {
    tmp = createTmpConfig('# >>> evm managed >>>\nexport FOO="bar"\n# <<< evm managed <<<\n');
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    process.exitCode = 0;
  });
  afterEach(() => { tmp.cleanup(); vi.restoreAllMocks(); process.exitCode = 0; });

  it('copies a variable to a new key', () => {
    copyCommand('FOO', 'FOO_COPY', { shell: 'zsh', config: tmp.configPath });
    const vars = readManagedVars(tmp.configPath, 'zsh');
    expect(vars.find(v => v.key === 'FOO_COPY')?.value).toBe('bar');
    expect(vars.find(v => v.key === 'FOO')?.value).toBe('bar'); // original untouched
    expect(logs.some(l => l.includes('Copied'))).toBe(true);
  });

  it('errors if source not found', () => {
    copyCommand('NOPE', 'DEST', { shell: 'zsh', config: tmp.configPath });
    expect(process.exitCode).toBe(1);
    expect(logs.some(l => l.includes('not found'))).toBe(true);
  });

  it('warns if dest exists without --overwrite', () => {
    writeFileSync(tmp.configPath, '# >>> evm managed >>>\nexport FOO="bar"\nexport FOO_COPY="old"\n# <<< evm managed <<<\n');
    copyCommand('FOO', 'FOO_COPY', { shell: 'zsh', config: tmp.configPath });
    expect(logs.some(l => l.includes('already exists'))).toBe(true);
    const vars = readManagedVars(tmp.configPath, 'zsh');
    expect(vars.find(v => v.key === 'FOO_COPY').value).toBe('old'); // unchanged
  });

  it('overwrites dest with --overwrite', () => {
    writeFileSync(tmp.configPath, '# >>> evm managed >>>\nexport FOO="bar"\nexport FOO_COPY="old"\n# <<< evm managed <<<\n');
    copyCommand('FOO', 'FOO_COPY', { shell: 'zsh', config: tmp.configPath, overwrite: true });
    const vars = readManagedVars(tmp.configPath, 'zsh');
    expect(vars.find(v => v.key === 'FOO_COPY').value).toBe('bar');
  });
});

describe('renameCommand', () => {
  let tmp, logs;

  beforeEach(() => {
    tmp = createTmpConfig('# >>> evm managed >>>\nexport FOO="bar"\n# <<< evm managed <<<\n');
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    process.exitCode = 0;
  });
  afterEach(() => { tmp.cleanup(); vi.restoreAllMocks(); process.exitCode = 0; });

  it('renames a variable', () => {
    renameCommand('FOO', 'FOO_NEW', { shell: 'zsh', config: tmp.configPath });
    const vars = readManagedVars(tmp.configPath, 'zsh');
    expect(vars.find(v => v.key === 'FOO_NEW')?.value).toBe('bar');
    expect(vars.find(v => v.key === 'FOO')).toBeUndefined(); // old key removed
    expect(logs.some(l => l.includes('Renamed'))).toBe(true);
  });

  it('errors if source not found', () => {
    renameCommand('NOPE', 'DEST', { shell: 'zsh', config: tmp.configPath });
    expect(process.exitCode).toBe(1);
  });

  it('warns if dest exists without --overwrite', () => {
    writeFileSync(tmp.configPath, '# >>> evm managed >>>\nexport FOO="bar"\nexport FOO_NEW="old"\n# <<< evm managed <<<\n');
    renameCommand('FOO', 'FOO_NEW', { shell: 'zsh', config: tmp.configPath });
    expect(logs.some(l => l.includes('already exists'))).toBe(true);
    const vars = readManagedVars(tmp.configPath, 'zsh');
    expect(vars.find(v => v.key === 'FOO')).toBeDefined(); // not removed
  });
});

describe('backupCommand + restoreCommand', () => {
  let tmp, backupTmp, logs;

  beforeEach(() => {
    tmp = createTmpConfig('# >>> evm managed >>>\nexport FOO="bar"\nexport BAZ="qux"\n# <<< evm managed <<<\n');
    backupTmp = makeTmpDir();
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    process.exitCode = 0;
  });
  afterEach(() => { tmp.cleanup(); backupTmp.cleanup(); vi.restoreAllMocks(); process.exitCode = 0; });

  it('backs up managed vars', () => {
    backupCommand({ shell: 'zsh', config: tmp.configPath, backupDir: backupTmp.dir });
    const backups = listBackups(backupTmp.dir);
    expect(backups).toHaveLength(1);
    expect(logs.some(l => l.includes('Backed up 2 variables'))).toBe(true);
  });

  it('warns on backup with no vars', () => {
    const emptyTmp = createTmpConfig('');
    backupCommand({ shell: 'zsh', config: emptyTmp.configPath, backupDir: backupTmp.dir });
    expect(logs.some(l => l.includes('No evm-managed variables'))).toBe(true);
    emptyTmp.cleanup();
  });

  it('restores from a backup', () => {
    // backup current vars
    backupCommand({ shell: 'zsh', config: tmp.configPath, backupDir: backupTmp.dir });
    const backups = listBackups(backupTmp.dir);

    // wipe config
    const emptyTmp = createTmpConfig('');
    restoreCommand(backups[0].name, { shell: 'zsh', config: emptyTmp.configPath, backupDir: backupTmp.dir });
    const vars = readManagedVars(emptyTmp.configPath, 'zsh');
    expect(vars).toEqual([{ key: 'FOO', value: 'bar' }, { key: 'BAZ', value: 'qux' }]);
    expect(logs.some(l => l.includes('Restored 2 variables'))).toBe(true);
    emptyTmp.cleanup();
  });

  it('restore --list shows available backups', () => {
    backupCommand({ shell: 'zsh', config: tmp.configPath, backupDir: backupTmp.dir });
    restoreCommand(undefined, { list: true, backupDir: backupTmp.dir });
    expect(logs.some(l => l.includes('backup') && l.includes('available'))).toBe(true);
  });

  it('restore errors on non-existent backup name', () => {
    restoreCommand('2000-01-01T00-00-00', { shell: 'zsh', config: tmp.configPath, backupDir: backupTmp.dir });
    expect(process.exitCode).toBe(1);
    expect(logs.some(l => l.includes('not found'))).toBe(true);
  });

  it('restore --list warns when no backups exist', () => {
    restoreCommand(undefined, { list: true, backupDir: backupTmp.dir });
    expect(logs.some(l => l.includes('No backups found'))).toBe(true);
  });
});
