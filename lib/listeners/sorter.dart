import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class SortNotifier extends ChangeNotifier {
  static String _sortKey = "";
  static bool _descending = false;

  void updateSortKey(String newKey, bool isDescending) {
    if (newKey == "") newKey = null;
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
  SortBy(this._internalSorter);

  final SortNotifier _internalSorter;

  Color _matchColor(String key) {
    if (key != _internalSorter.getSortKey()) return Get.theme.textTheme.bodyText1.color;
    return Get.theme.accentColor;
  }

  void _refreshData() {
    _sorter = [
      PopupMenuItem(
        textStyle: TextStyle(color: _matchColor(null)),
        value: "",
        child: Row(
          children: [
            Text("Default"),
            Spacer(),
            Icon(_getSortingData(false, null), color: _matchColor(null))
          ],
        ),
      ),
      PopupMenuItem(
        textStyle: TextStyle(color: _matchColor("rarity")),
        value: "rarity",
        child: Row(
          children: [
            Text("Rarity"),
            Spacer(),
            Icon(_getSortingData(true, "rarity"), color: _matchColor("rarity"))
          ],
        ),
      ),
    ];

    _charOnlySorter = [
      PopupMenuItem(
        textStyle: TextStyle(color: _matchColor("weapon")),
        value: "weapon",
        child: Row(
          children: [
            Text("Weapon Type"),
            Spacer(),
            Icon(_getSortingData(false, "weapon"), color: _matchColor("weapon"))
          ],
        ),
      ),
      PopupMenuItem(
        textStyle: TextStyle(color: _matchColor("affiliation")),
        value: "affiliation",
        child: Row(
          children: [
            Text("Affiliation"),
            Spacer(),
            Icon(_getSortingData(false, "affiliation"), color: _matchColor("affiliation"))
          ],
        ),
      ),
      PopupMenuItem(
        textStyle: TextStyle(color: _matchColor("gender")),
        value: "gender",
        child: Row(
          children: [
            Text("Gender"),
            Spacer(),
            Icon(_getSortingData(false, "gender"), color: _matchColor("gender"))
          ],
        ),
      ),
      PopupMenuItem(
        textStyle: TextStyle(color: _matchColor("nation")),
        value: "nation",
        child: Row(
          children: [
            Text("Nation"),
            Spacer(),
            Icon(_getSortingData(false, "nation"), color: _matchColor("nation"))
          ],
        ),
      ),
    ];

    _weaponOnlySorter = [
      PopupMenuItem(
        textStyle: TextStyle(color: _matchColor("base_atk")),
        value: "base_atk",
        child: Row(
          children: [
            Text("Base Attack"),
            Spacer(),
            Icon(_getSortingData(true, "base_atk"), color: _matchColor("base_atk"))
          ],
        ),
      ),
      PopupMenuItem(
        textStyle: TextStyle(color: _matchColor("secondary_stat_type")),
        value: "secondary_stat_type",
        child: Row(
          children: [
            Text("Secondary Stats"),
            Spacer(),
            Icon(_getSortingData(false, "secondary_stat_type"), color: _matchColor("secondary_stat_type"))
          ],
        ),
      ),
    ];
  }

  List<PopupMenuEntry> getSortList(int index) {
    _refreshData();
    List<PopupMenuEntry> finalizedSortList = List.of(_sorter);
    switch (index) {
      case 1:
        finalizedSortList.addAll(_charOnlySorter);
        break;
      case 2:
        finalizedSortList.addAll(_weaponOnlySorter);
        break;
    }
    return finalizedSortList;
  }

  IconData _getSortingData(bool number, String key) {
    if (!number) {
      if (key != _internalSorter.getSortKey())
        return Icons.sort_by_alpha;
      else if (_internalSorter.isDescending())
        return MdiIcons.sortAlphabeticalDescendingVariant;
      else
        return MdiIcons.sortAlphabeticalAscendingVariant;
    } else {
      if (key != _internalSorter.getSortKey())
        return MdiIcons.sortNumericVariant;
      else if (_internalSorter.isDescending())
        return MdiIcons.sortNumericDescendingVariant;
      else
        return MdiIcons.sortNumericAscendingVariant;
    }
  }

  List<PopupMenuEntry> _sorter;
  List<PopupMenuEntry> _charOnlySorter;
  List<PopupMenuEntry> _weaponOnlySorter;
}
