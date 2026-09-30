import { Component, Inject, OnDestroy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { finalize, take, takeUntil } from 'rxjs/operators';
import {
  AllowedValueCatalog,
  AllowedValueDefinition,
  AllowedValueOption,
  AllowedValueRule,
  RestApiConnectorService,
} from 'src/app/services/connectors/rest-api/rest-api-connector.service';

@Component({
  selector: 'app-allowed-value-dialog',
  templateUrl: './allowed-value-dialog.component.html',
  styles: [
    `
      .rule-identity {
        overflow-wrap: anywhere;
      }
      .scope-fields,
      .formatted-fields,
      .step-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }
      .scope-fields mat-form-field,
      .formatted-fields mat-form-field {
        flex: 1;
      }
      .search {
        width: 100%;
      }
      .option-list {
        max-height: 19em;
        overflow-y: auto;
      }
      .option-row {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      .option-row mat-checkbox {
        flex: 1;
        overflow-wrap: anywhere;
      }
      .option-state {
        font-size: 0.85em;
      }
      .draft-error {
        color: var(--mat-sys-error, #b00020);
      }
      .legacy-warning {
        border-left: 3px solid currentColor;
        padding-left: 12px;
      }
      .review-values {
        max-height: 18em;
        overflow-y: auto;
      }
    `,
  ],
  standalone: false,
})
export class AllowedValueDialogComponent implements OnDestroy {
  public rule?: AllowedValueRule;
  public propertyName = '';
  public domainName = '';
  public objectType = '';
  public search = '';
  public saving = false;
  public validating = false;
  public error = '';
  public formatted = this.formBuilder.nonNullable.group({
    source: ['', [Validators.required, Validators.pattern(/\S/)]],
    component: ['', [Validators.required, Validators.pattern(/\S/)]],
  });
  private draft = new Map<string, Map<string, boolean>>();
  private approved = new Map<string, Set<string>>();
  private destroyed = new Subject<void>();

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: {
      catalog: AllowedValueCatalog;
      rules: AllowedValueRule[];
      rule?: AllowedValueRule;
    },
    public dialogRef: MatDialogRef<AllowedValueDialogComponent>,
    private formBuilder: FormBuilder,
    private api: RestApiConnectorService
  ) {
    if (data.rule) this.loadRule(data.rule);
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  public get busy(): boolean {
    return this.saving || this.validating;
  }

  public get properties(): string[] {
    return [...new Set(this.data.catalog.rules.map(rule => rule.propertyName))];
  }

  public get domains(): AllowedValueDefinition[] {
    return this.data.catalog.rules.filter(
      rule => rule.propertyName === this.propertyName
    );
  }

  public get definition(): AllowedValueDefinition | undefined {
    return this.domains.find(rule => rule.domainName === this.domainName);
  }

  public get existingRule(): AllowedValueRule | undefined {
    return this.data.rules.find(
      rule =>
        rule.propertyName === this.propertyName &&
        rule.domainName === this.domainName
    );
  }

  public get scopeReady(): boolean {
    return !!this.definition?.objectTypes.includes(this.objectType);
  }

  public get pendingInput(): boolean {
    const { source, component } = this.formatted.getRawValue();
    return !!(source || component);
  }

  public get canSave(): boolean {
    return (
      this.scopeReady &&
      !this.busy &&
      !this.pendingInput &&
      (!!this.rule || !this.existingRule)
    );
  }

  public selectProperty(propertyName: string): void {
    if (this.busy || this.rule) return;
    this.propertyName = propertyName;
    this.selectDomain('');
  }

  public selectDomain(domainName: string): void {
    if (this.busy || this.rule) return;
    this.domainName = domainName;
    this.objectType = '';
    this.resetDraft();
  }

  public selectObjectType(objectType: string): void {
    if (
      this.busy ||
      this.pendingInput ||
      !this.definition?.objectTypes.includes(objectType)
    )
      return;
    this.objectType = objectType;
    this.search = '';
  }

  public openExisting(): void {
    if (this.busy || !this.existingRule || !this.scopeReady) return;
    this.loadRule(this.existingRule, this.objectType);
  }

  private resetDraft(): void {
    this.draft.clear();
    this.approved.clear();
    this.search = '';
    this.error = '';
    this.formatted.reset();
    for (const choice of this.definition?.choices || []) {
      for (const type of choice.objectTypes) this.approve(type, choice.value);
    }
  }

  private loadRule(rule: AllowedValueRule, objectType?: string): void {
    this.rule = rule;
    this.propertyName = rule.propertyName;
    this.domainName = rule.domainName;
    this.resetDraft();
    this.objectType = objectType || this.definition?.objectTypes[0] || '';
    // The server separates invalid legacy settings; only compliant values enter the draft.
    for (const option of rule.values) {
      for (const type of option.objectTypes) {
        if (this.definition?.valueType === 'formatted')
          this.approve(type, option.value);
        if (this.approved.get(type)?.has(option.value))
          this.setDraft(type, option.value, option.enabled);
      }
    }
  }

  private approve(type: string, value: string): void {
    if (!this.approved.has(type)) this.approved.set(type, new Set());
    this.approved.get(type)!.add(value);
  }

  private setDraft(type: string, value: string, enabled: boolean): void {
    if (!this.draft.has(type)) this.draft.set(type, new Map());
    this.draft.get(type)!.set(value, enabled);
  }

  public get visibleChoices(): string[] {
    const query = this.search.trim().toLowerCase();
    return [...(this.approved.get(this.objectType) || [])]
      .filter(value => value.toLowerCase().includes(query))
      .sort((a, b) => a.localeCompare(b));
  }

  public state(value: string): boolean | undefined {
    return this.draft.get(this.objectType)?.get(value);
  }

  public setEnabled(value: string, enabled: boolean): void {
    if (
      this.busy ||
      !this.scopeReady ||
      !this.approved.get(this.objectType)?.has(value)
    )
      return;
    this.setDraft(this.objectType, value, enabled);
  }

  public removeValue(value: string): void {
    if (!this.busy) this.draft.get(this.objectType)?.delete(value);
  }

  public clearInput(): void {
    if (!this.busy) this.formatted.reset();
  }

  public addFormatted(): void {
    if (
      this.busy ||
      !this.scopeReady ||
      this.definition?.valueType !== 'formatted'
    )
      return;
    if (this.formatted.invalid) {
      this.formatted.markAllAsTouched();
      return;
    }
    const { source, component } = this.formatted.getRawValue();
    const type = this.objectType;
    this.validating = true;
    this.error = '';
    this.dialogRef.disableClose = true;
    this.formatted.disable();
    this.api
      .validateAllowedValue(
        this.propertyName,
        this.domainName,
        [type],
        `${source.trim()}: ${component.trim()}`
      )
      .pipe(
        take(1),
        takeUntil(this.destroyed),
        finalize(() => {
          this.validating = false;
          this.dialogRef.disableClose = false;
          this.formatted.enable();
        })
      )
      .subscribe({
        next: ({ value }) => {
          this.approve(type, value);
          this.setDraft(type, value, true);
          this.formatted.reset();
          this.search = '';
        },
        error: (error: HttpErrorResponse) => this.showError(error),
      });
  }

  public get values(): AllowedValueOption[] {
    const values: AllowedValueOption[] = [];
    for (const [type, options] of this.draft) {
      // Creation configures exactly the chosen object type. Editing retains all other types.
      if (!this.rule && type !== this.objectType) continue;
      for (const [value, enabled] of options) {
        const existing = values.find(
          option => option.value === value && option.enabled === enabled
        );
        if (existing) existing.objectTypes.push(type);
        else values.push({ value, enabled, objectTypes: [type] });
      }
    }
    return values;
  }

  public cancel(): void {
    if (!this.busy) this.dialogRef.close();
  }

  public confirm(): void {
    if (!this.canSave) return;
    this.saving = true;
    this.error = '';
    this.dialogRef.disableClose = true;
    const request = this.rule
      ? this.api.putAllowedValueRule(
          this.propertyName,
          this.domainName,
          this.values
        )
      : this.api.postAllowedValueRule(
          this.propertyName,
          this.domainName,
          this.values
        );
    request
      .pipe(
        take(1),
        takeUntil(this.destroyed),
        finalize(() => {
          this.saving = false;
          this.dialogRef.disableClose = false;
        })
      )
      .subscribe({
        next: rule => this.dialogRef.close(rule),
        error: (error: HttpErrorResponse) => this.showError(error),
      });
  }

  private showError(error: HttpErrorResponse): void {
    this.error =
      typeof error.error?.details === 'string'
        ? error.error.details
        : typeof error.error?.message === 'string'
          ? error.error.message
          : typeof error.error === 'string'
            ? error.error
            : error.message;
  }
}
