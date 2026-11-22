import 'package:pista_ui/pista_ui.dart';
import 'package:pista_core/pista_core.dart';

/// What the server gave the app to start paying: the amount (chosen by the
/// server, never the app) and the public values the gateway's checkout needs.
class PaymentSession {
  final String paymentId, provider, currency;
  final bool simulated;
  final int amountPaise;
  final DateTime expiresAt;
  final Map<String, dynamic> clientParams;
  PaymentSession(Map<String, dynamic> json)
    : paymentId = '${json['paymentId']}',
      provider = '${json['provider']}',
      currency = '${json['currency']}',
      simulated = json['simulated'] == true,
      amountPaise = (json['amountPaise'] as num).toInt(),
      expiresAt =
          DateTime.tryParse('${json['expiresAt']}') ??
          DateTime.now().add(const Duration(minutes: 15)),
      clientParams = Map<String, dynamic>.from(json['clientParams'] as Map);
}

enum LaunchOutcome {
  /// The customer finished the gateway's checkout. This is only a hint: the
  /// server still confirms the result with the gateway.
  completed,

  /// The customer closed the checkout without paying.
  cancelled,

  /// The checkout reported an error.
  failed,
}

class LaunchResult {
  final LaunchOutcome outcome;

  /// Proof the gateway handed back (for Razorpay: razorpay_payment_id,
  /// razorpay_order_id and razorpay_signature). Sent to the server, which
  /// verifies it; the app never decides whether it is genuine.
  final Map<String, dynamic>? proof;
  final String? message;
  const LaunchResult(this.outcome, {this.proof, this.message});
}

/// Opens a gateway's checkout. The payment page only talks to this interface,
/// so connecting a real gateway means implementing [GatewayLauncher] below and
/// nothing else in the app changes.
abstract class PaymentLauncher {
  Future<LaunchResult> launch(BuildContext context, PaymentSession session);
}

/// The launcher for this session: the built-in test checkout when the server
/// uses the simulated provider, otherwise the real gateway's.
PaymentLauncher launcherFor(PaymentSession session, PistaApi api) =>
    session.simulated ? SimulatedLauncher(api) : GatewayLauncher();

/// Moves no money. Lets a tester choose what the bank "does", so every payment
/// state can be tried in the private beta.
class SimulatedLauncher implements PaymentLauncher {
  final PistaApi api;
  SimulatedLauncher(this.api);
  @override
  Future<LaunchResult> launch(
    BuildContext context,
    PaymentSession session,
  ) async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      isDismissible: true,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 4, 24, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Test payment',
                  style: TextStyle(
                    fontFamily: 'packages/pista_ui/HouseSerif',
                    fontSize: 26,
                    fontWeight: FontWeight.w600,
                    color: pistaGreen,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'This stands in for your bank or UPI app. No money moves. Pick what should happen to ${rupees(session.amountPaise)}.',
                  style: const TextStyle(height: 1.5),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => Navigator.pop(context, 'success'),
                  child: const Text('Pay successfully'),
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () => Navigator.pop(context, 'failure'),
                  child: const Text('Decline the payment'),
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () => Navigator.pop(context, 'pending'),
                  child: const Text('Leave it pending (slow UPI)'),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (choice == null) return const LaunchResult(LaunchOutcome.cancelled);
    try {
      await api.simulatePayment(session.paymentId, choice);
    } catch (e) {
      return LaunchResult(LaunchOutcome.failed, message: '$e');
    }
    return LaunchResult(
      choice == 'failure' ? LaunchOutcome.failed : LaunchOutcome.completed,
      message: choice == 'failure' ? 'The test payment was declined.' : null,
    );
  }
}

/// The real gateway's checkout. NOT connected yet: this is the one place to
/// write once a gateway account exists.
///
/// For Razorpay:
///  1. `flutter pub add razorpay_flutter`, then follow its Android and iOS setup.
///  2. Open checkout with the values the server returned, for example
///     `razorpay.open({'key': p['keyId'], 'order_id': p['orderId'],
///      'amount': p['amountPaise'], 'currency': p['currency'],
///      'name': p['name'], 'description': p['description'],
///      'prefill': p['prefill']})`. The amount and order come from the server.
///  3. On the success callback return
///     `LaunchResult(LaunchOutcome.completed, proof: {'razorpay_payment_id':
///      r.paymentId, 'razorpay_order_id': r.orderId, 'razorpay_signature':
///      r.signature})`; on the error callback return `failed` with the message;
///     if the customer closes it, return `cancelled`.
///
/// Nothing here marks an order paid. The payment page sends the proof to the
/// server, which verifies the signature and asks the gateway before it agrees.
class GatewayLauncher implements PaymentLauncher {
  @override
  Future<LaunchResult> launch(
    BuildContext context,
    PaymentSession session,
  ) async => LaunchResult(
    LaunchOutcome.failed,
    message:
        'This build does not include the ${session.provider} checkout yet. Real payments are not enabled.',
  );
}
