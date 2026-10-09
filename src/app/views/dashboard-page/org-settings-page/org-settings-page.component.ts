import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Identity } from 'src/app/classes/stix/identity';
import {
  MitreIdentityWrites,
  Namespace,
  RestApiConnectorService,
} from 'src/app/services/connectors/rest-api/rest-api-connector.service';

const MITRE_IDENTITY_STIX_ID = 'identity--c78cb6e5-0c4b-4611-8297-d1b8b55e40b5';

@Component({
  selector: 'app-org-settings-page',
  templateUrl: './org-settings-page.component.html',
  styleUrls: ['./org-settings-page.component.scss'],
  standalone: false,
})
export class OrgSettingsPageComponent implements OnInit {
  public organizationIdentity: Identity;
  public organizationIdentities: Identity[];
  public selectedOrganizationIdentityId: string;
  public organizationNamespace: Namespace;
  public mitreIdentityWrites: MitreIdentityWrites;
  private savedMitreIdentityWritesEnabled: boolean;
  public idRegex = `^([A-Za-z])*$`;
  public rangeRegex = `^([0-9]){1,4}$`;

  public isNOU = x => x === undefined || x === null; // isNullOrUndefined

  public get isNamespaceInvalid(): boolean {
    const regid = new RegExp(this.idRegex);
    const regrange = new RegExp(this.rangeRegex);
    return (
      !regid.test(this.organizationNamespace.prefix) ||
      (!this.isNOU(this.organizationNamespace.range_start) &&
        !regrange.test(this.organizationNamespace.range_start?.toString()))
    );
  }

  public get selectedOrganizationIdentity(): Identity {
    return this.organizationIdentities?.find(
      identity => identity.stixID === this.selectedOrganizationIdentityId
    );
  }

  public get isIdentityUnchanged(): boolean {
    return (
      !this.selectedOrganizationIdentityId ||
      this.selectedOrganizationIdentityId === this.organizationIdentity?.stixID
    );
  }

  public get isMitreIdentityWritesUnchanged(): boolean {
    return (
      !this.mitreIdentityWrites ||
      this.mitreIdentityWrites.enabled === this.savedMitreIdentityWritesEnabled
    );
  }

  public get hasMitreIdentity(): boolean {
    return (
      this.organizationIdentities?.some(
        identity => identity.stixID === MITRE_IDENTITY_STIX_ID
      ) ?? false
    );
  }

  constructor(private restAPIConnector: RestApiConnectorService) {}

  ngOnInit(): void {
    const idSub = forkJoin({
      identity: this.restAPIConnector.getOrganizationIdentity(),
      identities: this.restAPIConnector.getAllIdentities(),
    }).subscribe({
      next: ({ identity, identities }) => {
        this.organizationIdentity = identity;
        this.organizationIdentities = identities.data as Identity[];
        if (
          !this.organizationIdentities.some(
            organizationIdentity =>
              organizationIdentity.stixID === identity.stixID
          )
        ) {
          this.organizationIdentities.push(identity);
        }
        this.organizationIdentities.sort((a, b) =>
          (a.name || a.stixID).localeCompare(b.name || b.stixID)
        );
        this.selectedOrganizationIdentityId = identity.stixID;
        if (this.hasMitreIdentity) this.loadMitreIdentityWrites();
      },
      complete: () => idSub.unsubscribe(),
    });

    const namespaceSub = this.restAPIConnector
      .getOrganizationNamespace()
      .subscribe({
        next: namespaceSettings => {
          this.organizationNamespace = {
            ...namespaceSettings,
            range_start: namespaceSettings.range_start
              ? namespaceSettings.range_start.toString().padStart(4, '0')
              : undefined,
          };
        },
        complete: () => namespaceSub.unsubscribe(),
      });
  }

  private loadMitreIdentityWrites(): void {
    const mitreIdentityWritesSub = this.restAPIConnector
      .getMitreIdentityWrites()
      .subscribe({
        next: mitreIdentityWrites => {
          this.mitreIdentityWrites = mitreIdentityWrites;
          this.savedMitreIdentityWritesEnabled = mitreIdentityWrites.enabled;
        },
        complete: () => mitreIdentityWritesSub.unsubscribe(),
      });
  }

  onBlur(): void {
    if (!this.isNOU(this.organizationNamespace.range_start)) {
      this.organizationNamespace.range_start =
        this.organizationNamespace.range_start.toString().padStart(4, '0');
    }
  }

  saveIdentity(): void {
    const subscription = this.restAPIConnector
      .setOrganizationIdentityRef(this.selectedOrganizationIdentityId)
      .subscribe({
        next: () =>
          (this.organizationIdentity = this.selectedOrganizationIdentity),
        complete: () => subscription.unsubscribe(),
      });
  }

  saveNamespace(): void {
    const subscription = this.restAPIConnector
      .setOrganizationNamespace(this.organizationNamespace)
      .subscribe({
        next: namespace => (this.organizationNamespace = namespace),
        complete: () => subscription.unsubscribe(),
      });
  }

  saveMitreIdentityWrites(): void {
    const subscription = this.restAPIConnector
      .setMitreIdentityWrites(this.mitreIdentityWrites.enabled)
      .subscribe({
        next: () =>
          (this.savedMitreIdentityWritesEnabled =
            this.mitreIdentityWrites.enabled),
        complete: () => subscription.unsubscribe(),
      });
  }
}
