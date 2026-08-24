import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VersionDiffComponent } from './version-diff.component';

describe('VersionDiffComponent', () => {
  let component: VersionDiffComponent;
  let fixture: ComponentFixture<VersionDiffComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VersionDiffComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(VersionDiffComponent);
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
