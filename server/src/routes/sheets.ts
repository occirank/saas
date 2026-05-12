import { Router, Request, Response } from 'express';
import { sheetsService, extractOnPageIssues, issuesToSheetRows } from '../sheets/index.js';
import { oauthService } from '../sheets/oauth-service.js';
import { parseSFCrawlOutput } from '../parsers/sf-parser.js';
import { getCrawlStatus } from '../crawler/sf-crawler.js';
import { db } from '../db/index.js';
import { audits } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import type { SFCrawlResult } from '../parsers/sf-parser.js';
export const sheetsRouter = Router();

let dbAvailable = false;
const checkDb = async () => {
  try {
    await db.select().from(audits).limit(1);
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
};
checkDb();

// ===========================================
// OAUTH2 ROUTES
// ===========================================

/**
 * GET /api/sheets/oauth/status
 * Get OAuth2 authentication status
 */
sheetsRouter.get('/oauth/status', (_req: Request, res: Response) => {
  const oauthConfigured = oauthService.isConfigured();
  const isAuthenticated = oauthService.isAuthenticated();
  const tokenInfo = oauthService.getTokenInfo();
  const configInfo = oauthService.getConfigInfo();

  res.json({
    oauthConfigured,
    isAuthenticated,
    tokenInfo,
    configInfo,
    serviceAccountConfigured: sheetsService.isConfigured() && !sheetsService.isOAuthMode(),
    message: !oauthConfigured
      ? 'OAuth2 not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET environment variables.'
      : !isAuthenticated
        ? 'OAuth2 configured but not authenticated. Visit /api/sheets/oauth/authorize'
        : 'OAuth2 authenticated and ready to export.',
  });
});
sheetsRouter.get('/oauth/authorize', (_req: Request, res: Response) => {
  try {
    if (!oauthService.isConfigured()) {
      return res.status(400).json({
        error: 'OAuth2 not configured',
        hint: 'Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET environment variables.',
      });
    }

    const authUrl = oauthService.getAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/sheets/oauth/callback
 * OAuth2 callback endpoint - exchanges code for tokens
 */
sheetsRouter.get('/oauth/callback', async (req: Request, res: Response) => {
  try {
    const { code, error: oauthError } = req.query;

    if (oauthError) {
      return res.status(400).send(`
        <html>
          <body>
            <h1>Authentication Failed</h1>
            <p>Error: ${oauthError}</p>
            <p><a href="/api/sheets/oauth/authorize">Try again</a></p>
          </body>
        </html>
      `);
    }

    if (!code || typeof code !== 'string') {
      return res.status(400).send(`
        <html>
          <body>
            <h1>Invalid Request</h1>
            <p>No authorization code received.</p>
          </body>
        </html>
      `);
    }

    // Exchange code for tokens
    const tokens = await oauthService.exchangeCode(code);

    // Reload sheets service config to pick up OAuth
    sheetsService['loadConfig']();

    res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h1 style="color: #4CAF50;">✓ Authentication Successful!</h1>
          <p>Your Google account has been connected to OCCIRank.</p>
          <p>You can now export crawl results to Google Sheets.</p>
          <p><strong>Token expires:</strong> ${new Date(tokens.expiry_date).toLocaleString()}</p>
          <p><a href="/api/sheets/status">Check Status</a> | <a href="/">Back to App</a></p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('[OAuth] Callback error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).send(`
      <html>
        <body>
          <h1>Authentication Error</h1>
          <p>${message}</p>
          <p><a href="/api/sheets/oauth/authorize">Try again</a></p>
        </body>
      </html>
    `);
  }
});

/**
 * POST /api/sheets/oauth/revoke
 * Revoke OAuth2 tokens
 */
sheetsRouter.post('/oauth/revoke', async (_req: Request, res: Response) => {
  try {
    const success = await oauthService.revokeAuth();
    
    // Reload sheets service config
    sheetsService['loadConfig']();

    res.json({
      success,
      message: success 
        ? 'OAuth2 authentication revoked successfully' 
        : 'Failed to revoke authentication',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/sheets/oauth/auth-url
 * Get the authorization URL (for frontend to handle redirect)
 */
sheetsRouter.get('/oauth/auth-url', (_req: Request, res: Response) => {
  try {
    if (!oauthService.isConfigured()) {
      return res.status(400).json({
        error: 'OAuth2 not configured',
        hint: 'Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET environment variables.',
      });
    }

    const authUrl = oauthService.getAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ===========================================
// EXISTING ROUTES
// ===========================================

/**
 * GET /api/sheets/status
 * Check if Google Sheets is configured
 */
sheetsRouter.get('/status', (_req: Request, res: Response) => {
  const configured = sheetsService.isConfigured();
  const oauthConfigured = oauthService.isConfigured();
  const oauthAuthenticated = oauthService.isAuthenticated();
  const useOAuth = sheetsService.isOAuthMode();

  res.json({
    configured,
    authenticationMethod: useOAuth ? 'oauth2' : (configured ? 'service_account' : 'none'),
    oauth: {
      configured: oauthConfigured,
      authenticated: oauthAuthenticated,
    },
    message: !configured
      ? 'Google Sheets not configured. Set up OAuth2 or service account credentials.'
      : 'Google Sheets is configured and ready to export',
  });
});

/**
 * POST /api/sheets/export/crawl/:crawlId
 * Export crawl issues to Google Sheets by crawl ID
 */
sheetsRouter.post('/export/crawl/:crawlId', async (req: Request, res: Response) => {
  try {
    if (!sheetsService.isConfigured()) {
      return res.status(503).json({
        error: 'Google Sheets not configured',
        hint: 'Set GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY, and GOOGLE_SHEETS_SPREADSHEET_ID environment variables.',
      });
    }

    const { crawlId } = req.params;
    const { clearExisting = true, sheetName } = req.body;

    const job = getCrawlStatus(crawlId);
    if (!job) {
      return res.status(404).json({ error: 'Crawl job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({
        error: 'Crawl not completed',
        status: job.status,
      });
    }

    // Parse crawl results
    const crawlResult = await parseSFCrawlOutput(job.outputDir);

    // Export to sheets
    const result = await sheetsService.exportCrawlIssues(crawlResult, job.url, {
      clearExisting,
      sheetName,
    });

    res.json({
      success: result.success,
      crawlId: job.id,
      siteUrl: job.url,
      issuesFound: result.issuesFound,
      rowsExported: result.rowsExported,
      error: result.error,
    });
  } catch (error) {
    console.error('[Sheets] Export error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/sheets/export/audit/:auditId
 * Export audit issues to Google Sheets by audit ID (from database)
 */
sheetsRouter.post('/export/audit/:auditId', async (req: Request, res: Response) => {
  try {
    if (!sheetsService.isConfigured()) {
      return res.status(503).json({
        error: 'Google Sheets not configured',
        hint: 'Set GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY, and GOOGLE_SHEETS_SPREADSHEET_ID environment variables.',
      });
    }

    if (!dbAvailable) {
      return res.status(503).json({
        error: 'Database not available',
        hint: 'Set up PostgreSQL with DATABASE_URL environment variable',
      });
    }

    const { auditId } = req.params;
    const { clearExisting = true, sheetName } = req.body;

    const [audit] = await db.select().from(audits).where(eq(audits.id, auditId)).limit(1);

    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    if (audit.auditType !== 'crawl') {
      return res.status(400).json({
        error: 'Only crawl audits can be exported to Sheets',
        auditType: audit.auditType,
      });
    }

    const crawlResult = audit.auditData as unknown as SFCrawlResult;

    // Export to sheets
    const result = await sheetsService.exportCrawlIssues(crawlResult, audit.url, {
      clearExisting,
      sheetName,
    });

    res.json({
      success: result.success,
      auditId: audit.id,
      siteUrl: audit.url,
      issuesFound: result.issuesFound,
      rowsExported: result.rowsExported,
      error: result.error,
    });
  } catch (error) {
    console.error('[Sheets] Export error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/sheets/export/url
 * Export issues for a specific URL (requires crawl data in request body)
 */
sheetsRouter.post('/export/url', async (req: Request, res: Response) => {
  try {
    if (!sheetsService.isConfigured()) {
      return res.status(503).json({
        error: 'Google Sheets not configured',
        hint: 'Set GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY, and GOOGLE_SHEETS_SPREADSHEET_ID environment variables.',
      });
    }

    const { siteUrl, crawlData, clearExisting = true, sheetName } = req.body;

    if (!siteUrl) {
      return res.status(400).json({ error: 'siteUrl is required' });
    }

    if (!crawlData) {
      return res.status(400).json({ error: 'crawlData is required' });
    }

    const crawlResult = crawlData as SFCrawlResult;

    // Export to sheets
    const result = await sheetsService.exportCrawlIssues(crawlResult, siteUrl, {
      clearExisting,
      sheetName,
    });

    res.json({
      success: result.success,
      siteUrl,
      issuesFound: result.issuesFound,
      rowsExported: result.rowsExported,
      error: result.error,
    });
  } catch (error) {
    console.error('[Sheets] Export error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/sheets/preview/:crawlId
 * Preview issues that would be exported (without actually exporting)
 */
sheetsRouter.get('/preview/:crawlId', async (req: Request, res: Response) => {
  try {
    const { crawlId } = req.params;

    const job = getCrawlStatus(crawlId);
    if (!job) {
      return res.status(404).json({ error: 'Crawl job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({
        error: 'Crawl not completed',
        status: job.status,
      });
    }

    // Parse crawl results
    const crawlResult = await parseSFCrawlOutput(job.outputDir);

    // Extract issues
    const issues = extractOnPageIssues(crawlResult, job.url);
    const rows = issuesToSheetRows(issues);

    // Group by category
    const byCategory = issues.reduce((acc, issue) => {
      acc[issue.category] = (acc[issue.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group by severity
    const bySeverity = issues.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      crawlId: job.id,
      siteUrl: job.url,
      totalIssues: issues.length,
      byCategory,
      bySeverity,
      sampleRows: rows.slice(0, 10),
      sheetsConfigured: sheetsService.isConfigured(),
    });
  } catch (error) {
    console.error('[Sheets] Preview error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/sheets/preview-audit/:auditId
 * Preview issues from a saved audit (without actually exporting)
 */
sheetsRouter.get('/preview-audit/:auditId', async (req: Request, res: Response) => {
  try {
    if (!dbAvailable) {
      return res.status(503).json({
        error: 'Database not available',
        hint: 'Set up PostgreSQL with DATABASE_URL environment variable',
      });
    }

    const { auditId } = req.params;

    const [audit] = await db.select().from(audits).where(eq(audits.id, auditId)).limit(1);

    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    if (audit.auditType !== 'crawl') {
      return res.status(400).json({
        error: 'Only crawl audits can be previewed',
        auditType: audit.auditType,
      });
    }

    const crawlResult = audit.auditData as unknown as SFCrawlResult;

    // Extract issues
    const issues = extractOnPageIssues(crawlResult, audit.url);
    const rows = issuesToSheetRows(issues);

    // Group by category
    const byCategory = issues.reduce((acc, issue) => {
      acc[issue.category] = (acc[issue.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group by severity
    const bySeverity = issues.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      auditId: audit.id,
      siteUrl: audit.url,
      totalIssues: issues.length,
      byCategory,
      bySeverity,
      sampleRows: rows.slice(0, 10),
      sheetsConfigured: sheetsService.isConfigured(),
    });
  } catch (error) {
    console.error('[Sheets] Preview error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
