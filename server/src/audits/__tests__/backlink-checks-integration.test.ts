import { describe, it, expect, beforeAll } from 'vitest';
import { getAhrefsProxyService } from '../../ahrefs/index.js';
import { runBacklinkChecks, summarizeBacklinkHealth } from '../backlink-checks.js';

const PROXY_SESSION = process.env.TEST_AHREFS_PROXY_SESSION || process.env.AHREFS_PROXY_SESSION;
const TEST_DOMAIN = process.env.TEST_DOMAIN || 'www.cointribune.com';

describe.skipIf(!PROXY_SESSION)('Ahrefs Integration (requires proxy session)', () => {
  const service = getAhrefsProxyService();

  beforeAll(() => {
    if (PROXY_SESSION) {
      service.setProxySession(PROXY_SESSION);
    }
  });

  it('gets domain rating', async () => {
    const result = await service.getDomainRating(TEST_DOMAIN, 'fr');
    expect(result).toHaveProperty('domainRating');
    expect(result.domainRating.value).toBeGreaterThanOrEqual(0);
    expect(result.domainRating.value).toBeLessThanOrEqual(100);
  }, 30000);

  it('gets backlinks stats', async () => {
    const result = await service.getBacklinksStats(TEST_DOMAIN, 'fr');
    expect(result).toHaveProperty('backlinks');
    expect(result).toHaveProperty('refdomains');
    expect(result.backlinks).toBeGreaterThanOrEqual(0);
  }, 30000);

  it('gets refdomains history', async () => {
    const result = await service.getRefdomainsHistory(TEST_DOMAIN, 'year1', 'weekly', 'fr');
    expect(result).toHaveProperty('history');
    expect(Array.isArray(result.history)).toBe(true);
    if (result.history.length > 0) {
      expect(result.history[0]).toHaveProperty('date');
      expect(result.history[0]).toHaveProperty('refdomains');
    }
  }, 30000);

  it('gets full analysis', async () => {
    const result = await service.getFullAnalysis(TEST_DOMAIN, 'fr');
    expect(result).toHaveProperty('domainRating');
    expect(result).toHaveProperty('totalRefdomains');
    expect(result).toHaveProperty('refdomainsHistory');
    expect(result.analyzedAt).toBeInstanceOf(Date);
  }, 60000);

  it('runs all backlink checks', async () => {
    const results = await runBacklinkChecks({
      domain: TEST_DOMAIN,
      country: 'fr',
      sfBrokenLinks: [],
    });
    
    expect(results).toHaveLength(10);
    
    for (const result of results) {
      expect(result).toHaveProperty('questionId');
      expect(result).toHaveProperty('answer');
      expect(result).toHaveProperty('status');
      expect(['yes', 'no', 'partial', 'unknown']).toContain(result.answer);
      expect(['pass', 'fail', 'warning', 'info']).toContain(result.status);
    }
  }, 60000);

  it('summarizes backlink health', async () => {
    const results = await runBacklinkChecks({
      domain: TEST_DOMAIN,
      country: 'fr',
    });
    
    const summary = summarizeBacklinkHealth(results);
    
    expect(summary).toHaveProperty('overallScore');
    expect(summary).toHaveProperty('passed');
    expect(summary).toHaveProperty('failed');
    expect(summary).toHaveProperty('warnings');
    expect(summary.overallScore).toBeGreaterThanOrEqual(0);
    expect(summary.overallScore).toBeLessThanOrEqual(100);
  }, 60000);
});
