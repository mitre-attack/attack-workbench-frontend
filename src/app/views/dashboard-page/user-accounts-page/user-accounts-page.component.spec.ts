import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { UserAccountsPageComponent } from './user-accounts-page.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createMockRestApiConnector,
  createAsyncObservable,
  createPaginatedResponse,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('UserAccountsPageComponent', () => {
  let component: UserAccountsPageComponent;
  let fixture: ComponentFixture<UserAccountsPageComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({
      getAllUserAccounts: () =>
        createAsyncObservable(createPaginatedResponse()),
      getAllTeams: () => createAsyncObservable(createPaginatedResponse()),
    });

    await TestBed.configureTestingModule({
      declarations: [UserAccountsPageComponent],
      providers: [
        provideHttpClient(),
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UserAccountsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
