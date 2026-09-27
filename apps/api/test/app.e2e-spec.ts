import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

// Membutuhkan PostgreSQL dari infra/ yang sudah dimigrasi (DATABASE_URL di .env).
describe('API (e2e)', () => {
  let app: INestApplication;
  const slug = `e2e-${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health', () =>
    request(app.getHttpServer())
      .get('/api/health')
      .expect(200, { status: 'ok' }));

  it('GET /docs-json exposes the CRUD routes', async () => {
    const res = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining([
        '/api/clubs',
        '/api/courts/{id}',
        '/api/cameras',
      ]),
    );
  });

  it('rejects invalid DTOs', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/api/clubs')
      .send({ name: 'X', slug: 'Bad Slug' })
      .expect(400);
    await request(server)
      .post('/api/clubs')
      .send({ name: 'X', slug: slug, extra: 1 })
      .expect(400);
    await request(server)
      .post('/api/cameras')
      .send({ courtId: 'x', name: 'Cam', streamPath: 'lapangan-1' })
      .expect(400);
  });

  it('club -> court -> camera CRUD round trip', async () => {
    const server = app.getHttpServer();

    const club = (
      await request(server)
        .post('/api/clubs')
        .send({ name: 'E2E Club', slug })
        .expect(201)
    ).body;
    expect(club.timezone).toBe('Asia/Jakarta');
    await request(server)
      .post('/api/clubs')
      .send({ name: 'Dup', slug })
      .expect(409);

    const court = (
      await request(server)
        .post('/api/courts')
        .send({ clubId: club.id, name: 'Lapangan E2E' })
        .expect(201)
    ).body;
    await request(server)
      .post('/api/courts')
      .send({ clubId: 'does-not-exist', name: 'X' })
      .expect(400);

    const camera = (
      await request(server)
        .post('/api/cameras')
        .send({
          courtId: court.id,
          name: 'Kamera E2E',
          streamPath: `court-${slug}`,
        })
        .expect(201)
    ).body;
    expect(camera.isActive).toBe(true);

    const list = await request(server)
      .get(`/api/cameras?courtId=${court.id}`)
      .expect(200);
    expect(list.body).toHaveLength(1);

    await request(server)
      .patch(`/api/cameras/${camera.id}`)
      .send({ isActive: false })
      .expect(200)
      .expect((res) => expect(res.body.isActive).toBe(false));

    // Parent with children cannot be deleted.
    await request(server).delete(`/api/courts/${court.id}`).expect(409);
    await request(server).delete(`/api/clubs/${club.id}`).expect(409);

    await request(server).delete(`/api/cameras/${camera.id}`).expect(204);
    await request(server).delete(`/api/courts/${court.id}`).expect(204);
    await request(server).delete(`/api/clubs/${club.id}`).expect(204);
    await request(server).get(`/api/clubs/${club.id}`).expect(404);
    await request(server)
      .patch(`/api/clubs/${club.id}`)
      .send({ name: 'Y' })
      .expect(404);
  });
});
