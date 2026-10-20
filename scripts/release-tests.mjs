import { test } from "node:test";
import assert from "node:assert/strict";
import { packageVersion, releaseBody, validateRelease } from "./release.mjs";

const notes = `# Release notes
## Unreleased
- Future change.
## 0.1.26
- Current fix.
## 0.1.25
- Previous fix.
<!-- release-downloads -->
## Downloads
Shared installation guidance.
`;
const versions = { "package.json": "0.1.26", "Cargo.lock": "0.1.26" };

test("published notes include only the selected version and shared downloads", () => {
  assert.equal(releaseBody(notes.replace(/\n/g, "\r\n"), "0.1.26"),
    "## 0.1.26\n\n- Current fix.\n\n## Downloads\nShared installation guidance.\n");
});

test("rejects mismatched metadata, incorrect tags, and unsupported prerelease versions", () => {
  assert.throws(() => validateRelease({ ...versions, "Cargo.lock": "0.1.25" }, notes), /Cargo.lock/);
  assert.throws(() => validateRelease(versions, notes, "v0.1.25"), /tag must/);
  assert.throws(() => validateRelease({ "package.json": "1.0.0-beta.1" }, notes), /stable/);
  assert.throws(() => validateRelease({ "package.json": "01.0.0" }, notes), /stable/);
  assert.throws(() => validateRelease({ "package.json": "1.00.0" }, notes), /stable/);
  assert.match(validateRelease(versions, notes, "v0.1.26"), /Current fix/);
});

test("rejects missing, empty, or duplicate version sections and missing downloads", () => {
  assert.throws(() => releaseBody(notes, "0.1.27"), /exactly one/);
  assert.throws(() => releaseBody(notes.replace("- Current fix.", ""), "0.1.26"), /bullets/);
  assert.throws(() => releaseBody(notes.replace("## 0.1.25", "## 0.1.26"), "0.1.26"), /exactly one/);
  assert.throws(() => releaseBody(notes.split("<!--")[0], "0.1.26"), /download guidance/);
  assert.throws(() => releaseBody(`${notes}\n<!-- release-downloads -->\nextra`, "0.1.26"), /exactly one/);
});

test("reads the application package rather than dependency versions in Cargo metadata", () => {
  assert.equal(packageVersion('[package]\nname = "worknotes"\nversion = "0.1.26"\n\n[dependencies]\nversion = "9"'), "0.1.26");
  assert.equal(packageVersion('version = 4\n\n[[package]]\nname = "other"\nversion = "9.0.0"\n\n[[package]]\nname = "worknotes"\nversion = "0.1.26"\n', "worknotes"), "0.1.26");
  assert.throws(() => packageVersion('[package]\nname = "missing"'), /Cannot find/);
});
