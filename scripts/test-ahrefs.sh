#!/bin/bash

# Ahrefs Integration Test Script
# Usage: ./test-ahrefs.sh [domain]

DOMAIN=${1:-"www.cointribune.com"}
BASE_URL="http://localhost:3001"
AHREFS_URL="$BASE_URL/api/ahrefs"

echo "=========================================="
echo "  Ahrefs Integration Test Suite"
echo "=========================================="
echo ""
echo "Testing domain: $DOMAIN"
echo "API base: $BASE_URL"
echo ""

# Check server is running
echo "[1/7] Checking server health..."
curl -s "$BASE_URL/health" | jq . || echo "❌ Server not running. Start with: cd server && npm run dev"
echo ""

# Check Ahrefs status
echo "[2/7] Checking Ahrefs proxy status..."
curl -s "$AHREFS_URL/status" | jq .
echo ""

# Test domain rating
echo "[3/7] Fetching Domain Rating..."
curl -s "$AHREFS_URL/dr/$DOMAIN" | jq .
echo ""

# Test backlinks stats
echo "[4/7] Fetching Backlinks Stats..."
curl -s "$AHREFS_URL/backlinks/$DOMAIN" | jq .
echo ""

# Test full analysis
echo "[5/7] Running Full Analysis..."
curl -s "$AHREFS_URL/analyze/$DOMAIN" | jq '{
  domainRating: .domainRating,
  totalBacklinks: .totalBacklinks,
  totalRefdomains: .totalRefdomains,
  organicTraffic: .organicTraffic,
  historyCount: (.refdomainsHistory | length)
}'
echo ""

# Test history
echo "[6/7] Fetching Refdomains History..."
curl -s "$AHREFS_URL/history/$DOMAIN?timeFrame=year1&grouping=weekly" | jq '{
  historyCount: (.history | length),
  firstPoint: .history[0],
  lastPoint: .history[-1]
}'
echo ""

# Test all checks
echo "[7/7] Running All 10 Backlink Checks..."
curl -s -X POST "$AHREFS_URL/check/$DOMAIN" \
  -H "Content-Type: application/json" \
  -d '{"country": "fr"}' | jq '[.[] | {
    id: .questionId,
    question: .question[0:50],
    answer: .answer,
    status: .status
  }]'
echo ""

echo "=========================================="
echo "  Test Complete"
echo "=========================================="
