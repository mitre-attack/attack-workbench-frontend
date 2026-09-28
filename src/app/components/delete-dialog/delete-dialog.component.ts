import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-delete-dialog',
  templateUrl: './delete-dialog.component.html',
  styleUrls: ['./delete-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class DeleteDialogComponent {
  public confirmInput: string;
  public get title(): string {
    return this.config?.title || 'Are you sure you want to delete this object?';
  }
  public get warning(): string {
    return this.config?.warning || '';
  }
  public get confirmLabel(): string {
    return this.config?.confirmLabel || 'yes, delete';
  }
  public get confirmationText(): string {
    return this.config?.stixId || this.config?.stixID || 'DELETE';
  }
  public get hardDelete(): boolean {
    return this.config && this.config.hardDelete;
  }
  public get invalid(): boolean {
    return this.confirmInput != this.confirmationText;
  }
  public get collectionDelete(): boolean {
    return this.config && this.config.collectionDelete;
  }

  constructor(
    @Inject(MAT_DIALOG_DATA) public config: any,
    public dialogRef: MatDialogRef<DeleteDialogComponent>
  ) {}

  public confirm() {
    this.dialogRef.close(true);
  }
}
