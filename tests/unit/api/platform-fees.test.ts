import { describe, it, expect } from 'vitest';

function calculatePlatformFee(pf: any, amount: number): number {
  if (!pf) return 0;
  switch (pf.type) {
    case 'free':
      return 0;
    case 'flat':
      return pf.flatAmount || 0;
    case 'percentage':
      return Math.round((amount * (pf.percentage || 0)) / 100);
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
        } catch (e) {
          return 0;
        }
      }
      return 0;
    default:
      return 0;
  }
}

describe('Platform Fees Calculation', () => {
  describe('free', () => {
    it('returns 0 for any amount', () => {
      expect(calculatePlatformFee({ type: 'free' }, 100)).toBe(0);
      expect(calculatePlatformFee({ type: 'free' }, 1000)).toBe(0);
    });
  });

  describe('flat', () => {
    it('returns fixed amount regardless of order total', () => {
      expect(calculatePlatformFee({ type: 'flat', flatAmount: 5 }, 50)).toBe(5);
      expect(calculatePlatformFee({ type: 'flat', flatAmount: 5 }, 500)).toBe(5);
    });

    it('returns 0 if flatAmount not set', () => {
      expect(calculatePlatformFee({ type: 'flat' }, 100)).toBe(0);
    });
  });

  describe('percentage', () => {
    it('calculates percentage of amount', () => {
      expect(calculatePlatformFee({ type: 'percentage', percentage: 10 }, 100)).toBe(10);
      expect(calculatePlatformFee({ type: 'percentage', percentage: 5 }, 200)).toBe(10);
      expect(calculatePlatformFee({ type: 'percentage', percentage: 2.5 }, 100)).toBe(3); // rounded
    });

    it('returns 0 if percentage not set', () => {
      expect(calculatePlatformFee({ type: 'percentage' }, 100)).toBe(0);
    });
  });

  describe('tiered', () => {
    const tiers = [
      { minAmount: 0, maxAmount: 100, feeAmount: 1 },
      { minAmount: 101, maxAmount: 200, feeAmount: 2 },
      { minAmount: 201, maxAmount: 300, feeAmount: 3 },
      { minAmount: 301, maxAmount: Infinity, feeAmount: 5 },
    ];

    it('matches correct tier', () => {
      expect(calculatePlatformFee({ type: 'tiered', tiers }, 50)).toBe(1);
      expect(calculatePlatformFee({ type: 'tiered', tiers }, 150)).toBe(2);
      expect(calculatePlatformFee({ type: 'tiered', tiers }, 250)).toBe(3);
      expect(calculatePlatformFee({ type: 'tiered', tiers }, 500)).toBe(5);
    });

    it('handles edge cases at boundaries', () => {
      expect(calculatePlatformFee({ type: 'tiered', tiers }, 0)).toBe(1);
      expect(calculatePlatformFee({ type: 'tiered', tiers }, 100)).toBe(1);
      expect(calculatePlatformFee({ type: 'tiered', tiers }, 101)).toBe(2);
      expect(calculatePlatformFee({ type: 'tiered', tiers }, 200)).toBe(2);
      expect(calculatePlatformFee({ type: 'tiered', tiers }, 201)).toBe(3);
    });

    it('returns 0 if no matching tier', () => {
      expect(calculatePlatformFee({ type: 'tiered', tiers: [] }, 100)).toBe(0);
    });
  });

  describe('custom', () => {
    it('evaluates JS expression with amount variable', () => {
      expect(calculatePlatformFee({ type: 'custom', customFormula: 'amount * 0.02' }, 100)).toBe(2);
      expect(calculatePlatformFee({ type: 'custom', customFormula: 'amount > 500 ? 10 : 5' }, 600)).toBe(10);
      expect(calculatePlatformFee({ type: 'custom', customFormula: 'amount > 500 ? 10 : 5' }, 400)).toBe(5);
    });

    it('returns 0 on invalid formula', () => {
      expect(calculatePlatformFee({ type: 'custom', customFormula: 'invalid code' }, 100)).toBe(0);
    });

    it('returns 0 if no formula', () => {
      expect(calculatePlatformFee({ type: 'custom' }, 100)).toBe(0);
    });
  });

  describe('null/undefined handling', () => {
    it('returns 0 for null config', () => {
      expect(calculatePlatformFee(null, 100)).toBe(0);
    });

    it('returns 0 for undefined config', () => {
      expect(calculatePlatformFee(undefined, 100)).toBe(0);
    });

    it('returns 0 for empty object', () => {
      expect(calculatePlatformFee({}, 100)).toBe(0);
    });
  });
});