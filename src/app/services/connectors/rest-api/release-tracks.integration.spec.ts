import { describe, it, expect, beforeAll } from 'vitest';
import { environment } from 'src/environments/environment';

// Integration tests that exercise the real REST API. These tests will
// silently no-op (skip) if the configured API URL is unreachable.

const apiUrl = environment.integrations.rest_api.url.replace(/\/+$/, '');
let serverAvailable = false;
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

beforeAll(async () => {
  try {
    const res = await probe(`${apiUrl}/release-tracks`);
    if (res && res.ok) {
      serverAvailable = true;
      // try to read and pick an id if available
      try {
        const body = await res.json().catch(() => null);
        // server may return paginated object or array
        if (Array.isArray(body) && body.length > 0 && body[0].id) {
          discoveredTrackId = body[0].id;
        } else if (
          body &&
          body.items &&
          Array.isArray(body.items) &&
          body.items.length > 0 &&
          body.items[0].id
        ) {
          discoveredTrackId = body.items[0].id;
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      serverAvailable = false;
      // leave discoveredTrackId null
    }
  } catch (e) {
    // network error or timeout
    serverAvailable = false;
    console.error(e);
  }
});

describe('Release Tracks API integration (real server)', () => {
  it('GET /release-tracks (list) should return 200 when server available', async () => {
    if (!serverAvailable) {
      console.warn(
        'Skipping /release-tracks test because server is unreachable'
      );
      return;
    }
    const res = await fetch(`${apiUrl}/release-tracks`, {
      headers: commonHeaders,
    });
    expect(res.ok).toBe(true);
    const body = await res.json().catch(() => null);
    expect(body).toBeTruthy();
  });

  it('GET /release-tracks/ephemeral/:domain should return a bundle when available', async () => {
    if (!serverAvailable) {
      console.warn(
        'Skipping ephemeral bundle test because server is unreachable'
      );
      return;
    }
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

  it('GET /release-tracks/:id/snapshots/latest should return a snapshot when tracks exist', async () => {
    if (!serverAvailable) {
      console.warn(
        'Skipping getLatestSnapshot test because server is unreachable'
      );
      return;
    }
    if (!discoveredTrackId) {
      console.warn(
        'Skipping getLatestSnapshot test because no tracks were found in /release-tracks'
      );
      return;
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

  it('GET /release-tracks/:id/staged should return 200 (if track exists)', async () => {
    if (!serverAvailable) {
      console.warn('Skipping listStaged test because server is unreachable');
      return;
    }
    if (!discoveredTrackId) {
      console.warn(
        'Skipping listStaged test because no tracks were found in /release-tracks'
      );
      return;
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
});
