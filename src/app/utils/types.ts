import {
  ReleaseTrackObjectTier,
  StixObjectRef,
} from '../classes/release-tracks';
import { StixObject } from '../classes/stix';

/**
 * ATT&CK type definitions
 */
export type AttackType =
  | 'asset'
  | 'campaign'
  | 'collection'
  | 'group'
  | 'matrix'
  | 'mitigation'
  | 'software'
  | 'tactic'
  | 'technique'
  | 'relationship'
  | 'note'
  | 'identity'
  | 'marking-definition'
  | 'data-source'
  | 'data-component'
  | 'detection-strategy'
  | 'analytic';

/**
 * STIX type definitions
 */
export type StixType =
  | 'x-mitre-asset'
  | 'campaign'
  | 'x-mitre-collection'
  | 'intrusion-set'
  | 'x-mitre-matrix'
  | 'course-of-action'
  | 'malware'
  | 'tool'
  | 'x-mitre-tactic'
  | 'attack-pattern'
  | 'relationship'
  | 'note'
  | 'identity'
  | 'marking-definition'
  | 'x-mitre-data-source'
  | 'x-mitre-data-component'
  | 'x-mitre-detection-strategy'
  | 'x-mitre-analytic';

/**
 * Workflow status definitions
 */
export enum WorkflowStatus {
  WorkInProgress = 'work-in-progress',
  AwaitingReview = 'awaiting-review',
  Reviewed = 'reviewed',
}

export type WorkflowStatusType =
  | WorkflowStatus.WorkInProgress
  | WorkflowStatus.AwaitingReview
  | WorkflowStatus.Reviewed;

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatusType, string> = {
  [WorkflowStatus.WorkInProgress]: 'WIP',
  [WorkflowStatus.AwaitingReview]: 'Awaiting Review',
  [WorkflowStatus.Reviewed]: 'Reviewed',
};

export const WorkflowStatusMap = WORKFLOW_STATUS_LABELS;

export interface WorkflowStatusOption {
  value: WorkflowStatusType;
  label: string;
}

export const WORKFLOW_STATUS_OPTIONS: WorkflowStatusOption[] = [
  {
    value: WorkflowStatus.WorkInProgress,
    label: WORKFLOW_STATUS_LABELS[WorkflowStatus.WorkInProgress],
  },
  {
    value: WorkflowStatus.AwaitingReview,
    label: WORKFLOW_STATUS_LABELS[WorkflowStatus.AwaitingReview],
  },
  {
    value: WorkflowStatus.Reviewed,
    label: WORKFLOW_STATUS_LABELS[WorkflowStatus.Reviewed],
  },
];

export const WORKFLOW_STATUS_RANK: Record<WorkflowStatusType, number> = {
  [WorkflowStatus.WorkInProgress]: 0,
  [WorkflowStatus.AwaitingReview]: 1,
  [WorkflowStatus.Reviewed]: 2,
};

/**
 * Collection/release changelog categories
 */
export type ChangelogCategory =
  'additions' | 'changes' | 'minor_changes' | 'revocations' | 'deprecations';

export interface ReleaseTrackStatus {
  trackId: string;
  name: string;
  description: string;
  tier: ReleaseTrackObjectTier | null;
  status: WorkflowStatusType;
  objectRef: StixObjectRef;
}

export interface WorkflowStatusDialogData {
  object: StixObject;
  targetStatus: WorkflowStatusType;
  track: ReleaseTrackStatus;
}
