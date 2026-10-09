import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { UsersListComponent } from './users-list.component';
import { Role } from 'src/app/classes/authn/role';
import { Status } from 'src/app/classes/authn/status';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { AuthenticationService } from 'src/app/services/connectors/authentication/authentication.service';
import {
  createMockRestApiConnector,
  createAsyncObservable,
  createPaginatedResponse,
} from 'src/app/testing/mocks/rest-api-connector.mock';
import {
  createMockAuthenticationService,
  createMockUserAccount,
} from 'src/app/testing/mocks/authentication-service.mock';
import { UserAccountEventsService } from 'src/app/services/user-account-events/user-account-events.service';

describe('UsersListComponent', () => {
  let component: UsersListComponent;
  let fixture: ComponentFixture<UsersListComponent>;
  let mockRestApiConnector: any;
  let userAccountEvents: UserAccountEventsService;

  beforeEach(async () => {
    mockRestApiConnector = createMockRestApiConnector({
      getAllUserAccounts: () =>
        createAsyncObservable(createPaginatedResponse()),
      getTeamsByUserId: () => createAsyncObservable([]),
      putUserAccount: vi.fn(user => createAsyncObservable(user)),
    });
    const mockAuthService = createMockAuthenticationService({});

    await TestBed.configureTestingModule({
      declarations: [UsersListComponent],
      providers: [
        provideHttpClient(),
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
        { provide: AuthenticationService, useValue: mockAuthService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UsersListComponent);
    component = fixture.componentInstance;
    userAccountEvents = TestBed.inject(UserAccountEventsService);
    component.config = {
      mode: 'view',
      columnsToDisplay: [],
      team: null,
      showSearch: false,
      showFilters: false,
      selection: null,
    } as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should notify listeners after user role updates complete', async () => {
    const notifySpy = vi.spyOn(userAccountEvents, 'notifyUserAccountsChanged');
    const pendingUser = createMockUserAccount({
      status: Status.PENDING,
      role: Role.NONE,
    }).serialize();

    component.updateUserRole(pendingUser, Role.ADMIN);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockRestApiConnector.putUserAccount).toHaveBeenCalled();
    expect(notifySpy).toHaveBeenCalled();
  });
});
