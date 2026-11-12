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
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';

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

  it('blocks repeated saves until both persistence and track synchronization finish', () => {
    const persisted = new Subject<unknown>();
    const enrolled = new Subject<unknown>();
    mockObject.save.mockReturnValue(persisted);
    mockReleaseTracksService.addCandidates.mockReturnValue(enrolled);
    fixture.detectChanges();
    const saveButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[color="primary"]'
    );

    saveButton.click();
    fixture.detectChanges();
    expect(saveButton.disabled).toBe(true);
    expect(component.dialogRef.disableClose).toBe(true);
    component.onConfirmSave();
    component.saveNextMajorVersion();
    expect(mockObject.save).toHaveBeenCalledTimes(1);
    expect(mockObject.version.toString()).toBe('1.0');

    persisted.next({});
    persisted.complete();
    component.onConfirmSave();
    component.patch();
    expect(mockObject.save).toHaveBeenCalledTimes(1);
    expect(component.saveEnabled).toBe(false);
    expect(component.dialogRef.close).not.toHaveBeenCalled();

    enrolled.next({});
    enrolled.complete();
    expect(component.dialogRef.close).toHaveBeenCalledExactlyOnceWith(true);
    expect(component.saving).toBe(false);
    expect(component.dialogRef.disableClose).toBeUndefined();
  });

  it('releases the save guard after a failed POST so the user can try again', fakeAsync(() => {
    const persisted = new Subject<unknown>();
    mockObject.save.mockReturnValueOnce(persisted);
    component.dialogRef.disableClose = false;
    component.onConfirmSave();
    persisted.error(new Error('POST failed'));
    fixture.detectChanges();

    expect(component.saveEnabled).toBe(true);
    expect(component.dialogRef.disableClose).toBe(false);
    expect(component.dialogRef.close).not.toHaveBeenCalled();
    expect(mockReleaseTracksService.addCandidates).not.toHaveBeenCalled();

    component.onConfirmSave();
    flush();
    expect(mockObject.save).toHaveBeenCalledTimes(2);
    expect(component.dialogRef.close).toHaveBeenCalledExactlyOnceWith(true);
  }));

  it('holds the same guard while patching related objects before saving', () => {
    const patched = new Subject<unknown>();
    const persisted = new Subject<unknown>();
    const enrolled = new Subject<unknown>();
    const related = {
      stixID: 'attack-pattern--related',
      save: vi.fn().mockReturnValue(patched),
    };
    component.patch_objects = [related];
    component.stage = 2;
    mockObject.save.mockReturnValue(persisted);
    mockReleaseTracksService.addCandidates.mockReturnValue(enrolled);

    component.patch();
    component.patch();
    expect(related.save).toHaveBeenCalledTimes(1);
    expect(mockObject.save).not.toHaveBeenCalled();
    expect(component.saveEnabled).toBe(false);

    patched.next({});
    patched.complete();
    component.patch();
    expect(mockObject.save).toHaveBeenCalledTimes(1);
    persisted.next({});
    persisted.complete();
    component.patch();
    expect(related.save).toHaveBeenCalledTimes(1);
    expect(component.dialogRef.close).not.toHaveBeenCalled();
    enrolled.next({});
    enrolled.complete();
    expect(component.dialogRef.close).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('saves once when patch discovery found no related objects', () => {
    component.stage = 2;
    mockObject.save.mockReturnValue(of({}));
    mockReleaseTracksService.addCandidates.mockReturnValue(of({}));

    component.patch();

    expect(mockObject.save).toHaveBeenCalledTimes(1);
    expect(component.dialogRef.close).toHaveBeenCalledExactlyOnceWith(true);
    expect(component.saving).toBe(false);
  });

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
});
