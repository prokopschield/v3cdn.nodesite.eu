#!/usr/bin/env node

import { socket } from "nsblob-native-stream";

import { upload } from "./upload";

upload(...process.argv.slice(2))
    .then(console.log)
    .then(() => socket.close())
    .then(() => {
        if (process.argv[1].includes("v3cdn")) {
            process.exit(0);
        }
    });
