import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { DataQualityComponent } from './data-quality.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';

describe('DataQualityComponent', () => {
  let component: DataQualityComponent;
  let fixture: ComponentFixture<DataQualityComponent>;

  const mockReportService = {
    getMissingLinkById: () => of([]),
    getParallelRelationships: () => of({}),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DataQualityComponent],
      providers: [
        { provide: RestApiConnectorService, useValue: mockReportService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DataQualityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
