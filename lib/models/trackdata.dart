import 'package:gi_weekly_material_tracker/models/commondata.dart';

class TrackingUserInfo {
  List<String>? character;
  List<String>? material;
  List<String>? weapon;
  List<String>? talent;

  TrackingUserInfo({this.character, this.material, this.weapon, this.talent});

  factory TrackingUserInfo.fromJson(Map<String, dynamic>? parsedJson) {
    if (parsedJson == null) {
      return TrackingUserInfo(character: null, material: null, weapon: null);
    }

    return TrackingUserInfo(
      character: (parsedJson.containsKey('character'))
          ? (parsedJson['character'] as List<dynamic>)
              .map((e) => e.toString())
              .toSet()
              .toList()
          : null,
      material: (parsedJson.containsKey('material'))
          ? (parsedJson['material'] as List<dynamic>)
              .map((e) => e.toString())
              .toSet()
              .toList()
          : null,
      weapon: (parsedJson.containsKey('weapon'))
          ? (parsedJson['weapon'] as List<dynamic>)
              .map((e) => e.toString())
              .toSet()
              .toList()
          : null,
      talent: (parsedJson.containsKey('talents'))
          ? (parsedJson['talents'] as List<dynamic>)
              .map((e) => e.toString())
              .toSet()
              .toList()
          : null,
    );
  }
}

class TrackingUserData extends CommonTracking {
  String? addData;
  String? addedBy;

  TrackingUserData(
      {this.addData,
      this.addedBy,
      super.current,
      super.max,
      super.name,
      super.type})
      : super();

  factory TrackingUserData.fromJson(Map<String, dynamic> parsedJson) {
    return TrackingUserData(
      addData: parsedJson['addData'],
      addedBy: parsedJson['addedBy'],
      current: parsedJson['current'],
      max: parsedJson['max'],
      name: parsedJson['name'],
      type: parsedJson['type'],
    );
  }

  static Map<String, TrackingUserData> getList(Map<String, dynamic> list) {
    var fin = <String, TrackingUserData>{};
    list.forEach((key, value) {
      fin.putIfAbsent(key, () => TrackingUserData.fromJson(value));
    });

    return fin;
  }

  @override
  String toString() {
    return 'TrackingUserData{ name: $name, type: $type, addData: $addData, addedBy: $addedBy, current: $current, max: $max }';
  }
}
