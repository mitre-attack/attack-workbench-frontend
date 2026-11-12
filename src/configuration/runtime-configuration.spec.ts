import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

async function freshConfiguration() {
  vi.resetModules();
  return import('./runtime-configuration');
}

describe('runtime configuration bootstrap', () => {
  it.each([
    {
      development: true,
      logLevel: 'INFO',
      websiteUrl: 'http://localhost:8000',
    },
    {
      development: false,
      logLevel: 'ERROR',
      websiteUrl: 'https://attack.mitre.org',
    },
  ])(
    'uses Angular mode for defaults (development: $development)',
    async ({ development, logLevel, websiteUrl }) => {
      vi.stubGlobal('ngDevMode', development);
      const runtime = await freshConfiguration();
      runtime.initializeRuntimeConfiguration({ defaultLandingPage: 'tactic' });
      expect(runtime.getRuntimeConfiguration()).toMatchObject({
        logLevel,
        attackWebsiteUrl: websiteUrl,
        defaultLandingPage: 'tactic',
      });
    }
  );

  it('requires initialization and shares one immutable result across consumers', async () => {
    const runtime = await freshConfiguration();
    expect(() => runtime.getRuntimeConfiguration()).toThrow(
      'not been initialized'
    );
    const fetchConfiguration = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        collectionManagerEnabled: false,
        logLevel: 'WARN',
        recommendedIndexes: [],
      }),
    });
    vi.stubGlobal('fetch', fetchConfiguration);
    await Promise.all([
      runtime.loadRuntimeConfiguration(),
      runtime.loadRuntimeConfiguration(),
    ]);
    expect(fetchConfiguration).toHaveBeenCalledExactlyOnceWith(
      '/assets/config.json',
      { cache: 'no-store' }
    );
    const config = runtime.getRuntimeConfiguration();
    expect(config.collectionManagerEnabled).toBe(false);
    expect(config.logLevel).toBe('WARN');
    expect(config.recommendedIndexes).toEqual([]);
    expect(config.apiUrl).toBe('api');
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.recommendedIndexes)).toBe(true);
    await runtime.loadRuntimeConfiguration();
    expect(runtime.getRuntimeConfiguration()).toBe(config);
    expect(fetchConfiguration).toHaveBeenCalledTimes(1);
  });

  it.each([
    { ok: false, status: 404, json: async () => ({}) },
    { ok: true, json: async () => ({ collectionManagerEnabled: 'false' }) },
    {
      ok: true,
      json: async () => {
        throw new SyntaxError('Invalid JSON');
      },
    },
  ])(
    'rejects an unusable document before consumers can start',
    async response => {
      const runtime = await freshConfiguration();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
      await expect(runtime.loadRuntimeConfiguration()).rejects.toThrow();
      expect(() => runtime.getRuntimeConfiguration()).toThrow(
        'not been initialized'
      );
    }
  );
});
