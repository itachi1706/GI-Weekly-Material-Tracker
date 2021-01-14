import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemeNotifier with ChangeNotifier {
  static bool _isDark = false;

  ThemeMode currentTheme() {
    return _isDark ? ThemeMode.dark : ThemeMode.light;
  }

  void toggleTheme() async {
    SharedPreferences sp = await SharedPreferences.getInstance();
    _isDark = sp.getBool("dark_mode") ?? false;
    notifyListeners();
  }
}
