import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { StixListComponent, StixListConfig } from './stix-list.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { AuthenticationService } from 'src/app/services/connectors/authentication/authentication.service';

describe('StixListComponent', () => {
  let component: StixListComponent;
  let fixture: ComponentFixture<StixListComponent>;

  const defaultConfig: StixListConfig = {
    type: 'technique',
  };

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [StixListComponent],
      imports: [NoopAnimationsModule],
      providers: [
        {
          provide: RestApiConnectorService,
          useValue: {
            getAllAllowedValues: vi.fn(() => of([])),
            getAllObjects: vi.fn(() =>
              of({ data: [], pagination: { total: 0, limit: 0, offset: 0 } })
            ),
            getAllTechniques: vi.fn(() =>
              of({ data: [], pagination: { total: 0, limit: 0, offset: 0 } })
            ),
          },
        },
        {
          provide: AuthenticationService,
          useValue: {
            canEdit: vi.fn(() => true),
          },
        },
        {
          provide: MatDialog,
          useValue: {
            open: vi.fn(),
          },
        },
        {
          provide: Router,
          useValue: {
            navigate: vi.fn(),
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(StixListComponent);
    component = fixture.componentInstance;
    component.config = { ...defaultConfig };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should order all objects columns as ID, Name, Type, Domain, Modified', () => {
    component.config = { columnsPreset: 'all-objects' };
    component.tableColumns = [];
    component.tableColumns_settings = new Map<string, any>();

    (component as any).buildTable();

    expect(component.tableColumns).toEqual([
      'attackID',
      'name',
      'attackType',
      'domains',
      'modified',
    ]);
  });

  it('should not show the workflow status column for STIX object lists', () => {
    const types: StixListConfig['type'][] = [
      'asset',
      'campaign',
      'data-component',
      'data-source',
      'detection-strategy',
      'group',
      'matrix',
      'mitigation',
      'software',
      'tactic',
      'technique',
    ];

    types.forEach(type => {
      component.config = { type };
      component.tableColumns = [];
      component.tableColumns_settings = new Map<string, any>();

      (component as any).buildTable();

      expect(component.tableColumns).not.toContain('workflow');
      expect(component.tableColumns).toContain('state');
    });
  });
  it('should ignore objects without domains when filtering local objects by domain', () => {
    const domainlessObject = {
      stixID: 'campaign--1',
      name: 'Operation Triangulation',
    };
    const domainObject = {
      stixID: 'attack-pattern--1',
      name: 'Technique',
      domains: ['enterprise-attack'],
    };

    const result = (component as any).filterLocalObjects(
      [domainlessObject, domainObject],
      {
        deprecated: false,
        revoked: false,
        state: undefined,
        platforms: [],
        domains: ['enterprise-attack'],
        exclusiveDeprecated: false,
        exclusiveRevoked: false,
      }
    );

    expect(result).toEqual([domainObject]);
  });
});
