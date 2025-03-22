const icons = function(leaflet) {
/* // Prep work for future icon selection cleanup
    var iconGroups = {
        "Legacy": {
            "Red": ["Point", "Marker", "Target", "Bombing Target", "Combat", "Ground Combat", "Takeoff", "Landing", "Base", "Aircraft"],
            "Blue": ["Point", "Marker", "Target", "Bombing Target", "Combat", "Ground Combat", "Takeoff", "Landing", "Base", "Aircraft"],
            "Black": ["Point", "Marker", "Target", "Bombing Target", "Combat", "Ground Combat", "Takeoff", "Landing", "Base", "Aircraft"],
        },
        "Stock": {
            "Red": ["Point", "Marker", "Target", "Bombing Target", "Combat", "Ground Combat", "Takeoff", "Landing", "Base", "Aircraft"],
            "Blue": ["Point", "Marker", "Target", "Bombing Target", "Combat", "Ground Combat", "Takeoff", "Landing", "Base", "Aircraft"],
            "Spawns": ["Point", "Marker", "Target", "Bombing Target", "Combat", "Ground Combat", "Takeoff", "Landing", "Base", "Aircraft"],
        },
        "Apollo": {
            "Red": ["Point", "Marker", "Target", "Bombing Target", "Combat", "Ground Combat", "Takeoff", "Landing", "Base", "Aircraft"],
            "Blue": ["Point", "Marker", "Target", "Bombing Target", "Combat", "Ground Combat", "Takeoff", "Landing", "Base", "Aircraft"],
            "Black": ["Point", "Marker", "Target", "Bombing Target", "Combat", "Ground Combat", "Takeoff", "Landing", "Base", "Aircraft"],
        },
        "Random Expert": {
            "Red": ["Airfield", "Artillery", "Headquarters", "Motorcade", "Active Point", "Point", "Tank", "Warehouse", "Fort"],
            "Blue": ["Airfield", "Artillery", "Headquarters", "Motorcade", "Active Point", "Point", "Tank", "Warehouse", "Fort"]
        },
        "TAW": {
            "Red": ["Airfield", "Artillery", "Bridge", "City", "Defences", "Depot", "Supply", "Tank", "Train"],
            "Blue": ["Airfield", "Artillery", "Bridge", "City", "Defences", "Depot", "Supply", "Tank", "Train"]
        }
      }
*/
    const
        URL_PREFIX = 'img/',
        URL_SUFFIX = '.png',
        URL_DELIM = '-'
    ;

    function buildIconUrl(type, color) {
        if (color === '') {
            return URL_PREFIX + type + URL_SUFFIX;
        }
        else {
            return URL_PREFIX + color + URL_DELIM + type + URL_SUFFIX;
        }
    }

    return {
        factory: function(type, color) {
            if (color !== undefined && this._isCoalitionIcon(type)) {
                color = '';
            }
            else if (color === 'black' && (this._isRandomExpertIcon(type) || this._isTawIcon(type) || this._isStockIcon(type)) ) {
                color = 'blue';
            }
            var iconOpts = {
                iconSize: type === 're-point-active' ? [40, 60] : [36, 36],
                iconUrl: buildIconUrl(type, color),
            };
            return leaflet.icon(iconOpts);
        },
        textIconFactory: function(text, classes) {
            return leaflet.divIcon({
                className: classes,
                html: text,
                iconSize: [165, 0]
            });
        },
        // Private methods determine if this icon should default to blue when black is chosen
        _isRandomExpertIcon: function(type) {
            return type.substring(0, 2) === 're';
        },
        _isTawIcon: function(type) {
            return type.substring(0, 3) === 'taw' && type !== 'taw-af';
        },
        _isStockIcon: function(type) {
            return type.substring(0, 5) === 'stock';
        },
        _isSApolloIcon: function(type) {
            return type.substring(0, 6) === 'apollo';
        },
        _isCoalitionIcon: function(type) {
            return type.substring(type.length - 5) === 'spawn';
        }
    };
};

export default icons;
