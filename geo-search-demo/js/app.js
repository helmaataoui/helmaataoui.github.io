$(document).ready(function() {



  // INITIALIZATION
  // ==============
  var APPLICATION_ID = '5TEV4GO8XX';
  var SEARCH_ONLY_API_KEY = '31ac168eb62342f4fa7e5c5bcacc12d4';
  var INDEX_NAME = 'test';
  var PARAMS = { hitsPerPage: 60 };

  // Client + Helper initialization
  var algolia = algoliasearch(APPLICATION_ID, SEARCH_ONLY_API_KEY);
  var algoliaHelper = algoliasearchHelper(algolia, INDEX_NAME, PARAMS);
  algoliaHelper.setQueryParameter('getRankingInfo', true);

  // DOM and Templates binding
  $map = $('#map');
  $hits = $('#hits');
  $stats = $('#stats');
  $searchInput = $('#search-input');
  var hitsTemplate = Hogan.compile($('#hits-template').text());
  var noResultsTemplate = Hogan.compile($('#no-results-template').text());

  // Map initialization
  var map = new google.maps.Map($map.get(0), { center: {lat: 45.5065, lng: -73.6531}, streetViewControl: true, mapTypeControl: false, zoom: 9, minZoom: 3, maxZoom: 20, styles: [{ stylers: [{ hue: "#3596D2" }] } ] });
  var fitMapToMarkersAutomatically = true;
  var markers = [];
  var boundingBox;
  var boundingBoxListeners = [];

  // Page states
  var PAGE_STATES = {
    LOAD                   : 0,
    BOUNDING_BOX_RECTANGLE : 1,
    BOUNDING_BOX_POLYGON   : 2,
    AROUND_IP              : 4,
    AROUND_NYC             : 5,
    AROUND_LONDON          : 6,
    AROUND_SYDNEY          : 7
  };
  var pageState = PAGE_STATES.LOAD;
  setPageState(PAGE_STATES.BOUNDING_BOX_RECTANGLE);



  // PAGE STATES
  // ===========
  function setPageState (state) {
    resetPageState();
    beginPageState(state);
  }

  function beginPageState (state) {
    pageState = state;

    switch (state) {
      case PAGE_STATES.BOUNDING_BOX_RECTANGLE:
      boundingBox = new google.maps.Rectangle({
        bounds: { north: 45.707034, south: 45.385182, east: -73.478151, west: -73.983622 },
        strokeColor: '#EF5362',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#EF5362',
        fillOpacity: 0.15,
        draggable: true,
        editable: true,
        geodesic: true,
        map: map
      });
      algoliaHelper.setQueryParameter('insideBoundingBox', rectangleToAlgoliaParams(boundingBox));
      boundingBoxListeners.push(google.maps.event.addListener(boundingBox, 'bounds_changed', throttle( rectangleBoundsChanged, 150 )));
      break;

      case PAGE_STATES.BOUNDING_BOX_POLYGON:
      boundingBox = new google.maps.Polygon({
        paths: [
        {lat: 45.5381286489,lng: -73.6143636703},
        {lat: 45.5309439967,lng: -73.5986566544},
        {lat: 45.5285990161,lng: -73.6017036438},
        {lat: 45.5279075288,lng: -73.603720665},
        {lat: 45.527877464,lng: -73.6067247391},
        {lat: 45.527095772,lng: -73.608956337},
        {lat: 45.5258330159,lng: -73.610200882},
        {lat: 45.5282683059,lng: -73.615694046},
        {lat: 45.5296211991,lng: -73.6189985275},
        {lat: 45.5300721563,lng: -73.6222171783},
        {lat: 45.5344913455,lng: -73.6182689667},
        ],
        strokeColor: '#EF5362',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#EF5362',
        fillOpacity: 0.15,
        draggable: true,
        editable: true,
        geodesic: true,
        map: map
      });
      algoliaHelper.setQueryParameter('insidePolygon', polygonsToAlgoliaParams(boundingBox));
      boundingBoxListeners.push(google.maps.event.addListener(boundingBox.getPath(), 'set_at', throttle( polygonBoundsChanged, 150 )));
      boundingBoxListeners.push(google.maps.event.addListener(boundingBox.getPath(), 'insert_at', throttle( polygonBoundsChanged, 150 )));
      break;

      case PAGE_STATES.AROUND_IP:
      algoliaHelper.setQueryParameter('aroundLatLngViaIP', true);
      break;

      case PAGE_STATES.AROUND_NYC:
      algoliaHelper.setQueryParameter('aroundLatLng', '45.4841, -73.5627');
      break;

      case PAGE_STATES.AROUND_LONDON:
      algoliaHelper.setQueryParameter('aroundLatLng', '45.4692, -73.5385');
      break;

      case PAGE_STATES.AROUND_SYDNEY:
      algoliaHelper.setQueryParameter('aroundLatLng', '45.5239, -73.5828');
      break;
    }

    fitMapToMarkersAutomatically = true;
    algoliaHelper.search();
  }

  function resetPageState() {
    if (boundingBox) boundingBox.setMap(null);
    for (var i = 0; i < boundingBoxListeners.length; ++i) {
      google.maps.event.removeListener(boundingBoxListeners[i]);
    }
    boundingBoxListeners = [];
    $searchInput.val("");
    algoliaHelper.setQuery("");
    algoliaHelper.setQueryParameter('insideBoundingBox', undefined);
    algoliaHelper.setQueryParameter('insidePolygon',     undefined);
    algoliaHelper.setQueryParameter('aroundLatLng',      undefined);
    algoliaHelper.setQueryParameter('aroundLatLngViaIP', undefined);
  }



  // TEXTUAL SEARCH
  // ===============
  $searchInput.on('input propertychange', function(e) {
    var query = e.currentTarget.value;
    if (pageState === PAGE_STATES.BOUNDING_BOX_RECTANGLE || pageState === PAGE_STATES.BOUNDING_BOX_POLYGON) fitMapToMarkersAutomatically = true;
    algoliaHelper.setQuery(query).search();
  });



  // DISPLAY RESULTS
  // ===============
  algoliaHelper.on('result', function(content, state) {
    renderMap(content);
    renderHits(content);
  });

  algoliaHelper.on('error', function(error) {
    console.log(error);
  });

  function renderHits(content) {
    if (content.hits.length === 0) {
      $hits.html(noResultsTemplate.render());
      return;
    }
    content.hits = content.hits.slice(0,20);
    for (var i = 0; i < content.hits.length; ++i) {
      var hit = content.hits[i];
      hit.displayCity = (hit.listed_name === hit.city);
      if (hit._rankingInfo.matchedGeoLocation) hit.distance = parseInt(hit._rankingInfo.distance/1000) + " m";
    }
    $hits.html(hitsTemplate.render(content));
  }

  function renderMap (content) {
    removeMarkersFromMap();
    markers = [];

    for (var i = 0; i<content.hits.length; ++i) {
      var hit = content.hits[i];
      var marker = new google.maps.Marker({
        position: {lat: hit._geoloc.lat, lng: hit._geoloc.lng},
        map: map,
        airport_id: hit.objectID,
        title: hit.listed_name + ' - ' + hit.address + ' - ' + hit.PostalCode
      });
      markers.push(marker);
      attachInfoWindow(marker, hit);
    }

    if (fitMapToMarkersAutomatically) fitMapToMarkers();
  }



  // EVENTS BINDING
  // ==============
  $('.change_page_state').on('click', function(e) {
    e.preventDefault();
    updateMenu($(this).data("state"), $(this).data("mode"));
    switch ($(this).data("state")) {
      case "rectangle":
      setPageState(PAGE_STATES.BOUNDING_BOX_RECTANGLE);
      break;
      case "polygon":
      setPageState(PAGE_STATES.BOUNDING_BOX_POLYGON);
      break;
      case "ip":
      setPageState(PAGE_STATES.AROUND_IP);
      break;
      case "nyc":
      setPageState(PAGE_STATES.AROUND_NYC);
      break;
      case "london":
      setPageState(PAGE_STATES.AROUND_LONDON);
      break;
      case "sydney":
      setPageState(PAGE_STATES.AROUND_SYDNEY);
      break;
    }
  });



  // HELPER METHODS
  // ==============
  function updateMenu(stateClass, modeClass) {
    $('.change_page_state').removeClass("active");
    $(".change_page_state[data-state='"+stateClass+"']").addClass("active");
    $('.page_mode').removeClass("active");
    $(".page_mode[data-mode='"+modeClass+"']").addClass("active");
  }

  function fitMapToMarkers() {
    var mapBounds = new google.maps.LatLngBounds();
    for (var i = 0; i < markers.length; i++) {
      mapBounds.extend(markers[i].getPosition());
    }
    map.fitBounds(mapBounds);
  }

  function removeMarkersFromMap() {
    for (var i = 0; i < markers.length; i++) {
      markers[i].setMap(null);
    }
  }

  function rectangleBoundsChanged() {
    fitMapToMarkersAutomatically = false;
    algoliaHelper.setQueryParameter('insideBoundingBox', rectangleToAlgoliaParams(boundingBox)).search();
  }
  function polygonBoundsChanged() {
    fitMapToMarkersAutomatically = false;
    algoliaHelper.setQueryParameter('insidePolygon', polygonsToAlgoliaParams(boundingBox)).search();
  }

  function rectangleToAlgoliaParams(rectangle) {
    var bounds = rectangle.getBounds();
    var ne = bounds.getNorthEast();
    var sw = bounds.getSouthWest();
    return [ne.lat(), ne.lng(), sw.lat(), sw.lng()].join();
  }

  function polygonsToAlgoliaParams(polygons) {
    points = [];
    polygons.getPaths().forEach(function(path){
      path.getArray().forEach(function(latLng){
        points.push(latLng.lat());
        points.push(latLng.lng());
      });
    });
    return points.join();
  }

  function attachInfoWindow(marker, hit) {
    var message = (hit.listed_name === hit.city) ? hit.listed_name+' - '+hit.country : hit.listed_name+' - '+hit.city+' - '+hit.country;
    var infowindow = new google.maps.InfoWindow({ content: message });
    marker.addListener('click', function() {
      info_window = infowindow.open(marker.get('map'), marker);
      setTimeout(function(){infowindow.close()}, 3000);
    });
  }

  function throttle(func, wait) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    var later = function() {
      previous = Date.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = Date.now();
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) {
          context = args = null;
        }
      } else if (!timeout) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  }


});
