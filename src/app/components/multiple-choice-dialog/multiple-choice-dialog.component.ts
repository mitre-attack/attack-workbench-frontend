import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-multiple-choice-dialog',
  templateUrl: './multiple-choice-dialog.component.html',
  styleUrls: ['./multiple-choice-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class MultipleChoiceDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<MultipleChoiceDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public config: MultipleChoiceDialogConfig
  ) {}
}

export interface MultipleChoiceDialogConfig {
  title: string; //prompt text
  description?: string; //additional explanation
  choices: {
    label: string;
    value?: string;
    description?: string;
  }[];
}
