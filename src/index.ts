import * as Base64 from "@prokopschield/base64";
import Json from "doge-json";
import http from "http";
import { saturate, Source } from "nsblob-native-stream";
import type { Readable } from "stream";

import { get_homepage } from "./homepage";
import { FileSource } from "./types";

/** convert hex to base-64 **/
export function fromHex(hex: string) {
    return hex.length === 64 ? Base64.encode(Buffer.from(hex, "hex")) : hex;
}

/** convert base-64 to hex **/
export function toHex(base64: string) {
    return base64.length === 64
        ? base64
        : Buffer.from(Base64.decode(base64)).toString("hex");
}

/** apply liberal Access-Control to repsonse **/
export function applyCorsHeaders(response: http.ServerResponse) {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "*");
    response.setHeader("Access-Control-Allow-Headers", "*");

    return response;
}

/** apply liberal Access-Control and Cache-Control to response **/
export function applyBoringHeaders(
    response: http.ServerResponse,
    source: FileSource
) {
    applyCorsHeaders(response);

    response.setHeader("Cache-Control", "public, max-age=604800, immutable");

    const date = new Date(source.props.date);

    if (date.valueOf()) {
        response.setHeader("Last-Modified", date.toUTCString());
    }

    return response;
}

/** base for upload(Stream|Buffer) **/
export const root_url = new URL("https://v3cdn.nodesite.eu");
export const home_url = new URL(root_url);

/** upload stream to v3cdn **/
export async function uploadStream(
    stream: Readable,
    name: string,
    type: string,
    lastModified: number | string | Date = Date.now()
) {
    const source: FileSource = await Source.fromStream(stream, {
        name,
        type,
        date: new Date(lastModified).toUTCString(),
    });

    return new URL(fromHex(source.hash), root_url);
}

/** upload buffer to v3cdn **/
export async function uploadBuffer(
    buffer: string | Uint8Array,
    name: string,
    type: string,
    lastModified: number | string | Date = Date.now()
) {
    const source: FileSource = await Source.fromBuffer(Buffer.from(buffer), {
        name,
        type,
        date: new Date(lastModified).toUTCString(),
    });

    return new URL(fromHex(source.hash), root_url);
}

/** http/express listener for v3cdn **/
export async function listener(
    request: http.IncomingMessage,
    response: http.ServerResponse
) {
    try {
        const url: URL = new URL(
            request.url || "",
            "https://v2cdn.nodesite.eu"
        );

        const name = url.pathname.slice(1);

        const source: FileSource = await Source.fromStream(request, {
            name,
            type: request.headers["content-type"],
            date: request.headers["last-modified"],
        });

        if (source.length === 0) {
            if (request.method?.toLowerCase() !== "get") {
                response.statusCode = 200;

                return applyCorsHeaders(response).end();
            }

            if (request.headers["if-modified-since"]) {
                response.statusCode = 304;

                return applyCorsHeaders(response).end();
            }

            for (const hash of name.match(/[a-z0-9\~\_]{43}/gi) || []) {
                const source: FileSource = await Source.fromHash(toHex(hash));

                if (url.searchParams.has("info")) {
                    response.statusCode = 200;

                    response.setHeader("Content-Type", "application/json");

                    applyBoringHeaders(response, source);

                    response.write(Json.encode(source));
                    response.end();

                    return;
                }

                if (request.headers.range) {
                    const matches: string[] = [
                        ...(request.headers.range.match(/[\d]+/g) || []),
                    ];

                    let [first, last] = [
                        ...matches,
                        matches.length ? source.length - 1 : 0,
                        source.length - 1,
                    ].map(Number);

                    if (last >= source.length) {
                        last = source.length - 1;
                    }

                    if (first >= last) {
                        first = last;
                    }

                    response.statusCode = 206;

                    response.setHeader("Content-Type", source.props.type);

                    response.setHeader(
                        "Content-Range",
                        `bytes ${first}-${last}/${source.length}`
                    );

                    response.setHeader("Content-Length", source.length);

                    applyBoringHeaders(response, source);

                    return saturate(
                        source.raw,
                        response,
                        Number(first),
                        Number(last) + 1
                    );
                } else {
                    response.statusCode = 200;

                    response.setHeader("Content-Type", source.props.type);
                    response.setHeader("Content-Length", source.length);

                    applyBoringHeaders(response, source);

                    return saturate(source.raw, response);
                }
            }

            response.statusCode = 302;
            response.setHeader("Location", name ? url.href : home_url.href);

            response.end();
            return;
        } else {
            applyCorsHeaders(response)
                .setHeader("Content-Type", "text/plain")
                .write(fromHex(source.hash));
            return response.end();
        }
    } catch (error) {
        response.statusCode = 500;
        response.setHeader("Content-Type", "text/plain");
        response.write(String(error));
        response.end();
    }
}

/** entry point for v3cdn server **/
export async function main(port: number) {
    const homepage = await get_homepage();

    home_url.pathname = "/" + fromHex(homepage.hash);

    const server = http.createServer(listener);

    server.listen(port);
}
