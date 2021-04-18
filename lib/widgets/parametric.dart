import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:date_time_picker/date_time_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_countdown_timer/flutter_countdown_timer.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/placeholder.dart';
import 'package:gi_weekly_material_tracker/util.dart';
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
        actions: [
          IconButton(
              icon: Icon(Icons.settings),
              tooltip: 'Settings',
              onPressed: () => Get.toNamed('/settings')),
        ],
      ),
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
                TextButton(onPressed: _resetTime, child: Text('Reset Time')),
                TextButton(
                    onPressed: _showLastUseDialog,
                    child: Text('Set Last Use Time')),
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
            TextButton(onPressed: _noOp, child: Text('Launch Game')),
          ],
        ),
      ),
    );
  }

  Widget _getNotificationState() {
    if (_prefs == null) return Text('Loading...');

    var notifyParametric = _prefs.getBool('parametric_notification') ?? false;
    if (notifyParametric)
      return Text(
        'Enabled',
        style: TextStyle(color: Colors.green),
      );

    return Text('Disabled', style: TextStyle(color: Colors.red));
  }

  Widget _countdownTimer() {
    if (_endTimeCountdown == -1)
      return Padding(
        padding: const EdgeInsets.only(top: 16),
        child: Util.centerLoadingCircle(''),
      );

    return CountdownTimer(
      endTime: _endTimeCountdown,
      endWidget: Text(
        'READY!',
        style: TextStyle(
            fontWeight: FontWeight.bold, color: Colors.red, fontSize: 32),
      ),
      textStyle: TextStyle(fontWeight: FontWeight.bold, fontSize: 32),
    );
  }

  void _getResetTime() async {
    var uid = Util.getFirebaseUid();
    var data = await _db.collection('userdata').doc(uid).get();
    var epochTime = DateTime.now().millisecondsSinceEpoch;
    var lastResetStr = 'Unknown';
    if (data.exists) {
      var map = data.data();
      if (map.containsKey('parametricReset')) {
        var dt = DateTime.fromMillisecondsSinceEpoch(map['parametricReset']);
        lastResetStr = DateFormat('yyyy-MM-dd HH:mm').format(dt);
        dt = dt.add(Duration(days: 7));
        epochTime = dt.millisecondsSinceEpoch;
      }
    }
    var pref = await SharedPreferences.getInstance();
    setState(() {
      _endTimeCountdown = epochTime;
      _resetTimeString = lastResetStr;
      _prefs = pref;
    });
  }

  void _noOp() {
    PlaceholderUtil.showUnimplementedSnackbar(context);
  }

  void _updateOnlineData(String resetTime) async {
    var uid = Util.getFirebaseUid();
    var data = {
      'parametricReset': DateTime.parse(resetTime).millisecondsSinceEpoch
    };
    await _db
        .collection('userdata')
        .doc(uid)
        .set(data, SetOptions(merge: true));
    print('Updated Database with new reset time');
  }

  void _updateNewEndTime(String resetTime) {
    setState(() {
      _endTimeCountdown = DateTime.parse(_newDateTime)
          .add(Duration(days: 7))
          .millisecondsSinceEpoch;
      _resetTimeString = resetTime;
    });
  }

  void _resetTime() {
    _newDateTime = DateFormat('yyyy-MM-dd HH:mm').format(DateTime.now());
    print('_resetTime: $_newDateTime');
    // TODO: Update notification if any
    _updateNewEndTime(_newDateTime);
    _updateOnlineData(_newDateTime);
  }

  void _updateLastUseTime() {
    print('_updateLastUseTime: $_newDateTime');
    // TODO: Update notification if any
    _updateNewEndTime(_newDateTime);
    _updateOnlineData(_newDateTime);
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
