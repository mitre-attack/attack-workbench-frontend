import { StixObject } from './stix-object';
import { logger } from '../../utils/logger';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { Observable } from 'rxjs';
import { ValidationData } from '../serializable';
import { DataComponent } from './data-component';
import { WorkflowStatusType } from 'src/app/utils/types';

export class DataSource extends StixObject {
  public name = '';
  public description = '';
  public platforms: string[] = [];
  public collection_layers: string[] = [];
  public contributors: string[] = [];
  public domains: string[] = [];
  public data_components: DataComponent[] = [];

  public readonly supportsAttackID = true;
  protected get attackIDValidator() {
    return {
      regex: 'DS\\d{4}',
      format: 'DS####',
    };
  }

  constructor(sdo?: any) {
    super(sdo, 'x-mitre-data-source');
    if (sdo) {
      this.deserialize(sdo);
    }
  }

  /**
   * Transform the current object into a raw object for sending to the back-end
   * @abstract
   * @returns {*} the raw object to send
   */
  public serialize(keepModified?: string): any {
    const rep = super.base_serialize();
    if (keepModified) {
      rep.stix.modified = keepModified;
    }

    rep.stix.name = this.name.trim();
    rep.stix.description = this.description;
    rep.stix.x_mitre_platforms = this.platforms;
    rep.stix.x_mitre_collection_layers = this.collection_layers;
    rep.stix.x_mitre_contributors = this.contributors.map(x => x.trim());
    rep.stix.x_mitre_domains = this.domains;

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
    if ('dataComponents' in raw) {
      for (const obj of raw.dataComponents) {
        this.data_components.push(new DataComponent(obj));
      }
    }

    if (!('stix' in raw)) return;

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

    if ('description' in sdo) {
      if (typeof sdo.description === 'string')
        this.description = sdo.description;
      else
        logger.error(
          'TypeError: description field is not a string:',
          sdo.description,
          '(',
          typeof sdo.description,
          ')'
        );
    } else this.description = '';

    if ('x_mitre_platforms' in sdo) {
      if (this.isStringArray(sdo.x_mitre_platforms))
        this.platforms = sdo.x_mitre_platforms;
      else logger.error('TypeError: platforms field is not a string array.');
    } else this.platforms = [];

    if ('x_mitre_collection_layers' in sdo) {
      if (this.isStringArray(sdo.x_mitre_collection_layers))
        this.collection_layers = sdo.x_mitre_collection_layers;
      else
        logger.error(
          'TypeError: collection layers field is not a string array.'
        );
    } else this.collection_layers = [];

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

    if ('x_mitre_domains' in sdo) {
      if (this.isStringArray(sdo.x_mitre_domains))
        this.domains = sdo.x_mitre_domains;
      else logger.error('TypeError: domains field is not a string array.');
    } else this.domains = [];
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
  public save(restAPIService: RestApiConnectorService): Observable<DataSource> {
    const postObservable = restAPIService.postDataSource(this);
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
    const deleteObservable = restAPIService.deleteDataSource(this.stixID);
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
  public update(
    restAPIService: RestApiConnectorService
  ): Observable<DataSource> {
    const putObservable = restAPIService.putDataSource(this);
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
    return restAPIService.revokeDataSource(
      this.stixID,
      revokingObject,
      preserveRelationships
    );
  }
}
