#! /usr/bin/env node
import { Cli, Command } from 'clipanion';
import { readdirSync } from 'fs';
import { resolve, join } from 'path';

const cli = new Cli({
    binaryLabel: `helper`,
    binaryName: `helper`,
    binaryVersion: `1.0.0`,
});

const names = readdirSync(resolve(__dirname, './commands'));
const base = resolve(__dirname, './commands');
for (let name of names) {
    cli.register(require(join(base, name)).default);
}
cli.register(Command.Entries.Help);
cli.register(Command.Entries.Version);

cli.runExit(process.argv.slice(2), {
    ...Cli.defaultContext,
});