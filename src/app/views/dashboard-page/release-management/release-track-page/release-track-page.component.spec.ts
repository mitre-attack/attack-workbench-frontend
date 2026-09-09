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
import { of, throwError } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BreadcrumbService } from 'src/app/services/helpers/breadcrumb.service';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { AddDialogComponent } from 'src/app/components/add-dialog/add-dialog.component';
import { ConfirmationDialogComponent } from 'src/app/components/confirmation-dialog/confirmation-dialog.component';
import { DeleteDialogComponent } from 'src/app/components/delete-dialog/delete-dialog.component';
import { ReleasePreviewDialogComponent } from 'src/app/components/release-preview-dialog/release-preview-dialog.component';
import { ReleaseVersionDialogComponent } from 'src/app/components/release-version-dialog/release-version-dialog.component';
import { SnapshotDescriptionDialogComponent } from 'src/app/components/snapshot-description-dialog/snapshot-description-dialog.component';
import { ReleaseReviewDialogComponent } from 'src/app/components/release-review-dialog/release-review-dialog.component';
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
      retagRelease: vi.fn(() => createAsyncObservable({})),
      getConfig: vi.fn(() => createAsyncObservable(null)),
      updateConfig: vi.fn(() => createAsyncObservable({})),
      updateComposition: vi.fn(() => createAsyncObservable({})),
      updateSchedule: vi.fn(() =>
        createAsyncObservable({ snapshot_schedule: { mode: 'manual' } })
      ),
      reviewCandidates: vi.fn(() => createAsyncObservable({})),
      updateMetadataByLatest: vi.fn(() => createAsyncObservable({})),
      addCandidates: vi.fn(() => createAsyncObservable({})),
      deleteReleaseTrack: vi.fn(() => createAsyncObservable({})),
      deleteSnapshotByModified: vi.fn(() => createAsyncObservable(undefined)),
      convertReleaseToDraft: vi.fn(() => createAsyncObservable({})),
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
      postNote: vi.fn(() => of({})),
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
      isAuthorized: vi.fn(() => true),
      canDelete: vi.fn(() => true),
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

  it('should export a standard draft snapshot as a sealed bundle', () => {
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
      { stixVersion: '2.0' }
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
        content_manifest_id: 'release-track-graph-manifest--sealed',
        bundle_id: 'bundle--release',
        content_statistics: {
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
      stats: [],
      contentStats: [],
      contentTotal: 185,
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
      content: {
        manifest_id: 'release-track-graph-manifest--sealed',
        statistics: {
          primary_count: 120,
          secondary_count: 18,
          relationship_count: 42,
          supporting_count: 3,
          link_target_count: 2,
          total_count: 185,
        },
      },
      bundle_id: 'bundle--release',
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

  it('should adopt the canonical id when the route carries an alias', () => {
    mockReleaseTrackApiConnector.getLatestSnapshot.mockReturnValue(
      of({ id: 'release-track--123', alias: 'core-team', name: 'Core Team' })
    );
    component.id = 'core-team';

    component.getReleaseTrack();

    expect(mockReleaseTrackApiConnector.getLatestSnapshot).toHaveBeenCalledWith(
      'core-team',
      { format: 'workbench', include: 'all' }
    );
    expect(component.id).toBe('release-track--123');
    expect(component.configForm.get('alias')?.value).toBe('core-team');
    expect(component.aliasUrlPreview).toBe(
      '/dashboard/release-management/core-team'
    );
  });

  it('should save an alias change through metadata before the config', () => {
    vi.spyOn(component, 'getReleaseTrack').mockImplementation(() => undefined);
    vi.spyOn(component, 'getSnapshotHistory').mockImplementation(
      () => undefined
    );
    mockReleaseTrackApiConnector.updateMetadataByLatest.mockReturnValue(of({}));
    mockReleaseTrackApiConnector.updateConfig.mockReturnValue(of({}));
    component.id = 'release-track--123';
    component.releaseTrack = {
      id: 'release-track--123',
      alias: null,
      config: {},
    } as any;
    component.configForm.patchValue({ alias: 'core-team' });
    component.isEditingConfig = true;

    component.onSaveConfig();

    expect(
      mockReleaseTrackApiConnector.updateMetadataByLatest
    ).toHaveBeenCalledWith('release-track--123', { alias: 'core-team' });
    expect(mockReleaseTrackApiConnector.updateConfig).toHaveBeenCalled();
    expect(component.getReleaseTrack).toHaveBeenCalled();
  });

  it('should clear an alias by saving an empty value', () => {
    vi.spyOn(component, 'getReleaseTrack').mockImplementation(() => undefined);
    mockReleaseTrackApiConnector.updateMetadataByLatest.mockReturnValue(of({}));
    mockReleaseTrackApiConnector.updateConfig.mockReturnValue(of({}));
    component.id = 'release-track--123';
    component.releaseTrack = {
      id: 'release-track--123',
      alias: 'core-team',
      config: {},
    } as any;
    component.configForm.patchValue({ alias: '' });
    component.isEditingConfig = true;

    component.onSaveConfig();

    expect(
      mockReleaseTrackApiConnector.updateMetadataByLatest
    ).toHaveBeenCalledWith('release-track--123', { alias: null });
  });

  it('should not save the config while the alias is invalid', () => {
    mockReleaseTrackApiConnector.updateConfig.mockReturnValue(of({}));
    component.id = 'release-track--123';
    component.releaseTrack = { id: 'release-track--123', config: {} } as any;
    component.configForm.patchValue({ alias: 'Bad Alias' });
    component.isEditingConfig = true;

    component.onSaveConfig();

    expect(
      mockReleaseTrackApiConnector.updateMetadataByLatest
    ).not.toHaveBeenCalled();
    expect(mockReleaseTrackApiConnector.updateConfig).not.toHaveBeenCalled();
    expect(component.configForm.get('alias')?.touched).toBe(true);
  });

  it('should leave metadata alone when the alias is unchanged', () => {
    vi.spyOn(component, 'getReleaseTrack').mockImplementation(() => undefined);
    mockReleaseTrackApiConnector.updateConfig.mockReturnValue(of({}));
    component.id = 'release-track--123';
    component.releaseTrack = {
      id: 'release-track--123',
      alias: 'core-team',
      config: {},
    } as any;
    component.configForm.patchValue({ alias: 'core-team' });
    component.isEditingConfig = true;

    component.onSaveConfig();

    expect(
      mockReleaseTrackApiConnector.updateMetadataByLatest
    ).not.toHaveBeenCalled();
    expect(mockReleaseTrackApiConnector.updateConfig).toHaveBeenCalled();
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
            content_manifest_id: 'release-track-graph-manifest--sealed',
            tagged_at: '2024-04-15T06:30:00.000Z',
            modified: '2024-04-15T06:00:00.000Z',
            type: ReleaseTrackType.Virtual,
            name: 'Combined',
            members_count: 5,
            quarantine_count: 1,
            composition_resolution: {
              resolved_at: '2024-04-15T05:55:00.000Z',
              component_snapshots: [
                {
                  track_id: 'release-track--component-one',
                  track_name: 'Component One At Resolution',
                  track_type: 'standard',
                  resolved_snapshot_id: '2024-04-01T08:15:30.000Z',
                  resolved_version: '2.4',
                  strategy_used: 'latest_tagged',
                  filters_applied: {
                    object_types: ['attack-pattern'],
                    domains: ['enterprise'],
                  },
                  total_objects_in_source: 30,
                  objects_after_filter: 12,
                  objects_contributed: 10,
                },
              ],
              deduplication: {
                total_objects_before: 12,
                total_objects_after: 10,
                duplicates_found: 2,
                conflicts_resolved: [],
              },
              summary: {
                total_objects: 10,
                quarantined_objects: 1,
              },
            },
            content_statistics: {
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
        contentStats: [],
        contentTotal: 0,
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
        hasCompositionResolution: true,
        compositionResolvedAt: new Date('2024-04-15T05:55:00.000Z'),
        compositionResolutionRows: [
          {
            trackId: 'release-track--component-one',
            trackName: 'Component One At Resolution',
            strategy: 'latest_tagged',
            resolvedVersion: '2.4',
            resolvedSnapshotId: '2024-04-01T08:15:30.000Z',
            filters: ['attack pattern', 'enterprise'],
            totalObjectsInSource: 30,
            objectsAfterFilter: 12,
            objectsContributed: 10,
          },
        ],
        contentTotal: 28,
        contentStats: [
          expect.objectContaining({ label: 'Members', value: 5 }),
          expect.objectContaining({ label: 'Relationships', value: 12 }),
          expect.objectContaining({ label: 'Dependencies', value: 3 }),
          expect.objectContaining({ label: 'Legacy secondary', value: 8 }),
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

  it('should keep composition provenance scoped to each virtual snapshot', () => {
    component.releaseTrack = {
      type: ReleaseTrackType.Virtual,
      modified: new Date('2024-06-01T00:00:00.000Z'),
      composition_resolution: {
        component_snapshots: [
          {
            track_id: 'release-track--component',
            resolved_version: '9.9',
          },
        ],
      },
    } as any;
    mockReleaseTrackApiConnector.listSnapshots.mockReturnValue(
      of({
        data: [
          {
            modified: '2024-06-01T00:00:00.000Z',
            version: null,
            type: ReleaseTrackType.Virtual,
            composition_resolution: null,
          },
          {
            modified: '2024-05-01T00:00:00.000Z',
            version: '2.0',
            type: ReleaseTrackType.Virtual,
            composition_resolution: {
              resolved_at: '2024-04-30T23:59:00.000Z',
              component_snapshots: [
                {
                  track_id: 'release-track--component',
                  track_name: 'Component',
                  track_type: 'standard',
                  resolved_snapshot_id: '2024-04-20T10:00:00.000Z',
                  resolved_version: '2.7',
                  strategy_used: 'specific_version',
                  total_objects_in_source: 40,
                  objects_after_filter: 40,
                  objects_contributed: 38,
                },
              ],
            },
          },
          {
            modified: '2024-03-01T00:00:00.000Z',
            version: '1.0',
            type: ReleaseTrackType.Virtual,
            composition_resolution: {
              resolved_at: '2024-02-29T23:59:00.000Z',
              component_snapshots: [
                {
                  track_id: 'release-track--component',
                  track_name: 'Component',
                  track_type: 'standard',
                  resolved_snapshot_id: '2024-02-15T10:00:00.000Z',
                  resolved_version: '1.3',
                  strategy_used: 'latest_tagged',
                  total_objects_in_source: 30,
                  objects_after_filter: 30,
                  objects_contributed: 30,
                },
              ],
            },
          },
        ],
      })
    );
    component.id = 'release-track--virtual';

    component.getSnapshotHistory();

    expect(component.snapshotHistory[0].hasCompositionResolution).toBe(false);
    expect(component.snapshotHistory[0].compositionResolutionRows).toEqual([]);
    expect(
      component.snapshotHistory[1].compositionResolutionRows[0].resolvedVersion
    ).toBe('2.7');
    expect(
      component.snapshotHistory[1].compositionResolutionRows[0]
        .resolvedSnapshotId
    ).toBe('2024-04-20T10:00:00.000Z');
    expect(
      component.snapshotHistory[2].compositionResolutionRows[0].resolvedVersion
    ).toBe('1.3');
  });

  it('should convert the most recent release to draft after typed confirmation', () => {
    const item = {
      snapshot: {
        version: '1.1',
        content_manifest_id: 'release-track-content-manifest--x',
      },
      title: 'v1.1',
      modified: '2026-07-23T13:37:28.000Z',
      isTagged: true,
      isLatestRelease: true,
    } as any;
    mockDialog.open.mockReturnValue({ afterClosed: () => of(true) });
    mockReleaseTrackApiConnector.convertReleaseToDraft.mockReturnValue(
      of(undefined)
    );
    const trackSpy = vi
      .spyOn(component, 'getReleaseTrack')
      .mockImplementation(() => undefined);
    const historySpy = vi
      .spyOn(component, 'getSnapshotHistory')
      .mockImplementation(() => undefined);
    component.id = 'release-track--123';

    component.onConvertReleaseToDraft(item);

    expect(mockDialog.open).toHaveBeenCalledWith(
      DeleteDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Convert release 1.1 to draft?',
          stixId: '1.1',
        }),
      })
    );
    expect(
      mockReleaseTrackApiConnector.convertReleaseToDraft
    ).toHaveBeenCalledWith('release-track--123', item.modified, '1.1');
    expect(trackSpy).toHaveBeenCalled();
    expect(historySpy).toHaveBeenCalled();
    expect(mockSnackbar.open).toHaveBeenCalledWith(
      'Release 1.1 converted to draft.',
      null,
      { duration: 5000 }
    );
  });

  it('should change a tagged release version as an administrator', () => {
    const item = {
      snapshot: { version: '1.1' },
      title: 'v1.1',
      modified: '2026-07-23T13:37:28.000Z',
      isTagged: true,
      isLatestRelease: true,
    } as any;
    mockDialog.open.mockReturnValue({ afterClosed: () => of('1.2') });
    mockReleaseTrackApiConnector.retagRelease.mockReturnValue(
      of({ version: '1.2' })
    );
    const refreshSpy = vi
      .spyOn(component as any, 'refreshReleaseTrackState')
      .mockImplementation(() => undefined);
    component.id = 'release-track--123';

    component.onRetagRelease(item);

    expect(mockDialog.open).toHaveBeenCalledWith(
      ReleaseVersionDialogComponent,
      expect.objectContaining({ data: { currentVersion: '1.1' } })
    );
    expect(mockReleaseTrackApiConnector.retagRelease).toHaveBeenCalledWith(
      'release-track--123',
      item.modified,
      { version: '1.2' }
    );
    expect(refreshSpy).toHaveBeenCalled();
    expect(mockSnackbar.open).toHaveBeenCalledWith(
      'Release 1.1 changed to 1.2.',
      null,
      { duration: 5000 }
    );
  });

  it('should hide a preserved release-source draft until rollback', () => {
    const sourceModified = '2026-07-23T13:37:27.000Z';
    mockReleaseTrackApiConnector.listSnapshots.mockReturnValue(
      of({
        data: [
          {
            id: 'release-track--123',
            modified: '2026-07-23T13:37:28.000Z',
            version: '1.0',
            release_source_modified: sourceModified,
          },
          {
            id: 'release-track--123',
            modified: sourceModified,
            version: null,
          },
        ],
      })
    );
    component.id = 'release-track--123';

    component.getSnapshotHistory();

    expect(component.snapshotHistory).toHaveLength(1);
    expect(component.snapshotHistory[0].title).toBe('v1.0');
    expect(component.hasCurrentDraftSnapshot).toBe(false);
  });

  it('should not offer release conversion to non-administrators or for drafts', () => {
    mockAuthenticationService.canDelete.mockReturnValue(false);
    component.id = 'release-track--123';
    component.onConvertReleaseToDraft({
      snapshot: { version: '1.0' },
      modified: '2026-07-23T13:37:28.000Z',
      isTagged: true,
      isLatestRelease: true,
    } as any);
    mockAuthenticationService.canDelete.mockReturnValue(true);
    component.onConvertReleaseToDraft({
      snapshot: {},
      modified: '2026-07-23T13:37:28.000Z',
      isTagged: false,
    } as any);

    expect(mockDialog.open).not.toHaveBeenCalled();
    expect(
      mockReleaseTrackApiConnector.convertReleaseToDraft
    ).not.toHaveBeenCalled();
  });

  it('should delete only the current draft and refresh snapshot history', () => {
    component.id = 'release-track--123';
    const item = {
      snapshot: { version: null },
      modified: '2026-07-23T13:37:28.000Z',
      isTagged: false,
      isCurrentDraft: true,
    } as any;
    mockDialog.open.mockReturnValue({ afterClosed: () => of(true) });
    mockReleaseTrackApiConnector.deleteSnapshotByModified.mockReturnValue(
      of(undefined)
    );
    const trackSpy = vi
      .spyOn(component, 'getReleaseTrack')
      .mockImplementation(() => undefined);
    const historySpy = vi
      .spyOn(component, 'getSnapshotHistory')
      .mockImplementation(() => undefined);
    component.onDeleteDraft(item);
    expect(
      mockReleaseTrackApiConnector.deleteSnapshotByModified
    ).toHaveBeenCalledWith(component.id, item.modified);
    expect(
      mockReleaseTrackApiConnector.convertReleaseToDraft
    ).not.toHaveBeenCalled();
    expect(trackSpy).toHaveBeenCalled();
    expect(historySpy).toHaveBeenCalled();
    expect(mockSnackbar.open).toHaveBeenCalledWith(
      'Draft snapshot deleted.',
      null,
      expect.anything()
    );
  });

  it('should not offer deletion for tagged or historical snapshots', () => {
    component.id = 'release-track--123';
    for (const flags of [
      { isTagged: true, isCurrentDraft: true },
      { isTagged: false, isCurrentDraft: false },
    ]) {
      component.onDeleteDraft({
        snapshot: {},
        modified: '2026-07-23T13:37:28.000Z',
        ...flags,
      } as any);
    }
    expect(mockDialog.open).not.toHaveBeenCalled();
    expect(
      mockReleaseTrackApiConnector.deleteSnapshotByModified
    ).not.toHaveBeenCalled();
  });

  it('should preserve the draft card and explain a dependency rejection', () => {
    component.id = 'release-track--123';
    const item = {
      snapshot: {},
      modified: '2026-07-23T13:37:28.000Z',
      isTagged: false,
      isCurrentDraft: true,
    } as any;
    mockDialog.open.mockReturnValue({ afterClosed: () => of(true) });
    mockReleaseTrackApiConnector.deleteSnapshotByModified.mockReturnValue(
      throwError(() => ({ error: { dependent_snapshots: [{}] } }))
    );
    component.onDeleteDraft(item);
    expect(component.isDeletingDraft(item)).toBe(false);
    expect(mockSnackbar.open).toHaveBeenCalledWith(
      expect.stringContaining('downstream virtual snapshots depend on it'),
      null,
      expect.anything()
    );
  });

  it('should edit notes on a draft snapshot', () => {
    const modified = '2026-07-23T13:37:28.000Z';
    const item = {
      snapshot: {
        snapshot_description: 'Original context',
      },
      title: 'Draft Snapshot',
      modified,
      isTagged: false,
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

  it('should not open the notes editor for a released snapshot', () => {
    const item = {
      snapshot: {
        content_manifest_id: 'release-track-graph-manifest--sealed',
        snapshot_description: 'Frozen release notes',
      },
      title: 'v1.0',
      modified: '2026-07-23T13:37:28.000Z',
      isTagged: true,
      isLatestRelease: true,
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
        content_manifest_id: 'release-track-graph-manifest--sealed',
        bundle_hashes: {
          manifest_id: 'release-track-graph-manifest--sealed',
          stix_2_0: 'a'.repeat(64),
          stix_2_1: 'b'.repeat(64),
        },
      },
      title: 'v1.0',
      modified,
      isTagged: true,
      isLatestRelease: true,
    } as any;

    component.copySnapshotBundleHash(item, '2.1');

    expect(mockClipboard.copy).toHaveBeenCalledWith('b'.repeat(64));
    expect(mockSnackbar.open).toHaveBeenCalledWith(
      'STIX 2.1 bundle SHA-256 copied to the clipboard.',
      null,
      { duration: 3000 }
    );
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

  it('should preview and tag the current draft from its card', () => {
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
    mockReleaseTrackApiConnector.retrieveSnapshotByModified.mockReturnValue(
      of({
        id: 'release-track--123',
        name: 'Core Objects',
        version: null,
        members: [],
        staged: [],
        candidates: [
          {
            object_ref: 'attack-pattern--candidate',
            name: 'Canonical Candidate',
            type: 'attack-pattern',
            x_mitre_version: '2.1',
            object_status: 'awaiting-review',
          },
        ],
      })
    );
    mockReleaseTrackApiConnector.releaseSnapshot.mockReturnValue(of({}));
    mockDialog.open.mockReturnValue({
      afterClosed: () =>
        of({ increment: 'minor', description: 'First release context' }),
    });
    component.id = 'release-track--123';

    component.onTagSnapshot({
      modified: '2026-07-30T14:00:00.000Z',
      isTagged: false,
      snapshot: {},
    } as any);

    expect(mockReleaseTrackApiConnector.previewRelease).toHaveBeenCalledWith(
      'release-track--123',
      { format: 'summary', increment: 'minor' },
      '2026-07-30T14:00:00.000Z'
    );
    expect(mockRestApiConnector.getAllObjects).not.toHaveBeenCalled();
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
    expect(mockReleaseTrackApiConnector.releaseSnapshot).toHaveBeenCalledWith(
      'release-track--123',
      '2026-07-30T14:00:00.000Z',
      { increment: 'minor', description: 'First release context' }
    );
    expect(mockReleaseTrackApiConnector.releaseLatest).not.toHaveBeenCalled();
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
            attack_id: 'S0001',
            name: 'Replacement Example',
            type: 'malware',
            x_mitre_version: '1.0',
          },
        ],
        staged: [
          {
            object_ref: 'malware--replacement',
            object_modified: '2026-07-23T12:00:00.000Z',
            attack_id: 'S0001',
            name: 'Replacement Example',
            type: 'malware',
            x_mitre_version: '1.1',
          },
        ],
        candidates: [],
      })
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
    expect(mockRestApiConnector.getAllObjects).not.toHaveBeenCalled();
    expect(mockDialog.open).toHaveBeenCalledWith(
      ReleasePreviewDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          track: expect.objectContaining({
            members: [
              expect.objectContaining({
                x_mitre_version: '1.0',
                attack_type: 'software',
              }),
            ],
            staged: [
              expect.objectContaining({
                x_mitre_version: '1.1',
                attack_type: 'software',
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
    mockReleaseTrackApiConnector.retrieveSnapshotByModified.mockReturnValue(
      of({ id: 'release-track--123', members: [], staged: [], candidates: [] })
    );
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(undefined),
    });
    component.id = 'release-track--123';

    component.onTagSnapshot({
      modified: '2026-07-30T14:00:00.000Z',
      isTagged: false,
      snapshot: {},
    } as any);

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
    expect(mockReleaseTrackApiConnector.releaseSnapshot).not.toHaveBeenCalled();
  });

  it('should not create a snapshot when the preview is cancelled', () => {
    mockReleaseTrackApiConnector.previewRelease.mockReturnValue(
      of({
        version: '1.1',
        conflicts: [],
      })
    );
    mockReleaseTrackApiConnector.retrieveSnapshotByModified.mockReturnValue(
      of({ id: 'release-track--123', members: [], staged: [], candidates: [] })
    );
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(undefined),
    });
    component.id = 'release-track--123';

    component.onTagSnapshot({
      modified: '2026-07-30T14:00:00.000Z',
      isTagged: false,
      snapshot: {},
    } as any);

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
    expect(mockReleaseTrackApiConnector.releaseSnapshot).not.toHaveBeenCalled();
  });

  it('should stop releasing when the preview request fails', () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockReleaseTrackApiConnector.previewRelease.mockReturnValue(
      throwError(() => new Error('preview failed'))
    );
    component.id = 'release-track--123';

    component.onTagSnapshot({
      modified: '2026-07-30T14:00:00.000Z',
      isTagged: false,
      snapshot: {},
    } as any);

    expect(component.isReleasing).toBe(false);
    expect(component.previewingSnapshotModified).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to load objects for release preview',
      expect.any(Error)
    );
    expect(mockDialog.open).not.toHaveBeenCalled();
  });

  it('should notify the user when the preview response is empty', () => {
    mockReleaseTrackApiConnector.previewRelease.mockReturnValue(of(null));
    mockReleaseTrackApiConnector.retrieveSnapshotByModified.mockReturnValue(
      of({ id: 'release-track--123' })
    );
    component.id = 'release-track--123';

    component.onTagSnapshot({
      modified: '2026-07-30T14:00:00.000Z',
      isTagged: false,
      snapshot: {},
    } as any);

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

  it('should describe in-flight work in the activity bar', () => {
    expect(component.activityMessage).toBeNull();

    component.isCreatingDraft = true;
    expect(component.activityMessage).toContain('Creating the draft snapshot');
    component.isCreatingDraft = false;

    component.isReleasing = true;
    component.previewingSnapshotModified = '2026-07-30T14:00:00.000Z';
    expect(component.activityMessage).toContain(
      'Preparing the release preview'
    );
    component.previewingSnapshotModified = null;
    expect(component.activityMessage).toContain('Tagging the release');
    component.isReleasing = false;

    component.isDeleting = true;
    expect(component.activityMessage).toContain('Deleting the release track');
    component.isDeleting = false;

    component.isSavingConfig = true;
    expect(component.activityMessage).toContain(
      'Saving the track configuration'
    );
    component.isSavingConfig = false;

    expect(component.activityMessage).toBeNull();
  });

  it('should show the activity bar while a draft is being created', () => {
    component.id = 'release-track--123';
    component.releaseTrack = { id: 'release-track--123' } as any;
    component.isCreatingDraft = true;
    fixture.detectChanges();

    const activity = fixture.nativeElement.querySelector('.page-activity');
    expect(activity).toBeTruthy();
    expect(activity.querySelector('mat-progress-bar')).toBeTruthy();
    expect(activity.textContent).toContain('Creating the draft snapshot');
  });

  it('should ignore tagging requests for released snapshots', () => {
    component.id = 'release-track--123';

    component.onTagSnapshot({
      modified: '2026-07-30T14:00:00.000Z',
      isTagged: true,
      snapshot: {},
    } as any);

    expect(mockReleaseTrackApiConnector.previewRelease).not.toHaveBeenCalled();
    expect(mockDialog.open).not.toHaveBeenCalled();
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
      })
    );
    expect(component.configForm.get('candidacyThreshold')?.disabled).toBe(true);
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
    });
    component.isEditingConfig = true;

    component.onSaveConfig();

    expect(mockReleaseTrackApiConnector.updateConfig).toHaveBeenCalledWith(
      'release-track--123',
      {
        auto_promote: true,
        candidacy_threshold: 'reviewed',
        promotion_conflicts: {
          candidates_to_staged: 'prefer_latest',
          staged_to_members: 'abort',
        },
        publication: {
          collection_id: null,
          created: null,
          created_by_ref: { inherit: true },
          object_marking_refs: { inherit: true },
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
    mockReleaseTrackApiConnector.updateSchedule.mockReturnValue(
      of({ snapshot_schedule: { mode: SnapshotScheduleMode.Manual } })
    );
    mockReleaseTrackApiConnector.updateConfig.mockReturnValue(of({}));
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
    });
    component.onEditConfig();
    component.configForm.patchValue({
      virtualDeduplicationStrategy: DeduplicationStrategy.Quarantine,
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
        },
      }
    );
    expect(mockReleaseTrackApiConnector.updateSchedule).toHaveBeenCalledWith(
      'release-track--virtual',
      { mode: SnapshotScheduleMode.Manual }
    );
    // Publication settings apply to virtual tracks too and are saved after
    // the composition.
    expect(mockReleaseTrackApiConnector.updateConfig).toHaveBeenCalledWith(
      'release-track--virtual',
      {
        publication: {
          collection_id: null,
          created: null,
          created_by_ref: { inherit: true },
          object_marking_refs: { inherit: true },
        },
      }
    );
    expect(component.isEditingConfig).toBe(false);
    expect(refreshSpy).toHaveBeenCalled();
    expect(historySpy).toHaveBeenCalled();
  });

  it('should suggest hourly from partial text and apply only a selected preset', () => {
    component.configForm.patchValue({
      virtualSnapshotScheduleMode: SnapshotScheduleMode.Cron,
    });
    const previous = component.virtualCronExpression;
    component.configForm.patchValue({ virtualScheduleSearch: 'hou' });
    expect(
      component.filteredSchedulePresets.map(preset => preset.label)
    ).toEqual(['Hourly — at minute 0']);
    expect(component.virtualCronExpression).toBe(previous);
    expect(component.isVirtualScheduleValid).toBe(false);
    component.selectSchedulePreset(component.filteredSchedulePresets[0]);
    expect(component.virtualCronExpression).toBe('0 * * * *');
    expect(component.isVirtualScheduleValid).toBe(true);
    expect(component.virtualCronUsesExistingExpression).toBe(false);
  });

  it('should apply every preset and allow subsequent guided customization', () => {
    for (const preset of component.schedulePresets) {
      component.selectSchedulePreset(preset);
      expect(component.virtualCronExpression).toBe(preset.cron);
      expect(component.virtualCronUsesExistingExpression).toBe(false);
    }
    component.configForm.patchValue({ virtualScheduleSearch: 'EVERY 15' });
    component.selectSchedulePreset(component.filteredSchedulePresets[0]);
    expect(component.virtualCronExpression).toBe('*/15 * * * *');
    component.configForm.patchValue({ virtualCronInterval: 30 });
    expect(component.virtualCronExpression).toBe('*/30 * * * *');
    expect(component.configForm.get('virtualScheduleSearch')?.value).toBeNull();
    component.configForm.patchValue({ virtualScheduleSearch: 'tomorrowish' });
    expect(component.filteredSchedulePresets).toEqual([]);
    component.selectSchedulePreset({ label: 'Invalid', cron: 'bad' });
    expect(component.virtualCronExpression).toBe('*/30 * * * *');
  });

  it('should generate a controlled weekly UTC cron schedule', () => {
    component.releaseTrack = {
      type: ReleaseTrackType.Virtual,
      snapshot_schedule: { mode: SnapshotScheduleMode.Manual },
    } as any;
    component.onEditConfig();
    component.configForm.patchValue({
      virtualSnapshotScheduleMode: SnapshotScheduleMode.Cron,
      virtualCronCadence: 'weekly',
      virtualCronHour: 9,
      virtualCronMinute: 15,
      virtualCronWeekdays: [3, 1],
    });

    expect(component.virtualCronExpression).toBe('15 9 * * 1,3');
    expect(component.isVirtualScheduleValid).toBe(true);
  });

  it('should save every 15 minutes without resubmitting a server-shaped composition', () => {
    mockReleaseTrackApiConnector.updateSchedule.mockReturnValue(
      of({
        snapshot_schedule: {
          mode: SnapshotScheduleMode.Cron,
          cron: '*/15 * * * *',
        },
      })
    );
    mockReleaseTrackApiConnector.updateConfig.mockReturnValue(of({}));
    component.id = 'release-track--virtual';
    component.releaseTrack = {
      id: component.id,
      type: ReleaseTrackType.Virtual,
      snapshot_schedule: { mode: SnapshotScheduleMode.Manual },
      composition: {
        component_tracks: [
          {
            track_id: 'release-track--0ac85c02-e554-41cc-bdf9-8f89a1ce1fd1',
            resolution_strategy: 'latest_tagged',
            priority: 10,
            filters: { domains: ['enterprise-attack'] },
          },
        ],
        deduplication: {
          strategy: DeduplicationStrategy.PrioritizeLatestObject,
        },
      },
    } as any;
    component.onEditConfig();
    component.configForm.patchValue({
      virtualSnapshotScheduleMode: SnapshotScheduleMode.Cron,
    });
    component.selectSchedulePreset(
      component.schedulePresets.find(preset => preset.cron === '*/15 * * * *')!
    );

    component.onSaveConfig();

    expect(
      mockReleaseTrackApiConnector.updateComposition
    ).not.toHaveBeenCalled();
    expect(mockReleaseTrackApiConnector.updateSchedule).toHaveBeenCalledWith(
      component.id,
      { mode: SnapshotScheduleMode.Cron, cron: '*/15 * * * *' }
    );
  });

  it('should preserve an existing cron expression the guided editor cannot represent', () => {
    component.releaseTrack = {
      type: ReleaseTrackType.Virtual,
      snapshot_schedule: {
        mode: SnapshotScheduleMode.Cron,
        cron: '*/10 8-17 * * 1-5',
      },
    } as any;

    component.onEditConfig();

    expect(component.virtualCronUsesExistingExpression).toBe(true);
    expect(component.virtualCronExpression).toBe('*/10 8-17 * * 1-5');
  });

  it('should add unique future UTC schedule dates and require at least one', () => {
    component.releaseTrack = {
      type: ReleaseTrackType.Virtual,
      snapshot_schedule: { mode: SnapshotScheduleMode.Dates, dates: [] },
    } as any;
    component.onEditConfig();
    component.configForm.patchValue({
      virtualSnapshotScheduleMode: SnapshotScheduleMode.Dates,
      virtualScheduleDateDraft: '2099-07-15',
      virtualScheduleDateHour: 9,
      virtualScheduleDateMinute: 30,
    });

    expect(component.isVirtualScheduleValid).toBe(false);
    component.addVirtualScheduleDate();
    component.configForm.patchValue({ virtualScheduleDateDraft: '2099-07-15' });
    component.addVirtualScheduleDate();

    expect(component.virtualScheduleDates).toEqual([
      '2099-07-15T09:30:00.000Z',
    ]);
    expect(component.isVirtualScheduleValid).toBe(true);
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
      true
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
    const candidate = {
      object_ref: 'attack-pattern--123',
      object_modified: new Date('2024-04-20T00:00:00.000Z'),
      object_status: 'awaiting-review',
    } as any;
    vi.spyOn(component as any, 'resolveReviewDiffObjects').mockReturnValue(
      of({ current: { type: 'attack-pattern' }, prior: null })
    );
    mockReleaseTrackApiConnector.reviewCandidates.mockReturnValue(of({}));
    mockDialog.open.mockReturnValue({
      afterClosed: () =>
        of({
          approved: [candidate],
          updateRequests: [],
        }),
    });
    component.id = 'release-track--123';

    component.onReviewAndApprove(candidate);

    expect(mockDialog.open).toHaveBeenCalledWith(
      ReleaseReviewDialogComponent,
      expect.objectContaining({
        data: {
          items: [
            expect.objectContaining({
              item: candidate,
            }),
          ],
        },
      })
    );

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

  it('should attach a note when updates are requested', () => {
    const refreshSpy = vi
      .spyOn(component, 'getReleaseTrack')
      .mockImplementation(() => undefined);
    const candidate = {
      object_ref: 'attack-pattern--123',
      object_status: 'awaiting-review',
      name: 'Example technique',
    } as any;
    vi.spyOn(component as any, 'resolveReviewDiffObjects').mockReturnValue(
      of({ current: { type: 'attack-pattern' }, prior: null })
    );
    mockDialog.open.mockReturnValue({
      afterClosed: () =>
        of({
          approved: [],
          updateRequests: [{ item: candidate, note: 'Clarify the procedure.' }],
        }),
    });
    component.id = 'release-track--123';

    component.onReviewAndApprove(candidate);

    expect(mockRestApiConnector.postNote).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Updates requested: Example technique',
        content: 'Clarify the procedure.',
        object_refs: ['attack-pattern--123'],
      })
    );
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('should restrict review actions to team leads and admins', () => {
    mockAuthenticationService.isAuthorized.mockReturnValue(false);
    const lane = {
      type: 'candidate',
      statusFallback: 'awaiting-review',
      items: [{ object_ref: 'attack-pattern--123' }],
    } as any;

    expect(component.canReviewAndApprove(lane.items[0], lane)).toBe(false);
    expect(component.canReviewLane(lane)).toBe(false);
  });

  it('should step through all awaiting-review candidates in bulk review', () => {
    const candidates = [
      {
        object_ref: 'attack-pattern--one',
        object_status: 'awaiting-review',
      },
      {
        object_ref: 'attack-pattern--wip',
        object_status: 'work-in-progress',
      },
      {
        object_ref: 'attack-pattern--two',
        object_status: 'awaiting-review',
      },
    ] as any[];
    vi.spyOn(component as any, 'resolveReviewDiffObjects').mockReturnValue(
      of({ current: { type: 'attack-pattern' }, prior: null })
    );
    mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });

    component.onReviewAll(candidates);

    expect(mockDialog.open).toHaveBeenCalledWith(
      ReleaseReviewDialogComponent,
      expect.objectContaining({
        data: {
          items: [
            expect.objectContaining({ item: candidates[0] }),
            expect.objectContaining({ item: candidates[2] }),
          ],
        },
      })
    );
  });

  it('should confirm before approving all awaiting-review candidates', () => {
    const refreshSpy = vi
      .spyOn(component, 'getReleaseTrack')
      .mockImplementation(() => undefined);
    const candidates = [
      {
        object_ref: 'attack-pattern--one',
        object_status: 'awaiting-review',
      },
      {
        object_ref: 'attack-pattern--wip',
        object_status: 'work-in-progress',
      },
      {
        object_ref: 'attack-pattern--two',
        object_status: 'awaiting-review',
      },
    ] as any[];
    component.id = 'release-track--123';
    mockDialog.open.mockReturnValue({ afterClosed: () => of(true) });
    mockReleaseTrackApiConnector.reviewCandidates.mockReturnValue(of({}));

    component.onApproveAll(candidates);

    expect(mockDialog.open).toHaveBeenCalledWith(
      ConfirmationDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Approve all awaiting-review objects?',
          yes_label: 'Approve all (2)',
        }),
      })
    );
    expect(mockReleaseTrackApiConnector.reviewCandidates).toHaveBeenCalledWith(
      'release-track--123',
      {
        from: 'awaiting-review',
        to: 'reviewed',
        object_refs: ['attack-pattern--one', 'attack-pattern--two'],
      }
    );
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('should not bulk approve when confirmation is cancelled', () => {
    mockDialog.open.mockReturnValue({ afterClosed: () => of(false) });

    component.onApproveAll([
      {
        object_ref: 'attack-pattern--review',
        object_status: 'awaiting-review',
      },
    ] as any);

    expect(
      mockReleaseTrackApiConnector.reviewCandidates
    ).not.toHaveBeenCalled();
  });

  it('should not open review without permission or awaiting-review objects', () => {
    component.onReviewAll([
      {
        object_ref: 'attack-pattern--wip',
        object_status: 'work-in-progress',
      },
    ] as any);
    expect(mockDialog.open).not.toHaveBeenCalled();

    mockAuthenticationService.isAuthorized.mockReturnValue(false);
    component.onReviewAll([
      {
        object_ref: 'attack-pattern--review',
        object_status: 'awaiting-review',
      },
    ] as any);
    expect(mockDialog.open).not.toHaveBeenCalled();

    component.onApproveAll([
      {
        object_ref: 'attack-pattern--review',
        object_status: 'awaiting-review',
      },
    ] as any);
    expect(mockDialog.open).not.toHaveBeenCalled();
  });

  it('should report when review objects cannot be loaded', () => {
    vi.spyOn(component as any, 'resolveReviewDiffObjects').mockReturnValue(
      of({ current: null, prior: null })
    );

    component.onReviewAll([
      {
        object_ref: 'attack-pattern--missing',
        object_status: 'awaiting-review',
      },
    ] as any);

    expect(mockSnackbar.open).toHaveBeenCalledWith(
      'Unable to load the objects awaiting review.',
      undefined,
      { duration: 4000, panelClass: 'error' }
    );
    expect(mockDialog.open).not.toHaveBeenCalled();
  });

  it('should omit review objects that fail to resolve', () => {
    const candidates = [
      {
        object_ref: 'attack-pattern--loaded',
        object_status: 'awaiting-review',
      },
      {
        object_ref: 'attack-pattern--missing',
        object_status: 'awaiting-review',
      },
    ] as any[];
    vi.spyOn(component as any, 'resolveReviewDiffObjects').mockImplementation(
      (item: any) =>
        of({
          current:
            item.object_ref === 'attack-pattern--loaded'
              ? { type: 'attack-pattern' }
              : null,
          prior: null,
        })
    );
    mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });

    component.onReviewAll(candidates);

    expect(mockSnackbar.open).toHaveBeenCalledWith(
      'Some objects could not be loaded and were omitted from review.',
      undefined,
      { duration: 4000 }
    );
    expect(mockDialog.open).toHaveBeenCalledWith(
      ReleaseReviewDialogComponent,
      expect.objectContaining({
        data: { items: [expect.objectContaining({ item: candidates[0] })] },
      })
    );
  });

  it('should report an error while loading review objects', () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.spyOn(component as any, 'resolveReviewDiffObjects').mockReturnValue(
      throwError(() => new Error('load failed'))
    );

    component.onReviewAll([
      {
        object_ref: 'attack-pattern--error',
        object_status: 'awaiting-review',
      },
    ] as any);

    expect(mockSnackbar.open).toHaveBeenCalledWith(
      'Unable to load the objects awaiting review.',
      undefined,
      { duration: 4000, panelClass: 'error' }
    );
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should resolve review diffs against the released member', () => {
    const candidate = {
      object_ref: 'attack-pattern--123',
      object_modified: '2026-01-02T00:00:00.000Z',
    } as any;
    component.releaseTrack = {
      members: [
        {
          object_ref: 'attack-pattern--123',
          object_modified: '2026-01-01T00:00:00.000Z',
        },
      ],
    } as any;
    const fetchSpy = vi
      .spyOn(component as any, 'fetchObjectVersion')
      .mockImplementation((_id: string, modified: string) =>
        of({ modified } as any)
      );
    let result: any;

    (component as any)
      .resolveReviewDiffObjects(candidate)
      .subscribe((value: any) => (result = value));

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.current.modified).toBe('2026-01-02T00:00:00.000Z');
    expect(result.prior.modified).toBe('2026-01-01T00:00:00.000Z');
  });

  it('should resolve a new review object without a member baseline', () => {
    const candidate = {
      object_ref: 'attack-pattern--new',
      object_modified: '2026-01-02T00:00:00.000Z',
    } as any;
    component.releaseTrack = { members: [] } as any;
    vi.spyOn(component as any, 'fetchObjectVersion').mockReturnValue(
      of({ type: 'attack-pattern' } as any)
    );
    let result: any;

    (component as any)
      .resolveReviewDiffObjects(candidate)
      .subscribe((value: any) => (result = value));

    expect(result.current).toEqual({ type: 'attack-pattern' });
    expect(result.prior).toBeNull();
  });

  it('should refresh and notify when saving review actions fails', () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const refreshSpy = vi
      .spyOn(component, 'getReleaseTrack')
      .mockImplementation(() => undefined);
    mockReleaseTrackApiConnector.reviewCandidates.mockReturnValue(
      throwError(() => new Error('save failed'))
    );
    component.id = 'release-track--123';

    (component as any).applyReviewResult({
      approved: [{ object_ref: 'attack-pattern--123' }],
      updateRequests: [],
    });

    expect(mockSnackbar.open).toHaveBeenCalledWith(
      'Unable to save all review updates.',
      undefined,
      { duration: 5000, panelClass: 'error' }
    );
    expect(refreshSpy).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should ignore empty or cancelled review results', () => {
    (component as any).applyReviewResult(undefined);
    component.id = 'release-track--123';
    (component as any).applyReviewResult({
      approved: [],
      updateRequests: [],
    });

    expect(
      mockReleaseTrackApiConnector.reviewCandidates
    ).not.toHaveBeenCalled();
    expect(mockRestApiConnector.postNote).not.toHaveBeenCalled();
  });
});
