import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { AdminModule } from './admin/admin.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MfaModule } from './mfa/mfa.module';
import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';
import { validateConfig } from './config/validate-config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateConfig }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    DatabaseModule,
    RedisModule,
    AuditModule,
    UsersModule,
    AuthModule,
    MfaModule,
    AdminModule,
    HealthModule,
  ],
})
export class AppModule {}
