# Third-party distribution materials

`THIRD-PARTY-NOTICES.txt` includes full upstream npm licenses, separate PDF.js
font/CMap/ICC/WASM notices, and resolved Rust license texts. `third-party/inventory.json`
records the locked versions and scope. npm is a conservative non-dev dependency
superset; browser-unused optional Node canvas/native packages are excluded. Rust
covers Windows x64 MSVC and Linux x64 GNU; dev/build-only dependencies are excluded.
This is an attribution inventory, not a claim that every listed package is linked.

Liberation 1.07.4 uses GPL v2 with font exceptions. Its complete source archive
is shipped with the fonts, not merely linked. MPL-2.0 crate sources are included
too. See `third-party/SOURCES.md` and checksum-pinned `third-party/sources.json`.
Original WorkLog code remains Apache-2.0.

## Updating

After `npm ci`, run `npm run notices:generate` then `npm run notices:check`.
When Cargo.lock, Cargo.toml or about.toml changes, first use cargo-about **0.9.2**
from its official checksum-verified release (or `cargo install cargo-about --version
0.9.2 --locked`), and run:

```sh
cargo about generate --manifest-path src-tauri/Cargo.toml --locked --format json --fail -o rust-licenses.json
node scripts/third-party.mjs --rust-json rust-licenses.json
npm run notices:check
```

Review all new licenses, upstream copyright/NOTICE text, optional/native components,
and source obligations. A crate missing its license may use cargo-about's canonical
text. The normalizer rejects generic copyright placeholders and supplements package
license files; missing files use exact-version, checksum-pinned upstream texts in
`third-party/license-overrides.json`. Check upstream attribution before accepting a
refresh and add a reviewed override if required. The committed normalized license
snapshot has no developer filesystem paths. CI verifies lock/config fingerprints,
full-text integrity, npm license output and source archive hashes. It does not
automatically approve new licenses. Preserve/remove obsolete license files only
after reviewing the diff. If an MPL component changes, update the corresponding
`.crate` source archive and its digest from the checksum in Cargo.lock.

Tauri installer resources contain `licenses/` with the WorkLog license, combined
notices and entire third-party directory. Portable Windows ZIP and Linux tarball
contain those same materials. Release assets also include notices and a separate
third-party archive for easy source access. Do not distribute a bare executable
without its accompanying notices/source materials.

Before public distribution, inspect actual Windows and Linux installed packages,
not just this configuration. Linux system libraries supplied by the OS are covered
by distribution packages; AppImage-bundled native libraries also require review of
the produced image's contents and upstream notices. This remains a packaging audit
item until the generated AppImage has been inspected.
