import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
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
import 'package:gi_weekly_material_tracker/widgets/outfits.dart';
import 'package:gi_weekly_material_tracker/widgets/parametric.dart';
import 'package:gi_weekly_material_tracker/widgets/promocode.dart';
import 'package:gi_weekly_material_tracker/widgets/splash.dart';
import 'package:gi_weekly_material_tracker/widgets/weapons.dart';
import 'package:gi_weekly_material_tracker/widgets/wishbanners.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

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

    _initFirebaseAppCheck();
  }

  void _initFirebaseAppCheck() async {
    try {
      debugPrint('[FIREBASE] Initializing');
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
      debugPrint('[FIREBASE] Initialization Complete!');
      debugPrint('[APP-CHECK] Adding App Check listener');
      await FirebaseAppCheck.instance.activate(
        // Replace this with your actual site key
        webProvider:
            ReCaptchaV3Provider('6Lf1pE4iAAAAAIh8KeeTBcgGR4V23-wdcddd9bWV'),
        androidProvider: (kDebugMode)
            ? AndroidProvider.debug
            : AndroidProvider.playIntegrity,
      );
      FirebaseAppCheck.instance.onTokenChange.listen(
        (token) async {
          debugPrint('[APP-CHECK] App Check Token Updated to: $token');
          var prefs = await SharedPreferences.getInstance();
          await prefs.setString("app_check_token", token ?? "-");
          if (prefs.containsKey("app_check_token_err")) {
            await prefs.remove("app_check_token_err");
          }
        },
        onError: (error) async {
          debugPrint('[APP-CHECK] App Check Error: $error');
          var prefs = await SharedPreferences.getInstance();
          await prefs.setString("app_check_token_err", error);
        },
        onDone: () {
          debugPrint('[APP-CHECK] App Check Done');
        },
        cancelOnError: true,
      );
    } catch (err) {
      debugPrint(err.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    return GetMaterialApp(
      title: 'GI Weekly Tracker',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepOrange),
        fontFamily: 'Product-Sans',
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          brightness: Brightness.dark,
          seedColor: Colors.deepOrange,
        ),
        fontFamily: 'Product-Sans',
      ),
      themeMode: _theme,
      initialRoute: '/splash',
      unknownRoute: GetPage(name: '/splash', page: () => const SplashPage()),
      getPages: [
        GetPage(name: '/splash', page: () => const SplashPage()),
        GetPage(name: '/', page: () => const LoginPage()),
        GetPage(name: '/outfits', page: () => const AllOutfitsPage()),
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
        GetPage(
          name: '/outfits/:outfit',
          page: () => const OutfitInfoMainPage(),
        ),
        GetPage(
          name: '/outfits/:outfit/model',
          page: () => const OutfitModelViewerPage(),
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
  const TransitionPage({super.key});

  Future<void> _skip() async {
    Util.currentDrawerIndex = 0;
    Future.delayed(Duration.zero, () => Get.offAllNamed('/tracking'));

    return;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: _skip(),
      builder: (context, snapshot) {
        return Util.loadingScreen();
      },
    );
  }
}
