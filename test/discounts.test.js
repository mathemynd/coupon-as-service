'use strict';

const request = require('supertest');
const mongoose = require('mongoose');

describe('Discounts API', () => {
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
    // Clean up before each test
    const Coupon = mongoose.model('Coupon');
    const Discount = mongoose.model('Discount');
    await Coupon.deleteMany({});
    await Discount.deleteMany({});
  });

  async function createTestCoupons() {
    const Coupon = mongoose.model('Coupon');
    await Coupon.create([
      { code: 'DISCOUNT10', percent_off: 10 },
      { code: 'DISCOUNT20', percent_off: 20 },
    ]);
  }

  describe('GET /api/discounts', () => {
    test('should return empty array when no discounts', async () => {
      const res = await request(app)
        .get(`/api/discounts?password=${password}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(0);
    });

    test('should return list of discounts', async () => {
      await createTestCoupons();
      const Discount = mongoose.model('Discount');
      const Coupon = mongoose.model('Coupon');
      const coupon = await Coupon.findOne({ code: 'DISCOUNT10' });

      await Discount.create([
        { user: 'user1', code: 'DISCOUNT10', coupon: coupon._id },
        { user: 'user2', code: 'DISCOUNT20', coupon: coupon._id },
      ]);

      const res = await request(app)
        .get(`/api/discounts?password=${password}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(2);
      expect(res.body[0]).toHaveProperty('user');
      expect(res.body[0]).toHaveProperty('code');
    });

    test('should filter by from date', async () => {
      await createTestCoupons();
      const Discount = mongoose.model('Discount');
      const Coupon = mongoose.model('Coupon');
      const coupon = await Coupon.findOne({ code: 'DISCOUNT10' });

      // Create old discount
      await Discount.create({
        user: 'olduser',
        code: 'DISCOUNT10',
        coupon: coupon._id,
        start: new Date('2020-01-01'),
      });

      // Create recent discount
      await Discount.create({
        user: 'newuser',
        code: 'DISCOUNT10',
        coupon: coupon._id,
        start: new Date(),
      });

      const res = await request(app)
        .get(`/api/discounts?password=${password}&from=2024-01-01`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(1);
      expect(res.body[0].user).toBe('newuser');
    });

    test('should return 401 without password', async () => {
      await request(app)
        .get('/api/discounts')
        .expect(401);
    });
  });

  describe('POST /api/discounts', () => {
    test('should create a new discount', async () => {
      await createTestCoupons();
      const res = await request(app)
        .post(`/api/discounts?password=${password}`)
        .send({ code: 'DISCOUNT10', user: 'user123' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('code', 'DISCOUNT10');
      expect(res.body).toHaveProperty('user', 'user123');
      expect(res.body).toHaveProperty('coupon');
    });

    test('should upsert discount (update if exists)', async () => {
      await createTestCoupons();
      // Create first discount
      await request(app)
        .post(`/api/discounts?password=${password}`)
        .send({ code: 'DISCOUNT10', user: 'user123' })
        .expect(200);

      // Create same discount again (should update, not duplicate)
      await request(app)
        .post(`/api/discounts?password=${password}`)
        .send({ code: 'DISCOUNT10', user: 'user123' })
        .expect(200);

      // Verify only one discount exists
      const res = await request(app)
        .get(`/api/discounts?password=${password}`)
        .expect(200);

      expect(res.body.length).toBe(1);
    });

    test('should return 404 for non-existent coupon', async () => {
      await createTestCoupons();
      const res = await request(app)
        .post(`/api/discounts?password=${password}`)
        .send({ code: 'NONEXISTENT', user: 'user123' })
        .expect(404);

      expect(res.body).toContain('not found');
    });

    test('should handle case insensitive coupon code', async () => {
      await createTestCoupons();
      const res = await request(app)
        .post(`/api/discounts?password=${password}`)
        .send({ code: 'discount10', user: 'user123' })
        .expect(200);

      expect(res.body).toHaveProperty('code', 'discount10');
    });

    test('should return 401 without password', async () => {
      await request(app)
        .post('/api/discounts')
        .send({ code: 'DISCOUNT10', user: 'user123' })
        .expect(401);
    });
  });

  describe('GET /api/discounts/:id', () => {
    let discountId;

    beforeEach(async () => {
      await createTestCoupons();
      const Discount = mongoose.model('Discount');
      const Coupon = mongoose.model('Coupon');
      const coupon = await Coupon.findOne({ code: 'DISCOUNT10' });

      const discount = await Discount.create({
        user: 'testuser',
        code: 'DISCOUNT10',
        coupon: coupon._id,
      });
      discountId = discount._id.toString();
    });

    test('should get discount by ID', async () => {
      const res = await request(app)
        .get(`/api/discounts/${discountId}?password=${password}`)
        .expect(200);

      expect(res.body).toHaveProperty('user', 'testuser');
      expect(res.body).toHaveProperty('code', 'DISCOUNT10');
      expect(res.body).toHaveProperty('_id', discountId);
    });

    test('should return 401 without password', async () => {
      await request(app)
        .get(`/api/discounts/${discountId}`)
        .expect(401);
    });
  });

  describe('PUT /api/discounts/:id', () => {
    let discountId;

    beforeEach(async () => {
      await createTestCoupons();
      const Discount = mongoose.model('Discount');
      const Coupon = mongoose.model('Coupon');
      const coupon = await Coupon.findOne({ code: 'DISCOUNT10' });

      const discount = await Discount.create({
        user: 'originaluser',
        code: 'DISCOUNT10',
        coupon: coupon._id,
      });
      discountId = discount._id.toString();
    });

    test('should update discount', async () => {
      const res = await request(app)
        .put(`/api/discounts/${discountId}?password=${password}`)
        .send({ user: 'updateduser' })
        .expect(200);

      expect(res.body).toBe(`Updated discount ${discountId}`);

      // Verify update
      const getRes = await request(app)
        .get(`/api/discounts/${discountId}?password=${password}`)
        .expect(200);

      expect(getRes.body).toHaveProperty('user', 'updateduser');
    });

    test('should return 401 without password', async () => {
      await request(app)
        .put(`/api/discounts/${discountId}`)
        .send({ user: 'hacker' })
        .expect(401);
    });
  });

  describe('DELETE /api/discounts/:id', () => {
    let discountId;

    beforeEach(async () => {
      await createTestCoupons();
      const Discount = mongoose.model('Discount');
      const Coupon = mongoose.model('Coupon');
      const coupon = await Coupon.findOne({ code: 'DISCOUNT10' });

      const discount = await Discount.create({
        user: 'deleteuser',
        code: 'DISCOUNT10',
        coupon: coupon._id,
      });
      discountId = discount._id.toString();
    });

    test('should delete discount by ID', async () => {
      const res = await request(app)
        .delete(`/api/discounts/${discountId}?password=${password}`)
        .expect(200);

      expect(res.body).toBe('Deleted 1 discounts');

      // Verify deletion
      const getRes = await request(app)
        .get(`/api/discounts?password=${password}`)
        .expect(200);

      expect(getRes.body.length).toBe(0);
    });

    test('should delete all discounts with ALL', async () => {
      const Discount = mongoose.model('Discount');
      const Coupon = mongoose.model('Coupon');
      const coupon = await Coupon.findOne({ code: 'DISCOUNT10' });

      // Create multiple discounts
      await Discount.create([
        { user: 'user1', code: 'DISCOUNT10', coupon: coupon._id },
        { user: 'user2', code: 'DISCOUNT20', coupon: coupon._id },
      ]);

      const res = await request(app)
        .delete(`/api/discounts/ALL?password=${password}`)
        .expect(200);

      expect(res.body).toContain('Deleted');

      // Verify all deleted
      const getRes = await request(app)
        .get(`/api/discounts?password=${password}`)
        .expect(200);

      expect(getRes.body.length).toBe(0);
    });

    test('should return 401 without password', async () => {
      await request(app)
        .delete(`/api/discounts/${discountId}`)
        .expect(401);
    });
  });
});
