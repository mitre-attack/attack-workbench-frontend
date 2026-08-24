import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { DatepickerPropertyComponent } from './datepicker-property.component';

describe('DatepickerPropertyComponent', () => {
  let component: DatepickerPropertyComponent;
  let fixture: ComponentFixture<DatepickerPropertyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DatepickerPropertyComponent],
      providers: [provideHttpClient()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DatepickerPropertyComponent);
    component = fixture.componentInstance;
    // Set required config input
    component.config = {
      object: {} as any,
      field: 'date',
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
