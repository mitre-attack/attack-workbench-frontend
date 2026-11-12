import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmptyListMarkerComponent } from './empty-list-marker.component';

describe('EmptyListMarkerComponent', () => {
  let component: EmptyListMarkerComponent;
  let fixture: ComponentFixture<EmptyListMarkerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EmptyListMarkerComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EmptyListMarkerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
