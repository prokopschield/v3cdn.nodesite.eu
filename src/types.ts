import type { Source } from "nsblob-native-stream";

export type File = {
    name: string;
    type: string;
    date: string;
};

export type FileSource = Source<File>;
