import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { MtxPopoverModule } from '@ng-matero/extensions/popover';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { SubheadingComponent } from './subheading.component';
import { StixObject } from 'src/app/classes/stix/stix-object';

describe('SubheadingComponent', () => {
  let component: SubheadingComponent;
  let fixture: ComponentFixture<SubheadingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SubheadingComponent],
      imports: [MtxPopoverModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({}),
            queryParams: of({}),
          },
        },
        provideHttpClient(),
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SubheadingComponent);
    component = fixture.componentInstance;
    component.config = { object: {} };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should hide the STIX ID property when the name header shows workflow actions', () => {
    const object = Object.create(StixObject.prototype);
    object.stixID = 'attack-pattern--123';
    object.attackType = 'technique';
    component.config = {
      mode: 'view',
      object,
    } as any;

    expect(component.showStixIdProperty).toBe(false);
  });

  it('should keep the STIX ID property for collections', () => {
    const object = Object.create(StixObject.prototype);
    object.stixID = 'x-mitre-collection--123';
    object.attackType = 'collection';
    component.config = {
      mode: 'view',
      object,
    } as any;

    expect(component.showStixIdProperty).toBe(true);
  });
});
