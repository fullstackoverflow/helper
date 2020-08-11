#! /usr/bin/env node
import { Command, UsageError } from 'clipanion';
import got from 'got';
import { promisify } from 'util';
import stream from 'stream';
import { createWriteStream, existsSync, statSync } from 'fs';
import cliProgress from 'cli-progress';
import { basename, join } from 'path';

const pipeline = promisify(stream.pipeline);

export default class Download extends Command {
    @Command.Array(`-i,--input`)
    public input_paths: string[];

    @Command.String(`-d,--directory`)
    public download_dir: string;

    @Command.String(`-o,--output`)
    public output_path: string;

    @Command.Path(`download`)
    async execute() {
        if (!this.input_paths) {
            throw new UsageError(`-i,--input is needed for this commond`);
        }
        if (!this.output_path && !this.download_dir) {
            throw new UsageError(`-o,--output or -d,--directory is needed for this commond`);
        }
        if (this.input_paths.length > 1 && this.output_path) {
            throw new UsageError(`multi input can not specific name, use -d,--directory instead`);
        }
        if (this.download_dir && (!existsSync(this.download_dir) || !statSync(this.download_dir).isDirectory())) {
            throw new UsageError(`download directory is not exist or not a directory`);
        }
        const multibar = new cliProgress.MultiBar({
            clearOnComplete: false,
            hideCursor: true,
            format: `{filename} |{bar}| {percentage}%`,
        }, cliProgress.Presets.shades_grey);
        const max_length = Math.max(...this.input_paths.map(i => basename(i).length));
        await Promise.all(this.input_paths.map(input_path => {
            const bar = multibar.create(100, 0);
            const name = basename(input_path);
            return pipeline(
                got.stream(input_path).on("downloadProgress", (progress) => {
                    bar.update(progress.percent * 100, { filename: name + new Array(max_length - name.length).fill(" ").join("") });
                }),
                createWriteStream(this.output_path ?? join(this.download_dir, name))
            );
        }))
        multibar.stop();
    }
}