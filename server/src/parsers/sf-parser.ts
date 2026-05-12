import * as fs from 'fs';
import * as path from 'path';

export interface SFCrawlResult {
  summary: {
    totalPages: number;
    crawledPages: number;
    uniqueDomains: number;
    brokenLinks: number;
    redirects: number;
    avgPageSize: number;
    avgResponseTime: number;
  };
  pages: SFPageData[];
  images: SFPageImage[]; // All images found in crawl (not per-page)
  issues: SFIssue[];
  scores: {
    metaTags: number;
    headings: number;
    images: number;
    links: number;
    technical: number;
    performance: number;
    overall: number;
  };
  psiScores?: {
    avgMobilePerformance: number;
    avgDesktopPerformance: number;
    avgOverallPerformance: number;
    coreWebVitalsPassRate: number;
    pagesWithPSI: number;
  };
}

export interface PagePSIData {
  mobile: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
    coreWebVitals: {
      lcp: { value: number; score: 'good' | 'needs-improvement' | 'poor' };
      inp: { value: number; score: 'good' | 'needs-improvement' | 'poor' };
      cls: { value: number; score: 'good' | 'needs-improvement' | 'poor' };
    };
  };
  desktop: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
    coreWebVitals: {
      lcp: { value: number; score: 'good' | 'needs-improvement' | 'poor' };
      inp: { value: number; score: 'good' | 'needs-improvement' | 'poor' };
      cls: { value: number; score: 'good' | 'needs-improvement' | 'poor' };
    };
  };
  overallScore: number;
}

export interface SFPageImage {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  format?: string;
}

export interface SFHreflang {
  hreflang: string;
  href: string;
}

export interface SFStructuredData {
  type: string;
  context?: string;
  valid: boolean;
  errors?: string[];
}

export interface SFAnalytics {
  hasGoogleAnalytics: boolean;
  hasUniversalAnalytics: boolean;
  hasGA4: boolean;
  hasGTM: boolean;
  trackingIds: string[];
}

export interface SFContent {
  first100Words: string;
  last150Words: string;
  wordCount: number;
  sentenceCount: number;
}

export interface SFHeadingCounts {
  h1Count: number;
  h2Count: number;
  h3Count: number;
  h4Count: number;
  h5Count: number;
  h6Count: number;
}

export interface SFPageData {
  url: string;
  statusCode: number;
  status?: string;
  contentType?: string;
  indexability?: string;
  indexabilityStatus?: string;
  title?: string;
  titleLength?: number;
  titlePixelWidth?: number;
  metaDescription?: string;
  metaDescriptionLength?: number;
  metaDescriptionPixelWidth?: number;
  metaKeywords?: string;
  metaKeywordsLength?: number;
  h1?: string;
  h1Length?: number;
  h1_2?: string;
  h1_2Length?: number;
  h2_1?: string;
  h2_1Length?: number;
  h2_2?: string;
  h2_2Length?: number;
  // Full heading counts
  headingCounts?: SFHeadingCounts;
  metaRobots?: string;
  xRobotsTag?: string;
  metaRefresh?: string;
  canonical?: string;
  relNext?: string;
  relPrev?: string;
  httpRelNext?: string;
  httpRelPrev?: string;
  amphtmlLink?: string;
  // Hreflang data
  hreflangs?: SFHreflang[];
  pageSize?: number;
  transferred?: number;
  totalTransferred?: number;
  co2?: number;
  carbonFootprint?: string;
  wordCount?: number;
  sentenceCount?: number;
  avgWordsPerSentence?: number;
  fleschReadabilityScore?: number;
  readability?: string;
  textRatio?: number;
  crawlDepth?: number;
  folderDepth?: number;
  linkScore?: number;
  inlinks?: number;
  uniqueInlinks?: number;
  uniqueJSInlinks?: number;
  inlinksPercent?: number;
  outlinks?: number;
  uniqueOutlinks?: number;
  uniqueJSOutlinks?: number;
  externalOutlinks?: number;
  uniqueExternalOutlinks?: number;
  uniqueJSExternalOutlinks?: number;
  nearestDuplicate?: string;
  duplicateCount?: number;
  spellingErrors?: number;
  grammarErrors?: number;
  hash?: string;
  responseTime?: number;
  lastModified?: string;
  redirectUrl?: string;
  redirectType?: string;
  cookies?: string;
  language?: string;
  httpVersion?: string;
  mobileAlternate?: string;
  // Structured data
  structuredData?: SFStructuredData[];
  hasStructuredData?: boolean;
  // Images
  images?: SFPageImage[];
  imageCount?: number;
  imagesMissingAlt?: number;
  totalImageSize?: number;
  // Analytics
  analytics?: SFAnalytics;
  // Content analysis
  content?: SFContent;
  // Campaign URLs in internal links
  hasCampaignUrls?: boolean;
  campaignUrlCount?: number;
  issues: string[];
  psi?: PagePSIData;
}

export interface SFIssue {
  type: 'error' | 'warning' | 'notice';
  category: string;
  message: string;
  url?: string;
  count?: number;
}

/**
 * Parse all CSV exports from a Screaming Frog crawl output directory
/**
 * Update scores with enriched data (images, structured data, etc.)
 */
export async function parseSFCrawlOutput(outputDir: string): Promise<SFCrawlResult> {
  // Find all files in output directory
  let files: string[] = [];
  
  try {
    // Check for timestamped subfolder
    const entries = await fs.promises.readdir(outputDir, { withFileTypes: true });
    const subfolder = entries.find(e => e.isDirectory());
    
    if (subfolder) {
      const subPath = path.join(outputDir, subfolder.name);
      const subFiles = await fs.promises.readdir(subPath);
      files = subFiles.map(f => path.join(subPath, f));
    } else {
      files = entries.map(e => path.join(outputDir, e.name));
    }
  } catch {
    // Directory doesn't exist yet
  }
  
  const result: SFCrawlResult = {
    summary: {
      totalPages: 0,
      crawledPages: 0,
      uniqueDomains: 0,
      brokenLinks: 0,
      redirects: 0,
      avgPageSize: 0,
      avgResponseTime: 0,
    },
    pages: [],
    images: [],
    issues: [],
    scores: {
      metaTags: 100,
      headings: 100,
      images: 100,
      links: 100,
      technical: 100,
      performance: 100,
      overall: 100,
    },
  };
  // Parse internal_all.csv (main crawl data)
  // Support both English and French filenames (SF locale-dependent)
  const internalFile = files.find(f => 
    (f.includes('internal') && f.endsWith('.csv')) ||
    (f.includes('interne') && f.endsWith('.csv'))
  );
  if (internalFile) {
    const pages = await parseInternalCSV(internalFile);
    result.pages = pages;
    result.summary.crawledPages = pages.length;
    result.summary.totalPages = pages.length;
    
    // Calculate averages
    const sizes = pages.filter(p => p.pageSize).map(p => p.pageSize as number);
    const times = pages.filter(p => p.responseTime).map(p => p.responseTime as number);
    result.summary.avgPageSize = sizes.length ? Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length) : 0;
    result.summary.avgResponseTime = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
    
    // Count issues
    let brokenCount = 0;
    let redirectCount = 0;
    const domains = new Set<string>();
    
    pages.forEach(page => {
      try {
        const urlObj = new URL(page.url);
        domains.add(urlObj.hostname);
      } catch {}
      
      if (page.statusCode >= 400) brokenCount++;
      if (page.statusCode >= 300 && page.statusCode < 400) redirectCount++;
      
      page.issues.forEach(issue => {
        result.issues.push({
          type: 'warning',
          category: 'content',
          message: issue,
          url: page.url,
        });
      });
    });
    
    result.summary.brokenLinks = brokenCount;
    result.summary.redirects = redirectCount;
    result.summary.uniqueDomains = domains.size;
    
    // Calculate category scores
    calculateScores(result, pages);
    
    // Parse additional CSV files for enriched data
    const pagesByUrl = new Map<string, SFPageData>();
    pages.forEach(p => pagesByUrl.set(p.url, p));
    
    // Parse in parallel for better performance
    await Promise.all([
      // Hreflang
      (async () => {
        const hreflangFile = files.find(f => f.toLowerCase().includes('hreflang') && f.endsWith('.csv'));
        if (hreflangFile) await parseHreflangCSV(hreflangFile, pagesByUrl);
      })(),
      
      // Images
      (async () => {
        const imagesFile = files.find(f => 
          (f.toLowerCase().includes('image') && f.endsWith('.csv')) ||
          (f.toLowerCase().includes('images') && f.endsWith('.csv'))
        );
        console.log(`[SF Parser] Images CSV file:`, imagesFile || 'NOT FOUND');
        if (imagesFile) await parseImagesCSV(imagesFile, pagesByUrl, result);
      })(),
      
      // Structured data
      (async () => {
        const structuredDataFile = files.find(f => 
          (f.toLowerCase().includes('structured') && f.endsWith('.csv')) ||
          (f.toLowerCase().includes('schema') && f.endsWith('.csv'))
        );
        if (structuredDataFile) await parseStructuredDataCSV(structuredDataFile, pagesByUrl);
      })(),
      
      // Headings (full counts)
      (async () => {
        const headingsFile = files.find(f => 
          (f.toLowerCase().includes('heading') && f.endsWith('.csv')) ||
          (f.toLowerCase().includes('h1') && f.endsWith('.csv'))
        );
        if (headingsFile) await parseHeadingsCSV(headingsFile, pagesByUrl);
      })(),
      
      // Internal links (for campaign URL detection)
      (async () => {
        const linksFile = files.find(f => 
          (f.toLowerCase().includes('inlinks') && f.endsWith('.csv')) ||
          (f.toLowerCase().includes('all_inlinks') && f.endsWith('.csv'))
        );
        if (linksFile) await parseInternalLinksCSV(linksFile, pagesByUrl);
      })(),
    ]);
    
    // Check for duplicates after all pages are processed
    detectDuplicates(pages);
    
    // Update scores with new data
    updateScoresWithEnrichedData(result, pages);
  }

  return result;
}

/**
 * Parse the internal_all.csv file (simple CSV parser)
/**
 * Update scores with enriched data (images, structured data, etc.)
 */
async function parseInternalCSV(filePath: string): Promise<SFPageData[]> {
  const content = await fs.promises.readFile(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) return [];
  
  const headers = parseCSVLine(lines[0]);
  const pages: SFPageData[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    const page: SFPageData = {
      url: row['Address'] || row['Adresse'] || row['URL'] || '',
      statusCode: parseInt(row['Status Code'] || row['Code HTTP'] || row['Status'] || '0', 10),
      status: row['Status'] || row['Statut'] || '',
      contentType: row['Content-Type'] || row['Content Type'] || row['Type de contenu'] || '',
      indexability: row['Indexability'] || row['Indexabilité'] || 'Indexable',
      indexabilityStatus: row['Indexability Status'] || row['Statut d\'indexabilité'] || '',
      title: row['Title 1'] || row['Title'] || '',
      titleLength: parseInt(row['Title 1 Length'] || row['Longueur du Title 1'] || '0', 10) || undefined,
      titlePixelWidth: parseInt(row['Title 1 Pixel Width'] || row['Largeur en pixels du Title 1'] || '0', 10) || undefined,
      metaDescription: row['Meta Description 1'] || row['Meta Description'] || '',
      metaDescriptionLength: parseInt(row['Meta Description 1 Length'] || row['Longueur de la Meta Description 1'] || '0', 10) || undefined,
      metaDescriptionPixelWidth: parseInt(row['Meta Description 1 Pixel Width'] || row['Largeur en pixels de la Meta Description 1'] || '0', 10) || undefined,
      metaKeywords: row['Meta Keywords 1'] || row['Meta Keywords'] || '',
      metaKeywordsLength: parseInt(row['Meta Keywords 1 Length'] || row['Longueur des Meta Keywords 1'] || '0', 10) || undefined,
      h1: row['H1-1'] || row['H1'] || '',
      h1Length: parseInt(row['H1-1 Length'] || row['Longueur du H1-1'] || '0', 10) || undefined,
      h1_2: row['H1-2'] || '',
      h1_2Length: parseInt(row['H1-2 Length'] || row['Longueur du H1-2'] || '0', 10) || undefined,
      h2_1: row['H2-1'] || '',
      h2_1Length: parseInt(row['H2-1 Length'] || row['Longueur du H2-1'] || '0', 10) || undefined,
      h2_2: row['H2-2'] || '',
      h2_2Length: parseInt(row['H2-2 Length'] || row['Longueur du H2-2'] || '0', 10) || undefined,
      metaRobots: row['Meta Robots 1'] || '',
      xRobotsTag: row['X-Robots-Tag 1'] || row['Balise X-Robots 1'] || '',
      metaRefresh: row['Meta Refresh 1'] || '',
      canonical: row['Canonical Link Element 1'] || row['Élément de lien en version canonique 1'] || row['Canonical'] || '',
      relNext: row['rel="next" 1'] || '',
      relPrev: row['rel="prev" 1'] || '',
      httpRelNext: row['HTTP rel="next" 1'] || '',
      httpRelPrev: row['HTTP rel="prev" 1'] || '',
      amphtmlLink: row['amphtml Link Element'] || row['Élément de lien amphtml'] || '',
      pageSize: parseSize(row['Size'] || row['Taille (octets)'] || row['Page Size'] || '0'),
      transferred: parseInt(row['Transferred'] || row['Transféré (octets)'] || '0', 10) || undefined,
      totalTransferred: parseInt(row['Total Transferred'] || row['Total transféré (en octets)'] || '0', 10) || undefined,
      co2: parseFloat(row['CO2 (mg)'] || '0') || undefined,
      carbonFootprint: row['Carbon Footprint'] || row['Empreinte carbone'] || '',
      wordCount: parseInt(row['Word Count'] || row['Nombre de mots'] || '0', 10) || undefined,
      sentenceCount: parseInt(row['Sentence Count'] || row['Nombre de phrases'] || '0', 10) || undefined,
      avgWordsPerSentence: parseFloat(row['Average Words Per Sentence'] || row['Moyenne de mots par phrase'] || '0') || undefined,
      fleschReadabilityScore: parseFloat(row['Flesch Readability Score'] || row['Score de lisibilité de Flesch'] || '0') || undefined,
      readability: row['Readability'] || row['Lisibilité'] || '',
      textRatio: parseFloat(row['Text Ratio'] || row['Ratio texte'] || '0') || undefined,
      crawlDepth: parseInt(row['Crawl Depth'] || row['Crawl profondeur'] || '0', 10) || undefined,
      folderDepth: parseInt(row['Folder Depth'] || row['Profondeur du dossier'] || '0', 10) || undefined,
      linkScore: parseFloat(row['Link Score'] || '0') || undefined,
      inlinks: parseInt(row['Inlinks'] || row['Liens entrants'] || '0', 10) || undefined,
      uniqueInlinks: parseInt(row['Unique Inlinks'] || row['Liens entrants uniques'] || '0', 10) || undefined,
      uniqueJSInlinks: parseInt(row['Unique JS Inlinks'] || row['Liens entrants JS uniques'] || '0', 10) || undefined,
      inlinksPercent: parseFloat(row['% of Total'] || row['% du total'] || '0') || undefined,
      outlinks: parseInt(row['Outlinks'] || row['Liens sortants'] || '0', 10) || undefined,
      uniqueOutlinks: parseInt(row['Unique Outlinks'] || row['Liens sortants uniques'] || '0', 10) || undefined,
      uniqueJSOutlinks: parseInt(row['Unique JS Outlinks'] || row['Liens sortants JS uniques'] || '0', 10) || undefined,
      externalOutlinks: parseInt(row['External Outlinks'] || row['Liens sortants externes'] || '0', 10) || undefined,
      uniqueExternalOutlinks: parseInt(row['Unique External Outlinks'] || row['Liens sortants externes uniques'] || '0', 10) || undefined,
      uniqueJSExternalOutlinks: parseInt(row['Unique JS External Outlinks'] || row['Liens sortants JS externes uniques'] || '0', 10) || undefined,
      nearestDuplicate: row['Nearest Duplicate'] || row['Quasi-doublon le plus proche'] || '',
      duplicateCount: parseInt(row['Duplicate Count'] || row['Nombre de quasi-doublons'] || '0', 10) || undefined,
      spellingErrors: parseInt(row['Spelling Errors'] || row['Erreurs d\'orthographe'] || '0', 10) || undefined,
      grammarErrors: parseInt(row['Grammar Errors'] || row['Erreurs de grammaire'] || '0', 10) || undefined,
      hash: row['Hash'] || row['Hachage'] || '',
      responseTime: parseFloat(row['Response Time'] || row['Temps de réponse'] || '0') || undefined,
      lastModified: row['Last Modified'] || '',
      redirectUrl: row['Redirect URI'] || row['Redirect URL'] || row['URL de redirection'] || '',
      redirectType: row['Redirect Type'] || row['Type de redirection'] || '',
      cookies: row['Cookies'] || '',
      language: row['Language'] || '',
      httpVersion: row['HTTP Version'] || row['Version HTTP'] || '',
      mobileAlternate: row['Mobile Alternate Link'] || row['Lien alternate mobile'] || '',
      issues: [],
    };
    
    // Detect analytics
    page.analytics = detectAnalytics(row);
    
    // Derive content analysis
    page.content = deriveContentAnalysis(page, row);
    
    
    // Detect issues
    if (!page.title) page.issues.push('Balise Title manquante');
    else if ((page.titleLength || 0) < 30) page.issues.push('Balise Title trop courte');
    else if ((page.titleLength || 0) > 60) page.issues.push('Balise Title trop longue');
    
    if (!page.metaDescription) page.issues.push('Meta Description manquante');
    else if ((page.metaDescriptionLength || 0) < 120) page.issues.push('Meta Description trop courte');
    else if ((page.metaDescriptionLength || 0) > 160) page.issues.push('Meta Description trop longue');
    
    if (!page.h1) page.issues.push('Balise H1 non utilisée');
    else if ((page.h1Length || 0) > 70) page.issues.push('Balise H1 trop longue');
    
    if (!page.h2_1 && !page.h2_2) page.issues.push('Balise H2 non utilisée');
    else {
      if ((page.h2_1Length || 0) > 70) page.issues.push('Balise H2 trop longue');
      if ((page.h2_2Length || 0) > 70) page.issues.push('Balise H2 trop longue');
    }
    
    if ((page.wordCount || 0) < 300) page.issues.push('Quantité de mots trop faible');
    if ((page.pageSize || 0) > 500000) page.issues.push('Page trop lourde (>500KB)');
    if ((page.responseTime || 0) > 2000) page.issues.push('Temps de réponse lent');
    
    // Only include HTML pages (must have text/html content type)
    // EXCEPTION: Keep error pages (4xx/5xx) even without HTML content type so we can detect them
    const isErrorPage = page.statusCode >= 400;
    if (!isErrorPage && (!page.contentType || !page.contentType.toLowerCase().includes('text/html'))) {
      continue;
    }
    pages.push(page);
  }
  
  return pages;
}

/**
 * Parse CSV line (handles quoted values)
/**
 * Update scores with enriched data (images, structured data, etc.)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

/**
 * Parse size string to bytes
/**
 * Update scores with enriched data (images, structured data, etc.)
 */
function parseSize(sizeStr: string): number {
  const match = sizeStr.match(/^([\d.]+)\s*(KB|MB|GB|B)?$/i);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = (match[2] || 'B').toUpperCase();
  
  switch (unit) {
    case 'KB': return value * 1024;
    case 'MB': return value * 1024 * 1024;
    case 'GB': return value * 1024 * 1024 * 1024;
    default: return value;
  }
}

/**
 * Calculate category scores based on issues found
/**
 * Update scores with enriched data (images, structured data, etc.)
 */
function calculateScores(result: SFCrawlResult, pages: SFPageData[]): void {
  if (pages.length === 0) return;
  
  // Meta Tags Score
  let metaScore = 100;
  const missingTitles = pages.filter(p => !p.title).length;
  const missingDescriptions = pages.filter(p => !p.metaDescription).length;
  metaScore -= (missingTitles / pages.length) * 40;
  metaScore -= (missingDescriptions / pages.length) * 30;
  result.scores.metaTags = Math.max(0, Math.round(metaScore));
  
  // Headings Score
  let headingScore = 100;
  const missingH1 = pages.filter(p => !p.h1).length;
  const missingH2 = pages.filter(p => !p.h2_1 && !p.h2_2).length;
  headingScore -= (missingH1 / pages.length) * 50;
  headingScore -= (missingH2 / pages.length) * 20;
  result.scores.headings = Math.max(0, Math.round(headingScore));
  
  // Technical Score
  let techScore = 100;
  const non200 = pages.filter(p => p.statusCode !== 200).length;
  const slowPages = pages.filter(p => (p.responseTime || 0) > 2000).length;
  techScore -= (non200 / pages.length) * 30;
  techScore -= (slowPages / pages.length) * 20;
  result.scores.technical = Math.max(0, Math.round(techScore));
  
  // Performance Score
  let perfScore = 100;
  const largePages = pages.filter(p => (p.pageSize || 0) > 500000).length;
  perfScore -= (largePages / pages.length) * 40;
  result.scores.performance = Math.max(0, Math.round(perfScore));
  
  // Links Score
  const brokenPercent = result.summary.brokenLinks / pages.length;
  result.scores.links = Math.max(0, Math.round(100 - brokenPercent * 50));
  
  // Overall Score (weighted average)
  result.scores.overall = Math.round(
    result.scores.metaTags * 0.2 +
    result.scores.headings * 0.15 +
    result.scores.images * 0.1 +
    result.scores.links * 0.15 +
    result.scores.technical * 0.2 +
    result.scores.performance * 0.2
  );
}

/**
 * Detect duplicate titles, meta descriptions, H1, and H2 across pages
/**
 * Update scores with enriched data (images, structured data, etc.)
 */
function detectDuplicates(pages: SFPageData[]): void {
  if (pages.length === 0) return;
  
  // Track titles, meta descriptions, H1s, and H2s
  const titleCounts = new Map<string, number>();
  const metaDescCounts = new Map<string, number>();
  const h1Counts = new Map<string, number>();
  const h2Counts = new Map<string, number>();
  
  // Count occurrences
  pages.forEach(page => {
    if (page.title) {
      const titleLower = page.title.toLowerCase();
      titleCounts.set(titleLower, (titleCounts.get(titleLower) || 0) + 1);
    }
    if (page.metaDescription) {
      const metaLower = page.metaDescription.toLowerCase();
      metaDescCounts.set(metaLower, (metaDescCounts.get(metaLower) || 0) + 1);
    }
    if (page.h1) {
      const h1Lower = page.h1.toLowerCase();
      h1Counts.set(h1Lower, (h1Counts.get(h1Lower) || 0) + 1);
    }
    const h2 = page.h2_1 || page.h2_2;
    if (h2) {
      const h2Lower = h2.toLowerCase();
      h2Counts.set(h2Lower, (h2Counts.get(h2Lower) || 0) + 1);
    }
  });
  
  // Add duplicate issues to pages
  pages.forEach(page => {
    if (page.title) {
      const titleLower = page.title.toLowerCase();
      if ((titleCounts.get(titleLower) || 0) > 1) {
        page.issues.push('Balise Title dupliquée');
      }
    }
    if (page.metaDescription) {
      const metaLower = page.metaDescription.toLowerCase();
      if ((metaDescCounts.get(metaLower) || 0) > 1) {
        page.issues.push('Meta Description dupliquée');
      }
    }
    if (page.h1) {
      const h1Lower = page.h1.toLowerCase();
      if ((h1Counts.get(h1Lower) || 0) > 1) {
        page.issues.push('Balise H1 dupliquée');
      }
    }
    if (page.metaDescription) {
      const metaLower = page.metaDescription.toLowerCase();
      if ((metaDescCounts.get(metaLower) || 0) > 1) {
        page.issues.push('Meta Description dupliquée');
      }
    }
    if (page.h1) {
      const h1Lower = page.h1.toLowerCase();
      if ((h1Counts.get(h1Lower) || 0) > 1) {
        page.issues.push('Balise H1 dupliquée');
      }
    }
    const h2 = page.h2_1 || page.h2_2;
    if (h2) {
      const h2Lower = h2.toLowerCase();
      if ((h2Counts.get(h2Lower) || 0) > 1) {
        page.issues.push('Balise H2 dupliquée');
      }
    }
  });
}

/**
 * Update scores with enriched data (images, structured data, etc.)
 */
function updateScoresWithEnrichedData(result: SFCrawlResult, pages: SFPageData[]): void {
  if (pages.length === 0) return;
  
  // Images Score - based on alt text coverage and image optimization
  let imageScore = 100;
  const pagesWithImages = pages.filter(p => (p.imageCount || 0) > 0);
  if (pagesWithImages.length > 0) {
    const totalImages = pagesWithImages.reduce((sum, p) => sum + (p.imageCount || 0), 0);
    const missingAlt = pagesWithImages.reduce((sum, p) => sum + (p.imagesMissingAlt || 0), 0);
    const altCoverage = (totalImages - missingAlt) / totalImages;
    imageScore = Math.round(altCoverage * 100);
    
    // Penalize large images
    const largeImagePages = pagesWithImages.filter(p => (p.totalImageSize || 0) > 500000).length;
    imageScore -= Math.round((largeImagePages / pagesWithImages.length) * 20);
  }
  result.scores.images = Math.max(0, imageScore);
  
  // Recalculate overall score with updated image score
  result.scores.overall = Math.round(
    result.scores.metaTags * 0.2 +
    result.scores.headings * 0.15 +
    result.scores.images * 0.1 +
    result.scores.links * 0.15 +
    result.scores.technical * 0.2 +
    result.scores.performance * 0.2
  );
  
  // Add issues for pages without structured data
  const pagesWithoutSchema = pages.filter(p => !p.hasStructuredData);
  pagesWithoutSchema.forEach(p => {
    p.issues.push('Données structurées manquantes');
  });
  
  // Add issues for pages without analytics
  const pagesWithoutAnalytics = pages.filter(p => !p.analytics?.hasGoogleAnalytics);
  pagesWithoutAnalytics.forEach(p => {
    p.issues.push('Google Analytics non détecté');
  });
  
  // Add issues for pages with campaign URLs in internal links
  pages.filter(p => p.hasCampaignUrls).forEach(p => {
    p.issues.push(`Contient ${p.campaignUrlCount} URL interne(s) avec UTM`);
  });
}


/**
 * Parse hreflang CSV export
/**
 * Update scores with enriched data (images, structured data, etc.)
 */
async function parseHreflangCSV(filePath: string, pagesByUrl: Map<string, SFPageData>): Promise<void> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return;
    
    const headers = parseCSVLine(lines[0]);
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      const url = row['Address'] || row['Adresse'] || row['URL'] || '';
      const hreflang = row['Hreflang'] || row['Langue du lien'] || '';
      const href = row['Href'] || row['Lien'] || '';
      
      if (url && hreflang && href) {
        const page = pagesByUrl.get(url);
        if (page) {
          if (!page.hreflangs) page.hreflangs = [];
          page.hreflangs.push({ hreflang, href });
        }
      }
    }
  } catch {
    // File doesn't exist or can't be parsed
  }
}

/**
 * Parse images CSV export (SF French/English format)
 * Note: SF Images export lists images independently, not per-page
 * The 'Adresse' column contains the IMAGE URL, not the page URL
/**
 * Update scores with enriched data (images, structured data, etc.)
 */
async function parseImagesCSV(filePath: string, pagesByUrl: Map<string, SFPageData>, result: SFCrawlResult): Promise<void> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return;
    
    const headers = parseCSVLine(lines[0]);
    const allImages: SFPageImage[] = [];
    
    console.log(`[SF Parser] parseImagesCSV: Headers found:`, headers);
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      // SF French format: 'Adresse' is the IMAGE URL (not page URL)
      // English format: 'Address' is the IMAGE URL
      const src = row['Address'] || row['Adresse'] || row['URL'] || row['Image URL'] || '';
      const alt = row['Alt Text'] || row['Texte alternatif'] || row['Alt'] || '';
      const width = parseInt(row['Width'] || row['Largeur'] || '0', 10) || undefined;
      const height = parseInt(row['Height'] || row['Hauteur'] || '0', 10) || undefined;
      // Size column: 'Size', 'Taille', or 'Taille (octets)' in French
      const sizeStr = row['Size'] || row['Taille'] || row['Taille (octets)'] || '0';
      const size = parseSize(sizeStr);
      const format = row['Format'] || row['Type de contenu'] || '';
      
      if (src) {
        const img: SFPageImage = { src, alt: alt || undefined, width, height, fileSize: size || undefined, format: format || undefined };
        allImages.push(img);
      }
    }
    
    // Store in result for global access
    result.images = allImages;
    
    // Also update per-page image counts for scoring (if we can determine which page owns which image)
    // Note: With the current SF export format, we can't link images to pages
    // So we just count total images for the score calculation
    
    console.log(`[SF Parser] parseImagesCSV: Found ${allImages.length} total images`);
  } catch (err) {
    // File doesn't exist or can't be parsed
    console.log(`[SF Parser] parseImagesCSV error:`, err);
  }
}

/**
 * Parse structured data CSV export
/**
 * Update scores with enriched data (images, structured data, etc.)
 */
async function parseStructuredDataCSV(filePath: string, pagesByUrl: Map<string, SFPageData>): Promise<void> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return;
    
    const headers = parseCSVLine(lines[0]);
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      const url = row['Address'] || row['Adresse'] || row['URL'] || '';
      const type = row['Schema Type'] || row['Type de schéma'] || row['Type'] || '';
      const context = row['Context'] || '';
      const valid = row['Valid'] === 'true' || row['Valide'] === 'true' || row['Valid'] === '1';
      const errors = row['Errors'] || row['Erreurs'] || '';
      
      if (url && type) {
        const page = pagesByUrl.get(url);
        if (page) {
          if (!page.structuredData) page.structuredData = [];
          page.structuredData.push({
            type,
            context: context || undefined,
            valid,
            errors: errors ? errors.split(';').filter(e => e.trim()) : undefined,
          });
          page.hasStructuredData = true;
        }
      }
    }
  } catch {
    // File doesn't exist or can't be parsed
  }
}

/**
 * Parse headings CSV export for full H1/H2 counts
/**
 * Update scores with enriched data (images, structured data, etc.)
 */
async function parseHeadingsCSV(filePath: string, pagesByUrl: Map<string, SFPageData>): Promise<void> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return;
    
    const headers = parseCSVLine(lines[0]);
    const headingCountsByUrl = new Map<string, SFHeadingCounts>();
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      const url = row['Address'] || row['Adresse'] || row['URL'] || '';
      const tag = (row['Tag'] || row['Balise'] || '').toLowerCase();
      
      if (url && tag.startsWith('h')) {
        if (!headingCountsByUrl.has(url)) {
          headingCountsByUrl.set(url, { h1Count: 0, h2Count: 0, h3Count: 0, h4Count: 0, h5Count: 0, h6Count: 0 });
        }
        const counts = headingCountsByUrl.get(url)!;
        if (tag === 'h1') counts.h1Count++;
        else if (tag === 'h2') counts.h2Count++;
        else if (tag === 'h3') counts.h3Count++;
        else if (tag === 'h4') counts.h4Count++;
        else if (tag === 'h5') counts.h5Count++;
        else if (tag === 'h6') counts.h6Count++;
      }
    }
    
    // Merge into pages
    headingCountsByUrl.forEach((counts, url) => {
      const page = pagesByUrl.get(url);
      if (page) {
        page.headingCounts = counts;
        // Add issue for multiple H1s
        if (counts.h1Count > 1) {
          page.issues.push(`Balises H1 multiples (${counts.h1Count})`);
        }
      }
    });
  } catch {
    // File doesn't exist or can't be parsed
  }
}

/**

/**
 * Detect analytics from internal CSV data
/**
 * Update scores with enriched data (images, structured data, etc.)
 */
function detectAnalytics(row: Record<string, string>): SFAnalytics | undefined {
  const analytics: SFAnalytics = {
    hasGoogleAnalytics: false,
    hasUniversalAnalytics: false,
    hasGA4: false,
    hasGTM: false,
    trackingIds: [],
  };
  
  // Check for GA related columns (SF may export these)
  const gaColumns = [
    'Google Analytics', 'GA', 'Analytics',
    'Google Analytics (UA)', 'Universal Analytics',
    'Google Analytics 4', 'GA4', 'GTM', 'Google Tag Manager'
  ];
  
  for (const col of gaColumns) {
    const value = row[col];
    if (value && value !== '0' && value.toLowerCase() !== 'false') {
      analytics.hasGoogleAnalytics = true;
      analytics.trackingIds.push(value);
      
      // Detect type
      if (col.includes('UA') || col.includes('Universal')) {
        analytics.hasUniversalAnalytics = true;
      }
      if (col.includes('4') || col.includes('GA4')) {
        analytics.hasGA4 = true;
      }
      if (col.includes('GTM') || col.includes('Tag Manager')) {
        analytics.hasGTM = true;
      }
    }
  }
  
  // Check for tracking IDs in the value (UA-XXXXX, G-XXXXX, GTM-XXXXX)
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'string') {
      const uaMatch = value.match(/UA-\d+-\d+/g);
      const ga4Match = value.match(/G-[A-Z0-9]+/g);
      const gtmMatch = value.match(/GTM-[A-Z0-9]+/g);
      
      if (uaMatch) {
        analytics.hasGoogleAnalytics = true;
        analytics.hasUniversalAnalytics = true;
        analytics.trackingIds.push(...uaMatch);
      }
      if (ga4Match) {
        analytics.hasGoogleAnalytics = true;
        analytics.hasGA4 = true;
        analytics.trackingIds.push(...ga4Match);
      }
      if (gtmMatch) {
        analytics.hasGTM = true;
        analytics.trackingIds.push(...gtmMatch);
      }
    }
  }
  
  if (analytics.hasGoogleAnalytics || analytics.hasGTM) {
    analytics.trackingIds = [...new Set(analytics.trackingIds)];
    return analytics;
  }
  
  return undefined;
}

/**
 * Detect campaign URLs (UTM parameters) in internal links
/**
 * Update scores with enriched data (images, structured data, etc.)
 */
async function parseInternalLinksCSV(filePath: string, pagesByUrl: Map<string, SFPageData>): Promise<void> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return;
    
    const headers = parseCSVLine(lines[0]);
    const campaignLinksByUrl = new Map<string, number>();
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      const sourceUrl = row['Source'] || row['Source URL'] || row['Origine'] || '';
      const destUrl = row['Destination'] || row['Destination URL'] || row['Destination'] || '';
      const linkType = row['Type'] || row['Link Type'] || '';
      
      // Check if it's an internal link with UTM parameters
      if (linkType.toLowerCase().includes('internal') && destUrl) {
        const hasUtm = /[?&]utm_(source|medium|campaign|term|content)=/i.test(destUrl);
        if (hasUtm) {
          const count = campaignLinksByUrl.get(sourceUrl) || 0;
          campaignLinksByUrl.set(sourceUrl, count + 1);
        }
      }
    }
    
    // Merge into pages
    campaignLinksByUrl.forEach((count, url) => {
      const page = pagesByUrl.get(url);
      if (page) {
        page.hasCampaignUrls = true;
        page.campaignUrlCount = count;
        page.issues.push(`Contient ${count} lien(s) interne(s) avec paramètres UTM`);
      }
    });
  } catch {
    // File doesn't exist or can't be parsed
  }
}

/**
 * Extract content analysis (first 100 / last 150 words)
 * Note: SF doesn't export this by default, so we derive from word count
/**
 * Update scores with enriched data (images, structured data, etc.)
 */
function deriveContentAnalysis(page: SFPageData, row: Record<string, string>): SFContent | undefined {
  const wordCount = page.wordCount || 0;
  
  // SF may export content snippets in some configurations
  const firstWords = row['First 100 Words'] || row['Premiers 100 mots'] || '';
  const lastWords = row['Last 150 Words'] || row['Derniers 150 mots'] || '';
  
  // If we have the data, use it
  if (firstWords || lastWords) {
    return {
      first100Words: firstWords,
      last150Words: lastWords,
      wordCount,
      sentenceCount: page.sentenceCount || 0,
    };
  }
  
  return undefined;
}