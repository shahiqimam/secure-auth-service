import { validateConfig } from '../src/config/validate-config';

describe('validateConfig', () => {
  it('rejects missing or weak JWT secrets', () => {
    expect(() => validateConfig({})).toThrow('JWT_SECRET');
    expect(() => validateConfig({ JWT_SECRET: 'short' })).toThrow('JWT_SECRET');
  });

  it('loads safe defaults for local development', () => {
    const config = validateConfig({
      JWT_SECRET: 'local_test_secret_value_that_is_long_enough',
    });

    expect(config.PORT).toBe(3000);
    expect(config.JWT_ACCESS_EXPIRES_IN).toBe('15m');
    expect(config.REFRESH_SESSION_DAYS).toBe(7);
    expect(config.COOKIE_SECURE).toBe(false);
  });
});
