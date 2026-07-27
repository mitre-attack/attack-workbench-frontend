import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ReleaseTracksConnectorService } from './release-tracks.service';
import { environment } from 'src/environments/environment';

describe('ReleaseTracksConnectorService', () => {
  function createService(responses: Record<string, any>) {
    const http = {
      get: vi.fn((url: string) => of(responses[url] ?? null)),
    };
    const snackbar = {
      open: vi.fn(),
    };

    return {
      http,
      service: new ReleaseTracksConnectorService(http as any, snackbar as any),
    };
  }

  it('should list snapshot history from the snapshot summary endpoint', async () => {
    const apiUrl = environment.integrations.rest_api.url;
    const trackId = 'release-track--123';

    const { http, service } = createService({
      [`${apiUrl}/release-tracks/${trackId}/snapshots`]: {
        data: [
          {
            id: trackId,
            modified: '2024-05-21T07:00:00.000Z',
            version: null,
            type: 'standard',
            members_count: 10,
            staged_count: 2,
            candidates_count: 4,
          },
        ],
        pagination: {
          total: 1,
          limit: 200,
          offset: 0,
        },
      },
    });

    const history = await firstValueFrom(service.listSnapshots(trackId));

    expect(http.get).toHaveBeenCalledWith(
      `${apiUrl}/release-tracks/${trackId}/snapshots`,
      {
        params: expect.anything(),
      }
    );
    expect(http.get).toHaveBeenCalledTimes(1);
    const requestOptions = http.get.mock.calls[0][1];
    expect(requestOptions.params.get('limit')).toBe('200');
    expect(requestOptions.params.get('offset')).toBe('0');
    expect(history).toEqual([
      expect.objectContaining({
        version: null,
        members_count: 10,
        staged_count: 2,
        candidates_count: 4,
      }),
    ]);
  });

  it('should pass tagged and pagination options to the snapshot list endpoint', async () => {
    const apiUrl = environment.integrations.rest_api.url;
    const trackId = 'release-track--123';

    const { http, service } = createService({
      [`${apiUrl}/release-tracks/${trackId}/snapshots`]: [],
    });

    await firstValueFrom(
      service.listSnapshots(trackId, {
        tagged: true,
        limit: 50,
        offset: 25,
      })
    );

    const requestOptions = http.get.mock.calls[0][1];
    expect(requestOptions.params.get('tagged')).toBe('true');
    expect(requestOptions.params.get('limit')).toBe('50');
    expect(requestOptions.params.get('offset')).toBe('25');
  });

  it('should retrieve the latest snapshot from the explicit latest endpoint', async () => {
    const apiUrl = environment.integrations.rest_api.url;
    const trackId = 'release-track--123';

    const { http, service } = createService({
      [`${apiUrl}/release-tracks/${trackId}/snapshots/latest`]: {
        id: trackId,
        name: 'Enterprise Release',
      },
    });

    const snapshot = await firstValueFrom(
      service.getLatestSnapshot(trackId, { include: 'all' })
    );

    expect(http.get).toHaveBeenCalledWith(
      `${apiUrl}/release-tracks/${trackId}/snapshots/latest`,
      {
        params: expect.anything(),
      }
    );
    expect(http.get.mock.calls[0][1].params.get('include')).toBe('all');
    expect(snapshot?.name).toBe('Enterprise Release');
  });

  it('should export the latest snapshot from the explicit latest endpoint', async () => {
    const apiUrl = environment.integrations.rest_api.url;
    const trackId = 'release-track--123';

    const { http, service } = createService({
      [`${apiUrl}/release-tracks/${trackId}/snapshots/latest`]: {
        type: 'bundle',
        objects: [],
      },
    });

    const result = await firstValueFrom(
      service.exportLatestSnapshot(trackId, 'bundle', { include: 'all' })
    );

    expect(http.get).toHaveBeenCalledWith(
      `${apiUrl}/release-tracks/${trackId}/snapshots/latest`,
      {
        params: expect.anything(),
      }
    );
    expect(http.get.mock.calls[0][1].params.get('format')).toBe('bundle');
    expect(http.get.mock.calls[0][1].params.get('include')).toBe('all');
    expect(result).toEqual({ type: 'bundle', objects: [] });
  });
});
