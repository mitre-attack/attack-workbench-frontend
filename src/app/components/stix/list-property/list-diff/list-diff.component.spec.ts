import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { ListDiffComponent } from './list-diff.component';

describe('ListDiffComponent', () => {
  let component: ListDiffComponent;
  let fixture: ComponentFixture<ListDiffComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ListDiffComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ListDiffComponent);
    component = fixture.componentInstance;
    component.config = {
      mode: 'diff',
      object: [{} as any, {} as any],
      field: 'platforms',
    } as any;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
