import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExternalReferencesPropertyComponent } from './external-references-property.component';

describe('ExternalReferencesPropertyComponent', () => {
  let component: ExternalReferencesPropertyComponent;
  let fixture: ComponentFixture<ExternalReferencesPropertyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ExternalReferencesPropertyComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ExternalReferencesPropertyComponent);
    component = fixture.componentInstance;
    component.config = {
      mode: 'view',
      object: {} as any,
      referencesField: 'external_references',
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
