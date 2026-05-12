export interface ScreamingFrogConfig {
  // Path to Screaming Frog CLI executable
  cliPath: string;
  // Output directory for exports
  outputDir: string;
  // Default crawl settings
  crawlSettings: {
    maxPages?: number;
    maxDepth?: number;
    maxThreads?: number;
    timeout?: number; // minutes
  };
  // Export settings
  exportSettings: {
    format: 'csv' | 'xlsx';
    tabs: string[]; // Which tabs to export
  };
}

export const defaultConfig: ScreamingFrogConfig = {
  cliPath: process.platform === 'win32' 
    ? 'C:\\Program Files (x86)\\Screaming Frog SEO Spider\\ScreamingFrogSEOSpiderCli.exe'
    : '/usr/local/bin/screamingfrogseospider',
  outputDir: process.env.SF_OUTPUT_DIR || 
    (process.platform === 'win32' 
      ? 'C:\\Users\\LITE\\occirank\\crawls' 
      : '/var/lib/occirank/crawls'),
  crawlSettings: {
    maxPages: 500,
    maxDepth: 10,
    maxThreads: 4,
    timeout: 480,
  },
  exportSettings: {
    format: 'csv',
    tabs: [
      'internal',
      'external',
      'redirects',
      'broken_links',
      'images',
      'page_titles',
      'meta_description',
      'h1',
      'h2',
    ],
  },
};

export function getConfig(): ScreamingFrogConfig {
  return {
    ...defaultConfig,
    cliPath: process.env.SF_CLI_PATH || defaultConfig.cliPath,
    outputDir: process.env.SF_OUTPUT_DIR || defaultConfig.outputDir,
    crawlSettings: {
      ...defaultConfig.crawlSettings,
      timeout: process.env.SF_TIMEOUT ? parseInt(process.env.SF_TIMEOUT, 10) : defaultConfig.crawlSettings.timeout,
    },
  };
}
