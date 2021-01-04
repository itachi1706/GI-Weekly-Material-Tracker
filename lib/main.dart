import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:get/get_navigation/src/root/get_material_app.dart';
import 'package:gi_weekly_material_tracker/bottomnav.dart';
import 'package:gi_weekly_material_tracker/placeholder.dart';
import 'package:gi_weekly_material_tracker/login.dart';

void main() {
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GetMaterialApp(
      title: 'GI Weekly Tracker',
      theme: ThemeData(
        primarySwatch: Colors.green,
      ),
      initialRoute: '/',
      getPages: [
        GetPage(
            name: '/',
            page: () => LoginPage(
                  title: 'Login',
                )),
        GetPage(name: '/placeholder', page: () => PlaceholderPage()),
        GetPage(
            name: '/menu',
            page: () => MainNavigationPage(
                  title: 'GI Materials Tracker',
                )),
      ],
    );
  }
}
