import fs from "fs";
import { Source } from "nsblob-native-stream";
import path from "path";

export async function get_homepage() {
    const filename = path.resolve(__dirname, "../src/homepage.html");
    const stats = await fs.promises.stat(filename);
    const stream = fs.createReadStream(filename, { autoClose: true });
    const source = await Source.fromStream(stream, {
        name: "homepage.html",
        type: "text/html",
        date: stats.mtime.toUTCString(),
    });

    return source;
}
