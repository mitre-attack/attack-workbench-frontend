import { Observable, of } from 'rxjs';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { ValidationData } from '../serializable';
import { StixObject } from './stix-object';
import { logger } from '../../utils/logger';
import { Tactic } from './tactic';
import { WorkflowStatusType } from 'src/app/utils/types';

export class Matrix extends StixObject {
  public name = '';
  public tactic_refs: string[] = [];
  // NOTE: this is only populated in the matrix view when calling getTechniquesInMatrix() NOT getMatrix()
  public tactic_objects: Tactic[] = [];

  public readonly supportsAttackID = true;
  protected get attackIDValidator() {
    return {
      regex: '.*',
      format: '[domain identifier]',
    };
  }

  constructor(sdo?: any) {
    super(sdo, 'x-mitre-matrix');
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
    rep.stix.tactic_refs = this.tactic_refs;

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

      if ('tactic_refs' in sdo) {
        if (this.isStringArray(sdo.tactic_refs))
          this.tactic_refs = sdo.tactic_refs;
        else
          logger.error(
            'TypeError: tactic_refs field is not a string array:',
            sdo.tactic_refs,
            '(',
            typeof sdo.tactic_refs,
            ')'
          );
      } else this.tactic_refs = [];
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
    // TODO verify all tactics exist
    return this.base_validate(restAPIService, tempWorkflowState);
  }

  /**
   * Save the current state of the STIX object in the database. Update the current object from the response
   * @param restAPIService [RestApiConnectorService] the service to perform the POST/PUT through
   * @returns {Observable} of the post
   */
  public save(restAPIService: RestApiConnectorService): Observable<Matrix> {
    const postObservable = restAPIService.postMatrix(this);
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
    // deletion is not supported on Matrix objects
    return of({});
  }

  /**
   * Update the state of the STIX object in the database.
   * @param restAPIService [RestApiConnectorService] the service to perform the PUT through
   * @returns {Observable} of the put
   */
  public update(restAPIService: RestApiConnectorService): Observable<Matrix> {
    const putObservable = restAPIService.putMatrix(this);
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
    return restAPIService.revokeMatrix(
      this.stixID,
      revokingObject,
      preserveRelationships
    );
  }
}
