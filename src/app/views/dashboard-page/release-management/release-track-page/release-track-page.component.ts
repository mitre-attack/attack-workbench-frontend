import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ConflictPolicy,
  ConflictPolicyType,
  ExportFormat,
  ExportFormatType,
  MemberSyncBehavior,
  MemberSyncBehaviorType,
  MemberSyncPolicy,
  MemberSyncPolicyType,
  MemberSyncStrategy,
  MemberSyncStrategyType,
  ReleaseTrackConfig,
  ReleaseTrackSnapshot,
  ReleaseTrackSnapshotHistoryItem,
  ReleaseTrackType,
  StixObjectRef,
} from 'src/app/classes/release-tracks';
import { ReleaseTracksConnectorService } from 'src/app/services/connectors/rest-api/release-tracks.service';
import { BreadcrumbService } from 'src/app/services/helpers/breadcrumb.service';
import { MatDialog } from '@angular/material/dialog';
import { SelectionModel } from '@angular/cdk/collections';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { AddDialogComponent } from 'src/app/components/add-dialog/add-dialog.component';
import { StixTypeToAttackType } from 'src/app/utils/type-mappings';
import {
  StixType,
  WorkflowStatus,
  WorkflowStatusType,
} from 'src/app/utils/types';
import { MultipleChoiceDialogComponent } from 'src/app/components/multiple-choice-dialog/multiple-choice-dialog.component';
import { finalize, take } from 'rxjs/operators';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ReleaseTrackObjectItem } from 'src/app/components/release-track-object-card/release-track-object-card.component';

type ReleaseTrackLaneType = 'candidate' | 'staged' | 'member';

interface ReleaseTrackWorkspaceLane {
  key: string;
  title: string;
  type: ReleaseTrackLaneType;
  modifier: string;
  items: ReleaseTrackObjectItem[];
  emptyLabel: string;
  statusFallback: WorkflowStatusType;
  isReleasedMembers?: boolean;
}

interface SnapshotMemberRef {
  object_ref: string;
  object_modified?: string;
}

interface SnapshotHistoryViewModel {
  snapshot: ReleaseTrackSnapshotHistoryItem;
  title: string;
  created: Date | null;
  modified: string | null;
  isTagged: boolean;
  addedCount: number;
  modifiedCount: number;
  totalObjects: number;
}

interface ReleaseTrackConfigFormValue {
  autoPromote: boolean;
  candidacyThreshold: WorkflowStatusType | null;
  memberSyncStrategy: MemberSyncStrategyType;
  memberSyncSupplantBehavior: MemberSyncBehaviorType;
  memberSyncSupplantStatusPolicy: MemberSyncPolicyType;
  candidatesToStagedConflict: ConflictPolicyType;
  stagedToMembersConflict: ConflictPolicyType;
  includeSecondaryObjects: boolean;
  secondaryObjectThreshold: WorkflowStatusType;
}

@Component({
  selector: 'app-release-track-page',
  standalone: false,
  templateUrl: './release-track-page.component.html',
  styleUrls: ['./release-track-page.component.scss'],
})
export class ReleaseTrackPageComponent implements OnInit {
  public id = '';
  public releaseTrack: ReleaseTrackSnapshot | null = null;
  public showReleasedMembers = false;
  public descriptionDraft = '';
  public isEditingDescription = false;
  public isSavingDescription = false;
  public isCreatingDraft = false;
  public isLoadingSnapshotHistory = false;
  public isReleasing = false;
  public isLoadingConfig = false;
  public isEditingConfig = false;
  public isSavingConfig = false;
  public releaseTrackConfig: ReleaseTrackConfig = {};
  public snapshotHistory: SnapshotHistoryViewModel[] = [];
  public configForm: FormGroup;

  public candidacyOptions = Object.values(WorkflowStatus);
  public memberSyncStrategyOptions = Object.values(MemberSyncStrategy);
  public memberSyncBehaviorOptions = Object.values(MemberSyncBehavior);
  public memberSyncStatusPolicyOptions = Object.values(MemberSyncPolicy);
  public candidatesToStagedConflictOptions = Object.values(
    ConflictPolicy
  ).filter(policy => policy !== ConflictPolicy.Abort);
  public stagedToMembersConflictOptions = Object.values(ConflictPolicy);

  constructor(
    private connector: ReleaseTracksConnectorService,
    private breadcrumbService: BreadcrumbService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private restApiConnectorService: RestApiConnectorService,
    private fb: FormBuilder
  ) {
    this.configForm = this.fb.group({
      autoPromote: [true],
      candidacyThreshold: [WorkflowStatus.Reviewed],
      memberSyncStrategy: [MemberSyncStrategy.Manual],
      memberSyncSupplantBehavior: [MemberSyncBehavior.Replace],
      memberSyncSupplantStatusPolicy: [MemberSyncPolicy.Preserve],
      candidatesToStagedConflict: [ConflictPolicy.PreferLatest],
      stagedToMembersConflict: [ConflictPolicy.Abort],
      includeSecondaryObjects: [false],
      secondaryObjectThreshold: [WorkflowStatus.Reviewed],
    });
    this.configForm.get('autoPromote')?.valueChanges.subscribe(autoPromote => {
      this.syncCandidacyThresholdControl(!!autoPromote);
    });
    this.configForm
      .get('includeSecondaryObjects')
      ?.valueChanges.subscribe(includeSecondaryObjects => {
        this.syncSecondaryObjectThresholdControl(!!includeSecondaryObjects);
      });
    this.syncSecondaryObjectThresholdControl(false);
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      if (this.id !== params.id) this.showReleasedMembers = false;
      this.id = params.id;
      if (this.id) {
        this.getReleaseTrack();
        this.getSnapshotHistory();
        this.getConfig();
      }
    });
  }

  public get releaseTrackName(): string {
    return this.releaseTrack?.name ?? '';
  }

  public get releaseTrackDescription(): string {
    return this.releaseTrack?.description?.trim() ?? '';
  }

  public get candidates(): any[] {
    return this.releaseTrack?.candidates ?? [];
  }

  public get staged(): any[] {
    return this.releaseTrack?.staged ?? [];
  }

  public get members(): any[] {
    return this.releaseTrack?.members ?? [];
  }

  public get autoPromotionEnabled(): boolean {
    return !!this.releaseTrack?.config?.auto_promote;
  }

  public get workspaceLanes(): ReleaseTrackWorkspaceLane[] {
    if (this.autoPromotionEnabled) {
      return [
        {
          key: 'candidates-wip',
          title: 'Candidates WIP',
          type: 'candidate',
          modifier: 'candidates',
          items: this.candidates.filter(
            item => this.getObjectStatus(item) === WorkflowStatus.WorkInProgress
          ),
          emptyLabel: 'No work in progress candidates',
          statusFallback: WorkflowStatus.WorkInProgress,
        },
        {
          key: 'candidates-awaiting-review',
          title: 'Candidates Awaiting Review',
          type: 'candidate',
          modifier: 'awaiting-review',
          items: this.candidates.filter(
            item => this.getObjectStatus(item) === WorkflowStatus.AwaitingReview
          ),
          emptyLabel: 'No candidates awaiting review',
          statusFallback: WorkflowStatus.AwaitingReview,
        },
        {
          key: 'staged',
          title: 'Staged',
          type: 'staged',
          modifier: 'staged',
          items: this.staged,
          emptyLabel: 'No staged objects',
          statusFallback: WorkflowStatus.Reviewed,
        },
        this.releasedMembersLane,
      ];
    }

    return [
      {
        key: 'candidates',
        title: 'Candidates',
        type: 'candidate',
        modifier: 'candidates',
        items: this.candidates,
        emptyLabel: 'No candidates',
        statusFallback: WorkflowStatus.WorkInProgress,
      },
      {
        key: 'staged',
        title: 'Staged',
        type: 'staged',
        modifier: 'staged',
        items: this.staged,
        emptyLabel: 'No staged objects',
        statusFallback: WorkflowStatus.Reviewed,
      },
      this.releasedMembersLane,
    ];
  }

  private get releasedMembersLane(): ReleaseTrackWorkspaceLane {
    return {
      key: 'released-members',
      title: 'Released Members',
      type: 'member',
      modifier: 'members',
      items: this.members,
      emptyLabel: 'No released members',
      statusFallback: WorkflowStatus.Reviewed,
      isReleasedMembers: true,
    };
  }

  public get isVirtualReleaseTrack(): boolean {
    return this.releaseTrack?.type === ReleaseTrackType.Virtual;
  }

  public get canCreateDraft(): boolean {
    return !!this.id && this.isVirtualReleaseTrack && !this.isCreatingDraft;
  }

  public getReleaseTrack(): void {
    this.connector
      .getLatestSnapshot(this.id, { include: 'all' })
      .pipe(take(1))
      .subscribe({
        next: res => {
          this.releaseTrack = res;
          if (!this.releaseTrack) return;

          this.breadcrumbService.changeBreadcrumb(
            this.route.snapshot,
            this.releaseTrack.name
          );

          if (!this.isEditingConfig && this.releaseTrack.config) {
            this.setConfig(this.releaseTrack.config);
          }

          // this.loadCandidates();
        },
      });
  }

  private refreshReleaseTrackState(): void {
    this.getReleaseTrack();
    this.getSnapshotHistory();
  }

  public getSnapshotHistory(): void {
    if (!this.id) return;

    this.isLoadingSnapshotHistory = true;
    this.connector
      .listSnapshots(this.id)
      .pipe(
        take(1),
        finalize(() => {
          this.isLoadingSnapshotHistory = false;
        })
      )
      .subscribe({
        next: snapshots => {
          this.snapshotHistory = this.buildSnapshotHistory(snapshots);
        },
        error: err => {
          console.error('Failed to load release track snapshot history', err);
        },
      });
  }

  public getConfig(): void {
    if (!this.id) return;

    this.isLoadingConfig = true;
    this.connector
      .getConfig(this.id)
      .pipe(
        take(1),
        finalize(() => {
          this.isLoadingConfig = false;
        })
      )
      .subscribe({
        next: config => {
          if (!this.isEditingConfig) {
            this.setConfig(
              this.getConfigFromResponse(config, this.releaseTrack?.config)
            );
          }
        },
        error: err => {
          console.error('Failed to load release track config', err);
        },
      });
  }

  /**
   * Load candidates using ReleaseTracksConnectorService.listCandidates()
   */
  // private loadCandidates(): void {
  //   if (!this.id) return;
  //   const sub = this.connector.listCandidates(this.id).subscribe({
  //     next: res => {
  //       const list = (res && (res as any).data) ? (res as any).data : (Array.isArray(res) ? res : []);
  //       this._candidates = list as any[];
  //       if (this.releaseTrack) this.releaseTrack.candidates = this._candidates;
  //     },
  //     error: err => {
  //       console.error('Failed to list candidates for track', this.id, err);
  //     },
  //     complete: () => sub.unsubscribe(),
  //   });
  // }

  public onAddCandidate(): void {
    if (!this.releaseTrack) return;

    const selection = new SelectionModel<string>(true);

    const sub = this.restApiConnectorService
      .getAllObjects({ deserialize: true })
      .subscribe({
        next: results => {
          const objects = (results as any).data || [];

          const dialogRef = this.dialog.open(AddDialogComponent, {
            data: {
              selectableObjects: objects,
              select: selection,
              type: 'all',
              selectionType: 'many',
              buttonLabel: 'Add',
              title: 'Add candidates',
              clearSelection: true,
            },
            maxWidth: '70em',
            minWidth: '40vw',
            maxHeight: '75vh',
          });

          const closeSub = dialogRef.afterClosed().subscribe({
            next: result => {
              if (!result) return; // user cancelled

              const objectRefs: any[] = selection.selected.map(stixId => {
                const obj = objects.find(
                  (o: any) =>
                    o.stixID === stixId || (o.stix && o.stix.id === stixId)
                );
                const id = obj ? obj.stixID || obj.stix?.id : stixId;
                let modified: string | undefined;
                if (obj) {
                  if (obj.modified instanceof Date)
                    modified = obj.modified.toISOString();
                  else if (obj.modified) modified = obj.modified;
                  else if (obj.stix && obj.stix.modified)
                    modified = obj.stix.modified;
                }
                return modified ? { id, modified } : id;
              });

              const apiSub = this.connector
                .addCandidates(this.id, objectRefs)
                .subscribe({
                  next: () => {
                    // refresh snapshot from server so local state reflects saved candidates
                    this.refreshReleaseTrackState();
                  },
                  error: err => {
                    console.error('Failed to add candidates', err);
                  },
                  complete: () => apiSub.unsubscribe(),
                });
            },
            complete: () => closeSub.unsubscribe(),
          });
        },
        complete: () => sub.unsubscribe(),
      });
  }

  public getViewUrl(stixId: string): string {
    const stixType = stixId.split('-')[0] as StixType;
    return `/${StixTypeToAttackType[stixType]}/${stixId}`;
  }

  public promote(objectIds: string[]): void {
    if (!objectIds.length) return;
    const sub = this.connector.promoteCandidates(this.id, objectIds).subscribe({
      next: () => {
        this.refreshReleaseTrackState();
      },
      error: err => {
        console.error('Failed to promote candidates', err);
      },
      complete: () => sub.unsubscribe(),
    });
  }

  public onPromoteAll(): void {
    if (!this.id || !this.releaseTrack) return;
    const candidateIds: string[] = this.candidates
      .map(c => c.object_ref)
      .filter((r: any) => !!r);
    this.promote(candidateIds);
  }

  public onPromote(candidateId: string): void {
    if (!this.id || !candidateId) return;
    this.promote([candidateId]);
  }

  public demote(objectRefs: StixObjectRef[]): void {
    if (!objectRefs.length) return;
    const sub = this.connector.demoteStaged(this.id, objectRefs).subscribe({
      next: () => {
        this.refreshReleaseTrackState();
      },
      error: err => {
        console.error('Failed to demote staged objects', err);
      },
      complete: () => sub.unsubscribe(),
    });
  }

  public onDemoteAll(): void {
    if (!this.id || !this.releaseTrack) return;
    const stagedRefs: StixObjectRef[] = this.staged
      .map(s => {
        return {
          id: s.object_ref,
          modified: s.object_modified,
        };
      })
      .filter((s: any) => !!s);
    this.demote(stagedRefs);
  }

  public onDemote(staged: any): void {
    if (!this.id || !staged) return;
    const stagedRef: StixObjectRef = {
      id: staged.object_ref,
      modified: staged.object_modified,
    };
    this.demote([stagedRef]);
  }

  public onView(id: string): void {
    this.router.navigate([this.getViewUrl(id)]);
  }

  public onDiff(item: any): void {
    // TODO: open diff modal for item
    console.log('onDiff', item);
  }

  public onReviewAndApprove(item: any): void {
    this.reviewCandidateStatus(
      WorkflowStatus.AwaitingReview,
      WorkflowStatus.Reviewed,
      [item]
    );
  }

  public canAddCandidates(lane: ReleaseTrackWorkspaceLane): boolean {
    return lane.key === 'candidates' || lane.key === 'candidates-wip';
  }

  public canReviewAndApprove(
    item: ReleaseTrackObjectItem,
    lane: ReleaseTrackWorkspaceLane
  ): boolean {
    return (
      this.autoPromotionEnabled &&
      lane.type === 'candidate' &&
      this.getLaneStatus(item, lane) === WorkflowStatus.AwaitingReview
    );
  }

  public canManuallyPromote(lane: ReleaseTrackWorkspaceLane): boolean {
    return !this.autoPromotionEnabled && lane.type === 'candidate';
  }

  public canManuallyDemote(lane: ReleaseTrackWorkspaceLane): boolean {
    return !this.autoPromotionEnabled && lane.type === 'staged';
  }

  public getLaneStatus(
    item: ReleaseTrackObjectItem,
    lane: ReleaseTrackWorkspaceLane
  ): WorkflowStatusType {
    return item.object_status || lane.statusFallback;
  }

  public shouldShowLaneDescription(lane: ReleaseTrackWorkspaceLane): boolean {
    return this.autoPromotionEnabled && !lane.isReleasedMembers;
  }

  public toggleReleasedMembers(): void {
    this.showReleasedMembers = !this.showReleasedMembers;
  }

  public onEditDescription(): void {
    this.descriptionDraft = this.releaseTrack?.description ?? '';
    this.isEditingDescription = true;
  }

  public onCancelDescriptionEdit(): void {
    this.descriptionDraft = '';
    this.isEditingDescription = false;
  }

  public onSaveDescription(): void {
    if (!this.id || !this.releaseTrack || this.isSavingDescription) return;

    const description = this.descriptionDraft.trim();
    if (description === this.releaseTrackDescription) {
      this.onCancelDescriptionEdit();
      return;
    }

    this.isSavingDescription = true;
    this.connector
      .updateMetadataByLatest(this.id, { description })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.isEditingDescription = false;
          this.descriptionDraft = '';
          this.getReleaseTrack();
        },
        error: err => {
          this.isSavingDescription = false;
          console.error('Failed to update release track description', err);
        },
        complete: () => {
          this.isSavingDescription = false;
        },
      });
  }

  public trackByLaneKey(
    _index: number,
    lane: ReleaseTrackWorkspaceLane
  ): string {
    return lane.key;
  }

  public trackByObjectRef(
    _index: number,
    item: ReleaseTrackObjectItem
  ): string {
    return `${item.object_ref}-${item.object_modified || ''}`;
  }

  public onExport(): void {
    if (!this.id) return;

    const formatRef = this.dialog.open(MultipleChoiceDialogComponent, {
      width: '30em',
      autoFocus: false,
      data: {
        title: `Export latest release snapshot`,
        choices: [
          {
            label: 'STIX Bundle',
            value: 'bundle',
            description:
              'A standard STIX 2.1 JSON bundle containing all member objects of the release.',
          },
          {
            label: 'Snapshot',
            value: 'snapshot',
            description:
              'The raw release track snapshot, including tiers, version history, and configuration.',
          },
          {
            label: 'File System Store',
            value: 'filesystemstore',
            description:
              'A directory structure with individual STIX JSON files, suitable for Git releases.',
          },
          {
            label: 'Workbench Format',
            value: 'workbench',
            description:
              'A richer format including workflow statuses, metadata, and other Workbench-specific data.',
          },
        ],
      },
    });

    formatRef
      .afterClosed()
      .pipe(take(1))
      .subscribe(format => {
        if (!format) return;
        this.downloadLatestReleaseTrack(format as ExportFormat);
      });
  }

  private downloadLatestReleaseTrack(format: ExportFormatType): void {
    this.connector
      .exportLatestSnapshot(this.id, format, { include: 'all' })
      .pipe(take(1))
      .subscribe({
        next: result => {
          this.restApiConnectorService.triggerBrowserDownload(
            result,
            this.getExportFilename(format)
          );
        },
        error: err => {
          console.error('Failed to export release track', err);
        },
      });
  }

  private getExportFilename(format: ExportFormatType): string {
    const name = this.releaseTrackName || this.id || 'release-track';
    const safeName =
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'release-track';
    return `${safeName}-latest-${format}.json`;
  }

  public onDraft(): void {
    if (!this.canCreateDraft) return;

    this.isCreatingDraft = true;
    this.connector
      .createVirtualSnapshot(this.id)
      .pipe(
        take(1),
        finalize(() => {
          this.isCreatingDraft = false;
        })
      )
      .subscribe({
        next: () => {
          this.refreshReleaseTrackState();
        },
        error: err => {
          console.error('Failed to create draft snapshot', err);
        },
      });
  }

  public onEditConfig(): void {
    this.isEditingConfig = true;
  }

  public onCancelConfigEdit(): void {
    this.setConfig(this.releaseTrackConfig);
    this.isEditingConfig = false;
  }

  public onSaveConfig(): void {
    if (!this.id || this.isSavingConfig) return;

    const payload = this.getConfigPayload();
    this.isSavingConfig = true;
    this.connector
      .updateConfig(this.id, payload)
      .pipe(
        take(1),
        finalize(() => {
          this.isSavingConfig = false;
        })
      )
      .subscribe({
        next: result => {
          this.isEditingConfig = false;
          this.setConfig(this.getConfigFromResponse(result, payload));
          if (this.releaseTrack)
            this.releaseTrack.config = this.releaseTrackConfig;
          this.refreshReleaseTrackState();
        },
        error: err => {
          console.error('Failed to update release track config', err);
        },
      });
  }

  public onPreviewRelease(): void {
    if (!this.id || this.isReleasing) return;

    this.isReleasing = true;
    this.connector
      .previewBump(this.id, ExportFormat.Workbench)
      .pipe(
        take(1),
        finalize(() => {
          this.isReleasing = false;
        })
      )
      .subscribe({
        next: preview => this.openReleasePreviewDialog(preview),
        error: err => {
          console.error('Failed to preview release track bump', err);
        },
      });
  }

  public onTagSnapshot(): void {
    this.onPreviewRelease();
  }

  public onInspectSnapshot(item: SnapshotHistoryViewModel): void {
    if (!this.id || !item.modified) return;

    this.connector
      .retrieveSnapshotByModified(this.id, item.modified)
      .pipe(take(1))
      .subscribe({
        next: snapshot => {
          if (!snapshot) return;
          this.releaseTrack = snapshot;
          this.breadcrumbService.changeBreadcrumb(
            this.route.snapshot,
            snapshot.name
          );
        },
        error: err => {
          console.error('Failed to inspect release track snapshot', err);
        },
      });
  }

  public onExportSnapshot(item: SnapshotHistoryViewModel): void {
    if (!this.id || !item.modified) return;

    this.connector
      .exportSnapshotByModified(this.id, item.modified, ExportFormat.Bundle, {
        include: 'all',
      })
      .pipe(take(1))
      .subscribe({
        next: result => {
          this.restApiConnectorService.triggerBrowserDownload(
            result,
            this.getSnapshotExportFilename(item, ExportFormat.Bundle)
          );
        },
        error: err => {
          console.error('Failed to export release track snapshot', err);
        },
      });
  }

  private reviewCandidateStatus(
    from: WorkflowStatusType,
    to: WorkflowStatusType,
    items: any[]
  ): void {
    if (!this.id || !items.length) return;

    const objectRefs = items
      .map(item => this.getReviewObjectRef(item))
      .filter((ref): ref is StixObjectRef => !!ref);

    if (!objectRefs.length) return;

    this.connector
      .reviewCandidates(this.id, {
        from,
        to,
        object_refs: objectRefs,
      })
      .pipe(take(1))
      .subscribe({
        next: () => this.refreshReleaseTrackState(),
        error: err => {
          console.error('Failed to update candidate review status', err);
        },
      });
  }

  private getReviewObjectRef(item: any): StixObjectRef | null {
    if (!item?.object_ref) return null;
    const modified = this.toIsoString(item.object_modified);
    return modified ? { id: item.object_ref, modified } : item.object_ref;
  }

  private getObjectStatus(item: ReleaseTrackObjectItem): WorkflowStatusType {
    return item.object_status || WorkflowStatus.WorkInProgress;
  }

  public formatConfigOption(value: any): string {
    if (value === null || value === undefined || value === '') return 'not set';
    return String(value).replace(/[_-]+/g, ' ');
  }

  private setConfig(config: any): void {
    const normalizedConfig = this.normalizeConfig(config);
    this.releaseTrackConfig = normalizedConfig;
    this.configForm.reset(this.getConfigFormValue(normalizedConfig), {
      emitEvent: false,
    });
    this.syncCandidacyThresholdControl(!!normalizedConfig.auto_promote);
    this.syncSecondaryObjectThresholdControl(
      !!normalizedConfig.include_secondary_objects?.enabled
    );
  }

  private syncCandidacyThresholdControl(autoPromote: boolean): void {
    this.syncWorkflowStatusControl('candidacyThreshold', autoPromote);
  }

  private syncSecondaryObjectThresholdControl(
    includeSecondaryObjects: boolean
  ): void {
    this.syncWorkflowStatusControl(
      'secondaryObjectThreshold',
      includeSecondaryObjects
    );
  }

  private syncWorkflowStatusControl(
    controlName: string,
    isEnabled: boolean
  ): void {
    const thresholdControl = this.configForm.get(controlName);
    if (!thresholdControl) return;

    if (isEnabled) {
      thresholdControl.enable({ emitEvent: false });
      if (!thresholdControl.value) {
        thresholdControl.setValue(WorkflowStatus.Reviewed, {
          emitEvent: false,
        });
      }
      return;
    }

    if (!thresholdControl.value) {
      thresholdControl.setValue(WorkflowStatus.Reviewed, {
        emitEvent: false,
      });
    }
    thresholdControl.disable({ emitEvent: false });
  }

  private getConfigFromResponse(
    response: any,
    fallback?: ReleaseTrackConfig
  ): any {
    if (!response) return fallback || {};
    if (response.config) return response.config;

    const configKeys = [
      'auto_promote',
      'candidacy_threshold',
      'include_secondary_objects',
      'promotion_conflicts',
      'member_sync',
    ];
    return configKeys.some(key => key in response) ? response : fallback || {};
  }

  private normalizeConfig(config: any): ReleaseTrackConfig {
    const source = config?.config || config || {};
    const rawSupplant = source.member_sync?.supplant;
    const supplant =
      rawSupplant && typeof rawSupplant === 'object'
        ? rawSupplant
        : { behavior: rawSupplant };
    const candidatesToStagedConflict =
      source.promotion_conflicts?.candidates_to_staged === ConflictPolicy.Abort
        ? ConflictPolicy.PreferLatest
        : source.promotion_conflicts?.candidates_to_staged;
    const includeSecondaryObjects =
      typeof source.include_secondary_objects === 'boolean'
        ? { enabled: source.include_secondary_objects }
        : source.include_secondary_objects;

    return {
      auto_promote: source.auto_promote ?? true,
      candidacy_threshold:
        source.candidacy_threshold ?? WorkflowStatus.Reviewed,
      include_secondary_objects: {
        enabled: includeSecondaryObjects?.enabled ?? false,
        status_threshold:
          includeSecondaryObjects?.status_threshold ?? WorkflowStatus.Reviewed,
      },
      promotion_conflicts: {
        candidates_to_staged:
          candidatesToStagedConflict ?? ConflictPolicy.PreferLatest,
        staged_to_members:
          source.promotion_conflicts?.staged_to_members ?? ConflictPolicy.Abort,
      },
      member_sync: {
        strategy: source.member_sync?.strategy ?? MemberSyncStrategy.Manual,
        supplant: {
          behavior: supplant?.behavior ?? MemberSyncBehavior.Replace,
          status_policy: supplant?.status_policy ?? MemberSyncPolicy.Preserve,
        },
      },
    };
  }

  private getConfigFormValue(
    config: ReleaseTrackConfig
  ): ReleaseTrackConfigFormValue {
    const autoPromote = config.auto_promote ?? true;
    return {
      autoPromote,
      candidacyThreshold: config.candidacy_threshold ?? WorkflowStatus.Reviewed,
      memberSyncStrategy:
        config.member_sync?.strategy ?? MemberSyncStrategy.Manual,
      memberSyncSupplantBehavior:
        config.member_sync?.supplant?.behavior ?? MemberSyncBehavior.Replace,
      memberSyncSupplantStatusPolicy:
        config.member_sync?.supplant?.status_policy ??
        MemberSyncPolicy.Preserve,
      candidatesToStagedConflict:
        config.promotion_conflicts?.candidates_to_staged ??
        ConflictPolicy.PreferLatest,
      stagedToMembersConflict:
        config.promotion_conflicts?.staged_to_members ?? ConflictPolicy.Abort,
      includeSecondaryObjects:
        config.include_secondary_objects?.enabled ?? false,
      secondaryObjectThreshold:
        config.include_secondary_objects?.status_threshold ??
        WorkflowStatus.Reviewed,
    };
  }

  private getConfigPayload(): ReleaseTrackConfig {
    const value = this.configForm.getRawValue() as ReleaseTrackConfigFormValue;
    const payload: ReleaseTrackConfig = {
      auto_promote: value.autoPromote,
      include_secondary_objects: {
        enabled: value.includeSecondaryObjects,
        status_threshold: value.secondaryObjectThreshold,
      },
      promotion_conflicts: {
        candidates_to_staged: value.candidatesToStagedConflict,
        staged_to_members: value.stagedToMembersConflict,
      },
      member_sync: {
        strategy: value.memberSyncStrategy,
        supplant: {
          behavior: value.memberSyncSupplantBehavior,
          status_policy: value.memberSyncSupplantStatusPolicy,
        },
      },
    };

    if (value.autoPromote && value.candidacyThreshold) {
      payload.candidacy_threshold = value.candidacyThreshold;
    }

    return payload;
  }

  private openReleasePreviewDialog(preview: any): void {
    const conflicts = this.getReleaseConflicts(preview);

    if (conflicts.length) {
      this.dialog.open(MultipleChoiceDialogComponent, {
        width: '34em',
        autoFocus: false,
        data: {
          title: 'Release conflicts detected',
          description: `${conflicts.length} conflict${
            conflicts.length === 1 ? '' : 's'
          } must be resolved before this release can be tagged.`,
          choices: [
            {
              label: 'Close',
              value: 'close',
              description:
                'Review the staged and member object versions before retrying the release.',
            },
          ],
        },
      });
      return;
    }

    const minorVersion = preview?.next_version_minor || preview?.next_version;
    const majorVersion = preview?.next_version_major;
    const choices = [
      {
        label: `Minor Release${minorVersion ? ` (${minorVersion})` : ''}`,
        value: 'minor',
        description: this.getReleasePreviewDescription(preview),
      },
    ];

    if (majorVersion) {
      choices.push({
        label: `Major Release (${majorVersion})`,
        value: 'major',
        description: this.getReleasePreviewDescription(preview),
      });
    }

    const releaseRef = this.dialog.open(MultipleChoiceDialogComponent, {
      width: '34em',
      autoFocus: false,
      data: {
        title: 'Preview & release',
        description:
          'The release preview found no blocking conflicts. Choose a version bump to tag the latest draft snapshot.',
        choices,
      },
    });

    releaseRef
      .afterClosed()
      .pipe(take(1))
      .subscribe((type: 'major' | 'minor' | undefined) => {
        if (type !== 'major' && type !== 'minor') return;
        this.bumpLatestRelease(type);
      });
  }

  private bumpLatestRelease(type: 'major' | 'minor'): void {
    if (!this.id) return;

    this.isReleasing = true;
    this.connector
      .bumpByLatest(this.id, { type })
      .pipe(
        take(1),
        finalize(() => {
          this.isReleasing = false;
        })
      )
      .subscribe({
        next: () => this.refreshReleaseTrackState(),
        error: err => {
          console.error('Failed to tag release track snapshot', err);
        },
      });
  }

  private getReleaseConflicts(preview: any): any[] {
    return Array.isArray(preview?.conflicts) ? preview.conflicts : [];
  }

  private getReleasePreviewDescription(preview: any): string {
    const included =
      preview?.statistics?.included_objects ??
      preview?.release_preview?.will_include?.length ??
      preview?.staged_count ??
      0;
    const excluded =
      preview?.statistics?.excluded_objects ??
      preview?.release_preview?.will_exclude?.length ??
      preview?.candidates_count ??
      0;

    return `${included} object${included === 1 ? '' : 's'} will be included. ${
      excluded || 0
    } object${excluded === 1 ? '' : 's'} will remain out of this release.`;
  }

  private buildSnapshotHistory(
    snapshots: ReleaseTrackSnapshotHistoryItem[]
  ): SnapshotHistoryViewModel[] {
    const sorted = [...snapshots].sort(
      (a, b) => this.getSnapshotTime(b) - this.getSnapshotTime(a)
    );

    return sorted.map((snapshot, index) => {
      const previousSnapshot = sorted[index + 1];
      const currentMembers = this.getSnapshotMembers(snapshot);
      const previousMembers = previousSnapshot
        ? this.getSnapshotMembers(previousSnapshot)
        : [];

      return {
        snapshot,
        title: this.getSnapshotTitle(snapshot),
        created: this.getSnapshotDate(snapshot),
        modified: this.getSnapshotModified(snapshot),
        isTagged: this.isTaggedSnapshot(snapshot),
        addedCount: this.getAddedCount(
          snapshot,
          currentMembers,
          previousMembers
        ),
        modifiedCount: this.getModifiedCount(
          snapshot,
          currentMembers,
          previousMembers
        ),
        totalObjects: this.getSnapshotTotalObjects(snapshot, currentMembers),
      };
    });
  }

  private getSnapshotTitle(snapshot: ReleaseTrackSnapshotHistoryItem): string {
    const version = snapshot.version || snapshot.stix?.x_mitre_version;
    if (!version) return 'Draft Snapshot';
    return String(version).startsWith('v') ? String(version) : `v${version}`;
  }

  private getSnapshotDate(
    snapshot: ReleaseTrackSnapshotHistoryItem
  ): Date | null {
    const value =
      snapshot.created ||
      snapshot.modified ||
      snapshot.snapshot_id ||
      snapshot.tagged_at ||
      snapshot.stix?.modified;
    return value ? new Date(value) : null;
  }

  private getSnapshotModified(
    snapshot: ReleaseTrackSnapshotHistoryItem
  ): string | null {
    const value =
      snapshot.modified || snapshot.snapshot_id || snapshot.stix?.modified;
    if (!value) return null;
    return value instanceof Date ? value.toISOString() : String(value);
  }

  private getSnapshotTime(snapshot: ReleaseTrackSnapshotHistoryItem): number {
    return this.getSnapshotDate(snapshot)?.getTime() || 0;
  }

  private isTaggedSnapshot(snapshot: ReleaseTrackSnapshotHistoryItem): boolean {
    return !!(snapshot.version || snapshot.stix?.x_mitre_version);
  }

  private getSnapshotMembers(
    snapshot: ReleaseTrackSnapshotHistoryItem
  ): SnapshotMemberRef[] {
    const members =
      snapshot.members ||
      snapshot.contents?.members ||
      snapshot.stix?.x_mitre_contents ||
      [];

    return members
      .map((member: any) => this.getSnapshotMemberRef(member))
      .filter((member): member is SnapshotMemberRef => !!member);
  }

  private getSnapshotMemberRef(member: any): SnapshotMemberRef | null {
    if (!member) return null;

    if (typeof member === 'string') {
      return { object_ref: member };
    }

    const objectRef =
      member.object_ref ||
      member.id ||
      member.object_id ||
      member.stixID ||
      member.stix?.id;

    if (!objectRef) return null;

    const objectModified =
      member.object_modified || member.modified || member.stix?.modified;

    return {
      object_ref: objectRef,
      object_modified: objectModified
        ? this.toIsoString(objectModified)
        : undefined,
    };
  }

  private getAddedCount(
    snapshot: ReleaseTrackSnapshotHistoryItem,
    currentMembers: SnapshotMemberRef[],
    previousMembers: SnapshotMemberRef[]
  ): number {
    if (typeof snapshot.summary?.added_count === 'number') {
      return snapshot.summary.added_count;
    }
    if (typeof snapshot.summary?.promoted_count === 'number') {
      return snapshot.summary.promoted_count;
    }
    if (!previousMembers.length) return 0;

    const previousRefs = new Set(
      previousMembers.map(member => member.object_ref)
    );
    return currentMembers.filter(member => !previousRefs.has(member.object_ref))
      .length;
  }

  private getModifiedCount(
    snapshot: ReleaseTrackSnapshotHistoryItem,
    currentMembers: SnapshotMemberRef[],
    previousMembers: SnapshotMemberRef[]
  ): number {
    if (typeof snapshot.summary?.modified_count === 'number') {
      return snapshot.summary.modified_count;
    }
    if (!previousMembers.length) return 0;

    const previousByRef = new Map(
      previousMembers.map(member => [member.object_ref, member.object_modified])
    );

    return currentMembers.filter(member => {
      const previousModified = previousByRef.get(member.object_ref);
      return (
        !!member.object_modified &&
        !!previousModified &&
        member.object_modified !== previousModified
      );
    }).length;
  }

  private getSnapshotTotalObjects(
    snapshot: ReleaseTrackSnapshotHistoryItem,
    members: SnapshotMemberRef[]
  ): number {
    if (typeof snapshot.summary?.members_count === 'number') {
      return snapshot.summary.members_count;
    }
    if (typeof snapshot.composition_resolution?.total_objects === 'number') {
      return snapshot.composition_resolution.total_objects;
    }
    if (members.length) return members.length;

    const allRefs = [
      ...(snapshot.candidates || snapshot.contents?.candidates || []),
      ...(snapshot.staged || snapshot.contents?.staged || []),
    ]
      .map(item => this.getSnapshotMemberRef(item)?.object_ref)
      .filter((ref): ref is string => !!ref);

    return new Set(allRefs).size;
  }

  private getSnapshotExportFilename(
    item: SnapshotHistoryViewModel,
    format: ExportFormatType
  ): string {
    const name = this.releaseTrackName || this.id || 'release-track';
    const safeName =
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'release-track';
    const snapshotName = item.isTagged
      ? item.title.replace(/^v/, 'v')
      : 'draft';
    return `${safeName}-${snapshotName}-${format}.json`;
  }

  private toIsoString(value: Date | string | undefined): string | undefined {
    if (!value) return undefined;
    return value instanceof Date ? value.toISOString() : value;
  }
}
