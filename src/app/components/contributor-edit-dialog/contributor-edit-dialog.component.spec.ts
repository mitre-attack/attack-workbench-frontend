import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { provideHttpClient } from '@angular/common/http';

import { ContributorEditDialogComponent } from './contributor-edit-dialog.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { createMockRestApiConnector } from 'src/app/testing/mocks/rest-api-connector.mock';

describe('ContributorEditDialogComponent', () => {
  let component: ContributorEditDialogComponent;
  let fixture: ComponentFixture<ContributorEditDialogComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({});

    await TestBed.configureTestingModule({
      declarations: [ContributorEditDialogComponent],
      providers: [
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
        { provide: MatDialogRef, useValue: {} },
        { provide: MAT_DIALOG_DATA, useValue: {} },
        provideHttpClient(),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ContributorEditDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
