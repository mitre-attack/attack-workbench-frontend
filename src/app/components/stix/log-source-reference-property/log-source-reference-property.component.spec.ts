import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LogSourceReferencePropertyComponent } from './log-source-reference-property.component';

describe('LogSourceReferencePropertyComponent', () => {
  let component: LogSourceReferencePropertyComponent;
  let fixture: ComponentFixture<LogSourceReferencePropertyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LogSourceReferencePropertyComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(LogSourceReferencePropertyComponent);
    component = fixture.componentInstance;
    component.config = {
      mode: 'view',
      object: {} as any,
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
