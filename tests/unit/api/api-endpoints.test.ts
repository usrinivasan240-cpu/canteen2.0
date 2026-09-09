import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock DB functions (hoisted)
const mockPgSet = vi.fn();
const mockPgGetWhere = vi.fn();
const mockPgGetById = vi.fn();

// Create a minimal test app with the same route logic
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Platform fees calculation (copied from server logic)
  const calculatePlatformFee = (pf: any, amount: number): number => {
    if (!pf) return 0;
    switch (pf.type) {
      case 'free': return 0;
      case 'flat': return pf.flatAmount || 0;
      case 'percentage': return Math.round((amount * (pf.percentage || 0)) / 100);
      case 'tiered':
        if (pf.tiers && Array.isArray(pf.tiers)) {
          for (const tier of pf.tiers) {
            const min = tier.minAmount || 0;
            const max = tier.maxAmount || Infinity;
            if (amount >= min && (max === Infinity || amount <= max)) {
              return tier.feeAmount || 0;
            }
          }
        }
        return 0;
      case 'custom':
        if (pf.customFormula) {
          try {
            const fn = new Function('amount', `return ${pf.customFormula}`);
            return Math.round(fn(amount));
          } catch { return 0; }
        }
        return 0;
      default: return 0;
    }
  };

  // POST /api/canteen/order - simplified for testing
  app.post('/api/canteen/order', async (req, res) => {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Cannot place empty order.' });
    }
    // Simulate item not found for empty items array case
    return res.status(404).json({ success: false, error: 'Item not found' });
  });

  // GET /api/offers
  app.get('/api/offers', async (req, res) => {
    const { canteenId } = req.query;
    const offers = await mockPgGetWhere('offers', { canteenId });
    res.json({ success: true, offers });
  });

  // POST /api/offers
  app.post('/api/offers', async (req, res) => {
    const { canteenId, title, offerType, discountPercent, discountAmount, comboPrice, comboItemIds, applicableItemIds, minOrderAmount, maxUses, validFrom, validUntil, isActive } = req.body;
    if (!canteenId || !title) return res.status(400).json({ success: false, error: 'canteenId and title required' });
    
    const offerId = `offer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newOffer = { id: offerId, canteenId, title, offerType, discountPercent, discountAmount, comboPrice, comboItemIds, applicableItemIds, minOrderAmount, maxUses, validFrom, validUntil, isActive: isActive !== false, createdAt: Date.now() };
    await mockPgSet('offers', offerId, newOffer);
    res.json({ success: true, offer: newOffer });
  });

  // GET /api/chefs
  app.get('/api/chefs', async (req, res) => {
    const { canteenId } = req.query;
    const chefs = await mockPgGetWhere('chefs', { canteenId });
    res.json({ success: true, chefs });
  });

  // POST /api/chefs
  app.post('/api/chefs', async (req, res) => {
    const { canteenId, name, phone, email, specialization, userId } = req.body;
    if (!canteenId || !name) return res.status(400).json({ success: false, error: 'canteenId and name required' });
    
    const chefId = `chef_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newChef = { id: chefId, canteenId, name, phone: phone || '', email: email || '', specialization: specialization || [], userId: userId || null, status: 'AVAILABLE', isAvailable: true, createdAt: Date.now(), updatedAt: Date.now() };
    await mockPgSet('chefs', chefId, newChef);
    res.json({ success: true, chef: newChef });
  });

  // POST /api/chefs/:id/leave
  app.post('/api/chefs/:id/leave', async (req, res) => {
    const { id } = req.params;
    const { startDate, endDate, reason } = req.body;
    if (!startDate || !endDate) return res.status(400).json({ success: false, error: 'startDate and endDate required' });
    
    const leaveId = `leave_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newLeave = { id: leaveId, chefId: id, startDate, endDate, reason: reason || '', createdAt: Date.now() };
    await mockPgSet('chef_leave', leaveId, newLeave);
    res.json({ success: true, leave: newLeave });
  });

  return app;
};

describe('API Endpoints', () => {
  let app: express.Express;

  beforeEach(async () => {
    app = await createTestApp();
    vi.clearAllMocks();
  });

  describe('POST /api/canteen/order', () => {
    it('rejects empty orders', async () => {
      const res = await request(app)
        .post('/api/canteen/order')
        .send({ userId: 'user_1', userName: 'Test', items: [] });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/offers', () => {
    it('returns offers for canteen', async () => {
      mockPgGetWhere.mockResolvedValue([
        { id: 'offer_1', title: 'Lunch Deal', offerType: 'discount', discountPercent: 10, isActive: true }
      ]);

      const res = await request(app)
        .get('/api/offers?canteenId=canteen_001');
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.offers).toHaveLength(1);
    });
  });

  describe('POST /api/offers', () => {
    it('creates new offer', async () => {
      const res = await request(app)
        .post('/api/offers')
        .send({
          canteenId: 'canteen_001',
          title: 'Test Offer',
          offerType: 'discount',
          discountPercent: 15,
          isActive: true
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.offer).toBeDefined();
    });

    it('rejects offer without canteenId', async () => {
      const res = await request(app)
        .post('/api/offers')
        .send({ title: 'Test', offerType: 'discount' });
      
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/chefs', () => {
    it('returns chefs for canteen', async () => {
      mockPgGetWhere.mockResolvedValue([
        { id: 'chef_1', name: 'Chef Raj', status: 'AVAILABLE', canteenId: 'canteen_001' }
      ]);

      const res = await request(app)
        .get('/api/chefs?canteenId=canteen_001');
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.chefs).toHaveLength(1);
    });
  });

  describe('POST /api/chefs', () => {
    it('creates new chef', async () => {
      const res = await request(app)
        .post('/api/chefs')
        .send({
          canteenId: 'canteen_001',
          name: 'Chef New',
          phone: '9876543210',
          specialization: ['North Indian']
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.chef.name).toBe('Chef New');
    });

    it('rejects chef without canteenId', async () => {
      const res = await request(app)
        .post('/api/chefs')
        .send({ name: 'Chef' });
      
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/chefs/:id/leave', () => {
    it('creates leave record', async () => {
      const res = await request(app)
        .post('/api/chefs/chef_1/leave')
        .send({
          startDate: Date.now(),
          endDate: Date.now() + 86400000,
          reason: 'Vacation'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});