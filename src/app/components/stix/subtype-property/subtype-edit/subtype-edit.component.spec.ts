import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { SubtypeEditComponent } from './subtype-edit.component';

describe('SubtypeEditComponent', () => {
  let component: SubtypeEditComponent;
  let fixture: ComponentFixture<SubtypeEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SubtypeEditComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SubtypeEditComponent);
    component = fixture.componentInstance;
    component.config = {
      mode: 'edit',
      object: {},
      field: 'x_mitre_platforms',
      subtypeFields: [{ key: 'name' }],
    };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
