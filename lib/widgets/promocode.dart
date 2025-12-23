import 'dart:core';

import 'package:firebase_database/firebase_database.dart';
import 'package:firebase_ui_database/firebase_ui_database.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:gi_weekly_material_tracker/models/promocodedata.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:gi_weekly_material_tracker/widgets/drawer.dart';

final FirebaseDatabase db = FirebaseDatabase.instance;

class PromoCodePage extends StatefulWidget {
  const PromoCodePage({super.key});

  @override
  PromoCodePageState createState() => PromoCodePageState();
}

class PromoCodePageState extends State<PromoCodePage> {
  String? _location;

  @override
  void initState() {
    super.initState();
    Util.getSharedPreferenceInstance().then((value) {
      setState(() {
        _location = value.getString('location') ?? 'Asia';
      });
    });
  }

  void _launchRedemptionSite() {
    Util.launchWebPage('https://genshin.hoyoverse.com/en/gift');
  }

  void _launchRedemptionSiteWithCode(String code) {
    Util.launchWebPage('https://genshin.hoyoverse.com/en/gift?code=$code');
  }

  String? _getCode(PromoCode code) {
    switch (_location) {
      case 'EU':
        return code.euCode;
      case 'NA':
        return code.naCode;
      default:
        return code.asiaCode;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_location == null) {
      return Util.loadingScreenWithDrawer(const DrawerComponent());
    }
    final query = db.ref('codes').orderByChild("date");

    return Scaffold(
      appBar: AppBar(
        title: const Text('Game Promo Codes'),
        actions: [
          IconButton(
            onPressed: _launchRedemptionSite,
            icon: const Icon(Icons.open_in_browser),
            tooltip: 'Launch promo code page',
          ),
        ],
      ),
      drawer: const DrawerComponent(),
      body: SingleChildScrollView(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(8),
              child: Text(
                'Click to launch page with code pre-filled\nLong-click to copy code to clipboard\nCurrently viewing promo codes for $_location.\nNote: Some codes may have expired',
                style: const TextStyle(fontSize: 12),
                textAlign: TextAlign.center,
              ),
            ),
            FirebaseDatabaseListView(
              query: query,
              pageSize: 100,
              reverse: true,
              physics: const NeverScrollableScrollPhysics(),
              shrinkWrap: true,
              itemBuilder: (context, snapshot) {
                var codes = snapshot.value as Map<dynamic, dynamic>;
                var promoCode = PromoCode.fromJson(codes);

                if (!promoCode.isCode) {
                  var subtitle =
                      'URL: ${promoCode.url}\nTime: ${promoCode.date}, Expired: ${promoCode.expired}';
                  if (promoCode.expiryString != null && !promoCode.expired) {
                    subtitle += ', Expires: ${promoCode.expiryString}';
                  }

                  return Card(
                    margin:
                        const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                    child: ListTile(
                      // tileColor: _getExpiredColor(promoCode.expired),
                      title: Text(promoCode.reward),
                      subtitle: Text(subtitle),
                      isThreeLine: true,
                      onTap: () => Util.launchWebPage(promoCode.url),
                    ),
                  );
                }

                var promoCodeRegion = _getCode(promoCode);

                return Card(
                  margin:
                      const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                  child: ListTile(
                    title: Text(promoCode.reward),
                    // tileColor: _getExpiredColor(promoCode.expired),
                    subtitle: Text(
                      'Code: $promoCodeRegion\nTime: ${promoCode.date}, Expired: ${promoCode.expired}',
                    ),
                    isThreeLine: true,
                    onTap: () =>
                        _launchRedemptionSiteWithCode(promoCodeRegion!),
                    onLongPress: () {
                      Clipboard.setData(
                        ClipboardData(text: promoCodeRegion ?? '-'),
                      );
                      Util.showSnackbarQuick(
                        context,
                        'Code ($promoCodeRegion) copied to clipboard',
                      );
                    },
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

// Disabled until further notice
// We no longer know whether the code is expired or not
// Color _getExpiredColor(bool expired) {
//   return expired
//       ? (Util.themeNotifier.isDarkMode())
//           ? Colors.red
//           : Colors.deepOrangeAccent
//       : (Util.themeNotifier.isDarkMode())
//           ? Colors.green
//           : Colors.lightGreen;
// }
}
