import { DragDropModule } from '@angular/cdk/drag-drop';
import { provideHttpClient } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { MtxPopoverModule } from '@ng-matero/extensions/popover';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { Technique } from 'src/app/classes/stix/technique';
import { DeprecationService } from 'src/app/services/helpers/deprecation.service';

import { ObjectStatusComponent } from './object-status.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createAsyncObservable,
  createMockRestApiConnector,
  createPaginatedResponse,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('ObjectStatusComponent', () => {
  let component: ObjectStatusComponent;
  let fixture: ComponentFixture<ObjectStatusComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({
      getAllTechniques: () =>
        createAsyncObservable(createPaginatedResponse([])),
      getRelatedTo: () => createAsyncObservable(createPaginatedResponse([])),
    });
    await TestBed.configureTestingModule({
      declarations: [ObjectStatusComponent],
      imports: [
        MtxPopoverModule,
        ReactiveFormsModule,
        FormsModule,
        MatFormFieldModule,
        MatSelectModule,
        MatCheckboxModule,
        MatIconModule,
        MatButtonModule,
        MatTooltipModule,
        DragDropModule,
        BrowserAnimationsModule,
      ],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({}),
            queryParams: of({}),
          },
        },
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
        provideHttpClient(),
        {
          provide: Router,
          useValue: {
            url: '/technique/mock-stix-id?param=value',
            events: of({}),
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ObjectStatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('uses authoritative deprecation without changing local status early', () => {
    const pending = new Subject<boolean>();
    const lifecycle = TestBed.inject(DeprecationService);
    vi.spyOn(lifecycle, 'deprecate').mockReturnValue(pending);
    component.object = new Technique();
    component.objects = [component.object];
    component.loaded = true;
    component.editorService.editing = false;

    component.toggleDeprecated();
    expect(component.object.deprecated).toBe(false);
    expect(component.deprecateDisabled).toBe(true);

    pending.next(false);
    pending.complete();
    expect(component.deprecated).toBe(false);
    expect(component.lifecyclePending).toBe(false);
  });
});
