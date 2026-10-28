import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function needsDesktop(paths) {
  return paths.some(path => !(
    path.startsWith('docs/') || path.startsWith('site/') ||
    path.startsWith('.github/ISSUE_TEMPLATE/') ||
    /^[^/]+\.md$/i.test(path) || /^worklog[^/]*preview\.png$/.test(path) ||
    path === '.github/workflows/pages.yml' || path === '.github/PULL_REQUEST_TEMPLATE.md'
  ));
}

export function trustedBuilds(runs, commit, repository) {
  return runs.filter(run =>
    run.head_sha === commit && run.status === 'completed' && run.conclusion === 'success' &&
    run.repository?.full_name === repository &&
    (!run.head_repository || run.head_repository.full_name === repository) &&
    ((run.event === 'push' && run.head_branch === 'main') || run.event === 'workflow_dispatch')
  ).sort((a, b) => b.id - a.id);
}

export function hasPackages(artifacts) {
  return ['WorkLog-Windows', 'WorkLog-Linux'].every(name =>
    artifacts.filter(artifact => artifact.name === name && !artifact.expired).length === 1
  );
}

export function verifyBuildInfo(info, expected) {
  for (const field of ['commit', 'version', 'runId', 'platform']) {
    if (String(info[field]) !== String(expected[field])) throw new Error(`Build provenance mismatch: ${field}`);
  }
}

function main() {
  const command = process.argv[2];
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const pkg = () => JSON.parse(readFileSync('package.json', 'utf8'));
  if (command === 'changes') {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const before = event.pull_request?.base.sha || event.before;
    const after = process.env.GITHUB_SHA;
    const force = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' || !before || /^0+$/.test(before);
    const paths = force ? [] : git('diff', '--name-only', '--no-renames', before, after).split('\n').filter(Boolean);
    console.log(`desktop=${force || needsDesktop(paths)}`);
  } else if (command === 'provenance') {
    writeFileSync('src-tauri/target/release/build-info.json', JSON.stringify({
      commit: git('rev-parse', 'HEAD'), version: pkg().version,
      runId: process.env.GITHUB_RUN_ID, platform: process.env.RUNNER_OS,
    }, null, 2) + '\n');
  } else if (command === 'release-build') {
    const commit = git('rev-parse', 'HEAD');
    const repository = process.env.GITHUB_REPOSITORY;
    const api = (...args) => JSON.parse(execFileSync('gh', ['api', ...args], { encoding: 'utf8' }));
    const response = api('--method', 'GET', `repos/${repository}/actions/workflows/build.yml/runs`,
      '-f', `head_sha=${commit}`, '-f', 'status=success', '-f', 'per_page=100');
    for (const run of trustedBuilds(response.workflow_runs, commit, repository)) {
      const { artifacts } = api(`repos/${repository}/actions/runs/${run.id}/artifacts?per_page=100`);
      if (hasPackages(artifacts)) {
        console.log(`run-id=${run.id}`);
        return;
      }
    }
    throw new Error('No successful trusted build with both packages for this exact commit. Run Build and test WorkLog manually at the release tag, then retry publication.');
  } else if (command === 'verify-artifacts') {
    const directory = process.argv[3];
    const runId = process.argv[4];
    if (!/^\d+$/.test(runId || '')) throw new Error('Missing build run ID');
    for (const platform of ['Windows', 'Linux']) {
      const root = join(directory, `WorkLog-${platform}`);
      const info = JSON.parse(readFileSync(join(root, 'build-info.json'), 'utf8'));
      verifyBuildInfo(info, { commit: git('rev-parse', 'HEAD'), version: pkg().version, runId, platform });
      const binary = join(root, platform === 'Windows' ? 'worklog.exe' : 'worklog');
      if (!existsSync(binary)) throw new Error(`Missing ${platform} executable`);
      const bundles = join(root, 'bundle', platform === 'Windows' ? 'nsis' : 'deb');
      const expected = platform === 'Windows' ? `WorkLog_${pkg().version}_x64-setup.exe` : `WorkLog_${pkg().version}_amd64.deb`;
      if (readdirSync(bundles).filter(name => name.endsWith(platform === 'Windows' ? '.exe' : '.deb')).join() !== expected) {
        throw new Error(`Unexpected ${platform} installer`);
      }
    }
  } else throw new Error('Expected changes, provenance, release-build, or verify-artifacts');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
