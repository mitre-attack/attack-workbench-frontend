import { Observable, of } from 'rxjs';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { ValidationData } from '../serializable';
import { StixObject } from './stix-object';
import { logger } from '../../utils/logger';
import { Technique } from './technique';
import { WorkflowStatusType } from 'src/app/utils/types';

export class Tactic extends StixObject {
  public name = '';
  public domains: string[] = [];
  public contributors: string[] = [];

  // NOTE: this is only populated in the matrix view when calling getTechniquesInMatrix() NOT getMatrix()
  public technique_objects: Technique[] = [];

  public readonly supportsAttackID = true;
  protected get attackIDValidator() {
    return {
      regex: 'TA\\d{4}',
      format: 'TA####',
    };
  }

  public get shortname(): string {
    return this.name.trim().replace(/ /g, '-').toLowerCase();
  }

  constructor(sdo?: any) {
    super(sdo, 'x-mitre-tactic');
    if (sdo) {
      this.deserialize(sdo);
    }
  }

  /**
   * Transform the current object into a raw object for sending to the back-end, stripping any unnecessary fields
   * @abstract
   * @returns {*} the raw object to send
   */
  public serialize(keepModified?: string): any {
    const rep = super.base_serialize();
    if (keepModified) {
      rep.stix.modified = keepModified;
    }

    rep.stix.name = this.name.trim();
    rep.stix.x_mitre_domains = this.domains;
    rep.stix.x_mitre_shortname = this.shortname;
    rep.stix.x_mitre_contributors = this.contributors.map(x => x.trim());
    rep.stix = this.filterObject(rep.stix);

    // Strip properties that are empty strs + lists
    rep.stix = this.filterObject(rep.stix);

    return rep;
  }

  /**
   * Parse the object from the record returned from the back-end
   * @abstract
   * @param {*} raw the raw object to parse
   */
  public deserialize(raw: any) {
    if ('stix' in raw) {
      const sdo = raw.stix;

      if ('name' in sdo) {
        if (typeof sdo.name === 'string') this.name = sdo.name;
        else
          logger.error(
            'TypeError: name field is not a string:',
            sdo.name,
            '(',
            typeof sdo.name,
            ')'
          );
      } else this.name = '';

      if ('x_mitre_domains' in sdo) {
        if (this.isStringArray(sdo.x_mitre_domains))
          this.domains = sdo.x_mitre_domains;
        else logger.error('TypeError: domains field is not a string array.');
      } else this.domains = [];

      if ('x_mitre_contributors' in sdo) {
        if (this.isStringArray(sdo.x_mitre_contributors))
          this.contributors = sdo.x_mitre_contributors;
        else
          logger.error(
            'TypeError: x_mitre_contributors is not a string array:',
            sdo.x_mitre_contributors,
            '(',
            typeof sdo.x_mitre_contributors,
            ')'
          );
      } else this.contributors = [];
    }
  }

  /**
   * Validate the current object state and return information on the result of the validation
   * @param {RestApiConnectorService} restAPIService: the REST API connector through which asynchronous validation can be completed
   * @returns {Observable<ValidationData>} the validation warnings and errors once validation is complete.
   */
  public validate(
    restAPIService: RestApiConnectorService,
    tempWorkflowState?: WorkflowStatusType
  ): Observable<ValidationData> {
    return this.base_validate(restAPIService, tempWorkflowState);
  }

  /**
   * Save the current state of the STIX object in the database. Update the current object from the response
   * @param restAPIService [RestApiConnectorService] the service to perform the POST/PUT through
   * @returns {Observable} of the post
   */
  public save(restAPIService: RestApiConnectorService): Observable<Tactic> {
    const postObservable = restAPIService.postTactic(this);
    const subscription = postObservable.subscribe({
      next: result => {
        this.deserialize(result.serialize());
      },
      complete: () => {
        subscription.unsubscribe();
      },
    });
    return postObservable;
  }

  public delete(_restAPIService: RestApiConnectorService): Observable<object> {
    // deletion is not supported on Tactic objects
    return of({});
  }

  /**
   * Update the state of the STIX object in the database.
   * @param restAPIService [RestApiConnectorService] the service to perform the PUT through
   * @returns {Observable} of the put
   */
  public update(restAPIService: RestApiConnectorService): Observable<Tactic> {
    const putObservable = restAPIService.putTactic(this);
    const subscription = putObservable.subscribe({
      next: result => {
        this.deserialize(result.serialize());
      },
      complete: () => {
        subscription.unsubscribe();
      },
    });
    return putObservable;
  }

  /**
   * Revoke the STIX object in the database.
   * @param restAPIService [RestApiConnectorService] the service to perform the revoke through
   * @param revokingObject the revoking object payload
   * @returns {Observable} of the revoke
   */
  public revoke(
    restAPIService: RestApiConnectorService,
    revokingObject: { revoking: { stixId: string; modified: string } },
    preserveRelationships = false
  ): Observable<object> {
    return restAPIService.revokeTactic(
      this.stixID,
      revokingObject,
      preserveRelationships
    );
  }
}
