import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

export function packageVersion(toml, name) {
  const blocks = toml.replace(/\r/g, "").split(/^\[\[?package\]?\]\s*$/m);
  const block = name
    ? blocks.find((value) => new RegExp(`^name = "${name}"$`, "m").test(value))
    : blocks[1]?.split(/^\[/m)[0];
  const version = block?.match(/^version = "([^"]+)"$/m)?.[1];
  if (!version) throw new Error("Cannot find Rust package version");
  return version;
}

export function releaseBody(notes, version) {
  const normalized = notes.replace(/\r/g, "");
  if (normalized.split("<!-- release-downloads -->").length !== 2) {
    throw new Error("Expected exactly one release download guidance marker");
  }
  const [history, downloads] = normalized.split("<!-- release-downloads -->");
  if (!downloads?.trim()) throw new Error("Release download guidance is missing");
  const heading = `## ${version}`;
  const sections = history.split(/^## /m).slice(1);
  const matches = sections.filter((section) => section.split("\n")[0] === version);
  if (matches.length !== 1) throw new Error(`Expected exactly one ${heading} section`);
  const body = matches[0].slice(version.length).trim();
  if (!body || !/^- \S/m.test(body)) throw new Error(`${heading} needs user-facing release bullets`);
  return `${heading}\n\n${body}\n\n${downloads.trim()}\n`;
}

export function validateRelease(versions, notes, tag) {
  const version = versions["package.json"];
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error("Releases currently require a stable X.Y.Z version");
  }
  for (const [file, candidate] of Object.entries(versions)) {
    if (candidate !== version) throw new Error(`${file}: ${candidate} does not match ${version}`);
  }
  if (tag !== undefined && tag !== `v${version}`) {
    throw new Error(`Release tag must be v${version}; got ${tag}`);
  }
  return releaseBody(notes, version);
}

function main() {
  const { values } = parseArgs({
    options: { tag: { type: "string" }, output: { type: "string" } },
  });
  const pkg = JSON.parse(read("package.json"));
  const lock = JSON.parse(read("package-lock.json"));
  const versions = {
    "package.json": pkg.version,
    "package-lock.json": lock.version,
    "package-lock.json root package": lock.packages[""].version,
    "src-tauri/tauri.conf.json": JSON.parse(read("src-tauri/tauri.conf.json")).version,
    "src-tauri/Cargo.toml": packageVersion(read("src-tauri/Cargo.toml")),
    "src-tauri/Cargo.lock": packageVersion(read("src-tauri/Cargo.lock"), pkg.name),
  };
  const body = validateRelease(versions, read("docs/release-notes.md"), values.tag);
  if (values.output) writeFileSync(values.output, body);
  console.log(`Release metadata and notes verified for v${pkg.version}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
