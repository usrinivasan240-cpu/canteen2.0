/**
 * Paytm All-in-One SDK — Backend Endpoints
 * File: api/paytm-initiate.ts (Vercel Serverless Function)
 *
 * This file is imported by the existing Express server in server.ts.
 * Routes are registered on the Express app.
 */

import { Router } from 'express';
import axios from 'axios';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const PaytmChecksum = require('paytmchecksum');

const router = Router();

// ── Paytm Config (read from environment) ────────────────────────────────────
const PAYTM_MID          = (process.env.PAYTM_MID || process.env.PAYTM_MERCHANT_ID || '').trim();
const PAYTM_MKEY         = (process.env.PAYTM_MKEY || process.env.PAYTM_MERCHANT_KEY || '').trim();
const PAYTM_WEBSITE      = (process.env.PAYTM_WEBSITE || 'WEBSTAGING').trim();
const PAYTM_STAGING      = (process.env.PAYTM_STAGING || 'true').trim() === 'true';
const PAYTM_CALLBACK_URL = (process.env.PAYTM_CALLBACK_URL || 'https://canteen20.vercel.app/api/payment/paytm-callback').trim();

const PAYTM_BASE_URL = PAYTM_STAGING
  ? 'https://securegw-stage.paytm.in'
  : 'https://securegw.paytm.in';

const paytmConfigured = !!(PAYTM_MID && PAYTM_MKEY);

// ── POST /api/payment/paytm-initiate ────────────────────────────────────────
// Frontend calls this to get a txnToken before opening the Paytm SDK.
// Body: { orderId: string, amount: number|string, customerId: string }
// Returns: { success, txnToken, orderId, mid }
router.post('/api/payment/paytm-initiate', async (req, res) => {
  if (!paytmConfigured) {
    return res.status(500).json({
      success: false,
      error: 'Paytm credentials not configured on server',
    });
  }

  try {
    const { orderId, amount, customerId } = req.body;

    // ── Validate inputs ───────────────────────────────────────────────────
    if (!orderId || amount === undefined || amount === null || !customerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: orderId, amount, customerId',
      });
    }

    // Amount must be a string with exactly 2 decimal places
    const formattedAmount = Number(amount).toFixed(2);

    if (isNaN(Number(formattedAmount)) || Number(formattedAmount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount — must be a positive number',
      });
    }

    console.log(`[Paytm Initiate] orderId=${orderId} amount=₹${formattedAmount} customer=${customerId}`);

    // ── Build the request body for /theia/api/v1/initiateTransaction ──────
    const paytmBody = {
      mid: PAYTM_MID,
      orderId: orderId,
      txnAmount: {
        value: formattedAmount,
        currency: 'INR',
      },
      userInfo: {
        custId: customerId,
      },
    };

    // ── Generate checksum (signature over body object, NOT JSON string) ───
    const checksum = await PaytmChecksum.generateSignature(paytmBody, PAYTM_MKEY);
    console.log(`[Paytm Initiate] Checksum generated`);

    const fullPayload = {
      body: paytmBody,
      head: {
        signature: checksum,
      },
    };

    // ── Call Paytm's Initiate Transaction API ─────────────────────────────
    const apiUrl = `${PAYTM_BASE_URL}/theia/api/v1/initiateTransaction?mid=${PAYTM_MID}&orderId=${orderId}`;
    const paytmResponse = await axios.post(apiUrl, fullPayload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });

    const result = paytmResponse.data;

    // ── Check for success ─────────────────────────────────────────────────
    if (result.body?.resultInfo?.resultStatus === 'S' && result.body?.txnToken) {
      console.log(`[Paytm Initiate] ✅ txnToken issued for ${orderId}`);

      return res.json({
        success: true,
        txnToken: result.body.txnToken,
        orderId: orderId,
        mid: PAYTM_MID,
        amount: formattedAmount,
      });
    }

    // Paytm returned an error
    const errCode = result.body?.resultInfo?.resultCode || 'UNKNOWN';
    const errMsg = result.body?.resultInfo?.resultMsg || 'Paytm did not issue a txnToken';
    console.error(`[Paytm Initiate] ❌ ${errCode}: ${errMsg}`);

    return res.status(502).json({
      success: false,
      error: `[${errCode}] ${errMsg}`,
      paytmResult: result.body?.resultInfo,
    });
  } catch (err: any) {
    const detail = err?.response?.data || err?.message || JSON.stringify(err);
    console.error('[Paytm Initiate] Server error:', detail);
    return res.status(500).json({
      success: false,
      error: `Server error: ${err?.message || 'Unknown'}`,
    });
  }
});

// ── POST /api/payment/paytm-callback ────────────────────────────────────────
// Paytm calls this endpoint (server-to-server) after payment completes.
// It sends form-urlencoded body with ORDER_ID, TXNSTATUS, CHECKSUMHASH, etc.
router.post('/api/payment/paytm-callback', async (req, res) => {
  try {
    // Merge query + body (Paytm may send as POST body or query params)
    const params: Record<string, string> = { ...req.query as any, ...req.body };
    const orderId = params.ORDER_ID || '';
    const txnStatus = params.TXN_STATUS || params.STATUS || '';
    const checksum = params.CHECKSUMHASH || params.CHECKSUM || '';

    console.log(`[Paytm Callback] orderId=${orderId} status=${txnStatus}`);

    // ── Verify checksum ───────────────────────────────────────────────────
    if (checksum) {
      // Remove CHECKSUMHASH from the params before verifying
      const verifyParams = { ...params };
      delete verifyParams.CHECKSUMHASH;
      delete verifyParams.CHECKSUM;

      const isValid = await PaytmChecksum.verifySignature(
        verifyParams,
        PAYTM_MKEY,
        checksum
      );

      if (!isValid) {
        console.error(`[Paytm Callback] ❌ Checksum mismatch for ${orderId}`);
        return res.status(400).json({ success: false, error: 'Checksum verification failed' });
      }
      console.log(`[Paytm Callback] ✅ Checksum verified for ${orderId}`);
    }

    // ── Handle transaction result ─────────────────────────────────────────
    if (txnStatus === 'TXN_SUCCESS') {
      console.log(`[Paytm Callback] ✅ Payment SUCCESS for ${orderId}`);
      // TODO: Update order status in your database here
      // e.g., await db.collection('orders').doc(orderId).update({ paymentStatus: 'paid' });

      return res.json({
        success: true,
        orderId: orderId,
        txnStatus: 'TXN_SUCCESS',
        txnId: params.TXNID || '',
        amount: params.TXNAMOUNT || '',
      });
    } else {
      console.log(`[Paytm Callback] ❌ Payment FAILED for ${orderId}: ${params.RESPMSG || txnStatus}`);
      return res.json({
        success: false,
        orderId: orderId,
        txnStatus: txnStatus,
        error: params.RESPMSG || 'Payment failed',
      });
    }
  } catch (err: any) {
    console.error('[Paytm Callback] Error:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Callback processing error' });
  }
});

// ── GET /api/payment/paytm-callback ─────────────────────────────────────────
// Paytm may also redirect the browser via GET. Forward to the POST handler logic.
router.get('/api/payment/paytm-callback', (req, res) => {
  console.log('[Paytm Callback] GET redirect received:', req.query);
  // Redirect to the app with pending status — client will poll order status
  const APP_UPDATE_URL = process.env.APP_UPDATE_URL || 'https://canteen20.vercel.app';
  return res.redirect(`${APP_UPDATE_URL}?payment=pending&orderId=${req.query.ORDER_ID || ''}`);
});

export default router;
