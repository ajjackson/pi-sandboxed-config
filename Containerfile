# Reference the official helper images as build stages
# This forces Podman to automatically resolve and pull them on fresh systems
FROM ghcr.io/astral-sh/uv:latest AS uv_source
FROM ghcr.io/prefix-dev/pixi:latest AS pixi_source

FROM node:24-bookworm-slim

# Copy uv from our pulled build stage
COPY --from=uv_source /uv /uvx /usr/local/bin/

# Copy pixi from our pulled build stage
COPY --from=pixi_source /usr/local/bin/pixi /usr/local/bin/pixi

# Install system dependencies (including ripgrep, fd, jq, emacs, patch, and build essentials)
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    git \
    ripgrep \
    fd-find \
    jq \
    make \
    curl \
    patch \
    emacs-nox \
    procps \
    graphviz \
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
ENV EDITOR="emacsclient -t"
ENV ALTERNATE_EDITOR=""

# Switch to non-root user 'pi'
USER pi
WORKDIR /home/pi

# Install pi-coding-agent and plugins globally in userspace (as user 'pi') during build time
RUN mkdir -p /home/pi/.npm-global/lib /home/pi/.pi/agent/pi-blackhole \
 && npm install -g @earendil-works/pi-coding-agent @twogiants/pi-anthropic-vertex @fission-ai/openspec pi-openspec-status pi-web-access pi-blackhole

# Pre-configure pi-blackhole with Gemini-based workers and manual compaction mode
RUN echo '{"compaction":"manual","compactionEngine":"blackhole","memory":true,"sessionFallback":true,"model":{"provider":"google-vertex","id":"gemini-3.7-flash","thinking":"low"},"observerModel":{"provider":"google-vertex","id":"gemini-3.5-flash-lite","thinking":"off"},"observerFallbackModels":[{"provider":"google-vertex","id":"gemini-3.7-flash","thinking":"off"},{"provider":"google-vertex","id":"gemini-2.5-flash-lite","thinking":"off"}],"reflectorModel":{"provider":"google-vertex","id":"gemini-3.7-flash","thinking":"low"},"reflectorFallbackModels":[{"provider":"google-vertex","id":"gemini-3.5-flash","thinking":"low"},{"provider":"google-vertex","id":"gemini-2.5-flash","thinking":"off"}],"dropperModel":{"provider":"google-vertex","id":"gemini-3.5-flash-lite","thinking":"off"},"dropperFallbackModels":[{"provider":"google-vertex","id":"gemini-3.7-flash","thinking":"off"},{"provider":"google-vertex","id":"gemini-2.5-flash-lite","thinking":"off"}]}' > /home/pi/.pi/agent/pi-blackhole/pi-blackhole-config.json

# Initialize OpenSpec global agent skills and prompts for pi inside ~/.pi/agent/
# Uses an isolated temporary directory to extract only openspec-* skills and opsx-*.md prompts
RUN TMP_DIR=$(mktemp -d) && \
    ( \
      cd "$TMP_DIR" && \
      openspec init --tools pi && \
      mkdir -p /home/pi/.pi/agent/skills /home/pi/.pi/agent/prompts && \
      cp -r .pi/skills/openspec-* /home/pi/.pi/agent/skills/ && \
      cp -r .pi/prompts/opsx-*.md /home/pi/.pi/agent/prompts/ \
    ) && \
    rm -rf "$TMP_DIR"

# Copy build patches and custom agent extensions
COPY --chown=pi:pi patches/ /home/pi/.patches/
COPY --chown=pi:pi extensions/ /home/pi/.pi/agent/extensions/

# Install @lhl/pi-vertex globally and apply bugfix patches (fixes empty baseUrl in toPiModel, adds GLM-5.2 model).
RUN npm install -g @lhl/pi-vertex@1.1.9 && \
    patch -p1 -d /home/pi/.npm-global/lib/node_modules/@lhl/pi-vertex < /home/pi/.patches/pi-vertex-baseurl.patch && \
    patch -p1 -d /home/pi/.npm-global/lib/node_modules/@lhl/pi-vertex < /home/pi/.patches/pi-vertex-add-glm-5.2.patch && \
    rm -rf /home/pi/.patches

# Configure global settings with pre-installed packages
RUN echo '{"packages":["npm:pi-blackhole","npm:pi-openspec-status","npm:pi-web-access","npm:@twogiants/pi-anthropic-vertex","local:/home/pi/.pi/agent/extensions/pi-vertex-filter"]}' > /home/pi/.pi/agent/settings.json

# Set workspace as the default working directory
# Note on Configuration Files Scoping:
# - Workspace configs (such as .pi/settings.json, session records, prompts, and skills) 
#   are automatically searched and loaded from the project folder (/workspace/.pi).
# - Built-in configuration files like 'models.json' or 'auth.json' are strictly scoped 
#   to the global agent directory (~/.pi/agent/models.json) and are not natively loaded 
#   from the workspace. The launcher script (pi-launch) automatically bind-mounts 
#   local files (e.g. .pi/models.json) to their expected home locations inside the sandbox.
WORKDIR /workspace

# Set entrypoint to run pi
ENTRYPOINT ["pi"]
