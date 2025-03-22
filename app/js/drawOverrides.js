import calc from "./calc.js";
import compasspng from "../img/icons/ruler-compass.png"
import content from "./content.js";
import util from "./util.js";

const
    RED = '#9A070B',
    RED_FRONT = '#BD0101',
    BLUE = '#3C6490',
    BLUE_FRONT = '#4D4B40',
    BLACK = '#000000',
    FLIGHT_OPACITY = 0.8,
    CIRCLE_OPTIONS = {
        color: RED,
        weight: 2,
        opacity: FLIGHT_OPACITY
    },
    LINE_OPTIONS = {
        color: RED,
        weight: 2,
        opacity: FLIGHT_OPACITY
    },
    COMPASS_OPTIONS = {
        color: BLACK,
        weight: 2,
        opacity: FLIGHT_OPACITY
    }
;

// Extend polyline to have dynamic tooltip text
L.Draw.Polyline = L.Draw.Polyline.extend({
    _getTooltipText: function () {
        var showLength = this.options.showLength,
            labelText, distanceStr, headingStr;
        if (this._markers.length === 0) {
            labelText = {
                text: L.drawLocal.draw.handlers.polyline.tooltip.start
            };
        } else {
            var oldlatlng = this._markers[this._markers.length - 1].getLatLng();
            var latlng = this._currentLatLng;
            distanceStr = showLength ? this._getMeasurementString() : '';
            headingStr = (Math.round(calc.heading(oldlatlng, latlng) * 10) / 10).toFixed(1);

            if (this._markers.length === 1) {
                labelText = {
                    //text: L.drawLocal.draw.handlers.polyline.tooltip.cont,
                    text: 'Heading: ' + headingStr + '&deg<br />Click to continue the flight plan / polyline',
                    subtext: distanceStr
                };
            } else {
                labelText = {
                    //text: L.drawLocal.draw.handlers.polyline.tooltip.end,
                    text: 'Heading: ' + headingStr + '&deg<br />Click last point to finish flight plan / polyline',
                    subtext: distanceStr
                };
            }
        }
        return labelText;
    }
});

var myIcon = L.icon({
    iconUrl: compasspng,
    iconSize: [300, 300],
});

// Build our ruler tool
L.Draw.Ruler = L.Draw.Feature.extend({
    
    statics: {
        TYPE: 'ruler'
    },

	Poly: L.Polyline,

    options: {
		allowIntersection: true,
		repeatMode: false,
        icon: myIcon,
		mouseIcon: new L.DivIcon({
			iconSize: new L.Point(8, 8),
			className: 'leaflet-div-icon leaflet-editing-icon'
		}),
        shapeOptions: {
            stroke: true,
            color: BLACK,
            weight: 2,
			opacity: 0.8
        },
		metric: true, // Whether to use the metric measurement system or imperial
		feet: true, // When not metric, to use feet instead of yards for display.
		nautic: false, // When not metric, not feet use nautic mile for display
		showLength: true, // Whether to display distance in the tooltip
		zIndexOffset: 20000, // This should be > than the highest z-index any map layers
		factor: 1, // To change distance calculation
		maxPoints: 0 // Once this number of points are placed, finish shape
    },

    // @method initialize(): void
	initialize: function (map, options) {
		// Save the type so super can fire, need to do this as cannot do this.TYPE :(
		this.type = L.Draw.Ruler.TYPE;

		this._initialLabelText = L.drawLocal.draw.handlers.ruler.tooltip.start;

		L.Draw.Feature.prototype.initialize.call(this, map, options);

        this._startpos = null;
	},

	// @method addHooks(): void
	// Add listener hooks to this handler.
	addHooks: function () {
		L.Draw.Feature.prototype.addHooks.call(this);

		if (this._map) {
			this._mapDraggable = this._map.dragging.enabled();

			this._container.style.cursor = 'crosshair';

			if (this._mapDraggable) {
				this._map.dragging.disable();
			}

			this._poly = new L.Polyline([], this.options.shapeOptions);

			this._tooltip.updateContent({text: this._initialLabelText});

			if (!this._compassMarker) {
				this._compassMarker = L.marker(this._map.getCenter(), {
					icon: myIcon,
					opacity: 100,
					zIndexOffset: this.options.zIndexOffset,
                    interactive: false
				});
			}

			if (!this._blockerMarker) {
				this._blockerMarker = L.marker(this._map.getCenter(), {
					icon: L.divIcon({
						className: 'leaflet-mouse-marker',
						iconAnchor: [20, 20],
						iconSize: [40, 40]
					}),
					opacity: 0,
					zIndexOffset: this.options.zIndexOffset + 1
				});
			}

            this._compassMarker.addTo(this._map);

			this._blockerMarker
                .on('mousedown', this._onMouseDown, this)
                .on('mousemove', this._onMouseMove, this)
                .on('mouseup', this._onMouseUp, this)
                .on('mouseout', this._onMouseOut, this)
                .addTo(this._map);

			this._map
                .on('mousedown', this._onMouseDown, this)
                .on('mouseup', this._onMouseUp, this)
                .on('mousemove', this._onMouseMove, this)
                .on('mouseout', this._onMouseOut, this)
		}
	},

	// @method removeHooks(): void
	// Remove listener hooks from this handler.
	removeHooks: function () {
		L.Draw.Feature.prototype.removeHooks.call(this);
        if (this._mapDraggable) {
            this._map.dragging.enable();
        }

		this._container.style.cursor = '';

		this._map.removeLayer(this._poly);
		delete this._poly;

		this._map.removeLayer(this._compassMarker);
		delete this._compassMarker;

		this._blockerMarker
            .off('mousedown', this._onMouseDown, this)
            .off('mousemove', this._onMouseMove, this)
            .off('mouseup', this._onMouseUp, this)
            .off('mouseout', this._onMouseOut, this);
		this._map.removeLayer(this._blockerMarker);
		delete this._blockerMarker;

		this._map
            .off('mousedown', this._onMouseDown, this)
            .off('mousemove', this._onMouseMove, this)
            .off('mouseup', this._onMouseUp, this)
            .off('mouseout', this._onMouseOut, this);
	},

    _drawRuler: function (startlatlng, endlatlng) {
        var latlngs = [[startlatlng,endlatlng]];
		this._poly.setLatLngs(latlngs);

        this._map.addLayer(this._poly);
	},

	_onMouseDown: function (e) {
        if (this._clickHandled === true) {
            this._startpos = null;
            this._map.removeLayer(this._poly);
            this._compassMarker.setLatLng(e.latlng);
            this._tooltip.updateContent({text: this._initialLabelText});
            this._clickHandled = null;
        }
        else {
            if (this._startpos === null) {
                this._startpos = e.latlng;
            }
            this._clickHandled = true;
        }
        L.DomEvent.stopPropagation(e);
	},

	_onMouseMove: function (e) {
		var newPos = this._map.mouseEventToLayerPoint(e.originalEvent);
		var latlng = this._map.layerPointToLatLng(newPos);
        if (this._clickHandled === true) {
            if (this._startpos === null ) {
                this._startpos = latlng;
            }

            var mapConfig = util.getSelectedMapConfig(window.location.hash , content.maps);
            var units = (window.localStorage.getItem('units') || 'metric');
            var unitText = units === 'metric' ? 'km' : 'mi';

            this._tooltip.updatePosition(latlng);

            var heading = calc.heading(this._startpos, latlng);
            var reciprocal = (heading + 180) % 360;
            var distance = parseFloat(calc.convertMetricScale(mapConfig.scale, units) * L.CRS.Simple.distance(this._startpos, latlng));

            this._blockerMarker.setLatLng(latlng);
            this._tooltip.updateContent({text: 'Distance: ' + distance.toFixed(1) + unitText + '<br />Heading: ' + heading.toFixed(1) + '&deg<br />Reciprocal: ' + reciprocal.toFixed(1) + '&deg'});
            this._tooltip.updatePosition(latlng);
            this._drawRuler(this._startpos, latlng);
        }
        else {
            this._compassMarker.setLatLng(latlng);
            this._blockerMarker.setLatLng(latlng);
            this._tooltip.updatePosition(latlng);
        }
	},

    _onMouseUp: function (e) {

    }
});

L.DrawToolbar = L.DrawToolbar.extend({
    options: {
        polyline: {},
        polygon: {},
        rectangle: {},
        circle: {},
        marker: {},
        circlemarker: {},
        ruler: {}
    },

    getModeHandlers: function (map) {
        return [
            {
                enabled: this.options.polyline,
                handler: new L.Draw.Polyline(map, this.options.polyline),
                title: L.drawLocal.draw.toolbar.buttons.polyline
            },
            {
                enabled: this.options.polygon,
                handler: new L.Draw.Polygon(map, this.options.polygon),
                title: L.drawLocal.draw.toolbar.buttons.polygon
            },
            {
                enabled: this.options.rectangle,
                handler: new L.Draw.Rectangle(map, this.options.rectangle),
                title: L.drawLocal.draw.toolbar.buttons.rectangle
            },
            {
                enabled: this.options.circle,
                handler: new L.Draw.Circle(map, this.options.circle),
                title: L.drawLocal.draw.toolbar.buttons.circle
            },
            {
                enabled: this.options.marker,
                handler: new L.Draw.Marker(map, this.options.marker),
                title: L.drawLocal.draw.toolbar.buttons.marker
            },
            {
                enabled: this.options.circlemarker,
                handler: new L.Draw.CircleMarker(map, this.options.circlemarker),
                title: L.drawLocal.draw.toolbar.buttons.circlemarker
            },
            {
                enabled: this.options.ruler,
                handler: new L.Draw.Ruler(map, this.options.ruler),
                title: L.drawLocal.draw.toolbar.buttons.ruler
            }
        ];
    }
});

// Fix broken circle editing
L.Edit.Circle = L.Edit.Circle.extend({
	_resize: function (latlng) {
		var radius, moveLatLng = this._moveMarker.getLatLng();

        radius = this._map.distance(moveLatLng, latlng);
		this._shape.setRadius(radius);

		if (this._map.editTooltip) {
			this._map._editTooltip.updateContent({
				text: L.drawLocal.edit.handlers.edit.tooltip.subtext + '<br />' + L.drawLocal.edit.handlers.edit.tooltip.text,
				subtext: L.drawLocal.draw.handlers.circle.radius + ': ' +
				L.GeometryUtil.readableDistance(radius, true, this.options.feet, this.options.nautic)
			});
		}

		this._shape.setRadius(radius);

		this._map.fire(L.Draw.Event.EDITRESIZE, {layer: this._shape});
	}
});

L.drawLocal.draw.toolbar.buttons.ruler = 'Use ruler';

L.drawLocal.draw.handlers.ruler = {
    tooltip: {
        start: 'Click and drag to draw ruler.'
    }
};

// Extend the draw UI with our own text
L.drawLocal.draw.toolbar.buttons.polyline = 'Map a flight / Draw a polyline';
L.drawLocal.draw.toolbar.buttons.ruler = 'Measure distance and heading';
L.drawLocal.draw.handlers.ruler.tooltip.start = 'Click and drag to measure distance and heading';
L.drawLocal.draw.handlers.polyline.tooltip.start = 'Click to start a flight plan / polyline';
L.drawLocal.draw.handlers.polyline.tooltip.cont = 'Click to continue the flight plan / polyline';
L.drawLocal.draw.handlers.polyline.tooltip.end = 'Click last point to finish flight plan / polyline';

// Fix dragging while drawing polyline/polygon
L.Draw.Polyline.prototype._onTouch = L.Util.falseFn;
