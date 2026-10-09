import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface SnapshotDescriptionDialogData {
  title: string;
  description?: string;
  message?: string;
  confirmLabel?: string;
}

@Component({
  selector: 'app-snapshot-description-dialog',
  templateUrl: './snapshot-description-dialog.component.html',
  styleUrls: ['./snapshot-description-dialog.component.scss'],
  standalone: false,
})
export class SnapshotDescriptionDialogComponent {
  public readonly maxLength = 4000;
  public description: string;

  constructor(
    public dialogRef: MatDialogRef<SnapshotDescriptionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SnapshotDescriptionDialogData
  ) {
    this.description = data.description || '';
  }

  public get isInvalid(): boolean {
    return this.description.length > this.maxLength;
  }

  public cancel(): void {
    this.dialogRef.close();
  }

  public save(): void {
    if (this.isInvalid) return;
    this.dialogRef.close(this.description.trim());
  }
}
