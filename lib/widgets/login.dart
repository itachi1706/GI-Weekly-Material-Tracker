import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_signin_button/flutter_signin_button.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:google_sign_in/google_sign_in.dart';

final FirebaseAuth _auth = FirebaseAuth.instance;

class LoginPage extends StatefulWidget {
  final String title;

  LoginPage({Key key, this.title}) : super(key: key);

  @override
  _LoginPageState createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  bool _loggingIn = false;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder(
      stream: _auth.authStateChanges(),
      builder: (context, snapshot) {
        if (snapshot.hasData) {
          final User user = snapshot.data;
          Util.updateFirebaseUid();
          if (user != null) {
            SchedulerBinding.instance.addPostFrameCallback((timeStamp) {
              Util.showSnackbarQuick(context, 'Logged in as ${user.email}');
              Get.offAllNamed('/menu');
            });

            return _loginScreen();
          }
        }
        // Signed out
        print('Signed out');

        return _loginScreen();
      },
    );
  }

  List<Widget> _signInButtons() {
    var wid = <Widget>[
      Text('Genshin Impact Weekly Material Tracker'),
      SignInButton(Buttons.Google, onPressed: _signInGoogle),
    ];
    if (!kReleaseMode) {
      if (kIsWeb) {
        wid.insert(
          1,
          Padding(
            padding: const EdgeInsets.only(bottom: 8, top: 8),
            child: SignInButton(
              Buttons.Email,
              onPressed: _signIn,
              text: 'Sign in with Test Account',
            ),
          ),
        );
      } else {
        wid.insert(
          1,
          SignInButton(
            Buttons.Email,
            onPressed: _signIn,
            text: 'Sign in with Test Account',
          ),
        );
      }
    }
    if (_loggingIn) {
      wid.add(Padding(
        padding: EdgeInsets.all(16.0),
        child: CircularProgressIndicator(),
      ));
      wid.add(Text('Logging In'));
    }

    return wid;
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

  void _loggingInState() {
    setState(() {
      _loggingIn = true;
    });
  }

  void _signIn() async {
    print('Signing In with Test Account');
    _loggingInState();
    try {
      await _auth.signInWithEmailAndPassword(
        email: 'test@itachi1706.com',
        password: 'testP@ssw0rd',
      );
    } on FirebaseAuthException catch (e) {
      if (e.code == 'user-not-found') {
        print('No user found');
      } else if (e.code == 'wrong-password') {
        print('Wrong password provided for that user');
      }
    }
  }

  Future<UserCredential> _signInGoogle() async {
    print('Signing In with Google');
    _loggingInState();
    if (kIsWeb) {
      var googleProvider = GoogleAuthProvider();

      googleProvider.setCustomParameters({'login_hint': 'user@gmail.com'});

      // Once signed in, return the UserCredential
      await _auth.signInWithRedirect(googleProvider);

      return _auth.getRedirectResult();
    } else {
      // Trigger the authentication flow
      final googleUser = await GoogleSignIn().signIn();

      // Obtain the auth details from the request
      final googleAuth = await googleUser.authentication;

      // Create a new credential
      final GoogleAuthCredential credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      // Once signed in, return the UserCredential
      return await _auth.signInWithCredential(credential);
    }
  }
}
