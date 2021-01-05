import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

class Util {
  static void showSnackbarQuick(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(message), duration: Duration(seconds: 2)));
  }

  static Widget centerLoadingCircle(String loadText) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [CircularProgressIndicator(), Text(loadText)],
      ),
    );
  }
}