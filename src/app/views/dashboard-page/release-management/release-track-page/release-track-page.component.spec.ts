import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReleaseTrackPageComponent } from './release-track-page.component';
import { ReleaseTracksConnectorService } from 'src/app/services/connectors/rest-api/release-tracks.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import {
  createAsyncObservable,
  createMockReleaseTrackApiConnector,
  createPaginatedResponse,
} from 'src/app/testing/mocks/rest-api-connector.mock';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { BreadcrumbService } from 'src/app/services/helpers/breadcrumb.service';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { MultipleChoiceDialogComponent } from 'src/app/components/multiple-choice-dialog/multiple-choice-dialog.component';
import { AddDialogComponent } from 'src/app/components/add-dialog/add-dialog.component';
import { DeleteDialogComponent } from 'src/app/components/delete-dialog/delete-dialog.component';
import { AuthenticationService } from 'src/app/services/connectors/authentication/authentication.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  ConflictPolicy,
  DeduplicationStrategy,
  MemberSyncBehavior,
  MemberSyncPolicy,
  MemberSyncStrategy,
  ReleaseTrackType,
  SnapshotScheduleMode,
  SnapshotTier,
} from 'src/app/classes/release-tracks';

describe('ReleaseTrackPageComponent', () => {
  let component: ReleaseTrackPageComponent;
  let fixture: ComponentFixture<ReleaseTrackPageComponent>;
  let mockReleaseTrackApiConnector: any;
  let mockDialog: any;
  let mockRestApiConnector: any;
  let mockRouter: any;
  let mockAuthenticationService: any;

  beforeEach(async () => {
    mockReleaseTrackApiConnector = createMockReleaseTrackApiConnector({
      getLatestSnapshot: vi.fn(() => createAsyncObservable(null)),
      listReleaseTracks: vi.fn(() => createAsyncObservable({ data: [] })),
      listSnapshots: vi.fn(() => createAsyncObservable([])),
      exportLatestSnapshot: vi.fn(() => createAsyncObservable({})),
      exportSnapshotByModified: vi.fn(() => createAsyncObservable({})),
      retrieveSnapshotByModified: vi.fn(() => createAsyncObservable(null)),
      createVirtualSnapshot: vi.fn(() => createAsyncObservable({})),
      previewRelease: vi.fn(() => createAsyncObservable({})),
      releaseLatest: vi.fn(() => createAsyncObservable({})),
      releaseSnapshot: vi.fn(() => createAsyncObservable({})),
      getConfig: vi.fn(() => createAsyncObservable(null)),
      updateConfig: vi.fn(() => createAsyncObservable({})),
      updateComposition: vi.fn(() => createAsyncObservable({})),
      reviewCandidates: vi.fn(() => createAsyncObservable({})),
      updateMetadataByLatest: vi.fn(() => createAsyncObservable({})),
      addCandidates: vi.fn(() => createAsyncObservable({})),
      deleteReleaseTrack: vi.fn(() => createAsyncObservable({})),
    });
    mockDialog = {
      open: vi.fn(),
    };
    mockRestApiConnector = {
      getAllObjects: vi.fn(() =>
        createAsyncObservable(createPaginatedResponse([]))
      ),
      triggerBrowserDownload: vi.fn(),
    };
    const mockBreadcrumbService = {
      changeBreadcrumb: vi.fn(),
    };
    mockRouter = {
      navigate: vi.fn(),
    };
    mockAuthenticationService = {
      canEdit: vi.fn(() => true),
    };

    await TestBed.configureTestingModule({
      declarations: [ReleaseTrackPageComponent],
      imports: [FormsModule, ReactiveFormsModule],
      providers: [
        {
          provide: ReleaseTracksConnectorService,
          useValue: mockReleaseTrackApiConnector,
        },
        {
          provide: RestApiConnectorService,
          useValue: mockRestApiConnector,
        },
        {
          provide: AuthenticationService,
          useValue: mockAuthenticationService,
        },
        {
          provide: MatDialog,
          useValue: mockDialog,
        },
        {
          provide: BreadcrumbService,
          useValue: mockBreadcrumbService,
        },
        {
          provide: Router,
          useValue: mockRouter,
        },
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({}),
            queryParams: of({}),
            snapshot: {},
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ReleaseTrackPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should delete the release track after confirmation', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(true),
    });
    mockReleaseTrackApiConnector.deleteReleaseTrack.mockReturnValue(of({}));
    component.id = 'release-track--123';
    component.releaseTrack = { name: 'Enterprise Release' } as any;

    component.onDeleteReleaseTrack();

    expect(mockDialog.open).toHaveBeenCalledWith(
      DeleteDialogComponent,
      expect.objectContaining({
        maxWidth: '35em',
        disableClose: true,
        autoFocus: false,
        data: expect.objectContaining({
          title: 'Are you sure you want to delete this release track?',
          warning:
            'Enterprise Release and its snapshots will be permanently deleted.',
          stixId: 'release-track--123',
        }),
      })
    );
    expect(
      mockReleaseTrackApiConnector.deleteReleaseTrack
    ).toHaveBeenCalledWith('release-track--123');
    expect(mockRouter.navigate).toHaveBeenCalledWith([
      '/dashboard/release-management',
    ]);
  });

  it('should not delete the release track when confirmation is cancelled', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(false),
    });
    component.id = 'release-track--123';

    component.onDeleteReleaseTrack();

    expect(
      mockReleaseTrackApiConnector.deleteReleaseTrack
    ).not.toHaveBeenCalled();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('should not open the delete dialog without editor authorization', () => {
    mockAuthenticationService.canEdit.mockReturnValue(false);
    component.id = 'release-track--123';

    component.onDeleteReleaseTrack();

    expect(mockDialog.open).not.toHaveBeenCalled();
  });

  it('should download the release track in the selected export format', () => {
    const exportPayload = { type: 'bundle', objects: [] };
    mockDialog.open.mockReturnValue({
      afterClosed: () => of('bundle'),
    });
    mockReleaseTrackApiConnector.exportLatestSnapshot.mockReturnValue(
      of(exportPayload)
    );
    component.id = 'release-track--123';
    component.releaseTrack = { name: 'Enterprise Release' } as any;

    component.onExport();

    expect(mockDialog.open).toHaveBeenCalledWith(
      MultipleChoiceDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          choices: expect.arrayContaining([
            expect.objectContaining({
              label: 'STIX Bundle',
              value: 'bundle',
            }),
          ]),
        }),
      })
    );
    expect(
      mockReleaseTrackApiConnector.exportLatestSnapshot
    ).toHaveBeenCalledWith('release-track--123', 'bundle', { include: 'all' });
    expect(mockRestApiConnector.triggerBrowserDownload).toHaveBeenCalledWith(
      exportPayload,
      'enterprise-release-latest-bundle.json'
    );
  });

  it('should not export when the dialog is dismissed', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(null),
    });
    component.id = 'release-track--123';

    component.onExport();

    expect(
      mockReleaseTrackApiConnector.exportLatestSnapshot
    ).not.toHaveBeenCalled();
  });

  it('should not open the export dialog without a release track id', () => {
    component.id = '';

    component.onExport();

    expect(mockDialog.open).not.toHaveBeenCalled();
  });

  it('should load the latest release track with the snapshot model response', () => {
    mockReleaseTrackApiConnector.getLatestSnapshot.mockReturnValue(
      of({ name: 'Enterprise Release' })
    );
    component.id = 'release-track--123';

    component.getReleaseTrack();

    expect(mockReleaseTrackApiConnector.getLatestSnapshot).toHaveBeenCalledWith(
      'release-track--123',
      { format: 'workbench', include: 'all' }
    );
    expect(component.releaseTrack?.name).toBe('Enterprise Release');
  });

  it('should expose virtual release track composition and resolution details', () => {
    component.releaseTrack = {
      type: ReleaseTrackType.Virtual,
      composition: {
        component_tracks: [
          {
            track_id: 'release-track--component-one',
            resolution_strategy: 'latest_tagged',
            priority: 0,
            filters: {
              object_types: ['attack-pattern'],
            },
          },
          {
            track_id: 'release-track--component-two',
            resolution_strategy: 'latest_tagged',
            priority: 1,
          },
        ],
      },
      composition_resolution: {
        component_snapshots: [
          {
            track_id: 'release-track--component-one',
            track_name: 'Resolved Component One',
            resolved_version: '1.0',
            objects_contributed: 8,
            objects_after_filter: 8,
          },
          {
            track_id: 'release-track--component-two',
            track_name: 'Component Two',
            resolved_version: '2.0',
            objects_contributed: 12,
            objects_after_filter: 12,
          },
        ],
        summary: {
          total_objects: 20,
        },
        deduplication: {
          duplicates_found: 2,
          conflicts_resolved: [{ object_ref: 'attack-pattern--one' }],
        },
      },
      members: [
        {
          object_ref: 'x-mitre-collection--enterprise',
          object_modified: '2026-01-01T00:00:00.000Z',
          attack_id: 'NX0001',
          name: 'Enterprise ATT&CK',
        },
      ],
      quarantine: [{ object_ref: 'attack-pattern--quarantined' }],
    } as any;
    (component as any).virtualComponentTrackSummaries = new Map([
      [
        'release-track--component-one',
        {
          trackId: 'release-track--component-one',
          name: 'Component One',
          candidatesCount: 9,
          stagedCount: 3,
          membersCount: 72,
        },
      ],
      [
        'release-track--component-two',
        {
          trackId: 'release-track--component-two',
          name: 'Component Two',
          candidatesCount: 2,
          stagedCount: 1,
          membersCount: 20,
        },
      ],
    ]);

    expect(component.isVirtualReleaseTrack).toBe(true);
    expect(component.virtualComponentTracks).toHaveLength(2);
    expect(component.resolvedComponentSnapshots).toHaveLength(2);
    expect(component.virtualResolvedObjectCount).toBe(20);
    expect(component.virtualDuplicateCount).toBe(2);
    expect(component.virtualConflictCount).toBe(1);
    expect(component.quarantineObjects).toHaveLength(1);
    expect(
      component.getComponentTrackLabel(component.virtualComponentTracks[0])
    ).toBe('Component One');
    expect(
      component.getComponentTrackFilters(component.virtualComponentTracks[0])
    ).toEqual(['attack pattern']);
    expect(component.virtualResolutionRows[0]).toEqual(
      expect.objectContaining({
        trackId: 'release-track--component-one',
        trackName: 'Component One',
        strategy: 'latest_tagged',
        resolvedVersion: '1.0',
        candidatesCount: 9,
        stagedCount: 3,
        membersCount: 72,
      })
    );
    expect(
      component.getVirtualResolvedVersion(component.virtualResolutionRows[0])
    ).toBe('v1.0');
    expect(component.getVirtualTierCount(9)).toBe('9');
    expect(component.getVirtualObjectTitle(component.members[0])).toBe(
      'Enterprise ATT&CK'
    );
    expect(component.getVirtualObjectSubtitle(component.members[0])).toBe(
      'NX0001'
    );
  });

  it('should load component track summaries alongside a virtual track', () => {
    mockReleaseTrackApiConnector.getLatestSnapshot.mockReturnValue(
      of({
        type: ReleaseTrackType.Virtual,
        name: 'Virtual Release',
        composition: {
          component_tracks: [
            {
              track_id: 'release-track--component-one',
              resolution_strategy: 'latest_tagged',
            },
          ],
        },
      })
    );
    mockReleaseTrackApiConnector.listReleaseTracks.mockReturnValue(
      of({
        data: [
          {
            track_id: 'release-track--component-one',
            name: 'Component One',
            summary: {
              candidates_count: 9,
              staged_count: 3,
              members_count: 72,
            },
          },
        ],
      })
    );
    component.id = 'release-track--virtual';

    component.getReleaseTrack();

    expect(mockReleaseTrackApiConnector.listReleaseTracks).toHaveBeenCalled();
    expect(component.virtualResolutionRows[0]).toEqual(
      expect.objectContaining({
        trackName: 'Component One',
        candidatesCount: 9,
        stagedCount: 3,
        membersCount: 72,
      })
    );
  });

  it('should navigate to a component release track page', () => {
    component.onOpenComponentTrack({
      trackId: 'release-track--component-one',
    });

    expect(mockRouter.navigate).toHaveBeenCalledWith([
      '/dashboard/release-management',
      'release-track--component-one',
    ]);
  });

  it('should load snapshot history and compute timeline counts', () => {
    mockReleaseTrackApiConnector.listSnapshots.mockReturnValue(
      of([
        {
          modified: '2024-05-21T07:00:00.000Z',
          members: [
            {
              object_ref: 'attack-pattern--one',
              object_modified: '2024-05-20T00:00:00.000Z',
            },
            {
              object_ref: 'attack-pattern--two',
              object_modified: '2024-05-20T00:00:00.000Z',
            },
          ],
        },
        {
          version: '1.3',
          modified: '2024-04-15T06:00:00.000Z',
          members: [
            {
              object_ref: 'attack-pattern--one',
              object_modified: '2024-04-01T00:00:00.000Z',
            },
          ],
        },
      ])
    );
    component.id = 'release-track--123';

    component.getSnapshotHistory();

    expect(mockReleaseTrackApiConnector.listSnapshots).toHaveBeenCalledWith(
      'release-track--123'
    );
    expect(component.snapshotHistory[0]).toEqual(
      expect.objectContaining({
        title: 'Draft Snapshot',
        addedCount: 1,
        modifiedCount: 1,
        totalObjects: 2,
      })
    );
    expect(component.snapshotHistory[1]).toEqual(
      expect.objectContaining({
        title: 'v1.3',
        addedCount: 0,
        modifiedCount: 0,
        totalObjects: 1,
      })
    );
  });

  it('should create a draft snapshot and refresh the release track', () => {
    const refreshSpy = vi
      .spyOn(component, 'getReleaseTrack')
      .mockImplementation(() => undefined);
    const historySpy = vi
      .spyOn(component, 'getSnapshotHistory')
      .mockImplementation(() => undefined);
    mockDialog.open.mockReturnValue({
      afterClosed: () => of('create'),
    });
    mockReleaseTrackApiConnector.createVirtualSnapshot.mockReturnValue(of({}));
    component.id = 'release-track--123';
    component.releaseTrack = { type: ReleaseTrackType.Virtual } as any;

    component.onDraft();

    expect(mockDialog.open).toHaveBeenCalledWith(
      MultipleChoiceDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Create draft snapshot?',
          description: expect.stringContaining('persistent virtual draft'),
        }),
      })
    );
    expect(
      mockReleaseTrackApiConnector.createVirtualSnapshot
    ).toHaveBeenCalledWith('release-track--123', {
      description: 'Initial virtual snapshot',
    });
    expect(refreshSpy).toHaveBeenCalled();
    expect(historySpy).toHaveBeenCalled();
    expect(component.isCreatingDraft).toBe(false);
  });

  it('should not create a draft snapshot without a release track id', () => {
    component.id = '';
    component.releaseTrack = { type: ReleaseTrackType.Virtual } as any;

    component.onDraft();

    expect(mockDialog.open).not.toHaveBeenCalled();
    expect(
      mockReleaseTrackApiConnector.createVirtualSnapshot
    ).not.toHaveBeenCalled();
  });

  it('should not create a draft snapshot for a standard release track', () => {
    component.id = 'release-track--123';
    component.releaseTrack = { type: ReleaseTrackType.Standard } as any;

    component.onDraft();

    expect(mockDialog.open).not.toHaveBeenCalled();
    expect(
      mockReleaseTrackApiConnector.createVirtualSnapshot
    ).not.toHaveBeenCalled();
  });

  it('should open the all objects table to add candidates', () => {
    mockDialog.open.mockImplementation((_component: any, config: any) => {
      config.data.select.select('attack-pattern--1234');
      return {
        afterClosed: () => of(true),
      };
    });
    mockReleaseTrackApiConnector.addCandidates.mockReturnValue(of({}));
    component.id = 'release-track--123';
    component.releaseTrack = { id: 'release-track--123' } as any;

    component.onAddCandidate();

    expect(mockRestApiConnector.getAllObjects).not.toHaveBeenCalled();
    expect(mockDialog.open).toHaveBeenCalledWith(
      AddDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Add candidates',
          stixListConfig: expect.objectContaining({
            showUserSearch: true,
            excludeAttackTypes: ['relationship', 'note', 'collection'],
            select: 'many',
          }),
        }),
      })
    );
    expect(mockReleaseTrackApiConnector.addCandidates).toHaveBeenCalledWith(
      'release-track--123',
      ['attack-pattern--1234']
    );
  });

  it('should preview and tag the latest draft release', () => {
    const refreshSpy = vi
      .spyOn(component, 'getReleaseTrack')
      .mockImplementation(() => undefined);
    const historySpy = vi
      .spyOn(component, 'getSnapshotHistory')
      .mockImplementation(() => undefined);
    mockReleaseTrackApiConnector.previewRelease.mockReturnValue(
      of({
        type: ReleaseTrackType.Standard,
        version: '1.2',
        before: {
          members_count: 10,
          staged_count: 3,
          candidates_count: 1,
        },
        after: {
          members_count: 13,
          staged_count: 0,
          candidates_count: 1,
        },
        changes: {
          promoted_count: 3,
        },
        conflicts: [],
      })
    );
    mockReleaseTrackApiConnector.releaseLatest.mockReturnValue(of({}));
    mockDialog.open
      .mockReturnValueOnce({
        afterClosed: () => of('minor'),
      })
      .mockReturnValueOnce({
        afterClosed: () => of('release'),
      });
    component.id = 'release-track--123';

    component.onPreviewRelease();

    expect(mockReleaseTrackApiConnector.previewRelease).toHaveBeenCalledWith(
      'release-track--123',
      { format: 'summary', increment: 'minor' }
    );
    expect(mockDialog.open).toHaveBeenCalledWith(
      MultipleChoiceDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Preview & release',
        }),
      })
    );
    expect(mockReleaseTrackApiConnector.releaseLatest).toHaveBeenCalledWith(
      'release-track--123',
      { increment: 'minor' }
    );
    expect(refreshSpy).toHaveBeenCalled();
    expect(historySpy).toHaveBeenCalled();
    expect(component.isReleasing).toBe(false);
  });

  it('should preview and tag a selected draft snapshot', () => {
    const refreshSpy = vi
      .spyOn(component, 'getReleaseTrack')
      .mockImplementation(() => undefined);
    const historySpy = vi
      .spyOn(component, 'getSnapshotHistory')
      .mockImplementation(() => undefined);
    mockReleaseTrackApiConnector.previewRelease.mockReturnValue(
      of({
        type: ReleaseTrackType.Standard,
        version: '2.0',
        before: {
          members_count: 10,
          staged_count: 3,
          candidates_count: 1,
        },
        after: {
          members_count: 13,
          staged_count: 0,
          candidates_count: 1,
        },
        changes: {
          promoted_count: 3,
        },
        conflicts: [],
      })
    );
    mockReleaseTrackApiConnector.releaseSnapshot.mockReturnValue(of({}));
    mockDialog.open
      .mockReturnValueOnce({
        afterClosed: () => of('major'),
      })
      .mockReturnValueOnce({
        afterClosed: () => of('release'),
      });
    component.id = 'release-track--123';

    component.onTagSnapshot({
      modified: '2026-07-23T13:37:28.000Z',
      isTagged: false,
    } as any);

    expect(mockReleaseTrackApiConnector.previewRelease).toHaveBeenCalledWith(
      'release-track--123',
      { format: 'summary', increment: 'major' },
      '2026-07-23T13:37:28.000Z'
    );
    expect(mockReleaseTrackApiConnector.releaseSnapshot).toHaveBeenCalledWith(
      'release-track--123',
      '2026-07-23T13:37:28.000Z',
      { increment: 'major' }
    );
    expect(mockReleaseTrackApiConnector.releaseLatest).not.toHaveBeenCalled();
    expect(refreshSpy).toHaveBeenCalled();
    expect(historySpy).toHaveBeenCalled();
  });

  it('should not tag a release when preview returns conflicts', () => {
    mockReleaseTrackApiConnector.previewRelease.mockReturnValue(
      of({
        type: ReleaseTrackType.Standard,
        version: '1.2',
        conflicts: [
          {
            object_ref: 'attack-pattern--123',
            incumbent_version: '2024-01-15T10:00:00Z',
            incoming_version: '2024-02-20T10:00:00Z',
          },
        ],
      })
    );
    mockDialog.open
      .mockReturnValueOnce({
        afterClosed: () => of('minor'),
      })
      .mockReturnValueOnce({});
    component.id = 'release-track--123';

    component.onPreviewRelease();

    expect(mockDialog.open).toHaveBeenCalledWith(
      MultipleChoiceDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Release conflicts detected',
        }),
      })
    );
    expect(mockReleaseTrackApiConnector.releaseLatest).not.toHaveBeenCalled();
  });

  it('should load release track config into the config form', () => {
    mockReleaseTrackApiConnector.getConfig.mockReturnValue(
      of({
        auto_promote: false,
        candidacy_threshold: 'awaiting-review',
        promotion_conflicts: {
          candidates_to_staged: 'always_reject',
          staged_to_members: 'abort',
        },
        member_sync: {
          strategy: 'track_latest',
          supplant: {
            behavior: 'queue',
            status_policy: 'reset',
          },
        },
        include_secondary_objects: {
          enabled: true,
          status_threshold: 'work-in-progress',
        },
      })
    );
    component.id = 'release-track--123';

    component.getConfig();

    expect(mockReleaseTrackApiConnector.getConfig).toHaveBeenCalledWith(
      'release-track--123'
    );
    expect(component.configForm.getRawValue()).toEqual(
      expect.objectContaining({
        autoPromote: false,
        candidacyThreshold: 'awaiting-review',
        memberSyncStrategy: 'track_latest',
        memberSyncSupplantBehavior: 'queue',
        memberSyncSupplantStatusPolicy: 'reset',
        candidatesToStagedConflict: 'always_reject',
        stagedToMembersConflict: 'abort',
        includeSecondaryObjects: true,
        secondaryObjectThreshold: 'work-in-progress',
      })
    );
    expect(component.configForm.get('candidacyThreshold')?.disabled).toBe(true);
  });

  it('should disable the secondary object threshold when secondary objects are not included', () => {
    mockReleaseTrackApiConnector.getConfig.mockReturnValue(
      of({
        include_secondary_objects: {
          enabled: false,
          status_threshold: 'awaiting-review',
        },
      })
    );
    component.id = 'release-track--123';

    component.getConfig();

    expect(component.configForm.getRawValue()).toEqual(
      expect.objectContaining({
        includeSecondaryObjects: false,
        secondaryObjectThreshold: 'awaiting-review',
      })
    );
    expect(component.configForm.get('secondaryObjectThreshold')?.disabled).toBe(
      true
    );

    component.configForm.patchValue({
      includeSecondaryObjects: true,
    });

    expect(component.configForm.get('secondaryObjectThreshold')?.enabled).toBe(
      true
    );
  });

  it('should save release track config and refresh state', () => {
    const refreshSpy = vi
      .spyOn(component, 'getReleaseTrack')
      .mockImplementation(() => undefined);
    const historySpy = vi
      .spyOn(component, 'getSnapshotHistory')
      .mockImplementation(() => undefined);
    mockReleaseTrackApiConnector.updateConfig.mockReturnValue(of({}));
    component.id = 'release-track--123';
    component.releaseTrack = { config: {} } as any;
    component.configForm.patchValue({
      autoPromote: true,
      candidacyThreshold: 'reviewed',
      memberSyncStrategy: MemberSyncStrategy.Manual,
      memberSyncSupplantBehavior: MemberSyncBehavior.Replace,
      memberSyncSupplantStatusPolicy: MemberSyncPolicy.Preserve,
      candidatesToStagedConflict: ConflictPolicy.PreferLatest,
      stagedToMembersConflict: ConflictPolicy.Abort,
      includeSecondaryObjects: false,
      secondaryObjectThreshold: 'reviewed',
    });
    component.isEditingConfig = true;

    component.onSaveConfig();

    expect(mockReleaseTrackApiConnector.updateConfig).toHaveBeenCalledWith(
      'release-track--123',
      {
        auto_promote: true,
        candidacy_threshold: 'reviewed',
        include_secondary_objects: {
          enabled: false,
          status_threshold: 'reviewed',
        },
        promotion_conflicts: {
          candidates_to_staged: 'prefer_latest',
          staged_to_members: 'abort',
        },
        member_sync: {
          strategy: 'manual',
          supplant: {
            behavior: 'replace',
            status_policy: 'preserve',
          },
        },
      }
    );
    expect(component.isEditingConfig).toBe(false);
    expect(refreshSpy).toHaveBeenCalled();
    expect(historySpy).toHaveBeenCalled();
  });

  it('should save release track config without a candidacy threshold when auto-promotion is off', () => {
    mockReleaseTrackApiConnector.updateConfig.mockReturnValue(of({}));
    component.id = 'release-track--123';
    component.releaseTrack = { config: {} } as any;
    component.configForm.patchValue({
      autoPromote: false,
      candidacyThreshold: 'reviewed',
      memberSyncStrategy: MemberSyncStrategy.Manual,
      memberSyncSupplantBehavior: MemberSyncBehavior.Replace,
      memberSyncSupplantStatusPolicy: MemberSyncPolicy.Preserve,
      candidatesToStagedConflict: ConflictPolicy.PreferLatest,
      stagedToMembersConflict: ConflictPolicy.Abort,
      includeSecondaryObjects: false,
      secondaryObjectThreshold: 'reviewed',
    });
    component.isEditingConfig = true;

    component.onSaveConfig();

    expect(mockReleaseTrackApiConnector.updateConfig).toHaveBeenCalledWith(
      'release-track--123',
      expect.not.objectContaining({
        candidacy_threshold: expect.anything(),
      })
    );
    expect(
      mockReleaseTrackApiConnector.updateConfig.mock.calls[0][1]
        .candidacy_threshold
    ).toBeUndefined();
  });

  it('should load virtual release track config from composition fields', () => {
    mockReleaseTrackApiConnector.getLatestSnapshot.mockReturnValue(
      of({
        type: ReleaseTrackType.Virtual,
        name: 'Virtual Release',
        composition: {
          component_tracks: [
            {
              track_id: 'release-track--component-one',
              resolution_strategy: 'latest_tagged',
              priority: 0,
            },
          ],
          deduplication: {
            strategy: DeduplicationStrategy.Quarantine,
            tier_resolution: SnapshotTier.Staged,
            status_resolution: 'awaiting-review',
          },
        },
        snapshot_schedule: {
          mode: SnapshotScheduleMode.Cron,
          cron: '0 0 1 1,7 *',
        },
        config: {},
      })
    );
    component.id = 'release-track--virtual';

    component.getReleaseTrack();

    expect(component.configForm.getRawValue()).toEqual(
      expect.objectContaining({
        virtualDeduplicationStrategy: DeduplicationStrategy.Quarantine,
        virtualDeduplicationTier: SnapshotTier.Staged,
        virtualDeduplicationStatus: 'awaiting-review',
        virtualSnapshotScheduleMode: SnapshotScheduleMode.Cron,
        virtualSnapshotScheduleCron: '0 0 1 1,7 *',
      })
    );
  });

  it('should save virtual release track composition config', () => {
    const refreshSpy = vi
      .spyOn(component, 'getReleaseTrack')
      .mockImplementation(() => undefined);
    const historySpy = vi
      .spyOn(component, 'getSnapshotHistory')
      .mockImplementation(() => undefined);
    mockReleaseTrackApiConnector.updateComposition.mockReturnValue(of({}));
    component.id = 'release-track--virtual';
    component.releaseTrack = {
      type: ReleaseTrackType.Virtual,
      composition: {
        component_tracks: [
          {
            track_id: 'release-track--component-one',
            resolution_strategy: 'latest_tagged',
          },
        ],
        deduplication: {
          strategy: DeduplicationStrategy.PrioritizeLatestObject,
        },
      },
    } as any;
    component.configForm.patchValue({
      virtualDeduplicationStrategy: DeduplicationStrategy.Quarantine,
      virtualDeduplicationTier: SnapshotTier.Staged,
      virtualDeduplicationStatus: 'reviewed',
    });
    component.onEditConfig();
    component.configForm.patchValue({
      virtualDeduplicationStrategy: DeduplicationStrategy.Quarantine,
      virtualDeduplicationTier: SnapshotTier.Staged,
      virtualDeduplicationStatus: 'reviewed',
    });

    component.onSaveConfig();

    expect(mockReleaseTrackApiConnector.updateComposition).toHaveBeenCalledWith(
      'release-track--virtual',
      {
        component_tracks: [
          {
            track_id: 'release-track--component-one',
            resolution_strategy: 'latest_tagged',
            priority: 0,
          },
        ],
        deduplication: {
          strategy: DeduplicationStrategy.Quarantine,
          tier_resolution: SnapshotTier.Staged,
          status_resolution: 'reviewed',
        },
      }
    );
    expect(mockReleaseTrackApiConnector.updateConfig).not.toHaveBeenCalled();
    expect(component.isEditingConfig).toBe(false);
    expect(refreshSpy).toHaveBeenCalled();
    expect(historySpy).toHaveBeenCalled();
  });

  it('should edit virtual release track component tracks', () => {
    mockReleaseTrackApiConnector.updateComposition.mockReturnValue(of({}));
    component.id = 'release-track--virtual';
    component.releaseTrack = {
      type: ReleaseTrackType.Virtual,
      composition: {
        component_tracks: [
          {
            track_id: 'release-track--component-one',
            resolution_strategy: 'latest_tagged',
            priority: 0,
          },
        ],
      },
    } as any;
    component.virtualComponentTrackOptions = [
      {
        trackId: 'release-track--component-one',
        name: 'Component One',
        description: '',
        latestTaggedVersion: '1.0',
        taggedReleaseCount: 1,
      },
      {
        trackId: 'release-track--component-two',
        name: 'Component Two',
        description: '',
        latestTaggedVersion: null,
        taggedReleaseCount: 0,
      },
    ];
    component.onEditConfig();

    expect(component.filteredVirtualComponentTrackOptions).toEqual([
      expect.objectContaining({
        trackId: 'release-track--component-two',
      }),
    ]);

    component.selectVirtualComponentTrack({
      option: {
        value: component.virtualComponentTrackOptions[1],
      },
    });
    component.setVirtualComponentTrackObjectTypes(
      component.virtualConfigComponentTracks[1],
      ['attack-pattern']
    );
    component.removeVirtualComponentTrack(
      component.virtualConfigComponentTracks[0]
    );

    component.onSaveConfig();

    expect(mockReleaseTrackApiConnector.updateComposition).toHaveBeenCalledWith(
      'release-track--virtual',
      expect.objectContaining({
        component_tracks: [
          {
            track_id: 'release-track--component-two',
            resolution_strategy: 'latest_tagged',
            priority: 0,
            filters: {
              object_types: ['attack-pattern'],
            },
          },
        ],
      })
    );
  });

  it('should split auto-promotion release tracks into workflow lanes', () => {
    component.releaseTrack = {
      config: { auto_promote: true },
      candidates: [
        {
          object_ref: 'attack-pattern--wip',
        },
        {
          object_ref: 'attack-pattern--candidate',
          object_status: 'awaiting-review',
        },
        {
          object_ref: 'attack-pattern--reviewed-candidate',
          object_status: 'reviewed',
        },
      ],
      staged: [
        {
          object_ref: 'attack-pattern--staged',
          object_status: 'reviewed',
        },
      ],
      members: [
        {
          object_ref: 'attack-pattern--member',
        },
      ],
    } as any;

    const lanes = component.workspaceLanes;

    expect(lanes.map(lane => lane.title)).toEqual([
      'Candidates WIP',
      'Candidates Awaiting Review',
      'Staged',
      'Released Members',
    ]);
    expect(lanes.map(lane => lane.items.map(item => item.object_ref))).toEqual([
      ['attack-pattern--wip'],
      ['attack-pattern--candidate'],
      ['attack-pattern--staged'],
      ['attack-pattern--member'],
    ]);
    expect(component.canReviewAndApprove(lanes[1].items[0], lanes[1])).toBe(
      true
    );
    expect(component.canManuallyPromote(lanes[0])).toBe(false);
    expect(lanes[3].isReleasedMembers).toBe(true);
  });

  it('should keep manual release tracks in candidate and staged lanes', () => {
    component.releaseTrack = {
      config: { auto_promote: false },
      candidates: [
        {
          object_ref: 'attack-pattern--candidate',
          object_status: 'awaiting-review',
        },
      ],
      staged: [
        {
          object_ref: 'attack-pattern--staged',
        },
      ],
      members: [],
    } as any;

    const lanes = component.workspaceLanes;

    expect(lanes.map(lane => lane.title)).toEqual([
      'Candidates',
      'Staged',
      'Released Members',
    ]);
    expect(lanes[0].items.map(item => item.object_ref)).toEqual([
      'attack-pattern--candidate',
    ]);
    expect(component.canManuallyPromote(lanes[0])).toBe(true);
    expect(component.canManuallyDemote(lanes[1])).toBe(true);
    expect(component.canReviewAndApprove(lanes[0].items[0], lanes[0])).toBe(
      false
    );
  });

  it('should hide released members until toggled open', () => {
    expect(component.showReleasedMembers).toBe(false);

    component.toggleReleasedMembers();

    expect(component.showReleasedMembers).toBe(true);
  });

  it('should update the release track description', () => {
    const refreshSpy = vi
      .spyOn(component, 'getReleaseTrack')
      .mockImplementation(() => undefined);
    mockReleaseTrackApiConnector.updateMetadataByLatest.mockReturnValue(of({}));
    component.id = 'release-track--123';
    component.releaseTrack = {
      name: 'Enterprise Release',
      description: 'Original description',
    } as any;

    component.onEditDescription();
    component.descriptionDraft = 'Updated description';
    component.onSaveDescription();

    expect(
      mockReleaseTrackApiConnector.updateMetadataByLatest
    ).toHaveBeenCalledWith('release-track--123', {
      description: 'Updated description',
    });
    expect(component.isEditingDescription).toBe(false);
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('should review and approve a single awaiting-review candidate', () => {
    const refreshSpy = vi
      .spyOn(component, 'getReleaseTrack')
      .mockImplementation(() => undefined);
    mockReleaseTrackApiConnector.reviewCandidates.mockReturnValue(of({}));
    component.id = 'release-track--123';

    component.onReviewAndApprove({
      object_ref: 'attack-pattern--123',
      object_modified: new Date('2024-04-20T00:00:00.000Z'),
    });

    expect(mockReleaseTrackApiConnector.reviewCandidates).toHaveBeenCalledWith(
      'release-track--123',
      {
        from: 'awaiting-review',
        to: 'reviewed',
        object_refs: [
          {
            id: 'attack-pattern--123',
            modified: '2024-04-20T00:00:00.000Z',
          },
        ],
      }
    );
    expect(refreshSpy).toHaveBeenCalled();
  });
});
