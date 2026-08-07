import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { StixObject } from 'src/app/classes/stix/stix-object';
import { SelectionModel } from '@angular/cdk/collections';
import { StixListConfig } from '../stix/stix-list/stix-list.component';

@Component({
  selector: 'app-add-dialog',
  templateUrl: './add-dialog.component.html',
  styleUrls: ['./add-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class AddDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<AddDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public config: AddDialogConfig
  ) {}

  public get hasSelectableContent(): boolean {
    return (
      this.config.type === 'user' ||
      this.config.type === 'analytic' ||
      !!this.config.stixListConfig ||
      (this.config.selectableObjects?.length ?? 0) > 0
    );
  }

  public clearSelections() {
    this.config.select.clear();
    this.dialogRef.close(true);
  }
}

export interface AddDialogConfig {
  selectableObjects?: StixObject[]; // Stix Object array of selectable objects not in list
  type: string; // type to display stix list
  select: SelectionModel<string>; // selection model to retrieve list of selected object
  selectionType?: 'many' | 'one' | 'disabled'; // defaults to 'many' if a selection model is given
  buttonLabel?: string; // optional button label, default "add"
  title?: string; // dialog text
  clearSelection?: boolean; //boolean to add clear selection button
  showPreserveRelationshipsOption?: boolean; // show checkbox for preserveRelationships revoke option
  preserveRelationships?: boolean; // value passed back through the shared dialog config
  stixListConfig?: StixListConfig; // optional full stix-list config
}
