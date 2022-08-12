import 'dart:io';

import 'package:about/about.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:filesize/filesize.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/helpers/notifications.dart';
import 'package:gi_weekly_material_tracker/helpers/tracker.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:settings_ui/settings_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({Key? key}) : super(key: key);

  @override
  _SettingsPageState createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  String _location = 'Loading', _cacheSize = 'Loading', _version = 'Loading';
  String _versionStr = 'Unknown', _buildSource = 'Loading';
  bool _darkMode = false,
      _dailylogin = false,
      _weeklyParametric = false,
      _moveBot = false;
  int? _cacheFiles = 0;

  late SharedPreferences _prefs;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: SettingsList(
        sections: [
          _userDataSettings(),
          _appDataSettings(),
          SettingsSection(
            title: const Text('Notifications'),
            tiles: _showNotificationTestMenu(),
          ),
          _infoSettings(),
          _endSettings(),
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
      _buildSource = _prefs.getString('build_guide_source') ?? 'genshin.gg';
      _darkMode = _prefs.getBool('dark_mode') ?? false;
      _moveBot = _prefs.getBool('move_completed_bottom') ?? false;
      _dailylogin = _prefs.getBool('daily_login') ?? false;
      _cacheFiles = _files['fileNum'];
      _cacheSize = filesize(_files['size']);
      _version = 'Version: $version build $build ($type)';
      _versionStr = version;
      _weeklyParametric = _prefs.getBool('parametric_notification') ?? false;
    });
  }

  SettingsSection _userDataSettings() {
    return SettingsSection(
      title: const Text('User Data'),
      margin: const EdgeInsetsDirectional.all(16),
      tiles: [
        SettingsTile(
          title: const Text('Currently Logged in as'),
          trailing: const SizedBox.shrink(),
          description: Text(Util.getUserEmail() ?? 'Not logged in'),
          leading: const Icon(Icons.face),
        ),
        SettingsTile(
          title: const Text('Clear tracking data'),
          trailing: const SizedBox.shrink(),
          leading: const Icon(Icons.delete_forever),
          onPressed: _clearTrackingDataPrompt,
        ),
      ],
    );
  }

  List<SettingsTile> _getNotificationTiles() {
    return [
      SettingsTile.switchTile(
        title: const Text('Daily Forum Reminders'),
        leading: const Icon(Icons.alarm),
        onToggle: (bool value) {
          _prefs.setBool('daily_login', value).then((s) async {
            var notifyManager = NotificationManager.getInstance()!;
            await notifyManager.scheduleDailyForumReminder(
              value,
              resetNotificationChannel: true,
            );
            Util.showSnackbarQuick(
              context,
              '${(value) ? "Enabled" : "Disabled"} daily forum reminders at 12AM GMT+8',
            );
          });
          setState(() {
            _dailylogin = value;
          });
        },
        initialValue: _dailylogin,
      ),
      SettingsTile.switchTile(
        title: const Text('Parametric Transformer'),
        description: const Text(
          'Make sure to set the time on the Parametric Transformer page',
          maxLines: 2,
        ),
        leading: const Icon(Icons.alarm),
        onToggle: (bool value) {
          _prefs.setBool('parametric_notification', value).then((s) async {
            var notifyManager = NotificationManager.getInstance()!;
            await notifyManager.scheduleParametricReminder(
              value,
              resetNotificationChannel: true,
            );
            Util.showSnackbarQuick(
              context,
              '${(value) ? "Enabled" : "Disabled"} parametric transformer reminders',
            );
          });
          setState(() {
            _weeklyParametric = value;
          });
        },
        initialValue: _weeklyParametric,
      ),
    ];
  }

  List<SettingsTile> _showNotificationTestMenu() {
    if (kIsWeb) {
      // Return no op
      return [
        SettingsTile(
          trailing: const SizedBox.shrink(),
          title: const Text('Notifications not supported on web'),
          enabled: false,
        ),
      ];
    }

    var tiles = _getNotificationTiles();

    if (kDebugMode) {
      tiles.add(SettingsTile(
        title: const Text('Notification Test Menu'),
        leading: const Icon(Icons.bug_report),
        trailing: const SizedBox.shrink(),
        onPressed: (context) {
          Get.to(() => const NotificationDebugPage());
        },
      ));
    }

    return tiles;
  }

  // Switches
  void _toggleDarkMode(bool value) {
    _prefs.setBool('dark_mode', value).then((value) {
      Util.themeNotifier.toggleTheme();
    });
    setState(() {
      _darkMode = value;
    });
  }

  void _toggleMoveCompletedToBottom(bool value) {
    _prefs.setBool('move_completed_bottom', value).then((value) {
      Util.showSnackbarQuick(context, 'Will be moved on next reload');
    });
    setState(() {
      _moveBot = value;
    });
  }

  SettingsSection _appDataSettings() {
    return SettingsSection(
      title: const Text('Settings'),
      tiles: [
        SettingsTile.switchTile(
          title: const Text('Dark Mode'),
          leading: const Icon(Icons.wb_sunny_outlined),
          onToggle: _toggleDarkMode,
          initialValue: _darkMode,
        ),
        SettingsTile.switchTile(
          title: const Text('Move completed to bottom'),
          description: const Text('Only for the tracking page'),
          leading: const Icon(Icons.checklist),
          onToggle: _toggleMoveCompletedToBottom,
          initialValue: _moveBot,
        ),
        SettingsTile(
          title: const Text('Build Guide Source'),
          description: Text(_buildSource),
          leading: const Icon(MdiIcons.swordCross),
          onPressed: (context) {
            Get.to(() => const BuildGuideSelectorPage())!
                .then((value) => _refresh());
          },
        ),
        SettingsTile(
          title: const Text('Game Server Location'),
          description: Text(_location),
          leading: const Icon(MdiIcons.server),
          trailing: const SizedBox.shrink(),
          onPressed: (context) {
            Get.to(() => const RegionSettingsPage())!
                .then((value) => _refresh());
          },
        ),
        SettingsTile(
          title: const Text('Cache'),
          description: Text('Currently using $_cacheSize ($_cacheFiles files)'),
          trailing: const SizedBox.shrink(),
          enabled: !kIsWeb,
          leading: const Icon(Icons.cached_rounded),
        ),
        SettingsTile(
          title: const Text('Clear Cache'),
          leading: const Icon(MdiIcons.trashCanOutline),
          trailing: const SizedBox.shrink(),
          enabled: !kIsWeb,
          onPressed: (context) {
            _clearCache();
          },
        ),
      ],
    );
  }

  SettingsSection _infoSettings() {
    return SettingsSection(
      title: const Text('More Info'),
      tiles: [
        SettingsTile(
          title: const Text('About This App'),
          leading: const Icon(Icons.info_outline),
          trailing: const SizedBox.shrink(),
          onPressed: _showAboutPage,
        ),
      ],
    );
  }

  CustomSettingsSection _endSettings() {
    return CustomSettingsSection(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 22, bottom: 8),
            child: InkWell(
              onTap: () {
                Clipboard.setData(ClipboardData(text: _version))
                    .then((value) => Util.showSnackbarQuick(
                          context,
                          "Version copied to clipboard",
                        ));
              },
              child: Text(
                _version,
                style: const TextStyle(color: Color(0xFF777777)),
              ),
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
          title: const Text('Clear Tracking Data'),
          content: const Text(
            'Clear all materials currently being tracked from the app?',
          ),
          actions: [
            TextButton(
              onPressed: () => Get.back(),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: _clearTrackingData,
              child: const Text('Clear'),
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
    for (var file in files) {
      await file.delete(recursive: true);
    }
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
      debugPrint(e.toString());
    }

    return {'fileNum': fileNum, 'size': totalSize};
  }

  void _showAboutPage(BuildContext context) {
    showAboutPage(
      context: context,
      title: const Text('About this app'),
      values: {
        'version': _versionStr,
        'year': DateTime.now().year.toString(),
      },
      applicationLegalese: 'Copyright © Kenneth Soh, {{ year }}',
      applicationDescription: const Text(
        'Weekly Material Planner and Tracking Application for Genshin Impact',
      ),
      children: <Widget>[
        ListTile(
          leading: const Icon(Icons.source_outlined),
          trailing: const SizedBox.shrink(),
          title: const Text('View Source Code'),
          onTap: () => Util.launchWebPage(
            'https://github.com/itachi1706/GI-Weekly-Material-Tracker',
          ),
        ),
        ListTile(
          leading: const Icon(Icons.bug_report),
          trailing: const SizedBox.shrink(),
          title: const Text('Report a Bug'),
          onTap: () => Util.launchWebPage(
            'https://github.com/itachi1706/GI-Weekly-Material-Tracker/issues/new?assignees=&labels=bug%2C+status%3A%3Ato+triage&template=bug-report.md&title=',
          ),
        ),
        ListTile(
          leading: const Icon(Icons.lightbulb),
          trailing: const SizedBox.shrink(),
          title: const Text('Suggest a new Feature'),
          onTap: () => Util.launchWebPage(
            'https://github.com/itachi1706/GI-Weekly-Material-Tracker/issues/new?assignees=&labels=status%3A%3Ato+triage%2C+suggestion&template=feature-request.md&title=',
          ),
        ),
        const MarkdownPageListTile(
          icon: Icon(Icons.list),
          title: Text('Changelog'),
          filename: 'CHANGELOG.md',
        ),
        const LicensesPageListTile(
          title: Text('Open Source Licenses'),
          icon: Icon(Icons.favorite),
        ),
      ],
      applicationIcon: SizedBox(
        width: 100,
        height: 100,
        child: Image.asset(Util.themeNotifier.isDarkMode()
            ? 'assets/icons/splash/splash_dark.png'
            : 'assets/icons/splash/splash.png'),
      ),
    );
  }
}

class RegionSettingsPage extends StatefulWidget {
  const RegionSettingsPage({Key? key}) : super(key: key);

  @override
  _RegionSettingsPageState createState() => _RegionSettingsPageState();
}

class _RegionSettingsPageState extends State<RegionSettingsPage> {
  String? _regionKey;
  late SharedPreferences _prefs;

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
      appBar: AppBar(title: const Text('Game Server Location')),
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
              title: const Text('Asia'),
              description: const Text('GMT+8'),
              trailing: _trailingWidget('Asia'),
              onPressed: (context) {
                _changeRegion('Asia');
              },
            ),
            SettingsTile(
              title: const Text('America'),
              description: const Text('GMT-5'),
              trailing: _trailingWidget('NA'),
              onPressed: (context) {
                _changeRegion('NA');
              },
            ),
            SettingsTile(
              title: const Text('Europe'),
              description: const Text('GMT+1'),
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
      onChanged: (dynamic ig) {
        debugPrint('Set to $_regionKey');
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

class BuildGuideSelectorPage extends StatefulWidget {
  const BuildGuideSelectorPage({Key? key}) : super(key: key);

  @override
  _BuildGuideSelectorPageState createState() => _BuildGuideSelectorPageState();
}

class _BuildGuideSelectorPageState extends State<BuildGuideSelectorPage> {
  String? _buildGuideKey;
  late SharedPreferences _prefs;

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((value) {
      setState(() {
        _prefs = value;
        _buildGuideKey = value.getString('build_guide_source') ?? 'genshin.gg';
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Build Guide Source')),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_buildGuideKey == null) {
      return Util.centerLoadingCircle('Getting source of build guide');
    }

    return SettingsList(
      sections: [
        SettingsSection(
          tiles: [
            SettingsTile(
              title: const Text('Genshin.GG Wiki Database'),
              description: const Text('genshin.gg'),
              trailing: _trailingWidget('genshin.gg'),
              onPressed: (context) {
                _changeBuildGuide('genshin.gg');
              },
            ),
            SettingsTile(
              title: const Text('Paimon.moe'),
              description: const Text('paimon.moe'),
              trailing: _trailingWidget('paimon.moe'),
              onPressed: (context) {
                _changeBuildGuide('paimon.moe');
              },
            ),
          ],
        ),
      ],
    );
  }

  Widget _trailingWidget(String buildGuideSource) {
    return Radio(
      toggleable: false,
      autofocus: false,
      value: buildGuideSource,
      onChanged: (dynamic ig) {
        debugPrint('Set to $_buildGuideKey');
      },
      groupValue: _buildGuideKey,
    );
  }

  void _changeBuildGuide(String buildGuideSource) async {
    await _prefs.setString('build_guide_source', buildGuideSource);
    setState(() {
      _buildGuideKey = buildGuideSource;
    });
  }
}

class NotificationDebugPage extends StatelessWidget {
  const NotificationDebugPage({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    var notifyManager = NotificationManager.getInstance();

    return Scaffold(
      appBar: AppBar(title: const Text('Notification Debug')),
      body: SettingsList(
        sections: [
          SettingsSection(
            tiles: [
              SettingsTile(
                title: const Text('Daily Forum Reminder'),
                trailing: const SizedBox.shrink(),
                onPressed: (context) {
                  notifyManager!.showNotification(
                    notifyManager.getDailyCheckInMessages(),
                    notifyManager.craftDailyForumReminder(),
                    payload: 'forum-login',
                  );
                },
              ),
              SettingsTile(
                title: const Text('Parametric Transformer Reminder'),
                trailing: const SizedBox.shrink(),
                onPressed: (context) {
                  notifyManager!.showNotification(
                    notifyManager.getParametricTransformerMesssages(),
                    notifyManager.craftParametricTransformerReminder(),
                    payload: 'parametric-weekly',
                  );
                },
              ),
              SettingsTile(
                title: const Text('Scheduled Reminders List'),
                trailing: const SizedBox.shrink(),
                onPressed: (context) async {
                  var msg = await notifyManager!.getScheduledReminders();
                  await _showDialog(context, msg);
                },
              ),
              SettingsTile(
                title: const Text('Delete Scheduled Notification Channel'),
                trailing: const SizedBox.shrink(),
                onPressed: (context) {
                  notifyManager!.removeNotificationChannel('scheduled_notify');
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _showDialog(BuildContext context, String msg) async {
    await showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Upcoming Reminders'),
          content: Text(msg),
          actions: [
            TextButton(
              onPressed: () => Get.back(),
              child: const Text('Close'),
            ),
          ],
        );
      },
    );
  }
}
