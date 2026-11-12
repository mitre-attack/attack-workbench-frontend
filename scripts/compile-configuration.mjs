import { mkdir, readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';

const source = new URL(
  '../src/configuration/public-configuration.ts',
  import.meta.url
);
const output = new URL('../.generated/runtime/', import.meta.url);
await mkdir(output, { recursive: true });
const result = ts.transpileModule(await readFile(source, 'utf8'), {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
});
await writeFile(new URL('configuration.mjs', output), result.outputText);
