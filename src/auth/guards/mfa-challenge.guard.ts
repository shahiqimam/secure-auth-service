import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { MfaJwtPayload } from './jwt-payload';

@Injectable()
export class MfaChallengeGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { mfaUser?: MfaJwtPayload }>();
    const token = request.body?.challengeToken;
    if (!token) throw new UnauthorizedException('Missing MFA challenge token');
    const payload = this.jwt.verify<MfaJwtPayload>(token, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
    });
    if (payload.purpose !== 'mfa') throw new UnauthorizedException('Invalid challenge token');
    request.mfaUser = payload;
    return true;
  }
}
