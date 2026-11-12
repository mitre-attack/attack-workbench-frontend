import { firstValueFrom } from 'rxjs';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { createAsyncObservable } from 'src/app/testing/mocks/rest-api-connector.mock';
import { Group } from './group';
import { Mitigation } from './mitigation';
import { Relationship } from './relationship';

function rawObject(type: string, id: string, state: string) {
  return {
    workspace: { workflow: { state } },
    stix: {
      type,
      id,
      created: '2026-08-04T12:00:00.000Z',
      modified: '2026-08-04T12:00:00.000Z',
      spec_version: '2.1',
      name: `${type} fixture`,
      description: `${type} description`,
      x_mitre_version: '1.0',
      external_references: [],
    },
  };
}

describe('Relationship revision workflow', () => {
  it('resets related SDOs to WIP in place after saving a relationship revision', async () => {
    const source = rawObject(
      'intrusion-set',
      'intrusion-set--00000000-0000-4000-8000-000000000001',
      'reviewed'
    );
    const target = rawObject(
      'course-of-action',
      'course-of-action--00000000-0000-4000-8000-000000000002',
      'awaiting-review'
    );
    const relationship = new Relationship({
      workspace: { workflow: { state: 'reviewed' } },
      stix: {
        type: 'relationship',
        id: 'relationship--00000000-0000-4000-8000-000000000003',
        created: '2026-08-04T12:00:00.000Z',
        modified: '2026-08-04T12:00:00.000Z',
        spec_version: '2.1',
        relationship_type: 'mitigates',
        source_ref: source.stix.id,
        target_ref: target.stix.id,
        description: 'Updated relationship description',
      },
      source_object: source,
      target_object: target,
    });
    const calls: string[] = [];
    const postRelationship = vi.fn((value: Relationship) => {
      calls.push('relationship:post');
      return createAsyncObservable(value);
    });
    const postGroup = vi.fn();
    const postMitigation = vi.fn();
    const putGroup = vi.fn((value: Group) => {
      calls.push('source:put');
      return createAsyncObservable(value);
    });
    const putMitigation = vi.fn((value: Mitigation) => {
      calls.push('target:put');
      return createAsyncObservable(value);
    });
    const restApiService = {
      postRelationship,
      postGroup,
      postMitigation,
      putGroup,
      putMitigation,
    } as unknown as RestApiConnectorService;

    await firstValueFrom(relationship.save(restApiService));

    expect(calls).toEqual(['relationship:post', 'source:put', 'target:put']);
    expect(postRelationship).toHaveBeenCalledWith(relationship);
    expect(putGroup).toHaveBeenCalledOnce();
    expect(putMitigation).toHaveBeenCalledOnce();
    expect(putGroup.mock.calls[0][0].workflow?.state).toBe('work-in-progress');
    expect(putMitigation.mock.calls[0][0].workflow?.state).toBe(
      'work-in-progress'
    );
    // Workflow state is workspace metadata: no new SDO revisions are created.
    expect(postGroup).not.toHaveBeenCalled();
    expect(postMitigation).not.toHaveBeenCalled();
  });
});
