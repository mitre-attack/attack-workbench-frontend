import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AttackIDPropertyComponent } from './attackid-property.component';

describe('AttackIDPropertyComponent', () => {
  let component: AttackIDPropertyComponent;
  let fixture: ComponentFixture<AttackIDPropertyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AttackIDPropertyComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AttackIDPropertyComponent);
    component = fixture.componentInstance;
    // Set required config input
    component.config = {
      mode: 'view',
      object: {} as any,
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
