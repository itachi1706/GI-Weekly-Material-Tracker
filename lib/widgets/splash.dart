import 'dart:isolate';

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
  @override
  _SplashPageState createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> {
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

  @override
  Widget build(BuildContext context) {
    debugPrint('Dark Mode: $_darkMode');
    var _image = _darkMode
        ? Image.asset('assets/icons/splash/splash_dark.png')
        : Image.asset('assets/icons/splash/splash.png');
    var _backgroundColor = _darkMode ? Colors.black : Colors.white;
    var _textColor = _darkMode ? Colors.white : Colors.black;

    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: <Widget>[
          Container(
            decoration: BoxDecoration(
              color: _backgroundColor,
            ),
          ),
          Column(
            mainAxisAlignment: MainAxisAlignment.start,
            children: <Widget>[
              Expanded(
                flex: 2,
                child: Container(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      CircleAvatar(
                        backgroundColor: Colors.transparent,
                        radius: _photoSize,
                        child: Hero(
                          tag: 'splashscreenImage',
                          child: Container(child: _image),
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.only(top: 10.0),
                      ),
                      Text(
                        'Genshin Impact Weekly Material Tracker',
                        style: TextStyle(
                          color: _textColor,
                          fontSize: 20.0,
                          fontFamily: 'Product-Sans-Bold',
                        ),
                      ),
                    ],
                  ),
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
                        style: TextStyle(color: _textColor),
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
      if (!kIsWeb) {
        var _crashHandler = FirebaseCrashlytics.instance;
        var _perfHandler = FirebasePerformance.instance;
        if (kDebugMode) {
          await _crashHandler.setCrashlyticsCollectionEnabled(false);
          await _perfHandler.setPerformanceCollectionEnabled(false);
        } else {
          if (!_crashHandler.isCrashlyticsCollectionEnabled) {
            await _crashHandler.setCrashlyticsCollectionEnabled(true);
          }
          if (!(await _perfHandler.isPerformanceCollectionEnabled())) {
            await _perfHandler.setPerformanceCollectionEnabled(true);
          }
          FlutterError.onError = _crashHandler.recordFlutterError;
          Isolate.current.addErrorListener(RawReceivePort((pair) async {
            final List<dynamic> errorAndStacktrace = pair;
            await _crashHandler.recordError(
              errorAndStacktrace.first,
              errorAndStacktrace.last,
            );
          }).sendPort);
        }
        debugPrint(
          'Firebase Crashlytics: ${_crashHandler.isCrashlyticsCollectionEnabled}',
        );
        debugPrint(
          'Firebase Performance: ${await _perfHandler.isPerformanceCollectionEnabled()}',
        );
      } else {
        debugPrint('Web Mode, Crashlytics and Performance disabled');
      }
      var _auth = FirebaseAuth.instance;
      if (_auth.currentUser != null) return true;
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
}
