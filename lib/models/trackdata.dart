import 'package:gi_weekly_material_tracker/models/commondata.dart';

class TrackingUserInfo {
  List<String> character;
  List<String> material;
  List<String> weapon;

  TrackingUserInfo({this.character, this.material, this.weapon});

  factory TrackingUserInfo.fromJson(Map<String, dynamic> parsedJson) {
    return TrackingUserInfo(
      character: (parsedJson['character'] as List<dynamic>)
          .map((e) => e.toString())
          .toSet()
          .toList(),
      material: (parsedJson['material'] as List<dynamic>)
          .map((e) => e.toString())
          .toSet()
          .toList(),
      weapon: (parsedJson['weapon'] as List<dynamic>)
          .map((e) => e.toString())
          .toSet()
          .toList(),
    );
  }
}

class TrackingUserData extends CommonTracking {
  String addData;
  String addedBy;

  TrackingUserData({this.addData, this.addedBy, current, max, name, type})
      : super(current: current, max: max, name: name, type: type);

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

  static Map<String, TrackingUserData> getList(
      Map<String, dynamic> listString) {
    Map<String, TrackingUserData> _fin = new Map();
    listString.forEach((key, value) {
      _fin.putIfAbsent(key, () => TrackingUserData.fromJson(value));
    });
    return _fin;
  }

  @override
  String toString() {
    return "TrackingUserData{ name: $name, type: $type, addData: $addData, addedBy: $addedBy, current: $current, max: $max }";
  }
}
