import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TlpViewComponent } from './tlp-view.component';

describe('TlpViewComponent', () => {
  let component: TlpViewComponent;
  let fixture: ComponentFixture<TlpViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TlpViewComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TlpViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
