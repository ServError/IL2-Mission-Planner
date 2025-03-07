import 'font-awesome/css/font-awesome.min.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-modal/dist/leaflet.modal.min.css';
import 'skeleton-css/css/normalize.css';
import 'skeleton-css/css/skeleton.css';
import '../css/index.css';

import L from "leaflet";
import 'leaflet-draw';
import 'leaflet-polylinedecorator';
import 'leaflet-modal';
import { Validatinator } from "validatinator";
import 'leaflet-textpath';
import calc from "./calc.js";
import content from "./content.js";
import util from "./util.js";
import webdis from "./webdis.js";
import "./controls.js";
import conf from '../../dist/conf.json' with { type: "json" };
import icons_unmapped from "./icons.js"; //(L)?

const icons = icons_unmapped(L);

(function() {

    'use strict';

    const
        EXPORT_REV = 2,
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
        }
    ;

    var map, mapTiles, mapConfig, drawnItems, drawnMarkers, hiddenLayers, frontline,
            drawControl, selectedMapIndex, stopwatchControl, stopwatchVisible;

    var state = {
        units: window.localStorage.getItem('units') || 'metric',
        style: window.localStorage.getItem('style') || 'cb',
        colorsInverted: false,
        showBackground: true,
        streaming: false,
        connected: false,
        changing: false,
        streamInfo: {},
        streamingAvailable: (conf.streaming === true) ? webdis.init() : false
    };

    // Initialize form validation
    var V = new Validatinator(content.validatinatorConfig);

    function mapIsEmpty() {
      return drawnItems.getLayers().length === 0 && frontline.getLayers().length === 0;
    }

    function applyCircle(circle) {
        if (state.changing || state.connected) {
            return;
        }
        if (typeof circle.color === 'undefined') {
            circle.options.color = content.default.circleColor;
        }
        var clickedOk = false;
        map.openModal({
            color: circle.options.color,
            fillOpacity: circle.options.fillOpacity,
            template: content.circleModalTemplate,
            zIndex: 10000,

            onShow: function(e) {
                var element = document.getElementById('circleColor');
                element.focus();
                L.DomEvent.on(e.modal._container.querySelector('.modal-ok'), 'click', function() {
                    clickedOk = true;
                    e.modal.hide();
                });
                L.DomEvent.on(e.modal._container.querySelector('.modal-cancel'), 'click', function() {
                    e.modal.hide();
                });
            },
            onHide: function(e) {
                if (clickedOk) {
                    circle.options.color = document.getElementById('circleColor').value;
                    var circleFillCheckbox = document.getElementById('circle-fill-checkbox');
                    
                    switch (circle.options.color)
                    {
                        case 'blue':
                            circle.options.color = BLUE;
                            break;
                        case 'black':
                            circle.options.color = BLACK;
                            break;
                        case 'red':
                        default:
                            circle.options.color = RED;
                            break;
                    }
                    circle.setStyle({color:circle.options.color});
                    if (!circleFillCheckbox.checked)
                    {
                        circle.options.fillOpacity = 0;
                    }
                    else
                    {
                        circle.options.fillOpacity = 0.2;
                    }
                    circle.setStyle({fillOpacity: circle.options.fillOpacity});
                } else {
                    drawnItems.removeLayer(circle);
                }
                checkButtonsDisabled();
            }
        });
    }

    function applyPolygon(polygon) {
        if (state.changing || state.connected) {
            return;
        }
        if (typeof polygon.color === 'undefined') {
            polygon.options.color = content.default.polygonColor;
        }
        polygon.options.isPolygon = true;
        var clickedOk = false;
        map.openModal({
            color: polygon.options.color,
            fillOpacity: polygon.options.fillOpacity,
            template: content.polygonModalTemplate,
            zIndex: 10000,

            onShow: function(e) {
                var element = document.getElementById('polygonColor');
                element.focus();
                L.DomEvent.on(e.modal._container.querySelector('.modal-ok'), 'click', function() {
                    clickedOk = true;
                    e.modal.hide();
                });
                L.DomEvent.on(e.modal._container.querySelector('.modal-cancel'), 'click', function() {
                    e.modal.hide();
                });
            },
            onHide: function(e) {
                if (clickedOk) {
                    polygon.options.color = document.getElementById('polygonColor').value;
                    var polygonFillCheckbox = document.getElementById('polygon-fill-checkbox');
                    
                    switch (polygon.options.color)
                    {
                        case 'blue':
                            polygon.options.color = BLUE;
                            break;
                        case 'black':
                            polygon.options.color = BLACK;
                            break;
                        case 'red':
                        default:
                            polygon.options.color = RED;
                            break;
                    }
                    polygon.setStyle({color:polygon.options.color});
                    if (!polygonFillCheckbox.checked)
                    {
                        polygon.options.fillOpacity = 0;
                    }
                    else
                    {
                        polygon.options.fillOpacity = 0.2;
                    }
                    polygon.setStyle({fillOpacity: polygon.options.fillOpacity});
                } else {
                    drawnItems.removeLayer(polygon);
                }
                checkButtonsDisabled();
            }
        });
    }

    function newFlightDecorator(route) {
        return L.polylineDecorator(route, {
            patterns: [
                {
                    offset: 6,
                    repeat: 300,
                    symbol: L.Symbol.arrowHead({
                        pathOptions: {
                            opacity: 0,
                            fillOpacity: FLIGHT_OPACITY,
                            color: route.color
                        }
                    })
                }
            ]
        });
    }

    // dont forget to adjust the distance in both the leg before and after the marker
    function applyCustomFlightTurn(marker) {
        if (state.changing || state.connected) {
            return;
        }
        var parentRoute = drawnItems.getLayer(marker.parentId);
        map.openModal({
            altitude: marker.options.altitude,
            template: content.flightTurnModalTemplate,
            zIndex: 10000,
            onShow: function(e) {
                var element = document.getElementById('flight-turn-altitude');
                element.focus();
                element.select();
                L.DomEvent.on(e.modal._container.querySelector('.modal-ok'), 'click', function() {
                    if (V.passes('flight-turn-form')) {
                        var newAltitude = parseInt(element.value);
                        parentRoute.altitudes[marker.index] = newAltitude;
                        marker.options.altitude = newAltitude;
                        if (marker.priorMarkerId !== 0)
                        {
                            var altDiff = calc.altitudeUnitAdjust(Math.abs(parentRoute.altitudes[marker.index] - parentRoute.altitudes[marker.index-1]), state.units);
                            //var gndDistance = calc.convertMetricScale(mapConfig.scale, state.units) * L.CRS.Simple.distance(coords[marker.index], coords[marker.index-1]);
                            //var airDistance = parseFloat(altDiff) + parseFloat(gndDistance);

                            var priorMarker = drawnMarkers.getLayer(marker.priorMarkerId);
                            priorMarker.options.altDiff = altDiff;
                            applyCustomFlightLegCallback(priorMarker);
                        }
                        if (marker.followingMarkerId !== 0)
                        {
                            altDiff = calc.altitudeUnitAdjust(Math.abs(parentRoute.altitudes[marker.index] - parentRoute.altitudes[marker.index+1]), state.units);
                            //gndDistance = calc.convertMetricScale(mapConfig.scale, state.units) * L.CRS.Simple.distance(coords[marker.index], coords[marker.index-1]);
                            //airDistance = parseFloat(altDiff) + parseFloat(gndDistance);

                            var followingMarker = drawnMarkers.getLayer(marker.followingMarkerId);
                            followingMarker.options.altDiff = altDiff;
                            applyCustomFlightLegCallback(followingMarker);
                        }
                        
                        applyCustomFlightTurnCallback(marker);
                        e.modal.hide();
                    } else {
                        var errorElement = document.getElementById('flight-turn-error');
                        var units = state.units === 'metric' ? 'meters' : 'feet';
                        errorElement.innerHTML = 'Please input a valid altitude in' + units + '.';
                        util.removeClass(errorElement, 'hidden-section');
                        errorElement.focus();
                    }
                });
                L.DomEvent.on(e.modal._container.querySelector('.modal-cancel'), 'click', function() {
                    e.modal.hide();
                });
            }
        });
    }

    function applyCustomFlightTurnCallback(marker) {
        var newContent = util.formatFlightTurnMarker(marker.options.altitude, state.units);
        if (marker.priorMarkerId !== 0){
            marker.setIcon(icons.textIconFactory(newContent, 'flight-turn ' + getMapTextClasses(state)));
        }
        else {
            marker.setIcon(icons.textIconFactory(newContent, 'flight-start-alt ' + getMapTextClasses(state)));
        }
        publishMapState();
    }

    function applyCustomFlightLeg(marker) {
        if (state.changing || state.connected) {
            return;
        }
        var parentRoute = drawnItems.getLayer(marker.parentId);
        map.openModal({
            speed: parentRoute.speeds[marker.index],
            template: content.flightLegModalTemplate,
            zIndex: 10000,
            onShow: function(e) {
                var element = document.getElementById('flight-leg-speed');
                element.focus();
                element.select();
                L.DomEvent.on(e.modal._container.querySelector('.modal-ok'), 'click', function() {
                    if (V.passes('flight-leg-form')) {
                        var newSpeed = parseInt(element.value);
                        parentRoute.speeds[marker.index] = newSpeed;
                        marker.options.speed = newSpeed;
                        applyCustomFlightLegCallback(marker);
                        e.modal.hide();
                    } else {
                        var errorElement = document.getElementById('flight-leg-error');
                        var units = state.units === 'metric' ? 'kilometers' : 'miles';
                        errorElement.innerHTML = 'Please input a valid speed in' + units + 'per hour.';
                        util.removeClass(errorElement, 'hidden-section');
                        errorElement.focus();
                    }
                });
                L.DomEvent.on(e.modal._container.querySelector('.modal-cancel'), 'click', function() {
                    e.modal.hide();
                });
            }
        });
    }

    function applyCustomFlightLegCallback(marker) {
        marker.options.time = util.formatTime(calc.time(marker.options.speed, parseFloat(marker.options.gndDistance) + parseFloat(marker.options.altDiff)));
        var newContent = util.formatFlightLegMarker(
                marker.options.gndDistance, 
                marker.options.heading, 
                marker.options.speed, 
                marker.options.time,
                state.units
            );
        marker.setIcon(icons.textIconFactory(newContent, 'flight-leg  nobg ' + getMapTextClasses(state)));
        publishMapState();
    }

    function applyFlightPlanCallback(route, newFlight) {
        const routeClickHandlerFactory = function (clickedRoute) {
            return function() {
                if (state.changing || state.connected) {
                    return;
                }
                deleteAssociatedLayers(L.layerGroup([clickedRoute]));
                applyFlightPlan(clickedRoute);
            };
        };
        const markerClickHandlerFactory = function (clickedMarker) {
            return function() {
                if (state.changing || state.connected) {
                    return;
                }
                applyCustomFlightLeg(clickedMarker);
            };
        };
        const turnClickHandlerFactory = function (clickedMarker) {
            return function() {
                if (state.changing || state.connected) {
                    return;
                }
                applyCustomFlightTurn(clickedMarker);
            };
        };

        if (newFlight) {
            route.on('click', routeClickHandlerFactory(route));
        }
        var id = route._leaflet_id;
        var coords = route.getLatLngs();
        var decorator = newFlightDecorator(route);
        decorator.parentId = id;
        decorator.addTo(drawnMarkers);
        decorator.on('click', routeClickHandlerFactory(route));
        if (typeof route.speeds === 'undefined' || route.speedDirty || route.wasEdited) {
            route.speeds = util.defaultPopulateArray(route.speed, coords.length-1);
            route.speedDirty = false;
        }
        if (typeof route.altitudes === 'undefined' || route.altitudeDirty || route.wasEdited) {
            route.altitudes = util.defaultPopulateArray(route.altitude, coords.length);
            route.altitudeDirty = false;
        }

        var turnCoords = L.latLng(coords[0].lat, coords[0].lng);
        var turnMarkerContent = util.formatFlightTurnMarker(route.altitudes[0], state.units);
        var turnMarker = L.marker(turnCoords, {
            altitude: route.altitudes[0],
            draggable: false,
            icon: icons.textIconFactory(turnMarkerContent, ' flight-start-alt ' + getMapTextClasses(state))
        });
        turnMarker.parentId = id;
        turnMarker.priorMarkerId = 0;

        turnMarker.index = 0;
        turnMarker.on('click', turnClickHandlerFactory(turnMarker));
        turnMarker.addTo(drawnMarkers);

        var orientation = 0;
        var heading = calc.heading(coords[0], coords[1]);
        if (heading > 180)
        {
            orientation = 'flip';
        }

        route.setText(null); // Remove old name if present
        route.setText(route.name, {offset: -10, orientation: orientation, attributes: {class: 'text-path-flight-title', fill: route.color}});

        for (var i = 0; i < coords.length-1; i++) {
            var altDiff = calc.altitudeUnitAdjust(Math.abs(route.altitudes[i] - route.altitudes[i+1]), state.units);
            var gndDistance = calc.convertMetricScale(mapConfig.scale, state.units) * L.CRS.Simple.distance(coords[i], coords[i+1]);
            var airDistance = parseFloat(altDiff) + parseFloat(gndDistance);
            var heading = calc.heading(coords[i], coords[i+1]);
            var midpoint = calc.midpoint(coords[i], coords[i+1]);
            var time = util.formatTime(calc.time(route.speeds[i], airDistance));
            var markerContent = util.formatFlightLegMarker(gndDistance, heading, route.speeds[i], time, state.units);
            var marker =  L.marker(L.latLng(midpoint[0],midpoint[1]), {
                altDiff: altDiff,
                gndDistance: gndDistance,
                heading: heading,
                time: time,
                speed: route.speeds[i],
                icon: icons.textIconFactory(markerContent, 'flight-leg nobg ' + getMapTextClasses(state))
            });
            marker.parentId = id;
            marker.index = i;
            marker.on('click', markerClickHandlerFactory(marker));
            marker.addTo(drawnMarkers);

            turnMarker.followingMarkerId = marker._leaflet_id; // On first loop, this affects the turnMarker above.
                                                               // In later loops, it affects the  ones below.

            turnCoords = L.latLng(coords[i + 1].lat, coords[i + 1].lng);
            turnMarkerContent = util.formatFlightTurnMarker(route.altitudes[i+1], state.units);
            turnMarker = L.marker(turnCoords, {
                altitude: route.altitudes[i],
                draggable: false,
                icon: icons.textIconFactory(turnMarkerContent, ' flight-turn ' + getMapTextClasses(state))
            });
            turnMarker.parentId = id;
            turnMarker.priorMarkerId = marker._leaflet_id;
            if (i === coords.length-2) 
            {
                turnMarker.followingMarkerId = 0;
            }
            turnMarker.index = i + 1;
            turnMarker.on('click', turnClickHandlerFactory(turnMarker));
            turnMarker.addTo(drawnMarkers);
        }

        for (var i = 0; i < coords.length-1; i++) {
            var routeMarker = L.circleMarker(coords[i], {
                interactive: true,
                radius: 1,
                color: route.color,
                fillColor: route.color,
                opacity: FLIGHT_OPACITY,
                fillOpacity: FLIGHT_OPACITY
            });
            routeMarker.parentId = id;
            routeMarker.index = i;
            routeMarker.addTo(drawnMarkers);
        }

        var endMarker = L.circleMarker(coords[coords.length-1], {
            interactive: false,
            radius: 3,
            color: route.color,
            fillColor: route.color,
            opacity: FLIGHT_OPACITY,
            fillOpacity: FLIGHT_OPACITY
        });
        endMarker.parentId = id;
        endMarker.addTo(drawnMarkers);

        /*
        var nameCoords = L.latLng(coords[0].lat, coords[0].lng);
        //var nameMarkerContent = util.formatFlightStartMarker(route.name, route.altitudes[0], state.units);
        var nameMarker = L.marker(nameCoords, {
            draggable: false,
            icon: icons.textIconFactory(route.name, 'map-title flight-titles ' + getMapTextClasses(state))
        });
        nameMarker.parentId = id;
        nameMarker.on('click', routeClickHandlerFactory(route));
        nameMarker.addTo(drawnMarkers);
        */
        publishMapState();
    }

    function applyFlightPlan(route) {
        if (state.changing || state.connected) {
            return;
        }
        var newFlight = false;
        if (typeof route.altitude === 'undefined') {
            route.altitude = content.default.flightAltitude;
            newFlight = true;
        }
        if (typeof route.speed === 'undefined') {
            route.speed = content.default.flightSpeed;
            newFlight = true;
        }
        if (typeof route.name === 'undefined') {
            route.name = content.default.flightName;
        }
        if (typeof route.color === 'undefined') {
            route.color = content.default.flightColor;
        }
        var initialSpeed = route.speed;
        var averageAltitude = 0;
        if (!newFlight) {
            for (var i = 0; i < route.altitudes.length; i++){
                averageAltitude = averageAltitude + route.altitudes[i];
            }
            averageAltitude = averageAltitude / route.altitudes.length;
        }
        else {
            averageAltitude = route.altitude;
        }
        var clickedOk = false;
        map.openModal({
            altitude: averageAltitude,
            speed: route.speed,
            name: route.name,
            color: route.color,
            isFlightPlan: route.isFlightPlan,
            template: content.flightModalTemplate,
            zIndex: 10000,
            onShow: function(e) {
                var element = document.getElementById('flight-name');
                element.focus();
                element.select();
                L.DomEvent.on(e.modal._container.querySelector('.modal-ok'), 'click', function() {
                    clickedOk = true;
                    e.modal.hide();
                });
                L.DomEvent.on(e.modal._container.querySelector('.modal-cancel'), 'click', function() {
                    e.modal.hide();
                });
            },
            onHide: function(e) {
                if (clickedOk) {
                    var flightPlanCheckbox = document.getElementById('flight-plan-checkbox');
                    route.isFlightPlan = flightPlanCheckbox.checked;
                    route.name = document.getElementById('flight-name').value;
                    route.speed = parseInt(document.getElementById('flight-speed').value);
                    route.speedDirty = (route.speed !== initialSpeed);
                    route.color = document.getElementById('flight-color').value;
                    route.altitude = document.getElementById('flight-altitude').value;
                    route.altitudeDirty = (parseInt(route.altitude) !== parseInt(averageAltitude));
                    
                    switch (route.color)
                    {
                        case 'blue':
                            route.color = BLUE;
                            break;
                        case 'black':
                            route.color = BLACK;
                            break;
                        case 'red':
                        default:
                            route.color = RED;
                            break;
                    }
                    route.setStyle({color:route.color});
                    if (route.isFlightPlan)
                    {
                        applyFlightPlanCallback(route, newFlight);
                    }
                    else
                    {
                        //route.options.clickable = false; // Too late to apply, and also can break deletion
                    }
                } else if (newFlight) {
                    drawnItems.removeLayer(route);
                } else if (route.isFlightPlan) {
                    applyFlightPlanCallback(route, newFlight);
                }
                checkButtonsDisabled();
            }
        });
    }

    function applyTargetInfoCallback(target, newTarget) {
        function targetClickHandlerFactory(clickedTarget) {
            return function() {
                if (state.changing || state.connected) {
                    return;
                }
                deleteAssociatedLayers(L.layerGroup([clickedTarget]));
                applyTargetInfo(clickedTarget);
            };
        }
        var id = target._leaflet_id;
        var coords = target.getLatLng();
        target.setIcon(icons.factory(target.type, target.color));
        if (newTarget) {
            target.on('contextmenu', targetClickHandlerFactory(target));
        }
        var nameCoords = L.latLng(coords.lat, coords.lng);
        if (state.style === 'classic')
        {
            var nameMarker = L.marker(nameCoords, {
                draggable: false,
                icon: icons.textIconFactory(target.name, 'map-title target-title-classic ' + getMapTextClasses(state))
            });
        }
        else
        {
            var markerColor = BLACK;
            if (target.color === 'red'){
                markerColor = RED;
            }
            else if (target.color === 'blue'){
                markerColor = BLUE;
            }
            if ((target.type === 'taw-af') || (target.type === 're-af') || (target.type.substring(target.type.length - 5) === 'spawn'))
            {
                var nameMarker = L.marker(nameCoords, {
                    draggable: false,
                    icon: icons.textIconFactory('<font color=' + markerColor + '>' + target.name + '</font>', 'target-title-airfield')
                });
            }
            else if (target.type === 'point')
            {
                var nameMarker = L.marker(nameCoords, {
                    draggable: false,
                    icon: icons.textIconFactory(target.name, 'target-title-classic-centered map-text flight-leg')
                });
            }
            else
            {
                var nameMarker = L.marker(nameCoords, {
                    draggable: false,
                    icon: icons.textIconFactory('<font color=' + markerColor + '>' + target.name + '</font>', 'target-title-cb nobg')
                });
            }
        }

        if (util.validUrl(target.photo)) {
            util.bindPicture(target.photo, target);
        }
        
        nameMarker.parentId = id;
        nameMarker.on('click', targetClickHandlerFactory(target));
        nameMarker.addTo(drawnMarkers);
        if (target.notes !== '') {
            target.bindTooltip(target.notes, {
                direction: 'left'
            }).addTo(drawnMarkers);
        }
        publishMapState();
    }

    function applyTargetInfo(target) {
        if (state.changing || state.connected) {
            return;
        }
        var newTarget = false;
        if (typeof target.name === 'undefined') {
            target.name = content.default.pointName;
            var newTarget = true;
        }
        if (typeof target.notes === 'undefined') {
            target.notes = '';
        }
        if (typeof target.type === 'undefined') {
            target.type = content.default.pointType;
        }
        if (typeof target.color === 'undefined') {
            target.color = content.default.pointColor;
        }
        if (typeof target.photo === 'undefined') {
            target.photo = '';
        }
        var validPhoto = false;

        var clickedOk = false;
        map.openModal({
            name: target.name,
            notes: target.notes,
            photo: '',
            template: content.pointModalTemplate,
            zIndex: 10000,
            onShow: function(e) {
                var element = document.getElementById('target-name');
                element.focus();
                element.select();
                var typeSelect = document.getElementById('point-type-select');
                typeSelect.value = target.type;
                var colorSelect = document.getElementById('point-color-select');
                colorSelect.value = target.color;
                var photoSelect = document.getElementById('target-photo');
                photoSelect.value = target.photo;
                L.DomEvent.on(e.modal._container.querySelector('.modal-test-photo'), 'click', function() {
                    
                    if (util.validUrl(photoSelect.value)){
                        var xhr = util.buildGetBlobXhr(photoSelect.value, function() {
                            if (xhr.status === 200){
                                if (xhr.response !== "") {
                                    target.photo = photoSelect.value;
                                    validPhoto = true;
                                    util.removeClass(document.getElementById('photo-status-hidden'), 'hidden-section');
                                }
                                else {
                                    photoSelect.value = "failed, try again";
                                    validPhoto = false;
                                    util.addClass(document.getElementById('photo-status-hidden'), 'hidden-section');
                                }
                            }
                            else {
                                photoSelect.value = "failed, try again";
                                validPhoto = false;
                                util.addClass(document.getElementById('photo-status-hidden'), 'hidden-section');
                            }
                        });
                    } else {
                        photoSelect.value = "failed, try again";
                        validPhoto = false;
                        util.addClass(document.getElementById('photo-status-hidden'), 'hidden-section');
                    }
                });
                L.DomEvent.on(e.modal._container.querySelector('.modal-ok'), 'click', function() {
                    clickedOk = true;
                    e.modal.hide();
                });
                L.DomEvent.on(e.modal._container.querySelector('.modal-cancel'), 'click', function() {
                    e.modal.hide();
                });
            },
            onHide: function(e) {
                if (clickedOk) {
                    target.name = document.getElementById('target-name').value;
                    target.notes = document.getElementById('target-notes').value;
                    target.type = document.getElementById('point-type-select').value;
                    target.color = document.getElementById('point-color-select').value;
                    if (validPhoto) {
                        target.photo = document.getElementById('target-photo').value;
                    }
                    applyTargetInfoCallback(target, newTarget);
                } else if (newTarget) {
                    drawnItems.removeLayer(target);
                } else {
                    applyTargetInfoCallback(target, newTarget);
                }
                checkButtonsDisabled();
            }
        });
    }

    function deleteAssociatedLayers(parentLayers) {
        var toDelete = [];
        parentLayers.eachLayer(function(layer) {
            toDelete.push(layer._leaflet_id);
        });

        map.eachLayer(function(layer) {
            if (toDelete.indexOf(layer.parentId) !== -1) {
                map.removeLayer(layer);
            }
        });
        hiddenLayers.eachLayer(function(layer) {
            if (toDelete.indexOf(layer.parentId) !== -1) {
                hiddenLayers.removeLayer(layer);
            }
        });
        drawnMarkers.eachLayer(function(layer) {
            if (toDelete.indexOf(layer.parentId) !== -1) {
                drawnMarkers.removeLayer(layer);
            }
        });
    }

    function transferChildLayers(from, to) {
        from.eachLayer(function(layer) {
            if (typeof layer.parentId !== 'undefined') {
                from.removeLayer(layer);
                to.addLayer(layer);
            }
        });
    }

    function showChildLayers() {
        transferChildLayers(hiddenLayers, map);
    }

    function hideChildLayers() {
        transferChildLayers(map, hiddenLayers);
    }

    function changeUnits(units) {
        state.units = units;
        window.localStorage.setItem('units', units);
        var parentChanged = false;
        map.eachLayer(function (layer) {
            if (layer.options && typeof(layer.options.speed)!=='undefined') {
                if (!parentChanged) {
                    var parentRoute = drawnItems.getLayer(layer.parentId);
                    parentRoute.speeds = parentRoute.speeds.map((speed) => calc.convertSpeed(speed, units));
                    parentRoute.altitudes = parentRoute.altitudes.map((altitude) => calc.convertAltitude(altitude, units));
                    parentChanged = true;
                }
                layer.options.altDiff = calc.convertDistance(layer.options.altDiff, units);
                layer.options.speed = calc.convertSpeed(layer.options.speed, units);
                layer.options.gndDistance = parseFloat(calc.convertDistance(layer.options.gndDistance, units)).toFixed(1);
                applyCustomFlightLegCallback(layer);
            }
        });
        map.eachLayer(function (layer) {
            if (layer.options && typeof(layer.options.altitude)!=='undefined') {
                if (!parentChanged) {
                    var parentRoute = drawnItems.getLayer(layer.parentId);
                    parentRoute.speeds = parentRoute.speeds.map((speed) => calc.convertSpeed(speed, units));
                    parentRoute.altitudes = parentRoute.altitudes.map((altitude) => calc.convertAltitude(altitude, units));
                    parentChanged = true;
                }
                layer.options.altitude = calc.convertAltitude(layer.options.altitude, units);
                applyCustomFlightTurnCallback(layer);
            }
        });
    }

    function changeStyle(style) {
        state.style = style;
        window.localStorage.setItem('style', style);
        window.location.reload();
    }

    function disableButtons(buttonList) {
        for (var i = 0; i < buttonList.length; i++) {
            var element = document.getElementById(buttonList[i]);
            element.classList.add('leaflet-disabled');
        }
    }

    function enableButtons(buttonList) {
        for (var i = 0; i < buttonList.length; i++) {
            var element = document.getElementById(buttonList[i]);
            element.classList.remove('leaflet-disabled');
        }
    }

    function checkButtonsDisabled() {
        var buttons = ['export-button', 'missionhop-button'];
        if (!state.connected) {
            buttons.push('clear-button');
        }
        if (mapIsEmpty()) {
            disableButtons(buttons);
        } else {
            enableButtons(buttons);
        }
        buttons = ['stream-button'];
        if (conf.streaming !== true) {
            disableButtons(buttons);
        }
        buttons = ['summary-button', 'export-excel-button'];
        if (!util.flightPlanPresent(drawnItems)) {
            disableButtons(buttons);
        } else {
            enableButtons(buttons);
        }
    }

    function clearMap() {
        drawnItems.clearLayers();
        drawnMarkers.clearLayers();
        frontline.clearLayers();
        hideChildLayers();
        hiddenLayers.clearLayers();
        publishMapState();
    }

    function exportMapToCSV() {
        var csvData = [];

        var FlightName = 'Flight Name';
        var FlightLeg = 'Flight Leg';
        var FlightGrid = 'Grid';
        var FlightKeypad = 'Keypad';
        var FlightHeading = 'Heading';
        var FlightLegDistance = (state.units === 'imperial') ? 'Distance (mi)' : 'Distance (km)';
        var FlightLegSpeed = (state.units === 'imperial') ? 'Speed (mph)' : 'Speed (kph)';
        var FlightLegAltitude = (state.units === 'imperial') ? 'Altitude (ft)' : 'Altitude (m)';
        csvData.push({FlightName, FlightLeg, FlightGrid, FlightKeypad, FlightHeading, FlightLegDistance, FlightLegSpeed, FlightLegAltitude});

        drawnItems.eachLayer(function(layer) {
            if ((layer instanceof L.Polyline) && !(layer instanceof L.Polygon)) {
                if (layer.isFlightPlan) {
                    var coords = layer.getLatLngs();
                    for (var i = 0; i < (coords.length - 1); i++)
                    {
                        var FlightLocation = calc.latLngGrid(coords[i], mapConfig);

                        var FlightName = layer.name;
                        var FlightLeg = (i + 1);
                        var FlightGrid = FlightLocation[0];
                        var FlightKeypad = FlightLocation[1];
                        var FlightHeading = Math.round(calc.heading(coords[i], coords[i+1]));
                        var FlightLegDistance = parseFloat(calc.convertMetricScale(mapConfig.scale, state.units) * L.CRS.Simple.distance(coords[i], coords[i+1])).toFixed(1);
                        var FlightLegSpeed = Math.round(layer.speeds[i]);
                        var FlightLegAltitude = Math.round(layer.altitudes[i]);
                        csvData.push({FlightName, FlightLeg, FlightGrid, FlightKeypad, FlightHeading, FlightLegDistance, FlightLegSpeed, FlightLegAltitude});
                    }
                    var FlightLocation = calc.latLngGrid(coords[coords.length - 1], mapConfig);

                    var FlightName = layer.name;
                    var FlightLeg = 'end';
                    var FlightGrid = FlightLocation[0];
                    var FlightKeypad = FlightLocation[1];
                    var FlightHeading = '';
                    var FlightLegDistance = '';
                    var FlightLegSpeed = '';
                    var FlightLegAltitude = Math.round(layer.altitudes[coords.length - 1]);
                    csvData.push({FlightName, FlightLeg, FlightGrid, FlightKeypad, FlightHeading, FlightLegDistance, FlightLegSpeed, FlightLegAltitude});
                }
            }
        });
        return csvData;
    }

    function exportMapState() {
        var saveData = {
            revision: EXPORT_REV,  // Up the rev on every breaking change to import
            mapHash: window.location.hash,
            units: state.units,
            routes: [],
            points: [],
            circles: [],
            polygons: []
        };
        drawnItems.eachLayer(function(layer) {
            var saveLayer = {};
            // Order matters here because polgyon inherits from polyline and circle inherits from circleMarker
            if (layer instanceof L.Polygon) {
                saveLayer.latLngs = layer.getLatLngs();
                saveLayer.color = layer.options.color;
                saveLayer.fillOpacity = layer.options.fillOpacity;
                saveData.polygons.push(saveLayer);
            } else if (layer instanceof L.Polyline) {
                saveLayer.latLngs = layer.getLatLngs();
                saveLayer.name = layer.name;
                saveLayer.speed = layer.speed;
                saveLayer.speeds = layer.speeds;
                saveLayer.altitude = layer.altitude;
                saveLayer.altitudes = layer.altitudes;
                saveLayer.color = layer.color;
                saveLayer.isFlightPlan = layer.isFlightPlan;
                saveData.routes.push(saveLayer);
            } else if (layer instanceof L.Circle) {
                saveLayer.latLng = layer.getLatLng();
                saveLayer.radius = layer.getRadius();
                saveLayer.color = layer.options.color;
                saveLayer.fillOpacity = layer.options.fillOpacity;
                saveData.circles.push(saveLayer);
            } else if (layer instanceof L.Marker) {
                saveLayer.latLng = layer.getLatLng();
                saveLayer.name = layer.name;
                saveLayer.type = layer.type;
                saveLayer.color = layer.color;
                saveLayer.notes = layer.notes;
                saveLayer.photo = layer.photo;
                saveData.points.push(saveLayer);
            }
        });
        return saveData;
    }

    function selectMap(selectedMapConfig) {
        var newIndex = selectedMapConfig.selectIndex;
        if (newIndex !== selectedMapIndex) {
            selectedMapIndex = selectedMapConfig.selectIndex;
            window.location.hash = selectedMapConfig.hash;
            deleteAssociatedLayers(drawnItems);
            drawnItems.clearLayers();
            drawnMarkers.clearLayers();
            hiddenLayers.clearLayers();
            frontline.clearLayers();
            map.removeLayer(mapTiles);
            mapTiles = L.tileLayer(selectedMapConfig.tileUrl, {
                minZoom: selectedMapConfig.minZoom,
                maxZoom: selectedMapConfig.maxZoom,
                bounds: calc.tileBounds(selectedMapConfig)
            }).addTo(map);
            map.setMaxBounds(calc.maxBounds(selectedMapConfig));
            map.setView(calc.center(selectedMapConfig), selectedMapConfig.defaultZoom);
        }
    }

    function fitViewToMission() {
        map.flyToBounds(drawnItems.getBounds());
    }

    function getMapTextClasses(state) {
        var classes = 'map-text';
        if ((state.colorsInverted) && (state.style === 'classic')) {
            classes += ' inverted';
        }
        if (!state.showBackground && (state.style === 'classic')) {
            classes += ' nobg';
        }
        return classes;
    }

    function importMapState(saveData, keepExisting) {
        var keep = keepExisting && (saveData.mapHash === window.location.hash);
        if (!keep)
        {
            clearMap();
        }
        var revision = saveData.revision;
        var importedMapConfig = util.getSelectedMapConfig(saveData.mapHash, content.maps);
        selectMap(importedMapConfig);
        mapConfig = importedMapConfig;
        selectedMapIndex = mapConfig.selectIndex;
        if (keep)
        {
            if (state.units !== saveData.units)
            {
                changeUnits(saveData.units);
            }
        }        
        state.units = saveData.units || 'imperial';
        var newObject = true;
        if (saveData.routes) {
            for (var i = 0; i < saveData.routes.length; i++) {
                var route = saveData.routes[i];
                if ((route.color !== BLUE) && (route.color !== BLACK) && (route.color !== RED))
                {
                    route.color = RED;
                }
                var options = {color: route.color, weight: 2, opacity: FLIGHT_OPACITY};
                var newRoute = L.polyline(util.fixOldLatLngs(route.latLngs, mapConfig, revision), options);
                newRoute.name = route.name;
                newRoute.speed = route.speed;
                newRoute.speeds = route.speeds;
                newRoute.altitude = route.altitude;
                newRoute.altitudes = route.altitudes;
                newRoute.color = route.color;
                newRoute.isFlightPlan = route.isFlightPlan;
                drawnItems.addLayer(newRoute);
                if (newRoute.isFlightPlan)
                {
                    applyFlightPlanCallback(newRoute, newObject);
                }
            }
        }
        if (saveData.points) {
            for (var i = 0; i < saveData.points.length; i++) {
                var point = saveData.points[i];
                var newPoint = L.marker(util.fixOldLatLng(point.latLng, mapConfig, revision), {
                    icon: icons.factory(point.type, point.color)
                });
                newPoint.name = point.name;
                newPoint.type = point.type;
                newPoint.color = point.color;
                newPoint.notes = point.notes;
                newPoint.photo = point.photo;
                drawnItems.addLayer(newPoint);
                applyTargetInfoCallback(newPoint, newObject);
            }
        }
        if (saveData.circles) {
            for (var i = 0; i < saveData.circles.length; i++) {
                var circle = saveData.circles[i];
                var newCircle = L.circle(util.fixOldLatLng(circle.latLng, mapConfig, revision), circle.radius);
                newCircle.options.color = circle.color;
                newCircle.options.fillOpacity = circle.fillOpacity;
                newCircle.options.opacity = FLIGHT_OPACITY;
                newCircle.options.weight = 2;

                drawnItems.addLayer(newCircle);
            }
        }
        if (saveData.polygons) {
            for (var i = 0; i < saveData.polygons.length; i++) {
                var polygon = saveData.polygons[i];
                var options = {color: polygon.color, weight: 2, opacity: FLIGHT_OPACITY, fillOpacity: polygon.fillOpacity};
                var newPolygon = L.polygon(util.fixOldLatLngs(polygon.latLngs, mapConfig, revision), options);
                newPolygon.options.isPolygon = true;
                newPolygon.options.color = polygon.color;
                newPolygon.options.fillOpacity = polygon.fillOpacity;
                drawnItems.addLayer(newPolygon);
            }
        }
        if (saveData.frontline) {
            for (var frontNdx = 0; frontNdx < saveData.frontline.length; frontNdx++) { // for each frontline
                var blueFront = util.fixOldLatLngs(saveData.frontline[frontNdx][0], mapConfig, revision);
                var redFront = util.fixOldLatLngs(saveData.frontline[frontNdx][1], mapConfig, revision);
                L.polyline(blueFront, {color: BLUE_FRONT, opacity: 1}).addTo(frontline);
                L.polyline(redFront, {color: RED_FRONT, opacity: 1}).addTo(frontline);
            }

        }
    }

    function publishMapState() {
        if (state.streaming) {
            var saveData = exportMapState();
            webdis.publish(state.streamInfo.name, state.streamInfo.password,
                    state.streamInfo.code, window.escape(JSON.stringify(saveData)));
        }
    }

    function startConnectedMode() {
        map.removeControl(drawControl);
        map.removeControl(clearButton);
    }

    function endConnectedMode() {
        map.removeControl(gridToolbar);
        map.removeControl(importExportToolbar);
        map.addControl(drawControl);
        map.addControl(gridToolbar);
        map.addControl(clearButton);
        map.addControl(importExportToolbar);
        checkButtonsDisabled();
    }

    function setupCheckboxTogglableElement(checkboxId, elementId) {
        var checkbox = document.getElementById(checkboxId);
        var element = document.getElementById(elementId);
        L.DomEvent.on(checkbox, 'click', function() {
            if (checkbox.checked) {
                util.removeClass(element, 'hidden-section');

            } else {
                util.addClass(element, 'hidden-section');
            }
        });
    }

    // if hash is not in map list, try some other methods to get a json
    if (window.location.hash !== "" && !util.isAvailableMapHash(window.location.hash, content.maps)) {
        var responseBody = null;
        var url;

        if (conf.apiUrl === 'NONE')
        {
            // Example of using a proxy to dodge CORS and HTTPS requirements
            var cors_api_host = 'cors-anywhere.herokuapp.com';
            var cors_api_url = 'https://' + cors_api_host + '/';

            if ((window.location.hash.substring(0, 10) === '#json-url=') && (window.location.hash.length > 10)) {
                url = /*cors_api_url +*/ window.location.hash.slice(10);
            }
            else
            {
                switch(window.location.hash){
                    case "#combatbox":
                        url = ""; // Must be https if we're serving from https
                        break;
                    case "#virtualpilots":
                        url = ""; // TBD, must be https if we're serving from https
                        break;
                    default:
                        // Check repository of mission jsons for a matching name
                        url = "";
                        window.location.hash = "";
                }
            }
        }
        else  // try to get json for that server if API server is enabled
        {
            url = conf.apiUrl + '/servers/' + window.location.hash.substr(1);
        }

        if(url !== ""){
            var xhr = util.buildGetXhr(url, function() {
                if (xhr.readyState === 4){
                    if (xhr.response !== "") {
                        responseBody = JSON.parse(xhr.responseText);
                        importMapState(responseBody, false);
                        fitViewToMission();
                        checkButtonsDisabled();
                    }
                    else {
                        window.location.hash = "";
                    }
                }
                else {
                    window.location.hash = "";
                }
            });
        }
    }

    mapConfig = util.getSelectedMapConfig(window.location.hash , content.maps);
    selectedMapIndex = mapConfig.selectIndex;
/* // Debugging
    L.CursorHandler = L.Handler.extend({

        addHooks: function () {
            this._popup = new L.Popup();
            this._map.on('mouseover', this._open, this);
            this._map.on('mousemove', this._update, this);
            this._map.on('mouseout', this._close, this);
        },
    
        removeHooks: function () {
            this._map.off('mouseover', this._open, this);
            this._map.off('mousemove', this._update, this);
            this._map.off('mouseout', this._close, this);
        },
        
        _open: function (e) {
            this._update(e);
            this._popup.openOn(this._map);
        },
    
        _close: function () {
            this._map.closePopup(this._popup);
        },
    
        _update: function (e) {
            this._popup.setLatLng(e.latlng)
                .setContent(e.latlng.toString());
        }
    
        
    });
    
    L.Map.addInitHook('addHandler', 'cursor', L.CursorHandler);
*/
    map = L.map('map', {
        crs: L.CRS.Simple,
        //cursor: true, // Debugging
        attributionControl: false,
        zoomDelta: 0.25,
        zoomSnap: 0
    });

    mapTiles = L.tileLayer(mapConfig.tileUrl, {
        minZoom: mapConfig.minZoom,
        maxZoom: mapConfig.maxZoom,
        bounds: calc.tileBounds(mapConfig)
    }).addTo(map);

    map.setView(calc.center(mapConfig), mapConfig.defaultZoom);
    map.setMaxBounds(calc.maxBounds(mapConfig));

    drawnItems = L.featureGroup();
    map.addLayer(drawnItems);
    drawnMarkers = L.featureGroup();
    map.addLayer(drawnMarkers);
    frontline = L.featureGroup();
    map.addLayer(frontline);
    hiddenLayers = L.featureGroup();

    L.Control.Stopwatch = L.Control.extend({
        onAdd: function(map) {
            var stopwatch = L.DomUtil.create('iframe');
    
            stopwatch.src = 'https://serverror.github.io/stopwatch/';
            stopwatch.style.height = '145px';
            stopwatch.style.width = '270px';
            stopwatch.style.border = '0px';

            //L.DomEvent.on();
    
            return stopwatch;
        },
    
        onRemove: function(map) {
            //L.DomEvent.off();
        }
    });
    
    L.control.stopwatch = function(opts) {
        return new L.Control.Stopwatch(opts);
    };
    
/* // Debugging
    var boundsTestLatLngs = [
        [mapConfig.latMin, mapConfig.lngMin],
        [mapConfig.latMin, mapConfig.lngMax],
        [mapConfig.latMax, mapConfig.lngMax],
        [mapConfig.latMax, mapConfig.lngMin]
    ];

    var boundsTestOptions = {color: RED, weight: 2, opacity: FLIGHT_OPACITY, fillOpacity: 0.2};
    var boundsTestPolygon = L.polygon(boundsTestLatLngs, boundsTestOptions);

    drawnItems.addLayer(boundsTestPolygon);
*/
    drawControl = new L.Control.Draw({
        draw: {
            polygon: {
                showLength: false,
                shapeOptions: LINE_OPTIONS
            },
            rectangle: false,
            circle: {
                showRadius: false,
                shapeOptions: CIRCLE_OPTIONS
            },
            polyline: {
                showLength: false,
                shapeOptions: LINE_OPTIONS
            },
            marker: {
                icon: icons.factory(content.default.pointType, content.default.pointColor)
            },
            circlemarker: false
        },
        edit: {
            featureGroup: drawnItems,
            edit: { // L.Browser.touch is now always true, so it can't be used to detect touchscreens and disable the edit bar.
                selectedPathOptions: {
                    maintainColor: true,
                    opacity: 0.4,
                    fill: false
                }
            }
        }
    });

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

    // Extend the draw UI with our own text
    L.drawLocal.draw.toolbar.buttons.polyline = 'Map a flight / Draw a polyline';
    L.drawLocal.draw.handlers.polyline.tooltip.start = 'Click to start a flight plan / polyline';
    L.drawLocal.draw.handlers.polyline.tooltip.cont = 'Click to continue the flight plan / polyline';
    L.drawLocal.draw.handlers.polyline.tooltip.end = 'Click last point to finish flight plan / polyline';

    // Fix dragging while drawing polyline/polygon
    L.Draw.Polyline.prototype._onTouch = L.Util.falseFn;
    
    map.addControl(drawControl);

    var titleControl = new L.Control.TitleControl({});
    map.addControl(titleControl);

    var clearButton = new L.Control.CustomToolbar({
        position: 'topleft',
        buttons: [
            {
                id: 'clear-button',
                icon: 'fa-trash',
                tooltip: content.clearTooltip,
                clickFn: function() {
                    if (!mapIsEmpty()) {
                        map.openModal({
                            template: content.confirmClearModalTemplate,
                            onShow: function(e) {
                                var element = document.getElementById('confirm-cancel-button');
                                element.focus();
                                L.DomEvent.on(e.modal._container.querySelector('.modal-ok'), 'click', function() {
                                    clearMap();
                                    e.modal.hide();
                                });
                                L.DomEvent.on(e.modal._container.querySelector('.modal-cancel'), 'click', function() {
                                    e.modal.hide();
                                });
                            },
                            onHide: function() {
                                checkButtonsDisabled();
                            }
                        });
                    }
                }
            }
        ]
    });
    map.addControl(clearButton);

    var helpSettingsToolbar = new L.Control.CustomToolbar({
        position: 'bottomright',
        buttons: [
            {
                id: 'settings-button',
                icon: 'fa-gear',
                tooltip: content.settingsTooltip,
                clickFn: function() {
                    map.openModal({
                        template: content.settingsModalTemplate,
                        onShow: function(e) {
                            var mapSelect = document.getElementById('map-select');
                            mapSelect.selectedIndex = selectedMapIndex;
                            var originalIndex = selectedMapIndex;

                            var styleSelect = document.getElementById('style-select');
                            var originalStyleValue = state.style;
                            styleSelect.value = originalStyleValue;

                            var invertCheckbox = document.getElementById('invert-text-checkbox');
                            invertCheckbox.checked = state.colorsInverted;

                            var unitsSelect = document.getElementById('units-select');
                            var originalUnitValue = state.units;
                            unitsSelect.value = originalUnitValue;

                            var backgroundCheckbox = document.getElementById('text-background-checkbox');
                            backgroundCheckbox.checked = state.showBackground;
                            mapSelect.focus();

                            L.DomEvent.on(e.modal._container.querySelector('.modal-ok'), 'click', function() {
                                if (mapSelect.selectedIndex !== originalIndex) {
                                    var selectedMap = mapSelect.options[mapSelect.selectedIndex].value;
                                    mapConfig = content.maps[selectedMap];
                                    selectMap(mapConfig);
                                    selectedMapIndex = mapSelect.selectedIndex;
                                    publishMapState();
                                }
                                if (styleSelect.value !== originalStyleValue) {
                                    changeStyle(styleSelect.value);
                                }
                                if (unitsSelect.value !== originalUnitValue) {
                                    changeUnits(unitsSelect.value);
                                }
                                if (state.style === 'classic')
                                {
                                    if (invertCheckbox.checked !== state.colorsInverted) {
                                        state.colorsInverted = invertCheckbox.checked;
                                        var textElements = document.getElementsByClassName('map-text');
                                        for (var i = 0; i < textElements.length; i++) {
                                            if (state.colorsInverted) {
                                                textElements[i].classList.add('inverted');
                                            } else {
                                                textElements[i].classList.remove('inverted');
                                            }
                                        }
                                    }
                                    if (backgroundCheckbox.checked !== state.showBackground) {
                                        state.showBackground = backgroundCheckbox.checked;
                                        var textElements = document.getElementsByClassName('map-text');
                                        for (var i = 0; i < textElements.length; i++) {
                                            if (state.showBackground) {
                                                textElements[i].classList.remove('nobg');
                                            } else {
                                                textElements[i].classList.add('nobg');
                                            }
                                        }
                                    }
                                }
                                e.modal.hide();
                            });
                            L.DomEvent.on(e.modal._container.querySelector('.modal-cancel'), 'click', function() {
                                e.modal.hide();
                            });
                        }
                    });
                }
            },
            {
                id: 'help-button',
                icon: 'fa-question',
                tooltip: content.helpTooltip,
                clickFn: function() {
                    map.openModal({
                        template: content.helpModalTemplate,
                        onShow: function(e) {
                            L.DomEvent.on(e.modal._container.querySelector('.modal-ok'), 'click', function() {
                                e.modal.hide();
                            });
                        }
                    });
                }
            }
        ]
    });
    map.addControl(helpSettingsToolbar);

    var importExportToolbar = new L.Control.CustomToolbar({
        position: 'bottomright',
        buttons: [
            {
                id: 'import-button',
                icon: 'fa-upload',
                tooltip: content.importTooltip,
                clickFn: function() {
                    map.openModal({
                        template: content.importModalTemplate,
                        onShow: function(e) {
                            var importInput = document.getElementById('import-file');
                            var importButton = document.getElementById('import-button');
                            var mergeCheckbox = document.getElementById('merge-checkbox');
                            importInput.focus();
                            var fileContent;
                            L.DomEvent.on(importInput, 'change', function(evt) {
                                var reader = new window.FileReader();
                                reader.onload = function(evt) {
                                    if(evt.target.readyState !== 2) {
                                        return;
                                    }
                                    if(evt.target.error) {
                                        window.alert('Error while reading file');
                                        return;
                                    }
                                    fileContent = evt.target.result;
                                };
                                reader.readAsText(evt.target.files[0]);
                            });
                            L.DomEvent.on(e.modal._container.querySelector('.modal-ok'), 'click', function() {
                                if (fileContent !== undefined)
                                {
                                    var saveData = JSON.parse(fileContent);
                                    importMapState(saveData, mergeCheckbox.checked);
                                    e.modal.hide();
                                    fitViewToMission();
                                }
                            });
                            L.DomEvent.on(e.modal._container.querySelector('.modal-cancel'), 'click', function() {
                                e.modal.hide();
                            });
                        },
                        onHide: function() {
                            checkButtonsDisabled();
                        }
                    });
                }
            },
            {
                id: 'export-button',
                icon: 'fa-download',
                tooltip: content.exportTooltip,
                clickFn: function() {
                    if (!mapIsEmpty()) {
                        util.download('plan_IL2MPR_r' + EXPORT_REV + '.json', JSON.stringify(exportMapState()));
                    }
                }
            },
            {
                id: 'summary-button',
                icon: 'fa-list',
                tooltip: content.summaryTooltip,
                clickFn: function() {
                    if (util.flightPlanPresent(drawnItems)) {
                        map.openModal({
                            template: content.flightSummaryModalTemplate,
                            onShow: function(e) {
                                var text = document.getElementById('flight-summary');
                                text.innerHTML = '';
                                var summaryText = '';
                                drawnItems.eachLayer(function(layer) {
                                    if ((layer instanceof L.Polyline) && !(layer instanceof L.Polygon)) {
                                        if (layer.isFlightPlan)
                                        {
                                            summaryText += util.formatFlightSummary(layer, mapConfig, state.units);
                                        }
                                    }
                                });
                                text.innerHTML = summaryText;
                                e.modal.update();
                                L.DomEvent.on(e.modal._container.querySelector('.modal-ok'), 'click', function() {
                                    e.modal.hide();
                                });
                                L.DomEvent.on(e.modal._container.querySelector('.modal-print'), 'click', function() {
                                    var summaryPrint = window.open('', '', 'height=700, width=700');
                                    summaryPrint.document.write('<html>');
                                    summaryPrint.document.write('<body >');
                                    summaryPrint.document.write(summaryText);
                                    summaryPrint.document.write('</body></html>');
                                    summaryPrint.document.close();
                                    summaryPrint.print();
                                });
                            }
                        });
                    }
                }
            },
            {
                id: 'export-excel-button',
                icon: 'fa-file-excel-o',
                tooltip: content.exportCSVTooltip,
                clickFn: function() {
                    if (util.flightPlanPresent(drawnItems)) {
                        util.download('csv_IL2MPR_r' + EXPORT_REV + '.csv', util.csvConvert(exportMapToCSV()));
                    }
                }
            },
            {
                id: 'stopwatch-button',
                icon: 'fa-clock-o',
                tooltip: content.stopwatchTooltip,
                clickFn: function() {
                    if (!stopwatchVisible){
                        stopwatchControl = L.control.stopwatch({ position: 'bottomleft' }).addTo(map);
                        stopwatchVisible = true;
                    }
                    else {
                        stopwatchControl.remove();
                        stopwatchVisible = false;
                    }
                }
            },
            {
                id: 'stream-button',
                icon: 'fa-share-alt',
                tooltip: content.streamTooltip,
                clickFn: function() {
                    var template;
                    if (!state.streaming && !state.connected) {
                        template = content.streamModalTemplate;
                        fireStreamModal();
                    } else if (state.streaming && !state.connected) {
                        template = content.alreadyStreamingModalTemplate;
                        fireAlreadyStreamingModal();
                    } else if (!state.streaming && state.connected) {
                        template = content.alreadyConnectedModalTemplate;
                        fireAlreadyConnectedModal();
                    }
                    function fireStreamModal() {
                        if (conf.streaming === true) {
                            map.openModal({
                                template: template,
                                onShow: function(e) {
                                    document.getElementById('stream-start-button').focus();
                                    L.DomEvent.on(document.getElementById('stream-start-button'), 'click', function() {
                                        e.modal.hide();
                                        fireStartModal();
                                    });
                                    L.DomEvent.on(document.getElementById('stream-connect-button'), 'click', function() {
                                        e.modal.hide();
                                        fireConnectModal();
                                    });
                                    L.DomEvent.on(e.modal._container.querySelector('.modal-cancel'), 'click', function() {
                                        e.modal.hide();
                                    });
                                }
                            });
                        }
                    }
                    function fireStartModal() {
                        map.openModal({
                            template: content.startStreamModalTemplate,
                            onShow: function(e) {
                                document.getElementById('stream-start-confirm-button').focus();
                                L.DomEvent.on(document.getElementById('stream-start-confirm-button'), 'click', function() {
                                    var streamName = document.getElementById('stream-name').value;
                                    var streamPassword = document.getElementById('stream-password').value;
                                    var streamCode = document.getElementById('stream-leader-code').value;
                                    if (!streamName || !streamPassword || !streamCode) {
                                        var errorElement = document.getElementById('start-stream-error');
                                        errorElement.innerHTML = 'All fields are required. Try again.';
                                        util.removeClass(errorElement, 'hidden-section');
                                        return;
                                    }
                                    var mapState = window.escape(JSON.stringify(exportMapState()));
                                    var response = webdis.startStream(streamName, streamPassword, streamCode, mapState);
                                    if (response[0] !== 'SUCCESS')  {
                                        var errorElement = document.getElementById('start-stream-error');
                                        errorElement.innerHTML = response[1];
                                        util.removeClass(errorElement, 'hidden-section');
                                        return;
                                    }
                                    state.streaming = true;
                                    util.addClass(document.querySelector('a.fa-share-alt'), 'streaming');
                                    state.streamInfo = {
                                        name: streamName,
                                        password: streamPassword,
                                        code: streamCode
                                    };
                                    e.modal.hide();
                                });
                                L.DomEvent.on(e.modal._container.querySelector('.modal-cancel'), 'click', function() {
                                    e.modal.hide();
                                });
                            }
                        });
                    }
                    function fireConnectModal() {
                        map.openModal({
                            template: content.connectStreamModalTemplate,
                            onShow: function(e) {
                                var streamSelect = document.getElementById('stream-select');
                                var streams = webdis.getStreamList();
                                streamSelect.options.length = 0;
                                for (var i=0; i < streams.length; i++) {
                                    streamSelect.options[i] = new Option(streams[i].substring(7), streams[i].substring(7));
                                }
                                setupCheckboxTogglableElement('leader-checkbox', 'leader-hidden');
                                document.getElementById('stream-connect-button').focus();
                                L.DomEvent.on(document.getElementById('stream-connect-button'), 'click', function() {
                                    var selectedStream = streamSelect.options[streamSelect.selectedIndex].value;
                                    var password = document.getElementById('stream-password').value;
                                    var code, response;
                                    var checkbox = document.getElementById('leader-checkbox');
                                    if (checkbox.checked) {
                                        if (V.fails('connect-form')) {
                                            var errorElement = document.getElementById('connect-stream-error');
                                            errorElement.innerHTML = 'Password and code are required to connect.';
                                            util.removeClass(errorElement, 'hidden-section');
                                            return;
                                        }
                                        code = document.getElementById('stream-code').value;
                                        response = webdis.getStreamReconnect(selectedStream, password, code);
                                        if (response[0] !== 'SUCCESS') {
                                            var errorElement = document.getElementById('connect-stream-error');
                                            errorElement.innerHTML = response[1];
                                            util.removeClass(errorElement, 'hidden-section');
                                            return;
                                        }
                                        state.streamInfo.code = code;
                                        clearMap();
                                        importMapState(JSON.parse(response[2]), false);
                                        state.streaming = true;
                                        util.addClass(document.querySelector('a.fa-share-alt'), 'streaming');
                                    } else {
                                        if (V.fails('connect-form')) {
                                            var errorElement = document.getElementById('connect-stream-error');
                                            errorElement.innerHTML = 'Password is required to connect.';
                                            util.removeClass(errorElement, 'hidden-section');
                                            return;
                                        }
                                        response = webdis.getStreamInfo(selectedStream, password);
                                        if (response[0] !== 'SUCCESS') {
                                            var errorElement = document.getElementById('connect-stream-error');
                                            errorElement.innerHTML = response[1];
                                            util.removeClass(errorElement, 'hidden-section');
                                            return;
                                        }
                                        webdis.subscribe(response[1]);
                                        clearMap();
                                        importMapState(JSON.parse(response[2]), false);
                                        state.connected = response[1];
                                        util.addClass(document.querySelector('a.fa-share-alt'), 'connected');
                                        startConnectedMode();
                                    }
                                    state.streamInfo = {
                                        name: selectedStream,
                                        password: password,
                                        code: code
                                    };
                                    checkButtonsDisabled();
                                    e.modal.hide();
                                });
                                L.DomEvent.on(e.modal._container.querySelector('.modal-cancel'), 'click', function() {
                                    e.modal.hide();
                                });
                            }
                        });
                    }
                    function fireAlreadyConnectedModal() {
                        map.openModal({
                            streamName: state.streamInfo.name,
                            template: content.alreadyConnectedModalTemplate,
                            onShow: function(e) {
                                document.getElementById('disconnect-button').focus();
                                L.DomEvent.on(document.getElementById('disconnect-button'), 'click', function() {
                                    webdis.unsubscribe(state.connected);
                                    state.connected = false;
                                    util.removeClass(document.querySelector('a.fa-share-alt'), 'connected');
                                    endConnectedMode();
                                    e.modal.hide();
                                });
                                L.DomEvent.on(e.modal._container.querySelector('.modal-cancel'), 'click', function() {
                                    e.modal.hide();
                                });
                            }
                        });
                    }
                    function fireAlreadyStreamingModal() {
                        map.openModal({
                            streamName: state.streamInfo.name,
                            streamPassword: state.streamInfo.password,
                            streamCode: state.streamInfo.code,
                            template: content.alreadyStreamingModalTemplate,
                            onShow: function(e) {
                                document.getElementById('stop-streaming-button').focus();
                                setupCheckboxTogglableElement('already-streaming-checkbox', 'already-streaming-hidden');
                                L.DomEvent.on(document.getElementById('stop-streaming-button'), 'click', function() {
                                    e.modal.hide();
                                    state.streaming = false;
                                    util.removeClass(document.querySelector('a.fa-share-alt'), 'streaming');
                                });
                                L.DomEvent.on(e.modal._container.querySelector('.modal-cancel'), 'click', function() {
                                    e.modal.hide();
                                });
                            }
                        });
                    }
                }
            }
        ]
    });
    map.addControl(importExportToolbar);

    var gridToolbar = new L.Control.CustomToolbar({
        position: 'topleft',
        buttons: [
            {
                id: 'gridhop-button',
                icon: 'fa-th-large',
                tooltip: content.gridHopTooltip,
                clickFn: function() {
                    map.openModal({
                        template: content.gridJumpModalTemplate,
                        onShow: function(e) {
                            var gridElement = document.getElementById('grid-input');
                            gridElement.focus();
                            L.DomEvent.on(e.modal._container.querySelector('.modal-ok'), 'click', function() {
                                if (V.passes('grid-jump-form')) {
                                    var grid = gridElement.value;
                                    var viewLatLng = calc.gridLatLng(grid, mapConfig);
                                    map.flyTo(viewLatLng, mapConfig.gridHopZoom);
                                    e.modal.hide();
                                } else {
                                    var errorElement = document.getElementById('grid-jump-error');
                                    errorElement.innerHTML = 'Please input a valid four digit grid number.';
                                    util.removeClass(errorElement, 'hidden-section');
                                    errorElement.focus();
                                }
                            });
                            L.DomEvent.on(e.modal._container.querySelector('.modal-cancel'), 'click', function() {
                                e.modal.hide();
                            });
                        }
                    });
                }
            },
            {
                id: 'missionhop-button',
                icon: 'fa-crop',
                tooltip: content.missionHopTooltip,
                clickFn: function() {
                    if (!mapIsEmpty()) {
                        fitViewToMission();
                    }
                }
            }
        ]
    });
    map.addControl(gridToolbar);

    map.on('draw:created', function(e) {
        drawnItems.addLayer(e.layer);
        if (e.layerType === 'polyline') {
            applyFlightPlan(e.layer);
        } else if (e.layerType === 'marker') {
            applyTargetInfo(e.layer);
        } else if (e.layerType === 'circle') {
            applyCircle(e.layer);
        } else if (e.layerType === 'polygon') {
            applyPolygon(e.layer);
        }
        checkButtonsDisabled();
    });

    map.on('draw:deleted', function(e) {
        deleteAssociatedLayers(e.layers);
        publishMapState();
        checkButtonsDisabled();
    });

    map.on('draw:edited', function(e) {
        deleteAssociatedLayers(e.layers);
        e.layers.eachLayer(function(layer) {
            if (layer instanceof L.Polygon) {
                
            } else if (layer instanceof L.Polyline) {
                if (layer.isFlightPlan)
                {
                    layer.wasEdited = (layer.getLatLngs().length-1 !== layer.speeds.length);
                    applyFlightPlanCallback(layer);
                }
            } else if (layer instanceof L.Circle) {
                
            } else if (layer instanceof L.Marker) {
                applyTargetInfoCallback(layer);
            }
        });
        publishMapState();
    });

    map.on('draw:editstart', function() {
        state.changing = true;
        hideChildLayers(); 
    });

    map.on('draw:editstop', function() {
        state.changing = false;
        
        drawnItems.eachLayer(function(layer) {
            if (layer instanceof L.Marker) {
                 // Fix for stuck edit box
                if (L.DomUtil.hasClass(layer._icon, 'leaflet-edit-marker-selected')) {
                    L.DomUtil.removeClass(layer._icon, 'leaflet-edit-marker-selected');
                    // Offset as the border will make the icon move.
                    util.offsetMarker(layer._icon, -4);
                }
            }
        });

        showChildLayers();
        checkButtonsDisabled();
    });

    map.on('draw:deletestart', function() {
        state.changing = true;
        hideChildLayers();
    });

    map.on('draw:deletestop', function() {
        state.changing = false;
        showChildLayers();
        checkButtonsDisabled();
    });

    window.addEventListener('il2:streamerror', function (e) {
        if (!state.connected) {
            return;
        }
        util.addClass(document.querySelector('a.fa-share-alt'), 'stream-error');
    });

    window.addEventListener('il2:streamupdate', function (e) {
        if (!state.connected) {
            return;
        }
        var saveData = e.detail;
        if (saveData !== 1) {
            clearMap();
            importMapState(JSON.parse(saveData), false);
        }
        util.removeClass(document.querySelector('a.fa-share-alt'), 'stream-error');
        checkButtonsDisabled();
    });

    checkButtonsDisabled();

})();
