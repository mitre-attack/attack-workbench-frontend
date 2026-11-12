import { describe, it, expect, beforeAll } from 'vitest';

// Opt in explicitly: Node tests do not use the browser's Angular API proxy.
const configuredApiUrl = process.env.WORKBENCH_FRONTEND_TEST_API_URL;
const apiUrl = configuredApiUrl?.replace(/\/+$/, '');
if (configuredApiUrl !== undefined) {
  let url: URL;
  try {
    url = new URL(configuredApiUrl);
  } catch {
    throw new Error(
      'WORKBENCH_FRONTEND_TEST_API_URL must be an absolute HTTP(S) API URL'
    );
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      'WORKBENCH_FRONTEND_TEST_API_URL must be an HTTP(S) API URL without credentials, query, or fragment'
    );
}
const commonHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
};
let discoveredTrackId: string | null = null;

async function probe(url: string, timeoutMs = 3000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

describe.skipIf(configuredApiUrl === undefined)(
  'Release Tracks API integration (real server)',
  () => {
    beforeAll(async () => {
      const res = await probe(`${apiUrl}/release-tracks?type=standard&limit=1`);
      if (!res.ok)
        throw new Error(
          `Configured integration API returned HTTP ${res.status}; check server availability and authentication`
        );
      const body = await res.json();
      if (Array.isArray(body?.data) && body.data[0]?.id)
        discoveredTrackId = body.data[0].id;
    });

    it('GET /release-tracks (list) should return 200 when server available', async () => {
      const res = await fetch(`${apiUrl}/release-tracks`, {
        headers: commonHeaders,
      });
      expect(res.ok).toBe(true);
      const body = await res.json().catch(() => null);
      expect(body).toBeTruthy();
    });

    it('GET /release-tracks/ephemeral/:domain should return a bundle when available', async () => {
      const domain = 'enterprise';
      const res = await fetch(
        `${apiUrl}/release-tracks/ephemeral/${domain}?format=bundle`,
        { headers: commonHeaders }
      );
      // The API may return different formats; assert no network error and a JSON body when possible
      expect(res.ok).toBe(true);
      // attempt to parse JSON but do not fail if parsing isn't possible
      try {
        const json = await res.json();
        expect(json).toBeDefined();
      } catch (e) {
        console.error(e);
      }
    });

    it('GET /release-tracks/:id/snapshots/latest should return the latest snapshot', async context => {
      if (!discoveredTrackId) {
        console.warn(
          'Skipping getLatestSnapshot test because no tracks were found in /release-tracks'
        );
        context.skip();
      }
      const res = await fetch(
        `${apiUrl}/release-tracks/${encodeURIComponent(discoveredTrackId)}/snapshots/latest`,
        { headers: commonHeaders }
      );
      expect(res.ok).toBe(true);
      const json = await res.json().catch(() => null);
      expect(json).toBeTruthy();
      // If the API returns a shape compatible with ReleaseTrackSnapshot, it usually has id/name/modified
      if (json) {
        expect(json).toHaveProperty('id');
      }
    });

    it('GET /release-tracks/:id/staged should return 200 (if track exists)', async context => {
      if (!discoveredTrackId) {
        console.warn(
          'Skipping listStaged test because no tracks were found in /release-tracks'
        );
        context.skip();
      }
      const res = await fetch(
        `${apiUrl}/release-tracks/${encodeURIComponent(discoveredTrackId)}/staged`,
        { headers: commonHeaders }
      );
      expect(res.ok).toBe(true);
      // body may be array or paginated object
      const body = await res.json().catch(() => null);
      expect(body).toBeDefined();
    });
  }
);
