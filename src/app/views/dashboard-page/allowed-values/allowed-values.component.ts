import {
  AfterViewInit,
  Component,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { forkJoin } from 'rxjs';
import { finalize, take } from 'rxjs/operators';
import {
  AllowedValueCatalog,
  AllowedValueOption,
  AllowedValueRule,
  RestApiConnectorService,
} from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { AllowedValueDialogComponent } from './allowed-value-dialog/allowed-value-dialog.component';

interface AllowedValueRow extends AllowedValueRule {
  valueCount: number;
  disabledCount: number;
  preview: AllowedValueOption[];
}

@Component({
  selector: 'app-allowed-values',
  templateUrl: './allowed-values.component.html',
  styleUrls: ['../validation-bypasses/validation-bypasses.component.scss'],
  styles: [
    `
      .allowed-values-page .value-summary {
        min-width: 15em;
        max-width: 28em;
        padding-top: 12px;
        padding-bottom: 12px;
      }
      .allowed-values-page .value-preview {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 6px;
      }
      .allowed-values-page .value-option {
        border: 1px solid currentColor;
        border-radius: 12px;
        padding: 2px 8px;
        max-width: 100%;
        overflow-wrap: anywhere;
      }
      .allowed-values-page .value-option.disabled {
        border-style: dashed;
      }
      .allowed-values-page .remaining-values {
        align-self: center;
      }
    `,
  ],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class AllowedValuesComponent implements OnInit, AfterViewInit {
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  public dataSource = new MatTableDataSource<AllowedValueRow>([]);
  public columnsToDisplay = [
    'propertyName',
    'domainName',
    'objectTypes',
    'values',
    'actions',
  ];
  public loading = false;
  public loaded = false;
  public error = '';
  public catalog?: AllowedValueCatalog;

  constructor(
    private api: RestApiConnectorService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.dataSource.filterPredicate = (row, query) =>
      [
        row.propertyName,
        row.domainName,
        ...row.objectTypes,
        ...row.values.map(
          option => `${option.value} ${option.enabled ? 'enabled' : 'disabled'}`
        ),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    this.dataSource.sortingDataAccessor = (row, column) => {
      if (column === 'objectTypes') return row.objectTypes.join(', ');
      if (column === 'values') return row.valueCount;
      return row[column];
    };
    this.loadRules();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  public loadRules(): void {
    this.loading = true;
    this.error = '';
    this.loaded = false;
    this.catalog = undefined;
    forkJoin({
      rules: this.api.getAllowedValueRules(),
      catalog: this.api.getAllowedValueCatalog(),
    })
      .pipe(
        take(1),
        finalize(() => (this.loading = false))
      )
      .subscribe({
        next: ({ rules, catalog }) => {
          this.catalog = catalog;
          this.dataSource.data = rules.map(rule => this.toRow(rule));
          this.loaded = true;
        },
        error: (error: HttpErrorResponse) => {
          this.error =
            typeof error.error?.message === 'string'
              ? error.error.message
              : typeof error.error === 'string'
                ? error.error
                : error.message;
        },
      });
  }

  public applySearch(query: string): void {
    this.dataSource.filter = query.trim().toLowerCase();
    this.paginator?.firstPage();
  }

  public editValues(rule?: AllowedValueRule): void {
    if (!this.catalog || this.loading || this.error) return;
    this.dialog
      .open(AllowedValueDialogComponent, {
        width: '58em',
        maxWidth: '95vw',
        data: { rule, rules: this.dataSource.data, catalog: this.catalog },
        autoFocus: false,
      })
      .afterClosed()
      .pipe(take(1))
      .subscribe((updated?: AllowedValueRule) => {
        if (!updated) return;
        const existing = this.dataSource.data.some(
          row =>
            row.propertyName === updated.propertyName &&
            row.domainName === updated.domainName
        );
        this.dataSource.data = existing
          ? this.dataSource.data.map(row =>
              row.propertyName === updated.propertyName &&
              row.domainName === updated.domainName
                ? this.toRow(updated)
                : row
            )
          : [...this.dataSource.data, this.toRow(updated)];
      });
  }

  private toRow(rule: AllowedValueRule): AllowedValueRow {
    return {
      ...rule,
      valueCount: new Set(rule.values.map(option => option.value)).size,
      disabledCount: rule.values.filter(option => !option.enabled).length,
      preview: rule.values.slice(0, 3),
    };
  }
}
