#! /usr/bin/env node
import { Cli, Command, UsageError } from 'clipanion';
import got from 'got';
import { promisify } from 'util';
import stream from 'stream';
import { createWriteStream, readFileSync } from 'fs';
import OSS from 'ali-oss';
import cliProgress from 'cli-progress';

const pipeline = promisify(stream.pipeline);

class Download extends Command {
    @Command.String(`-i,--input`)
    public download_path: string;

    @Command.String(`-o,--output`)
    public output_path: string;

    @Command.Path(`download`)
    async execute() {
        if (!this.download_path) {
            throw new UsageError(`-i,--input is needed for this commond`);
        }
        if (!this.output_path) {
            throw new UsageError(`-o,--output is needed for this commond`);
        }
        const bar = new cliProgress.SingleBar({
            format: `Downloading... |{bar}| {percentage}%`,
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        });
        bar.start(100, 0);
        await pipeline(
            got.stream(this.download_path).on("downloadProgress", (progress) => {
                bar.update(progress.percent * 100);
            }),
            createWriteStream(this.output_path)
        );
        bar.stop();
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
    @Command.String(`-i,--input`)
    public local_path: string;

    @Command.String(`-o,--output`)
    public output_path: string;

    @Command.String(`-c,--config`)
    public config: string;

    @Command.String(`-t,--type`)
    public type: Type = Type.ALI;

    async [Type.ALI](config: OSS.Options) {
        const bar = new cliProgress.SingleBar({
            format: `Uploading... |{bar}| {percentage}%`,
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        });
        bar.start(100, 0)
        const client = new OSS(config);
        await client.multipartUpload(this.output_path, this.local_path, {
            parallel: 4,
            partSize: 1024 * 1024,
            progress: (p) => {
                bar.update(p * 100);
            }
        })
        bar.stop();
    }

    @Command.Path(`upload`)
    async execute() {
        if (!this.local_path) {
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