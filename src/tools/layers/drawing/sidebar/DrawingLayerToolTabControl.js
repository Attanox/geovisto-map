import DrawingLayerToolTabControlDefaults from './DrawingLayerToolTabControlDefaults';
import DrawingLayerToolTabControlState, { ADMIN_LEVELS } from './DrawingLayerToolTabControlState';
import AbstractLayerToolTabControl from '../../abstract/sidebar/AbstractLayerToolTabControl';
import SidebarInputFactory from '../../../../inputs/SidebarInputFactory';

import '../style/drawingLayerTabControl.scss';
import { geoSearch, iconStarter, putMarkerOnMap } from '../util/Marker';
import { highlightStyles, normalStyles, simplifyFeature } from '../util/Poly';
import { debounce, getIntervalStep, isFloat } from '../util/functionUtils';
import { createIntervalInput, createCheck } from '../components/inputs';

import * as osmtogeojson from 'osmtogeojson';
import * as turf from '@turf/turf';
import { FIRST } from '../util/constants';

const POLYS = ['polyline', 'polygon', 'painted', 'vertice'];

const C_sidebar_tab_content_class = 'leaflet-sidebar-tab-content';

/**
 * This class provides controls for management of the layer sidebar tab.
 *
 * @author Andrej Tlcina
 */
class DrawingLayerToolTabControl extends AbstractLayerToolTabControl {
  constructor(tool) {
    super(tool);
  }

  /**
   * It creates new defaults of the tab control.
   */
  createDefaults() {
    return new DrawingLayerToolTabControlDefaults();
  }

  /**
   * It creates new state of the tab control.
   */
  createState() {
    return new DrawingLayerToolTabControlState(this);
  }

  createPalette(label, opts, activeIdx, changeAction, img = false) {
    const inputPalette = document.createElement('div');
    if (label) inputPalette.appendChild(document.createTextNode(label + ': '));
    const wrapper = document.createElement('div');
    wrapper.style.display = 'grid';
    wrapper.style.width = '100%';
    wrapper.style.gridTemplateColumns = 'repeat(4, 1fr)';
    inputPalette.appendChild(wrapper);
    opts.forEach((opt, idx) => {
      let elem = document.createElement('div');
      elem.style.boxSizing = 'border-box';
      elem.style.background = img ? `url(${opt})` : opt;
      elem.style.backgroundRepeat = 'no-repeat';
      elem.style.backgroundPosition = 'center';
      elem.style.backgroundSize = 'contain';
      elem.style.height = '20px';
      elem.style.display = 'inline-block';
      elem.style.cursor = 'pointer';
      if (idx === activeIdx) {
        elem.style.border = '1px solid #333';
      }
      elem.addEventListener('click', () => changeAction(opt));
      wrapper.appendChild(elem);
    });
    return inputPalette;
  }

  createColorPicker() {
    const inputWrapper = document.createElement('div');
    inputWrapper.appendChild(document.createTextNode('Pick color: '));
    const colorPicker = document.createElement('input');
    colorPicker.setAttribute('type', 'color');
    colorPicker.onchange = (e) => this.getState().changeColorAction(e.target.value);
    colorPicker.value = this._getSelected()?.options?.color || this.getState().getSelectedColor();
    inputWrapper.appendChild(colorPicker);
    return inputWrapper;
  }

  createColorPalette() {
    const colors = this.getState().colors;
    const activeColor = this.getState().getSelectedColor();
    const activeIndex = colors.indexOf(activeColor);
    const res = this.createPalette(
      'Pick color',
      colors,
      activeIndex,
      this.getState().changeColorAction,
    );
    return res;
  }

  createIconPalette() {
    const iconsSet = this.getState().iconSrcs;
    const iconUrl = this._getSelected()?.options?.icon?.options?.iconUrl;
    if (iconUrl) iconsSet.add(iconUrl);
    const activeIcon = this.getState().getSelectedIcon();
    const iconsArr = Array.from(iconsSet);
    const activeIndex = iconsArr.indexOf(activeIcon);
    const res = this.createPalette(
      'Pick icon',
      iconsArr,
      activeIndex,
      this.getState().changeIconAction,
      true,
    );
    return res;
  }

  /**
   * It acquire selected data mapping from input values.
   */
  getInputValues() {
    // get data mapping model
    let model = this.getDefaults().getDataMappingModel();

    // create new selection
    let dataMapping = {};

    // get selected data domains values
    dataMapping[model.identifier.name] = this.inputId.getValue();

    return dataMapping;
  }

  /**
   * It updates selected input values according to the given data mapping.
   *
   * @param {*} dataMapping
   */
  setInputValues(dataMapping) {
    // get data mapping model
    let model = this.getDefaults().getDataMappingModel();

    // update inputs
    this.inputId.setValue(dataMapping[model.identifier.name]);
  }

  redrawTabContent(layerType, enabled = false) {
    console.log('redrawing sidebar...');
    // get rendered sidebar tab
    let tabElement = document.getElementById(this.getState().getId());

    // create sidebar tab content
    let tabContent = tabElement.getElementsByClassName(C_sidebar_tab_content_class)[0];

    while (tabContent.firstChild) {
      tabContent.removeChild(tabContent.firstChild);
    }

    tabContent.appendChild(this.getTabContent(layerType, enabled));
  }

  _getSelected() {
    return this.getTool().getState().selectedLayer;
  }

  createBrushSizeControl = () => {
    let paintPoly = this.getState().paintPoly;

    if (!paintPoly.isActive()) return null;

    let { maxBrushSize, minBrushSize } = paintPoly.getBrushSizeConstraints();

    const controlWrapper = document.createElement('div');
    const brushControl = createIntervalInput(
      'Brush size: ',
      minBrushSize,
      maxBrushSize,
      paintPoly.resizeBrush,
      paintPoly.getBrushSize(),
    );
    controlWrapper.appendChild(brushControl);

    const customToleranceCheck = this.createCustomToleranceCheck();
    controlWrapper.appendChild(customToleranceCheck);

    this.customToleranceInput = document.createElement('div');
    controlWrapper.appendChild(this.customToleranceInput);
    return controlWrapper;
  };

  createIdentifierInput = (model) => {
    const data = this.getTool()?.getState()?.map?.state?.data;

    const idKey = this.state.getIdentifierType();

    let idOpts = data && data[0][idKey] ? data.map((d) => d[idKey]) : [];
    idOpts = Array.from(new Set(idOpts));

    const result = SidebarInputFactory.createSidebarInput(model.identifier.input, {
      label: model.identifier.label,
      action: (e) => this.getState().changeIdentifierAction(e.target.value),
      value: this._getSelected()?.identifier || '',
      options: idOpts,
      placeholder: 'e.g. CZ',
    });

    return result;
  };

  createPickIdentifier = (model) => {
    const data = this.getTool()?.getState()?.map?.state?.data;

    const idOpts = data[0] ? Object.keys(data[0]).map((k) => ({ value: k, label: k })) : [];

    const result = SidebarInputFactory.createSidebarInput(model.idKey.input, {
      label: model.idKey.label,
      action: this.getState().changeWhichIdUseAction,
      value: this.state.getIdentifierType(),
      options: [{ value: '', label: '' }, ...idOpts],
    });

    return result;
  };

  convertDescToPopText = (descText) => {
    if (!descText) return '';
    return descText.replaceAll('\n', '<br />');
  };

  convertDescfromPopText = (popText) => {
    if (!popText) return '';
    return popText.replaceAll('<br />', '\n');
  };

  createConnectCheck = () => {
    const onChange = (val) => this.getState().setConnectActivated(val);
    const { connectActivated } = this.getState();

    const result = createCheck(
      connectActivated,
      onChange,
      'connect',
      'By creating new marker while having this choice selected, you will create path between newly created marker and selected marker or last created marker via Topology tool',
    );

    return result;
  };

  createIntersectionCheck = () => {
    const onChange = (val) => this.getState().setIntersectActivated(val);
    const { intersectActivated } = this.getState();

    const result = createCheck(
      intersectActivated,
      onChange,
      'intersect',
      'By selecting the option you can create intersects with selected polygon',
    );
    return result;
  };

  createHighQualityCheck = () => {
    const onChange = (val) => this.getState().setHighQuality(val);
    const { highQuality } = this.getState();

    const result = createCheck(
      highQuality,
      onChange,
      'high-quality',
      'By selecting the option displayed polygons will be in higher quality, which however means that some operations will take longer to execute',
    );
    return result;
  };

  createChangeConnectCheck = () => {
    const toolState = this.getTool().getState();
    const onChange = (connectClick) => {
      let selected = this.getState().changeIconOpts({ connectClick });

      if (selected) {
        this.getTool().highlightElement(selected);
      }
    };
    const isConnect = toolState.selectedLayerIsConnectMarker();

    const result = createCheck(
      isConnect,
      onChange,
      'change-connect',
      'By selecting the option marker will be able to create topology',
    );
    return result;
  };

  createCustomToleranceCheck = () => {
    const { paintPoly } = this.getState();
    const toleranceChange = (val) => {
      window.customTolerance = val;
      paintPoly.clearAllAccumulated();
    };

    window.map.on('zoomend', () => {
      let firstChild = this.customToleranceInput.firstChild;
      if (firstChild) {
        let interval = firstChild.firstChild.lastChild;
        let display = firstChild.lastChild;
        let val = window.customTolerance;
        if (display) display.innerText = val;
        if (interval) {
          interval.value = val;
          let step = getIntervalStep(val);
          interval.step = step;
          interval.max = val * 2;
        }
      }
    });

    const onChange = (check) => {
      if (check) {
        let val = window.customTolerance;
        let step = getIntervalStep(val);
        const customTolerance = createIntervalInput(
          'Custom tolerance',
          0.0,
          val * 2,
          toleranceChange,
          val || '',
          step,
        );
        this.customToleranceInput.appendChild(customTolerance);
      } else {
        let firstChild = this.customToleranceInput.firstChild;
        if (firstChild) this.customToleranceInput.removeChild(firstChild);
        this.getTool().setGlobalSimplificationTolerance();
      }
    };

    const result = createCheck(
      '',
      onChange,
      'custom-tolerance',
      'By selecting the option you can custom level of detail for brush strokes',
    );
    return result;
  };

  createIconAnchorSlider = (coordinate) => {
    const selectedEl = this._getSelected();

    let iconOptions = selectedEl?.options?.icon?.options || {};
    const iconAnchor = iconOptions.iconAnchor || iconStarter.iconAnchor;
    const value = iconAnchor[coordinate] || '';

    const customAnchor = createIntervalInput(
      `Icon '${coordinate.toUpperCase()}' anchor`,
      0,
      50,
      (val) => this.getState().changeIconAnchor(val, coordinate),
      value,
      1,
    );

    return customAnchor;
  };

  createXAnchorSlider = () => this.createIconAnchorSlider('x');
  createYAnchorSlider = () => this.createIconAnchorSlider('y');

  addHeading = (title, elem) => {
    let headingTag = document.createElement('h3');
    headingTag.innerText = title;
    elem.appendChild(headingTag);
  };

  renderSearchInputs = (elem, model) => {
    this.addHeading('Search for place', elem);
    // * labeled text Search
    this.inputSearch = SidebarInputFactory.createSidebarInput(model.search.input, {
      label: model.search.label,
      action: this.getState().searchAction,
      options: [],
      placeholder: 'Press enter for search',
      setData: this.getState().onInputOptClick,
    });
    elem.appendChild(this.inputSearch.create());

    this.inputConnect = this.createConnectCheck();
    elem.appendChild(this.inputConnect);
    // * divider
    elem.appendChild(document.createElement('hr'));

    this.addHeading('Search for area', elem);
    // * labeled text Search
    this.inputSearchForArea = SidebarInputFactory.createSidebarInput(model.searchForArea.input, {
      label: model.searchForArea.label,
      options: this.getState().getSelectCountries(),
      action: this.getState().searchForAreaAction,
      value: this.getState().countryCode || '',
    });
    elem.appendChild(this.inputSearchForArea.create());

    this.inputAdminLevel = SidebarInputFactory.createSidebarInput(model.adminLevel.input, {
      label: model.adminLevel.label,
      options: ADMIN_LEVELS,
      action: this.getState().pickAdminLevelAction,
      value: this.getState().adminLevel,
    });
    elem.appendChild(this.inputAdminLevel.create());

    const hqCheck = this.createHighQualityCheck();
    elem.appendChild(hqCheck);

    this.errorMsg = document.createElement('div');
    this.errorMsg.className = 'error-text';
    this.errorMsg.innerText = '';
    elem.appendChild(this.errorMsg);

    this.searchForAreasBtn = document.createElement('button');
    this.searchForAreasBtn.innerText = 'Submit';
    this.searchForAreasBtn.addEventListener('click', this.getState().fetchAreas);
    elem.appendChild(this.searchForAreasBtn);
  };

  renderDataInputs = (elem, model) => {
    let disableTextFields = !Boolean(this._getSelected());
    // Select Pick Identifier
    this.inputPickIdentifier = this.createPickIdentifier(model);
    elem.appendChild(this.inputPickIdentifier.create());
    this.inputPickIdentifier.setDisabled(disableTextFields);
    // textfield Identifier
    this.inputId = this.createIdentifierInput(model);
    elem.appendChild(this.inputId.create());
    this.inputId.setDisabled(disableTextFields);
    // textarea Description
    this.inputDesc = SidebarInputFactory.createSidebarInput(model.description.input, {
      label: model.description.label,
      action: this.getState().changeDescriptionAction,
      value: this.convertDescfromPopText(this._getSelected()?.getPopup()?.getContent()),
    });
    elem.appendChild(this.inputDesc.create());
    this.inputDesc.setDisabled(disableTextFields);
  };

  renderDataFilters = (elem, model) => {
    const data = this.getTool()?.getState()?.map?.state?.data;

    const idOpts = data[0] ? Object.keys(data[0]).map((k) => ({ value: k, label: k })) : [];
    const state = this.getState();

    const setDataKey = (e, index) => {
      let val = e.target.value;
      state.setFiltersKey(index, val);
      this.redrawTabContent(this._getSelected()?.layerType);
    };
    const setDataValue = (e, index) => {
      let val = e.target.value;
      state.setFiltersValue(index, val);
      state.callIdentifierChange();
      this.redrawTabContent(this._getSelected()?.layerType);
    };

    for (let index = 0; index < state.filtersAmount; index++) {
      let filtersKey = state.getFiltersKey(index);
      let inputKey = SidebarInputFactory.createSidebarInput(model.dataFilterKey.input, {
        label: model.dataFilterKey.label,
        action: (e) => setDataKey(e, index),
        value: filtersKey,
        options: [{ value: '', label: '' }, ...idOpts],
      });
      let keyEl = inputKey.create();
      elem.appendChild(keyEl);
      // ***********************************************************
      let valueOpts = data && data[0][filtersKey] ? data.map((d) => d[filtersKey]) : [];
      valueOpts = Array.from(new Set(valueOpts));

      let inputValue = SidebarInputFactory.createSidebarInput(model.dataFilterValue.input, {
        label: model.dataFilterValue.label,
        action: (e) => setDataValue(e, index),
        value: state.getFiltersValue(index),
        options: ['', ...valueOpts],
      });
      let valueEl = inputValue.create();
      elem.appendChild(valueEl);

      elem.appendChild(document.createElement('hr'));
    }
  };

  renderFilterInputs = (elem, model) => {
    let disabled = !Boolean(this._getSelected());

    const addFilter = () => {
      this.getState().increaseFilters();
      this.redrawTabContent(this._getSelected().layerType);
    };
    const removeFilter = () => {
      this.getState().decreaseFilters();
      this.getState().callIdentifierChange();
      this.redrawTabContent(this._getSelected().layerType);
    };

    const wrapper = document.createElement('div');
    wrapper.style.width = '100%';
    const addFilterBtn = document.createElement('button');
    addFilterBtn.innerText = 'Add Filter';
    addFilterBtn.addEventListener('click', addFilter);
    if (disabled) addFilterBtn.setAttribute('disabled', disabled);
    else addFilterBtn.removeAttribute('disabled');
    const removeFilterBtn = document.createElement('button');
    removeFilterBtn.innerText = 'Remove Filter';
    removeFilterBtn.addEventListener('click', removeFilter);
    if (disabled) removeFilterBtn.setAttribute('disabled', disabled);
    else removeFilterBtn.removeAttribute('disabled');
    wrapper.appendChild(addFilterBtn);
    wrapper.appendChild(removeFilterBtn);
    elem.appendChild(wrapper);
  };

  renderPolyInputs = (elem, model) => {
    // select stroke thickness
    const thicknessOpts = this.getState().strokes;
    this.inputThickness = SidebarInputFactory.createSidebarInput(model.strokeThickness.input, {
      label: model.strokeThickness.label,
      options: thicknessOpts,
      action: this.getState().changeWeightAction,
      value: this._getSelected()?.options?.weight || this.getState().getSelectedStroke(),
    });
    elem.appendChild(this.inputThickness.create());

    // palette Colors
    this.inputColor = this.createColorPicker();
    elem.appendChild(this.inputColor);
  };

  renderIconInputs = (elem, model) => {
    // palette Icons
    this.inputIcon = this.createIconPalette();
    elem.appendChild(this.inputIcon);

    this.inputUrl = SidebarInputFactory.createSidebarInput(model.iconUrl.input, {
      label: model.iconUrl.label,
      action: this.getState().addIconAction,
      value: '',
    });

    elem.appendChild(this.inputUrl.create());

    const changeConnect = this.createChangeConnectCheck();
    elem.appendChild(changeConnect);

    elem.appendChild(this.createXAnchorSlider());
    elem.appendChild(this.createYAnchorSlider());
  };

  /**
   * It returns the sidebar tab pane.
   *
   * @param {string} layerType
   * @param {boolean} enabled
   * @returns
   */
  getTabContent(layerType = null, enabled = false) {
    // tab content
    let tab = document.createElement('div');
    let elem = tab.appendChild(document.createElement('div'));
    elem.classList.add('drawing-sidebar');

    // get data mapping model
    let model = this.getDefaults().getDataMappingModel();

    let paintPolyControl = this.createBrushSizeControl();
    if (paintPolyControl) elem.appendChild(paintPolyControl);

    if (!layerType) {
      this.getState().clearFilters();
      return tab;
    }

    if (layerType === 'search') {
      this.renderSearchInputs(elem, model);
      this.getState().clearFilters();
      return tab;
    }

    this.renderDataInputs(elem, model);
    this.renderDataFilters(elem, model);
    this.renderFilterInputs(elem, model);

    if (layerType === 'painted' || layerType === 'polygon') {
      this.inputIntersect = this.createIntersectionCheck();
      elem.appendChild(this.inputIntersect);
    }

    if (POLYS.includes(layerType)) {
      this.renderPolyInputs(elem, model);
    }

    if (layerType === 'marker') {
      this.renderIconInputs(elem, model);
    }

    // this.setInputValues(this.getTool().getState().getDataMapping());

    return tab;
  }
}
export default DrawingLayerToolTabControl;
