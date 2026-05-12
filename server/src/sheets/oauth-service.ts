import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

/**
 * OAuth2 Token structure
 */
export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

/**
 * OAuth2 Configuration
 */
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

// Token storage path
const TOKEN_DIR = path.join(process.cwd(), 'data');
const TOKEN_PATH = path.join(TOKEN_DIR, 'google-oauth-token.json');

// Scopes needed for Google Sheets
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file', // To create new spreadsheets
];

/**
 * Google OAuth2 Service for Sheets
 */
export class GoogleOAuthService {
  private oauth2Client: OAuth2Client | null = null;
  private config: OAuthConfig | null = null;

  constructor() {
    this.loadConfig();
  }

  /**
   * Load OAuth2 configuration from environment variables
   */
  private loadConfig(): void {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3001/api/sheets/oauth/callback';

    if (clientId && clientSecret) {
      this.config = {
        clientId,
        clientSecret,
        redirectUri,
      };

      this.oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
      );

      // Load existing tokens if available
      this.loadSavedTokens();
    }
  }

  /**
   * Check if OAuth2 is configured
   */
  isConfigured(): boolean {
    return this.config !== null;
  }

  /**
   * Check if user is authenticated (has valid tokens)
   */
  isAuthenticated(): boolean {
    if (!this.oauth2Client) return false;
    const credentials = this.oauth2Client.credentials;
    // Consider authenticated if we have a refresh token (can auto-refresh)
    return !!(credentials && credentials.refresh_token);
  }

  /**
   * Get the OAuth2 client (for use by Sheets service)
   */
  getOAuth2Client(): OAuth2Client | null {
    return this.oauth2Client;
  }

  /**
   * Generate authorization URL
   */
  getAuthUrl(): string {
    if (!this.oauth2Client) {
      throw new Error('OAuth2 not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET');
    }

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent', // Force consent screen to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<OAuthTokens> {
    if (!this.oauth2Client) {
      throw new Error('OAuth2 not configured');
    }

    const { tokens } = await this.oauth2Client.getToken(code);
    
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Failed to get required tokens');
    }

    // Set credentials
    this.oauth2Client.setCredentials(tokens);

    // Save tokens to file
    this.saveTokens(tokens as OAuthTokens);

    return tokens as OAuthTokens;
  }

  /**
   * Load saved tokens from file
   */
  private loadSavedTokens(): void {
    try {
      if (fs.existsSync(TOKEN_PATH)) {
        const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
        if (this.oauth2Client && tokens.refresh_token) {
          this.oauth2Client.setCredentials(tokens);
          console.log('[OAuth] Loaded saved tokens');
        }
      }
    } catch (error) {
      console.log('[OAuth] No saved tokens found or error loading:', error);
    }
  }

  /**
   * Save tokens to file
   */
  private saveTokens(tokens: OAuthTokens): void {
    try {
      // Ensure directory exists
      if (!fs.existsSync(TOKEN_DIR)) {
        fs.mkdirSync(TOKEN_DIR, { recursive: true });
      }

      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      console.log('[OAuth] Tokens saved to', TOKEN_PATH);
    } catch (error) {
      console.error('[OAuth] Failed to save tokens:', error);
    }
  }

  /**
   * Refresh access token if expired
   */
  async refreshAccessToken(): Promise<boolean> {
    if (!this.oauth2Client) {
      return false;
    }

    try {
      const credentials = this.oauth2Client.credentials;
      
      if (!credentials.refresh_token) {
        return false;
      }

      // Check if token is expired or will expire in next 5 minutes
      const expiryDate = credentials.expiry_date || 0;
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      if (expiryDate > now + fiveMinutes) {
        // Token is still valid
        return true;
      }

      // Refresh the token
      const { credentials: newCredentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(newCredentials);
      
      // Save new tokens
      if (newCredentials.access_token) {
        this.saveTokens({
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

  /**
   * Revoke authentication (clear tokens)
   */
  async revokeAuth(): Promise<boolean> {
    try {
      if (this.oauth2Client && this.oauth2Client.credentials.access_token) {
        await this.oauth2Client.revokeToken(this.oauth2Client.credentials.access_token);
      }
      
      // Clear credentials
      if (this.oauth2Client) {
        this.oauth2Client.setCredentials({});
      }

      // Delete token file
      if (fs.existsSync(TOKEN_PATH)) {
        fs.unlinkSync(TOKEN_PATH);
      }

      console.log('[OAuth] Authentication revoked');
      return true;
    } catch (error) {
      console.error('[OAuth] Failed to revoke auth:', error);
      return false;
    }
  }

  /**
   * Get current token info
   */
  getTokenInfo(): { hasToken: boolean; expiresAt?: number; isExpired: boolean } {
    if (!this.oauth2Client || !this.oauth2Client.credentials.access_token) {
      return { hasToken: false, isExpired: true };
    }

    const expiryDate = this.oauth2Client.credentials.expiry_date || 0;
    const isExpired = Date.now() >= expiryDate;

    return {
      hasToken: true,
      expiresAt: expiryDate,
      isExpired,
    };
  }

  /**
   * Get configuration info (without secrets)
   */
  getConfigInfo(): { configured: boolean; redirectUri?: string } {
    if (!this.config) {
      return { configured: false };
    }

    return {
      configured: true,
      redirectUri: this.config.redirectUri,
    };
  }
}

// Export singleton instance
export const oauthService = new GoogleOAuthService();
