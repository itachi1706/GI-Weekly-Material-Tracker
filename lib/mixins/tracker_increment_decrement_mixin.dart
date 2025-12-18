import 'dart:async';

import 'package:flutter/material.dart';
import 'package:gi_weekly_material_tracker/helpers/tracker.dart';

mixin TrackerIncrementDecrementMixin<T extends StatefulWidget> on State<T> {
  int _currentCount = 0;
  int _step = 1;
  int _tick = 0;
  bool _bulkChange = false;
  Timer? _bulkTimer;

  int get currentCount => _currentCount;

  bool get bulkChange => _bulkChange;

  void startCounter(bool increment, int current, int max) {
    setState(() {
      _bulkChange = true;
      _currentCount = current;
    });
    var maxCnt = max;

    _bulkTimer = Timer.periodic(Duration(milliseconds: 250), (timer) {
      var newCnt = _currentCount;
      if (increment) {
        if (_currentCount >= maxCnt) {
          return;
        }
        newCnt = _currentCount + _step;
        if (newCnt >= maxCnt) newCnt = maxCnt;
      } else {
        if (_currentCount <= 0) {
          return;
        }
        newCnt = _currentCount - _step;
        if (newCnt <= 0) newCnt = 0;
      }

      setState(() {
        _currentCount = newCnt;
        _step = _stepCounterInc();
        _tick++;
      });
    });
  }

  void endCounter(String? key, String? type, int max) {
    _bulkTimer?.cancel();
    TrackingData.setCount(key, type, _currentCount, max);
    setState(() {
      _bulkChange = false;
      _step = 1;
      _tick = 0;
    });
  }

  void incrementData(String key, String? type, int current, int max) {
    TrackingData.incrementCount(key, type, current, max);
  }

  void decrementData(String key, String? type, int current) {
    TrackingData.decrementCount(key, type, current);
  }

  String counterString(int? current, int? max) {
    return _bulkChange ? "$_currentCount/$max" : "$current/$max";
  }

  int _stepCounterInc() {
    var step = _step;
    if (_tick > 5) {
      step = step == 1 ? 2 : (step * 1.5).toInt();
    }

    return step;
  }
}
