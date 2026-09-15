import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordResetToken } from './password-reset-token.entity';
import { AccessTokenGuard } from './guards/access-token.guard';
import { MfaChallengeGuard } from './guards/mfa-challenge.guard';
import { RolesGuard } from './guards/roles.guard';
import { SessionService } from './session.service';

@Module({
  imports: [JwtModule.register({}), TypeOrmModule.forFeature([PasswordResetToken]), UsersModule, AuditModule],
  controllers: [AuthController],
  providers: [AuthService, SessionService, AccessTokenGuard, MfaChallengeGuard, RolesGuard],
  exports: [AuthService, SessionService, AccessTokenGuard, MfaChallengeGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
