import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { vi } from 'vitest';

import { MembershipSectionDataService } from './membership-section-data.service';
import { ReleaseTracksConnectorService } from './release-tracks.service';

describe('MembershipSectionDataService', () => {
  const objectRef = 'attack-pattern--063b5b92-5361-481a-9c3f-95492ed9a2d8';
  const trackId = 'release-track--c3d8c25d-0dfe-4d8a-8249-1fc4016d0555';

  let service: MembershipSectionDataService;
  let releaseTracksConnector: {
    listReleaseTracks: ReturnType<typeof vi.fn>;
    listReleasesForObject: ReturnType<typeof vi.fn>;
    listObjectVersions: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    releaseTracksConnector = {
      listReleaseTracks: vi.fn().mockReturnValue(
        of({
          data: [
            {
              id: trackId,
              track_id: trackId,
              name: 'Release Track v1',
              type: 'standard',
            },
          ],
        })
      ),
      listReleasesForObject: vi.fn().mockReturnValue(
        of({
          data: [
            {
              track_id: trackId,
              version: '1.0',
              tagged_at: '2026-07-20T14:57:40.134Z',
              object_modified: '2025-04-15T19:58:03.170Z',
            },
            {
              track_id: 'release-track--other',
              version: '2.0',
              tagged_at: '2026-07-21T14:57:40.134Z',
            },
          ],
        })
      ),
      listObjectVersions: vi.fn().mockReturnValue(
        of({
          versions: [
            {
              tier: 'members',
              object_ref: objectRef,
              object_modified: '2025-04-15T19:58:03.170Z',
            },
          ],
        })
      ),
    };

    service = new MembershipSectionDataService(
      {} as HttpClient,
      releaseTracksConnector as unknown as ReleaseTracksConnectorService
    );
  });

  it('maps tagged releases to the correct track without retaining a stale draft', async () => {
    const tracks = await firstValueFrom(
      service.loadMemberships(
        objectRef,
        {
          workspace: {
            release_tracks: [
              {
                id: trackId,
                tier: 'staged',
                status: 'reviewed',
              },
            ],
          },
        },
        null
      )
    );

    const standardTrack = tracks.find(track => track.type === 'STANDARD');

    expect(standardTrack?.current_draft).toBeNull();
    expect(standardTrack?.production_releases).toHaveLength(1);
    expect(standardTrack?.production_releases?.[0]).toMatchObject({
      track_id: trackId,
      version: '1.0',
    });
    expect(releaseTracksConnector.listReleasesForObject).toHaveBeenCalledWith(
      objectRef,
      { order: 'desc', limit: 100, offset: 0 }
    );
  });
});
