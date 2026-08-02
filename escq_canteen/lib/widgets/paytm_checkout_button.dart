import 'package:flutter/material.dart';
import '../services/paytm_payment_service.dart';

/// Example: Paytm payment button for the checkout screen.
///
/// Usage:
///   PaytmCheckoutButton(
///     orderId: 'ORD_12345',
///     amount: 200.0,
///     customerId: 'user_001',
///     onSuccess: (result) { ... },
///   )
class PaytmCheckoutButton extends StatefulWidget {
  final String orderId;
  final double amount;
  final String customerId;
  final void Function(PaytmResult result)? onSuccess;
  final void Function(PaytmResult result)? onFailure;

  const PaytmCheckoutButton({
    super.key,
    required this.orderId,
    required this.amount,
    required this.customerId,
    this.onSuccess,
    this.onFailure,
  });

  @override
  State<PaytmCheckoutButton> createState() => _PaytmCheckoutButtonState();
}

class _PaytmCheckoutButtonState extends State<PaytmCheckoutButton> {
  bool _isLoading = false;
  String? _statusMessage;

  Future<void> _handlePayment() async {
    setState(() {
      _isLoading = true;
      _statusMessage = 'Requesting payment token...';
    });

    try {
      final result = await PaytmPaymentService.initiatePayment(
        orderId: widget.orderId,
        amount: widget.amount,
        customerId: widget.customerId,
      );

      if (!mounted) return;

      setState(() {
        _isLoading = false;
        if (result.success) {
          _statusMessage = '✅ Payment successful! Order confirmed.';
          widget.onSuccess?.call(result);
        } else if (result.status == 'USER_CANCELLED') {
          _statusMessage = 'Payment cancelled.';
          widget.onFailure?.call(result);
        } else {
          _statusMessage = '❌ ${result.errorMessage ?? 'Payment failed'}';
          widget.onFailure?.call(result);
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _statusMessage = '❌ Unexpected error: $e';
      });
      widget.onFailure?.call(PaytmResult(
        success: false,
        orderId: widget.orderId,
        status: 'ERROR',
        errorMessage: e.toString(),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _handlePayment,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF00B9F5), // Paytm blue
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              disabledBackgroundColor: const Color(0xFF00B9F5).withOpacity(0.5),
            ),
            child: _isLoading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : Text(
                    'Pay ₹${widget.amount.toStringAsFixed(2)} via Paytm',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
          ),
        ),
        if (_statusMessage != null) ...[
          const SizedBox(height: 12),
          Text(
            _statusMessage!,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              color: _statusMessage!.startsWith('✅')
                  ? Colors.green.shade700
                  : _statusMessage!.startsWith('❌')
                      ? Colors.red.shade700
                      : Colors.grey.shade600,
            ),
          ),
        ],
      ],
    );
  }
}
