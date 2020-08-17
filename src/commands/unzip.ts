#! /usr/bin/env node
import { Command, UsageError } from 'clipanion';
import { createWriteStream, readFileSync, writeFile, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import JSZip from 'jszip';

export default class UnZip extends Command {
    @Command.String(`-i,--input`)
    public input_path: string;

    @Command.String(`-o,--output`)
    public output_path: string;

    @Command.Path(`unzip`)
    async execute() {
        console.log(this.input_path);
        console.log(this.output_path);
        if (!this.input_path) {
            throw new UsageError(`-i,--input is needed for this commond`);
        }
        if (!this.output_path) {
            throw new UsageError(`-o,--output is needed for this commond`);
        }
        const zip = await JSZip.loadAsync(readFileSync(this.input_path));
        console.log('F1', zip);
        for (let [name] of Object.entries(zip.files)) {
            if (zip.files[name].dir == true) {
                mkdirSync(join(this.output_path, name));
            } else {
                const buffer = await zip.files[name].async('nodebuffer');
                writeFileSync(join(this.output_path, name), buffer);
            }
        }
    }
}