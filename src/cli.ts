import argv from "@prokopschield/argv";

argv.alias("port", "p").alias("server", "s");

if (argv.get("port") || argv.get("server")) {
    const port = argv.get("port");

    if (Number(port)) {
        process.env.port = port;
    }

    require("./server-cli");
} else {
    require("./upload-cli");
}
