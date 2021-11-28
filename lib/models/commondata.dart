class CommonData {
  String? name;
  int? rarity;
  String? image;
  String? description;
  String? wiki;
  bool? crossover;

  CommonData({
    this.name,
    this.rarity,
    this.image,
    this.description,
    this.wiki,
    this.crossover = false,
  });
}

class CommonAscension {
  int? level;
  String? material1;
  int? material1Qty;
  String? material2;
  int? material2Qty;
  String? material3;
  int? material3Qty;
  int? mora;

  CommonAscension({
    this.level,
    this.material1,
    this.material1Qty,
    this.material2,
    this.material2Qty,
    this.material3,
    this.material3Qty,
    this.mora,
  });
}

class CommonTracking {
  int? current;
  int? max;
  String? name;
  String? type;

  CommonTracking({this.current, this.max, this.name, this.type});

  @override
  String toString() {
    return 'CommonTracking{ name: $name, type: $type, current: $current, max: $max }';
  }
}
