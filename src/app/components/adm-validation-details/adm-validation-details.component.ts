import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { finalize, take, timeout } from 'rxjs/operators';
import {
  ExemptionReport,
  RetirementStatus,
} from 'src/app/classes/validation-policy';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';

@Component({
  selector: 'app-adm-validation-details',
  templateUrl: './adm-validation-details.component.html',
  standalone: false,
})
export class AdmValidationDetailsComponent implements OnChanges, OnDestroy {
  @Input() report: ExemptionReport;
  public displayed: ExemptionReport;
  public expanded = false;
  public loading = false;
  public error = '';
  public statuses: RetirementStatus[] = [];
  public ruleIds: string[] = [];
  public rules: NonNullable<ExemptionReport['byRule']> = [];
  public page = 0;
  private cursors: (string | undefined)[] = [undefined];
  private request?: Subscription;

  constructor(private connector: RestApiConnectorService) {}

  ngOnChanges(): void {
    this.request?.unsubscribe();
    this.displayed = this.report;
    this.rules = this.report?.byRule || [];
    this.statuses = [];
    this.ruleIds = [];
    this.page = 0;
    this.cursors = [undefined];
    this.error = '';
    if (this.expanded) this.load();
  }
  public open(): void {
    this.expanded = true;
    this.load();
  }
  public filter(): void {
    this.page = 0;
    this.cursors = [undefined];
    this.load();
  }
  public next(): void {
    if (!this.displayed?.nextCursor) return;
    this.cursors[++this.page] = this.displayed.nextCursor;
    this.load();
  }
  public previous(): void {
    if (this.page > 0) {
      this.page--;
      this.load();
    }
  }
  public load(): void {
    this.request?.unsubscribe();
    this.error = '';
    if (!this.report?.reportId) {
      const details = (this.report?.details || []).filter(
        row =>
          (!this.statuses.length ||
            this.statuses.includes(row.retirementStatus)) &&
          (!this.ruleIds.length || this.ruleIds.includes(row.ruleId))
      );
      const complete =
        !this.report?.truncated &&
        !this.report?.hasMore &&
        !this.report?.nextCursor &&
        !!this.report?.details;
      const byRule = new Map<
        string,
        NonNullable<ExemptionReport['byRule']>[number]
      >();
      if (complete)
        for (const row of details) {
          const rule = byRule.get(row.ruleId) || {
            ruleId: row.ruleId,
            ruleName: row.ruleName,
            retirementStatus: row.retirementStatus,
            count: 0,
          };
          rule.count++;
          byRule.set(row.ruleId, rule);
        }
      this.displayed =
        !this.statuses.length && !this.ruleIds.length
          ? this.report
          : {
              ...this.report,
              details,
              reportedExemptRevisions: !complete
                ? undefined
                : new Set(
                    details.map(
                      row => `${row.object_ref}/${row.object_modified}`
                    )
                  ).size,
              ruleApplications: !complete ? undefined : details.length,
              byRule: [...byRule.values()].sort((a, b) =>
                a.ruleId.localeCompare(b.ruleId)
              ),
            };
      return;
    }
    this.loading = true;
    this.request = this.connector
      .getValidationReport(this.report.reportId, {
        statuses: this.statuses,
        ruleIds: this.ruleIds,
        limit: 50,
        cursor: this.cursors[this.page],
      })
      .pipe(
        take(1),
        timeout(20000),
        finalize(() => (this.loading = false))
      )
      .subscribe({
        next: report => {
          this.displayed = report;
          for (const rule of report.byRule || [])
            if (!this.rules.some(item => item.ruleId === rule.ruleId))
              this.rules = [...this.rules, rule];
        },
        error: error => {
          this.error =
            error.status === 410
              ? 'This report has expired. The original operation has not been rerun.'
              : error.status === 401 || error.status === 403
                ? 'You no longer have access to this report.'
                : error.error?.message ||
                  'Unable to retrieve this report. Try again.';
        },
      });
  }
  ngOnDestroy(): void {
    this.request?.unsubscribe();
  }
}
