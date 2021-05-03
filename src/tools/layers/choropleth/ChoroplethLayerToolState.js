import AbstractLayerToolState from "../abstract/AbstractLayerToolState";
import ChoroplethLayerToolDefaults from "./ChoroplethLayerToolDefaults";

/**
 * This class provide functions for using the state of the layer tool.
 * 
 * @author Jiri Hynek
 */
class ChoroplethLayerToolState extends AbstractLayerToolState {

    /**
     * It creates a tool state.
     */
    constructor() {
        super();
    }

    /**
     * It resets state with respect to initial props. Optionally, defaults can be set if property is undefined.
     * 
     * @param {ChoroplethLayerToolDefaults} defaults 
     */
    reset(defaults) {
        super.reset(defaults);

        // the layer tool properties
        this.setZIndex(defaults ? defaults.getZIndex() : 350);
        // TODO
    }

    /**
     * Help function which resets the state properties realated with map if not defined.
     */
    resetMapVariables(map, defaults) {
        super.resetMapVariables(map, defaults);
        
        let props = this.getProps();
        this.setPolygons(props.polygons == undefined && defaults && map ? defaults.getPolygons() : props.polygons);
    }

    /**
     * The metod takes config and desrializes the values.
     * 
     * @param {*} config 
     */
    deserialize(config) {
        super.deserialize(config);

        // the layer tool config
        // TODO
    }

    /**
     * The method serializes the tool state. Optionally, defaults can be set if property is undefined.
     * 
     * @param {ChoroplethLayerToolDefaults} defaults
     */
    serialize(defaults) {
        let config = super.serialize(defaults);

        // serialize the layer tool properties
        // TODO

        return config;
    }

    /**
     * It returns a Leaflet geoJSON layer.
     */
    getLayer() {
        return this.layer;
    }

    /**
     * It sets a Leaflet geoJSON layer.
     * 
     * @param {L.svg} layer 
     */
    setLayer(layer) {
        this.layer = layer;
    }

    /**
     * It returns a Leaflet popup control.
     */
    getLayerPopup() {
        return this.popup;
    }

    /**
     * It sets a Leaflet popup control.
     * 
     * @param {L.control} popup 
     */
    setLayerPopup(popup) {
        this.popup = popup;
    }

    /**
     * It returns the polygons.
     */
    getPolygons() {
        return this.polygons;
    }

    /**
     * It sets the polygons.
     * 
     * @param {*} polygons 
     */
    setPolygons(polygons) {
        let polys = [];
        if (Array.isArray(polygons)) polys = polygons;
        if (polygons?.features) polys = polygons.features;
        return (this.polygons = polys);
    }

    /**
     * It returns the hovered item.
     */
    getHoveredItem() {
        return this.hoveredItem;
    }

    /**
     * It sets the hovered item.
     * 
     * @param {*} hoveredItem 
     */
    setHoveredItem(hoveredItem) {
        this.hoveredItem = hoveredItem;
    }

    /**
     * It returns the z index.
     */
    getZIndex() {
        return this.zindex;
    }

    /**
     * It sets the z index.
     * 
     * @param {*} zindex 
     */
    setZIndex(zindex) {
        this.zindex = zindex;
    }

    // TODO
}
export default ChoroplethLayerToolState;