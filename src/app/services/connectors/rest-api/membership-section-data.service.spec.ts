import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { vi } from 'vitest';

import { MembershipSectionDataService } from './membership-section-data.service';
import { ReleaseTracksConnectorService } from './release-tracks.service';

describe('MembershipSectionDataService', () => {
  const objectRef = 'attack-pattern--063b5b92-5361-481a-9c3f-95492ed9a2d8';
  const trackId = 'release-track--c3d8c25d-0dfe-4d8a-8249-1fc4016d0555';

  let service: MembershipSectionDataService;
  let httpClient: { get: ReturnType<typeof vi.fn> };
  let releaseTracksConnector: {
    listReleaseTracks: ReturnType<typeof vi.fn>;
    listReleasesForObject: ReturnType<typeof vi.fn>;
    listObjectVersions: ReturnType<typeof vi.fn>;
    getLatestSnapshot: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    httpClient = {
      get: vi.fn().mockReturnValue(
        of([
          {
            stix: { modified: '2026-07-10T10:00:00.000Z' },
            workspace: {
              release_tracks: [
                {
                  id: trackId,
                  tier: 'candidates',
                  status: 'work-in-progress',
                },
              ],
            },
          },
          {
            stix: { modified: '2026-07-12T12:30:00.000Z' },
            workspace: {
              release_tracks: [
                {
                  id: trackId,
                  tier: 'candidates',
                  status: 'awaiting-review',
                },
              ],
            },
          },
        ])
      ),
    };

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
      getLatestSnapshot: vi.fn().mockReturnValue(
        of({
          modified: '2026-07-20T15:32:46.907Z',
          candidates: [
            {
              object_ref: objectRef,
              object_status: 'work-in-progress',
              object_added_at: '2026-07-20T15:32:46.901Z',
            },
          ],
          staged: [],
        })
      ),
    };

    service = new MembershipSectionDataService(
      httpClient as unknown as HttpClient,
      releaseTracksConnector as unknown as ReleaseTracksConnectorService
    );
  });

  it('uses all object revisions to date the latest status change', async () => {
    releaseTracksConnector.listReleasesForObject.mockReturnValue(
      of({ data: [] })
    );
    releaseTracksConnector.listObjectVersions.mockReturnValue(
      of({
        versions: [
          {
            tier: 'candidates',
            object_ref: objectRef,
            object_status: 'awaiting-review',
          },
        ],
      })
    );

    const tracks = await firstValueFrom(
      service.loadMemberships(
        objectRef,
        {
          type: 'attack-pattern',
          workspace: {
            release_tracks: [
              {
                id: trackId,
                tier: 'candidates',
                status: 'awaiting-review',
              },
            ],
          },
        },
        null
      )
    );

    expect(tracks[0].current_draft?.updated_at).toBe(
      '2026-07-12T12:30:00.000Z'
    );
    expect(httpClient.get).toHaveBeenCalledWith(
      expect.stringContaining(`/techniques/${objectRef}`),
      { params: { versions: 'all' } }
    );
  });

  it('falls back to the track snapshot date when revisions show no transition', async () => {
    httpClient.get.mockReturnValue(
      of([
        {
          stix: { modified: '2025-04-15T19:58:03.170Z' },
          workspace: {
            release_tracks: [
              {
                id: trackId,
                tier: 'candidates',
                status: 'work-in-progress',
              },
            ],
          },
        },
      ])
    );
    releaseTracksConnector.listReleasesForObject.mockReturnValue(
      of({ data: [] })
    );
    releaseTracksConnector.listObjectVersions.mockReturnValue(
      of({
        versions: [
          {
            tier: 'candidates',
            object_ref: objectRef,
            object_status: 'work-in-progress',
          },
        ],
      })
    );

    const tracks = await firstValueFrom(
      service.loadMemberships(
        objectRef,
        {
          type: 'attack-pattern',
          workspace: {
            release_tracks: [
              {
                id: trackId,
                tier: 'candidates',
                status: 'work-in-progress',
              },
            ],
          },
        },
        null
      )
    );

    expect(tracks[0].current_draft?.updated_at).toBe(
      '2026-07-20T15:32:46.901Z'
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
