FROM node:24-bookworm-slim

# Copy uv from the official uv image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# Copy pixi from the official pixi image
COPY --from=ghcr.io/prefix-dev/pixi:latest /usr/local/bin/pixi /usr/local/bin/pixi

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
# This allows 'pi' user to install packages globally without root permissions
ENV NPM_CONFIG_PREFIX=/home/pi/.npm-global
ENV PATH=/home/pi/.npm-global/bin:$PATH

# Switch to non-root user 'pi'
USER pi
WORKDIR /home/pi

# Install pi-coding-agent globally for the pi user
RUN mkdir -p /home/pi/.npm-global/lib && npm install -g @earendil-works/pi-coding-agent

# Set workspace as the default working directory
WORKDIR /workspace

# Set entrypoint to run pi
ENTRYPOINT ["pi"]
