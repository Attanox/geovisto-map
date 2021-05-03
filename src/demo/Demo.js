import React, { Component } from 'react';
import ReactGeovistoMap from '../react/ReactGeovistoMap';
import FlattenedMapData from '../model/data/basic/FlattenedMapData';

import SettingsTool from '../tools/settings/SettingsTool';
import FiltersTool from '../tools/filters/FiltersTool';
import BasicMapConfig from '../model/config/basic/BasicMapConfig';
import SidebarTool from '../tools/sidebar/SidebarTool';
import ToolsManager from '../model/tool/generic/ToolsManager';
import ThemesManager from '../tools/themes/model/theme/generic/ThemesManager';
import ThemesTool from '../tools/themes/ThemesTool';
import SelectionTool from '../tools/selection/SelectionTool';
import MapLayerTool from '../tools/layers/map/MapLayerTool';
import ChoroplethLayerTool from '../tools/layers/choropleth/ChoroplethLayerTool';
import MarkerLayerTool from '../tools/layers/marker/MarkerLayerTool';
import ConnectionLayerTool from '../tools/layers/connection/ConnectionLayerTool';
import DrawingLayerTool from '../tools/layers/drawing/DrawingLayerTool';
import Dark1Theme from '../tools/themes/model/theme/basic/dark1/Dark1Theme';
import Dark2Theme from '../tools/themes/model/theme/basic/dark2/Dark2Theme';
import Dark3Theme from '../tools/themes/model/theme/basic/dark3/Dark3Theme';
import Light1Theme from '../tools/themes/model/theme/basic/light1/Light1Theme';
import Light2Theme from '../tools/themes/model/theme/basic/light2/Light2Theme';
import Light3Theme from '../tools/themes/model/theme/basic/light3/Light3Theme';
import EqFilterOperation from '../tools/filters/model/basic/EqFilterOperation';
import NeqFilterOperation from '../tools/filters/model/basic/NeqFilterOperation';
import RegFilterOperation from '../tools/filters/model/basic/RegFilterOperation';
import FiltersManager from '../tools/filters/model/generic/FiltersManager';

import 'font-awesome/css/font-awesome.min.css';
import './Demo.scss';

import Polygons from '../../static/geo/country_polygons.json'
import Centroids from '../../static/geo/country_centroids.json'
import JsonData from '../../static/data/demo1.json'
import JsonConfig from '../../static/config/config.json'
import GeojsonConfig from '../../static/geo/map.json'

/* example of screen component with grid layout and card wrapper usage */

const C_ID_select_data = 'leaflet-combined-map-select-data';
const C_ID_check_data = 'leaflet-combined-map-check-data';
const C_ID_input_data = 'leaflet-combined-map-input-data';
const C_ID_check_config = 'leaflet-combined-map-check-config';
const C_ID_input_config = 'leaflet-combined-map-input-config';
const C_ID_check_geojson = 'leaflet-combined-map-check-geojson';
const C_ID_input_geojson = 'leaflet-combined-map-input-geojson';
const C_ID_input_import = 'leaflet-combined-map-input-import';
const C_ID_input_export = 'leaflet-combined-map-input-export';

const PREFIX = '../..'

class Demo extends Component {
  constructor(props) {
    super(props);

    // initialize geo objects
    this.polygons = Polygons;
    this.centroids = Centroids;

    // // implicit file
    const jsonData = JsonData;

    // // implicit config
    const jsonConfig = JsonConfig;

    // // implicitgeojson
    const geojsonConfig = GeojsonConfig;

    // reference to the rendered map
    this.map = React.createRef();

    // data and config can be changed
    this.state = {
      data: jsonData,
      config: jsonConfig,
      geo: geojsonConfig,
    };
  }

  componentDidMount() {
    const _this = this;

    // ------ enable check boxes ------ //

    const enableInput = function (checked, id) {
      if (checked) {
        document.getElementById(id).removeAttribute('disabled');
      } else {
        document.getElementById(id).setAttribute('disabled', 'disabled');
      }
    };

    // enable data check box
    const enableDataInput = function (e) {
      enableInput(e.target.checked, C_ID_input_data);
    };
    document.getElementById(C_ID_input_data).setAttribute('disabled', 'disabled');
    document.getElementById(C_ID_check_data).onchange = enableDataInput;

    // enable config check box
    const enableConfigInput = function (e) {
      enableInput(e.target.checked, C_ID_input_config);
    };
    document.getElementById(C_ID_input_config).setAttribute('disabled', 'disabled');
    document.getElementById(C_ID_check_config).onchange = enableConfigInput;

    // enable geojson check box
    const enableGeojsonInput = function (e) {
      enableInput(e.target.checked, C_ID_input_geojson);
    };
    document.getElementById(C_ID_input_geojson).setAttribute('disabled', 'disabled');
    document.getElementById(C_ID_check_geojson).onchange = enableGeojsonInput;

    // ------ process files ------ //

    // process path
    const pathSubmitted = function (file, result) {
      const reader = new FileReader();
      const onLoadAction = function (e) {
        try {
          console.log(e);
          //console.log(reader.result);
          result.json = JSON.parse(reader.result);
        } catch (ex) {
          console.log('unable to read file');
          // TODO: notify user
        }
      };
      reader.onload = onLoadAction;
      reader.readAsText(file);
    };

    // process data path
    const data = {
      json: undefined,
    };
    const dataPathSubmitted = function (e) {
      console.log(this.files);
      pathSubmitted(this.files[0], data);
    };
    document.getElementById(C_ID_input_data).addEventListener('change', dataPathSubmitted, false);

    // process config path
    const config = {
      json: undefined,
    };
    const configPathSubmitted = function (e) {
      console.log(this.files);
      pathSubmitted(this.files[0], config);
    };
    document
      .getElementById(C_ID_input_config)
      .addEventListener('change', configPathSubmitted, false);

    // process geojson path
    const geo = {
      json: undefined,
    };
    const geoPathSubmitted = function (e) {
      console.log(this.files);
      pathSubmitted(this.files[0], geo);
    };
    document.getElementById(C_ID_input_geojson).addEventListener('change', geoPathSubmitted, false);

    // ------ import ------ //

    // import action
    const importAction = function (e) {
      console.log(e);
      console.log('data: ', data);
      console.log('config: ', config);
      console.log('geo: ', geo);

      // process data json
      if (!document.getElementById(C_ID_check_data).checked || data.json == undefined) {
        const fileName = document.getElementById(C_ID_select_data).value;
        console.log(fileName);
        data.json = React.lazy(() => import(PREFIX + '/static/data/' + fileName));
      }

      // process config json
      if (!document.getElementById(C_ID_check_config).checked || config.json == undefined) {
        config.json = React.lazy(() => import(PREFIX + '/static/config/config.json'));
      }

      // process geojson
      if (!document.getElementById(C_ID_check_geojson).checked || geo.json == undefined) {
        geo.json = React.lazy(() => import(PREFIX + '/static/geo/map.json'));
      }

      // update state
      _this.setState({
        data: data.json,
        config: config.json,
        geo: geo.json,
      });
    };
    document.getElementById(C_ID_input_import).addEventListener('click', importAction);

    // ------ export ------ //

    // export action
    const exportAction = function (e) {
      console.log(e);

      // expert map configuration
      const config = JSON.stringify(_this.map.current.getMap().export(), null, 2);

      // download file
      const element = document.createElement('a');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(config));
      element.setAttribute('download', 'config.json');
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);

      console.log('rendered map:');
    };
    document.getElementById(C_ID_input_export).addEventListener('click', exportAction);
  }

  exportGeoJSON = (evt) => {
    const config = JSON.stringify(this.map.current.getMap().exportGeoJSON(), null, 2);
    // download file
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(config));
    element.setAttribute('download', 'map.json');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  render() {
    console.log('rendering...');
    return (
      <div className="demo-container">
        <div className="demo-toolbar">
          <span>Data file: </span>
          <select id={C_ID_select_data}>
            <option value="demo1.json">demo1.json</option>
            <option value="demo2.json">demo2.json</option>
            <option disabled></option>
          </select>

          <span>
            {' '}
            or <input id={C_ID_check_data} type="checkbox" /> custom file:{' '}
          </span>
          <input id={C_ID_input_data} type="file" accept=".json" size="3" />

          <input id={C_ID_check_config} type="checkbox" />
          <span> Configuration file: </span>
          <input id={C_ID_input_config} type="file" accept=".json" size="3" />

          <input id={C_ID_check_geojson} type="checkbox" />
          <span> GeoJSON file: </span>
          <input id={C_ID_input_geojson} type="file" accept=".json" size="3" />

          <input id={C_ID_input_import} type="submit" value="import" />
          <input id={C_ID_input_export} type="submit" value="export" />

          <input type="submit" value="geoExport" onClick={this.exportGeoJSON} />
        </div>
        <div className="demo-map">
          <ReactGeovistoMap
            ref={this.map}
            id="my-geovisto-map"
            polygons={this.polygons}
            centroids={this.centroids}
            data={new FlattenedMapData(this.state.data)}
            config={new BasicMapConfig(this.state.config)}
            geojson={this.state.geo}
            globals={undefined}
            tools={
              new ToolsManager([
                new SidebarTool({ id: 'geovisto-tool-sidebar' }),
                new SettingsTool({ id: 'geovisto-tool-settings' }),
                new FiltersTool({
                  // filter operations
                  id: 'geovisto-tool-filters',
                  manager: new FiltersManager([
                    new EqFilterOperation(),
                    new NeqFilterOperation(),
                    new RegFilterOperation(),
                  ]),
                }),
                new ThemesTool({
                  // style themes
                  id: 'geovisto-tool-themes',
                  manager: new ThemesManager([
                    new Light1Theme(),
                    new Light2Theme(),
                    new Light3Theme(),
                    new Dark1Theme(),
                    new Dark2Theme(),
                    new Dark3Theme(),
                  ]),
                }),
                new SelectionTool({ id: 'geovisto-tool-selection' }),
                new MapLayerTool({ id: 'geovisto-tool-layer-map' }),
                new ChoroplethLayerTool({ id: 'geovisto-tool-layer-choropleth' }),
                new MarkerLayerTool({ id: 'geovisto-tool-layer-marker' }),
                new ConnectionLayerTool({ id: 'geovisto-tool-layer-connection' }),
                new DrawingLayerTool({ id: 'geovisto-tool-layer-drawing' }),
              ])
            }
          />
        </div>
      </div>
    );
  }
}

export default Demo;
