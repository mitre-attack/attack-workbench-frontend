import { Clipboard } from '@angular/cdk/clipboard';
import { SelectionModel } from '@angular/cdk/collections';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { finalize, map, switchMap, take } from 'rxjs/operators';
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
  PublicationConfig,
  PublicationResolved,
  PublicationSource,
  ReleaseTrackConfig,
  ReleaseTrackSnapshot,
  ReleaseTrackSnapshotHistoryItem,
  ReleaseTrackSnapshotOptions,
  ReleaseTrackType,
  ResolutionStrategy,
  SnapshotScheduleMode,
  SnapshotScheduleModeType,
  SnapshotSchedule,
  StixObjectRef,
  UpdateMetadataPayload,
} from 'src/app/classes/release-tracks';
import { StixObject } from 'src/app/classes/stix';
import { Note } from 'src/app/classes/stix/note';
import { Role } from 'src/app/classes/authn/role';
import { AddDialogComponent } from 'src/app/components/add-dialog/add-dialog.component';
import { ConfirmationDialogComponent } from 'src/app/components/confirmation-dialog/confirmation-dialog.component';
import { DeleteDialogComponent } from 'src/app/components/delete-dialog/delete-dialog.component';
import { MultipleChoiceDialogComponent } from 'src/app/components/multiple-choice-dialog/multiple-choice-dialog.component';
import {
  ReleasePreviewDialogComponent,
  ReleasePreviewSelection,
} from 'src/app/components/release-preview-dialog/release-preview-dialog.component';
import { ReleaseVersionDialogComponent } from 'src/app/components/release-version-dialog/release-version-dialog.component';
import {
  ReleaseReviewDialogComponent,
  ReleaseReviewDialogResult,
  ReleaseReviewItem,
} from 'src/app/components/release-review-dialog/release-review-dialog.component';
import { ReleaseTrackObjectItem } from 'src/app/components/release-track-object-card/release-track-object-card.component';
import { SnapshotDescriptionDialogComponent } from 'src/app/components/snapshot-description-dialog/snapshot-description-dialog.component';
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
type StixVersion = '2.0' | '2.1';
type SnapshotExportChoice =
  | 'bundle-stix-2.0'
  | 'bundle-stix-2.1'
  | ExportFormat.Workbench
  | 'copy-summary';

interface SnapshotExportSelection {
  format: ExportFormatType;
  stixVersion?: StixVersion;
}

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

/** Mirrors the API's alias rule: 2-64 lowercase letters, digits, and hyphens. */
export const TRACK_ALIAS_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/;

interface SnapshotHistoryViewModel {
  snapshot: ReleaseTrackSnapshotHistoryItem;
  title: string;
  created: Date | null;
  modified: string | null;
  taggedAt: Date | null;
  isTagged: boolean;
  isLatest: boolean;
  /** The track's most recent release: the only one that can be deleted. */
  isLatestRelease: boolean;
  isCurrentDraft: boolean;
  stats: SnapshotHistoryStat[];
  contentStats: SnapshotHistoryStat[];
  contentTotal: number;
  addedCount: number;
  modifiedCount: number;
  totalObjects: number;
  hasCompositionResolution: boolean;
  compositionResolvedAt: Date | null;
  compositionResolutionRows: VirtualResolutionRow[];
}

interface SnapshotHistoryStat {
  label: string;
  value: string | number;
  modifier?: string;
  tooltip?: string;
}

interface ReleaseTrackConfigFormValue {
  autoPromote: boolean;
  candidacyThreshold: WorkflowStatusType | null;
  memberSyncStrategy: MemberSyncStrategyType;
  memberSyncSupplantBehavior: MemberSyncBehaviorType;
  memberSyncSupplantStatusPolicy: MemberSyncPolicyType;
  candidatesToStagedConflict: ConflictPolicyType;
  stagedToMembersConflict: ConflictPolicyType;
  publicationCollectionId: string;
  publicationCreated: string;
  publicationIdentityInherit: boolean;
  publicationIdentityValue: string;
  publicationMarkingsInherit: boolean;
  publicationMarkingsValue: string[];
}

interface PublicationOption {
  id: string;
  label: string;
}

interface VirtualReleaseTrackConfigFormValue {
  virtualDeduplicationStrategy: DeduplicationStrategyType;
  virtualSnapshotScheduleMode: SnapshotScheduleModeType;
  virtualSnapshotScheduleCron: string;
  virtualCronCadence: VirtualCronCadence;
  virtualCronMinute: number;
  virtualCronHour: number;
  virtualCronWeekdays: number[];
  virtualCronMonthDay: number;
  virtualCronMonths: number[];
  virtualScheduleDates: string[];
  virtualScheduleDateDraft: string;
  virtualScheduleDateHour: number;
  virtualScheduleDateMinute: number;
}

type VirtualCronCadence =
  'interval' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

interface SchedulePreset {
  label: string;
  cron: string;
}

interface VirtualResolutionRow {
  trackId: string;
  trackName: string;
  strategy: string;
  resolvedVersion?: string | null;
  resolvedSnapshotId?: string | null;
  filters?: string[];
  totalObjectsInSource?: number | null;
  objectsAfterFilter?: number | null;
  objectsContributed?: number | null;
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
const VIRTUAL_WEEKDAY_OPTIONS = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
];
const VIRTUAL_MONTH_OPTIONS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
].map((label, index) => ({ label, value: index + 1 }));

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
  /** Snapshot whose release preview is being prepared ('latest' for the header action). */
  public previewingSnapshotModified: string | null = null;
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
  private updatingSnapshotDescriptionModified = new Set<string>();
  private deletingReleaseModified = new Set<string>();
  private retaggingReleaseModified = new Set<string>();
  public publicationResolved: PublicationResolved | null = null;
  public publicationIdentityOptions: PublicationOption[] = [];
  public publicationMarkingOptions: PublicationOption[] = [];

  public candidacyOptions = Object.values(WorkflowStatus);
  public memberSyncStrategyOptions = Object.values(MemberSyncStrategy);
  public memberSyncBehaviorOptions = Object.values(MemberSyncBehavior);
  public memberSyncStatusPolicyOptions = Object.values(MemberSyncPolicy);
  public candidatesToStagedConflictOptions = Object.values(
    ConflictPolicy
  ).filter(policy => policy !== ConflictPolicy.Abort);
  public stagedToMembersConflictOptions = Object.values(ConflictPolicy);
  public virtualDeduplicationOptions = Object.values(DeduplicationStrategy);
  public virtualSnapshotScheduleModeOptions =
    Object.values(SnapshotScheduleMode);
  public virtualObjectTypeOptions = VIRTUAL_OBJECT_TYPE_OPTIONS.map(type => ({
    label: this.formatStixType(type),
    value: type,
  }));
  public virtualDomainOptions = VIRTUAL_DOMAIN_FILTER_OPTIONS;
  public virtualCronCadenceOptions: {
    label: string;
    value: VirtualCronCadence;
  }[] = [
    { label: 'Every 15 or 30 minutes', value: 'interval' },
    { label: 'Hourly', value: 'hourly' },
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' },
    { label: 'Yearly', value: 'yearly' },
  ];
  public virtualWeekdayOptions = VIRTUAL_WEEKDAY_OPTIONS;
  public virtualMonthOptions = VIRTUAL_MONTH_OPTIONS;
  public virtualHourOptions = Array.from({ length: 24 }, (_, value) => value);
  public virtualMinuteOptions = Array.from(
    { length: 12 },
    (_, index) => index * 5
  );
  public virtualMonthDayOptions = Array.from(
    { length: 28 },
    (_, index) => index + 1
  );
  public virtualCronUsesExistingExpression = false;
  public readonly schedulePresets: SchedulePreset[] = [
    { label: 'Hourly — at minute 0', cron: '0 * * * *' },
    { label: 'Every 15 minutes', cron: '*/15 * * * *' },
    { label: 'Every 30 minutes', cron: '*/30 * * * *' },
    { label: 'Daily at midnight UTC', cron: '0 0 * * *' },
    { label: 'Weekdays at 09:00 UTC', cron: '0 9 * * 1,2,3,4,5' },
    { label: 'Weekly on Monday at 09:00 UTC', cron: '0 9 * * 1' },
    { label: 'Monthly on day 1 at midnight UTC', cron: '0 0 1 * *' },
    { label: 'Yearly on January 1 at midnight UTC', cron: '0 0 1 1 *' },
  ];

  public displaySchedulePreset = (preset: SchedulePreset | null): string =>
    preset?.label || '';

  public get filteredSchedulePresets(): SchedulePreset[] {
    const value = this.configForm.get('virtualScheduleSearch')?.value;
    const query = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return this.schedulePresets.filter(preset =>
      preset.label.toLowerCase().includes(query)
    );
  }

  public selectSchedulePreset(preset: SchedulePreset): void {
    if (!this.schedulePresets.includes(preset)) return;
    this.configureVirtualCronExpression(preset.cron);
  }

  constructor(
    private connector: ReleaseTracksConnectorService,
    private breadcrumbService: BreadcrumbService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private snackbar: MatSnackBar,
    private restApiConnectorService: RestApiConnectorService,
    private authenticationService: AuthenticationService,
    private clipboard: Clipboard,
    private fb: FormBuilder
  ) {
    this.configForm = this.fb.group({
      alias: [
        '',
        [Validators.maxLength(64), Validators.pattern(TRACK_ALIAS_PATTERN)],
      ],
      autoPromote: [true],
      candidacyThreshold: [WorkflowStatus.Reviewed],
      memberSyncStrategy: [MemberSyncStrategy.Manual],
      memberSyncSupplantBehavior: [MemberSyncBehavior.Replace],
      memberSyncSupplantStatusPolicy: [MemberSyncPolicy.Preserve],
      candidatesToStagedConflict: [ConflictPolicy.PreferLatest],
      stagedToMembersConflict: [ConflictPolicy.Abort],
      publicationCollectionId: [''],
      publicationCreated: [''],
      publicationIdentityInherit: [true],
      publicationIdentityValue: [''],
      publicationMarkingsInherit: [true],
      publicationMarkingsValue: [[] as string[]],
      virtualDeduplicationStrategy: [
        DeduplicationStrategy.PrioritizeLatestObject,
      ],
      virtualSnapshotScheduleMode: [SnapshotScheduleMode.Manual],
      virtualSnapshotScheduleCron: [''],
      virtualCronCadence: ['daily' as VirtualCronCadence],
      virtualCronMinute: [0],
      virtualCronInterval: [15],
      virtualScheduleSearch: [null],
      virtualCronHour: [0],
      virtualCronWeekdays: [[1]],
      virtualCronMonthDay: [1],
      virtualCronMonths: [[1]],
      virtualScheduleDates: [[] as string[]],
      virtualScheduleDateDraft: [''],
      virtualScheduleDateHour: [0],
      virtualScheduleDateMinute: [0],
      virtualComponentTrackSearch: [''],
    });
    this.configForm.get('autoPromote')?.valueChanges.subscribe(autoPromote => {
      this.syncCandidacyThresholdControl(!!autoPromote);
    });
    [
      'virtualCronCadence',
      'virtualCronMinute',
      'virtualCronInterval',
      'virtualCronHour',
      'virtualCronWeekdays',
      'virtualCronMonthDay',
      'virtualCronMonths',
    ].forEach(controlName => {
      this.configForm.get(controlName)?.valueChanges.subscribe(() => {
        this.virtualCronUsesExistingExpression = false;
        this.configForm
          .get('virtualScheduleSearch')
          ?.reset(null, { emitEvent: false });
      });
    });
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
    return this.snapshotHistory.some((item, index) =>
      this.isCurrentDraftHistoryItem(item, index)
    );
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
    const value = this.releaseTrack?.composition_resolution?.resolved_at;
    if (!value) return null;
    return value instanceof Date ? value : new Date(value);
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
    return (
      !!this.id &&
      this.isVirtualReleaseTrack &&
      this.virtualComponentTracks.length > 0 &&
      !this.isCreatingDraft
    );
  }

  private isCurrentDraftHistoryItem(
    item: SnapshotHistoryViewModel,
    index: number
  ): boolean {
    return (
      !item.isTagged &&
      (typeof item.isCurrentDraft === 'boolean'
        ? item.isCurrentDraft
        : typeof item.isLatest === 'boolean'
          ? item.isLatest
          : index === 0)
    );
  }

  public get canEditReleaseTrack(): boolean {
    return this.authenticationService.canEdit();
  }

  public get canDeleteRelease(): boolean {
    return this.authenticationService.canDelete();
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
          if (res) {
            this.setReleaseTrack(res);
          } else {
            this.loadReleaseTrackSummary();
          }

          // this.loadCandidates();
        },
      });
  }

  private loadReleaseTrackSummary(): void {
    this.connector
      .listReleaseTracks()
      .pipe(take(1))
      .subscribe({
        next: result => {
          const track = this.getReleaseTrackList(result).find(
            item => this.getReleaseTrackId(item) === this.id
          );
          if (track) this.setReleaseTrack(track);
        },
      });
  }

  private setReleaseTrack(track: any): void {
    this.releaseTrack = track;
    if (!this.releaseTrack) return;
    // The route may carry the track's alias; work with the canonical id from
    // here on so confirmations and comparisons never see the alias.
    if (this.releaseTrack.id && this.releaseTrack.id !== this.id) {
      this.id = this.releaseTrack.id;
    }
    this.syncAliasControl();
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

  public isDeletingRelease(item: SnapshotHistoryViewModel): boolean {
    return !!item.modified && this.deletingReleaseModified.has(item.modified);
  }

  public isRetaggingRelease(item: SnapshotHistoryViewModel): boolean {
    return !!item.modified && this.retaggingReleaseModified.has(item.modified);
  }

  public onRetagRelease(item: SnapshotHistoryViewModel): void {
    if (
      !this.id ||
      !item.modified ||
      !item.isTagged ||
      !this.canDeleteRelease ||
      this.isRetaggingRelease(item)
    ) {
      return;
    }

    const currentVersion = item.snapshot.version || '';
    const modified = item.modified;
    const prompt = this.dialog.open(ReleaseVersionDialogComponent, {
      maxWidth: '35em',
      disableClose: true,
      autoFocus: false,
      data: { currentVersion },
    });

    prompt
      .afterClosed()
      .pipe(take(1))
      .subscribe(version => {
        if (!version || version === currentVersion) return;

        this.retaggingReleaseModified.add(modified);
        this.connector
          .retagRelease(this.id, modified, { version })
          .pipe(
            take(1),
            finalize(() => this.retaggingReleaseModified.delete(modified))
          )
          .subscribe({
            next: () => {
              this.snackbar.open(
                `Release ${currentVersion} changed to ${version}.`,
                null,
                { duration: 5000 }
              );
              this.refreshReleaseTrackState();
            },
            error: err =>
              console.error('Failed to change release version', err),
          });
      });
  }

  /**
   * Delete the track's most recent release. Only administrators may do this,
   * and they confirm by typing the release version.
   */
  public onDeleteRelease(item: SnapshotHistoryViewModel): void {
    if (
      !this.id ||
      !item.modified ||
      !item.isTagged ||
      !this.canDeleteRelease ||
      this.isDeletingRelease(item)
    ) {
      return;
    }
    const version = item.snapshot.version || '';
    const modified = item.modified;
    const rollsBackToDraft = !this.isVirtualReleaseTrack;
    const prompt = this.dialog.open(DeleteDialogComponent, {
      maxWidth: '35em',
      disableClose: true,
      autoFocus: false,
      data: {
        title: rollsBackToDraft
          ? `Roll back release ${version}?`
          : `Delete release ${version}?`,
        warning: rollsBackToDraft
          ? `Release ${version} of ${this.releaseTrackName || 'this track'} will be removed and its exact pre-release draft restored. This is blocked if a virtual snapshot depends on the release.`
          : `Release ${version} of ${this.releaseTrackName || 'this track'} will be permanently deleted.`,
        stixId: version,
      },
    });

    prompt
      .afterClosed()
      .pipe(take(1))
      .subscribe(confirm => {
        if (!confirm) return;

        this.deletingReleaseModified.add(modified);
        this.connector
          .deleteSnapshotByModified(this.id, modified, {
            confirmVersion: version,
          })
          .pipe(
            take(1),
            finalize(() => {
              this.deletingReleaseModified.delete(modified);
            })
          )
          .subscribe({
            next: () => {
              this.snackbar.open(
                rollsBackToDraft
                  ? `Release ${version} rolled back to draft.`
                  : `Release ${version} deleted.`,
                null,
                {
                  duration: 5000,
                }
              );
              this.getReleaseTrack();
              this.getSnapshotHistory();
            },
            error: err => {
              console.error('Failed to delete release', err);
              const dependents = err?.error?.dependent_snapshots;
              this.snackbar.open(
                Array.isArray(dependents) && dependents.length
                  ? `Unable to roll back: ${dependents.length} virtual snapshot${dependents.length === 1 ? '' : 's'} depend on this release.`
                  : err?.error?.message ||
                      'Unable to roll back this release. Please try again.',
                null,
                { duration: 5000, panelClass: 'error' }
              );
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
              this.setConfig(
                this.getConfigFromResponse(config, this.releaseTrack?.config)
              );
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
    this.openReviewDialog([item]);
  }

  public onReviewAll(items: ReleaseTrackObjectItem[]): void {
    this.openReviewDialog(items);
  }

  public onApproveAll(items: ReleaseTrackObjectItem[]): void {
    const awaitingReview = items.filter(
      item => this.getObjectStatus(item) === WorkflowStatus.AwaitingReview
    );
    if (!this.canReviewReleaseTrack || !awaitingReview.length) return;

    this.dialog
      .open(ConfirmationDialogComponent, {
        width: '32em',
        autoFocus: false,
        data: {
          title: 'Approve all awaiting-review objects?',
          message:
            'This will approve every awaiting-review object without stepping through its changes. Bulk approval is dangerous and cannot be undone from this review screen.',
          no_label: 'Cancel',
          yes_label: `Approve all (${awaitingReview.length})`,
          confirm_color: 'warn',
          confirm_appearance: 'raised',
          layout: 'simple',
        },
      })
      .afterClosed()
      .pipe(take(1))
      .subscribe(confirmed => {
        if (!confirmed) return;
        this.applyReviewResult({
          approved: awaitingReview,
          updateRequests: [],
        });
      });
  }

  public get canReviewReleaseTrack(): boolean {
    return this.authenticationService.isAuthorized([
      Role.ADMIN,
      Role.TEAM_LEAD,
    ]);
  }

  public canAddCandidates(lane: ReleaseTrackWorkspaceLane): boolean {
    return lane.key === 'candidates' || lane.key === 'candidates-wip';
  }

  public canReviewAndApprove(
    item: ReleaseTrackObjectItem,
    lane: ReleaseTrackWorkspaceLane
  ): boolean {
    return (
      this.canReviewReleaseTrack &&
      lane.type === 'candidate' &&
      this.getLaneStatus(item, lane) === WorkflowStatus.AwaitingReview
    );
  }

  public canReviewLane(lane: ReleaseTrackWorkspaceLane): boolean {
    return (
      this.canReviewReleaseTrack &&
      lane.type === 'candidate' &&
      lane.items.some(
        item => this.getLaneStatus(item, lane) === WorkflowStatus.AwaitingReview
      )
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

  private openExportFormatDialog(
    title: string,
    includeSummary = false
  ): Observable<SnapshotExportChoice | null> {
    const choices: {
      label: string;
      value: SnapshotExportChoice;
      description: string;
    }[] = [
      {
        label: 'Bundle (STIX 2.0)',
        value: 'bundle-stix-2.0',
        description:
          'Download a STIX 2.0 JSON bundle for publication or interchange.',
      },
      {
        label: 'Bundle (STIX 2.1)',
        value: 'bundle-stix-2.1',
        description:
          'Download a STIX 2.1 JSON bundle for publication or interchange.',
      },
      {
        label: 'Workbench',
        value: ExportFormat.Workbench,
        description:
          'Download the snapshot with workflow tiers, metadata, and other Workbench-specific data.',
      },
    ];

    if (includeSummary) {
      choices.push({
        label: 'Summary',
        value: 'copy-summary',
        description:
          'Copy lightweight snapshot metadata, object counts, and content statistics to the clipboard.',
      });
    }

    const formatRef = this.dialog.open(MultipleChoiceDialogComponent, {
      width: '30em',
      autoFocus: false,
      data: {
        title,
        description: includeSummary
          ? 'Choose a downloadable snapshot format or copy its concise history summary.'
          : 'Choose a downloadable snapshot format.',
        choices,
      },
    });

    return formatRef
      .afterClosed()
      .pipe(
        map(format =>
          format === 'bundle-stix-2.0' ||
          format === 'bundle-stix-2.1' ||
          format === ExportFormat.Workbench ||
          (includeSummary && format === 'copy-summary')
            ? format
            : null
        )
      );
  }

  private getSnapshotExportSelection(
    choice: SnapshotExportChoice | null
  ): SnapshotExportSelection | null {
    if (choice === 'bundle-stix-2.0') {
      return { format: ExportFormat.Bundle, stixVersion: '2.0' };
    }
    if (choice === 'bundle-stix-2.1') {
      return { format: ExportFormat.Bundle, stixVersion: '2.1' };
    }
    if (choice === ExportFormat.Workbench) {
      return { format: ExportFormat.Workbench };
    }
    return null;
  }

  public onDraft(): void {
    if (!this.canCreateDraft) return;

    const trackName = this.releaseTrackName || this.id || 'this release track';
    const dialogRef = this.dialog.open(SnapshotDescriptionDialogComponent, {
      autoFocus: false,
      data: {
        title: 'Create draft snapshot',
        message: `Create a copy of the latest snapshot for ${trackName}. Add optional notes so other analysts can understand this draft in history.`,
        description: this.releaseTrack?.snapshot_description || '',
        confirmLabel: 'Create draft',
      },
    });

    dialogRef.afterClosed().subscribe(description => {
      if (
        description === undefined ||
        !this.id ||
        !this.isVirtualReleaseTrack
      ) {
        return;
      }
      this.createVirtualDraftSnapshot(description);
    });
  }

  private createVirtualDraftSnapshot(description: string): void {
    this.isCreatingDraft = true;
    this.connector
      .createVirtualSnapshot(this.id, {
        description,
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

    const modified = this.getSnapshotModified(draftSnapshot);
    if (!modified) return null;
    const resolvedTotalObjects =
      typeof draftSnapshot.composition_resolution?.total_objects === 'number'
        ? draftSnapshot.composition_resolution.total_objects
        : null;
    const membersCount =
      this.getSnapshotCount(draftSnapshot, 'members_count') ??
      this.getSnapshotMembers(draftSnapshot).length;
    const quarantineCount =
      this.getSnapshotCount(
        draftSnapshot,
        'quarantine_count',
        'quarantined_count'
      ) ?? this.getSnapshotQuarantineCount(draftSnapshot);
    const shouldUseResolvedTotal =
      !membersCount && !quarantineCount && resolvedTotalObjects !== null;

    return {
      ...draftSnapshot,
      modified,
      version: null,
      type: ReleaseTrackType.Virtual,
      members_count: shouldUseResolvedTotal
        ? resolvedTotalObjects
        : membersCount,
      quarantine_count: quarantineCount,
    };
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
    this.loadPublicationOptions();
    this.syncAliasControl();
    this.isEditingConfig = true;
  }

  public onCancelConfigEdit(): void {
    if (this.isVirtualReleaseTrack) {
      this.setVirtualConfig();
    } else {
      this.setConfig(this.releaseTrackConfig);
    }
    this.syncAliasControl();
    this.isEditingConfig = false;
  }

  /**
   * Message for the page-level activity bar while a long-running operation is
   * in flight, or null. Each operation names what the server is doing so a
   * multi-second wait reads as work, not as a frozen page.
   */
  public get activityMessage(): string | null {
    if (this.isCreatingDraft) {
      return 'Creating the draft snapshot. Materializing a virtual track resolves every component track and can take a while.';
    }
    if (this.isReleasing) {
      return this.previewingSnapshotModified
        ? 'Preparing the release preview. Large tracks can take a while.'
        : 'Tagging the release and sealing its content.';
    }
    if (this.deletingReleaseModified.size > 0) {
      return this.isVirtualReleaseTrack
        ? 'Deleting the virtual release and reconciling the track.'
        : 'Rolling back the release and restoring its preserved draft.';
    }
    if (this.retaggingReleaseModified.size > 0) {
      return 'Changing the release version and rebuilding its exports.';
    }
    if (this.isDeleting) {
      return 'Deleting the release track and its history.';
    }
    if (this.isSavingConfig) {
      return 'Saving the track configuration.';
    }
    return null;
  }

  public get aliasUrlPreview(): string {
    const alias = (this.configForm.get('alias')?.value ?? '').trim();
    return `/dashboard/release-management/${alias || '<alias>'}`;
  }

  private syncAliasControl(): void {
    this.configForm
      .get('alias')
      ?.setValue(this.releaseTrack?.alias ?? '', { emitEvent: false });
  }

  /** The metadata update that brings the registry alias in line with the form, if any. */
  private getAliasUpdate(): UpdateMetadataPayload | null {
    const draft = (this.configForm.get('alias')?.value ?? '').trim();
    const current = this.releaseTrack?.alias ?? '';
    if (draft === current) return null;
    return { alias: draft || null };
  }

  /**
   * The alias is registry metadata saved through the metadata endpoint, so a
   * config save first applies any alias change, then runs the config write.
   */
  private withAliasUpdate<T>(next: () => Observable<T>): Observable<T> {
    const update = this.getAliasUpdate();
    if (!update) return next();
    return this.connector
      .updateMetadataByLatest(this.id, update)
      .pipe(switchMap(() => next()));
  }

  public onSaveConfig(): void {
    if (!this.id || this.isSavingConfig) return;
    const aliasControl = this.configForm.get('alias');
    if (aliasControl?.invalid) {
      aliasControl.markAsTouched();
      return;
    }
    if (this.isVirtualReleaseTrack) {
      if (!this.isVirtualScheduleValid) return;
      this.saveVirtualConfig();
      return;
    }

    const payload = this.getConfigPayload();
    const aliasChanged = !!this.getAliasUpdate();
    this.isSavingConfig = true;
    this.withAliasUpdate(() => this.connector.updateConfig(this.id, payload))
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
          this.getConfig();
          if (aliasChanged) this.getReleaseTrack();
        },
        error: err => {
          console.error('Failed to update release track config', err);
        },
      });
  }

  /**
   * Tagging is the second step of the draft-then-tag flow: a draft snapshot
   * (implicit for standard tracks, materialized for virtual ones) is
   * previewed and then tagged from its card on the Releases tab.
   */
  public onTagSnapshot(item: SnapshotHistoryViewModel): void {
    if (!item || item.isTagged || !item.modified) return;
    this.previewRelease(item);
  }

  private previewRelease(item: SnapshotHistoryViewModel): void {
    if (!this.id || !item.modified || this.isReleasing) return;

    this.isReleasing = true;
    this.previewingSnapshotModified = item.modified;
    const selection: ReleasePayload = { increment: 'minor' };
    // The workbench snapshot already carries each entry's name, ATT&CK ID,
    // type, and version, so no catalogue download is needed for the dialog.
    const preview = forkJoin({
      preview: this.connector.previewRelease(
        this.id,
        { format: ReleasePreviewFormat.Summary, ...selection },
        item.modified
      ),
      track: this.connector.retrieveSnapshotByModified(this.id, item.modified, {
        format: ExportFormat.Workbench,
        include: 'all',
      }),
    });

    preview
      .pipe(
        take(1),
        finalize(() => {
          this.isReleasing = false;
          this.previewingSnapshotModified = null;
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
            this.enrichReleasePreviewTrack(result.track),
            item
          );
        },
        error: err => {
          console.error('Failed to load objects for release preview', err);
        },
      });
  }

  public onExportSnapshot(item: SnapshotHistoryViewModel): void {
    if (!this.id || !item.modified) return;
    const modified = item.modified;

    this.openExportFormatDialog('Export release track snapshot', true)
      .pipe(take(1))
      .subscribe(choice => {
        if (!choice) return;
        if (choice === 'copy-summary') {
          this.copySnapshotSummary(item);
          return;
        }
        const selection = this.getSnapshotExportSelection(choice);
        if (selection) this.downloadSnapshot(item, modified, selection);
      });
  }

  private copySnapshotSummary(item: SnapshotHistoryViewModel): void {
    const copied = this.clipboard.copy(
      JSON.stringify(this.getSnapshotClipboardSummary(item), null, 2)
    );

    this.snackbar.open(
      copied
        ? 'Snapshot summary copied to the clipboard.'
        : 'Unable to copy the snapshot summary.',
      null,
      copied ? { duration: 3000 } : { duration: 5000, panelClass: 'error' }
    );
  }

  private getSnapshotClipboardSummary(
    item: SnapshotHistoryViewModel
  ): Record<string, any> {
    const snapshot = item.snapshot;
    const type = this.getSnapshotType(snapshot);
    const counts =
      type === ReleaseTrackType.Virtual
        ? {
            members: this.getSnapshotCount(snapshot, 'members_count') ?? 0,
            quarantine:
              this.getSnapshotCount(
                snapshot,
                'quarantine_count',
                'quarantined_count'
              ) ?? 0,
          }
        : {
            members: this.getSnapshotCount(snapshot, 'members_count') ?? 0,
            staged: this.getSnapshotCount(snapshot, 'staged_count') ?? 0,
            candidates:
              this.getSnapshotCount(snapshot, 'candidates_count') ?? 0,
          };

    return {
      id: snapshot.id || this.id,
      name: snapshot.name || this.releaseTrackName,
      type,
      version: snapshot.version ?? null,
      notes: snapshot.snapshot_description ?? null,
      modified: item.modified,
      tagged: item.isTagged,
      latest: item.isLatest,
      counts,
      content: {
        manifest_id: snapshot.content_manifest_id ?? null,
        statistics: snapshot.content_statistics ?? null,
      },
      bundle_id: snapshot.bundle_id ?? null,
    };
  }

  public isUpdatingSnapshotDescription(
    item: SnapshotHistoryViewModel
  ): boolean {
    return (
      !!item.modified &&
      this.updatingSnapshotDescriptionModified.has(item.modified)
    );
  }

  public onEditSnapshotDescription(item: SnapshotHistoryViewModel): void {
    if (
      !this.id ||
      !item.modified ||
      !this.canEditReleaseTrack ||
      item.isTagged ||
      this.isUpdatingSnapshotDescription(item)
    ) {
      return;
    }

    const modified = item.modified;
    const dialogRef = this.dialog.open(SnapshotDescriptionDialogComponent, {
      autoFocus: false,
      data: {
        title: item.snapshot.snapshot_description
          ? 'Edit snapshot notes'
          : 'Add snapshot notes',
        description: item.snapshot.snapshot_description || '',
        message:
          'These notes are visible on this snapshot in history and become the collection description in its STIX bundles. Notes are fixed once the snapshot is released.',
        confirmLabel: 'Save notes',
      },
    });

    dialogRef
      .afterClosed()
      .pipe(take(1))
      .subscribe((description: string | undefined) => {
        if (description === undefined) return;

        this.updatingSnapshotDescriptionModified.add(modified);
        this.connector
          .updateSnapshotDescription(this.id, modified, { description })
          .pipe(
            take(1),
            finalize(() => {
              this.updatingSnapshotDescriptionModified.delete(modified);
            })
          )
          .subscribe({
            next: snapshot => {
              const updatedDescription = snapshot.snapshot_description;
              item.snapshot = { ...item.snapshot, ...snapshot };

              if (
                this.releaseTrack &&
                this.getSnapshotModified(this.releaseTrack) === modified
              ) {
                Object.assign(this.releaseTrack, snapshot);
              }
              if (
                this.createdDraftSnapshot &&
                this.getSnapshotModified(this.createdDraftSnapshot) === modified
              ) {
                Object.assign(this.createdDraftSnapshot, snapshot);
              }

              this.snackbar.open(
                updatedDescription
                  ? 'Snapshot notes saved.'
                  : 'Snapshot notes cleared.',
                null,
                { duration: 3000 }
              );
            },
            error: err => {
              console.error('Failed to update snapshot notes', err);
              this.snackbar.open(
                'Unable to save snapshot notes. Please try again.',
                null,
                { duration: 5000, panelClass: 'error' }
              );
            },
          });
      });
  }

  private downloadSnapshot(
    item: SnapshotHistoryViewModel,
    modified: string,
    selection: SnapshotExportSelection
  ): void {
    this.connector
      .exportSnapshotByModified(
        this.id,
        modified,
        selection.format,
        this.getSnapshotExportOptions(selection)
      )
      .pipe(take(1))
      .subscribe({
        next: result => {
          this.restApiConnectorService.triggerBrowserDownload(
            result,
            this.getSnapshotExportFilename(item, selection)
          );
        },
        error: err => {
          console.error('Failed to export release track snapshot', err);
        },
      });
  }

  public getSnapshotBundleHash(
    item: SnapshotHistoryViewModel,
    stixVersion: StixVersion
  ): string | null {
    const hashes = item.snapshot.bundle_hashes;
    if (!hashes || hashes.manifest_id !== item.snapshot.content_manifest_id) {
      return null;
    }
    return stixVersion === '2.0' ? hashes.stix_2_0 : hashes.stix_2_1;
  }

  public copySnapshotBundleHash(
    item: SnapshotHistoryViewModel,
    stixVersion: StixVersion
  ): void {
    const hash = this.getSnapshotBundleHash(item, stixVersion);
    if (!hash) return;

    const copied = this.clipboard.copy(hash);
    this.snackbar.open(
      copied
        ? `STIX ${stixVersion} bundle SHA-256 copied to the clipboard.`
        : `Unable to copy the STIX ${stixVersion} bundle SHA-256.`,
      null,
      copied ? { duration: 3000 } : { duration: 5000, panelClass: 'error' }
    );
  }

  /**
   * Workbench exports select every tier; bundle exports replay the sealed
   * content manifest and accept only the STIX version.
   */
  private getSnapshotExportOptions(
    selection: SnapshotExportSelection
  ): Omit<ReleaseTrackSnapshotOptions, 'format'> | undefined {
    if (selection.format === ExportFormat.Workbench) {
      return { include: 'all' };
    }
    return selection.stixVersion
      ? { stixVersion: selection.stixVersion }
      : undefined;
  }

  public isPreviewingSnapshot(item: SnapshotHistoryViewModel): boolean {
    return (
      this.isReleasing &&
      !!item.modified &&
      this.previewingSnapshotModified === item.modified
    );
  }

  private openReviewDialog(items: ReleaseTrackObjectItem[]): void {
    const awaitingReview = items.filter(
      item => this.getObjectStatus(item) === WorkflowStatus.AwaitingReview
    );
    if (!this.canReviewReleaseTrack || !awaitingReview.length) return;

    forkJoin(
      awaitingReview.map(item =>
        this.resolveReviewDiffObjects(item).pipe(
          map(({ current, prior }) =>
            current ? ({ item, current, prior } as ReleaseReviewItem) : null
          )
        )
      )
    )
      .pipe(take(1))
      .subscribe({
        next: resolvedItems => {
          const reviewItems = resolvedItems.filter(
            (item): item is ReleaseReviewItem => !!item
          );
          if (!reviewItems.length) {
            this.snackbar.open(
              'Unable to load the objects awaiting review.',
              undefined,
              { duration: 4000, panelClass: 'error' }
            );
            return;
          }

          if (reviewItems.length !== awaitingReview.length) {
            this.snackbar.open(
              'Some objects could not be loaded and were omitted from review.',
              undefined,
              { duration: 4000 }
            );
          }

          this.openResolvedReviewDialog(reviewItems);
        },
        error: err => {
          console.error('Failed to load objects for review', err);
          this.snackbar.open(
            'Unable to load the objects awaiting review.',
            undefined,
            { duration: 4000, panelClass: 'error' }
          );
        },
      });
  }

  /**
   * Review always compares the proposed candidate revision with the current
   * released member. A staged entry is deliberately not used as the baseline.
   */
  private resolveReviewDiffObjects(item: ReleaseTrackObjectItem): Observable<{
    current: StixObject | null;
    prior: StixObject | null;
  }> {
    return this.resolveDiffObjects(item, this.findMemberEntry(item.object_ref));
  }

  private openResolvedReviewDialog(items: ReleaseReviewItem[]): void {
    this.dialog
      .open<
        ReleaseReviewDialogComponent,
        { items: ReleaseReviewItem[] },
        ReleaseReviewDialogResult
      >(ReleaseReviewDialogComponent, {
        data: { items },
        panelClass: 'release-review-dialog-panel',
        maxWidth: 'none',
        autoFocus: false,
        restoreFocus: true,
      })
      .afterClosed()
      .pipe(take(1))
      .subscribe(result => this.applyReviewResult(result));
  }

  private applyReviewResult(result?: ReleaseReviewDialogResult): void {
    if (!this.id || !result) return;

    const requests: Observable<unknown>[] = [];
    const approvedRefs = result.approved
      .map(item => this.getReviewObjectRef(item))
      .filter((ref): ref is StixObjectRef => !!ref);

    if (approvedRefs.length) {
      requests.push(
        this.connector.reviewCandidates(this.id, {
          from: WorkflowStatus.AwaitingReview,
          to: WorkflowStatus.Reviewed,
          object_refs: approvedRefs,
        })
      );
    }

    result.updateRequests.forEach(request => {
      const note = new Note();
      note.title = `Updates requested: ${request.item.name || request.item.attack_id || 'Object'}`;
      note.content = request.note;
      note.object_refs = [request.item.object_ref];
      requests.push(this.restApiConnectorService.postNote(note));
    });

    if (!requests.length) return;

    forkJoin(requests)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.snackbar.open('Review updates saved.', undefined, {
            duration: 3000,
          });
          this.refreshReleaseTrackState();
        },
        error: err => {
          console.error('Failed to save release track review', err);
          this.snackbar.open('Unable to save all review updates.', undefined, {
            duration: 5000,
            panelClass: 'error',
          });
          this.refreshReleaseTrackState();
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

    return this.resolveDiffObjects(item, baselineEntry).pipe(
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

    return this.resolveDiffObjects(item, memberEntry).pipe(
      map(({ current, prior }) => ({
        current,
        prior,
        expectedBaseline: !!memberEntry,
      }))
    );
  }

  private resolveDiffObjects(
    item: ReleaseTrackObjectItem,
    baselineEntry: ReleaseTrackObjectItem | null
  ): Observable<{
    current: StixObject | null;
    prior: StixObject | null;
  }> {
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
    });
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

  public getVirtualScheduleModeLabel(mode: SnapshotScheduleMode): string {
    switch (mode) {
      case SnapshotScheduleMode.Cron:
        return 'Recurring';
      case SnapshotScheduleMode.Dates:
        return 'Specific dates';
      default:
        return 'Manual';
    }
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

  public formatTwoDigit(value: number): string {
    return String(value).padStart(2, '0');
  }

  public get virtualCronExpression(): string {
    const value =
      this.configForm.getRawValue() as VirtualReleaseTrackConfigFormValue;
    if (this.virtualCronUsesExistingExpression) {
      return value.virtualSnapshotScheduleCron;
    }

    const prefix = `${value.virtualCronMinute} ${value.virtualCronHour}`;
    switch (value.virtualCronCadence) {
      case 'hourly':
        return `${value.virtualCronMinute} * * * *`;
      case 'interval':
        return `*/${this.configForm.get('virtualCronInterval')?.value} * * * *`;
      case 'weekly':
        return `${prefix} * * ${[...value.virtualCronWeekdays].sort().join(',')}`;
      case 'monthly':
        return `${prefix} ${value.virtualCronMonthDay} * *`;
      case 'yearly':
        return `${prefix} ${value.virtualCronMonthDay} ${[
          ...value.virtualCronMonths,
        ]
          .sort((left, right) => left - right)
          .join(',')} *`;
      default:
        return `${prefix} * * *`;
    }
  }

  public get virtualScheduleDates(): string[] {
    return (
      (this.configForm.get('virtualScheduleDates')?.value as string[]) || []
    );
  }

  public get virtualScheduleDateMin(): string {
    return new Date().toISOString().slice(0, 10);
  }

  public get isVirtualScheduleValid(): boolean {
    const value =
      this.configForm.getRawValue() as VirtualReleaseTrackConfigFormValue;
    if (value.virtualSnapshotScheduleMode === SnapshotScheduleMode.Dates) {
      return value.virtualScheduleDates.length > 0;
    }
    if (value.virtualSnapshotScheduleMode !== SnapshotScheduleMode.Cron) {
      return true;
    }
    if (
      typeof this.configForm.get('virtualScheduleSearch')?.value === 'string' &&
      this.configForm.get('virtualScheduleSearch')?.value.trim()
    )
      return false;
    if (this.virtualCronUsesExistingExpression) return true;
    if (
      value.virtualCronCadence === 'weekly' &&
      !value.virtualCronWeekdays.length
    ) {
      return false;
    }
    return !(
      value.virtualCronCadence === 'yearly' && !value.virtualCronMonths.length
    );
  }

  public get canAddVirtualScheduleDate(): boolean {
    const value =
      this.configForm.getRawValue() as VirtualReleaseTrackConfigFormValue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.virtualScheduleDateDraft)) {
      return false;
    }
    return this.isValidVirtualScheduleDate(
      value.virtualScheduleDateDraft,
      value.virtualScheduleDateHour,
      value.virtualScheduleDateMinute
    );
  }

  public addVirtualScheduleDate(): void {
    if (!this.canAddVirtualScheduleDate) return;
    const value =
      this.configForm.getRawValue() as VirtualReleaseTrackConfigFormValue;
    const date = this.buildVirtualScheduleDate(
      value.virtualScheduleDateDraft,
      value.virtualScheduleDateHour,
      value.virtualScheduleDateMinute
    ).toISOString();
    this.configForm.patchValue({
      virtualScheduleDates: [
        ...new Set([...value.virtualScheduleDates, date]),
      ].sort(),
      virtualScheduleDateDraft: '',
    });
  }

  public removeVirtualScheduleDate(date: string): void {
    this.configForm.patchValue({
      virtualScheduleDates: this.virtualScheduleDates.filter(
        item => item !== date
      ),
    });
  }

  public replaceExistingCronExpression(): void {
    this.virtualCronUsesExistingExpression = false;
    this.configForm.patchValue({
      virtualCronCadence: 'daily',
      virtualCronMinute: 0,
      virtualCronHour: 0,
    });
  }

  private buildVirtualScheduleDate(
    date: string,
    hour: number,
    minute: number
  ): Date {
    return new Date(
      `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`
    );
  }

  private isValidVirtualScheduleDate(
    date: string,
    hour: number,
    minute: number
  ): boolean {
    const value = this.buildVirtualScheduleDate(date, hour, minute);
    return (
      !Number.isNaN(value.getTime()) &&
      value.toISOString().slice(0, 10) === date &&
      value.getTime() > Date.now()
    );
  }

  private setConfig(config: any): void {
    const normalizedConfig = this.normalizeConfig(config);
    this.releaseTrackConfig = normalizedConfig;
    if (normalizedConfig.publication_resolved) {
      this.publicationResolved = normalizedConfig.publication_resolved;
    }
    this.configForm.patchValue(this.getConfigFormValue(normalizedConfig), {
      emitEvent: false,
    });
    this.syncCandidacyThresholdControl(!!normalizedConfig.auto_promote);
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
        virtualSnapshotScheduleMode:
          snapshotSchedule.mode ?? SnapshotScheduleMode.Manual,
        virtualSnapshotScheduleCron: snapshotSchedule.cron ?? '',
        virtualScheduleDates: (snapshotSchedule.dates ?? []).map((date: any) =>
          new Date(date).toISOString()
        ),
        virtualScheduleDateDraft: '',
      },
      { emitEvent: false }
    );
    this.configureVirtualCronExpression(snapshotSchedule.cron);
    this.initialVirtualComposition = JSON.stringify(
      this.getVirtualCompositionPayload()
    );
  }

  private configureVirtualCronExpression(cron?: string): void {
    this.configForm
      .get('virtualScheduleSearch')
      ?.reset(
        this.schedulePresets.find(preset => preset.cron === cron) || null,
        { emitEvent: false }
      );
    if (cron && /^(0|5|[1-5][05]|\*\/(15|30)) \* \* \* \*$/.test(cron)) {
      this.virtualCronUsesExistingExpression = false;
      this.configForm.patchValue(
        {
          virtualCronCadence: cron.startsWith('*/') ? 'interval' : 'hourly',
          virtualCronMinute: cron.startsWith('*/')
            ? 0
            : Number(cron.split(' ')[0]),
          virtualCronInterval: cron.startsWith('*/30') ? 30 : 15,
        },
        { emitEvent: false }
      );
      return;
    }
    if (!cron) {
      this.virtualCronUsesExistingExpression = false;
      return;
    }
    const fields = cron.trim().split(/\s+/);
    const minute = Number(fields[0]);
    const hour = Number(fields[1]);
    if (
      fields.length !== 5 ||
      !Number.isInteger(minute) ||
      minute < 0 ||
      minute > 59 ||
      !this.virtualMinuteOptions.includes(minute) ||
      !Number.isInteger(hour) ||
      hour < 0 ||
      hour > 23
    ) {
      this.virtualCronUsesExistingExpression = true;
      return;
    }

    const parseList = (field: string, minimum: number, maximum: number) => {
      const values = field.split(',').map(Number);
      return values.length > 0 &&
        new Set(values).size === values.length &&
        values.every(
          value =>
            Number.isInteger(value) && value >= minimum && value <= maximum
        )
        ? values
        : null;
    };
    const [, , dayOfMonth, month, dayOfWeek] = fields;
    let controls: Record<string, any> | null = null;
    if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      controls = { virtualCronCadence: 'daily' };
    } else if (dayOfMonth === '*' && month === '*') {
      const weekdays = parseList(dayOfWeek, 0, 6);
      if (weekdays) {
        controls = {
          virtualCronCadence: 'weekly',
          virtualCronWeekdays: weekdays,
        };
      }
    } else if (month === '*' && dayOfWeek === '*') {
      const monthDay = Number(dayOfMonth);
      if (Number.isInteger(monthDay) && monthDay >= 1 && monthDay <= 28) {
        controls = {
          virtualCronCadence: 'monthly',
          virtualCronMonthDay: monthDay,
        };
      }
    } else if (dayOfWeek === '*') {
      const monthDay = Number(dayOfMonth);
      const months = parseList(month, 1, 12);
      if (
        Number.isInteger(monthDay) &&
        monthDay >= 1 &&
        monthDay <= 28 &&
        months
      ) {
        controls = {
          virtualCronCadence: 'yearly',
          virtualCronMonthDay: monthDay,
          virtualCronMonths: months,
        };
      }
    }

    this.virtualCronUsesExistingExpression = !controls;
    if (controls) {
      this.configForm.patchValue(
        {
          ...controls,
          virtualCronMinute: minute,
          virtualCronHour: hour,
        },
        { emitEvent: false }
      );
    }
  }

  private saveVirtualConfig(): void {
    const payload = this.getVirtualCompositionPayload();
    const publication = this.getPublicationPayload(
      this.configForm.getRawValue() as ReleaseTrackConfigFormValue
    );
    const aliasChanged = !!this.getAliasUpdate();
    const compositionChanged = this.hasVirtualCompositionChanges(payload);
    this.isSavingConfig = true;
    this.withAliasUpdate(() =>
      compositionChanged
        ? this.connector.updateComposition(this.id, payload)
        : of(this.releaseTrack?.composition)
    )
      .pipe(
        take(1),
        switchMap(result =>
          this.connector
            .updateSchedule(this.id, this.getVirtualSchedulePayload())
            .pipe(map(scheduleResult => ({ result, scheduleResult })))
        ),
        switchMap(({ result, scheduleResult }) =>
          this.connector
            .updateConfig(this.id, { publication })
            .pipe(
              map(configResult => ({ result, scheduleResult, configResult }))
            )
        ),
        finalize(() => {
          this.isSavingConfig = false;
        })
      )
      .subscribe({
        next: ({ result, scheduleResult, configResult }) => {
          this.isEditingConfig = false;
          if (this.releaseTrack) {
            this.releaseTrack.composition = this.getCompositionFromResponse(
              result,
              payload
            );
            this.releaseTrack.snapshot_schedule =
              scheduleResult?.snapshot_schedule ||
              this.getVirtualSchedulePayload();
          }
          this.setConfig(
            this.getConfigFromResponse(configResult, { publication })
          );
          this.refreshReleaseTrackState();
          this.getConfig();
          if (aliasChanged) this.getReleaseTrack();
        },
        error: err => {
          console.error('Failed to update virtual release track config', err);
        },
      });
  }

  private getVirtualSchedulePayload(): SnapshotSchedule {
    const value =
      this.configForm.getRawValue() as VirtualReleaseTrackConfigFormValue;
    switch (value.virtualSnapshotScheduleMode) {
      case SnapshotScheduleMode.Cron:
        return {
          mode: SnapshotScheduleMode.Cron,
          cron: this.virtualCronExpression,
        };
      case SnapshotScheduleMode.Dates:
        return {
          mode: SnapshotScheduleMode.Dates,
          dates: value.virtualScheduleDates,
        };
      default:
        return { mode: SnapshotScheduleMode.Manual };
    }
  }

  private initialVirtualComposition = '';

  private hasVirtualCompositionChanges(payload: any): boolean {
    return JSON.stringify(payload) !== this.initialVirtualComposition;
  }

  private getCompositionFromResponse(response: any, fallback: any): any {
    if (!response) return fallback;
    return response.composition || response;
  }

  private syncCandidacyThresholdControl(autoPromote: boolean): void {
    this.syncWorkflowStatusControl('candidacyThreshold', autoPromote);
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
      'promotion_conflicts',
      'member_sync',
      'publication',
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
    return {
      auto_promote: source.auto_promote ?? true,
      candidacy_threshold:
        source.candidacy_threshold ?? WorkflowStatus.Reviewed,
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
      publication: {
        collection_id: source.publication?.collection_id ?? null,
        created: source.publication?.created ?? null,
        created_by_ref: source.publication?.created_by_ref ?? { inherit: true },
        object_marking_refs: source.publication?.object_marking_refs ?? {
          inherit: true,
        },
      },
      publication_resolved: source.publication_resolved,
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
      publicationCollectionId: config.publication?.collection_id ?? '',
      publicationCreated: config.publication?.created ?? '',
      publicationIdentityInherit:
        config.publication?.created_by_ref?.inherit !== false,
      publicationIdentityValue:
        config.publication?.created_by_ref?.inherit === false
          ? config.publication.created_by_ref.value
          : '',
      publicationMarkingsInherit:
        config.publication?.object_marking_refs?.inherit !== false,
      publicationMarkingsValue:
        config.publication?.object_marking_refs?.inherit === false
          ? [...config.publication.object_marking_refs.value]
          : [],
    };
  }

  private getPublicationPayload(
    value: ReleaseTrackConfigFormValue
  ): PublicationConfig {
    const identityValue = value.publicationIdentityValue?.trim();
    const markingValues = (value.publicationMarkingsValue || []).filter(
      Boolean
    );
    const payload: PublicationConfig = {
      created_by_ref:
        value.publicationIdentityInherit || !identityValue
          ? { inherit: true }
          : { inherit: false, value: identityValue },
      object_marking_refs:
        value.publicationMarkingsInherit || markingValues.length === 0
          ? { inherit: true }
          : { inherit: false, value: markingValues },
    };
    // Collection identity is immutable once released; only send it while it
    // can still change so an unchanged form never triggers a conflict.
    if (!this.hasTaggedRelease) {
      payload.collection_id = value.publicationCollectionId?.trim() || null;
      payload.created = value.publicationCreated?.trim() || null;
    }
    return payload;
  }

  public get hasTaggedRelease(): boolean {
    return (this.releaseTrack?.version_history?.length ?? 0) > 0;
  }

  public get publicationIdentityLabel(): string {
    const resolved = this.publicationResolved;
    if (!resolved) return '';
    const option = this.publicationIdentityOptions.find(
      candidate => candidate.id === resolved.created_by_ref
    );
    return option?.label || resolved.created_by_ref;
  }

  public get publicationMarkingLabels(): string[] {
    const resolved = this.publicationResolved;
    if (!resolved) return [];
    return resolved.object_marking_refs.map(
      ref =>
        this.publicationMarkingOptions.find(candidate => candidate.id === ref)
          ?.label || ref
    );
  }

  public formatPublicationSource(source?: PublicationSource): string {
    switch (source) {
      case 'track':
        return 'Track override';
      case 'global':
        return 'Inherited from organization settings';
      case 'content':
        return 'Derived from bundle contents';
      case 'derived':
        return 'Derived from this track';
      default:
        return '';
    }
  }

  private loadPublicationOptions(): void {
    // The connector exposes these as getters returning bound-by-call functions,
    // so they must be invoked as methods on the service.
    const service = this.restApiConnectorService as any;
    if (typeof service?.getAllIdentities === 'function') {
      service
        .getAllIdentities()
        .pipe(take(1))
        .subscribe({
          next: (result: any) => {
            this.publicationIdentityOptions = (result?.data ?? []).map(
              (identity: any) => ({
                id: identity.stixID ?? identity.stix?.id,
                label:
                  identity.name ??
                  identity.stix?.name ??
                  identity.stixID ??
                  identity.stix?.id,
              })
            );
          },
          error: err =>
            console.error('Failed to load identities for publication', err),
        });
    }
    if (typeof service?.getAllMarkingDefinitions === 'function') {
      service
        .getAllMarkingDefinitions()
        .pipe(take(1))
        .subscribe({
          next: (result: any) => {
            this.publicationMarkingOptions = (result?.data ?? []).map(
              (marking: any) => ({
                id: marking.stixID ?? marking.stix?.id,
                label:
                  marking.definition_string ??
                  marking.stix?.definition?.tlp ??
                  marking.stixID ??
                  marking.stix?.id,
              })
            );
          },
          error: err =>
            console.error(
              'Failed to load marking definitions for publication',
              err
            ),
        });
    }
  }

  private getConfigPayload(): ReleaseTrackConfig {
    const value = this.configForm.getRawValue() as ReleaseTrackConfigFormValue;
    const payload: ReleaseTrackConfig = {
      auto_promote: value.autoPromote,
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
    payload.publication = this.getPublicationPayload(value);

    return payload;
  }

  private getVirtualCompositionPayload(): any {
    const value =
      this.configForm.getRawValue() as VirtualReleaseTrackConfigFormValue;

    return {
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
      },
    };
  }

  private openReleasePreviewDialog(
    preview: any,
    track: ReleaseTrackSnapshot,
    item: SnapshotHistoryViewModel
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
      .subscribe((selection: ReleasePreviewSelection | undefined) => {
        if (!selection) return;
        this.releaseSnapshot(selection, item);
      });
  }

  /**
   * Tier entries arrive with name, ATT&CK ID, STIX type, and version from the
   * API; only the Workbench attack type has to be derived for the dialog.
   */
  private enrichReleasePreviewTrack(
    track: ReleaseTrackSnapshot
  ): ReleaseTrackSnapshot {
    const enrich = (entry: any) => ({
      ...entry,
      attack_type:
        entry?.attack_type ??
        StixTypeToAttackType[entry?.type as StixType] ??
        entry?.attack_type,
    });

    return {
      ...track,
      members: (track.members ?? []).map(enrich),
      staged: (track.staged ?? []).map(enrich),
      candidates: (track.candidates ?? []).map(enrich),
    } as ReleaseTrackSnapshot;
  }

  private releaseSnapshot(
    selection: ReleasePayload,
    item: SnapshotHistoryViewModel
  ): void {
    if (!this.id || !item.modified) return;

    this.isReleasing = true;
    this.connector
      .releaseSnapshot(this.id, item.modified, selection)
      .pipe(
        take(1),
        finalize(() => {
          this.isReleasing = false;
        })
      )
      .subscribe({
        next: () => {
          if (item.modified === this.createdDraftSnapshot?.modified) {
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
    const retainedSourceDrafts = new Set(
      snapshots
        .filter(snapshot => this.isTaggedSnapshot(snapshot))
        .map(snapshot => snapshot.release_source_modified)
        .filter((modified): modified is string | Date => !!modified)
        .map(modified =>
          modified instanceof Date ? modified.toISOString() : String(modified)
        )
    );
    const visibleSnapshots = snapshots.filter(snapshot => {
      if (this.isTaggedSnapshot(snapshot)) return true;
      const modified = this.getSnapshotModified(snapshot);
      return !modified || !retainedSourceDrafts.has(modified);
    });
    const sorted = [...visibleSnapshots].sort(
      (a, b) => this.getSnapshotTime(b) - this.getSnapshotTime(a)
    );
    const latestSnapshot =
      sorted.find(snapshot => this.isLatestHistorySnapshot(snapshot)) ??
      sorted[0];
    const latestRelease = sorted.find(snapshot =>
      this.isTaggedSnapshot(snapshot)
    );

    return sorted.map((snapshot, index) => {
      const previousSnapshot = sorted[index + 1];
      const isTagged = this.isTaggedSnapshot(snapshot);
      const isLatest = snapshot === latestSnapshot;
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
        isTagged,
        isLatest,
        isLatestRelease: isTagged && snapshot === latestRelease,
        isCurrentDraft: !isTagged && isLatest,
        stats: this.getSnapshotStats(snapshot, addedCount, modifiedCount),
        contentStats: this.getContentStats(snapshot),
        contentTotal: snapshot.content_statistics?.total_count ?? 0,
        addedCount,
        modifiedCount,
        totalObjects,
        hasCompositionResolution: snapshot.composition_resolution != null,
        compositionResolvedAt: this.getCompositionResolvedAt(snapshot),
        compositionResolutionRows:
          this.getSnapshotCompositionResolutionRows(snapshot),
      };
    });
  }

  private getCompositionResolvedAt(
    snapshot: ReleaseTrackSnapshotHistoryItem
  ): Date | null {
    const value = snapshot.composition_resolution?.resolved_at;
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private getSnapshotCompositionResolutionRows(
    snapshot: ReleaseTrackSnapshotHistoryItem
  ): VirtualResolutionRow[] {
    const components = snapshot.composition_resolution?.component_snapshots;
    if (!Array.isArray(components)) return [];

    return components.map(component => ({
      trackId: component.track_id,
      trackName: component.track_name || component.track_id,
      strategy: component.strategy_used || '',
      resolvedVersion: component.resolved_version || null,
      resolvedSnapshotId: component.resolved_snapshot_id
        ? this.toIsoString(component.resolved_snapshot_id)
        : null,
      filters: this.getComponentTrackFilters({
        filters: component.filters_applied,
      }),
      totalObjectsInSource: this.toOptionalNumber(
        component.total_objects_in_source
      ),
      objectsAfterFilter: this.toOptionalNumber(component.objects_after_filter),
      objectsContributed: this.toOptionalNumber(component.objects_contributed),
    }));
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

  private getContentStats(
    snapshot: ReleaseTrackSnapshotHistoryItem
  ): SnapshotHistoryStat[] {
    const statistics = snapshot.content_statistics;
    if (!snapshot.content_manifest_id || !statistics) return [];

    const stats: SnapshotHistoryStat[] = [
      {
        label: 'Members',
        value: statistics.primary_count,
        tooltip: 'Exact object revisions selected as snapshot members.',
      },
      {
        label: 'Relationships',
        value: statistics.relationship_count,
        tooltip:
          'Relationships whose source and target are both members, pinned to those member revisions.',
      },
      {
        label: 'Dependencies',
        value: statistics.supporting_count + statistics.link_target_count,
        tooltip:
          'Supporting identities, markings, and LinkById targets sealed with the content.',
      },
    ];
    if (statistics.secondary_count > 0) {
      stats.push({
        label: 'Legacy secondary',
        value: statistics.secondary_count,
        tooltip:
          'Historical non-member objects carried by a source-attested manifest.',
      });
    }
    return stats;
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

  private getSnapshotQuarantineCount(
    snapshot: ReleaseTrackSnapshotHistoryItem
  ): number {
    const quarantine =
      snapshot.quarantine || snapshot.contents?.quarantine || [];
    return Array.isArray(quarantine) ? quarantine.length : 0;
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
    const resolution = snapshot.composition_resolution as any;
    const resolvedTotalObjects =
      resolution?.summary?.total_objects ?? resolution?.total_objects;
    if (typeof resolvedTotalObjects === 'number') {
      return resolvedTotalObjects;
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
    selection: SnapshotExportSelection
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
    return `${safeName}-${snapshotName}-${this.getExportFilenameSuffix(selection)}.json`;
  }

  private getExportFilenameSuffix(selection: SnapshotExportSelection): string {
    return selection.stixVersion
      ? `${selection.format}-stix-${selection.stixVersion}`
      : selection.format;
  }

  private toIsoString(value: Date | string | undefined): string | undefined {
    if (!value) return undefined;
    return value instanceof Date ? value.toISOString() : value;
  }
}
