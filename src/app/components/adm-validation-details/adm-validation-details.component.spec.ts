import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { of, Subject, throwError } from 'rxjs';
import { ExemptionReport } from 'src/app/classes/validation-policy';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { AdmValidationDetailsComponent } from './adm-validation-details.component';

const report: ExemptionReport = {
  availability: 'retained',
  reportId: 'original',
  policyRevision: 4,
  state: 'completed',
  reportedExemptRevisions: 0,
  ruleApplications: 0,
  byRule: [],
  details: [],
  nextCursor: null,
};
describe('ADM validation details', () => {
  let connector: { getValidationReport: ReturnType<typeof vi.fn> };
  let component: AdmValidationDetailsComponent;
  beforeEach(() => {
    connector = { getValidationReport: vi.fn(() => of(report)) };
    component = new AdmValidationDetailsComponent(connector as any);
    component.report = report;
    component.ngOnChanges();
  });
  it('stays collapsed without requests, then expands the original report', () => {
    expect(component.expanded).toBe(false);
    expect(connector.getValidationReport).not.toHaveBeenCalled();
    component.open();
    expect(connector.getValidationReport).toHaveBeenCalledWith('original', {
      statuses: [],
      ruleIds: [],
      limit: 50,
      cursor: undefined,
    });
  });
  it('uses bounded cursor pagination and starts a new page for changed selectors', () => {
    connector.getValidationReport.mockReturnValue(
      of({ ...report, nextCursor: 'page2', hasMore: true })
    );
    component.open();
    component.next();
    expect(connector.getValidationReport.mock.lastCall[1].cursor).toBe('page2');
    component.statuses = ['revoked'];
    component.filter();
    expect(component.page).toBe(0);
    expect(connector.getValidationReport.mock.lastCall[1]).toMatchObject({
      statuses: ['revoked'],
      cursor: undefined,
    });
  });
  it('cancels older requests on selector changes and destroy', () => {
    const old = new Subject<ExemptionReport>();
    const current = new Subject<ExemptionReport>();
    connector.getValidationReport
      .mockReturnValueOnce(old)
      .mockReturnValueOnce(current);
    component.open();
    component.ruleIds = ['rule'];
    component.filter();
    old.next({ ...report, reportedExemptRevisions: 99 });
    expect(component.displayed.reportedExemptRevisions).toBe(0);
    current.next({ ...report, reportedExemptRevisions: 1 });
    expect(component.displayed.reportedExemptRevisions).toBe(1);
    component.ngOnDestroy();
    expect(current.observed).toBe(false);
  });
  it('handles expired reports without rerunning validation', () => {
    connector.getValidationReport.mockReturnValue(
      throwError(() => ({ status: 410 }))
    );
    component.open();
    expect(component.error).toContain('expired');
    expect(component.loading).toBe(false);
  });
  it('filters complete inline evidence and tolerates unavailable counts', () => {
    component.report = {
      availability: 'unavailable',
      details: [
        {
          object_ref: 'group--1',
          object_modified: 'date',
          ruleId: 'r',
          ruleName: 'Retired',
          retirementStatus: 'deprecated',
          phase: 'evaluation',
        },
      ],
    };
    component.ngOnChanges();
    component.statuses = ['revoked'];
    component.open();
    expect(component.displayed.reportedExemptRevisions).toBe(0);
    component.report = {
      availability: 'unavailable',
      availabilityMessage: 'Retention failed',
    };
    component.ngOnChanges();
    expect(component.displayed.reportedExemptRevisions).toBeUndefined();
  });
  it('rebuilds readable per-rule summaries for nonempty complete inline selections', () => {
    const row = {
      object_ref: 'group--1',
      object_modified: 'date',
      ruleId: 'r',
      ruleName: 'Retired groups',
      retirementStatus: 'deprecated' as const,
      phase: 'evaluation' as const,
    };
    component.report = {
      availability: 'unavailable',
      details: [
        row,
        { ...row, object_ref: 'group--2' },
        { ...row, ruleId: 'overlap', ruleName: 'All deprecated' },
        {
          ...row,
          retirementStatus: 'revoked',
          ruleId: 'other',
          ruleName: 'Revoked',
        },
      ],
      truncated: false,
    };
    component.ngOnChanges();
    component.statuses = ['deprecated'];
    component.open();
    expect(component.displayed.reportedExemptRevisions).toBe(2);
    expect(component.displayed.ruleApplications).toBe(3);
    expect(component.displayed.byRule).toEqual([
      {
        ruleId: 'overlap',
        ruleName: 'All deprecated',
        retirementStatus: 'deprecated',
        count: 1,
      },
      {
        ruleId: 'r',
        ruleName: 'Retired groups',
        retirementStatus: 'deprecated',
        count: 2,
      },
    ]);
    component.ruleIds = ['r'];
    component.filter();
    expect(component.displayed.byRule).toEqual([
      {
        ruleId: 'r',
        ruleName: 'Retired groups',
        retirementStatus: 'deprecated',
        count: 2,
      },
    ]);
    expect(component.displayed.ruleApplications).toBe(2);
    expect(connector.getValidationReport).not.toHaveBeenCalled();
  });
  it('keeps filtered totals unknown for incomplete or absent inline evidence', () => {
    const details = [
      {
        object_ref: 'group--1',
        object_modified: 'date',
        ruleId: 'r',
        ruleName: 'Retired',
        retirementStatus: 'deprecated' as const,
        phase: 'evaluation' as const,
      },
    ];
    for (const evidence of [
      { details, truncated: true },
      { details, hasMore: true },
      { details, nextCursor: 'another-page' },
      { availabilityMessage: 'Retention failed' },
    ]) {
      component.report = { availability: 'unavailable', ...evidence };
      component.ngOnChanges();
      component.statuses = ['deprecated'];
      component.open();
      expect(component.displayed.reportedExemptRevisions).toBeUndefined();
      expect(component.displayed.ruleApplications).toBeUndefined();
      expect(component.displayed.byRule).toEqual([]);
    }
    expect(connector.getValidationReport).not.toHaveBeenCalled();
  });
  it('renders zero selection as no matches and explains that it does not establish conformance', async () => {
    await TestBed.configureTestingModule({
      declarations: [AdmValidationDetailsComponent],
      imports: [CommonModule],
      providers: [{ provide: RestApiConnectorService, useValue: connector }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdmValidationDetailsComponent);
    fixture.componentInstance.report = report;
    fixture.componentInstance.ngOnChanges();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('No matches for this selection');
    expect(text).toContain('does not establish ADM conformance');
    expect(text).not.toMatch(/ADM valid(?:$|[.!\s])/);
    fixture.destroy();
  });
});
