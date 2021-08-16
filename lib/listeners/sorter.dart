import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class SortNotifier extends ChangeNotifier {
  static String _sortKey = '';
  static bool _descending = false;

  void updateSortKey(String newKey, bool isDescending) {
    if (newKey == '') newKey = null;
    _sortKey = newKey;
    _descending = isDescending;
    notifyListeners();
  }

  String getSortKey() {
    return _sortKey;
  }

  bool isDescending() {
    return _descending;
  }
}

class SortBy {
  final SortNotifier _internalSorter;

  List<PopupMenuEntry> _sorter;
  List<PopupMenuEntry> _charOnlySorter;
  List<PopupMenuEntry> _weaponOnlySorter;

  SortBy(this._internalSorter);

  List<PopupMenuEntry> getSortList(int index) {
    _refreshData();
    var finalizedSortList = List<PopupMenuEntry>.of(_sorter);
    switch (index) {
      case 0:
        finalizedSortList.addAll(_charOnlySorter);
        break;
      case 1:
        finalizedSortList.addAll(_weaponOnlySorter);
        break;
    }

    return finalizedSortList;
  }

  Color _matchColor(String key) {
    if (key != _internalSorter.getSortKey()) {
      return Get.theme.textTheme.bodyText1.color;
    }

    return Get.theme.accentColor;
  }

  PopupMenuItem _getSorterMenuWidget(String type, String title, bool isNumber) {
    return PopupMenuItem(
      textStyle: TextStyle(color: _matchColor(type)),
      value: type,
      child: Row(
        children: [
          Text(title),
          Spacer(),
          Icon(
            _getSortingData(isNumber, type),
            color: _matchColor(type),
          ),
        ],
      ),
    );
  }

  List<PopupMenuEntry<dynamic>> _getCharSorter() {
    return [
      _getSorterMenuWidget('weapon', 'Weapon Type', false),
      _getSorterMenuWidget('affiliation', 'Affiliation', false),
      _getSorterMenuWidget('gender', 'Gender', false),
      _getSorterMenuWidget('nation', 'Nation', false),
    ];
  }

  List<PopupMenuEntry<dynamic>> _getWeaponSorter() {
    return [
      _getSorterMenuWidget('base_atk', 'Base Attack', true),
      _getSorterMenuWidget('secondary_stat_type', 'Secondary Stats', false),
    ];
  }

  void _refreshData() {
    _sorter = [
      PopupMenuItem(
        textStyle: TextStyle(color: _matchColor(null)),
        value: '',
        child: Row(
          children: [Text('Default'), Spacer()],
        ),
      ),
      _getSorterMenuWidget('rarity', 'Rarity', true),
    ];

    _charOnlySorter = _getCharSorter();

    _weaponOnlySorter = _getWeaponSorter();
  }

  IconData _getSortingData(bool number, String key) {
    if (!number) {
      if (key != _internalSorter.getSortKey()) {
        return Icons.sort_by_alpha;
      } else if (_internalSorter.isDescending()) {
        return MdiIcons.sortAlphabeticalDescendingVariant;
      } else {
        return MdiIcons.sortAlphabeticalAscendingVariant;
      }
    } else {
      if (key != _internalSorter.getSortKey()) {
        return MdiIcons.sortNumericVariant;
      } else if (_internalSorter.isDescending()) {
        return MdiIcons.sortNumericDescendingVariant;
      } else {
        return MdiIcons.sortNumericAscendingVariant;
      }
    }
  }
}
