// -----------------------------------------------------------------------------
// Release Track Configuration
// -----------------------------------------------------------------------------

import { WorkflowStatusType } from 'src/app/utils/types';
import type {
  ConflictPolicyType,
  MemberSyncBehaviorType,
  MemberSyncPolicyType,
  MemberSyncStrategyType,
} from './enums';

export interface ReleaseTrackConfig {
  candidacy_threshold?: WorkflowStatusType;
  auto_promote?: boolean;
  include_secondary_objects?: {
    enabled?: boolean;
    status_threshold?: WorkflowStatusType;
  };
  promotion_conflicts?: {
    candidates_to_staged?: ConflictPolicyType;
    staged_to_members?: ConflictPolicyType;
  };
  member_sync?: {
    strategy?: MemberSyncStrategyType;
    supplant?: {
      behavior?: MemberSyncBehaviorType;
      status_policy?: MemberSyncPolicyType;
    };
  };
}
