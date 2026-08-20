import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('API Versioning Strategy (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / -> Returns API info with supported versions and sunset dates', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);
    expect(res.body).toHaveProperty('currentVersion', 'v2');
    expect(res.body.supportedVersions).toContain('v1');
    expect(res.body.supportedVersions).toContain('v2');
  });

  it('GET /v1/puzzles -> Serves V1 schema with Deprecation header & payload warning', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/puzzles')
      .expect(200);

    expect(res.headers['deprecation']).toBe('true');
    expect(res.headers).toHaveProperty('sunset');
    expect(res.body.deprecation.isDeprecated).toBe(true);
    expect(res.body.data[0]).toHaveProperty('difficulty');
  });

  it('GET /v2/puzzles -> Serves V2 schema without deprecation warnings', async () => {
    const res = await request(app.getHttpServer())
      .get('/v2/puzzles')
      .expect(200);

    expect(res.headers['deprecation']).toBeUndefined();
    expect(res.body).not.toHaveProperty('deprecation');
    expect(res.body.data[0]).toHaveProperty('difficultyRating');
    expect(res.body.data[0]).toHaveProperty('onChainHash');
  });
});