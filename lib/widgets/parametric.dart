
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:date_time_picker/date_time_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_countdown_timer/flutter_countdown_timer.dart';
import 'package:gi_weekly_material_tracker/placeholder.dart';
import 'package:gi_weekly_material_tracker/util.dart';

final FirebaseFirestore _db = FirebaseFirestore.instance;

class ParametricPage extends StatefulWidget {

  ParametricPage({Key key}) : super(key: key);

  @override
  _ParametricPageState createState() => _ParametricPageState();
}

class _ParametricPageState extends State<ParametricPage> {

  int _endTimeCountdown = DateTime.now().millisecondsSinceEpoch;
  String _resetTimeString = DateTime.now().toString();


  @override
  void initState() {
    super.initState();

    _getResetTime();
  }

  @override
  Widget build(BuildContext context) {

    return Scaffold(
      appBar: AppBar(
        title: Text('Parametric Reminder Test'),
      ),
      body: Center(
        child: Column(
          children: [
            Image.asset('assets/images/items/Item_Parametric_Transformer.png'),
            Text('Refreshing in', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 24),),
            CountdownTimer(
              endTime: _endTimeCountdown,
              endWidget: Text('Parametric Transformer is now ready!'),
              textStyle: TextStyle(fontWeight: FontWeight.bold, fontSize: 32),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                TextButton(onPressed: _resetTime, child: Text('Reset Time')),
                TextButton(onPressed: _showLastUseDialog, child: Text('Set Last Use Time')),
              ],
            ),
            Spacer(),
            TextButton(onPressed: _noOp, child: Text('Launch Game')),
          ],
        ),
      ),
    );
  }

  void _getResetTime() {
    // TODO: Get last usage time from Firebase
    // TODO: Calculate expiry time
    // TODO: Update state
  }

  void _noOp() {
    PlaceholderUtil.showUnimplementedSnackbar(context);
  }

  void _updateNewEndTime(String resetTime) {
    setState(() {
      _endTimeCountdown = DateTime.parse(_newDateTime).add(Duration(days: 7)).millisecondsSinceEpoch;
      _resetTimeString = resetTime;
    });
  }

  void _resetTime() {
    _newDateTime = DateTime.now().toString();
    print('_resetTime: $_newDateTime');
    // TODO: Update to Firestore DB
    // TODO: Update notification if any
    _updateNewEndTime(_newDateTime);
    _noOp();
  }

  void _updateLastUseTime() {
    print('_updateLastUseTime: $_newDateTime');
    // TODO: Update to Firestore DB
    // TODO: Update notification if any
    _updateNewEndTime(_newDateTime);
    Navigator.of(context).pop();
    _noOp();
  }

  String _newDateTime = DateTime.now().toString();

  void _showLastUseDialog() async {
    await showDialog(context: context,
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