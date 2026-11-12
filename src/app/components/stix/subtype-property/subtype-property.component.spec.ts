import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubtypePropertyComponent } from './subtype-property.component';
import { StixObject } from 'src/app/classes/stix';

describe('SubtypePropertyComponent', () => {
  let component: SubtypePropertyComponent;
  let fixture: ComponentFixture<SubtypePropertyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SubtypePropertyComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SubtypePropertyComponent);
    component = fixture.componentInstance;
    // Set required config input
    component.config = {
      mode: 'view',
      object: {} as StixObject,
      field: 'test',
      label: 'Test',
      subtypeFields: [],
      tooltip: 'Test tooltip',
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
