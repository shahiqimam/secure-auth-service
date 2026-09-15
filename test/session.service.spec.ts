import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionService } from '../src/auth/session.service';

class RedisMemory {
  values = new Map<string, string>();
  sets = new Map<string, Set<string>>();

  async set(key: string, value: string) {
    this.values.set(key, value);
    return 'OK';
  }

  async get(key: string) {
    return this.values.get(key) ?? null;
  }

  async del(...keys: string[]) {
    let count = 0;
    for (const key of keys) {
      if (this.values.delete(key)) count += 1;
      if (this.sets.delete(key)) count += 1;
    }
    return count;
  }

  async sadd(key: string, value: string) {
    if (!this.sets.has(key)) this.sets.set(key, new Set());
    this.sets.get(key)!.add(value);
    return 1;
  }

  async srem(key: string, value: string) {
    return this.sets.get(key)?.delete(value) ? 1 : 0;
  }

  async smembers(key: string) {
    return [...(this.sets.get(key) ?? new Set<string>())];
  }

  async expire() {
    return 1;
  }

  async keys(pattern: string) {
    const prefix = pattern.replace('*', '');
    return [...this.values.keys()].filter((key) => key.startsWith(prefix));
  }

  async mget(keys: string[]) {
    return keys.map((key) => this.values.get(key) ?? null);
  }
}

describe('SessionService', () => {
  let redis: RedisMemory;
  let service: SessionService;

  beforeEach(() => {
    redis = new RedisMemory();
    service = new SessionService(
      redis as never,
      { getOrThrow: () => 7 } as unknown as ConfigService,
    );
  });

  it('creates sessions without exposing refresh token hashes in listings', async () => {
    const { record } = await service.createSession({
      userId: 'user-1',
      userAgent: 'jest',
      ipAddress: '127.0.0.1',
    });

    const sessions = await service.listForUser('user-1');

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      sessionId: record.sessionId,
      userId: 'user-1',
      userAgent: 'jest',
    });
    expect(sessions[0]).not.toHaveProperty('refreshTokenHash');
  });

  it('rotates refresh tokens and rejects the old token as replay', async () => {
    const created = await service.createSession({ userId: 'user-1' });

    const rotated = await service.rotate(created.refreshToken);
    expect(rotated.refreshToken).not.toEqual(created.refreshToken);

    await expect(service.rotate(created.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.get(created.record.sessionId)).resolves.toBeNull();
  });

  it('revokes all sessions for a user', async () => {
    const first = await service.createSession({ userId: 'user-1' });
    const second = await service.createSession({ userId: 'user-1' });

    await service.revokeAllForUser('user-1');

    await expect(service.get(first.record.sessionId)).resolves.toBeNull();
    await expect(service.get(second.record.sessionId)).resolves.toBeNull();
    await expect(service.listForUser('user-1')).resolves.toEqual([]);
  });
});
