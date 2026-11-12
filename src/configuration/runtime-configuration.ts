import { isDevMode } from '@angular/core';
import {
  PublicConfiguration,
  resolveConfiguration,
} from './public-configuration';

let configuration: Readonly<PublicConfiguration>;
let loading: Promise<void>;
function freeze(value: PublicConfiguration): Readonly<PublicConfiguration> {
  value.recommendedIndexes.forEach(Object.freeze);
  Object.freeze(value.recommendedIndexes);
  return Object.freeze(value);
}

export function getRuntimeConfiguration(): Readonly<PublicConfiguration> {
  if (!configuration)
    throw new Error('Frontend configuration has not been initialized');
  return configuration;
}

export function initializeRuntimeConfiguration(input: unknown): void {
  configuration = freeze(resolveConfiguration(input, !isDevMode()));
}

export function loadRuntimeConfiguration(): Promise<void> {
  return (loading ??= fetchConfiguration());
}

async function fetchConfiguration(): Promise<void> {
  const response = await fetch('/assets/config.json', { cache: 'no-store' });
  if (!response.ok)
    throw new Error(
      `Unable to load frontend configuration (HTTP ${response.status})`
    );
  initializeRuntimeConfiguration(await response.json());
}
