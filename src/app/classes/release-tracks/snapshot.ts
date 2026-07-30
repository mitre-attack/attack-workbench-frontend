import { Composition, CompositionResolution } from './composition';
import { ReleaseTrackConfig } from './config';
import { ReleaseTrackType } from './enums';
import { VersionHistoryEntry } from './history';
import { SnapshotSchedule } from './release-track';
import {
  CandidateEntry,
  MemberEntry,
  QuarantineEntry,
  StagedEntry,
  WorkflowRevisionSelector,
} from './tiers';

export class ReleaseTrackSnapshot {
  public id = '';
  public type: ReleaseTrackType = ReleaseTrackType.Standard;
  public modified: Date = new Date();
  public version?: string | null;
  public name = '';
  public description?: string;
  public created: Date = new Date();
  public created_by_ref?: string;
  public object_marking_refs?: string[];

  public config: ReleaseTrackConfig = {} as ReleaseTrackConfig;
  public version_history: VersionHistoryEntry[] = [];

  // standard track tiers
  public members: MemberEntry[] = [];
  public staged?: StagedEntry[];
  public candidates?: CandidateEntry[];

  // virtual track tiers
  public quarantine?: QuarantineEntry[];

  // virtual track composition
  public composition?: Composition;
  public composition_resolution?: CompositionResolution;
  public snapshot_schedule?: SnapshotSchedule;

  constructor(raw?: any) {
    if (raw) this.deserialize(raw);
  }

  public get isVirtual(): boolean {
    return this.type === ReleaseTrackType.Virtual;
  }

  public get isStandard(): boolean {
    return this.type === ReleaseTrackType.Standard;
  }

  public get memberCount(): number {
    return this.members ? this.members.length : 0;
  }

  public get stagedCount(): number {
    return this.staged ? this.staged.length : 0;
  }

  public get candidateCount(): number {
    return this.candidates ? this.candidates.length : 0;
  }

  public get quarantineCount(): number {
    return this.quarantine ? this.quarantine.length : 0;
  }

  public get isTagged(): boolean {
    return !!this.version;
  }

  public get latestTaggedVersion(): string | null {
    if (!this.version_history || this.version_history.length === 0) return null;
    const sorted = [...this.version_history].sort((a, b) => {
      const ta = a.tagged_at ? new Date(a.tagged_at).getTime() : 0;
      const tb = b.tagged_at ? new Date(b.tagged_at).getTime() : 0;
      return tb - ta;
    });
    return sorted[0].version || null;
  }

  // Populate release track snapshot fields from a raw object
  public deserialize(raw: any) {
    if (!raw) return;

    if ('id' in raw) this.id = raw.id;
    if ('type' in raw) this.type = raw.type;
    if ('modified' in raw) this.modified = new Date(raw.modified);
    if ('version' in raw) this.version = raw.version;
    if ('name' in raw) this.name = raw.name;
    if ('description' in raw) this.description = raw.description;
    if ('created' in raw) this.created = new Date(raw.created);
    if ('created_by_ref' in raw) this.created_by_ref = raw.created_by_ref;
    if ('object_marking_refs' in raw && Array.isArray(raw.object_marking_refs))
      this.object_marking_refs = raw.object_marking_refs.slice();

    if ('config' in raw) this.config = raw.config;

    if ('version_history' in raw && Array.isArray(raw.version_history)) {
      this.version_history = raw.version_history.map((v: any) => {
        const entry: VersionHistoryEntry = { ...v } as any;
        if (v.tagged_at) entry.tagged_at = new Date(v.tagged_at);
        if (v.snapshot_id) entry.snapshot_id = new Date(v.snapshot_id);
        return entry;
      });
    }

    if ('members' in raw && Array.isArray(raw.members)) {
      this.members = raw.members.map((m: any) => ({
        ...m,
        object_ref: m.object_ref,
        object_modified: m.object_modified
          ? new Date(m.object_modified)
          : undefined,
      }));
    }

    if ('staged' in raw && Array.isArray(raw.staged)) {
      this.staged = raw.staged.map((s: any) => ({
        ...s,
        object_ref: s.object_ref,
        object_modified: this.deserializeWorkflowRevision(
          s.object_modified
        ),
        object_status: s.object_status,
        object_staged_at: s.object_staged_at
          ? new Date(s.object_staged_at)
          : undefined,
        object_staged_by: s.object_staged_by,
      }));
    }

    if ('candidates' in raw && Array.isArray(raw.candidates)) {
      this.candidates = raw.candidates.map((c: any) => ({
        ...c,
        object_ref: c.object_ref,
        object_modified: this.deserializeWorkflowRevision(
          c.object_modified
        ),
        object_status: c.object_status,
        object_added_at: c.object_added_at
          ? new Date(c.object_added_at)
          : undefined,
        object_added_by: c.object_added_by,
      }));
    }

    if ('quarantine' in raw && Array.isArray(raw.quarantine)) {
      this.quarantine = raw.quarantine.map((q: any) => ({
        ...q,
        object_ref: q.object_ref,
        object_modified: q.object_modified
          ? new Date(q.object_modified)
          : undefined,
        source_track_id: q.source_track_id,
        source_track_name: q.source_track_name,
        source_snapshot_version: q.source_snapshot_version,
        conflict_reason: q.conflict_reason,
      }));
    }

    if ('composition' in raw) this.composition = raw.composition;

    if ('snapshot_schedule' in raw)
      this.snapshot_schedule = raw.snapshot_schedule;

    if ('composition_resolution' in raw && raw.composition_resolution) {
      const cr = raw.composition_resolution;
      const resolved: CompositionResolution = { ...cr } as any;
      if (cr.resolved_at) resolved.resolved_at = new Date(cr.resolved_at);
      if (cr.component_snapshots && Array.isArray(cr.component_snapshots)) {
        resolved.component_snapshots = cr.component_snapshots.map(
          (cs: any) => ({
            ...cs,
            resolved_snapshot_id: cs.resolved_snapshot_id
              ? new Date(cs.resolved_snapshot_id)
              : undefined,
          })
        );
      }
      this.composition_resolution = resolved;
    }
  }

  // Generate object representation of the release track snapshot
  public serialize(): any {
    return {
      id: this.id,
      type: this.type,
      modified: this.modified ? this.modified.toISOString() : undefined,
      version: this.version,
      name: this.name,
      description: this.description,
      created: this.created ? this.created.toISOString() : undefined,
      created_by_ref: this.created_by_ref,
      object_marking_refs: this.object_marking_refs,
      config: this.config,
      version_history: this.version_history?.map(v => ({
        ...v,
        tagged_at: v.tagged_at
          ? (v.tagged_at as any).toISOString()
          : v.tagged_at,
        snapshot_id: v.snapshot_id
          ? (v.snapshot_id as any).toISOString()
          : v.snapshot_id,
      })),
      members: this.members?.map(m => ({
        ...m,
        object_modified: m.object_modified
          ? (m.object_modified as any).toISOString()
          : m.object_modified,
      })),
      staged: this.staged?.map(s => ({
        ...s,
        object_modified: this.serializeWorkflowRevision(s.object_modified),
        object_staged_at: s.object_staged_at
          ? (s.object_staged_at as any).toISOString()
          : s.object_staged_at,
      })),
      candidates: this.candidates?.map(c => ({
        ...c,
        object_modified: this.serializeWorkflowRevision(c.object_modified),
        object_added_at: c.object_added_at
          ? (c.object_added_at as any).toISOString()
          : c.object_added_at,
      })),
      quarantine: this.quarantine?.map(q => ({
        ...q,
        object_modified: q.object_modified
          ? (q.object_modified as any).toISOString()
          : q.object_modified,
      })),
      composition: this.composition,
      composition_resolution: this.composition_resolution,
      snapshot_schedule: this.snapshot_schedule,
    };
  }

  // Check if an object with the given STIX ID exists in members
  public hasMember(objectRef: string): boolean {
    return !!this.members.find(m => m.object_ref === objectRef);
  }

  // Check if an object with the given STIX ID exists in candidates
  public hasCandidate(objectRef: string): boolean {
    return !!this.candidates?.find(c => c.object_ref === objectRef);
  }

  // Check if an object with the given STIX ID exists in staged
  public hasStaged(objectRef: string): boolean {
    return !!this.staged?.find(c => c.object_ref === objectRef);
  }

  // Get the member entry for the given STIX ID
  public findMember(objectRef: string): MemberEntry | undefined {
    return this.members.find(m => m.object_ref === objectRef);
  }

  private deserializeWorkflowRevision(
    value: string | Date | undefined
  ): WorkflowRevisionSelector | undefined {
    if (!value) return undefined;
    return value === 'latest' ? 'latest' : new Date(value);
  }

  private serializeWorkflowRevision(
    value: WorkflowRevisionSelector | undefined
  ): string | undefined {
    if (value === undefined) return undefined;
    if (value === 'latest') return value;
    return value.toISOString();
  }

  // Get the candidate entry for the given STIX ID
  public findCandidate(objectRef: string): CandidateEntry | undefined {
    return this.candidates?.find(c => c.object_ref === objectRef);
  }

  // Get the staged entry for the given STIX ID
  public findStaged(objectRef: string): StagedEntry | undefined {
    return this.staged?.find(c => c.object_ref === objectRef);
  }

  // Add candidate entry
  public addCandidate(entry: CandidateEntry): void {
    if (!this.candidates) this.candidates = [];
    if (!this.hasCandidate(entry.object_ref)) this.candidates.push(entry);
  }

  // Remove candidate entry
  public removeCandidate(objectRef: string): void {
    if (!this.candidates) return;
    this.candidates = this.candidates.filter(c => c.object_ref !== objectRef);
  }

  // Get a summary of the snapshot object
  public toSummary(): any {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      version: this.version,
      modified: this.modified,
      counts: {
        members: this.memberCount,
        staged: this.stagedCount,
        candidates: this.candidateCount,
        quarantine: this.quarantineCount,
      },
    };
  }
}
