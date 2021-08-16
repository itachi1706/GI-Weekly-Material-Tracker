import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:get/get_navigation/src/root/get_material_app.dart';
import 'package:gi_weekly_material_tracker/placeholder.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:gi_weekly_material_tracker/widgets/appsettings.dart';
import 'package:gi_weekly_material_tracker/widgets/characters.dart';
import 'package:gi_weekly_material_tracker/widgets/globaltracking.dart';
import 'package:gi_weekly_material_tracker/widgets/login.dart';
import 'package:gi_weekly_material_tracker/widgets/mainnavs.dart';
import 'package:gi_weekly_material_tracker/widgets/materials.dart';
import 'package:gi_weekly_material_tracker/widgets/parametric.dart';
import 'package:gi_weekly_material_tracker/widgets/promocode.dart';
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
    var accentColorDark = Colors.deepOrangeAccent;

    return GetMaterialApp(
      title: 'GI Weekly Tracker',
      theme: ThemeData(
        primarySwatch: Colors.deepOrange,
        fontFamily: 'Product-Sans',
      ),
      darkTheme: ThemeData(
        primarySwatch: Colors.deepOrange,
        toggleableActiveColor: Colors.deepOrangeAccent,
        accentColor: accentColorDark,
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
          ),
        ),
        GetPage(name: '/placeholder', page: () => PlaceholderPage()),
        GetPage(
          name: '/menu',
          page: () => TransitionPage(),
          // page: () => MainNavigationPage(
          //   title: 'GI Materials Tracker',
          // ),
        ),
        GetPage(
          name: '/tracking',
          page: () => TrackingPage(
            title: 'GI Materials Tracker',
          ),
          transition: Transition.noTransition,
        ),
        GetPage(
          name: '/dictionary',
          page: () => DictionaryPage(),
          transition: Transition.noTransition,
        ),
        GetPage(name: '/materials/:material', page: () => MaterialInfoPage()),
        GetPage(
          name: '/characters/:character',
          page: () => CharacterInfoMainPage(),
        ),
        GetPage(name: '/weapons/:weapon', page: () => WeaponInfoPage()),
        GetPage(name: '/globalTracking', page: () => GlobalTrackingPage()),
        GetPage(
          name: '/globalMaterial/:materialKey',
          page: () => GlobalMaterialPage(),
        ),
        GetPage(name: '/settings', page: () => SettingsPage()),
        GetPage(
          name: '/parametric',
          page: () => ParametricPage(),
          transition: Transition.noTransition,
        ),
        GetPage(
          name: '/promos',
          page: () => PromoCodePage(),
          transition: Transition.noTransition,
        ),
      ],
    );
  }
}

class TransitionPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: _skip(),
      builder: (context, snapshot) {
        return Util.loadingScreen();
      },
    );
  }

  Future<void> _skip() async {
    Util.currentRoute = '/tracking';
    Future.delayed(Duration.zero, () => Get.offAllNamed('/tracking'));

    return;
  }
}
