import 'dart:convert';
import 'dart:io';

import 'package:about/about.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:file_picker/file_picker.dart';
import 'package:filesize/filesize.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_cached_image/firebase_cached_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_file_dialog/flutter_file_dialog.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/helpers/notifications.dart';
import 'package:gi_weekly_material_tracker/helpers/tracker.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:settings_ui/settings_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  SettingsPageState createState() => SettingsPageState();
}

class SettingsPageState extends State<SettingsPage> {
  String _location = 'Loading', _cacheSize = 'Loading', _version = 'Loading';
  String _versionStr = 'Unknown', _buildSource = 'Loading';
  String _appCheckToken = 'Loading', _appCheckError = 'Loading';
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

  void _refresh() async {
    var pref = await SharedPreferences.getInstance();
    var files = <String, int>{'fileNum': 0, 'size': 0};

    var pkgInfo = await PackageInfo.fromPlatform();
    var version = pkgInfo.version;
    var build = pkgInfo.buildNumber;
    if (!kIsWeb) {
      var dir = await getTemporaryDirectory();
      var cacheDir = dir;
      files = _dirStatSync(cacheDir.path);
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
      _appCheckToken = _prefs.getString('app_check_token') ?? 'NA';
      _appCheckError = _prefs.getString('app_check_token_err') ?? 'No Errors';
      _location = _prefs.getString('location') ?? 'Asia';
      _buildSource = _prefs.getString('build_guide_source') ?? 'genshin.gg';
      _darkMode = _prefs.getBool('dark_mode') ?? false;
      _moveBot = _prefs.getBool('move_completed_bottom') ?? false;
      _dailylogin = _prefs.getBool('daily_login') ?? false;
      _cacheFiles = files['fileNum'];
      _cacheSize = filesize(files['size']);
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
          title: const Text('Logged in as'),
          value: Text(Util.getUserEmail() ?? 'Not logged in'),
          leading: const Icon(Icons.face),
        ),
        SettingsTile(
          title: const Text('Import User Data'),
          description: const Text('Will overwrite current data!'),
          trailing: const SizedBox.shrink(),
          leading: const Icon(Icons.file_upload),
          onPressed: _importData,
        ),
        SettingsTile(
          title: const Text('Export User Data'),
          trailing: const SizedBox.shrink(),
          leading: const Icon(Icons.file_download),
          onPressed: _exportData,
        ),
        SettingsTile(
          title: const Text('Clear tracking data'),
          trailing: const SizedBox.shrink(),
          leading: const Icon(Icons.delete_forever),
          onPressed: _clearTrackingDataPrompt,
        ),
        SettingsTile(
          title: const Text(
            'Delete Account',
            style: TextStyle(color: Colors.red),
          ),
          trailing: const SizedBox.shrink(),
          leading: const Icon(
            Icons.close,
            color: Colors.red,
          ),
          onPressed: _deletePrompt,
        ),
      ],
    );
  }

  void _toggleForumReminders(bool value) {
    _prefs.setBool('daily_login', value).then((s) async {
      var notifyManager = NotificationManager.getInstance()!;
      var result = await notifyManager.scheduleDailyForumReminder(
        value,
        resetNotificationChannel: true,
      );
      if (mounted) {
        if (!result) {
          Util.showSnackbarQuick(
            context,
            'Failed to schedule reminder. Make sure permission to post notification and exact alarm is enabled',
          );
        } else {
          Util.showSnackbarQuick(
            context,
            '${(value) ? "Enabled" : "Disabled"} daily forum reminders at 12AM GMT+8',
          );
        }
      }
    });
    setState(() {
      _dailylogin = value;
    });
  }

  void _toggleParametricReminders(bool value) {
    _prefs.setBool('parametric_notification', value).then((s) async {
      var notifyManager = NotificationManager.getInstance()!;
      var result = await notifyManager.scheduleParametricReminder(
        value,
        resetNotificationChannel: true,
      );
      if (mounted) {
        if (!result) {
          Util.showSnackbarQuick(
            context,
            'Failed to schedule reminder. Make sure permission to post notification and exact alarm is enabled',
          );
        } else {
          Util.showSnackbarQuick(
            context,
            '${(value) ? "Enabled" : "Disabled"} parametric transformer reminders',
          );
        }
      }
    });
    setState(() {
      _weeklyParametric = value;
    });
  }

  List<SettingsTile> _getNotificationTiles() {
    return [
      SettingsTile.switchTile(
        title: const Text('Daily Forum Reminders'),
        leading: const Icon(Icons.alarm),
        onToggle: _toggleForumReminders,
        initialValue: _dailylogin,
      ),
      SettingsTile.switchTile(
        title: const Text('Parametric Transformer'),
        description: const Text(
          'Make sure to set the time on the Parametric Transformer page',
          maxLines: 2,
        ),
        leading: const Icon(Icons.alarm),
        onToggle: _toggleParametricReminders,
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
          value: Text(_buildSource),
          leading: Icon(MdiIcons.swordCross),
          onPressed: (context) {
            Get.to(() => const BuildGuideSelectorPage())!
                .then((value) => _refresh());
          },
        ),
        SettingsTile(
          title: const Text('Game Server Location'),
          value: Text(_location),
          leading: Icon(MdiIcons.server),
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
          title: const Text('Clear Cache', style: TextStyle(color: Colors.red)),
          leading: Icon(MdiIcons.trashCanOutline, color: Colors.red),
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

  void _importData(BuildContext context) async {
    var firestore = FirebaseFirestore.instance;
    var uid = Util.getFirebaseUid();
    if (uid == null) {
      Util.showSnackbarQuick(context, 'Please login first');

      return;
    }

    var fileContent = await _loadFile();
    if (fileContent == null) {
      _safeNotification('No file detected');

      return;
    }

    _safeNotification("Importing data...");

    try {
      debugPrint(fileContent);
      var data = jsonDecode(fileContent) as Map<String, dynamic>;

      var tracking = data.containsKey('tracking') ? data['tracking'] : null;
      var bd = data.containsKey('item_boss_drops')
          ? data['item_boss_drops'] as Map<String, dynamic>
          : null;
      var dm = data.containsKey('item_domain_material')
          ? data['item_domain_material'] as Map<String, dynamic>
          : null;
      var ls = data.containsKey('item_local_speciality')
          ? data['item_local_speciality'] as Map<String, dynamic>
          : null;
      var mb = data.containsKey('item_mob_drops')
          ? data['item_mob_drops'] as Map<String, dynamic>
          : null;
      var ud = data.containsKey('userdata') ? data['userdata'] : null;

      var batch = firestore.batch();
      var ref = firestore.collection('tracking').doc(uid);
      if (tracking != null || ud != null) {
        await _clearTrackingData(false, false); // Wipe existing data first
      }
      if (tracking != null) {
        batch.set(ref, tracking);
        bd?.forEach((key, value) {
          batch.set(ref.collection('boss_drops').doc(key), value);
        });
        dm?.forEach((key, value) {
          batch.set(ref.collection('domain_material').doc(key), value);
        });
        ls?.forEach((key, value) {
          batch.set(ref.collection('local_speciality').doc(key), value);
        });
        mb?.forEach((key, value) {
          batch.set(ref.collection('mob_drops').doc(key), value);
        });
      }
      if (ud != null) {
        batch.set(firestore.collection('userdata').doc(uid), ud);
      }
      await batch.commit();
      _safeNotification('Data imported successfully!');
    } catch (e) {
      _safeNotification('Invalid file detected');
      e.printError();

      return;
    }
  }

  void _exportData(BuildContext context) async {
    Util.showSnackbarQuick(context, 'Preparing export...');
    var firestore = FirebaseFirestore.instance;
    var uid = Util.getFirebaseUid();
    if (uid == null) {
      Util.showSnackbarQuick(context, 'Please login first');

      return;
    }

    var obj = <String, dynamic>{};
    obj['version'] = 1; // V1 data

    // Get data from tracking document
    var trackingRef = firestore.collection('tracking').doc(uid);
    var trackingData = await trackingRef.get();
    if (trackingData.exists) {
      obj['tracking'] = trackingData.data();

      // Get all sub-collections in tracking document hardcoded as not available on Flutter
      await trackingRef.collection('boss_drops').get().then((value) {
        if (value.docs.isNotEmpty) {
          obj['item_boss_drops'] = <String, dynamic>{};
          for (var element in value.docs) {
            obj['item_boss_drops'][element.id] = element.data();
          }
        }
      });
      await trackingRef.collection('domain_material').get().then((value) {
        if (value.docs.isNotEmpty) {
          obj['item_domain_material'] = <String, dynamic>{};
          for (var element in value.docs) {
            obj['item_domain_material'][element.id] = element.data();
          }
        }
      });
      await trackingRef.collection('local_speciality').get().then((value) {
        if (value.docs.isNotEmpty) {
          obj['item_local_speciality'] = <String, dynamic>{};
          for (var element in value.docs) {
            obj['item_local_speciality'][element.id] = element.data();
          }
        }
      });
      await trackingRef.collection('mob_drops').get().then((value) {
        if (value.docs.isNotEmpty) {
          obj['item_mob_drops'] = <String, dynamic>{};
          for (var element in value.docs) {
            obj['item_mob_drops'][element.id] = element.data();
          }
        }
      });
    }

    // Get data from userdata document
    var userData = await firestore.collection('userdata').doc(uid).get();
    if (userData.exists) {
      obj['userdata'] = userData.data();
    }

    // Convert to JSON
    var json = jsonEncode(obj);
    debugPrint("JSON: $json");

    // Save to JSON file
    var result = await _saveFile(uid, json);
    if (!result) {
      _safeNotification('Failed to save file');

      return;
    }

    _safeNotification('Data exported successfully');

    return;
  }

  void _safeNotification(String text) {
    if (mounted) {
      Util.showSnackbarQuick(context, text);
    } else {
      debugPrint(text);
    }
  }

  Future<String?> _loadFile() async {
    var filePath = await FilePicker.platform.pickFiles();
    if (filePath != null) {
      if (kIsWeb) {
        var bytes = filePath.files.first.bytes;
        if (bytes != null) {
          return utf8.decode(bytes);
        }
      } else {
        var file = File(filePath.files.single.path!);

        return file.readAsString();
      }
    }

    return null;
  }

  Future<bool> _saveFile(String uid, String json) async {
    var fileName = "userdata-$uid.json";
    var fileData = Uint8List.fromList(json.codeUnits);
    var mimeType = ["application/json"];

    if (kIsWeb) {
      await launchUrl(Uri.parse(
        "data:application/octet-stream;base64,${base64Encode(fileData)}",
      ));

      return true;
    }

    var params = SaveFileDialogParams(
      data: fileData,
      fileName: fileName,
      mimeTypesFilter: mimeType,
    );
    var path = await FlutterFileDialog.saveFile(params: params);

    return path != null;
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
              onPressed: _clearTrackingDataPh,
              child: const Text('Clear'),
            ),
          ],
        );
      },
    );
  }

  void _deletePrompt(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Delete Account'),
          content: const Text(
            '!!!THIS IS NOT REVERSIBLE!!!\n\nClicking delete will cause you to delete your account!\n\nThis will remove all data from the app. You will need to create a new account to use the app again.',
          ),
          actions: [
            TextButton(
              onPressed: () => Get.back(),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: _deleteAccount,
              child: const Text('Delete'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _deleteAccount() async {
    var auth = FirebaseAuth.instance;
    await auth.currentUser?.delete();
    if (mounted) {
      Util.showSnackbarQuick(context, 'Account deleted');
    }
    await Get.offAllNamed('/');
  }

  void _clearTrackingDataPh() async {
    await _clearTrackingData(true, true);
  }

  Future<void> _clearTrackingData(bool alert, bool goBack) async {
    // Clear tracking data by deleting the document
    var uid = Util.getFirebaseUid();
    if (goBack) {
      Get.back();
    }
    if (uid == null) return;
    var db = FirebaseFirestore.instance;
    // Deleting all subcollections
    var ref = db.collection('tracking').doc(uid);
    await TrackingData.clearCollection('boss_drops');
    await TrackingData.clearCollection('domain_material');
    await TrackingData.clearCollection('local_speciality');
    await TrackingData.clearCollection('mob_drops');
    await ref.delete(); // Delete fields
    if (mounted && alert) {
      Util.showSnackbarQuick(context, 'Cleared all tracking information');
    }
  }

  void _clearCache() async {
    var tmp = await getTemporaryDirectory();
    var files = tmp.listSync();
    await FirebaseCacheManager().clearCache();
    debugPrint('Cleared image cache');
    for (var file in files) {
      if (file.path.contains('flutter_cached_image')) {
        debugPrint('Skipping ${file.path}');
      } else {
        debugPrint('Deleting ${file.path}');
        await file.delete(recursive: true);
      }
    }
    if (mounted) {
      Util.showSnackbarQuick(context, 'Cache Cleared');
    }
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
        ListTile(
          leading: const Icon(Icons.bug_report),
          trailing: const SizedBox.shrink(),
          title: const Text('Debug Info'),
          onTap: () => _showDebugInfo(context),
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

  void _showDebugInfo(BuildContext context) async {
    // Alert Dialog
    await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Debug Info'),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Version: $_versionStr'),
              Text('App Check Token: $_appCheckToken'),
              Text('App Check Error: $_appCheckError'),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
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
}

class RegionSettingsPage extends StatefulWidget {
  const RegionSettingsPage({super.key});

  @override
  RegionSettingsPageState createState() => RegionSettingsPageState();
}

class RegionSettingsPageState extends State<RegionSettingsPage> {
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Game Server Location')),
      body: _buildBody(),
    );
  }
}

class BuildGuideSelectorPage extends StatefulWidget {
  const BuildGuideSelectorPage({super.key});

  @override
  BuildGuideSelectorPageState createState() => BuildGuideSelectorPageState();
}

class BuildGuideSelectorPageState extends State<BuildGuideSelectorPage> {
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Build Guide Source')),
      body: _buildBody(),
    );
  }
}

class NotificationDebugPage extends StatelessWidget {
  const NotificationDebugPage({super.key});

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
                    notifyManager.getParametricTransformerMessages(),
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
                  if (context.mounted) {
                    await _showDialog(context, msg);
                  }
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
}
