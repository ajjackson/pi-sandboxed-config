# Reference the official helper images as build stages
# This forces Podman to automatically resolve and pull them on fresh systems
FROM ghcr.io/astral-sh/uv:latest AS uv_source
FROM ghcr.io/prefix-dev/pixi:latest AS pixi_source

FROM node:24-bookworm-slim

# Copy uv from our pulled build stage
COPY --from=uv_source /uv /uvx /usr/local/bin/

# Copy pixi from our pulled build stage
COPY --from=pixi_source /usr/local/bin/pixi /usr/local/bin/pixi

# Install system dependencies (including ripgrep, fd, jq, and build essentials)
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    git \
    ripgrep \
    fd-find \
    jq \
    make \
    curl \
 && ln -sf /usr/bin/fdfind /usr/local/bin/fd \
 && rm -rf /var/lib/apt/lists/*

# Delete pre-existing 'node' user with UID 1000 to avoid conflicts
RUN userdel -r node

# Create a non-root user 'pi' with standard UID 1000
RUN useradd -u 1000 -m -s /bin/bash pi

# Set up global npm directory inside the pi user's home directory
# This allows the 'pi' user to install packages globally without root permissions
ENV NPM_CONFIG_PREFIX=/home/pi/.npm-global
ENV PATH=/home/pi/.npm-global/bin:$PATH
ENV NODE_PATH=/home/pi/.npm-global/lib/node_modules

# Switch to non-root user 'pi'
USER pi
WORKDIR /home/pi

# Install pi-coding-agent and plugins globally in userspace (as user 'pi') during build time
RUN mkdir -p /home/pi/.npm-global/lib \
 && npm install -g @earendil-works/pi-coding-agent @twogiants/pi-anthropic-vertex

# Install the extensions globally via npm -g (this writes to /home/pi/.npm-global/lib/node_modules)
# which survives Podman's /home/pi tmpfs copy-up perfectly at container runtime.
# We then patch two known bugs in @lhl/pi-vertex:
#   1. toPiModel() leaves baseUrl empty, which pi's newer model validation rejects.
#   2. Exclude Gemini/Claude (already covered by the dedicated extensions above) and
#      Grok (no thanks) from the model list to avoid duplicate/unusable providers.
# Version pinned deliberately: the sed patches below are matched against this exact
# release's source (comment style, variable names). If bumping this version, first
# check upstream (https://www.npmjs.com/package/@lhl/pi-vertex) to see whether the
# baseUrl bug is fixed and the model-filtering patch still applies cleanly.
RUN npm install -g @twogiants/pi-anthropic-vertex@0.1.12 @lhl/pi-vertex@1.1.9 && \
    PLUGIN_DIR=/home/pi/.npm-global/lib/node_modules/@lhl/pi-vertex && \
    sed -i 's#baseUrl: "", // Will be set dynamically#baseUrl: "https://aiplatform.googleapis.com", // Will be set dynamically#' "$PLUGIN_DIR/index.ts" && \
    sed -i 's#\.\.\.MAAS_MODELS,#...MAAS_MODELS.filter((m) => !m.id.startsWith("grok-")),#' "$PLUGIN_DIR/models/index.ts" && \
    sed -i '/\.\.\.GEMINI_MODELS,/d' "$PLUGIN_DIR/models/index.ts" && \
    sed -i '/\.\.\.CLAUDE_MODELS,/d' "$PLUGIN_DIR/models/index.ts"

# Set workspace as the default working directory
WORKDIR /workspace

# Set entrypoint to run pi
ENTRYPOINT ["pi"]
