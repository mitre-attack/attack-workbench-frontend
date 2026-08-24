import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrderedListPropertyComponent } from './ordered-list-property.component';

describe('OrderedListPropertyComponent', () => {
  let component: OrderedListPropertyComponent;
  let fixture: ComponentFixture<OrderedListPropertyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OrderedListPropertyComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(OrderedListPropertyComponent);
    component = fixture.componentInstance;
    component.config = {
      mode: 'view',
      field: 'name',
      object: {} as any,
      objectOrderedListField: 'items',
      globalObjects: [],
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
