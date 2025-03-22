const calc = (function() {
    
    const
        SECONDS_IN_HOUR = 3600,
        BORDER = 40,
        MILE_PER_KM = 0.6213712,
        KM_PER_MILE = 1.609344,
        KM_PER_METER = 0.001,
        MILE_PER_FT = 0.00018939,
        FT_PER_METER = 3.2808399,
        METER_PER_FT = 0.3048
    ;

    return {

        geometricDegreesToGeographic: function(degrees) {
            if (degrees < 0) {
                degrees += 360;
            }
            return (450 - degrees) % 360;
        },

        heading: function(a, b) {
            var radians = Math.atan2(b.lat - a.lat, b.lng - a.lng);
            var degrees = radians * 180 / Math.PI;
            degrees = this.geometricDegreesToGeographic(degrees);
            return degrees;
        },

        midpoint: function(a, b) {
            var lat = (a.lat + b.lat) / 2;
            var lng = (a.lng + b.lng) / 2;
            return [lat, lng];
        },

        pad: function(num, size) {
            var s = Math.floor(num).toFixed(0);
            while (s.length < size) {
                s = "0" + s;
            }
            return s;
        },

        time: function(speed, distance) {
            var kmPerSecond = speed / SECONDS_IN_HOUR;
            return distance / kmPerSecond;
        },

        maxBounds: function(mapConfig) {
            return [
                [mapConfig.latMin - BORDER, mapConfig.lngMin - BORDER],
                [mapConfig.latMax + BORDER, mapConfig.lngMax + BORDER]
            ];
        },
        
        tileBounds: function(mapConfig) {
            return [
                [mapConfig.latMin, mapConfig.lngMin],
                [mapConfig.latMax, mapConfig.lngMax]
            ];
        },

        center: function(mapConfig) {
            return [(Math.abs(mapConfig.latMax) - Math.abs(mapConfig.latMin)) / 2, (Math.abs(mapConfig.lngMax) - Math.abs(mapConfig.lngMin)) / 2];
        },

        gridLatLng: function(grid, mapConfig) {
            var width = mapConfig.lngMax - mapConfig.lngMin;
            var height = mapConfig.latMax - mapConfig.latMin;
            var gridWidth = width / mapConfig.lngGridMax;
            var gridHeight = height / mapConfig.latGridMax;
            var gridSideLength = (gridWidth + gridHeight) / 2;
            var gridLat = parseInt(grid.substring(0, 2));
            var gridLng = parseInt(grid.substring(2, 4));
            var lat = mapConfig.latMax - (gridLat*gridSideLength);
            var lng = (gridLng*gridSideLength);
            return [lat, lng];
        },

        latLngGrid: function(latLng, mapConfig) {
            var width = mapConfig.lngMax - mapConfig.lngMin;
            var height = mapConfig.latMax - mapConfig.latMin;
            
            var latGridTemp = -1 * ((latLng.lat / height) * mapConfig.latGridMax); // Invert negative latitude map
            var lngGridTemp = (latLng.lng /  width) * mapConfig.lngGridMax;

            var latGrid = Math.ceil(latGridTemp);
            var lngGrid = Math.ceil(lngGridTemp);

            var grid = this.pad(latGrid, 2) + this.pad(lngGrid, 2);

            var keypadY = Math.ceil((1 - (latGridTemp % 1)) * 3); // Since top left corner is 0,0 , keypadY needs to be flipped
            var keypadX = Math.ceil((lngGridTemp % 1) * 3);

            var keypad = ((keypadY * 3) - 2) + (keypadX - 1);

            return [grid, keypad];
        },

        invertHeading: function(heading) {
            return (360 + (heading - 180)) % 360;
        },

        convertSpeed: function(value, units) {
            var factor = units === 'metric' ? KM_PER_MILE : MILE_PER_KM;
            return Math.round(value * factor);
        },

        convertDistance: function(value, units) {
            var factor = units === 'metric' ? KM_PER_MILE : MILE_PER_KM;
            return (value * factor).toFixed(4);
        },

        convertAltitude: function(value, units) {
            var factor = units === 'metric' ? METER_PER_FT : FT_PER_METER;
            return (value * factor).toFixed(2);
        },

        altitudeUnitAdjust: function(value, units) {
            var factor = units === 'metric' ? KM_PER_METER : MILE_PER_FT;
            return (value * factor).toFixed(4);
        },
        convertMetricScale: function(value, units) {
            if (units === 'metric') {
                return value;
            }
            else {
                var factor = MILE_PER_KM;
                return (value * factor).toFixed(5);
            }
        },
    };
})();

export default calc;
