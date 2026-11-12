/** Public configuration contract shared by the browser and startup generator. */
export const logLevels = [
  'TRACE',
  'DEBUG',
  'INFO',
  'LOG',
  'WARN',
  'ERROR',
  'FATAL',
  'OFF',
] as const;
export type LogLevel = (typeof logLevels)[number];
export interface PublicConfiguration {
  apiUrl: string;
  attackWebsiteEnabled: boolean;
  attackWebsiteUrl: string;
  collectionManagerEnabled: boolean;
  recommendedIndexes: { name: string; url: string }[];
  logLevel: LogLevel;
  defaultLandingPage: string;
}

export function configurationDefaults(production = false): PublicConfiguration {
  return {
    apiUrl: 'api',
    attackWebsiteEnabled: false,
    attackWebsiteUrl: production
      ? 'https://attack.mitre.org'
      : 'http://localhost:8000',
    collectionManagerEnabled: true,
    recommendedIndexes: [
      {
        name: 'MITRE ATT&CK',
        url: 'https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/index.json',
      },
    ],
    logLevel: production ? 'ERROR' : 'INFO',
    defaultLandingPage: '',
  };
}

function invalid(key: string, expected: string): never {
  throw new Error(
    `Invalid frontend configuration ${key}: expected ${expected}`
  );
}

function httpUrl(value: unknown, key: string): string {
  if (typeof value !== 'string' || !value || value.trim() !== value)
    return invalid(key, 'an HTTP(S) URL');
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password
    )
      return invalid(key, 'an HTTP(S) URL without credentials');
  } catch {
    return invalid(key, 'an HTTP(S) URL');
  }
  return value;
}

function apiUrl(value: unknown): string {
  if (typeof value !== 'string' || !value || /[\s\\?#]/.test(value))
    return invalid(
      'apiUrl',
      'a relative API path or HTTP(S) URL without query or fragment'
    );
  if (/^https?:\/\//.test(value))
    return httpUrl(value, 'apiUrl').replace(/\/+$/, '');
  if (
    value.startsWith('//') ||
    value.includes(':') ||
    value.split('/').includes('..')
  )
    return invalid('apiUrl', 'a relative API path or HTTP(S) URL');
  const path = value.replace(/\/+$/, '');
  if (!path) return invalid('apiUrl', 'a nonempty API path');
  return path;
}

/** Merge a partial legacy/public document over defaults and validate every field. */
export function resolveConfiguration(
  input: unknown = {},
  production = false
): PublicConfiguration {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return invalid('document', 'a JSON object');
  const defaults = configurationDefaults(production);
  const supplied = input as Record<string, unknown>;
  for (const key of Object.keys(supplied)) {
    if (!Object.prototype.hasOwnProperty.call(defaults, key))
      return invalid(key, 'a supported public setting');
  }
  const values: Record<string, unknown> = { ...defaults, ...supplied };
  const boolean = (key: string): boolean =>
    typeof values[key] === 'boolean'
      ? (values[key] as boolean)
      : invalid(key, 'true or false');
  if (!Array.isArray(values.recommendedIndexes))
    return invalid('recommendedIndexes', 'an array of { name, url }');
  const recommendedIndexes = values.recommendedIndexes.map(
    (entry: unknown, index: number) => {
      const key = `recommendedIndexes[${index}]`;
      if (!entry || typeof entry !== 'object' || Array.isArray(entry))
        return invalid(key, '{ name, url }');
      const item = entry as Record<string, unknown>;
      if (
        typeof item.name !== 'string' ||
        !item.name.trim() ||
        Object.keys(item).some(k => k !== 'name' && k !== 'url')
      )
        return invalid(key, '{ name, url } with a nonempty name');
      return { name: item.name, url: httpUrl(item.url, `${key}.url`) };
    }
  );
  if (!logLevels.includes(values.logLevel as LogLevel))
    return invalid('logLevel', logLevels.join(', '));
  if (
    typeof values.defaultLandingPage !== 'string' ||
    /[\s\\:#?]/.test(values.defaultLandingPage) ||
    values.defaultLandingPage.startsWith('//') ||
    values.defaultLandingPage.split('/').includes('..')
  )
    return invalid(
      'defaultLandingPage',
      'an internal application route or empty string'
    );
  return {
    apiUrl: apiUrl(values.apiUrl),
    attackWebsiteEnabled: boolean('attackWebsiteEnabled'),
    attackWebsiteUrl: httpUrl(values.attackWebsiteUrl, 'attackWebsiteUrl'),
    collectionManagerEnabled: boolean('collectionManagerEnabled'),
    recommendedIndexes,
    logLevel: values.logLevel as LogLevel,
    defaultLandingPage: values.defaultLandingPage,
  };
}

export const environmentMapping = {
  WORKBENCH_FRONTEND_API_URL: ['apiUrl', 'string'],
  WORKBENCH_FRONTEND_ATTACK_WEBSITE_ENABLED: [
    'attackWebsiteEnabled',
    'boolean',
  ],
  WORKBENCH_FRONTEND_ATTACK_WEBSITE_URL: ['attackWebsiteUrl', 'string'],
  WORKBENCH_FRONTEND_COLLECTION_MANAGER_ENABLED: [
    'collectionManagerEnabled',
    'boolean',
  ],
  WORKBENCH_FRONTEND_RECOMMENDED_INDEXES: ['recommendedIndexes', 'json'],
  WORKBENCH_FRONTEND_LOG_LEVEL: ['logLevel', 'string'],
  WORKBENCH_FRONTEND_DEFAULT_LANDING_PAGE: ['defaultLandingPage', 'string'],
} as const;

export function environmentOverrides(
  env: Record<string, string | undefined>
): Partial<PublicConfiguration> {
  const overrides: Record<string, unknown> = {};
  for (const [name, [key, type]] of Object.entries(environmentMapping)) {
    const value = env[name];
    if (value === undefined) continue;
    if (type === 'boolean') {
      if (value !== 'true' && value !== 'false')
        return invalid(name, 'true or false');
      overrides[key] = value === 'true';
    } else if (type === 'json') {
      try {
        overrides[key] = JSON.parse(value);
      } catch {
        return invalid(name, 'a JSON array');
      }
    } else overrides[key] = value;
  }
  return overrides;
}
