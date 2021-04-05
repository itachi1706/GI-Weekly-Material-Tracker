import 'package:flutter/cupertino.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:get/get.dart';
import 'package:get/get_utils/src/platform/platform.dart';
import 'package:gi_weekly_material_tracker/placeholder.dart';
import 'package:gi_weekly_material_tracker/util.dart';

class NotificationManager {

  static NotificationManager _instance;
  FlutterLocalNotificationsPlugin _plugin;

  NotificationManager() {
    _plugin = null;
    print('Notification Manager Created');
  }

  static NotificationManager getInstance() {
    _instance ??= NotificationManager();

    return _instance;
  }

  Future<void> initialize() async {
    _plugin = FlutterLocalNotificationsPlugin();

    const initializationSettingsAndroid =
    AndroidInitializationSettings('splash');
    final initializationSettingsIOS =
    IOSInitializationSettings(
      onDidReceiveLocalNotification: onDidReceiveLocalNotification,);
    final initializationSettings = InitializationSettings(
      android: initializationSettingsAndroid,
      iOS: initializationSettingsIOS,);
    await _plugin.initialize(initializationSettings,
      onSelectNotification: selectNotification,);

    print('Initializing Notification Manager');
  }

  Future onDidReceiveLocalNotification(int id, String title, String body,
      String payload) async {
    PlaceholderUtil.showUnimplementedSnackbar(Get.context);
  }

  Future selectNotification(String payload) async {
    if (payload != null) {
      debugPrint('notification payload: $payload');
      switch (payload) {
        case 'forum-login':
          await Util.launchWebPage('https://webstatic-sea.mihoyo.com/ys/event/signin-sea/index.html?act_id=e202102251931481&lang=en-us');
          // Open page to forum
          break;
      }
    }
  }

  void removeNotificationChannel(String channelId) async {
    if (GetPlatform.isAndroid) {
      await _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>().deleteNotificationChannel(channelId);
      Util.showSnackbarQuick(Get.context, 'Notification Channel deleted');
    }
  }

  NotificationDetails craftDailyForumReminder() {
    const androidNotificationDetails = AndroidNotificationDetails(
        'scheduled_notify', 'Scheduled Notification',
        'Channel Concerning Scheduled Notifications',
      priority: Priority.high,
      importance: Importance.high,
      showWhen: true,
      playSound: true,
      enableLights: true,
      enableVibration: true,
      sound: RawResourceAndroidNotificationSound('xpup'),
      autoCancel: true,
      tag: 'daily_forum',
    );
    const platformChannelSpecifics = NotificationDetails(android: androidNotificationDetails);

    return platformChannelSpecifics;
  }

  Future<void> showNotification(int id, String title, String body, NotificationDetails notificationDetails, {String payload}) async {
    await _plugin.show(id, title, body, notificationDetails, payload: (payload != null) ? payload : null);
  }



}