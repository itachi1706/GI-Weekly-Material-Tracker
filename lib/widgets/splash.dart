import 'dart:isolate';

import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_performance/firebase_performance.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/helpers/notifications.dart';
import 'package:gi_weekly_material_tracker/util.dart';

import '../firebase_options.dart';

class SplashPage extends StatefulWidget {
  const SplashPage({Key? key}) : super(key: key);

  @override
  SplashPageState createState() => SplashPageState();
}

class SplashPageState extends State<SplashPage> {
  bool _darkMode = true;
  final double _photoSize = 100.0;
  late VoidCallback _listener;

  @override
  void initState() {
    super.initState();
    _login().then(_complete);

    _listener = () {
      setState(() {
        _darkMode = Util.themeNotifier.isDarkMode();
      });
    };

    Util.themeNotifier.addListener(_listener);
  }

  void _complete(String value) {
    Util.themeNotifier.removeListener(_listener);
    Get.offNamed(value);
  }

  Future<void> _setupNotifications() async {
    if (kIsWeb) return; // Return straight away for web as it is not supported
    var manager = NotificationManager.getInstance()!;
    await manager.initialize();
    debugPrint('Initialized Notifications');
    await manager.processNotificationAppLaunch();
    await manager.rescheduleAllScheduledReminders();
  }

  Future<bool> _initFirebase() async {
    try {
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
      await FirebaseAppCheck.instance.activate(
        webRecaptchaSiteKey: '6Lf1pE4iAAAAAIh8KeeTBcgGR4V23-wdcddd9bWV',  // Replace this with your actual site key
        androidProvider: (kDebugMode) ? AndroidProvider.debug : AndroidProvider.safetyNet,
      );
      if (!kIsWeb) {
        var crashHandler = FirebaseCrashlytics.instance;
        var perfHandler = FirebasePerformance.instance;
        if (kDebugMode) {
          await crashHandler.setCrashlyticsCollectionEnabled(false);
          await perfHandler.setPerformanceCollectionEnabled(false);
        } else {
          if (!crashHandler.isCrashlyticsCollectionEnabled) {
            await crashHandler.setCrashlyticsCollectionEnabled(true);
          }
          if (!(await perfHandler.isPerformanceCollectionEnabled())) {
            await perfHandler.setPerformanceCollectionEnabled(true);
          }
          FlutterError.onError = crashHandler.recordFlutterError;
          Isolate.current.addErrorListener(RawReceivePort((pair) async {
            final List<dynamic> errorAndStacktrace = pair;
            await crashHandler.recordError(
              errorAndStacktrace.first,
              errorAndStacktrace.last,
            );
          }).sendPort);
        }
        debugPrint(
          'Firebase Crashlytics: ${crashHandler.isCrashlyticsCollectionEnabled}',
        );
        debugPrint(
          'Firebase Performance: ${await perfHandler.isPerformanceCollectionEnabled()}',
        );
      } else {
        debugPrint('Web Mode, Crashlytics and Performance disabled');
      }
      var auth = FirebaseAuth.instance;
      if (auth.currentUser != null) return true;
    } catch (e) {
      debugPrint(e.toString());
    }

    return false;
  }

  Future<String> _login() async {
    var res = await Future.wait(
      [
        _initFirebase(),
        _setupNotifications(),
        Future.delayed(const Duration(seconds: 2)),
      ],
    );

    return (res[0]) ? '/menu' : '/';
  }

  @override
  Widget build(BuildContext context) {
    debugPrint('Dark Mode: $_darkMode');
    var image = _darkMode
        ? Image.asset('assets/icons/splash/splash_dark.png')
        : Image.asset('assets/icons/splash/splash.png');
    var backgroundColor = _darkMode ? Colors.black : Colors.white;
    var textColor = _darkMode ? Colors.white : Colors.black;

    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: <Widget>[
          Container(
            decoration: BoxDecoration(
              color: backgroundColor,
            ),
          ),
          Column(
            mainAxisAlignment: MainAxisAlignment.start,
            children: <Widget>[
              Expanded(
                flex: 2,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    CircleAvatar(
                      backgroundColor: Colors.transparent,
                      radius: _photoSize,
                      child: Hero(
                        tag: 'splashscreenImage',
                        child: Container(child: image),
                      ),
                    ),
                    const Padding(
                      padding: EdgeInsets.only(top: 10.0),
                    ),
                    Text(
                      'Genshin Impact Weekly Material Tracker',
                      style: TextStyle(
                        color: textColor,
                        fontSize: 20.0,
                        fontFamily: 'Product-Sans-Bold',
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                flex: 1,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: <Widget>[
                    const CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color?>(
                        null,
                      ),
                    ),
                    const Padding(
                      padding: EdgeInsets.only(top: 20.0),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(top: 10.0),
                      child: Text(
                        'Initializing App',
                        style: TextStyle(color: textColor),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
