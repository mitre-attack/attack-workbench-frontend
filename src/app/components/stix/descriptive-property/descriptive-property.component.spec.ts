import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DescriptivePropertyComponent } from './descriptive-property.component';

describe('DescriptivePropertyComponent', () => {
  let component: DescriptivePropertyComponent;
  let fixture: ComponentFixture<DescriptivePropertyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DescriptivePropertyComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DescriptivePropertyComponent);
    component = fixture.componentInstance;
    component.config = {
      mode: 'view',
      object: {} as any,
      field: 'description',
      label: 'Description',
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
