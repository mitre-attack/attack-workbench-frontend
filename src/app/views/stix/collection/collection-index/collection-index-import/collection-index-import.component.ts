import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { MatStepper } from '@angular/material/stepper';
import { CollectionIndex } from 'src/app/classes/collection-index';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { getRuntimeConfiguration } from 'src/configuration/runtime-configuration';
import { logger } from '../../../../../utils/logger';
@Component({
  selector: 'app-collection-index-import',
  templateUrl: './collection-index-import.component.html',
  styleUrls: ['./collection-index-import.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class CollectionIndexImportComponent implements OnInit {
  @ViewChild(MatStepper) public stepper: MatStepper;

  constructor(
    private restAPIConnector: RestApiConnectorService,
    private snackbar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // intentionally left blank
  }

  public url = '';
  public get recommended_indexes() {
    return getRuntimeConfiguration().recommendedIndexes;
  }

  public index: CollectionIndex = null;

  /**
   * download the collection index at this.url and move to the next step in the stepper
   */
  public previewIndex(): void {
    const subscription = this.restAPIConnector
      .getRemoteIndex(this.url)
      .subscribe({
        next: index => {
          if (index) {
            this.index = new CollectionIndex(index);
            if (this.index.valid()) {
              this.stepper.next();
            } else {
              this.error('Invalid collection index.');
            } //show snackbar
          }
        },
        complete: () => {
          subscription.unsubscribe();
        }, //prevent memory leaks
      });
  }
  /**
   * Save the downloaded collection index to the REST API
   *
   * @memberof CollectionIndexImportComponent
   */
  public saveIndex(): void {
    const serialized = this.index.serialize();
    serialized.workspace.update_policy = {
      // set up update policy
      automatic: true,
      last_retrieval: new Date(),
      // interval: 10, // allow REST API to define the update interval according to the app config
    };
    const subscription = this.restAPIConnector
      .postCollectionIndex(serialized)
      .subscribe({
        next: result => {
          this.stepper.next();
        },
        complete: () => {
          subscription.unsubscribe();
        }, // prevent memory leaks
      });
  }

  /**
   * Show error message
   * @param {msg} message the error message to show
   */
  public error(msg: string): void {
    logger.error(msg);
    this.snackbar.open(msg, 'dismiss', {
      duration: 2000,
      panelClass: 'warn',
    });
  }
}
