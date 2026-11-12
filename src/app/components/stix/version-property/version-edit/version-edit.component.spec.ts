import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { VersionEditComponent } from './version-edit.component';

describe('VersionEditComponent', () => {
  let component: VersionEditComponent;
  let fixture: ComponentFixture<VersionEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VersionEditComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VersionEditComponent);
    component = fixture.componentInstance;
    component.config = {
      mode: 'edit',
      object: {} as any,
      field: 'x_mitre_version',
    };
    component.config.object[component.field] = { version: '1.0' };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
