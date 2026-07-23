import { provideHttpClient } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { vi } from 'vitest';

import { WorkflowStatusDialogComponent } from './workflow-status-dialog.component';
import { SnapshotTier } from 'src/app/classes/release-tracks';
import { VersionNumber } from 'src/app/classes/version-number';
import { ReleaseTracksConnectorService } from 'src/app/services/connectors/rest-api/release-tracks.service';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createAsyncObservable,
  createMockRestApiConnector,
} from 'src/app/testing/mocks/rest-api-connector.mock';
import { WorkflowStatus } from 'src/app/utils/types';

describe('WorkflowStatusDialogComponent', () => {
  let component: WorkflowStatusDialogComponent;
  let fixture: ComponentFixture<WorkflowStatusDialogComponent>;
  let mockObject;
  let mockDialogRef;
  let mockReleaseTracksService;

  beforeEach(async () => {
    mockObject = {
      stixID: 'attack-pattern--123',
      attackType: 'technique',
      modified: new Date('2026-01-01T00:00:00.000Z'),
      version: new VersionNumber('1.0'),
      workflow: {
        state: WorkflowStatus.WorkInProgress,
      },
      workspace: {
        release_tracks: [
          {
            track_id: 'release-track--core',
            name: 'Core Objects',
            description: 'Core object workflow',
            object_ref: 'attack-pattern--123',
            object_modified: '2026-01-01T00:00:00.000Z',
            object_status: WorkflowStatus.WorkInProgress,
          },
        ],
      },
      validate: vi.fn(
        (_restApi, workflowState = WorkflowStatus.WorkInProgress) => {
          mockObject.workflow = { state: workflowState };
          return createAsyncObservable({
            successes: [],
            errors: [],
            warnings: [],
            info: [],
          });
        }
      ),
      save: vi.fn().mockReturnValue(createAsyncObservable({})),
    };
    mockDialogRef = {
      close: vi.fn(),
    };
    mockReleaseTracksService = {
      getLatestSnapshot: vi.fn((trackId: string) =>
        createAsyncObservable({
          name:
            trackId === 'release-track--core'
              ? 'Core Objects'
              : 'Groups & Campaigns',
          description:
            trackId === 'release-track--core'
              ? 'Core object workflow'
              : 'Groups workflow',
          candidates:
            trackId === 'release-track--core'
              ? [
                  {
                    object_ref: 'attack-pattern--123',
                    object_modified: '2026-01-01T00:00:00.000Z',
                    object_status: WorkflowStatus.WorkInProgress,
                  },
                ]
              : [
                  {
                    object_ref: 'attack-pattern--123',
                    object_modified: '2026-01-01T00:00:00.000Z',
                    object_status: WorkflowStatus.AwaitingReview,
                  },
                ],
          staged: [],
        })
      ),
      reviewCandidates: vi.fn().mockReturnValue(createAsyncObservable({})),
      demoteStaged: vi.fn().mockReturnValue(createAsyncObservable({})),
    };

    await TestBed.configureTestingModule({
      declarations: [WorkflowStatusDialogComponent],
      imports: [FormsModule, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            object: mockObject,
            targetStatus: WorkflowStatus.AwaitingReview,
            track: {
              trackId: 'release-track--core',
              name: 'Core Objects',
              description: 'Core object workflow',
              tier: SnapshotTier.Candidate,
              status: WorkflowStatus.WorkInProgress,
              objectRef: {
                id: 'attack-pattern--123',
                modified: '2026-01-01T00:00:00.000Z',
              },
            },
          },
        },
        {
          provide: RestApiConnectorService,
          useValue: createMockRestApiConnector(),
        },
        {
          provide: ReleaseTracksConnectorService,
          useValue: mockReleaseTracksService,
        },
        provideHttpClient(),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WorkflowStatusDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should validate against the selected status and load the target track', async () => {
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(component.dialogTitle).toBe('Submit for Review');
    expect(component.targetStatusLabel).toBe('Awaiting Review');
    expect(mockObject.validate).toHaveBeenCalledWith(
      expect.anything(),
      WorkflowStatus.AwaitingReview
    );
    expect(mockReleaseTracksService.getLatestSnapshot).toHaveBeenCalledWith(
      'release-track--core',
      { include: 'all' }
    );
    expect(component.trackStatus).toEqual(
      expect.objectContaining({
        trackId: 'release-track--core',
        name: 'Core Objects',
        description: 'Core object workflow',
        status: WorkflowStatus.WorkInProgress,
      })
    );
  });

  it('should update the target release track without saving the object', async () => {
    await new Promise(resolve => setTimeout(resolve, 10));

    component.onConfirm();
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockObject.workflow).toEqual({
      state: WorkflowStatus.WorkInProgress,
    });
    expect(mockObject.save).not.toHaveBeenCalled();
    expect(mockReleaseTracksService.reviewCandidates).toHaveBeenCalledWith(
      'release-track--core',
      {
        from: WorkflowStatus.WorkInProgress,
        to: WorkflowStatus.AwaitingReview,
        object_refs: [
          {
            id: 'attack-pattern--123',
            modified: '2026-01-01T00:00:00.000Z',
          },
        ],
      }
    );
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
  });

  it('should restore the previous workflow status on cancel', async () => {
    await new Promise(resolve => setTimeout(resolve, 10));

    component.onCancel();

    expect(mockObject.workflow).toEqual({
      state: WorkflowStatus.WorkInProgress,
    });
    expect(mockDialogRef.close).toHaveBeenCalledWith(false);
  });
});
