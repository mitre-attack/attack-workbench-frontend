import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { ReferenceSidebarComponent } from './reference-sidebar.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createAsyncObservable,
  createMockRestApiConnector,
  createPaginatedResponse,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('ReferenceManagerComponent', () => {
  let component: ReferenceSidebarComponent;
  let fixture: ComponentFixture<ReferenceSidebarComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({
      getAllReferences: () =>
        createAsyncObservable(createPaginatedResponse([])),
    });

    await TestBed.configureTestingModule({
      declarations: [ReferenceSidebarComponent],
      providers: [
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
        provideHttpClient(),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ReferenceSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
