import { Observable } from 'rxjs';
import { Paginated } from 'src/app/services/connectors/rest-api/rest-api-connector.service';

/**
 * Creates an async Observable that emits the provided data after a setTimeout(0).
 * This prevents subscription initialization bugs in Angular tests.
 *
 * @param data - The data to emit from the Observable
 * @returns An Observable that emits the data asynchronously
 */
export function createAsyncObservable<T>(data: T): Observable<T> {
  return new Observable(subscriber => {
    setTimeout(() => {
      subscriber.next(data);
      subscriber.complete();
    }, 0);
  });
}

/**
 * Creates a standard paginated response structure with empty data by default.
 *
 * @param data - Optional array of data items (defaults to empty array)
 * @returns A Paginated response object with the provided data
 */
export function createPaginatedResponse<T>(data: T[] = []): Paginated<T> {
  return {
    data,
    pagination: {
      total: 0,
      limit: -1,
      offset: -1,
    },
  };
}

/**
 * Creates a mock RestApiConnectorService with configurable method implementations.
 *
 * @param config - Partial object with method implementations to override
 * @returns A mock object that can be used in Angular tests
 *
 * @example
 * // Simple paginated method mock
 * const mock = createMockRestApiConnector({
 *   getAllNotes: () => createAsyncObservable(createPaginatedResponse())
 * });
 *
 * @example
 * // Custom response mock
 * const mock = createMockRestApiConnector({
 *   getOrganizationIdentity: () => createAsyncObservable({ name: 'Test Org' })
 * });
 */
export function createMockRestApiConnector(config?: any): any {
  const defaults = {
    // Default implementation for getAllAllowedValues to prevent HTTP errors in tests
    getAllAllowedValues: () => createAsyncObservable([]),
  };

  return { ...defaults, ...config };
}

export function createMockReleaseTrackApiConnector(config?: any): any {
  return { ...config };
}
