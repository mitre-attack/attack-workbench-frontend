import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimestampPropertyComponent } from './timestamp-property.component';
import { StixObject } from 'src/app/classes/stix/stix-object';

describe('TimestampPropertyComponent', () => {
  let component: TimestampPropertyComponent;
  let fixture: ComponentFixture<TimestampPropertyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TimestampPropertyComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TimestampPropertyComponent);
    component = fixture.componentInstance;
    // Set required config input
    component.config = {
      mode: 'view',
      object: {} as StixObject,
      field: 'created',
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
