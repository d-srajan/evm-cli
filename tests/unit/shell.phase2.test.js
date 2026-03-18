import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeBackup, listBackups, readBackupFile } from '../../src/shell.js';

function makeTmpBackupDir() {
  const dir = mkdtempSync(join(tmpdir(), 'evm-backup-test-'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe('writeBackup', () => {
  let tmp;
  afterEach(() => tmp?.cleanup());

  it('creates a .env backup file', () => {
    tmp = makeTmpBackupDir();
    const vars = [{ key: 'FOO', value: 'bar' }, { key: 'BAZ', value: 'qux' }];
    const path = writeBackup(vars, tmp.dir);
    expect(path).toMatch(/\.env$/);
    const backups = listBackups(tmp.dir);
    expect(backups).toHaveLength(1);
  });

  it('backup file contains correct content', () => {
    tmp = makeTmpBackupDir();
    const vars = [{ key: 'FOO', value: 'bar' }];
    const path = writeBackup(vars, tmp.dir);
    const content = readBackupFile(path);
    expect(content).toEqual([{ key: 'FOO', value: 'bar' }]);
  });

  it('creates backupDir if it does not exist', () => {
    const parent = mkdtempSync(join(tmpdir(), 'evm-bk-'));
    const nested = join(parent, 'nested', 'backups');
    try {
      const path = writeBackup([{ key: 'X', value: '1' }], nested);
      expect(path).toMatch(/\.env$/);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe('listBackups', () => {
  let tmp;
  afterEach(() => tmp?.cleanup());

  it('returns empty array for missing dir', () => {
    expect(listBackups('/tmp/evm-nonexistent-backup-dir')).toEqual([]);
  });

  it('returns backups sorted newest-first', async () => {
    tmp = makeTmpBackupDir();
    writeBackup([{ key: 'A', value: '1' }], tmp.dir);
    // Small delay so timestamps differ
    await new Promise(r => setTimeout(r, 10));
    writeBackup([{ key: 'B', value: '2' }], tmp.dir);

    const backups = listBackups(tmp.dir);
    expect(backups).toHaveLength(2);
    // Newest first means second written > first written
    expect(backups[0].name > backups[1].name).toBe(true);
  });

  it('only includes .env files', () => {
    tmp = makeTmpBackupDir();
    writeBackup([{ key: 'X', value: '1' }], tmp.dir);
    // write a non-.env file manually
    writeFileSync(join(tmp.dir, 'README.txt'), 'ignore me');

    const backups = listBackups(tmp.dir);
    expect(backups.every(b => b.name.endsWith('.env') === false)).toBe(true);
    expect(backups).toHaveLength(1);
  });
});

describe('readBackupFile', () => {
  let tmp;
  afterEach(() => tmp?.cleanup());

  it('returns null for non-existent file', () => {
    expect(readBackupFile('/tmp/evm-nonexistent.env')).toBeNull();
  });

  it('reads and parses backup correctly', () => {
    tmp = makeTmpBackupDir();
    const vars = [{ key: 'FOO', value: 'bar' }, { key: 'BAZ', value: 'qux' }];
    const path = writeBackup(vars, tmp.dir);
    expect(readBackupFile(path)).toEqual(vars);
  });
});
