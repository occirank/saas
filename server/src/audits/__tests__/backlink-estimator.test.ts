import { describe, it, expect } from 'vitest';
import {
  analyzeRefdomainsTrend,
  checkRapidGain,
  checkRapidDrop,
  checkSpikeDropPattern,
  checkPositiveTrend,
  estimateAnchorOveruse,
  estimateTldMismatch,
  checkBrokenBacklinks,
  checkLowQualityRefdomains,
  estimateSponsoredLinksWithoutNofollow,
  estimateDirectoryLinks,
} from '../backlink-estimator.js';
import type { RefdomainsHistoryPoint } from '../../ahrefs/types.js';

describe('analyzeRefdomainsTrend', () => {
  it('returns stable for empty history', () => {
    const result = analyzeRefdomainsTrend([]);
    expect(result.direction).toBe('stable');
    expect(result.percentChange).toBe(0);
  });

  it('returns stable for single point', () => {
    const history: RefdomainsHistoryPoint[] = [
      { date: '2024-01-01', refdomains: 100, refdomainsDofollow: 80, refdomainsNofollow: 20 },
    ];
    const result = analyzeRefdomainsTrend(history);
    expect(result.direction).toBe('stable');
  });

  it('detects positive trend', () => {
    const history: RefdomainsHistoryPoint[] = [
      { date: '2024-01-01', refdomains: 100, refdomainsDofollow: 80, refdomainsNofollow: 20 },
      { date: '2024-01-08', refdomains: 200, refdomainsDofollow: 180, refdomainsNofollow: 20 },
      { date: '2024-01-15', refdomains: 400, refdomainsDofollow: 360, refdomainsNofollow: 40 },
      { date: '2024-01-22', refdomains: 800, refdomainsDofollow: 720, refdomainsNofollow: 80 },
      { date: '2024-01-29', refdomains: 1600, refdomainsDofollow: 1440, refdomainsNofollow: 160 },
    ];
    const result = analyzeRefdomainsTrend(history);
    expect(result.direction).toBe('positive');
    expect(result.percentChange).toBe(1500);
  });

  it('detects spike (20%+ weekly increase)', () => {
    const history: RefdomainsHistoryPoint[] = [
      { date: '2024-01-01', refdomains: 100, refdomainsDofollow: 80, refdomainsNofollow: 20 },
      { date: '2024-01-08', refdomains: 130, refdomainsDofollow: 110, refdomainsNofollow: 20 },
    ];
    const result = analyzeRefdomainsTrend(history);
    expect(result.hasSpike).toBe(true);
    expect(result.spikePercent).toBe(30);
  });

  it('detects drop (10%+ weekly decrease)', () => {
    const history: RefdomainsHistoryPoint[] = [
      { date: '2024-01-01', refdomains: 100, refdomainsDofollow: 80, refdomainsNofollow: 20 },
      { date: '2024-01-08', refdomains: 85, refdomainsDofollow: 70, refdomainsNofollow: 15 },
    ];
    const result = analyzeRefdomainsTrend(history);
    expect(result.hasDrop).toBe(true);
  });

  it('detects spike-drop pattern', () => {
    const history: RefdomainsHistoryPoint[] = [
      { date: '2024-01-01', refdomains: 100, refdomainsDofollow: 80, refdomainsNofollow: 20 },
      { date: '2024-01-08', refdomains: 130, refdomainsDofollow: 110, refdomainsNofollow: 20 },
      { date: '2024-01-15', refdomains: 100, refdomainsDofollow: 85, refdomainsNofollow: 15 },
    ];
    const result = analyzeRefdomainsTrend(history);
    expect(result.hasSpikeDrop).toBe(true);
  });
});

describe('checkRapidGain', () => {
  it('returns pass when no spike', () => {
    const trend = analyzeRefdomainsTrend([
      { date: '2024-01-01', refdomains: 100, refdomainsDofollow: 80, refdomainsNofollow: 20 },
      { date: '2024-01-08', refdomains: 105, refdomainsDofollow: 85, refdomainsNofollow: 20 },
    ]);
    const result = checkRapidGain(trend);
    expect(result.status).toBe('pass');
    expect(result.answer).toBe('no');
  });

  it('returns warning when spike detected', () => {
    const trend = analyzeRefdomainsTrend([
      { date: '2024-01-01', refdomains: 100, refdomainsDofollow: 80, refdomainsNofollow: 20 },
      { date: '2024-01-08', refdomains: 130, refdomainsDofollow: 110, refdomainsNofollow: 20 },
    ]);
    const result = checkRapidGain(trend);
    expect(result.status).toBe('warning');
    expect(result.answer).toBe('yes');
  });
});

describe('checkBrokenBacklinks', () => {
  it('returns pass when no broken links', () => {
    const result = checkBrokenBacklinks([]);
    expect(result.status).toBe('pass');
    expect(result.answer).toBe('no');
  });

  it('returns fail when 404s exist', () => {
    const brokenLinks = [
      { url: 'https://example.com/old-page', statusCode: 404 },
      { url: 'https://example.com/another-old', statusCode: 404 },
    ];
    const result = checkBrokenBacklinks(brokenLinks);
    expect(result.status).toBe('fail');
    expect(result.answer).toBe('yes');
    expect(result.metrics?.brokenCount).toBe(2);
  });
});

describe('estimateAnchorOveruse', () => {
  it('returns unknown for empty anchors', () => {
    const result = estimateAnchorOveruse([]);
    expect(result.status).toBe('info');
    expect(result.answer).toBe('unknown');
  });

  it('returns pass for natural distribution', () => {
    const anchors = [
      { anchor: 'click here', count: 10 },
      { anchor: 'read more', count: 15 },
      { anchor: 'visit site', count: 12 },
    ];
    const result = estimateAnchorOveruse(anchors, 50);
    expect(result.status).toBe('pass');
  });

  it('returns fail when single anchor exceeds threshold', () => {
    const anchors = [
      { anchor: 'best SEO tool', count: 50 },
      { anchor: 'click here', count: 10 },
    ];
    const result = estimateAnchorOveruse(anchors, 15);
    expect(result.status).toBe('fail');
    expect(result.answer).toBe('yes');
  });
});

describe('estimateTldMismatch', () => {
  it('returns unknown for empty refdomains', () => {
    const result = estimateTldMismatch([], 'fr');
    expect(result.status).toBe('info');
  });

  it('returns pass for local TLDs', () => {
    const refdomains = [
      { domain: 'site1.fr' },
      { domain: 'site2.fr' },
      { domain: 'site3.be' },
    ];
    const result = estimateTldMismatch(refdomains, 'fr');
    expect(result.status).toBe('pass');
  });

  it('returns warning for high mismatch', () => {
    const refdomains = [
      { domain: 'site1.com' },
      { domain: 'site2.com' },
      { domain: 'site3.com' },
      { domain: 'site4.fr' },
    ];
    const result = estimateTldMismatch(refdomains, 'fr');
    expect(result.status).toBe('warning');
    expect(result.answer).toBe('yes');
  });
});
