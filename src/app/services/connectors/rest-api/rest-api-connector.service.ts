import {
  HttpClient,
  HttpHeaders,
  HttpParameterCodec,
  HttpParams,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, Observable, of, Subject, throwError } from 'rxjs';
import {
  catchError,
  filter,
  finalize,
  map,
  mergeMap,
  share,
  switchMap,
  tap,
} from 'rxjs/operators';
import { Team } from 'src/app/classes/authn/team';
import { UserAccount } from 'src/app/classes/authn/user-account';
import { CollectionIndex } from 'src/app/classes/collection-index';
import { ExternalReference } from 'src/app/classes/external-references';
import {
  Analytic,
  Asset,
  Campaign,
  DataComponent,
  DataSource,
  DetectionStrategy,
  Group,
  Identity,
  MarkingDefinition,
  Matrix,
  Mitigation,
  Note,
  Relationship,
  Software,
  StixObject,
  Tactic,
  Technique,
} from 'src/app/classes/stix';
import { Collection } from 'src/app/classes/stix/collection';
import {
  AttackTypeToClass,
  StixTypeToClass,
} from 'src/app/utils/class-mappings';
import { AttackTypeToPlural } from 'src/app/utils/type-mappings';
import { AttackType } from 'src/app/utils/types';
import { environment } from '../../../../environments/environment';
import { logger } from '../../../utils/logger';
import { ApiConnector } from '../api-connector';
import {
  CollectionStreamService,
  StreamProgress,
} from '../collection-stream.service';

export interface Paginated<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface Namespace {
  prefix: string;
  range_start: string;
}

@Injectable({
  providedIn: 'root',
})
export class RestApiConnectorService extends ApiConnector {
  private get apiUrl(): string {
    return environment.integrations.rest_api.url;
  }

  constructor(
    private http: HttpClient,
    private snackbar: MatSnackBar,
    private collectionStreamService: CollectionStreamService
  ) {
    super(snackbar);
  }

  /**
   * Get the name of a given STIX object
   */
  private getObjectName(object: StixObject): string {
    if (object.type == 'relationship') {
      if (
        object['source_name'] == '[unknown object]' ||
        object['target_name'] == '[unknown object]'
      ) {
        return `${object['relationship_type'].charAt(0).toUpperCase()}${object['relationship_type'].slice(1)} relationship`;
      }
      return `${object['source_name']} ${object['relationship_type']} ${object['target_name']}`;
    } else if (object.type == 'note') {
      return object['title'];
    } else if ('name' in object) {
      return object['name'] as string;
    } else if (object['attackID']) {
      return object['attackID'];
    } else {
      logger.warn('could not determine object name', object);
      return 'unknown object';
    }
  }

  //   ___ _____ _____  __       _   ___ ___ ___
  //  / __|_   _|_ _\ \/ /      /_\ | _ \_ _/ __|
  //  \__ \ | |  | | >  <      / _ \|  _/| |\__ \
  //  |___/ |_| |___/_/\_\    /_/ \_\_| |___|___/
  //

  /**
   * Factory to create a new STIX get-all function
   * @template T the type to get
   * @param {AttackType} attackType the type to get
   * @returns getter function
   */
  private getStixObjectsFactory<T extends StixObject>(attackType: AttackType) {
    const attackClass = AttackTypeToClass[attackType];
    const plural = AttackTypeToPlural[attackType];
    return function <P extends T>(options?: {
      limit?: number;
      offset?: number;
      state?: string;
      includeRevoked?: boolean;
      includeDeprecated?: boolean;
      versions?: 'all' | 'latest';
      excludeIDs?: string[];
      search?: string;
      platforms?: string[];
      domains?: string[];
      lastUpdatedBy?: string[];
      includeRefs?: boolean;
    }): Observable<Paginated<StixObject>> {
      const pagination = {
        total: 1,
        limit: -1,
        offset: -1,
      };
      // parse params into query string
      let query = new HttpParams({ encoder: new CustomEncoder() });
      if (options) {
        // pagination
        if (options.limit) query = query.set('limit', options.limit.toString());
        if (options.offset)
          query = query.set('offset', options.offset.toString());
        if (options.limit || options.offset)
          query = query.set('includePagination', 'true');
        // state/workflow
        if (options.state) query = query.set('state', options.state);
        if (options.includeRevoked)
          query = query.set(
            'includeRevoked',
            options.includeRevoked ? 'true' : 'false'
          );
        if (options.includeDeprecated)
          query = query.set(
            'includeDeprecated',
            options.includeDeprecated ? 'true' : 'false'
          );
        // include related objects in a `related_to` array
        if (options.includeRefs)
          query = query.set(
            'includeRefs',
            options.includeRefs ? 'true' : 'false'
          );
        // versions selector
        if (options.versions) query = query.set('versions', options.versions);
        // searching
        if (options.search) query = query.set('search', options.search);
        // platforms/domains
        if (options.platforms)
          options.platforms.forEach(
            platform => (query = query.append('platform', platform))
          );
        if (options.domains)
          options.domains.forEach(
            domain => (query = query.append('domain', domain))
          );
        // lastUpdatedBy
        if (options.lastUpdatedBy)
          options.lastUpdatedBy.forEach(
            user => (query = query.append('lastUpdatedBy', user))
          );
      }
      // perform the request
      const url = `${this.apiUrl}/${plural}`;
      return this.http.get(url, { headers: this.headers, params: query }).pipe(
        tap(results => logger.log(`retrieved ${plural}`, results)), // on success, trigger the success notification
        map(results => {
          if (!options || !options.excludeIDs) return results; // only filter if param is present
          let response = results as any;
          if (options && (options.limit || options.offset)) {
            // returned a paginated
            response.data = response.data.filter(
              d => !options.excludeIDs.includes(d.stix.id)
            ); //remove any matches to excludeIDs
            return response;
          } else {
            //returned a stixObject[]
            response = response.filter(
              d => !options.excludeIDs.includes(d.stix.id)
            ); //remove any matches to excludeIDs
            return response;
          }
        }),
        map(results => {
          const response = results as any;
          if (options && (options.limit || options.offset)) {
            // returned a paginated
            let data = response.data as any[];
            data = data.map(y => {
              if (y.stix.type == 'malware' || y.stix.type == 'tool')
                return new Software(y.stix.type, y);
              else return new attackClass(y);
            });
            response.data = data;
            return response;
          } else {
            //returned a stixObject[]
            return {
              pagination: {
                total: response.length,
                limit: -1,
                offset: -1,
              },
              data: response.map(y => {
                if (y.stix.type == 'malware' || y.stix.type == 'tool')
                  return new Software(y.stix.type, y);
                else return new attackClass(y);
              }),
            };
          }
        }),
        catchError(this.handleError_continue([])), // on error, trigger the error notification and continue operation without crashing (returns empty item)
        share() // multicast so that multiple subscribers don't trigger the call twice. THIS MUST BE THE LAST LINE OF THE PIPE
      );
    };
  }

  /**
   * Get all techniques
   * @param {number} [limit] the number of techniques to retrieve
   * @param {number} [offset] the number of techniques to skip
   * @param {string} [state] if specified, only get objects with this state
   * @param {boolean} [includeRevoked] if true, get revoked objects
   * @param {boolean} [includeDeprecated] if true, get deprecated objects
   * @param {"all" | "latest"} [versions] if "all", get all versions of the objects. if "latest", only get the latest version of each object
   * @param {string} [lastUpdatedBy] if specified, only get objects which were last updated by these users
   * @param {string[]} [excludeIDs] if specified, excludes these STIX IDs from the result
   * @param {string} [search] if specified, return objects where the query occurs in the name, description, or ATT&CK ID; the search is case-insensitive
   * @param {string[]} [platforms] if specified, retrieve objects that contain the specified platform(s)
   * @param {string[]} [domains] if specified, retrieve objects that contain the specified domain(s)
   * @returns {Observable<Technique[]>} observable of retrieved objects
   */
  public get getAllTechniques() {
    return this.getStixObjectsFactory<Technique>('technique');
  }
  /**
   * Get all tactics
   * @param {number} [limit] the number of tactics to retrieve
   * @param {number} [offset] the number of tactics to skip
   * @param {string} [state] if specified, only get objects with this state
   * @param {string} [lastUpdatedBy] if specified, only get objects which were last updated by these users
   * @param {boolean} [revoked] if true, get revoked objects
   * @param {boolean} [deprecated] if true, get deprecated objects
   * @param {string[]} [excludeIDs] if specified, excludes these STIX IDs from the result
   * @returns {Observable<Tactic[]>} observable of retrieved objects
   */
  public get getAllTactics() {
    return this.getStixObjectsFactory<Tactic>('tactic');
  }
  /**
   * Get all groups
   * @param {number} [limit] the number of groups to retrieve
   * @param {number} [offset] the number of groups to skip
   * @param {string} [state] if specified, only get objects with this state
   * @param {string} [lastUpdatedBy] if specified, only get objects which were last updated by these users
   * @param {boolean} [revoked] if true, get revoked objects
   * @param {boolean} [deprecated] if true, get deprecated objects
   * @param {string[]} [excludeIDs] if specified, excludes these STIX IDs from the result
   * @returns {Observable<Group[]>} observable of retrieved objects
   */
  public get getAllGroups() {
    return this.getStixObjectsFactory<Group>('group');
  }
  /**
   * Get all campaigns
   * @param {number} [limit] the number of campaigns to retrieve
   * @param {number} [offset] the number of campaigns to skip
   * @param {string} [state] if specified, only get objects with this state
   * @param {string} [lastUpdatedBy] if specified, only get objects which were last updated by these users
   * @param {boolean} [revoked] if true, get revoked objects
   * @param {boolean} [deprecated] if true, get deprecated objects
   * @param {string[]} [excludeIDs] if specified, excludes these STIX IDs from the result
   * @returns {Observable<Campaign[]>} observable of retrieved objects
   */
  public get getAllCampaigns() {
    return this.getStixObjectsFactory<Campaign>('campaign');
  }
  /**
   * Get all assets
   * @param {number} [limit] the number of assets to retrieve
   * @param {number} [offset] the number of assets to skip
   * @param {string} [state] if specified, only get objects with this state
   * @param {string} [lastUpdatedBy] if specified, only get objects which were last updated by these users
   * @param {boolean} [revoked] if true, get revoked objects
   * @param {boolean} [deprecated] if true, get deprecated objects
   * @param {string[]} [excludeIDs] if specified, excludes these STIX IDs from the result
   * @returns {Observable<Asset[]>} observable of retrieved objects
   */
  public get getAllAssets() {
    return this.getStixObjectsFactory<Asset>('asset');
  }
  /**
   * Get all software
   * @param {number} [limit] the number of software to retrieve
   * @param {number} [offset] the number of software to skip
   * @param {string} [state] if specified, only get objects with this state
   * @param {string} [lastUpdatedBy] if specified, only get objects which were last updated by these users
   * @param {boolean} [revoked] if true, get revoked objects
   * @param {boolean} [deprecated] if true, get deprecated objects
   * @returns {Observable<Software[]>} observable of retrieved objects
   */
  public get getAllSoftware() {
    return this.getStixObjectsFactory<Software>('software');
  }
  /**
   * Get all mitigations
   * @param {number} [limit] the number of mitigations to retrieve
   * @param {number} [offset] the number of mitigations to skip
   * @param {string} [state] if specified, only get objects with this state
   * @param {string} [lastUpdatedBy] if specified, only get objects which were last updated by these users
   * @param {boolean} [revoked] if true, get revoked objects
   * @param {boolean} [deprecated] if true, get deprecated objects
   * @param {string[]} [excludeIDs] if specified, excludes these STIX IDs from the result
   * @returns {Observable<Mitigation[]>} observable of retrieved objects
   */
  public get getAllMitigations() {
    return this.getStixObjectsFactory<Mitigation>('mitigation');
  }
  /**
   * Get all data sources
   * @param {number} [limit] the number of data sources to retrieve
   * @param {number} [offset] the number of data sources to skip
   * @param {string} [state] if specified, only get objects with this state
   * @param {string} [lastUpdatedBy] if specified, only get objects which were last updated by these users
   * @param {boolean} [revoked] if true, get revoked objects
   * @param {boolean} [deprecated] if true, get deprecated objects
   * @param {string[]} [excludeIDs] if specified, excludes these STIX IDs from the result
   * @returns {Observable<DataSource[]>} observable of retrieved objects
   */
  public get getAllDataSources() {
    return this.getStixObjectsFactory<DataSource>('data-source');
  }
  /**
   * Get all data components
   * @param {number} [limit] the number of data components to retrieve
   * @param {number} [offset] the number of data components to skip
   * @param {string} [state] if specified, only get objects with this state
   * @param {string} [lastUpdatedBy] if specified, only get objects which were last updated by these users
   * @param {boolean} [revoked] if true, get revoked objects
   * @param {boolean} [deprecated] if true, get deprecated objects
   * @param {string[]} [excludeIDs] if specified, excludes these STIX IDs from the result
   * @returns {Observable<DataComponent[]>} observable of retrieved objects
   */
  public get getAllDataComponents() {
    return this.getStixObjectsFactory<DataComponent>('data-component');
  }
  /**
   * Get all detection strategies
   * @param {number} [limit] the number of detection strategies to retrieve
   * @param {number} [offset] the number of detection strategies to skip
   * @param {string} [state] if specified, only get objects with this state
   * @param {string} [lastUpdatedBy] if specified, only get objects which were last updated by these users
   * @param {boolean} [revoked] if true, get revoked objects
   * @param {boolean} [deprecated] if true, get deprecated objects
   * @param {string[]} [excludeIDs] if specified, excludes these STIX IDs from the result
   * @returns {Observable<DetectionStrategy[]>} observable of retrieved objects
   */
  public get getAllDetectionStrategies() {
    return this.getStixObjectsFactory<DetectionStrategy>('detection-strategy');
  }
  /**
   * Get all analytics
   * @param {number} [limit] the number of analytics to retrieve
   * @param {number} [offset] the number of analytics to skip
   * @param {string} [state] if specified, only get objects with this state
   * @param {string} [lastUpdatedBy] if specified, only get objects which were last updated by these users
   * @param {boolean} [revoked] if true, get revoked objects
   * @param {boolean} [deprecated] if true, get deprecated objects
   * @param {string[]} [excludeIDs] if specified, excludes these STIX IDs from the result
   * @returns {Observable<Analytic[]>} observable of retrieved objects
   */
  public get getAllAnalytics() {
    return this.getStixObjectsFactory<Analytic>('analytic');
  }
  /**
   * Get all matrices
   * @param {number} [limit] the number of matrices to retrieve
   * @param {number} [offset] the number of matrices to skip
   * @param {string} [state] if specified, only get objects with this state
   * @param {string} [lastUpdatedBy] if specified, only get objects which were last updated by these users
   * @param {boolean} [revoked] if true, get revoked objects
   * @param {boolean} [deprecated] if true, get deprecated objects
   * @param {string[]} [excludeIDs] if specified, excludes these STIX IDs from the result
   * @returns {Observable<Matrix[]>} observable of retrieved objects
   */
  public get getAllMatrices() {
    return this.getStixObjectsFactory<Matrix>('matrix');
  }
  /**
   * Get all collections
   * @param {number} [limit] the number of collections to retrieve
   * @param {number} [offset] the number of collections to skip
   * @param {string} [state] if specified, only get objects with this state
   * @param {string} [lastUpdatedBy] if specified, only get objects which were last updated by these users
   * @param {boolean} [revoked] if true, get revoked objects
   * @param {versions} ["all" | "latest"] if "all", get all versions of the collections. if "latest", only get the latest version of each collection.
   * @param {boolean} [deprecated] if true, get deprecated objects
   * @param {string[]} [excludeIDs] if specified, excludes these STIX IDs from the result
   * @returns {Observable<Collection[]>} observable of retrieved objects
   */
  public get getAllCollections() {
    return this.getStixObjectsFactory<Collection>('collection');
  }
  /**
   * Get all marking definitions
   * @param {number} [limit] the number of marking definitions to retrieve
   * @param {number} [offset] the number of marking definitions to skip
   * @param {string} [state] if specified, only get objects with this state
   * @param {string} [lastUpdatedBy] if specified, only get objects which were last updated by these users
   * @param {boolean} [revoked] if true, get revoked objects
   * @param {versions} ["all" | "latest"] if "all", get all versions of the marking definitions. if "latest", only get the latest version of each collection.
   * @param {boolean} [deprecated] if true, get deprecated objects
   * @param {string[]} [excludeIDs] if specified, excludes these STIX IDs from the result
   * @returns {Observable<MarkingDefinition[]>} observable of retrieved objects
   */
  public get getAllMarkingDefinitions() {
    return this.getStixObjectsFactory<MarkingDefinition>('marking-definition');
  }
  /**
   * Get all notes
   * @param {number} [limit] the number of notes to retrieve
   * @param {number} [offset] the number of notes to skip
   * @param {string} [state] if specified, only get objects with this state
   * @param {string} [lastUpdatedBy] if specified, only get objects which were last updated by these users
   * @param {boolean} [revoked] if true, get revoked objects
   * @param {boolean} [deprecated] if true, get deprecated objects
   * @param {string[]} [excludeIDs] if specified, excludes these STIX IDs from the result
   * @returns {Observable<Note[]>} observable of retrieved objects
   */
  public get getAllNotes() {
    return this.getStixObjectsFactory<Note>('note');
  }
  /**
   * Get all identities
   * @param {number} [limit] the number of identities to retrieve
   * @param {number} [offset] the number of identities to skip
   * @param {string} [state] if specified, only get objects with this state
   * @param {string} [lastUpdatedBy] if specified, only get objects which were last updated by these users
   * @param {boolean} [revoked] if true, get revoked objects
   * @param {boolean} [deprecated] if true, get deprecated objects
   * @param {string[]} [excludeIDs] if specified, excludes these STIX IDs from the result
   * @returns {Observable<Identity[]>} observable of retrieved objects
   */
  public get getAllIdentities() {
    return this.getStixObjectsFactory<Identity>('identity');
  }
  /**
   * Get all relationships
   * @param {number} [limit] the number of techniques to retrieve
   * @param {number} [offset] the number of techniques to skip
   * @param {string} [state] if specified, only get objects with this state
   * @param {boolean} [includeRevoked] if true, get revoked objects
   * @param {boolean} [includeDeprecated] if true, get deprecated objects
   * @param {"all" | "latest"} [versions] if "all", get all versions of the objects. if "latest", only get the latest version of each object
   * @param {string} [lastUpdatedBy] if specified, only get objects which were last updated by these users
   * @param {string[]} [excludeIDs] if specified, excludes these STIX IDs from the result
   * @param {string} [search] if specified, return objects where the query occurs in the name, description, or ATT&CK ID; the search is case-insensitive
   * @param {string[]} [platforms] if specified, retrieve objects that contain the specified platform(s)
   * @param {string[]} [domains] if specified, retrieve objects that contain the specified domain(s)
   * @returns {Observable<Relationships[]>} observable of retrieved objects
   */
  public get getAllRelationships() {
    return this.getStixObjectsFactory<Relationship>('relationship');
  }

  /**
   * Get all objects; objects will not be deserialized to STIX objects unless the parameter is used
   * @param {string[]} [attackIDs] filter to only include objects within the list of given ATT&CK IDs
   * @param {number} [limit] the number of collections to retrieve
   * @param {number} [offset] the number of collections to skip
   * @param {string} [state] if specified, only get objects with this state
   * @param {boolean} [revoked] if true, get revoked objects
   * @param {boolean} [deprecated] if true, get deprecated objects
   * @param {boolean} [deserialize] if true, deserialize objects to full STIX objects
   * @param {string[]} [lastUpdatedBy] filter to only include objects modified by the list of given user IDs
   * @param {string} [search] if specified, return objects where the query occurs in the name, description, or ATT&CK ID; the search is case-insensitive
   * @returns {Observable<any[]>} observable of retrieved objects
   */
  public getAllObjects(options?: {
    attackIDs?: string[];
    limit?: number;
    offset?: number;
    state?: string;
    revoked?: boolean;
    deprecated?: boolean;
    deserialize?: boolean;
    lastUpdatedBy?: string[];
    search?: string;
  }) {
    let query = new HttpParams({ encoder: new CustomEncoder() });

    // pagination
    if (options?.limit) query = query.set('limit', options.limit.toString());
    if (options?.offset) query = query.set('offset', options.offset.toString());
    if (options?.limit || options?.offset)
      query = query.set('includePagination', 'true');
    // ATT&CK ID filter
    if (options?.attackIDs) {
      options.attackIDs.forEach(id => (query = query.append('attackId', id)));
    }
    // object state
    if (options?.state) query = query.set('state', options.state);
    if (options?.revoked)
      query = query.set('includeRevoked', options.revoked ? 'true' : 'false');
    if (options?.deprecated)
      query = query.set(
        'includeDeprecated',
        options.deprecated ? 'true' : 'false'
      );
    // searching
    if (options?.search) query = query.set('search', options.search);
    // lastUpdatedBy
    if (options?.lastUpdatedBy)
      options.lastUpdatedBy.forEach(
        user => (query = query.append('lastUpdatedBy', user))
      );

    return this.http
      .get(`${this.apiUrl}/attack-objects`, { params: query })
      .pipe(
        tap(results => logger.log(`retrieved ATT&CK objects`, results)), // on success, trigger the success notification
        map(results => {
          if (!options?.deserialize) return results; //skip deserialization if param not added
          const response = results as any;
          if (options?.limit || options?.offset) {
            // returned a paginated
            let data = response.data as any[];
            data = data
              .filter(
                y => !['marking-definition', 'identity'].includes(y.stix.type)
              )
              .map(y => {
                if (y.stix.type == 'malware' || y.stix.type == 'tool')
                  return new Software(y.stix.type, y);
                else return new StixTypeToClass[y.stix.type](y);
              });
            response.data = data;
            return response;
          } else {
            //returned a stixObject[]
            return {
              pagination: {
                total: response.length,
                limit: -1,
                offset: -1,
              },
              data: response
                .filter(
                  y => !['marking-definition', 'identity'].includes(y.stix.type)
                )
                .map(y => {
                  if (y.stix.type == 'malware' || y.stix.type == 'tool')
                    return new Software(y.stix.type, y);
                  else return new StixTypeToClass[y.stix.type](y);
                }),
            };
          }
        }),
        catchError(this.handleError_continue([])), // on error, trigger the error notification and continue operation without crashing (returns empty item)
        share() // multicast so that multiple subscribers don't trigger the call twice. THIS MUST BE THE LAST LINE OF THE PIPE
      );
  }

  /**
   * Get all recent activity
   * @param {number} [limit] the number of collections to retrieve
   * @param {number} [offset] the number of collections to skip
   * @param {boolean} [revoked] if true, get revoked objects
   * @param {boolean} [deprecated] if true, get deprecated objects
   * @param {boolean} [deserialize] if true, deserialize objects to full STIX objects
   * @param {string[]} [lastUpdatedBy] filter to only include objects modified by the list of given user IDs
   * @returns {Observable<any[]>} observable of retrieved objects
   */
  public getRecentActivity(
    limit?: number,
    offset?: number,
    revoked?: boolean,
    deprecated?: boolean,
    deserialize?: boolean,
    lastUpdatedBy?: string[]
  ) {
    let query = new HttpParams({ encoder: new CustomEncoder() });
    // pagination
    if (limit) query = query.set('limit', limit.toString());
    if (offset) query = query.set('offset', offset.toString());
    if (limit || offset) query = query.set('includePagination', 'true');
    // object state
    if (revoked)
      query = query.set('includeRevoked', revoked ? 'true' : 'false');
    if (deprecated)
      query = query.set('includeDeprecated', deprecated ? 'true' : 'false');
    // lastUpdatedBy
    if (lastUpdatedBy)
      lastUpdatedBy.forEach(
        user => (query = query.append('lastUpdatedBy', user))
      );
    return this.http
      .get(`${this.apiUrl}/recent-activity`, { params: query })
      .pipe(
        tap(results => logger.log(`retrieved recent activity`, results)), // on success, trigger the success notification
        map(results => {
          if (!deserialize) return results; // skip deserialization if param not added
          const response = results as any;
          if (limit || offset) {
            // returned a paginated
            let data = response.data as any[];
            data = data
              .filter(
                y => !['marking-definition', 'identity'].includes(y.stix.type)
              )
              .map(y => {
                if (y.stix.type == 'malware' || y.stix.type == 'tool')
                  return new Software(y.stix.type, y);
                else return new StixTypeToClass[y.stix.type](y);
              });
            response.data = data;
            return response;
          } else {
            //returned a stixObject[]
            return {
              pagination: {
                total: response.length,
                limit: -1,
                offset: -1,
              },
              data: response
                .filter(
                  y => !['marking-definition', 'identity'].includes(y.stix.type)
                )
                .map(y => {
                  if (y.stix.type == 'malware' || y.stix.type == 'tool')
                    return new Software(y.stix.type, y);
                  else return new StixTypeToClass[y.stix.type](y);
                }),
            };
          }
        }),
        catchError(this.handleError_continue([])), // on error, trigger the error notification and continue operation without crashing (returns empty item)
        share() // multicast so that multiple subscribers don't trigger the call twice. THIS MUST BE THE LAST LINE OF THE PIPE
      );
  }

  public getCollectionStream(
    id: string,
    modified?: Date | string,
    retrieveContents = true
  ): {
    collection$: Observable<Collection>;
    streamProgress$: Observable<StreamProgress>;
  } {
    const collectionStreamProgress$ = new Subject<StreamProgress>();
    const modifiedString =
      typeof modified === 'string' ? modified : modified?.toISOString();

    let url = `${this.apiUrl}/collections/${id}`;
    if (modifiedString) {
      url += `/modified/${modifiedString}`;
    }
    url += `?retrieveContents=${retrieveContents}&stream=true`;

    logger.log('Streaming collection from:', url);

    // Create collection with the correct stixID to prevent UUID generation
    const collection = new Collection({
      stix: {
        id: id,
        type: 'x-mitre-collection',
      },
    });
    collection.streaming = true;
    collection.stix_contents = [];
    let expectedCount = 0;

    const collection$ = this.collectionStreamService.streamCollection(url).pipe(
      tap(data => {
        switch (data.type) {
          case 'collection':
            // Update collection metadata
            collection.deserialize(data.data);
            logger.log('Received collection metadata');
            break;

          case 'contentCount':
            expectedCount = data.count || 0;
            logger.log(`Expecting ${expectedCount} content objects`);
            collectionStreamProgress$.next({
              total: expectedCount,
              loaded: 0,
              percentage: 0,
            });
            break;

          case 'content':
            if (data.position !== undefined && data.object) {
              collection.hydrateContent(data.object);
              const loaded = collection.stix_contents.length;
              const percentage =
                expectedCount > 0
                  ? Math.round((loaded / expectedCount) * 100)
                  : 0;
              collectionStreamProgress$.next({
                total: expectedCount,
                loaded,
                percentage,
              });
            }
            break;
        }
      }),
      // Only emit when we have the collection metadata
      filter(data => data.type === 'collection' || data.type === 'content'),
      map(() => collection),
      finalize(() => {
        collection.streaming = false;
        logger.log(
          'Stream complete, total objects:',
          collection.stix_contents.length
        );
        collectionStreamProgress$.complete();
      }),
      catchError(err => {
        logger.error('Stream error:', err);
        collection.streaming = false;
        collectionStreamProgress$.error(err);
        return throwError(() => err);
      })
    );

    return {
      collection$,
      streamProgress$: collectionStreamProgress$.asObservable(),
    };
  }

  /**
   * Factory to create a new STIX get by ID function
   * @template T the type to get
   * @param {AttackType} attackType the type to get
   * @returns getter function
   */
  private getStixObjectFactory<T extends StixObject>(attackType: AttackType) {
    const attackClass = AttackTypeToClass[attackType];
    const plural = AttackTypeToPlural[attackType];
    return function <P extends T>(
      id: string,
      modified?: Date | string,
      versions = 'latest',
      includeSubs?: boolean,
      retrieveContents?: boolean,
      retrieveDataComponents?: boolean,
      options?: {
        preferStream?: boolean;
        includeRefs?: boolean;
      }
    ): Observable<P[]> {
      // For streaming collections, delegate to a separate method
      if (
        attackType === 'collection' &&
        options?.preferStream &&
        retrieveContents &&
        versions === 'latest'
      ) {
        return this.getCollectionStream(id, modified, true).pipe(
          map(collection => [collection]),
          catchError(err => {
            logger.warn(
              'Streaming failed, falling back to traditional load:',
              err
            );
            // Call the original implementation as fallback (without preferStream)
            return this.getCollection(
              id,
              modified,
              versions,
              includeSubs,
              retrieveContents,
              retrieveDataComponents
            );
          })
        );
      }

      // Continue with existing non-streaming implementation
      let url = `${this.apiUrl}/${plural}/${id}`;
      if (modified) {
        const modifiedString =
          typeof modified == 'string' ? modified : modified.toISOString();
        url += `/modified/${modifiedString}`;
      }
      let query = new HttpParams();
      if (versions != 'latest') query = query.set('versions', versions);
      if (attackType == 'collection' && retrieveContents)
        query = query.set('retrieveContents', 'true');
      if (attackType == 'data-source' && retrieveDataComponents)
        query = query.set('retrieveDataComponents', 'true');
      // include related objects in a `related_to` array
      if (options?.includeRefs) query = query.set('includeRefs', 'true');
      return this.http.get(url, { headers: this.headers, params: query }).pipe(
        tap(result => logger.log(`retrieved ${attackType}`, result)), // on success, trigger the success notification
        map(result => {
          let x = result as any;
          if (Array.isArray(result) && result.length == 0) {
            logger.warn('empty result');
            return [];
          }
          if (!Array.isArray(result)) x = [x];
          return x.map(y => {
            if (y.stix.type == 'malware' || y.stix.type == 'tool')
              return new Software(y.stix.type, y);
            else return new attackClass(y);
          });
        }),
        switchMap(result => {
          // add sub-technique or parent-technique but only if it's a technique
          if (!includeSubs) return of(result);
          const x = result as any[];
          if (x[0].attackType != 'technique') return of(result); //don't transform non-techniques
          const t = x[0] as Technique;
          if (t.is_subtechnique) {
            //add parent technique
            return this.getRelatedTo({
              sourceRef: t.stixID,
              relationshipType: 'subtechnique-of',
            }).pipe(
              // fetch from REST API
              map(rel => {
                //extract the parent from the relationship
                const p = rel as any;
                if (!p || p.data.length == 0) return null; // no parent technique
                return new Technique(p.data[0].target_object); //transform it to a Technique
              }),
              map(parent => {
                //add the parent to the sub-technique
                const p = parent as any;
                t.parentTechnique = p;
                return [t];
              }),
              tap(result =>
                logger.log(
                  'fetched parent technique of',
                  result,
                  result[0]['parentTechnique']
                )
              )
            );
          } else {
            // add subtechniques
            return this.getRelatedTo({
              targetRef: t.stixID,
              relationshipType: 'subtechnique-of',
            }).pipe(
              // fetch from REST API
              map(rel => {
                //extract the sub-techniques from the relationships
                const s = rel as any;
                return s.data.map(rel => new Technique(rel.source_object)); //transform them to Techniques
              }),
              map(subs => {
                //add the sub-techniques to the parent
                const s = subs as any[];
                t.subTechniques = s;
                return [t];
              }),
              tap(result =>
                logger.log(
                  'fetched sub-techniques of',
                  result,
                  result[0]['subTechniques']
                )
              )
            );
          }
        }),
        switchMap(result => {
          // fetch parent data source of data component
          const x = result as any[];
          if (!x[0] || x[0].attackType != 'data-component') return of(result);

          const d = x[0] as DataComponent;
          // if no data source ref, just return the data component
          if (!d.dataSourceRef) return of([d]);
          // otherwise, fetch the parent data source
          return this.getDataSource(d.dataSourceRef).pipe(
            // fetch data source from REST API
            map(data_source => {
              const ds = data_source as DataSource[];
              d.data_source = ds[0];
              return [d];
            }),
            tap(data_component =>
              logger.log('fetched data source of', data_component)
            )
          );
        }),
        catchError(this.handleError_continue([])), // on error, trigger the error notification and continue operation without crashing (returns empty item)
        share() // multicast so that multiple subscribers don't trigger the call twice. THIS MUST BE THE LAST LINE OF THE PIPE
      );
    };
  }
  /**
   * Get a single technique by STIX ID
   * @param {string} id the object STIX ID
   * @param {Date} [modified] if specified, get the version modified at the given date
   * @param {versions} [string] default "latest", if "all" returns all versions of the object instead of just the latest version. Incompatible with includeSubs
   * @param {includeSubs} [boolean] if true, include sub-techniques/parent-technique attached to the given object. Incompatible with versions="all"
   * @returns {Observable<Technique>} the object with the given ID and modified date
   */
  public get getTechnique() {
    return this.getStixObjectFactory<Technique>('technique');
  }
  /**
   * Get a single tactic by STIX ID
   * @param {string} id the object STIX ID
   * @param {Date} [modified] if specified, get the version modified at the given date
   * * @param {versions} [string] default "latest", if "all" returns all versions of the object instead of just the latest version.
   * @returns {Observable<Tactic>} the object with the given ID and modified date
   */
  public get getTactic() {
    return this.getStixObjectFactory<Tactic>('tactic');
  }
  /**
   * Get a single group by STIX ID
   * @param {string} id the object STIX ID
   * @param {Date} [modified] if specified, get the version modified at the given date
   * * @param {versions} [string] default "latest", if "all" returns all versions of the object instead of just the latest version.
   * @returns {Observable<Group>} the object with the given ID and modified date
   */
  public get getGroup() {
    return this.getStixObjectFactory<Group>('group');
  }
  /**
   * Get a single campaign by STIX ID
   * @param {string} id the object STIX ID
   * @param {Date} [modified] if specified, get the version modified at the given date
   * * @param {versions} [string] default "latest", if "all" returns all versions of the object instead of just the latest version.
   * @returns {Observable<Campaign>} the object with the given ID and modified date
   */
  public get getCampaign() {
    return this.getStixObjectFactory<Campaign>('campaign');
  }
  /**
   * Get a single asset by STIX ID
   * @param {string} id the object STIX ID
   * @param {Date} [modified] if specified, get the version modified at the given date
   * * @param {versions} [string] default "latest", if "all" returns all versions of the object instead of just the latest version.
   * @returns {Observable<Asset>} the object with the given ID and modified date
   */
  public get getAsset() {
    return this.getStixObjectFactory<Asset>('asset');
  }
  /**
   * Get a single software by STIX ID
   * @param {string} id the object STIX ID
   * @param {Date} [modified] if specified, get the version modified at the given date
   * @param {versions} [string] default "latest", if "all" returns all versions of the object instead of just the latest version.
   * @returns {Observable<Software>} the object with the given ID and modified date
   */
  public get getSoftware() {
    return this.getStixObjectFactory<Software>('software');
  }
  /**
   * Get a single mitigation by STIX ID
   * @param {string} id the object STIX ID
   * @param {Date} [modified] if specified, get the version modified at the given date
   * @param {versions} [string] default "latest", if "all" returns all versions of the object instead of just the latest version.
   * @returns {Observable<Mitigation>} the object with the given ID and modified date
   */
  public get getMitigation() {
    return this.getStixObjectFactory<Mitigation>('mitigation');
  }
  /**
   * Get a single data source by STIX ID
   * @param {string} id the object STIX ID
   * @param {Date} [modified] if specified, get the version modified at the given date
   * @param {versions} [string] default "latest", if "all" returns all versions of the object instead of just the latest version.
   * @param {retrieveDataComponents} [boolean] if true, include data components with a reference to the given object. Incompatible with versions="all"
   * @returns {Observable<DataSource>} the object with the given ID and modified date
   */
  public get getDataSource() {
    return this.getStixObjectFactory<DataSource>('data-source');
  }
  /**
   * Get a single data component by STIX ID
   * @param {string} id the object STIX ID
   * @param {Date} [modified] if specified, get the version modified at the given date
   * @param {versions} [string] default "latest", if "all" returns all versions of the object instead of just the latest version.
   * @returns {Observable<DataComponent>} the object with the given ID and modified date
   */
  public get getDataComponent() {
    return this.getStixObjectFactory<DataComponent>('data-component');
  }
  /**
   * Get a single detection strategy by STIX ID
   * @param {string} id the object STIX ID
   * @param {Date} [modified] if specified, get the version modified at the given date
   * @param {versions} [string] default "latest", if "all" returns all versions of the object instead of just the latest version.
   * @returns {Observable<DetectionStrategy>} the object with the given ID and modified date
   */
  public get getDetectionStrategy() {
    return this.getStixObjectFactory<DetectionStrategy>('detection-strategy');
  }
  /**
   * Get a single analytic by STIX ID
   * @param {string} id the object STIX ID
   * @param {Date} [modified] if specified, get the version modified at the given date
   * @param {versions} [string] default "latest", if "all" returns all versions of the object instead of just the latest version.
   * @returns {Observable<Analytic>} the object with the given ID and modified date
   */
  public get getAnalytic() {
    return this.getStixObjectFactory<Analytic>('analytic');
  }
  /**
   * Get a single matrix by STIX ID
   * @param {string} id the object STIX ID
   * @param {Date} [modified] if specified, get the version modified at the given date
   * @param {versions} [string] default "latest", if "all" returns all versions of the object instead of just the latest version.
   * @returns {Observable<Matrix>} the object with the given ID and modified date
   */
  public get getMatrix() {
    return this.getStixObjectFactory<Matrix>('matrix');
  }
  /**
   * Get a single collection by STIX ID
   * This is the existing getter that uses the factory
   * @param {string} id the object STIX ID
   * @param {Date} [modified] if specified, get the version modified at the given date
   * @param {versions} [string] default "latest", if "all" returns all versions of the object instead of just the latest version.
   * @param {includeSubs} [boolean] not used for collections
   * @param {retrieveContents} [boolean] if true, retrieve the collection with its contents
   * @param {retrieveDataComponents} [boolean] not used for collections
   * @param {options} [object] additional options, including preferStream for streaming support
   * @returns {Observable<Collection>} the object with the given ID and modified date
   */
  public get getCollection() {
    return this.getStixObjectFactory<Collection>('collection');
  }
  /**
   * Get a single note by STIX ID
   * @param {string} id the object STIX ID
   * @param {Date} [modified] if specified, get the version modified at the given date
   * @param {versions} [string] default "latest", if "all" returns all versions of the object instead of just the latest version.
   * @returns {Observable<Note>} the object with the given ID and modified date
   */
  public get getNote() {
    return this.getStixObjectFactory<Note>('note');
  }
  /**
   * Get a single identity by STIX ID
   * @param {string} id the object STIX ID
   * @param {Date} [modified] if specified, get the version modified at the given date
   * @param {versions} [string] default "latest", if "all" returns all versions of the object instead of just the latest version.
   * @returns {Observable<Identity>} the object with the given ID and modified date
   */
  public get getIdentity() {
    return this.getStixObjectFactory<Identity>('identity');
  }
  /**
   * Get a single marking definition by STIX ID
   * @param {string} id the object STIX ID
   * @returns {Observable<MarkingDefinition>} the object with the given ID
   */
  public get getMarkingDefinition() {
    return this.getStixObjectFactory<MarkingDefinition>('marking-definition');
  }

  /**
   * Factory to create a new STIX object creator (POST) function
   * @template T the type to create
   * @param {AttackType} attackType the type to create
   * @returns creator (POST) function
   */
  private postStixObjectFactory<T extends StixObject>(attackType: AttackType) {
    const attackClass = AttackTypeToClass[attackType];
    const plural = AttackTypeToPlural[attackType];
    return function <P extends T>(object: P): Observable<P> {
      const url = `${this.apiUrl}/${plural}`;
      let params = new HttpParams();

      // add parentTechniqueId for sub-techniques
      if (attackType == 'technique') {
        const technique = object as StixObject as Technique;
        if (technique.is_subtechnique && technique.parentTechnique) {
          params = params.set(
            'parentTechniqueId',
            technique.parentTechnique.attackID
          );
        }
      }
      return this.http
        .post(url, object.serialize(), {
          headers: this.headers,
          params: params,
        })
        .pipe(
          tap(this.handleSuccess(`${this.getObjectName(object)} saved`)),
          map(result => {
            const x = result as any;
            if (x.stix.type == 'malware' || x.stix.type == 'tool')
              return new Software(x.stix.type, x);
            else return new attackClass(x);
          }),
          catchError(this.handleError_raise()),
          share() // multicast so that multiple subscribers don't trigger the call twice. THIS MUST BE THE LAST LINE OF THE PIPE
        );
    };
  }

  /**
   * Factory to create a STIX object validator via dryRun POST.
   *
   * Posts the serialized object to its type-specific endpoint with ?dryRun=true,
   * which runs the full create pipeline (compose, validate) without persisting.
   * Normalizes the response into { errors, warnings } for the caller.
   *
   * @template T the type to validate
   * @returns validator function
   */
  public validateStixObject<T extends StixObject>() {
    return <P extends T>(object: P): Observable<any> => {
      const plural = AttackTypeToPlural[object.attackType];
      const url = `${this.apiUrl}/${plural}`;
      let params = new HttpParams().set('dryRun', 'true');

      // add parentTechniqueId for sub-techniques
      if (object.attackType == 'technique') {
        const technique = object as StixObject as Technique;
        if (technique.is_subtechnique && technique.parentTechnique) {
          params = params.set(
            'parentTechniqueId',
            technique.parentTechnique.attackID
          );
        }
      }

      return this.http.post(url, object.serialize(), { params }).pipe(
        // Success (200): validation passed, extract warnings only
        map(result => ({
          errors: [],
          warnings: (result as any).warnings || [],
        })),
        catchError((error: any) => {
          // Validation failure (400): normalize errors and warnings into expected shape
          if (error.status === 400 && error.error?.details) {
            return of({
              errors: error.error.details,
              warnings: error.error.warnings || [],
            });
          }
          // Non-validation errors: re-raise
          return throwError(error);
        }),
        share()
      );
    };
  }
  /**
   * POST (create) a new technique
   * @param {Technique} object the object to create
   * @returns {Observable<Technique>} the created object
   */
  public get postTechnique() {
    return this.postStixObjectFactory<Technique>('technique');
  }
  /**
   * POST (create) a new tactic
   * @param {Tactic} object the object to create
   * @returns {Observable<Tactic>} the created object
   */
  public get postTactic() {
    return this.postStixObjectFactory<Tactic>('tactic');
  }
  /**
   * POST (create) a new group
   * @param {Group} object the object to create
   * @returns {Observable<Group>} the created object
   */
  public get postGroup() {
    return this.postStixObjectFactory<Group>('group');
  }
  /**
   * POST (create) a new campaign
   * @param {Campaign} object the object to create
   * @returns {Observable<Campaign>} the created object
   */
  public get postCampaign() {
    return this.postStixObjectFactory<Campaign>('campaign');
  }
  /**
   * POST (create) a new asset
   * @param {Asset} object the object to create
   * @returns {Observable<Asset>} the created object
   */
  public get postAsset() {
    return this.postStixObjectFactory<Asset>('asset');
  }
  /**
   * POST (create) a new software
   * @param {Software} object the object to create
   * @returns {Observable<Software>} the created object
   */
  public get postSoftware() {
    return this.postStixObjectFactory<Software>('software');
  }
  /**
   * POST (create) a new mitigation
   * @param {Mitigation} object the object to create
   * @returns {Observable<Mitigation>} the created object
   */
  public get postMitigation() {
    return this.postStixObjectFactory<Mitigation>('mitigation');
  }
  /**
   * POST (create) a new data source
   * @param {DataSource} object the object to create
   * @returns {Observable<DataSource>} the created object
   */
  public get postDataSource() {
    return this.postStixObjectFactory<DataSource>('data-source');
  }
  /**
   * POST (create) a new data component
   * @param {DataComponent} object the object to create
   * @returns {Observable<DataComponent>} the created object
   */
  public get postDataComponent() {
    return this.postStixObjectFactory<DataComponent>('data-component');
  }
  /**
   * POST (create) a new detection strategy
   * @param {DetectionStrategy} object the object to create
   * @returns {Observable<DetectionStrategy>} the created object
   */
  public get postDetectionStrategy() {
    return this.postStixObjectFactory<DetectionStrategy>('detection-strategy');
  }
  /**
   * POST (create) a new analytic
   * @param {Analytic} object the object to create
   * @returns {Observable<Analytic>} the created object
   */
  public get postAnalytic() {
    return this.postStixObjectFactory<Analytic>('analytic');
  }
  /**
   * POST (create) a new matrix
   * @param {Matrix} object the object to create
   * @returns {Observable<Matrix>} the created object
   */
  public get postMatrix() {
    return this.postStixObjectFactory<Matrix>('matrix');
  }
  /**
   * POST (create) a new relationship
   * @param {Relationship} object the object to create
   * @returns {Observable<Relationship>} the created object
   */
  public get postRelationship() {
    return this.postStixObjectFactory<Relationship>('relationship');
  }
  /**
   * POST (create) a new relationship
   * @param {MarkingDefinition} object the object to create
   * @returns {Observable<MarkingDefinition>} the created object
   */
  public get postMarkingDefinition() {
    return this.postStixObjectFactory<MarkingDefinition>('marking-definition');
  }
  /**
   * POST (create) a new note
   * @param {Note} object the object to create
   * @returns {Observable<Note>} the created object
   */
  public get postNote() {
    return this.postStixObjectFactory<Note>('note');
  }
  /**
   * POST (create) a new collection
   * @param {Collection} object the object to create
   * @returns {Observable<Collection>} the created object
   */
  public get postCollection() {
    return this.postStixObjectFactory<Collection>('collection');
  }
  /**
   * POST (create) a new identity
   * @param {Identity} object the object to create
   * @returns {Observable<Identity>} the created object
   */
  public get postIdentity() {
    return this.postStixObjectFactory<Identity>('identity');
  }

  /**
   * Factory to create a new STIX put (update) function
   * @template T the type to put
   * @param {AttackType} attackType the type to put
   * @returns put function
   */
  private putStixObjectFactory<T extends StixObject>(attackType: AttackType) {
    const attackClass = AttackTypeToClass[attackType];
    const plural = AttackTypeToPlural[attackType];
    return function <P extends T>(object: T, modified?: Date): Observable<P> {
      if (!modified) modified = object.modified; //infer modified from STIX object modified date
      const url = `${this.apiUrl}/${plural}/${object.stixID}/modified/${modified.toISOString()}`;
      const rep = object.serialize(modified.toISOString());
      return this.http.put(url, rep, { headers: this.headers }).pipe(
        tap(this.handleSuccess(`${this.getObjectName(object)} saved`)),
        map(result => {
          const x = result as any;
          if (x.stix.type == 'malware' || x.stix.type == 'tool')
            return new Software(x.stix.type, x);
          else return new attackClass(x);
        }),
        catchError(this.handleError_raise()),
        share() // multicast so that multiple subscribers don't trigger the call twice. THIS MUST BE THE LAST LINE OF THE PIPE
      );
    };
  }

  /**
   * PUT (update) a technique
   * @param {Technique} object the object to update
   * @param {Date} [modified] optional, the modified date to overwrite. If omitted, uses the modified field of the object
   * @returns {Observable<Technique>} the updated object
   */
  public get putTechnique() {
    return this.putStixObjectFactory<Technique>('technique');
  }
  /**
   * PUT (update) a tactic
   * @param {Tactic} object the object to update
   * @param {Date} [modified] optional, the modified date to overwrite. If omitted, uses the modified field of the object
   * @returns {Observable<Tactic>} the updated object
   */
  public get putTactic() {
    return this.putStixObjectFactory<Tactic>('tactic');
  }
  /**
   * PUT (update) a group
   * @param {Group} object the object to update
   * @param {Date} [modified] optional, the modified date to overwrite. If omitted, uses the modified field of the object
   * @returns {Observable<Group>} the updated object
   */
  public get putGroup() {
    return this.putStixObjectFactory<Group>('group');
  }
  /**
   * PUT (update) a campaign
   * @param {Campaign} object the object to update
   * @param {Date} [modified] optional, the modified date to overwrite. If omitted, uses the modified field of the object
   * @returns {Observable<Campaign>} the updated object
   */
  public get putCampaign() {
    return this.putStixObjectFactory<Campaign>('campaign');
  }
  /**
   * PUT (update) an asset
   * @param {Asset} object the object to update
   * @param {Date} [modified] optional, the modified date to overwrite. If omitted, uses the modified field of the object
   * @returns {Observable<Asset>} the updated object
   */
  public get putAsset() {
    return this.putStixObjectFactory<Asset>('asset');
  }
  /**
   * PUT (update) a software
   * @param {Software} object the object to update
   * @param {Date} [modified] optional, the modified date to overwrite. If omitted, uses the modified field of the object
   * @returns {Observable<Software>} the updated object
   */
  public get putSoftware() {
    return this.putStixObjectFactory<Software>('software');
  }
  /**
   * PUT (update) a mitigation
   * @param {Mitigation} object the object to update
   * @param {Date} [modified] optional, the modified date to overwrite. If omitted, uses the modified field of the object
   * @returns {Observable<Mitigation>} the updated object
   */
  public get putMitigation() {
    return this.putStixObjectFactory<Mitigation>('mitigation');
  }
  /**
   * PUT (update) a data source
   * @param {DataSource} object the object to update
   * @param {Date} [modified] optional, the modified date to overwrite. If omitted, uses the modified field of the object
   * @returns {Observable<DataSource>} the updated object
   */
  public get putDataSource() {
    return this.putStixObjectFactory<DataSource>('data-source');
  }
  /**
   * PUT (update) a data component
   * @param {DataComponent} object the object to update
   * @param {Date} [modified] optional, the modified date to overwrite. If omitted, uses the modified field of the object
   * @returns {Observable<DataComponent>} the updated object
   */
  public get putDataComponent() {
    return this.putStixObjectFactory<DataComponent>('data-component');
  }
  /**
   * PUT (update) a detection strategy
   * @param {DetectionStrategy} object the object to update
   * @param {Date} [modified] optional, the modified date to overwrite. If omitted, uses the modified field of the object
   * @returns {Observable<DetectionStrategy>} the updated object
   */
  public get putDetectionStrategy() {
    return this.putStixObjectFactory<DetectionStrategy>('detection-strategy');
  }
  /**
   * PUT (update) an analytic
   * @param {Analytic} object the object to update
   * @param {Date} [modified] optional, the modified date to overwrite. If omitted, uses the modified field of the object
   * @returns {Observable<Analytic>} the updated object
   */
  public get putAnalytic() {
    return this.putStixObjectFactory<Analytic>('analytic');
  }
  /**
   * PUT (update) a matrix
   * @param {Matrix} object the object to update
   * @param {Date} [modified] optional, the modified date to overwrite. If omitted, uses the modified field of the object
   * @returns {Observable<Matrix>} the updated object
   */
  public get putMatrix() {
    return this.putStixObjectFactory<Matrix>('matrix');
  }
  /**
   * PUT (update) a relationship
   * @param {Relationship} object the object to update
   * @param {Date} [modified] optional, the modified date to overwrite. If omitted, uses the modified field of the object
   * @returns {Observable<Relationship>} the updated object
   */
  public get putRelationship() {
    return this.putStixObjectFactory<Relationship>('relationship');
  }
  /**
   * PUT (update) a note
   * @param {Note} object the object to update
   * @param {Date} [modified] optional, the modified date to overwrite. If omitted, uses the modified field of the object
   * @returns {Observable<Note>} the updated object
   */
  public get putNote() {
    return this.putStixObjectFactory<Note>('note');
  }
  /**
   * PUT (update) an identity
   * @param {Identity} object the object to update
   * @param {Date} [modified] optional, the modified date to overwrite. If omitted, uses the modified field of the object
   * @returns {Observable<Identity>} the updated object
   */
  public get putIdentity() {
    return this.putStixObjectFactory<Identity>('identity');
  }

  private deleteStixObjectFactory(attackType: AttackType) {
    const plural = AttackTypeToPlural[attackType];
    return function (id: string): Observable<{}> {
      const url = `${this.apiUrl}/${plural}/${id}`;
      return this.http.delete(url).pipe(
        tap(this.handleSuccess(`${attackType} deleted`)),
        catchError(this.handleError_raise()),
        share() // multicast so that multiple subscribers don't trigger the call twice. THIS MUST BE THE LAST LINE OF THE PIPE
      );
    };
  }

  private revokeStixObjectFactory(attackType: AttackType) {
    const plural = AttackTypeToPlural[attackType];
    return function (
      id: string,
      revokingObject: { revoking: { stixId: string; modified: string } },
      preserveRelationships = false
    ): Observable<{}> {
      const url = `${this.apiUrl}/${plural}/${id}/revoke`;
      const params = { preserveRelationships };
      return this.http.post(url, revokingObject, { params }).pipe(
        tap(this.handleSuccess(`${attackType} revoked`)),
        catchError(this.handleError_raise()),
        share() // multicast so that multiple subscribers don't trigger the call twice. THIS MUST BE THE LAST LINE OF THE PIPE
      );
    };
  }

  /**
   * DELETE a technique
   * @param {string} id the STIX ID of the object to delete
   * @returns {Observable<{}>} observable of the response body
   */
  public get deleteTechnique() {
    return this.deleteStixObjectFactory('technique');
  }
  /**
   * DELETE a tactic
   * @param {string} id the STIX ID of the object to delete
   * @returns {Observable<{}>} observable of the response body
   */
  public get deleteTactic() {
    return this.deleteStixObjectFactory('tactic');
  }
  /**
   * DELETE a group
   * @param {string} id the STIX ID of the object to delete
   * @returns {Observable<{}>} observable of the response body
   */
  public get deleteGroup() {
    return this.deleteStixObjectFactory('group');
  }
  /**
   * DELETE a campaign
   * @param {string} id the STIX ID of the object to delete
   * @returns {Observable<{}>} observable of the response body
   */
  public get deleteCampaign() {
    return this.deleteStixObjectFactory('campaign');
  }
  /**
   * DELETE an asset
   * @param {string} id the STIX ID of the object to delete
   * @returns {Observable<{}>} observable of the response body
   */
  public get deleteAsset() {
    return this.deleteStixObjectFactory('asset');
  }
  /**
   * DELETE a software
   * @param {string} id the STIX ID of the object to delete
   * @returns {Observable<{}>} observable of the response body
   */
  public get deleteSoftware() {
    return this.deleteStixObjectFactory('software');
  }
  /**
   * DELETE a mitigation
   * @param {string} id the STIX ID of the object to delete
   * @returns {Observable<{}>} observable of the response body
   */
  public get deleteMitigation() {
    return this.deleteStixObjectFactory('mitigation');
  }
  /**
   * DELETE a data source
   * @param {string} id the STIX ID of the object to delete
   * @returns {Observable<{}>} observable of the response body
   */
  public get deleteDataSource() {
    return this.deleteStixObjectFactory('data-source');
  }
  /**
   * DELETE a data component
   * @param {string} id the STIX ID of the object to delete
   * @returns {Observable<{}>} observable of the response body
   */
  public get deleteDataComponent() {
    return this.deleteStixObjectFactory('data-component');
  }
  /**
   * DELETE a detection strategy
   * @param {string} id the STIX ID of the object to delete
   * @returns {Observable<{}>} observable of the response body
   */
  public get deleteDetectionStrategy() {
    return this.deleteStixObjectFactory('detection-strategy');
  }
  /**
   * DELETE an analytic
   * @param {string} id the STIX ID of the object to delete
   * @returns {Observable<{}>} observable of the response body
   */
  public get deleteAnalytic() {
    return this.deleteStixObjectFactory('analytic');
  }
  /**
   * DELETE a matrix
   * @param {string} id the STIX ID of the object to delete
   * @returns {Observable<{}>} observable of the response body
   */
  public get deleteMatrix() {
    return this.deleteStixObjectFactory('matrix');
  }
  /**
   * REVOKE a technique
   * @param {string} id the STIX ID of the object to revoke
   * @returns {Observable<{}>} observable of the response body
   */
  public get revokeTechnique() {
    return this.revokeStixObjectFactory('technique');
  }
  /**
   * REVOKE a tactic
   * @param {string} id the STIX ID of the object to revoke
   * @returns {Observable<{}>} observable of the response body
   */
  public get revokeTactic() {
    return this.revokeStixObjectFactory('tactic');
  }
  /**
   * REVOKE a group
   * @param {string} id the STIX ID of the object to revoke
   * @returns {Observable<{}>} observable of the response body
   */
  public get revokeGroup() {
    return this.revokeStixObjectFactory('group');
  }
  /**
   * REVOKE a matrix
   * @param {string} id the STIX ID of the object to revoke
   * @returns {Observable<{}>} observable of the response body
   */
  public get revokeMatrix() {
    return this.revokeStixObjectFactory('matrix');
  }
  /**
   * REVOKE a campaign
   * @param {string} id the STIX ID of the object to revoke
   * @returns {Observable<{}>} observable of the response body
   */
  public get revokeCampaign() {
    return this.revokeStixObjectFactory('campaign');
  }
  /**
   * REVOKE an asset
   * @param {string} id the STIX ID of the object to revoke
   * @returns {Observable<{}>} observable of the response body
   */
  public get revokeAsset() {
    return this.revokeStixObjectFactory('asset');
  }
  /**
   * REVOKE a software
   * @param {string} id the STIX ID of the object to revoke
   * @returns {Observable<{}>} observable of the response body
   */
  public get revokeSoftware() {
    return this.revokeStixObjectFactory('software');
  }
  /**
   * REVOKE a mitigation
   * @param {string} id the STIX ID of the object to revoke
   * @returns {Observable<{}>} observable of the response body
   */
  public get revokeMitigation() {
    return this.revokeStixObjectFactory('mitigation');
  }
  /**
   * REVOKE a data source
   * @param {string} id the STIX ID of the object to revoke
   * @returns {Observable<{}>} observable of the response body
   */
  public get revokeDataSource() {
    return this.revokeStixObjectFactory('data-source');
  }
  /**
   * REVOKE a data component
   * @param {string} id the STIX ID of the object to revoke
   * @returns {Observable<{}>} observable of the response body
   */
  public get revokeDataComponent() {
    return this.revokeStixObjectFactory('data-component');
  }
  /**
   * DELETE a collection
   * @param {string} id the STIX ID of the object to delete
   * @param {boolean} deleteAllContents whether or not to delete all of the contents of the collection
   * @param {string} version modified date of the version to delete
   * @returns {Observable<{}>} observable of the response body
   */
  public get deleteCollection() {
    return function (
      id: string,
      deleteAllContents: boolean,
      version?: string
    ): Observable<{}> {
      const url = `${this.apiUrl}/collections/${id}${version ? `/modified/${version}` : ``}?deleteAllContents=${deleteAllContents ? 'true' : 'false'}`;
      return this.http.delete(url).pipe(
        tap(this.handleSuccess(`collection deleted`)),
        catchError(this.handleError_raise()),
        share() // multicast so that multiple subscribers don't trigger the call twice. THIS MUST BE THE LAST LINE OF THE PIPE
      );
    };
  }
  /**
   * DELETE a relationship
   * @param {string} id the STIX ID of the object to delete
   * @returns {Observable<{}>} observable of the response body
   */
  public get deleteRelationship() {
    return this.deleteStixObjectFactory('relationship');
  }
  /**
   * DELETE a note
   * @param {string} id the STIX ID of the object to delete
   * @returns {Observable<{}>} observable of the response body
   */
  public deleteNote(id: string) {
    return this.http
      .delete(`${this.apiUrl}/notes/${id}`)
      .pipe(
        tap(this.handleSuccess('note removed')),
        catchError(this.handleError_raise()),
        share()
      );
  }

  //   ___ ___ _      _ _____ ___ ___  _  _ ___ _  _ ___ ___  ___
  //  | _ \ __| |    /_\_   _|_ _/ _ \| \| / __| || |_ _| _ \/ __|
  //  |   / _|| |__ / _ \| |  | | (_) | .` \__ \ __ || ||  _/\__ \
  //  |_|_\___|____/_/ \_\_| |___\___/|_|\_|___/_||_|___|_|  |___/
  //

  /**
   * Get relationships. Note: pass in args in an object
   *
   * @param {string} [sourceRef] STIX id of referenced object. Only retrieve relationships that reference this object in the source_ref property.
   * @param {string} [targetRef] STIX id of referenced object. Only retrieve relationships that reference this object in the target_ref property.
   * @param {string} [sourceOrTargetRef] STIX id of referenced object. Only retrieve relationships that reference this object in the target_ref or source_ref property.
   * @param {string} [relationshipType] Only retrieve relationships that have a matching relationship_type.
   * @param {string} [sourceType] retrieve objects where the source object is this ATT&CK type
   * @param {string} [targetType] retrieve objects where the source object is this ATT&CK type
   * @param {number} [limit] The number of relationships to retrieve.
   * @param {number} [offset] The number of relationships to skip.
   * @param {boolean} [includeDeprecated] if true, include deprecated relationships.
   * @param {"all" | "latest"} [versions] if "all", get all versions of the relationships, otherwise only get the latest versions
   * @param {string[]} [excludeSourceRefs] if specified, exclude source refs which are found in this array
   * @param {string[]} [excludeTargetRefs] if specified, exclude target refs which are found in this array
   * @returns {Observable<Paginated>} paginated data of the relationships
   */
  public getRelatedTo(args: {
    sourceRef?: string;
    targetRef?: string;
    sourceOrTargetRef?: string;
    sourceType?: AttackType;
    targetType?: AttackType;
    relationshipType?: string;
    excludeSourceRefs?: string[];
    excludeTargetRefs?: string[];
    limit?: number;
    offset?: number;
    includeDeprecated?: boolean;
    versions?: 'all' | 'latest';
  }): Observable<Paginated<StixObject>> {
    let query = new HttpParams();

    if (args.sourceRef) query = query.set('sourceRef', args.sourceRef);
    if (args.targetRef) query = query.set('targetRef', args.targetRef);

    if (args.sourceType) query = query.set('sourceType', args.sourceType);
    if (args.targetType) query = query.set('targetType', args.targetType);

    if (args.sourceOrTargetRef)
      query = query.set('sourceOrTargetRef', args.sourceOrTargetRef);

    if (args.relationshipType)
      query = query.set('relationshipType', args.relationshipType);

    if (args.includeDeprecated)
      query = query.set(
        'includeDeprecated',
        args.includeDeprecated ? 'true' : 'false'
      );

    if (args.versions) query = query.set('versions', args.versions);

    if (args.limit) query = query.set('limit', args.limit.toString());
    if (args.offset) query = query.set('offset', args.offset.toString());
    if (args.limit || args.offset)
      query = query.set('includePagination', 'true');
    const url = `${this.apiUrl}/relationships`;
    return this.http.get(url, { params: query }).pipe(
      tap(results => logger.log('retrieved relationships', results)),
      map(results => {
        if (!args.excludeSourceRefs && !args.excludeTargetRefs) return results; // only filter if params are present
        let response = results as any;
        if (args.limit || args.offset) {
          // returned a paginated
          const pre_filter = response.data.length;
          if (args.excludeSourceRefs)
            response.data = response.data.filter(
              d => !args.excludeSourceRefs.includes(d.stix.source_ref)
            );
          if (args.excludeTargetRefs)
            response.data = response.data.filter(
              d => !args.excludeTargetRefs.includes(d.stix.target_ref)
            );
          logger.log(
            'filtered',
            pre_filter - response.data.length,
            'results by ID'
          );
          return response;
        } else {
          //returned a stixObject[]
          const pre_filter = response.length;
          if (args.excludeSourceRefs)
            response = response.filter(
              d => !args.excludeSourceRefs.includes(d.stix.source_ref)
            );
          if (args.excludeTargetRefs)
            response = response.filter(
              d => !args.excludeTargetRefs.includes(d.stix.target_ref)
            );
          logger.log('filtered', pre_filter - response.length, 'results by ID');
          return response;
        }
      }),
      map(results => {
        const response = results as any;
        if (args.limit || args.offset) {
          //returned paginated
          let data = response.data as any[];
          data = data.map(y => new Relationship(y));
          response.data = data;
          return response;
        } else {
          //returned StixObject[]
          return {
            pagination: {
              total: response.length,
              limit: -1,
              offset: -1,
            },
            data: response.map(y => new Relationship(y)),
          };
        }
      }),
      catchError(this.handleError_continue([])),
      share()
    );
  }

  /**
   * Get all objects related to a data source
   * @param id the STIX ID of the data source
   * @returns list of data components related to the data source along with the data components' relationships with techniques
   */
  public getAllRelatedToDataSource(id: string): Observable<StixObject[]> {
    const dataComponents$ = this.getAllDataComponents();
    return dataComponents$.pipe(
      map(result => {
        // get related data component objects
        const dataComponents = result.data as DataComponent[];
        return dataComponents.filter(d => d?.dataSourceRef == id);
      }),
      mergeMap(dataComponents => {
        // get relationships for each data component
        const relatedTo = dataComponents.map(dc =>
          this.getRelatedTo({ sourceOrTargetRef: dc.stixID })
        );
        if (!relatedTo.length) return of(dataComponents);
        return forkJoin(relatedTo).pipe(
          map(relationships => {
            let all_results: StixObject[] = [];
            for (const relationship_result of relationships) {
              all_results = all_results.concat(relationship_result.data);
            }
            return all_results.concat(dataComponents);
          })
        );
      }),
      catchError(this.handleError_continue([])),
      share()
    );
  }

  /**
   * Get all techniques referencing the given tactic
   * @param {string} tactic_id the stix id of the tactic
   * @param {Date} modified the modified date of the tactic
   * @returns {Technique[]} a list of techniques that reference the tactic
   */
  public getTechniquesInTactic(
    tactic_id: string,
    modified: Date
  ): Observable<Technique[]> {
    const url = `${this.apiUrl}/tactics/${tactic_id}/modified/${modified.toISOString()}/techniques`;
    return this.http.get(url).pipe(
      tap(results => logger.log('retrieved techniques', results)),
      map(response => {
        const data = response as any[];
        const techniques: Technique[] = data.map(sdo => {
          return new Technique(sdo);
        });
        return techniques;
      }),
      catchError(this.handleError_continue([])),
      share()
    );
  }
  /**
   * Get list of all tactics, techniques, and nested subtechniques within a given matrix
   * @param {Matrix} matrix the matrix object for the response's tactic list to be added to
   * @returns
   */
  public getTechniquesInMatrix(matrix: Matrix): Observable<any> {
    const url = `${this.apiUrl}/matrices/${matrix.stixID}/modified/${matrix.modified.toISOString()}/techniques`;
    return this.http.get(url).pipe(
      tap(results => logger.log('retrieved techniques', results)),
      map(response => {
        const data = response as any[];
        const entries = Object.entries(data);
        entries.forEach(item => {
          const tactic = new Tactic(item[1]);
          const techniqueList = item[1].techniques;
          techniqueList.forEach(item => {
            const technique = new Technique(item);
            if (item.subtechniques.length > 0) {
              item.subtechniques.forEach(subtechnique => {
                technique.subTechniques.push(new Technique(subtechnique));
              });
            }
            technique.subTechniques.sort((a, b) =>
              a.name.toLowerCase().localeCompare(b.name.toLowerCase())
            );
            tactic.technique_objects.push(technique);
          });
          tactic.technique_objects.sort((a, b) =>
            a.name.toLowerCase().localeCompare(b.name.toLowerCase())
          );
          matrix.tactic_objects.push(tactic);
        });
        return matrix;
      }),
      catchError(this.handleError_continue([])),
      share()
    );
  }

  /**
   * Get all tactics referenced by the given technique
   * @param {string} technique_id the stix id of the technique
   * @param {Date} modified the modified date of the technique
   * @returns {Tactic[]} a list of tactics that are referenced by the technique
   */
  public getTacticsRelatedToTechnique(
    technique_id: string,
    modified: Date
  ): Observable<Tactic[]> {
    const url = `${this.apiUrl}/techniques/${technique_id}/modified/${modified.toISOString()}/tactics`;
    return this.http.get(url).pipe(
      tap(results => logger.log('retrieved tactics', results)),
      map(response => {
        const data = response as any[];
        const tactics: Tactic[] = data.map(sdo => {
          return new Tactic(sdo);
        });
        return tactics;
      }),
      catchError(this.handleError_continue([])),
      share()
    );
  }

  /**
   * Get the list of channels on a Data Component by its STIX ID
   * @param stixId the STIX ID of the data component object
   */
  public getDataComponentChannels(stixId: string): Observable<string[]> {
    const url = `${this.apiUrl}/data-components/${stixId}/channels`;
    return this.http
      .get<string[]>(url)
      .pipe(
        tap(results => logger.log('retrieved data component channels', results))
      );
  }

  //   ___ ___ ___ ___ ___ ___ _  _  ___ ___ ___
  //  | _ \ __| __| __| _ \ __| \| |/ __| __/ __|
  //  |   / _|| _|| _||   / _|| .` | (__| _|\__ \
  //  |_|_\___|_| |___|_|_\___|_|\_|\___|___|___/

  /**
   * get all external references
   * @param {number} [limit] the number of references to retrieve
   * @param {number} [offset] the number of references to skip
   * @param {string} [search] Only return references where the provided search text occurs in the description or url. The search is case-insensitive.
   * @returns {Observable<Paginated>} paginated data for external references
   */
  public getAllReferences(
    limit?: number,
    offset?: number,
    search?: string
  ): Observable<Paginated<ExternalReference>> {
    const url = `${this.apiUrl}/references`;
    // parse params into query string
    let query = new HttpParams({ encoder: new CustomEncoder() });
    // pagination
    if (limit) query = query.set('limit', limit.toString());
    if (offset) query = query.set('offset', offset.toString());
    if (search) query = query.set('search', search);
    /*if (limit || offset) */ query = query.set('includePagination', 'true');
    return this.http
      .get<Paginated<ExternalReference>>(url, { params: query })
      .pipe(
        tap(results => logger.log('retrieved references', results)),
        catchError(
          this.handleError_continue<Paginated<ExternalReference>>({
            data: [],
            pagination: { total: 0, limit: 0, offset: 0 },
          })
        ), // on error, trigger the error notification and continue operation without crashing (returns empty item)
        share() // multicast so that multiple subscribers don't trigger the call twice. THIS MUST BE THE LAST LINE OF THE PIPE
      );
  }

  /**
   * Get a single reference by source name
   * @param {string} source_name the reference's source_name identifier
   * @returns {Observable<ExternalReference>} the external reference with the given source_name
   */
  public getReference(source_name: string): Observable<ExternalReference> {
    const url = `${this.apiUrl}/references`;
    // parse params into query string
    let query = new HttpParams({ encoder: new CustomEncoder() });
    query = query.set('sourceName', source_name);
    return this.http.get<ExternalReference>(url, { params: query }).pipe(
      tap(results => logger.log('retrieved reference', results)),
      catchError(this.handleError_continue<ExternalReference>()), // on error, trigger the error notification and continue operation without crashing (returns empty item)
      share() // multicast so that multiple subscribers don't trigger the call twice. THIS MUST BE THE LAST LINE OF THE PIPE
    );
  }

  /**
   * Create an external reference
   * @param {ExternalReference} reference the reference to create
   * @returns {Observable<ExternalReference>} the created reference
   */
  public postReference(
    reference: ExternalReference
  ): Observable<ExternalReference> {
    const url = `${this.apiUrl}/references`;
    return this.http.post<ExternalReference>(url, reference).pipe(
      tap(this.handleSuccess(`${reference.source_name} saved`)),
      catchError(this.handleError_raise<ExternalReference>()), // on error, trigger the error notification and continue operation without crashing (returns empty item)
      share() // multicast so that multiple subscribers don't trigger the call twice. THIS MUST BE THE LAST LINE OF THE PIPE
    );
  }

  /**
   * Update an external reference
   * @param {ExternalReference} reference the reference to update
   * @returns {Observable<ExternalReference>} the updated reference
   */
  public putReference(
    reference: ExternalReference
  ): Observable<ExternalReference> {
    const url = `${this.apiUrl}/references`;
    return this.http.put<ExternalReference>(url, reference).pipe(
      tap(this.handleSuccess(`${reference.source_name} saved`)),
      catchError(this.handleError_raise<ExternalReference>()), // on error, trigger the error notification and continue operation without crashing (returns empty item)
      share() // multicast so that multiple subscribers don't trigger the call twice. THIS MUST BE THE LAST LINE OF THE PIPE
    );
  }

  /**
   * DELETE a reference
   * @param {string} source_name the source name of the reference to delete
   * @returns {Observable<{}>} observable of the response body
   */
  public deleteReference(source_name: string) {
    const url = `${this.apiUrl}/references`;
    let query = new HttpParams({ encoder: new CustomEncoder() });
    query = query.set('sourceName', source_name);
    return this.http
      .delete(url, { params: query })
      .pipe(
        tap(this.handleSuccess('reference removed')),
        catchError(this.handleError_raise()),
        share()
      );
  }

  //    ___ ___  _    _    ___ ___ _____ ___ ___  _  _     _   ___ ___ ___
  //   / __/ _ \| |  | |  | __/ __|_   _|_ _/ _ \| \| |   /_\ | _ \_ _/ __|
  //  | (_| (_) | |__| |__| _| (__  | |  | | (_) | .` |  / _ \|  _/| |\__ \
  //   \___\___/|____|____|___\___| |_| |___\___/|_|\_| /_/ \_\_| |___|___/
  //

  /**
   * POST a collection bundle (including a collection SDO and the objects to which it refers) to the back-end
   * @param {*} collectionBundle the STIX bundle to write
   * @param {boolean} [preview] if true, preview the results of the import without actually committing the import
   * @param {boolean} [force] if true, force import the collection
   * @param {boolean} [suppressErrors] if true, suppress the error snackbar
   * @returns {Observable<Collection>} collection object marking the results of the import
   */
  public postCollectionBundle(
    collectionBundle: any,
    preview = false,
    force = false,
    suppressErrors = false
  ): Observable<Collection> {
    // add query params for preview
    let query = new HttpParams();
    if (preview) query = query.set('previewOnly', 'true');
    if (force) query = query.set('forceImport', 'all');
    // perform the request
    return this.http
      .post(`${this.apiUrl}/collection-bundles`, collectionBundle, {
        params: query,
      })
      .pipe(
        tap(result => {
          if (preview) logger.log('previewed collection import', result);
          else this.handleSuccess('imported collection')(result);
        }),
        map(result => {
          return new Collection(result);
        }),
        catchError(this.handleError_raise<Collection>(!suppressErrors)),
        share()
      );
  }

  /**
   * Stream collection bundle import with progress updates using Server-Sent Events
   * @param collectionBundle the STIX bundle to import
   * @param force whether to force import despite warnings
   * @returns Observable that emits progress events and final collection
   */
  public streamCollectionBundleImport(
    collectionBundle: any,
    force = false
  ): Observable<{ type: string; data: any }> {
    return new Observable(observer => {
      let query = new HttpParams();
      query = query.set('stream', 'true');
      if (force) query = query.set('forceImport', 'all');

      const url = `${this.apiUrl}/collection-bundles?${query.toString()}`;

      // Note: EventSource doesn't support POST with body, so we need to use fetch
      // with SSE streaming instead
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        credentials: 'include',
        body: JSON.stringify(collectionBundle),
      })
        .then(async response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error('No response body');
          }

          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              observer.complete();
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim() === '' || line.startsWith(':')) continue;

              const eventMatch = line.match(/^event: (\w+)\n/);
              const dataMatch = line.match(/data: (.+)$/m);

              if (dataMatch) {
                try {
                  const data = JSON.parse(dataMatch[1]);
                  const eventType = eventMatch ? eventMatch[1] : 'message';

                  if (eventType === 'error') {
                    observer.error(data);
                    return;
                  }

                  observer.next({ type: eventType, data });

                  if (eventType === 'complete') {
                    observer.complete();
                    return;
                  }
                } catch (e) {
                  logger.error('Error parsing SSE data:', e);
                }
              }
            }
          }
        })
        .catch(err => {
          logger.error('Stream error:', err);
          observer.error(err);
        });

      // Cleanup
      return () => {
        // EventSource cleanup if needed
      };
    });
  }

  /**
   * Preview a collection bundle.
   * POST the collection bundle to the back end to retrieve a preview of the import results. A second POST
   * call will occur (with ?forceImport='all') if the first POST call results in an overridable import error.
   * This is done in order to view the import errors alongside a preview of the import results.
   * @param collectionBundle the STIX bundle to preview
   * @returns {Observable<any>} the collection object and any import errors as result of the preview import
   */
  public previewCollectionBundle(collectionBundle: any): Observable<any> {
    // perform preview request
    return this.postCollectionBundle(collectionBundle, true, false, true).pipe(
      map(result => {
        return { error: undefined, preview: result };
      }),
      catchError(err => {
        // check if import can be forced
        if (this.cannotForceImport(err)) {
          return of({ error: err.error, preview: undefined });
        }
        // force request
        return this.postCollectionBundle(
          collectionBundle,
          true,
          true,
          true
        ).pipe(
          map(force_result => {
            return { error: err.error, preview: force_result };
          }),
          catchError(this.handleError_raise<Collection>())
        );
      }),
      share()
    );
  }

  /**
   * Determine if the user cannot force import a collection when the post collection call fails.
   * Users cannot force an import when:
   *   1. the collection bundle has more than one collection object
   *   2. the collection bundle does not have a collection object
   *   3. the collection is badly formatted
   *   4. the collection contains duplicate objects
   * @param err the resulting error from previewing the collection
   * @returns true if the user cannot force import the collection; false otherwise
   */
  private cannotForceImport(err: any): boolean {
    if (err.status == '400') {
      try {
        const bundleErrors = err.error.bundleErrors;
        const objectErrors = err.error.objectErrors.summary;
        if (
          bundleErrors.noCollection ||
          bundleErrors.moreThanOneCollection ||
          bundleErrors.badlyFormattedCollection ||
          objectErrors.duplicateObjectInBundleCount
        ) {
          return true;
        }
        return false;
      } catch (_) {
        // continue to force import; errors will be displayed to the user if the collection is invalid
        return false;
      }
    }
    return true;
  }

  /**
   * Get a collection bundle
   * @param {string} id STIX ID of collection
   * @param {Date} modified modified date of collection
   * @param {boolean} includeNotes if true, include relevant Note objects
   * @returns {Observable<any>} collection STIX bundle
   */
  public getCollectionBundle(
    id: string,
    modified: Date,
    includeNotes?: boolean
  ): Observable<any> {
    let query = new HttpParams();
    query = query.set('collectionId', id);
    query = query.set('collectionModified', modified.toISOString());
    if (includeNotes) query = query.set('includeNotes', 'true');
    return this.http
      .get(`${this.apiUrl}/collection-bundles`, { params: query })
      .pipe(
        tap(results => logger.log('retrieved collection bundle')),
        catchError(this.handleError_continue<any>({})),
        share() //multicast
      );
  }

  //    ___ ___  _    _    ___ ___ _____ ___ ___  _  _      ___ _  _ ___  _____  __       _   ___ ___ ___
  //   / __/ _ \| |  | |  | __/ __|_   _|_ _/ _ \| \| |    |_ _| \| |   \| __\ \/ /      /_\ | _ \_ _/ __|
  //  | (_| (_) | |__| |__| _| (__  | |  | | (_) | .` |     | || .` | |) | _| >  <      / _ \|  _/| |\__ \
  //   \___\___/|____|____|___\___| |_| |___\___/|_|\_|    |___|_|\_|___/|___/_/\_\    /_/ \_\_| |___|___/
  //

  /**
   * Post a new collection index to the back-end
   * @param {CollectionIndex} index record to write
   * @returns {Observable<CollectionIndex>} posted index if successful
   */
  public postCollectionIndex(
    index: CollectionIndex
  ): Observable<CollectionIndex> {
    return this.http
      .post<CollectionIndex>(`${this.apiUrl}/collection-indexes`, index)
      .pipe(
        tap(this.handleSuccess('collection index added')),
        map(result => result as CollectionIndex),
        catchError(this.handleError_raise<CollectionIndex>())
      );
  }

  /**
   * Update the given collection index
   * @param {CollectionIndex} index the index to update
   * @param {string} [successMessage="collection index updated"] message to show to the user in the snackbar on success
   * @returns {Observable<CollectionIndex>} the updated record
   */
  public putCollectionIndex(
    index: CollectionIndex,
    successMessage = 'collection index updated'
  ): Observable<CollectionIndex> {
    const serialized = index.serialize();
    return this.http
      .put<CollectionIndex>(
        `${this.apiUrl}/collection-indexes/${index.collection_index.id}`,
        serialized
      )
      .pipe(
        tap(this.handleSuccess(successMessage)),
        map(result => new CollectionIndex(result)),
        catchError(this.handleError_raise<CollectionIndex>())
      );
  }

  /**
   * Fetch all collection indexes
   * @param {number} limit optional, number to retrieve
   * @param {number} offset optional, number to skip
   * @returns {Observable<CollectionIndex>} collection indexes
   */
  public getCollectionIndexes(
    limit?: number,
    offset?: number
  ): Observable<CollectionIndex[]> {
    return this.http
      .get<CollectionIndex[]>(`${this.apiUrl}/collection-indexes`)
      .pipe(
        tap(_ => logger.log('retrieved collection indexes')), // on success, trigger the success notification
        map(results => {
          return results.map(raw => new CollectionIndex(raw));
        }),
        catchError(this.handleError_continue<CollectionIndex[]>([])) // on error, trigger the error notification and continue operation without crashing (returns empty item)
      );
  }

  /**
   * Delete the given collection index
   * @param {string} id the ID of the collection index to delete
   */
  public deleteCollectionIndex(id: string): Observable<{}> {
    return this.http
      .delete(`${this.apiUrl}/collection-indexes/${id}`)
      .pipe(
        tap(this.handleSuccess('collection index removed')),
        catchError(this.handleError_raise())
      );
  }

  /**
   * Given a URL, retrieve the collection index at the URL
   * @param {string} url the URL of the collection index
   * @returns {Observable<CollectionIndex>} the collection index at the URL
   */
  public getRemoteIndex(url: string): Observable<CollectionIndex> {
    const params = new HttpParams({ encoder: new CustomEncoder() });
    const headers: HttpHeaders = new HttpHeaders({
      ExcludeCredentials: 'true',
    });
    return this.http.get(url, { headers: headers, params: params }).pipe(
      tap(_ => logger.log('downloaded index at', url)), // on success, trigger the success notification
      map(index => {
        return {
          collection_index: index,
          workspace: { remote_url: url },
        } as CollectionIndex;
      }),
      catchError(this.handleError_continue<CollectionIndex>()) // on error, trigger the error notification and continue operation without crashing (returns empty item)
    );
  }

  //   _____   _____ _____ ___ __  __    ___ ___  _  _ ___ ___ ___     _   ___ ___ ___
  //  / __\ \ / / __|_   _| __|  \/  |  / __/ _ \| \| | __|_ _/ __|   /_\ | _ \_ _/ __|
  //  \__ \\ V /\__ \ | | | _|| |\/| | | (_| (_) | .` | _| | | (_ |  / _ \|  _/| |\__ \
  //  |___/ |_| |___/ |_| |___|_|  |_|  \___\___/|_|\_|_| |___\___| /_/ \_\_| |___|___/
  //

  /**
   * Get all allowed values
   * @returns {Observable<any>} all allowed values
   */
  private allowedValues;
  public getAllAllowedValues(): Observable<any> {
    if (this.allowedValues) {
      return of(this.allowedValues);
    }

    const data$ = this.http
      .get<any>(`${this.apiUrl}/config/allowed-values`)
      .pipe(
        tap(_ => logger.log('retrieved allowed values')),
        map(result => result as any),
        catchError(this.handleError_continue<string[]>([]))
      );
    const subscription = data$.subscribe({
      next: data => {
        this.allowedValues = data;
      },
      complete: () => {
        subscription.unsubscribe();
      },
    });
    return data$;
  }

  /**
   * Get the default marking definitions
   * @returns {Observable<any>} default marking definitions
   */
  public getDefaultMarkingDefinitions(): Observable<any> {
    return this.http
      .get(`${this.apiUrl}/config/default-marking-definitions`)
      .pipe(
        tap(_ => logger.log('retrieved default marking definitions')),
        map(result => {
          return result;
        }),
        catchError(this.handleError_continue<string[]>())
      );
  }

  /**
   * Set the default marking definitions
   * @returns {Observable<any>} default marking definitions
   */
  public postDefaultMarkingDefinitions(
    defaultMarkingDefs: string[]
  ): Observable<any> {
    return this.http
      .post(
        `${this.apiUrl}/config/default-marking-definitions`,
        defaultMarkingDefs
      )
      .pipe(
        tap(this.handleSuccess(`saved default marking definitions`)),
        catchError(this.handleError_raise<string[]>()),
        share() //multicast to subscribers
      );
  }

  /**
   * Get the organization identity
   * @returns {Observable<Identity>} the organization identity
   */
  public getOrganizationIdentity(): Observable<Identity> {
    return this.http.get(`${this.apiUrl}/config/organization-identity`).pipe(
      tap(_ => logger.log('retrieved organization identity')),
      map(result => {
        return new Identity(result);
      }),
      catchError(this.handleError_continue<Identity>()),
      share() //multicast to subscribers
    );
  }

  /**
   * Update the organization identity
   * @param {Identity} object the identity object to save
   * @returns {Observable<Identity>} the updated identity
   * @memberof RestApiConnectorService
   */
  public setOrganizationIdentity(object: Identity): Observable<Identity> {
    return this.postIdentity(object).pipe(
      //create/save the identity
      switchMap(result => {
        logger.log(result);
        // set the organization identity to be this identity's ID after it was created/updated
        return this.http
          .post(`${this.apiUrl}/config/organization-identity`, {
            id: result.stixID,
          })
          .pipe(
            tap(this.handleSuccess('Organization Identity Updated')),
            map(_ => {
              return new Identity(result);
            }),
            catchError(this.handleError_raise<Identity>()),
            share() // multicast so that multiple subscribers don't trigger the call twice. THIS MUST BE THE LAST LINE OF THE PIPE
          );
      })
    );
  }

  /**
   * Get the organization namespace configurations
   * @returns {Observable<Namespace>} the organization namespace configurations
   */
  public getOrganizationNamespace(): Observable<Namespace> {
    return this.http.get(`${this.apiUrl}/config/organization-namespace`).pipe(
      tap(_ => logger.log('retrieved organization namespace configurations')),
      map(result => {
        return result;
      }),
      catchError(this.handleError_continue<any>()),
      share() //multicast to subscribers
    );
  }

  /**
   * Update the organization namespace config
   * @returns {Observable<Namespace>} the updated identity
   * @memberof RestApiConnectorService
   * @param namespaceSettings the namespace object to save
   */
  public setOrganizationNamespace(
    namespaceSettings: Namespace
  ): Observable<Namespace> {
    const range = namespaceSettings.range_start
      ? Number(namespaceSettings.range_start)
      : 0;
    return this.http
      .post(`${this.apiUrl}/config/organization-namespace`, {
        ...namespaceSettings,
        range_start: range,
      })
      .pipe(
        // set the organization identity to be this identity's ID after it was created/updated
        tap(this.handleSuccess('Organization Namespace Updated')),
        map(_ => {
          return namespaceSettings;
        }),
        catchError(this.handleError_raise<any>()),
        share() // multicast so that multiple subscribers don't trigger the call twice. THIS MUST BE THE LAST LINE OF THE PIPE
      );
  }

  /**
   * Get the next available ATT&CK ID for a given STIX type
   * @param {string} stixType the STIX type (e.g., 'attack-pattern', 'x-mitre-tactic')
   * @param {string} [parentRef] optional parent technique STIX ID for subtechniques
   * @returns {Observable<string>} the next available ATT&CK ID
   */
  public getNextAttackId(
    stixType: string,
    parentRef?: string
  ): Observable<string> {
    let params = new HttpParams().set('type', stixType);
    if (parentRef) {
      params = params.set('parentRef', parentRef);
    }

    return this.http
      .get<{
        attack_id: string;
      }>(`${this.apiUrl}/attack-objects/attack-id/next`, { params })
      .pipe(
        tap(_ => logger.log(`retrieved next ATT&CK ID for ${stixType}`)),
        map(result => result.attack_id),
        catchError(this.handleError_continue<string>()),
        share()
      );
  }

  //   _   _ ___ ___ ___     _   ___ ___ ___  _   _ _  _ _____     _   ___ ___ ___
  //  | | | / __| __| _ \   /_\ / __/ __/ _ \| | | | \| |_   _|   /_\ | _ \_ _/ __|
  //  | |_| \__ \ _||   /  / _ \ (_| (_| (_) | |_| | .` | | |    / _ \|  _/| |\__ \
  //   \___/|___/___|_|_\ /_/ \_\___\___\___/ \___/|_|\_| |_|   /_/ \_\_| |___|___/

  /**
   * Get all user accounts
   * @param {number} [limit] the number of user accounts to retrieve
   * @param {number} [offset] the number of user accounts to skip
   * @param {string[]} [status] if specified, only get objects with this status
   * @param {string[]} [role] if specified, only get objects with this role
   * @param {string} [search] Only return user accounts where the provided search text occurs in the username or email. The search is case-insensitive.
   * @returns {Observable<Paginated>} paginated data of the user accounts
   */
  public getAllUserAccounts(options?: {
    limit?: number;
    offset?: number;
    status?: string[];
    role?: string[];
    search?: string;
  }): Observable<Paginated<UserAccount>> {
    const url = `${this.apiUrl}/user-accounts`;
    // parse params into query string
    let query = new HttpParams({ encoder: new CustomEncoder() });
    // pagination
    if (options && options.limit)
      query = query.set('limit', options.limit.toString());
    if (options && options.offset)
      query = query.set('offset', options.offset.toString());
    if (options && (options.limit || options.offset))
      query = query.set('includePagination', 'true');
    // search
    if (options && options.search) query = query.set('search', options.search);
    // status/role
    if (options && options.status)
      options.status.forEach(
        status => (query = query.append('status', status))
      );
    if (options && options.role)
      options.role.forEach(role => (query = query.append('role', role)));
    return this.http.get<Paginated<UserAccount>>(url, { params: query }).pipe(
      catchError(
        this.handleError_continue<Paginated<UserAccount>>({
          data: [],
          pagination: { total: 0, limit: 0, offset: 0 },
        })
      ),
      share() //multicast to subscribers
    );
  }

  /**
   * GET a single user account by ID
   * @param {string} id the object ID
   * @returns {Observable<UserAccount>} the object with the given ID
   */
  public getUserAccount(id: string): Observable<UserAccount> {
    const url = `${this.apiUrl}/user-accounts/${id}`;
    return this.http.get<UserAccount>(url).pipe(
      catchError(this.handleError_continue<UserAccount>()),
      share() // multicast to subscribers
    );
  }

  /**
   * POST (create) a new user account
   * @param {UserAccount} userAccount the object to create
   * @returns {Observable<UserAccount>} the created object
   */
  public postUserAccount(userAccount: UserAccount): Observable<UserAccount> {
    const url = `${this.apiUrl}/user-accounts/${userAccount.id}`;
    return this.http.post<UserAccount>(url, userAccount.serialize()).pipe(
      catchError(this.handleError_raise<UserAccount>()),
      share() // multicast to subscribers
    );
  }

  /**
   * PUT (update) a user account
   * @param {UserAccount} userAccount the object to update
   * @returns {Observable<UserAccount>} the updated object
   */
  public putUserAccount(userAccount: UserAccount): Observable<UserAccount> {
    const url = `${this.apiUrl}/user-accounts/${userAccount.id}`;
    return this.http.put<UserAccount>(url, userAccount.serialize()).pipe(
      catchError(this.handleError_raise<UserAccount>()),
      share() // multicast to subscribers
    );
  }

  //  _____ ___   _   __  __ ___     _   ___ ___ ___
  // |_   _| __| /_\ |  \/  / __|   /_\ | _ \_ _/ __|
  //   | | | _| / _ \| |\/| \__ \  / _ \|  _/| |\__ \
  //   |_| |___/_/ \_\_|  |_|___/ /_/ \_\_| |___|___/

  /**
   * Get all teams
   * @param {number} [limit] the number of teams to retrieve
   * @param {number} [offset] the number of teams to skip
   * @param {boolean} [includePagination] whether or not to include pagination (will be done automatically if limit or offset are set)
   * @param {string} [search] Only return teams where the provided search text occurs in the name or description. The search is case-insensitive.
   * @returns {Observable<Paginated>} paginated data of teams
   */
  public getAllTeams(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    includePagination?: boolean;
  }): Observable<Paginated<Team>> {
    const url = `${this.apiUrl}/teams`;
    // parse params into query string
    let query = new HttpParams({ encoder: new CustomEncoder() });
    // pagination
    if (options && options.limit)
      query = query.set('limit', options.limit.toString());
    if (options && options.offset)
      query = query.set('offset', options.offset.toString());
    if (
      options &&
      (options.includePagination || options.limit || options.offset)
    )
      query = query.set('includePagination', 'true');
    // search
    if (options && options.search) query = query.set('search', options.search);
    return this.http.get<Paginated<Team>>(url, { params: query }).pipe(
      catchError(
        this.handleError_continue<Paginated<Team>>({
          data: [],
          pagination: { total: 0, limit: 0, offset: 0 },
        })
      ),
      share() //multicast to subscribers
    );
  }

  /**
   * Get all teams
   * @param {string} id the object ID
   * @param {number} [limit] the number of users to retrieve
   * @param {number} [offset] the number of users to skip
   * @param {string} [search] Only return users where the provided search text occurs in the username, email, or displayName.  The search is case-insensitive.
   * @returns {Observable<Paginated>} paginated data of users from the given tem
   */
  public getUserAccountsByTeamId(
    id: string,
    options?: { limit?: number; offset?: number; search?: string }
  ): Observable<Paginated<UserAccount>> {
    const url = `${this.apiUrl}/teams/${id}/users`;
    // parse params into query string
    let query = new HttpParams({ encoder: new CustomEncoder() });
    // pagination
    if (options && options.limit)
      query = query.set('limit', options.limit.toString());
    if (options && options.offset)
      query = query.set('offset', options.offset.toString());
    if (options && (options.limit || options.offset))
      query = query.set('includePagination', 'true');
    // search
    if (options && options.search) query = query.set('search', options.search);
    return this.http.get<Paginated<UserAccount>>(url, { params: query }).pipe(
      catchError(
        this.handleError_continue<Paginated<UserAccount>>({
          data: [],
          pagination: { total: 0, limit: 0, offset: 0 },
        })
      ),
      share() //multicast to subscribers
    );
  }

  /**
   * Get list of teams by user ID
   * @param id the ID of the user account
   * @param {number} [limit] the number of users to retrieve
   * @param {number} [offset] the number of users to skip
   * @returns {Team[]} the list of teams the user is a part of
   */
  public getTeamsByUserId(
    id: string,
    options?: { limit?: number; offset?: number }
  ): Observable<Team[]> {
    const url = `${this.apiUrl}/user-accounts/${id}/teams`;
    // parse params into query string
    let query = new HttpParams({ encoder: new CustomEncoder() });
    // pagination
    if (options && options.limit)
      query = query.set('limit', options.limit.toString());
    if (options && options.offset)
      query = query.set('offset', options.offset.toString());
    if (options && (options.limit || options.offset))
      query = query.set('includePagination', 'true');
    return this.http.get<Team[]>(url, { params: query }).pipe(
      tap(_ => console.log(`retrieved`, _)),
      catchError(this.handleError_continue([])), // on error, trigger the error notification and continue operation without crashing (returns empty item)
      share() // multicast so that multiple subscribers don't trigger the call twice
    );
  }

  /**
   * GET a single team by ID
   * @param {string} id the object ID
   * @returns {Team} the object with the given ID
   */
  public getTeam(id: string): Observable<Team> {
    const url = `${this.apiUrl}/teams/${id}`;
    return this.http.get<Team>(url).pipe(
      catchError(this.handleError_continue<Team>()),
      share() //multicast to subscribers
    );
  }

  /**
   * POST (create) a new team
   * @param {Team} team the object to create
   * @returns {Team} the created object
   */
  public postTeam(team: Team): Observable<Team> {
    const url = `${this.apiUrl}/teams`;
    return this.http.post<Team>(url, team).pipe(
      catchError(this.handleError_continue<Team>()),
      share() //multicast to subscribers
    );
  }

  /**
   * PUT (update) a team
   * @param {Team} team the object to update
   * @returns {Team} the updated object
   */
  public putTeam(team: Team): Observable<Team> {
    const url = `${this.apiUrl}/teams/${team.id}`;
    return this.http.put<Team>(url, team).pipe(
      catchError(this.handleError_continue<Team>()),
      share() //multicast to subscribers
    );
  }

  /**
   * DELETE (remove) a team
   * @param {Team} team the object to delete
   * @returns {Observable<{}>}
   */
  public deleteTeam(team: Team): Observable<{}> {
    const url = `${this.apiUrl}/teams/${team.id}`;
    return this.http.delete<object>(url).pipe(
      catchError(this.handleError_continue<object>()),
      share() //multicast to subscribers
    );
  }

  //   ___    ___      __  ___ _____ _____  __    _   ___ ___ ___
  //  | _ \  /_\ \    / / / __|_   _|_ _\ \/ /   /_\ | _ \_ _/ __|
  //  |   / / _ \ \/\/ /  \__ \ | |  | | >  <   / _ \|  _/| |\__ \
  //  |_|_\/_/ \_\_/\_/   |___/ |_| |___/_/\_\ /_/ \_\_| |___|___/

  /**
   * Helper function: trigger the download of the given data from the browser
   * @param data: the data to download. Must be a JSON
   * @param filename: the name of the file to download
   */
  public triggerBrowserDownload(data: any, filename: string) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 4)], { type: 'text/json' })
    );
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }

  /**
   * Get a stix bundle by domain
   * @param {string} domain the domain to fetch
   * @returns {Observable<any>} the raw STIX bundle of the domain
   */
  public getStixBundle(domain: string): Observable<any> {
    let query = new HttpParams();
    query = query.set('domain', domain);
    return this.http.get(`${this.apiUrl}/stix-bundles`, { params: query }).pipe(
      tap(results => logger.log('retrieved stix bundle')),
      catchError(this.handleError_continue<any>({})),
      share() //multicast
    );
  }

  /**
   * Download a stix bundle by domain. Triggers browser download UI when complete.
   * @param {string} domain the domain to download
   * @param filename: the name of the file to download
   * @returns {Observable<any>} the observable to watch while download is loading
   */
  public downloadStixBundle(domain: string, filename: string): Observable<any> {
    const getter = this.getStixBundle(domain);
    const subscription = getter.subscribe({
      next: result => {
        this.triggerBrowserDownload(result, filename);
      },
      complete: () => {
        subscription.unsubscribe();
      },
    });
    return getter;
  }

  /**
   * Download a collection bundle. Triggers browser download UI when complete.
   * @param {string} id the STIX ID of the collection
   * @param {Date} modified the modified date of the collection
   * @param {string} filename the name of the file to download
   * @param {boolean} includeNotes if true, include relevant Note objects
   * @returns {Observable<any>} the observable to watch while download is loading
   */
  public downloadCollectionBundle(
    id: string,
    modified: Date,
    filename: string,
    includeNotes?: boolean
  ): Observable<any> {
    const getter = this.getCollectionBundle(id, modified, includeNotes);
    const subscription = getter.subscribe({
      next: result => {
        logger.log(result);
        this.triggerBrowserDownload(result, filename);
      },
      complete: () => {
        subscription.unsubscribe();
      },
    });
    return getter;
  }

  //   ___                      _
  //  | _ \___ _ __  ___ _ _ __| |_ ___
  //  |   / -_) '_ \/ _ \ '_/ _|  _(_-<
  //  |_|_\___| .__/\___/_| \__|\__/__/
  //          |_|

  /**
   * Retrieve objects which have unresolved link-by-id references
   */
  public getMissingLinkById(): Observable<any> {
    const url = `${this.apiUrl}/reports/link-by-id/missing`;
    return this.http.get(url).pipe(
      tap(results =>
        logger.log('retrieved missing link-by-id report', results)
      ),
      catchError(this.handleError_continue([])), // on error, trigger the error notification and continue operation without crashing (returns empty item)
      share() // multicast so that multiple subscribers don't trigger the call twice. THIS MUST BE THE LAST LINE OF THE PIPE
    );
  }
  /**
   * Retrieve groups of parallel relationships between the same source/target/type
   */
  public getParallelRelationships(): Observable<any> {
    const url = `${this.apiUrl}/reports/parallel-relationships`;
    return this.http.get(url).pipe(
      tap(results =>
        logger.log('retrieved parallel relationships report', results)
      ),
      catchError(this.handleError_continue([])), // on error, trigger the error notification and continue operation without crashing (returns empty item)
      share() // multicast so that multiple subscribers don't trigger the call twice. THIS MUST BE THE LAST LINE OF THE PIPE
    );
  }
}

class CustomEncoder implements HttpParameterCodec {
  encodeKey(key: string): string {
    return encodeURIComponent(key);
  }
  encodeValue(value: string): string {
    return encodeURIComponent(value);
  }
  decodeKey(key: string): string {
    return decodeURIComponent(key);
  }
  decodeValue(value: string): string {
    return decodeURIComponent(value);
  }
}
