import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MapLayerToolDefaults from './MapLayerToolDefaults';
import MapLayerToolState from './MapLayerToolState';
import MapLayerToolTabControl from './sidebar/MapLayerToolTabControl';
import AbstractLayerTool from '../abstract/AbstractLayerTool';
import ThemesToolEvent from '../../themes/model/event/ThemesToolEvent';

/**
 * This class represents Map layer tool. It use tile layer and OSM maps.
 * 
 * @author Jiri Hynek
 */
class MapLayerTool extends AbstractLayerTool {

    /**
     * It creates a new tool with respect to the props.
     * 
     * @param {*} props 
     */
    constructor(props) {
        super(props);
    }

    /**
     * A unique string of the tool type.
     */
    static TYPE() {
        return "geovisto-tool-layer-map"; 
    }

    /**
     * It creates a copy of the uninitialized tool.
     */
    copy() {
        return new MapLayerTool(this.getProps());
    }

    /**
     * It creates new defaults of the tool.
     */
    createDefaults() {
        return new MapLayerToolDefaults();
    }

    /**
     * It returns default tool state.
     */
    createState() {
        return new MapLayerToolState();
    }

    /**
     * It creates new tab control.
     */
    createSidebarTabControl() {
        return new MapLayerToolTabControl({ tool: this });
    }

    /**
     * It creates layer items.
     */
    createLayerItems() {
        // create a tile layer
        let layer = this.createTileLayer(this.getState().getBaseMap());

        // update state
        this.getState().setLayer(layer);

        return [ layer ];
    }

    /**
     * Creates new tile layer
     * 
     * @param {*} tileID 
     */
    createTileLayer(tileID) {
        // ----------------- TODO: refactorization needed
        let layer = L.tileLayer(tileID, {    
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19,
            minZoom: 1,
        });
        return layer;
    }

    /**
     * This function is called when a custom event is invoked.
     * 
     * @param {AbstractEvent} event 
     */
    handleEvent(event) {
        if(event.getType() == ThemesToolEvent.TYPE()) {
            this.onThemeChange(event.getObject())
        }
    }

    /**
     * This function updates theme used in the tool.
     */
    onThemeChange(theme) {
        // update base map
        this.getState().setBaseMap(theme.getBaseMap());

        let layer = this.getState().getLayer();
        if(layer && layer._url != theme.getBaseMap()) {
            // remove the old layer
            this.getMap().getState().getLeafletMap().removeLayer(layer);

            // create a new tile layer
            layer = this.createTileLayer(this.getState().getBaseMap());

            // update state
            this.getState().setLayer(layer);

            // add the new layer to the leaflet map
            layer.addTo(this.getMap().getState().getLeafletMap());
        } else {
            
        }
    }
}

export default MapLayerTool;