import type { AuditCheck, AuditContext, CheckResult } from '../types.js';

/**
 * Interface for analytics detection results
 */
export interface AnalyticsDetection {
  googleAnalytics: boolean;
  googleAnalytics4: boolean;
  universalAnalytics: boolean;
  googleTagManager: boolean;
  hotjar: boolean;
  facebookPixel: boolean;
  linkedinInsight: boolean;
  microsoftClarity: boolean;
  plausible: boolean;
  matomo: boolean;
  customTracking: boolean;
  detectedScripts: string[];
}

/**
 * Detect analytics and tracking scripts on page
 */
export function detectAnalytics(ctx: AuditContext): AnalyticsDetection {
  const { $, html } = ctx;
  const htmlLower = html.toLowerCase();
  
  const detection: AnalyticsDetection = {
    googleAnalytics: false,
    googleAnalytics4: false,
    universalAnalytics: false,
    googleTagManager: false,
    hotjar: false,
    facebookPixel: false,
    linkedinInsight: false,
    microsoftClarity: false,
    plausible: false,
    matomo: false,
    customTracking: false,
    detectedScripts: [],
  };

  // Google Analytics 4
  if (
    htmlLower.includes('gtag/js') ||
    htmlLower.includes('gtag(') ||
    htmlLower.includes('googletagmanager.com/gtag') ||
    htmlLower.includes('g-') && htmlLower.includes('gtag')
  ) {
    detection.googleAnalytics4 = true;
    detection.googleAnalytics = true;
    detection.detectedScripts.push('Google Analytics 4');
  }

  // Universal Analytics (UA)
  if (
    htmlLower.includes('google-analytics.com/analytics.js') ||
    htmlLower.includes('google-analytics.com/analytic') ||
    htmlLower.includes("ga('create',") ||
    htmlLower.includes('ua-')
  ) {
    detection.universalAnalytics = true;
    detection.googleAnalytics = true;
    detection.detectedScripts.push('Universal Analytics');
  }

  // Google Tag Manager
  if (
    htmlLower.includes('googletagmanager.com/gtm.js') ||
    htmlLower.includes('gtm.js') ||
    htmlLower.includes('gtm.start') ||
    htmlLower.includes('data-layer') ||
    htmlLower.includes('datalayer')
  ) {
    detection.googleTagManager = true;
    detection.detectedScripts.push('Google Tag Manager');
  }

  // Hotjar
  if (
    htmlLower.includes('hotjar.com') ||
    htmlLower.includes('hj(') ||
    htmlLower.includes('_hjid')
  ) {
    detection.hotjar = true;
    detection.detectedScripts.push('Hotjar');
  }

  // Facebook Pixel
  if (
    htmlLower.includes('connect.facebook.net') ||
    htmlLower.includes('fbq(') ||
    htmlLower.includes('facebook-jssdk')
  ) {
    detection.facebookPixel = true;
    detection.detectedScripts.push('Facebook Pixel');
  }

  // LinkedIn Insight
  if (
    htmlLower.includes('linkedin.com/px') ||
    htmlLower.includes('partner_id') ||
    htmlLower.includes('linkedin.com/servicing/leads')
  ) {
    detection.linkedinInsight = true;
    detection.detectedScripts.push('LinkedIn Insight');
  }

  // Microsoft Clarity
  if (
    htmlLower.includes('clarity.ms') ||
    htmlLower.includes('_clarity') ||
    htmlLower.includes('"clarity"')
  ) {
    detection.microsoftClarity = true;
    detection.detectedScripts.push('Microsoft Clarity');
  }

  // Plausible
  if (
    htmlLower.includes('plausible.io') ||
    htmlLower.includes('plausible.js')
  ) {
    detection.plausible = true;
    detection.detectedScripts.push('Plausible');
  }

  // Matomo/Piwik
  if (
    htmlLower.includes('matomo') ||
    htmlLower.includes('piwik') ||
    htmlLower.includes('_paq.push')
  ) {
    detection.matomo = true;
    detection.detectedScripts.push('Matomo');
  }

  // Check for generic tracking patterns
  const $scripts = $('script[src]');
  $scripts.each((_i, el) => {
    const src = $(el).attr('src') || '';
    const srcLower = src.toLowerCase();
    
    // Look for tracking-related URLs
    if (
      srcLower.includes('track') ||
      srcLower.includes('analytics') ||
      srcLower.includes('stats') ||
      srcLower.includes('pixel')
    ) {
      if (!detection.detectedScripts.some(s => srcLower.includes(s.toLowerCase()))) {
        detection.customTracking = true;
        // Extract domain for reporting
        try {
          const url = new URL(src);
          const domain = url.hostname.replace('www.', '');
          if (!detection.detectedScripts.includes(domain)) {
            detection.detectedScripts.push(`${domain} (tracking)`);
          }
        } catch {
          // Invalid URL
        }
      }
    }
  });

  return detection;
}

/**
 * Check Google Analytics presence
 */
export const checkGoogleAnalytics: AuditCheck = async (ctx: AuditContext): Promise<CheckResult> => {
  const analytics = detectAnalytics(ctx);

  if (!analytics.googleAnalytics && !analytics.googleTagManager) {
    return {
      id: 'google-analytics',
      name: 'Google Analytics',
      status: 'fail',
      score: 0,
      message: 'No Google Analytics or Google Tag Manager detected.',
      details: 'Install Google Analytics 4 to track user behavior and conversions.',
    };
  }

  // Prefer GA4
  if (analytics.googleAnalytics4) {
    return {
      id: 'google-analytics',
      name: 'Google Analytics',
      status: 'pass',
      score: 100,
      message: 'Google Analytics 4 is installed.',
      value: analytics.googleTagManager ? 'GA4 + GTM' : 'GA4',
    };
  }

  // UA is deprecated
  if (analytics.universalAnalytics && !analytics.googleAnalytics4) {
    return {
      id: 'google-analytics',
      name: 'Google Analytics',
      status: 'warning',
      score: 60,
      message: 'Universal Analytics detected (deprecated).',
      details: 'Migrate to Google Analytics 4 before July 2024.',
      value: 'Universal Analytics',
    };
  }

  // GTM without GA
  if (analytics.googleTagManager && !analytics.googleAnalytics) {
    return {
      id: 'google-analytics',
      name: 'Google Analytics',
      status: 'warning',
      score: 70,
      message: 'Google Tag Manager detected, but no GA tags found.',
      details: 'Ensure GA4 is configured in GTM.',
      value: 'GTM only',
    };
  }

  return {
    id: 'google-analytics',
    name: 'Google Analytics',
    status: 'pass',
    score: 100,
    message: 'Analytics tracking is installed.',
    value: analytics.detectedScripts.filter(s => s.includes('Google')).join(', '),
  };
};

/**
 * Check overall analytics coverage
 */
export const checkAnalyticsCoverage: AuditCheck = async (ctx: AuditContext): Promise<CheckResult> => {
  const analytics = detectAnalytics(ctx);
  const count = analytics.detectedScripts.length;

  if (count === 0) {
    return {
      id: 'analytics-coverage',
      name: 'Analytics Coverage',
      status: 'fail',
      score: 0,
      message: 'No analytics or tracking detected.',
      details: 'Consider adding analytics to understand user behavior.',
    };
  }

  // Must have at least one major analytics
  const hasMajor = analytics.googleAnalytics || analytics.googleTagManager;
  
  if (!hasMajor) {
    return {
      id: 'analytics-coverage',
      name: 'Analytics Coverage',
      status: 'warning',
      score: 50,
      message: 'Minor analytics detected, but no major analytics platform.',
      details: `Found: ${analytics.detectedScripts.join(', ')}`,
      value: `${count} scripts`,
    };
  }

  // Good coverage
  if (count >= 2) {
    return {
      id: 'analytics-coverage',
      name: 'Analytics Coverage',
      status: 'pass',
      score: 100,
      message: `Good analytics coverage with ${count} tracking tools.`,
      details: analytics.detectedScripts.join(', '),
      value: `${count} scripts`,
    };
  }

  return {
    id: 'analytics-coverage',
    name: 'Analytics Coverage',
    status: 'pass',
    score: 90,
    message: 'Analytics is installed.',
    details: analytics.detectedScripts.join(', '),
    value: `${count} script`,
  };
};

/**
 * Check conversion tracking setup
 */
export const checkConversionTracking: AuditCheck = async (ctx: AuditContext): Promise<CheckResult> => {
  const { html } = ctx;
  const htmlLower = html.toLowerCase();
  
  const trackingIndicators: string[] = [];
  let hasConversionTracking = false;

  // Google Ads conversion
  if (
    htmlLower.includes('googletagmanager.com/gtag') ||
    htmlLower.includes('gtag("event"')
  ) {
    trackingIndicators.push('Google Ads conversion possible');
    hasConversionTracking = true;
  }

  // Facebook conversion
  if (
    htmlLower.includes('fbq("track"') ||
    htmlLower.includes('fbq(\'track\'')
  ) {
    trackingIndicators.push('Facebook conversion');
    hasConversionTracking = true;
  }

  // LinkedIn conversion
  if (htmlLower.includes('lintrk') || htmlLower.includes('partner_id')) {
    trackingIndicators.push('LinkedIn conversion possible');
    hasConversionTracking = true;
  }

  // Check for event tracking patterns
  if (
    htmlLower.includes('dataLayer.push') ||
    htmlLower.includes('gtag("event"') ||
    htmlLower.includes('track("')
  ) {
    trackingIndicators.push('Event tracking detected');
    hasConversionTracking = true;
  }

  if (!hasConversionTracking) {
    return {
      id: 'conversion-tracking',
      name: 'Conversion Tracking',
      status: 'warning',
      score: 60,
      message: 'No conversion tracking patterns detected.',
      details: 'Consider setting up conversion tracking for key actions.',
    };
  }

  return {
    id: 'conversion-tracking',
    name: 'Conversion Tracking',
    status: 'pass',
    score: 100,
    message: 'Conversion tracking appears to be configured.',
    details: trackingIndicators.join('\n'),
  };
};

/**
 * Check for GDPR/privacy compliance indicators
 */
export const checkPrivacyCompliance: AuditCheck = async (ctx: AuditContext): Promise<CheckResult> => {
  const { $, html } = ctx;
  const htmlLower = html.toLowerCase();
  
  const indicators: string[] = [];
  let hasCompliance = false;

  // Cookie consent
  if (
    htmlLower.includes('cookie') && 
    (htmlLower.includes('consent') || htmlLower.includes('banner') || htmlLower.includes('notice'))
  ) {
    indicators.push('Cookie consent detected');
    hasCompliance = true;
  }

  // Privacy policy link
  const $privacyLink = $('a[href*="privacy"]').first();
  if ($privacyLink.length > 0) {
    indicators.push('Privacy policy link found');
    hasCompliance = true;
  }

  // Common consent management platforms
  const cmpPatterns = [
    'onetrust',
    'cookiebot',
    'quantcast',
    'trustarc',
    'cookieyes',
    'complianz',
    'borlabs',
    'iubenda',
  ];

  for (const cmp of cmpPatterns) {
    if (htmlLower.includes(cmp)) {
      indicators.push(`CMP: ${cmp}`);
      hasCompliance = true;
    }
  }

  // Consent mode (Google)
  if (
    htmlLower.includes('consent_mode') ||
    htmlLower.includes('gtag("consent"')
  ) {
    indicators.push('Google consent mode enabled');
    hasCompliance = true;
  }

  if (!hasCompliance) {
    return {
      id: 'privacy-compliance',
      name: 'Privacy Compliance',
      status: 'warning',
      score: 70,
      message: 'No privacy compliance indicators found.',
      details: 'Consider adding cookie consent for GDPR/CCPA compliance.',
    };
  }

  return {
    id: 'privacy-compliance',
    name: 'Privacy Compliance',
    status: 'pass',
    score: 100,
    message: 'Privacy compliance measures detected.',
    details: indicators.join('\n'),
  };
};

// Export analytics checks as array
export const analyticsChecks: AuditCheck[] = [
  checkGoogleAnalytics,
  checkAnalyticsCoverage,
  checkConversionTracking,
  checkPrivacyCompliance,
];
