import { Component, Inject, OnInit, ViewEncapsulation } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { forkJoin } from 'rxjs';
import { ValidationData } from 'src/app/classes/serializable';
import { DetectionStrategy } from 'src/app/classes/stix';
import { StixObject } from 'src/app/classes/stix/stix-object';
import { VersionNumber } from 'src/app/classes/version-number';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  WorkflowStatus,
  WorkflowStatusMap,
  WorkflowStatusType,
} from 'src/app/utils/types';
import { logger } from '../../utils/logger';

@Component({
  selector: 'app-save-dialog',
  templateUrl: './save-dialog.component.html',
  styleUrls: ['./save-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class SaveDialogComponent implements OnInit {
  public stage = 0;
  public currentVersion: string;
  public nextMajorVersion: string;
  public nextMinorVersion: string;
  public patch_objects = [];
  public validation: ValidationData = null;
  public newState: WorkflowStatus | undefined = WorkflowStatus.WorkInProgress;
  public workflows = Object.entries(WorkflowStatusMap);
  public analyticsToPatch = new Set<string>(); // list of stix ids of analytics that need patching

  public get saveEnabled() {
    return this.validation && this.validation.errors.length == 0;
  }

  constructor(
    public dialogRef: MatDialogRef<SaveDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public config: SaveDialogConfig,
    public restApiService: RestApiConnectorService
  ) {
    this.currentVersion = config.object.version.toString();
    this.nextMajorVersion = config.object.version.nextMajorVersion().toString();
    this.nextMinorVersion = config.object.version.nextMinorVersion().toString();

    const subscription = config.object.validate(this.restApiService).subscribe({
      next: result => {
        // tell the user version has been incremented, but not if the version has an error
        if (
          this.config.versionAlreadyIncremented &&
          !result.errors.some(x => x.field == 'version')
        )
          result.info.push({
            field: 'version',
            result: 'info',
            message: 'version has already been changed',
          });
        this.validation = result;
      },
      error: err => {
        logger.error(err);
      },
      complete: () => {
        subscription.unsubscribe();
      },
    });
  }

  ngOnInit(): void {
    this.newState =
      this.config.initialWorkflowState || WorkflowStatus.WorkInProgress;
    if (this.config.object.attackType === 'relationship') {
      this.newState = undefined;
    }
    if (this.config.object.attackType === 'detection-strategy') {
      const det = this.config.object as DetectionStrategy;
      const newAnalytics = new Set<string>(det.analytics);
      if (this.config.patchAnalytics) {
        // get set symmetric diff of analytics that need patching
        // analytics that were removed or added to the DET need to
        // be updated
        for (const a of this.config.patchAnalytics) {
          // check for analytics removed
          if (!newAnalytics.has(a)) this.analyticsToPatch.add(a);
        }
        for (const a of newAnalytics) {
          // check for analytics added
          if (!this.config.patchAnalytics.has(a)) this.analyticsToPatch.add(a);
        }
      }
      if (this.config.patchId) {
        // patching DET ID -> need to patch all current analytics
        for (const a of newAnalytics) this.analyticsToPatch.add(a);
      }
    }
    // Run validation for the initial state
    const subscription = this.config.object
      .validate(this.restApiService, this.newState)
      .subscribe({
        next: result => {
          this.validation = result;
        },
        error: err => {
          logger.error(err);
        },
        complete: () => subscription.unsubscribe(),
      });
  }

  onStatusChanged(event) {
    const subscription = this.config.object
      .validate(this.restApiService, event.value)
      .subscribe({
        next: result => {
          this.validation = result;
        },
        error: err => {
          logger.error(err);
        },
        complete: () => subscription.unsubscribe(),
      });
  }

  /**
   * Find objects with links to the previous object ATT&CK ID
   */
  private parse_patches(): void {
    this.stage = 1; // enter patching stage
    const objSubscription = this.restApiService
      .getAllObjects({ deserialize: true })
      .subscribe({
        next: results => {
          // find objects with a link to the previous ID
          const objLink = `(LinkById: ${this.config.patchId})`;
          results.data.forEach(x => {
            if (
              this.config.patchId &&
              (x.description?.indexOf(objLink) !== -1 ||
                ('detection' in x && x.detection?.indexOf(objLink) !== -1))
            ) {
              this.patch_objects.push(x);
              return; // already added as a patch object, continue
            }

            // update analytics referencing the old detection strategy url
            if (
              this.analyticsToPatch.size &&
              this.analyticsToPatch.has(x.stixID)
            ) {
              this.patch_objects.push(x);
              return; // already added as a patch object, continue
            }
          });

          // check if the object iself needs to be patched
          if (
            this.config.object.description?.indexOf(objLink) !== -1 ||
            ('detection' in this.config.object &&
              (this.config.object.detection as string)?.indexOf(objLink) !== -1)
          ) {
            this.patchObject(this.config.object); // calls patchObject() directly to avoid saving the object twice
          }

          this.stage = 2;
        },
        complete: () => objSubscription.unsubscribe(),
      });
  }

  private patchObject(obj): void {
    if (this.config.patchId) {
      // replace LinkById references with the new ATT&CK ID
      const regex = new RegExp(
        `\\(LinkById: (${this.config.patchId})\\)`,
        'gmu'
      );
      obj.description = obj.description.replace(
        regex,
        `(LinkById: ${this.config.object.attackID})`
      );
      if ('detection' in obj && obj.detection) {
        obj.detection = obj.detection.replace(
          regex,
          `(LinkById: ${this.config.object.attackID})`
        );
      }
    }

    if (this.analyticsToPatch.has(obj.stixID)) {
      // update the related detection so the analytic url is serialized correctly
      const det = this.config.object as DetectionStrategy;
      if (det?.analytics.includes(obj.stixID)) {
        // set related detection to this DET
        obj.relatedDetections = [
          {
            stixId: det.stixID,
            name: det.name,
            attackId: det.attackID,
            type: det.type,
          },
        ];
      } else {
        // analytic was removed, remove related DET
        obj.relatedDetections = undefined;
      }
    }
  }

  /**
   * Apply LinkById patches and save the object
   */
  public patch() {
    const saves = [];
    for (const obj of this.patch_objects) {
      this.patchObject(obj);
      if (obj.stixID !== this.config.object.stixID)
        saves.push(obj.save(this.restApiService));
    }
    this.stage = 3; // enter loading stage until patching is complete
    const saveSubscription = forkJoin(saves).subscribe({
      complete: () => {
        saveSubscription.unsubscribe();
        this.save();
      },
    });
  }

  /**
   * Save the object with the current version and check for patches
   */
  public saveCurrentVersion() {
    this.config.object.workflow = this.newState
      ? { state: this.newState }
      : undefined;
    if (this.config.patchId || this.config.patchAnalytics) this.parse_patches();
    else this.save();
  }

  /**
   * Save the object with the next minor version (i.e. 1.0 -> 1.1) and check for patches
   */
  public saveNextMinorVersion() {
    this.config.object.version = new VersionNumber(this.nextMinorVersion);
    this.config.object.workflow = this.newState
      ? { state: this.newState }
      : undefined;
    if (this.config.patchId || this.config.patchAnalytics) this.parse_patches();
    else this.save();
  }

  /**
   * Save the object with the next major version (i.e. 1.0 -> 2.0) and check for patches
   */
  public saveNextMajorVersion() {
    this.config.object.version = new VersionNumber(this.nextMajorVersion);
    this.config.object.workflow = this.newState
      ? { state: this.newState }
      : undefined;
    if (this.config.patchId || this.config.patchAnalytics) this.parse_patches();
    else this.save();
  }

  private saveObject() {
    return this.config.object.save(this.restApiService); // save this object
  }

  /**
   * Save the object without patching other objects
   */
  private save() {
    if (!this.saveEnabled) {
      return;
    }
    this.config.object.workflow = { state: this.newState };
    const sub = this.saveObject().subscribe({
      next: () => {
        this.dialogRef.close(true);
      },
      complete: () => sub.unsubscribe(),
    });
  }
}

export interface SaveDialogConfig {
  object: StixObject;
  patchId?: string; // previous object ID to patch in LinkByID tags
  patchAnalytics?: Set<string>; // previous list of analytics related to a detection strategy
  versionAlreadyIncremented: boolean;
  initialWorkflowState?: WorkflowStatusType;
}
