import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { CreateVirtualSnapshotPayload } from 'src/app/classes/release-tracks';

@Component({
  selector: 'app-create-draft-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
  ],
  template: `
    <h2 mat-dialog-title>Create draft snapshot</h2>
    <mat-dialog-content>
      <p>
        Create a new snapshot for {{ data.trackName }}. Add optional notes for
        other analysts.
      </p>
      <mat-form-field appearance="outline">
        <mat-label>Snapshot notes</mat-label>
        <textarea
          matInput
          [(ngModel)]="description"
          maxlength="4000"
          rows="4"></textarea>
      </mat-form-field>
      <section
        *ngIf="data.canManageRetention"
        aria-label="Cleanup for this draft">
        <mat-slide-toggle [(ngModel)]="retentionEnabled"
          >Delete older drafts after creating this draft</mat-slide-toggle
        >
        <p>
          Off by default. This applies only to this request and does not change
          or inherit the recurring schedule's policy.
        </p>
        <ng-container *ngIf="retentionEnabled">
          <mat-form-field appearance="outline">
            <mat-label>Maximum retained drafts</mat-label>
            <input
              matInput
              type="number"
              min="1"
              step="1"
              [(ngModel)]="maxDrafts" />
          </mat-form-field>
          <p>
            Older eligible drafts and their notes will be permanently deleted
            across this track's entire draft history. Tagged releases, the
            latest snapshot, and protected source drafts are preserved.
            Protected drafts may exceed the limit.
          </p>
          <p *ngIf="!isRetentionValid" role="alert">
            Enter a positive safe whole number.
          </p>
        </ng-container>
      </section>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button
        mat-raised-button
        color="primary"
        [disabled]="isInvalid"
        (click)="save()">
        Create draft
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    'mat-form-field { display: block; width: 100%; } section { margin-top: 1rem; }',
  ],
})
export class CreateDraftDialogComponent {
  public description: string;
  public retentionEnabled = false;
  public maxDrafts = 10;

  constructor(
    public dialogRef: MatDialogRef<
      CreateDraftDialogComponent,
      CreateVirtualSnapshotPayload
    >,
    @Inject(MAT_DIALOG_DATA)
    public data: {
      trackName: string;
      description?: string;
      canManageRetention: boolean;
    }
  ) {
    this.description = data.description || '';
  }

  public get isRetentionValid(): boolean {
    return (
      !this.data.canManageRetention ||
      !this.retentionEnabled ||
      (Number.isSafeInteger(this.maxDrafts) && this.maxDrafts > 0)
    );
  }

  public get isInvalid(): boolean {
    return this.description.length > 4000 || !this.isRetentionValid;
  }

  public save(): void {
    if (this.isInvalid) return;
    const payload: CreateVirtualSnapshotPayload = {
      description: this.description.trim(),
    };
    if (this.data.canManageRetention && this.retentionEnabled) {
      payload.draft_retention = { max_drafts: this.maxDrafts };
    }
    this.dialogRef.close(payload);
  }
}
