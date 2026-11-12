import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LogSourceReferenceEditComponent } from './log-source-reference-edit.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createAsyncObservable,
  createMockRestApiConnector,
  createPaginatedResponse,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('LogSourceReferenceEditComponent', () => {
  let component: LogSourceReferenceEditComponent;
  let fixture: ComponentFixture<LogSourceReferenceEditComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({
      getAllDataComponents: () =>
        createAsyncObservable(createPaginatedResponse([])),
    });

    await TestBed.configureTestingModule({
      declarations: [LogSourceReferenceEditComponent],
      providers: [
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(LogSourceReferenceEditComponent);
    component = fixture.componentInstance;
    component.config = {
      mode: 'edit',
      object: { logSourceReferences: [] } as any,
      field: 'logSourceReferences',
    } as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
