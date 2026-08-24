export interface VersionHistoryEntry {
  version: string;
  tagged_at: Date;
  tagged_by: string;
  snapshot_id: Date;
  summary?: {
    members_count?: number;
    promoted_count?: number;
    staged_count?: number;
    candidate_count?: number;
  };
  component_versions?: any; // virtual tracks only
}
