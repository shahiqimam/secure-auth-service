import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AccessJwtPayload } from './jwt-payload';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const auth = request.header('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) throw new UnauthorizedException('Missing access token');
    const payload = this.jwt.verify<AccessJwtPayload>(token, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
    });
    if (payload.type !== 'access') throw new UnauthorizedException('Invalid token type');
    request.user = payload;
    return true;
  }
}
