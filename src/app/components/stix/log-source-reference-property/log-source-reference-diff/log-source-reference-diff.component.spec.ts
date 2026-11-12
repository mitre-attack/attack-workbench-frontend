import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { LogSourceReferenceDiffComponent } from './log-source-reference-diff.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { createMockRestApiConnector } from 'src/app/testing/mocks/rest-api-connector.mock';

describe('LogSourceReferenceDiffComponent', () => {
  let component: LogSourceReferenceDiffComponent;
  let fixture: ComponentFixture<LogSourceReferenceDiffComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({});

    await TestBed.configureTestingModule({
      declarations: [LogSourceReferenceDiffComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LogSourceReferenceDiffComponent);
    component = fixture.componentInstance;
    component.config = {
      mode: 'diff',
      object: [
        { logSourceReferences: [] } as any,
        { logSourceReferences: [] } as any,
      ],
      field: 'logSourceReferences',
    } as any;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
