import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { of, Subject, throwError } from 'rxjs';

import { ValidationBypassesComponent } from './validation-bypasses.component';
import {
  RestApiConnectorService,
  ValidationBypassRule,
} from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createAsyncObservable,
  createMockRestApiConnector,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('ValidationBypassesComponent', () => {
  let component: ValidationBypassesComponent;
  let fixture: ComponentFixture<ValidationBypassesComponent>;

  const rules: ValidationBypassRule[] = [
    {
      _id: '6a3ab4064663ff5bba83e889',
      fieldPath: ['x_mitre_modified_by_ref'],
      errorCode: 'invalid_value',
      stixType: 'x-mitre-tactic',
      suppressError: true,
      autoCreated: true,
      autoCreatedReason: 'static',
      triggerEvent: null,
      warningMessage: null,
    },
  ];

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({
      getValidationReconciliation: () =>
        of({
          status: 'completed',
          policy_revision: 1,
          progress: { processed: 0, total: 0 },
        }),
      getValidationBypassRules: () => createAsyncObservable(rules),
      postValidationBypassRule: vi.fn(() => of(rules[0])),
      putValidationBypassRule: vi.fn(() => of(rules[0])),
      deleteValidationBypassRule: vi.fn(() => of({})),
    });
    const mockDialog = {
      open: vi.fn(() => ({ afterClosed: () => of(false) })),
    };

    await TestBed.configureTestingModule({
      declarations: [ValidationBypassesComponent],
      providers: [
        provideHttpClient(),
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
        { provide: MatDialog, useValue: mockDialog },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ValidationBypassesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load validation bypass rules', async () => {
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(component.dataSource.data).toEqual(rules);
    expect(component.fieldPath(rules[0])).toBe('x_mitre_modified_by_ref');
    expect(component.behavior(rules[0])).toBe('suppress');
    expect(component.source(rules[0])).toBe('auto: static');
  });
});

describe('validation policy administration lifecycle', () => {
  const status = {
    status: 'pending',
    policy_revision: 2,
    progress: { processed: 10, total: null },
  };
  let connector: any;
  let page: ValidationBypassesComponent;
  beforeEach(() => {
    vi.useFakeTimers();
    connector = {
      getValidationBypassRules: vi.fn(() => of([])),
      getValidationReconciliation: vi.fn(() => of(status)),
      retryValidationReconciliation: vi.fn(() => of(status)),
    };
    page = new ValidationBypassesComponent(connector, {} as any);
  });
  afterEach(() => {
    page.ngOnDestroy();
    vi.useRealTimers();
  });
  it('polls pending work at 30 seconds, pauses hidden and cleans up on destroy', () => {
    page.ngOnInit();
    const initial = connector.getValidationReconciliation.mock.calls.length;
    vi.advanceTimersByTime(30000);
    expect(connector.getValidationReconciliation.mock.calls.length).toBe(
      initial + 1
    );
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(60000);
    expect(connector.getValidationReconciliation.mock.calls.length).toBe(
      initial + 1
    );
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(connector.getValidationReconciliation.mock.calls.length).toBe(
      initial + 2
    );
    page.ngOnDestroy();
    vi.advanceTimersByTime(60000);
    expect(connector.getValidationReconciliation.mock.calls.length).toBe(
      initial + 2
    );
    vi.restoreAllMocks();
  });
  it('retries failed work and refreshes status without indefinite loading', () => {
    page.retryReconciliation();
    expect(connector.retryValidationReconciliation).toHaveBeenCalledOnce();
    expect(connector.getValidationReconciliation).toHaveBeenCalledOnce();
    expect(page.retrying).toBe(false);
  });
  it('searches exemption name, category and friendly scope while retaining server IDs', () => {
    page.ngOnInit();
    const exemption: ValidationBypassRule = {
      _id: 'stable',
      kind: 'object-exemption',
      name: 'Old tactics',
      enabled: false,
      retirementStatus: 'revoked',
      stixTypes: ['x-mitre-tactic'],
    };
    expect(page.dataSource.filterPredicate(exemption, 'old tactics')).toBe(
      true
    );
    expect(page.dataSource.filterPredicate(exemption, 'revoked')).toBe(true);
    expect(page.scope(exemption)).toBe('tactic');
    expect(page.behavior(exemption)).toBe('disabled');
    expect(page.ruleId(exemption)).toBe('stable');
  });
  it('shows API errors and conflicts and cancels stale status requests', () => {
    connector.getValidationBypassRules.mockReturnValue(
      throwError(() => ({
        status: 409,
        error: { message: 'Rule selector already exists.' },
      }))
    );
    page.loadRules();
    expect(page.apiError).toContain('Reload');
    expect(page.apiError).toContain('Rule selector already exists.');
    expect(page.loadingRules).toBe(false);
    const previous = new Subject();
    const current = new Subject();
    connector.getValidationReconciliation
      .mockReturnValueOnce(previous)
      .mockReturnValueOnce(current);
    page.refreshStatus();
    page.refreshStatus();
    previous.next({ ...status, policy_revision: 100 });
    expect(page.reconciliation).toBeUndefined();
    current.next({ ...status, status: 'failed' });
    expect(page.reconciliation.status).toBe('failed');
    page.ngOnDestroy();
    expect(current.observed).toBe(false);
  });
  it('keeps loading state accurate when a reload cancels a previous request', () => {
    const old = new Subject();
    const current = new Subject();
    connector.getValidationBypassRules
      .mockReturnValueOnce(old)
      .mockReturnValueOnce(current);
    page.loadRules();
    page.loadRules();
    expect(old.observed).toBe(false);
    expect(page.loadingRules).toBe(true);
    current.next([]);
    expect(page.loadingRules).toBe(false);
  });
  it.each(['create', 'edit'])(
    'keeps the %s rule Save subscribed after 45 seconds of editing',
    action => {
      const closed = new Subject<ValidationBypassRule>();
      const rule: ValidationBypassRule = {
        _id: 'stable-rule',
        kind: 'object-exemption',
        name: 'Retired',
        enabled: true,
        retirementStatus: 'revoked',
        stixTypes: 'all',
      };
      connector.postValidationBypassRule = vi.fn(() => of(rule));
      connector.putValidationBypassRule = vi.fn(() => of(rule));
      page = new ValidationBypassesComponent(connector, {
        open: () => ({ afterClosed: () => closed }),
      } as any);
      if (action === 'create') page.createRule();
      else page.editRule(rule);
      vi.advanceTimersByTime(45000);
      expect(closed.observed).toBe(true);
      closed.next(rule);
      if (action === 'create')
        expect(connector.postValidationBypassRule).toHaveBeenCalledWith(rule);
      else
        expect(connector.putValidationBypassRule).toHaveBeenCalledWith(
          'stable-rule',
          rule
        );
    }
  );
  it('keeps delete confirmation subscribed after 45 seconds of reading', () => {
    const closed = new Subject<boolean>();
    connector.deleteValidationBypassRule = vi.fn(() => of({}));
    page = new ValidationBypassesComponent(connector, {
      open: () => ({ afterClosed: () => closed }),
    } as any);
    page.deleteRule({ _id: 'stable-rule' } as ValidationBypassRule);
    vi.advanceTimersByTime(45000);
    expect(closed.observed).toBe(true);
    closed.next(true);
    expect(connector.deleteValidationBypassRule).toHaveBeenCalledWith(
      'stable-rule'
    );
  });
});
