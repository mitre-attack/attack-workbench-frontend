import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { ExternalReferencesDiffComponent } from './external-references-diff.component';

describe('ExternalReferencesDiffComponent', () => {
  let component: ExternalReferencesDiffComponent;
  let fixture: ComponentFixture<ExternalReferencesDiffComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ExternalReferencesDiffComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ExternalReferencesDiffComponent);
    component = fixture.componentInstance;
    component.config = {
      mode: 'diff',
      object: [
        { external_references: [] } as any,
        { external_references: [] } as any,
      ],
      referencesField: 'external_references',
    };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
