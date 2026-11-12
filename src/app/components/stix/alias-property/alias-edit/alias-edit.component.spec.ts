import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { AliasEditComponent } from './alias-edit.component';

describe('AliasEditComponent', () => {
  let component: AliasEditComponent;
  let fixture: ComponentFixture<AliasEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AliasEditComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AliasEditComponent);
    component = fixture.componentInstance;
    component.config = { mode: 'edit', object: {} as any };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
