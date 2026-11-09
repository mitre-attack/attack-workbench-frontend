# syntax=docker/dockerfile:1

FROM node:22-alpine AS dev

WORKDIR /workspace

COPY package*.json ./
# Optional corporate CA trust is available only during this install.
RUN --mount=type=secret,id=build_ca_cert \
    if [ -s /run/secrets/build_ca_cert ]; then \
        export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca_cert; \
    fi; \
    npm ci

COPY . .

EXPOSE 80 4200

# Polling detects edits through Docker Desktop source mounts.
# Container mode reads optional /etc/workbench/config.json instead of source JSON.
CMD ["sh", "-c", "exec npm start -- --container --host 0.0.0.0 --port 80 --poll 1000"]

FROM --platform=${BUILDPLATFORM} node:22-alpine AS build

WORKDIR /workspace

# Copy everything
COPY . .

ARG TARGETOS
ARG TARGETARCH
ARG VERSION=dev
ARG BUILDTIME
ARG REVISION=unknown

# Make the OCI build metadata available while Angular's static assets are built.
ENV WORKBENCH_FRONTEND_APP_VERSION=${VERSION} \
    WORKBENCH_FRONTEND_GIT_COMMIT=${REVISION} \
    WORKBENCH_FRONTEND_BUILD_DATE=${BUILDTIME}

# Install dependencies
RUN --mount=type=secret,id=build_ca_cert \
    if [ -s /run/secrets/build_ca_cert ]; then \
        export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca_cert; \
    fi; \
    npm install --cpu ${TARGETARCH} --os ${TARGETOS}

# Build the application
RUN npm run build-prod -- --configuration-defaults-only

# Second stage: production environment
FROM nginx:stable-alpine-slim

# Run the same public-configuration generator used by native development.
# apk uses a combined public + corporate CA bundle without persisting it.
RUN --mount=type=secret,id=build_ca_cert,target=/etc/apk/ca.pem \
    if [ -s /etc/apk/ca.pem ]; then \
        export SSL_CERT_FILE=/etc/apk/ca.pem; \
    fi; \
    apk add --no-cache nodejs

# Define build arguments
ARG VERSION=dev
ARG BUILDTIME
ARG REVISION=unknown

# Set version as environment variable for runtime access
ENV WORKBENCH_FRONTEND_APP_VERSION=$VERSION \
    WORKBENCH_FRONTEND_GIT_COMMIT=$REVISION \
    WORKBENCH_FRONTEND_BUILD_DATE=$BUILDTIME

# Set Docker labels
LABEL org.opencontainers.image.title="ATT&CK Workbench Frontend Service" \
    org.opencontainers.image.description="This Docker image contains the frontend service of the ATT&CK Workbench, an application for exploring, creating, annotating, and sharing extensions of the MITRE ATT&CK® knowledge base. The service handles the storage, querying, and editing of ATT&CK objects. It is an Angular SPA served by an Nginx reverse proxy." \
    org.opencontainers.image.source="https://github.com/mitre-attack/attack-workbench-frontend" \
    org.opencontainers.image.documentation="https://github.com/mitre-attack/attack-workbench-frontend/README.md" \
    org.opencontainers.image.url="https://ghcr.io/mitre-attack/attack-workbench-frontend" \
    org.opencontainers.image.vendor="The MITRE Corporation" \
    org.opencontainers.image.licenses="Apache-2.0" \
    org.opencontainers.image.authors="MITRE ATT&CK<attack@mitre.org>" \
    org.opencontainers.image.version="${VERSION}" \
    org.opencontainers.image.created="${BUILDTIME}" \
    org.opencontainers.image.revision="${REVISION}" \
    maintainer="MITRE ATT&CK<attack@mitre.org>"

# Remove the default nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy the application bundles - explicitly specifying the full path
COPY --from=build /workspace/dist/app/browser /usr/share/nginx/html

COPY --from=build /workspace/.generated/runtime /opt/workbench/.generated/runtime
COPY scripts/write-runtime-config.mjs /opt/workbench/scripts/write-runtime-config.mjs
COPY docker/40-workbench-configuration.sh /docker-entrypoint.d/40-workbench-configuration.sh
RUN chmod +x /docker-entrypoint.d/40-workbench-configuration.sh
COPY docker/default.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80 443

# Command to run NGINX in foreground
CMD ["nginx", "-g", "daemon off;"]
