import L from 'leaflet';
import LL from 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import './style/spikeLayer.scss';
import * as d3 from "d3";
import SpikeLayerToolTabControl from './sidebar/SpikeLayerToolTabControl';
import SpikeLayerToolDefaults from './SpikeLayerToolDefaults';
import SpikeLayerToolState from './SpikeLayerToolState';
import SelectionTool from '../../selection/SelectionTool';
import AbstractLayerTool from '../abstract/AbstractLayerTool';
import ThemesToolEvent from '../../themes/model/event/ThemesToolEvent';
import SelectionToolEvent from '../../selection/model/event/SelectionToolEvent';
import DataChangeEvent from '../../../model/event/basic/DataChangeEvent';

/**
 * This class represents custom div icon which is used to mark center of countries.
 * It overrides L.DivIcon.
 *
 * @author Jiri Hynek
 * @override {L.DivIcon}
 */
var CountryIcon = L.DivIcon.extend({

    _LEVEL: 0,
    _SUFFIX: 1,
    _COLOR: 2,
    levels: [
        [-Infinity, "N/A", "#CCCCCC"],
        [1, "", "#CCCCCC"],
        [1e2, "K", "#AAAAAA"],
        [1e5, "M", "#555555"],
        [1e8, "B", "#222222"],
        [1e11, "t", "#111111"],
    ],

    // moved to css
    //donutColors: ["darkred", "goldenrod", "gray"],

    options: {
        sizeBasic: 32,
        sizeGroup: 36,
        sizeDonut: 48,

        // It is derived
        //iconSize: [32,32],
        //iconAnchor: [32/2,32/2],

        className: "div-country-icon",
        values: {
            id: "",
            value: 0,
            subvalues: {
                active: 0,
                mitigated: 0,
                finished: 0,
            }
        },
        isGroup: false,
        useDonut: true
    },

    round: function (value, align) {
        return Math.round(value * align) / align;
    },

    formatValue: function (value, level) {
        if (level == undefined || level < 0) {
            return this.levels[0][this._SUFFIX];
        } else {
            if (this.levels[level][this._LEVEL] == -Infinity) {
                return this.levels[level][this._SUFFIX];
            } else if (this.levels[level][this._LEVEL] == 1) {
                return this.round(value, this.levels[level][this._LEVEL]);
            } else {
                value = value / (this.levels[level][this._LEVEL] * 10);
                var align = (value >= 10) ? 1 : 10;
                return this.round(value, align) + this.levels[level][this._SUFFIX];
            }
        }
    },

    getColor: function (level) {
        if (level == null || level < 0) {
            return this.levels[0][this._COLOR];
        } else {
            return this.levels[level][this._COLOR];
        }
    },

    getLevel: function (value) {
        for (var i = this.levels.length - 1; i >= 0; i--) {
            if (value > this.levels[i][this._LEVEL]) {
                return i;
            }
        }
        return -1;
    },

    createIcon: function (oldIcon) {
        var div = (oldIcon && oldIcon.tagName === 'DIV') ? oldIcon : document.createElement('div'),
            options = this.options;

        var size = options.useDonut ? options.sizeDonut : (options.isGroup ? options.sizeGroup : options.sizeBasic);
        options.iconSize = [size, size];
        options.iconAnchor = [size / 2, size / 2];
        var rCircle = options.sizeBasic / 2;
        var center = size / 2;
        // moved to css
        //var strokeWidth = options.isGroup ? ((options.sizeGroup-options.sizeBasic)/2) : 0;
        var level = this.getLevel(options.values.value);

        var divContent = div.appendChild(document.createElement('div'));
        divContent.classList.value =
            "leaflet-marker-level" + level // level
            + (options.isGroup ? " leaflet-marker-group" : "") // group of several markers
            ;


        //console.log(size);
        var element = d3.select(divContent);
        //console.log(element)
        var svg = element.append("svg");
        svg.append("g").append("path")
            .attr("fill", "red")
            .attr("stroke", "red")
            .attr("d", "M150 0 L146.5 200 L153.5 200 Z");
        // svg.attr("width", size).attr("height", size);
        // //svg.classList.add("leaflet-marker-item");
        //
        // // circle
        // svg.append("circle")
        //     .attr("cx", center)
        //     .attr("cy", center)
        //     .attr("r", rCircle)
        // moved to css

        const spike = (length, width = 7) => `M${-width / 2},0L0,${-length}L${width / 2},0`;
        const vls = [100, 200, 300, 400];
        const length = d3.scaleLinear([0, d3.max(vls)], [0, 200]);

       // <g transform="translate(957,590)"><path fill="red" fill-opacity="0.3" stroke="red" d="M-3.5,0L0,-397.726792517367L3.5,0"></path><text dy="1.3em">10M</text></g>

        // svg.append("path")
        //     .attr("fill", "red")
        //     .attr("fill-opacity", 0.3)
        //     .attr("stroke", "red")
        //     .attr("d", d => {return spike(length(100))});
        //.attr("fill", this.getColor(level))
        //.attr("fill-opacity", 0.9)
        //.attr("stroke-width", strokeWidth)
        //.attr("stroke", "black");


        this._setIconStyles(div, 'icon');
        console.log('here');
        return div;
    },
});

/**
 * This class represents Marker layer. It works with geojson polygons representing countries.
 *
 * @author Jiri Hynek
 */
class SpikeLayerTool extends AbstractLayerTool {

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
        return "geovisto-tool-layer-marker";
    }

    /**
     * It creates a copy of the uninitialized tool.
     */
    copy() {
        return new SpikeLayerTool(this.getProps());
    }

    /**
     * It creates new defaults of the tool.
     */
    createDefaults() {
        return new SpikeLayerToolDefaults();
    }

    /**
     * It returns default tool state.
     */
    createState() {
        return new SpikeLayerToolState();
    }

    /**
     * Help function which acquires and returns the selection tool if available.
     */
    getSelectionTool() {
        if (this.selectionTool == undefined) {
            let tools = this.getMap().getState().getTools().getByType(SelectionTool.TYPE());
            if (tools.length > 0) {
                this.selectionTool = tools[0];
            }
        }
        return this.selectionTool;
    }

    /**
     * It creates new tab control.
     */
    createSidebarTabControl() {
        return new SpikeLayerToolTabControl({ tool: this });
    }

    /**
     * It creates layer items.
     */
    createLayerItems() {
        // create layer which clusters points
        //let layer = L.layerGroup([]);
        let layer = L.markerClusterGroup({

            // create cluster icon
            iconCreateFunction: function (cluster) {
                var markers = cluster.getAllChildMarkers();
                let data = { id: "<Group>", value: 0, subvalues: {} };
                for (var i = 0; i < markers.length; i++) {
                    data.value += markers[i].options.icon.options.values.value;
                    for (let [key, value] of Object.entries(markers[i].options.icon.options.values.subvalues)) {
                        if (data.subvalues[key] == undefined) {
                            data.subvalues[key] = value;
                        } else {
                            data.subvalues[key] += value;
                        }
                    }
                }
                // create custom icon
                return new CountryIcon({
                    countryName: "<Group>",
                    values: data,
                    isGroup: true,
                });
            }
        });

        // update state
        this.getState().setLayer(layer);

        this.redraw();

        return [layer];
    }

    /**
     * It deletes layer items.
     */
    deleteLayerItems() {
        //console.log("marker");
        let markers = this.getState().getMarkers();

        // delete the 'value' property of every geo feature object if defined
        let layer = this.getState().getLayer();
        for (let i = 0; i < markers.length; i++) {
            layer.removeLayer(markers[i]);
        }

        this.getState().setMarkers([]);
    }

    /**
     * It prepares data for markers.
     */
    prepareMapData() {
        //console.log("updating map data", this);

        // prepare data
        let workData = [];
        let mapData = this.getMap().getState().getMapData();
        let dataMappingModel = this.getDefaults().getDataMappingModel();
        let dataMapping = this.getState().getDataMapping();
        let countryDataDomain = mapData.getDataDomain(dataMapping[dataMappingModel.country.name]);
        let valueDataDomain = mapData.getDataDomain(dataMapping[dataMappingModel.value.name]);
        let categoryDataDomain = mapData.getDataDomain(dataMapping[dataMappingModel.category.name]);
        let geoCountry, actResultItem;
        let foundCountries, foundValues, foundCategories;
        let highlightedIds = this.getSelectionTool() && this.getSelectionTool().getState().getSelection() ?
            this.getSelectionTool().getState().getSelection().getIds() : [];
        let data = this.getMap().getState().getCurrentData();
        let dataLen = data.length;
        let centroids = this.getState().getCentroids();
        for (let i = 0; i < dataLen; i++) {
            // find the 'country' properties
            foundCountries = mapData.getItemValues(countryDataDomain, data[i]);
            //console.log("search country: ", foundCountries);

            // find the 'value' properties
            foundValues = mapData.getItemValues(valueDataDomain, data[i]);
            //console.log("search values: ", foundValues);

            // find the 'category' properties
            foundCategories = mapData.getItemValues(categoryDataDomain, data[i]);
            //console.log("search category: ", foundCategories);

            // since the data are flattened we can expect max one found item
            //console.log("abc", highlightedIds);
            if (foundCountries.length == 1 && (highlightedIds.length == 0 || highlightedIds.indexOf(foundCountries[0]) >= 0)) {
                // test if country respects highlighting selection
                /*if(highlightedIds != undefined) {
                    console.log(highlightedIds.indexOf(foundCountries[0]) >= 0);
                }*/

                // test if country exists in the map
                geoCountry = centroids.find(x => x.id == foundCountries[0]);
                if (geoCountry != undefined) {
                    // test if country exists in the results array
                    actResultItem = workData.find(x => x.id == foundCountries[0]);
                    if (actResultItem == undefined) {
                        actResultItem = { id: foundCountries[0], value: 0, subvalues: {} };
                        workData.push(actResultItem);
                    }
                    // initialize category if does not exists yet
                    if (foundCategories.length == 1) {
                        if (actResultItem.subvalues[foundCategories[0]] == undefined) {
                            actResultItem.subvalues[foundCategories[0]] = 0;
                        }
                    }
                    // set value with respect to the aggregation function
                    if (dataMapping[dataMappingModel.aggregation.name] == "sum") {
                        // test if value is valid
                        if (foundValues.length == 1 && foundValues[0] != null && typeof foundValues[0] === 'number') {
                            actResultItem.value += foundValues[0];
                            // set category
                            if (foundCategories.length == 1) {
                                actResultItem.subvalues[foundCategories[0]] += foundValues[0];
                            }
                        }
                    } else {
                        // count
                        actResultItem.value++;
                        // incerement category value
                        actResultItem.subvalues[foundCategories[0]]++;
                    }
                }
            }
        }
        //console.log("result: ", preparedData);
        return workData;
    }

    /**
     * It creates markers using workData
     */
    createMarkers(workData) {
        // create markers
        let markers = [];

        let geoCountry;
        let layer = this.getState().getLayer();
        let centroids = this.getState().getCentroids();
        for (let i = 0; i < workData.length; i++) {
            // get centroid
            // note: the centroid exists since invalid countries has been filtered
            geoCountry = centroids.find(x => x.id == workData[i].id);
            // build message
            let point = this.createMarker(geoCountry, workData[i]);
            layer.addLayer(point);
            markers.push(point);
        }

        return markers;
    }

    /**
     * It creates one marker with respect to the given centroid and data.
     *
     * @param {*} centroid
     * @param {*} data
     */
    createMarker(centroid, data) {
        function thousands_separator(num) {
            var num_parts = num.toString().split(".");
            num_parts[0] = num_parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
            return num_parts.join(".");
        }

        // build popup message
        let popupMsg = "<b>" + centroid.name + "</b><br>";
        popupMsg += (data.value != null ? thousands_separator(data.value) : "N/A") + "<br>";
        for (let [key, value] of Object.entries(data.subvalues)) {
            popupMsg += key + ": " + thousands_separator(value) + "<br>";
        }

        // create marker
        console.log(centroid.lat, centroid.long);
        let point = L.marker([centroid.lat, centroid.long], {
            // create basic icon
            id: centroid.name,
            icon: new CountryIcon({
                values: data
            })
        }).bindPopup(popupMsg);
        console.log(data);
        //let spike =
        return point;
    }

    /**
     * It reloads data and redraw the layer.
     */
    redraw(onlyStyle) {
        if (this.getState().getLayer()) {
            // delete actual items
            this.deleteLayerItems();

            // prepare data
            let workData = this.prepareMapData();

            // update map
            let markers = this.createMarkers(workData);

            // update state
            this.getState().setMarkers(markers);
        }
    }

    /**
     * This function is called when a custom event is invoked.
     *
     * @param {AbstractEvent} event
     */
    handleEvent(event) {
        if (event.getType() == DataChangeEvent.TYPE()) {
            // data change
            this.redraw();
        } else if (event.getType() == SelectionToolEvent.TYPE()) {
            this.redraw();
            // TODO
        } else if(event.getType() == ThemesToolEvent.TYPE()) {
            var map = event.getObject();
            document.documentElement.style.setProperty('--leaflet-marker-donut1', map.getDataColors().triadic1);
            document.documentElement.style.setProperty('--leaflet-marker-donut2', map.getDataColors().triadic2);
            document.documentElement.style.setProperty('--leaflet-marker-donut3', map.getDataColors().triadic3);
        }
    }
}

export default SpikeLayerTool;