import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../db/index.js';
import { sheetsTokens } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

export class GoogleOAuthService {
  private oauth2Client: OAuth2Client | null = null;
  private config: OAuthConfig | null = null;

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3001/api/sheets/oauth/callback';

    if (clientId && clientSecret) {
      this.config = { clientId, clientSecret, redirectUri };
      this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      this.loadSavedTokens();
    }
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  isAuthenticated(): boolean {
    if (!this.oauth2Client) return false;
    const credentials = this.oauth2Client.credentials;
    return !!(credentials && credentials.refresh_token);
  }

  getOAuth2Client(): OAuth2Client | null {
    return this.oauth2Client;
  }

  getAuthUrl(): string {
    if (!this.oauth2Client) {
      throw new Error('OAuth2 not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET');
    }
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    if (!this.oauth2Client) throw new Error('OAuth2 not configured');
    const { tokens } = await this.oauth2Client.getToken(code);
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Failed to get required tokens');
    }
    this.oauth2Client.setCredentials(tokens);
    await this.saveTokens(tokens as OAuthTokens);
    return tokens as OAuthTokens;
  }

  private async loadSavedTokens(): Promise<void> {
    try {
      const [row] = await db.select().from(sheetsTokens).limit(1);
      if (row && this.oauth2Client) {
        this.oauth2Client.setCredentials({
          access_token: row.accessToken,
          refresh_token: row.refreshToken,
          expiry_date: row.expiryDate,
          token_type: row.tokenType,
          scope: row.scope,
        });
        console.log('[OAuth] Loaded saved tokens from DB');
      }
    } catch (error) {
      console.log('[OAuth] No saved tokens in DB:', error);
    }
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    try {
      const existing = await db.select().from(sheetsTokens).limit(1);
      if (existing.length > 0) {
        await db.update(sheetsTokens)
          .set({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiryDate: tokens.expiry_date,
            tokenType: tokens.token_type,
            scope: tokens.scope,
          })
          .where(eq(sheetsTokens.id, existing[0].id));
      } else {
        await db.insert(sheetsTokens).values({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiryDate: tokens.expiry_date,
          tokenType: tokens.token_type,
          scope: tokens.scope,
        });
      }
      console.log('[OAuth] Tokens saved to DB');
    } catch (error) {
      console.error('[OAuth] Failed to save tokens:', error);
    }
  }

  async refreshAccessToken(): Promise<boolean> {
    if (!this.oauth2Client) return false;
    try {
      const credentials = this.oauth2Client.credentials;
      if (!credentials.refresh_token) return false;

      const expiryDate = credentials.expiry_date || 0;
      if (Date.now() < expiryDate - 5 * 60 * 1000) return true;

      const { credentials: newCredentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(newCredentials);

      if (newCredentials.access_token) {
        await this.saveTokens({
          access_token: newCredentials.access_token,
          refresh_token: newCredentials.refresh_token || credentials.refresh_token,
          scope: newCredentials.scope || SCOPES.join(' '),
          token_type: newCredentials.token_type || 'Bearer',
          expiry_date: newCredentials.expiry_date || 0,
        });
      }
      console.log('[OAuth] Access token refreshed');
      return true;
    } catch (error) {
      console.error('[OAuth] Failed to refresh token:', error);
      return false;
    }
  }

  async revokeAuth(): Promise<boolean> {
    try {
      if (this.oauth2Client && this.oauth2Client.credentials.access_token) {
        await this.oauth2Client.revokeToken(this.oauth2Client.credentials.access_token);
      }
      if (this.oauth2Client) {
        this.oauth2Client.setCredentials({});
      }
      await db.delete(sheetsTokens);
      console.log('[OAuth] Authentication revoked');
      return true;
    } catch (error) {
      console.error('[OAuth] Failed to revoke auth:', error);
      return false;
    }
  }

  getTokenInfo(): { hasToken: boolean; expiresAt?: number; isExpired: boolean } {
    if (!this.oauth2Client || !this.oauth2Client.credentials.access_token) {
      return { hasToken: false, isExpired: true };
    }
    const expiryDate = this.oauth2Client.credentials.expiry_date || 0;
    return { hasToken: true, expiresAt: expiryDate, isExpired: Date.now() >= expiryDate };
  }

  getConfigInfo(): { configured: boolean; redirectUri?: string } {
    if (!this.config) return { configured: false };
    return { configured: true, redirectUri: this.config.redirectUri };
  }
}

export const oauthService = new GoogleOAuthService();
