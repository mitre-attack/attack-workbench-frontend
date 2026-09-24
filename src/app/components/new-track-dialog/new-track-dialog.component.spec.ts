import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { of } from 'rxjs';

import { NewTrackDialogComponent } from './new-track-dialog.component';
import { ReleaseTracksConnectorService } from 'src/app/services/connectors/rest-api/release-tracks.service';
import {
  DeduplicationStrategy,
  ReleaseTrackType,
  ResolutionStrategy,
  SnapshotScheduleMode,
} from 'src/app/classes/release-tracks';

describe('NewTrackDialogComponent', () => {
  let component: NewTrackDialogComponent;
  let fixture: ComponentFixture<NewTrackDialogComponent>;
  let mockDialogRef: any;
  let mockConnector: any;

  beforeEach(async () => {
    mockDialogRef = {
      close: vi.fn(),
    };
    mockConnector = {
      listReleaseTracks: vi.fn(() =>
        of({
          data: [
            {
              track_id: 'release-track--standard-tagged',
              type: 'standard',
              name: 'Tagged Standard',
              description: 'Can be used by a virtual track',
              latest_tagged_version: '1.0',
              tagged_release_count: 1,
            },
            {
              track_id: 'release-track--standard-draft',
              type: 'standard',
              name: 'Draft Only Standard',
              tagged_release_count: 0,
            },
            {
              track_id: 'release-track--virtual-tagged',
              type: 'virtual',
              name: 'Virtual Track',
              latest_tagged_version: '1.0',
              tagged_release_count: 1,
            },
          ],
        })
      ),
      createReleaseTrack: vi.fn(() =>
        of({ track_id: 'release-track--new-virtual' })
      ),
    };

    await TestBed.configureTestingModule({
      declarations: [NewTrackDialogComponent],
      imports: [FormsModule, ReactiveFormsModule],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { type: ReleaseTrackType.Virtual },
        },
        { provide: ReleaseTracksConnectorService, useValue: mockConnector },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(NewTrackDialogComponent);
    component = fixture.componentInstance;
    component.ngOnInit();
  });

  it('should list standard tracks even when they have no tagged snapshots', () => {
    expect(mockConnector.listReleaseTracks).toHaveBeenCalledWith();
    expect(component.componentTrackOptions).toEqual([
      expect.objectContaining({
        trackId: 'release-track--standard-tagged',
        name: 'Tagged Standard',
      }),
      expect.objectContaining({
        trackId: 'release-track--standard-draft',
        name: 'Draft Only Standard',
      }),
    ]);
  });

  it('should filter and select component tracks from the autocomplete', () => {
    component.form.get('composition.componentTrackSearch')?.setValue('draft');

    expect(component.filteredComponentTrackOptions).toEqual([
      expect.objectContaining({
        trackId: 'release-track--standard-draft',
      }),
    ]);

    component.selectComponentTrack({
      option: {
        value: component.componentTrackOptions[1],
      },
    });

    expect(component.selectedComponentTracks).toEqual([
      expect.objectContaining({
        trackId: 'release-track--standard-draft',
      }),
    ]);
    expect(component.form.get('composition.componentTrackSearch')?.value).toBe(
      ''
    );
    expect(component.filteredComponentTrackOptions).not.toContain(
      component.componentTrackOptions[1]
    );
  });

  it('should remove selected component tracks and clear their filters', () => {
    component.toggleComponentTrack(component.componentTrackOptions[0], true);
    component.componentTrackOptions[0].objectTypes = ['attack-pattern'];

    component.removeComponentTrack(component.componentTrackOptions[0]);

    expect(component.componentTrackOptions[0].selected).toBe(false);
    expect(component.componentTrackOptions[0].objectTypes).toEqual([]);
  });

  it('should create a mixed composition with explicit priorities and independent filters', () => {
    component.form.patchValue({
      name: 'Combined Enterprise',
      description: 'Aggregates released Enterprise content',
    });
    component.toggleComponentTrack(component.componentTrackOptions[0], true);
    component.componentTrackOptions[0].objectTypes = ['attack-pattern'];
    component.toggleComponentTrack(component.componentTrackOptions[1], true);
    component.componentTrackOptions[1].resolutionStrategy =
      ResolutionStrategy.LatestPreview;
    component.componentTrackOptions[1].domains = ['mobile'];
    component.componentTrackOptions[0].priority = 20;
    component.componentTrackOptions[1].priority = 3;

    component.handleCreate();

    expect(mockConnector.createReleaseTrack).toHaveBeenCalledWith({
      type: ReleaseTrackType.Virtual,
      name: 'Combined Enterprise',
      description: 'Aggregates released Enterprise content',
      composition: {
        component_tracks: [
          {
            track_id: 'release-track--standard-tagged',
            resolution_strategy: ResolutionStrategy.LatestTagged,
            priority: 20,
            filters: {
              object_types: ['attack-pattern'],
            },
          },
          {
            track_id: 'release-track--standard-draft',
            resolution_strategy: ResolutionStrategy.LatestPreview,
            priority: 3,
            filters: {
              domains: ['mobile'],
            },
          },
        ],
        deduplication: {
          strategy: DeduplicationStrategy.PrioritizeLatestObject,
        },
      },
      snapshot_schedule: {
        mode: SnapshotScheduleMode.Manual,
      },
    });
    expect(mockDialogRef.close).toHaveBeenCalledWith({
      track_id: 'release-track--new-virtual',
    });
  });

  it('blocks duplicate, empty and invalid priorities until they are corrected', () => {
    component.form.patchValue({ name: 'Priority validation' });
    const [first, second] = component.componentTrackOptions;
    component.toggleComponentTrack(first, true);
    component.toggleComponentTrack(second, true);

    for (const priority of [first.priority, null, -1, 0.5]) {
      second.priority = priority;
      expect(component.isFormValid()).toBe(false);
      component.handleCreate();
    }
    expect(mockConnector.createReleaseTrack).not.toHaveBeenCalled();
    second.priority = 7;
    expect(component.isFormValid()).toBe(true);
    component.handleCreate();
    expect(mockConnector.createReleaseTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        composition: expect.objectContaining({
          component_tracks: [
            expect.objectContaining({ track_id: first.trackId, priority: 0 }),
            expect.objectContaining({ track_id: second.trackId, priority: 7 }),
          ],
        }),
      })
    );
  });

  it('does not renumber remaining priorities when a component is removed and re-added', () => {
    const [first, second] = component.componentTrackOptions;
    component.toggleComponentTrack(first, true);
    component.toggleComponentTrack(second, true);
    second.priority = 12;
    component.removeComponentTrack(first);
    component.selectComponentTrack({ option: { value: first } });
    expect(second.priority).toBe(12);
    expect(first.priority).toBe(13);
  });

  it('should create a virtual track with public domain filters', () => {
    component.form.patchValue({
      name: 'Combined domain content',
    });
    component.toggleComponentTrack(component.componentTrackOptions[0], true);
    component.componentTrackOptions[0].objectTypes = ['malware'];
    (component.componentTrackOptions[0] as any).domains = [
      'enterprise',
      'mobile',
    ];

    component.handleCreate();

    expect(mockConnector.createReleaseTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        composition: expect.objectContaining({
          component_tracks: [
            expect.objectContaining({
              filters: {
                object_types: ['malware'],
                domains: ['enterprise', 'mobile'],
              },
            }),
          ],
        }),
      })
    );
  });

  it('should allow untagged standard tracks in virtual track composition', () => {
    component.form.patchValue({
      name: 'Future Combined Track',
      description: 'Will resolve once components are tagged',
    });
    component.toggleComponentTrack(component.componentTrackOptions[1], true);

    component.handleCreate();

    expect(mockConnector.createReleaseTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        composition: expect.objectContaining({
          component_tracks: [
            expect.objectContaining({
              track_id: 'release-track--standard-draft',
              resolution_strategy: ResolutionStrategy.LatestTagged,
              priority: 0,
            }),
          ],
        }),
      })
    );
  });

  it('should create a standard track with the API member-sync supplant shape', () => {
    component.mode = ReleaseTrackType.Standard;
    component.form.patchValue({
      name: 'Enterprise Content',
      description: 'Tracks Enterprise content',
      snapshotDescription: 'Initial analyst context',
      memberSync: 'track_latest',
      supplantBehavior: 'replace',
    });

    component.handleCreate();

    expect(mockConnector.createReleaseTrack).toHaveBeenCalledWith({
      type: ReleaseTrackType.Standard,
      name: 'Enterprise Content',
      description: 'Tracks Enterprise content',
      snapshot_description: 'Initial analyst context',
      config: {
        auto_promote: false,
        member_sync: {
          strategy: 'track_latest',
          supplant: {
            behavior: 'replace',
            status_policy: 'preserve',
          },
        },
      },
    });
  });

  it('should omit unsupported virtual deduplication resolution settings', () => {
    component.form.patchValue({
      name: 'Scheduled Combined Track',
      description: 'Includes optional virtual settings',
      composition: {
        deduplicationStrategy: DeduplicationStrategy.Quarantine,
      },
      snapshotSchedule: {
        mode: SnapshotScheduleMode.Cron,
        cron: '0 0 1 1,7 *',
      },
    });
    component.toggleComponentTrack(component.componentTrackOptions[0], true);

    component.handleCreate();

    expect(mockConnector.createReleaseTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        composition: expect.objectContaining({
          deduplication: {
            strategy: DeduplicationStrategy.Quarantine,
          },
        }),
        snapshot_schedule: {
          mode: SnapshotScheduleMode.Cron,
          cron: '0 0 1 1,7 *',
        },
      })
    );
  });
});
