import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/cart_provider.dart';
import '../providers/auth_provider.dart';
import '../providers/order_provider.dart';
import '../providers/theme_provider.dart';
import '../models/offer.dart';
import '../services/api_service.dart';
import 'payment_screen.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  String selectedSlot = 'ASAP (Instant)';
  List<Offer> _activeOffers = [];
  Offer? _selectedOffer;
  double _discount = 0;
  bool _loadingOffers = true;

  @override
  void initState() {
    super.initState();
    _fetchOffers();
  }

  Future<void> _fetchOffers() async {
    try {
      final cart = context.read<CartProvider>();
      final canteenId = cart.canteenId ?? 'canteen_001';
      final api = ApiService();
      final offerMaps = await api.getActiveOffers(canteenId);
      if (mounted) {
        setState(() {
          _activeOffers = offerMaps.map((m) => Offer.fromJson(m)).toList();
          _loadingOffers = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loadingOffers = false);
    }
  }

  void _applyOffer(Offer? offer) {
    final cart = context.read<CartProvider>();
    setState(() {
      if (offer == null || _selectedOffer?.id == offer.id) {
        _selectedOffer = null;
        _discount = 0;
      } else {
        final cartItems = cart.items.entries.map((e) => {
          'itemId': e.value.menuItem.id,
          'name': e.value.menuItem.name,
          'price': e.value.menuItem.price,
          'quantity': e.value.quantity,
        }).toList();
        final disc = offer.calculateDiscount(cart.subtotal, cartItems);
        if (disc > 0 && cart.subtotal - disc >= 0) {
          _selectedOffer = offer;
          _discount = disc;
        } else {
          _selectedOffer = null;
          _discount = 0;
        }
      }
    });
  }

  List<String> _generateTimeSlots() {
    final slots = ['ASAP (Instant)'];
    final now = DateTime.now();
    int minutes = now.minute;
    int hours = now.hour;
    final remainder = minutes % 15;
    minutes += (15 - remainder);
    if (minutes >= 60) { minutes = 0; hours++; }
    for (int i = 0; i < 16; i++) {
      final slotMin = minutes.toString().padLeft(2, '0');
      int displayHours = hours % 12;
      if (displayHours == 0) displayHours = 12;
      final ampm = hours >= 12 ? 'PM' : 'AM';
      slots.add('$displayHours:$slotMin $ampm');
      minutes += 15;
      if (minutes >= 60) { minutes = 0; hours++; }
    }
    return slots;
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final slots = _generateTimeSlots();
    final themeProv = context.watch<ThemeProvider>();
    final bg = themeProv.isDark ? const Color(0xFF111827) : const Color(0xFFFBFCFF);
    final cardBg = themeProv.isDark ? const Color(0xFF1F2937) : Colors.white;
    final cardBorder = themeProv.isDark ? const Color(0xFF374151) : const Color(0xFFFEE2E2);
    final textColor = themeProv.isDark ? Colors.white : Colors.black87;
    final subTextColor = themeProv.isDark ? Colors.grey[400]! : Colors.grey;

    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        backgroundColor: themeProv.isDark ? const Color(0xFF1F2937) : Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios, size: 18, color: textColor),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Checkout', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: textColor)),
        centerTitle: true,
      ),
      body: cart.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.shopping_cart_outlined, size: 64, color: Colors.amber[100]),
                  const SizedBox(height: 16),
                  const Text('Your cart is empty', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Color(0xFF6B7280))),
                  const SizedBox(height: 8),
                  Text('Add items from the menu to get started', style: TextStyle(fontSize: 12, color: Colors.grey[400])),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFF59E0B), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                    child: const Text('Browse Menu', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(8)),
                    child: Row(
                      children: [
                        Icon(Icons.store, size: 14, color: Colors.amber[700]),
                        const SizedBox(width: 6),
                        Text('Ordering from this canteen only', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.amber[700])),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: cardBg,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: cardBorder),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('YOUR ORDER', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: subTextColor, letterSpacing: 0.5)),
                        const SizedBox(height: 12),
                        ...cart.items.entries.map((e) {
                          final item = e.value;
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Row(
                              children: [
                                Container(
                                  width: 44, height: 44,
                                  decoration: BoxDecoration(color: Colors.amber[50], borderRadius: BorderRadius.circular(10)),
                                  child: item.menuItem.imageUrl != null && item.menuItem.imageUrl!.isNotEmpty
                                      ? ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.network(item.menuItem.imageUrl!, fit: BoxFit.cover))
                                      : const Center(child: Text('🍲', style: TextStyle(fontSize: 18))),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(item.menuItem.name, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: textColor), maxLines: 1, overflow: TextOverflow.ellipsis),
                                      const SizedBox(height: 2),
                                      Text('₹${item.menuItem.price.toStringAsFixed(2)}', style: TextStyle(fontSize: 11, color: Colors.amber[700], fontWeight: FontWeight.bold)),
                                    ],
                                  ),
                                ),
                                Container(
                                  decoration: BoxDecoration(color: Colors.amber[50], borderRadius: BorderRadius.circular(8)),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      _qtyBtn(Icons.remove, () {
                                        setState(() {
                                          if (item.quantity <= 1) cart.removeItem(item.menuItem.id);
                                          else cart.updateQuantity(item.menuItem.id, item.quantity - 1);
                                        });
                                      }),
                                      Padding(
                                        padding: const EdgeInsets.symmetric(horizontal: 6),
                                        child: Text('${item.quantity}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                      ),
                                      _qtyBtn(Icons.add, () {
                                        if (item.quantity < item.menuItem.stock) {
                                          setState(() => cart.updateQuantity(item.menuItem.id, item.quantity + 1));
                                        }
                                      }),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                GestureDetector(
                                  onTap: () => setState(() => cart.removeItem(item.menuItem.id)),
                                  child: Icon(Icons.delete_outline, size: 16, color: Colors.amber[400]),
                                ),
                              ],
                            ),
                          );
                        }),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: cardBg,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: cardBorder),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('PICKUP SLOT', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: subTextColor, letterSpacing: 0.5)),
                        const SizedBox(height: 8),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEE2E2).withOpacity(0.3),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFFEE2E2)),
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              value: selectedSlot,
                              isDense: true,
                              isExpanded: true,
                              items: slots.map((s) => DropdownMenuItem(value: s, child: Text(s, style: TextStyle(fontSize: 12, color: textColor)))).toList(),
                              onChanged: (v) => setState(() => selectedSlot = v ?? 'ASAP (Instant)'),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  // ── AVAILABLE OFFERS ──
                  if (!_loadingOffers && _activeOffers.isNotEmpty) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: cardBg,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFD1FAE5)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            const Icon(Icons.local_offer, size: 16, color: Color(0xFF059669)),
                            const SizedBox(width: 6),
                            Text('AVAILABLE OFFERS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: const Color(0xFF059669), letterSpacing: 0.5)),
                          ]),
                          const SizedBox(height: 10),
                          ...(_activeOffers.map((offer) => GestureDetector(
                            onTap: () => _applyOffer(offer),
                            child: Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: _selectedOffer?.id == offer.id ? const Color(0xFFD1FAE5) : Colors.grey[50],
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: _selectedOffer?.id == offer.id ? const Color(0xFF059669) : Colors.grey[200]!,
                                  width: _selectedOffer?.id == offer.id ? 2 : 1,
                                ),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: offer.offerType == 'combo' ? const Color(0xFFEDE9FE) : const Color(0xFFDBEAFE),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(offer.typeLabel, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: offer.offerType == 'combo' ? const Color(0xFF7C3AED) : const Color(0xFF2563EB))),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(offer.title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
                                        Text(offer.displayText, style: const TextStyle(fontSize: 10, color: Color(0xFF059669), fontWeight: FontWeight.w600)),
                                      ],
                                    ),
                                  ),
                                  if (_selectedOffer?.id == offer.id)
                                    const Icon(Icons.check_circle, size: 18, color: Color(0xFF059669))
                                  else
                                    Icon(Icons.radio_button_unchecked, size: 18, color: Colors.grey[400]),
                                ],
                              ),
                            ),
                          ))),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  // ── BILL SUMMARY ──
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: cardBg,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: cardBorder),
                    ),
                    child: Column(
                      children: [
                        _summaryRow('Subtotal', '₹${cart.subtotal.toStringAsFixed(2)}'),
                        if (_discount > 0)
                          _summaryRow('Offer Discount ($_selectedOffer!.displayText)', '-₹${_discount.toStringAsFixed(2)}', bold: false, isDiscount: true),
                        _summaryRow('Convenience Fee', '₹${cart.convenienceFee.toStringAsFixed(2)} + ₹${cart.pgCharge.toStringAsFixed(2)}'),
                        const Divider(color: Color(0xFFFEE2E2)),
                        _summaryRow('Grand Total', '₹${(cart.totalAmount - _discount).toStringAsFixed(2)}', bold: true),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: cart.isEmpty ? null : () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => PaymentScreen(
                              totalAmount: cart.totalAmount - _discount,
                              pickupSlot: selectedSlot,
                            ),
                          ),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFF59E0B),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 3,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.lock, size: 16),
                          const SizedBox(width: 8),
                          Text('Pay via Razorpay ₹${(cart.totalAmount - _discount).toStringAsFixed(2)}', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Center(
                    child: Text('SECURE ENCRYPTED PAYMENT', style: TextStyle(fontSize: 9, color: Colors.grey[400], letterSpacing: 1)),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _qtyBtn(IconData icon, VoidCallback onTap) {
    final themeProv = context.watch<ThemeProvider>();
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.all(5),
        decoration: BoxDecoration(color: themeProv.isDark ? const Color(0xFF374151) : Colors.white, borderRadius: BorderRadius.circular(5)),
        child: Icon(icon, size: 12, color: const Color(0xFFF59E0B)),
      ),
    );
  }

  Widget _summaryRow(String label, String value, {bool bold = false, bool isDiscount = false}) {
    final themeProv = context.watch<ThemeProvider>();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 13, color: isDiscount ? const Color(0xFF059669) : (themeProv.isDark ? Colors.grey[400] : Colors.grey[500]), fontWeight: bold ? FontWeight.w700 : FontWeight.normal)),
          Text(value, style: TextStyle(
            fontSize: bold ? 16 : 13,
            fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
            color: isDiscount ? const Color(0xFF059669) : (bold ? const Color(0xFFF59E0B) : (themeProv.isDark ? Colors.grey[300] : Colors.grey[700])),
          )),
        ],
      ),
    );
  }
}
