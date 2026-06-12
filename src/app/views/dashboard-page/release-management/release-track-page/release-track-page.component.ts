import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ExportFormat,
  ExportFormatType,
  ReleaseTrackSnapshot,
} from 'src/app/classes/release-tracks';
import {
  ReleaseTracksConnectorService,
  StixObjectRef,
} from 'src/app/services/connectors/rest-api/release-tracks.service';
import { BreadcrumbService } from 'src/app/services/helpers/breadcrumb.service';
import { MatDialog } from '@angular/material/dialog';
import { SelectionModel } from '@angular/cdk/collections';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { AddDialogComponent } from 'src/app/components/add-dialog/add-dialog.component';
import { StixTypeToAttackType } from 'src/app/utils/type-mappings';
import {
  StixType,
  WorkflowStatus,
  WorkflowStatusType,
} from 'src/app/utils/types';
import { MultipleChoiceDialogComponent } from 'src/app/components/multiple-choice-dialog/multiple-choice-dialog.component';
import { take } from 'rxjs/operators';
import { ReleaseTrackObjectItem } from 'src/app/components/release-track-object-card/release-track-object-card.component';

type ReleaseTrackLaneType = 'candidate' | 'staged' | 'member';

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

  constructor(
    private connector: ReleaseTracksConnectorService,
    private breadcrumbService: BreadcrumbService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private restApiConnectorService: RestApiConnectorService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      if (this.id !== params.id) this.showReleasedMembers = false;
      this.id = params.id;
      if (this.id) this.getReleaseTrack();
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
          items: this.candidates.filter(
            item => this.getObjectStatus(item) === WorkflowStatus.WorkInProgress
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
          key: 'staged-reviewed',
          title: 'Staged/Reviewed',
          type: 'staged',
          modifier: 'staged',
          items: [
            ...this.candidates.filter(
              item => this.getObjectStatus(item) === WorkflowStatus.Reviewed
            ),
            ...this.staged,
          ],
          emptyLabel: 'No staged or reviewed objects',
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

  public getReleaseTrack(): void {
    const subscription = this.connector.getLatestSnapshot(this.id).subscribe({
      next: res => {
        this.releaseTrack = res;
        if (!this.releaseTrack) return;

        this.breadcrumbService.changeBreadcrumb(
          this.route.snapshot,
          this.releaseTrack.name
        );

        // this.loadCandidates();
      },
      complete: () => {
        subscription.unsubscribe();
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

    const sub = this.restApiConnectorService
      .getAllObjects({ deserialize: true })
      .subscribe({
        next: results => {
          const objects = (results as any).data || [];

          const dialogRef = this.dialog.open(AddDialogComponent, {
            data: {
              selectableObjects: objects,
              select: selection,
              type: 'all',
              selectionType: 'many',
              buttonLabel: 'Add',
              title: 'Add candidates',
              clearSelection: true,
            },
            maxWidth: '70em',
            minWidth: '40vw',
            maxHeight: '75vh',
          });

          const closeSub = dialogRef.afterClosed().subscribe({
            next: result => {
              if (!result) return; // user cancelled

              const objectRefs: any[] = selection.selected.map(stixId => {
                const obj = objects.find(
                  (o: any) =>
                    o.stixID === stixId || (o.stix && o.stix.id === stixId)
                );
                const id = obj ? obj.stixID || obj.stix?.id : stixId;
                let modified: string | undefined;
                if (obj) {
                  if (obj.modified instanceof Date)
                    modified = obj.modified.toISOString();
                  else if (obj.modified) modified = obj.modified;
                  else if (obj.stix && obj.stix.modified)
                    modified = obj.stix.modified;
                }
                return modified ? { id, modified } : id;
              });

              const apiSub = this.connector
                .addCandidates(this.id, objectRefs)
                .subscribe({
                  next: () => {
                    // refresh snapshot from server so local state reflects saved candidates
                    this.getReleaseTrack();
                  },
                  error: err => {
                    console.error('Failed to add candidates', err);
                  },
                  complete: () => apiSub.unsubscribe(),
                });
            },
            complete: () => closeSub.unsubscribe(),
          });
        },
        complete: () => sub.unsubscribe(),
      });
  }

  public getViewUrl(stixId: string): string {
    const stixType = stixId.split('-')[0] as StixType;
    return `/${StixTypeToAttackType[stixType]}/${stixId}`;
  }

  public promote(objectIds: string[]): void {
    if (!objectIds.length) return;
    const sub = this.connector.promoteCandidates(this.id, objectIds).subscribe({
      next: () => {
        this.getReleaseTrack();
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
        this.getReleaseTrack();
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
    this.router.navigate([this.getViewUrl(id)]);
  }

  public onDiff(item: any): void {
    // TODO: open diff modal for item
    console.log('onDiff', item);
  }

  public onReviewAndApprove(item: any): void {
    this.reviewCandidateStatus(
      WorkflowStatus.AwaitingReview,
      WorkflowStatus.Reviewed,
      [item]
    );
  }

  public canAddCandidates(lane: ReleaseTrackWorkspaceLane): boolean {
    return lane.key === 'candidates' || lane.key === 'candidates-wip';
  }

  public canReviewAndApprove(
    item: ReleaseTrackObjectItem,
    lane: ReleaseTrackWorkspaceLane
  ): boolean {
    return (
      this.autoPromotionEnabled &&
      lane.type === 'candidate' &&
      this.getLaneStatus(item, lane) === WorkflowStatus.AwaitingReview
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

  public toggleReleasedMembers(): void {
    this.showReleasedMembers = !this.showReleasedMembers;
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

  public onExport(): void {
    if (!this.id) return;

    const formatRef = this.dialog.open(MultipleChoiceDialogComponent, {
      width: '30em',
      autoFocus: false,
      data: {
        title: `Export latest release snapshot`,
        choices: [
          {
            label: 'STIX Bundle',
            value: 'bundle',
            description:
              'A standard STIX 2.1 JSON bundle containing all member objects of the release.',
          },
          {
            label: 'Snapshot',
            value: 'snapshot',
            description:
              'The raw release track snapshot, including tiers, version history, and configuration.',
          },
          {
            label: 'File System Store',
            value: 'filesystemstore',
            description:
              'A directory structure with individual STIX JSON files, suitable for Git releases.',
          },
          {
            label: 'Workbench Format',
            value: 'workbench',
            description:
              'A richer format including workflow statuses, metadata, and other Workbench-specific data.',
          },
        ],
      },
    });

    formatRef
      .afterClosed()
      .pipe(take(1))
      .subscribe(format => {
        if (!format) return;
        this.downloadLatestReleaseTrack(format as ExportFormat);
      });
  }

  private downloadLatestReleaseTrack(format: ExportFormatType): void {
    this.connector
      .exportLatestSnapshot(this.id, format, { include: 'all' })
      .pipe(take(1))
      .subscribe({
        next: result => {
          this.restApiConnectorService.triggerBrowserDownload(
            result,
            this.getExportFilename(format)
          );
        },
        error: err => {
          console.error('Failed to export release track', err);
        },
      });
  }

  private getExportFilename(format: ExportFormatType): string {
    const name = this.releaseTrackName || this.id || 'release-track';
    const safeName =
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'release-track';
    return `${safeName}-latest-${format}.json`;
  }

  public onDraft(): void {
    // TODO: create draft snapshot
    console.log('onDraft');
  }

  public onPreviewRelease(): void {
    // TODO: open preview & release modal
    console.log('onPreviewRelease');
  }

  private reviewCandidateStatus(
    from: WorkflowStatusType,
    to: WorkflowStatusType,
    items: any[]
  ): void {
    if (!this.id || !items.length) return;

    const objectRefs = items
      .map(item => this.getReviewObjectRef(item))
      .filter((ref): ref is StixObjectRef => !!ref);

    if (!objectRefs.length) return;

    this.connector
      .reviewCandidates(this.id, {
        from,
        to,
        object_refs: objectRefs,
      })
      .pipe(take(1))
      .subscribe({
        next: () => this.getReleaseTrack(),
        error: err => {
          console.error('Failed to update candidate review status', err);
        },
      });
  }

  private getReviewObjectRef(item: any): StixObjectRef | null {
    if (!item?.object_ref) return null;
    const modified = this.toIsoString(item.object_modified);
    return modified ? { id: item.object_ref, modified } : item.object_ref;
  }

  private getObjectStatus(item: ReleaseTrackObjectItem): WorkflowStatusType {
    return item.object_status || WorkflowStatus.WorkInProgress;
  }

  private toIsoString(value: Date | string | undefined): string | undefined {
    if (!value) return undefined;
    return value instanceof Date ? value.toISOString() : value;
  }
}
