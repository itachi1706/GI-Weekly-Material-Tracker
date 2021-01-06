import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:get/get_navigation/src/root/get_material_app.dart';
import 'package:gi_weekly_material_tracker/widgets//bottomnav.dart';
import 'package:gi_weekly_material_tracker/placeholder.dart';
import 'package:gi_weekly_material_tracker/widgets/characters.dart';
import 'package:gi_weekly_material_tracker/widgets/login.dart';
import 'package:gi_weekly_material_tracker/widgets/materials.dart';

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
        fontFamily: 'Product-Sans',
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
        GetPage(name: '/materials', page: () => MaterialInfoPage()),
        GetPage(name: '/characters', page: () => CharacterInfoPage()),
        GetPage(name: '/weapons', page: () => PlaceholderPage()),
      ],
    );
  }
}
