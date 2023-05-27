import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:model_viewer_plus/model_viewer_plus.dart';

class CostumeData {
  String name;
  String gsUrl;

  CostumeData({
    required this.name,
    required this.gsUrl,
  });

  Map<String, dynamic> toJson() => {
    'name': name,
    'gsUrl': gsUrl,
  };

  CostumeData.fromJson(Map<String, dynamic> json) : name = json['name'], gsUrl = json['gsUrl'];
}

class TestPage extends StatelessWidget {

  final List<CostumeData> _costumesList = [
    CostumeData(name: "Aether", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Aether.glb"),
    CostumeData(name: "Albedo", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Albedo.glb"),
    CostumeData(name: "Amber", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Amber.glb"),
    CostumeData(name: "Ayaka", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Ayaka.glb"),
    CostumeData(name: "Ayato", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Ayato.glb"),
    CostumeData(name: "Babara", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Babara.glb"),
    CostumeData(name: "Babara (Summer Island)", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Babara_Summer.glb"),
    CostumeData(name: "Beidou", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Beidou.glb"),
    CostumeData(name: "Bennett", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Bennett.glb"),
    CostumeData(name: "Chongyun", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Chongyun.glb"),
    CostumeData(name: "Collei", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Collei.glb"),
    CostumeData(name: "Diluc", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Diluc.glb"),
    CostumeData(name: "Diluc (Delusion)", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Diluc_Summer.glb"),
    CostumeData(name: "Diona", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Diona.glb"),
    CostumeData(name: "Dori", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Dori.glb"),
    CostumeData(name: "Eula", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Eula.glb"),
    CostumeData(name: "Fischl", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Fischl.glb"),
    CostumeData(name: "Fischl (Summer Island)", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Fischl_Summer.glb"),
    CostumeData(name: "Ganyu", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Ganyu.glb"),
    CostumeData(name: "Gorou", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Gorou.glb"),
    CostumeData(name: "Heizou", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Heizou.glb"),
    CostumeData(name: "Hilichurl", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Hilichurl.glb"),
    CostumeData(name: "Hu Tao", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Hu%20Tao.glb"),
    CostumeData(name: "Itto", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Itto.glb"),
    CostumeData(name: "Jean", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Jean.glb"),
    CostumeData(name: "Jean (Summer Island)", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Jean_Summer.glb"),
    CostumeData(name: "Kaeya", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Kaeya.glb"),
    CostumeData(name: "Kazuha", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Kazuha.glb"),
    CostumeData(name: "Keqing", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Keqing.glb"),
    CostumeData(name: "Keqing (Lantern Rite)", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Keqing_Lunar.glb"),
    CostumeData(name: "Klee", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Klee.glb"),
    CostumeData(name: "Kokomi", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Kokomi.glb"),
    CostumeData(name: "Kujou Sara", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Kujou%20Sara.glb"),
    CostumeData(name: "Kuki Shinobu", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Kuki%20Shinobu.glb"),
    CostumeData(name: "Lisa", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Lisa.glb"),
    CostumeData(name: "Lumine", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Lumine.glb"),
    CostumeData(name: "Mona", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Mona.glb"),
    CostumeData(name: "Mona (Alternate)", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Mona_Alt.glb"),
    CostumeData(name: "Ningguang", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Ningguang.glb"),
    CostumeData(name: "Ningguang (Lantern Rite)", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Ningguang_Lunar.glb"),
    CostumeData(name: "Noelle", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Noelle.glb"),
    CostumeData(name: "Paimon", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Paimon.glb"),
    CostumeData(name: "Qiqi", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Qiqi.glb"),
    CostumeData(name: "Raiden Shogun", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Raiden%20Shogun.glb"),
    CostumeData(name: "Sayu", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Sayu.glb"),
    CostumeData(name: "Shenhe", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Shenhe.glb"),
    CostumeData(name: "Sucrose", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Sucrose.glb"),
    CostumeData(name: "Tartaglia", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Tartaglia.glb"),
    CostumeData(name: "Thoma", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Thoma.glb"),
    CostumeData(name: "Tighnari", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Tighnari.glb"),
    CostumeData(name: "Unusual Hilichurl", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Unusual%20Hilichurl.glb"),
    CostumeData(name: "Venti", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Venti.glb"),
    CostumeData(name: "Xiangling", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Xiangling.glb"),
    CostumeData(name: "Xiao", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Xiao.glb"),
    CostumeData(name: "Xingqiu", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Xingqiu.glb"),
    CostumeData(name: "Xinyan", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Xinyan.glb"),
    CostumeData(name: "Yae Miko", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Yae%20Miko.glb"),
    CostumeData(name: "Yelan", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Yelan.glb"),
    CostumeData(name: "Yoimiya", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Yoimiya.glb"),
    CostumeData(name: "Yun Jin", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Yun_Jin.glb"),
    CostumeData(name: "Zhongli", gsUrl: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/Zhongli.glb"),
  ];

  TestPage({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Costume List (ALPHA)'),
      ),
      body: ListView.separated(
        shrinkWrap: true,
        itemCount: _costumesList.length,
        itemBuilder: (context, index) {
          var key = _costumesList[index];

          return ListTile(
            onTap: () {
              // Convert to base64
              Codec<String, String> stringToBase64 = utf8.fuse(base64);
              String cosStr = jsonEncode(key);
              String encodedCostume = stringToBase64.encode(cosStr);
              Get.toNamed("/test3d/$encodedCostume");
            },
            title: Text(key.name),
          );
        },
        separatorBuilder: (context, index) => const Divider(height: 1),
      ),
    );
  }
}

class ThreeDViewerPage extends StatefulWidget {
  const ThreeDViewerPage({Key? key}) : super(key: key);

  @override
  ThreeDViewerPageState createState() => ThreeDViewerPageState();
}

class ThreeDViewerPageState extends State<ThreeDViewerPage> {

  @override
  Widget build(BuildContext context) {
    var appname = "";
    if (_costumeData != null) appname = _costumeData!.name;
    return Scaffold(
      appBar: AppBar(
        title: Text("3D Model - $appname (ALPHA)"),
      ),
      body: _buildModel(),
    );
  }

  Widget _buildModel() {
    if (_costumeData == null) {
      return const Center(
        child: Text('No URL Found'),
      );
    } else {
      return ModelViewer(
        src: _costumeData!.gsUrl,
        alt: _costumeData!.name,
        autoRotate: true,
        cameraControls: true,
        disablePan: false,
        ar: true,
        arModes: ['scene-viewer', 'webxr', 'quick-look'],
        environmentImage: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/music_hall_01_1k.hdr",
        shadowIntensity: 1,
        exposure: 1,
      );
    }
  }

  CostumeData? _costumeData;

  @override
  void initState() {
    super.initState();
    String? costumeString = Get.parameters['costume'];
    if (costumeString != null) {
      Codec<String, String> stringToBase64 = utf8.fuse(base64);
      String decodedCostume = stringToBase64.decode(costumeString);
      Map<String, dynamic> cosMap = jsonDecode(decodedCostume);
      CostumeData costume = CostumeData.fromJson(cosMap);
      setState(() {
        _costumeData = costume;
      });
      debugPrint("Processing ${costume.name}");
    }
  }
}