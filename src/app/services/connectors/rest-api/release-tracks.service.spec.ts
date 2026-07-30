import { of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ReleaseTracksConnectorService } from './release-tracks.service';

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
      .releaseLatest('release-track--standard', { increment: 'minor' })
      .subscribe();

    expect(http.post).toHaveBeenCalledWith(
      `${environment.integrations.rest_api.url}/release-tracks/release-track--standard/snapshots/latest/release`,
      { increment: 'minor' }
    );
  });

  it('should release a selected snapshot with an exact version', () => {
    service
      .releaseSnapshot(
        'release-track--standard',
        '2026-07-23T13:37:28.000Z',
        { version: '14.1' }
      )
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
});
