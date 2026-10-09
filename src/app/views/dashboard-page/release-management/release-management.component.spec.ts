import { of } from 'rxjs';
import { ReleaseManagementComponent } from './release-management.component';

describe('ReleaseManagementComponent', () => {
  it('should populate virtual card counts from the release track summary', () => {
    const connector = {
      listReleaseTracks: vi.fn().mockReturnValue(
        of({
          data: [
            {
              track_id: 'release-track--virtual',
              type: 'virtual',
              summary: {
                members_count: 24,
                quarantine_count: 3,
                component_tracks_count: 2,
              },
            },
          ],
        })
      ),
    } as any;
    const component = new ReleaseManagementComponent(
      connector,
      { navigate: vi.fn() } as any,
      { open: vi.fn() } as any
    );

    component.ngOnInit();

    expect(component.virtualTracks[0].stats).toEqual(
      expect.objectContaining({
        members: 24,
        quarantined: 3,
        components: 2,
      })
    );
  });

  it('should fall back to included arrays when summary counts are absent', () => {
    const connector = {
      listReleaseTracks: vi.fn().mockReturnValue(
        of({
          data: [
            {
              track_id: 'release-track--virtual',
              type: 'virtual',
              members: [{ object_ref: 'attack-pattern--one' }],
              quarantine: [{ object_ref: 'attack-pattern--two' }],
              composition: {
                component_tracks: [
                  { track_id: 'release-track--standard-one' },
                  { track_id: 'release-track--standard-two' },
                ],
              },
            },
          ],
        })
      ),
    } as any;
    const component = new ReleaseManagementComponent(
      connector,
      { navigate: vi.fn() } as any,
      { open: vi.fn() } as any
    );

    component.ngOnInit();

    expect(component.virtualTracks[0].stats).toEqual(
      expect.objectContaining({
        members: 1,
        quarantined: 1,
        components: 2,
      })
    );
  });
});
