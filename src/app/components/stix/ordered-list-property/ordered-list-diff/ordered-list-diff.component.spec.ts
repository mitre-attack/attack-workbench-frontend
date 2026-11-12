import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrderedListDiffComponent } from './ordered-list-diff.component';

describe('OrderedListDiffComponent', () => {
  let component: OrderedListDiffComponent;
  let fixture: ComponentFixture<OrderedListDiffComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OrderedListDiffComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderedListDiffComponent);
    component = fixture.componentInstance;
    // Set required config input
    component.config = {
      mode: 'diff',
      object: [{}, {}] as any,
      objectOrderedListField: 'test',
      field: 'test',
      globalObjects: [],
      label: 'Test',
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
