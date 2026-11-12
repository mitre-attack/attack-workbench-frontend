import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OutdatedContentWarningComponent } from './outdated-content-warning.component';

describe('OutdatedContentWarningComponent', () => {
  let component: OutdatedContentWarningComponent;
  let fixture: ComponentFixture<OutdatedContentWarningComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OutdatedContentWarningComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(OutdatedContentWarningComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
