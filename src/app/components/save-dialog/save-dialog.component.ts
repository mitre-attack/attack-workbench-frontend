import { Component, Inject, OnInit, ViewEncapsulation } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ExportFormat, SnapshotTier } from 'src/app/classes/release-tracks';
import type {
  ReleaseTrackObjectTier,
  StixObjectRef,
} from 'src/app/classes/release-tracks';
import { ValidationData } from 'src/app/classes/serializable';
import { DetectionStrategy } from 'src/app/classes/stix';
import { StixObject } from 'src/app/classes/stix/stix-object';
import { VersionNumber } from 'src/app/classes/version-number';
import { ReleaseTracksConnectorService } from 'src/app/services/connectors/rest-api/release-tracks.service';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { WORKFLOW_STATUS_LABELS, WorkflowStatus } from 'src/app/utils/types';
import type {
  ReleaseTrackStatus,
  WorkflowStatusType,
} from 'src/app/utils/types';
import { logger } from '../../utils/logger';

@Component({
  selector: 'app-save-dialog',
  templateUrl: './save-dialog.component.html',
  styleUrls: ['./save-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class SaveDialogComponent implements OnInit {
  public stage = 0;
  public currentVersion: string;
  public nextMajorVersion: string;
  public nextMinorVersion: string;
  public patch_objects = [];
  public validation: ValidationData = null;
  public validating = false;
  public newState: WorkflowStatus | undefined = WorkflowStatus.WorkInProgress;
  public analyticsToPatch = new Set<string>(); // list of stix ids of analytics that need patching
  public versionChoice: SaveVersionChoice = 'keep';
  public trackRows: TrackRow[] = [];
  public enrollmentSearch: string | TrackRow = '';
  public loadingTracks = false;
  public readonly resetWorkflowStatus = WorkflowStatus.WorkInProgress;
  private validationRequestId = 0;

  public get saveEnabled() {
    return (
      !this.validating && this.validation && this.validation.errors.length == 0
    );
  }

  public get validationStatus(): ValidationStatus {
    if (!this.validation) return 'success';
    if (this.validation.errors.length) return 'error';
    if (
      this.validation.warnings.length ||
      this.config.patchId ||
      this.config.patchAnalytics
    )
      return 'warning';
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

  public get validationReviewStatus(): WorkflowStatusType | undefined {
    if (this.config.object.attackType === 'relationship') return undefined;
    return this.resetWorkflowStatus;
  }

  public get validationReviewStatusLabel(): string {
    const status = this.validationReviewStatus;
    if (!status) return '';
    return this.getWorkflowStatusLabel(status);
  }

  constructor(
    public dialogRef: MatDialogRef<SaveDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public config: SaveDialogConfig,
    public restApiService: RestApiConnectorService,
    private releaseTracksService: ReleaseTracksConnectorService
  ) {
    this.currentVersion = config.object.version.toString();
    this.nextMajorVersion = config.object.version.nextMajorVersion().toString();
    this.nextMinorVersion = config.object.version.nextMinorVersion().toString();
  }

  ngOnInit(): void {
    this.newState =
      this.config.initialWorkflowState || WorkflowStatus.WorkInProgress;
    if (this.config.object.attackType === 'relationship') {
      this.newState = undefined;
    }
    if (this.config.object.attackType === 'detection-strategy') {
      const det = this.config.object as DetectionStrategy;
      const newAnalytics = new Set<string>(det.analytics);
      if (this.config.patchAnalytics) {
        // get set symmetric diff of analytics that need patching
        // analytics that were removed or added to the DET need to
        // be updated
        for (const a of this.config.patchAnalytics) {
          // check for analytics removed
          if (!newAnalytics.has(a)) this.analyticsToPatch.add(a);
        }
        for (const a of newAnalytics) {
          // check for analytics added
          if (!this.config.patchAnalytics.has(a)) this.analyticsToPatch.add(a);
        }
      }
      if (this.config.patchId) {
        // patching DET ID -> need to patch all current analytics
        for (const a of newAnalytics) this.analyticsToPatch.add(a);
      }
    }
    this.validateObject();
    this.loadTrackRows();
  }

  public get selectedVersion(): string {
    switch (this.versionChoice) {
      case 'major':
        return this.nextMajorVersion;
      case 'minor':
        return this.nextMinorVersion;
      default:
        return this.currentVersion;
    }
  }

  public get selectedVersionLabel(): string {
    return `v${this.selectedVersion}`;
  }

  public get statusRows(): TrackRow[] {
    return this.trackRows.filter(row => row.enrolled || row.selected);
  }

  public get hasStatusRows(): boolean {
    return this.statusRows.length > 0;
  }

  public get enrollmentOptions(): TrackRow[] {
    const search = this.getEnrollmentSearchText().toLowerCase().trim();
    return this.trackRows
      .filter(row => !row.enrolled && !row.selected)
      .filter(row => !search || row.name.toLowerCase().includes(search));
  }

  public onConfirmSave(): void {
    switch (this.versionChoice) {
      case 'major':
        this.saveNextMajorVersion();
        return;
      case 'minor':
        this.saveNextMinorVersion();
        return;
      default:
        this.saveCurrentVersion();
    }
  }

  public displayTrack(track: TrackRow | string): string {
    if (typeof track === 'string') return track;
    return track?.name || '';
  }

  public selectEnrollmentTrack(event): void {
    const row = event?.option?.value as TrackRow;
    if (!row) return;

    row.selected = true;
    this.enrollmentSearch = '';
  }

  /**
   * Find objects with links to the previous object ATT&CK ID
   */
  private parse_patches(): void {
    this.stage = 1; // enter patching stage
    const objSubscription = this.restApiService
      .getAllObjects({ deserialize: true })
      .subscribe({
        next: results => {
          // find objects with a link to the previous ID
          const objLink = `(LinkById: ${this.config.patchId})`;
          results.data.forEach(x => {
            if (
              this.config.patchId &&
              (x.description?.indexOf(objLink) !== -1 ||
                ('detection' in x && x.detection?.indexOf(objLink) !== -1))
            ) {
              this.patch_objects.push(x);
              return; // already added as a patch object, continue
            }

            // update analytics referencing the old detection strategy url
            if (
              this.analyticsToPatch.size &&
              this.analyticsToPatch.has(x.stixID)
            ) {
              this.patch_objects.push(x);
              return; // already added as a patch object, continue
            }
          });

          // check if the object iself needs to be patched
          if (
            this.config.object.description?.indexOf(objLink) !== -1 ||
            ('detection' in this.config.object &&
              (this.config.object.detection as string)?.indexOf(objLink) !== -1)
          ) {
            this.patchObject(this.config.object); // calls patchObject() directly to avoid saving the object twice
          }

          this.stage = 2;
        },
        complete: () => objSubscription.unsubscribe(),
      });
  }

  private patchObject(obj): void {
    if (this.config.patchId) {
      // replace LinkById references with the new ATT&CK ID
      const regex = new RegExp(
        `\\(LinkById: (${this.config.patchId})\\)`,
        'gmu'
      );
      obj.description = obj.description.replace(
        regex,
        `(LinkById: ${this.config.object.attackID})`
      );
      if ('detection' in obj && obj.detection) {
        obj.detection = obj.detection.replace(
          regex,
          `(LinkById: ${this.config.object.attackID})`
        );
      }
    }

    if (this.analyticsToPatch.has(obj.stixID)) {
      // update the related detection so the analytic url is serialized correctly
      const det = this.config.object as DetectionStrategy;
      if (det?.analytics.includes(obj.stixID)) {
        // set related detection to this DET
        obj.relatedDetections = [
          {
            stixId: det.stixID,
            name: det.name,
            attackId: det.attackID,
            type: det.type,
          },
        ];
      } else {
        // analytic was removed, remove related DET
        obj.relatedDetections = undefined;
      }
    }
  }

  /**
   * Apply LinkById patches and save the object
   */
  public patch() {
    const saves = [];
    for (const obj of this.patch_objects) {
      this.patchObject(obj);
      if (obj.stixID !== this.config.object.stixID)
        saves.push(obj.save(this.restApiService));
    }
    this.stage = 3; // enter loading stage until patching is complete
    const saveSubscription = forkJoin(saves).subscribe({
      complete: () => {
        saveSubscription.unsubscribe();
        this.save();
      },
    });
  }

  /**
   * Save the object with the current version and check for patches
   */
  public saveCurrentVersion() {
    this.config.object.workflow = this.newState
      ? { state: this.newState }
      : undefined;
    if (this.config.patchId || this.config.patchAnalytics) this.parse_patches();
    else this.save();
  }

  /**
   * Save the object with the next minor version (i.e. 1.0 -> 1.1) and check for patches
   */
  public saveNextMinorVersion() {
    this.config.object.version = new VersionNumber(this.nextMinorVersion);
    this.config.object.workflow = this.newState
      ? { state: this.newState }
      : undefined;
    if (this.config.patchId || this.config.patchAnalytics) this.parse_patches();
    else this.save();
  }

  /**
   * Save the object with the next major version (i.e. 1.0 -> 2.0) and check for patches
   */
  public saveNextMajorVersion() {
    this.config.object.version = new VersionNumber(this.nextMajorVersion);
    this.config.object.workflow = this.newState
      ? { state: this.newState }
      : undefined;
    if (this.config.patchId || this.config.patchAnalytics) this.parse_patches();
    else this.save();
  }

  private saveObject() {
    return this.config.object.save(this.restApiService); // save this object
  }

  /**
   * Save the object without patching other objects
   */
  private save() {
    if (!this.saveEnabled) {
      return;
    }
    this.config.object.workflow = this.newState
      ? { state: this.newState }
      : undefined;
    const sub = this.saveObject()
      .pipe(switchMap(() => this.syncTracks()))
      .subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        complete: () => sub.unsubscribe(),
      });
  }

  private loadTrackRows(): void {
    if (
      !this.config.object?.stixID ||
      this.config.object.attackType === 'relationship'
    ) {
      this.trackRows = [];
      return;
    }

    this.loadingTracks = true;
    this.releaseTracksService
      .listReleaseTracks({ type: 'standard' })
      .pipe(
        switchMap(tracksResult => {
          const tracks = this.getTrackList(tracksResult);
          if (!tracks.length) return of([]);
          const workspaceTracksByTrack = this.getWorkspaceTracksById();

          return forkJoin(
            tracks.map(track => {
              const trackId = this.getTrackId(track);
              const workspaceTrack = trackId
                ? workspaceTracksByTrack.get(trackId) || null
                : null;

              if (!trackId || !workspaceTrack) {
                return of(this.toTrackRow(track, null, workspaceTrack));
              }

              return this.releaseTracksService
                .getLatestSnapshot(trackId, {
                  format: ExportFormat.Workbench,
                  include: 'all',
                })
                .pipe(
                  map(snapshot =>
                    this.toTrackRow(track, snapshot, workspaceTrack)
                  ),
                  catchError(err => {
                    logger.error(
                      'Failed to load release track snapshot for save dialog',
                      err
                    );
                    return of(this.toTrackRow(track, null, workspaceTrack));
                  })
                );
            })
          );
        }),
        catchError(err => {
          logger.error('Failed to load release tracks for save dialog', err);
          return of([]);
        })
      )
      .subscribe({
        next: rows => {
          this.trackRows = rows;
          this.loadingTracks = false;
        },
        error: err => {
          logger.error(err);
          this.trackRows = [];
          this.loadingTracks = false;
        },
      });
  }

  private toTrackRow(
    track: any,
    snapshot: any,
    workspaceTrack?: ReleaseTrackStatus | null
  ): TrackRow {
    const trackId = this.getTrackId(track) || '';
    const entry = this.getTrackedObjectEntry(snapshot);
    const tier = this.getEntryTier(entry) || workspaceTrack?.tier || null;
    const status =
      this.getEntryWorkflowStatus(entry) ||
      workspaceTrack?.status ||
      this.getFallbackWorkflowStatus(tier);

    return {
      trackId,
      name:
        track?.name ||
        snapshot?.name ||
        workspaceTrack?.name ||
        trackId ||
        'Release track',
      tier,
      status,
      objectRef: entry
        ? this.getObjectRef(entry)
        : workspaceTrack?.objectRef || this.config.object.stixID,
      enrolled: !!entry || !!workspaceTrack,
      selected: false,
    };
  }

  private getTrackedObjectEntry(snapshot: any): any | null {
    if (!snapshot) return null;
    return (
      this.getSnapshotWorkflowEntries(snapshot).find(
        entry => this.getEntryObjectRef(entry) === this.config.object.stixID
      ) || null
    );
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

  private validateObject(): void {
    const requestId = ++this.validationRequestId;
    this.validation = null;
    this.validating = true;

    this.config.object
      .validate(this.restApiService, this.validationReviewStatus)
      .subscribe({
        next: result => {
          if (requestId !== this.validationRequestId) return;
          this.applyValidationResult(result);
        },
        error: err => {
          if (requestId !== this.validationRequestId) return;
          logger.error(err);
        },
        complete: () => {
          if (requestId === this.validationRequestId) {
            this.validating = false;
          }
        },
      });
  }

  private applyValidationResult(result: ValidationData): void {
    // tell the user version has been incremented, but not if the version has an error
    if (
      this.config.versionAlreadyIncremented &&
      !result.errors.some(x => x.field == 'version')
    ) {
      result.info.push({
        field: 'version',
        result: 'info',
        message: 'version has already been changed',
      });
    }
    this.validation = result;
  }

  private getWorkflowStatusLabel(status: WorkflowStatusType): string {
    return WORKFLOW_STATUS_LABELS[status] || status;
  }

  private syncTracks(): Observable<unknown> {
    const rows = this.trackRows.filter(row => row.enrolled || row.selected);
    if (!rows.length) return of(null);

    return forkJoin(
      rows.map(row =>
        this.syncTrack(row).pipe(
          catchError(err => {
            logger.error('Failed to update release track object status', err);
            return of(null);
          })
        )
      )
    );
  }

  private syncTrack(row: TrackRow): Observable<unknown> {
    if (!row.trackId) return of(null);
    return this.addCandidateToTrack(row);
  }

  private addCandidateToTrack(row: TrackRow): Observable<unknown> {
    return this.releaseTracksService.addCandidates(row.trackId, [
      this.config.object.stixID,
    ]);
  }

  private getTrackList(result: any): any[] {
    if (Array.isArray(result?.data)) return result.data;
    if (Array.isArray(result?.release_tracks)) return result.release_tracks;
    if (Array.isArray(result)) return result;
    return [];
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

  private getWorkspaceTracksById(): Map<string, ReleaseTrackStatus> {
    const releaseTracks = this.config.object?.workspace?.release_tracks;
    if (!Array.isArray(releaseTracks)) return new Map();

    return releaseTracks.reduce((lookup, track) => {
      const ref = this.toWorkspaceTrack(track);
      if (ref && !lookup.has(ref.trackId)) lookup.set(ref.trackId, ref);
      return lookup;
    }, new Map<string, ReleaseTrackStatus>());
  }

  private toWorkspaceTrack(track: any): ReleaseTrackStatus | null {
    const trackId = typeof track === 'string' ? track : this.getTrackId(track);
    if (!trackId) return null;
    const tier = typeof track === 'string' ? null : this.getEntryTier(track);
    const status =
      typeof track === 'string'
        ? WorkflowStatus.WorkInProgress
        : this.getEntryWorkflowStatus(track) ||
          this.getFallbackWorkflowStatus(tier);

    return {
      trackId,
      name: typeof track === 'string' ? '' : track.name || track.track_name,
      description: typeof track === 'string' ? '' : track.description || '',
      tier,
      status,
      objectRef:
        typeof track === 'string'
          ? this.config.object.stixID
          : this.getWorkspaceObjectRef(track),
    };
  }

  private getWorkspaceObjectRef(track: any): StixObjectRef {
    const modified =
      this.toIsoString(track?.object_modified) ||
      this.toIsoString(track?.modified) ||
      this.config.object.modified?.toISOString();

    return modified
      ? {
          id: track?.object_ref || track?.ref || this.config.object.stixID,
          modified,
        }
      : track?.object_ref || track?.ref || this.config.object.stixID;
  }

  private getEntryObjectRef(entry: any): string | null {
    return entry?.object_ref || entry?.ref || entry?.id || null;
  }

  private toIsoString(value: any): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }

  private getEnrollmentSearchText(): string {
    return this.displayTrack(this.enrollmentSearch);
  }
}

type SaveVersionChoice = 'keep' | 'minor' | 'major';
type ValidationStatus = 'success' | 'warning' | 'error';

interface TrackRow {
  trackId: string;
  name: string;
  tier: ReleaseTrackObjectTier | null;
  status: WorkflowStatusType;
  objectRef: StixObjectRef;
  enrolled: boolean;
  selected: boolean;
}

export interface SaveDialogConfig {
  object: StixObject;
  patchId?: string; // previous object ID to patch in LinkByID tags
  patchAnalytics?: Set<string>; // previous list of analytics related to a detection strategy
  versionAlreadyIncremented: boolean;
  initialWorkflowState?: WorkflowStatusType;
}
