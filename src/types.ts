import { Source } from "nsblob-stream";

export type File = {
    name: string;
    type: string;
    date: string;
};

export type FileSource = Source<File>;
