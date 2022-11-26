import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_ui_auth/firebase_ui_auth.dart';
import 'package:firebase_ui_oauth_google/firebase_ui_oauth_google.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_signin_button/flutter_signin_button.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/app_secrets.dart';
import 'package:gi_weekly_material_tracker/util.dart';

final FirebaseAuth _auth = FirebaseAuth.instance;

class LoginPage extends StatefulWidget {
  const LoginPage({Key? key}) : super(key: key);

  @override
  LoginPageState createState() => LoginPageState();
}

class LoginPageState extends State<LoginPage> {
  StreamSubscription<User?>? _listener;

  @override
  void initState() {
    super.initState();
    _listener = _auth.userChanges().listen((event) {
      if (event != null) {
        _finishLoggedInFlow(context, event);
      }
    });
  }

  void _signInWithTest() async {
    Util.showSnackbarQuick(context, 'Signing in with test account...');
    try {
      var credentials = await _auth.signInWithEmailAndPassword(
        email: 'test@itachi1706.com',
        password: 'testP@ssw0rd',
      );

      if (mounted) {
        _finishLoggedInFlow(context, credentials.user);
      }
    } on FirebaseAuthException catch (_, e) {
      Util.showSnackbarQuick(context, 'Error signing in with test account');
      debugPrint('Error signing in with test account: $e');
    }
  }

  void _finishLoggedInFlow(BuildContext context, User? user) {
    Util.updateFirebaseUid();
    Util.showSnackbarQuick(context, 'Logged in as ${user?.email}');
    Get.offAllNamed('/menu');
  }

  Widget _buildFooter(BuildContext context, AuthAction action) {
    if (!kReleaseMode) {
      return SignInButton(
        Buttons.Email,
        onPressed: _signInWithTest,
        text: 'Sign in with Test Account',
      );
    }

    return const SizedBox.shrink();
  }

  @override
  void deactivate() {
    _listener?.cancel();
    _listener = null;
    super.deactivate();
  }

  @override
  Widget build(BuildContext context) {
    return SignInScreen(
      providers: [
        GoogleProvider(clientId: googleClientId),
      ],
      actions: [
        AuthStateChangeAction<SignedIn>((context, state) {
          _finishLoggedInFlow(context, state.user);
        }),
      ],
      showAuthActionSwitch: false,
      email: 'test@itachi1706.com',
      subtitleBuilder: (context, action) {
        return const Padding(
          padding: EdgeInsets.only(bottom: 8.0),
          child: Text('to Genshin Impact Weekly Material Tracker'),
        );
      },
      footerBuilder: _buildFooter,
    );
  }
}
