import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { NotesEditorComponent } from './notes-editor.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createMockRestApiConnector,
  createAsyncObservable,
  createPaginatedResponse,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('NotesEditorComponent', () => {
  let component: NotesEditorComponent;
  let fixture: ComponentFixture<NotesEditorComponent>;
  let mockRestApiConnector: any;
  let mockRouter: any;

  beforeEach(async () => {
    mockRestApiConnector = createMockRestApiConnector({
      getAllNotes: vi.fn(() =>
        createAsyncObservable(createPaginatedResponse())
      ),
    });
    mockRouter = {
      url: '/test/mock-id?param=value',
    };

    await TestBed.configureTestingModule({
      declarations: [NotesEditorComponent],
      providers: [
        provideHttpClient(),
        {
          provide: Router,
          useValue: mockRouter,
        },
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NotesEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not load notes when there is no object STIX ID in the URL', () => {
    mockRouter.url = '/dashboard/release-management';
    mockRestApiConnector.getAllNotes.mockClear();

    const dashboardFixture = TestBed.createComponent(NotesEditorComponent);
    const dashboardComponent = dashboardFixture.componentInstance;
    dashboardFixture.detectChanges();

    expect(dashboardComponent.objectStixID).toBe('');
    expect(mockRestApiConnector.getAllNotes).not.toHaveBeenCalled();
  });
});
