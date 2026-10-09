import { Subject, Subscription } from 'rxjs';
import { ReconciliationStatus } from 'src/app/classes/validation-policy';
import { StixTypeToAttackType } from 'src/app/utils/type-mappings';
import {
  AfterViewInit,
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { finalize, take, takeUntil, timeout } from 'rxjs/operators';
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
export class ValidationBypassesComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  public dataSource = new MatTableDataSource<ValidationBypassRule>([]);
  public columnsToDisplay = [
    'name',
    'kind',
    'category',
    'scope',
    'enabled',
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
  public apiError = '';
  public reconciliation: ReconciliationStatus;
  public statusError = '';
  public retrying = false;
  private statusRequest?: Subscription;
  private rulesRequest?: Subscription;
  private retryRequest?: Subscription;
  private pollTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;
  private readonly destroy$ = new Subject<void>();
  private readonly visibilityChanged = () => {
    if (document.hidden) {
      this.stopPolling();
      this.statusRequest?.unsubscribe();
    } else this.refreshStatus();
  };
  private readonly focused = () => {
    if (!document.hidden) this.refreshStatus();
  };

  public scope(rule: ValidationBypassRule): string {
    const types =
      rule.kind === 'object-exemption' ? rule.stixTypes : rule.stixType;
    return types === 'all'
      ? 'All types'
      : (Array.isArray(types) ? types : [types])
          .map(type => StixTypeToAttackType[type] || type)
          .join(', ');
  }
  public get reconciliationError(): string {
    const error = this.reconciliation?.last_error;
    return typeof error === 'string' ? error : error?.message || '';
  }
  public refreshStatus(): void {
    this.stopPolling();
    this.statusRequest?.unsubscribe();
    if (this.destroyed || document.hidden) return;
    this.statusRequest = this.restAPIConnector
      .getValidationReconciliation()
      .pipe(take(1), timeout(20000))
      .subscribe({
        next: status => {
          this.reconciliation = status;
          this.statusError = '';
          this.schedulePoll();
        },
        error: error => {
          this.statusError = this.errorMessage(error);
          this.schedulePoll();
        },
      });
  }
  public retryReconciliation(): void {
    this.retryRequest?.unsubscribe();
    this.retrying = true;
    this.retryRequest = this.restAPIConnector
      .retryValidationReconciliation()
      .pipe(
        take(1),
        timeout(20000),
        finalize(() => (this.retrying = false))
      )
      .subscribe({
        next: () => this.refreshStatus(),
        error: error => (this.statusError = this.errorMessage(error)),
      });
  }
  private schedulePoll(): void {
    if (
      !this.destroyed &&
      !document.hidden &&
      (this.statusError ||
        ['pending', 'running', 'superseded'].includes(
          this.reconciliation?.status
        ))
    )
      this.pollTimer = setTimeout(() => this.refreshStatus(), 30000);
  }
  private stopPolling(): void {
    clearTimeout(this.pollTimer);
  }
  private errorMessage(error: {
    status?: number;
    error?: string | { message?: string; details?: string };
    message?: string;
  }): string {
    const message =
      typeof error.error === 'string'
        ? error.error
        : error.error?.message || error.error?.details;
    return error.status === 409
      ? `${message || 'This rule conflicts with the current policy.'} Reload the rules and try again.`
      : message ||
          error.message ||
          'Unable to load validation policy. Try again.';
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    this.destroy$.next();
    this.destroy$.complete();
    this.stopPolling();
    this.statusRequest?.unsubscribe();
    this.rulesRequest?.unsubscribe();
    this.retryRequest?.unsubscribe();
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    window.removeEventListener('focus', this.focused);
  }

  constructor(
    private restAPIConnector: RestApiConnectorService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.configureTable();
    this.loadRules();
    this.refreshStatus();
    document.addEventListener('visibilitychange', this.visibilityChanged);
    window.addEventListener('focus', this.focused);
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  public loadRules(): void {
    this.rulesRequest?.unsubscribe();
    this.loadingRules = true;
    this.apiError = '';
    this.rulesRequest = this.restAPIConnector
      .getValidationBypassRules()
      .pipe(
        take(1),
        timeout(20000),
        finalize(() => (this.loadingRules = false))
      )
      .subscribe({
        next: rules => {
          this.refreshStatus();
          this.dataSource.data = rules || [];
          if (this.paginator) this.paginator.firstPage();
          if (this.searchQuery) this.applySearch(this.searchQuery);
        },
        error: error => (this.apiError = this.errorMessage(error)),
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
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe(result => {
        if (!result) return;

        this.restAPIConnector
          .deleteValidationBypassRule(id)
          .pipe(take(1), timeout(20000), takeUntil(this.destroy$))
          .subscribe({
            next: () => this.loadRules(),
            error: error => (this.apiError = this.errorMessage(error)),
          });
      });
  }

  public fieldPath(rule: ValidationBypassRule): string {
    return (rule.fieldPath || []).join('.');
  }

  public behavior(rule: ValidationBypassRule): string {
    if (rule.kind === 'object-exemption')
      return rule.enabled ? 'skip ADM' : 'disabled';
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
        case 'kind':
          return rule.kind || 'error-bypass';
        case 'category':
          return rule.retirementStatus || '';
        case 'scope':
          return this.scope(rule);
        case 'enabled':
          return rule.kind === 'object-exemption' ? String(rule.enabled) : '';
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
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe((result?: ValidationBypassRule) => {
        if (!result) return;

        const id = rule ? this.ruleId(rule) : undefined;
        const request = id
          ? this.restAPIConnector.putValidationBypassRule(id, result)
          : this.restAPIConnector.postValidationBypassRule(result);

        request
          .pipe(take(1), timeout(20000), takeUntil(this.destroy$))
          .subscribe({
            next: () => this.loadRules(),
            error: error => (this.apiError = this.errorMessage(error)),
          });
      });
  }

  private ruleSearchText(rule: ValidationBypassRule): string {
    return [
      rule.name,
      rule.kind || 'error-bypass',
      rule.retirementStatus,
      this.scope(rule),
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
