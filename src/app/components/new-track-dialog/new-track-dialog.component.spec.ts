import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { of } from 'rxjs';

import { NewTrackDialogComponent } from './new-track-dialog.component';
import { ReleaseTracksConnectorService } from 'src/app/services/connectors/rest-api/release-tracks.service';
import {
  DeduplicationStrategy,
  ReleaseTrackType,
  ResolutionStrategy,
  SnapshotScheduleMode,
  SnapshotTier,
} from 'src/app/classes/release-tracks';
import { WorkflowStatus } from 'src/app/utils/types';

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
      imports: [ReactiveFormsModule],
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

  it('should format component track snapshot labels', () => {
    expect(
      component.getComponentTrackSnapshotLabel(
        component.componentTrackOptions[0]
      )
    ).toBe('v1.0');
    expect(
      component.getComponentTrackSnapshotLabel(
        component.componentTrackOptions[1]
      )
    ).toBe('no tagged snapshots');
  });

  it('should remove selected component tracks and clear their filters', () => {
    component.toggleComponentTrack(component.componentTrackOptions[0], true);
    component.componentTrackOptions[0].objectTypes = ['attack-pattern'];

    component.removeComponentTrack(component.componentTrackOptions[0]);

    expect(component.componentTrackOptions[0].selected).toBe(false);
    expect(component.componentTrackOptions[0].objectTypes).toEqual([]);
  });

  it('should create a virtual track with latest tagged components and priorities', () => {
    component.form.patchValue({
      name: 'Combined Enterprise',
      description: 'Aggregates released Enterprise content',
    });
    component.toggleComponentTrack(component.componentTrackOptions[0], true);
    component.componentTrackOptions[0].objectTypes = ['attack-pattern'];

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
            priority: 0,
            filters: {
              object_types: ['attack-pattern'],
            },
          },
        ],
        deduplication: {
          strategy: DeduplicationStrategy.PrioritizeLatestObject,
          tier_resolution: SnapshotTier.Member,
          status_resolution: WorkflowStatus.WorkInProgress,
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
      memberSync: 'track_latest',
      supplantBehavior: 'replace',
    });

    component.handleCreate();

    expect(mockConnector.createReleaseTrack).toHaveBeenCalledWith({
      type: ReleaseTrackType.Standard,
      name: 'Enterprise Content',
      description: 'Tracks Enterprise content',
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

  it('should preserve optional virtual track settings in the create payload', () => {
    component.form.patchValue({
      name: 'Scheduled Combined Track',
      description: 'Includes optional virtual settings',
      composition: {
        deduplicationStrategy: DeduplicationStrategy.Quarantine,
        deduplicationTier: SnapshotTier.Staged,
        deduplicationStatus: WorkflowStatus.Reviewed,
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
            tier_resolution: SnapshotTier.Staged,
            status_resolution: WorkflowStatus.Reviewed,
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
