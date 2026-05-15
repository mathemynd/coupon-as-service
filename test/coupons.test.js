'use strict';

const request = require('supertest');
const mongoose = require('mongoose');

describe('Coupons API', () => {
  let app;
  const password = process.env.API_PASSWORD || 'testpass';

  beforeAll(() => {
    process.env.API_PASSWORD = password;
    process.env.NODE_ENV = 'test';
    app = require('../app/app');
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    app.closeDatabase();
  });

  beforeEach(async () => {
    // Clean up coupons before each test
    const Coupon = mongoose.model('Coupon');
    await Coupon.deleteMany({});
  });

  describe('GET /api/coupons', () => {
    test('should return empty array when no coupons', async () => {
      const res = await request(app)
        .get(`/api/coupons?password=${password}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(0);
    });

    test('should return list of coupons', async () => {
      const Coupon = mongoose.model('Coupon');
      await Coupon.create([
        { code: 'TEST1', percent_off: 10 },
        { code: 'TEST2', percent_off: 20 },
      ]);

      const res = await request(app)
        .get(`/api/coupons?password=${password}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(2);
      expect(res.body[0]).toHaveProperty('code');
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).not.toHaveProperty('_id');
      expect(res.body[0]).not.toHaveProperty('__v');
    });

    test('should return 401 without password', async () => {
      await request(app)
        .get('/api/coupons')
        .expect(401);
    });

    test('should return 401 with wrong password', async () => {
      await request(app)
        .get('/api/coupons?password=wrongpass')
        .expect(401);
    });
  });

  describe('POST /api/coupons', () => {
    test('should create a new coupon with code', async () => {
      const res = await request(app)
        .post(`/api/coupons?password=${password}`)
        .send({ code: 'SAVE20', percent_off: 20, duration: 'once' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('code', 'SAVE20');
      expect(res.body).toHaveProperty('percent_off', 20);
      expect(res.body).toHaveProperty('id', 'SAVE20');
      expect(res.body).not.toHaveProperty('_id');
    });

    test('should auto-generate code if not provided', async () => {
      const res = await request(app)
        .post(`/api/coupons?password=${password}`)
        .send({ percent_off: 15 })
        .expect(200);

      expect(res.body).toHaveProperty('code');
      expect(res.body.code).toBeTruthy();
      expect(res.body.code.length).toBeGreaterThan(0);
    });

    test('should convert code to uppercase', async () => {
      const res = await request(app)
        .post(`/api/coupons?password=${password}`)
        .send({ code: 'lowercase', percent_off: 10 })
        .expect(200);

      expect(res.body.code).toBe('LOWERCASE');
    });

    test('should create email-based coupon', async () => {
      const res = await request(app)
        .post(`/api/coupons?password=${password}`)
        .send({ email: 'mit.edu', percent_off: 15 })
        .expect(200);

      expect(res.body).toHaveProperty('email', 'mit.edu');
      expect(res.body).toHaveProperty('percent_off', 15);
      expect(res.body).toHaveProperty('code');
    });

    test('should create coupon with amount_off', async () => {
      const res = await request(app)
        .post(`/api/coupons?password=${password}`)
        .send({ code: 'SAVE10USD', amount_off: 1000, currency: 'usd' })
        .expect(200);

      expect(res.body).toHaveProperty('amount_off', 1000);
      expect(res.body).toHaveProperty('currency', 'usd');
    });

    test('should create coupon with metadata', async () => {
      const res = await request(app)
        .post(`/api/coupons?password=${password}`)
        .send({
          code: 'META',
          percent_off: 10,
          metadata: { campaign: 'summer2024', source: 'email' }
        })
        .expect(200);

      expect(res.body).toHaveProperty('metadata');
      expect(res.body.metadata).toEqual({ campaign: 'summer2024', source: 'email' });
    });

    test('should create coupon with constraints', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const res = await request(app)
        .post(`/api/coupons?password=${password}`)
        .send({
          code: 'LIMITED',
          percent_off: 25,
          max_redemptions: 100,
          redeem_by: futureDate,
          duration: 'repeating',
          duration_in_months: 3
        })
        .expect(200);

      expect(res.body).toHaveProperty('max_redemptions', 100);
      expect(res.body).toHaveProperty('duration', 'repeating');
      expect(res.body).toHaveProperty('duration_in_months', 3);
    });

    test('should return 401 without password', async () => {
      await request(app)
        .post('/api/coupons')
        .send({ code: 'TEST', percent_off: 10 })
        .expect(401);
    });
  });

  describe('GET /api/coupons/:id', () => {
    beforeEach(async () => {
      const Coupon = mongoose.model('Coupon');
      await Coupon.create([
        { code: 'TESTCODE', percent_off: 30 },
        { email: 'stanford.edu', percent_off: 20 },
      ]);
    });

    test('should get coupon by code', async () => {
      const res = await request(app)
        .get(`/api/coupons/TESTCODE?password=${password}`)
        .expect(200);

      expect(res.body).toHaveProperty('code', 'TESTCODE');
      expect(res.body).toHaveProperty('percent_off', 30);
    });

    test('should get coupon by code (case insensitive)', async () => {
      const res = await request(app)
        .get(`/api/coupons/testcode?password=${password}`)
        .expect(200);

      expect(res.body).toHaveProperty('code', 'TESTCODE');
    });

    test('should get coupon by email', async () => {
      const res = await request(app)
        .get(`/api/coupons/@stanford.edu?password=${password}`)
        .expect(200);

      expect(res.body).toHaveProperty('email', 'stanford.edu');
      expect(res.body).toHaveProperty('percent_off', 20);
    });

    test('should return 404 for non-existent coupon', async () => {
      await request(app)
        .get(`/api/coupons/NONEXISTENT?password=${password}`)
        .expect(404);
    });

    test('should return 404 for non-existent email', async () => {
      await request(app)
        .get(`/api/coupons/@nonexistent.edu?password=${password}`)
        .expect(404);
    });

    test('should return 401 without password', async () => {
      await request(app)
        .get('/api/coupons/TESTCODE')
        .expect(401);
    });
  });

  describe('PUT /api/coupons/:id', () => {
    beforeEach(async () => {
      const Coupon = mongoose.model('Coupon');
      await Coupon.create({ code: 'UPDATEME', percent_off: 10 });
    });

    test('should update coupon', async () => {
      const res = await request(app)
        .put(`/api/coupons/UPDATEME?password=${password}`)
        .send({ percent_off: 25, max_redemptions: 50 })
        .expect(200);

      expect(res.body).toBe('Updated coupon UPDATEME');

      // Verify update
      const getRes = await request(app)
        .get(`/api/coupons/UPDATEME?password=${password}`)
        .expect(200);

      expect(getRes.body).toHaveProperty('percent_off', 25);
      expect(getRes.body).toHaveProperty('max_redemptions', 50);
    });

    test('should update with case insensitive code', async () => {
      await request(app)
        .put(`/api/coupons/updateme?password=${password}`)
        .send({ percent_off: 30 })
        .expect(200);

      const getRes = await request(app)
        .get(`/api/coupons/UPDATEME?password=${password}`)
        .expect(200);

      expect(getRes.body).toHaveProperty('percent_off', 30);
    });

    test('should return 401 without password', async () => {
      await request(app)
        .put('/api/coupons/UPDATEME')
        .send({ percent_off: 99 })
        .expect(401);
    });
  });

  describe('DELETE /api/coupons/:id', () => {
    beforeEach(async () => {
      const Coupon = mongoose.model('Coupon');
      await Coupon.create([
        { code: 'DELETE1', percent_off: 10 },
        { code: 'DELETE2', percent_off: 20 },
      ]);
    });

    test('should delete coupon by code', async () => {
      const res = await request(app)
        .delete(`/api/coupons/DELETE1?password=${password}`)
        .expect(200);

      expect(res.body).toBe('Deleted 1 coupons');

      // Verify deletion
      await request(app)
        .get(`/api/coupons/DELETE1?password=${password}`)
        .expect(404);
    });

    test('should delete all coupons with ALL', async () => {
      const res = await request(app)
        .delete(`/api/coupons/ALL?password=${password}`)
        .expect(200);

      expect(res.body).toContain('Deleted 2 coupons');

      // Verify all deleted
      const getRes = await request(app)
        .get(`/api/coupons?password=${password}`)
        .expect(200);

      expect(getRes.body.length).toBe(0);
    });

    test('should return 401 without password', async () => {
      await request(app)
        .delete('/api/coupons/DELETE1')
        .expect(401);
    });
  });
});
