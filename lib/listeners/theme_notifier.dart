import 'package:flutter/material.dart';
import 'package:gi_weekly_material_tracker/util.dart';

class ThemeNotifier with ChangeNotifier {
  static bool _isDark = false;

  ThemeMode currentTheme() {
    return _isDark ? ThemeMode.dark : ThemeMode.light;
  }

  bool isDarkMode() {
    return _isDark;
  }

  void toggleTheme() async {
    var sp = await Util.getSharedPreferenceInstance();
    _isDark = sp.getBool('dark_mode') ?? false;
    notifyListeners();
  }
}
