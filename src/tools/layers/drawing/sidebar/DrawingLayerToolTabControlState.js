import AbstractLayerToolTabControlState from '../../abstract/sidebar/AbstractLayerToolTabControlState';
import PaintPoly from '../components/paintPoly';

import '../style/drawingLayerTabControl.scss';
import { geoSearch, iconStarter, putMarkerOnMap } from '../util/Marker';
import { highlightStyles, normalStyles, simplifyFeature } from '../util/Poly';
import { debounce } from '../util/functionUtils';
import { createIntervalInput, createCheck } from '../components/inputs';

import * as osmtogeojson from 'osmtogeojson';
import * as turf from '@turf/turf';
import { FIRST } from '../util/constants';

export const ICON_SRCS = [
  'https://upload.wikimedia.org/wikipedia/commons/0/0a/Marker_location.png',
  'https://icons.iconarchive.com/icons/icons-land/vista-map-markers/32/Map-Marker-Flag-1-Right-Azure-icon.png',
];
export const COLORS = [
  '#1ABC9C',
  '#16A085',
  '#2ECC71',
  '#27AE60',
  '#3498DB',
  '#2980B9',
  '#9B59B6',
  '#8E44AD',
  '#34495E',
  '#2C3E50',
  '#F1C40F',
  '#F39C12',
  '#E67E22',
  '#D35400',
  '#E74C3C',
  '#C0392B',
  '#ECF0F1',
  '#BDC3C7',
  '#95A5A6',
  '#7F8C8D',
];
export const STROKES = [
  { label: 'thin', value: 3 },
  { label: 'medium', value: 5, selected: true },
  { label: 'bold', value: 7 },
];
export const ADMIN_LEVELS = [
  { label: 'State', value: 2 },
  { label: 'Province', value: 4, selected: true },
  { label: '5 (depends on country)', value: 5 },
  { label: '6 (depends on country)', value: 6 },
  { label: '7 (depends on country)', value: 7 },
  { label: '8 (depends on country)', value: 8 },
  { label: '9 (depends on country)', value: 9 },
  { label: '10 (depends on country)', value: 10 },
];

/**
 * This class manages the state of the sidebar tab.
 * It wraps the state since the sidebar tab can work with state objects which needs to be explicitly serialized.
 *
 * @author Andrej Tlcina
 */
class DrawingLayerToolTabControlState extends AbstractLayerToolTabControlState {
  /**
   * It creates a tab control state.
   */
  constructor(tabControl) {
    super();
    this.tabControl = tabControl;

    this.colors = COLORS;
    this.selectedColor = COLORS[0];

    this.strokes = STROKES;
    this.selectedStroke = STROKES[1].value;

    this.iconSrcs = new Set(ICON_SRCS);
    this.selectedIcon = ICON_SRCS[0];

    // * element/layer that was enabled and not created yet
    this.enabledEl = null;

    this.identifierType = '';

    this.searchOpts = [];

    this.guideLayers = [];

    this.connectActivated = false;

    this.intersectActivated = false;

    this.paintPoly = new PaintPoly({
      tabState: this,
    });

    this.pather = new L.Pather({
      strokeWidth: 3,
      smoothFactor: 5,
      moduleClass: 'leaflet-pather',
      pathColour: '#333',
    });
    this.patherActive = false;

    this.countries = require('../../../../../static/geo/iso3166_countries.json');
    this.countryCode = '';
    this.adminLevel = ADMIN_LEVELS[1].value;
    this.highQuality = false;

    this.filtersAmount = 0;
    this.filtersKeys = [];
    this.filtersValues = [];
  }

  clearFilters() {
    this.filtersAmount = 0;
    this.filtersKeys = [];
    this.filtersValues = [];
  }

  getFiltersKey(idx) {
    const key = this.filtersKeys[idx];
    return key;
  }
  getFiltersValue(idx) {
    const value = this.filtersValues[idx];
    return value;
  }
  setFiltersKey(idx, value) {
    if (idx > this.filtersAmount) return;
    this.filtersKeys[idx] = value;
  }
  setFiltersValue(idx, value) {
    if (idx > this.filtersAmount) return;
    this.filtersValues[idx] = value;
  }

  increaseFilters = () => {
    this.filtersAmount += 1;
    this.filtersKeys.push('');
    this.filtersValues.push('');
  };
  decreaseFilters = () => {
    if (this.filtersAmount === 0) return;
    this.filtersAmount -= 1;
    this.filtersKeys.pop();
    this.filtersValues.pop();
  };

  setCountryCode(val) {
    this.countryCode = val;
  }
  setAdminLevel(val) {
    this.adminLevel = val;
  }
  setHighQuality(val) {
    this.highQuality = val;
  }

  getToolState() {
    return this.getTool().getState();
  }

  setPatherStatus(val) {
    this.patherActive = val;
  }

  setConnectActivated(val) {
    this.connectActivated = val;
  }

  setIntersectActivated(val) {
    this.intersectActivated = val;
  }

  pushGuideLayer(layer) {
    this.guideLayers.push(layer);
  }

  setEnabledEl(val) {
    this.enabledEl?.disable();
    this.enabledEl = val;
    // this.tool.state.setSelectedLayer(null);
  }

  getIdentifierType() {
    return this.identifierType;
  }

  setIdentifierType(val) {
    this.identifierType = val;
  }

  getEnabledEl() {
    return this.enabledEl;
  }

  getSelectedColor() {
    return this.selectedColor;
  }

  getSelectedStroke() {
    return this.selectedStroke;
  }

  getSelectedIcon() {
    return this.selectedIcon;
  }

  setSelectedColor(value) {
    this.selectedColor = value;
  }

  setSelectedStroke(value) {
    this.selectedStroke = value;
  }

  setSelectedIcon(value) {
    this.selectedIcon = value;
  }

  setSearchOpts(opts) {
    this.searchOpts = opts;
  }

  appendToIconSrcs(iconUrl) {
    this.iconSrcs.add(iconUrl);
  }

  getSelectCountries() {
    const result = this.countries.map((c) => ({ value: c['alpha-2'], label: c['name'] }));
    return [{ value: '', label: '' }, ...result];
  }

  changeColorAction = (color) => {
    const selectedEl = this._getSelected();
    this.setSelectedColor(color);
    if (selectedEl?.setStyle) selectedEl.setStyle({ color });
    this._getExtraSelected().forEach((layer) => {
      layer?.setStyle({ color });
    });
  };

  changeWeightAction = (e) => {
    const weight = Number(e.target.value);
    const selectedEl = this._getSelected();
    this.setSelectedStroke(weight);
    if (selectedEl?.setStyle) selectedEl.setStyle({ weight });
    this._getExtraSelected().forEach((layer) => {
      layer?.setStyle({ weight });
    });
  };

  changeIconOpts = (iconOpt = {}) => {
    const { enabledEl } = this;

    let selectedEl = this._getSelected();
    let marker = selectedEl;

    if (enabledEl?.type === 'marker') {
      selectedEl = enabledEl;
      marker = enabledEl._marker;
    }

    let oldIconOptions = selectedEl?.options?.icon?.options || {};
    let newIconOptions = {
      ...oldIconOptions,
      ...iconOpt,
    };

    const markerIcon = new L.Icon(newIconOptions);
    if (marker) marker.setIcon(markerIcon);
    this.tool.highlightElement(marker);
    this._getExtraSelected().forEach((layer) => {
      layer?.setIcon(markerIcon);
      this.tool.highlightElement(layer);
    });
    if (enabledEl?.type === 'marker') enabledEl.setIconOptions(markerIcon);

    return marker;
  };

  changeIconAction = (icon) => {
    this.changeIconOpts({ iconUrl: icon });

    this.setSelectedIcon(icon);
    this.tabControl.redrawTabContent('marker');
  };

  changeIconAnchor = (val, coordinate) => {
    const selectedEl = this.enabledEl || this._getSelected();
    let iconOptions = selectedEl?.options?.icon?.options || {};
    const iconAnchor = iconOptions.iconAnchor || iconStarter.iconAnchor;
    iconAnchor[coordinate] = val;
    this.changeIconOpts({ iconAnchor });
  };

  changeDescriptionAction = (e) => {
    this.changeDesc(e.target.value);
  };

  changeDesc = (inputText) => {
    const selectedEl = this._getSelected();
    const modInputText = this.tabControl.convertDescToPopText(inputText);

    let popup1 = selectedEl.getPopup();
    if (popup1) {
      popup1.setContent(modInputText);
    } else {
      selectedEl.bindPopup(modInputText, { closeOnClick: false, autoClose: false });
    }
    // store for import
    console.log({ selectedEl });
    if (selectedEl) selectedEl.popupContent = modInputText;
    if (selectedEl?.setStyle) selectedEl.setStyle(modInputText);
  };

  callIdentifierChange = (haveToCheckFilters = false) => {
    if (haveToCheckFilters && this.filtersAmount === 0) return;
    const selectedEl = this._getSelected();
    this.changeIdentifierAction(selectedEl?.identifier);
  };

  changeIdentifierAction = (id) => {
    if (!id) return;
    const selectedEl = this._getSelected();
    if (selectedEl) selectedEl.identifier = id;

    const data = this.getTool()?.getState()?.map?.state?.data;

    let filteredData = data;
    this.filtersKeys.forEach((key, idx) => {
      filteredData = filteredData.filter((d) => String(d[key]) === this.filtersValues[idx]);
    });

    const idType = this.identifierType;
    const found = filteredData.find((d) => String(d[idType]) === id);

    let popupText = '';
    if (found) {
      Object.keys(found).forEach((key) => {
        popupText += `${key}: ${found[key]}<br />`;
      });
    }

    this.changeDesc(popupText);
    this.tabControl.redrawTabContent(selectedEl?.layerType);
  };

  changeWhichIdUseAction = (e) => {
    const id = e.target.value;
    const selectedEl = this._getSelected();

    this.setIdentifierType(id);

    this.tabControl.redrawTabContent(selectedEl?.layerType);
  };

  searchAction = async (e) => {
    const value = e.target.value;
    const featureGroup = this.getTool()?.getState()?.featureGroup;

    const opts = await geoSearch(featureGroup, value);

    this.setSearchOpts(opts);
    this.tabControl.inputSearch.changeOptions(opts ? opts.map((opt) => opt.label || '') : []);
    // this.inputSearch.redrawMenu();
  };

  onInputOptClick = (value) => {
    const featureGroup = this.getTool()?.getState().featureGroup;
    const { searchOpts: opts, connectActivated } = this;

    const found = opts.find((opt) => opt.label === value);

    let latlng = L.latLng(0, 0);
    latlng.lat = found?.y || 0;
    latlng.lng = found?.x || 0;
    const iconUrl = found?.raw?.icon || ICON_SRCS[0];
    const marker = putMarkerOnMap(featureGroup, latlng, found?.label, iconUrl, connectActivated);
    this.getTool().applyEventListeners(marker);
    this.getTool().applyTopologyMarkerListeners(marker);
    this.setSelectedIcon(iconUrl);
    this.appendToIconSrcs(iconUrl);
    if (connectActivated) {
      this.getTool().plotTopology();
    }
    this.tabControl.redrawTabContent('search');
  };

  addIconAction = (e) => {
    const iconUrl = e.target.value;
    this.appendToIconSrcs(iconUrl);
    this.tabControl.redrawTabContent('marker');
  };

  fetchAreas = async () => {
    const { countryCode, adminLevel, highQuality } = this;

    if (!countryCode || !adminLevel) return;

    const toolState = this.getTool().getState();

    const endPoint = 'https://overpass-api.de/api/interpreter?data=[out:json];';
    const query = `area["ISO3166-1"="${countryCode}"]->.searchArea;(relation["admin_level"="${adminLevel}"](area.searchArea););out;>;out skel qt;`;

    document.querySelector('.leaflet-container').style.cursor = 'wait';
    this.tabControl.searchForAreasBtn.setAttribute('disabled', true);

    fetch(endPoint + query)
      .then((response) => response.json())
      .then((data) => {
        const gJSON = osmtogeojson(data);

        const opts = {
          color: this.selectedColor,
          draggable: true,
          transform: true,
        };

        toolState.featureGroup.eachLayer((layer) => {
          if (layer.countryCode === countryCode) toolState.removeLayer(layer);
        });

        gJSON?.features
          ?.filter((feat) => feat?.geometry?.type === 'Polygon')
          ?.forEach((feat) => {
            let coords = feat.geometry.coordinates;
            if (!highQuality) {
              let simplified = simplifyFeature(feat, 0.01);
              coords = simplified.geometry.coordinates;
            }
            let latlngs = L.GeoJSON.coordsToLatLngs(coords, 1);
            let result = new L.polygon(latlngs, { ...opts, ...normalStyles });
            result?.dragging?.disable();
            result.layerType = 'polygon';
            result.countryCode = countryCode;
            toolState.addLayer(result);
          });
        this.tabControl.errorMsg.innerText = '';
      })
      .catch((err) => {
        this.tabControl.errorMsg.innerText = 'There was a problem, re-try later.';
        console.error(err);
      })
      .finally(() => {
        document.querySelector('.leaflet-container').style.cursor = '';
        this.tabControl.searchForAreasBtn.removeAttribute('disabled');
      });
  };

  searchForAreaAction = (e) => {
    const val = e.target.value;
    this.setCountryCode(val);
  };

  pickAdminLevelAction = (e) => {
    const val = e.target.value;
    this.setAdminLevel(val);
  };

  _getSelected() {
    return this.getTool().getState().selectedLayer;
  }

  _getExtraSelected() {
    return this.getTool().getState().extraSelected;
  }
}
export default DrawingLayerToolTabControlState;
