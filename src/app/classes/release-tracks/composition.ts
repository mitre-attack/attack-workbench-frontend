// -----------------------------------------------------------------------------
// Composition
//
// Rules and configuration that defines how a virtual release track
// aggregates content from component tracks
// -----------------------------------------------------------------------------

import { DeduplicationStrategyType } from './enums';
import { ComponentTrack, ComponentSnapshotResolution } from './component-track';

export interface Composition {
  component_tracks?: ComponentTrack[];
  deduplication?: {
    strategy?: DeduplicationStrategyType;
  };
}

export interface CompositionResolution {
  resolved_at?: Date | string;
  component_snapshots?: ComponentSnapshotResolution[];
  deduplication?: {
    total_objects_before?: number;
    total_objects_after?: number;
    duplicates_found?: number;
    conflicts_resolved?: any[];
  };
  summary?: any;
}
