import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/util.dart';

final FirebaseAuth _auth = FirebaseAuth.instance;

class PlaceholderPage extends StatelessWidget {
  const PlaceholderPage({Key? key}) : super(key: key);

  void _signOut() async {
    await _auth.signOut();
    await Get.offAllNamed('/');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Placeholder Page'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _signOut,
          ),
        ],
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Text('Page Coming Soon'),
          ],
        ),
      ),
    );
  }
}

class PlaceholderWidgetContainer extends StatelessWidget {
  final Color color;

  const PlaceholderWidgetContainer(this.color, {Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      color: color,
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Text(
              'Coming Soon!',
              style: TextStyle(color: Colors.white, fontSize: 24),
            ),
          ],
        ),
      ),
    );
  }
}

class PlaceholderUtil {
  static void showUnimplementedSnackbar(BuildContext context) {
    Util.showSnackbarQuick(context, 'Feature Coming Soon!');
  }
}
