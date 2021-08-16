import 'dart:io';

import 'package:app_installer/app_installer.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:date_time_picker/date_time_picker.dart';
import 'package:device_apps/device_apps.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_countdown_timer/flutter_countdown_timer.dart';
import 'package:gi_weekly_material_tracker/helpers/notifications.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:gi_weekly_material_tracker/widgets/drawer.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

final FirebaseFirestore _db = FirebaseFirestore.instance;

class ParametricPage extends StatefulWidget {
  ParametricPage({Key key}) : super(key: key);

  @override
  _ParametricPageState createState() => _ParametricPageState();
}

class _ParametricPageState extends State<ParametricPage> {
  int _endTimeCountdown = -1;
  String _resetTimeString = 'Refreshing...';
  SharedPreferences _prefs;
  String _newDateTime;

  @override
  void initState() {
    super.initState();
    _getResetTime();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Parametric Transformer'),
      ),
      drawer: DrawerComponent(),
      body: Center(
        child: Column(
          children: [
            Image.asset('assets/images/items/Item_Parametric_Transformer.png'),
            Text(
              'Refreshing in',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 24),
            ),
            _countdownTimer(),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Spacer(
                  flex: 20,
                ),
                TextButton(onPressed: _resetTime, child: Text('Reset Time')),
                Spacer(),
                TextButton(
                  onPressed: _showLastUseDialog,
                  child: Text('Set Last Use Time'),
                ),
                Spacer(
                  flex: 20,
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text('Last updated on $_resetTimeString'),
            ),
            Spacer(),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('Notifications: '),
                _getNotificationState(),
              ],
            ),
            TextButton(onPressed: _launchApp, child: Text('Launch Game')),
          ],
        ),
      ),
    );
  }

  Widget _getNotificationState() {
    if (_prefs == null) return Text('Loading...');

    var notifyParametric = _prefs.getBool('parametric_notification') ?? false;
    if (notifyParametric) {
      return Text(
        'Enabled',
        style: TextStyle(color: Colors.green),
      );
    }

    return Text('Disabled', style: TextStyle(color: Colors.red));
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
      endWidget: Text(
        'ITEM READY!',
        style: TextStyle(
          fontWeight: FontWeight.bold,
          color: Colors.red,
          fontSize: 32,
        ),
      ),
      textStyle: TextStyle(fontWeight: FontWeight.bold, fontSize: 32),
    );
  }

  void _getResetTime() async {
    var uid = Util.getFirebaseUid();
    var data = await _db.collection('userdata').doc(uid).get();
    var epochTime = DateTime.now().millisecondsSinceEpoch;
    var lastResetStr = 'Unknown';
    var pref = await SharedPreferences.getInstance();
    if (data.exists) {
      var map = data.data();
      if (map.containsKey('parametricReset')) {
        var dt = DateTime.fromMillisecondsSinceEpoch(map['parametricReset']);
        lastResetStr = DateFormat('yyyy-MM-dd HH:mm').format(dt);
        await pref.setInt('parametric-reset-time', map['parametricReset']);
        dt = dt.add(Duration(days: 6, hours: 22));
        epochTime = dt.millisecondsSinceEpoch;
        if (!kIsWeb) {
          await NotificationManager.getInstance().scheduleParametricReminder(
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
        var apps = await DeviceApps.getInstalledApplications(
          onlyAppsWithLaunchIntent: true,
        );
        print(apps);
        var isInstalled = await DeviceApps.isAppInstalled(androidId);
        print('App Installed: $isInstalled');
        if (isInstalled) {
          await DeviceApps.openApp(androidId);

          return;
        }
      }
      // If not installed or iOS, launch app store
      await AppInstaller.goStore(
        androidId,
        '1517783697',
      );
    }
  }

  Future<void> _updateOnlineData(String resetTime) async {
    var uid = Util.getFirebaseUid();
    var time = DateTime.parse(resetTime).millisecondsSinceEpoch;
    var data = {
      'parametricReset': time,
    };
    await _prefs.setInt('parametric-reset-time', time);
    await _db
        .collection('userdata')
        .doc(uid)
        .set(data, SetOptions(merge: true));
    print('Updated Database with new reset time');
  }

  void _updateNewEndTime(String resetTime) {
    setState(() {
      _endTimeCountdown = DateTime.parse(_newDateTime)
          .add(Duration(days: 6, hours: 22))
          .millisecondsSinceEpoch;
      _resetTimeString = resetTime;
    });
  }

  Future<void> _updateNotification() async {
    if (kIsWeb) return; // NO-OP for web
    var notifyParametric = _prefs.getBool('parametric_notification') ?? false;
    await NotificationManager.getInstance()
        .scheduleParametricReminder(notifyParametric);
  }

  Future<void> _resetTime() async {
    _newDateTime = DateFormat('yyyy-MM-dd HH:mm').format(DateTime.now());
    print('_resetTime: $_newDateTime');
    _updateNewEndTime(_newDateTime);
    await _updateOnlineData(_newDateTime);
    await _updateNotification();
  }

  Future<void> _updateLastUseTime() async {
    print('_updateLastUseTime: $_newDateTime');
    _updateNewEndTime(_newDateTime);
    await _updateOnlineData(_newDateTime);
    await _updateNotification();
    Navigator.of(context).pop();
  }

  void _showLastUseDialog() async {
    await showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text('Update Last Use Time of Parametric Transformer'),
          content: DateTimePicker(
            type: DateTimePickerType.dateTimeSeparate,
            initialValue: _resetTimeString,
            firstDate: DateTime(2020),
            lastDate: DateTime(2100),
            onChanged: (val) {
              print('onChanged: $val');
              _newDateTime = val;
            },
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text('Cancel'),
            ),
            TextButton(
              onPressed: _updateLastUseTime,
              child: Text('Update'),
            ),
          ],
        );
      },
    );
  }
}
