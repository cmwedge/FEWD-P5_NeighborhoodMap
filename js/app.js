"use strict";

function Stadium(name, team, location) {
    var s = this;
    this.name = name;
    this.team = team;
    this.location = location;
    
    var defaultWindowContent = "<div class='myInfoBox'>Loading content...<div>";

    this.infoWindow = new google.maps.InfoWindow({
        content: defaultWindowContent
    });

    this.marker = new google.maps.Marker({
        title: this.name + "(" + this.team + ")",
        position: this.location,
        draggable: false
    });

    // wikipedia download success handler
    this.wikiLoadSuccess = function (data) {
        // extract first paragraph of wikipedia data
        var pageId = "";
        var usefulData = "";
        for (var prop in data["query"]["pages"]) {
            pageId = data["query"]["pages"][prop]["pageid"];
            usefulData = data["query"]["pages"][prop]["extract"];
            break;
        }
        var startIdx = usefulData.indexOf("<p>");
        var endIdx = usefulData.indexOf("</p>");
        usefulData = usefulData.substring(startIdx, endIdx - startIdx);
        usefulData += "<br><br><a href='http://en.wikipedia.org/wiki?curid=" + pageId + "' target='_blank'>Go to Full Wikipedia Article</a>";
        usefulData = "<div class='myInfoBox'>" + usefulData + "</div>";
        this.infoWindow.setContent(usefulData);
    };

    // wikipedia download error handler
    this.wikiLoadFail = function () {
        this.infoWindow.setContent("Unable to load Wikipedia data :(");
    };

    // loads wikipedia article data into info window
    this.loadWikiData = function () {
        // avoid downloading again
        if (this.infoWindow.content !== defaultWindowContent)
            return;

        // get data from wikipedia
        var url = "http://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro=true&titles=" + this.name + "&callback=?";
        $.ajax({
            dataType: "jsonp",
            url: url,
            success: this.wikiLoadSuccess,
            error: this.wikiLoadFail,
            context: this,
            crossDomain: true,
            timeout: 5000
        });
    };

    // opens info window
    this.openWindow = function () {
        s.loadWikiData();
        window.map.panTo(s.marker.getPosition());

        if (window.activeWindow)
            window.activeWindow.close();

        s.infoWindow.open(window.map, s.marker);
        window.activeWindow = s.infoWindow;
    };
}

function StadiumMapViewModel() {
    var self = this;
    self.currentFilter = ko.observable();
    self.currentFilter.subscribe(function (data) { self.refreshMap(); });

    stadiumsDataSource.sort(function (a, b) {
        if (a.name < b.name)
            return -1;
        if (a.name > b.name)
            return 1;
        return 0;
    });

    self.Stadiums = ko.observableArray([]);
    stadiumsDataSource.forEach(function (elem, idx, arr) {
        self.Stadiums.push(new Stadium(elem.name, elem.team, elem.location));
    });

    // forces a refresh of map bounds. useful for things like resizing
    self.forceRefreshMapBounds = function () {
        if (!window.map)
            return;

        var filter = self.currentFilter() || "";
        filter = filter.toLowerCase();

        var hasPoint = false;
        var bounds = new google.maps.LatLngBounds();
        var stadiums = self.Stadiums();
        var numStadiums = stadiums.length;

        for (var i = 0; i < numStadiums; i++) {
            var curStadium = stadiums[i];
            var curMarker = curStadium.marker;

            // check against filter
            if (filter === "" || curStadium.name.toLowerCase().indexOf(filter) >= 0) {
                bounds.extend(curMarker.getPosition());
                hasPoint = true;
            }
        }

        if (hasPoint) {
            window.map.setCenter(bounds.getCenter());
            window.map.fitBounds(bounds);
        }
        else
            //default to US
            window.map.panTo({ lat: 37.6, lng: -95.665 });
    };

    // manages the map state
    self.refreshMap = function () {
        // first time this is called, do some extra work
        if (!window.map) {
            self.initializeMap();
            self.addMarkerClickListeners();
        }

        var filter = self.currentFilter() || "";
        filter = filter.toLowerCase();

        var hasPoint = false;
        var changedPoint = false;
        var bounds = new google.maps.LatLngBounds();
        var stadiums = self.Stadiums();
        var numStadiums = stadiums.length;

        for (var i = 0; i < numStadiums; i++) {
            var curStadium = stadiums[i];
            var curMarker = curStadium.marker;

            // apply filter
            if (filter === "" || curStadium.name.toLowerCase().indexOf(filter) >= 0) {
                if (!curMarker.getMap()) {
                    curMarker.setMap(window.map);
                    changedPoint = true;
                }

                bounds.extend(curMarker.getPosition());
                hasPoint = true;
            }
            else {
                if (curMarker.getMap()) {
                    curStadium.infoWindow.close();
                    curMarker.setMap(null);
                    changedPoint = true;
                }
            }
        }

        // only update bounds if we have a point and at least one changed
        if (hasPoint && changedPoint) {
            window.map.setCenter(bounds.getCenter());
            window.map.fitBounds(bounds);
        }
    };

    // adds click event listeners to markers
    self.addMarkerClickListeners = function () {
        var stadiums = self.Stadiums();
        var numStadiums = stadiums.length;

        for (var i = 0; i < numStadiums; i++) {
            var curStadium = stadiums[i];
            google.maps.event.addListener(curStadium.marker, 'click', curStadium.openWindow);
        }
    };

    // initializes the map
    self.initializeMap = function () {
        var mapOptions = {
            zoom: 5
        };

        var map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
        window.map = map;
    };
}

var vm = new StadiumMapViewModel();

$(window).resize(function () {
    var headerHeight = 52;
    var windowHeight = $(window).height();
    $('#map-canvas').css('height', windowHeight - headerHeight);
    vm.forceRefreshMapBounds();
});

// get it all started
google.maps.event.addDomListener(window, 'load', function () {
    $(window).resize();
    vm.refreshMap();
    ko.applyBindings(vm);
});

