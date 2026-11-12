import { readFileSync } from 'node:fs';

const targetViews = [
  ['technique', './technique-view/technique-view.component.html'],
  ['campaign', './campaign-view/campaign-view.component.html'],
  ['mitigation', './mitigation-view/mitigation-view.component.html'],
  ['group', './group-view/group-view.component.html'],
  ['software', './software-view/software-view.component.html'],
  ['analytic', './analytic-view/analytic-view.component.html'],
  ['asset', './asset-view/asset-view.component.html'],
  [
    'data component',
    './data-component-view/data-component-view.component.html',
  ],
  ['data source', './data-source-view/data-source-view.component.html'],
  [
    'detection strategy',
    './detection-strategy-view/detection-strategy-view.component.html',
  ],
  ['matrix', './matrix/matrix-view/matrix-view.component.html'],
  ['tactic', './tactic-view/tactic-view.component.html'],
] as const;

describe('canonical domain-bearing STIX object views', () => {
  it.each(targetViews)('exposes an editable domain field for %s', (_, path) => {
    const template = readFileSync(new URL(path, import.meta.url), 'utf8');

    expect(template).toMatch(/field:\s*'domains'/);
    expect(template).toMatch(/field:\s*'domains'[\s\S]*?editType:\s*'select'/);
  });
});
