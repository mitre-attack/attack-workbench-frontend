import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { AliasDiffComponent } from './alias-diff.component';

describe('AliasDiffComponent', () => {
  let component: AliasDiffComponent;
  let fixture: ComponentFixture<AliasDiffComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AliasDiffComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AliasDiffComponent);
    component = fixture.componentInstance;
    component.config = { mode: 'view', object: [{}, {}] as any };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
