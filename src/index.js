import { Command } from 'commander';
import { setCommand, getCommand, rmCommand, listCommand, editCommand } from './commands.js';

export function createProgram() {
  const program = new Command();

  program
    .name('evm')
    .description('Manage OS-level environment variables with ease')
    .version('1.0.0');

  program
    .command('set')
    .description('Set an environment variable: evm set KEY=value')
    .argument('<assignment...>', 'KEY=value pair')
    .action((args) => setCommand(args));

  program
    .command('get')
    .description('Get the value of an environment variable')
    .argument('<key>', 'Variable name')
    .action((key) => getCommand(key));

  program
    .command('rm')
    .description('Remove an environment variable')
    .argument('<key>', 'Variable name')
    .action((key) => rmCommand(key));

  program
    .command('list')
    .description('List all evm-managed environment variables')
    .option('-g, --grep <pattern>', 'Filter by regex pattern')
    .option('-u, --unmask', 'Reveal sensitive values')
    .action((opts) => listCommand(opts));

  program
    .command('edit')
    .description('Interactively edit a variable\'s value')
    .argument('<key>', 'Variable name')
    .action((key) => editCommand(key));

  return program;
}
