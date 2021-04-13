import React from 'react';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { normalStyles, polygonCreate, polylineCreate, slicePoly } from '../util/Poly';
import { connectClick, markerCreate } from '../util/Marker';

import '../style/drawingLayer.scss';
import paintPoly from './paintPoly';

import '../components/Edit';

import * as turf from '@turf/turf';

const UNABLE_TO_CLICK_DISABLE = ['lineBtn', 'markerBtn', 'polygonBtn'];

export default function useDrawingToolbar() {
  L.Control.DrawingToolbar = L.Control.extend({
    options: {
      position: 'topleft',
      drawingBtns: {},
    },
    initialize: function (options) {
      if (options) {
        L.setOptions(this, options);
      }
    },
    onAdd: function (map) {
      this.options.map = map;
      return this.createUi();
    },
    createUi: function (map) {
      const topContainer = L.DomUtil.create('div', 'drawingtoolbar');
      const toolContainer = L.DomUtil.create('div', 'leaflet-bar leaflet-control', topContainer);
      toolContainer.style.cursor = 'pointer';

      this.options.drawingBtns.lineBtn = this.createToolbarBtn(
        'lineBtn',
        toolContainer,
        'Line',
        'fa fa-minus',
        true,
      );
      this.options.drawingBtns.markerBtn = this.createToolbarBtn(
        'markerBtn',
        toolContainer,
        'Marker',
        'fa fa-map-marker',
        true,
      );
      this.options.drawingBtns.polygonBtn = this.createToolbarBtn(
        'polygonBtn',
        toolContainer,
        'Polygon',
        'fa fa-star',
        true,
      );

      this.options.drawingBtns.deselectBtn = this.createToolbarBtn(
        'deselectBtn',
        toolContainer,
        'Deselect',
        'fa fa-star-half-o',
      );

      this.options.drawingBtns.transformBtn = this.createToolbarBtn(
        'transformBtn',
        toolContainer,
        'Transform',
        'fa fa-arrows-alt',
      );

      this.options.drawingBtns.editBtn = this.createToolbarBtn(
        'editBtn',
        toolContainer,
        'Edit',
        'fa fa-square',
      );

      this.options.drawingBtns.joinBtn = this.createToolbarBtn(
        'joinBtn',
        toolContainer,
        'Join',
        'fa fa-plus-circle',
        true,
      );

      this.options.drawingBtns.sliceBtn = this.createToolbarBtn(
        'sliceBtn',
        toolContainer,
        'Slice polygon',
        'fa fa-cutlery',
        true,
      );

      this.options.drawingBtns.connectBtn = this.createToolbarBtn(
        'connectBtn',
        toolContainer,
        'Connect',
        'fa fa-sitemap',
        true,
      );

      this.options.drawingBtns.searchBtn = this.createToolbarBtn(
        'searchBtn',
        toolContainer,
        'Search',
        'fa fa-search',
      );

      this.options.drawingBtns.paintBtn = this.createToolbarBtn(
        'paintBtn',
        toolContainer,
        'Paint',
        'fa fa-paint-brush',
        true,
      );

      this.options.drawingBtns.eraserBtn = this.createToolbarBtn(
        'eraseBtn',
        toolContainer,
        'Erase',
        'fa fa-eraser',
        true,
      );

      this.options.drawingBtns.removeBtn = this.createToolbarBtn(
        'removeBtn',
        toolContainer,
        'Remove',
        'fa fa-fire',
      );

      this.addEventListeners();
      L.DomEvent.disableClickPropagation(topContainer);
      return topContainer;
    },

    onRemove: function (map) {},

    _disableDrawing: function (e) {
      e.stopPropagation();
      e?.target?.classList?.toggle('hide');
      const sidebar = this.getSidebar();
      let enabled = sidebar.getState().getEnabledEl();
      if (enabled) {
        sidebar.getState().setEnabledEl(null);
        this.redrawSidebar();
      }
    },

    _disableTransform: function () {
      const layer = this.getCurrEl();

      if (layer?.transform?._enabled) {
        layer.transform.disable();
        layer.dragging.disable();
        let paintPoly = this.getSidebar().getState().paintPoly;
        paintPoly.updatePaintedPolys(layer.kIdx, layer);
      }
    },

    addEventListeners: function () {
      const {
        lineBtn,
        markerBtn,
        polygonBtn,
        transformBtn,
        editBtn,
        sliceBtn,
        joinBtn,
        deselectBtn,
        connectBtn,
        searchBtn,
        paintBtn,
        eraserBtn,
        removeBtn,
      } = this.options.drawingBtns;
      const map = this.options.map;
      const sidebar = this.getSidebar();

      const btnsArr = Object.values(this.options.drawingBtns);
      btnsArr.forEach((btn) => {
        if (btn.className !== 'transformBtn') {
          L.DomEvent.on(btn, 'click', this._disableTransform, this);
        }
      });

      const toggleExtra = (e) => {
        withExtra.forEach((btn) => btn.lastChild.classList.add('hide'));
        let extraBtn = e.target.lastChild;
        if (!extraBtn) extraBtn = e.target.nextSibling;
        extraBtn.classList.toggle('hide');
        L.DomEvent.on(extraBtn, 'click', this._disableDrawing, this);
      };
      const withExtra = [
        lineBtn,
        markerBtn,
        polygonBtn,
        connectBtn,
        sliceBtn,
        paintBtn,
        eraserBtn,
        joinBtn,
      ];
      withExtra.forEach((btn) => {
        L.DomEvent.on(btn, 'click', toggleExtra, this);
      });

      L.DomEvent.on(lineBtn, 'click', () => this.initCreatePolyline(map, sidebar), this);
      L.DomEvent.on(markerBtn, 'click', L.DomEvent.stopPropagation)
        .on(markerBtn, 'click', L.DomEvent.preventDefault)
        .on(markerBtn, 'click', () => this.initCreateMarker(map, sidebar), this);
      L.DomEvent.on(polygonBtn, 'click', () => this.initCreatePolygon(map, sidebar), this);
      L.DomEvent.on(transformBtn, 'click', this.initTransform, this);
      L.DomEvent.on(editBtn, 'click', this.initNodeEdit, this);
      L.DomEvent.on(sliceBtn, 'click', () => this.initSlicePoly(map, sidebar), this);
      L.DomEvent.on(deselectBtn, 'click', this.deselect, this);
      L.DomEvent.on(joinBtn, 'click', this.initJoin, this);
      L.DomEvent.on(connectBtn, 'click', L.DomEvent.stopPropagation)
        .on(connectBtn, 'click', L.DomEvent.preventDefault)
        .on(connectBtn, 'click', () => this.initConnect(map, sidebar), this);
      L.DomEvent.on(searchBtn, 'click', this.initSearch, this);
      L.DomEvent.on(paintBtn, 'click', this.initPainting, this);
      L.DomEvent.on(eraserBtn, 'click', this.initErasing, this);
      L.DomEvent.on(removeBtn, 'click', this.initRemove, this);
    },

    initJoin: function (evt) {
      const sidebar = this.getSidebar();
      const init = this.options.tool.initSelecting;
      init();
      sidebar.getState().setEnabledEl({
        enable: init,
        disable: () => {
          init();
          this.options.tool.getState().deselectChosenLayers();
        },
      });
    },

    initConnect: function (map, sidebar) {
      this.redrawSidebar('marker');
      connectClick(map, sidebar);
    },

    initRemove: function (evt) {
      this.options.tool.removeElement();
    },

    initErasing: function (evt) {
      this.redrawSidebar(null);
      let sidebar = this.getSidebar();
      let paintPoly = sidebar.getState().paintPoly;
      sidebar.getState().paintPoly.erase(evt);

      sidebar
        .getState()
        .setEnabledEl({ enable: paintPoly.enableErase, disable: paintPoly.disable });
    },

    initPainting: function (e) {
      this.redrawSidebar('painted');
      let sidebar = this.getSidebar();
      let paintPoly = sidebar.getState().paintPoly;
      sidebar.getState().paintPoly.clickDraw(e);

      sidebar
        .getState()
        .setEnabledEl({ enable: paintPoly.enablePaint, disable: paintPoly.disable });
    },

    initSearch: function () {
      this.options.tool.search();
    },

    initCreatePolyline: function (map, sidebar) {
      this.redrawSidebar('polyline');
      polylineCreate(map, sidebar);
    },
    initCreatePolygon: function (map, sidebar) {
      this.redrawSidebar('polygon');
      polygonCreate(map, sidebar);
    },
    initCreateMarker: function (map, sidebar) {
      this.redrawSidebar('marker');
      markerCreate(map, sidebar);
    },
    initSlicePoly: function (map, sidebar) {
      this.redrawSidebar(null);
      slicePoly(map, sidebar);
    },

    deselect: function () {
      const currEl = this.getCurrEl();
      // console.log({ currEl });

      if (currEl?.editing?._enabled) {
        currEl.editing.disable();
      }
      let selected = this.options.tool.getState().selectedLayer;
      if (selected) {
        this.options.tool.normalizeElement(selected);
        this.options.tool.initNodeEdit(true);
        this.options.tool.getState().clearSelectedLayer();
        this.redrawSidebar();
        this.setCurrEl(null);
        document.querySelector('.leaflet-container').style.cursor = '';
      }
    },

    initNodeEdit: function () {
      this.options.tool.initNodeEdit();
    },

    initTransform: function () {
      const currEl = this.getCurrEl();

      this.options.tool.initTransform(currEl);
    },

    createToolbarBtn: function (className, btnContainer, title, icon, extra = false) {
      const returnBtn = L.DomUtil.create('a', `${className} d-side-button`, btnContainer);
      returnBtn.title = title;
      returnBtn.innerHTML = `<i class="${icon}" aria-hidden="true"></i>`;
      returnBtn.role = 'button';
      if (extra) {
        const extraBtn = L.DomUtil.create('a', 'extra-btn hide', returnBtn);
        extraBtn.innerHTML = `Cancel`;
        extraBtn.role = 'button';
      }
      return returnBtn;
    },

    getCurrEl: function () {
      return this.options.tool.getState().currEl;
    },

    setCurrEl: function (el) {
      this.options.tool.getState().setCurrEl(el);
    },

    redrawSidebar: function (val) {
      this.options.tool.redrawSidebarTabControl(val);
    },

    getSidebar: function () {
      return this.options.tool.getSidebarTabControl();
    },
  });

  L.control.drawingToolbar = function (options) {
    if (!options) {
      options = {};
    }
    return new L.Control.DrawingToolbar(options);
  };
}
