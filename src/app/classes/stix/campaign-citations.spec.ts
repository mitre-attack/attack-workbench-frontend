import { firstValueFrom, of } from 'rxjs';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { Campaign } from './campaign';

describe('Campaign citation validation', () => {
  it('preserves references cited by the first and last seen fields', async () => {
    const campaign = new Campaign({
      workspace: {
        workflow: {
          state: 'work-in-progress',
        },
      },
      stix: {
        type: 'campaign',
        id: 'campaign--46421788-b6e1-4256-b351-f8beffd1afba',
        created: '2023-09-27T13:11:52.340Z',
        modified: '2026-07-31T20:48:14.920Z',
        spec_version: '2.1',
        name: '2015 Ukraine Electric Power Attack',
        description: 'Campaign description without citations.',
        aliases: ['2015 Ukraine Electric Power Attack'],
        first_seen: '2015-12-01T05:00:00.000Z',
        last_seen: '2016-01-01T05:00:00.000Z',
        x_mitre_first_seen_citation: '(Citation: Booz Allen Hamilton)',
        x_mitre_last_seen_citation: '(Citation: Booz Allen Hamilton)',
        x_mitre_version: '1.0',
        external_references: [
          {
            source_name: 'mitre-attack',
            external_id: 'C0028',
            url: 'https://attack.mitre.org/campaigns/C0028',
          },
          {
            source_name: 'Booz Allen Hamilton',
            description: 'When The Lights Went Out.',
            url: 'https://example.com/when-the-lights-went-out.pdf',
          },
        ],
      },
    });
    const restApiService = {
      validateStixObject: () => () => of({ errors: [], warnings: [] }),
      getAllCampaigns: () => of({ data: [] }),
      getReference: () => of([]),
    } as unknown as RestApiConnectorService;

    await firstValueFrom(campaign.validate(restApiService));

    expect(campaign.serialize().stix.external_references).toContainEqual(
      expect.objectContaining({ source_name: 'Booz Allen Hamilton' })
    );
  });
});
