import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { TechniqueViewComponent } from './technique-view.component';
import { AuthenticationService } from 'src/app/services/connectors/authentication/authentication.service';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createMockRestApiConnector,
  createAsyncObservable,
  createPaginatedResponse,
} from 'src/app/testing/mocks/rest-api-connector.mock';
import { createMockAuthenticationService } from 'src/app/testing/mocks/authentication-service.mock';
import { Role } from 'src/app/classes/authn/role';

describe('TechniqueViewComponent', () => {
  let component: TechniqueViewComponent;
  let fixture: ComponentFixture<TechniqueViewComponent>;

  beforeEach(waitForAsync(() => {
    const mockAuthService = createMockAuthenticationService({
      isAuthorized: () => true,
    });
    const mockRestApiService = createMockRestApiConnector({
      getAllMarkingDefinitions: () =>
        createAsyncObservable(createPaginatedResponse()),
    });

    TestBed.configureTestingModule({
      declarations: [TechniqueViewComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideHttpClient(),
        { provide: AuthenticationService, useValue: mockAuthService },
        { provide: RestApiConnectorService, useValue: mockRestApiService },
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TechniqueViewComponent);
    component = fixture.componentInstance;
    component.config = { mode: 'view', object: {} as any };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
