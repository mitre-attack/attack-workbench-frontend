import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { MtxPopoverModule } from '@ng-matero/extensions/popover';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { ContributorsPageComponent } from './contributors-page.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createMockRestApiConnector,
  createAsyncObservable,
  createPaginatedResponse,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('ContributorsPageComponent', () => {
  let component: ContributorsPageComponent;
  let fixture: ComponentFixture<ContributorsPageComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({
      getAllObjects: () => createAsyncObservable(createPaginatedResponse()),
    });

    await TestBed.configureTestingModule({
      declarations: [ContributorsPageComponent],
      imports: [MtxPopoverModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideHttpClient(),
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContributorsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
