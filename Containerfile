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

# Set workspace as the default working directory
WORKDIR /workspace

# Set entrypoint to run pi
ENTRYPOINT ["pi"]
