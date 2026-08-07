import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageInfo = JSON.parse(
  await readFile(resolve(repositoryRoot, 'package.json'), 'utf8')
);
const outputPath = process.env.BUILD_INFO_OUTPUT_PATH
  ? resolve(process.env.BUILD_INFO_OUTPUT_PATH)
  : resolve(repositoryRoot, 'dist/app/browser/assets/build-info.json');

function environmentValue(name, fallback) {
  return process.env[name]?.trim() || fallback;
}

const buildInfo = {
  name: packageInfo.name,
  version: environmentValue('APP_VERSION', packageInfo.version),
  gitCommit: environmentValue('GIT_COMMIT', 'unknown'),
  buildDate: environmentValue('BUILD_DATE', 'unknown'),
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(buildInfo, null, 2)}\n`);

console.log(`Wrote build information to ${outputPath}`);
