import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/listeners/sorter.dart';
import 'package:gi_weekly_material_tracker/models/grid.dart';
import 'package:gi_weekly_material_tracker/models/materialdata.dart';
import 'package:gi_weekly_material_tracker/models/tracker.dart';
import 'package:gi_weekly_material_tracker/util.dart';

final FirebaseFirestore _db = FirebaseFirestore.instance;

class MaterialTabController extends StatefulWidget {
  MaterialTabController({Key key, @required this.tabController, this.notifier})
      : super(key: key);

  final TabController tabController;
  final SortNotifier notifier;

  @override
  _MaterialTabControllerState createState() => _MaterialTabControllerState();
}

class _MaterialTabControllerState extends State<MaterialTabController> {
  @override
  Widget build(BuildContext context) {
    return TabBarView(controller: widget.tabController, children: [
      MaterialListGrid(notifier: widget.notifier),
      MaterialListGrid(filter: "boss_drops", notifier: widget.notifier),
      MaterialListGrid(filter: "domain_forgery", notifier: widget.notifier),
      MaterialListGrid(filter: "mob_drops", notifier: widget.notifier),
      MaterialListGrid(filter: "local_speciality", notifier: widget.notifier),
    ]);
  }
}

class MaterialListGrid extends StatefulWidget {
  MaterialListGrid({Key key, this.filter, this.notifier});

  final String filter;
  final SortNotifier notifier;

  @override
  _MaterialListGridState createState() => _MaterialListGridState();
}

class _MaterialListGridState extends State<MaterialListGrid> {
  String _sorter;
  bool _isDescending = false;

  @override
  void initState() {
    super.initState();
    widget.notifier.addListener(() {
      if (!mounted) return;
      setState(() {
        _sorter = widget.notifier.getSortKey();
        _isDescending = widget.notifier.isDescending();
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    CollectionReference materialRef = _db.collection('materials');
    Query queryRef;
    if (widget.filter != null)
      queryRef = materialRef.where("innerType", isEqualTo: widget.filter);
    if (_sorter != null && queryRef == null)
      queryRef = materialRef
          .orderBy(_sorter, descending: _isDescending)
          .orderBy(FieldPath.documentId);
    else if (_sorter != null)
      queryRef = queryRef
          .orderBy(_sorter, descending: _isDescending)
          .orderBy(FieldPath.documentId);
    return StreamBuilder(
        stream:
            (queryRef == null) ? materialRef.snapshots() : queryRef.snapshots(),
        builder: (context, AsyncSnapshot<QuerySnapshot> snapshot) {
          if (snapshot.hasError) {
            return Text("Error occurred getting snapshot");
          }

          if (snapshot.connectionState == ConnectionState.waiting) {
            return Util.centerLoadingCircle("");
          }

          if (widget.filter == null)
            GridData.setStaticData("materials", snapshot.data);

          return GridView.count(
            crossAxisCount:
                (Get.context.orientation == Orientation.portrait) ? 3 : 6,
            children: snapshot.data.docs.map((document) {
              return GestureDetector(
                onTap: () => Get.toNamed('/materials/${document.id}'),
                child: GridData.getGridData(
                    MaterialDataCommon.fromJson(document.data())),
              );
            }).toList(),
          );
        });
  }
}

class MaterialInfoPage extends StatefulWidget {
  @override
  _MaterialInfoPageState createState() => _MaterialInfoPageState();
}

class _MaterialInfoPageState extends State<MaterialInfoPage> {
  MaterialDataCommon _info;
  String _infoId;

  Color _rarityColor;

  bool _isAdded = false;
  bool _addCheckObtained = false;

  @override
  void initState() {
    super.initState();
    _infoId = Get.parameters['material'];
    GridData.retrieveMaterialsMapData().then((value) {
      setState(() {
        _info = value[_infoId];
        _rarityColor = GridData.getRarityColor(_info.rarity);
      });
      _refreshTrackingStatus();
    });
  }

  void _refreshTrackingStatus() {
    setState(() {
      if (!mounted) return;
      _addCheckObtained = false;
    });
    TrackingData.isBeingTracked('material', _infoId)
        .then((isTracked) => setState(() {
              if (!mounted) return;
              _isAdded = isTracked;
              _addCheckObtained = true;
            }));
  }

  Widget _getFabWidget() {
    if (!_addCheckObtained) return CircularProgressIndicator();
    if (_isAdded)
      return Icon(
        Icons.remove,
        color: Colors.white,
      );
    else
      return Icon(
        Icons.add,
        color: Colors.white,
      );
  }

  String _cntTrack = "";
  TextEditingController _textEditingController = TextEditingController();

  void _trackMaterialAction() {
    int toTrack = int.tryParse(_cntTrack) ?? 0;
    TrackingData.addToRecord('material', _infoId).then((value) {
      _refreshTrackingStatus();
      Util.showSnackbarQuick(context, "${_info.name} added to tracker!");
    });
    TrackingData.addToCollection("Material_$_infoId", _infoId, toTrack,
        _info.innerType, 'material', null);
    Navigator.of(context).pop();
  }

  void _untrackMaterialAction() {
    TrackingData.removeFromRecord('material', _infoId).then((value) {
      _refreshTrackingStatus();
      Util.showSnackbarQuick(context, "${_info.name} removed from tracker!");
    });
    TrackingData.removeFromCollection("Material_$_infoId", _info.innerType);
    Navigator.of(context).pop();
  }

  void _addOrRemoveMaterial() async {
    if (!_addCheckObtained) {
      Util.showSnackbarQuick(context, "Checking tracking status");
      return;
    }

    if (_isAdded) {
      showDialog(
        context: context,
        builder: (context) {
          return AlertDialog(
            title: Text("Remove ${_info.name} from the tracker?"),
            content: SingleChildScrollView(
              child: ListBody(
                children: [
                  GridData.getImageAssetFromFirebase(_info.image, height: 64),
                  Text(
                      "This will remove the currently tracked data for this material from the tracker"),
                ],
              ),
            ),
            actions: [
              TextButton(
                child: Text('Cancel'),
                onPressed: () => Navigator.of(context).pop(),
              ),
              TextButton(
                child: Text('Untrack'),
                onPressed: _untrackMaterialAction,
              ),
            ],
          );
        },
      );
    } else {
      showDialog(
        context: context,
        builder: (context) {
          return AlertDialog(
            title: Text("Add ${_info.name} to the tracker?"),
            content: SingleChildScrollView(
              child: ListBody(
                children: [
                  GridData.getImageAssetFromFirebase(_info.image, height: 64),
                  TextField(
                    onChanged: (newValue) {
                      setState(() {
                        _cntTrack = newValue;
                      });
                    },
                    controller: _textEditingController,
                    decoration: InputDecoration(labelText: "Quantity to track"),
                    keyboardType: TextInputType.number,
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                child: Text('Cancel'),
                onPressed: () => Navigator.of(context).pop(),
              ),
              TextButton(
                child: Text('Track'),
                onPressed: _trackMaterialAction,
              ),
            ],
          );
        },
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_info == null) return Util.loadingScreen();
    return Scaffold(
      appBar: AppBar(
        title: Text(_info.name),
        backgroundColor: _rarityColor,
        actions: [
          IconButton(
            icon: Icon(Icons.info_outline),
            onPressed: () => GridData.launchWikiUrl(context, _info),
            tooltip: "View Wiki",
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        child: _getFabWidget(),
        backgroundColor: _rarityColor,
        onPressed: _addOrRemoveMaterial,
      ),
      body: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          children: [
            Row(
              children: [
                GridData.getImageAssetFromFirebase(_info.image, height: 64),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: MediaQuery.of(context).size.width - 128,
                      child: Text(
                        _info.type,
                        textAlign: TextAlign.start,
                        style: TextStyle(fontSize: 20),
                      ),
                    ),
                    RatingBar.builder(
                      ignoreGestures: true,
                      itemCount: 5,
                      itemSize: 30,
                      initialRating: double.tryParse(_info.rarity.toString()),
                      itemBuilder: (context, _) =>
                          Icon(Icons.star, color: Colors.amber),
                      onRatingUpdate: (rating) {
                        print(rating);
                      },
                    ),
                  ],
                ),
              ],
            ),
            Divider(),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Row(
                children: [
                  Icon(Icons.location_pin),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(left: 8, right: 8),
                      child: Text(_info.obtained
                          .replaceAll('\\n', "\n")
                          .replaceAll("- ", "")),
                    ),
                  ),
                ],
              ),
            ),
            Divider(),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Row(
                children: [
                  Icon(Icons.format_list_bulleted),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(left: 8, right: 8),
                      child: Text(_info.description.replaceAll('\\n', "\n")),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
