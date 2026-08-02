import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:paytm_allinonesdk/paytm_allinonesdk.dart';
import '../config.dart';

/// Result of a Paytm payment attempt.
class PaytmResult {
  final bool success;
  final String? orderId;
  final String? txnId;
  final String? status; // 'TXN_SUCCESS', 'TXN_FAILURE', 'USER_CANCELLED', 'INITIATED'
  final String? errorMessage;
  final Map<String, String>? rawResponse;

  PaytmResult({
    required this.success,
    this.orderId,
    this.txnId,
    this.status,
    this.errorMessage,
    this.rawResponse,
  });

  @override
  String toString() =>
      'PaytmResult(success=$success, orderId=$orderId, status=$status, error=$errorMessage)';
}

/// Service that handles Paytm All-in-One SDK payments.
///
/// Flow:
/// 1. Call backend → get txnToken
/// 2. Open Paytm SDK payment sheet
/// 3. Return result to caller
class PaytmPaymentService {
  /// Initiate a Paytm payment.
  ///
  /// [orderId]   — unique order ID (e.g. "ORD_12345")
  /// [amount]    — payment amount (e.g. 200.00)
  /// [customerId] — customer/user ID
  ///
  /// Returns a [PaytmResult] with success/failure details.
  static Future<PaytmResult> initiatePayment({
    required String orderId,
    required double amount,
    required String customerId,
  }) async {
    try {
      // ── Step 1: Call our backend to get txnToken ──────────────────────
      debugPrint('[Paytm] Requesting txnToken for order $orderId...');

      final initResponse = await http.post(
        Uri.parse('${AppConfig.apiBase}/api/payment/paytm-initiate'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'orderId': orderId,
          'amount': amount,
          'customerId': customerId,
        }),
      );

      if (initResponse.statusCode != 200) {
        debugPrint('[Paytm] Backend returned ${initResponse.statusCode}: ${initResponse.body}');
        return PaytmResult(
          success: false,
          orderId: orderId,
          status: 'INITIATED',
          errorMessage: 'Backend returned status ${initResponse.statusCode}',
        );
      }

      final initData = jsonDecode(initResponse.body) as Map<String, dynamic>;

      if (initData['success'] != true || initData['txnToken'] == null) {
        final errMsg = initData['error']?.toString() ?? 'Failed to get txnToken';
        debugPrint('[Paytm] Initiate failed: $errMsg');
        return PaytmResult(
          success: false,
          orderId: orderId,
          status: 'INITIATED',
          errorMessage: errMsg,
        );
      }

      final txnToken = initData['txnToken'] as String;
      final mid = initData['mid'] as String;
      debugPrint('[Paytm] txnToken received, opening SDK...');

      // ── Step 2: Open the Paytm All-in-One SDK ─────────────────────────
      //
      // The SDK opens a native payment sheet. After the user pays / cancels,
      // the Future completes with a Map containing the transaction response.
      //
      // Parameters:
      //   mid             — merchant ID (provided by Paytm)
      //   orderId         — same order ID used to generate txnToken
      //   txnToken        — token from Paytm's Initiate Transaction API
      //   amount           — amount as string
      //   callbackUrl     — Paytm redirects here after payment
      //   isStaging       — true for test mode
      //   restrictAdditionalParameters — limit extra params sent to callback

      final Map<String, String> result = await AllInOneSdk.startTransaction(
        mid: mid,
        orderId: orderId,
        txnToken: txnToken,
        amount: amount.toStringAsFixed(2),
        callbackUrl: '${AppConfig.apiBase}/api/payment/paytm-callback',
        isStaging: true,
        restrictAdditionalParameters: false,
      ).catchError((error) {
        debugPrint('[Paytm] SDK error: $error');
        // SDK throws on user cancellation or network errors
        throw error;
      });

      // ── Step 3: Parse the SDK response ────────────────────────────────
      debugPrint('[Paytm] SDK response: $result');

      final txnStatus = result['STATUS'] ?? result['txnStatus'] ?? '';
      final txnId = result['TXNID'] ?? result['txnId'] ?? '';
      final orderIdReturned = result['ORDERID'] ?? orderId;
      final respMsg = result['RESPMSG'] ?? result['respMsg'] ?? '';

      if (txnStatus == 'TXN_SUCCESS') {
        debugPrint('[Paytm] ✅ Payment SUCCESS — txnId: $txnId');
        return PaytmResult(
          success: true,
          orderId: orderIdReturned,
          txnId: txnId,
          status: 'TXN_SUCCESS',
          rawResponse: result,
        );
      } else {
        debugPrint('[Paytm] ❌ Payment $txnStatus — $respMsg');
        return PaytmResult(
          success: false,
          orderId: orderIdReturned,
          txnId: txnId,
          status: txnStatus,
          errorMessage: respMsg,
          rawResponse: result,
        );
      }
    } catch (e) {
      // This handles SDK cancellation, network errors, JSON parse errors
      final errorStr = e.toString();
      debugPrint('[Paytm] Exception: $errorStr');

      // User tapped back / cancelled the payment sheet
      if (errorStr.toLowerCase().includes('cancel') ||
          errorStr.toLowerCase().contains('back press')) {
        return PaytmResult(
          success: false,
          orderId: orderId,
          status: 'USER_CANCELLED',
          errorMessage: 'Payment cancelled by user',
        );
      }

      return PaytmResult(
        success: false,
        orderId: orderId,
        status: 'ERROR',
        errorMessage: errorStr,
      );
    }
  }
}
