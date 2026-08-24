import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BooleanPropertyComponent } from './boolean-property.component';
import { StixObject } from 'src/app/classes/stix';

describe('BooleanPropertyComponent', () => {
  let component: BooleanPropertyComponent;
  let fixture: ComponentFixture<BooleanPropertyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BooleanPropertyComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(BooleanPropertyComponent);
    component = fixture.componentInstance;
    // Set required config input
    component.config = {
      mode: 'view',
      object: {} as StixObject,
      field: 'test',
      label: 'Test',
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
