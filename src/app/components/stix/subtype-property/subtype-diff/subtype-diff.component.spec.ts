import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { SubtypeDiffComponent } from './subtype-diff.component';

describe('SubtypeDiffComponent', () => {
  let component: SubtypeDiffComponent;
  let fixture: ComponentFixture<SubtypeDiffComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SubtypeDiffComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SubtypeDiffComponent);
    component = fixture.componentInstance;
    component.config = {
      mode: 'diff',
      object: [{}, {}],
      field: 'x_mitre_attack_spec_version',
    };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
