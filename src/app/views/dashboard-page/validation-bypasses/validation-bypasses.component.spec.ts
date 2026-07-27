import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

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
