import { provideHttpClient } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import {
  ComponentFixture,
  fakeAsync,
  flush,
  TestBed,
} from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { vi } from 'vitest';
import { Subject } from 'rxjs';
import { ValidationData } from 'src/app/classes/serializable';

import { VersionNumber } from 'src/app/classes/version-number';
import { ReleaseTracksConnectorService } from 'src/app/services/connectors/rest-api/release-tracks.service';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createAsyncObservable,
  createMockRestApiConnector,
} from 'src/app/testing/mocks/rest-api-connector.mock';
import { WorkflowStatus } from 'src/app/utils/types';
import { SaveDialogComponent } from './save-dialog.component';

describe('SaveDialogComponent', () => {
  let component: SaveDialogComponent;
  let fixture: ComponentFixture<SaveDialogComponent>;
  let mockObject;
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
            object_ref: 'attack-pattern--123',
            object_modified: '2026-01-01T00:00:00.000Z',
            object_status: WorkflowStatus.AwaitingReview,
          },
        ],
      },
      validate: vi.fn(
        (_restApi, workflowState = WorkflowStatus.WorkInProgress) =>
          createAsyncObservable({
            successes: [],
            errors:
              workflowState === WorkflowStatus.Reviewed
                ? [
                    {
                      field: 'workflow',
                      result: 'error',
                      message: 'reviewed objects require stricter validation',
                    },
                  ]
                : [],
            warnings: [],
            info: [],
          })
      ),
      save: vi.fn().mockReturnValue(createAsyncObservable({})),
    };
    mockReleaseTracksService = {
      listReleaseTracks: vi.fn().mockReturnValue(
        createAsyncObservable({
          data: [
            {
              track_id: 'release-track--core',
              name: 'Core Objects',
              type: 'standard',
            },
            {
              track_id: 'release-track--groups',
              name: 'Groups & Campaigns',
              type: 'standard',
            },
          ],
        })
      ),
      getLatestSnapshot: vi.fn((trackId: string) =>
        createAsyncObservable({
          name: trackId === 'release-track--core' ? 'Core Objects' : '',
          candidates:
            trackId === 'release-track--core'
              ? [
                  {
                    object_ref: 'attack-pattern--123',
                    object_modified: '2026-01-01T00:00:00.000Z',
                    object_status: WorkflowStatus.AwaitingReview,
                  },
                ]
              : [],
          staged: [],
        })
      ),
      addCandidates: vi.fn().mockReturnValue(createAsyncObservable({})),
      reviewCandidates: vi.fn().mockReturnValue(createAsyncObservable({})),
      promoteCandidates: vi.fn().mockReturnValue(createAsyncObservable({})),
      demoteStaged: vi.fn().mockReturnValue(createAsyncObservable({})),
    };

    await TestBed.configureTestingModule({
      declarations: [SaveDialogComponent],
      imports: [
        FormsModule,
        MatAutocompleteModule,
        MatFormFieldModule,
        MatInputModule,
        MatRadioModule,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            object: mockObject,
            versionAlreadyIncremented: false,
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

  beforeEach(fakeAsync(() => {
    fixture = TestBed.createComponent(SaveDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flush();
  }));

  it('should distinguish enrolled tracks from available tracks', () => {
    expect(component.trackRows).toEqual([
      expect.objectContaining({
        trackId: 'release-track--core',
        name: 'Core Objects',
        selected: false,
        enrolled: true,
      }),
      expect.objectContaining({
        trackId: 'release-track--groups',
        name: 'Groups & Campaigns',
        selected: false,
        enrolled: false,
      }),
    ]);
    expect(component.statusRows).toEqual([
      expect.objectContaining({
        trackId: 'release-track--core',
      }),
    ]);
    expect(component.enrollmentOptions).toEqual([
      expect.objectContaining({
        trackId: 'release-track--groups',
      }),
    ]);
  });

  it('should move newly enrolled tracks into the release track status table', () => {
    const row = component.enrollmentOptions[0];
    component.selectEnrollmentTrack({ option: { value: row } });

    expect(row.selected).toBe(true);
    expect(component.statusRows).toEqual([
      expect.objectContaining({
        trackId: 'release-track--core',
      }),
      expect.objectContaining({
        trackId: 'release-track--groups',
      }),
    ]);
    expect(component.enrollmentOptions).toEqual([]);
  });

  it('should always validate save updates against WIP', () => {
    expect(component.validationReviewStatus).toBe(
      WorkflowStatus.WorkInProgress
    );
    expect(component.validationReviewStatusLabel).toBe('WIP');
    expect(mockObject.validate).toHaveBeenCalledWith(
      expect.anything(),
      WorkflowStatus.WorkInProgress
    );
    expect(component.validationStatus).toBe('success');
  });

  it('should add the saved object as a WIP candidate without reviewing tracks', fakeAsync(() => {
    const newTrack = component.enrollmentOptions[0];
    component.selectEnrollmentTrack({ option: { value: newTrack } });

    component.onConfirmSave();
    flush();

    expect(mockReleaseTracksService.reviewCandidates).not.toHaveBeenCalled();
    expect(mockReleaseTracksService.demoteStaged).not.toHaveBeenCalled();
    expect(mockReleaseTracksService.addCandidates).toHaveBeenCalledTimes(2);
    expect(mockReleaseTracksService.addCandidates).toHaveBeenCalledWith(
      'release-track--core',
      ['attack-pattern--123']
    );
    expect(mockReleaseTracksService.addCandidates).toHaveBeenCalledWith(
      'release-track--groups',
      ['attack-pattern--123']
    );
    expect(component.dialogRef.close).toHaveBeenCalledWith(true);
  }));

  it('should summarize validation status by severity', () => {
    component.validation = {
      successes: [],
      errors: [],
      warnings: [],
      info: [],
    };
    expect(component.validationStatus).toBe('success');
    expect(component.validationStatusLabel).toBe('Success');

    component.validation.warnings.push({
      field: 'name',
      result: 'warning',
      message: 'name warning',
    });
    expect(component.validationStatus).toBe('warning');
    expect(component.validationStatusLabel).toBe('Warning');

    component.validation.errors.push({
      field: 'name',
      result: 'error',
      message: 'name error',
    });
    expect(component.validationStatus).toBe('error');
    expect(component.validationStatusLabel).toBe('Error');
  });

  it('replaces completed preview evidence with the actual failed save report', () => {
    const saved = new Subject<any>();
    const preview = { reportId: 'preview', policyRevision: 1 };
    const actual = {
      reportId: 'failed-save',
      policyRevision: 2,
      state: 'partial' as const,
    };
    component.validation = new ValidationData();
    component.validation.exemptionReports = [preview];
    mockObject.save.mockReturnValue(saved);
    component.onConfirmSave();
    expect(component.validation.exemptionReports).toEqual([]);
    saved.error({ status: 400, error: { exemptionReport: actual } });
    expect(component.validation.exemptionReports).toEqual([actual]);
    expect(component.dialogRef.close).not.toHaveBeenCalled();
  });

  it('captures actual save evidence before track enrollment and keeps normal completion', fakeAsync(() => {
    const saved = new Subject<any>();
    const enrollment = new Subject<any>();
    const actual = { reportId: 'actual-save', state: 'completed' as const };
    component.validation = new ValidationData();
    component.validation.exemptionReports = [{ reportId: 'preview' }];
    mockObject.save.mockReturnValue(saved);
    mockReleaseTracksService.addCandidates.mockReturnValue(enrollment);
    component.onConfirmSave();
    saved.next({ exemptionReport: actual });
    saved.complete();
    expect(component.validation.exemptionReports).toEqual([actual]);
    expect(mockObject.exemptionReport).toEqual(actual);
    expect(component.dialogRef.close).not.toHaveBeenCalled();
    enrollment.next({});
    enrollment.complete();
    flush();
    expect(component.dialogRef.close).toHaveBeenCalledWith(true);
  }));
});
