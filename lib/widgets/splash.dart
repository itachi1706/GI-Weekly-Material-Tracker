import 'dart:isolate';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_performance/firebase_performance.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:splashscreen/splashscreen.dart';

class SplashPage extends StatelessWidget {
  Future<void> _initFirebase() async {
    try {
      await Firebase.initializeApp();
      if (!kIsWeb) {
        FirebaseCrashlytics _crashHandler = FirebaseCrashlytics.instance;
        FirebasePerformance _perfHandler = FirebasePerformance.instance;
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
        print(
            "Firebase Crashlytics: ${_crashHandler.isCrashlyticsCollectionEnabled}");
        print(
            "Firebase Performance: ${await _perfHandler.isPerformanceCollectionEnabled()}");
      } else {
        print("Web Mode, Crashlytics and Performance disabled");
      }
      FirebaseAuth _auth = FirebaseAuth.instance;
      if (_auth.currentUser != null) return true;
    } catch (e) {
      print(e);
    }
    return false;
  }

  Future<String> _login() async {
    List<dynamic> res = await Future.wait(
        [_initFirebase(), Future.delayed(Duration(seconds: 2))]);
    return (res[0]) ? "/menu" : "/";
  }

  @override
  Widget build(BuildContext context) {
    return SplashScreen(
      navigateAfterFuture: _login(),
      image: Image.asset("assets/logo.png"),
      loadingText: Text("Initializing App"),
      title: Text(
        "Genshin Impact Weekly Material Tracker",
        style: new TextStyle(fontSize: 20.0, fontFamily: 'Product-Sans-Bold'),
      ),
      backgroundColor: Colors.black,
      photoSize: 100.0,
    );
  }
}
