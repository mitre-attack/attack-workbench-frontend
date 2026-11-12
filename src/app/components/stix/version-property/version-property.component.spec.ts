import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { VersionPropertyComponent } from './version-property.component';
import { StixObject } from 'src/app/classes/stix/stix-object';

describe('VersionPropertyComponent', () => {
  let component: VersionPropertyComponent;
  let fixture: ComponentFixture<VersionPropertyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VersionPropertyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [provideHttpClient()],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VersionPropertyComponent);
    component = fixture.componentInstance;
    // Set required config input
    component.config = {
      mode: 'view',
      object: {} as StixObject,
    };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
