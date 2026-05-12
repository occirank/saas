import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { getGAService } from '../ga/ga-service.js';
import type { GAConnectionStatus, GAAnalyticsResult, GAProperty, GARealtimeData } from '../ga/types.js';
import { db } from '../db/index.js';
import { gaTokens, gaProperties, gaAnalytics } from '../db/schema.js';

export const gaRouter = Router();

let dbAvailable = false;
const checkDb = async () => {
  try {
    await db.select().from(gaTokens).limit(1);
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
};
checkDb();

/**
 * GET /api/ga/status
 * Check GA connection status
 */
gaRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const service = getGAService();
    
    if (!service.isConfigured()) {
      return res.json({
        connected: false,
        configured: false,
        hasTokens: false,
        error: 'GA credentials not configured. Set GA_CLIENT_ID and GA_CLIENT_SECRET environment variables.',
      } as GAConnectionStatus);
    }

    // Check database for stored tokens
    if (dbAvailable) {
      const [storedToken] = await db.select().from(gaTokens).limit(1);
      if (storedToken) {
        service.setTokens({
          accessToken: storedToken.accessToken,
          refreshToken: storedToken.refreshToken,
          expiryDate: storedToken.expiryDate,
          tokenType: storedToken.tokenType,
          scope: storedToken.scope || '',
        });
      }
    }

    if (!service.isConnected()) {
      return res.json({
        connected: false,
        configured: true,
        hasTokens: false,
      } as GAConnectionStatus);
    }

    // Get properties if connected
    const properties = await service.getProperties();
    
    // Sync properties to database
    if (dbAvailable && properties.length > 0) {
      for (const property of properties) {
        await db.insert(gaProperties)
          .values({
            propertyId: property.propertyId,
            propertyName: property.propertyName,
            accountName: property.accountName,
            websiteUrl: property.websiteUrl,
          })
          .onConflictDoUpdate({
            target: gaProperties.propertyId,
            set: {
              propertyName: property.propertyName,
              accountName: property.accountName,
              websiteUrl: property.websiteUrl,
              updatedAt: new Date(),
            },
          });
      }
    }

    res.json({
      connected: true,
      configured: true,
      hasTokens: true,
      properties,
    } as GAConnectionStatus);
  } catch (error) {
    console.error('GA status error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.json({
      connected: false,
      configured: true,
      hasTokens: false,
      error: message,
    } as GAConnectionStatus);
  }
});

/**
 * GET /api/ga/auth
 * Get OAuth authorization URL
 */
gaRouter.get('/auth', (_req: Request, res: Response) => {
  try {
    const service = getGAService();
    
    if (!service.isConfigured()) {
      return res.status(400).json({ 
        error: 'GA not configured. Set GA_CLIENT_ID and GA_CLIENT_SECRET environment variables.' 
      });
    }

    const state = Math.random().toString(36).substring(7);
    const authUrl = service.getAuthorizationUrl(state);
    
    res.json({ authUrl, state });
  } catch (error) {
    console.error('GA auth error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/ga/callback
 * OAuth callback endpoint
 */
gaRouter.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, error: oauthError } = req.query;

    if (oauthError) {
      return res.redirect(`http://localhost:5173/analytics?error=${encodeURIComponent(oauthError as string)}`);
    }

    if (!code) {
      return res.redirect('http://localhost:5173/analytics?error=No+authorization+code+received');
    }

    const service = getGAService();
    const tokens = await service.exchangeCodeForTokens(code as string);

    // Store tokens in database
    if (dbAvailable) {
      // Delete existing tokens first
      await db.delete(gaTokens);
      
      await db.insert(gaTokens).values({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiryDate: tokens.expiryDate,
        tokenType: tokens.tokenType,
        scope: tokens.scope,
      });
    }

    res.redirect('http://localhost:5173/analytics?connected=true');
  } catch (error) {
    console.error('GA callback error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.redirect(`http://localhost:5173/analytics?error=${encodeURIComponent(message)}`);
  }
});

/**
 * POST /api/ga/disconnect
 * Disconnect GA integration
 */
gaRouter.post('/disconnect', async (_req: Request, res: Response) => {
  try {
    const service = getGAService();
    service.setTokens(null);

    if (dbAvailable) {
      await db.delete(gaTokens);
    }

    res.json({ success: true, message: 'GA disconnected' });
  } catch (error) {
    console.error('GA disconnect error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/ga/properties
 * Get all connected GA properties
 */
gaRouter.get('/properties', async (_req: Request, res: Response) => {
  try {
    const service = getGAService();
    
    if (!service.isConnected()) {
      return res.status(401).json({ error: 'GA not connected' });
    }

    const properties = await service.getProperties();
    res.json(properties);
  } catch (error) {
    console.error('GA properties error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/ga/analytics
 * Get analytics data for a property
 */
gaRouter.post('/analytics', async (req: Request, res: Response) => {
  try {
    const { propertyId, startDate, endDate, useCache = true } = req.body;

    if (!propertyId || !startDate || !endDate) {
      return res.status(400).json({ 
        error: 'propertyId, startDate, and endDate are required' 
      });
    }

    const service = getGAService();
    
    if (!service.isConnected()) {
      return res.status(401).json({ error: 'GA not connected' });
    }

    // Check cache first
    if (dbAvailable && useCache) {
      const [cached] = await db.select()
        .from(gaAnalytics)
        .where(and(
          eq(gaAnalytics.propertyId, propertyId),
          eq(gaAnalytics.startDate, startDate),
          eq(gaAnalytics.endDate, endDate)
        ))
        .limit(1);

      // Cache is valid for 1 hour
      if (cached && (Date.now() - cached.createdAt.getTime()) < 60 * 60 * 1000) {
        return res.json(cached.analyticsData as unknown as GAAnalyticsResult);
      }
    }

    // Fetch fresh data
    const result = await service.getAnalytics(propertyId, startDate, endDate);

    // Cache the result
    if (dbAvailable) {
      await db.insert(gaAnalytics).values({
        propertyId,
        startDate,
        endDate,
        analyticsData: result as unknown as Record<string, unknown>,
      });
    }

    res.json(result);
  } catch (error) {
    console.error('GA analytics error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/ga/analytics/:propertyId
 * Get analytics for a specific property (with date range query params)
 */
gaRouter.get('/analytics/:propertyId', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const { startDate, endDate, useCache } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'startDate and endDate query parameters are required' 
      });
    }

    const service = getGAService();
    
    if (!service.isConnected()) {
      return res.status(401).json({ error: 'GA not connected' });
    }

    // Check cache first
    if (dbAvailable && useCache !== 'false') {
      const [cached] = await db.select()
        .from(gaAnalytics)
        .where(and(
          eq(gaAnalytics.propertyId, decodeURIComponent(propertyId)),
          eq(gaAnalytics.startDate, startDate as string),
          eq(gaAnalytics.endDate, endDate as string)
        ))
        .limit(1);

      // Cache is valid for 1 hour
      if (cached && (Date.now() - cached.createdAt.getTime()) < 60 * 60 * 1000) {
        return res.json(cached.analyticsData as unknown as GAAnalyticsResult);
      }
    }

    // Fetch fresh data
    const result = await service.getAnalytics(
      decodeURIComponent(propertyId),
      startDate as string,
      endDate as string
    );

    // Cache the result
    if (dbAvailable) {
      await db.insert(gaAnalytics).values({
        propertyId: decodeURIComponent(propertyId),
        startDate: startDate as string,
        endDate: endDate as string,
        analyticsData: result as unknown as Record<string, unknown>,
      });
    }

    res.json(result);
  } catch (error) {
    console.error('GA analytics error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/ga/realtime/:propertyId
 * Get realtime data for a property
 */
gaRouter.get('/realtime/:propertyId', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;

    const service = getGAService();
    
    if (!service.isConnected()) {
      return res.status(401).json({ error: 'GA not connected' });
    }

    const result = await service.getRealtimeData(decodeURIComponent(propertyId));
    res.json(result);
  } catch (error) {
    console.error('GA realtime error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
