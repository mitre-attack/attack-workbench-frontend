import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { AnalyticViewComponent } from './analytic-view.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createMockRestApiConnector,
  createAsyncObservable,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('AnalyticViewComponent', () => {
  let component: AnalyticViewComponent;
  let fixture: ComponentFixture<AnalyticViewComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({
      getDefaultMarkingDefinitions: () => createAsyncObservable([]),
      getNextAttackId: () => createAsyncObservable('ANA-0001'),
    });

    await TestBed.configureTestingModule({
      declarations: [AnalyticViewComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideHttpClient(),
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticViewComponent);
    component = fixture.componentInstance;
    component.config = { mode: 'view', object: {} as any };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
