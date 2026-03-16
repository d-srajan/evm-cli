import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Create a temporary shell config file for testing.
 * Returns { configPath, read(), cleanup() }.
 */
export function createTmpConfig(initialContent = '') {
  const dir = mkdtempSync(join(tmpdir(), 'evm-test-'));
  const configPath = join(dir, '.testrc');
  writeFileSync(configPath, initialContent);

  return {
    configPath,
    read() {
      return readFileSync(configPath, 'utf-8');
    },
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
