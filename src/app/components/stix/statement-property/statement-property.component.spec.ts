import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatementPropertyComponent } from './statement-property.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createMockRestApiConnector,
  createAsyncObservable,
  createPaginatedResponse,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('StatementPropertyComponent', () => {
  let component: StatementPropertyComponent;
  let fixture: ComponentFixture<StatementPropertyComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({
      getAllMarkingDefinitions: () =>
        createAsyncObservable(createPaginatedResponse([])),
    });

    await TestBed.configureTestingModule({
      declarations: [StatementPropertyComponent],
      providers: [
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StatementPropertyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
