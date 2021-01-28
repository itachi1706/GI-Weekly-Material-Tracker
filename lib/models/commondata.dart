class CommonData {
  String name;
  int rarity;
  String image;
  String description;

  CommonData({this.name, this.rarity, this.image, this.description});
}

class CommonAscension {
  int level;
  String material1;
  int material1Qty;
  String material2;
  int material2Qty;
  String material3;
  int material3Qty;
  int mora;

  CommonAscension(
      {this.level,
      this.material1,
      this.material1Qty,
      this.material2,
      this.material2Qty,
      this.material3,
      this.material3Qty,
      this.mora});
}
