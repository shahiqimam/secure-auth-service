import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';
import { randomToken, safeEqual, sha256 } from '../common/token.util';

export type SessionRecord = {
  sessionId: string;
  userId: string;
  familyId: string;
  refreshTokenHash: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  userAgent: string | null;
  ipAddress: string | null;
};

@Injectable()
export class SessionService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  async createSession(input: { userId: string; userAgent?: string; ipAddress?: string }) {
    const sessionId = randomToken(24);
    const familyId = randomToken(24);
    const refreshToken = randomToken(48);
    const ttlSeconds = this.refreshTtlSeconds();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const record: SessionRecord = {
      sessionId,
      userId: input.userId,
      familyId,
      refreshTokenHash: sha256(refreshToken),
      createdAt: now.toISOString(),
      lastUsedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
    };
    await this.save(record, ttlSeconds);
    await this.redis.set(this.lookupKey(record.refreshTokenHash), sessionId, 'EX', ttlSeconds);
    await this.redis.sadd(this.userSessionsKey(input.userId), sessionId);
    await this.redis.expire(this.userSessionsKey(input.userId), ttlSeconds);
    return { record, refreshToken };
  }

  async rotate(refreshToken: string) {
    const presentedHash = sha256(refreshToken);
    const sessionId = await this.redis.get(this.lookupKey(presentedHash));
    if (!sessionId) {
      const consumedFamilyId = await this.redis.get(this.consumedLookupKey(presentedHash));
      if (consumedFamilyId) {
        await this.revokeFamily(consumedFamilyId);
        throw new UnauthorizedException('Refresh token reuse detected');
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    const record = await this.get(sessionId);
    if (!record) throw new UnauthorizedException('Invalid refresh token');
    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      await this.revoke(sessionId);
      throw new UnauthorizedException('Refresh session expired');
    }
    if (!safeEqual(record.refreshTokenHash, presentedHash)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const ttlSeconds = Math.max(1, Math.floor((new Date(record.expiresAt).getTime() - Date.now()) / 1000));
    const nextRefreshToken = randomToken(48);
    const nextHash = sha256(nextRefreshToken);
    await this.redis.set(this.consumedKey(record.familyId, presentedHash), sessionId, 'EX', ttlSeconds);
    await this.redis.set(this.consumedLookupKey(presentedHash), record.familyId, 'EX', ttlSeconds);
    await this.redis.del(this.lookupKey(presentedHash));
    record.refreshTokenHash = nextHash;
    record.lastUsedAt = new Date().toISOString();
    await this.save(record, ttlSeconds);
    await this.redis.set(this.lookupKey(nextHash), sessionId, 'EX', ttlSeconds);
    return { record, refreshToken: nextRefreshToken };
  }

  async listForUser(userId: string) {
    const ids = await this.redis.smembers(this.userSessionsKey(userId));
    const records = await Promise.all(ids.map((id) => this.get(id)));
    return records
      .filter((record): record is SessionRecord => Boolean(record))
      .map((record) => ({
        sessionId: record.sessionId,
        userId: record.userId,
        familyId: record.familyId,
        createdAt: record.createdAt,
        lastUsedAt: record.lastUsedAt,
        expiresAt: record.expiresAt,
        userAgent: record.userAgent,
        ipAddress: record.ipAddress,
      }));
  }

  async revoke(sessionId: string) {
    const record = await this.get(sessionId);
    if (!record) return;
    await this.redis.del(this.sessionKey(sessionId), this.lookupKey(record.refreshTokenHash));
    await this.redis.srem(this.userSessionsKey(record.userId), sessionId);
  }

  async revokeAllForUser(userId: string) {
    const ids = await this.redis.smembers(this.userSessionsKey(userId));
    await Promise.all(ids.map((id) => this.revoke(id)));
    await this.redis.del(this.userSessionsKey(userId));
  }

  async get(sessionId: string) {
    const value = await this.redis.get(this.sessionKey(sessionId));
    return value ? (JSON.parse(value) as SessionRecord) : null;
  }

  private async save(record: SessionRecord, ttlSeconds: number) {
    await this.redis.set(this.sessionKey(record.sessionId), JSON.stringify(record), 'EX', ttlSeconds);
  }

  private async revokeFamily(familyId: string) {
    const keys = await this.redis.keys(`auth:consumed:${familyId}:*`);
    const ids = keys.length ? await this.redis.mget(keys) : [];
    await Promise.all([...new Set(ids.filter(Boolean) as string[])].map((id) => this.revoke(id)));
  }

  private refreshTtlSeconds() {
    return this.config.getOrThrow<number>('REFRESH_SESSION_DAYS') * 24 * 60 * 60;
  }

  private sessionKey(sessionId: string) {
    return `auth:session:${sessionId}`;
  }

  private lookupKey(hash: string) {
    return `auth:refresh-lookup:${hash}`;
  }

  private consumedLookupKey(hash: string) {
    return `auth:consumed-lookup:${hash}`;
  }

  private consumedKey(familyId: string, hash: string) {
    return `auth:consumed:${familyId}:${hash}`;
  }

  private userSessionsKey(userId: string) {
    return `auth:user-sessions:${userId}`;
  }
}
