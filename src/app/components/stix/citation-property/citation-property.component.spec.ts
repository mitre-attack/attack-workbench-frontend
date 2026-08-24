import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CitationPropertyComponent } from './citation-property.component';

describe('CitationPropertyComponent', () => {
  let component: CitationPropertyComponent;
  let fixture: ComponentFixture<CitationPropertyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CitationPropertyComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CitationPropertyComponent);
    component = fixture.componentInstance;
    component.config = {
      mode: 'view',
      object: {} as any,
      field: 'description',
      referencesField: 'external_references',
      label: 'Description',
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
