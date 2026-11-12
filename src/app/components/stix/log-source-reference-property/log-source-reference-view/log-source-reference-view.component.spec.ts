import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { LogSourceReferenceViewComponent } from './log-source-reference-view.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { createMockRestApiConnector } from 'src/app/testing/mocks/rest-api-connector.mock';

describe('LogSourceReferenceViewComponent', () => {
  let component: LogSourceReferenceViewComponent;
  let fixture: ComponentFixture<LogSourceReferenceViewComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({});

    await TestBed.configureTestingModule({
      declarations: [LogSourceReferenceViewComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LogSourceReferenceViewComponent);
    component = fixture.componentInstance;
    component.config = {
      mode: 'view',
      object: { logSourceReferences: [] } as any,
      field: 'logSourceReferences',
    } as any;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
