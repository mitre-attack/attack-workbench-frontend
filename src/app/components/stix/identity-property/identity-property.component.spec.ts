import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { IdentityPropertyComponent } from './identity-property.component';
import { UserAvatarComponent } from '../../user-avatar/user-avatar.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createMockRestApiConnector,
  createAsyncObservable,
  createPaginatedResponse,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('IdentityPropertyComponent', () => {
  let component: IdentityPropertyComponent;
  let fixture: ComponentFixture<IdentityPropertyComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({
      getAllIdentities: () => createAsyncObservable(createPaginatedResponse()),
    });

    await TestBed.configureTestingModule({
      declarations: [IdentityPropertyComponent],
      imports: [UserAvatarComponent],
      providers: [
        provideHttpClient(),
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(IdentityPropertyComponent);
    component = fixture.componentInstance;
    // Set required config input
    component.config = {
      object: {} as any,
      field: 'identity',
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
