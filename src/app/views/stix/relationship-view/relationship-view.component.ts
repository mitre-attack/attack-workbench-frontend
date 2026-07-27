import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { Router } from '@angular/router';
import { Relationship } from 'src/app/classes/stix/relationship';
import { StixObject } from 'src/app/classes/stix/stix-object';
import { AuthenticationService } from 'src/app/services/connectors/authentication/authentication.service';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { StixViewPage } from '../stix-view-page';
import { VersionNumber } from 'src/app/classes/version-number';
import { EditorService } from 'src/app/services/editor/editor.service';
import { forkJoin } from 'rxjs';
import moment from 'moment';
import { StixTypeToAttackType } from 'src/app/utils/type-mappings';

@Component({
  selector: 'app-relationship-view',
  templateUrl: './relationship-view.component.html',
  styleUrls: ['./relationship-view.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class RelationshipViewComponent extends StixViewPage implements OnInit {
  @Output() public onVersionChange = new EventEmitter();
  @Output() closeDialogEvent = new EventEmitter<void>();
  @Output() changeDialogToObject = new EventEmitter<any>();

  public get relationship() {
    return this.configCurrentObject as Relationship;
  }
  public get previous() {
    return this.configPreviousObject as Relationship;
  }

  public source_type: string;
  public target_type: string;
  public refresh = true;
  public loaded = false;
  public currentPageStixID: string;
  public showOutdatedContentWarning = false;

  /** refresh the list of source objects if the type changes
   *  This is bad code and should be done a better way.
   */
  public refresh_lists() {
    this.refresh = false;
    setTimeout(() => {
      this.refresh = true;
    });
  }
  public source_version: any = {
    minor: false,
    major: false,
  };
  public target_version: any = {
    minor: false,
    major: false,
  };

  constructor(
    private restApiService: RestApiConnectorService,
    private editorService: EditorService,
    authenticationService: AuthenticationService,
    private router: Router
  ) {
    super(authenticationService);
  }

  ngOnInit(): void {
    this.currentPageStixID = this.editorService.stixId;

    // initialize source types if there is a source object, or if there is only one possible value
    if (this.relationship.source_object)
      this.source_type =
        StixTypeToAttackType[this.relationship.source_object.stix.type];
    else if (this.config.sourceType) this.source_type = this.config.sourceType;
    else if (this.relationship.valid_source_types.length == 1)
      this.source_type = this.relationship.valid_source_types[0];

    // initialize target types if there is a target object, or if there is only one possible value
    if (this.relationship.target_object)
      this.target_type =
        StixTypeToAttackType[this.relationship.target_object.stix.type];
    else if (this.config.targetType) this.target_type = this.config.targetType;
    else if (this.relationship.valid_target_types.length == 1)
      this.target_type = this.relationship.valid_target_types[0];

    if (
      this.source_type === 'data-component' &&
      this.relationship.relationship_type === 'detects' &&
      this.target_type === 'technique'
    ) {
      this.showOutdatedContentWarning = true;
    }

    // fetch parent of source/target objects of current object (utilized for displaying the full name of subtechniques and data components)
    const parent_calls = [];
    if (this.relationship.source_object) {
      if (
        this.relationship.source_object.stix.x_mitre_is_subtechnique ||
        this.source_type == 'data-component'
      ) {
        parent_calls.push(
          this.relationship.update_source_parent(this.restApiService)
        );
      }
    }
    if (this.relationship.target_object) {
      if (
        this.relationship.target_object.stix.x_mitre_is_subtechnique ||
        this.target_type == 'data-component'
      ) {
        parent_calls.push(
          this.relationship.update_target_parent(this.restApiService)
        );
      }
    }
    // fetch parent of source/target objects of previous object (iff config.mode == 'diff')
    if (this.previous?.source_object) {
      if (
        this.previous?.source_object.stix.x_mitre_is_subtechnique ||
        this.previous?.source_object.stix.type == 'data-component'
      ) {
        parent_calls.push(
          this.previous.update_source_parent(this.restApiService)
        );
      }
    }
    if (this.previous?.target_object) {
      if (
        this.previous?.target_object.stix.x_mitre_is_subtechnique ||
        this.previous?.target_object.stix.type == 'data-component'
      ) {
        parent_calls.push(
          this.previous.update_target_parent(this.restApiService)
        );
      }
    }
    if (parent_calls.length) {
      const pSubscription = forkJoin(parent_calls).subscribe({
        complete: () => {
          this.loaded = true;
          if (pSubscription) pSubscription.unsubscribe();
        },
      });
    } else this.loaded = true;
  }

  public setSourceObject(object: StixObject) {
    var subscription = this.relationship
      .set_source_object(object, this.restApiService)
      .subscribe({
        complete: () => {
          if (subscription) subscription.unsubscribe();
        }, //subscription doesn't exist for some reason in this case
      });
  }

  public setTargetObject(object: StixObject) {
    var subscription = this.relationship
      .set_target_object(object, this.restApiService)
      .subscribe({
        complete: () => {
          if (subscription) subscription.unsubscribe();
        }, //subscription doesn't exist for some reason in this case
      });
  }

  /**
   * Get the object version and last modified date information to display in the relationship view
   * @param {any} obj the object to retrieve details for
   * @returns formatted string with object's version (if defined) and last modified date (if defined)
   */
  public getObjectDetails(obj: any): string {
    if (!obj || !obj['stix']) return '';

    const version = obj['stix'].x_mitre_version;
    const modified = obj['stix'].modified
      ? moment(obj['stix'].modified).format('D MMM YYYY, h:mm A')
      : undefined;

    if (version && modified) return `(v${version}, last modified ${modified})`;
    else if (version && !modified) return `(v${version})`;
    else if (!version && modified) return `(last modified ${modified})`;
    else return '';
  }

  /**
   * Get the formatted string for the next minor version of the given object
   * @param {any} obj the raw STIX object
   */
  public nextMinorVersion(obj: any): string {
    if (!obj || !obj['stix'] || !obj['stix'].x_mitre_version) return '';
    const nextMinorVersion = new VersionNumber(
      obj['stix'].x_mitre_version
    ).nextMinorVersion();
    return nextMinorVersion.toString();
  }

  /**
   * Get the formatted string for the next major version of the given object
   * @param {any} obj the raw STIX object
   */
  public nextMajorVersion(obj: any): string {
    if (!obj || !obj['stix'] || !obj['stix'].x_mitre_version) return '';
    const nextMajorVersion = new VersionNumber(
      obj['stix'].x_mitre_version
    ).nextMajorVersion();
    return nextMajorVersion.toString();
  }

  /**
   * Handle checkbox change for source object version update
   * @param {MatCheckBoxChange} $event
   */
  public onSourceVersionChange($event) {
    this.onVersionChange.emit({ source: this.source_version });
  }

  /**
   * Handle checkbox change for target object version update
   * @param {MatCheckBoxChange} $event
   */
  public onTargetVersionChange($event) {
    this.onVersionChange.emit({ target: this.target_version });
  }

  public getStatus(obj: StixObject): string {
    if (obj?.['revoked']) return 'revoked';
    else if (obj?.['deprecated']) return 'deprecated';
    return '';
  }

  /**
   * Navigate to the given object's page
   * @param {any} obj the raw STIX object
   */
  public navigateTo(obj: any): void {
    if (
      !(obj?.stix?.type && obj?.stix?.id && StixTypeToAttackType[obj.stix.type])
    ) {
      console.warn('Invalid object passed to navigateTo:', obj);
      return;
    }

    const formattedType = StixTypeToAttackType[obj.stix.type]
      .toLowerCase()
      .replace(/\s+/g, '-');
    const targetRoute = `/${formattedType}/${obj.stix.id}`;
    this.closeDialogEvent.emit();
    this.router.navigate([targetRoute]);
  }
}
