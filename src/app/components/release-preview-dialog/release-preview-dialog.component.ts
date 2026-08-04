import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { VersionNumber } from 'src/app/classes/version-number';

export interface ReleasePreviewDialogData {
  track: any;
  conflicts?: any[];
  proposedMinorVersion?: string;
  previewSummary?: any;
}

export interface ReleasePreviewSelection {
  increment: 'minor' | 'major';
  description: string;
}

interface ReleaseTrackObject {
  object_ref?: string;
  object_modified?: string;
  attack_id?: string;
  name?: string;
  description?: string;
  attack_type?: string;
  version?: string;
  x_mitre_version?: string;
  stix?: { type?: string; x_mitre_version?: string };
  [key: string]: any;
}

export interface IncludedReleaseObject {
  object: ReleaseTrackObject;
  currentMember: ReleaseTrackObject | null;
  incomingStaged: ReleaseTrackObject | null;
  invalidVersionBump: boolean;
}

@Component({
  selector: 'app-release-preview-dialog',
  templateUrl: './release-preview-dialog.component.html',
  styleUrls: ['./release-preview-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class ReleasePreviewDialogComponent {
  public readonly snapshotDescriptionMaxLength = 4000;
  public snapshotDescription: string;

  constructor(
    public dialogRef: MatDialogRef<ReleasePreviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ReleasePreviewDialogData
  ) {
    this.snapshotDescription = data.track?.snapshot_description || '';
  }

  public get trackName(): string {
    return this.data.track?.name || 'Release Track';
  }

  public get currentVersion(): string {
    const history = this.asArray(this.data.track?.version_history);
    const version =
      this.data.track?.version ?? history[history.length - 1]?.version ?? '0.1';

    return this.formatVersion(version);
  }

  public get minorVersion(): string {
    if (this.data.proposedMinorVersion) {
      return this.formatVersion(this.data.proposedMinorVersion);
    }

    return this.formatVersion(
      new VersionNumber(this.currentVersion.replace(/^v/i, ''))
        .nextMinorVersion()
        .toString()
    );
  }

  public get majorVersion(): string {
    return this.formatVersion(
      new VersionNumber(this.currentVersion.replace(/^v/i, ''))
        .nextMajorVersion()
        .toString()
    );
  }

  public get members(): ReleaseTrackObject[] {
    return this.asArray(this.data.track?.members);
  }

  public get staged(): ReleaseTrackObject[] {
    return this.asArray(this.data.track?.staged);
  }

  public get excludedCandidates(): ReleaseTrackObject[] {
    return this.asArray(this.data.track?.candidates);
  }

  public get isVirtualTrack(): boolean {
    return this.data.previewSummary?.type === 'virtual';
  }

  public get totalIncludedCount(): number {
    return this.isVirtualTrack
      ? (this.data.previewSummary?.after?.members_count ?? this.members.length)
      : this.includedObjects.length;
  }

  public get includedObjects(): IncludedReleaseObject[] {
    const stagedByRef = new Map(
      this.staged.map(item => [this.getObjectRef(item), item])
    );
    const memberRefs = new Set(
      this.members.map(item => this.getObjectRef(item))
    );

    const existingMembers = this.members.map(member => {
      const incoming = stagedByRef.get(this.getObjectRef(member)) ?? null;

      return this.createIncludedObject(incoming ?? member, member, incoming);
    });
    const newStaged = this.staged
      .filter(item => !memberRefs.has(this.getObjectRef(item)))
      .map(item => this.createIncludedObject(item, null, item));

    return [...existingMembers, ...newStaged];
  }

  public get newObjectCount(): number {
    if (this.isVirtualTrack) {
      return this.data.previewSummary?.changes?.new_count ?? 0;
    }

    const memberRefs = new Set(
      this.members.map(item => this.getObjectRef(item))
    );
    return this.staged.filter(item => !memberRefs.has(this.getObjectRef(item)))
      .length;
  }

  public get updatedMemberCount(): number {
    if (this.isVirtualTrack) {
      return this.data.previewSummary?.changes?.updated_count ?? 0;
    }

    const memberRefs = new Set(
      this.members.map(item => this.getObjectRef(item))
    );
    return this.staged.filter(item => memberRefs.has(this.getObjectRef(item)))
      .length;
  }

  public get unchangedObjectCount(): number {
    if (this.isVirtualTrack) {
      return Math.max(
        this.totalIncludedCount - this.newObjectCount - this.updatedMemberCount,
        0
      );
    }

    return Math.max(this.members.length - this.updatedMemberCount, 0);
  }

  public get removedObjectCount(): number {
    return this.data.previewSummary?.changes?.removed_count ?? 0;
  }

  public get quarantinedObjectCount(): number {
    return this.data.previewSummary?.changes?.quarantined_count ?? 0;
  }

  public get replacements(): IncludedReleaseObject[] {
    return this.includedObjects.filter(
      item => !!item.currentMember && !!item.incomingStaged
    );
  }

  public get hasInvalidVersionBumps(): boolean {
    return this.includedObjects.some(item => item.invalidVersionBump);
  }

  public get hasPromotionConflicts(): boolean {
    return !!this.data.conflicts?.length;
  }

  public get isReleaseBlocked(): boolean {
    return this.hasInvalidVersionBumps || this.hasPromotionConflicts;
  }

  public close(): void {
    this.dialogRef.close();
  }

  public tagVersion(type: 'minor' | 'major'): void {
    if (this.isReleaseBlocked) {
      return;
    }

    this.dialogRef.close({
      increment: type,
      description: this.snapshotDescription.trim(),
    } satisfies ReleasePreviewSelection);
  }

  public getObjectName(item: ReleaseTrackObject): string {
    return item?.name || item?.attack_id || item?.object_ref || 'ATT&CK object';
  }

  public getObjectVersion(item: ReleaseTrackObject | null): string {
    const version = this.getRawVersion(item);
    return version ? this.formatVersion(version) : 'Not available';
  }

  public getObjectType(item: ReleaseTrackObject): string {
    const type =
      item?.attack_type ??
      item?.type ??
      item?.stix?.type ??
      item?.object_ref?.split('--')[0] ??
      '';

    return (
      String(type)
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, character => character.toUpperCase()) || 'STIX Object'
    );
  }

  public getIncludedSource(item: IncludedReleaseObject): string {
    return item.incomingStaged ? 'staged' : 'members';
  }

  public getWorkflowState(item: ReleaseTrackObject): string {
    return item?.object_status ?? item?.status ?? 'work-in-progress';
  }

  public trackByIncludedObject(
    index: number,
    item: IncludedReleaseObject
  ): string | number {
    return item.object?.object_ref || index;
  }

  public trackByObject(
    index: number,
    item: ReleaseTrackObject
  ): string | number {
    return item?.object_ref || index;
  }

  private createIncludedObject(
    object: ReleaseTrackObject,
    currentMember: ReleaseTrackObject | null,
    incomingStaged: ReleaseTrackObject | null
  ): IncludedReleaseObject {
    return {
      object,
      currentMember,
      incomingStaged,
      invalidVersionBump: this.isInvalidVersionBump(
        currentMember,
        incomingStaged
      ),
    };
  }

  private isInvalidVersionBump(
    currentMember: ReleaseTrackObject | null,
    incomingStaged: ReleaseTrackObject | null
  ): boolean {
    const currentVersion = this.getRawVersion(currentMember);
    const incomingVersion = this.getRawVersion(incomingStaged);

    if (!currentVersion || !incomingVersion) {
      return false;
    }

    return new VersionNumber(incomingVersion).isDoubleIncrement(
      new VersionNumber(currentVersion)
    );
  }

  private getRawVersion(item: ReleaseTrackObject | null): string | null {
    const value =
      item?.version ?? item?.x_mitre_version ?? item?.stix?.x_mitre_version;

    if (value === null || value === undefined || value === '') {
      return null;
    }

    return String(value).replace(/^v/i, '');
  }

  private formatVersion(value: unknown): string {
    const version = String(value);
    return version.toLowerCase().startsWith('v') ? version : `v${version}`;
  }

  private getObjectRef(item: ReleaseTrackObject): string {
    return String(item?.object_ref ?? '');
  }

  private asArray(value: unknown): ReleaseTrackObject[] {
    return Array.isArray(value) ? value : [];
  }
}
