import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:get/get_navigation/src/root/get_material_app.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:gi_weekly_material_tracker/widgets//bottomnav.dart';
import 'package:gi_weekly_material_tracker/placeholder.dart';
import 'package:gi_weekly_material_tracker/widgets/appsettings.dart';
import 'package:gi_weekly_material_tracker/widgets/characters.dart';
import 'package:gi_weekly_material_tracker/widgets/globaltracking.dart';
import 'package:gi_weekly_material_tracker/widgets/login.dart';
import 'package:gi_weekly_material_tracker/widgets/materials.dart';
import 'package:gi_weekly_material_tracker/widgets/splash.dart';
import 'package:gi_weekly_material_tracker/widgets/weapons.dart';

void main() {
  runApp(MyApp());
}

class MyApp extends StatefulWidget {
  @override
  _MyAppState createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  ThemeMode _theme = Util.themeNotifier.currentTheme();

  @override
  void initState() {
    super.initState();
    Util.themeNotifier.toggleTheme();
    Util.themeNotifier.addListener(() {
      setState(() {
        _theme = Util.themeNotifier.currentTheme();
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return GetMaterialApp(
      title: 'GI Weekly Tracker',
      theme: ThemeData(
        primarySwatch: Colors.deepOrange,
        fontFamily: 'Product-Sans',
      ),
      darkTheme: ThemeData(
        primarySwatch: Colors.deepOrange,
        toggleableActiveColor: Colors.deepOrangeAccent,
        accentColor: Colors.deepOrangeAccent,
        colorScheme: ColorScheme.dark().copyWith(primary: Colors.deepOrange),
        fontFamily: 'Product-Sans',
      ),
      themeMode: _theme,
      initialRoute: '/splash',
      unknownRoute: GetPage(name: '/splash', page: () => SplashPage()),
      getPages: [
        GetPage(name: '/splash', page: () => SplashPage()),
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
        GetPage(name: '/materials/:material', page: () => MaterialInfoPage()),
        GetPage(
            name: '/characters/:character', page: () => CharacterInfoMainPage()),
        GetPage(name: '/weapons/:weapon', page: () => WeaponInfoPage()),
        GetPage(name: '/globalTracking', page: () => GlobalTrackingPage()),
        GetPage(
            name: '/globalMaterial/:materialKey',
            page: () => GlobalMaterialPage()),
        GetPage(name: '/settings', page: () => SettingsPage()),
      ],
    );
  }
}
