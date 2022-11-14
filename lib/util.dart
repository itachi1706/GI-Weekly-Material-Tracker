import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/listeners/theme_notifier.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

const String _firebaseStorageUrl =
    'gs://gi-weekly-material-tracker.appspot.com/';
final FirebaseStorage _storage = FirebaseStorage.instance;
final FirebaseAuth _auth = FirebaseAuth.instance;

class Util {
  static const String genshinGGUrl = 'https://genshin.gg/';
  static const String paimonMoeUrl = 'https://paimon.moe/';
  static ThemeNotifier themeNotifier = ThemeNotifier();
  static String? currentRoute;

  static DateFormat defaultDateFormat = DateFormat("yyyy-MM-dd HH:mm:ss");

  static Uint8List kTransparentImage = Uint8List.fromList([
    0x89,
    0x50,
    0x4E,
    0x47,
    0x0D,
    0x0A,
    0x1A,
    0x0A,
    0x00,
    0x00,
    0x00,
    0x0D,
    0x49,
    0x48,
    0x44,
    0x52,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    0x01,
    0x08,
    0x06,
    0x00,
    0x00,
    0x00,
    0x1F,
    0x15,
    0xC4,
    0x89,
    0x00,
    0x00,
    0x00,
    0x06,
    0x62,
    0x4B,
    0x47,
    0x44,
    0x00,
    0xFF,
    0x00,
    0xFF,
    0x00,
    0xFF,
    0xA0,
    0xBD,
    0xA7,
    0x93,
    0x00,
    0x00,
    0x00,
    0x09,
    0x70,
    0x48,
    0x59,
    0x73,
    0x00,
    0x00,
    0x0B,
    0x13,
    0x00,
    0x00,
    0x0B,
    0x13,
    0x01,
    0x00,
    0x9A,
    0x9C,
    0x18,
    0x00,
    0x00,
    0x00,
    0x07,
    0x74,
    0x49,
    0x4D,
    0x45,
    0x07,
    0xE6,
    0x03,
    0x10,
    0x17,
    0x07,
    0x1D,
    0x2E,
    0x5E,
    0x30,
    0x9B,
    0x00,
    0x00,
    0x00,
    0x0B,
    0x49,
    0x44,
    0x41,
    0x54,
    0x08,
    0xD7,
    0x63,
    0x60,
    0x00,
    0x02,
    0x00,
    0x00,
    0x05,
    0x00,
    0x01,
    0xE2,
    0x26,
    0x05,
    0x9B,
    0x00,
    0x00,
    0x00,
    0x00,
    0x49,
    0x45,
    0x4E,
    0x44,
    0xAE,
    0x42,
    0x60,
    0x82,
  ]);

  static String? _uid;

  static void showSnackbarQuick(BuildContext context, String message) {
    ScaffoldMessenger.of(context).removeCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), duration: const Duration(seconds: 2)),
    );
  }

  static Widget loadingScreen() => Scaffold(
        appBar: AppBar(
          title: const Text('Loading...'),
        ),
        body: Util.centerLoadingCircle('Getting Data'),
      );

  static Widget loadingScreenWithDrawer(Widget drawer) => Scaffold(
        appBar: AppBar(
          title: const Text('Loading...'),
        ),
        drawer: drawer,
        body: Util.centerLoadingCircle('Getting Data'),
      );

  static Widget centerLoadingCircle(String loadText) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 10),
            Text(loadText),
          ],
        ),
      );

  static Future<String> getFirebaseStorageUrl(String ref) async {
    if (kIsWeb) return await _storage.ref(ref).getDownloadURL();

    return '$_firebaseStorageUrl$ref';
  }

  static void updateFirebaseUid() => _uid = _auth.currentUser!.uid;

  static String? getFirebaseUid() {
    if (_auth.currentUser == null) return null;
    _uid ??= _auth.currentUser!.uid;

    return _uid;
  }

  static String? getUserEmail() {
    return _auth.currentUser == null
        ? 'Not Logged In'
        : _auth.currentUser!.email;
  }

  static String? getUserName() {
    return _auth.currentUser == null ? null : _auth.currentUser!.displayName;
  }

  static String? getUserPhotoUrl() {
    return _auth.currentUser == null ? null : _auth.currentUser!.photoURL;
  }

  static Future<bool> launchWebPage(
    String? url, {
    rarityColor = Colors.orange,
    webView = false,
    hideTopBars = true,
    iOSBottomBar = false,
    iOSUrlBar = false,
  }) async {
    if (url == null) return false;
    // Web Browser for web mode
    if (kIsWeb) {
      return await _launchWebPageWeb(url);
    } else if (GetPlatform.isAndroid || GetPlatform.isIOS) {
      if (webView) {
        // Use WebView instead
        var browser = InAppBrowser();
        var options = InAppBrowserClassOptions(
          crossPlatform: InAppBrowserOptions(
            hideToolbarTop: hideTopBars,
            hideUrlBar: !iOSUrlBar,
            toolbarTopBackgroundColor: rarityColor,
          ),
          ios: IOSInAppBrowserOptions(
            hideToolbarBottom: !iOSBottomBar,
          ),
          inAppWebViewGroupOptions: InAppWebViewGroupOptions(
            crossPlatform: InAppWebViewOptions(javaScriptEnabled: true),
          ),
        );

        await browser.openUrlRequest(
          urlRequest: URLRequest(url: Uri.parse(url)),
          options: options,
        );
      } else {
        // Native call for mobile app mode
        var browser = ChromeSafariBrowser();
        var options = ChromeSafariBrowserClassOptions(
          android: AndroidChromeCustomTabsOptions(
            toolbarBackgroundColor: rarityColor,
            showTitle: true,
            addDefaultShareMenuItem: true,
            enableUrlBarHiding: true,
          ),
          ios: IOSSafariOptions(
            barCollapsingEnabled: true,
            dismissButtonStyle: IOSSafariDismissButtonStyle.CLOSE,
          ),
        );

        await browser.open(url: Uri.parse(url), options: options);
      }

      return true;
    }

    // Launch web browser for all other platforms
    return await _launchWebPageWeb(url);
  }

  static Future<bool> _launchWebPageWeb(String url) async {
    // Launch through Web
    debugPrint('Launching $url');
    if (await canLaunch(url)) {
      await launch(url, forceSafariVC: false);

      return true;
    } else {
      return false;
    }
  }
}
