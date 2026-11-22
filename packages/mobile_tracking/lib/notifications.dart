import 'dart:async';
import 'package:flutter/material.dart';
import 'package:pista_core/pista_core.dart';

const _green = Color(0xFF073B29);
const _gold = Color(0xFFB69B60);
const _cream = Color(0xFFFBF3E8);

String notificationAge(String iso) {
  final t = DateTime.tryParse(iso)?.toLocal();
  if (t == null) return '';
  final d = DateTime.now().difference(t);
  if (d.inMinutes < 1) return 'just now';
  if (d.inMinutes < 60) return '${d.inMinutes} min ago';
  if (d.inHours < 24) return '${d.inHours} h ago';
  return '${d.inDays} d ago';
}

IconData notificationIcon(String kind) {
  if (kind.startsWith('support')) return Icons.support_agent;
  if (kind.startsWith('refund')) return Icons.currency_rupee;
  if (kind.startsWith('rider') || kind.startsWith('delivery')) {
    return Icons.delivery_dining_outlined;
  }
  if (kind.startsWith('staff')) return Icons.receipt_long_outlined;
  if (kind.startsWith('order')) return Icons.restaurant_outlined;
  return Icons.notifications_none;
}

/// A bell with an unread badge. It checks for new alerts while the app is open
/// and shows a short banner when one arrives. A closed app is only woken by
/// push (see docs/notifications.md).
class NotificationBell extends StatefulWidget {
  final PistaApi api;

  /// Called with the notification when someone taps it in the inbox.
  final void Function(Map<String, dynamic> item)? onOpenItem;

  /// Show the reminder/promotion switches (customers only).
  final bool showSettings;
  final Duration every;
  final Color? color;
  const NotificationBell({
    super.key,
    required this.api,
    this.onOpenItem,
    this.showSettings = false,
    this.every = const Duration(seconds: 30),
    this.color,
  });
  @override
  State<NotificationBell> createState() => _NotificationBellState();
}

class _NotificationBellState extends State<NotificationBell> {
  int unread = 0;
  Timer? _timer;
  bool _busy = false, _first = true;

  @override
  void initState() {
    super.initState();
    check();
    _timer = Timer.periodic(widget.every, (_) => check());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> check() async {
    if (_busy || widget.api.token == null) return;
    _busy = true;
    try {
      final data = await widget.api.request('/notifications/unread-count');
      final count = (data['count'] as num?)?.toInt() ?? 0;
      final grew = count > unread && !_first;
      _first = false;
      if (!mounted) return;
      setState(() => unread = count);
      if (grew) await _banner();
    } catch (_) {
      // Alerts are a convenience: a failed check must never disturb the screen.
    } finally {
      _busy = false;
    }
  }

  Future<void> _banner() async {
    try {
      final data = await widget.api.request('/notifications?limit=1');
      final items = (data['items'] as List?) ?? const [];
      if (items.isEmpty || !mounted) return;
      final n = Map<String, dynamic>.from(items.first as Map);
      ScaffoldMessenger.maybeOf(context)
        ?..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text('${n['title']}\n${n['body']}'),
            action: SnackBarAction(label: 'View', onPressed: open),
          ),
        );
    } catch (_) {}
  }

  Future<void> open() async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute(
        builder: (_) => NotificationsPage(
          api: widget.api,
          onOpenItem: widget.onOpenItem,
          showSettings: widget.showSettings,
        ),
      ),
    );
    check();
  }

  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: 'Notifications',
    onPressed: open,
    icon: Badge(
      isLabelVisible: unread > 0,
      label: Text(unread > 99 ? '99+' : '$unread'),
      child: Icon(Icons.notifications_none, color: widget.color),
    ),
  );
}

/// The inbox: every alert, newest first, with "mark all read" and, for
/// customers, the choice of which reminders and offers they want.
class NotificationsPage extends StatefulWidget {
  final PistaApi api;
  final void Function(Map<String, dynamic> item)? onOpenItem;
  final bool showSettings;
  const NotificationsPage({
    super.key,
    required this.api,
    this.onOpenItem,
    this.showSettings = false,
  });
  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List<Map<String, dynamic>>? items;
  Map<String, dynamic>? prefs;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final data = await widget.api.request('/notifications?limit=100');
      Map<String, dynamic>? p;
      if (widget.showSettings) {
        p = Map<String, dynamic>.from(
          await widget.api.request('/notifications/preferences') as Map,
        );
      }
      if (!mounted) return;
      setState(() {
        items = ((data['items'] as List?) ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        prefs = p;
        error = null;
      });
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    }
  }

  Future<void> markAll() async {
    try {
      await widget.api.request(
        '/notifications/read',
        method: 'POST',
        body: <String, dynamic>{},
      );
      await load();
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    }
  }

  Future<void> tap(Map<String, dynamic> n) async {
    final wasRead = n['read'] == true;
    if (!wasRead) {
      setState(() => n['read'] = true);
      try {
        await widget.api.request(
          '/notifications/${n['id']}/open',
          method: 'POST',
        );
      } catch (_) {}
    }
    if (!mounted) return;
    widget.onOpenItem?.call(n);
  }

  Future<void> setPref(String key, bool value) async {
    final before = prefs?[key];
    setState(() => prefs = {...?prefs, key: value});
    try {
      final saved = await widget.api.request(
        '/notifications/preferences',
        method: 'PUT',
        body: {key: value},
      );
      if (mounted) setState(() => prefs = Map<String, dynamic>.from(saved));
    } catch (e) {
      if (mounted) {
        setState(() {
          prefs = {...?prefs, key: before};
          error = '$e';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final list = items;
    return Scaffold(
      backgroundColor: _cream,
      appBar: AppBar(
        backgroundColor: _cream,
        title: const Text('Notifications'),
        actions: [
          TextButton(onPressed: markAll, child: const Text('Mark all read')),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            if (error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(error!, style: const TextStyle(color: Colors.red)),
              ),
            if (prefs != null) _settings(),
            if (list == null && error == null)
              const Padding(
                padding: EdgeInsets.all(32),
                child: Center(child: CircularProgressIndicator()),
              ),
            if (list != null && list.isEmpty)
              const Padding(
                padding: EdgeInsets.all(32),
                child: Center(
                  child: Text('Nothing yet. Updates will show up here.'),
                ),
              ),
            for (final n in list ?? const <Map<String, dynamic>>[]) _tile(n),
          ],
        ),
      ),
    );
  }

  Widget _settings() => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          SwitchListTile(
            value: prefs!['reminders'] == true,
            onChanged: (v) => setPref('reminders', v),
            title: const Text('Reminders'),
            subtitle: const Text(
              'A nudge about your usual order or a forgotten cart',
            ),
          ),
          SwitchListTile(
            value: prefs!['promotions'] == true,
            onChanged: (v) => setPref('promotions', v),
            title: const Text('Offers and suggestions'),
            subtitle: const Text(
              'Occasional ideas. Never between 10 pm and 8 am. Order updates always come through.',
            ),
          ),
        ],
      ),
    ),
  );

  Widget _tile(Map<String, dynamic> n) {
    final unread = n['read'] != true;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: unread ? Colors.white : Colors.white70,
        borderRadius: BorderRadius.circular(16),
        child: ListTile(
          key: ValueKey('notification-${n['id']}'),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          leading: CircleAvatar(
            backgroundColor: unread ? _green : Colors.black12,
            child: Icon(
              notificationIcon('${n['kind']}'),
              color: unread ? _gold : Colors.black45,
              size: 20,
            ),
          ),
          title: Text(
            '${n['title']}',
            style: TextStyle(
              fontWeight: unread ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
          subtitle: Text(
            '${n['body']}\n${notificationAge('${n['createdAt']}')}',
          ),
          isThreeLine: true,
          onTap: () => tap(n),
        ),
      ),
    );
  }
}
