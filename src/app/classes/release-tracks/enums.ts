import { WorkflowStatus, WorkflowStatusType } from 'src/app/utils/types';

type EnumValue<T extends Record<string, string>> = T[keyof T];

// -----------------------------------------------------------------------------
// Release Track Type
// -----------------------------------------------------------------------------

export enum ReleaseTrackType {
  Standard = 'standard',
  Virtual = 'virtual',
}

export const RELEASE_TRACK_TYPE_OPTIONS: ReleaseTrackType[] = Object.values(
  ReleaseTrackType
) as ReleaseTrackType[];

// -----------------------------------------------------------------------------
// Conflict Resolution
// -----------------------------------------------------------------------------

export enum ConflictPolicy {
  AlwaysOverwrite = 'always_overwrite', // replace with incoming entry
  AlwaysReject = 'always_reject', // always reject incoming
  PreferLatest = 'prefer_latest', // keep whichever has newer object_modified
  Abort = 'abort', // throw error on any conflict
}

export type ConflictPolicyType = EnumValue<typeof ConflictPolicy>;

export const CONFLICT_POLICY_OPTIONS: ConflictPolicyType[] = Object.values(
  ConflictPolicy
) as ConflictPolicyType[];

// -----------------------------------------------------------------------------
// Deduplication Strategy
// -----------------------------------------------------------------------------

export enum DeduplicationStrategy {
  PrioritizeLatestObject = 'prioritize_latest_object', // keep version with newest object_modified
  PrioritizeLatestSnapshot = 'prioritize_latest_snapshot', // keep version from most recently modified snapshot
  PrioritizeHigherPriority = 'prioritize_higher_priority', // keep version from the higher-priority component (lower number)
  Quarantine = 'quarantine', // send all conflicting versions to quarantine for manual review
}

export type DeduplicationStrategyType = EnumValue<typeof DeduplicationStrategy>;

export const DEDUPLICATION_STRATEGY_OPTIONS: DeduplicationStrategyType[] =
  Object.values(DeduplicationStrategy) as DeduplicationStrategyType[];

// -----------------------------------------------------------------------------
// Export Format
// -----------------------------------------------------------------------------

export enum ExportFormat {
  Bundle = 'bundle',
  Workbench = 'workbench',
  FileSystemStore = 'filesystemstore',
}

export type ExportFormatType = EnumValue<typeof ExportFormat>;

export const EXPORT_FORMAT_OPTIONS: ExportFormatType[] = Object.values(
  ExportFormat
) as ExportFormatType[];

export enum ReleasePreviewFormat {
  Summary = 'summary',
  Bundle = 'bundle',
  Workbench = 'workbench',
  FileSystemStore = 'filesystemstore',
}

export type ReleasePreviewFormatType = EnumValue<typeof ReleasePreviewFormat>;

// -----------------------------------------------------------------------------
// Release Track Snapshot Tiers
// -----------------------------------------------------------------------------

export enum SnapshotTier {
  Member = 'released',
  Staged = 'staged',
  Candidate = 'candidate',
  All = 'all',
}

export type SnapshotTierType = EnumValue<typeof SnapshotTier>;

export const SNAPSHOT_TIER_OPTIONS: SnapshotTierType[] = Object.values(
  SnapshotTier
) as SnapshotTierType[];

// -----------------------------------------------------------------------------
// Candidacy Thresholds
// -----------------------------------------------------------------------------

export const CANDIDACY_THRESHOLD_OPTIONS: WorkflowStatusType[] = Object.values(
  WorkflowStatus
) as WorkflowStatusType[];

// -----------------------------------------------------------------------------
// Resolution Strategy
// -----------------------------------------------------------------------------

export enum ResolutionStrategy {
  LatestTagged = 'latest_tagged',
  SpecificVersion = 'specific_version',
  SpecificSnapshot = 'specific_snapshot',
}

export type ResolutionStrategyType = EnumValue<typeof ResolutionStrategy>;

export const RESOLUTION_STRATEGY_OPTIONS: ResolutionStrategyType[] =
  Object.values(ResolutionStrategy) as ResolutionStrategyType[];

// -----------------------------------------------------------------------------
// Snapshot Schedule Modes
// -----------------------------------------------------------------------------

export enum SnapshotScheduleMode {
  Manual = 'manual',
  Cron = 'cron',
  Dates = 'dates',
}

export type SnapshotScheduleModeType = EnumValue<typeof SnapshotScheduleMode>;

export const SNAPSHOT_MODE_OPTIONS: SnapshotScheduleModeType[] = Object.values(
  SnapshotScheduleMode
) as SnapshotScheduleModeType[];

// -----------------------------------------------------------------------------
// Member Sync
// -----------------------------------------------------------------------------

export enum MemberSyncStrategy {
  TrackLatest = 'track_latest',
  Manual = 'manual',
}

export type MemberSyncStrategyType = EnumValue<typeof MemberSyncStrategy>;

export const MEMBER_SYNC_STRATEGY_OPTIONS: MemberSyncStrategyType[] =
  Object.values(MemberSyncStrategy) as MemberSyncStrategyType[];

export enum MemberSyncBehavior {
  Replace = 'replace',
  Queue = 'queue',
  Ignore = 'ignore',
}

export type MemberSyncBehaviorType = EnumValue<typeof MemberSyncBehavior>;

export const MEMBER_SYNC_BEHAVIOR_OPTIONS: MemberSyncBehaviorType[] =
  Object.values(MemberSyncBehavior) as MemberSyncBehaviorType[];

export enum MemberSyncPolicy {
  Reset = 'reset',
  Preserve = 'preserve',
}

export type MemberSyncPolicyType = EnumValue<typeof MemberSyncPolicy>;

export const MEMBER_SYNC_STATUS_POLICY_OPTIONS: MemberSyncPolicyType[] =
  Object.values(MemberSyncPolicy) as MemberSyncPolicyType[];
