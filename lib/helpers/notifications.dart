import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:get/get.dart';
import 'package:get/get_utils/src/platform/platform.dart';
import 'package:gi_weekly_material_tracker/placeholder.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/data/latest.dart' as tz;
import 'package:timezone/timezone.dart' as tz;

class NotificationManager {
  static NotificationManager _instance;
  FlutterLocalNotificationsPlugin _plugin;
  bool _appLaunch = false;

  NotificationManager() {
    _plugin = null;
    print('Notification Manager Created');
  }

  static NotificationManager getInstance() {
    _instance ??= NotificationManager();

    return _instance;
  }

  Future<void> processNotificationAppLaunch() async {
    if (_appLaunch) return; // Run once
    _appLaunch = true;
    var appLaunchDetails = await _plugin.getNotificationAppLaunchDetails();
    if (appLaunchDetails.didNotificationLaunchApp) {
      await selectNotification(appLaunchDetails.payload);
    }
  }

  Future<void> initialize() async {
    _plugin = FlutterLocalNotificationsPlugin();

    const initializationSettingsAndroid =
        AndroidInitializationSettings('splash');
    final initializationSettingsIOS = IOSInitializationSettings(
      onDidReceiveLocalNotification: onDidReceiveLocalNotification,
      requestSoundPermission: true,
      requestBadgePermission: true,
      requestAlertPermission: true,
    );
    final initializationSettings = InitializationSettings(
      android: initializationSettingsAndroid,
      iOS: initializationSettingsIOS,
    );
    await _plugin.initialize(
      initializationSettings,
      onSelectNotification: selectNotification,
    );

    tz.initializeTimeZones();
    tz.setLocalLocation(tz.getLocation('Asia/Singapore'));

    print('Initializing Notification Manager');
  }

  Future onDidReceiveLocalNotification(
    int id,
    String title,
    String body,
    String payload,
  ) async {
    PlaceholderUtil.showUnimplementedSnackbar(Get.context);
  }

  Future rescheduleAllScheduledReminders() async {
    print('Rescheduling all scheduled reminders');
    var pref = await SharedPreferences.getInstance();
    await scheduleDailyForumReminder(pref.getBool('daily_login') ?? false);
    await scheduleParametricReminder(
      pref.getBool('parametric_notification') ?? false,
    );
    print('Scheduled Reminders rescheduled');
  }

  Future selectNotification(String payload) async {
    if (payload != null) {
      debugPrint('notification payload: $payload');
      switch (payload) {
        case 'parametric-weekly':
          await Get.toNamed('/parametric');
          break;
        case 'forum-login':
          await Util.launchWebPage(
            'https://webstatic-sea.mihoyo.com/ys/event/signin-sea/index.html?act_id=e202102251931481&lang=en-us',
          );
          // Open page to forum
          break;
      }
    }
  }

  void removeNotificationChannel(
    String channelId, {
    bool silent = false,
  }) async {
    if (GetPlatform.isAndroid) {
      await _plugin
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          .deleteNotificationChannel(channelId);
      if (!silent) {
        Util.showSnackbarQuick(Get.context, 'Notification Channel deleted');
      } else {
        print('Notification Channel $channelId deleted');
      }
    }
  }

  Future<String> getScheduledReminders() async {
    var result = '';
    var pendingRequests = await _plugin.pendingNotificationRequests();
    if (pendingRequests.isEmpty) {
      result = 'No Pending Notifications';
    } else {
      pendingRequests.forEach((element) {
        result +=
            '${element.id}|${element.title}|${element.body}|${element.payload}\n';
      });
    }

    return result;
  }

  List<dynamic> getDailyCheckInMessages() {
    return [
      1001,
      'Claim your Genshin Impact Daily Check In',
      'Click to open the webpage',
    ];
  }

  List<dynamic> getParametricTransformerMesssages() {
    return [
      1002,
      'Your Parametric Transformer is Ready!',
      'Click to view the reminder page in the app',
    ];
  }

  Future<void> resetScheduledIfNotInUse() async {
    if (kIsWeb || !GetPlatform.isAndroid) return;

    var pref = await SharedPreferences.getInstance();

    if (pref.containsKey('daily_login')) {
      var dailyLogin = pref.getBool('daily_login') ?? false;
      if (!dailyLogin) {
        removeNotificationChannel('notify_forum', silent: true);
      }
    }

    if (pref.containsKey('parametric_notification')) {
      var paraNotif = pref.getBool('parametric_notification') ?? false;
      if (!paraNotif) {
        removeNotificationChannel('notify_parametric', silent: true);
      }
    }

    // Remove old channel
    removeNotificationChannel('scheduled_notify', silent: true);
  }

  Future<void> scheduleParametricReminder(
    bool toEnable, {
    bool resetNotificationChannel = false,
  }) async {
    var data = getParametricTransformerMesssages();
    await _plugin.cancel(data[0], tag: 'weekly_parametric');
    print('Deleted Parametric Transformer Reminder');

    if (resetNotificationChannel) {
      await resetScheduledIfNotInUse();
    }

    // Get from preference
    var prefs = await SharedPreferences.getInstance();
    var resetTime = -1;
    if (prefs.containsKey('parametric-reset-time')) {
      resetTime = prefs.getInt('parametric-reset-time') ?? -1;
    }

    var currentTime = tz.TZDateTime.now(tz.local).millisecondsSinceEpoch;
    print('Now (ms): $currentTime | Reset (ms): $resetTime');

    // Prevent creating reminder if reminder time is before current time (aka its over)
    if (toEnable && resetTime > 0) {
      print('Parametric Reminder Enabled. Calculating reminder time');
      var remindTime =
          tz.TZDateTime.fromMillisecondsSinceEpoch(tz.local, resetTime)
              .add(Duration(days: 6, hours: 22));
      print('Remind (ms): ${remindTime.millisecondsSinceEpoch}');
      if (remindTime.millisecondsSinceEpoch > currentTime) {
        print('Scheduling Parametric Transformer Reminder');
        await _plugin.zonedSchedule(
          data[0],
          data[1],
          data[2],
          remindTime,
          craftParametricTransformerReminder(),
          uiLocalNotificationDateInterpretation:
              UILocalNotificationDateInterpretation.absoluteTime,
          payload: 'parametric-weekly',
          androidAllowWhileIdle: true,
        );
      } else {
        print(
            'Reminder Time is before current time. Aborting scheduling of reminder');
      }
    }
  }

  Future<void> scheduleDailyForumReminder(
    bool toEnable, {
    bool resetNotificationChannel = false,
  }) async {
    var data = getDailyCheckInMessages();
    await _plugin.cancel(data[0], tag: 'daily_forum');
    print('Deleted Daily Forum Reminder');

    if (resetNotificationChannel) {
      await resetScheduledIfNotInUse();
    }

    if (toEnable) {
      print('Scheduling Daily Forum Reminder');
      await _plugin.zonedSchedule(
        data[0],
        data[1],
        data[2],
        _nextInstanceOfMidnight(),
        craftDailyForumReminder(),
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
        matchDateTimeComponents: DateTimeComponents.time,
        payload: 'forum-login',
        androidAllowWhileIdle: true,
      );
    }
  }

  NotificationDetails craftParametricTransformerReminder() {
    const androidNotificationDetails = AndroidNotificationDetails(
      'notify_parametric',
      'Parametric Transformer Notification',
      'Channel related to parametric transformer',
      priority: Priority.high,
      importance: Importance.high,
      showWhen: true,
      playSound: true,
      enableLights: true,
      enableVibration: true,
      sound: RawResourceAndroidNotificationSound('xpup'),
      autoCancel: true,
      tag: 'weekly_parametric',
    );

    const platformChannelSpecifics =
        NotificationDetails(android: androidNotificationDetails);

    return platformChannelSpecifics;
  }

  NotificationDetails craftDailyForumReminder() {
    const androidNotificationDetails = AndroidNotificationDetails(
      'notify_forum',
      'Forum Notification',
      'Scheduled daily reminder on forum',
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
    const platformChannelSpecifics =
        NotificationDetails(android: androidNotificationDetails);

    return platformChannelSpecifics;
  }

  Future<void> showNotification(
    List<dynamic> data,
    NotificationDetails notificationDetails, {
    String payload,
  }) async {
    await _plugin.show(
      data[0],
      data[1],
      data[2],
      notificationDetails,
      payload: (payload != null) ? payload : null,
    );
  }

  tz.TZDateTime _nextInstanceOfMidnight() {
    final now = tz.TZDateTime.now(tz.local); // 12AM GMT+8
    var scheduledDate =
        tz.TZDateTime(tz.local, now.year, now.month, now.day, 0);
    if (scheduledDate.isBefore(now)) {
      scheduledDate = scheduledDate.add(const Duration(days: 1));
    }
    print('Now: $now | Scheduled: $scheduledDate');

    return scheduledDate;
  }
}
