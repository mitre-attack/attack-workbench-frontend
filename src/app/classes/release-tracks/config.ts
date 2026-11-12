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

export type InheritedIdentitySetting =
  { inherit: true } | { inherit: false; value: string };

export type InheritedMarkingRefsSetting =
  { inherit: true } | { inherit: false; value: string[] };

// Publication metadata for the emitted x-mitre-collection object. Each rule
// inherits the global system configuration unless overridden at the track
// scope. collection_id and created become immutable once the track has a
// tagged release.
export interface PublicationConfig {
  collection_id?: string | null;
  created?: string | null;
  created_by_ref?: InheritedIdentitySetting;
  object_marking_refs?: InheritedMarkingRefsSetting;
}

export type PublicationSource = 'track' | 'global' | 'derived' | 'content';

export interface PublicationResolved {
  collection_id: string;
  created: string;
  created_by_ref: string;
  object_marking_refs: string[];
  attack_spec_version: string;
  sources: {
    collection_id: PublicationSource;
    created: PublicationSource;
    created_by_ref: PublicationSource;
    object_marking_refs: PublicationSource;
  };
}

export interface ReleaseTrackConfig {
  candidacy_threshold?: WorkflowStatusType;
  auto_promote?: boolean;
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
  publication?: PublicationConfig;
  publication_resolved?: PublicationResolved;
}
