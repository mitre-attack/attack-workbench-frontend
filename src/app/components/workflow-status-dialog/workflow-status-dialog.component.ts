import {
  Component,
  Inject,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';
import { catchError, concatMap, map } from 'rxjs/operators';
import { SnapshotTier } from 'src/app/classes/release-tracks';
import type {
  ReleaseTrackObjectTier,
  StixObjectRef,
} from 'src/app/classes/release-tracks';
import { ValidationData } from 'src/app/classes/serializable';
import { StixObject } from 'src/app/classes/stix/stix-object';
import { ReleaseTracksConnectorService } from 'src/app/services/connectors/rest-api/release-tracks.service';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { WORKFLOW_STATUS_LABELS, WorkflowStatus } from 'src/app/utils/types';
import type {
  ReleaseTrackStatus,
  WorkflowStatusDialogData,
  WorkflowStatusType,
} from 'src/app/utils/types';
import { logger } from 'src/app/utils/logger';

@Component({
  selector: 'app-workflow-status-dialog',
  templateUrl: './workflow-status-dialog.component.html',
  styleUrls: ['./workflow-status-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class WorkflowStatusDialogComponent implements OnInit, OnDestroy {
  public validation: ValidationData = null;
  public validating = false;
  public saving = false;
  public trackStatus: ReleaseTrackStatus | null = null;
  public loadingTracks = false;

  private saved = false;
  private previousWorkflow?: StixObject['workflow'];

  public get saveEnabled(): boolean {
    return (
      !this.validating &&
      !this.saving &&
      this.validation &&
      this.validation.errors.length === 0 &&
      this.hasTrack
    );
  }

  public get validationStatus(): ValidationStatus {
    if (!this.validation) return 'success';
    if (this.validation.errors.length) return 'error';
    if (this.validation.warnings.length) return 'warning';
    return 'success';
  }

  public get validationStatusLabel(): string {
    switch (this.validationStatus) {
      case 'error':
        return 'Error';
      case 'warning':
        return 'Warning';
      default:
        return 'Success';
    }
  }

  public get targetStatusLabel(): string {
    return this.getWorkflowStatusLabel(this.config.targetStatus);
  }

  public get dialogTitle(): string {
    switch (this.config.targetStatus) {
      case WorkflowStatus.AwaitingReview:
        return 'Submit for Review';
      case WorkflowStatus.Reviewed:
        return 'Mark as Reviewed';
      case WorkflowStatus.WorkInProgress:
        return 'Move to Work In Progress';
    }
  }

  public get primaryActionLabel(): string {
    return this.config.targetStatus === WorkflowStatus.AwaitingReview
      ? 'Submit for Review'
      : 'Save Status';
  }

  public get objectDisplayName(): string {
    return (
      this.config.object?.['name'] ||
      this.config.object?.['stix']?.name ||
      'Untitled object'
    );
  }

  public get hasTrack(): boolean {
    return !!this.trackStatus;
  }

  constructor(
    public dialogRef: MatDialogRef<WorkflowStatusDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public config: WorkflowStatusDialogData,
    public restApiService: RestApiConnectorService,
    private releaseTracksService: ReleaseTracksConnectorService
  ) {
    this.previousWorkflow = this.config.object.workflow
      ? { ...this.config.object.workflow }
      : undefined;
  }

  ngOnInit(): void {
    this.validateObject();
    this.loadTrack();
  }

  ngOnDestroy(): void {
    if (!this.saved) this.restorePreviousWorkflow();
  }

  public onCancel(): void {
    this.restorePreviousWorkflow();
    this.dialogRef.close(false);
  }

  public onConfirm(): void {
    if (!this.saveEnabled) return;

    this.saving = true;
    this.restorePreviousWorkflow();
    const subscription = this.syncTrack().subscribe({
      next: () => {
        this.saved = true;
        this.restorePreviousWorkflow();
        this.dialogRef.close(true);
      },
      error: err => {
        logger.error(err);
        this.restorePreviousWorkflow();
        this.saving = false;
      },
      complete: () => subscription.unsubscribe(),
    });
  }

  private validateObject(): void {
    this.validation = null;
    this.validating = true;

    this.config.object
      .validate(this.restApiService, this.config.targetStatus)
      .subscribe({
        next: result => {
          this.validation = result;
          this.restorePreviousWorkflow();
        },
        error: err => {
          logger.error(err);
          this.restorePreviousWorkflow();
          this.validating = false;
        },
        complete: () => {
          this.restorePreviousWorkflow();
          this.validating = false;
        },
      });
  }

  private loadTrack(): void {
    if (!this.config.object?.stixID) {
      this.trackStatus = null;
      return;
    }

    this.loadingTracks = true;
    const track = this.config.track;

    if (!track) {
      this.trackStatus = null;
      this.loadingTracks = false;
      return;
    }

    this.releaseTracksService
      .getLatestSnapshot(track.trackId, { include: 'all' })
      .pipe(
        map(snapshot => this.toTrackStatus(track, snapshot)),
        catchError(err => {
          logger.error(
            'Failed to load release track snapshot for workflow status dialog',
            err
          );
          return of(this.toTrackStatus(track, null));
        }),
        map(row => (row !== null && this.canUpdateTrack(row) ? row : null))
      )
      .subscribe({
        next: row => {
          this.trackStatus = row;
          this.loadingTracks = false;
        },
        error: err => {
          logger.error(err);
          this.trackStatus = null;
          this.loadingTracks = false;
        },
      });
  }

  private toTrackStatus(
    track: ReleaseTrackStatus,
    snapshot: any
  ): ReleaseTrackStatus | null {
    const entry = this.getTrackedObjectEntry(snapshot);
    if (!entry && !track.tier) return null;

    const tier = this.getEntryTier(entry) || track.tier || null;
    const status =
      this.getEntryWorkflowStatus(entry) ||
      track.status ||
      this.getFallbackWorkflowStatus(tier);

    return {
      trackId: this.getTrackId(track) || '',
      name: snapshot?.name || track?.name || this.getTrackId(track) || '',
      description: snapshot?.description || track.description || '',
      tier,
      status,
      objectRef: entry ? this.getObjectRef(entry) : track.objectRef,
    };
  }

  private syncTrack(): Observable<unknown> {
    if (!this.trackStatus) return of(null);

    return this.updateTrack(this.trackStatus).pipe(
      catchError(err => {
        logger.error('Failed to update release track object status', err);
        return of(null);
      })
    );
  }

  private updateTrack(row: ReleaseTrackStatus): Observable<unknown> {
    if (!row.trackId) return of(null);
    if (row.status === this.config.targetStatus) return of(null);

    if (row.tier === SnapshotTier.Staged) {
      return this.releaseTracksService
        .demoteStaged(row.trackId, [row.objectRef])
        .pipe(
          concatMap(() =>
            this.releaseTracksService.reviewCandidates(row.trackId, {
              from: row.status,
              to: this.config.targetStatus,
              object_refs: [row.objectRef],
            })
          )
        );
    }

    return this.releaseTracksService.reviewCandidates(row.trackId, {
      from: row.status,
      to: this.config.targetStatus,
      object_refs: [row.objectRef],
    });
  }

  private getTrackedObjectEntry(snapshot: any): any | null {
    if (!snapshot) return null;
    return (
      this.getSnapshotWorkflowEntries(snapshot).find(
        entry => this.getEntryObjectRef(entry) === this.config.object.stixID
      ) || null
    );
  }

  private canUpdateTrack(row: ReleaseTrackStatus): boolean {
    return row.status !== this.config.targetStatus;
  }

  private getSnapshotWorkflowEntries(snapshot: any): any[] {
    return [
      this.withTier(snapshot?.candidates, SnapshotTier.Candidate),
      this.withTier(snapshot?.staged, SnapshotTier.Staged),
      this.withTier(snapshot?.contents?.candidates, SnapshotTier.Candidate),
      this.withTier(snapshot?.contents?.staged, SnapshotTier.Staged),
      this.withTier(snapshot?.workspace?.candidates, SnapshotTier.Candidate),
      this.withTier(snapshot?.workspace?.staged, SnapshotTier.Staged),
    ]
      .filter(Array.isArray)
      .reduce((entries, tierEntries) => entries.concat(tierEntries), []);
  }

  private withTier(
    entries: any,
    tier: ReleaseTrackObjectTier
  ): any[] | undefined {
    if (!Array.isArray(entries)) return undefined;
    return entries.map(entry => ({
      ...entry,
      tier: this.getEntryTier(entry) || tier,
    }));
  }

  private getEntryTier(entry: any): ReleaseTrackObjectTier | null {
    if (!entry) return null;
    const tier = String(entry.tier || entry.object_tier || '').toLowerCase();
    if (tier === SnapshotTier.Staged) return SnapshotTier.Staged;
    if (tier === SnapshotTier.Candidate) return SnapshotTier.Candidate;
    if (entry.object_staged_at || entry.staged_at) return SnapshotTier.Staged;
    if (this.getEntryWorkflowStatus(entry)) return SnapshotTier.Candidate;
    return null;
  }

  private getEntryWorkflowStatus(entry: any): WorkflowStatusType | null {
    if (!entry) return null;
    const status = entry.object_status || entry.status;
    if (Object.values(WorkflowStatus).includes(status)) return status;
    return null;
  }

  private getFallbackWorkflowStatus(
    tier: ReleaseTrackObjectTier | null
  ): WorkflowStatusType {
    return tier === SnapshotTier.Staged
      ? WorkflowStatus.Reviewed
      : WorkflowStatus.WorkInProgress;
  }

  private getObjectRef(entry: any): StixObjectRef {
    const modified =
      this.toIsoString(entry.object_modified) ||
      this.toIsoString(entry.modified) ||
      this.config.object.modified?.toISOString();

    return modified
      ? {
          id: this.getEntryObjectRef(entry) || this.config.object.stixID,
          modified,
        }
      : this.getEntryObjectRef(entry) || this.config.object.stixID;
  }

  private getEntryObjectRef(entry: any): string | null {
    return entry?.object_ref || entry?.ref || entry?.id || null;
  }

  private toIsoString(value: any): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }

  private getTrackId(track: any): string | null {
    return (
      track?.trackId ||
      track?.track_id ||
      track?.release_track_id ||
      track?.releaseTrackId ||
      (track?.id?.startsWith('release-track--') ? track.id : null)
    );
  }

  private getWorkflowStatusLabel(status: WorkflowStatusType): string {
    return WORKFLOW_STATUS_LABELS[status] || status;
  }

  private restorePreviousWorkflow(): void {
    if (this.previousWorkflow) {
      this.config.object.workflow = { ...this.previousWorkflow };
      return;
    }
    this.config.object.workflow = undefined;
  }
}

type ValidationStatus = 'success' | 'warning' | 'error';
