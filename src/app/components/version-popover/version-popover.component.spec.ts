import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MtxPopoverModule } from '@ng-matero/extensions/popover';

import { VersionPopoverComponent } from './version-popover.component';
import { StixObject } from 'src/app/classes/stix/stix-object';

describe('VersionPopoverComponent', () => {
  let component: VersionPopoverComponent;
  let fixture: ComponentFixture<VersionPopoverComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VersionPopoverComponent],
      imports: [MtxPopoverModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VersionPopoverComponent);
    component = fixture.componentInstance;
    // Set required config input
    component.config = {
      object: {} as StixObject,
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
