import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ReleaseVersionDialogData {
  currentVersion: string;
}

@Component({
  selector: 'app-release-version-dialog',
  templateUrl: './release-version-dialog.component.html',
  styleUrls: ['./release-version-dialog.component.scss'],
  standalone: false,
})
export class ReleaseVersionDialogComponent {
  public version: string;

  constructor(
    public dialogRef: MatDialogRef<ReleaseVersionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ReleaseVersionDialogData
  ) {
    this.version = data.currentVersion;
  }

  public get normalizedVersion(): string {
    return this.version.trim();
  }

  public get isInvalid(): boolean {
    return !/^\d+\.\d+$/.test(this.normalizedVersion);
  }

  public save(): void {
    if (this.isInvalid) return;
    this.dialogRef.close(this.normalizedVersion);
  }
}
