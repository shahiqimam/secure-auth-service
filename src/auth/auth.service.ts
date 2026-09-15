import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Request, Response } from 'express';
import * as argon2 from 'argon2';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditEventType } from '../audit/security-audit-event.entity';
import { normalizeEmail } from '../common/email';
import { randomToken, sha256 } from '../common/token.util';
import { User, UserStatus } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordResetToken } from './password-reset-token.entity';
import { SessionService } from './session.service';

const genericBadCredentials = 'Invalid email or password';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokens: Repository<PasswordResetToken>,
  ) {}

  async register(dto: RegisterDto) {
    const email = normalizeEmail(dto.email);
    if (await this.users.findByEmail(email)) throw new ConflictException('Email is already registered');
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.users.createUser({ name: dto.name, email, passwordHash });
    await this.audit.record({ userId: user.id, eventType: AuditEventType.Registered });
    return this.users.toSafeUser(user);
  }

  async login(dto: LoginDto, request: Request, response: Response) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) {
      await this.audit.record({ eventType: AuditEventType.LoginFailure, ipAddress: request.ip });
      throw new UnauthorizedException(genericBadCredentials);
    }

    this.assertCanLogin(user);
    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) {
      await this.recordFailedLogin(user, request);
      throw new UnauthorizedException(genericBadCredentials);
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    await this.users.save(user);

    if (user.mfaEnabled) {
      return {
        mfaRequired: true,
        challengeToken: this.jwt.sign(
          { sub: user.id, purpose: 'mfa' },
          {
            secret: this.config.getOrThrow<string>('JWT_SECRET'),
            expiresIn: this.config.getOrThrow<string>('MFA_CHALLENGE_EXPIRES_IN'),
          },
        ),
      };
    }

    return this.issueSession(user, request, response);
  }

  async refresh(refreshToken: string | undefined, response: Response) {
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');
    const { record, refreshToken: nextRefreshToken } = await this.sessions.rotate(refreshToken);
    const user = await this.users.findById(record.userId);
    if (!user || user.status !== UserStatus.Active) throw new UnauthorizedException('Invalid refresh session');
    this.setRefreshCookie(response, nextRefreshToken);
    await this.audit.record({
      userId: user.id,
      eventType: AuditEventType.SessionRefreshed,
      metadata: { sessionId: record.sessionId },
    });
    return { accessToken: this.signAccessToken(user, record.sessionId) };
  }

  async logout(refreshToken: string | undefined, response: Response) {
    if (refreshToken) {
      try {
        const { record } = await this.sessions.rotate(refreshToken);
        await this.sessions.revoke(record.sessionId);
        await this.audit.record({ userId: record.userId, eventType: AuditEventType.Logout });
      } catch {
        // Logout stays idempotent and defensive.
      }
    }
    this.clearRefreshCookie(response);
    return { message: 'Logged out' };
  }

  async logoutAll(userId: string, response: Response) {
    await this.sessions.revokeAllForUser(userId);
    this.clearRefreshCookie(response);
    await this.audit.record({ userId, eventType: AuditEventType.LogoutAll });
    return { message: 'All sessions revoked' };
  }

  async sessionsFor(userId: string) {
    return this.sessions.listForUser(userId);
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.sessions.get(sessionId);
    if (!session || session.userId !== userId) throw new ForbiddenException('Cannot revoke this session');
    await this.sessions.revoke(sessionId);
    await this.audit.record({ userId, eventType: AuditEventType.SessionRevoked, metadata: { sessionId } });
    return { message: 'Session revoked' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    const ok = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');
    user.passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    user.passwordChangedAt = new Date();
    await this.users.save(user);
    await this.sessions.revokeAllForUser(user.id);
    await this.audit.record({ userId: user.id, eventType: AuditEventType.PasswordChanged });
    return { message: 'Password changed. Please sign in again.' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.users.findByEmail(dto.email);
    if (user) {
      const token = randomToken(48);
      const expiresAt = new Date(
        Date.now() + this.config.getOrThrow<number>('PASSWORD_RESET_MINUTES') * 60_000,
      );
      await this.resetTokens.save(
        this.resetTokens.create({ userId: user.id, tokenHash: sha256(token), expiresAt }),
      );
      await this.audit.record({ userId: user.id, eventType: AuditEventType.PasswordResetRequested });
      if (this.config.get<string>('NODE_ENV') !== 'production') {
        return {
          message: 'If an account exists, reset instructions have been generated.',
          developmentResetToken: token,
        };
      }
    }
    return { message: 'If an account exists, reset instructions have been generated.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = sha256(dto.token);
    const reset = await this.resetTokens.findOne({ where: { tokenHash } });
    if (!reset || reset.usedAt || reset.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
    const user = await this.users.findById(reset.userId);
    if (!user) throw new UnauthorizedException('Invalid or expired reset token');
    user.passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    user.passwordChangedAt = new Date();
    reset.usedAt = new Date();
    await this.users.save(user);
    await this.resetTokens.save(reset);
    await this.sessions.revokeAllForUser(user.id);
    await this.audit.record({ userId: user.id, eventType: AuditEventType.PasswordResetCompleted });
    return { message: 'Password reset completed' };
  }

  async issueSession(user: User, request: Request, response: Response) {
    const { record, refreshToken } = await this.sessions.createSession({
      userId: user.id,
      userAgent: request.header('user-agent'),
      ipAddress: request.ip,
    });
    this.setRefreshCookie(response, refreshToken);
    await this.audit.record({
      userId: user.id,
      eventType: AuditEventType.LoginSuccess,
      ipAddress: request.ip,
      userAgent: request.header('user-agent'),
    });
    await this.audit.record({
      userId: user.id,
      eventType: AuditEventType.SessionCreated,
      metadata: { sessionId: record.sessionId },
    });
    return { accessToken: this.signAccessToken(user, record.sessionId), user: this.users.toSafeUser(user) };
  }

  private signAccessToken(user: User, sessionId?: string) {
    return this.jwt.sign(
      { sub: user.id, email: user.email, roles: user.roles, type: 'access', sessionId },
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN'),
      },
    );
  }

  private assertCanLogin(user: User) {
    if (user.status === UserStatus.Disabled) throw new UnauthorizedException(genericBadCredentials);
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException(genericBadCredentials);
    }
  }

  private async recordFailedLogin(user: User, request: Request) {
    const maxAttempts = this.config.getOrThrow<number>('MAX_FAILED_LOGIN_ATTEMPTS');
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= maxAttempts) {
      user.lockedUntil = new Date(
        Date.now() + this.config.getOrThrow<number>('ACCOUNT_LOCK_MINUTES') * 60_000,
      );
      await this.audit.record({ userId: user.id, eventType: AuditEventType.AccountLocked });
    }
    await this.users.save(user);
    await this.audit.record({
      userId: user.id,
      eventType: AuditEventType.LoginFailure,
      ipAddress: request.ip,
      userAgent: request.header('user-agent'),
    });
  }

  private setRefreshCookie(response: Response, token: string) {
    response.cookie('refresh_token', token, {
      httpOnly: true,
      secure: this.config.getOrThrow<boolean>('COOKIE_SECURE'),
      sameSite: this.config.get<'lax' | 'strict' | 'none'>('COOKIE_SAME_SITE', 'lax'),
      path: '/api/v1/auth',
      maxAge: this.config.getOrThrow<number>('REFRESH_SESSION_DAYS') * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshCookie(response: Response) {
    response.clearCookie('refresh_token', { path: '/api/v1/auth' });
  }
}
