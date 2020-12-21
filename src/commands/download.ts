#! /usr/bin/env node
import { Command, UsageError } from 'clipanion';
import got from 'got';
import { promisify } from 'util';
import stream from 'stream';
import { createWriteStream, existsSync, statSync, unlinkSync } from 'fs';
import cliProgress from 'cli-progress';
import { basename, join } from 'path';
import { lightred } from '@tosee/color';

const pipeline = promisify(stream.pipeline);

export default class Download extends Command {
    @Command.Array(`-i,--input`)
    public input_paths: string[];

    @Command.String(`-d,--directory`)
    public download_dir: string;

    @Command.String(`--timeout`)
    public timeout: string;

    @Command.String(`-o,--output`)
    public output_path: string;

    @Command.Boolean(`--safe`)
    public safe: boolean = false;

    @Command.Path(`download`)
    async execute() {
        const extra_opt = {
        };
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
        if (this.timeout) {
            if (isNaN(Number(this.timeout))) {
                throw new UsageError(`timeout must be a number`);
            } else {
                extra_opt["timeout"] = Number(this.timeout);
            }
        }
        const multibar = new cliProgress.MultiBar({
            clearOnComplete: false,
            hideCursor: true,
            format: `{filename} |{bar}| {percentage}%`,
        }, cliProgress.Presets.shades_grey);
        const max_length = Math.max(...this.input_paths.map(i => basename(i).length));
        await Promise.all(this.input_paths.map(input_path => {
            let bar: cliProgress.SingleBar;
            const name = basename(input_path);
            return pipeline(
                got.stream(input_path, extra_opt).on("downloadProgress", (progress) => {
                    if (bar) {
                        bar.update(progress.percent * 100, { filename: name + new Array(max_length - name.length).fill(" ").join("") });
                    } else {
                        bar = multibar.create(100, progress.percent * 100, { filename: name + new Array(max_length - name.length).fill(" ").join("") });
                    }
                }),
                createWriteStream(this.output_path ?? join(this.download_dir, name))
            ).catch(e => {
                if (!this.safe) {
                    throw e;
                } else {
                    console.log(lightred`Download ${input_path} Failed:`, e);
                    unlinkSync(this.output_path ?? join(this.download_dir, name));
                }
            });
        }))
        multibar.stop();
    }
}