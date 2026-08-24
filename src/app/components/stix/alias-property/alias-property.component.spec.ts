import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AliasPropertyComponent } from './alias-property.component';
import { StixObject } from 'src/app/classes/stix/stix-object';

describe('AliasPropertyComponent', () => {
  let component: AliasPropertyComponent;
  let fixture: ComponentFixture<AliasPropertyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AliasPropertyComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AliasPropertyComponent);
    component = fixture.componentInstance;
    // Set required config input
    component.config = {
      mode: 'view',
      object: {} as StixObject,
      field: 'aliases',
      label: 'Aliases',
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
