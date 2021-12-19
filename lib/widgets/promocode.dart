import 'dart:core';

import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutterfire_ui/database.dart';
import 'package:gi_weekly_material_tracker/models/promocodedata.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:gi_weekly_material_tracker/widgets/drawer.dart';
import 'package:shared_preferences/shared_preferences.dart';

final FirebaseDatabase db = FirebaseDatabase.instance;

class PromoCodePage extends StatefulWidget {
  const PromoCodePage({Key? key}) : super(key: key);

  @override
  _PromoCodePageState createState() => _PromoCodePageState();
}

class _PromoCodePageState extends State<PromoCodePage> {
  String? _location;

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((value) {
      setState(() {
        _location = value.getString('location') ?? 'Asia';
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_location == null) {
      return Util.loadingScreenWithDrawer(DrawerComponent());
    }
    final query = db.ref('codes');

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
      drawer: DrawerComponent(),
      body: SingleChildScrollView(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(8),
              child: Text(
                'Click to copy code to clipboard. Page auto updates\nCurrently viewing promo codes for $_location.',
                style: const TextStyle(fontSize: 12),
                textAlign: TextAlign.center,
              ),
            ),
            FirebaseDatabaseListView(
              query: query,
              pageSize: 20,
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

                  return ListTile(
                    tileColor: _getExpiredColor(promoCode.expired),
                    title: Text(promoCode.reward),
                    subtitle: Text(subtitle),
                    isThreeLine: true,
                    onTap: () => Util.launchWebPage(promoCode.url),
                  );
                }

                var promoCodeRegion = _getCode(promoCode);

                return ListTile(
                  title: Text(promoCode.reward),
                  tileColor: _getExpiredColor(promoCode.expired),
                  subtitle: Text(
                    'Code: $promoCodeRegion\nTime: ${promoCode.date}, Expired: ${promoCode.expired}',
                  ),
                  isThreeLine: true,
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: promoCodeRegion));
                    Util.showSnackbarQuick(
                      context,
                      'Code ($promoCodeRegion) copied to clipboard',
                    );
                  },
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  void _launchRedemptionSite() {
    Util.launchWebPage('https://genshin.mihoyo.com/en/gift');
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

  Color _getExpiredColor(bool expired) {
    return expired
        ? (Util.themeNotifier.isDarkMode())
            ? Colors.red
            : Colors.deepOrangeAccent
        : (Util.themeNotifier.isDarkMode())
            ? Colors.green
            : Colors.lightGreen;
  }
}
