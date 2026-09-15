const insecureSecrets = new Set(['secret', 'changeme', 'replace_me', 'replace_with_long_random_secret']);

export function validateConfig(config: Record<string, string | undefined>) {
  const nodeEnv = config.NODE_ENV ?? 'development';
  const jwtSecret = config.JWT_SECRET;

  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters.');
  }

  if (nodeEnv === 'production' && insecureSecrets.has(jwtSecret)) {
    throw new Error('JWT_SECRET is insecure for production.');
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: Number(config.PORT ?? 3000),
    DATABASE_HOST: config.DATABASE_HOST ?? 'localhost',
    DATABASE_PORT: Number(config.DATABASE_PORT ?? 5432),
    DATABASE_NAME: config.DATABASE_NAME ?? 'authforge',
    DATABASE_USER: config.DATABASE_USER ?? 'authforge',
    DATABASE_PASSWORD: config.DATABASE_PASSWORD ?? 'change_me',
    REDIS_HOST: config.REDIS_HOST ?? 'localhost',
    REDIS_PORT: Number(config.REDIS_PORT ?? 6379),
    JWT_SECRET: jwtSecret,
    JWT_ACCESS_EXPIRES_IN: config.JWT_ACCESS_EXPIRES_IN ?? '15m',
    MFA_CHALLENGE_EXPIRES_IN: config.MFA_CHALLENGE_EXPIRES_IN ?? '5m',
    REFRESH_SESSION_DAYS: Number(config.REFRESH_SESSION_DAYS ?? 7),
    MFA_ENCRYPTION_KEY: config.MFA_ENCRYPTION_KEY,
    CORS_ORIGIN: config.CORS_ORIGIN ?? 'http://localhost:3001',
    COOKIE_SECURE: config.COOKIE_SECURE === 'true',
    COOKIE_SAME_SITE: config.COOKIE_SAME_SITE ?? 'lax',
    MAX_FAILED_LOGIN_ATTEMPTS: Number(config.MAX_FAILED_LOGIN_ATTEMPTS ?? 5),
    ACCOUNT_LOCK_MINUTES: Number(config.ACCOUNT_LOCK_MINUTES ?? 15),
    PASSWORD_RESET_MINUTES: Number(config.PASSWORD_RESET_MINUTES ?? 20),
  };
}
