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

  ngOnInit(): void {
    // intentionally left blank
  }
}

export interface ConfirmationDialogConfig {
  message: string; //prompt text
  yes_suffix?: string; //optional suffix to add to the yes button
  no_suffix?: string; //optional suffix to add to the no button
  alternate_label?: string; //optional label for a third button
  alternate_value?: string; //optional value returned by the third button
}
