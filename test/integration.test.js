'use strict';

const request = require('supertest');
const mongoose = require('mongoose');

describe('Integration Tests', () => {
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
    const Coupon = mongoose.model('Coupon');
    const Discount = mongoose.model('Discount');
    await Coupon.deleteMany({});
    await Discount.deleteMany({});
  });

  describe('Full coupon lifecycle', () => {
    test('should create, retrieve, update, and delete a coupon', async () => {
      // Create
      const createRes = await request(app)
        .post(`/api/coupons?password=${password}`)
        .send({
          code: 'LIFECYCLE',
          percent_off: 15,
          duration: 'once',
          max_redemptions: 100,
        })
        .expect(200);

      expect(createRes.body.code).toBe('LIFECYCLE');
      expect(createRes.body.percent_off).toBe(15);

      // Retrieve
      const getRes = await request(app)
        .get(`/api/coupons/LIFECYCLE?password=${password}`)
        .expect(200);

      expect(getRes.body.code).toBe('LIFECYCLE');
      expect(getRes.body.max_redemptions).toBe(100);

      // Update
      await request(app)
        .put(`/api/coupons/LIFECYCLE?password=${password}`)
        .send({ percent_off: 25, max_redemptions: 200 })
        .expect(200);

      // Verify update
      const getRes2 = await request(app)
        .get(`/api/coupons/LIFECYCLE?password=${password}`)
        .expect(200);

      expect(getRes2.body.percent_off).toBe(25);
      expect(getRes2.body.max_redemptions).toBe(200);

      // Delete
      await request(app)
        .delete(`/api/coupons/LIFECYCLE?password=${password}`)
        .expect(200);

      // Verify deletion
      await request(app)
        .get(`/api/coupons/LIFECYCLE?password=${password}`)
        .expect(404);
    });
  });

  describe('Coupon to discount flow', () => {
    test('should create coupon and apply as discount', async () => {
      // Create coupon
      await request(app)
        .post(`/api/coupons?password=${password}`)
        .send({ code: 'FLOWTEST', percent_off: 30 })
        .expect(200);

      // Apply discount
      const discountRes = await request(app)
        .post(`/api/discounts?password=${password}`)
        .send({ code: 'FLOWTEST', user: 'testuser123' })
        .expect(200);

      expect(discountRes.body.user).toBe('testuser123');
      expect(discountRes.body.code).toBe('FLOWTEST');

      // Verify discount exists
      const listRes = await request(app)
        .get(`/api/discounts?password=${password}`)
        .expect(200);

      expect(listRes.body.length).toBe(1);
      expect(listRes.body[0].user).toBe('testuser123');
    });
  });

  describe('Email-based coupons', () => {
    test('should create and retrieve email-based coupon', async () => {
      // Create email coupon
      await request(app)
        .post(`/api/coupons?password=${password}`)
        .send({ email: 'company.com', percent_off: 20 })
        .expect(200);

      // Retrieve by email
      const res = await request(app)
        .get(`/api/coupons/@company.com?password=${password}`)
        .expect(200);

      expect(res.body.email).toBe('company.com');
      expect(res.body.percent_off).toBe(20);
    });
  });

  describe('Multiple coupons and discounts', () => {
    test('should handle multiple coupons and discounts', async () => {
      const Coupon = mongoose.model('Coupon');

      // Create multiple coupons
      await Coupon.create([
        { code: 'BULK1', percent_off: 10 },
        { code: 'BULK2', percent_off: 20 },
        { code: 'BULK3', percent_off: 30 },
      ]);

      // List coupons
      const listRes = await request(app)
        .get(`/api/coupons?password=${password}`)
        .expect(200);

      expect(listRes.body.length).toBe(3);

      // Apply multiple discounts
      await request(app)
        .post(`/api/discounts?password=${password}`)
        .send({ code: 'BULK1', user: 'user1' })
        .expect(200);

      await request(app)
        .post(`/api/discounts?password=${password}`)
        .send({ code: 'BULK2', user: 'user2' })
        .expect(200);

      await request(app)
        .post(`/api/discounts?password=${password}`)
        .send({ code: 'BULK3', user: 'user3' })
        .expect(200);

      // Verify all discounts
      const discountRes = await request(app)
        .get(`/api/discounts?password=${password}`)
        .expect(200);

      expect(discountRes.body.length).toBe(3);
    });
  });

  describe('Error handling', () => {
    test('should return 404 for non-existent coupon', async () => {
      await request(app)
        .get(`/api/coupons/NOTFOUND?password=${password}`)
        .expect(404);
    });

    test('should return 404 when applying non-existent coupon', async () => {
      await request(app)
        .post(`/api/discounts?password=${password}`)
        .send({ code: 'NOTFOUND', user: 'user1' })
        .expect(404);
    });

    test('should return 401 for all endpoints without password', async () => {
      await request(app).get('/api/coupons').expect(401);
      await request(app).post('/api/coupons').send({}).expect(401);
      await request(app).get('/api/coupons/TEST').expect(401);
      await request(app).put('/api/coupons/TEST').send({}).expect(401);
      await request(app).delete('/api/coupons/TEST').expect(401);

      await request(app).get('/api/discounts').expect(401);
      await request(app).post('/api/discounts').send({}).expect(401);
    });
  });

  describe('Coupon with all fields', () => {
    test('should create coupon with all possible fields', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();

      const res = await request(app)
        .post(`/api/coupons?password=${password}`)
        .send({
          code: 'FULLFEATURED',
          percent_off: 25,
          max_redemptions: 1000,
          redeem_by: futureDate,
        })
        .expect(200);

      expect(res.body.code).toBe('FULLFEATURED');
      expect(res.body.percent_off).toBe(25);
      expect(res.body.max_redemptions).toBe(1000);
      expect(res.body.redeem_by).toBeDefined();
    });
  });
});
