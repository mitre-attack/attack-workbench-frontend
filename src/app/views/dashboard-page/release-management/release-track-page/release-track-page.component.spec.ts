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
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  ConflictPolicy,
  MemberSyncBehavior,
  MemberSyncPolicy,
  MemberSyncStrategy,
  ReleaseTrackType,
} from 'src/app/classes/release-tracks';

describe('ReleaseTrackPageComponent', () => {
  let component: ReleaseTrackPageComponent;
  let fixture: ComponentFixture<ReleaseTrackPageComponent>;
  let mockReleaseTrackApiConnector: any;
  let mockDialog: any;
  let mockRestApiConnector: any;

  beforeEach(async () => {
    mockReleaseTrackApiConnector = createMockReleaseTrackApiConnector({
      getLatestSnapshot: vi.fn(() => createAsyncObservable(null)),
      listSnapshots: vi.fn(() => createAsyncObservable([])),
      exportLatestSnapshot: vi.fn(() => createAsyncObservable({})),
      exportSnapshotByModified: vi.fn(() => createAsyncObservable({})),
      retrieveSnapshotByModified: vi.fn(() => createAsyncObservable(null)),
      createVirtualSnapshot: vi.fn(() => createAsyncObservable({})),
      previewBump: vi.fn(() => createAsyncObservable({})),
      bumpByLatest: vi.fn(() => createAsyncObservable({})),
      getConfig: vi.fn(() => createAsyncObservable(null)),
      updateConfig: vi.fn(() => createAsyncObservable({})),
      reviewCandidates: vi.fn(() => createAsyncObservable({})),
      updateMetadataByLatest: vi.fn(() => createAsyncObservable({})),
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
    const mockRouter = {
      navigate: vi.fn(),
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
      { include: 'all' }
    );
    expect(component.releaseTrack?.name).toBe('Enterprise Release');
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
    mockReleaseTrackApiConnector.createVirtualSnapshot.mockReturnValue(of({}));
    component.id = 'release-track--123';
    component.releaseTrack = { type: ReleaseTrackType.Virtual } as any;

    component.onDraft();

    expect(
      mockReleaseTrackApiConnector.createVirtualSnapshot
    ).toHaveBeenCalledWith('release-track--123');
    expect(refreshSpy).toHaveBeenCalled();
    expect(historySpy).toHaveBeenCalled();
    expect(component.isCreatingDraft).toBe(false);
  });

  it('should not create a draft snapshot without a release track id', () => {
    component.id = '';
    component.releaseTrack = { type: ReleaseTrackType.Virtual } as any;

    component.onDraft();

    expect(
      mockReleaseTrackApiConnector.createVirtualSnapshot
    ).not.toHaveBeenCalled();
  });

  it('should not create a draft snapshot for a standard release track', () => {
    component.id = 'release-track--123';
    component.releaseTrack = { type: ReleaseTrackType.Standard } as any;

    component.onDraft();

    expect(
      mockReleaseTrackApiConnector.createVirtualSnapshot
    ).not.toHaveBeenCalled();
  });

  it('should preview and tag the latest draft release', () => {
    const refreshSpy = vi
      .spyOn(component, 'getReleaseTrack')
      .mockImplementation(() => undefined);
    const historySpy = vi
      .spyOn(component, 'getSnapshotHistory')
      .mockImplementation(() => undefined);
    mockReleaseTrackApiConnector.previewBump.mockReturnValue(
      of({
        next_version_minor: '1.2',
        next_version_major: '2.0',
        staged_count: 3,
        candidates_count: 1,
        conflicts: [],
      })
    );
    mockReleaseTrackApiConnector.bumpByLatest.mockReturnValue(of({}));
    mockDialog.open.mockReturnValue({
      afterClosed: () => of('minor'),
    });
    component.id = 'release-track--123';

    component.onPreviewRelease();

    expect(mockReleaseTrackApiConnector.previewBump).toHaveBeenCalledWith(
      'release-track--123',
      'workbench'
    );
    expect(mockDialog.open).toHaveBeenCalledWith(
      MultipleChoiceDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Preview & release',
        }),
      })
    );
    expect(mockReleaseTrackApiConnector.bumpByLatest).toHaveBeenCalledWith(
      'release-track--123',
      { type: 'minor' }
    );
    expect(refreshSpy).toHaveBeenCalled();
    expect(historySpy).toHaveBeenCalled();
    expect(component.isReleasing).toBe(false);
  });

  it('should not tag a release when preview returns conflicts', () => {
    mockReleaseTrackApiConnector.previewBump.mockReturnValue(
      of({
        conflicts: [
          {
            object_ref: 'attack-pattern--123',
            incumbent_version: '2024-01-15T10:00:00Z',
            incoming_version: '2024-02-20T10:00:00Z',
          },
        ],
      })
    );
    mockDialog.open.mockReturnValue({
      afterClosed: () => of('close'),
    });
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
    expect(mockReleaseTrackApiConnector.bumpByLatest).not.toHaveBeenCalled();
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
    expect(component.configForm.getRawValue()).toEqual({
      autoPromote: false,
      candidacyThreshold: 'awaiting-review',
      memberSyncStrategy: 'track_latest',
      memberSyncSupplantBehavior: 'queue',
      memberSyncSupplantStatusPolicy: 'reset',
      candidatesToStagedConflict: 'always_reject',
      stagedToMembersConflict: 'abort',
      includeSecondaryObjects: true,
      secondaryObjectThreshold: 'work-in-progress',
    });
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
