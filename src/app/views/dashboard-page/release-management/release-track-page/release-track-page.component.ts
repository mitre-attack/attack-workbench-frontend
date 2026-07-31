import { SelectionModel } from '@angular/cdk/collections';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, take } from 'rxjs/operators';
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
  ReleaseTrackSnapshotOptions,
  ReleaseTrackType,
  ResolutionStrategy,
  SnapshotScheduleMode,
  SnapshotScheduleModeType,
  SnapshotTier,
  SnapshotTierType,
  StixObjectRef,
} from 'src/app/classes/release-tracks';
import { AddDialogComponent } from 'src/app/components/add-dialog/add-dialog.component';
import { DeleteDialogComponent } from 'src/app/components/delete-dialog/delete-dialog.component';
import { MultipleChoiceDialogComponent } from 'src/app/components/multiple-choice-dialog/multiple-choice-dialog.component';
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

interface SnapshotHistoryViewModel {
  snapshot: ReleaseTrackSnapshotHistoryItem;
  title: string;
  created: Date | null;
  modified: string | null;
  isTagged: boolean;
  isVirtual: boolean;
  membersCount: number;
  stagedCount?: number;
  candidatesCount?: number;
  quarantineCount?: number;
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

          this.breadcrumbService.changeBreadcrumb(
            this.route.snapshot,
            this.releaseTrack.name
          );

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
          this.snapshotHistory = this.buildSnapshotHistory(result.data);
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

        this.connector.addCandidates(this.id, selection.selected).subscribe({
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
        next: () => {
          this.refreshReleaseTrackState();
        },
        error: err => {
          console.error('Failed to create draft snapshot', err);
        },
      });
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
    this.chooseReleaseIncrement();
  }

  public onTagSnapshot(item: SnapshotHistoryViewModel): void {
    this.chooseReleaseIncrement(item);
  }

  private chooseReleaseIncrement(item?: SnapshotHistoryViewModel): void {
    if (!this.id || this.isReleasing) return;

    const selectionRef = this.dialog.open(MultipleChoiceDialogComponent, {
      width: '34em',
      autoFocus: false,
      data: {
        title: 'Choose a release version',
        description:
          'Use the next minor or major version for the release preview.',
        choices: [
          {
            label: 'Next minor version',
            value: 'minor',
          },
          {
            label: 'Next major version',
            value: 'major',
          },
        ],
      },
    });

    selectionRef
      .afterClosed()
      .pipe(take(1))
      .subscribe((increment: 'major' | 'minor' | undefined) => {
        if (increment !== 'major' && increment !== 'minor') return;
        this.previewRelease({ increment }, item);
      });
  }

  private previewRelease(
    selection: ReleasePayload,
    item?: SnapshotHistoryViewModel
  ): void {
    this.isReleasing = true;
    const preview = item?.modified
      ? this.connector.previewRelease(
          this.id,
          { format: ReleasePreviewFormat.Summary, ...selection },
          item.modified
        )
      : this.connector.previewRelease(this.id, {
          format: ReleasePreviewFormat.Summary,
          ...selection,
        });

    preview
      .pipe(
        take(1),
        finalize(() => {
          this.isReleasing = false;
        })
      )
      .subscribe({
        next: preview =>
          this.openReleasePreviewDialog(preview, selection, item),
        error: err => {
          console.error('Failed to preview release track release', err);
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
    selection: ReleasePayload,
    item?: SnapshotHistoryViewModel
  ): void {
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

    const choices = [
      {
        label: `Release${preview?.version ? ` (${preview.version})` : ''}`,
        value: 'release',
        description: this.getReleasePreviewDescription(preview),
      },
    ];

    const releaseRef = this.dialog.open(MultipleChoiceDialogComponent, {
      width: '34em',
      autoFocus: false,
      data: {
        title: 'Preview & release',
        description:
          'The release preview found no blocking conflicts. Confirm to tag the draft snapshot.',
        choices,
      },
    });

    releaseRef
      .afterClosed()
      .pipe(take(1))
      .subscribe((action: 'release' | undefined) => {
        if (action !== 'release') return;
        this.releaseSnapshot(selection, item);
      });
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
    if (preview?.type === ReleaseTrackType.Virtual) {
      const changes = preview?.changes || {};
      return `${changes.new_count || 0} new, ${
        changes.updated_count || 0
      } updated, ${changes.removed_count || 0} removed, and ${
        changes.quarantined_count || 0
      } quarantined objects.`;
    }

    const promoted = preview?.changes?.promoted_count || 0;
    const candidates = preview?.after?.candidates_count || 0;
    return `${promoted} staged object${
      promoted === 1 ? '' : 's'
    } will become members. ${candidates} candidate object${
      candidates === 1 ? '' : 's'
    } will remain outside the release.`;
  }

  private buildSnapshotHistory(
    snapshots: ReleaseTrackSnapshotHistoryItem[]
  ): SnapshotHistoryViewModel[] {
    const sorted = [...snapshots].sort(
      (a, b) => this.getSnapshotTime(b) - this.getSnapshotTime(a)
    );

    return sorted.map(snapshot => ({
      snapshot,
      title: this.getSnapshotTitle(snapshot),
      created: this.getSnapshotDate(snapshot),
      modified: snapshot.modified,
      isTagged: !!snapshot.version,
      isVirtual: snapshot.type === ReleaseTrackType.Virtual,
      membersCount: snapshot.members_count,
      stagedCount:
        snapshot.type === ReleaseTrackType.Standard
          ? snapshot.staged_count
          : undefined,
      candidatesCount:
        snapshot.type === ReleaseTrackType.Standard
          ? snapshot.candidates_count
          : undefined,
      quarantineCount:
        snapshot.type === ReleaseTrackType.Virtual
          ? snapshot.quarantine_count
          : undefined,
    }));
  }

  private getSnapshotTitle(snapshot: ReleaseTrackSnapshotHistoryItem): string {
    const version = snapshot.version;
    if (!version) return 'Draft Snapshot';
    return String(version).startsWith('v') ? String(version) : `v${version}`;
  }

  private getSnapshotDate(
    snapshot: ReleaseTrackSnapshotHistoryItem
  ): Date | null {
    return snapshot.modified ? new Date(snapshot.modified) : null;
  }

  private getSnapshotTime(snapshot: ReleaseTrackSnapshotHistoryItem): number {
    return this.getSnapshotDate(snapshot)?.getTime() || 0;
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

  private getSnapshotExportOptions(
    item: SnapshotHistoryViewModel
  ): Omit<ReleaseTrackSnapshotOptions, 'format'> | undefined {
    if (item.isTagged || this.releaseTrack?.type === ReleaseTrackType.Virtual) {
      return undefined;
    }

    return { include: 'staged' };
  }

  private toIsoString(value: Date | string | undefined): string | undefined {
    if (!value) return undefined;
    return value instanceof Date ? value.toISOString() : value;
  }
}
