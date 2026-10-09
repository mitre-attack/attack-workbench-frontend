import {
  Analytic,
  Asset,
  Campaign,
  DataComponent,
  DataSource,
  DetectionStrategy,
  Group,
  Matrix,
  Mitigation,
  Software,
  StixObject,
  Tactic,
  Technique,
} from './index';

const domains = ['enterprise-attack', 'ics-attack'];

function rawObject(type: string) {
  return {
    workspace: {
      workflow: {
        state: 'work-in-progress',
      },
    },
    stix: {
      type,
      id: `${type}--00000000-0000-4000-8000-000000000000`,
      created: '2026-08-03T00:00:00.000Z',
      modified: '2026-08-03T00:00:00.000Z',
      spec_version: '2.1',
      name: 'Domain round-trip fixture',
      x_mitre_version: '1.0',
      x_mitre_domains: domains,
      external_references: [],
    },
  };
}

const targetTypes: {
  type: string;
  create: (raw: ReturnType<typeof rawObject>) => StixObject;
}[] = [
  { type: 'attack-pattern', create: raw => new Technique(raw) },
  { type: 'campaign', create: raw => new Campaign(raw) },
  { type: 'course-of-action', create: raw => new Mitigation(raw) },
  { type: 'intrusion-set', create: raw => new Group(raw) },
  { type: 'malware', create: raw => new Software('malware', raw) },
  { type: 'tool', create: raw => new Software('tool', raw) },
  { type: 'x-mitre-analytic', create: raw => new Analytic(raw) },
  { type: 'x-mitre-asset', create: raw => new Asset(raw) },
  {
    type: 'x-mitre-data-component',
    create: raw => new DataComponent(raw),
  },
  { type: 'x-mitre-data-source', create: raw => new DataSource(raw) },
  {
    type: 'x-mitre-detection-strategy',
    create: raw => new DetectionStrategy(raw),
  },
  { type: 'x-mitre-matrix', create: raw => new Matrix(raw) },
  { type: 'x-mitre-tactic', create: raw => new Tactic(raw) },
];

describe('canonical domain-bearing STIX objects', () => {
  it.each(targetTypes)(
    'preserves x_mitre_domains when revising $type',
    ({ type, create }) => {
      const object = create(rawObject(type));

      expect((object as StixObject & { domains: string[] }).domains).toEqual(
        domains
      );
      expect(object.serialize().stix.x_mitre_domains).toEqual(domains);
    }
  );
});
