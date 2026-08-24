import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TlpDiffComponent } from './tlp-diff.component';

describe('TlpDiffComponent', () => {
  let component: TlpDiffComponent;
  let fixture: ComponentFixture<TlpDiffComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TlpDiffComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TlpDiffComponent);
    component = fixture.componentInstance;
    // Set required config input
    component.config = {
      mode: 'diff',
      object: [{} as any, {} as any],
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
