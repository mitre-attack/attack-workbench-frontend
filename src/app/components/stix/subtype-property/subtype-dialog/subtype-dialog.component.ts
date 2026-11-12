import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatOptionSelectionChange } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { map, Observable, startWith, Subscription } from 'rxjs';
import { StixObject } from 'src/app/classes/stix';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { EditorService } from 'src/app/services/editor/editor.service';
import { dataComponentNames } from 'src/app/utils/data-component-names';

@Component({
  selector: 'app-subtype-dialog',
  templateUrl: './subtype-dialog.component.html',
  styleUrls: ['./subtype-dialog.component.scss'],
  standalone: false,
})
export class SubtypeDialogComponent implements OnInit, OnDestroy {
  public isNew = false;
  public data: any = {};

  public allowedValues: any = {};
  public selectControls: Record<string, FormControl> = {};
  public dataLoaded = false;
  private allowedValuesSub: Subscription = new Subscription();
  private saveSubscription: Subscription = new Subscription();

  public dataComponentNames = dataComponentNames;
  public filteredDataComponentNames: Observable<string[]>;
  public dataComponentNameControl = new FormControl('');

  public get isValid(): boolean {
    const required = this.config.subtypeFields.filter(field => field.required);
    return required.every(
      field => field.name in this.data && this.data[field.name].length
    );
  }

  constructor(
    public dialogRef: MatDialogRef<SubtypeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public config: SubtypeDialogConfig,
    public restApiService: RestApiConnectorService,
    public editorService: EditorService
  ) {
    this.isNew = config.index == undefined;
    if (!this.isNew) this.data = config.object[config.field][config.index];
  }

  ngOnInit(): void {
    const autocompletes = this.config.subtypeFields
      .filter(field => field.editType === 'autocomplete')
      .map(field => field.name);
    if (autocompletes.includes('data_component_name')) {
      const fieldName = 'data_component_name';
      this.dataComponentNameControl.setValue(this.data[fieldName] || '');
      this.filteredDataComponentNames =
        this.dataComponentNameControl.valueChanges.pipe(
          startWith(this.data[fieldName] || ''),
          map(value => this.filterDataComponentNames(value || ''))
        );
      // keep in sync
      this.dataComponentNameControl.valueChanges.subscribe(v => {
        this.data[fieldName] = v;
      });
    }

    // retrieve 'select' fields
    const selections = this.config.subtypeFields
      .filter(field => field.editType == 'select')
      .map(field => field.name);
    if (!selections.length) return;

    // create a form control for each 'select' field
    selections.forEach(fieldName => {
      this.selectControls[fieldName] = new FormControl(
        this.data[fieldName] || []
      );
    });

    // load allowed values for 'select' fields
    this.allowedValuesSub = this.restApiService
      .getAllAllowedValues()
      .subscribe({
        next: data => {
          const allAllowedValues = data.find(
            obj => obj.objectType == this.config.object.attackType
          );
          selections.forEach(field => {
            const values = new Set<string>();
            const property = allAllowedValues?.properties?.find(
              p => p.propertyName == field
            );
            if ('domains' in this.config.object) {
              const obj = this.config.object as any;
              property?.domains?.forEach(domain => {
                if (obj.domains.includes(domain.domainName)) {
                  domain.allowedValues.forEach(values.add, values);
                }
              });
            } else {
              // domains not specified on object
              property?.domains?.forEach(domain => {
                domain.allowedValues.forEach(values.add, values);
              });
            }
            this.allowedValues[field] = Array.from(values);
          });
          this.dataLoaded = true;
        },
      });
  }

  ngOnDestroy(): void {
    if (this.allowedValuesSub) this.allowedValuesSub.unsubscribe();
    if (this.saveSubscription) this.saveSubscription.unsubscribe();
  }

  /** Add value to subtype field */
  public add(): void {
    if (this.config.index || this.config.index === 0) {
      // update the existing value
      this.config.object[this.config.field][this.config.index] = this.data;
    } else {
      // add the value to the field
      this.config.object[this.config.field].push(this.data);
    }

    // parse citations
    this.saveSubscription = this.config.object['external_references']
      .parseObjectCitations(this.config.object, this.restApiService)
      .subscribe({
        next: () => {
          this.editorService.onReloadReferences.emit();
        },
      });
    this.dialogRef.close();
  }

  public getOptions(fieldName: string): string[] {
    return [
      ...new Set<string>([
        ...(this.allowedValues[fieldName] || []),
        ...(this.selectControls[fieldName].value || []),
      ]),
    ];
  }

  /** Handles onSelectionChange event to add or remove the
   *  user's selection from a multi-select field */
  public change(event: MatOptionSelectionChange, fieldName: string): void {
    if (!event.isUserInput) return;
    if (event.source.selected) {
      this.data[fieldName] = [
        ...(this.data[fieldName] || []),
        event.source.value,
      ];
    } else this.remove(fieldName, event.source.value);
  }

  /** Remove value from multi-select field */
  public remove(fieldName: string, value: string): void {
    const values = this.selectControls[fieldName].value as string[];
    const i = values.indexOf(value);
    if (i >= 0) values.splice(i, 1);
    this.selectControls[fieldName].setValue(values);
    this.data[fieldName] = this.selectControls[fieldName].value;
  }

  private filterDataComponentNames(value: string): string[] {
    const search = value.toLowerCase();
    return this.dataComponentNames.filter(o =>
      o.toLowerCase().includes(search)
    );
  }
}

export interface SubtypeDialogConfig {
  object: StixObject;
  field: string;
  index?: number;
  tooltip: string;
  subtypeFields: {
    name: string;
    editType: string;
    label: string;
    required?: boolean;
    key?: boolean /** Specifies which subtypeField is used as an indexing key, there must be at least one */;
  }[];
}
