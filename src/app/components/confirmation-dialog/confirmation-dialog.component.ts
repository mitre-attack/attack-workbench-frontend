import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-confirmation-dialog',
  templateUrl: './confirmation-dialog.component.html',
  styleUrls: ['./confirmation-dialog.component.scss'],
  standalone: false,
})
export class ConfirmationDialogComponent implements OnInit {
  constructor(
    public dialogRef: MatDialogRef<ConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public config: ConfirmationDialogConfig
  ) {}

  public get cancelLabel(): string {
    if (this.config.no_label) return this.config.no_label;
    return this.config.no_suffix ? `no, ${this.config.no_suffix}` : 'no';
  }

  public get confirmLabel(): string {
    if (this.config.yes_label) return this.config.yes_label;
    return this.config.yes_suffix ? `Yes, ${this.config.yes_suffix}` : 'Yes';
  }

  public get confirmColor(): 'primary' | 'accent' | 'warn' {
    return this.config.confirm_color || 'warn';
  }

  public get confirmAppearance(): 'raised' | 'stroked' {
    return this.config.confirm_appearance || 'stroked';
  }

  ngOnInit(): void {
    // intentionally left blank
  }
}

export interface ConfirmationDialogConfig {
  title?: string;
  message: string; //prompt text
  yes_suffix?: string; //optional suffix to add to the yes button
  no_suffix?: string; //optional suffix to add to the no button
  yes_label?: string; //optional full yes button label
  no_label?: string; //optional full no button label
  confirm_color?: 'primary' | 'accent' | 'warn';
  confirm_appearance?: 'raised' | 'stroked';
  layout?: 'default' | 'simple';
}
