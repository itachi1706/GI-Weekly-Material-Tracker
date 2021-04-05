import 'dart:io';

import 'package:about/about.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:filesize_ns/filesize_ns.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/helpers/notifications.dart';
import 'package:gi_weekly_material_tracker/helpers/tracker.dart';
import 'package:gi_weekly_material_tracker/placeholder.dart';
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
  String _location = 'Loading', _cacheSize = 'Loading', _version = 'Loading';
  bool _darkMode = false;
  int _cacheFiles = 0;

  SharedPreferences _prefs;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Settings')),
      body: SettingsList(
        sections: [
          _userDataSettings(),
          _appDataSettings(),
          _notificationSettings(),
          ..._infoSettings(),
        ],
      ),
    );
  }

  void _refresh() async {
    var pref = await SharedPreferences.getInstance();
    var _files = <String, int>{'fileNum': 0, 'size': 0};

    var pkgInfo = await PackageInfo.fromPlatform();
    var version = pkgInfo.version;
    var build = pkgInfo.buildNumber;
    if (!kIsWeb) {
      var dir = await getTemporaryDirectory();
      var _cacheDir = dir;
      _files = _dirStatSync(_cacheDir.path);
    }
    var type = (kIsWeb)
        ? 'Web'
        : (Platform.isAndroid)
            ? 'Android'
            : (Platform.isIOS)
                ? 'iOS'
                : 'Others';

    setState(() {
      _prefs = pref;
      _location = _prefs.getString('location') ?? 'Asia';
      _darkMode = _prefs.getBool('dark_mode') ?? false;
      _cacheFiles = _files['fileNum'];
      _cacheSize = filesize(_files['size']);
      _version = 'Version: $version build $build ($type)';
    });
  }

  Widget _userDataSettings() {
    return SettingsSection(
      title: 'User Data',
      titlePadding: const EdgeInsets.all(16),
      tiles: [
        SettingsTile(
          title: 'Currently Logged in as',
          trailing: SizedBox.shrink(),
          subtitle: Util.getUserEmail(),
          leading: Icon(Icons.face),
        ),
        SettingsTile(
          title: 'Clear tracking data',
          trailing: SizedBox.shrink(),
          leading: Icon(Icons.delete_forever),
          onPressed: _clearTrackingDataPrompt,
        ),
      ],
    );
  }

  Widget _notificationSettings() {
    return SettingsSection(
      title: 'Notifications',
      tiles: [
        SettingsTile.switchTile(
          title: 'Daily Forum Reminder (WIP)',
          leading: Icon(Icons.alarm),
          onToggle: (bool value) {
            PlaceholderUtil.showUnimplementedSnackbar(context);
          },
          switchValue: false,
        ),
        SettingsTile(
          title: 'Notification Test',
          leading: Icon(Icons.bug_report),
          onPressed: (context) {
            Get.to(() => NotificationDebugPage());
          },
        ),
      ],
    );
  }

  Widget _appDataSettings() {
    return SettingsSection(
      title: 'Settings',
      tiles: [
        SettingsTile.switchTile(
          title: 'Dark Mode',
          leading: Icon(Icons.wb_sunny_outlined),
          onToggle: (bool value) {
            _prefs.setBool('dark_mode', value).then((value) {
              Util.themeNotifier.toggleTheme();
            });
            setState(() {
              _darkMode = value;
            });
          },
          switchValue: _darkMode,
        ),
        SettingsTile(
          title: 'Game Server Location',
          subtitle: _location,
          leading: Icon(MdiIcons.server),
          onPressed: (context) {
            Get.to(() => RegionSettingsPage());
          },
        ),
        SettingsTile(
          title: 'Cache',
          subtitle: 'Currently using $_cacheSize ($_cacheFiles files)',
          trailing: SizedBox.shrink(),
          enabled: !kIsWeb,
          leading: Icon(Icons.cached_rounded),
        ),
        SettingsTile(
          title: 'Clear Cache',
          leading: Icon(MdiIcons.trashCanOutline),
          enabled: !kIsWeb,
          onPressed: (context) {
            _clearCache();
          },
        ),
      ],
    );
  }

  List<Widget> _infoSettings() {
    return [
      SettingsSection(
        title: 'More Info',
        tiles: [
          SettingsTile(
            title: 'About This App',
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
    ];
  }

  void _clearTrackingDataPrompt(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text('Clear Tracking Data'),
          content:
              Text('Claer all materials currently being tracked from the app?'),
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
    var _uid = Util.getFirebaseUid();
    Get.back();
    if (_uid == null) return;
    var _db = FirebaseFirestore.instance;
    // Deleting all subcollections
    var ref = _db.collection('tracking').doc(_uid);
    await TrackingData.clearCollection('boss_drops');
    await TrackingData.clearCollection('domain_material');
    await TrackingData.clearCollection('local_speciality');
    await TrackingData.clearCollection('mob_drops');
    await ref.delete(); // Delete fields
    Util.showSnackbarQuick(context, 'Cleared all tracking information');
  }

  void _clearCache() async {
    var tmp = await getTemporaryDirectory();
    var files = tmp.listSync();
    files.forEach((file) async {
      await file.delete(recursive: true);
    });
    Util.showSnackbarQuick(context, 'Cache Cleared');
    _refresh();
  }

  Map<String, int> _dirStatSync(String dirPath) {
    var fileNum = 0;
    var totalSize = 0;
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
      title: Text('About this app'),
      applicationLegalese: 'Copyright © Kenneth Soh, {{ year }}',
      applicationDescription: const Text(
        'Weekly Material Planner and Tracking Application for Genshin Impact',
      ),
      children: <Widget>[
        ListTile(
          leading: Icon(Icons.source_outlined),
          trailing: SizedBox.shrink(),
          title: Text('View Source Code'),
          onTap: () => Util.launchWebPage(
            'https://gitlab.com/itachi1706/gi-weekly-material-tracker',
          ),
        ),
        MarkdownPageListTile(
          icon: Icon(Icons.list),
          title: const Text('Changelog'),
          filename: 'CHANGELOG.md',
        ),
        LicensesPageListTile(
          title: Text('Open Source Licenses'),
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
        _regionKey = value.getString('location') ?? 'Asia';
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Game Server Location')),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_regionKey == null) return Util.centerLoadingCircle('Getting Region');

    return SettingsList(
      sections: [
        SettingsSection(
          tiles: [
            SettingsTile(
              title: 'Asia',
              subtitle: 'GMT+8',
              trailing: _trailingWidget('Asia'),
              onPressed: (context) {
                _changeRegion('Asia');
              },
            ),
            SettingsTile(
              title: 'America',
              subtitle: 'GMT-5',
              trailing: _trailingWidget('NA'),
              onPressed: (context) {
                _changeRegion('NA');
              },
            ),
            SettingsTile(
              title: 'Europe',
              subtitle: 'GMT+1',
              trailing: _trailingWidget('EU'),
              onPressed: (context) {
                _changeRegion('EU');
              },
            ),
          ],
        ),
      ],
    );
  }

  Widget _trailingWidget(String region) {
    return Radio(
      toggleable: false,
      autofocus: false,
      value: region,
      onChanged: (ig) {
        print('Set to $_regionKey');
      },
      groupValue: _regionKey,
    );
  }

  void _changeRegion(String region) async {
    await _prefs.setString('location', region);
    setState(() {
      _regionKey = region;
    });
  }
}

class NotificationDebugPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    var notifyManager = NotificationManager.getInstance(context);

    return Scaffold(
      appBar: AppBar(title: Text('Notification Debug')),
      body: SettingsList(
        sections: [
          SettingsSection(
            tiles: [
              SettingsTile(
                title: 'Daily Forum Reminder',
                onPressed: (context) {
                  notifyManager.showNotification(1001, 'Claim your Genshin Impact Daily Check In', 'Click to open the webpage', notifyManager.craftDailyForumReminder(), payload: 'forum-login');
                  //PlaceholderUtil.showUnimplementedSnackbar(context);
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

}
