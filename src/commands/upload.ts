#! /usr/bin/env node
import { Command, UsageError } from 'clipanion';
import { readFileSync } from 'fs';
import OSS from 'ali-oss';
import cliProgress from 'cli-progress';
import { basename, join } from 'path';

enum Type {
    ALI = 'ali'
}

function parseJSON(input: string) {
    try {
        return JSON.parse(input);
    } catch (e) {
        return false;
    }
}

export default class Upload extends Command {
    @Command.Array(`-i,--input`)
    public local_paths: string[];

    @Command.String(`-o,--output`)
    public output_path: string;

    @Command.String(`-c,--config`)
    public config: string;

    @Command.String(`-t,--type`)
    public type: Type = Type.ALI;

    async [Type.ALI](config: OSS.Options) {
        const client = new OSS(config);
        const multibar = new cliProgress.MultiBar({
            clearOnComplete: false,
            hideCursor: true,
            format: `{filename} |{bar}| {percentage}%`,
        }, cliProgress.Presets.shades_grey);
        const max_length = Math.max(...this.local_paths.map(i => basename(i).length));
        await Promise.all(this.local_paths.map(local_path => {
            const bar = multibar.create(100, 0);
            const name = basename(local_path);
            return client.multipartUpload(join(this.output_path, name), local_path, {
                parallel: 4,
                partSize: 1024 * 1024,
                progress: (p) => {
                    bar.update(p * 100, { filename: name + new Array(max_length - name.length).fill(" ").join("") });
                }
            })
        }))
        multibar.stop();
    }

    @Command.Path(`upload`)
    async execute() {
        if (!this.local_paths) {
            throw new UsageError(`-i,--input is needed for this commond`)
        }
        if (!this.config) {
            throw new UsageError(`-c,--config is needed for this commond`);
        }
        if (!this.output_path) {
            throw new UsageError(`-o,--output is needed for this commond`);
        }
        const config = parseJSON(readFileSync(this.config).toString());
        if (config === false) {
            throw new UsageError(`-c,--config must be a json`);
        }
        await this[this.type](config);
    }
}