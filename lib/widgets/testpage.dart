import 'package:flutter/material.dart';
import 'package:model_viewer_plus/model_viewer_plus.dart';

class TestPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Test Page'),
      ),
      body: ModelViewer(
        src: "assets/Fischl_Summer.glb",
        autoRotate: true,
        cameraControls: true,
        environmentImage: "https://modelviewer.dev/shared-assets/environments/music_hall_01_1k.hdr",
        shadowIntensity: 1,
        exposure: 1,
      ),
    );
  }

}