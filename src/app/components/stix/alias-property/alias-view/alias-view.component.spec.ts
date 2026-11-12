import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { AliasViewComponent } from './alias-view.component';

describe('AliasViewComponent', () => {
  let component: AliasViewComponent;
  let fixture: ComponentFixture<AliasViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AliasViewComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AliasViewComponent);
    component = fixture.componentInstance;
    component.config = { mode: 'view', field: 'name', object: {} as any };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
