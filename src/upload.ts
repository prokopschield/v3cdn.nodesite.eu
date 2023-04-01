import * as Base64 from "@prokopschield/base64";
import { execSync } from "child_process";
import Json from "doge-json";
import fs from "fs";
import { contentType } from "mime-types";
import { Source } from "nsblob-native-stream";
import path from "path";
import { Queue } from "ps-std";

import type { FileSource } from "./types";

const queue = new Queue();

export function fromHex(hex: string) {
    return hex.length === 64 ? Base64.encode(Buffer.from(hex, "hex")) : hex;
}

export function sourceToUrl(source: Source<any>) {
    return "https://v3cdn.nodesite.eu/" + fromHex(source.hash);
}

export async function uploadFile(file: string) {
    await queue.promise;

    const stats = await fs.promises.stat(file);
    const stream = fs.createReadStream(file, { autoClose: true });
    const name = path.basename(file);

    const type =
        contentType(name) ||
        execSync(`file --mime ${file}`)
            .toString()
            .trim()
            .split(/[ \;\:]+/g)[1] ||
        "text/plain";

    const source: FileSource = await Source.fromStream(stream, {
        name,
        type,
        date: new Date(stats.mtimeMs).toUTCString(),
    });

    queue.next_async();

    return sourceToUrl(source);
}

export async function upload(...files: string[]): Promise<string> {
    if (files.length > 1) {
        const items: string[] = await Promise.all(
            files.map(async (file) => {
                try {
                    const name = path.basename(file);
                    const hash = await upload(file);

                    return `<li><a href="${hash}">${name}</a></li>`;
                } catch (error) {
                    console.error(`Uploading ${file} failed`, String(error));

                    return `<li>Uploading ${path.basename(file)} failed.</li>`;
                }
            })
        );

        const buffer = Buffer.from(`<ul>${items.join("")}</ul>`);

        const source = await Source.fromBuffer(buffer, {
            type: "text/html",
        });

        queue.next_async();

        return sourceToUrl(source);
    }

    let [file] = files;

    file ||= ".";

    await queue.promise;
    const stats = await fs.promises.stat(file);
    queue.next_async();

    if (stats.isFile()) {
        return uploadFile(file);
    } else if (stats.isDirectory()) {
        const files = fs
            .readdirSync(file)
            .map((name) => path.resolve(file, name));

        if (files.length) {
            return upload(...files);
        } else {
            return sourceToUrl(
                await Source.fromBuffer(
                    Buffer.from(
                        `The directory ${path.basename(file)} was empty.`
                    ),
                    { type: "text/plain" }
                )
            );
        }
    } else {
        return sourceToUrl(
            await Source.fromBuffer(
                Buffer.from(
                    Json.encode({
                        file,
                        ...stats,
                    })
                ),
                { type: "application/json" }
            )
        );
    }
}
