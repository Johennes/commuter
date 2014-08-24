(function($) {
  
  function MapService() {
    this.map = null;
    this.inputs = new Array();
    this.rects = new Array();
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
  
  
  MapService.prototype.getMarkerPosition = function(index) {
    if (!this.map || index < 0 || index > this.inputs.length - 1) {
      return null;
    }
    
    var marker = this.inputs[index].marker;
    return marker ? marker.getPosition() : null;
  };
  
  
  MapService.prototype.panToMarkers = function() {
    if (!this.map) {
      return null;
    }
    
    var sw = null, ne = null;
    
    for (var i = 0; i < this.inputs.length; ++i) {
      var position = this.getMarkerPosition(i);
      
      if (! position) {
        continue;
      }
      
      if (sw === null) {
        sw = position;
      } else {
        sw = new google.maps.LatLng(Math.min(sw.lat(), position.lat()),
                                    Math.min(sw.lng(), position.lng()));
      }
      
      if (ne === null) {
        ne = position;
      } else {
        ne = new google.maps.LatLng(Math.max(ne.lat(), position.lat()),
                                    Math.max(ne.lng(), position.lng()));
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
  
  
  MapService.prototype.addRect = function(rect) {
    rect.setMap(this.map);
    this.rects.push(rect);
  };
  
  
  MapService.prototype.removeAllRects = function() {
    for (var i = 0; i < this.rects.length; ++i) {
      this.rects[i].setMap(null);
    }
    
    this.rects = new Array();
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
  }
  
  
  RectService.prototype.createRect = function(position, size, duration1, duration2) {
    var sw = new google.maps.LatLng(position.lat() - deltaKmToDeltaLatitude(size / 2.0), position.lng() - deltaKmToDeltaLongitude(size / 2.0, position.lat()));
    var ne = new google.maps.LatLng(position.lat() + deltaKmToDeltaLatitude(size / 2.0), position.lng() + deltaKmToDeltaLongitude(size / 2.0, position.lat()));
    
    var red = Math.round(Math.min(duration1 + duration2, 7200) / 7200 * 255);
    var green = 255 - red;
    var colorString = '#' + (red < 16 ? '0' : '') + red.toString(16).toUpperCase() + (green < 16 ? '0' : '') + green.toString(16).toUpperCase() + '00';
    
    return new google.maps.Rectangle({
      bounds: new google.maps.LatLngBounds(sw, ne),
      strokeColor: colorString,
      strokeOpacity: 0.5,
      strokeWeight: 1,
      fillColor: colorString,
      fillOpacity: 0.2
    });
  };
  
  
  function SpiralingGridWalker(callback) {
    this.callback = callback;
    this.loopIndex = 0;
    this.cellIndex = 0;
  }
  
  
  SpiralingGridWalker.prototype.step = function() {
    var x = null, y = null;
    
    if (this.loopIndex === 0) {
      x = 0;
      y = 0;
    } else {
      var edgeLength = 2 * this.loopIndex + 1;
      
      if (this.cellIndex < edgeLength) { // Left border
        x = -this.loopIndex;
        y = this.loopIndex - this.cellIndex;
      } else if (this.cellIndex < 2 * edgeLength - 1) { // Bottom border
        x = -this.loopIndex + this.cellIndex - (edgeLength - 1);
        y = -this.loopIndex;
      } else if (this.cellIndex < 3 * edgeLength -2) { // Right border
        x = this.loopIndex;
        y = -this.loopIndex + this.cellIndex - (2 * edgeLength - 2);
      } else { // Top border
        x = this.loopIndex - this.cellIndex + (3 * edgeLength - 3);
        y = this.loopIndex;
      }
    }
    
    this.callback(x, y);
    
    if (this.loopFinished()) {
      this.loopIndex += 1;
      this.cellIndex = 0;
    } else {
      this.cellIndex += 1;
    }
  };
  
  
  SpiralingGridWalker.prototype.loopFinished = function() {
    return (this.loopIndex === 0 || this.cellIndex === 8 * this.loopIndex - 1);
  };
  
  
  SpiralingGridWalker.prototype.getLoopIndex = function() {
    return this.loopIndex;
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
    mapService.removeAllRects();
    mapService.panToMarkers();
    
    var destination1 = mapService.getMarkerPosition(0);
    var destination2 = mapService.getMarkerPosition(1);
    
    if (destination1 && destination2) {
      calculateDirections(destination1, destination2);
    }
  }
  
  
  function calculateDirections(destination1, destination2) {
    var midPointLat = (destination1.lat() + destination2.lat()) / 2.0;
    var midPointLng = (destination1.lng() + destination2.lng()) / 2.0;
    var midPoint = new google.maps.LatLng(midPointLat, midPointLng);
    
    var walker = new SpiralingGridWalker(function(x, y) {
      var lat = midPoint.lat() + deltaKmToDeltaLatitude(GRID_SPACING * y);
      var lng = midPoint.lng() + deltaKmToDeltaLongitude(GRID_SPACING * x, lat);
      var origin = new google.maps.LatLng(lat, lng);
      
      $('.progressBar').css('margin-left', '-100%');
      
      directionService.getTravelDuration(origin, destination1, function(duration1) {
        $('.progressBar').css('margin-left', '-50%');
        
        directionService.getTravelDuration(origin, destination2, function(duration2) {
          $('.progressBar').css('margin-left', '0%');
          
          var rect = rectService.createRect(origin, GRID_SPACING, duration1, duration2);
          mapService.addRect(rect);
          
          if (walker.getLoopIndex() < 9) {
            walker.step();
          }
        });
      });
    });
    
    walker.step();
  }
  
  
  function deltaKmToDeltaLatitude(km) {
    // 1° lat ~ 110.54km => 1km ~ 1° / 110.54
    return km / 110.54;
  }
  
  
  function deltaKmToDeltaLongitude(km, lat) {
    // 1° lng ~ 111.32km * cos(lat) => 1km ~ 1° / 111.32 / cos(lat)
    return km / 111.32 / Math.cos(lat / 180 * Math.PI);
  }
  
})(jQuery);
