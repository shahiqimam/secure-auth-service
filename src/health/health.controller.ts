import { Controller, Get, Inject } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { REDIS } from '../redis/redis.module';

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    await this.dataSource.query('select 1');
    await this.redis.ping();
    return { status: 'ready' };
  }
}
