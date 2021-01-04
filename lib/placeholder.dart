import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

final FirebaseAuth _auth = FirebaseAuth.instance;

class PlaceholderPage extends StatelessWidget {

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Placeholder Page"),
        actions: [
          IconButton(
            icon: Icon(Icons.logout),
            onPressed: _signOut,
          )
        ],
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text("Placeholder after sign in"),
          ],
        ),
      ),
    );
  }

  void _signOut() async {
    await _auth.signOut();
    // Go to login screen

    Get.offAllNamed('/');

    //Navigator.pushNamed(context, '/');
  }
}