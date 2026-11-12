import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PropertyDiffComponent } from './property-diff.component';

describe('PropertyDiffComponent', () => {
  let component: PropertyDiffComponent;
  let fixture: ComponentFixture<PropertyDiffComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PropertyDiffComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PropertyDiffComponent);
    component = fixture.componentInstance;

    // Initialize required inputs to prevent null errors
    component.before = 'old value';
    component.after = 'new value';

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
