// -----------------------------------------------------------------------------
// Component Tracks
//
// Release track (standard or virtual) referenced by a virtual release track
// -----------------------------------------------------------------------------

import {
  HistoricalResolutionStrategyType,
  ResolutionStrategyType,
} from './enums';

export interface ComponentTrackFilters {
  object_types?: string[];
  domains?: string[];
}

export interface ComponentTrack {
  track_id: string;
  resolution_strategy: ResolutionStrategyType;
  priority: number;
  version?: string | null;
  snapshot?: Date | string;
  filters?: ComponentTrackFilters;
}

/** Loaded rules may be retired; they must be replaced before a new write. */
export interface LoadedComponentTrack extends Omit<
  ComponentTrack,
  'resolution_strategy'
> {
  resolution_strategy: HistoricalResolutionStrategyType;
}

export interface ComponentSnapshotResolution {
  track_id: string;
  track_name: string;
  track_type: string;
  resolved_snapshot_id: Date | string;
  resolved_version?: string | null;
  strategy_used: HistoricalResolutionStrategyType;
  filters_applied?: ComponentTrackFilters;
  total_objects_in_source: number;
  objects_after_filter: number;
  objects_contributed: number;
}

interface PrioritizedComponent {
  priority?: number | null;
}

function isComponentPriority(
  value: number | null | undefined
): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function hasValidComponentPriorities(
  tracks: readonly PrioritizedComponent[]
): boolean {
  const seen = new Set<number>();
  for (const { priority } of tracks) {
    if (!isComponentPriority(priority) || seen.has(priority)) return false;
    seen.add(priority);
  }
  return true;
}

export function getComponentPriorityError(
  priority: number | null | undefined,
  tracks: readonly PrioritizedComponent[]
): string | null {
  if (!isComponentPriority(priority))
    return 'Enter a valid non-negative whole number.';
  let found = false;
  for (const track of tracks) {
    if (track.priority !== priority) continue;
    if (found) return 'Each component must have a unique priority.';
    found = true;
  }
  return null;
}

export function nextComponentPriority(
  tracks: readonly PrioritizedComponent[]
): number {
  let next = 0;
  for (const { priority } of tracks) {
    if (!isComponentPriority(priority)) continue;
    next = Math.max(next, priority + 1);
  }
  if (Number.isSafeInteger(next)) return next;
  // A component may already use the largest safe integer; fill a free slot
  // rather than generate an invalid priority or renumber existing components.
  const used = new Set<number>();
  for (const { priority } of tracks) {
    if (isComponentPriority(priority)) used.add(priority);
  }
  next = 0;
  while (used.has(next)) next++;
  return next;
}
