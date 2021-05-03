import L from 'leaflet';
import AbstractLayerTool from '../abstract/AbstractLayerTool';
import DrawingLayerToolState from './DrawingLayerToolState';
import DrawingLayerToolDefaults from './DrawingLayerToolDefaults';
import DrawingLayerToolTabControl from './sidebar/DrawingLayerToolTabControl';
import useDrawingToolbar from './components/useDrawingToolbar';
import union from '@turf/union';
import {
  convertOptionsToProperties,
  convertPropertiesToOptions,
  featureToLeafletCoordinates,
  getGeoJSONFeatureFromLayer,
  getLeafletTypeFromFeature,
  highlightStyles,
  normalStyles,
  getFeatFromLayer,
  isFeaturePoly,
  getSimplifiedPoly,
  isLayerPoly,
  simplifyFeature,
  morphFeatureToPolygon,
} from './util/Poly';

import 'leaflet/dist/leaflet.css';
import './style/drawingLayer.scss';
import difference from '@turf/difference';
import MapCreatedEvent from '../../../model/event/basic/MapCreatedEvent';
import { iconStarter } from './util/Marker';
import { filter } from 'd3-array';
import lineToPolygon from '@turf/line-to-polygon';
import * as turf from '@turf/turf';
import * as martinez from 'martinez-polygon-clipping';
import * as polyClipping from 'polygon-clipping';
import 'leaflet-snap';
import 'leaflet-geometryutil';
import 'leaflet-draw';
import 'proj4leaflet';
import proj4 from 'proj4';

import * as d33 from 'd3-3-5-5';
import Pather from 'leaflet-pather';
import { isEmpty, sortReverseAlpha, sortAlpha } from './util/functionUtils';
import { FIRST, NOT_FOUND, SPACE_BAR } from './util/constants';
import { getCoords } from '@turf/turf';

// ! pather throws errors without this line
window.d3 = d33;

// * as advised in https://github.com/makinacorpus/Leaflet.Snap/issues/52
L.Draw.Feature.include(L.Evented.prototype);
L.Draw.Feature.include(L.Draw.Feature.SnapMixin);
L.Draw.Feature.addInitHook(L.Draw.Feature.SnapMixin._snap_initialize);

export const DRAWING_TOOL_LAYER_TYPE = 'geovisto-tool-layer-drawing';

// proj4.defs('urn:ogc:def:crs:EPSG::3857', '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs ');

/**
 * This class represents Drawing layer tool.
 *
 * @author Andrej Tlcina
 */
class DrawingLayerTool extends AbstractLayerTool {
  /**
   * It creates a new tool with respect to the props.
   *
   * @param {*} props
   */
  constructor(props) {
    super(props);
    useDrawingToolbar();
  }

  /**
   * A unique string of the tool type.
   */
  static TYPE() {
    return DRAWING_TOOL_LAYER_TYPE;
  }

  /**
   * It creates a copy of the uninitialized tool.
   */
  copy() {
    return new DrawingLayerTool(this.getProps());
  }

  /**
   * It creates new defaults of the tool.
   */
  createDefaults() {
    return new DrawingLayerToolDefaults();
  }

  /**
   * It returns default tool state.
   */
  createState() {
    return new DrawingLayerToolState(this);
  }

  /**
   * It returns a tab control.
   */
  getSidebarTabControl() {
    if (this.tabControl == undefined) {
      this.tabControl = this.createSidebarTabControl();
    }
    return this.tabControl;
  }

  redrawSidebarTabControl(layerType, enabled = false) {
    if (this.tabControl == undefined) return;
    this.tabControl.redrawTabContent(layerType, enabled);
  }

  /**
   * It creates new tab control.
   */
  createSidebarTabControl() {
    return new DrawingLayerToolTabControl({ tool: this });
  }

  search() {
    this.redrawSidebarTabControl('search');
  }

  applyEventListeners(layer) {
    layer.on('click', L.DomEvent.stopPropagation).on('click', this.initChangeStyle, this);
    layer.on('mouseover', this.hightlightOnHover, this);
    layer.on('mouseout', this.normalizeOnHover, this);
    if (layer.layerType === 'marker') this.applyTopologyMarkerListeners(layer);
  }

  polyDiff(layer, intersect = false) {
    let selectedLayer = this.getState().selectedLayer;
    let paintPoly = this.getSidebarTabControl().getState().paintPoly;
    let fgLayers = this.getState().featureGroup._layers;

    let layerFeature = getGeoJSONFeatureFromLayer(layer);
    let isCurrentLayerPoly = isLayerPoly(layer);

    // let createdIsNotEraser = layer.layerType !== 'erased';
    let createdIsEraser = layer.layerType === 'erased';

    const replaceLayer = (replacement, replacedLayer, replacementCoords) => {
      replacement?.dragging?.disable();
      replacement.layerType = 'polygon';
      if (replacementCoords) replacement._latlngs = replacementCoords;
      replacement.identifier = replacedLayer.identifier;
      replacement.setStyle({ ...replacement.options, ...normalStyles });
      let content = replacedLayer.popupContent;
      if (content) {
        replacement.bindPopup(content, {
          closeOnClick: false,
          autoClose: false,
        });
        replacement.popupContent = content;
      }
      this.getState().addLayer(replacement);
      this.getState().removeLayer(replacedLayer);
      paintPoly.clearPaintedPolys(replacedLayer.kIdx);
    };

    const diffLayers = (l) => {
      if (!l) return;
      let feature = getGeoJSONFeatureFromLayer(l);

      let layerIsNotSelected = l?._leaflet_id !== selectedLayer?._leaflet_id;
      let canDiff = !createdIsEraser ? true : layerIsNotSelected;
      if (canDiff || intersect) {
        let diffFeature = difference(feature, layerFeature);

        if (diffFeature) {
          let coords;
          let latlngs;
          coords = diffFeature.geometry.coordinates;
          let isMultiPoly = diffFeature.geometry.type === 'MultiPolygon';
          let isJustPoly = diffFeature.geometry.type === 'Polygon';
          // * when substracting you can basically slice polygon into more parts
          // * then we have to increase depth by one because we have an array within array
          let depth = isMultiPoly ? 2 : 1;
          try {
            // * this conditional asks if created polygon is polygon with hole punched in it
            // * for the rest of cases i.e. when polygon is split into multiple parts or not we use loop
            // * otherwise we create polygon where hole should be
            if (isJustPoly && coords.length !== 1) {
              latlngs = L.GeoJSON.coordsToLatLngs(coords, 1);
              let result = new L.polygon(latlngs, {
                ...l.options,
              });
              replaceLayer(result, l);
            } else {
              coords.forEach((coord) => {
                latlngs = L.GeoJSON.coordsToLatLngs([coord], depth);
                let result = new L.polygon(latlngs, {
                  ...l.options,
                });
                let newLatLngs = depth === 1 ? result._latlngs : result._latlngs[FIRST];
                replaceLayer(result, l, newLatLngs);
              });
            }
          } catch (error) {
            console.error({ coords, latlngs, error, depth });
          }
        } else {
          this.getState().removeLayer(l);
          paintPoly.clearPaintedPolys(l.kIdx);
        }
      }
    };

    if (isCurrentLayerPoly) {
      if (intersect && !createdIsEraser) {
        diffLayers(selectedLayer, true);
      } else {
        Object.values(fgLayers)
          .filter((l) => isLayerPoly(l))
          .forEach((l) => {
            diffLayers(l);
          });
      }
    }
  }

  operateOnSelectedAndCurrectLayer = (layer, eKeyIndex, operation, selectNew = false) => {
    let paintPoly = this.getSidebarTabControl().getState().paintPoly;

    let feature = getFeatFromLayer(layer);
    // * gets only first one because MultiPolygon is not expected to be created
    feature = Array.isArray(feature) ? feature[0] : feature;
    let isFeatPoly = isFeaturePoly(feature);
    if (!isFeatPoly) return layer;

    let summedFeature = feature;

    let selectedLayer = this.getState().selectedLayer;
    // * this can be multipolygon whenever user joins 2 unconnected polygons
    let selectedFeatures = getFeatFromLayer(selectedLayer);
    if (!selectedFeatures) return layer;

    selectedFeatures.forEach((selectedFeature) => {
      let isSelectedFeaturePoly = isFeaturePoly(selectedFeature);

      if (isSelectedFeaturePoly) {
        summedFeature = operation(selectedFeature, summedFeature);
      }
    });

    layer = morphFeatureToPolygon(summedFeature, layer.options, false);
    paintPoly.clearPaintedPolys(eKeyIndex);
    if (selectNew) {
      this.getState().removeSelectedLayer();
      this.getState().setSelectedLayer(layer);
    }
    return layer;
  };

  polyIntersect(layer, eKeyIndex) {
    const updatedLayer = this.operateOnSelectedAndCurrectLayer(layer, eKeyIndex, turf.intersect);

    return updatedLayer;
  }

  polyJoin(layer, eKeyIndex) {
    const updatedLayer = this.operateOnSelectedAndCurrectLayer(layer, eKeyIndex, union, true);
    return updatedLayer;
  }

  // inspired by https://gis.stackexchange.com/questions/344068/splitting-a-polygon-by-multiple-linestrings-leaflet-and-turf-js
  polySlice(layer) {
    let lineFeat = getGeoJSONFeatureFromLayer(layer);
    let selectedLayer = this.getState().selectedLayer;

    if (selectedLayer) {
      const THICK_LINE_WIDTH = 0.00001;
      const THICK_LINE_UNITS = 'kilometers';
      let offsetLine;
      let selectedFeature = getGeoJSONFeatureFromLayer(selectedLayer);

      let isFeatPoly = isFeaturePoly(selectedFeature);

      if (isFeatPoly) {
        let coords;
        let latlngs;
        try {
          offsetLine = turf.lineOffset(lineFeat, THICK_LINE_WIDTH, {
            units: THICK_LINE_UNITS,
          });

          let polyCoords = [];
          // * push all of the coordinates of original line
          for (let j = 0; j < lineFeat.geometry.coordinates.length; j++) {
            polyCoords.push(lineFeat.geometry.coordinates[j]);
          }
          // * push all of the coordinates of offset line
          for (let j = offsetLine.geometry.coordinates.length - 1; j >= 0; j--) {
            polyCoords.push(offsetLine.geometry.coordinates[j]);
          }
          // * to create linear ring
          polyCoords.push(lineFeat.geometry.coordinates[0]);

          let thickLineString = turf.lineString(polyCoords);
          let thickLinePolygon = turf.lineToPolygon(thickLineString);
          let clipped = turf.difference(selectedFeature, thickLinePolygon);
          // clipped = simplifyFeature(clipped);

          coords = clipped.geometry.coordinates;
          this.getState().removeSelectedLayer(selectedLayer);
          coords.forEach((coord) => {
            latlngs = L.GeoJSON.coordsToLatLngs(coord, 1);
            let result = new L.polygon(latlngs, {
              ...selectedLayer.options,
              ...normalStyles,
            });
            result.layerType = 'polygon';
            this.getState().addLayer(result);
          });
        } catch (error) {
          console.error({ coords, latlngs, error });
        }
      }
    }
  }

  haveSameVertice(current) {
    const found = this.state.createdVertices.find((vertice) => {
      return (
        (vertice.getLatLngs()[0].equals(current.getLatLngs()[0]) &&
          vertice.getLatLngs()[1].equals(current.getLatLngs()[1])) ||
        (vertice.getLatLngs()[0].equals(current.getLatLngs()[1]) &&
          vertice.getLatLngs()[1].equals(current.getLatLngs()[0]))
      );
    });

    return Boolean(found);
  }

  plotTopology(chosen = null) {
    const selectedLayer = this.getState().selectedLayer;

    const layersObj = this.state.featureGroup._layers;
    const layerArr = [...Object.values(layersObj)];
    const allConnected = layerArr.filter((_) => this.getState().isConnectMarker(_)).reverse();
    const _markers = chosen || allConnected;
    // console.log({ _markers });
    const index = 0;
    const firstMarker = _markers[index];

    const selectedLayerIsConnectMarker = this.getState().selectedLayerIsConnectMarker();

    const secondMarker =
      selectedLayerIsConnectMarker && !chosen ? selectedLayer : _markers[index + 1];
    if (secondMarker) {
      const { lat: fLat, lng: fLng } = firstMarker.getLatLng();
      const { lat: sLat, lng: sLng } = secondMarker.getLatLng();

      let _latlng = [L.latLng(fLat, fLng), L.latLng(sLat, sLng)];
      let poly = new L.polyline(_latlng, {
        color: '#563412',
        weight: 3,
        ...normalStyles,
      });
      poly.layerType = 'vertice';
      if (!this.haveSameVertice(poly)) {
        this.state.pushVertice(poly);
        this.getState().addLayer(poly);
      }
    }

    this.mapMarkersToVertices(_markers);
  }

  mapMarkersToVertices(_markers) {
    console.log({ _markers, mapped: this.state.mappedMarkersToVertices });
    _markers
      .map((marker) => ({ latlng: marker.getLatLng(), lId: marker._leaflet_id, marker }))
      .forEach(({ latlng, lId, marker }) => {
        this.state.createdVertices.forEach((vertice, index) => {
          // * used indexing instead of another loop (vertices have only 2 points)

          let spread = this.state.mappedMarkersToVertices[lId] || {};
          if (vertice.getLatLngs()[0].equals(latlng)) {
            this.getState().setVerticesToMarker(lId, { ...spread, [`${index}-0`]: vertice });
          } else if (vertice.getLatLngs()[1].equals(latlng)) {
            this.getState().setVerticesToMarker(lId, { ...spread, [`${index}-1`]: vertice });
          }
        });
      });
  }

  changeVerticesLocation(latlng, oldlatlng, markerID) {
    console.log({ m: this.state.mappedMarkersToVertices });
    const markerVertices = this.state.mappedMarkersToVertices[markerID];
    if (!markerVertices) return;

    this.setVerticesCoordinates(markerVertices, latlng);
  }

  setVerticesCoordinates(markerVertices, latlng) {
    Object.keys(markerVertices).forEach((key) => {
      let vertice = markerVertices[key];
      let splitKey = key?.split('-');
      let idx = splitKey ? splitKey[1] : undefined;
      if (idx === undefined) return;
      let latLngs = L.LatLngUtil.cloneLatLngs(vertice.getLatLngs());
      latLngs[idx] = latlng;
      vertice.setLatLngs(latLngs);
    });
  }

  createdListener = (e) => {
    let layer = e.layer;
    layer.layerType = e.layerType;
    if (e.keyIndex) layer.kIdx = e.keyIndex;
    const sidebarState = this.getSidebarTabControl().getState();

    const { intersectActivated } = sidebarState;

    if (e.layerType === 'polygon' || e.layerType === 'painted') {
      // * JOIN
      if (intersectActivated) layer = this.polyIntersect(layer, e.keyIndex);
      else layer = this.polyJoin(layer, e.keyIndex);
    }

    if (e.layerType === 'polygon' || e.layerType === 'painted' || e.layerType === 'erased') {
      // * DIFFERENCE
      this.polyDiff(layer, intersectActivated);
    }

    if (layer.dragging) layer.dragging.disable();

    // * SLICE
    if (e.layerType === 'knife') {
      this.polySlice(layer);
      // * restore state
      let enabled = sidebarState.getEnabledEl();
      if (enabled) {
        sidebarState.setEnabledEl(null);
        this.redrawSidebarTabControl();
      }
      const divideBtn = document.querySelector('.drawingtoolbar .divideBtn .extra-btn');
      if (divideBtn) divideBtn.classList.add('hide');
    }

    if (e.layerType !== 'knife' && e.layerType !== 'erased') {
      this.getState().addLayer(layer);
      sidebarState.pushGuideLayer(layer);
    }

    if (e.layerType === 'erased') {
      const map = this.getMap().getState().getLeafletMap();
      map.removeLayer(layer);
      let paintPoly = sidebarState.paintPoly;
      paintPoly.clearPaintedPolys(e.keyIndex);
    }

    // * MARKER
    if (this.getState().isConnectMarker(layer)) {
      this.plotTopology();
    }
  };

  applyTopologyMarkerListeners(layer) {
    layer.on('drag', (event) => {
      const { latlng, oldLatLng, target } = event;

      // console.log({ lat: latlng.lat, lng: latlng.lng, oldlat: oldLatLng.lat, oldlng: oldLatLng.lng });

      this.changeVerticesLocation(latlng, oldLatLng, target._leaflet_id);
    });
  }

  createdPath = (e) => {
    // * get polyline object
    const layer = e.polyline.polyline;

    // * get Leaflet map
    const combinedMap = this.getMap();
    const map = combinedMap.state.map;

    // * get sidebar state and pather object
    const sidebarState = this.getSidebarTabControl().getState();
    const pather = sidebarState.pather;
    // * SLICE
    this.polySlice(layer);

    // * we do not want path to stay
    pather.removePath(layer);
    // * we do not want to keep cutting (drawing)
    map.removeLayer(pather);
    sidebarState.setPatherStatus(false);
    // * restore state
    let enabled = sidebarState.getEnabledEl();
    if (enabled) {
      sidebarState.setEnabledEl(null);
      this.redrawSidebarTabControl();
    }
    const knifeBtn = document.querySelector('.drawingtoolbar .sliceBtn .extra-btn');
    if (knifeBtn) knifeBtn.classList.add('hide');
  };

  /**
   * It creates layer items.
   */
  createLayerItems() {
    console.log('%c ...creating', 'color: #ff5108');
    const map = this.getMap().getState().getLeafletMap();

    this.setGlobalSimplificationTolerance();

    map.addControl(L.control.drawingToolbar({ tool: this }));
    // * eventlistener for when object is created
    map.on('draw:created', this.createdListener);

    map.on('zoomend', () => this.setGlobalSimplificationTolerance());

    map.on('click', () => {
      const sidebar = this.getSidebarTabControl();
      if (Boolean(sidebar.getState().enabledEl)) return;
      if (document.querySelector('.leaflet-container').style.cursor === 'wait') return;
      let selected = this.getState().selectedLayer;
      if (selected) {
        this.normalizeElement(selected);
        this.initNodeEdit(true);
        this.redrawSidebarTabControl();
        this.initTransform(selected, true);
        this.getState().clearSelectedLayer();
        document.querySelector('.leaflet-container').style.cursor = '';
      }
      this.getState().clearExtraSelected();
    });

    document.addEventListener('keydown', (e) => {
      if (e.keyCode === SPACE_BAR) {
        let enabledEl = this.getSidebarTabControl().getState().enabledEl;
        if (enabledEl) {
          enabledEl.disable();
          // map.dragging.enable(); // we do not have to do this, it is already on always
        }
      }
    });
    document.addEventListener('keyup', (e) => {
      if (e.keyCode === SPACE_BAR) {
        let enabledEl = this.getSidebarTabControl().getState().enabledEl;
        if (enabledEl) {
          enabledEl.enable();
          // map.dragging.disable(); // we do not have to do this, it is already on always
        }
      }
    });

    const { pather, guideLayers } = this.getSidebarTabControl().getState();
    pather.on('created', this.createdPath);

    const { featureGroup } = this.getState();
    featureGroup.eachLayer((layer) => {
      layer.addTo(map);
      this.applyEventListeners(layer);
    });
    return [featureGroup];
  }

  setGlobalSimplificationTolerance() {
    const map = window.map;
    const metersPerPixel =
      (40075016.686 * Math.abs(Math.cos((map.getCenter().lat * Math.PI) / 180))) /
      Math.pow(2, map.getZoom() + 8);
    const zoom = map.getZoom();

    // ! this is tried out, so no real calculation
    window.customTolerance = zoom >= 4 ? 0.0001 * metersPerPixel : 1.5;
  }

  highlightElement(el) {
    if (el?._icon) {
      L.DomUtil.addClass(el._icon, 'highlight-marker');
    } else {
      if (el?.setStyle) el.setStyle(highlightStyles);
    }
  }

  hightlightOnHover(e) {
    if (!this.getState().getSelecting()) return;
    this.highlightElement(e.target);
  }

  normalizeElement(el) {
    if (el?._icon) {
      L.DomUtil.removeClass(el._icon, 'highlight-marker');
    } else {
      if (el?.setStyle) el.setStyle(normalStyles);
    }
  }

  normalizeOnHover(e) {
    if (!this.getState().getSelecting()) return;
    const { chosenLayers } = this.getState();
    const isChosen = chosenLayers.map((x) => x._leaflet_id).includes(e.target._leaflet_id);
    if (isChosen) return;
    this.normalizeElement(e.target);
  }

  getSummedFeature = (features) => {
    if (!features || !Array.isArray(features)) return null;

    let summedFeature = features[0];
    for (let index = 1; index < features.length; index++) {
      const feature = features[index];
      let isfeaturePoly = isFeaturePoly(feature);

      if (isfeaturePoly) {
        summedFeature = union(feature, summedFeature);
      }
    }

    return summedFeature;
  };

  joinChosen = (drawObject) => {
    const layerState = this.getState();
    const unfit = !layerState.canPushToChosen(drawObject);
    if (unfit) return;
    layerState.pushChosenLayer(drawObject);
    if (layerState.chosenLayersMaxed()) {
      if (layerState.chosenLayersArePolys()) {
        const { chosenLayers } = layerState;
        const chosenFeatures = chosenLayers
          .filter((c) => isLayerPoly(c))
          .map((chosen) => getFeatFromLayer(chosen));

        if (chosenFeatures.length !== chosenLayers.length) return;

        const first = this.getSummedFeature(chosenFeatures[0]);
        const second = this.getSummedFeature(chosenFeatures[1]);

        const resultFeature = union(first, second);
        const opts = { ...chosenLayers[0].options, ...chosenLayers[1].options };
        const result = morphFeatureToPolygon(resultFeature, opts, false);
        layerState.pushJoinedToChosenLayers(result);

        this.redrawSidebarTabControl(drawObject.layerType);
      }
      if (layerState.chosenLayersAreMarkers()) {
        const { chosenLayers } = layerState;

        this.plotTopology(chosenLayers);

        layerState.deselectChosenLayers();
        layerState.clearChosenLayers();

        this.redrawSidebarTabControl(null);
      }
    }
  };

  initChangeStyle = (e) => {
    const drawObject = e.target;
    const state = this.getState();

    const selecting = state.getSelecting();
    if (selecting) {
      this.joinChosen(drawObject);
      return;
    }

    if (e?.originalEvent?.ctrlKey && state.selectedLayer) {
      state.addExtraSelected(drawObject);
      return;
    }

    let fgLayers = state.featureGroup._layers;
    Object.values(fgLayers).forEach((_) => {
      this.normalizeElement(_);
      _?.dragging?.disable();
      if (_?.transform?._enabled) {
        _.transform.disable();
        let paintPoly = this.getSidebarTabControl().getState().paintPoly;
        paintPoly.updatePaintedPolys(_.kIdx, _);
      }
    });
    state.setSelectedLayer(drawObject);
    this.initTransform(drawObject);
    this.redrawSidebarTabControl(drawObject.layerType);
    // TODO:
    this.tabControl.state.callIdentifierChange(true);

    document.querySelector('.leaflet-container').style.cursor = '';
    // * at this point user clicked without holdin 'CTRL' key
    // state.clearExtraSelected();
  };

  initTransform(drawObject, disable = false) {
    const layer = drawObject;
    if (layer?.transform) {
      if (layer.transform._enabled || disable) {
        layer.transform.disable();
        layer.dragging.disable();
        let paintPoly = this.getSidebarTabControl().getState().paintPoly;
        paintPoly.updatePaintedPolys(layer.kIdx, layer);
      } else {
        layer.transform.enable({ rotation: true, scaling: true });
        layer.dragging.enable();
      }
    } else if (layer.layerType === 'marker') {
      if (layer.dragging._enabled || disable) {
        layer.dragging.disable();
      } else {
        layer.dragging.enable();
      }
    }
  }

  initNodeEdit(disable = false) {
    const selectedLayer = this.getState().selectedLayer;

    if (selectedLayer?.editing) {
      if (selectedLayer.editing._enabled || disable) {
        selectedLayer.editing.disable();
        // let paintPoly = this.options.tool.getSidebarTabControl().getState().paintPoly;
        // paintPoly.updatePaintedPolys(layer.kIdx, layer);
      } else {
        selectedLayer.editing.enable();
      }
    }
  }

  removeElement() {
    const selectedLayer = this.getState().selectedLayer;
    if (this.getState().selectedLayerIsConnectMarker()) {
      this.getState().removeMarkersMappedVertices(selectedLayer._leaflet_id);
    }
    if (selectedLayer.layerType === 'vertice') {
      this.getState().removeGivenVertice(selectedLayer._leaflet_id);
    }
    let paintPoly = this.getSidebarTabControl().getState().paintPoly;
    paintPoly.clearPaintedPolys(selectedLayer.kIdx);
    this.getState().removeSelectedLayer();
    this.redrawSidebarTabControl(null);
  }

  initSelecting = () => {
    const selecting = this.getState().getSelecting();
    this.getState().setSelecting(!selecting);
    if (!selecting) document.querySelector('.leaflet-container').style.cursor = 'crosshair';
    else document.querySelector('.leaflet-container').style.cursor = '';
  };

  divideEqual = () => {
    const { selectedLayer } = this.getState();
    if (!selectedLayer) return;
    if (!isLayerPoly(selectedLayer)) return;

    const polygonFeat = selectedLayer.toGeoJSON();
    const polygonBbox = turf.bbox(polygonFeat);
    const area = turf.area(polygonFeat);
    const options = { units: 'meters' };
    var from = turf.point([polygonBbox[0], polygonBbox[1]]);
    var to = turf.point([polygonBbox[2], polygonBbox[3]]);

    var distance = turf.distance(from, to, options);
    console.log({ distance });
    const cellSide = 50;

    const squareGrid = turf.squareGrid(polygonBbox, cellSide, options);
    // squareGrid.features.forEach((feat) => {
    //   let latlngs = L.GeoJSON.coordsToLatLngs(feat.geometry.coordinates, 1);
    //   let newPoly = new L.polygon(latlngs);
    //   this.getState().addLayer(newPoly);
    // });
  };

  /**
   * This function is called when layer items are rendered.
   */
  postCreateLayerItems() {}

  /**
   * It reloads data and redraw the layer.
   */
  redraw(onlyStyle) {
    console.log('%c ...redrawing', 'color: #08ff51');
  }

  /**
   * This function is called when a custom event is invoked.
   *
   * @param {AbstractEvent} event
   */
  handleEvent(event) {}
}

export default DrawingLayerTool;
