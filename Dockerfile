# ============================================================
# Stage 1: Build the React client
# ============================================================
FROM node:20-bookworm AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ============================================================
# Stage 2: Build the Express server (TypeScript)
# ============================================================
FROM node:20-bookworm AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# ============================================================
# Stage 3: Production runtime with Screaming Frog + Xvfb
# ============================================================
# Screaming Frog SEO Spider requires:
#   - Java Runtime (JRE) 11+
#   - Xvfb (virtual framebuffer for headless rendering)
#   - Various X11/GTK libraries
FROM node:20-bookworm

# -----------------------------------------------------------
# Install system dependencies for Screaming Frog + Xvfb
# -----------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Java runtime (required by Screaming Frog)
    openjdk-17-jre-headless \
    # Virtual framebuffer for headless rendering
    xvfb \
    # X11 libraries needed by Screaming Frog's embedded browser
    libgtk2.0-0 \
    libnss3 \
    libnspr4 \
    libxss1 \
    libx11-xcb1 \
    libxkbfile1 \
    xdg-utils \
    # Utilities
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# -----------------------------------------------------------
# Install Screaming Frog SEO Spider CLI
# -----------------------------------------------------------
ARG SF_VERSION=23.3
RUN wget -q "https://download.screamingfrog.co.uk/products/seo-spider/screamingfrogseospider_${SF_VERSION}_all.deb" -O /tmp/sf.deb \
    && dpkg -i /tmp/sf.deb || true \
    && apt-get install -y -f --no-install-recommends \
    && rm /tmp/sf.deb \
    && rm -rf /var/lib/apt/lists/*

# Create symlink so config's default path works
# .deb installs to /usr/bin/, config expects /usr/local/bin/
RUN ln -sf /usr/bin/screamingfrogseospider /usr/local/bin/screamingfrogseospider

# Accept Screaming Frog EULA
RUN mkdir -p /root/.ScreamingFrogSEOSpider \
    && echo 'eula.accepted=12' > /root/.ScreamingFrogSEOSpider/spider.config

# Verify SF CLI installed correctly
RUN screamingfrogseospider --help > /dev/null 2>&1 || echo "SF CLI installed but --help may fail without Xvfb (expected)"

# -----------------------------------------------------------
# Set up the application
# -----------------------------------------------------------
WORKDIR /app

# Copy server dist + dependencies
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/package.json ./server/
COPY --from=server-builder /app/server/node_modules ./server/node_modules

# Copy client build (served as static files by Express)
COPY --from=client-builder /app/client/dist ./server/dist/public

# Create crawl output directory
RUN mkdir -p /var/lib/occirank/crawls

# -----------------------------------------------------------
# Entrypoint: start Xvfb then launch the Node app
# -----------------------------------------------------------
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

WORKDIR /app/server
ENV NODE_ENV=production
ENV PORT=3001
ENV DISPLAY=:99
ENV SF_OUTPUT_DIR=/var/lib/occirank/crawls
ENV SF_CLI_PATH=/usr/local/bin/screamingfrogseospider

EXPOSE 3001

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]