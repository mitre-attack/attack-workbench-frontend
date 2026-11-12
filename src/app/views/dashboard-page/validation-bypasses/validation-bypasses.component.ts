import {
  AfterViewInit,
  Component,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { finalize, take } from 'rxjs/operators';
import { ConfirmationDialogComponent } from 'src/app/components/confirmation-dialog/confirmation-dialog.component';
import {
  RestApiConnectorService,
  ValidationBypassRule,
} from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { ValidationBypassRuleDialogComponent } from './validation-bypass-rule-dialog/validation-bypass-rule-dialog.component';

@Component({
  selector: 'app-validation-bypasses',
  templateUrl: './validation-bypasses.component.html',
  styleUrls: ['./validation-bypasses.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class ValidationBypassesComponent implements OnInit, AfterViewInit {
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  public dataSource = new MatTableDataSource<ValidationBypassRule>([]);
  public columnsToDisplay = [
    'fieldPath',
    'errorCode',
    'stixType',
    'behavior',
    'source',
    'warningMessage',
    'actions',
  ];
  public loadingRules = false;
  public searchQuery = '';

  constructor(
    private restAPIConnector: RestApiConnectorService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.configureTable();
    this.loadRules();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  public loadRules(): void {
    this.loadingRules = true;
    this.restAPIConnector
      .getValidationBypassRules()
      .pipe(
        take(1),
        finalize(() => (this.loadingRules = false))
      )
      .subscribe({
        next: rules => {
          this.dataSource.data = rules || [];
          if (this.paginator) this.paginator.firstPage();
          if (this.searchQuery) this.applySearch(this.searchQuery);
        },
      });
  }

  public applySearch(query: string): void {
    this.searchQuery = query;
    this.dataSource.filter = (query || '').trim().toLowerCase();
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  public createRule(): void {
    this.openRuleDialog();
  }

  public editRule(rule: ValidationBypassRule): void {
    this.openRuleDialog(rule);
  }

  public deleteRule(rule: ValidationBypassRule): void {
    const id = this.ruleId(rule);
    if (!id) return;

    const confirmationPrompt = this.dialog.open(ConfirmationDialogComponent, {
      maxWidth: '35em',
      data: {
        message: 'This validation bypass rule will be deleted.',
      },
      autoFocus: false,
    });

    confirmationPrompt
      .afterClosed()
      .pipe(take(1))
      .subscribe(result => {
        if (!result) return;

        this.restAPIConnector
          .deleteValidationBypassRule(id)
          .pipe(take(1))
          .subscribe({ next: () => this.loadRules() });
      });
  }

  public fieldPath(rule: ValidationBypassRule): string {
    return (rule.fieldPath || []).join('.');
  }

  public behavior(rule: ValidationBypassRule): string {
    const hasWarning = !!rule.warningMessage;
    if (rule.suppressError && hasWarning) return 'suppress + warn';
    if (rule.suppressError) return 'suppress';
    if (hasWarning) return 'warn';
    return 'inactive';
  }

  public source(rule: ValidationBypassRule): string {
    if (!rule.autoCreated) return 'manual';
    return rule.autoCreatedReason
      ? `auto: ${rule.autoCreatedReason}`
      : 'auto-created';
  }

  public ruleId(rule: ValidationBypassRule): string | undefined {
    return rule._id || rule.id;
  }

  private configureTable(): void {
    this.dataSource.filterPredicate = (rule, filter) => {
      return this.ruleSearchText(rule).includes(filter);
    };

    this.dataSource.sortingDataAccessor = (rule, column) => {
      switch (column) {
        case 'fieldPath':
          return this.fieldPath(rule);
        case 'behavior':
          return this.behavior(rule);
        case 'source':
          return this.source(rule);
        case 'warningMessage':
          return rule.warningMessage || '';
        default:
          return (rule as any)[column] || '';
      }
    };
  }

  private openRuleDialog(rule?: ValidationBypassRule): void {
    const prompt = this.dialog.open(ValidationBypassRuleDialogComponent, {
      maxWidth: '48em',
      width: '48em',
      data: { rule },
      autoFocus: false,
    });

    prompt
      .afterClosed()
      .pipe(take(1))
      .subscribe((result?: ValidationBypassRule) => {
        if (!result) return;

        const id = rule ? this.ruleId(rule) : undefined;
        const request = id
          ? this.restAPIConnector.putValidationBypassRule(id, result)
          : this.restAPIConnector.postValidationBypassRule(result);

        request.pipe(take(1)).subscribe({ next: () => this.loadRules() });
      });
  }

  private ruleSearchText(rule: ValidationBypassRule): string {
    return [
      this.fieldPath(rule),
      rule.errorCode,
      rule.stixType,
      this.behavior(rule),
      this.source(rule),
      rule.warningMessage,
      rule.triggerEvent,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }
}
