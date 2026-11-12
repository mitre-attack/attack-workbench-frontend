import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { OrgSettingsPageComponent } from './org-settings-page.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createMockRestApiConnector,
  createAsyncObservable,
  createPaginatedResponse,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('OrgSettingsPageComponent', () => {
  let component: OrgSettingsPageComponent;
  let fixture: ComponentFixture<OrgSettingsPageComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({
      getOrganizationIdentity: () => createAsyncObservable({}),
      getAllIdentities: () => createAsyncObservable(createPaginatedResponse()),
      getOrganizationNamespace: () =>
        createAsyncObservable({ prefix: '', range_start: undefined }),
    });

    await TestBed.configureTestingModule({
      declarations: [OrgSettingsPageComponent],
      providers: [
        provideHttpClient(),
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(OrgSettingsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
