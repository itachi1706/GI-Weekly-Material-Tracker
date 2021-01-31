import 'dart:io';

import 'package:about/about.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:filesize/filesize.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/models/tracker.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:settings_ui/settings_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SettingsPage extends StatefulWidget {
  @override
  _SettingsPageState createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  String _location = "Loading", _cacheSize = "Loading", _version = "Loading";
  bool _darkMode = false;
  int _cacheFiles = 0;

  SharedPreferences _prefs;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  void _refresh() async {
    SharedPreferences pref = await SharedPreferences.getInstance();
    Map<String, int> _files = {"fileNum": 0, "size": 0};

    PackageInfo pkgInfo = await PackageInfo.fromPlatform();
    String version = pkgInfo.version, build = pkgInfo.buildNumber;
    if (!kIsWeb) {
      Directory dir = await getTemporaryDirectory();
      Directory _cacheDir = dir;
      _files = _dirStatSync(_cacheDir.path);
    }
    String type = (kIsWeb)
        ? "Web"
        : (Platform.isAndroid)
            ? "Android"
            : (Platform.isIOS)
                ? 'iOS'
                : "Others";

    setState(() {
      _prefs = pref;
      _location = _prefs.getString("location") ?? "Asia";
      _darkMode = _prefs.getBool("dark_mode") ?? false;
      _cacheFiles = _files["fileNum"];
      _cacheSize = filesize(_files["size"]);
      _version = "Version: $version build $build ($type)";
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("Settings")),
      body: SettingsList(
        sections: [
          SettingsSection(
            title: 'User Data',
            titlePadding: const EdgeInsets.all(16),
            tiles: [
              SettingsTile(
                title: "Currently Logged in as",
                trailing: SizedBox.shrink(),
                subtitle: Util.getUserEmail(),
                leading: Icon(Icons.face),
              ),
              SettingsTile(
                title: "Clear tracking data",
                trailing: SizedBox.shrink(),
                leading: Icon(Icons.delete_forever),
                onPressed: _clearTrackingDataPrompt,
              ),
            ],
          ),
          SettingsSection(
            title: "Settings",
            tiles: [
              SettingsTile.switchTile(
                title: "Dark Mode",
                leading: Icon(Icons.wb_sunny_outlined),
                onToggle: (bool value) {
                  _prefs.setBool("dark_mode", value).then((value) {
                    Util.themeNotifier.toggleTheme();
                  });
                  setState(() {
                    _darkMode = value;
                  });
                },
                switchValue: _darkMode,
              ),
              SettingsTile(
                title: "Game Server Location",
                subtitle: _location,
                leading: Icon(MdiIcons.server),
                onPressed: (context) {
                  Get.to(RegionSettingsPage());
                },
              ),
              SettingsTile(
                title: "Cache",
                subtitle: "Currently using $_cacheSize ($_cacheFiles files)",
                trailing: SizedBox.shrink(),
                enabled: !kIsWeb,
                leading: Icon(Icons.cached_rounded),
              ),
              SettingsTile(
                title: "Clear Cache",
                leading: Icon(MdiIcons.trashCanOutline),
                enabled: !kIsWeb,
                onPressed: (context) {
                  _clearCache();
                },
              ),
            ],
          ),
          SettingsSection(
            title: "More Info",
            tiles: [
              SettingsTile(
                title: "About This App",
                leading: Icon(Icons.info_outline),
                onPressed: _showAboutPage,
              ),
            ],
          ),
          CustomSection(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 22, bottom: 8),
                  child: Text(
                    _version,
                    style: TextStyle(color: Color(0xFF777777)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _clearTrackingDataPrompt(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text("Clear Tracking Data"),
          content:
              Text("Claer all materials currently being tracked from the app?"),
          actions: [
            TextButton(
              child: Text('Cancel'),
              onPressed: () => Get.back(),
            ),
            TextButton(
              child: Text('Clear'),
              onPressed: _clearTrackingData,
            ),
          ],
        );
      },
    );
  }

  void _clearTrackingData() async {
    // Clear tracking data by deleting the document
    String _uid = Util.getFirebaseUid();
    Get.back();
    if (_uid == null) return;
    FirebaseFirestore _db = FirebaseFirestore.instance;
    // Deleting all subcollections
    DocumentReference ref = _db.collection("tracking").doc(_uid);
    await TrackingData.clearCollection("boss_drops");
    await TrackingData.clearCollection("domain_forgery");
    await TrackingData.clearCollection("local_speciality");
    await TrackingData.clearCollection("mob_drops");
    await ref.delete(); // Delete fields
    Util.showSnackbarQuick(context, "Cleared all tracking information");
  }

  void _clearCache() async {
    Directory tmp = await getTemporaryDirectory();
    List<FileSystemEntity> files = tmp.listSync();
    files.forEach((file) async {
      await file.delete(recursive: true);
    });
    Util.showSnackbarQuick(context, "Cache Cleared");
    _refresh();
  }

  Map<String, int> _dirStatSync(String dirPath) {
    int fileNum = 0;
    int totalSize = 0;
    var dir = Directory(dirPath);
    try {
      if (dir.existsSync()) {
        dir
            .listSync(recursive: true, followLinks: false)
            .forEach((FileSystemEntity entity) {
          if (entity is File) {
            fileNum++;
            totalSize += entity.lengthSync();
          }
        });
      }
    } catch (e) {
      print(e.toString());
    }

    return {'fileNum': fileNum, 'size': totalSize};
  }

  void _showAboutPage(BuildContext context) {
    showAboutPage(
      context: context,
      title: Text("About this app"),
      applicationLegalese: "Copyright © Kenneth Soh, {{ year }}",
      applicationDescription: const Text(
          'Weekly Material Planner and Tracking Application for Genshin Impact'),
      children: <Widget>[
        ListTile(
          leading: Icon(Icons.source_outlined),
          trailing: SizedBox.shrink(),
          title: Text("View Source Code"),
          onTap: () => Util.launchWebPage("https://gitlab.com/itachi1706/gi-weekly-material-tracker"),
        ),
        MarkdownPageListTile(
          icon: Icon(Icons.list),
          title: const Text('Changelog'),
          filename: 'CHANGELOG.md',
        ),
        LicensesPageListTile(
          title: Text("Open Source Licenses"),
          icon: Icon(Icons.favorite),
        ),
      ],
      applicationIcon: const SizedBox(
        width: 100,
        height: 100,
        child: Image(
          image: AssetImage('assets/logo.png'),
        ),
      ),
    );
  }
}

class RegionSettingsPage extends StatefulWidget {
  @override
  _RegionSettingsPageState createState() => _RegionSettingsPageState();
}

class _RegionSettingsPageState extends State<RegionSettingsPage> {
  String _regionKey;
  SharedPreferences _prefs;

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((value) {
      setState(() {
        _prefs = value;
        _regionKey = value.getString("location") ?? "Asia";
      });
    });
  }

  Widget _buildBody() {
    if (_regionKey == null) return Util.centerLoadingCircle("Getting Region");
    return SettingsList(
      sections: [
        SettingsSection(
          tiles: [
            SettingsTile(
              title: "Asia",
              subtitle: "GMT+8",
              trailing: trailingWidget("Asia"),
              onPressed: (context) {
                changeRegion("Asia");
              },
            ),
            SettingsTile(
              title: "America",
              subtitle: "GMT-5",
              trailing: trailingWidget("NA"),
              onPressed: (context) {
                changeRegion("NA");
              },
            ),
            SettingsTile(
              title: "Europe",
              subtitle: "GMT+1",
              trailing: trailingWidget("EU"),
              onPressed: (context) {
                changeRegion("EU");
              },
            ),
          ],
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("Game Server Location")),
      body: _buildBody(),
    );
  }

  Widget trailingWidget(String region) {
    return Radio(
      toggleable: false,
      autofocus: false,
      value: region,
      onChanged: (ig) {},
      groupValue: _regionKey,
    );
  }

  void changeRegion(String region) async {
    await _prefs.setString("location", region);
    setState(() {
      _regionKey = region;
    });
  }
}
