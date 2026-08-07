import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { of } from 'rxjs';

import { FooterComponent } from './footer.component';
import { BuildInfoService } from '../../services/build-info/build-info.service';

describe('FooterComponent', () => {
  let component: FooterComponent;
  let fixture: ComponentFixture<FooterComponent>;
  const buildInfo = {
    frontend: {
      name: 'attack-workbench-frontend',
      version: '4.20.0-beta.23',
      gitCommit: 'frontend-commit',
      buildDate: '2026-08-05T15:13:49.915Z',
    },
    restApi: {
      name: 'attack-workbench-rest-api',
      version: '4.20.0-beta.22',
      gitCommit: 'rest-api-commit',
      buildDate: '2026-08-04T15:13:49.915Z',
      attackSpecVersion: '3.3.0',
    },
  };

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [FooterComponent],
      providers: [
        {
          provide: BuildInfoService,
          useValue: { getBuildInfo: vi.fn(() => of(buildInfo)) },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the frontend and REST API build versions', () => {
    const versionElements: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.version-info')
    );

    expect(versionElements.map(element => element.textContent?.trim())).toEqual(
      ['Frontend v4.20.0-beta.23', 'REST API v4.20.0-beta.22']
    );
    expect(versionElements[0].title).toContain('Commit: frontend-commit');
    expect(versionElements[1].title).toContain(
      'Built: 2026-08-04T15:13:49.915Z'
    );
  });

  it('should not duplicate an existing version prefix', () => {
    expect(component.formatVersion('v4.20.0')).toBe('v4.20.0');
    expect(component.formatVersion('unknown')).toBe('unknown');
  });
});
