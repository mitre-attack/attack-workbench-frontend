import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { CitationViewComponent } from './citation-view.component';

describe('CitationViewComponent', () => {
  let component: CitationViewComponent;
  let fixture: ComponentFixture<CitationViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CitationViewComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [provideHttpClient()],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CitationViewComponent);
    component = fixture.componentInstance;
    component.config = {
      mode: 'view',
      object: {} as any,
      field: 'external_references',
      referencesField: 'external_references',
      label: 'External References',
    };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
