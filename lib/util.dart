import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';

final FirebaseStorage _storage = FirebaseStorage.instance;

class Util {
  static void showSnackbarQuick(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), duration: Duration(seconds: 2)));
  }

  static Widget centerLoadingCircle(String loadText) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [CircularProgressIndicator(), Text(loadText)],
      ),
    );
  }

  static Future<String> getFirebaseStorageUrl(String ref) async {
    return await _storage.ref(ref).getDownloadURL();
  }
}
