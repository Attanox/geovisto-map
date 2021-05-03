import AbstractToolsManager from '../model/tool/abstract/AbstractToolsManager';
import AbstractMapData from '../model/data/AbstractMapData';
import AbstractMapObjectState from '../model/object/abstract/AbstractMapObjectState';
import AbstractMapConfig from '../model/config/AbstractMapConfig';
import { DRAWING_TOOL_LAYER_TYPE } from '../tools/layers/drawing/DrawingLayerTool';

/**
 * This class manages state of the map.
 * It wraps the state since the map can work with state objects which needs to be explicitly serialized.
 *
 * @author Jiri Hynek
 */
class GeovistoMapState extends AbstractMapObjectState {
  /**
   * It initializes a map state.
   */
  constructor() {
    super();
  }

  /**
   * It resets state with respect to initial props. Optionally, defaults can be set if property is undefined.
   *
   * @param {*} defaults
   */
  reset(defaults) {
    super.reset(defaults);

    let props = this.getProps();

    // templates
    let templates =
      props.templates == undefined && defaults ? defaults.getTemplates() : props.templates;
    this.setToolTemplates(
      templates.tools == undefined && defaults ? defaults.getToolTemplates() : templates.tools,
    );

    // tools
    this.setTools(props.tools == undefined && defaults ? defaults.getTools() : props.tools);

    // data
    this.setMapData(props.data == undefined && defaults ? defaults.getMapData() : props.data);

    // geo data - TODO convert to generic geo data
    this.setPolygons(
      props.polygons == undefined && defaults ? defaults.getPolygons() : props.polygons,
    );
    this.setCentroids(
      props.centroids == undefined && defaults ? defaults.getCentroids() : props.centroids,
    );

    // globals (state variables which are common for all geovisto tools) - can be undefined and set by initialize function
    let globals = props.globals == undefined && defaults ? defaults.getGlobals() : props.globals;
    this.setInitialZoom(globals.zoom == undefined && defaults ? defaults.getZoom() : globals.zoom);
    this.setInitialMapCenter(
      globals.mapCenter == undefined && defaults ? defaults.getMapCenter() : globals.mapCenter,
    );
    this.setInitialMapStructure(
      globals.mapStructure == undefined && defaults
        ? defaults.getMapStructure()
        : globals.mapStructure,
    );
  }

  /**
   * It takes config and desrializes the values.
   *
   * @param {*} config
   */
  deserialize(config, geojson) {
    super.deserialize(config);

    if (config.zoom != undefined) this.setInitialZoom(config.zoom);
    if (config.mapCenter != undefined) this.setInitialMapCenter(config.mapCenter);
    if (config.mapStructure != undefined) this.setInitialMapStructure(config.mapStructure);

    this.deserializeGeoJSON(geojson);
  }

  deserializeGeoJSON(geojson) {
    if (!geojson) return;
    // tools
    let tools = this.getTools().getObjects();
    // get drawing tool
    let found = tools.find((t) => t.getState().type === DRAWING_TOOL_LAYER_TYPE);
    if (found) {
      found.getState().deserializeGeoJSON(geojson);
    }
  }

  /**
   * It serializes the map state. Optionally, a serialed value can be let undefined if it equals the default value.
   *
   * @param {*} defaults
   */
  serialize(defaults) {
    // do not serialize the id and type for map
    //let config = super.serialize(defaults);
    let config = {};

    // initialize config
    let map = this.getLeafletMap();
    config.zoom = defaults && map.getZoom() == defaults.getZoom() ? undefined : map.getZoom();
    config.mapCenter =
      defaults && map.getCenter() == defaults.getMapCenter() ? undefined : map.getCenter();
    // TODO map structure
    config.tools = [];

    // tools
    let tools = this.getTools().getObjects();
    for (let i = 0; i < tools.length; i++) {
      config.tools.push(tools[i].getState().serialize());
    }

    return config;
  }

  serializeGeoJSON() {
    // tools
    let tools = this.getTools().getObjects();
    // get drawing tool
    let found = tools.find((t) => t.getState().type === DRAWING_TOOL_LAYER_TYPE);
    if (found) {
      const config = found.getState().serializeToGeoJSON();
      return config;
    }
    return {};
  }

  /**
   * It returns the Leaflet map.
   */
  getLeafletMap() {
    return this.map;
  }

  /**
   * It returns the Leaflet map.
   *
   * @param {L.Map} map
   */
  setLeafletMap(map) {
    return (this.map = map);
  }

  /**
   * It returns tool templates.
   */
  getToolTemplates() {
    return this.toolTemplates;
  }

  /**
   * It sets tool templates.
   *
   * @param {AbstractToolsManager} toolTemplates
   */
  setToolTemplates(toolTemplates) {
    this.toolTemplates = toolTemplates;
  }

  /**
   * It returns tools.
   */
  getTools() {
    return this.tools;
  }

  /**
   * It sets tools.
   *
   * @param {AbstractToolsManager} tools
   */
  setTools(tools) {
    // we use copies of predefined tools due to later multiple imports of configs
    this.tools = tools.copy();
  }

  /**
   * It returns the MapData object.
   */
  getMapData() {
    return this.mapData;
  }

  /**
   * It sets the MapData object.
   * note: It also updates the current data.
   *
   * @param {AbstractMapData} mapData
   */
  setMapData(mapData) {
    this.mapData = mapData;
    this.setCurrentData(mapData.getData());
  }

  /**
   * It returns current data (might be filtered).
   */
  getCurrentData() {
    return this.data;
  }

  /**
   * It sets current data.
   *
   * @param {[any]} data
   */
  setCurrentData(data) {
    return (this.data = data);
  }

  /**
   * It returns the MapConfig object.
   */
  getMapConfig() {
    return this.mapConfig;
  }

  /**
   * It sets the MapConfig object.
   *
   * @param {AbstractMapConfig} mapData
   */
  setMapConfig(mapConfig) {
    this.mapConfig = mapConfig;
  }

  /**
   * It returns polygons.
   */
  getPolygons() {
    return this.polygons;
  }

  /**
   * It sets polygons.
   *
   * @param {[any]} polygons
   */
  setPolygons(polygons) {
    let polys = [];
    if (Array.isArray(polygons)) polys = polygons
    if (polygons?.features) polys = polygons.features;
    return (this.polygons = polys);
  }

  /**
   * It returns centroids.
   */
  getCentroids() {
    return this.centroids;
  }

  /**
   * It sets centroids.
   *
   * @param {[any]} centroids
   */
  setCentroids(centroids) {
    return (this.centroids = centroids);
  }

  /**
   * It returns the initial zoom level.
   */
  getInitialZoom() {
    return this.zoom;
  }

  /**
   * It sets initial zoom level.
   *
   * @param {number} zoom
   */
  setInitialZoom(zoom) {
    return (this.zoom = zoom);
  }

  /**
   * It returns the initial map center.
   */
  getInitialMapCenter() {
    return this.mapCenter;
  }

  /**
   * It sets initial map center.
   *
   * @param {*} mapCenter
   */
  setInitialMapCenter(mapCenter) {
    return (this.mapCenter = mapCenter);
  }

  /**
   * It returns the initial structure.
   */
  getInitialMapStructure() {
    return this.mapCenter;
  }

  /**
   * It sets initial map structure.
   *
   * @param {*} mapStructure
   */
  setInitialMapStructure(mapStructure) {
    return (this.mapStructure = mapStructure);
  }
}
export default GeovistoMapState;
