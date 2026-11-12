import './load-env.cjs';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageInfo = JSON.parse(
  await readFile(resolve(repositoryRoot, 'package.json'), 'utf8')
);
const assetPath = resolve(repositoryRoot, '.generated/assets/build-info.json');
const exportOnly = process.argv.includes('--export-only');

if (exportOnly && !process.env.WORKBENCH_FRONTEND_BUILD_INFO_OUTPUT_PATH)
  process.exit(0);

function environmentValue(name, fallback) {
  return process.env[name]?.trim() || fallback;
}

function gitCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

const buildInfo = exportOnly
  ? JSON.parse(await readFile(assetPath, 'utf8'))
  : {
      name: packageInfo.name,
      version: environmentValue(
        'WORKBENCH_FRONTEND_APP_VERSION',
        packageInfo.version
      ),
      gitCommit: environmentValue('WORKBENCH_FRONTEND_GIT_COMMIT', gitCommit()),
      buildDate: environmentValue(
        'WORKBENCH_FRONTEND_BUILD_DATE',
        new Date().toISOString()
      ),
    };

const outputPaths = new Set(exportOnly ? [] : [assetPath]);
if (process.env.WORKBENCH_FRONTEND_BUILD_INFO_OUTPUT_PATH) {
  outputPaths.add(
    resolve(process.env.WORKBENCH_FRONTEND_BUILD_INFO_OUTPUT_PATH)
  );
}

for (const outputPath of outputPaths) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(buildInfo, null, 2)}\n`);
  console.log(`Wrote build information to ${outputPath}`);
}
