import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { StixObject } from 'src/app/classes/stix/stix-object';
import { SelectionModel } from '@angular/cdk/collections';
import { StixListConfig } from '../stix/stix-list/stix-list.component';

@Component({
  selector: 'app-bulk-update-dialog',
  templateUrl: './bulk-update-dialog.component.html',
  styleUrls: ['./bulk-update-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class BulkPromoteDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<BulkPromoteDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public config: BulkPromoteDialogConfig
  ) {}

  public get stixObjects(): StixObject[] {
    if (Array.isArray(this.config.stixListConfig?.stixObjects)) {
      return this.config.stixListConfig.stixObjects;
    }
    return this.config.selectableObjects || [];
  }

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

  public selectAll(): void {
    const ids = this.stixObjects.map(obj => obj.stixID);
    this.config.select.select(...ids);
  }
}

export interface BulkPromoteDialogConfig {
  selectableObjects?: StixObject[]; // Stix Object array of selectable objects not in list
  type: string; // type to display stix list
  select: SelectionModel<string>; // selection model to retrieve list of selected object
  selectAll?: boolean;
  selectionType?: 'many' | 'one' | 'disabled'; // defaults to 'many' if a selection model is given
  canPromote?: boolean;
  canDemote?: boolean;
  title?: string; // dialog text
  clearSelection?: boolean; //boolean to add clear selection button
  stixListConfig?: StixListConfig; // optional full stix-list config
}
