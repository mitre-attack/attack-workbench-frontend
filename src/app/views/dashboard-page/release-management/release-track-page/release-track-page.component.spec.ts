import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Clipboard } from '@angular/cdk/clipboard';

import { ReleaseTrackPageComponent } from './release-track-page.component';
import { ReleaseTracksConnectorService } from 'src/app/services/connectors/rest-api/release-tracks.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import {
  createAsyncObservable,
  createMockReleaseTrackApiConnector,
  createPaginatedResponse,
} from 'src/app/testing/mocks/rest-api-connector.mock';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BreadcrumbService } from 'src/app/services/helpers/breadcrumb.service';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { MultipleChoiceDialogComponent } from 'src/app/components/multiple-choice-dialog/multiple-choice-dialog.component';
import { AddDialogComponent } from 'src/app/components/add-dialog/add-dialog.component';
import { DeleteDialogComponent } from 'src/app/components/delete-dialog/delete-dialog.component';
import { ReleasePreviewDialogComponent } from 'src/app/components/release-preview-dialog/release-preview-dialog.component';
import { ConfirmationDialogComponent } from 'src/app/components/confirmation-dialog/confirmation-dialog.component';
import { SnapshotDescriptionDialogComponent } from 'src/app/components/snapshot-description-dialog/snapshot-description-dialog.component';
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
  let mockSnackbar: any;
  let mockClipboard: any;

  beforeEach(async () => {
    mockReleaseTrackApiConnector = createMockReleaseTrackApiConnector({
      getLatestSnapshot: vi.fn(() => createAsyncObservable(null)),
      listReleaseTracks: vi.fn(() => createAsyncObservable({ data: [] })),
      listSnapshots: vi.fn(() =>
        createAsyncObservable({
          data: [],
          pagination: { total: 0, limit: 50, offset: 0 },
        })
      ),
      exportLatestSnapshot: vi.fn(() => createAsyncObservable({})),
      exportSnapshotByModified: vi.fn(() => createAsyncObservable({})),
      retrieveSnapshotByModified: vi.fn(() => createAsyncObservable(null)),
      updateSnapshotDescription: vi.fn(() => createAsyncObservable({})),
      createVirtualSnapshot: vi.fn(() => createAsyncObservable({})),
      previewRelease: vi.fn(() => createAsyncObservable({})),
      releaseLatest: vi.fn(() => createAsyncObservable({})),
      releaseSnapshot: vi.fn(() => createAsyncObservable({})),
      createSnapshotGraph: vi.fn(() => createAsyncObservable({})),
      deleteSnapshotGraph: vi.fn(() => createAsyncObservable(undefined)),
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
    mockSnackbar = {
      open: vi.fn(),
    };
    mockClipboard = {
      copy: vi.fn(() => true),
    };
    mockRestApiConnector = {
      getAllObjects: vi.fn(() => of(createPaginatedResponse([]))),
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
          provide: MatSnackBar,
          useValue: mockSnackbar,
        },
        {
          provide: Clipboard,
          useValue: mockClipboard,
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

  it('should only show a diff for the latest pin when an object is both staged and a candidate', () => {
    const staged = {
      object_ref: 'attack-pattern--shared',
      object_modified: '2026-01-01T00:00:00.000Z',
    } as any;
    const candidate = {
      object_ref: 'attack-pattern--shared',
      object_modified: '2026-02-01T00:00:00.000Z',
    } as any;
    const unrelatedCandidate = {
      object_ref: 'attack-pattern--candidate-only',
      object_modified: '2026-01-01T00:00:00.000Z',
    } as any;
    component.releaseTrack = {
      staged: [staged],
      candidates: [candidate, unrelatedCandidate],
    } as any;

    expect(component.shouldShowDiff(staged)).toBe(false);
    expect(component.shouldShowDiff(candidate)).toBe(true);
    expect(component.shouldShowDiff(unrelatedCandidate)).toBe(true);
    expect(component.getDiffUnavailableMessage(staged)).toBe(
      'A newer revision of this object is available in the release track. View its diff instead.'
    );
    expect(component.getDiffUnavailableMessage(candidate)).toBeNull();
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
      afterClosed: () => of('bundle-stix-2.1'),
    });
    mockReleaseTrackApiConnector.exportLatestSnapshot.mockReturnValue(
      of(exportPayload)
    );
    component.id = 'release-track--123';
    component.releaseTrack = { name: 'Enterprise Release' } as any;

    component.onExport();

    const choices = mockDialog.open.mock.calls[0][1].data.choices;
    expect(mockDialog.open).toHaveBeenCalledWith(
      MultipleChoiceDialogComponent,
      expect.anything()
    );
    expect(choices.map((choice: any) => choice.value)).toEqual([
      'bundle-stix-2.0',
      'bundle-stix-2.1',
      'workbench',
    ]);
    expect(choices.map((choice: any) => choice.label)).toEqual([
      'Bundle (STIX 2.0)',
      'Bundle (STIX 2.1)',
      'Workbench',
    ]);
    expect(
      mockReleaseTrackApiConnector.exportLatestSnapshot
    ).toHaveBeenCalledWith('release-track--123', 'bundle', {
      include: 'all',
      stixVersion: '2.1',
    });
    expect(mockRestApiConnector.triggerBrowserDownload).toHaveBeenCalledWith(
      exportPayload,
      'enterprise-release-latest-bundle-stix-2.1.json'
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

  it('should export a standard draft snapshot with staged content', () => {
    const exportPayload = { type: 'bundle', objects: [] };
    mockDialog.open.mockReturnValue({
      afterClosed: () => of('bundle-stix-2.0'),
    });
    mockReleaseTrackApiConnector.exportSnapshotByModified.mockReturnValue(
      of(exportPayload)
    );
    component.id = 'release-track--123';
    component.releaseTrack = {
      name: 'Enterprise Release',
      type: ReleaseTrackType.Standard,
    } as any;

    component.onExportSnapshot({
      snapshot: {
        modified: '2024-05-21T07:00:00.000Z',
        type: ReleaseTrackType.Standard,
        version: null,
      },
      title: 'Draft Snapshot',
      created: new Date('2024-05-21T07:00:00.000Z'),
      modified: '2024-05-21T07:00:00.000Z',
      taggedAt: null,
      isTagged: false,
      stats: [],
      addedCount: 0,
      modifiedCount: 0,
      totalObjects: 0,
    } as any);

    expect(
      mockReleaseTrackApiConnector.exportSnapshotByModified
    ).toHaveBeenCalledWith(
      'release-track--123',
      '2024-05-21T07:00:00.000Z',
      'bundle',
      { include: 'staged', stixVersion: '2.0' }
    );
    expect(mockRestApiConnector.triggerBrowserDownload).toHaveBeenCalledWith(
      exportPayload,
      'enterprise-release-draft-bundle-stix-2.0.json'
    );
  });

  it.each([
    ['2.0', 'bundle-stix-2.0'],
    ['2.1', 'bundle-stix-2.1'],
  ] as const)(
    'should export a cached tagged standard snapshot as STIX %s without staged content',
    (stixVersion, choice) => {
      mockDialog.open.mockReturnValue({
        afterClosed: () => of(choice),
      });
      mockReleaseTrackApiConnector.exportSnapshotByModified.mockReturnValue(
        of({ type: 'bundle', objects: [] })
      );
      component.id = 'release-track--123';
      component.releaseTrack = {
        name: 'Enterprise Release',
        type: ReleaseTrackType.Standard,
      } as any;

      component.onExportSnapshot({
        snapshot: {
          modified: '2024-04-15T06:00:00.000Z',
          type: ReleaseTrackType.Standard,
          version: '1.3',
          snapshot_description: 'Published analyst context',
        },
        title: 'v1.3',
        created: new Date('2024-04-15T06:00:00.000Z'),
        modified: '2024-04-15T06:00:00.000Z',
        taggedAt: new Date('2024-04-15T06:30:00.000Z'),
        isTagged: true,
        isBundleCached: true,
        stats: [],
        addedCount: 0,
        modifiedCount: 0,
        totalObjects: 0,
      } as any);

      expect(
        mockReleaseTrackApiConnector.exportSnapshotByModified
      ).toHaveBeenCalledWith(
        'release-track--123',
        '2024-04-15T06:00:00.000Z',
        'bundle',
        { stixVersion }
      );
      expect(mockRestApiConnector.triggerBrowserDownload).toHaveBeenCalledWith(
        { type: 'bundle', objects: [] },
        `enterprise-release-v1.3-bundle-stix-${stixVersion}.json`
      );
    }
  );

  it('should export a virtual draft snapshot without staged content', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of('bundle-stix-2.0'),
    });
    mockReleaseTrackApiConnector.exportSnapshotByModified.mockReturnValue(
      of({ type: 'bundle', objects: [] })
    );
    component.id = 'release-track--virtual';
    component.releaseTrack = {
      type: ReleaseTrackType.Virtual,
    } as any;

    component.onExportSnapshot({
      snapshot: {
        modified: '2024-05-21T07:00:00.000Z',
        type: ReleaseTrackType.Virtual,
        version: null,
      },
      title: 'Draft Snapshot',
      created: new Date('2024-05-21T07:00:00.000Z'),
      modified: '2024-05-21T07:00:00.000Z',
      taggedAt: null,
      isTagged: false,
      stats: [],
      addedCount: 0,
      modifiedCount: 0,
      totalObjects: 0,
    } as any);

    expect(
      mockReleaseTrackApiConnector.exportSnapshotByModified
    ).toHaveBeenCalledWith(
      'release-track--virtual',
      '2024-05-21T07:00:00.000Z',
      'bundle',
      { stixVersion: '2.0' }
    );
  });

  it('should export a snapshot in workbench format with all tiers', () => {
    const exportPayload = { id: 'release-track--123', members: [] };
    mockDialog.open.mockReturnValue({
      afterClosed: () => of('workbench'),
    });
    mockReleaseTrackApiConnector.exportSnapshotByModified.mockReturnValue(
      of(exportPayload)
    );
    component.id = 'release-track--123';
    component.releaseTrack = {
      name: 'Enterprise Release',
      type: ReleaseTrackType.Standard,
    } as any;

    component.onExportSnapshot({
      snapshot: {
        modified: '2024-05-21T07:00:00.000Z',
        type: ReleaseTrackType.Standard,
        version: null,
      },
      title: 'Draft Snapshot',
      created: new Date('2024-05-21T07:00:00.000Z'),
      modified: '2024-05-21T07:00:00.000Z',
      taggedAt: null,
      isTagged: false,
      stats: [],
      addedCount: 0,
      modifiedCount: 0,
      totalObjects: 0,
    } as any);

    expect(
      mockReleaseTrackApiConnector.exportSnapshotByModified
    ).toHaveBeenCalledWith(
      'release-track--123',
      '2024-05-21T07:00:00.000Z',
      'workbench',
      { include: 'all' }
    );
    expect(mockRestApiConnector.triggerBrowserDownload).toHaveBeenCalledWith(
      exportPayload,
      'enterprise-release-draft-workbench.json'
    );
  });

  it('should copy a concise snapshot summary without requesting an export', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of('copy-summary'),
    });
    component.id = 'release-track--123';
    component.releaseTrack = {
      name: 'Enterprise Release',
      type: ReleaseTrackType.Standard,
    } as any;

    component.onExportSnapshot({
      snapshot: {
        id: 'release-track--123',
        name: 'Enterprise Release',
        modified: '2024-04-15T06:00:00.000Z',
        type: ReleaseTrackType.Standard,
        version: '1.3',
        snapshot_description: 'Published analyst context',
        members_count: 120,
        staged_count: 4,
        candidates_count: 9,
        graph_manifest_id: 'release-track-graph-manifest--cached',
        graph_statistics: {
          primary_count: 120,
          secondary_count: 18,
          relationship_count: 42,
          supporting_count: 3,
          link_target_count: 2,
          total_count: 185,
        },
      },
      title: 'v1.3',
      created: new Date('2024-04-15T06:00:00.000Z'),
      modified: '2024-04-15T06:00:00.000Z',
      taggedAt: new Date('2024-04-15T06:30:00.000Z'),
      isTagged: true,
      isLatest: false,
      isBundleCached: true,
      stats: [],
      graphCacheStats: [],
      graphCacheTotal: 185,
      addedCount: 0,
      modifiedCount: 0,
      totalObjects: 120,
    } as any);

    const choices = mockDialog.open.mock.calls[0][1].data.choices;
    expect(choices.map((choice: any) => choice.value)).toEqual([
      'bundle-stix-2.0',
      'bundle-stix-2.1',
      'workbench',
      'copy-summary',
    ]);
    expect(choices.map((choice: any) => choice.label)).toEqual([
      'Bundle (STIX 2.0)',
      'Bundle (STIX 2.1)',
      'Workbench',
      'Summary',
    ]);
    expect(
      mockReleaseTrackApiConnector.exportSnapshotByModified
    ).not.toHaveBeenCalled();
    expect(mockClipboard.copy).toHaveBeenCalledOnce();
    expect(JSON.parse(mockClipboard.copy.mock.calls[0][0])).toEqual({
      id: 'release-track--123',
      name: 'Enterprise Release',
      type: 'standard',
      version: '1.3',
      notes: 'Published analyst context',
      modified: '2024-04-15T06:00:00.000Z',
      tagged: true,
      latest: false,
      counts: {
        members: 120,
        staged: 4,
        candidates: 9,
      },
      graph_cache: {
        cached: true,
        manifest_id: 'release-track-graph-manifest--cached',
        statistics: {
          primary_count: 120,
          secondary_count: 18,
          relationship_count: 42,
          supporting_count: 3,
          link_target_count: 2,
          total_count: 185,
        },
      },
    });
    expect(mockSnackbar.open).toHaveBeenCalledWith(
      'Snapshot summary copied to the clipboard.',
      null,
      { duration: 3000 }
    );
  });

  it('should report when a snapshot summary cannot be copied', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of('copy-summary'),
    });
    mockClipboard.copy.mockReturnValue(false);
    component.id = 'release-track--123';

    component.onExportSnapshot({
      snapshot: {
        modified: '2024-05-21T07:00:00.000Z',
        type: ReleaseTrackType.Virtual,
        version: null,
        members_count: 8,
        quarantine_count: 2,
      },
      title: 'Draft Snapshot',
      modified: '2024-05-21T07:00:00.000Z',
      isTagged: false,
      isLatest: true,
      isBundleCached: false,
    } as any);

    expect(mockSnackbar.open).toHaveBeenCalledWith(
      'Unable to copy the snapshot summary.',
      null,
      { duration: 5000, panelClass: 'error' }
    );
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

  it('should load release track summary when latest snapshot is unavailable', () => {
    mockReleaseTrackApiConnector.getLatestSnapshot.mockReturnValue(of(null));
    mockReleaseTrackApiConnector.listReleaseTracks.mockReturnValue(
      of({
        data: [
          {
            track_id: 'release-track--virtual',
            type: ReleaseTrackType.Virtual,
            name: 'Virtual Release',
            composition: {
              component_tracks: [{ track_id: 'release-track--standard' }],
            },
          },
        ],
      })
    );
    component.id = 'release-track--virtual';

    component.getReleaseTrack();

    expect(component.releaseTrack?.name).toBe('Virtual Release');
    expect(component.canCreateDraft).toBe(true);
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
              domains: ['enterprise-attack'],
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
    ).toEqual(['attack pattern', 'enterprise']);
    expect(
      component.getVirtualComponentTrackDomains(
        component.virtualComponentTracks[0]
      )
    ).toEqual(['enterprise']);
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

  it('should load snapshot history from summary counts', () => {
    mockReleaseTrackApiConnector.listSnapshots.mockReturnValue(
      of({
        data: [
          {
            id: 'release-track--123',
            modified: '2024-05-21T07:00:00.000Z',
            version: null,
            type: ReleaseTrackType.Standard,
            name: 'Enterprise',
            added_count: 2,
            modified_count: 1,
            candidates_count: 4,
            staged_count: 3,
            members_count: 20,
          },
          {
            id: 'release-track--456',
            version: '1.3',
            graph_manifest_id: 'release-track-graph-manifest--cached',
            tagged_at: '2024-04-15T06:30:00.000Z',
            modified: '2024-04-15T06:00:00.000Z',
            type: ReleaseTrackType.Virtual,
            name: 'Combined',
            members_count: 5,
            quarantine_count: 1,
            graph_statistics: {
              primary_count: 5,
              secondary_count: 8,
              relationship_count: 12,
              supporting_count: 2,
              link_target_count: 1,
              total_count: 28,
            },
          },
        ],
        pagination: { total: 2, limit: 50, offset: 0 },
      })
    );
    component.id = 'release-track--123';

    component.getSnapshotHistory();

    expect(mockReleaseTrackApiConnector.listSnapshots).toHaveBeenCalledWith(
      'release-track--123'
    );
    expect(component.snapshotHistory[0]).toEqual(
      expect.objectContaining({
        title: 'Draft Snapshot',
        addedCount: 2,
        modifiedCount: 1,
        totalObjects: 27,
        isTagged: false,
        isBundleCached: false,
        canCacheBundle: false,
        stats: [
          expect.objectContaining({ label: 'Added', value: '+2' }),
          expect.objectContaining({ label: 'Modified', value: 1 }),
          expect.objectContaining({ label: 'Candidates', value: 4 }),
          expect.objectContaining({ label: 'Staged', value: 3 }),
          expect.objectContaining({ label: 'Members', value: 20 }),
        ],
      })
    );
    expect(component.snapshotHistory[1]).toEqual(
      expect.objectContaining({
        title: 'v1.3',
        addedCount: 0,
        modifiedCount: 0,
        totalObjects: 6,
        taggedAt: new Date('2024-04-15T06:30:00.000Z'),
        isTagged: true,
        isBundleCached: true,
        canCacheBundle: false,
        graphCacheTotal: 28,
        graphCacheStats: [
          expect.objectContaining({ label: 'Primary', value: 5 }),
          expect.objectContaining({ label: 'Secondary', value: 8 }),
          expect.objectContaining({ label: 'Relationships', value: 12 }),
          expect.objectContaining({ label: 'Dependencies', value: 3 }),
        ],
        stats: [
          expect.objectContaining({ label: 'Members', value: 5 }),
          expect.objectContaining({ label: 'Quarantine', value: 1 }),
        ],
      })
    );
    expect(component.taggedSnapshotCount).toBe(1);
    expect(component.hasCurrentDraftSnapshot).toBe(true);
  });

  it('should explain cached, uncached, and draft bundle states', () => {
    const cached = {
      isTagged: true,
      isBundleCached: true,
    } as any;
    const uncached = {
      isTagged: true,
      isBundleCached: false,
    } as any;
    const draft = {
      isTagged: false,
      isBundleCached: false,
    } as any;

    expect(component.getBundleCacheTooltip(cached)).toContain(
      'repeated exports are deterministic'
    );
    expect(component.getBundleCacheTooltip(uncached)).toContain(
      'not guaranteed to be deterministic'
    );
    expect(component.getBundleCacheTooltip(draft)).toContain(
      'Tag this snapshot before caching it'
    );
  });

  it('should cache a tagged snapshot and update its history state', () => {
    const item = {
      snapshot: {},
      title: 'v1.0',
      modified: '2026-07-23T13:37:28.000Z',
      isTagged: true,
      isBundleCached: false,
      canCacheBundle: true,
      stats: [],
    } as any;
    mockReleaseTrackApiConnector.createSnapshotGraph.mockReturnValue(
      of({
        modified: item.modified,
        version: '1.0',
        graph_manifest_id: 'release-track-graph-manifest--cached',
        bundle_hashes: {
          manifest_id: 'release-track-graph-manifest--cached',
          stix_2_0: 'a'.repeat(64),
          stix_2_1: 'b'.repeat(64),
        },
      })
    );
    component.id = 'release-track--123';

    component.onCacheSnapshotBundle(item);

    expect(
      mockReleaseTrackApiConnector.createSnapshotGraph
    ).toHaveBeenCalledWith('release-track--123', item.modified);
    expect(item.snapshot.graph_manifest_id).toBe(
      'release-track-graph-manifest--cached'
    );
    expect(component.getSnapshotBundleHash(item, '2.0')).toBe('a'.repeat(64));
    expect(component.getSnapshotBundleHash(item, '2.1')).toBe('b'.repeat(64));
    expect(item.isBundleCached).toBe(true);
    expect(item.canCacheBundle).toBe(false);
    expect(mockReleaseTrackApiConnector.listSnapshots).toHaveBeenCalledWith(
      'release-track--123'
    );
    expect(mockSnackbar.open).toHaveBeenCalledWith(
      'Bundle cached. Member-only bundle exports are now deterministic.',
      null,
      expect.objectContaining({ duration: 5000 })
    );
    expect(component.isCachingSnapshot(item)).toBe(false);
  });

  it('should expose cache materialization as in progress until it completes', () => {
    const graphResult = new Subject<any>();
    const item = {
      snapshot: {},
      title: 'v1.0',
      modified: '2026-07-23T13:37:28.000Z',
      isTagged: true,
      isBundleCached: false,
      canCacheBundle: true,
      stats: [],
    } as any;
    mockReleaseTrackApiConnector.createSnapshotGraph.mockReturnValue(
      graphResult
    );
    component.id = 'release-track--123';

    component.onCacheSnapshotBundle(item);

    expect(component.isCachingSnapshot(item)).toBe(true);

    graphResult.next({
      modified: item.modified,
      version: '1.0',
      graph_manifest_id: 'release-track-graph-manifest--cached',
    });
    graphResult.complete();

    expect(component.isCachingSnapshot(item)).toBe(false);
  });

  it('should edit notes on a snapshot without a bundle cache', () => {
    const modified = '2026-07-23T13:37:28.000Z';
    const item = {
      snapshot: {
        snapshot_description: 'Original context',
      },
      title: 'v1.0',
      modified,
      isTagged: true,
      isBundleCached: false,
    } as any;
    mockDialog.open.mockReturnValue({
      afterClosed: () => of('Updated analyst context'),
    });
    mockReleaseTrackApiConnector.updateSnapshotDescription.mockReturnValue(
      of({
        modified,
        snapshot_description: 'Updated analyst context',
      })
    );
    component.id = 'release-track--123';
    component.releaseTrack = {
      modified: new Date(modified),
      snapshot_description: 'Original context',
    } as any;

    component.onEditSnapshotDescription(item);

    expect(mockDialog.open).toHaveBeenCalledWith(
      SnapshotDescriptionDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Edit snapshot notes',
          description: 'Original context',
        }),
      })
    );
    expect(
      mockReleaseTrackApiConnector.updateSnapshotDescription
    ).toHaveBeenCalledWith('release-track--123', modified, {
      description: 'Updated analyst context',
    });
    expect(item.modified).toBe(modified);
    expect(item.snapshot.snapshot_description).toBe('Updated analyst context');
    expect(component.releaseTrack?.snapshot_description).toBe(
      'Updated analyst context'
    );
    expect(component.isUpdatingSnapshotDescription(item)).toBe(false);
    expect(mockSnackbar.open).toHaveBeenCalledWith(
      'Snapshot notes saved.',
      null,
      { duration: 3000 }
    );
  });

  it('should not open the notes editor for a cached snapshot', () => {
    const item = {
      snapshot: {
        graph_manifest_id: 'release-track-graph-manifest--cached',
        snapshot_description: 'Frozen release notes',
      },
      title: 'v1.0',
      modified: '2026-07-23T13:37:28.000Z',
      isTagged: true,
      isBundleCached: true,
    } as any;
    component.id = 'release-track--123';

    component.onEditSnapshotDescription(item);

    expect(mockDialog.open).not.toHaveBeenCalled();
    expect(
      mockReleaseTrackApiConnector.updateSnapshotDescription
    ).not.toHaveBeenCalled();
  });

  it('should copy a server-provided bundle hash to the clipboard', () => {
    const modified = '2026-07-23T13:37:28.000Z';
    const item = {
      snapshot: {
        graph_manifest_id: 'release-track-graph-manifest--cached',
        bundle_hashes: {
          manifest_id: 'release-track-graph-manifest--cached',
          stix_2_0: 'a'.repeat(64),
          stix_2_1: 'b'.repeat(64),
        },
      },
      title: 'v1.0',
      modified,
      isTagged: true,
    } as any;

    component.copySnapshotBundleHash(item, '2.1');

    expect(mockClipboard.copy).toHaveBeenCalledWith('b'.repeat(64));
    expect(mockSnackbar.open).toHaveBeenCalledWith(
      'STIX 2.1 bundle SHA-256 copied to the clipboard.',
      null,
      { duration: 3000 }
    );
  });

  it('should delete a cached snapshot graph after confirmation', () => {
    const item = {
      snapshot: {
        graph_manifest_id: 'release-track-graph-manifest--cached',
        graph_statistics: { total_count: 28 },
        bundle_hashes: {
          manifest_id: 'release-track-graph-manifest--cached',
          stix_2_0: 'a'.repeat(64),
          stix_2_1: 'b'.repeat(64),
        },
      },
      title: 'v1.0',
      modified: '2026-07-23T13:37:28.000Z',
      isTagged: true,
      isBundleCached: true,
      canCacheBundle: false,
      graphCacheStats: [{ label: 'Primary', value: 5 }],
      graphCacheTotal: 28,
      stats: [],
    } as any;
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(true),
    });
    mockReleaseTrackApiConnector.deleteSnapshotGraph.mockReturnValue(
      of(undefined)
    );
    component.id = 'release-track--123';

    component.onDeleteSnapshotCache(item);

    expect(mockDialog.open).toHaveBeenCalledWith(
      ConfirmationDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Delete bundle cache?',
          confirm_color: 'warn',
        }),
      })
    );
    expect(
      mockReleaseTrackApiConnector.deleteSnapshotGraph
    ).toHaveBeenCalledWith('release-track--123', item.modified);
    expect(item.snapshot.graph_manifest_id).toBeUndefined();
    expect(item.snapshot.graph_statistics).toBeUndefined();
    expect(item.snapshot.bundle_hashes).toBeUndefined();
    expect(item.isBundleCached).toBe(false);
    expect(item.canCacheBundle).toBe(true);
    expect(item.graphCacheStats).toEqual([]);
    expect(item.graphCacheTotal).toBe(0);
    expect(mockReleaseTrackApiConnector.listSnapshots).toHaveBeenCalledWith(
      'release-track--123'
    );
    expect(mockSnackbar.open).toHaveBeenCalledWith(
      'Bundle cache deleted. Member-only bundle exports are no longer guaranteed to be deterministic.',
      null,
      expect.objectContaining({ duration: 5000 })
    );
    expect(component.isDeletingSnapshotCache(item)).toBe(false);
  });

  it('should use latest snapshot summary counts for the latest history row', () => {
    component.releaseTrack = {
      modified: new Date('2024-05-21T07:00:00.000Z'),
      type: ReleaseTrackType.Standard,
      summary: {
        added_count: 5,
        modified_count: 2,
      },
    } as any;
    mockReleaseTrackApiConnector.listSnapshots.mockReturnValue(
      of([
        {
          modified: '2024-05-21T07:00:00.000Z',
          version: null,
          type: ReleaseTrackType.Standard,
          is_latest: true,
          candidates_count: 1,
          staged_count: 2,
          members_count: 3,
        },
      ])
    );
    component.id = 'release-track--123';

    component.getSnapshotHistory();

    expect(component.snapshotHistory[0].stats).toEqual([
      expect.objectContaining({ label: 'Added', value: '+5' }),
      expect.objectContaining({ label: 'Modified', value: 2 }),
      expect.objectContaining({ label: 'Candidates', value: 1 }),
      expect.objectContaining({ label: 'Staged', value: 2 }),
      expect.objectContaining({ label: 'Members', value: 3 }),
    ]);
  });

  it('should only mark the latest draft snapshot as current', () => {
    mockReleaseTrackApiConnector.listSnapshots.mockReturnValue(
      of([
        {
          modified: '2024-05-21T07:00:00.000Z',
          version: null,
          type: ReleaseTrackType.Standard,
        },
        {
          modified: '2024-05-20T07:00:00.000Z',
          version: null,
          type: ReleaseTrackType.Standard,
        },
        {
          modified: '2024-05-19T07:00:00.000Z',
          version: '1.0',
          type: ReleaseTrackType.Standard,
        },
      ])
    );
    component.id = 'release-track--123';

    component.getSnapshotHistory();

    expect(component.snapshotHistory[0]).toEqual(
      expect.objectContaining({
        modified: '2024-05-21T07:00:00.000Z',
        isTagged: false,
        isLatest: true,
        isCurrentDraft: true,
      })
    );
    expect(component.snapshotHistory[1]).toEqual(
      expect.objectContaining({
        modified: '2024-05-20T07:00:00.000Z',
        isTagged: false,
        isLatest: false,
        isCurrentDraft: false,
      })
    );
    expect(component.snapshotHistory[2]).toEqual(
      expect.objectContaining({
        modified: '2024-05-19T07:00:00.000Z',
        isTagged: true,
        isLatest: false,
        isCurrentDraft: false,
      })
    );
    expect(component.hasCurrentDraftSnapshot).toBe(true);
  });

  it('should mark a tagged current snapshot as latest', () => {
    mockReleaseTrackApiConnector.listSnapshots.mockReturnValue(
      of([
        {
          modified: '2024-05-21T07:00:00.000Z',
          version: '1.1',
          type: ReleaseTrackType.Standard,
        },
        {
          modified: '2024-05-20T07:00:00.000Z',
          version: null,
          type: ReleaseTrackType.Standard,
        },
      ])
    );
    component.id = 'release-track--123';

    component.getSnapshotHistory();

    expect(component.snapshotHistory[0]).toEqual(
      expect.objectContaining({
        modified: '2024-05-21T07:00:00.000Z',
        isTagged: true,
        isLatest: true,
        isCurrentDraft: false,
      })
    );
    expect(component.snapshotHistory[1]).toEqual(
      expect.objectContaining({
        modified: '2024-05-20T07:00:00.000Z',
        isTagged: false,
        isLatest: false,
        isCurrentDraft: false,
      })
    );
    expect(component.hasCurrentDraftSnapshot).toBe(false);
  });

  it('should create a draft snapshot and refresh the release track', () => {
    const refreshSpy = vi
      .spyOn(component, 'getReleaseTrack')
      .mockImplementation(() => undefined);
    const historySpy = vi
      .spyOn(component, 'getSnapshotHistory')
      .mockImplementation(() => undefined);
    mockDialog.open.mockReturnValue({
      afterClosed: () => of('Draft analyst context'),
    });
    mockReleaseTrackApiConnector.createVirtualSnapshot.mockReturnValue(
      of({
        stix: {
          modified: '2024-05-21T07:00:00.000Z',
          x_mitre_version: null,
        },
        members: [{ object_ref: 'attack-pattern--member' }],
        quarantine: [{ object_ref: 'attack-pattern--quarantined' }],
      })
    );
    component.id = 'release-track--123';
    component.releaseTrack = {
      type: ReleaseTrackType.Virtual,
      name: 'Virtual Release',
      composition: {
        component_tracks: [{ track_id: 'release-track--standard' }],
      },
    } as any;

    component.onDraft();

    expect(mockDialog.open).toHaveBeenCalledWith(
      SnapshotDescriptionDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Create draft snapshot',
          message: expect.stringContaining(
            'Create a copy of the latest snapshot for Virtual Release'
          ),
          confirmLabel: 'Create draft',
        }),
      })
    );
    expect(
      mockReleaseTrackApiConnector.createVirtualSnapshot
    ).toHaveBeenCalledWith('release-track--123', {
      description: 'Draft analyst context',
    });
    expect(refreshSpy).toHaveBeenCalled();
    expect(historySpy).toHaveBeenCalled();
    expect(component.hasCurrentDraftSnapshot).toBe(true);
    expect(component.snapshotHistory[0]).toEqual(
      expect.objectContaining({
        title: 'Draft Snapshot',
        totalObjects: 2,
        isTagged: false,
      })
    );
    expect(component.snapshotHistory[0].stats).toEqual([
      expect.objectContaining({ label: 'Members', value: 1 }),
      expect.objectContaining({ label: 'Quarantine', value: 1 }),
    ]);
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

  it('should not create a draft snapshot for a virtual track without components', () => {
    component.id = 'release-track--123';
    component.releaseTrack = {
      type: ReleaseTrackType.Virtual,
      composition: {
        component_tracks: [],
      },
    } as any;

    component.onDraft();

    expect(mockDialog.open).not.toHaveBeenCalled();
    expect(
      mockReleaseTrackApiConnector.createVirtualSnapshot
    ).not.toHaveBeenCalled();
  });

  it('should exclude current candidates from the all objects table', () => {
    const candidateId = 'attack-pattern--candidate';
    const stagedId = 'attack-pattern--staged';
    mockDialog.open.mockImplementation((_component: any, config: any) => {
      config.data.select.select('attack-pattern--1234');
      return {
        afterClosed: () => of(true),
      };
    });
    mockReleaseTrackApiConnector.addCandidates.mockReturnValue(of({}));
    component.id = 'release-track--123';
    component.releaseTrack = {
      id: 'release-track--123',
      candidates: [{ object_ref: candidateId }],
      staged: [{ object_ref: stagedId }],
    } as any;

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
            excludeIDs: [candidateId],
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
    component.releaseTrack = {
      id: 'release-track--123',
      name: 'Core Objects',
      version: null,
      members: [],
      staged: [],
      candidates: [
        {
          object_ref: 'attack-pattern--candidate',
          name: 'Canonical Candidate',
          attack_type: 'technique',
          x_mitre_version: '2.1',
          object_status: 'awaiting-review',
        },
      ],
    } as any;
    mockDialog.open.mockReturnValue({
      afterClosed: () =>
        of({ increment: 'minor', description: 'First release context' }),
    });
    component.id = 'release-track--123';

    component.onPreviewRelease();

    expect(mockReleaseTrackApiConnector.previewRelease).toHaveBeenCalledWith(
      'release-track--123',
      { format: 'summary', increment: 'minor' }
    );
    expect(mockRestApiConnector.getAllObjects).toHaveBeenCalledWith({
      revoked: true,
      deprecated: true,
      versions: 'all',
    });
    expect(mockDialog.open).toHaveBeenCalledWith(
      ReleasePreviewDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          track: expect.objectContaining({
            id: 'release-track--123',
            candidates: [
              expect.objectContaining({
                name: 'Canonical Candidate',
                attack_type: 'technique',
                x_mitre_version: '2.1',
                object_status: 'awaiting-review',
              }),
            ],
          }),
        }),
      })
    );
    expect(mockReleaseTrackApiConnector.releaseLatest).toHaveBeenCalledWith(
      'release-track--123',
      { increment: 'minor', description: 'First release context' }
    );
    expect(refreshSpy).toHaveBeenCalled();
    expect(historySpy).toHaveBeenCalled();
    expect(component.isReleasing).toBe(false);
  });

  it('should tag the selected draft snapshot from history', () => {
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
    mockReleaseTrackApiConnector.retrieveSnapshotByModified.mockReturnValue(
      of({
        id: 'release-track--123',
        members: [
          {
            object_ref: 'malware--replacement',
            object_modified: '2026-07-01T12:00:00.000Z',
          },
        ],
        staged: [
          {
            object_ref: 'malware--replacement',
            object_modified: '2026-07-23T12:00:00.000Z',
          },
        ],
        candidates: [],
      })
    );
    mockRestApiConnector.getAllObjects.mockReturnValue(
      of(
        createPaginatedResponse([
          {
            workspace: { attack_id: 'S0001' },
            stix: {
              id: 'malware--replacement',
              modified: '2026-07-01T12:00:00.000Z',
              name: 'Replacement Example',
              type: 'malware',
              x_mitre_version: '1.0',
            },
          },
          {
            workspace: { attack_id: 'S0001' },
            stix: {
              id: 'malware--replacement',
              modified: '2026-07-23T12:00:00.000Z',
              name: 'Replacement Example',
              type: 'malware',
              x_mitre_version: '1.1',
            },
          },
        ])
      )
    );
    mockDialog.open.mockReturnValue({
      afterClosed: () =>
        of({ version: '1.5', description: 'Exact release context' }),
    });
    component.id = 'release-track--123';

    component.onTagSnapshot({
      modified: '2026-07-23T13:37:28.000Z',
      isTagged: false,
      snapshot: {},
    } as any);

    expect(mockReleaseTrackApiConnector.previewRelease).toHaveBeenCalledWith(
      'release-track--123',
      { format: 'summary', increment: 'minor' },
      '2026-07-23T13:37:28.000Z'
    );
    expect(
      mockReleaseTrackApiConnector.retrieveSnapshotByModified
    ).toHaveBeenCalledWith('release-track--123', '2026-07-23T13:37:28.000Z', {
      format: 'workbench',
      include: 'all',
    });
    expect(mockRestApiConnector.getAllObjects).toHaveBeenCalledWith({
      revoked: true,
      deprecated: true,
      versions: 'all',
    });
    expect(mockDialog.open).toHaveBeenCalledWith(
      ReleasePreviewDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          track: expect.objectContaining({
            members: [
              expect.objectContaining({
                x_mitre_version: '1.0',
              }),
            ],
            staged: [
              expect.objectContaining({
                x_mitre_version: '1.1',
              }),
            ],
          }),
        }),
      })
    );
    expect(mockReleaseTrackApiConnector.releaseSnapshot).toHaveBeenCalledWith(
      'release-track--123',
      '2026-07-23T13:37:28.000Z',
      { version: '1.5', description: 'Exact release context' }
    );
    expect(mockReleaseTrackApiConnector.releaseLatest).not.toHaveBeenCalled();
    expect(refreshSpy).toHaveBeenCalled();
    expect(historySpy).toHaveBeenCalled();
    expect(component.isReleasing).toBe(false);
  });

  it('should preview the newest draft when multiple drafts exist', () => {
    mockReleaseTrackApiConnector.previewRelease.mockReturnValue(
      of({ version: '1.1', conflicts: [] })
    );
    mockReleaseTrackApiConnector.retrieveSnapshotByModified.mockReturnValue(
      of({
        id: 'release-track--123',
        modified: '2026-07-30T14:00:00.000Z',
        members: [],
        staged: [],
        candidates: [],
      })
    );
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(undefined),
    });
    component.id = 'release-track--123';
    component.releaseTrack = {
      id: 'release-track--123',
      version: null,
    } as any;
    component.snapshotHistory = [
      {
        modified: '2026-07-30T14:00:00.000Z',
        isTagged: false,
      },
      {
        modified: '2026-07-29T14:00:00.000Z',
        isTagged: false,
      },
    ] as any;

    component.onPreviewRelease();

    expect(mockReleaseTrackApiConnector.previewRelease).toHaveBeenCalledWith(
      'release-track--123',
      { format: 'summary', increment: 'minor' },
      '2026-07-30T14:00:00.000Z'
    );
    expect(
      mockReleaseTrackApiConnector.retrieveSnapshotByModified
    ).toHaveBeenCalledWith('release-track--123', '2026-07-30T14:00:00.000Z', {
      format: 'workbench',
      include: 'all',
    });
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
    component.releaseTrack = {
      id: 'release-track--123',
      members: [],
      staged: [],
      candidates: [],
    } as any;
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(undefined),
    });
    component.id = 'release-track--123';

    component.onPreviewRelease();

    expect(mockDialog.open).toHaveBeenCalledWith(
      ReleasePreviewDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          conflicts: expect.arrayContaining([
            expect.objectContaining({
              object_ref: 'attack-pattern--123',
            }),
          ]),
        }),
      })
    );
    expect(mockReleaseTrackApiConnector.releaseLatest).not.toHaveBeenCalled();
  });

  it('should not create a snapshot when the preview is cancelled', () => {
    mockReleaseTrackApiConnector.previewRelease.mockReturnValue(
      of({
        version: '1.1',
        conflicts: [],
      })
    );
    component.releaseTrack = {
      id: 'release-track--123',
      members: [],
      staged: [],
      candidates: [],
    } as any;
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(undefined),
    });
    component.id = 'release-track--123';

    component.onPreviewRelease();

    expect(mockDialog.open).toHaveBeenCalledWith(
      ReleasePreviewDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          track: expect.objectContaining({
            id: 'release-track--123',
          }),
        }),
      })
    );
    expect(mockReleaseTrackApiConnector.releaseLatest).not.toHaveBeenCalled();
  });

  it('should stop releasing when the preview request fails', () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockReleaseTrackApiConnector.previewRelease.mockReturnValue(
      throwError(() => new Error('preview failed'))
    );
    component.id = 'release-track--123';
    component.releaseTrack = {
      id: 'release-track--123',
      version: null,
    } as any;

    component.onPreviewRelease();

    expect(component.isReleasing).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to load objects for release preview',
      expect.any(Error)
    );
    expect(mockDialog.open).not.toHaveBeenCalled();
  });

  it('should notify the user when the preview response is empty', () => {
    mockReleaseTrackApiConnector.previewRelease.mockReturnValue(of(null));
    component.id = 'release-track--123';
    component.releaseTrack = {
      id: 'release-track--123',
      version: null,
    } as any;

    component.onPreviewRelease();

    expect(mockSnackbar.open).toHaveBeenCalledWith(
      'Unable to load the release preview. Please try again.',
      null,
      {
        duration: 5000,
        panelClass: 'error',
      }
    );
    expect(mockDialog.open).not.toHaveBeenCalled();
    expect(component.isReleasing).toBe(false);
  });

  it('should keep Preview & Release enabled for a tagged snapshot', () => {
    component.id = 'release-track--123';
    component.releaseTrack = {
      id: 'release-track--123',
      version: '1.0',
    } as any;
    fixture.detectChanges();

    const previewButton = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    ).find((button: Element) =>
      button.textContent?.includes('Preview & Release')
    ) as HTMLButtonElement;

    expect(previewButton).toBeTruthy();
    expect(previewButton.disabled).toBe(false);

    component.onPreviewRelease();

    expect(mockReleaseTrackApiConnector.previewRelease).not.toHaveBeenCalled();
    expect(mockDialog.open).toHaveBeenCalledWith(
      MultipleChoiceDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'No draft snapshot available',
        }),
      })
    );
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

  it('should retain object types when clearing component-track domains', () => {
    const track: any = {
      filters: {
        object_types: ['malware'],
        domains: ['mobile'],
      },
    };

    (component as any).setVirtualComponentTrackDomains(track, []);

    expect(track.filters).toEqual({
      object_types: ['malware'],
    });
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
