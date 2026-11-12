import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  environmentOverrides,
  resolveConfiguration,
} from '../.generated/runtime/configuration.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const container = args.includes('--container');
if (!container && !args.includes('--defaults-only'))
  await import('./load-env.cjs');
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--'))
    throw new Error(`${name} requires a path`);
  return resolve(args[index + 1]);
};
const input = option(
  '--input',
  process.env.WORKBENCH_FRONTEND_CONFIG_FILE ||
    (container
      ? '/etc/workbench/config.json'
      : resolve(root, 'src/assets/config.json'))
);
const output = option(
  '--output',
  container
    ? '/usr/share/nginx/html/assets/config.json'
    : resolve(root, '.generated/assets/config.json')
);
const temporary = `${output}.${process.pid}.tmp`;
try {
  let supplied = {};
  if (!args.includes('--defaults-only')) {
    try {
      supplied = JSON.parse(await readFile(input, 'utf8'));
    } catch (error) {
      if (
        error.code !== 'ENOENT' ||
        args.includes('--input') ||
        process.env.WORKBENCH_FRONTEND_CONFIG_FILE
      )
        throw error;
    }
  }
  // Validate supplied input before applying overrides; malformed configuration is never hidden.
  const production = args.includes('--production');
  const baseline = resolveConfiguration(supplied, production);
  const config = resolveConfiguration(
    {
      ...baseline,
      ...environmentOverrides(
        args.includes('--defaults-only') ? {} : process.env
      ),
    },
    production
  );
  await mkdir(dirname(output), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o644,
  });
  await rename(temporary, output);
  console.log(`Wrote frontend configuration to ${output}`);
} catch (error) {
  await rm(temporary, { force: true });
  console.error(`Frontend configuration failed: ${error.message}`);
  process.exitCode = 1;
}
