#!/usr/bin/env node

import { main } from ".";

main(Number(process.env.port) || 21212);
