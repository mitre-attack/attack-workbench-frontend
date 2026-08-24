import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StixObject } from 'src/app/classes/stix/stix-object';

import { TlpPropertyComponent } from './tlp-property.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createMockRestApiConnector,
  createAsyncObservable,
  createPaginatedResponse,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('TlpPropertyComponent', () => {
  let component: TlpPropertyComponent;
  let fixture: ComponentFixture<TlpPropertyComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({
      getAllMarkingDefinitions: () =>
        createAsyncObservable(createPaginatedResponse([])),
    });

    await TestBed.configureTestingModule({
      declarations: [TlpPropertyComponent],
      providers: [
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TlpPropertyComponent);
    component = fixture.componentInstance;
    component.config = {
      mode: 'view',
      object: { stixID: 'test-stix-id' } as StixObject,
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
