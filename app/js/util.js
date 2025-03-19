import url from "url";
import calc from "./calc.js";
import pkg from 'file-saver';
const { saveAs } = pkg;

const util = (function() {

    const UNIT_MAP = {
        metric: {
            distance: 'km',
            speed: 'kph',
            altitude: 'm',
        },
        imperial: {
            distance: 'mi',
            speed: 'mph',
            altitude: 'ft',
        }
    };

    return {

        formatTime: function(timeInSeconds) {
            var minutes = timeInSeconds / 60;
            var seconds = timeInSeconds % 60;
            return Math.floor(minutes).toFixed(0) + ':' + calc.pad(seconds, 2);
        },

        isAvailableMapHash: function(hash, maps) {
            for (var map in maps) {
                if (maps[map].hash === hash) {
                    return true;
                }
            }
            return false;
        },

        getSelectedMapConfig: function(hash, maps) {
            for (var map in maps) {
                if (maps[map].hash === hash) {
                    return maps[map];
                }
            }
            return maps.stalingrad;
        },

        defaultPopulateArray: function(val, count) {
            var array = [];
            for (var i = 0; i < count; i++) {
                array.push(parseInt(val));
            }
            return array;
        },

        formatFlightLegMarker: function(distance, heading, speed, time, units) {
            units = units || 'metric';
            distance = typeof distance === 'number' ? distance.toFixed(1) : distance;
            heading = typeof heading === 'number' ? heading.toFixed(0) : heading;
            var textRotation = (heading % 180) - 90;
            return  '<div style="background: rgba(100, 100, 100, .75); transform: rotate(' + textRotation + 'deg);">' + 
                speed + UNIT_MAP[units].speed + ' | ' + 
                calc.pad(heading, 3) + '&deg;/' + 
                calc.pad(calc.invertHeading(heading), 3) +'&deg; <br/> ' + 
                distance + UNIT_MAP[units].distance + ' | ' + 
                'ETE ' + time + '</div>';
        },

        formatFlightStartMarker: function(name, altitude, units) {
            units = units || 'metric';
            return  name + '<br />' +
                altitude + UNIT_MAP[units].altitude;
        },
        
        formatFlightTurnMarker: function(altitude, units) {
            units = units || 'metric';
            return Math.round(altitude) + UNIT_MAP[units].altitude;
        },
        
        formatFlightSummary: function(layer, mapConfig, units) {
            var summaryText = '<h3>' + layer.name + '</h3><ol class="summary">';
            var summedTime = 0;
            var summedDistance = 0;
            var coords = layer.getLatLngs();
            for (var i = 0; i < (coords.length - 1); i++)
            {
                var altDiff = calc.altitudeUnitAdjust(Math.abs(layer.altitudes[i] - layer.altitudes[i+1]), units);
                var FlightLocation = calc.latLngGrid(coords[i], mapConfig);
                var time = calc.time(layer.speeds[i], parseFloat(calc.convertMetricScale(mapConfig.scale, units) * L.CRS.Simple.distance(coords[i], coords[i+1])) + parseFloat(altDiff));
                var distance = calc.convertMetricScale(mapConfig.scale, units) * L.CRS.Simple.distance(coords[i], coords[i+1]);
                summedTime += time;
                summedDistance += distance;

                if (i === 0)
                {
                    summaryText += '<li>Beginning flight at ' + Math.round(layer.altitudes[0]) + UNIT_MAP[units].altitude + ' in grid ';
                }
                else
                {
                    summaryText += '<li>From grid ';
                }
                summaryText += FlightLocation[0] + '.' + FlightLocation[1];
                summaryText += ', fly heading ' + calc.pad(Math.round(calc.heading(coords[i], coords[i+1])), 3);
                summaryText += ' at ' + Math.round(layer.speeds[i]) + ' ' + UNIT_MAP[units].speed;
                summaryText += ' for ' + this.formatTime(time) + ' minutes while';

                if (layer.altitudes[i] === layer.altitudes[i + 1])
                {
                    summaryText += ' maintaining ';
                }
                else if (layer.altitudes[i] < layer.altitudes[i + 1])
                {
                    summaryText += ' climbing to ';
                }
                else
                {
                    summaryText += ' descending to ';
                }
                summaryText += Math.round(layer.altitudes[i + 1]) + UNIT_MAP[units].altitude + '. ';
                summaryText += distance.toFixed(1) + UNIT_MAP[units].distance + ' traveled.';
                if ((i > 0) && (i < coords.length - 2))
                {
                    summaryText += '<br />Distance Flown: ' + summedDistance.toFixed(1) + UNIT_MAP[units].distance + ', Time Elapsed: ' + this.formatTime(summedTime) + ' minutes</li>';
                }
            }
            var FlightLocation = calc.latLngGrid(coords[coords.length - 1], mapConfig);
            summaryText += '<li>End flight in grid ' + FlightLocation[0] + '.' + FlightLocation[1] + ' at ' + Math.round(layer.altitudes[coords.length - 1]) + UNIT_MAP[units].altitude + '.<br />Total Distance: ' + summedDistance.toFixed(1) + UNIT_MAP[units].distance + ', Total Time: ' + this.formatTime(summedTime) + ' minutes</li>';
            summaryText += '</ol>';

            return summaryText;
        },
        
        formatFlightSummaryTable: function(layer, mapConfig, units) {
            var summaryText = '<h3>' + layer.name + '</h3><ol class="summary">';
            summaryText += '<table><tr><th>Flight Leg</th><th>Grid</th><th>Keypad</th><th>Heading</th>';
            summaryText += '<th>Distance (' + UNIT_MAP[units].distance + ')</th><th>Speed (' + UNIT_MAP[units].speed + ')</th><th>Altitude (' + UNIT_MAP[units].altitude + ')</th><th>Time (MM:SS)</th></tr>';
            var summedTime = 0;
            var summedDistance = 0;
            var coords = layer.getLatLngs();
            for (var i = 0; i < (coords.length - 1); i++)
            {
                var altDiff = calc.altitudeUnitAdjust(Math.abs(layer.altitudes[i] - layer.altitudes[i+1]), units);
                var FlightLocation = calc.latLngGrid(coords[i], mapConfig);
                var time = calc.time(layer.speeds[i], parseFloat(calc.convertMetricScale(mapConfig.scale, units) * L.CRS.Simple.distance(coords[i], coords[i+1])) + parseFloat(altDiff));
                var distance = calc.convertMetricScale(mapConfig.scale,units) * L.CRS.Simple.distance(coords[i], coords[i+1]);
                summedTime += time;
                summedDistance += distance;

                summaryText += '<tr>';
                summaryText += '<td>' + (i + 1) + '</td>';
                summaryText += '<td>' + FlightLocation[0] + '</td>';
                summaryText += '<td>' + FlightLocation[1] + '</td>';
                summaryText += '<td>' + calc.pad(Math.round(calc.heading(coords[i], coords[i+1])), 3) + '</td>';
                summaryText += '<td>' + distance.toFixed(1) + '</td>';
                summaryText += '<td>' + Math.round(layer.speeds[i]) + '</td>';
                if (layer.altitudes[i] == layer.altitudes[i+1]) {
                    summaryText += '<td>' + Math.round(layer.altitudes[i]) + '</td>';
                }
                else {
                    summaryText += '<td>' + Math.round(layer.altitudes[i]) + '->' + Math.round(layer.altitudes[i]) + '</td>';
                }

                summaryText += '<td>' + util.formatTime(time) + '</td>';
                summaryText += '</tr>';
            }

            var FlightLocation = calc.latLngGrid(coords[i], mapConfig);
            summaryText += '<tr>';
            summaryText += '<td>END</td>';
            summaryText += '<td>' + FlightLocation[0] + '</td>';
            summaryText += '<td>' + FlightLocation[1] + '</td>';
            summaryText += '<td></td>';
            summaryText += '<td></td>';
            summaryText += '<td></td>';
            summaryText += '<td>' + Math.round(layer.altitudes[i]) + '</td>';
            summaryText += '<td></td>';
            summaryText += '</tr>';

            summaryText += '</table></ol>';

            return summaryText;
        },
        
        bindPicture: function(url, layer) {
            var popupContent = document.createElement("img");
            popupContent.onload = function () {
                if (this.naturalHeight >= 700)
                {
                    popupContent.height = 700;
                }
                else
                {
                    popupContent.width = 700;
                }
                layer.update();
            };
            popupContent.src = url;
            layer.bindPopup(popupContent, {className: 'popup', maxWidth: "710px", closeButton: false});
        },

        validUrl: function(string) {
            var result;
  
            try {
                result = url.parse(string);
            } catch (_) {
              return false;  
            }
          
            return result.protocol === "http:" || result.protocol === "https:";
        },

        buildGetXhr: function(url, updateFn) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.onreadystatechange = updateFn;
            xhr.send(null);
            return xhr;
        },
        
        buildGetBlobXhr: function(url, updateFn) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'blob';
            xhr.onreadystatechange = updateFn;
            xhr.send();
            return xhr;
        },

        buildSyncGetXhr: function(url) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false);
            xhr.send(null);
            return xhr;
        },

        // Class functions taken from here: http://jaketrent.com/post/addremove-classes-raw-javascript/
        hasClass: function(el, className) {
            if (el.classList) {
                return el.classList.contains(className);
            } else {
                return !!el.className.match(new RegExp('(\\s|^)' + className + '(\\s|$)'));
            }
        },

        addClass: function(el, className) {
            if (el.classList) {
                el.classList.add(className);
            } else if (!this.hasClass(el, className)) {
                el.className += " " + className;
            }
        },

        removeClass: function(el, className) {
            if (el.classList) {
                el.classList.remove(className);
            } else if (this.hasClass(el, className)) {
                var reg = new RegExp('(\\s|^)' + className + '(\\s|$)');
                el.className=el.className.replace(reg, ' ');
            }
        },
        // End class functions

        download: function(filename, text) {
            var blob = new Blob([text], {type: "text/plain;charset=utf-8"});
            saveAs(blob, filename);
        },

        csvConvert: function(array) {
            var csv="";
            for (var i = 0; i < array.length; i++)
            {
                var row = array[i];
                // Row is the row of array at index "i"
                var string = "";
                // Empty string which will be added later
                for (var index in row) {
                    // Traversing each element in the row
                    var w = row[index];
                    // Adding the element at index "index" to the string
                    string += w;
                    if (index !== row.length - 1) {
                        string += ",";
                        // If the element is not the last element , then add a comma
                    }
                }
                string += "\n";
                // Adding next line at the end
                csv += string;
                // adding the string to the final string "csv"
            }
            return csv;
        },

        flightPlanPresent: function (layer) {
            var present = false;
            layer.eachLayer(function(e) {
                if ((e instanceof L.Polyline) && !(e instanceof L.Polygon)) {
                    if (e.isFlightPlan) {
                        present = true;
                    }
                }
            });
            return present;
        },

        offsetMarker: function (icon, offset) {
            var iconMarginTop = parseInt(icon.style.marginTop, 10) - offset,
                iconMarginLeft = parseInt(icon.style.marginLeft, 10) - offset;
    
            icon.style.marginTop = iconMarginTop + 'px';
            icon.style.marginLeft = iconMarginLeft + 'px';
        },
        
        // In the newer, modern tile scheme, this does a decent job of adjusting old mission plans
        fixOldLatLng: function(latLng, mapConfig, revision) {
            // Now check revision and update LatLngs if need be
            if ((typeof revision === 'undefined') || (revision < 2))
            {
                latLng.lat = latLng.lat - Math.abs(mapConfig.latMax - mapConfig.latMin);
            }
            return latLng;
        },

        fixOldLatLngs: function(latLngs, mapConfig, revision) {
            // Now check revision and update LatLngs if need be
            if ((typeof revision === 'undefined') || (revision < 2))
            {
                for (var i = 0; i < latLngs.length; i++)
                {
                    latLngs[i][0] = latLngs[i][0] - Math.abs(mapConfig.latMax - mapConfig.latMin);
                }
            }

            return latLngs;
        },

    };
})();

export default util;
