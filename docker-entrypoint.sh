#!/bin/bash
set -e

# ============================================================
# docker-entrypoint.sh — Occirank with Screaming Frog + Xvfb
# ============================================================
# Starts a virtual framebuffer (Xvfb) for headless Chromium
# rendering used by Screaming Frog SEO Spider, then launches
# the Node.js application.
#
# ENV:
#   DISPLAY     - X display (default :99)
#   SF_OUTPUT_DIR - crawl output directory
# ============================================================

DISPLAY="${DISPLAY:-:99}"

# Start Xvfb in the background
echo "[entrypoint] Starting Xvfb on display ${DISPLAY}..."
Xvfb "${DISPLAY}" -screen 0 1280x1024x24 &
XVFB_PID=$!

# Wait for Xvfb to be ready
sleep 1
if ! kill -0 "${XVFB_PID}" 2>/dev/null; then
    echo "[entrypoint] ERROR: Xvfb failed to start"
    exit 1
fi
echo "[entrypoint] Xvfb running (PID: ${XVFB_PID})"

# Ensure crawl output directory exists
mkdir -p "${SF_OUTPUT_DIR:-/var/lib/occirank/crawls}"

# Apply Screaming Frog license key if provided via env var
if [ -n "${SF_LICENSE_KEY}" ]; then
    mkdir -p /root/.ScreamingFrogSEOSpider
    # Handle multi-line keys: \n literal or actual newlines both work
    printf '%b\n' "${SF_LICENSE_KEY}" > /root/.ScreamingFrogSEOSpider/licence.txt
    echo "[entrypoint] Screaming Frog license key applied"
fi

# Ensure EULA is always accepted at current version
echo 'eula.accepted=15' > /root/.ScreamingFrogSEOSpider/spider.config

# Launch the Node.js application
echo "[entrypoint] Starting application..."
exec "$@"