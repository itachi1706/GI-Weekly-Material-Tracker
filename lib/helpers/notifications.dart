import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/placeholder.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:timezone/data/latest.dart' as tz;
import 'package:timezone/timezone.dart' as tz;

class NotificationManager {
  static NotificationManager? _instance;
  FlutterLocalNotificationsPlugin? _plugin;
  bool _appLaunch = false;

  NotificationManager() {
    _plugin = null;
    debugPrint('Notification Manager Created');
  }

  static NotificationManager? getInstance() {
    _instance ??= NotificationManager();

    return _instance;
  }

  Future<void> processNotificationAppLaunch() async {
    if (_appLaunch) return; // Run once
    _appLaunch = true;
    var appLaunchDetails = await _plugin!.getNotificationAppLaunchDetails();
    if (appLaunchDetails == null) return; // macOS 10.14 and before
    if (appLaunchDetails.didNotificationLaunchApp) {
      await selectNotification(appLaunchDetails.notificationResponse);
    }
  }

  Future<void> initialize() async {
    _plugin = FlutterLocalNotificationsPlugin();

    const initializationSettingsAndroid =
        AndroidInitializationSettings('splash');
    final initializationSettingsIOS = DarwinInitializationSettings(
      onDidReceiveLocalNotification: onDidReceiveLocalNotification,
      requestSoundPermission: true,
      requestBadgePermission: true,
      requestAlertPermission: true,
    );
    final initializationSettings = InitializationSettings(
      android: initializationSettingsAndroid,
      iOS: initializationSettingsIOS,
    );
    await _plugin!.initialize(
      initializationSettings,
      onDidReceiveNotificationResponse: selectNotification,
    );

    tz.initializeTimeZones();
    tz.setLocalLocation(tz.getLocation('Asia/Singapore'));

    debugPrint('Initializing Notification Manager');
  }

  void onDidReceiveLocalNotification(
    int id,
    String? title,
    String? body,
    String? payload,
  ) {
    PlaceholderUtil.showUnimplementedSnackbar(Get.context!);
  }

  Future rescheduleAllScheduledReminders() async {
    debugPrint('Rescheduling all scheduled reminders');
    var pref = await Util.getSharedPreferenceInstance();
    await scheduleDailyForumReminder(pref.getBool('daily_login') ?? false);
    await scheduleParametricReminder(
      pref.getBool('parametric_notification') ?? false,
    );
    debugPrint('Scheduled Reminders rescheduled');
  }

  Future selectNotification(NotificationResponse? response) async {
    if (response != null) {
      debugPrint('notification payload: $response');
      switch (response.payload) {
        case 'parametric-weekly':
          await Get.toNamed('/parametric');
          break;
        case 'forum-login':
          var pref = await Util.getSharedPreferenceInstance();
          await Util.launchWebPage(
            'https://webstatic-sea.mihoyo.com/ys/event/signin-sea/index.html?act_id=e202102251931481&lang=en-us',
            useDeepLink: pref.getBool('deeplinkEnabled') ?? false,
            deepLink:
                'hoyolab://webview?link=https%3A%2F%2Fact.hoyolab.com%2Fys%2Fevent%2Fsignin-sea-v3%2Findex.html%3Fact_id%3De202102251931481%26hyl_auth_required%3Dtrue%26hyl_presentation_style%3Dfullscreen&adjust_reftag=caSnGrq7Audpt',
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
      await _plugin!
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()!
          .deleteNotificationChannel(channelId);
      if (!silent) {
        Util.showSnackbarQuick(Get.context!, 'Notification Channel deleted');
      } else {
        debugPrint('Notification Channel $channelId deleted');
      }
    }
  }

  Future<String> getScheduledReminders() async {
    var result = '';
    var pendingRequests = await _plugin!.pendingNotificationRequests();
    if (pendingRequests.isEmpty) {
      result = 'No Pending Notifications';
    } else {
      for (var element in pendingRequests) {
        result +=
            '${element.id}|${element.title}|${element.body}|${element.payload}\n';
      }
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

  List<dynamic> getParametricTransformerMessages() {
    return [
      1002,
      'Your Parametric Transformer is Ready!',
      'Click to view the reminder page in the app',
    ];
  }

  Future<void> resetScheduledIfNotInUse() async {
    if (kIsWeb || !GetPlatform.isAndroid) return;

    var pref = await Util.getSharedPreferenceInstance();

    if (pref.containsKey('daily_login')) {
      var dailyLogin = pref.getBool('daily_login') ?? false;
      if (!dailyLogin) {
        removeNotificationChannel('notify_forum', silent: true);
      }
    }

    if (pref.containsKey('parametric_notification')) {
      var paraNotification = pref.getBool('parametric_notification') ?? false;
      if (!paraNotification) {
        removeNotificationChannel('notify_parametric', silent: true);
      }
    }

    // Remove old channel
    removeNotificationChannel('scheduled_notify', silent: true);
  }

  Future<bool> scheduleParametricReminder(
    bool toEnable, {
    bool resetNotificationChannel = false,
  }) async {
    var data = getParametricTransformerMessages();
    await _plugin!.cancel(data[0], tag: 'weekly_parametric');
    debugPrint('Deleted Parametric Transformer Reminder');

    if (resetNotificationChannel) {
      await resetScheduledIfNotInUse();
    }

    // Get from preference
    var prefs = await Util.getSharedPreferenceInstance();
    var resetTime = -1;
    if (prefs.containsKey('parametric-reset-time')) {
      resetTime = prefs.getInt('parametric-reset-time') ?? -1;
    }

    var currentTime = tz.TZDateTime.now(tz.local).millisecondsSinceEpoch;
    debugPrint('Now (ms): $currentTime | Reset (ms): $resetTime');

    // Prevent creating reminder if reminder time is before current time (aka its over)
    if (toEnable && resetTime > 0) {
      debugPrint('Parametric Reminder Enabled. Calculating reminder time');
      var remindTime =
          tz.TZDateTime.fromMillisecondsSinceEpoch(tz.local, resetTime)
              .add(const Duration(days: 6, hours: 22));
      debugPrint('Remind (ms): ${remindTime.millisecondsSinceEpoch}');
      if (remindTime.millisecondsSinceEpoch > currentTime) {
        debugPrint('Scheduling Parametric Transformer Reminder');

        if (GetPlatform.isAndroid && !(await _hasNotificationPermission())) {
          _showNotificationRequirementRationale();
          return false;
        }

        await _plugin!.zonedSchedule(
          data[0],
          data[1],
          data[2],
          remindTime,
          craftParametricTransformerReminder(),
          uiLocalNotificationDateInterpretation:
              UILocalNotificationDateInterpretation.absoluteTime,
          payload: 'parametric-weekly',
          androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        );
      } else {
        debugPrint(
          'Reminder Time is before current time. Aborting scheduling of reminder',
        );
      }
    }

    return true;
  }

  Future<bool> scheduleDailyForumReminder(
    bool toEnable, {
    bool resetNotificationChannel = false,
  }) async {
    var data = getDailyCheckInMessages();
    await _plugin!.cancel(data[0], tag: 'daily_forum');
    debugPrint('Deleted Daily Forum Reminder');

    if (resetNotificationChannel) {
      await resetScheduledIfNotInUse();
    }

    if (toEnable) {
      debugPrint('Scheduling Daily Forum Reminder');

      if (GetPlatform.isAndroid && !(await _hasNotificationPermission())) {
        _showNotificationRequirementRationale();

        return false;
      }

      await _plugin!.zonedSchedule(
        data[0],
        data[1],
        data[2],
        _nextInstanceOfMidnight(),
        craftDailyForumReminder(),
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
        matchDateTimeComponents: DateTimeComponents.time,
        payload: 'forum-login',
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      );
    }

    return true;
  }

  void _showNotificationRequirementRationale() {
    debugPrint('No permission. Aborting');
    // Show alert
    Util.showSnackbarQuick(
      Get.context!,
      'Please enable notifications for this app in your phone settings',
    );
  }

  NotificationDetails craftParametricTransformerReminder() {
    const androidNotificationDetails = AndroidNotificationDetails(
      'notify_parametric',
      'Parametric Transformer Notification',
      channelDescription: 'Channel related to parametric transformer',
      color: Colors.deepOrange,
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
      channelDescription: 'Scheduled daily reminder on forum',
      color: Colors.deepOrange,
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
    String? payload,
  }) async {
    await _plugin!.show(
      data[0],
      data[1],
      data[2],
      notificationDetails,
      payload: (payload != null) ? payload : null,
    );
  }

  Future<bool> _hasNotificationPermission() async {
    debugPrint('Ensuring we have permissions');
    if (_plugin == null) return false;

    var isEnabled = await _checkIfNotificationEnabled();
    if (!isEnabled) {
      debugPrint('Requesting Notification Permission');
      await _plugin!
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.requestNotificationsPermission();
    }

    debugPrint('Notifications Enabled: $isEnabled');

    // Check again
    return await _checkIfNotificationEnabled();
  }

  Future<bool> _checkIfNotificationEnabled() async {
    if (_plugin == null) return false;

    return await _plugin!
            .resolvePlatformSpecificImplementation<
                AndroidFlutterLocalNotificationsPlugin>()
            ?.areNotificationsEnabled() ??
        false;
  }

  tz.TZDateTime _nextInstanceOfMidnight() {
    final now = tz.TZDateTime.now(tz.local); // 12AM GMT+8
    var scheduledDate =
        tz.TZDateTime(tz.local, now.year, now.month, now.day, 0);
    if (scheduledDate.isBefore(now)) {
      scheduledDate = scheduledDate.add(const Duration(days: 1));
    }
    debugPrint('Now: $now | Scheduled: $scheduledDate');

    return scheduledDate;
  }
}
