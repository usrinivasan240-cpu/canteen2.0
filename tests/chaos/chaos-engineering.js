// Chaos Engineering Scripts for Esc(Q) Canteen
// Run with: k6 run tests/chaos/chaos-engineering.js --env BASE_URL=https://canteen20.vercel.app

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import exec from 'k6/execution';

const errorRate = new Rate('errors');
const latency = new Trend('latency');

export const options = {
  vus: 10,
  duration: '5m',
  thresholds: {
    http_req_failed: ['rate<0.1'],
    http_req_duration: ['p(99)<10000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://canteen20.vercel.app';

export function setup() {
  console.log('Starting Chaos Engineering Experiments');
  console.log('Target: ' + (__ENV.BASE_URL || 'https://canteen20.vercel.app'));
  return { baseUrl: __ENV.BASE_URL || 'https://canteen20.vercel.app' };
}

export default function (data) {
  const baseUrl = data.baseUrl || 'https://canteen20.vercel.app';
  
  // Experiment 1: Database Connection Failure Simulation
  if (Math.random() < 0.2) {
    console.log('EXPERIMENT: Simulating DB connection issues...');
    const res = http.get('https://canteen20.vercel.app/api/health', { timeout: '5s' });
    check(res, {
      'health endpoint responds': (r) => r.status === 200 || r.status === 503,
    });
  }
  
  // Experiment 2: High Latency Simulation
  if (Math.random() < 0.2) {
    console.log('EXPERIMENT: Testing high latency tolerance...');
    const start = Date.now();
    const res = http.get('https://canteen20.vercel.app/api/canteen?canteenId=canteen_001', { timeout: '30s' });
    const duration = Date.now() - start;
    check(res, { 'responds within 30s': (r) => r.status === 200 || r.status === 504 });
    console.log('Response time: ' + duration + 'ms');
  }
  
  // Experiment 3: Concurrent Order Storm
  if (Math.random() < 0.3) {
    console.log('EXPERIMENT: Concurrent order storm...');
    for (var i = 0; i < 10; i++) {
      http.post('https://canteen20.vercel.app/api/canteen/order', {
        items: [{ itemId: 'item_001', quantity: 1 }],
        pickupSlot: 'ASAP (Instant)',
        canteenId: 'canteen_001',
      }, { headers: { 'Content-Type': 'application/json' } });
    }
    sleep(1);
  }
  
  // Experiment 4: Payment Gateway Failure
  if (Math.random() < 0.1) {
    console.log('EXPERIMENT: Payment gateway failure simulation...');
    http.post('https://canteen20.vercel.app/api/razorpay/verify', {
      razorpay_order_id: 'order_test',
      razorpay_payment_id: 'pay_test',
      razorpay_signature: 'invalid_signature',
    }, { headers: { 'Content-Type': 'application/json' } });
  }
  
  // Experiment 5: Database Connection Exhaustion
  if (Math.random() < 0.1) {
    console.log('EXPERIMENT: Connection pool exhaustion...');
    for (var i = 0; i < 50; i++) {
      http.get('https://canteen20.vercel.app/api/canteen?canteenId=canteen_001');
    }
    sleep(2);
  }
  
  sleep(5);
}

export function teardown(data) {
  console.log('Chaos experiments completed');
}