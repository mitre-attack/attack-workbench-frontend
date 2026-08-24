import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { DescriptiveDiffComponent } from './descriptive-diff.component';

describe('DescriptiveDiffComponent', () => {
  let component: DescriptiveDiffComponent;
  let fixture: ComponentFixture<DescriptiveDiffComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DescriptiveDiffComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DescriptiveDiffComponent);
    component = fixture.componentInstance;
    component.config = {
      mode: 'diff',
      object: [{} as any, {} as any],
      field: 'description',
    };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
