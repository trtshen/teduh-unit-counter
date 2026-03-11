#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "manifest.json");
const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
const parts = manifest.version.split(".");
parts[2] = +parts[2] + 1;
manifest.version = parts.join(".");
fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest.json version → ${manifest.version}`);
