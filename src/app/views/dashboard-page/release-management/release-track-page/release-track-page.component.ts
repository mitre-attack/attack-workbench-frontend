import { SelectionModel } from '@angular/cdk/collections';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { finalize, map, take } from 'rxjs/operators';
import {
  ConflictPolicy,
  ConflictPolicyType,
  DeduplicationStrategy,
  DeduplicationStrategyType,
  ExportFormat,
  ExportFormatType,
  MemberSyncBehavior,
  MemberSyncBehaviorType,
  MemberSyncPolicy,
  MemberSyncPolicyType,
  MemberSyncStrategy,
  MemberSyncStrategyType,
  ReleasePayload,
  ReleasePreviewFormat,
  ReleaseTrackConfig,
  ReleaseTrackSnapshot,
  ReleaseTrackSnapshotHistoryItem,
  ReleaseTrackType,
  ResolutionStrategy,
  SnapshotScheduleMode,
  SnapshotScheduleModeType,
  SnapshotTier,
  SnapshotTierType,
  StixObjectRef,
} from 'src/app/classes/release-tracks';
import { StixObject } from 'src/app/classes/stix';
import { AddDialogComponent } from 'src/app/components/add-dialog/add-dialog.component';
import { DeleteDialogComponent } from 'src/app/components/delete-dialog/delete-dialog.component';
import { MultipleChoiceDialogComponent } from 'src/app/components/multiple-choice-dialog/multiple-choice-dialog.component';
import { ReleasePreviewDialogComponent } from 'src/app/components/release-preview-dialog/release-preview-dialog.component';
import { ReleaseTrackObjectItem } from 'src/app/components/release-track-object-card/release-track-object-card.component';
import { AuthenticationService } from 'src/app/services/connectors/authentication/authentication.service';
import { ReleaseTracksConnectorService } from 'src/app/services/connectors/rest-api/release-tracks.service';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { BreadcrumbService } from 'src/app/services/helpers/breadcrumb.service';
import {
  AttackTypeToPlural,
  StixTypeToAttackType,
} from 'src/app/utils/type-mappings';
import {
  StixType,
  WorkflowStatus,
  WorkflowStatusType,
} from 'src/app/utils/types';

import { ALL_OBJECTS_STIX_LIST_CONFIG } from 'src/app/views/stix/all-objects-page/all-objects-page.component';
import { StixDialogComponent } from 'src/app/views/stix/stix-dialog/stix-dialog.component';

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
  taggedAt: Date | null;
  isTagged: boolean;
  stats: SnapshotHistoryStat[];
  addedCount: number;
  modifiedCount: number;
  totalObjects: number;
}

interface SnapshotHistoryStat {
  label: string;
  value: string | number;
  modifier?: string;
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

interface VirtualReleaseTrackConfigFormValue {
  virtualDeduplicationStrategy: DeduplicationStrategyType;
  virtualDeduplicationTier: SnapshotTierType;
  virtualDeduplicationStatus: WorkflowStatusType;
  virtualSnapshotScheduleMode: SnapshotScheduleModeType;
  virtualSnapshotScheduleCron: string;
}

interface VirtualResolutionRow {
  trackId: string;
  trackName: string;
  strategy: string;
  resolvedVersion?: string | null;
  candidatesCount?: number | null;
  stagedCount?: number | null;
  membersCount?: number | null;
}

interface VirtualComponentTrackSummary {
  trackId: string;
  name: string;
  description: string;
  type: string;
  latestTaggedVersion: string | null;
  taggedReleaseCount: number;
  candidatesCount: number;
  stagedCount: number;
  membersCount: number;
}

interface VirtualComponentTrackOption {
  trackId: string;
  name: string;
  description: string;
  latestTaggedVersion: string | null;
  taggedReleaseCount: number;
}

const VIRTUAL_OBJECT_TYPE_OPTIONS: StixType[] = [
  'attack-pattern',
  'campaign',
  'course-of-action',
  'intrusion-set',
  'malware',
  'tool',
  'x-mitre-asset',
  'x-mitre-data-source',
  'x-mitre-data-component',
  'x-mitre-detection-strategy',
  'x-mitre-analytic',
  'x-mitre-matrix',
  'x-mitre-tactic',
];

const VIRTUAL_DOMAIN_FILTER_OPTIONS = ['enterprise', 'ics', 'mobile'];

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
  public isDeleting = false;
  public isLoadingSnapshotHistory = false;
  public isReleasing = false;
  public isLoadingConfig = false;
  public isEditingConfig = false;
  public isSavingConfig = false;
  public releaseTrackConfig: ReleaseTrackConfig = {};
  public snapshotHistory: SnapshotHistoryViewModel[] = [];
  public configForm: FormGroup;
  private virtualComponentTrackSummaries = new Map<
    string,
    VirtualComponentTrackSummary
  >();
  public virtualComponentTrackOptions: VirtualComponentTrackOption[] = [];
  public virtualConfigComponentTracks: any[] = [];
  private createdDraftSnapshot: ReleaseTrackSnapshotHistoryItem | null = null;

  public candidacyOptions = Object.values(WorkflowStatus);
  public memberSyncStrategyOptions = Object.values(MemberSyncStrategy);
  public memberSyncBehaviorOptions = Object.values(MemberSyncBehavior);
  public memberSyncStatusPolicyOptions = Object.values(MemberSyncPolicy);
  public candidatesToStagedConflictOptions = Object.values(
    ConflictPolicy
  ).filter(policy => policy !== ConflictPolicy.Abort);
  public stagedToMembersConflictOptions = Object.values(ConflictPolicy);
  public virtualDeduplicationOptions = Object.values(DeduplicationStrategy);
  public virtualDeduplicationTierOptions = Object.values(SnapshotTier);
  public virtualDeduplicationStatusOptions = Object.values(WorkflowStatus);
  public virtualSnapshotScheduleModeOptions =
    Object.values(SnapshotScheduleMode);
  public virtualObjectTypeOptions = VIRTUAL_OBJECT_TYPE_OPTIONS.map(type => ({
    label: this.formatStixType(type),
    value: type,
  }));
  public virtualDomainOptions = VIRTUAL_DOMAIN_FILTER_OPTIONS;

  constructor(
    private connector: ReleaseTracksConnectorService,
    private breadcrumbService: BreadcrumbService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private snackbar: MatSnackBar,
    private restApiConnectorService: RestApiConnectorService,
    private authenticationService: AuthenticationService,
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
      virtualDeduplicationStrategy: [
        DeduplicationStrategy.PrioritizeLatestObject,
      ],
      virtualDeduplicationTier: [SnapshotTier.Member],
      virtualDeduplicationStatus: [WorkflowStatus.Reviewed],
      virtualSnapshotScheduleMode: [SnapshotScheduleMode.Manual],
      virtualSnapshotScheduleCron: [''],
      virtualComponentTrackSearch: [''],
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

  public get virtualComponentTracks(): any[] {
    return this.releaseTrack?.composition?.component_tracks ?? [];
  }

  public get displayedVirtualConfigComponentTracks(): any[] {
    return this.isEditingConfig
      ? this.virtualConfigComponentTracks
      : this.virtualComponentTracks;
  }

  public get filteredVirtualComponentTrackOptions(): VirtualComponentTrackOption[] {
    const search = this.getVirtualComponentTrackSearchText();
    const selectedIds = new Set(
      this.virtualConfigComponentTracks
        .map(track => track.track_id)
        .filter((trackId): trackId is string => !!trackId)
    );

    return this.virtualComponentTrackOptions
      .filter(track => !selectedIds.has(track.trackId))
      .filter(track => this.matchesVirtualComponentTrackSearch(track, search));
  }

  public get virtualSnapshotSchedule(): any {
    return (this.releaseTrack as any)?.snapshot_schedule || {};
  }

  public get hasCurrentDraftSnapshot(): boolean {
    return this.snapshotHistory.some(item => !item.isTagged);
  }

  public get taggedSnapshotCount(): number {
    return this.snapshotHistory.filter(item => item.isTagged).length;
  }

  public get resolvedComponentSnapshots(): any[] {
    return this.releaseTrack?.composition_resolution?.component_snapshots ?? [];
  }

  public get quarantineObjects(): any[] {
    return this.releaseTrack?.quarantine ?? [];
  }

  public get virtualResolvedAt(): Date | null {
    return this.releaseTrack?.composition_resolution?.resolved_at ?? null;
  }

  public get virtualResolutionRows(): VirtualResolutionRow[] {
    if (this.resolvedComponentSnapshots.length) {
      return this.resolvedComponentSnapshots.map(component => {
        const configuredTrack = this.virtualComponentTracks.find(
          track => track.track_id === component.track_id
        );
        return {
          trackId: component.track_id,
          trackName:
            this.getComponentTrackSummary(component.track_id)?.name ||
            component.track_name ||
            component.track_id,
          strategy:
            component.strategy_used ||
            configuredTrack?.resolution_strategy ||
            '',
          resolvedVersion:
            component.resolved_version ||
            component.version ||
            component.version_label ||
            null,
          ...this.getVirtualComponentCounts(component.track_id),
        };
      });
    }

    return this.virtualComponentTracks.map(track => ({
      trackId: track.track_id,
      trackName: this.getComponentTrackLabel(track),
      strategy: track.resolution_strategy,
      resolvedVersion: null,
      ...this.getVirtualComponentCounts(track.track_id),
    }));
  }

  public get virtualResolvedObjectCount(): number {
    const resolved = this.releaseTrack?.composition_resolution as any;
    return (
      this.getResolutionNumber(
        resolved,
        'total_objects',
        'totalObjects',
        'objects_contributed',
        'total_objects_after'
      ) ||
      this.resolvedComponentSnapshots.reduce(
        (total, component) =>
          total + Number(component.objects_contributed || 0),
        0
      )
    );
  }

  public get virtualDuplicateCount(): number {
    return this.getResolutionNumber(
      this.releaseTrack?.composition_resolution as any,
      'duplicates_found',
      'duplicates',
      'duplicate_count'
    );
  }

  public get virtualConflictCount(): number {
    const resolved = this.releaseTrack?.composition_resolution as any;
    const conflictCount = this.getResolutionNumber(
      resolved,
      'conflicts_found',
      'conflicts',
      'conflict_count'
    );
    if (conflictCount) return conflictCount;
    const resolvedConflicts = resolved?.deduplication?.conflicts_resolved;
    return Array.isArray(resolvedConflicts) ? resolvedConflicts.length : 0;
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
          items: this.candidates.filter(item =>
            this.isWorkInProgressCandidate(item)
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

  private get latestDraftSnapshot(): SnapshotHistoryViewModel | undefined {
    return this.snapshotHistory.find(snapshot => !snapshot.isTagged);
  }

  public get canEditReleaseTrack(): boolean {
    return this.authenticationService.canEdit();
  }

  public getReleaseTrack(): void {
    this.connector
      .getLatestSnapshot(this.id, {
        format: ExportFormat.Workbench,
        include: 'all',
      })
      .pipe(take(1))
      .subscribe({
        next: res => {
          this.releaseTrack = res;
          if (!this.releaseTrack) return;
          this.hydrateDynamicEntryDates();

          this.breadcrumbService.changeBreadcrumb(
            this.route.snapshot,
            this.releaseTrack.name
          );

          if (this.snapshotHistory.length) {
            this.snapshotHistory = this.buildSnapshotHistory(
              this.snapshotHistory.map(item => item.snapshot)
            );
          }

          if (this.isVirtualReleaseTrack) {
            this.loadVirtualComponentTrackSummaries();
          } else {
            this.virtualComponentTrackSummaries.clear();
          }

          if (!this.isEditingConfig) {
            if (this.isVirtualReleaseTrack) {
              this.setVirtualConfig();
            } else if (this.releaseTrack.config) {
              this.setConfig(this.releaseTrack.config);
            }
          }

          // this.loadCandidates();
        },
      });
  }

  private refreshReleaseTrackState(): void {
    this.getReleaseTrack();
    this.getSnapshotHistory();
  }

  private hydrateDynamicEntryDates(): void {
    const entries = ([] as ReleaseTrackObjectItem[]).concat(
      ...['candidates', 'staged', 'members'].map(tier =>
        (this.releaseTrack?.[tier] || []).filter(
          (entry: ReleaseTrackObjectItem) => entry.object_modified === 'latest'
        )
      )
    );
    if (!entries.length) return;

    forkJoin(
      entries.map(entry =>
        this.fetchLatestObject(entry.object_ref).pipe(
          map(object => ({ entry, modified: object?.modified }))
        )
      )
    )
      .pipe(take(1))
      .subscribe(results => {
        results.forEach(({ entry, modified }) => {
          if (modified) {
            entry.resolved_object_modified =
              modified instanceof Date ? modified.toISOString() : modified;
          }
        });
      });
  }

  private fetchLatestObject(objectRef: string): Observable<any | null> {
    const attackType =
      StixTypeToAttackType[objectRef.split('--')[0] as StixType];
    const getters: Partial<Record<string, () => Observable<any[]>>> = {
      'technique': () => this.restApiConnectorService.getTechnique(objectRef),
      'tactic': () => this.restApiConnectorService.getTactic(objectRef),
      'group': () => this.restApiConnectorService.getGroup(objectRef),
      'campaign': () => this.restApiConnectorService.getCampaign(objectRef),
      'asset': () => this.restApiConnectorService.getAsset(objectRef),
      'software': () => this.restApiConnectorService.getSoftware(objectRef),
      'mitigation': () => this.restApiConnectorService.getMitigation(objectRef),
      'matrix': () => this.restApiConnectorService.getMatrix(objectRef),
      'data-source': () =>
        this.restApiConnectorService.getDataSource(objectRef),
      'data-component': () =>
        this.restApiConnectorService.getDataComponent(objectRef),
      'detection-strategy': () =>
        this.restApiConnectorService.getDetectionStrategy(objectRef),
      'analytic': () => this.restApiConnectorService.getAnalytic(objectRef),
    };
    const getObject = getters[attackType];
    return getObject
      ? getObject().pipe(map(objects => objects[0] || null))
      : of(null);
  }

  public onDeleteReleaseTrack(): void {
    if (!this.id || !this.canEditReleaseTrack || this.isDeleting) return;

    const prompt = this.dialog.open(DeleteDialogComponent, {
      maxWidth: '35em',
      disableClose: true,
      autoFocus: false,
      data: {
        title: 'Are you sure you want to delete this release track?',
        warning: `${this.releaseTrackName || 'This release track'} and its snapshots will be permanently deleted.`,
        stixId: this.id,
      },
    });

    prompt
      .afterClosed()
      .pipe(take(1))
      .subscribe(confirm => {
        if (!confirm) return;

        this.isDeleting = true;
        this.connector
          .deleteReleaseTrack(this.id)
          .pipe(
            take(1),
            finalize(() => {
              this.isDeleting = false;
            })
          )
          .subscribe({
            next: () => {
              this.router.navigate(['/dashboard/release-management']);
            },
            error: err => {
              console.error('Failed to delete release track', err);
            },
          });
      });
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
        next: result => {
          const snapshots = Array.isArray(result) ? result : result?.data || [];
          this.snapshotHistory = this.buildSnapshotHistory(
            this.withCreatedDraftSnapshot(snapshots)
          );
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
            if (this.isVirtualReleaseTrack) {
              this.setVirtualConfig();
            } else {
              this.setConfig(
                this.getConfigFromResponse(config, this.releaseTrack?.config)
              );
            }
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
    const selectedObjectRefs = new Map<
      string,
      {
        id: string;
        modified: string;
      }
    >();
    const dialogRef = this.dialog.open(AddDialogComponent, {
      data: {
        select: selection,
        type: 'all',
        selectionType: 'many',
        buttonLabel: 'Add',
        title: 'Add candidates',
        clearSelection: true,
        stixListConfig: {
          ...ALL_OBJECTS_STIX_LIST_CONFIG,
          select: 'many',
          selectionModel: selection,
          selectedObjectRefs,
          clickBehavior: 'expand',
        },
      },
      maxWidth: '90vw',
      width: '80vw',
      maxHeight: '85vh',
    });

    dialogRef.afterClosed().subscribe({
      next: result => {
        if (!result || !selection.selected.length) return;

        const objectRefs = selection.selected.map(
          id => selectedObjectRefs.get(id) || id
        );

        this.connector.addCandidates(this.id, objectRefs).subscribe({
          next: () => {
            this.refreshReleaseTrackState();
          },
          error: err => {
            console.error('Failed to add candidates', err);
          },
        });
      },
    });
  }

  public getViewUrl(stixId: string): string | null {
    const [stixType] = stixId.split('--');
    const attackType = StixTypeToAttackType[stixType as StixType];
    return attackType ? `/${attackType}/${stixId}` : null;
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
    const viewUrl = this.getViewUrl(id);
    if (!viewUrl) {
      console.error('Unable to resolve object route', id);
      return;
    }
    this.router.navigate([viewUrl]);
  }

  public onDiff(item: ReleaseTrackObjectItem): void {
    if (!item?.object_ref) {
      this.snackbar.open(
        'Unable to determine which object to compare.',
        undefined,
        {
          duration: 3000,
        }
      );
      return;
    }

    const tier = this.getDiffTier(item);
    if (!tier) {
      this.snackbar.open(
        'Unable to determine which lane to compare.',
        undefined,
        {
          duration: 3000,
        }
      );
      return;
    }

    const diff =
      tier === 'candidate'
        ? this.resolveCandidateDiffObjects(item)
        : this.resolveStagedDiffObjects(item);
    const relationshipBaseline =
      tier === 'candidate'
        ? (this.findStagedEntry(item.object_ref) ??
          this.findMemberEntry(item.object_ref))
        : this.findMemberEntry(item.object_ref);
    const relationshipAddedAfter =
      this.getDiffObjectModified(relationshipBaseline);
    diff.pipe(take(1)).subscribe(({ current, prior, expectedBaseline }) => {
      if (!current) {
        this.snackbar.open(
          'Unable to load the current object version.',
          undefined,
          {
            duration: 3000,
          }
        );
        return;
      }

      if (expectedBaseline && !prior) {
        this.snackbar.open(
          'Unable to load the comparison baseline version.',
          undefined,
          {
            duration: 3000,
          }
        );
        return;
      }

      this.openDiffDialog(
        current,
        prior,
        tier === 'staged' ? this.getDiffObjectModified(item) : undefined,
        relationshipAddedAfter
      );
    });
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

  /**
   * When different revisions of an object occupy both workflow tiers, only the
   * newest pin can present a non-misleading relationship diff.
   */
  public shouldShowDiff(item: ReleaseTrackObjectItem): boolean {
    if (!item?.object_ref) return true;

    const staged = (this.releaseTrack?.staged || []).filter(
      entry => entry.object_ref === item.object_ref
    );
    const candidates = (this.releaseTrack?.candidates || []).filter(
      entry => entry.object_ref === item.object_ref
    );

    if (!staged.length || !candidates.length) return true;

    const itemModified = this.getModifiedTimestamp(item.object_modified);
    const pins = [...staged, ...candidates].map(entry =>
      this.getModifiedTimestamp(entry.object_modified)
    );
    if (
      !Number.isFinite(itemModified) ||
      pins.some(time => !Number.isFinite(time))
    ) {
      return true;
    }

    return itemModified === Math.max(...pins);
  }

  public getDiffUnavailableMessage(
    item: ReleaseTrackObjectItem
  ): string | null {
    return this.shouldShowDiff(item)
      ? null
      : 'A newer revision of this object is available in the release track. View its diff instead.';
  }

  public toggleReleasedMembers(): void {
    this.showReleasedMembers = !this.showReleasedMembers;
  }

  private getModifiedTimestamp(value?: Date | string): number {
    return value ? new Date(value).getTime() : Number.NaN;
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

  public trackByComponentTrack(_index: number, track: any): string {
    return track?.track_id || `${_index}`;
  }

  public trackByResolvedComponent(_index: number, component: any): string {
    return component?.track_id || component?.track_name || `${_index}`;
  }

  public trackByVirtualResolutionRow(
    _index: number,
    row: VirtualResolutionRow
  ): string {
    return row.trackId || `${_index}`;
  }

  public onOpenComponentTrack(track: any): void {
    const trackId = track?.track_id || track?.trackId;
    if (!trackId) return;
    this.router.navigate(['/dashboard/release-management', trackId]);
  }

  public getComponentTrackLabel(track: any): string {
    const resolvedComponent = this.resolvedComponentSnapshots.find(
      component => component.track_id === track.track_id
    );
    return (
      this.getComponentTrackSummary(track.track_id)?.name ||
      resolvedComponent?.track_name ||
      track.track_name ||
      track.track_id
    );
  }

  public getComponentTrackFilters(track: any): string[] {
    const objectTypes = track?.filters?.object_types;
    const domains = track?.filters?.domains;
    return [
      ...(Array.isArray(objectTypes)
        ? objectTypes.map(type => this.formatConfigOption(type))
        : []),
      ...(Array.isArray(domains) ? domains.map(this.formatDomain) : []),
    ];
  }

  public getResolvedComponentLabel(component: any): string {
    const version =
      component.resolved_version ||
      component.version ||
      component.version_label;
    if (version) return `Resolved version ${version}`;

    const snapshot =
      component.resolved_snapshot_id || component.resolved_snapshot;
    if (snapshot) return `Resolved snapshot ${this.toDisplayDate(snapshot)}`;

    return 'Resolved snapshot';
  }

  public getVirtualResolvedVersion(row: VirtualResolutionRow): string {
    if (!row.resolvedVersion) return '-';
    return row.resolvedVersion.startsWith('v')
      ? row.resolvedVersion
      : `v${row.resolvedVersion}`;
  }

  public getVirtualTierCount(value: number | null | undefined): string {
    if (value === null || value === undefined) return '-';
    return String(value);
  }

  public displayVirtualComponentTrackOption(
    track: VirtualComponentTrackOption
  ): string {
    return track?.name || '';
  }

  public getVirtualComponentTrackSnapshotLabel(
    track: VirtualComponentTrackOption | any
  ): string {
    const version =
      track?.latestTaggedVersion ||
      track?.latest_tagged_version ||
      track?.latest_version;
    return version ? `v${version}` : 'no tagged snapshots';
  }

  public selectVirtualComponentTrack(event: any): void {
    const option = event?.option?.value as VirtualComponentTrackOption;
    if (!option) return;

    this.virtualConfigComponentTracks = [
      ...this.virtualConfigComponentTracks,
      {
        track_id: option.trackId,
        resolution_strategy: ResolutionStrategy.LatestTagged,
        priority: this.virtualConfigComponentTracks.length,
      },
    ];
    this.configForm
      .get('virtualComponentTrackSearch')
      ?.setValue('', { emitEvent: false });
  }

  public removeVirtualComponentTrack(track: any): void {
    this.virtualConfigComponentTracks =
      this.virtualConfigComponentTracks.filter(item => item !== track);
  }

  public getVirtualComponentTrackObjectTypes(track: any): string[] {
    const objectTypes = track?.filters?.object_types;
    return Array.isArray(objectTypes) ? objectTypes : [];
  }

  public setVirtualComponentTrackObjectTypes(
    track: any,
    objectTypes: string[]
  ): void {
    if (!objectTypes.length) {
      const filters = { ...(track.filters || {}) };
      delete filters.object_types;
      track.filters = Object.keys(filters).length ? filters : undefined;
      return;
    }

    track.filters = {
      ...(track.filters || {}),
      object_types: objectTypes,
    };
  }

  public getVirtualComponentTrackDomains(track: any): string[] {
    const domains = track?.filters?.domains;
    return Array.isArray(domains) ? domains.map(this.formatDomain) : [];
  }

  public setVirtualComponentTrackDomains(track: any, domains: string[]): void {
    const filters = { ...(track.filters || {}) };
    if (domains.length) filters.domains = domains;
    else delete filters.domains;
    track.filters = Object.keys(filters).length ? filters : undefined;
  }

  private formatDomain(domain: string): string {
    return domain.replace(/-attack$/, '');
  }

  public getVirtualComponentTrackDescription(track: any): string {
    return this.getComponentTrackSummary(track?.track_id)?.description || '';
  }

  public getVirtualObjectTitle(item: any): string {
    return item?.name || this.getFallbackObjectLabel(item?.object_ref);
  }

  public getVirtualObjectSubtitle(item: any): string {
    return (
      item?.attack_id ||
      item?.attackId ||
      item?.source_snapshot_version ||
      item?.conflict_reason ||
      item?.object_ref ||
      ''
    );
  }

  private getResolutionNumber(resolution: any, ...keys: string[]): number {
    if (!resolution) return 0;
    const sources = [resolution, resolution.summary, resolution.deduplication];
    for (const source of sources) {
      if (!source) continue;
      for (const key of keys) {
        if (typeof source[key] === 'number') return source[key];
      }
    }
    return 0;
  }

  private loadVirtualComponentTrackSummaries(): void {
    this.connector
      .listReleaseTracks()
      .pipe(take(1))
      .subscribe({
        next: result => {
          const summaries = new Map<string, VirtualComponentTrackSummary>();
          const options: VirtualComponentTrackOption[] = [];
          for (const track of this.getReleaseTrackList(result)) {
            const trackId = this.getReleaseTrackId(track);
            if (!trackId) continue;
            summaries.set(trackId, this.toVirtualComponentTrackSummary(track));
            if (this.isStandardReleaseTrack(track)) {
              options.push(this.toVirtualComponentTrackOption(track));
            }
          }
          this.virtualComponentTrackSummaries = summaries;
          this.virtualComponentTrackOptions = options;
        },
        error: err => {
          this.virtualComponentTrackSummaries.clear();
          this.virtualComponentTrackOptions = [];
          console.error('Failed to load component track summaries', err);
        },
      });
  }

  private getReleaseTrackList(result: any): any[] {
    if (Array.isArray(result?.data)) return result.data;
    if (Array.isArray(result?.release_tracks)) return result.release_tracks;
    if (Array.isArray(result)) return result;
    return [];
  }

  private getReleaseTrackId(track: any): string | null {
    return track?.track_id || track?.id || null;
  }

  private isStandardReleaseTrack(track: any): boolean {
    return String(track?.type).toLowerCase() === ReleaseTrackType.Standard;
  }

  private toVirtualComponentTrackSummary(
    track: any
  ): VirtualComponentTrackSummary {
    const summary = track?.summary || {};
    return {
      trackId: this.getReleaseTrackId(track) as string,
      name: track?.name || 'Untitled release track',
      description: track?.description || '',
      type: track?.type || '',
      latestTaggedVersion: this.getLatestTaggedVersion(track),
      taggedReleaseCount: this.getTaggedReleaseCount(track),
      candidatesCount: Number(summary.candidates_count || 0),
      stagedCount: Number(summary.staged_count || 0),
      membersCount: Number(summary.members_count || 0),
    };
  }

  private toVirtualComponentTrackOption(
    track: any
  ): VirtualComponentTrackOption {
    return {
      trackId: this.getReleaseTrackId(track) as string,
      name: track?.name || 'Untitled release track',
      description: track?.description || '',
      latestTaggedVersion: this.getLatestTaggedVersion(track),
      taggedReleaseCount: this.getTaggedReleaseCount(track),
    };
  }

  private getLatestTaggedVersion(track: any): string | null {
    return (
      track?.latest_tagged_version ||
      track?.latestTaggedVersion ||
      track?.latest_version ||
      track?.latestVersion ||
      null
    );
  }

  private getTaggedReleaseCount(track: any): number {
    return Number(
      track?.tagged_release_count ||
        track?.taggedReleaseCount ||
        track?.tagged_releases_count ||
        0
    );
  }

  private getComponentTrackSummary(
    trackId: string
  ): VirtualComponentTrackSummary | undefined {
    return this.virtualComponentTrackSummaries.get(trackId);
  }

  private getVirtualComponentCounts(
    trackId: string
  ): Pick<
    VirtualResolutionRow,
    'candidatesCount' | 'stagedCount' | 'membersCount'
  > {
    const summary = this.getComponentTrackSummary(trackId);
    return {
      candidatesCount: summary?.candidatesCount ?? null,
      stagedCount: summary?.stagedCount ?? null,
      membersCount: summary?.membersCount ?? null,
    };
  }

  private cloneVirtualComponentTracks(tracks: any[]): any[] {
    return tracks.map(track => ({
      ...track,
      filters: track.filters
        ? {
            ...track.filters,
            object_types: Array.isArray(track.filters.object_types)
              ? [...track.filters.object_types]
              : undefined,
            domains: Array.isArray(track.filters.domains)
              ? [...track.filters.domains]
              : undefined,
          }
        : undefined,
    }));
  }

  private getVirtualComponentTrackSearchText(): string {
    const value = this.configForm.get('virtualComponentTrackSearch')?.value;
    if (!value) return '';
    if (typeof value === 'string') return value.trim().toLowerCase();
    return String(value.name || value.trackId || '')
      .trim()
      .toLowerCase();
  }

  private matchesVirtualComponentTrackSearch(
    track: VirtualComponentTrackOption,
    search: string
  ): boolean {
    if (!search) return true;
    return [track.name, track.trackId, track.description]
      .filter(Boolean)
      .some(value => value.toLowerCase().includes(search));
  }

  private toDisplayDate(value: any): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  private toOptionalNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private formatStixType(type: StixType): string {
    const attackType = StixTypeToAttackType[type];
    return AttackTypeToPlural[attackType]?.replace(/-/g, ' ') || type;
  }

  private getFallbackObjectLabel(objectRef: string | undefined): string {
    if (!objectRef) return 'Unknown object';
    const [type, id] = objectRef.split('--');
    if (!type || !id) return objectRef;
    const attackType = StixTypeToAttackType[type as StixType];
    const typeLabel = attackType
      ? attackType.replace(/-/g, ' ')
      : type.replace(/-/g, ' ');
    return `${typeLabel.replace(/\b\w/g, char => char.toUpperCase())} ${id.slice(0, 8)}`;
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

    const dialogRef = this.dialog.open(MultipleChoiceDialogComponent, {
      width: '30em',
      autoFocus: false,
      data: {
        title: 'Create draft snapshot?',
        description:
          'Resolve the tagged component releases into a persistent virtual draft snapshot.',
        choices: [
          {
            label: 'Create Draft',
            value: 'create',
            description:
              'Resolve the virtual track composition into a new draft snapshot.',
          },
          {
            label: 'Cancel',
            value: 'cancel',
          },
        ],
      },
    });

    dialogRef.afterClosed().subscribe(choice => {
      if (choice !== 'create' || !this.id || !this.isVirtualReleaseTrack) {
        return;
      }
      this.createVirtualDraftSnapshot();
    });
  }

  private createVirtualDraftSnapshot(): void {
    this.isCreatingDraft = true;
    this.connector
      .createVirtualSnapshot(this.id, {
        description: this.snapshotHistory.length
          ? 'Virtual snapshot'
          : 'Initial virtual snapshot',
      })
      .pipe(
        take(1),
        finalize(() => {
          this.isCreatingDraft = false;
        })
      )
      .subscribe({
        next: snapshot => {
          this.addCreatedDraftSnapshotToHistory(snapshot);
          this.refreshReleaseTrackState();
        },
        error: err => {
          console.error('Failed to create draft snapshot', err);
        },
      });
  }

  private addCreatedDraftSnapshotToHistory(snapshot: any): void {
    const draftSnapshot = this.getCreatedDraftSnapshot(snapshot);
    if (!draftSnapshot) return;

    this.createdDraftSnapshot = draftSnapshot;
    this.snapshotHistory = this.buildSnapshotHistory(
      this.withCreatedDraftSnapshot(
        this.snapshotHistory.map(item => item.snapshot)
      )
    );
  }

  private getCreatedDraftSnapshot(
    snapshot: any
  ): ReleaseTrackSnapshotHistoryItem | null {
    const draftSnapshot = snapshot?.data || snapshot?.snapshot || snapshot;
    if (!draftSnapshot || this.isTaggedSnapshot(draftSnapshot)) return null;
    return this.getSnapshotModified(draftSnapshot) ? draftSnapshot : null;
  }

  private withCreatedDraftSnapshot(
    snapshots: ReleaseTrackSnapshotHistoryItem[]
  ): ReleaseTrackSnapshotHistoryItem[] {
    if (!this.createdDraftSnapshot) return snapshots;

    const createdDraftModified = this.getSnapshotModified(
      this.createdDraftSnapshot
    );
    const draftAlreadyLoaded = snapshots.some(
      snapshot => this.getSnapshotModified(snapshot) === createdDraftModified
    );

    if (draftAlreadyLoaded) {
      this.createdDraftSnapshot = null;
      return snapshots;
    }

    return [...snapshots, this.createdDraftSnapshot];
  }

  public onEditConfig(): void {
    if (this.isVirtualReleaseTrack) this.setVirtualConfig();
    this.isEditingConfig = true;
  }

  public onCancelConfigEdit(): void {
    if (this.isVirtualReleaseTrack) {
      this.setVirtualConfig();
    } else {
      this.setConfig(this.releaseTrackConfig);
    }
    this.isEditingConfig = false;
  }

  public onSaveConfig(): void {
    if (!this.id || this.isSavingConfig) return;
    if (this.isVirtualReleaseTrack) {
      this.saveVirtualConfig();
      return;
    }

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
    if (!this.latestDraftSnapshot && this.releaseTrack?.version != null) {
      this.openNoDraftSnapshotDialog();
      return;
    }

    this.previewRelease(this.latestDraftSnapshot);
  }

  private openNoDraftSnapshotDialog(): void {
    this.dialog.open(MultipleChoiceDialogComponent, {
      width: '30em',
      autoFocus: false,
      restoreFocus: true,
      data: {
        title: 'No draft snapshot available',
        description:
          'The latest snapshot has already been released. Modify the release track to create a new draft before previewing another release.',
        choices: [
          {
            label: 'Close',
            value: 'close',
          },
        ],
      },
    });
  }

  public onTagSnapshot(item: SnapshotHistoryViewModel): void {
    if (!item || item.isTagged || !item.modified) return;
    this.previewRelease(item);
  }

  private previewRelease(item?: SnapshotHistoryViewModel): void {
    if (!this.id || this.isReleasing) return;

    this.isReleasing = true;
    const selection: ReleasePayload = { increment: 'minor' };
    const preview = forkJoin({
      preview: item?.modified
        ? this.connector.previewRelease(
            this.id,
            { format: ReleasePreviewFormat.Summary, ...selection },
            item.modified
          )
        : this.connector.previewRelease(this.id, {
            format: ReleasePreviewFormat.Summary,
            ...selection,
          }),
      track: item?.modified
        ? this.connector.retrieveSnapshotByModified(this.id, item.modified, {
            format: ExportFormat.Workbench,
            include: 'all',
          })
        : of(this.releaseTrack),
      objects: this.restApiConnectorService.getAllObjects({
        revoked: true,
        deprecated: true,
        versions: 'all',
      }),
    });

    preview
      .pipe(
        take(1),
        finalize(() => {
          this.isReleasing = false;
        })
      )
      .subscribe({
        next: result => {
          if (!result.preview || !result.track) {
            this.snackbar.open(
              'Unable to load the release preview. Please try again.',
              null,
              {
                duration: 5000,
                panelClass: 'error',
              }
            );
            return;
          }

          this.openReleasePreviewDialog(
            result.preview,
            this.enrichReleasePreviewTrack(result.track, result.objects),
            item
          );
        },
        error: err => {
          console.error('Failed to load objects for release preview', err);
        },
      });
  }

  public onInspectSnapshot(item: SnapshotHistoryViewModel): void {
    if (!this.id || !item.modified) return;

    this.connector
      .retrieveSnapshotByModified(this.id, item.modified, {
        format: ExportFormat.Workbench,
        include: 'all',
      })
      .pipe(take(1))
      .subscribe({
        next: snapshot => {
          if (!snapshot) return;
          this.releaseTrack = snapshot;
          if (this.isVirtualReleaseTrack) {
            this.loadVirtualComponentTrackSummaries();
          }
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
      .exportSnapshotByModified(
        this.id,
        item.modified,
        ExportFormat.Bundle,
        this.getSnapshotExportOptions(item)
      )
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

  private getSnapshotExportOptions(
    item: SnapshotHistoryViewModel
  ): { include: 'staged' } | undefined {
    const trackType =
      this.getSnapshotType(item.snapshot) || this.releaseTrack?.type;
    if (trackType === ReleaseTrackType.Standard && !item.isTagged) {
      return { include: 'staged' };
    }
    return undefined;
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

  private getReleaseTrackTier(item: any): 'candidate' | 'staged' | null {
    if (item?.release_track_tier) {
      return item.release_track_tier === 'candidate' ||
        item.release_track_tier === 'staged'
        ? item.release_track_tier
        : null;
    }
    if (item?.object_staged_at || item?.object_staged_by) return 'staged';
    return item?.object_ref ? 'candidate' : null;
  }

  private getDiffTier(
    item: ReleaseTrackObjectItem
  ): 'candidate' | 'staged' | null {
    return this.getReleaseTrackTier(item);
  }

  private findStagedEntry(objectRef: string): ReleaseTrackObjectItem | null {
    return (
      this.releaseTrack?.staged?.find(item => item.object_ref === objectRef) ??
      null
    );
  }

  private findMemberEntry(objectRef: string): ReleaseTrackObjectItem | null {
    return (
      this.releaseTrack?.members?.find(item => item.object_ref === objectRef) ??
      null
    );
  }

  private getDiffObjectModified(
    item: ReleaseTrackObjectItem | null
  ): Date | string | undefined {
    return item?.resolved_object_modified ?? item?.object_modified;
  }

  private resolveCandidateDiffObjects(
    item: ReleaseTrackObjectItem
  ): Observable<{
    current: StixObject | null;
    prior: StixObject | null;
    expectedBaseline: boolean;
  }> {
    const stagedEntry = this.findStagedEntry(item.object_ref);
    const memberEntry = stagedEntry
      ? null
      : this.findMemberEntry(item.object_ref);
    const baselineEntry = stagedEntry ?? memberEntry;

    return forkJoin({
      current: this.fetchObjectVersion(
        item.object_ref,
        this.getDiffObjectModified(item)
      ),
      prior: baselineEntry
        ? this.fetchObjectVersion(
            baselineEntry.object_ref,
            this.getDiffObjectModified(baselineEntry)
          )
        : of(null),
    }).pipe(
      map(({ current, prior }) => ({
        current,
        prior,
        expectedBaseline: !!baselineEntry,
      }))
    );
  }

  private resolveStagedDiffObjects(item: ReleaseTrackObjectItem): Observable<{
    current: StixObject | null;
    prior: StixObject | null;
    expectedBaseline: boolean;
  }> {
    const memberEntry = this.findMemberEntry(item.object_ref);

    return forkJoin({
      current: this.fetchObjectVersion(
        item.object_ref,
        this.getDiffObjectModified(item)
      ),
      prior: memberEntry
        ? this.fetchObjectVersion(
            memberEntry.object_ref,
            this.getDiffObjectModified(memberEntry)
          )
        : of(null),
    }).pipe(
      map(({ current, prior }) => ({
        current,
        prior,
        expectedBaseline: !!memberEntry,
      }))
    );
  }

  private fetchObjectVersion(
    objectRef: string,
    modified?: Date | string
  ): Observable<StixObject | null> {
    const stixType = objectRef.split('--')[0] as StixType;
    const attackType = StixTypeToAttackType[stixType];
    const requestedModified = modified === 'latest' ? undefined : modified;

    let requestObject: Observable<StixObject[]>;
    switch (attackType) {
      case 'technique':
        requestObject = this.restApiConnectorService.getTechnique(
          objectRef,
          requestedModified
        );
        break;
      case 'tactic':
        requestObject = this.restApiConnectorService.getTactic(
          objectRef,
          requestedModified
        );
        break;
      case 'group':
        requestObject = this.restApiConnectorService.getGroup(
          objectRef,
          requestedModified
        );
        break;
      case 'campaign':
        requestObject = this.restApiConnectorService.getCampaign(
          objectRef,
          requestedModified
        );
        break;
      case 'asset':
        requestObject = this.restApiConnectorService.getAsset(
          objectRef,
          requestedModified
        );
        break;
      case 'software':
        requestObject = this.restApiConnectorService.getSoftware(
          objectRef,
          requestedModified
        );
        break;
      case 'mitigation':
        requestObject = this.restApiConnectorService.getMitigation(
          objectRef,
          requestedModified
        );
        break;
      case 'matrix':
        requestObject = this.restApiConnectorService.getMatrix(
          objectRef,
          requestedModified
        );
        break;
      case 'data-source':
        requestObject = this.restApiConnectorService.getDataSource(
          objectRef,
          requestedModified
        );
        break;
      case 'data-component':
        requestObject = this.restApiConnectorService.getDataComponent(
          objectRef,
          requestedModified
        );
        break;
      case 'detection-strategy':
        requestObject = this.restApiConnectorService.getDetectionStrategy(
          objectRef,
          requestedModified
        );
        break;
      case 'analytic':
        requestObject = this.restApiConnectorService.getAnalytic(
          objectRef,
          requestedModified
        );
        break;
      default:
        return of(null);
    }

    return requestObject.pipe(
      take(1),
      map(results => results[0] ?? null)
    );
  }

  private openDiffDialog(
    current: StixObject,
    prior: StixObject | null,
    relationshipCreatedBefore?: Date | string,
    relationshipAddedAfter?: Date | string
  ): void {
    this.dialog.open(StixDialogComponent, {
      data: {
        object: [current, prior],
        mode: 'diff',
        editable: false,
        sidebarControl: 'disable',
        relationshipCreatedBefore,
        relationshipAddedAfter,
      },
      maxHeight: '75vh',
      autoFocus: false,
    });
  }

  private getObjectStatus(item: ReleaseTrackObjectItem): WorkflowStatusType {
    return item.object_status || WorkflowStatus.WorkInProgress;
  }

  private isWorkInProgressCandidate(item: ReleaseTrackObjectItem): boolean {
    return (
      this.getObjectStatus(item) === WorkflowStatus.WorkInProgress ||
      String(item.object_status) === 'modified-in-place'
    );
  }

  public formatConfigOption(value: any): string {
    if (value === null || value === undefined || value === '') return 'not set';
    return String(value).replace(/[_-]+/g, ' ');
  }

  public getVirtualTrackPriority(track: any, index: number): number {
    return typeof track?.priority === 'number' ? track.priority : index;
  }

  public getVirtualScheduleValue(key: string): string {
    const value = this.virtualSnapshotSchedule?.[key];
    return value === null || value === undefined || value === ''
      ? 'not set'
      : String(value);
  }

  private setConfig(config: any): void {
    const normalizedConfig = this.normalizeConfig(config);
    this.releaseTrackConfig = normalizedConfig;
    this.configForm.patchValue(this.getConfigFormValue(normalizedConfig), {
      emitEvent: false,
    });
    this.syncCandidacyThresholdControl(!!normalizedConfig.auto_promote);
    this.syncSecondaryObjectThresholdControl(
      !!normalizedConfig.include_secondary_objects?.enabled
    );
  }

  private setVirtualConfig(): void {
    const deduplication = this.releaseTrack?.composition?.deduplication || {};
    const snapshotSchedule = this.virtualSnapshotSchedule;
    this.virtualConfigComponentTracks = this.cloneVirtualComponentTracks(
      this.virtualComponentTracks
    );

    this.configForm.patchValue(
      {
        virtualComponentTrackSearch: '',
        virtualDeduplicationStrategy:
          deduplication.strategy ??
          DeduplicationStrategy.PrioritizeLatestObject,
        virtualDeduplicationTier:
          deduplication.tier_resolution ?? SnapshotTier.Member,
        virtualDeduplicationStatus:
          deduplication.status_resolution ?? WorkflowStatus.Reviewed,
        virtualSnapshotScheduleMode:
          snapshotSchedule.mode ?? SnapshotScheduleMode.Manual,
        virtualSnapshotScheduleCron: snapshotSchedule.cron ?? '',
      },
      { emitEvent: false }
    );
  }

  private saveVirtualConfig(): void {
    const payload = this.getVirtualCompositionPayload();
    this.isSavingConfig = true;
    this.connector
      .updateComposition(this.id, payload)
      .pipe(
        take(1),
        finalize(() => {
          this.isSavingConfig = false;
        })
      )
      .subscribe({
        next: result => {
          this.isEditingConfig = false;
          if (this.releaseTrack) {
            this.releaseTrack.composition = this.getCompositionFromResponse(
              result,
              payload
            );
          }
          this.refreshReleaseTrackState();
        },
        error: err => {
          console.error('Failed to update virtual release track config', err);
        },
      });
  }

  private getCompositionFromResponse(response: any, fallback: any): any {
    if (!response) return fallback;
    return response.composition || response;
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

  private getVirtualCompositionPayload(): any {
    const value =
      this.configForm.getRawValue() as VirtualReleaseTrackConfigFormValue;
    const currentComposition = this.releaseTrack?.composition || {};

    return {
      ...currentComposition,
      component_tracks: this.virtualConfigComponentTracks.map(
        (track, index) => ({
          ...track,
          priority: index,
        })
      ),
      deduplication: {
        strategy:
          value.virtualDeduplicationStrategy ||
          DeduplicationStrategy.PrioritizeLatestObject,
        tier_resolution: value.virtualDeduplicationTier || SnapshotTier.Member,
        status_resolution:
          value.virtualDeduplicationStatus || WorkflowStatus.Reviewed,
      },
    };
  }

  private openReleasePreviewDialog(
    preview: any,
    track: ReleaseTrackSnapshot,
    item?: SnapshotHistoryViewModel
  ): void {
    const releaseRef = this.dialog.open(ReleasePreviewDialogComponent, {
      maxWidth: 'none',
      autoFocus: false,
      restoreFocus: true,
      ariaLabelledBy: 'release-preview-dialog-title',
      panelClass: 'release-preview-dialog-panel',
      backdropClass: 'release-preview-dialog-backdrop',
      data: {
        track,
        conflicts: this.getReleaseConflicts(preview),
        proposedMinorVersion: preview?.version,
        previewSummary: preview,
      },
    });

    releaseRef
      .afterClosed()
      .pipe(take(1))
      .subscribe((action: 'major' | 'minor' | undefined) => {
        if (action !== 'major' && action !== 'minor') return;
        this.releaseSnapshot({ increment: action }, item);
      });
  }

  private enrichReleasePreviewTrack(
    track: ReleaseTrackSnapshot,
    response: any
  ) {
    const objects = Array.isArray(response)
      ? response
      : Array.isArray(response?.data)
        ? response.data
        : [];
    const objectsByRevision = new Map<string, any>();

    objects.forEach((object: any) => {
      const objectRef = object?.stix?.id ?? object?.stixID ?? object?.id;
      const modified =
        object?.stix?.modified ?? object?.modified ?? object?.object_modified;
      if (objectRef && modified) {
        objectsByRevision.set(
          this.getReleasePreviewRevisionKey(objectRef, modified),
          object
        );
      }
    });

    const enrich = (entry: any) => {
      const object = objectsByRevision.get(
        this.getReleasePreviewRevisionKey(
          entry?.object_ref,
          entry?.object_modified
        )
      );
      if (!object) return entry;

      const stix = object?.stix ?? object;
      return {
        ...entry,
        name: object?.name ?? stix?.name ?? entry?.name,
        attack_id:
          object?.attackID ??
          object?.attack_id ??
          object?.workspace?.attack_id ??
          entry?.attack_id,
        attack_type:
          object?.attackType ??
          StixTypeToAttackType[stix?.type as StixType] ??
          entry?.attack_type,
        type: stix?.type ?? entry?.type,
        x_mitre_version:
          object?.version?.toString?.() ??
          object?.version ??
          stix?.x_mitre_version ??
          entry?.x_mitre_version,
      };
    };

    return {
      ...track,
      members: (track.members ?? []).map(enrich),
      staged: (track.staged ?? []).map(enrich),
      candidates: (track.candidates ?? []).map(enrich),
    } as ReleaseTrackSnapshot;
  }

  private getReleasePreviewRevisionKey(
    objectRef: unknown,
    modified: unknown
  ): string {
    const timestamp = new Date(modified as any).getTime();
    return `${String(objectRef ?? '')}::${timestamp}`;
  }

  private releaseSnapshot(
    selection: ReleasePayload,
    item?: SnapshotHistoryViewModel
  ): void {
    if (!this.id) return;

    this.isReleasing = true;
    const release = item?.modified
      ? this.connector.releaseSnapshot(this.id, item.modified, selection)
      : this.connector.releaseLatest(this.id, selection);

    release
      .pipe(
        take(1),
        finalize(() => {
          this.isReleasing = false;
        })
      )
      .subscribe({
        next: () => {
          if (item?.modified === this.createdDraftSnapshot?.modified) {
            this.createdDraftSnapshot = null;
          }
          this.refreshReleaseTrackState();
        },
        error: err => {
          console.error('Failed to tag release track snapshot', err);
        },
      });
  }

  private getReleaseConflicts(preview: any): any[] {
    return Array.isArray(preview?.conflicts) ? preview.conflicts : [];
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
      const addedCount = this.getAddedCount(
        snapshot,
        currentMembers,
        previousMembers
      );
      const modifiedCount = this.getModifiedCount(
        snapshot,
        currentMembers,
        previousMembers
      );
      const totalObjects = this.getSnapshotTotalObjects(
        snapshot,
        currentMembers
      );

      return {
        snapshot,
        title: this.getSnapshotTitle(snapshot),
        created: this.getSnapshotDate(snapshot),
        modified: this.getSnapshotModified(snapshot),
        taggedAt: this.getSnapshotTaggedAt(snapshot),
        isTagged: this.isTaggedSnapshot(snapshot),
        stats: this.getSnapshotStats(snapshot, addedCount, modifiedCount),
        addedCount,
        modifiedCount,
        totalObjects,
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
      snapshot.modified ||
      snapshot.snapshot_id ||
      snapshot.stix?.modified ||
      snapshot.created ||
      snapshot.tagged_at;
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

  private getSnapshotTaggedAt(
    snapshot: ReleaseTrackSnapshotHistoryItem
  ): Date | null {
    const value = snapshot.tagged_at;
    return value ? new Date(value) : null;
  }

  private getSnapshotTime(snapshot: ReleaseTrackSnapshotHistoryItem): number {
    return this.getSnapshotDate(snapshot)?.getTime() || 0;
  }

  private isTaggedSnapshot(snapshot: ReleaseTrackSnapshotHistoryItem): boolean {
    return !!(snapshot.version || snapshot.stix?.x_mitre_version);
  }

  private getSnapshotStats(
    snapshot: ReleaseTrackSnapshotHistoryItem,
    addedCount: number,
    modifiedCount: number
  ): SnapshotHistoryStat[] {
    const stats: SnapshotHistoryStat[] = [];
    const hasAddedCount = this.hasSnapshotCount(snapshot, 'added_count');
    const hasModifiedCount = this.hasSnapshotCount(snapshot, 'modified_count');

    if (hasAddedCount) {
      stats.push({
        label: 'Added',
        value: `+${addedCount}`,
        modifier: 'promote-color',
      });
    }

    if (hasModifiedCount) {
      stats.push({
        label: 'Modified',
        value: modifiedCount,
        modifier: 'modified-color',
      });
    }

    if (this.getSnapshotType(snapshot) === ReleaseTrackType.Virtual) {
      return [
        ...stats,
        {
          label: 'Members',
          value: this.getSnapshotCount(snapshot, 'members_count') ?? 0,
        },
        {
          label: 'Quarantine',
          value:
            this.getSnapshotCount(
              snapshot,
              'quarantine_count',
              'quarantined_count'
            ) ?? 0,
        },
      ];
    }

    const tierStats: SnapshotHistoryStat[] = [
      {
        label: 'Candidates',
        value: this.getSnapshotCount(snapshot, 'candidates_count') ?? 0,
        modifier: 'view-color',
      },
      {
        label: 'Staged',
        value: this.getSnapshotCount(snapshot, 'staged_count') ?? 0,
        modifier: 'promote-color',
      },
      {
        label: 'Members',
        value: this.getSnapshotCount(snapshot, 'members_count') ?? 0,
      },
    ];

    if (tierStats.some(stat => Number(stat.value) > 0)) {
      return [...stats, ...tierStats];
    }

    return [
      ...stats,
      {
        label: 'Total Objects',
        value: this.getSnapshotTotalObjects(
          snapshot,
          this.getSnapshotMembers(snapshot)
        ),
      },
    ];
  }

  private getSnapshotType(
    snapshot: ReleaseTrackSnapshotHistoryItem
  ): ReleaseTrackType | null {
    const type =
      snapshot.type ||
      (this.isLatestHistorySnapshot(snapshot) ? this.releaseTrack?.type : null);
    return type === ReleaseTrackType.Virtual
      ? ReleaseTrackType.Virtual
      : type === ReleaseTrackType.Standard
        ? ReleaseTrackType.Standard
        : null;
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
    const addedCount = this.getSnapshotCount(
      snapshot,
      'added_count',
      'promoted_count'
    );
    if (addedCount !== null) {
      return addedCount;
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
    const modifiedCount = this.getSnapshotCount(snapshot, 'modified_count');
    if (modifiedCount !== null) {
      return modifiedCount;
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
    if (this.getSnapshotType(snapshot) === ReleaseTrackType.Virtual) {
      const membersCount = this.getSnapshotCount(snapshot, 'members_count');
      const quarantineCount = this.getSnapshotCount(
        snapshot,
        'quarantine_count',
        'quarantined_count'
      );
      if (membersCount !== null || quarantineCount !== null) {
        return (membersCount ?? 0) + (quarantineCount ?? 0);
      }
    }

    const membersCount = this.getSnapshotCount(snapshot, 'members_count');
    const stagedCount = this.getSnapshotCount(snapshot, 'staged_count');
    const candidatesCount = this.getSnapshotCount(snapshot, 'candidates_count');
    if (
      membersCount !== null ||
      stagedCount !== null ||
      candidatesCount !== null
    ) {
      return (membersCount ?? 0) + (stagedCount ?? 0) + (candidatesCount ?? 0);
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

  private hasSnapshotCount(
    snapshot: ReleaseTrackSnapshotHistoryItem,
    ...keys: string[]
  ): boolean {
    return this.getSnapshotCount(snapshot, ...keys) !== null;
  }

  private getSnapshotCount(
    snapshot: ReleaseTrackSnapshotHistoryItem,
    ...keys: string[]
  ): number | null {
    const latestSnapshot = this.isLatestHistorySnapshot(snapshot)
      ? this.releaseTrack
      : null;

    for (const key of keys) {
      const value =
        snapshot[key] ??
        snapshot.summary?.[key] ??
        latestSnapshot?.summary?.[key] ??
        snapshot.statistics?.[key] ??
        null;
      if (typeof value === 'number') return value;
    }

    return null;
  }

  private isLatestHistorySnapshot(
    snapshot: ReleaseTrackSnapshotHistoryItem
  ): boolean {
    if (snapshot.is_latest) return true;
    if (!this.releaseTrack?.modified) return false;
    return (
      this.getSnapshotModified(snapshot) ===
      this.toIsoString(this.releaseTrack.modified)
    );
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
