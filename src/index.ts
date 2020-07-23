#! /usr/bin/env node
import { Cli, Command, UsageError } from 'clipanion';
import got from 'got';
import { promisify } from 'util';
import stream from 'stream';
import { createWriteStream, readFileSync, existsSync, statSync } from 'fs';
import OSS from 'ali-oss';
import cliProgress from 'cli-progress';
import { basename, join, resolve } from 'path';

const pipeline = promisify(stream.pipeline);

class Download extends Command {
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

class Upload extends Command {
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

const cli = new Cli({
    binaryLabel: `helper`,
    binaryName: `helper`,
    binaryVersion: `1.0.0`,
});

cli.register(Download);
cli.register(Upload);
cli.register(Command.Entries.Help);
cli.register(Command.Entries.Version);

cli.runExit(process.argv.slice(2), {
    ...Cli.defaultContext,
});