FROM --platform=${BUILDPLATFORM} node:22-alpine AS build

WORKDIR /workspace

# Copy everything
COPY . .

ARG TARGETOS
ARG TARGETARCH

# Install dependencies
RUN npm install --cpu ${TARGETARCH} --os ${TARGETOS}

# Build the application
RUN npm run build-prod --cpu ${TARGETARCH} --os ${TARGETOS}

# Second stage: production environment
FROM nginx:stable-alpine-slim

# Define build arguments
ARG VERSION=dev
ARG BUILDTIME=unknown
ARG REVISION=unknown

# Set version as environment variable for runtime access
ENV APP_VERSION=$VERSION \
    GIT_COMMIT=$REVISION \
    BUILD_DATE=$BUILDTIME

# Set Docker labels
LABEL org.opencontainers.image.title="ATT&CK Workbench Frontend Service" \
    org.opencontainers.image.description="This Docker image contains the frontend service of the ATT&CK Workbench, an application for exploring, creating, annotating, and sharing extensions of the MITRE ATT&CK® knowledge base. The service handles the storage, querying, and editing of ATT&CK objects. It is an Angular SPA served by an Nginx reverse proxy." \
    org.opencontainers.image.source="https://github.com/mitre-attack/attack-workbench-frontend" \
    org.opencontainers.image.documentation="https://github.com/mitre-attack/attack-workbench-frontend/README.md" \
    org.opencontainers.image.url="https://ghcr.io/mitre-attack/attack-workbench-frontend" \
    org.opencontainers.image.vendor="The MITRE Corporation" \
    org.opencontainers.image.licenses="Apache-2.0" \
    org.opencontainers.image.authors="MITRE ATT&CK<attack@mitre.org>" \
    maintainer="MITRE ATT&CK<attack@mitre.org>"

# Remove the default nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy the application bundles - explicitly specifying the full path
COPY --from=build /workspace/dist/app/browser /usr/share/nginx/html

# Expose port 80
EXPOSE 80 443

# Command to run NGINX in foreground
CMD ["nginx", "-g", "daemon off;"]