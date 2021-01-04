import 'dart:async';

import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_signin_button/flutter_signin_button.dart';
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:get/get.dart';
import 'package:google_sign_in/google_sign_in.dart';

final FirebaseAuth _auth = FirebaseAuth.instance;

class LoginPage extends StatefulWidget {
  LoginPage({Key key, this.title}) : super(key: key);

  final String title;

  @override
  _LoginPageState createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  bool _initialized = false;
  bool _error = false;

  List<Widget> _signInButtons() {
    List<Widget> wid = <Widget>[
      Text("Genshin Impact Weekly Material Tracker"),
      SignInButton(Buttons.Google, onPressed: _signInGoogle),
    ];
    if (!kReleaseMode) {
      wid.insert(
          1,
          SignInButton(
            Buttons.Email,
            onPressed: _signIn,
            text: "Sign in with Test Account",
          ));
    }
    return wid;
  }

  void initializeFirebase() async {
    try {
      await Firebase.initializeApp();
      setState(() {
        _initialized = true;
      });
    } catch (e) {
      setState(() {
        _error = true;
      });
    }
  }

  @override
  void initState() {
    initializeFirebase();
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    if (!_initialized || _error) {
      return _loading();
    } else {
      return StreamBuilder(
        stream: _auth.authStateChanges(),
        builder: (context, snapshot) {
          if (snapshot.hasData) {
            final User user = snapshot.data;
            if (user != null) {
              SchedulerBinding.instance.addPostFrameCallback((timeStamp) {
                Get.offAllNamed('/menu');
              });
              return _loginScreen();
            }
          }
          // Signed out
          print("Signed out");
          return _loginScreen();
        },
      );
    }
  }

  Widget _loading() {
    // TODO: Replace with splash screen in the future
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [CircularProgressIndicator(), Text("Initializing App")],
        ),
      ),
    );
  }

  Widget _loginScreen() {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: _signInButtons(),
        ),
      ),
    );
  }

  void _signIn() async {
    print("Signing In with Test Account");
    try {
      await _auth.signInWithEmailAndPassword(
          email: "test@itachi1706.com", password: "testP@ssw0rd");
    } on FirebaseAuthException catch (e) {
      if (e.code == 'user-not-found') {
        print("No user found");
      } else if (e.code == "wrong-password") {
        print("Wrong password provided for that user");
      }
    }
  }

  Future<UserCredential> _signInGoogle() async {
    print("Signing In with Google");
    // Trigger the authentication flow
    final GoogleSignInAccount googleUser = await GoogleSignIn().signIn();

    // Obtain the auth details from the request
    final GoogleSignInAuthentication googleAuth =
        await googleUser.authentication;

    // Create a new credential
    final GoogleAuthCredential credential = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );

    // Once signed in, return the UserCredential
    return await _auth.signInWithCredential(credential);
  }
}
