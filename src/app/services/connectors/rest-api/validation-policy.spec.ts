import { Group } from 'src/app/classes/stix/group';
import { Relationship } from 'src/app/classes/stix/relationship';
import { ReadableStream } from 'node:stream/web';
import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { firstValueFrom, lastValueFrom, of, throwError } from 'rxjs';
import { ValidationData } from 'src/app/classes/serializable';
import { ExemptionReport } from 'src/app/classes/validation-policy';
import { RestApiConnectorService } from './rest-api-connector.service';

const report: ExemptionReport = {
  policyRevision: 2,
  state: 'completed',
  availability: 'retained',
  reportId: 'original',
  reportedExemptRevisions: 1,
  ruleApplications: 1,
};

describe('validation policy connector', () => {
  let http: {
    post: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
  };
  let connector: RestApiConnectorService;
  const object = {
    attackType: 'group',
    serialize: () => ({ stix: { type: 'intrusion-set' } }),
  };
  beforeEach(() => {
    http = { post: vi.fn(), get: vi.fn(), put: vi.fn() };
    connector = new RestApiConnectorService(
      http as any,
      { open: vi.fn() } as any,
      {} as any
    );
  });
  it('opts into the original dryRun and preserves report independently of warnings', async () => {
    http.post.mockReturnValue(of({ warnings: [], exemptionReport: report }));
    const result = await firstValueFrom(
      connector.validateStixObject()(object as any)
    );
    expect(http.post.mock.calls[0][2].params.get('exemptionReport')).toBe(
      'details'
    );
    expect(http.post.mock.calls[0][2].params.get('dryRun')).toBe('true');
    expect(result).toEqual({
      errors: [],
      warnings: [],
      exemptionReport: report,
    });
  });
  it('keeps original warnings, errors and partial report on a validation failure', async () => {
    const details = [{ path: ['name'], message: 'required' }];
    const warnings = [{ path: ['description'], message: 'legacy bypass' }];
    http.post.mockReturnValue(
      throwError(() => ({
        status: 400,
        error: {
          details,
          warnings,
          exemptionReport: { ...report, state: 'partial' },
        },
      }))
    );
    const result = await firstValueFrom(
      connector.validateStixObject()(object as any)
    );
    expect(result.errors).toEqual(details);
    expect(result.warnings).toEqual(warnings);
    expect(result.exemptionReport.state).toBe('partial');
  });
  it('reads scalar configuration204 headers from the full response', async () => {
    http.post.mockReturnValue(
      of(
        new HttpResponse({
          status: 204,
          body: null,
          headers: new HttpHeaders({
            'X-Validation-Report-Availability': 'retained',
            'X-Validation-Report-Id': 'original',
            'X-Validation-Report-Policy-Revision': '2',
            'X-Validation-Report-State': 'completed',
            'X-Validation-Report-Exempt-Revisions': '1',
            'X-Validation-Report-Rule-Applications': '1',
          }),
        })
      )
    );
    const result = await firstValueFrom(
      connector.setOrganizationIdentityRef('identity--1')
    );
    expect(http.post.mock.calls[0][2].observe).toBe('response');
    expect(http.post.mock.calls[0][2].params.get('exemptionReport')).toBe(
      'details'
    );
    expect(result.exemptionReport).toMatchObject(report);
  });
  it('keeps unavailable configuration reports with missing counts', async () => {
    http.post.mockReturnValue(
      of(
        new HttpResponse({
          status: 204,
          headers: new HttpHeaders({
            'X-Validation-Report-Availability': 'unavailable',
          }),
        })
      )
    );
    const result = await firstValueFrom(
      connector.setOrganizationNamespace({ prefix: 'ORG', range_start: '0001' })
    );
    expect(result.exemptionReport.availability).toBe('unavailable');
    expect(result.exemptionReport.reportedExemptRevisions).toBeUndefined();
  });
  it('retrieves original report pages using only retained GET selectors', async () => {
    http.get.mockReturnValue(of(report));
    await firstValueFrom(
      connector.getValidationReport('opaque-id', {
        statuses: ['deprecated'],
        ruleIds: ['rule'],
        cursor: 'page2',
        limit: 50,
      })
    );
    const params = http.get.mock.calls[0][1].params;
    expect(params.get('exemptionReport')).toBeNull();
    expect(params.get('exemptionStatuses')).toBe('deprecated');
    expect(params.get('exemptionRuleIds')).toBe('rule');
    expect(params.get('exemptionCursor')).toBe('page2');
    expect(http.post).not.toHaveBeenCalled();
  });
  it('merges separate operation reports without adding warning rows', () => {
    const first = new ValidationData();
    const second = new ValidationData();
    first.exemptionReports = [report];
    second.exemptionReports = [report, { ...report, reportId: 'actual-save' }];
    first.merge(second);
    expect(first.exemptionReports.map(item => item.reportId)).toEqual([
      'original',
      'actual-save',
    ]);
    expect(first.warnings).toEqual([]);
    expect(first.errors).toEqual([]);
  });
  it('opts into streaming import and retains the original terminal completion report', async () => {
    const events =
      'event: progress\ndata: {"phase":"validate"}\n\nevent: complete\ndata: ' +
      JSON.stringify({
        stix: { type: 'x-mitre-collection' },
        exemptionReport: report,
      }) +
      '\n\n';
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(events));
            controller.close();
          },
        }),
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    try {
      const result = await lastValueFrom(
        connector.streamCollectionBundleImport({ objects: [] })
      );
      expect(fetchMock.mock.calls[0][0]).toContain('exemptionReport=details');
      expect(result.type).toBe('complete');
      expect(result.data.exemptionReport).toEqual(report);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('preserves partial report in original streaming error event', async () => {
    const failure = {
      message: 'Import stopped',
      exemptionReport: { ...report, state: 'partial' },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  'event: error\ndata: ' + JSON.stringify(failure) + '\n\n'
                )
              );
              controller.close();
            },
          }),
        })
      )
    );
    try {
      await expect(
        firstValueFrom(connector.streamCollectionBundleImport({ objects: [] }))
      ).rejects.toEqual(failure);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('retains preview report through model validation without introducing exemption warnings', async () => {
    http.post.mockReturnValue(of({ exemptionReport: report, warnings: [] }));
    const relationship = new Relationship();
    const validation = await firstValueFrom(
      relationship.base_validate(connector)
    );
    expect(validation.exemptionReports).toEqual([report]);
    expect(validation.warnings).toEqual([]);
    expect(validation.errors).toEqual([]);
  });
  it('never sends earlier configuration report back in a later save payload', async () => {
    http.post.mockReturnValue(of(new HttpResponse({ status: 204 })));
    await firstValueFrom(
      connector.setOrganizationNamespace({
        prefix: 'ORG',
        range_start: '0001',
        exemptionReport: report,
      })
    );
    expect(http.post.mock.calls[0][1]).toEqual({
      prefix: 'ORG',
      range_start: 1,
    });
  });
  it('opts into actual object POST and PUT and retains each response report outside serialization', async () => {
    const raw = {
      stix: {
        type: 'intrusion-set',
        id: 'intrusion-set--saved',
        name: 'Saved',
        modified: '2026-10-08T01:00:00.000Z',
        created: '2026-10-08T01:00:00.000Z',
      },
      workspace: {},
    };
    const actual = { ...report, reportId: 'actual-save', policyRevision: 3 };
    http.post.mockReturnValue(of({ ...raw, exemptionReport: actual }));
    const saved = await firstValueFrom(connector.postGroup(new Group(raw)));
    expect(http.post.mock.calls[0][2].params.get('exemptionReport')).toBe(
      'details'
    );
    expect(http.post.mock.calls[0][2].params.get('dryRun')).toBeNull();
    expect(saved.exemptionReport).toEqual(actual);
    expect(saved.serialize()).not.toHaveProperty('exemptionReport');
    http.put.mockReturnValue(
      of({ ...raw, exemptionReport: { ...actual, reportId: 'metadata-save' } })
    );
    const updated = await firstValueFrom(connector.putGroup(saved));
    expect(http.put.mock.calls[0][2].params.get('exemptionReport')).toBe(
      'details'
    );
    expect(updated.exemptionReport.reportId).toBe('metadata-save');
  });
  it('preserves original actual save failure and its partial report', async () => {
    const failure = {
      status: 400,
      error: {
        message: 'Save rejected',
        warnings: [],
        exemptionReport: {
          ...report,
          reportId: 'failed-save',
          state: 'partial',
        },
      },
    };
    http.post.mockReturnValue(throwError(() => failure));
    await expect(firstValueFrom(connector.postGroup(new Group()))).rejects.toBe(
      failure
    );
    expect(http.post.mock.calls[0][2].params.get('exemptionReport')).toBe(
      'details'
    );
  });
  it('keeps committed POST and PUT successful when report delivery uses an unavailable envelope', async () => {
    const raw = {
      stix: {
        type: 'intrusion-set',
        id: 'intrusion-set--saved',
        name: 'Saved',
        modified: '2026-10-08T01:00:00.000Z',
        created: '2026-10-08T01:00:00.000Z',
      },
      workspace: {},
    };
    const unavailable: ExemptionReport = { availability: 'unavailable' };
    const response = { result: raw, exemptionReport: unavailable };
    http.post.mockReturnValue(of(response));
    const saved = await firstValueFrom(connector.postGroup(new Group(raw)));
    expect(saved.stixID).toBe(raw.stix.id);
    expect(saved.exemptionReport).toEqual(unavailable);
    http.put.mockReturnValue(of(response));
    const updated = await firstValueFrom(connector.putGroup(saved));
    expect(updated.stixID).toBe(raw.stix.id);
    expect(updated.exemptionReport).toEqual(unavailable);
    expect(updated.serialize()).not.toHaveProperty('exemptionReport');
  });
  it('returns both partial reports and the final error when forced collection preview fails', async () => {
    const initial = {
      status: 400,
      error: { message: 'Initial preview failed', exemptionReport: report },
    };
    const fallbackReport = {
      ...report,
      reportId: 'forced-preview',
      state: 'partial',
    };
    const fallback = {
      status: 400,
      error: {
        message: 'Forced preview failed',
        exemptionReport: fallbackReport,
      },
    };
    http.post
      .mockReturnValueOnce(throwError(() => initial))
      .mockReturnValueOnce(throwError(() => fallback));
    const result = await firstValueFrom(
      connector.previewCollectionBundle({ objects: [] })
    );
    expect(result.error).toBe(fallback.error);
    expect(result.preview).toBeUndefined();
    expect(result.exemptionReports).toEqual([report, fallbackReport]);
    expect(http.post).toHaveBeenCalledTimes(2);
  });
  it('keeps a collection preview usable when report delivery returns an unavailable envelope', async () => {
    const raw = {
      stix: {
        type: 'x-mitre-collection',
        id: 'x-mitre-collection--preview',
        name: 'Preview',
        modified: '2026-10-08T01:00:00.000Z',
        created: '2026-10-08T01:00:00.000Z',
      },
      workspace: {},
    };
    const unavailable: ExemptionReport = { availability: 'unavailable' };
    http.post.mockReturnValue(
      of({ result: raw, exemptionReport: unavailable })
    );
    const result = await firstValueFrom(
      connector.previewCollectionBundle({ objects: [] })
    );
    expect(result.error).toBeUndefined();
    expect(result.preview.stixID).toBe(raw.stix.id);
    expect(result.exemptionReports).toEqual([unavailable]);
    expect(http.post).toHaveBeenCalledOnce();
  });

  it('preserves dry-run warnings when reporting returns a fallback envelope', async () => {
    const warnings = [{ path: ['description'], message: 'Legacy bypass' }];
    const unavailable = { availability: 'unavailable' };
    http.post.mockReturnValue(
      of({ result: { warnings }, exemptionReport: unavailable })
    );
    const result = await firstValueFrom(
      connector.validateStixObject()(object as any)
    );
    expect(result.warnings).toEqual(warnings);
    expect(result.exemptionReport).toEqual(unavailable);
  });

  it('preserves failed dry-run diagnostics when reporting returns a fallback envelope', async () => {
    const details = [{ path: ['name'], message: 'Required name' }];
    const warnings = [{ path: ['description'], message: 'Legacy bypass' }];
    const unavailable = { availability: 'unavailable' };
    http.post.mockReturnValue(
      throwError(() => ({
        status: 400,
        error: {
          result: { message: 'Validation failed', details, warnings },
          exemptionReport: unavailable,
        },
      }))
    );
    const result = await firstValueFrom(
      connector.validateStixObject()(object as any)
    );
    expect(result.errors).toEqual(details);
    expect(result.warnings).toEqual(warnings);
    expect(result.exemptionReport).toEqual(unavailable);
  });
});
