import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReleaseTracksConnectorService } from './release-tracks.service';
import { environment } from 'src/environments/environment';

describe('ReleaseTracksConnectorService', () => {
  let http: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let service: ReleaseTracksConnectorService;

  beforeEach(() => {
    http = {
      get: vi.fn(() => of({})),
      post: vi.fn(() => of({})),
      put: vi.fn(() => of({})),
      delete: vi.fn(() => of({})),
    };
    service = new ReleaseTracksConnectorService(
      http as any,
      { open: vi.fn() } as any
    );
  });

  it('should retrieve the latest snapshot from the explicit latest endpoint', async () => {
    const apiUrl = environment.integrations.rest_api.url;
    const trackId = 'release-track--123';
    http.get.mockReturnValue(
      of({
        id: trackId,
        name: 'Enterprise Release',
      })
    );

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
    const exportPayload = { type: 'bundle', objects: [] };
    http.get.mockReturnValue(of(exportPayload));

    const result = await firstValueFrom(
      service.exportLatestSnapshot(trackId, 'bundle', {
        include: 'all',
        stixVersion: '2.0',
      })
    );

    expect(http.get).toHaveBeenCalledWith(
      `${apiUrl}/release-tracks/${trackId}/snapshots/latest`,
      {
        params: expect.anything(),
      }
    );
    expect(http.get.mock.calls[0][1].params.get('format')).toBe('bundle');
    expect(http.get.mock.calls[0][1].params.get('include')).toBe('all');
    expect(http.get.mock.calls[0][1].params.get('stixVersion')).toBe('2.0');
    expect(result).toEqual(exportPayload);
  });

  it('should request snapshot history with default pagination', async () => {
    const apiUrl = environment.integrations.rest_api.url;
    const trackId = 'release-track--123';
    const response = {
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
    };
    http.get.mockReturnValue(of(response));

    const history = await firstValueFrom(service.listSnapshots(trackId));

    expect(http.get).toHaveBeenCalledWith(
      `${apiUrl}/release-tracks/${trackId}/snapshots`,
      {
        params: expect.anything(),
      }
    );
    expect(http.get.mock.calls[0][1].params.get('limit')).toBe('200');
    expect(http.get.mock.calls[0][1].params.get('offset')).toBe('0');
    expect(history).toEqual(response);
  });

  it('should pass tagged and pagination options to the snapshot list endpoint', async () => {
    service
      .listSnapshots('release-track--standard', {
        tagged: false,
        limit: 25,
        offset: 50,
      })
      .subscribe();

    const [url, options] = http.get.mock.calls[0];
    expect(url).toBe(
      `${environment.integrations.rest_api.url}/release-tracks/release-track--standard/snapshots`
    );
    expect(options.params.get('tagged')).toBe('false');
    expect(options.params.get('limit')).toBe('25');
    expect(options.params.get('offset')).toBe('50');
  });

  it('should create a deterministic graph for an exact snapshot', async () => {
    const snapshot = {
      modified: '2026-07-23T13:37:28.000Z',
      version: '1.0',
      graph_manifest_id: 'release-track-graph-manifest--123',
    };
    http.post.mockReturnValue(of(snapshot));

    const result = await firstValueFrom(
      service.createSnapshotGraph(
        'release-track--standard',
        '2026-07-23T13:37:28.000Z'
      )
    );

    expect(http.post).toHaveBeenCalledWith(
      `${environment.integrations.rest_api.url}/release-tracks/release-track--standard/snapshots/2026-07-23T13%3A37%3A28.000Z/graph`,
      {}
    );
    expect(result).toEqual(snapshot);
  });

  it('should delete a deterministic graph for an exact snapshot', async () => {
    http.delete.mockReturnValue(of(undefined));

    const result = await firstValueFrom(
      service.deleteSnapshotGraph(
        'release-track--standard',
        '2026-07-23T13:37:28.000Z'
      )
    );

    expect(http.delete).toHaveBeenCalledWith(
      `${environment.integrations.rest_api.url}/release-tracks/release-track--standard/snapshots/2026-07-23T13%3A37%3A28.000Z/graph`
    );
    expect(result).toBeUndefined();
  });

  it('should create virtual snapshots through the virtual namespace', () => {
    service
      .createVirtualSnapshot('release-track--virtual', {
        description: 'Scheduled draft',
      })
      .subscribe();

    expect(http.post).toHaveBeenCalledWith(
      `${environment.integrations.rest_api.url}/release-tracks/release-track--virtual/virtual/snapshots/create`,
      { description: 'Scheduled draft' }
    );
  });

  it('should update composition through the virtual namespace', () => {
    const composition = {
      component_tracks: [
        {
          track_id: 'release-track--standard',
          resolution_strategy: 'latest_tagged' as const,
          priority: 0,
        },
      ],
    };

    service
      .updateComposition('release-track--virtual', composition)
      .subscribe();

    expect(http.put).toHaveBeenCalledWith(
      `${environment.integrations.rest_api.url}/release-tracks/release-track--virtual/virtual/composition`,
      composition
    );
  });

  it('should promote an exact quarantined revision', () => {
    const body = {
      object_ref: 'attack-pattern--one',
      object_modified: '2026-07-23T13:37:28.000Z',
    };

    service
      .promoteQuarantinedRevision('release-track--virtual', body)
      .subscribe();

    expect(http.post).toHaveBeenCalledWith(
      `${environment.integrations.rest_api.url}/release-tracks/release-track--virtual/virtual/quarantine/promote`,
      body
    );
  });

  it('should not expose the removed virtual snapshot preview operation', () => {
    expect((service as any).previewVirtualSnapshot).toBeUndefined();
  });

  it('should preview a release with query-based version selection', () => {
    service
      .previewRelease('release-track--standard', {
        format: 'summary',
        increment: 'major',
      })
      .subscribe();

    const [url, options] = http.get.mock.calls[0];
    expect(url).toBe(
      `${environment.integrations.rest_api.url}/release-tracks/release-track--standard/snapshots/latest/release/preview`
    );
    expect(options.params.get('format')).toBe('summary');
    expect(options.params.get('increment')).toBe('major');
  });

  it('should release the latest snapshot with the current request body', () => {
    service
      .releaseLatest('release-track--standard', {
        increment: 'minor',
        description: 'Analyst release context',
      })
      .subscribe();

    expect(http.post).toHaveBeenCalledWith(
      `${environment.integrations.rest_api.url}/release-tracks/release-track--standard/snapshots/latest/release`,
      { increment: 'minor', description: 'Analyst release context' }
    );
  });

  it('should release a selected snapshot with an exact version', () => {
    service
      .releaseSnapshot('release-track--standard', '2026-07-23T13:37:28.000Z', {
        version: '14.1',
      })
      .subscribe();

    expect(http.post).toHaveBeenCalledWith(
      `${environment.integrations.rest_api.url}/release-tracks/release-track--standard/snapshots/2026-07-23T13%3A37%3A28.000Z/release`,
      { version: '14.1' }
    );
  });

  it('should not expose bump-oriented operations', () => {
    expect((service as any).previewBump).toBeUndefined();
    expect((service as any).bumpByLatest).toBeUndefined();
    expect((service as any).bumpByModified).toBeUndefined();
  });

  it('should list tracks with only supported query parameters', () => {
    service
      .listReleaseTracks({
        type: 'virtual',
        limit: 25,
        offset: 0,
        search: 'enterprise',
      })
      .subscribe();

    const [url, options] = http.get.mock.calls[0];
    expect(url).toBe(`${environment.integrations.rest_api.url}/release-tracks`);
    expect(options.params.get('type')).toBe('virtual');
    expect(options.params.get('limit')).toBe('25');
    expect(options.params.get('offset')).toBe('0');
    expect(options.params.get('search')).toBe('enterprise');
  });

  it('should confirm the target ID when deleting a release track', () => {
    service.deleteReleaseTrack('release-track--standard').subscribe();

    const [url, options] = http.delete.mock.calls[0];
    expect(url).toBe(
      `${environment.integrations.rest_api.url}/release-tracks/release-track--standard`
    );
    expect(options.params.get('confirm_track_id')).toBe(
      'release-track--standard'
    );
  });

  it('should encode timestamps used as snapshot path parameters', () => {
    service
      .retrieveSnapshotByModified(
        'release-track--standard',
        '2026-07-23T13:37:28.000Z'
      )
      .subscribe();

    const [url] = http.get.mock.calls[0];
    expect(url).toBe(
      `${environment.integrations.rest_api.url}/release-tracks/release-track--standard/snapshots/2026-07-23T13%3A37%3A28.000Z`
    );
  });

  it('should update notes on an exact snapshot', () => {
    service
      .updateSnapshotDescription(
        'release-track--standard',
        '2026-07-23T13:37:28.000Z',
        { description: 'Updated analyst context' }
      )
      .subscribe();

    expect(http.put).toHaveBeenCalledWith(
      `${environment.integrations.rest_api.url}/release-tracks/release-track--standard/snapshots/2026-07-23T13%3A37%3A28.000Z/description`,
      { description: 'Updated analyst context' }
    );
  });
});
