import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsDesktop, trustedBuilds, hasPackages, verifyBuildInfo } from './ci.mjs';

test('documentation changes skip desktop work while code, dependencies, licensing and CI still run it', () => {
  assert.equal(needsDesktop(['README.md', 'docs/user-guide.md', 'docs/screenshots/test.png', 'site/index.html']), false);
  for (const path of ['src/App.tsx', 'src-tauri/src/main.rs', 'package-lock.json', 'scripts/ci.mjs', '.github/actions/desktop/action.yml', 'LICENSE', 'third-party/rust.json', 'app-icon.svg', 'unknown-file']) {
    assert.equal(needsDesktop(['README.md', path]), true, path);
  }
});

test('publication rejects PRs, forks, failed builds and other commits; permits explicit rebuilds', () => {
  const valid = { id: 1, head_sha: 'abc', status: 'completed', conclusion: 'success', repository: { full_name: 'owner/repo' }, event: 'push', head_branch: 'main' };
  const invalid = [{ event: 'pull_request' }, { event: 'pull_request_target' }, { head_branch: 'feature' }, { head_sha: 'other' }, { conclusion: 'failure' }, { status: 'in_progress' }, { repository: { full_name: 'fork/repo' } }, { head_repository: { full_name: 'fork/repo' } }].map(change => ({ ...valid, ...change }));
  const manual = { ...valid, id: 2, event: 'workflow_dispatch', head_branch: 'v1.0.0' };
  assert.deepEqual(trustedBuilds([...invalid, valid, manual], 'abc', 'owner/repo'), [manual, valid]);
});

test('both non-expired platform artifacts and matching provenance are required', () => {
  const artifacts = ['WorkLog-Windows', 'WorkLog-Linux'].map(name => ({ name, expired: false }));
  assert.equal(hasPackages(artifacts), true);
  assert.equal(hasPackages(artifacts.slice(1)), false);
  assert.equal(hasPackages([...artifacts, artifacts[0]]), false);
  assert.equal(hasPackages(artifacts.map(a => ({ ...a, expired: true }))), false);
  const expected = { commit: 'abc', version: '1.0.0', runId: '123', platform: 'Linux' };
  verifyBuildInfo(expected, expected);
  for (const field of Object.keys(expected)) {
    assert.throws(() => verifyBuildInfo({ ...expected, [field]: 'wrong' }, expected), /mismatch/);
  }
});
