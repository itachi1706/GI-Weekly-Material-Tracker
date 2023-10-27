import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_countdown_timer/flutter_countdown_timer.dart';
import 'package:gi_weekly_material_tracker/helpers/notifications.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:gi_weekly_material_tracker/widgets/drawer.dart';
import 'package:intl/intl.dart';
import 'package:omni_datetime_picker/omni_datetime_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';

final FirebaseFirestore _db = FirebaseFirestore.instance;

class ParametricPage extends StatefulWidget {
  const ParametricPage({Key? key}) : super(key: key);

  @override
  ParametricPageState createState() => ParametricPageState();
}

class ParametricPageState extends State<ParametricPage> {
  int _endTimeCountdown = -1;
  String? _resetTimeString = 'Refreshing...';
  SharedPreferences? _prefs;
  String? _newDateTime;

  @override
  void initState() {
    super.initState();
    _getResetTime();
  }

  Widget _getNotificationState() {
    if (_prefs == null) return const Text('Loading...');

    var notifyParametric = _prefs!.getBool('parametric_notification') ?? false;
    if (notifyParametric) {
      return const Text(
        'Enabled',
        style: TextStyle(color: Colors.green),
      );
    }

    return const Text('Disabled', style: TextStyle(color: Colors.red));
  }

  Widget _countdownTimer() {
    if (_endTimeCountdown == -1) {
      return Padding(
        padding: const EdgeInsets.only(top: 16),
        child: Util.centerLoadingCircle(''),
      );
    }

    return CountdownTimer(
      endTime: _endTimeCountdown,
      endWidget: const Text(
        'ITEM READY!',
        style: TextStyle(
          fontWeight: FontWeight.bold,
          color: Colors.red,
          fontSize: 32,
        ),
      ),
      textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 32),
    );
  }

  void _getResetTime() async {
    var uid = Util.getFirebaseUid();
    var data = await _db.collection('userdata').doc(uid).get();
    var epochTime = DateTime.now().millisecondsSinceEpoch;
    var lastResetStr = 'Unknown';
    var pref = await SharedPreferences.getInstance();
    if (data.exists) {
      var map = data.data()!;
      if (map.containsKey('parametricReset')) {
        var dt = DateTime.fromMillisecondsSinceEpoch(map['parametricReset']);
        lastResetStr = DateFormat('yyyy-MM-dd HH:mm').format(dt);
        await pref.setInt('parametric-reset-time', map['parametricReset']);
        dt = dt.add(const Duration(days: 6, hours: 22));
        epochTime = dt.millisecondsSinceEpoch;
        if (!kIsWeb) {
          await NotificationManager.getInstance()!.scheduleParametricReminder(
            pref.getBool('parametric_notification') ?? false,
          );
        }
      }
    }
    setState(() {
      _endTimeCountdown = epochTime;
      _resetTimeString = lastResetStr;
      _prefs = pref;
    });
  }

  void _launchApp() async {
    if (kIsWeb) {
      // Launch the website
      await Util.launchWebPage('https://genshin.mihoyo.com/en/download');
    } else {
      var androidId = 'com.miHoYo.GenshinImpact';
      if (Platform.isAndroid) {
        // Returns a list of only those apps that have launch intent
        // TODO(#1207): Replace device_apps package due to un-maintained
        // var apps = await DeviceApps.getInstalledApplications(
        //   onlyAppsWithLaunchIntent: true,
        // );
        // debugPrint(apps.toString());
        // var isInstalled = await DeviceApps.isAppInstalled(androidId);
        // debugPrint('App Installed: $isInstalled');
        // if (isInstalled) {
        //   await DeviceApps.openApp(androidId);
        //
        //   return;
        // }
      } else if (Platform.isLinux ||
          Platform.isFuchsia ||
          Platform.isWindows ||
          Platform.isMacOS) {
        // Not Supported
        Util.showSnackbarQuick(context, "Not Supported on this Platform");

        return;
      }
      // If not installed or iOS, launch app store
      debugPrint('Launching App Store');
      // TODO(#1207): Replace store_redirect package due to un-maintained
      Util.showSnackbarQuick(context, "Currently disabled");
      // await StoreRedirect.redirect(
      //   androidAppId: androidId,
      //   iOSAppId: '1517783697',
      // );
    }
  }

  Future<void> _updateOnlineData(String resetTime) async {
    var uid = Util.getFirebaseUid();
    var time = DateTime.parse(resetTime).millisecondsSinceEpoch;
    var data = {
      'parametricReset': time,
    };
    await _prefs!.setInt('parametric-reset-time', time);
    await _db
        .collection('userdata')
        .doc(uid)
        .set(data, SetOptions(merge: true));
    debugPrint('Updated Database with new reset time');
  }

  void _updateNewEndTime(String? resetTime) {
    setState(() {
      _endTimeCountdown = DateTime.parse(_newDateTime!)
          .add(const Duration(days: 6, hours: 22))
          .millisecondsSinceEpoch;
      _resetTimeString = resetTime;
    });
  }

  Future<void> _updateNotification() async {
    if (kIsWeb) return; // NO-OP for web
    var notifyParametric = _prefs!.getBool('parametric_notification') ?? false;
    await NotificationManager.getInstance()!
        .scheduleParametricReminder(notifyParametric);
  }

  Future<void> _resetTime() async {
    _newDateTime = DateFormat('yyyy-MM-dd HH:mm').format(DateTime.now());
    debugPrint('_resetTime: $_newDateTime');
    _updateNewEndTime(_newDateTime);
    await _updateOnlineData(_newDateTime!);
    await _updateNotification();
  }

  Future<void> _updateLastUseTime() async {
    debugPrint('_updateLastUseTime: $_newDateTime');
    _updateNewEndTime(_newDateTime);
    await _updateOnlineData(_newDateTime!);
    await _updateNotification();
  }

  void _showLastUseDialog() async {
    DateTime dt;
    try {
      dt = DateTime.parse(_resetTimeString ?? '');
    } catch (e) {
      // Format exception. Default to current datetime
      dt = DateTime.now();
    }

    var newDt = await showOmniDateTimePicker(
      context: context,
      initialDate: dt,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
      isShowSeconds: false,
    );

    debugPrint("newDt: $newDt");
    if (newDt != null) {
      _newDateTime = DateFormat('yyyy-MM-dd HH:mm').format(newDt);
      _updateLastUseTime();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Parametric Transformer'),
      ),
      drawer: const DrawerComponent(),
      body: Center(
        child: Column(
          children: [
            Image.asset('assets/images/items/Item_Parametric_Transformer.png'),
            const Text(
              'Refreshing in',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 24),
            ),
            _countdownTimer(),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Spacer(
                  flex: 20,
                ),
                TextButton(
                  onPressed: _resetTime,
                  child: const Text('Reset Time'),
                ),
                const Spacer(),
                TextButton(
                  onPressed: _showLastUseDialog,
                  child: const Text('Set Last Use Time'),
                ),
                const Spacer(
                  flex: 20,
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text('Last updated on $_resetTimeString'),
            ),
            const Spacer(),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                const Text('Notifications: '),
                _getNotificationState(),
              ],
            ),
            TextButton(onPressed: _launchApp, child: const Text('Launch Game')),
          ],
        ),
      ),
    );
  }
}
