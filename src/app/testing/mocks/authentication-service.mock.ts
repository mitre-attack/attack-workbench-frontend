import { EventEmitter } from '@angular/core';
import { Observable } from 'rxjs';
import { Role } from 'src/app/classes/authn/role';
import { Status } from 'src/app/classes/authn/status';
import { UserAccount } from 'src/app/classes/authn/user-account';
import { createAsyncObservable } from './rest-api-connector.mock';

/**
 * Creates a mock UserAccount for testing purposes.
 *
 * @param overrides - Partial UserAccount properties to override defaults
 * @returns A UserAccount object with sensible test defaults
 *
 * @example
 * const user = createMockUserAccount({ role: Role.ADMIN });
 */
export function createMockUserAccount(
  overrides?: Partial<UserAccount>
): UserAccount {
  const mockUser = new UserAccount({
    id: 'mock-user-id',
    username: 'testuser',
    email: 'test@example.com',
    displayName: 'Test User',
    status: Status.ACTIVE,
    role: Role.VISITOR,
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
  });

  // Apply overrides if provided
  if (overrides) {
    Object.assign(mockUser, overrides);
  }

  return mockUser;
}

/**
 * Creates a mock AuthenticationService with configurable method implementations.
 *
 * @param config - Partial object with method implementations to override
 * @returns A mock object that can be used in Angular tests
 *
 * @example
 * // Basic mock with logged-out user
 * const mock = createMockAuthenticationService({});
 *
 * @example
 * // Mock with logged-in admin user
 * const mock = createMockAuthenticationService({
 *   currentUser: createMockUserAccount({ role: Role.ADMIN }),
 *   isLoggedIn: true
 * });
 *
 * @example
 * // Mock with custom authorization logic
 * const mock = createMockAuthenticationService({
 *   isAuthorized: (roles: Role[]) => roles.includes(Role.EDITOR)
 * });
 */
export function createMockAuthenticationService(config?: any): any {
  // Default mock user (not logged in)
  const defaultUser = new UserAccount({
    id: '',
    username: '',
    email: '',
    displayName: '',
    status: Status.PENDING,
    role: Role.NONE,
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
  });

  const defaults = {
    // Properties
    currentUser: defaultUser,
    activeRoles: [Role.ADMIN, Role.EDITOR, Role.TEAM_LEAD, Role.VISITOR],
    inactiveRoles: [Role.NONE],
    onLogin: new EventEmitter(),

    // Computed property
    get isLoggedIn(): boolean {
      return this.currentUser && this.currentUser.status === Status.ACTIVE;
    },

    // Methods
    isAuthorized: (roles: Role[]): boolean => {
      const mock = config?.currentUser || defaultUser;
      if (!mock || mock.status !== Status.ACTIVE) return false;
      return roles.indexOf(mock.role) > -1;
    },

    canEdit: (attackType?: string): boolean => {
      const mock = config?.currentUser || defaultUser;
      if (!mock || mock.status !== Status.ACTIVE) return false;

      if (
        attackType &&
        (attackType.includes('collection') ||
          attackType.includes('marking-definition'))
      ) {
        return mock.role === Role.ADMIN;
      }
      return [Role.EDITOR, Role.TEAM_LEAD, Role.ADMIN].indexOf(mock.role) > -1;
    },

    canDelete: (): boolean => {
      const mock = config?.currentUser || defaultUser;
      if (!mock || mock.status !== Status.ACTIVE) return false;
      return mock.role === Role.ADMIN;
    },

    login: (): Observable<UserAccount> => {
      return createAsyncObservable(config?.currentUser || defaultUser);
    },

    logout: (): Observable<any> => {
      return createAsyncObservable({});
    },

    register: (): Observable<any> => {
      return createAsyncObservable({});
    },

    handleRegisterRedirect: (): Observable<any> => {
      return createAsyncObservable({});
    },

    getSession: (): Observable<UserAccount> => {
      return createAsyncObservable(config?.currentUser || defaultUser);
    },

    getAuthType: (): Observable<string> => {
      return createAsyncObservable('anonymous');
    },

    success: (): void => {
      // Mock success method
    },
  };

  // Merge config with defaults
  return { ...defaults, ...config };
}
