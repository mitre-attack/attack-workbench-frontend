import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuTrigger } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ExportFormat, SnapshotTier } from 'src/app/classes/release-tracks';
import type {
  ReleaseTrackObjectTier,
  StixObjectRef,
} from 'src/app/classes/release-tracks';
import { Relationship } from 'src/app/classes/stix/relationship';
import { StixObject } from 'src/app/classes/stix/stix-object';
import { Technique } from 'src/app/classes/stix/technique';
import { ReleaseTracksConnectorService } from 'src/app/services/connectors/rest-api/release-tracks.service';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { EditorService } from 'src/app/services/editor/editor.service';
import { WorkflowStatusDialogComponent } from 'src/app/components/workflow-status-dialog/workflow-status-dialog.component';
import {
  WORKFLOW_STATUS_OPTIONS,
  WORKFLOW_STATUS_RANK,
  WorkflowStatus,
} from 'src/app/utils/types';
import type {
  ReleaseTrackStatus,
  WorkflowStatusType,
} from 'src/app/utils/types';
import { logger } from 'src/app/utils/logger';

@Component({
  selector: 'app-name-property',
  templateUrl: './name-property.component.html',
  styleUrls: ['./name-property.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class NamePropertyComponent implements OnChanges, OnInit {
  @Input() public config: NamePropertyConfig;
  @ViewChild('workflowTriggerButton')
  private workflowTriggerButton?: ElementRef<HTMLElement>;
  public currentTargetObj?: any;
  public loaded = false;
  public statusControl: FormControl<WorkflowStatus | null>;
  public trackStatuses: ReleaseTrackStatus[] = [];
  public loadingTracks = false;
  private trackStatusLoadKey: string | null = null;
  public statusActions: WorkflowStatusAction[] = WORKFLOW_STATUS_OPTIONS.map(
    option => ({
      ...option,
      status: option.value,
      modifier: this.getWorkflowStatusModifier(option.value),
    })
  );

  public get field() {
    return this.config.field ? this.config.field : 'name';
  }

  public get object(): any {
    return Array.isArray(this.config.object)
      ? this.config.object[0]
      : this.config.object;
  }

  public get showWorkflowControl(): boolean {
    return (
      this.config.mode === 'view' &&
      this.object instanceof StixObject &&
      this.object.attackType !== 'collection'
    );
  }

  public get hasTracks(): boolean {
    return this.trackStatuses.length > 0;
  }

  /**
   * retrieve the internal link to the parent technique
   */
  public get internalParentLink(): string {
    return `/${this.config.parent.attackType}/${this.config.parent.stixID}`;
  }

  public get current() {
    return this.config.object[0] || null;
  }
  public get currentName() {
    return this.current?.[this.field] || '';
  }
  public get previous() {
    return this.config.object[1] || null;
  }
  public get previousName() {
    return this.previous?.[this.field] || '';
  }

  constructor(
    private dialog: MatDialog,
    private editorService: EditorService,
    private restAPIService: RestApiConnectorService,
    private releaseTracksService: ReleaseTracksConnectorService,
    public snackbar: MatSnackBar
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes.config) return;
    this.syncStatusControl();
    this.loadTrackStatuses();
  }

  ngOnInit(): void {
    const object = this.object;
    this.syncStatusControl();
    this.loadTrackStatuses();
    if (this.config.mode !== 'diff' && object.revoked) {
      // retrieve revoking object
      const data$ = this.restAPIService.getRelatedTo({
        sourceRef: object.stixID,
        relationshipType: 'revoked-by',
      });
      const relSubscription = data$.subscribe({
        next: data => {
          const relationship = data.data[0] as Relationship;
          this.currentTargetObj = relationship.target_object as Technique;
          this.loaded = true;
        },
        complete: () => {
          relSubscription.unsubscribe();
        },
      });
    }
  }

  public getStatus(obj: StixObject): string {
    if (obj?.['revoked']) return 'revoked';
    else if (obj?.['deprecated']) return 'deprecated';
    return '';
  }

  public openStatusDialog(
    targetStatus: WorkflowStatusType,
    menuTrigger: MatMenuTrigger | undefined,
    track: ReleaseTrackStatus
  ): void {
    menuTrigger?.closeMenu();
    const previousWorkflowState =
      this.object?.workflow?.state || WorkflowStatus.WorkInProgress;
    const dialogRef = this.dialog.open(WorkflowStatusDialogComponent, {
      maxWidth: '760px',
      maxHeight: '86vh',
      panelClass: 'workflow-status-dialog-panel',
      backdropClass: 'workflow-status-dialog-backdrop',
      data: {
        object: this.object,
        targetStatus,
        track,
      },
      autoFocus: false,
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.statusControl.setValue(targetStatus);
        this.getTrackStatuses();
        this.editorService.onReload.emit();
      } else {
        this.statusControl.setValue(previousWorkflowState);
      }
    });
  }

  public isStatusActive(
    row: ReleaseTrackStatus,
    status: WorkflowStatusType
  ): boolean {
    return row.status === status;
  }

  public isStatusDisabled(
    row: ReleaseTrackStatus,
    status: WorkflowStatusType
  ): boolean {
    return WORKFLOW_STATUS_RANK[status] <= WORKFLOW_STATUS_RANK[row.status];
  }

  private syncStatusControl(): void {
    const state = this.object?.workflow?.state || WorkflowStatus.WorkInProgress;
    if (!this.statusControl) {
      this.statusControl = new FormControl(state);
      return;
    }
    this.statusControl.setValue(state, { emitEvent: false });
  }

  private loadTrackStatuses(): void {
    if (!this.showWorkflowControl) {
      this.trackStatuses = [];
      this.trackStatusLoadKey = null;
      return;
    }

    const loadKey = this.getTrackStatusLoadKey();
    if (loadKey === this.trackStatusLoadKey) return;
    this.trackStatusLoadKey = loadKey;
    this.getTrackStatuses();
  }

  private getTrackStatusLoadKey(): string {
    const object = this.object;
    const releaseTracks = Array.isArray(object?.workspace?.release_tracks)
      ? object.workspace.release_tracks
      : [];
    const trackKey = releaseTracks
      .map(track => {
        if (typeof track === 'string') return track;
        return [
          this.getTrackId(track),
          this.getEntryWorkflowStatus(track),
          this.getEntryTier(track),
          this.toIsoString(track?.object_modified || track?.modified),
        ].join(':');
      })
      .join('|');

    return [
      this.config?.mode || 'view',
      object?.stixID || '',
      this.toIsoString(object?.modified),
      trackKey,
    ].join('|');
  }

  private getTrackStatuses(): void {
    if (!this.object?.stixID) {
      this.trackStatuses = [];
      return;
    }

    this.loadingTracks = true;
    const releaseTracks = this.getWorkspaceTracks();
    if (!releaseTracks.length) {
      this.trackStatuses = [];
      this.loadingTracks = false;
      return;
    }

    forkJoin(
      releaseTracks.map(track =>
        this.releaseTracksService
          .getLatestSnapshot(track.trackId, {
            format: ExportFormat.Workbench,
            include: 'all',
          })
          .pipe(
            map(snapshot => this.toTrackStatus(track, snapshot)),
            catchError(err => {
              logger.error(
                'Failed to load release track snapshot for workflow status menu',
                err
              );
              return of(this.toTrackStatus(track, null));
            })
          )
      )
    )
      .pipe(
        map(rows =>
          rows.filter((row): row is ReleaseTrackStatus => row !== null)
        )
      )
      .subscribe({
        next: rows => {
          this.trackStatuses = rows;
          this.loadingTracks = false;
        },
        error: err => {
          logger.error(err);
          this.trackStatuses = [];
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
      name: snapshot?.name || track.name || this.getTrackId(track) || '',
      description: snapshot?.description || track.description || '',
      tier,
      status,
      objectRef: entry ? this.getObjectRef(entry) : track.objectRef,
    };
  }

  private getWorkspaceTracks(): ReleaseTrackStatus[] {
    const releaseTracks = this.object?.workspace?.release_tracks;
    if (!Array.isArray(releaseTracks)) return [];

    const seen = new Set<string>();
    return releaseTracks
      .map(track => this.toWorkspaceTrack(track))
      .filter((track): track is ReleaseTrackStatus => !!track)
      .filter(track => {
        if (seen.has(track.trackId)) return false;
        seen.add(track.trackId);
        return true;
      });
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
          ? this.object.stixID
          : this.getWorkspaceObjectRef(track),
    };
  }

  private getTrackedObjectEntry(snapshot: any): any | null {
    if (!snapshot) return null;
    return (
      this.getSnapshotWorkflowEntries(snapshot).find(
        entry => this.getEntryObjectRef(entry) === this.object.stixID
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

  private getWorkflowStatusModifier(
    status: WorkflowStatusType
  ): WorkflowStatusAction['modifier'] {
    switch (status) {
      case WorkflowStatus.AwaitingReview:
        return 'awaiting-review';
      case WorkflowStatus.Reviewed:
        return 'reviewed';
      default:
        return 'wip';
    }
  }

  private getEntryObjectRef(entry: any): string | null {
    return entry?.object_ref || entry?.ref || entry?.id || null;
  }

  private getObjectRef(entry: any): StixObjectRef {
    const modified =
      this.toIsoString(entry.object_modified) ||
      this.toIsoString(entry.modified) ||
      this.object.modified?.toISOString();

    return modified
      ? {
          id: this.getEntryObjectRef(entry) || this.object.stixID,
          modified,
        }
      : this.getEntryObjectRef(entry) || this.object.stixID;
  }

  private getWorkspaceObjectRef(track: any): StixObjectRef {
    const modified =
      this.toIsoString(track?.object_modified) ||
      this.toIsoString(track?.modified) ||
      this.object.modified?.toISOString();

    return modified
      ? {
          id: track?.object_ref || track?.ref || this.object.stixID,
          modified,
        }
      : track?.object_ref || track?.ref || this.object.stixID;
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
}

export interface NamePropertyConfig {
  /* What is the current mode? Default: 'view
   *    view: viewing the list property
   *    edit: editing the list property
   *    diff: displaying the diff between two STIX objects. If this mode is selected, two StixObjects must be specified in the objects field
   */
  mode?: 'view' | 'edit' | 'diff';
  /* The object to show the field of
   * Note: if mode is diff, pass an array of two objects to diff
   */
  object: StixObject | [StixObject, StixObject];
  /* The parent object. If specified, the object name will be
   * prefixed with the name of the parent
   */
  parent?: StixObject;
  /* the field of the object(s) to visualize as a name
   * If unspecified, uses 'name' field as defined on StixObject
   */
  field?: string;
}

interface WorkflowStatusAction {
  label: string;
  status: WorkflowStatusType;
  modifier: 'wip' | 'awaiting-review' | 'reviewed';
}
