import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const defaultsOnly = args.includes('--configuration-defaults-only');
const container = args.includes('--container');
const cliArgs = args.filter(
  arg => arg !== '--configuration-defaults-only' && arg !== '--container'
);
const configurationIndex = cliArgs.findIndex(
  arg => arg === '--configuration' || arg === '-c'
);
const configuration =
  cliArgs
    .find(arg => arg.startsWith('--configuration=') || arg.startsWith('-c='))
    ?.split('=')[1] ??
  (configurationIndex >= 0 ? cliArgs[configurationIndex + 1] : '');
const production = configuration?.split(',').includes('production');

function runScript(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
  });
  return result.status ?? 1;
}

// Every serve/build path, including snapshot preview, prepares the same assets.
for (const command of [
  ['scripts/write-build-info.mjs'],
  ['scripts/compile-configuration.mjs'],
  [
    'scripts/write-runtime-config.mjs',
    // Container inputs use /etc/workbench; Angular still serves generated assets.
    ...(container
      ? [
          '--container',
          '--output',
          resolve(root, '.generated/assets/config.json'),
        ]
      : []),
    ...(production ? ['--production'] : []),
    ...(defaultsOnly ? ['--defaults-only'] : []),
  ],
]) {
  const status = runScript(command);
  if (status !== 0) process.exit(status);
}
const angular = spawn(
  process.execPath,
  ['node_modules/@angular/cli/bin/ng.js', ...cliArgs],
  { cwd: root, stdio: 'inherit' }
);
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    stopping = true;
    angular.kill(signal);
  });
angular.on('exit', code => {
  process.exitCode = stopping ? 0 : (code ?? 1);
  // Angular may clear an export placed under dist; restore it using the same
  // metadata after a successful build. The script is a no-op without an export path.
  if (!stopping && code === 0 && cliArgs[0] === 'build')
    process.exitCode = runScript([
      'scripts/write-build-info.mjs',
      '--export-only',
    ]);
});
angular.on('error', error => {
  console.error(error.message);
  process.exitCode = 1;
});
