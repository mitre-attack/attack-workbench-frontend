import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CitationDiffComponent } from './citation-diff.component';
import { StixObject } from 'src/app/classes/stix/stix-object';

describe('CitationDiffComponent', () => {
  let component: CitationDiffComponent;
  let fixture: ComponentFixture<CitationDiffComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CitationDiffComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CitationDiffComponent);
    component = fixture.componentInstance;
    // Set required config input
    component.config = {
      mode: 'diff',
      object: [{} as StixObject, {} as StixObject],
      field: 'test',
      referencesField: 'external_references',
      label: 'Test',
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
