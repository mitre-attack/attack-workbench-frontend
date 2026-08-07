import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { AuthenticationService } from 'src/app/services/connectors/authentication/authentication.service';
import {
  createMockAuthenticationService,
  createMockUserAccount,
} from 'src/app/testing/mocks/authentication-service.mock';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createAsyncObservable,
  createMockRestApiConnector,
} from 'src/app/testing/mocks/rest-api-connector.mock';

import { ProfilePageComponent } from './profile-page.component';
import { UserAvatarComponent } from '../../components/user-avatar/user-avatar.component';

describe('ProfilePageComponent', () => {
  let component: ProfilePageComponent;
  let fixture: ComponentFixture<ProfilePageComponent>;

  beforeEach(async () => {
    const mockAuthService = createMockAuthenticationService({
      currentUser: createMockUserAccount({
        id: 'mock-user-id',
        username: 'testuser',
        email: 'test@example.com',
      }),
      canEdit: () => false,
    });
    const mockRestApiConnector = createMockRestApiConnector({
      getTeamsByUserId: () => createAsyncObservable([]),
    });

    await TestBed.configureTestingModule({
      declarations: [ProfilePageComponent],
      imports: [UserAvatarComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideHttpClient(),
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({}),
            queryParams: of({}),
          },
        },
        {
          provide: AuthenticationService,
          useValue: mockAuthService,
        },
        {
          provide: RestApiConnectorService,
          useValue: mockRestApiConnector,
        },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ProfilePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
