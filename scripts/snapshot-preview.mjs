import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Design fixture server, never used by normal start/build. All writes are in memory.
// content_manifest_entries is a proposed read contract, not an existing API field.
const root = fileURLToPath(new URL('..', import.meta.url));
const trackId = 'release-track--snapshot-preview';
const standardId = 'release-track--component-preview';
const enterpriseSource = {
  track_id: standardId,
  track_name: 'Enterprise ATT&CK',
};
const researchSource = {
  track_id: 'release-track--research-preview',
  track_name: 'Research extensions',
};
const modified = '2026-09-30T10:30:00.000Z';
const revision = '2026-09-18T09:00:00.000Z';
const id = (type, n) =>
  `${type}--00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const object = (type, n, name, extra = {}) => ({
  type,
  id: id(type, n),
  name,
  created: '2026-01-15T09:00:00.000Z',
  modified: revision,
  spec_version: '2.1',
  x_mitre_version: '1.0',
  description: `${name}. Illustrative data for the virtual snapshot design preview.`,
  ...extra,
});
const attack = external_id => ({
  external_references: [{ source_name: 'mitre-attack', external_id }],
});
const roots = [
  object(
    'attack-pattern',
    1,
    'Command and Scripting Interpreter',
    attack('T1059')
  ),
  object('attack-pattern', 2, 'PowerShell', {
    ...attack('T1059.001'),
    x_mitre_is_subtechnique: true,
  }),
  object('attack-pattern', 3, 'Phishing', attack('T1566')),
  object('intrusion-set', 4, 'Example threat group', attack('G0001')),
  object('malware', 5, 'Example remote access tool', {
    ...attack('S0001'),
    is_family: true,
  }),
];
const relationship = (n, source, target, relationship_type) =>
  object('relationship', n, undefined, {
    source_ref: source.id,
    target_ref: target.id,
    relationship_type,
    description: 'Relationship pinned to the selected member revisions.',
  });
const relationships = [
  relationship(6, roots[1], roots[0], 'subtechnique-of'),
  relationship(7, roots[3], roots[2], 'uses'),
  relationship(8, roots[4], roots[1], 'uses'),
];
const identity = object('identity', 9, 'Snapshot Design Lab', {
  identity_class: 'organization',
});
const marking = {
  type: 'marking-definition',
  id: id('marking-definition', 10),
  created: '2026-01-15T09:00:00.000Z',
  spec_version: '2.1',
  definition_type: 'statement',
  definition: { statement: 'Design preview data only' },
};
const linkTarget = object('x-mitre-tactic', 11, 'Execution', {
  ...attack('TA0002'),
  x_mitre_shortname: 'execution',
});
const entry = (kind, stix, source_tracks) => ({
  kind,
  object_ref: stix.id,
  object_modified: stix.modified,
  stix,
  ...(source_tracks ? { source_tracks } : {}),
});
const entries = [
  ...roots.map((stix, index) =>
    entry(
      'primary',
      stix,
      index === 4
        ? [researchSource]
        : index === 1
          ? [enterpriseSource, researchSource]
          : [enterpriseSource]
    )
  ),
  ...relationships.map((stix, index) =>
    entry('relationship', stix, [
      index === 2 ? researchSource : enterpriseSource,
    ])
  ),
  entry('supporting', identity),
  entry('supporting', marking),
  entry('link_target', linkTarget, [enterpriseSource]),
];
const conflict = object(
  'attack-pattern',
  12,
  'Scheduled Task/Job',
  attack('T1053')
);
const quarantine = ['2026-09-12T08:00:00.000Z', '2026-09-25T14:00:00.000Z'].map(
  (object_modified, i) => ({
    object_ref: conflict.id,
    object_modified,
    name: conflict.name,
    attack_id: 'T1053',
    source_track_id: i ? 'release-track--research-preview' : standardId,
    source_track_name: i ? 'Research extensions' : 'Enterprise ATT&CK',
    conflict_reason:
      'Component tracks selected different revisions of this object.',
  })
);
const conflictRevisions = quarantine.map((item, index) => ({
  stix: {
    ...conflict,
    modified: item.object_modified,
    x_mitre_version: index ? '1.1' : '1.0',
    description: index
      ? 'Research revision: adversaries may use scheduled tasks on Windows and Linux to execute commands at a defined time or on system startup.'
      : 'Enterprise revision: adversaries may use Windows Task Scheduler to execute commands at a defined time or on system startup.',
    x_mitre_domains: ['enterprise-attack'],
    x_mitre_platforms: index ? ['Windows', 'Linux'] : ['Windows'],
    kill_chain_phases: [
      { kill_chain_name: 'mitre-attack', phase_name: 'execution' },
      { kill_chain_name: 'mitre-attack', phase_name: 'persistence' },
    ],
    x_mitre_is_subtechnique: false,
    x_mitre_detection: index
      ? 'Monitor scheduled task registration and cron configuration changes.'
      : 'Monitor Windows scheduled task registration.',
    x_mitre_attack_spec_version: '3.3.0',
    created_by_ref: identity.id,
    object_marking_refs: [marking.id],
    revoked: false,
    x_mitre_deprecated: false,
  },
  workspace: { workflow: { state: 'reviewed' } },
}));
const libraryRecords = entries
  .map(({ stix }) => {
    const record = { stix, workspace: {} };
    if (stix.type === 'relationship') {
      record.source_object = {
        stix: entries.find(e => e.object_ref === stix.source_ref).stix,
        workspace: {},
      };
      record.target_object = {
        stix: entries.find(e => e.object_ref === stix.target_ref).stix,
        workspace: {},
      };
    }
    return record;
  })
  .concat(conflictRevisions);
const libraryTypes = {
  'techniques': ['attack-pattern'],
  'groups': ['intrusion-set'],
  'software': ['malware', 'tool'],
  'relationships': ['relationship'],
  'identities': ['identity'],
  'marking-definitions': ['marking-definition'],
  'tactics': ['x-mitre-tactic'],
};
const attackTypes = {
  'attack-pattern': 'technique',
  'intrusion-set': 'group',
  'malware': 'software',
  'tool': 'software',
};
const stats = manifest => ({
  primary_count: manifest.filter(e => e.kind === 'primary').length,
  secondary_count: manifest.filter(e => e.kind === 'secondary').length,
  relationship_count: manifest.filter(e => e.kind === 'relationship').length,
  supporting_count: manifest.filter(e => e.kind === 'supporting').length,
  link_target_count: manifest.filter(e => e.kind === 'link_target').length,
  total_count: manifest.length,
});
const snapshot = (time, version, strategy, conflicts, manifest = entries) => ({
  id: trackId,
  name: 'Enterprise Composite · Design Preview',
  type: 'virtual',
  description:
    'Enterprise ATT&CK and research extensions, composed into a single snapshot.',
  modified: time,
  created: time,
  version,
  creation_actor: { kind: 'system' },
  creation_cause: 'scheduled_snapshot',
  snapshot_schedule: { mode: 'manual' },
  snapshot_description: version
    ? 'Published composition of the selected component snapshots.'
    : 'Scheduled composition. One object has competing revisions to review.',
  content_manifest_id: `release-track-content-manifest--preview-${time.slice(0, 10)}`,
  content_manifest_entries: structuredClone(manifest),
  content_statistics: stats(manifest),
  members: manifest
    .filter(e => e.kind === 'primary')
    .map(e => ({
      object_ref: e.object_ref,
      object_modified: e.object_modified,
      name: e.stix.name,
    })),
  members_count: manifest.filter(e => e.kind === 'primary').length,
  quarantine: structuredClone(conflicts),
  quarantine_count: conflicts.length,
  composition: {
    component_tracks: [
      {
        track_id: standardId,
        priority: 1,
        resolution_strategy: 'latest_tagged',
      },
      {
        track_id: 'release-track--research-preview',
        priority: 2,
        resolution_strategy: 'latest_preview',
      },
    ],
    deduplication: { strategy },
  },
  composition_resolution: {
    resolved_at: time,
    component_snapshots: [
      {
        track_id: standardId,
        track_name: 'Enterprise ATT&CK',
        resolved_snapshot_id: '2026-09-20T09:00:00.000Z',
        resolved_version: '19.1',
        strategy_used: 'latest_tagged',
        total_objects_in_source: 4,
        objects_after_filter: 4,
        objects_contributed: 4,
      },
      {
        track_id: 'release-track--research-preview',
        track_name: 'Research extensions',
        resolved_snapshot_id: '2026-09-29T09:00:00.000Z',
        strategy_used: 'latest_preview',
        total_objects_in_source: 2,
        objects_after_filter: 2,
        objects_contributed: 1,
      },
    ],
  },
  config: {},
});
const snapshots = [
  snapshot(modified, null, 'quarantine', quarantine),
  snapshot(
    '2026-09-23T10:30:00.000Z',
    '19.1',
    'prioritize_latest_object',
    [],
    entries.slice(0, -1)
  ),
  snapshot('2026-09-16T10:30:00.000Z', '19.0', 'quarantine', [], entries),
];
const standard = {
  id: standardId,
  name: 'Enterprise ATT&CK · Design Preview',
  type: 'standard',
  modified,
  created: modified,
  members: [],
  staged: [],
  candidates: [],
  config: {},
};
const page = data => ({
  data,
  pagination: { total: data.length, limit: 200, offset: 0 },
});
const historyPage = (history, params) => {
  const tagged = params.get('tagged');
  const filtered =
    tagged === null
      ? history
      : history.filter(snapshot => !!snapshot.version === (tagged === 'true'));
  const offset = Math.max(0, Number(params.get('offset')) || 0);
  const limit = Math.max(1, Number(params.get('limit')) || 200);
  const taggedCount = filtered.filter(snapshot => !!snapshot.version).length;
  return {
    data: filtered.slice(offset, offset + limit),
    pagination: { total: filtered.length, limit, offset },
    counts: {
      tagged: taggedCount,
      drafts: filtered.length - taggedCount,
      total: filtered.length,
    },
    latest_snapshot_modified: history[0]?.modified ?? null,
    latest_tagged_snapshot_modified:
      history.find(snapshot => !!snapshot.version)?.modified ?? null,
  };
};
const send = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:4311');
  const path = decodeURIComponent(url.pathname);
  if (
    req.method === 'POST' &&
    path === `/api/release-tracks/${trackId}/virtual/quarantine/promote`
  ) {
    let body = '';
    for await (const chunk of req) body += chunk;
    let choice;
    try {
      choice = JSON.parse(body);
    } catch {
      return send(res, 400, { message: 'Invalid JSON.' });
    }
    const current = snapshots[0];
    const selected = current.quarantine.find(
      e =>
        e.object_ref === choice.object_ref &&
        e.object_modified === choice.object_modified
    );
    if (!selected)
      return send(res, 409, {
        message: 'This revision is no longer quarantined in the current draft.',
      });
    const next = structuredClone(current);
    next.modified = new Date(
      new Date(current.modified).getTime() + 1000
    ).toISOString();
    next.created = next.modified;
    next.content_manifest_id += '-resolved';
    next.quarantine = next.quarantine.filter(
      e => e.object_ref !== choice.object_ref
    );
    next.quarantine_count = next.quarantine.length;
    next.members.push({
      object_ref: choice.object_ref,
      object_modified: choice.object_modified,
      name: conflict.name,
    });
    next.members_count = next.members.length;
    next.content_manifest_entries.push(
      entry(
        'primary',
        conflictRevisions.find(
          record => record.stix.modified === choice.object_modified
        ).stix,
        [
          {
            track_id: selected.source_track_id,
            track_name: selected.source_track_name,
          },
        ]
      )
    );
    next.content_statistics = stats(next.content_manifest_entries);
    next.snapshot_description =
      'Exact revision selected in quarantine review. The previous snapshot is preserved.';
    next.creation_cause = 'quarantine_promoted';
    snapshots.unshift(next);
    return send(res, 200, next);
  }
  if (req.method !== 'GET')
    return send(res, 405, {
      message:
        'Design preview: only quarantine resolution is simulated. No production data is changed.',
    });
  const tacticTechniques = path.match(
    /^\/api\/tactics\/([^/]+)\/modified\/([^/]+)\/techniques$/
  );
  if (tacticTechniques) {
    const tactic = libraryRecords.find(
      record =>
        record.stix.id === tacticTechniques[1] &&
        record.stix.modified === tacticTechniques[2]
    );
    if (!tactic)
      return send(res, 404, { message: 'Tactic revision not found.' });
    const techniques = new Map();
    for (const record of libraryRecords) {
      if (
        record.stix.type !== 'attack-pattern' ||
        !record.stix.kill_chain_phases?.some(
          phase => phase.phase_name === tactic.stix.x_mitre_shortname
        )
      )
        continue;
      const previous = techniques.get(record.stix.id);
      if (!previous || record.stix.modified > previous.stix.modified)
        techniques.set(record.stix.id, record);
    }
    return send(res, 200, [...techniques.values()]);
  }
  const libraryPath = path.match(
    /^\/api\/([^/]+)(?:\/([^/]+)(?:\/modified\/([^/]+))?)?$/
  );
  if (libraryPath && libraryTypes[libraryPath[1]]) {
    const [, resource, objectId, exactRevision] = libraryPath;
    let records = libraryRecords.filter(record =>
      libraryTypes[resource].includes(record.stix.type)
    );
    if (objectId) {
      records = records.filter(record => record.stix.id === objectId);
      if (exactRevision)
        records = records.filter(
          record => record.stix.modified === exactRevision
        );
      records.sort((a, b) =>
        (b.stix.modified || b.stix.created).localeCompare(
          a.stix.modified || a.stix.created
        )
      );
      if (!records.length)
        return send(res, 404, {
          message: 'This exact object revision is not in the design preview.',
        });
      return send(
        res,
        200,
        !exactRevision && url.searchParams.get('versions') === 'all'
          ? records
          : records[0]
      );
    }
    if (url.searchParams.get('versions') !== 'all') {
      const latest = new Map();
      for (const record of records) {
        const previous = latest.get(record.stix.id);
        if (
          !previous ||
          (record.stix.modified || record.stix.created) >
            (previous.stix.modified || previous.stix.created)
        )
          latest.set(record.stix.id, record);
      }
      records = [...latest.values()];
    }
    if (resource === 'relationships') {
      records = records.filter(record => {
        const { stix, source_object, target_object } = record;
        const filters = {
          sourceRef: stix.source_ref,
          targetRef: stix.target_ref,
          relationshipType: stix.relationship_type,
          sourceType:
            attackTypes[source_object.stix.type] || source_object.stix.type,
          targetType:
            attackTypes[target_object.stix.type] || target_object.stix.type,
        };
        for (const [key, value] of Object.entries(filters)) {
          if (url.searchParams.has(key) && url.searchParams.get(key) !== value)
            return false;
        }
        const eitherRef = url.searchParams.get('sourceOrTargetRef');
        return (
          !eitherRef ||
          eitherRef === stix.source_ref ||
          eitherRef === stix.target_ref
        );
      });
    }
    const total = records.length;
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
    const limit = url.searchParams.has('limit')
      ? Math.max(0, Number(url.searchParams.get('limit')) || 0)
      : total;
    records = records.slice(offset, offset + limit);
    return send(
      res,
      200,
      url.searchParams.get('includePagination') === 'true'
        ? { data: records, pagination: { total, offset, limit } }
        : records
    );
  }
  if (
    [
      '/api/references',
      '/api/notes',
      '/api/collections',
      '/api/matrices',
      '/api/campaigns',
      '/api/mitigations',
      '/api/data-sources',
      '/api/data-components',
      '/api/detection-strategies',
      '/api/analytics',
      '/api/assets',
    ].includes(path)
  )
    return send(
      res,
      200,
      url.searchParams.get('includePagination') === 'true' ? page([]) : []
    );
  if (path === '/api/config/system-version')
    return send(res, 200, {
      name: 'snapshot-design-fixtures',
      version: 'design-preview',
      gitCommit: 'not-a-production-api',
      buildDate: '2026-09-30',
    });
  if (path === '/api/user-accounts') return send(res, 200, page([]));
  if (path === '/api/session')
    return send(res, 200, { userAccountId: 'snapshot-designer' });
  if (path === '/api/user-accounts/snapshot-designer')
    return send(res, 200, {
      id: 'snapshot-designer',
      username: 'designer',
      displayName: 'Design Preview',
      status: 'active',
      role: 'admin',
    });
  if (path === '/api/config/authn')
    return send(res, 200, { mechanisms: [{ authnType: 'anonymous' }] });
  if (path === '/api/config/allowed-values')
    return send(res, 200, [
      {
        objectType: 'identity',
        properties: [
          {
            propertyName: 'identity_class',
            domains: [
              {
                domainName: 'stix',
                allowedValues: [
                  'individual',
                  'group',
                  'system',
                  'organization',
                  'class',
                  'unspecified',
                ],
              },
            ],
          },
        ],
      },
    ]);
  if (path === '/api/config/organization-identity')
    return send(res, 200, { stix: identity, workspace: {} });
  if (path === '/api/config/organization-namespace')
    return send(res, 200, { prefix: 'PREVIEW', range_start: 1 });
  if (path === '/api/release-tracks')
    return send(res, 200, page([snapshots[0], standard]));
  if (path === `/api/release-tracks/${trackId}/config`)
    return send(res, 200, snapshots[0].config);
  if (path === `/api/release-tracks/${standardId}/config`)
    return send(res, 200, {});
  if (path === `/api/release-tracks/${standardId}/snapshots/latest`)
    return send(res, 200, standard);
  if (path === `/api/release-tracks/${standardId}/snapshots`)
    return send(res, 200, historyPage([standard], url.searchParams));
  if (path === `/api/release-tracks/${trackId}/snapshots`)
    return send(res, 200, historyPage(snapshots, url.searchParams));
  if (path === `/api/release-tracks/${trackId}/virtual/draft-cleanup`)
    return send(res, 200, { data: [] });
  const snapshotPath = `/api/release-tracks/${trackId}/snapshots/`;
  if (path.startsWith(snapshotPath)) {
    const key = path.slice(snapshotPath.length);
    const selected =
      key === 'latest' ? snapshots[0] : snapshots.find(s => s.modified === key);
    if (!selected)
      return send(res, 404, {
        message: 'Snapshot not found in the design preview.',
      });
    if (url.searchParams.get('format') === 'bundle')
      return send(res, 200, {
        type: 'bundle',
        id: id('bundle', 20),
        objects: [
          {
            type: 'x-mitre-collection',
            id: id('x-mitre-collection', 21),
            name: selected.name,
          },
          ...selected.content_manifest_entries
            .filter(e => e.kind !== 'link_target')
            .map(e => e.stix),
        ],
      });
    return send(res, 200, selected);
  }
  if (path === '/api/collection-indexes') return send(res, 200, []);
  console.warn(`Preview route not provided: ${req.method} ${path}`);
  return send(res, 404, {
    message: 'Not available in the snapshot design preview.',
  });
});
server.listen(4311, '127.0.0.1', () => {
  console.log(
    'Snapshot design fixture API ready on 127.0.0.1:4311 (in-memory only).'
  );
  console.log(
    `Preview: http://localhost:4300/dashboard/release-management/${trackId}`
  );
});
const angular = spawn(
  process.execPath,
  [
    'node_modules/@angular/cli/bin/ng.js',
    'serve',
    '--configuration',
    'snapshot-preview',
    '--port',
    '4300',
    '--host',
    'localhost',
  ],
  { cwd: root, stdio: 'inherit' }
);
const stop = () => {
  angular.kill('SIGTERM');
  server.close();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
angular.on('exit', code => {
  server.close();
  process.exitCode = code ?? 0;
});
server.on('error', error => {
  console.error(error.message);
  angular.kill('SIGTERM');
  process.exitCode = 1;
});
