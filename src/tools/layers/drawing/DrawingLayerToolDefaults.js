import { AbstractLayerToolDefaults } from '../abstract';
import DrawingLayerTool from './DrawingLayerTool';
import LabeledTextSidebarInput from '../../../inputs/input/LabeledTextSidebarInput';
import LabeledTextAreaSidebarInput from '../../../inputs/input/LabeledTextAreaSidebarInput';
import LabeledSelectSidebarInput from '../../../inputs/select/LabeledSelectSidebarInput';
import AutocompleteSidebarInput from '../../../inputs/input/AutocompleteSidebarInput';

/**
 * TODO: refactorization needed!
 */
const TYPE = 'drawing';

const INPUT_ID_PREFIX = 'geovisto-input-' + TYPE;

/**
 * Data mapping model which can be used in the sidebar form.
 */
const MAPPING_MODEL = {
  idKey: {
    id: INPUT_ID_PREFIX + '-idKey',
    name: 'idKey',
    label: 'ID key',
    input: LabeledSelectSidebarInput.ID(),
  },
  identifier: {
    id: INPUT_ID_PREFIX + '-identifier',
    name: 'identifier',
    label: 'Identifier',
    input: AutocompleteSidebarInput.ID(),
  },
  description: {
    id: INPUT_ID_PREFIX + '-description',
    name: 'description',
    label: 'Description',
    input: LabeledTextAreaSidebarInput.ID(),
  },
  strokeThickness: {
    id: INPUT_ID_PREFIX + '-stroke-thickness',
    name: 'stroke-thickness',
    label: 'Stroke thickness',
    input: LabeledSelectSidebarInput.ID(),
  },
  search: {
    id: INPUT_ID_PREFIX + '-search',
    name: 'search',
    label: 'Search',
    input: AutocompleteSidebarInput.ID(),
  },
  searchForArea: {
    id: INPUT_ID_PREFIX + '-search-for-area',
    name: 'search-for-area',
    label: 'Search',
    input: LabeledSelectSidebarInput.ID(),
  },
  adminLevel: {
    id: INPUT_ID_PREFIX + '-admin-level',
    name: 'admin-level',
    label: 'Pick level of administration',
    input: LabeledSelectSidebarInput.ID(),
  },
  iconUrl: {
    id: INPUT_ID_PREFIX + '-iconUrl',
    name: 'iconUrl',
    label: 'Icon URL',
    input: LabeledTextSidebarInput.ID(),
  },
  dataFilterKey: {
    id: INPUT_ID_PREFIX + '-data-filter-key',
    name: 'data-filter-key',
    label: 'Pick column',
    input: LabeledSelectSidebarInput.ID(),
  },
  dataFilterValue: {
    id: INPUT_ID_PREFIX + '-data-filter-value',
    name: 'data-filter-value',
    label: 'Pick value',
    input: LabeledSelectSidebarInput.ID(),
  },
};

/**
 * This class provide functions which return the default state values.
 *
 * @author Andrej Tlcina
 */
class DrawingLayerToolDefaults extends AbstractLayerToolDefaults {
  /**
   * It initializes tool defaults.
   */
  constructor() {
    super();
  }

  /**
   * It returns a unique type string of the tool which is based on the layer it wraps.
   */
  getType() {
    return DrawingLayerTool.TYPE();
  }

  /**
   * It returns the layer name.
   */
  getName() {
    return 'Drawing layer';
  }

  /**
   * It returns the default mapping of data domains to chart dimensions.
   */
  getDataMapping() {
    let dataMapping = {};

    let dataMappingModel = this.getDataMappingModel();
    let implicitDataDomainLabel = this.getMapObject()
      .getMap()
      .getState()
      .getMapData()
      .getDataDomainLabels()[0];
    console.log({ implicitDataDomainLabel });

    dataMapping[dataMappingModel.identifier.name] = implicitDataDomainLabel;
    dataMapping[dataMappingModel.description.name] = implicitDataDomainLabel;

    return dataMapping;
  }

  /**
   * It returns the data mapping model.
   */
  getDataMappingModel() {
    return MAPPING_MODEL;
  }
}
export default DrawingLayerToolDefaults;
