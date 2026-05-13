# ============================================================
# Stage 1: Build the React client
# ============================================================
FROM node:20-bookworm AS client-builder
WORKDIR /app
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
RUN npm install
COPY client/ ./client/
RUN npm run build --workspace=client

# ============================================================
# Stage 2: Build the Express server (TypeScript)
# ============================================================
FROM node:20-bookworm AS server-builder
WORKDIR /app
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
RUN npm install
COPY server/ ./server/
RUN npm run build --workspace=server

# ============================================================
# Stage 3: Production runtime with Screaming Frog + Xvfb
# ============================================================
FROM node:20-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-17-jre-headless \
    xvfb \
    libgtk2.0-0 \
    libnss3 \
    libnspr4 \
    libxss1 \
    libx11-xcb1 \
    libxkbfile1 \
    xdg-utils \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ARG SF_VERSION=23.3
RUN wget -q "https://download.screamingfrog.co.uk/products/seo-spider/screamingfrogseospider_${SF_VERSION}_all.deb" -O /tmp/sf.deb \
    && dpkg -i /tmp/sf.deb || true \
    && apt-get install -y -f --no-install-recommends \
    && rm /tmp/sf.deb \
    && rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/bin/screamingfrogseospider /usr/local/bin/screamingfrogseospider

RUN mkdir -p /root/.ScreamingFrogSEOSpider \
    && echo 'eula.accepted=12' > /root/.ScreamingFrogSEOSpider/spider.config

RUN screamingfrogseospider --help > /dev/null 2>&1 || echo "SF CLI installed (--help may fail without Xvfb)"

WORKDIR /app

COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/package.json ./server/
# Workspaces hoist deps to /app/node_modules, not /app/server/node_modules
COPY --from=server-builder /app/node_modules ./node_modules

COPY --from=client-builder /app/client/dist ./server/dist/public

RUN mkdir -p /var/lib/occirank/crawls

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