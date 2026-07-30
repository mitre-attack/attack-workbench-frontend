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
});
