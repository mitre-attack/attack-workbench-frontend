import { fakeAsync, flush } from '@angular/core/testing';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { createAsyncObservable } from 'src/app/testing/mocks/rest-api-connector.mock';
import { WorkflowStatus } from 'src/app/utils/types';
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
} from './index';
import { Collection } from './collection';

const created = '2020-01-02T03:04:05.006Z';
const modified = '2026-08-04T12:00:00.123Z';
const creator = 'identity--00000000-0000-4000-8000-000000000001';
const modifier = 'identity--00000000-0000-4000-8000-000000000002';

interface RawStixResponse {
  stix: Record<string, unknown>;
  workspace?: {
    workflow: { state: string };
    server_metadata: string;
  };
  created_by_identity?: { stix: { id: string; name: string } };
  modified_by_identity?: { stix: { id: string; name: string } };
  created_by_user_account?: { id: string; username: string };
}

function rawObject(type: string): RawStixResponse {
  return {
    workspace: { workflow: { state: 'reviewed' }, server_metadata: 'retained' },
    created_by_identity: {
      stix: { id: creator, name: 'Original organization' },
    },
    modified_by_identity: {
      stix: { id: modifier, name: 'Editing organization' },
    },
    created_by_user_account: { id: 'author', username: 'original-author' },
    stix: {
      type,
      id: `${type}--00000000-0000-4000-8000-000000000003`,
      created,
      ...(type === 'marking-definition' ? {} : { modified }),
      created_by_ref: creator,
      x_mitre_modified_by_ref: modifier,
      spec_version: '2.1',
      name: 'Server name',
      description: 'Server description',
      x_mitre_version: '2.3',
      x_mitre_deprecated: true,
      revoked: true,
      object_marking_refs: [
        'marking-definition--00000000-0000-4000-8000-000000000004',
      ],
      external_references: [
        { source_name: 'Server reference', description: 'Evidence' },
      ],
      x_mitre_domains: ['enterprise-attack'],
      identity_class: 'organization',
      definition_type: 'statement',
      definition: { statement: 'Server marking' },
      content: 'Server note content',
      object_refs: [creator],
      relationship_type: 'uses',
      source_ref: 'intrusion-set--00000000-0000-4000-8000-000000000003',
      target_ref: 'course-of-action--00000000-0000-4000-8000-000000000003',
      x_mitre_contents: [],
    },
  };
}

const targetTypes: {
  type: string;
  api: string;
  create: (raw?: RawStixResponse) => StixObject;
  update?: boolean;
}[] = [
  { type: 'campaign', api: 'Campaign', create: raw => new Campaign(raw) },
  { type: 'intrusion-set', api: 'Group', create: raw => new Group(raw) },
  {
    type: 'malware',
    api: 'Software',
    create: raw => new Software('malware', raw),
  },
  { type: 'tool', api: 'Software', create: raw => new Software('tool', raw) },
  {
    type: 'course-of-action',
    api: 'Mitigation',
    create: raw => new Mitigation(raw),
  },
  { type: 'x-mitre-asset', api: 'Asset', create: raw => new Asset(raw) },
  {
    type: 'x-mitre-data-source',
    api: 'DataSource',
    create: raw => new DataSource(raw),
  },
  {
    type: 'x-mitre-data-component',
    api: 'DataComponent',
    create: raw => new DataComponent(raw),
  },
  {
    type: 'x-mitre-detection-strategy',
    api: 'DetectionStrategy',
    create: raw => new DetectionStrategy(raw),
  },
  {
    type: 'x-mitre-analytic',
    api: 'Analytic',
    create: raw => new Analytic(raw),
  },
  { type: 'x-mitre-matrix', api: 'Matrix', create: raw => new Matrix(raw) },
  { type: 'x-mitre-tactic', api: 'Tactic', create: raw => new Tactic(raw) },
  { type: 'note', api: 'Note', create: raw => new Note(raw) },
  { type: 'identity', api: 'Identity', create: raw => new Identity(raw) },
  {
    type: 'attack-pattern',
    api: 'Technique',
    create: raw => new Technique(raw),
  },
  {
    type: 'relationship',
    api: 'Relationship',
    create: raw => new Relationship(raw),
  },
  {
    type: 'marking-definition',
    api: 'MarkingDefinition',
    create: raw => new MarkingDefinition(raw),
    update: false,
  },
  {
    type: 'x-mitre-collection',
    api: 'Collection',
    create: raw => new Collection(raw),
    update: false,
  },
];

function prepareRelationship(object: StixObject): void {
  if (object instanceof Relationship) {
    object.source_object = rawObject('intrusion-set');
    object.target_object = rawObject('course-of-action');
    object.source_ref = object.source_object.stix.id;
    object.target_ref = object.target_object.stix.id;
  }
}

function serviceFor(api: string, response: () => StixObject) {
  return {
    getRelatedTo: () => createAsyncObservable({ data: [] }),
    putGroup: (value: Group) => createAsyncObservable(value),
    putMitigation: (value: Mitigation) => createAsyncObservable(value),
    [`post${api}`]: () => createAsyncObservable(response()),
    [`put${api}`]: () => createAsyncObservable(response()),
  } as unknown as RestApiConnectorService;
}

function expectResponseMetadata(
  object: StixObject,
  response: StixObject
): void {
  // Subsequent authoring requests retain provenance; the model keeps the exact
  // saved revision timestamp for version-specific reads and updates.
  const serialized = object.serialize().stix;
  expect(serialized.created).toBe(created);
  expect(serialized.created_by_ref).toBe(creator);
  expect(object.modified?.toISOString()).toBe(response.modified?.toISOString());
  expect(object.firstInitialized).toBe(false);
  if (object instanceof Note) {
    expect(object.content).toBe('Server note content');
    expect(serialized.content).toBe('Server note content');
  } else if (object instanceof Relationship) {
    expect(object.relationship_type).toBe('uses');
    expect(serialized.relationship_type).toBe('uses');
  } else {
    expect(serialized.name).toBe('Server name');
  }
}

describe('STIX save response hydration', () => {
  it.each(targetTypes)(
    'retains server provenance, exact modified and subtype fields across repeated $type saves',
    fakeAsync(({ type, api, create }) => {
      const object = create();
      prepareRelationship(object);
      let response = create(rawObject(type));
      const service = serviceFor(api, () => response);

      expect(object.firstInitialized).toBe(true);
      object.save(service).subscribe();
      flush();

      expectResponseMetadata(object, response);
      expect(object.created.toISOString()).toBe(created);
      expect(object.modified?.toISOString()).toBe(
        type === 'marking-definition' ? undefined : modified
      );

      const nextRaw = rawObject(type);
      if (type !== 'marking-definition')
        nextRaw.stix.modified = '2026-08-05T12:00:00.456Z';
      response = create(nextRaw);
      const payload = object.serialize().stix;
      expect(payload.created_by_ref).toBe(creator);
      expect(payload.created).toBe(created);
      object.save(service).subscribe();
      flush();

      expectResponseMetadata(object, response);
    })
  );

  it.each(targetTypes.filter(target => target.update !== false))(
    'refreshes server metadata and subtype fields after updating $type',
    fakeAsync(({ type, api, create }) => {
      const object = create(rawObject(type));
      prepareRelationship(object);
      object.deserialize({
        stix: {
          name: 'Unsaved local name',
          content: 'Unsaved local note',
          relationship_type: 'targets',
        },
      });
      object.created = new Date('2025-01-01T00:00:00.000Z');
      object.created_by_ref = modifier;
      object.description = 'Unsaved local description';
      const response = create(rawObject(type));

      object.update(serviceFor(api, () => response)).subscribe();
      flush();

      expectResponseMetadata(object, response);
      expect(object.modified?.toISOString()).toBe(modified);
    })
  );

  it.each(targetTypes)(
    'does not retain stale optional base metadata missing from a $type response',
    fakeAsync(({ type, api, create }) => {
      const object = create(rawObject(type));
      prepareRelationship(object);
      const raw = rawObject(type);
      delete raw.stix.created_by_ref;
      delete raw.stix.x_mitre_modified_by_ref;
      delete raw.created_by_identity;
      delete raw.modified_by_identity;
      delete raw.created_by_user_account;
      delete raw.workspace;
      const response = create(raw);

      object.save(serviceFor(api, () => response)).subscribe();
      flush();

      expect(object.created_by_ref).toBeUndefined();
      expect(object.created_by).toBeUndefined();
      expect(object.modified_by_ref).toBeUndefined();
      expect(object.modified_by).toBeUndefined();
      expect(object.created_by_user_account).toBeUndefined();
      expect(object.workspace).toBeUndefined();
      expect(object.workflow).toBeUndefined();
      expect(object.serialize().stix.created_by_ref).toBeUndefined();
      expect(object.created.toISOString()).toBe(created);
    })
  );

  it('hydrates a new subtechnique before syncing its parent and preserves local parent context', fakeAsync(() => {
    const parent = new Technique(rawObject('attack-pattern'));
    const child = new Technique();
    child.is_subtechnique = true;
    child.parentTechnique = parent;
    const raw = rawObject('attack-pattern');
    raw.stix.id = child.stixID;
    const response = new Technique({
      ...raw,
      stix: { ...raw.stix, x_mitre_is_subtechnique: true },
    });
    const service = {
      postTechnique: () => createAsyncObservable(response),
      getRelatedTo: () =>
        createAsyncObservable({
          data: [{ source_ref: child.stixID, target_ref: parent.stixID }],
        }),
      getTechnique: () => createAsyncObservable([parent]),
    } as unknown as RestApiConnectorService;

    child.save(service).subscribe();
    flush();

    expectResponseMetadata(child, response);
    expect(child.is_subtechnique).toBe(true);
    expect(child.parentTechnique).toBe(parent);
    expect(child.created.toISOString()).toBe(created);
    expect(child.modified.toISOString()).toBe(modified);
  }));

  it('retains ATT&CK identifiers and local editor state while refreshing base metadata', fakeAsync(() => {
    const raw = rawObject('campaign');
    const response = new Campaign({
      ...raw,
      stix: {
        ...raw.stix,
        external_references: [
          {
            source_name: 'mitre-attack',
            external_id: 'C1234',
            url: 'https://example.test/server-reference',
          },
        ],
      },
    });
    const object = new Campaign();
    object.tempWorkflowState = WorkflowStatus.AwaitingReview;

    object.save(serviceFor('Campaign', () => response)).subscribe();
    flush();

    expect(object.attackID).toBe('C1234');
    expect(object.tempWorkflowState).toBe('awaiting-review');
    expect(object.created_by_ref).toBe(creator);
  }));
});
