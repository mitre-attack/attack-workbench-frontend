import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { MarkingDefinitionViewComponent } from './marking-definition-view.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { createMockRestApiConnector } from 'src/app/testing/mocks/rest-api-connector.mock';

describe('MarkingDefinitionViewComponent', () => {
  let component: MarkingDefinitionViewComponent;
  let fixture: ComponentFixture<MarkingDefinitionViewComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({});

    await TestBed.configureTestingModule({
      declarations: [MarkingDefinitionViewComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideHttpClient(),
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MarkingDefinitionViewComponent);
    component = fixture.componentInstance;
    component.config = { mode: 'view', object: {} as any };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
