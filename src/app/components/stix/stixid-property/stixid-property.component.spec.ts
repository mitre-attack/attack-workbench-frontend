import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { StixObject } from 'src/app/classes/stix/stix-object';

import { StixIDPropertyComponent } from './stixid-property.component';

describe('StixidPropertyComponent', () => {
  let component: StixIDPropertyComponent;
  let fixture: ComponentFixture<StixIDPropertyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StixIDPropertyComponent],
      imports: [MatSnackBarModule, MatIconModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StixIDPropertyComponent);
    component = fixture.componentInstance;
    component.config = {
      mode: 'view',
      object: { stixID: 'test-stix-id' } as StixObject,
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
