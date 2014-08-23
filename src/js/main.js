(function($) {
  
  function MapService() {
    this.map = null;
    this.inputs = new Array();
  }
  
  
  MapService.prototype.initMap = function(container) {
    if (this.map) {
      return;
    }
    
    this.map = new google.maps.Map(container, {
      center: new google.maps.LatLng(52.5167, 13.3833), // Berlin for the win!! :)
      zoom:   11
    });
  };
  
  
  MapService.prototype.addLocationInput = function(inputElement, onChangedCallback) {
    if (!this.map || !inputElement || !onChangedCallback) {
      return;
    }
    
    var input = new google.maps.places.Autocomplete(inputElement, { types: ['geocode'] });
    input.marker = null;
    this.inputs.push(input);
    
    var ref = this;
    
    google.maps.event.addListener(input, 'place_changed', function() {
      ref.onLocationInputChanged(input, onChangedCallback);
    });
  };
  
  
  MapService.prototype.onLocationInputChanged = function(input, callback) {
    if (!input.getPlace() || !input.getPlace().geometry) {
      if (input.marker) {
        this.removeMarker(input.marker);
        input.marker = null;
      }
      return;
    }
    
    var position = input.getPlace().geometry.location;
    
    if (input.marker) {
      input.marker.setPosition(position);
    } else {
      input.marker = this.createMarker(position);
    }
    
    callback();
  };
  
  
  MapService.prototype.createMarker = function(latLng) {
    if (!this.map) {
      return;
    }
    
    return new google.maps.Marker({
      position: latLng,
      map:      this.map
    });
  };
  
  
  MapService.prototype.removeMarker = function(marker) {
    if (!this.map || !marker) {
      return;
    }
    
    marker.setMap(null);
  };
  
  
  MapService.prototype.getMarker = function(index) {
    if (!this.map || index > this.inputs.length - 1) {
      return null;
    }
    
    return this.inputs[index].marker;
  };
  
  
  MapService.prototype.panToMarkers = function() {
    if (!this.map) {
      return null;
    }
    
    var sw = null, ne = null;
    
    for (var i = 0; i < this.inputs.length; ++i) {
      var marker = this.getMarker(i);
      
      if (! marker) {
        continue;
      }
      
      if (sw === null) {
        sw = marker.getPosition();
      } else {
        sw = new google.maps.LatLng(Math.min(sw.lat(), marker.position.lat()),
                                    Math.min(sw.lng(), marker.position.lng()));
      }
      
      if (ne === null) {
        ne = marker.getPosition();
      } else {
        ne = new google.maps.LatLng(Math.max(ne.lat(), marker.position.lat()),
                                    Math.max(ne.lng(), marker.position.lng()));
      }
    }
    
    if (sw === null || ne === null) {
      return;
    }
    
    if (sw.lat() === ne.lat() && sw.lng() === ne.lng()) {
      this.map.panTo(sw);
      this.map.setZoom(11);
    } else {
      this.map.panToBounds(new google.maps.LatLngBounds(sw, ne));
    }
  };
  
  
  function DirectionService() {
    this.service = new google.maps.DirectionsService();
  }
  
  
  DirectionService.prototype.getTravelDuration = function(from, to, callback) {
    var departure = new Date();
    departure.setHours(7);
    
    var ref = this;
    
    this.service.route({
      origin:         from,
      destination:    to,
      travelMode:     google.maps.TravelMode.TRANSIT,
      transitOptions: { departureTime: departure }
    }, function(result, status) {
      if (status === 'OVER_QUERY_LIMIT') {
        setTimeout(function() {
          ref.getTravelDuration(from, to, callback);
        }, 1000);
      } else if (status === 'OK') {
        callback(result.routes[0].legs[0].duration.value);
      }
    });
  };
  
  
  function RectService() {
    this.rects = new Array();
  }
  
  
  RectService.prototype.removeAllRects = function() {
    for (var i = 0; i < this.rects.length; ++i) {
      this.rects[i].setMap(null);
    }
    
    this.rects = new Array();
  };
  
  
  RectService.prototype.addRect = function(position, size, duration1, duration2) {
    var sw = new google.maps.LatLng(position.lat() - deltaKmToDeltaLatitude(size / 2.0), position.lng() - deltaKmToDeltaLongitude(size / 2.0, position.lat()));
    var ne = new google.maps.LatLng(position.lat() + deltaKmToDeltaLatitude(size / 2.0), position.lng() + deltaKmToDeltaLongitude(size / 2.0, position.lat()));
    console.log('sw: ' + sw + ' ne: ' + ne);
    
    var red = Math.round(Math.min(duration1 + duration2, 7200) / 7200 * 255);
    var green = 255 - red;
    var colorString = '#' + (red < 16 ? '0' : '') + red.toString(16).toUpperCase() + (green < 16 ? '0' : '') + green.toString(16).toUpperCase() + '00';
    console.log(colorString);
    
    return new google.maps.Rectangle({
      bounds: new google.maps.LatLngBounds(sw, ne),
      strokeColor: colorString,
      strokeOpacity: 0.5,
      strokeWeight: 1,
      fillColor: colorString,
      fillOpacity: 0.2,
      map: mapService.map
    });
  };
  
  
  var mapService = new MapService();
  var directionService = new DirectionService();
  var rectService = new RectService()
  
  const GRID_SIZE = 20;
  const GRID_SPACING = 1;
  
  
  $(document).ready(function() {
    mapService.initMap(document.getElementById('map'));
    mapService.addLocationInput(document.getElementById('location1'), onLocationChanged);
    mapService.addLocationInput(document.getElementById('location2'), onLocationChanged);
  });
  
  
  function onLocationChanged() {
    mapService.panToMarkers();
    
    var marker1 = mapService.getMarker(0);
    var marker2 = mapService.getMarker(1);
    
    if (marker1 && marker2) {
      calculateDirections(marker1.getPosition(), marker2.getPosition());
    }
  }
  
  
  function calculateDirections(position1, position2) {
    rectService.removeAllRects();
    
    var midPoint = calculateMidPoint(position1, position2);
    
    walk(position1, position2, midPoint, 0, 0);
  }
  
  
  function walk(destination1, destination2, center, loop, cell) {
    var x = null, y = null;
    
    if (loop === 0) {
      x = 0;
      y = 0;
    } else {
      var edgeLength = 2 * loop + 1;
      
      if (cell < edgeLength) { // Left border
        x = -loop;
        y = loop - cell;
      } else if (cell < 2 * edgeLength - 1) { // Bottom border
        x = -loop + cell - (edgeLength - 1);
        y = -loop;
      } else if (cell < 3 * edgeLength -2) { // Right border
        x = loop;
        y = -loop + cell - (2 * edgeLength - 2);
      } else { // Top border
        x = loop - cell + (3 * edgeLength - 3);
        y = loop;
      }
    }
    
    console.log(loop, cell, x, y);
    
    var lat = center.lat() + deltaKmToDeltaLatitude(GRID_SPACING * y);
    var lng = center.lng() + deltaKmToDeltaLongitude(GRID_SPACING * x, lat);
    var position = new google.maps.LatLng(lat, lng);
    
    directionService.getTravelDuration(position, destination1, function(duration1) {
      directionService.getTravelDuration(position, destination2, function(duration2) {
        rectService.addRect(position, GRID_SPACING, duration1, duration2);
        
        if (loop === 0 || cell === 8 * loop - 1) {
          ++loop;
          cell = 0;
        } else {
          ++cell;
        }
        
        if (loop < 10) {
          setTimeout(function() {
            walk(destination1, destination2, center, loop, cell);
          }, 0);
        }
      });
    });
  }
  
  
  function calculateMidPoint(position1, position2) {
    return new google.maps.LatLng((position1.lat() + position2.lat()) / 2.0,
                                  (position1.lng() + position2.lng()) / 2.0);
  }
  
  
  function deltaKmToDeltaLatitude(km) {
    // 1° lat = 110.54km => 1km = 1° / 110.54
    return km / 110.54;
  }
  
  
  function deltaKmToDeltaLongitude(km, lat) {
    // 1° lng = 111.32km * cos(lat) => 1km = 1° / 111.32 / cos(lat)
    return km / 111.32 / Math.cos(lat / 180 * Math.PI);
  }
  
})(jQuery);
