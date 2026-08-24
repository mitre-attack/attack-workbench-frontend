import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IconViewComponent } from './icon-view.component';

describe('WorkflowPropertyComponent', () => {
  let component: IconViewComponent;
  let fixture: ComponentFixture<IconViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [IconViewComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(IconViewComponent);
    component = fixture.componentInstance;
    // Set required config input
    component.config = {
      field: 'test',
      object: {} as any,
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
