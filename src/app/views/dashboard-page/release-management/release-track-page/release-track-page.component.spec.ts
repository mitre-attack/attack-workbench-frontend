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
import { FormsModule } from '@angular/forms';

describe('ReleaseTrackPageComponent', () => {
  let component: ReleaseTrackPageComponent;
  let fixture: ComponentFixture<ReleaseTrackPageComponent>;
  let mockReleaseTrackApiConnector: any;
  let mockDialog: any;
  let mockRestApiConnector: any;

  beforeEach(async () => {
    mockReleaseTrackApiConnector = createMockReleaseTrackApiConnector({
      getLatestSnapshot: vi.fn(() => createAsyncObservable(null)),
      exportLatestSnapshot: vi.fn(() => createAsyncObservable({})),
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
      imports: [FormsModule],
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
      'Staged/Reviewed',
      'Released Members',
    ]);
    expect(lanes.map(lane => lane.items.map(item => item.object_ref))).toEqual([
      ['attack-pattern--wip'],
      ['attack-pattern--candidate'],
      ['attack-pattern--reviewed-candidate', 'attack-pattern--staged'],
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
