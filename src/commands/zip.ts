#! /usr/bin/env node
import { Command, UsageError } from 'clipanion';
import { createWriteStream, existsSync, statSync, readFileSync } from 'fs';
import { basename, dirname } from 'path';
import JSZip from 'jszip';
import { Glob } from 'glob';

export default class Zip extends Command {
    @Command.Array(`-i,--input`)
    public input_paths: string[];

    @Command.Boolean(`-r`)
    public recursive: boolean;

    @Command.String(`-o,--output`)
    public output_path: string;

    @Command.Path(`zip`)
    async execute() {
        if (!this.input_paths) {
            throw new UsageError(`-i,--input is needed for this commond`);
        }
        if (!this.output_path) {
            throw new UsageError(`-o,--output or -d,--directory is needed for this commond`);
        }
        if (this.input_paths.length > 1 && this.recursive == true) {
            throw new UsageError(`multi inputs is not support -r option`);
        }
        const zip = new JSZip();
        if (this.recursive == true) {
            let dirMap = {};
            const glob = new Glob(this.input_paths[0], { dot: true }).on("match", file => {
                this.context.stdout.write(file + "\n");
                if (statSync(file).isDirectory()) {
                    const parentZip = dirMap[dirname(file)];
                    if (!parentZip) {
                        zip.folder(basename(file));
                    } else {
                        parentZip.folder(basename(file))
                    }
                    dirMap[file] = zip.folder(basename(file));
                } else {
                    const parentZip = dirMap[dirname(file)];
                    if (!parentZip) {
                        zip.file(basename(file), readFileSync(file));
                    } else {
                        parentZip.file(basename(file), readFileSync(file));
                    }
                }
            });
            await new Promise(resolve => {
                glob.on("end", () => {
                    resolve();
                })
            })
        } else {
            this.input_paths.forEach(path => {
                if (!(statSync(path).isFile())) {
                    throw new UsageError(`inputs without -r option must be file`);
                }
                zip.file(basename(path), readFileSync(path));
            })
        }
        zip.generateNodeStream().pipe(createWriteStream(this.output_path));
    }
}