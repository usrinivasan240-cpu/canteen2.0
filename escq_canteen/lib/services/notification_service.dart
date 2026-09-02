import 'dart:convert';
import 'dart:io';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'package:permission_handler/permission_handler.dart';
import '../config.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._();
  factory NotificationService() => _instance;
  NotificationService._();

  FirebaseMessaging? _fcm;
  final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();
  String? _fcmToken;
  bool _initialized = false;

  String? get fcmToken => _fcmToken;

  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;

    await _requestPermission();
    await _initFirebase();
    await _initLocalNotifications();
  }

  Future<void> _requestPermission() async {
    try {
      if (Platform.isAndroid) {
        final status = await Permission.notification.status;
        if (status.isDenied || status.isPermanentlyDenied) {
          final result = await Permission.notification.request();
          debugPrint('Android notification permission: $result');
        } else {
          debugPrint('Android notification permission already: $status');
        }
      }
    } catch (e) {
      debugPrint('Permission request failed: $e');
    }
  }

  Future<void> _initFirebase() async {
    try {
      await Firebase.initializeApp();
      _fcm = FirebaseMessaging.instance;
      _fcmToken = await _fcm!.getToken();
      debugPrint('FCM Token: $_fcmToken');
      FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
      FirebaseMessaging.onMessageOpenedApp.listen(_handleBackgroundMessage);
    } catch (e) {
      debugPrint('Firebase init failed: $e');
    }
  }

  Future<void> _initLocalNotifications() async {
    try {
      const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
      const initSettings = InitializationSettings(android: androidSettings);
      await _localNotifications.initialize(initSettings, onDidReceiveNotificationResponse: _onNotificationTap);

      const androidChannel = AndroidNotificationChannel(
        'escq_orders',
        'Order Updates',
        description: 'Notifications for order status changes',
        importance: Importance.high,
        playSound: true,
      );
      await _localNotifications
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(androidChannel);
    } catch (e) {
      debugPrint('Local notifications init failed: $e');
    }
  }

  void _onNotificationTap(NotificationResponse response) {
    final payload = response.payload;
    if (payload != null) {
      debugPrint('Notification tapped: $payload');
    }
  }

  void _handleForegroundMessage(RemoteMessage message) {
    final notification = message.notification;
    if (notification != null) {
      _showLocalNotification(
        id: message.hashCode,
        title: notification.title ?? 'Esc(Q)',
        body: notification.body ?? '',
        payload: jsonEncode(message.data),
      );
    }
  }

  void _handleBackgroundMessage(RemoteMessage message) {
    debugPrint('Background message: ${message.messageId}');
  }

  Future<void> _showLocalNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    const androidDetails = AndroidNotificationDetails(
      'escq_orders',
      'Order Updates',
      channelDescription: 'Notifications for order status changes',
      importance: Importance.high,
      priority: Priority.high,
      playSound: true,
      icon: '@mipmap/ic_launcher',
    );
    const details = NotificationDetails(android: androidDetails);
    await _localNotifications.show(id, title, body, details, payload: payload);
  }

  Future<void> sendTokenToServer(String userId) async {
    if (_fcmToken == null) return;
    try {
      await http.post(
        Uri.parse('${AppConfig.apiBase}/api/fcm-token'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'userId': userId, 'fcmToken': _fcmToken}),
      );
    } catch (e) {
      debugPrint('Failed to send FCM token: $e');
    }
  }

  Future<void> showOrderNotification(String title, String body, Map<String, String> data) async {
    _showLocalNotification(
      id: DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title: title,
      body: body,
      payload: jsonEncode(data),
    );
  }
}
