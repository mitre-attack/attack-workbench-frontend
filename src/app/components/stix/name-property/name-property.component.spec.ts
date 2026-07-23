import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';

import { NamePropertyComponent } from './name-property.component';
import { StixObject } from 'src/app/classes/stix/stix-object';
import { ReleaseTracksConnectorService } from 'src/app/services/connectors/rest-api/release-tracks.service';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { EditorService } from 'src/app/services/editor/editor.service';
import {
  createAsyncObservable,
  createMockRestApiConnector,
} from 'src/app/testing/mocks/rest-api-connector.mock';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { WorkflowStatus } from 'src/app/utils/types';
import { WorkflowStatusDialogComponent } from 'src/app/components/workflow-status-dialog/workflow-status-dialog.component';

describe('NamePropertyComponent', () => {
  let component: NamePropertyComponent;
  let fixture: ComponentFixture<NamePropertyComponent>;
  let mockDialog;
  let mockEditorService;
  let mockReleaseTracksService;
  let mockSnackbar;
  let snapshotStatus;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({});
    mockDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(true),
      }),
    };
    mockEditorService = {
      onReload: {
        emit: vi.fn(),
      },
    };
    mockSnackbar = {
      open: vi.fn(),
    };
    snapshotStatus = WorkflowStatus.WorkInProgress;
    mockReleaseTracksService = {
      getLatestSnapshot: vi.fn(() =>
        createAsyncObservable({
          name: 'Core Objects',
          description: 'Core workflow',
          candidates: [
            {
              object_ref: 'attack-pattern--123',
              object_status: snapshotStatus,
            },
          ],
          staged: [],
        })
      ),
    };

    await TestBed.configureTestingModule({
      declarations: [NamePropertyComponent],
      imports: [MatMenuModule],
      providers: [
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackbar },
        { provide: EditorService, useValue: mockEditorService },
        {
          provide: ReleaseTracksConnectorService,
          useValue: mockReleaseTracksService,
        },
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({}),
            queryParams: of({}),
          },
        },
        provideHttpClient(),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NamePropertyComponent);
    component = fixture.componentInstance;
    // Set required config input
    component.config = {
      mode: 'view',
      object: {} as any,
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should open workflow status dialog for a release track status action', async () => {
    const object = Object.create(StixObject.prototype);
    object.stixID = 'attack-pattern--123';
    object.attackType = 'technique';
    object.workflow = { state: WorkflowStatus.WorkInProgress };
    object.workspace = {
      release_tracks: [
        {
          track_id: 'release-track--core',
          name: 'Core Objects',
          object_ref: 'attack-pattern--123',
          object_modified: '2026-01-01T00:00:00.000Z',
          object_status: WorkflowStatus.WorkInProgress,
        },
      ],
    };
    component.config = {
      mode: 'view',
      object,
    };
    component.ngOnInit();
    await new Promise(resolve => setTimeout(resolve, 10));

    const track = component.trackStatuses[0];
    component.openStatusDialog(WorkflowStatus.Reviewed, undefined, track);

    expect(mockDialog.open).toHaveBeenCalledWith(
      WorkflowStatusDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          object,
          targetStatus: WorkflowStatus.Reviewed,
          track: expect.objectContaining({
            trackId: 'release-track--core',
          }),
        }),
      })
    );
    expect(component.statusControl.value).toBe(WorkflowStatus.Reviewed);
    expect(mockEditorService.onReload.emit).toHaveBeenCalled();
  });

  it('should reset workflow status control when workflow status dialog is canceled', async () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(false),
    });
    const object = Object.create(StixObject.prototype);
    object.stixID = 'attack-pattern--123';
    object.attackType = 'technique';
    object.workflow = { state: WorkflowStatus.WorkInProgress };
    object.workspace = {
      release_tracks: [
        {
          track_id: 'release-track--core',
          name: 'Core Objects',
          object_ref: 'attack-pattern--123',
          object_modified: '2026-01-01T00:00:00.000Z',
          object_status: WorkflowStatus.WorkInProgress,
        },
      ],
    };
    component.config = {
      mode: 'view',
      object,
    };
    component.ngOnInit();
    await new Promise(resolve => setTimeout(resolve, 10));

    component.openStatusDialog(
      WorkflowStatus.Reviewed,
      undefined,
      component.trackStatuses[0]
    );

    expect(component.statusControl.value).toBe(WorkflowStatus.WorkInProgress);
  });

  it('should load release track workflow rows for the status menu', async () => {
    const object = Object.create(StixObject.prototype);
    object.stixID = 'attack-pattern--123';
    object.attackType = 'technique';
    object.workflow = { state: WorkflowStatus.WorkInProgress };
    object.workspace = {
      release_tracks: [
        {
          track_id: 'release-track--core',
          name: 'Core Objects',
          object_ref: 'attack-pattern--123',
          object_modified: '2026-01-01T00:00:00.000Z',
          object_status: WorkflowStatus.WorkInProgress,
        },
      ],
    };
    component.config = {
      mode: 'view',
      object,
    };

    component.ngOnInit();
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockReleaseTracksService.getLatestSnapshot).toHaveBeenCalledWith(
      'release-track--core',
      { include: 'all' }
    );
    expect(component.trackStatuses).toEqual([
      expect.objectContaining({
        trackId: 'release-track--core',
        name: 'Core Objects',
        description: 'Core workflow',
        status: WorkflowStatus.WorkInProgress,
      }),
    ]);
  });

  it('should refresh release track statuses when the saved object reloads', async () => {
    const object = Object.create(StixObject.prototype);
    object.stixID = 'attack-pattern--123';
    object.attackType = 'technique';
    object.modified = new Date('2026-01-01T00:00:00.000Z');
    object.workflow = { state: WorkflowStatus.WorkInProgress };
    object.workspace = {
      release_tracks: [
        {
          track_id: 'release-track--core',
          name: 'Core Objects',
          object_ref: 'attack-pattern--123',
          object_modified: '2026-01-01T00:00:00.000Z',
          object_status: WorkflowStatus.WorkInProgress,
        },
      ],
    };
    component.config = {
      mode: 'view',
      object,
    };
    component.ngOnInit();
    await new Promise(resolve => setTimeout(resolve, 10));

    snapshotStatus = WorkflowStatus.AwaitingReview;
    const updatedObject = Object.create(StixObject.prototype);
    updatedObject.stixID = 'attack-pattern--123';
    updatedObject.attackType = 'technique';
    updatedObject.modified = new Date('2026-01-02T00:00:00.000Z');
    updatedObject.workflow = { state: WorkflowStatus.WorkInProgress };
    updatedObject.workspace = {
      release_tracks: [
        {
          track_id: 'release-track--core',
          name: 'Core Objects',
          object_ref: 'attack-pattern--123',
          object_modified: '2026-01-02T00:00:00.000Z',
          object_status: WorkflowStatus.AwaitingReview,
        },
      ],
    };
    component.config = {
      mode: 'view',
      object: updatedObject,
    };
    component.ngOnChanges({
      config: {
        previousValue: { mode: 'view', object },
        currentValue: component.config,
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockReleaseTracksService.getLatestSnapshot).toHaveBeenCalledTimes(2);
    expect(component.trackStatuses[0].status).toBe(
      WorkflowStatus.AwaitingReview
    );
  });

  it('should only allow forward workflow status changes from the menu', () => {
    const row = {
      status: WorkflowStatus.AwaitingReview,
    } as any;

    expect(component.isStatusDisabled(row, WorkflowStatus.WorkInProgress)).toBe(
      true
    );
    expect(component.isStatusDisabled(row, WorkflowStatus.AwaitingReview)).toBe(
      true
    );
    expect(component.isStatusDisabled(row, WorkflowStatus.Reviewed)).toBe(
      false
    );
  });
});
