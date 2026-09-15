import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenGuard } from '../src/auth/guards/access-token.guard';
import { Role } from '../src/common/roles';

function contextFor(auth?: string): ExecutionContext {
  const request = {
    header: (name: string) => (name.toLowerCase() === 'authorization' ? auth : undefined),
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('AccessTokenGuard', () => {
  const secret = 'test_secret_value_that_is_long_enough';
  const jwt = new JwtService();
  const guard = new AccessTokenGuard(
    jwt,
    { getOrThrow: () => secret } as unknown as ConfigService,
  );

  it('accepts access tokens and attaches the payload', () => {
    const token = jwt.sign(
      { sub: 'user-1', email: 'demo@example.test', roles: [Role.User], type: 'access' },
      { secret },
    );
    const context = contextFor(`Bearer ${token}`);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects MFA challenge tokens as access tokens', () => {
    const token = jwt.sign({ sub: 'user-1', purpose: 'mfa' }, { secret });

    expect(() => guard.canActivate(contextFor(`Bearer ${token}`))).toThrow(UnauthorizedException);
  });

  it('rejects missing bearer tokens', () => {
    expect(() => guard.canActivate(contextFor())).toThrow(UnauthorizedException);
  });
});
