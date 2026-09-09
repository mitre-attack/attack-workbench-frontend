import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { StixObject } from 'src/app/classes/stix';
import { ReleaseTrackObjectItem } from 'src/app/components/release-track-object-card/release-track-object-card.component';
import { StixViewConfig } from 'src/app/views/stix/stix-view-page';

export interface ReleaseReviewItem {
  item: ReleaseTrackObjectItem;
  current: StixObject;
  prior: StixObject | null;
}

export interface ReleaseReviewDialogData {
  items: ReleaseReviewItem[];
}

export interface ReleaseReviewUpdateRequest {
  item: ReleaseTrackObjectItem;
  note: string;
}

export interface ReleaseReviewDialogResult {
  approved: ReleaseTrackObjectItem[];
  updateRequests: ReleaseReviewUpdateRequest[];
}

@Component({
  selector: 'app-release-review-dialog',
  templateUrl: './release-review-dialog.component.html',
  styleUrls: ['./release-review-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class ReleaseReviewDialogComponent {
  public index = 0;
  public note = '';
  public showNote = false;

  private readonly result: ReleaseReviewDialogResult = {
    approved: [],
    updateRequests: [],
  };

  constructor(
    public dialogRef: MatDialogRef<ReleaseReviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ReleaseReviewDialogData
  ) {}

  public get reviewItem(): ReleaseReviewItem {
    return this.data.items[this.index];
  }

  public get objectName(): string {
    return (
      this.reviewItem?.item?.name ||
      this.reviewItem?.item?.attack_id ||
      'Object'
    );
  }

  public get progressLabel(): string {
    return `${this.index + 1} of ${this.data.items.length}`;
  }

  public get config(): StixViewConfig {
    return {
      mode: 'diff',
      object: [this.reviewItem.current, this.reviewItem.prior],
      editable: false,
      sidebarControl: 'disable',
      showRelationships: false,
    };
  }

  public approve(): void {
    this.result.approved.push(this.reviewItem.item);
    this.next();
  }

  public requestUpdates(): void {
    const note = this.note.trim();
    if (!note) return;

    this.result.updateRequests.push({ item: this.reviewItem.item, note });
    this.next();
  }

  public skip(): void {
    this.next();
  }

  public cancel(): void {
    const hasCompletedActions =
      this.result.approved.length > 0 || this.result.updateRequests.length > 0;
    this.dialogRef.close(hasCompletedActions ? this.result : undefined);
  }

  private next(): void {
    if (this.index === this.data.items.length - 1) {
      this.dialogRef.close(this.result);
      return;
    }

    this.index += 1;
    this.note = '';
    this.showNote = false;
  }
}
