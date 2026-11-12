import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  MatChipsModule,
  MatChip,
  MatChipRemove,
} from '@angular/material/chips';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { of } from 'rxjs';

import { ListEditComponent } from './list-edit.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { Technique } from 'src/app/classes/stix/technique';

describe('ListEditComponent', () => {
  let component: ListEditComponent;
  let fixture: ComponentFixture<ListEditComponent>;
  let enabled: string[];
  let object: Technique;

  beforeEach(async () => {
    enabled = ['Linux'];
    await TestBed.configureTestingModule({
      declarations: [ListEditComponent],
      imports: [
        CommonModule,
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatSelectModule,
        MatChipsModule,
      ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: RestApiConnectorService,
          useValue: {
            getAllAllowedValues: () =>
              of([
                {
                  objectType: 'technique',
                  properties: [
                    {
                      propertyName: 'x_mitre_platforms',
                      domains: [
                        {
                          domainName: 'enterprise-attack',
                          allowedValues: enabled,
                        },
                      ],
                    },
                  ],
                },
              ]),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ListEditComponent);
    component = fixture.componentInstance;
    object = new Technique();
    object.domains = ['enterprise-attack'];
    object.platforms = ['Legacy'];
    component.config = {
      mode: 'edit',
      editType: 'select',
      object,
      field: 'platforms',
    };
  });

  afterEach(() => fixture.destroy());

  async function openSelect(): Promise<HTMLElement[]> {
    fixture.debugElement
      .query(By.directive(MatSelect))
      .componentInstance.open();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return Array.from(document.querySelectorAll<HTMLElement>('mat-option'));
  }

  async function closeSelect(): Promise<void> {
    fixture.debugElement
      .query(By.directive(MatSelect))
      .componentInstance.close();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('preserves unavailable selections while adding enabled choices, then stops offering removed selections', async () => {
    fixture.detectChanges();
    const options = await openSelect();
    const legacy = options.find(
      option => option.textContent.trim() === 'Legacy'
    );
    expect(legacy.getAttribute('aria-disabled')).toBe('true');
    expect(legacy.getAttribute('aria-selected')).toBe('true');
    options.find(option => option.textContent.trim() === 'Linux').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(object.platforms).toEqual(['Legacy', 'Linux']);
    await closeSelect();
    fixture.debugElement
      .queryAll(By.directive(MatChip))
      .find(chip => chip.nativeElement.textContent.includes('Legacy'))
      .query(By.directive(MatChipRemove))
      .nativeElement.click();
    fixture.detectChanges();
    expect(
      (await openSelect()).map(option => option.textContent.trim())
    ).toEqual(['Linux']);
    expect(object.platforms).toEqual(['Linux']);
  });

  it('keeps existing data visible when its supported tuple has no enabled values', async () => {
    enabled = [];
    fixture.detectChanges();
    const options = await openSelect();
    expect(options.map(option => option.textContent.trim())).toEqual([
      'Legacy',
    ]);
    expect(options[0].getAttribute('aria-disabled')).toBe('true');
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    expect(object.platforms).toEqual(['Legacy']);
  });
});
