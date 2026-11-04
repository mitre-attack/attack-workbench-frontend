# Container builds

The [Dockerfile](../../Dockerfile) provides a `dev` target for Angular live
reload and a default final image that serves the compiled application with
Nginx. For full application deployment, see the
[Workbench Deployment Guide](https://github.com/mitre-attack/attack-workbench-deployment).

## Building behind a corporate TLS proxy

Use a BuildKit-capable builder and an approved PEM bundle containing public
roots and your corporate CA certificates. Keep the bundle outside the build
context; do not supply private keys or registry credentials in this bundle.

From the repository root:

```bash
# Set this to an existing approved file outside the repository/build context.
export BUILD_CA_CERT=/absolute/path/to/combined-ca.pem

# Default final image: compiled application served by Nginx.
docker build \
  --secret "id=build_ca_cert,src=${BUILD_CA_CERT:?Set BUILD_CA_CERT}" \
  -t attack-workbench-frontend:local .

# Development image: Angular development server.
docker build --target dev \
  --secret "id=build_ca_cert,src=${BUILD_CA_CERT:?Set BUILD_CA_CERT}" \
  -t attack-workbench-frontend:local-dev .
```

Compose builds can provide the same secret using `build.secrets` and a top-level
file-backed secret named `build_ca_cert`. The secret source must be accessible
to the builder and comply with the host's filesystem policy. See
[Docker's build-secret documentation](https://docs.docker.com/build/building/secrets/).

Without the optional secret, the Dockerfile leaves the installers' normal trust
configuration in place. It does not disable certificate verification.

## Where the additional trust applies

- **npm installation:** the `dev` and `build` stages mount the secret at
  `/run/secrets/build_ca_cert` and set `NODE_EXTRA_CA_CERTS` for that `RUN`
  instruction. Node adds these certificates to its normal trusted certificates.
- **Alpine package installation:** the final Nginx stage mounts the secret at
  `/etc/apk/ca.pem` and sets `SSL_CERT_FILE` while running the existing
  `apk add --no-cache nodejs` instruction. This step uses the supplied bundle,
  which is why it must include public roots as well as corporate certificates.

These shell exports apply to the installation processes, not to subsequent
Dockerfile instructions or the running application. Build-time trust does not
configure Docker/BuildKit's trust for pulling base images or the Dockerfile
syntax frontend image. Configure the builder's registry/proxy trust separately.
Runtime custom trust is also a separate configuration; the build secret does
not install corporate certificates into the runtime trust store.

## Secret handling and validation limits

BuildKit does not automatically persist the secret mount in image layers.
However, this is not a blanket guarantee that the certificate file cannot enter
an image: `COPY . .` can copy a bundle placed inside the build context, unless
it is explicitly excluded by `.dockerignore`. Commands and dependency install
scripts running during the secret-mounted instruction can also read or copy it.
Keep the source outside the context and use trusted build inputs and scripts.

The Dockerfile's `-s` check treats an empty secret as absent. Node warns and
ignores missing or malformed extra-CA files rather than necessarily terminating;
this does not disable normal TLS verification. Explicit TLS `ca` options can
also override Node's extra-CA mechanism. See
[`NODE_EXTRA_CA_CERTS`](https://nodejs.org/api/cli.html#node_extra_ca_certsfile).
Do not treat a successful cached build as proof that a supplied bundle was
loaded or validated.

## Certificate rotation and build caching

Secret contents are not part of Docker's build-cache key. Changing the PEM
bundle alone does not force installation steps to run again. When verifying a
changed bundle, rerun the build with `--no-cache` and the same `--secret` option.
This re-executes the instructions without deleting existing images or globally
pruning the build cache. See
[Docker's secret cache behavior](https://docs.docker.com/build/cache/invalidation/#build-secrets).
