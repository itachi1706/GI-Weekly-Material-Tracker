import 'package:flutter/material.dart';
import 'package:get/get.dart';
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
import 'package:gi_weekly_material_tracker/widgets/wishbanners.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  MyAppState createState() => MyAppState();
}

class MyAppState extends State<MyApp> {
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
        colorScheme: const ColorScheme.dark().copyWith(
          primary: Colors.deepOrange,
          secondary: Colors.deepOrange,
        ),
        fontFamily: 'Product-Sans',
      ),
      themeMode: _theme,
      initialRoute: '/splash',
      unknownRoute: GetPage(name: '/splash', page: () => const SplashPage()),
      getPages: [
        GetPage(name: '/splash', page: () => const SplashPage()),
        GetPage(name: '/', page: () => const LoginPage()),
        GetPage(name: '/placeholder', page: () => const PlaceholderPage()),
        GetPage(name: '/menu', page: () => const TransitionPage()),
        GetPage(
          name: '/tracking',
          page: () => const TrackingPage(
            title: 'GI Materials Tracker',
          ),
          transition: Transition.noTransition,
        ),
        GetPage(
          name: '/dictionary',
          page: () => const DictionaryPage(),
          transition: Transition.noTransition,
        ),
        GetPage(
          name: '/materials/:material',
          page: () => const MaterialInfoPage(),
        ),
        GetPage(
          name: '/characters/:character',
          page: () => const CharacterInfoMainPage(),
        ),
        GetPage(name: '/weapons/:weapon', page: () => const WeaponInfoPage()),
        GetPage(name: '/globalTracking', page: () => GlobalTrackingPage()),
        GetPage(
          name: '/globalMaterial/:materialKey',
          page: () => const GlobalMaterialPage(),
        ),
        GetPage(name: '/settings', page: () => const SettingsPage()),
        GetPage(
          name: '/parametric',
          page: () => const ParametricPage(),
          transition: Transition.noTransition,
        ),
        GetPage(
          name: '/promos',
          page: () => const PromoCodePage(),
          transition: Transition.noTransition,
        ),
        GetPage(
          name: '/bannerinfo',
          page: () => const WishListPage(),
          transition: Transition.noTransition,
        ),
        GetPage(
          name: '/bannerinfo/:type/:index',
          page: () => const BannerInfoPage(),
        ),
      ],
    );
  }
}

class TransitionPage extends StatelessWidget {
  const TransitionPage({Key? key}) : super(key: key);

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
