import { describe, it, expect, beforeEach } from 'vitest';
import { AhrefsProxyService } from '../ahrefs-proxy-service.js';

describe('AhrefsProxyService', () => {
  let service: AhrefsProxyService;

  beforeEach(() => {
    service = new AhrefsProxyService();
  });

  describe('isConfigured', () => {
    it('returns false when no proxy session is set', () => {
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('setProxySession', () => {
    it('sets the proxy session and marks service as configured', () => {
      service.setProxySession('new-session');
      expect(service.isConfigured()).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('returns status object with configured flag false initially', () => {
      const status = service.getStatus();
      expect(status.configured).toBe(false);
      expect(status).toHaveProperty('proxySessionValid');
    });

    it('shows configured true after setting session', () => {
      service.setProxySession('test');
      const status = service.getStatus();
      expect(status.configured).toBe(true);
    });
  });
});
