import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';

import { HeaderComponent } from './header.component';
import { UserAvatarComponent } from '../user-avatar/user-avatar.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { AuthenticationService } from 'src/app/services/connectors/authentication/authentication.service';
import { createMockRestApiConnector } from 'src/app/testing/mocks/rest-api-connector.mock';
import {
  createMockAuthenticationService,
  createMockUserAccount,
} from 'src/app/testing/mocks/authentication-service.mock';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(waitForAsync(() => {
    const mockRestApiConnector = createMockRestApiConnector({});
    const mockAuthService = createMockAuthenticationService({
      currentUser: createMockUserAccount(),
      isLoggedIn: true,
    });

    TestBed.configureTestingModule({
      declarations: [HeaderComponent],
      imports: [
        UserAvatarComponent,
        MatToolbarModule,
        MatMenuModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
        { provide: AuthenticationService, useValue: mockAuthService },
        provideRouter([]),
        provideHttpClient(),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the current user display name in the account trigger', () => {
    const accountButton = fixture.debugElement.query(By.css('button.account'));

    expect(accountButton.nativeElement.textContent).toContain('Test User');
  });
});
