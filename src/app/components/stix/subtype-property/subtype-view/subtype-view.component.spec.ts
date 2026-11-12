import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubtypeViewComponent } from './subtype-view.component';

describe('SubtypeViewComponent', () => {
  let component: SubtypeViewComponent;
  let fixture: ComponentFixture<SubtypeViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SubtypeViewComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SubtypeViewComponent);
    component = fixture.componentInstance;
    // Set required config input
    component.config = {
      mode: 'view',
      object: { test: {} } as any,
      field: 'test',
      label: 'Test',
      subtypeFields: [],
      tooltip: 'Test',
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
