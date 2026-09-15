import * as cookieParser from 'cookie-parser';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { REDIS } from '../src/redis/redis.module';

describe('AuthForge auth flow (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.get<any>(REDIS).quit();
    await app.close();
  });

  it('registers, logs in, refreshes, and rejects old refresh replay', async () => {
    const agent = request.agent(app.getHttpServer());
    const email = `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
    const password = 'ExamplePassword123!';

    await agent
      .post('/api/v1/auth/register')
      .send({ name: 'E2E User', email, password })
      .expect(201);

    const login = await agent.post('/api/v1/auth/login').send({ email, password }).expect(201);
    expect(login.body.accessToken).toEqual(expect.any(String));
    const oldRefreshCookie = login.headers['set-cookie'][0];

    const profile = await agent
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(profile.body.email).toBe(email);

    const refresh = await agent.post('/api/v1/auth/refresh').expect(201);
    expect(refresh.body.accessToken).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', oldRefreshCookie)
      .expect(401);
  });
});
