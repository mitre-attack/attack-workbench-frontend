import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VersionViewComponent } from './version-view.component';
import { Technique } from 'src/app/classes/stix/technique';
import { VersionNumber } from 'src/app/classes/version-number';

describe('VersionViewComponent', () => {
  let component: VersionViewComponent;
  let fixture: ComponentFixture<VersionViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VersionViewComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VersionViewComponent);
    component = fixture.componentInstance;

    // Initialize the required config input with a mock
    const mockObject = new Technique();
    mockObject.version = new VersionNumber('1.0');
    component.config = {
      object: mockObject,
      mode: 'view',
    };

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
