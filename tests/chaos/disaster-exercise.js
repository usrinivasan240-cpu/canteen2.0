// Disaster Exercise: 10-Minute Backend Outage Simulation
// Run with: k6 run tests/chaos/disaster-exercise.js --env BASE_URL=https://canteen20.vercel.app

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '15m',
  thresholds: {
    http_req_failed: ['rate<0.5'], // Allow higher error rate during outage
    http_req_duration: ['p(95)<30000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://canteen20.vercel.app';

export function setup() {
  console.log('=== DISASTER EXERCISE: 10-MINUTE BACKEND OUTAGE ===');
  console.log('Simulating backend outage during peak lunch');
  console.log('Phase 1: Normal operation (2 min)');
  console.log('Phase 2: Backend outage (10 min)');
  console.log('Phase 3: Recovery (3 min)');
  return { startTime: Date.now(), currentPhase: 'normal' };
}

var phase = 'normal';
var phaseStart = Date.now();

export default function (data) {
  var now = Date.now();
  var elapsed = now - data.startTime;
  
  // Determine phase
  if (elapsed < 2 * 60 * 1000) {
    phase = 'normal';
  } else if (elapsed < 12 * 60 * 1000) {
    phase = 'outage';
  } else {
    phase = 'recovery';
  }
  
  if (phase !== data.currentPhase) {
    console.log('PHASE CHANGE: ' + phase.toUpperCase() + ' at ' + Math.round(elapsed / 1000) + 's');
    data.currentPhase = phase;
  }
  
  var headers = { headers: { 'Content-Type': 'application/json' } };
  var targetUrl = 'https://canteen20.vercel.app';
  
  if (phase === 'outage') {
    // During outage - simulate backend unavailable
    var res = http.get('https://canteen20.vercel.app/api/health', { timeout: '5s' });
    var success = res.status === 503 || res.status === 502 || res.status === 504 || res.status === 0;
    console.log('Outage phase - Health check: ' + (success ? 'DOWN (expected)' : 'UP (unexpected)') + ' - Status: ' + res.status);
  } else {
    // Normal or recovery phase
    var res = http.get('https://canteen20.vercel.app/api/canteen?canteenId=canteen_001', { timeout: '10s' });
    var success = res.status === 200;
    console.log('Phase: ' + phase + ' - Canteen API: ' + (success ? 'UP' : 'DOWN') + ' - Status: ' + res.status);
  }
  
  sleep(10);
}

export function teardown(data) {
  console.log('=== DISASTER EXERCISE COMPLETE ===');
  console.log('Verify:');
  console.log('1. Orders during outage: queued or failed gracefully');
  console.log('2. Orders after recovery: processed normally');
  console.log('3. No data loss or corruption');
  console.log('4. Kitchen tasks: queued during outage, processed after recovery');
  console.log('5. Payment callbacks: handled correctly on recovery');
}