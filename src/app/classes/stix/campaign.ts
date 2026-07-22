import { Observable } from 'rxjs';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { logger } from '../../utils/logger';
import { ValidationData } from '../serializable';
import { StixObject } from './stix-object';
import { WorkflowStatusType } from 'src/app/utils/types';

export class Campaign extends StixObject {
  public name = '';
  public first_seen: Date;
  public last_seen: Date;
  public first_seen_citation = '';
  public last_seen_citation = '';
  public aliases: string[] = [];
  public contributors: string[] = [];

  public readonly supportsAttackID = true;
  protected get attackIDValidator() {
    return {
      regex: 'C\\d{4}',
      format: 'C####',
    };
  }

  constructor(sdo?: any) {
    super(sdo, 'campaign');
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
    rep.stix.first_seen = this.first_seen?.toISOString();
    rep.stix.last_seen = this.last_seen?.toISOString();
    rep.stix.x_mitre_first_seen_citation = this.first_seen_citation.trim();
    rep.stix.x_mitre_last_seen_citation = this.last_seen_citation.trim();
    rep.stix.aliases = this.aliases.map(x => x.trim());
    rep.stix.x_mitre_contributors = this.contributors.map(x => x.trim());

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

      if ('first_seen' in sdo) {
        if (typeof sdo.first_seen === 'string')
          this.first_seen = new Date(sdo.first_seen);
        else
          logger.error(
            'TypeError: first_seen field is not a string:',
            sdo.first_seen,
            '(',
            typeof sdo.first_seen,
            ')'
          );
      }

      if ('last_seen' in sdo) {
        if (typeof sdo.last_seen === 'string')
          this.last_seen = new Date(sdo.last_seen);
        else
          logger.error(
            'TypeError: last_seen field is not a string:',
            sdo.last_seen,
            '(',
            typeof sdo.last_seen,
            ')'
          );
      }

      if ('x_mitre_first_seen_citation' in sdo) {
        if (typeof sdo.x_mitre_first_seen_citation === 'string')
          this.first_seen_citation = sdo.x_mitre_first_seen_citation;
        else
          logger.error(
            'TypeError: x_mitre_first_seen_citation field is not a string:',
            sdo.first_seen_citation,
            '(',
            typeof sdo.first_seen_citation,
            ')'
          );
      }

      if ('x_mitre_last_seen_citation' in sdo) {
        if (typeof sdo.x_mitre_last_seen_citation === 'string')
          this.last_seen_citation = sdo.x_mitre_last_seen_citation;
        else
          logger.error(
            'TypeError: x_mitre_last_seen_citation field is not a string:',
            sdo.last_seen_citation,
            '(',
            typeof sdo.last_seen_citation,
            ')'
          );
      }

      if ('aliases' in sdo) {
        if (this.isStringArray(sdo.aliases)) this.aliases = sdo.aliases;
        else
          logger.error(
            'TypeError: aliases is not a string array:',
            sdo.aliases,
            '(',
            typeof sdo.aliases,
            ')'
          );
      } else this.aliases = [];

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
  public save(restAPIService: RestApiConnectorService): Observable<Campaign> {
    const postObservable = restAPIService.postCampaign(this);
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

  /**
   * Delete this STIX object from the database.
   * @param restAPIService [RestApiConnectorService] the service to perform the DELETE through
   */
  public delete(restAPIService: RestApiConnectorService): Observable<object> {
    const deleteObservable = restAPIService.deleteCampaign(this.stixID);
    const subscription = deleteObservable.subscribe({
      complete: () => {
        subscription.unsubscribe();
      },
    });
    return deleteObservable;
  }

  /**
   * Update the state of the STIX object in the database.
   * @param restAPIService [RestApiConnectorService] the service to perform the PUT through
   * @returns {Observable} of the put
   */
  public update(restAPIService: RestApiConnectorService): Observable<Campaign> {
    const putObservable = restAPIService.putCampaign(this);
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
    return restAPIService.revokeCampaign(
      this.stixID,
      revokingObject,
      preserveRelationships
    );
  }
}
