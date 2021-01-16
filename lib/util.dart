import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:gi_weekly_material_tracker/models/themeNotifier.dart';

final String _firebaseStorageUrl =
    "gs://gi-weekly-material-tracker.appspot.com/";
final FirebaseStorage _storage = FirebaseStorage.instance;
final FirebaseAuth _auth = FirebaseAuth.instance;

class Util {
  static String _uid;

  static void showSnackbarQuick(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), duration: Duration(seconds: 2)));
  }

  static Widget loadingScreen() => Scaffold(
        appBar: AppBar(
          title: Text("Loading..."),
        ),
        body: Util.centerLoadingCircle("Getting Data"),
      );

  static Widget centerLoadingCircle(String loadText) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [CircularProgressIndicator(), Text(loadText)],
        ),
      );

  static Future<String> getFirebaseStorageUrl(String ref) async {
    if (kIsWeb) return await _storage.ref(ref).getDownloadURL();
    return "$_firebaseStorageUrl$ref";
  }

  static void updateFirebaseUid() => _uid = _auth.currentUser.uid;

  static String getFirebaseUid() {
    if (_auth.currentUser == null) return null;
    if (_uid == null) {
      _uid = _auth.currentUser.uid;
    }
    return _uid;
  }

  static String getUserEmail() {
    if (_auth.currentUser == null)
      return "Not Logged In";
    else
      return _auth.currentUser.email;
  }

  static ThemeNotifier themeNotifier = ThemeNotifier();
}
