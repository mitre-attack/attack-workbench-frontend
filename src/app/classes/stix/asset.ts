import { Observable } from 'rxjs';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { logger } from '../../utils/logger';
import { ValidationData } from '../serializable';
import { StixObject } from './stix-object';
import { WorkflowStatusType } from 'src/app/utils/types';

export class Asset extends StixObject {
  public name = '';
  public contributors: string[] = [];
  public sectors: string[] = [];
  public relatedAssets: RelatedAsset[] = [];
  public platforms: string[] = [];

  // assets are ICS-only
  public domains: string[] = ['ics-attack'];

  public readonly supportsAttackID = true;
  protected get attackIDValidator() {
    return {
      regex: 'A\\d{4}',
      format: 'A####',
    };
  }

  constructor(sdo?: any) {
    super(sdo, 'x-mitre-asset');
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

    // Conditionally serialize array fields - only include if non-empty
    this.serializeArrayField(rep.stix, 'x_mitre_domains', this.domains);
    this.serializeArrayField(rep.stix, 'x_mitre_sectors', this.sectors);
    this.serializeArrayField(
      rep.stix,
      'x_mitre_related_assets',
      this.relatedAssets,
      assets =>
        assets.map((asset: RelatedAsset) => {
          const relatedAsset: any = {
            name: asset.name.trim(),
            description: asset.description || '',
          };
          // Only include related_asset_sectors if it's a non-empty array
          if (
            Array.isArray(asset.related_asset_sectors) &&
            asset.related_asset_sectors.length > 0
          ) {
            relatedAsset.related_asset_sectors = asset.related_asset_sectors;
          }
          return relatedAsset;
        })
    );
    this.serializeArrayField(rep.stix, 'x_mitre_platforms', this.platforms);
    this.serializeArrayField(
      rep.stix,
      'x_mitre_contributors',
      this.contributors,
      contributors => contributors.map(x => x.trim())
    );

    // Strip properties that are empty strs + lists
    rep.stix = this.filterObject(rep.stix);

    return rep;
  }

  public isRelatedAssetArray(arr: any[]): boolean {
    return (
      Array.isArray(arr) && arr.every(a => typeof a === 'object' && 'name' in a)
    );
  }

  /**
   * Parse the object from the record returned from the back-end
   * @abstract
   * @param {*} raw the raw object to parse
   */
  public deserialize(raw: any) {
    if (!('stix' in raw)) return;

    const sdo = raw.stix;

    if (!('name' in sdo)) this.name = '';
    else if (typeof sdo.name === 'string') this.name = sdo.name;
    else
      logger.error(
        `TypeError: name field is not a string: ${sdo.name} (${typeof sdo.name})`
      );

    if (!('x_mitre_sectors' in sdo)) this.sectors = [];
    else if (this.isStringArray(sdo.x_mitre_sectors))
      this.sectors = sdo.x_mitre_sectors;
    else
      logger.error(`TypeError: x_mitre_sectors field is not a string array.`);

    if (!('x_mitre_related_assets' in sdo)) this.relatedAssets = [];
    else if (this.isRelatedAssetArray(sdo.x_mitre_related_assets))
      this.relatedAssets = sdo.x_mitre_related_assets;
    else
      logger.error(
        `TypeError: x_mitre_related_assets field is not an array of related assets.`
      );

    if (!('x_mitre_platforms' in sdo)) this.platforms = [];
    else if (this.isStringArray(sdo.x_mitre_platforms))
      this.platforms = sdo.x_mitre_platforms;
    else logger.error(`TypeError: platforms field is not a string array.`);

    if (!('x_mitre_domains' in sdo)) this.domains = ['ics-attack'];
    else if (this.isStringArray(sdo.x_mitre_domains))
      this.domains = sdo.x_mitre_domains;
    else logger.error(`TypeError: domains field is not a string array.`);

    if (!('x_mitre_contributors' in sdo)) this.contributors = [];
    else if (this.isStringArray(sdo.x_mitre_contributors))
      this.contributors = sdo.x_mitre_contributors;
    else logger.error(`TypeError: x_mitre_contributors is not a string array.`);
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
  public save(restAPIService: RestApiConnectorService): Observable<Asset> {
    const postObservable = restAPIService.postAsset(this);
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
    const deleteObservable = restAPIService.deleteAsset(this.stixID);
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
  public update(restAPIService: RestApiConnectorService): Observable<Asset> {
    const putObservable = restAPIService.putAsset(this);
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
    return restAPIService.revokeAsset(
      this.stixID,
      revokingObject,
      preserveRelationships
    );
  }
}

export interface RelatedAsset {
  name: string;
  related_asset_sectors: string;
  description: string;
}
