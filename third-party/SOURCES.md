# Corresponding source

These archives accompany every WorkLog distribution and are also published in
`WorkLog-third-party.tar.gz` beside release binaries. `sources.json` records their
upstream URLs and SHA-256 digests. WorkLog does not modify these components.

- `liberation-fonts-1.07.4.tar.gz` contains the preferred FontForge `.sfd` sources,
  Makefile, scripts, authors, GPL v2 and Liberation exceptions for the four
  LiberationSans fonts distributed by PDF.js. Retrieved unchanged from Ubuntu's
  official source archive; the original upstream Pagure download is unavailable.
  Extract with `tar -xzf`, install FontForge, enter the extracted directory and
  run `make` as described in its README. The output is in `build/`. WorkLog's
  `scripts/pdf-assets.mjs` copies the supplied PDF.js fonts without modification.
- The `.crate` files are gzip tar archives containing the complete original
  MPL-2.0 crate sources, manifests and upstream documentation. Extract with
  `tar -xzf FILE.crate`. The application uses the versions in `src-tauri/Cargo.lock`;
  its build instructions are in `docs/development.md`. These include a conservative
  superset (including the cssparser macro crate) to keep source available even
  when compilation omits particular components.

You may use, modify and redistribute these components under their respective
licenses. The WorkLog Apache-2.0 license does not replace those licenses.
