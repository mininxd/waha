# ================================
# Global build args
# ================================
ARG NODE_IMAGE_TAG=24.11-bookworm-slim
ARG GOLANG_IMAGE_TAG=1.24-bookworm
ARG DASHBOARD_URL="https://github.com/mininxd/waha/releases/download/v2026.1.23_dash/waha_dashboard.zip"

# ================================
# Build (Node / App)
# ================================
FROM node:${NODE_IMAGE_TAG} AS build

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV YARN_CHECKSUM_BEHAVIOR=update

RUN apt-get update && apt-get install -y \
    git \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /git

COPY package.json yarn.lock ./

RUN npm install -g corepack \
    && corepack enable \
    && yarn set version 4.9.2 \
    && yarn install

COPY . .

RUN yarn install \
    && yarn build \
    && find ./dist -name "*.d.ts" -delete

# ================================
# Dashboard
# ================================
FROM node:${NODE_IMAGE_TAG} AS dashboard

ARG DASHBOARD_URL
ENV DASHBOARD_URL=${DASHBOARD_URL}

RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    jq \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /tmp

RUN echo "Using dashboard URL: ${DASHBOARD_URL}" \
    && wget "${DASHBOARD_URL}" -O dashboard.zip \
    && unzip dashboard.zip -d /dashboard \
    && rm dashboard.zip

# ================================
# GOWS
# ================================
FROM golang:${GOLANG_IMAGE_TAG} AS gows

RUN apt-get update && apt-get install -y \
    jq \
    protobuf-compiler \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

COPY waha.config.json /tmp/waha.config.json

WORKDIR /go/gows

RUN set -eux; \
    GOWS_GITHUB_REPO=$(jq -r '.waha.gows.repo' /tmp/waha.config.json); \
    GOWS_SHA=$(jq -r '.waha.gows.ref' /tmp/waha.config.json); \
    ARCH=$(uname -m); \
    case "$ARCH" in \
      x86_64) ARCH=amd64 ;; \
      aarch64) ARCH=arm64 ;; \
      *) echo "Unsupported architecture: $ARCH" && exit 1 ;; \
    esac; \
    mkdir -p bin; \
    wget -O bin/gows https://github.com/${GOWS_GITHUB_REPO}/releases/download/${GOWS_SHA}/gows-${ARCH}; \
    chmod +x bin/gows

# ================================
# Release
# ================================
FROM node:${NODE_IMAGE_TAG} AS release

ARG USE_BROWSER=chromium
ARG WHATSAPP_DEFAULT_ENGINE
ARG CHROME_VERSION="140.0.7339.80-1"
ARG OPUSTAGS_VERSION="1.10.1"

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_OPTIONS="--max-old-space-size=16384"
ENV WHATSAPP_DEFAULT_ENGINE=${WHATSAPP_DEFAULT_ENGINE}

# ----------------
# Base deps
# ----------------
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libvips \
    curl \
    libc6 \
    tini \
    && rm -rf /var/lib/apt/lists/*

# ----------------
# Browser deps
# ----------------
RUN if [ "$USE_BROWSER" = "chromium" ] || [ "$USE_BROWSER" = "chrome" ]; then \
      apt-get update && apt-get install -y --no-install-recommends \
        zip unzip wget \
        fontconfig \
        fonts-freefont-ttf \
        fonts-gfs-neohellenic \
        fonts-indic \
        fonts-ipafont-gothic \
        fonts-kacst \
        fonts-liberation \
        fonts-noto-cjk \
        fonts-noto-color-emoji \
        fonts-roboto \
        fonts-thai-tlwg \
        fonts-wqy-zenhei \
        fonts-open-sans \
        xvfb \
        xauth \
        libnss3 \
        libxss1 \
        libasound2 \
        libatk-bridge2.0-0 \
        libgtk-3-0 \
        libdrm2 \
        ca-certificates \
      && rm -rf /var/lib/apt/lists/*; \
    fi

# ----------------
# Chromium
# ----------------
RUN if [ "$USE_BROWSER" = "chromium" ]; then \
      apt-get update && apt-get install -y chromium --no-install-recommends \
      && rm -rf /var/lib/apt/lists/*; \
    fi

# ----------------
# Chrome
# ----------------
RUN if [ "$USE_BROWSER" = "chrome" ]; then \
      wget -q -O /tmp/chrome.deb \
        https://dl.google.com/linux/chrome/deb/pool/main/g/google-chrome-stable/google-chrome-stable_${CHROME_VERSION}_amd64.deb \
      && apt-get update \
      && apt-get install -y /tmp/chrome.deb \
      && rm /tmp/chrome.deb \
      && rm -rf /var/lib/apt/lists/*; \
    fi

# ----------------
# Opustags
# ----------------
RUN set -eux; \
    buildDeps="build-essential cmake pkg-config libogg-dev"; \
    apt-get update; \
    apt-get install -y --no-install-recommends ${buildDeps}; \
    mkdir -p /tmp/opustags; \
    curl -L https://github.com/fmang/opustags/archive/refs/tags/${OPUSTAGS_VERSION}.tar.gz \
      | tar -xz -C /tmp/opustags; \
    cd /tmp/opustags/opustags-${OPUSTAGS_VERSION}; \
    cmake -S . -B build -DCMAKE_INSTALL_PREFIX=/usr/local -DCMAKE_BUILD_TYPE=Release; \
    cmake --build build; \
    cmake --install build; \
    rm -rf /tmp/opustags; \
    apt-get purge -y --auto-remove ${buildDeps}; \
    rm -rf /var/lib/apt/lists/*

# ================================
# App assembly
# ================================
WORKDIR /app

COPY package.json ./
COPY --from=build /git/node_modules ./node_modules
COPY --from=build /git/dist ./dist
COPY --from=dashboard /dashboard ./dist/dashboard
COPY --from=gows /go/gows/bin/gows ./gows

COPY .env.example ./
COPY scripts/init-waha.js ./scripts/init-waha.js
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x ./scripts/init-waha.js \
    && printf '#!/bin/sh\nexec node /app/scripts/init-waha.js "$@"\n' > /usr/local/bin/init-waha \
    && chmod +x /usr/local/bin/init-waha \
    && chmod +x /entrypoint.sh

# ================================
# Runtime ENV
# ================================
ENV WAHA_GOWS_PATH=/app/gows
ENV WAHA_GOWS_SOCKET=/tmp/gows.sock
ENV CHOKIDAR_USEPOLLING=1
ENV CHOKIDAR_INTERVAL=5000
ENV WAHA_ZIPPER=ZIPUNZIP
ENV GODEBUG=netdns=cgo

EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/entrypoint.sh"]
