import 'dart:core';

import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:gi_weekly_material_tracker/models/promocodedata.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:shared_preferences/shared_preferences.dart';

final DatabaseReference db = FirebaseDatabase().reference();

class PromoCodePage extends StatefulWidget {
  PromoCodePage({Key key}) : super(key: key);

  @override
  _PromoCodePageState createState() => _PromoCodePageState();
}

class _PromoCodePageState extends State<PromoCodePage> {
  List<PromoCode> _codes;
  String _location;

  @override
  void initState() {
    super.initState();
    _retrievePromoCodes();
    SharedPreferences.getInstance().then((value) {
      setState(() {
        _location = value.getString('location') ?? 'Asia';
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_codes == null || _location == null) {
      return Util.loadingScreen();
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('Game Promo Codes'),
        actions: [
          IconButton(
            icon: Icon(Icons.open_in_browser),
            tooltip: 'Launch promo code page',
            onPressed: _launchRedemptionSite,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _retrievePromoCodes,
        child: SingleChildScrollView(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(8),
                child: Text(
                  'Currently viewing promo codes for $_location. Click to copy code to clipboard',
                  style: TextStyle(fontSize: 12),
                ),
              ),
              ListView.separated(
                shrinkWrap: true,
                physics: NeverScrollableScrollPhysics(),
                itemCount: _codes.length,
                itemBuilder: (context, index) {
                  var codeObj = _codes[index];
                  var promoCodeRegion = _getCode(codeObj);

                  return ListTile(
                    tileColor: _getExpiredColor(codeObj.expired),
                    title: Text(codeObj.reward),
                    subtitle: Text(
                      'Code: $promoCodeRegion\nTime: ${codeObj.date}, Expired: ${codeObj.expired}',
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
                separatorBuilder: (context, index) => Divider(height: 1),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _launchRedemptionSite() {
    Util.launchWebPage('https://genshin.mihoyo.com/en/gift');
  }

  String _getCode(PromoCode code) {
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

  Future<void> _retrievePromoCodes() async {
    var dataSnapshot = await db.child('codes').once();
    print('Promo Codes: ${dataSnapshot.value}');
    var data = dataSnapshot.value;

    var promoList = PromoCode.fromDB(Map<String, dynamic>.from(data));
    print(promoList);

    promoList.sort((a, b) => (b.expired) ? -1 : 1);

    setState(() {
      _codes = promoList;
    });
  }
}
