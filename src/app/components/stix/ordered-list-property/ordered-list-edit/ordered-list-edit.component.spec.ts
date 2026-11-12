import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { OrderedListEditComponent } from './ordered-list-edit.component';

describe('OrderedListEditComponent', () => {
  let component: OrderedListEditComponent;
  let fixture: ComponentFixture<OrderedListEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OrderedListEditComponent],
      imports: [DragDropModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [provideHttpClient()],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(OrderedListEditComponent);
    component = fixture.componentInstance;
    component.config = {
      mode: 'edit',
      object: {} as any,
      field: 'x_mitre_contributors',
      objectOrderedListField: 'x_mitre_contributors',
      globalObjects: [],
    };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
