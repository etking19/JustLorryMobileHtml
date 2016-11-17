phonon.options({

    navigator: {
        defaultPage: 'home',
        hashPrefix: '!', // default #!pagename
        useHash: true,
        animatePages: true,
        templateRootDirectory: 'contents/',
        enableBrowserBackButton: true // should be disabled on Cordova
    },
    i18n: {
        directory: 'res/lang/',
        localeFallback: 'en-US',
        localePreferred: 'en-US'
    }
});

phonon.i18n().bind();

var app = phonon.navigator();

var oneSignalIdentifier = null;
var distance = 0;
var lorrySize = 1;
var orderCode = null;
var totalAmount = null;

var lorryType = 1;
var fromBuildingType = 0, toBuildingType = 0;
var laborCount = 0;
var assemblyBedCount = 0;
var assemblyDiningCount = 0;
var assemblyWardrobeCount = 0;
var assemblyTableCount = 0;
var promoCodeValue = null;
var recommendedLaborCount = 0;

var fromPostcode = null, toPostcode = null;		// not in use, for reference only
var fromLocation = null, toLocation = null;
var fromLocationBound = null, toLocationBound = null;
var fromGpsLat = null, fromGpsLng = null;
var toGpsLat = null, toGpsLng = null;

var fromAddUnit = null, fromAddStreet = null, toAddUnit = null, toAddStreet = null;
var contactName = null, contactNumber = null, contactEmail = null;
var deliverDateTime = null;

var promoDialog = null;

// price details controls
var price_fuel, price_maintenace, price_labor, price_partner, price_justlorry;

var colorSelected = "rgb(254, 255, 208)";
var colorDeselect = "rgb(241, 241, 241)"

// handling for language selections
document.querySelector('.lang-en').on('tap', function(evt){
    phonon.updateLocale('en-US');

    if (typeof(Storage) !== "undefined") {
        localStorage.setItem("locale", "en-US");
    }

    phonon.setPreference("en-US");
});

document.querySelector('.lang-zh').on('tap', function(evt){
    phonon.updateLocale('zh');

    if (typeof(Storage) !== "undefined") {
        localStorage.setItem("locale", "zh");
    }

    phonon.setPreference("zh");
});

document.querySelector('.lang-ms').on('tap', function(evt){
    phonon.updateLocale('ms');

    if (typeof(Storage) !== "undefined") {
        localStorage.setItem("locale", "ms");
    }

    phonon.setPreference("ms");
});

$.ajaxSetup({
    headers: 
    { 
        'Authorization': 'basic anVzdFBhcnRuZXJBcHA=',
        'Content-Type' : 'application/json'
    },
    dataType: 'json'
});

app.on({page: 'tracking', content: 'orderstatus.html'}, function(activity){

    var map, resultDiv;
    var latestPos = {lat: 3.1371243, lng: 101.596567};
    var mUniqueId;
    var markers = [];
    var refreshIdentifier = null;

    activity.onCreate(function(){
        
        initMap();

        var orderSubmitBtn = document.querySelector('#tracking_confirm');
        var orderIdInput = document.querySelector('#tracking_id');
        orderSubmitBtn.on('tap', function(){
            mUniqueId = orderIdInput.value;
            if(mUniqueId !== undefined && mUniqueId.length >= 4){
                queryJob(mUniqueId);
            }
        });

        resultDiv = document.querySelector('#tracking_route');
        resultDiv.style.visibility = 'hidden';
    });

    activity.onHidden(function() {

        console.log('close');
        if(refreshIdentifier !== null){
            clearInterval(refreshIdentifier);
            refreshIdentifier = null;
        }
    });

    function initMap() {

        console.log('init map');
        map = new google.maps.Map(document.getElementById('tracking_map'), {
            center: latestPos,
            zoom: 15,
            streetViewControl: false,
            zoomControl: false,
            scaleControl: false,
            disableDefaultUI: true
        });
    }

    function queryJob(uniqueId){

        var blocking = phonon.indicator("", false);

        $.when(queryJobDetails(uniqueId), queryJobStatus(uniqueId))
        .fail(function(){

            phonon.i18n().get(['error_home_payment'], function(values) {
                phonon.notif(values['error_home_payment'], 2000, false, null);
            });
        })
        .done(function() {
            resultDiv.style.visibility = 'visible';
        })
        .always(function(){
            blocking.close();
        });
    }

    function setLocation(longitude, latitude) {

        // clear old marker
        markers.forEach(function(marker) {
            marker.setMap(null);
        });
        
        var updatedLoc = {lat: latitude, lng: longitude};

        // add the position marker
        var marker = new google.maps.Marker({
            position: updatedLoc,
            animation: google.maps.Animation.DROP,
            map: map
        });

        markers.push(marker);

        map.setCenter(updatedLoc);
    }

    function setRefresh(jobId){

        if(refreshIdentifier !== null){
            // stop the previous call
            clearInterval(refreshIdentifier);
        }

        // call one time first
        $.get(apiBaseUrl + 'JobDeliveryDriver?' + 'jobId=' + jobId)
        .success(function(trackingResult){

            var trackingObj = JSON.parse(trackingResult.payload);
            console.log(trackingObj);
            setLocation(trackingObj.gpsLongitude, trackingObj.gpsLatitude);
        });

        // set the auto refresh
        refreshIdentifier = setInterval(function() {

            // update the map according to driver location
            $.get(apiBaseUrl + 'JobDeliveryDriver?' + 'jobId=' + jobId)
            .success(function(trackingResult){

                var trackingObj = JSON.parse(trackingResult.payload);
                console.log(trackingObj);
                setLocation(trackingObj.gpsLongitude, trackingObj.gpsLatitude);
            });

        }, 10000);
    }

    function queryJobDetails(uniqueId) {

        return $.Deferred(function(d1){

            $.get(apiBaseUrl + 'job?' + 'uniqueId=' + uniqueId)
                .success(function(result){
                    
                    if(result === undefined){
                        console.log('failed to request job details');
                        return d1.reject();
                    }

                    if(result.success === false){
                        console.log('request job details return false');
                        return d1.reject();
                    }

                    var orderDetails = JSON.parse(result.payload);
                    console.log(orderDetails);

                    document.getElementById('tracking_orderid').text = mUniqueId;
                    document.getElementById('tracking_pickupTime').text = orderDetails.deliveryDate;

                    // stop the previous thread if any
                    if(refreshIdentifier !== null){
                        // stop the previous call
                        clearInterval(refreshIdentifier);
                        refreshIdentifier = null;
                    }

                    if(orderDetails.jobStatusId === '4' ||
                        orderDetails.jobStatusId === '5'){  //picking up or delivering

                        // refresh the map
                        setRefresh(orderDetails.jobId);

                    } else if (orderDetails.jobStatusId === '6') { // delivered
                        // set the map to destination
                        var destination = orderDetails.addressTo[0];
                        if(destination !== undefined){

                            setLocation(destination.gpsLongitude, destination.gpsLatitude);
                        }

                    } else {
                        // set the map to pick up address
                        var pickup = orderDetails.addressFrom[0];
                        if(pickup !== undefined){

                            setLocation(pickup.gpsLongitude, pickup.gpsLatitude);
                        }
                    }

                    d1.resolve();
                })
                .fail(function(){
                    return d1.reject();
                });
        }).promise();
    }

    function queryJobStatus(uniqueId) {

        return $.Deferred(function(d1){

            $.get(apiBaseUrl + 'JobDeliveryStatus?' + 'uniqueId=' + uniqueId)
                .success(function(result){
                    
                    if(result === undefined){
                        console.log('failed to request job details');
                        return d1.reject();
                    }

                    if(result.success === false){
                        console.log('request job details return false');
                        return d1.reject();
                    }

                    console.log(result);

                    var jobStatus = JSON.parse(result.payload);
                    var tableData = new Array();
                    tableData.push(["Date & Time", "Status"]);

                    jobStatus.orderStatus.forEach(function(jobOrderStatus){

                        tableData.push([jobOrderStatus.last_modified_date, jobStatusArray[jobOrderStatus.job_status_id]]);
                    });

                    //Create a HTML Table element.
                    var table = document.createElement("TABLE");
                    table.border = "0";
                 
                    //Get the count of columns.
                    var columnCount = tableData[0].length;

                    //Add the data rows.
                    for (var i = 1; i < tableData.length; i++) {
                        row = table.insertRow(-1);
                        for (var j = 0; j < columnCount; j++) {
                            var cell = row.insertCell(-1);
                            cell.innerHTML = tableData[i][j];
                        }
                    }

                    var dvTable = document.getElementById("tracking_dvtable");
                    dvTable.innerHTML = "";
                    dvTable.appendChild(table);

                    d1.resolve();

                })
                .fail(function(){
                    return d1.reject();
                });
        }).promise();







        // // generate the table runtime
        // var customers = new Array();
        // customers.push(["Date/Time", "Activity", "Location"]);
        // customers.push([1, "John Hammond"]);
        // customers.push([2, "Mudassar Khan"]);
        // customers.push([3, "Suzanne Mathews"]);
        // customers.push([4, "Robert Schidner"]);
     
        // //Create a HTML Table element.
        // var table = document.createElement("TABLE");
        // table.border = "0";
     
        // //Get the count of columns.
        // var columnCount = customers[0].length;
     
        // //Add the header row.
        // var row = table.insertRow(-1);
        // for (var i = 0; i < columnCount; i++) {
        //     var headerCell = document.createElement("TH");
        //     headerCell.innerHTML = customers[0][i];
        //     row.appendChild(headerCell);
        // }
     
        // //Add the data rows.
        // for (var i = 1; i < customers.length; i++) {
        //     row = table.insertRow(-1);
        //     for (var j = 0; j < columnCount; j++) {
        //         var cell = row.insertCell(-1);
        //         cell.innerHTML = customers[i][j];
        //     }
        // }
     
        // var dvTable = document.getElementById("tracking_dvtable");
        // dvTable.innerHTML = "";
        // dvTable.appendChild(table);
    }

});

app.on({page: 'stepone', content: 'stepone.html'}, function(activity){

    var buttonNext;
    
    var entryTo;
    var entryFrom;
    
    var currentPrice;
    var promoCode;
    
    // events handling
    var onTap = function(evt) {
        
        if(entryTo.validity.valid == false ||
          entryFrom.validity.valid == false) {
            return false;
        }
        
        var target = evt.target;
        var order = target.getAttribute('data-order');
        
        if (order === 'stepone-next'){
            // go to next page
            app.changePage('steptwo');
            return false;
            
        } else if(order === 'stepone-promocode') {

            promoDialog.open();
            ga('send', 'event', 'mobile', 'click', 'promo_code');  
            
        }
    };

	var displayPostcodeError = function() {
		// prompt invalid postcode
		phonon.i18n().get(['error_invalid_postcode', 'button_ok'], function(values) {
			phonon.alert('', values['error_invalid_postcode'], false, values['button_ok']);
		});
		
		entryFrom.value = '';
        entryTo.value = '';
	}
    
    var getPostcodeInfo = function(from, to)
    {
        // validate via api and get the distance
        var blocking = phonon.indicator("", false);

        if(to !== null){
            $.post(apiBaseUrl + 'postcode?' + 'deliverFrom=' + from + "&deliverTo=" + to, 
                null,
                function(data, status){
                    console.log(data);
                    
                    blocking.close();

                    if(data.success) {
                        // keep the data
                        var payload = JSON.parse(data.payload);
                        console.log(payload);
                        
                        fromLocation = payload.postCodeAddFrom;
                        toLocation = payload.postCodeAddTo;
                        distance = payload.distance / 1000;

                        fromLocationBound = payload.fromBound;
                        toLocationBound = payload.toBound;
                        
                        // generate price
                        generatePrice(currentPrice);
                    } else {
                        displayPostcodeError();
                    }
                });
        } else {

            // for disposal
            $.post(apiBaseUrl + 'postcode?' + 'deliverFrom=' + from, 
                null,
                function(data, status){
                    console.log(data);
                    
                    blocking.close();

                    if(data.success) {
                        // keep the data
                        var payload = JSON.parse(data.payload);
                        console.log(payload);
                        
                        fromLocation = payload.postCodeAddFrom;
                        toLocation = payload.postCodeAddTo;
                        distance = payload.distance / 1000;
                        
                        // generate price
                        generatePrice(currentPrice);
                    } else {
                        displayPostcodeError();
                    }
                });
        }
        
    }

    var onEntryChange = function(evt) {
        
        if(fromPostcode == entryFrom.value &&
            toPostcode == entryTo.value) {
            return;
        }
        
        var target = evt.target;

        // validate if the postcode not existed
        var fromPostcodeReady = (entryFrom.value.length === 5);
        if(fromPostcodeReady){
            fromPostcode = entryFrom.value;
        }
        
        var toPostcodeReady = (entryTo.value.length === 5);
        if(toPostcodeReady){
            toPostcode = entryTo.value;
        } 
        
        if(lorryType == 2 && fromPostcodeReady){
            // disposal type
            console.log('lorry disposal');
            getPostcodeInfo(fromPostcode, null);

        } else if(fromPostcodeReady && toPostcodeReady) {
            console.log('lorry standard');
            getPostcodeInfo(fromPostcode, toPostcode);
        }
    };

    activity.onCreate(function(){

        buttonNext = document.querySelector('#next');
        
        entryFrom = document.querySelector('#location_from');
        entryTo = document.querySelector('#location_to');
        
        currentPrice = document.querySelector('#stepone-final-price');
        promoCode = document.querySelector('#stepone-promocode');
            
        price_fuel = document.querySelector('#price-fuel');
        price_maintenace = document.querySelector('#price-maintenace');
        price_labor = document.querySelector('#price-labor');
        price_partner = document.querySelector('#price-partner');
        price_justlorry = document.querySelector('#price-justlorry');

        // register events
        buttonNext.on('tap', onTap);
        
        $('#stepone-standard').on('click', function(){

            if(lorryType === 1) {
                // same type, ignore
                return;
            }
                    
            // show the to address
            $('#location_div_to').show();
            
            // change the styling
            $('#stepone-disposal').removeClass('selected');
            $(this).addClass('selected');

            $('#stepone-disposal-text').removeClass('selected');
            $('#stepone-standard-text').addClass('selected');

            lorryType = 1;
            console.log('change lorry type: ' + lorryType);
            entryTo.required = true;
            generatePrice(currentPrice);

            ga('send', 'event', 'mobile', 'click', 'standard_delivery');
        });

        $('#stepone-disposal').on('click', function(){

            if(lorryType === 2) {
                // same type, ignore
                return;
            }
            
            // hide the to address
            $('#location_div_to').hide();
            
            // change the styling
            $('#stepone-standard').removeClass('selected');
            $(this).addClass('selected');
            
            $('#stepone-standard-text').removeClass('selected');
            $('#stepone-disposal-text').addClass('selected');

            lorryType = 2;
            console.log('change lorry type: ' + lorryType);
            entryTo.required = false;

            generatePrice(currentPrice);

            ga('send', 'event', 'mobile', 'click', 'disposal_delivery');
        });
        
        $('#stepone-one-tonne').on('click', function(){

            if(lorrySize == 1){
                return;
            }

            $('#1tonne_info').show();
            $('#3tonne_info').hide();
            $('#5tonne_info').hide();

            // styling
            $('#stepone-one-tonne').addClass('selected');
            $('#stepone-three-tonne').removeClass('selected');
            $('#stepone-five-tonne').removeClass('selected');

            lorrySize = 1;
            generatePrice(currentPrice);

            ga('send', 'event', 'mobile', 'click', 'one_tonne');
        });

        $('#stepone-three-tonne').on('click', function(){
            if(lorrySize == 3){
                return;
            }

            $('#1tonne_info').hide();
            $('#3tonne_info').show();
            $('#5tonne_info').hide();

            // styling
            $('#stepone-one-tonne').removeClass('selected');
            $('#stepone-three-tonne').addClass('selected');
            $('#stepone-five-tonne').removeClass('selected');

            lorrySize = 3;
            generatePrice(currentPrice);

            ga('send', 'event', 'mobile', 'click', 'three_tonne');
        });

        $('#stepone-five-tonne').on('click', function(){
            if(lorrySize == 5){
                return;
            }

            $('#1tonne_info').hide();
            $('#3tonne_info').hide();
            $('#5tonne_info').show();

            // styling
            $('#stepone-one-tonne').removeClass('selected');
            $('#stepone-three-tonne').removeClass('selected');
            $('#stepone-five-tonne').addClass('selected');

            lorrySize = 5;
            generatePrice(currentPrice);

            ga('send', 'event', 'mobile', 'click', 'five_tonne');
        });
        
        entryFrom.on('change', onEntryChange);
        entryFrom.on('paste', onEntryChange);
        entryFrom.on('keyup', onEntryChange);
        
        entryTo.on('change', onEntryChange);
        entryTo.on('paste', onEntryChange);
        entryTo.on('keyup', onEntryChange);
        
        promoCode.on('tap', onTap);
        
        // initially choose the default entry
        $('#3tonne_info').hide();
        $('#5tonne_info').hide();
        
        lorrySize = 1;
        
        console.log(currentPrice);
        currentPrice.text = '0';

        promoDialog = phonon.dialog('#promo_dialog');
        promoDialog.on('confirm', function(inputValue)
        {
            promoCodeHandler(inputValue);
            generatePrice(currentPrice);
        });
    });
	
	
	activity.onReady(function(){
		// cater for back page
		generatePrice(currentPrice);
	});
	
}); // step1 page end

app.on({page: 'steptwo', content: 'steptwo.html'}, function(activity){

    var promoCode, currentPrice;
    var dateTime, name, contact, email;
    var fromAddUnitCtrl, fromAddStreetCtrl, toAddUnitCtrl, toAddStreetCtrl;
    var txtFromLocation, txtToLocation;
    var divTo;

    var fromAutocomplete = null, toAutocomplete = null;
    
    activity.onCreate(function(){
        
        currentPrice = document.querySelector('#steptwo-final-price');
        promoCode = document.querySelector('#promo-code');
        
        name = document.querySelector('#contact_name');
        contact = document.querySelector('#contact_number');
        email = document.querySelector('#contact_email');
        dateTime = document.querySelector('#delivery_datetime');
        
        fromAddUnitCtrl = document.querySelector('#address_from_unit');
        fromAddStreetCtrl = document.querySelector('#address_from_street');
        toAddUnitCtrl = document.querySelector('#address_to_unit');
		toAddStreetCtrl = document.querySelector('#address_to_street');
        
        txtToLocation = document.querySelector('#step2_location_to');
        txtFromLocation = document.querySelector('#step2_location_from');

        divTo = document.querySelector('#div_to');  
        
		price_fuel = document.querySelector('#price-fuel');
        price_maintenace = document.querySelector('#price-maintenace');
        price_labor = document.querySelector('#price-labor');
        price_partner = document.querySelector('#price-partner');
        price_justlorry = document.querySelector('#price-justlorry');
		
		
        document.querySelector('#nextsteptwo').on('tap', onAction);
        promoCode.on('tap', onPromoCode);

		$('input:radio[name="building-type-from"]').change(onBuildingTypeFromChange);
		$('input:radio[name="building-type-to"]').change(onBuildingTypeToChange);

        promoDialog = phonon.dialog('#promo_dialog');
        promoDialog.on('confirm', function(inputValue) {
            promoCodeHandler(inputValue);
            generatePrice(currentPrice);
        }); 

        // setup from auto complete text box
        fromAutocomplete = new google.maps.places.Autocomplete(
            fromAddStreetCtrl,
            {
                types: ['geocode']
            });
        fromAutocomplete.addListener('place_changed', fromAddChange);

        if(fromLocationBound !== null){
            var sw = new google.maps.LatLng(fromLocationBound.southwest.lat, fromLocationBound.southwest.lng);
            var ne = new google.maps.LatLng(fromLocationBound.northeast.lat, fromLocationBound.northeast.lng);
            fromAutocomplete.setBounds(new google.maps.LatLngBounds(sw, ne));
        }

        // setup to auto complete text box
        toAutocomplete = new google.maps.places.Autocomplete(
            toAddStreetCtrl,
            {
                types: ['geocode']
            });
        toAutocomplete.addListener('place_changed', toAddChange);

        if(toLocationBound !== null){
            var sw = new google.maps.LatLng(toLocationBound.southwest.lat, toLocationBound.southwest.lng);
            var ne = new google.maps.LatLng(toLocationBound.northeast.lat, toLocationBound.northeast.lng);
            toAutocomplete.setBounds(new google.maps.LatLngBounds(sw, ne));
        }

    });

    var componentForm = {

        street_number: 'short_name',
        route: 'long_name',
        locality: 'long_name',
        administrative_area_level_1: 'short_name',
        country: 'long_name',
        postal_code: 'short_name',
        premise : 'long_name'
    };

    function checkType(component) {

        return component.types[0] === 'route';
    }

    function checkPremise(component) {
        return component.types[0] === 'premise';
    }

    function checkCountry(component) {
        return component.types[0] === 'country';
    }

    var fromAddChange = function() {

        var place = fromAutocomplete.getPlace();
        console.log(place);

        var country = place.address_components.find(checkCountry);
        if(country !== undefined &&
            country.long_name !== 'Malaysia'){

            // route address not found
            fromAddStreetCtrl.value = '';

            phonon.i18n().get(['error_country_invalid', 'button_cancel'], function(values) {
                phonon.notif(values['error_country_invalid'], 2000, true, values['button_cancel']);
            });

            return;
        }

        var premise = place.address_components.find(checkPremise);
        if(premise !== undefined){

            // found the premise name
            fromAddStreetCtrl.value = premise.long_name;

            fromGpsLat = place.geometry.location.lat();
            fromGpsLng = place.geometry.location.lng();
            return;
        }

        var result = place.address_components.find(checkType);
        console.log(result);
        if(result !== undefined){

            // found the street name
            fromAddStreetCtrl.value = result.long_name; 

            fromGpsLat = place.geometry.location.lat();
            fromGpsLng = place.geometry.location.lng();

        } else {

            // route address not found
            fromAddStreetCtrl.value = '';

            phonon.i18n().get(['error_street_address', 'button_cancel'], function(values) {
                phonon.notif(values['error_street_address'], 2000, true, values['button_cancel']);
            });
        }
    }
    
    var toAddChange = function() {

        var place = toAutocomplete.getPlace();
        console.log(place);

        var country = place.address_components.find(checkCountry);
        if(country !== undefined &&
            country.long_name !== 'Malaysia'){

            // route address not found
            toAddStreetCtrl.value = '';

            phonon.i18n().get(['error_country_invalid', 'button_cancel'], function(values) {
                phonon.notif(values['error_country_invalid'], 2000, true, values['button_cancel']);
            });

            return;
        }

        var premise = place.address_components.find(checkPremise);
        if(premise !== undefined){

            // found the premise name
            toAddStreetCtrl.value = premise.long_name;

            toGpsLat = place.geometry.location.lat();
            toGpsLng = place.geometry.location.lng();

            return;
        }

        var result = place.address_components.find(checkType);
        console.log(result);
        if(result !== undefined){

            // found the street name
            toAddStreetCtrl.value = result.long_name; 

            toGpsLat = place.geometry.location.lat();
            toGpsLng = place.geometry.location.lng();
        } else {

            // route address not found
            toAddStreetCtrl.value = '';

            phonon.i18n().get(['error_street_address', 'button_cancel'], function(values) {
                phonon.notif(values['error_street_address'], 2000, true, values['button_cancel']);
            });
        }
    }

    activity.onReady(function(){
        // setup the location base on the postcode insert
        console.log(fromLocation);
        console.log(toLocation);
        console.log(lorryType);
        console.log(lorrySize);

        switch(lorryType){
            case 1:
            {
                console.log('case 1');
                switch(lorrySize){
                    case 1:
                        document.getElementById("deliver_icon").src = 'res/img/lorry_1tonne_256x190.png';
                        break;
                    case 3:
                        document.getElementById("deliver_icon").src = 'res/img/lorry_3tonne_256x190.png';
                        break;
                    case 5:
                        document.getElementById("deliver_icon").src = 'res/img/lorry_5tonne_256x190.png';
                        break;
                }
                break;
            }
            case 2: 
            {
                console.log('case 2');
                switch(lorrySize){
                    case 1:
                        document.getElementById("deliver_icon").src = 'res/img/disposal_lorry_1tonne_256x190.png';
                        break;
                    case 3:
                        document.getElementById("deliver_icon").src = 'res/img/disposal_lorry_3tonne_256x190.png';
                        break;
                    case 5:
                        document.getElementById("deliver_icon").src = 'res/img/disposal_lorry_5tonne_256x190.png';
                        break;
                }
                break;
            }
            default:
                console.log('default');
        }
		
        txtFromLocation.text = fromLocation;
        
        if(lorryType === 2) {
            // disposal type, hide the to address
			toAddUnitCtrl.required = false; // avoid validity failed.
			toAddStreetCtrl.required = false;
            divTo.style.display = 'none'; 	
			
        } else {
            divTo.style.display = 'inherit';
            txtToLocation.text = toLocation;
        }
		
		generatePrice(currentPrice);

		// initialize the datetime picker 2 days after today
		var minDate = moment().add(2, 'days');

		// dateTime.value = minDate.format("YYYY-MM-DDT08:00");
		dateTime.min = minDate.format("YYYY-MM-DDT08:00");
    });
    
	var onBuildingTypeFromChange = function(evt) {

		console.log('from: ' + this.value);
		fromBuildingType  = this.value;

        // change the button style
        switch(fromBuildingType){
            case '1':
                document.getElementById("panel-building-type-from").src 
                    = 'res/img/bt_icon_1_lift_active_96x96.png';
                break;
            case '2':
                document.getElementById("panel-building-type-from").src 
                    = 'res/img/bt_icon_2_nolift_active_96x96.png';
                break;
            case '3':
                document.getElementById("panel-building-type-from").src 
                    = 'res/img/bt_icon_3_landed_active_96x96.png';
                break;
        }

		generatePrice(currentPrice);

        ga('send', 'event', 'mobile', 'click', 'building_type_from');
	}
	
	var onBuildingTypeToChange = function(evt) {
		console.log('to: ' + this.value);
		toBuildingType = this.value;

        // change the button style
        switch(toBuildingType){
            case '1':
                document.getElementById("panel-building-type-to").src 
                    = 'res/img/bt_icon_1_lift_active_96x96.png';
                break;
            case '2':
                document.getElementById("panel-building-type-to").src 
                    = 'res/img/bt_icon_2_nolift_active_96x96.png';
                break;
            case '3':
                document.getElementById("panel-building-type-to").src 
                    = 'res/img/bt_icon_3_landed_active_96x96.png';
                break;
        }

		generatePrice(currentPrice);

        ga('send', 'event', 'mobile', 'click', 'building_type_to');
	}
	
    // events handling
    var onAction = function(evt) {
        var target = evt.target;

        if (target.getAttribute('data-order') === 'steptwo-next'){
            // go to next page
            if(name.validity.valid == false ||
              contact.validity.valid == false ||
              email.validity.valid == false ||
			  fromAddUnitCtrl.validity.valid == false ||
			  fromAddStreetCtrl.validity.valid == false ||
			  toAddStreetCtrl.validity.valid == false ||
			  toAddStreetCtrl.validity.valid == false) {
                return;
            }
            
            if(dateTime.value === ''){

                phonon.i18n().get(['error_pickup_time'], function(values) {
                    phonon.notif(values['error_pickup_time'], 1500, false);
                });

                return;
            }

            // check for building selection
            if(fromBuildingType === 0){

                phonon.i18n().get(['error_building_type'], function(values) {
                    phonon.notif(values['error_building_type'], 1500, false);
                });

                return;
            }

            if(lorryType === 1 &&
                toBuildingType === 0){
                
                phonon.i18n().get(['error_building_type'], function(values) {
                    phonon.notif(values['error_building_type'], 1500, false);
                });
                return;
            }


			// save the details
			/*
			var fromAddUnit, fromAddStreet, toAddUnit, toAddStreet;
			var contactName = null, contactNumber = null, contactEmail = null;
			var deliverDateTime = null;
			*/
			deliverDateTime = dateTime.value;
			contactName = name.value;
			contactNumber = contact.value;
			contactEmail = email.value;

			fromAddUnit = fromAddUnitCtrl.value;
			fromAddStreet = fromAddStreetCtrl.value;
			toAddUnit = toAddUnitCtrl.value;
			toAddStreet = toAddStreetCtrl.value;

			console.log(deliverDateTime);
			console.log(contactName);
			console.log(contactNumber);
			console.log(contactEmail);
			
            app.changePage('confirm');
        }
    };
    
    var onPromoCode = function(evt) {

        promoDialog.open();

        /*
        phonon.i18n().get(['bottom_promo', 'button_ok', 'button_cancel', 'promo_code_placeholder'], function(values) {
            console.log(values);

            var prompt = phonon.prompt(values['promo_code_placeholder'], values['bottom_promo'], true, values['button_ok'], values['button_cancel']);
            prompt.
            prompt.on('confirm', function(inputValue)
                {
                    promoCodeHandler(inputValue, currentPrice);
                });
        });  
        */

        ga('send', 'event', 'mobile', 'click', 'promo_code');
    }; 
}); // step2 page end

app.on({page: 'confirm', content: 'confirm.html'}, function(activity){
    
	var confirmBtn;
    var promoCode, currentPrice;
    var divTo, divImgDispose;
	var divAdditionalService;
	
	var deliverDate, deliveryTime, name, contact;
	var deliverToUnit, deliverToStreet, deliveryToLocation;
	var deliverFromUnit, deliverFromStreet, deliveryFromLocation;
	
	var checkboxLabor;
	var laborTxtCtrl;
	
    var recommendedLaborCount = 0;
	
    activity.onCreate(function(){
		
		confirmBtn = document.querySelector('#confirm_confirm');
		
        currentPrice = document.querySelector('#confirm_final_price');
        promoCode = document.querySelector('#confirm_promo_code');
        
        divTo = document.querySelector('#div_deliver_to');
        divImgDispose = document.querySelector('#div_image_disposed');
		divAdditionalService = document.querySelector('#additional_service_div');
        
		deliverDate = document.querySelector('#confirm_delivery_date');
        deliveryTime = document.querySelector('#confirm_delivery_time');
        name = document.querySelector('#confirm_contact_name');
		contact = document.querySelector('#confirm_contact_phone');
		
		deliverFromUnit = document.querySelector('#road_details_unit_from');
        deliverFromStreet = document.querySelector('#road_details_street_from');
		deliveryFromLocation = document.querySelector('#road_location_from');
		
		deliverToUnit = document.querySelector('#road_details_unit_to');
        deliverToStreet = document.querySelector('#road_details_street_to');
		deliveryToLocation = document.querySelector('#road_location_to');
		
		checkboxLabor = document.querySelector('#confirm_checkbox_labor');
		laborTxtCtrl = document.querySelector('#service_labor_text');
		
		price_fuel = document.querySelector('#price-fuel');
        price_maintenace = document.querySelector('#price-maintenace');
        price_labor = document.querySelector('#price-labor');
        price_partner = document.querySelector('#price-partner');
        price_justlorry = document.querySelector('#price-justlorry');
		
		
		// register events
		confirmBtn.on('tap', onConfirm);
		promoCode.on('tap', onPromoCode);
		checkboxLabor.on('change', onChecked);

		$( "#select_bed_count" ).change(onBedChange);
		$( "#select_wardrobe_count" ).change(onWardrobeChange);
		$( "#select_dinning_count" ).change(onDiningChange);
		$( "#select_table_count" ).change(onOfficeChange);

                // manipulate labor count for disposal
        if(lorryType == 2){
            switch(lorrySize){
                case 1:
                case 3:
                    laborCount = 2
                    break;
                case 5:
                    laborCount = 3;
                    break;
            }
        } else {
            laborCount = 0;
        }

        promoDialog = phonon.dialog('#promo_dialog'); 
        promoDialog.on('confirm', function(inputValue)
        {
            promoCodeHandler(inputValue);
            generatePrice(currentPrice);
        });

    });
    
    activity.onReady(function() {
        
        console.log(lorryType);
        console.log(lorrySize);

        switch(lorryType){
            case 1:
            {
                console.log('case 1');
                switch(lorrySize){
                    case 1:
                        document.getElementById("confirmation_deliver_icon").src = 'res/img/lorry_1tonne_256x190.png';
                        break;
                    case 3:
                        document.getElementById("confirmation_deliver_icon").src = 'res/img/lorry_3tonne_256x190.png';
                        break;
                    case 5:
                        document.getElementById("confirmation_deliver_icon").src = 'res/img/lorry_5tonne_256x190.png';
                        break;
                }
                break;
            }
            case 2: 
            {
                console.log('case 2');
                switch(lorrySize){
                    case 1:
                        document.getElementById("confirmation_deliver_icon").src = 'res/img/disposal_lorry_1tonne_256x190.png';
                        break;
                    case 3:
                        document.getElementById("confirmation_deliver_icon").src = 'res/img/disposal_lorry_3tonne_256x190.png';
                        break;
                    case 5:
                        document.getElementById("confirmation_deliver_icon").src = 'res/img/disposal_lorry_5tonne_256x190.png';
                        break;
                }
                break;
            }
            default:
                console.log('default');
        }

        if(lorryType === 2) {
            // disposal type, hide the to address
            divTo.style.display = 'none';
            divImgDispose.style.display= 'inherit';
			
			divAdditionalService.style.display = 'none';

        } else {
            divTo.style.display = 'inherit';
            divImgDispose.style.display= 'none';
			
			divAdditionalService.style.display = 'inherit';
        }
		
		// generate the price
		generatePrice(currentPrice);
		
		// populate delivery info
		var mom = moment(deliverDateTime, moment.ISO_8601);
		console.log(mom);
		deliverDate.text = mom.format("DD/MM/YYYY");
		deliveryTime.text = mom.format("hh:mm A");
		
		name.text = contactName;
		contact.text = contactNumber;
		
		
		deliverFromUnit.text = fromAddUnit;
		deliverFromStreet.text = fromAddStreet;
		deliveryFromLocation.text = fromLocation;
		
		deliverToUnit.text = toAddUnit;
		deliverToStreet.text = toAddStreet;
		deliveryToLocation.text = toLocation;
		
		
		// generate the labor text base on lorry type
		switch(lorrySize) {
			case 1:
				recommendedLaborCount = 2;
				break;
			case 3:
				recommendedLaborCount = 3;
				break;
			case 5:
				recommendedLaborCount = 3;
				break;
		}

		phonon.i18n().get(['panel_service_labor_man'], function(values) {
            console.log(values);
			
			var laborCharge = 0;
			if((fromBuildingType == 1 || fromBuildingType == 3) &&
				(toBuildingType == 1 || toBuildingType == 3)) {
				laborCharge = 90;
			} else {
				laborCharge = 135;
			}
	
			var perPerson = values['panel_service_labor_man'].replace('##', laborCharge)
			laborTxtCtrl.text = recommendedLaborCount + perPerson;
        });
    });
	
	var onBedChange = function(evt) {
		assemblyBedCount = this.value;
		console.log('assemblyBedCount: ' + assemblyBedCount);
		
		generatePrice(currentPrice);
	}
	
	var onWardrobeChange = function(evt) {
		assemblyWardrobeCount = this.value;
		console.log('assemblyWardrobeCount: ' + assemblyWardrobeCount);
		
		generatePrice(currentPrice);
	}
	
	var onDiningChange = function(evt) {
		assemblyDiningCount = this.value;
		console.log('assemblyDiningCount: ' + assemblyDiningCount);
		
		generatePrice(currentPrice);
	}
	
	var onOfficeChange = function(evt) {
		assemblyTableCount = this.value;
		console.log('assemblyTableCount: ' + assemblyTableCount);
		
		generatePrice(currentPrice);
	}
	
	var onChecked = function(evt) {

		var order = evt.target.getAttribute('data-order');
		console.log(order);
		switch(order) {
			case 'labor':
				handleLaborChecked(evt.target.checked);
				break;
			case 'assembly':
				handleAssemblyChecked(evt.target.checked);
				break;
			case 'bubble':
				break;
			case 'shrink':
				break;
		}

        ga('send', 'event', 'mobile', 'click', 'additional_service');
	}
	
	var handleLaborChecked = function(checkStatus) {
		console.log('labor ' + checkStatus);
		
		if(checkStatus) {		
			// labor count based on lorry size
			laborCount = recommendedLaborCount;
		} else {
			laborCount = 0;
		}
		
		generatePrice(currentPrice);
        ga('send', 'event', 'mobile', 'click', 'labor');
	}
	
	var handleAssemblyChecked = function(checkStatus) {
		console.log('assembly ' + checkStatus);
		
		if(checkStatus) {
			phonon.panel('#panel-service-assembly').open();
		} else {
			// reset all the items
			$("#select_bed_count").val('0').change();
			$("#select_wardrobe_count").val('0').change();
			$("#select_dinning_count").val('0').change();
			$("#select_table_count").val('0').change();
		}
	}
	
    /*
    var fromAddUnit = null, fromAddStreet = null, toAddUnit = null, toAddStreet = null;
    var contactName = null, contactNumber = null, contactEmail = null;
    var deliverDateTime = null;
    */
	var onConfirm = function(evt) {

        var blocking = phonon.indicator("", false);

        console.log(currentPrice.text);
        totalAmount = currentPrice.text;

        // first add the user
        var userId = '';
        var addressTo = [{
            "address1" : toAddUnit,
            "address2" : toAddStreet,
            "address3" : toLocation,
            //"stateId" : '1', // TODO
            //"countryId" : '1', // TODO
            "postcode" : fromPostcode,
            "contactPerson" :  contactName,
            "contactNumber" : contactNumber,
            "gpsLongitude" : toGpsLng,
            "gpsLatitude" : toGpsLat
        }];

        if(lorryType == 2){
            // disposal should not pass in address to
            addressTo = [];
        }

        $.post(apiBaseUrl + 'user', JSON.stringify(
            {
                'username': contactNumber,
                'displayName' : contactName,
                'contactNumber' : contactNumber,
                'email' : contactEmail
            }))
        .then(function(result){
            
            userId = result.payload;

            console.log(oneSignalIdentifier);
            if(oneSignalIdentifier != null){

                $.ajax({
                    url: apiBaseUrl + 'device?userId=' + userId + '&newIdentifier=' +  oneSignalIdentifier,
                    method: "PUT"
                }).done(function(result){
                    console.log(result);
                });
            }
        })
        .done(function(){
            

            var remarks = '';
            if(fromBuildingType == 2) {
                remarks += ('From building without lift. ');
            }


            if(toBuildingType == 2) {
                remarks += ('To building without lift. ');
            }

            if(assemblyBedCount != 0){
                remarks += ('Assembly Bed: ' + assemblyBedCount + ' ');
            }

            if(assemblyDiningCount != 0){
                remarks += ('Assembly Dining: ' + assemblyDiningCount + ' ');
            }

            if(assemblyWardrobeCount != 0){
                remarks += ('Assembly Wardrobe: ' + assemblyWardrobeCount + ' ');
            }

            if(assemblyTableCount != 0){
                remarks += ('Assembly Table: ' + assemblyTableCount + ' ');
            }

            blocking.close();
            $.post(apiBaseUrl + 'job', JSON.stringify(
            {
                "ownerUserId" : userId,
                "jobTypeId" : lorryType,
                "fleetTypeId" : lorrySize,          // server to transfer size to type
                "amount" : currentPrice.text,      // TODO: to be discuss for server side double confirm
                "workerAssistant" : laborCount,
                "deliveryDate" : deliverDateTime,
                "remarks" : 'assemblyBedCount:0',
                "addressFrom" : [{
                    "address1" : fromAddUnit,
                    "address2" : fromAddStreet,
                    "address3" : fromLocation,
                    //"stateId" : '1', // TODO
                    //"countryId" : '1', // TODO
                    "postcode" : fromPostcode,
                    "contactPerson" :  contactName,
                    "contactNumber" : contactNumber,
                    "gpsLongitude" : fromGpsLng,
                    "gpsLatitude" : fromGpsLat
                }],
                "addressTo" : addressTo
            }))
            .done(function(result2){

                console.log(result2);
                if(result2.success){
                    orderCode = result2.payload;

                    // proceed to payment page
                    app.changePage("payment", orderCode);
                } else {
                    phonon.i18n().get(['error_general', 'button_ok'], function(values) {
                        phonon.alert('', result2.errorMessage, false, values['button_ok']);
                    });
                }
            });
        })
	};
    
    var onPromoCode = function(evt) {

        promoDialog.open();
        ga('send', 'event', 'mobile', 'click', 'promo_code');
    };
}); // 'confirm' page end 

app.on({page: 'home', content: 'home.html'}, function(activity){
    
    var newOrderBtn = null;
    var makePaymentBtn = null;
    var trackingBtn = null;
    var ikeaDeliveryBtn = null;

    var bookingDialog = null;

    activity.onCreate(function(){

        // if (typeof(Storage) !== undefined) {
        //     // load the languages user last set
        //     var locale = localStorage.getItem("locale");
        //     console.log(locale);
        //     if(locale !== undefined && locale !== null){
        //         phonon.updateLocale(locale);
        //     }
        // }

        // get the passed in param
        var queryStr = QueryString;
        if(queryStr != null &&
            queryStr.identifier != null){

            console.log(queryStr);
            oneSignalIdentifier = queryStr.identifier;
        }

        newOrderBtn = document.querySelector('#home_new');
        makePaymentBtn = document.querySelector('#home_payment');
        trackingBtn = document.querySelector('#home_orderstatus');
        ikeaDeliveryBtn = document.querySelector('#home_ikea');

        if(newOrderBtn !== null){
            newOrderBtn.on('tap', function(evt){
                app.changePage('stepone');
            });
        }

        if(makePaymentBtn !== null){
            makePaymentBtn.on('tap', onPayment);
        }

        bookingDialog = phonon.dialog('#booking_dialog'); 
        bookingDialog.on('confirm', function(inputValue) {
            // validate the order id
            $.get(apiBaseUrl + 'job?uniqueId=' + inputValue, 
                   JSON.stringify({
                    }),
                function(data, status){
                    console.log(data);

                    if(data.success){
                        app.changePage('payment', inputValue);    
                        return;                  
                    }

                    displayPaymentError();
            });
        });


        if(trackingBtn !== null){
            trackingBtn.on('tap', function(evt){
                app.changePage('tracking');
                return;
            });
        }

        if(ikeaDeliveryBtn !== null){
            ikeaDeliveryBtn.on('tap', function(evt){
                //window.location.href = 'https://ikea.justlorry.com';
                window.open(
                    'https://ikea.justlorry.com',
                    '_blank'
                );
                return;        
            });
        }
    });

    activity.onReady(function() {

        console.log(phonon.device.os);
        try {

            if(phonon.device.os === 'Android') {
                Android.StartGpsTracking("test123");
            } else if(phonon.device.os === 'iOS') {
                JSCall.StartGpsTracking("test444");
            }
        } catch(e) {

            console.log(e);
        }

    });

    var onPayment = function(evt) {

        bookingDialog.open();

        /*
        console.log('test');
        phonon.i18n().get(['home_payment_orderId_title', 'button_ok', 'button_cancel', 'home_payment_orderId_placeholder'], function(values) {

            var prompt = phonon.prompt(values['home_payment_orderId_placeholder'], values['home_payment_orderId_title'], true, values['button_ok'], values['button_cancel']);
            prompt.on('confirm', function(inputValue) {
                // validate the order id
                $.get(apiBaseUrl + 'job?uniqueId=' + inputValue, 
                       JSON.stringify({
                        }),
                function(data, status){
                    console.log(data);

                    if(data.success){
                        app.changePage('payment', inputValue);    
                        return;                  
                    }

                    displayPaymentError();

                });
            });
        });
        */  
    };

    var displayPaymentError = function() {

        console.log('displayPaymentError');
        
        // prompt invalid postcode
        phonon.i18n().get(['error_home_payment', 'button_ok'], function(values) {
            phonon.alert('', values['error_home_payment'], false, values['button_ok']);
        });
    }

}); // home page end

app.on({page: 'payment', content: 'payment.html'}, function(activity){
    
    var paymentBtn;
    var orderIdCtrl;
    var totalCostCtrl;

    var displayPaymentError = function() {
        // prompt invalid postcode
        phonon.i18n().get(['error_general', 'button_ok'], function(values) {
            phonon.alert('', values['error_general'], false, values['button_ok']);
        });
    }

    var onPayment = function(evt){

        $.post(apiBaseUrl + 'payment?orderId=' + orderCode, 
               null,
        function(data, status){
            console.log(data);
            
            if(data.success) {
                // keep the data
                console.log(data.payload);
                window.location.href = data.payload;

            } else {
                displayPaymentError();
            }
        });
    }
    
    activity.onCreate(function(){

        paymentBtn = document.querySelector('#payment_confirm');
        orderIdCtrl = document.querySelector('#booking_id');
        totalCostCtrl = document.querySelector('#total_amount');
    });

    activity.onReady(function(){
        paymentBtn.on('tap', onPayment);
    });

    activity.onHashChanged(function(orderId){

        $.get(apiBaseUrl + 'job?uniqueId=' + orderId, 
               JSON.stringify({
                }),
            function(data, status){
                console.log(data);
                
                if(data.success){
                        
                    orderCode = orderId;
                    orderIdCtrl.text = orderId;

                    var parsedPayload = JSON.parse(data.payload);
                    totalAmount = parsedPayload.amount;
                    totalCostCtrl.text = totalAmount; 

                    if(oneSignalIdentifier != null){
                        $.ajax({
                            url: apiBaseUrl + 'device?userId=' + parsedPayload.ownerUserId  + '&newIdentifier=' +  oneSignalIdentifier,
                            method: "PUT"
                        }).done(function(result){
                            console.log(result);
                        });
                    }                       
                }
            });
    });

}); // payment page end

app.start();

var generatePrice = function(control) {

    console.log('gen1');
    if(fromPostcode == null) {
        return;
    }
    console.log('gen2');
    
    if(lorryType == 1){
        
        console.log('gen3');
        if(toPostcode == null) {
            return;
        }
        
        console.log('gen4');
        // standard delivery
        $.get(apiBaseUrl + 'StandardDelivery?' +
            'distance=' + distance + '&' +
            'lorryType=' + lorrySize+ '&' +
            'fromBuildingType=' + fromBuildingType + '&' +
            'toBuildingType=' + toBuildingType + '&' +
            'labor=' + laborCount + '&' +
            'assembleBed='+ assemblyBedCount + '&' +
            'assemblyDining=' + assemblyDiningCount + '&' +
            'assemblyWardrobe=' + assemblyWardrobeCount + '&' +
            'assemblyTable=' + assemblyTableCount + '&' +
            'promoCode=' + promoCodeValue,
        function(data, status){
            console.log('gen5');
            if(data.success){

                // set the price 
                var payload = JSON.parse(data.payload);
                console.log(payload);

                control.text = payload.total.toFixed(0);
                price_fuel.text = payload.fuel.toFixed(0);
                price_maintenace.text = payload.maintenance.toFixed(0);
                price_labor.text = payload.labor.toFixed(0);
                price_partner.text = payload.partner.toFixed(0);
                price_justlorry.text = payload.justlorry.toFixed(0);

            } else {
                phonon.i18n().get(['error_general', 'button_ok'], function(values) {
                    phonon.alert('', values['error_general'], false, values['button_ok']);
                });
            }
        });   
    }
    else if(lorryType == 2)
    {
        // disposal
        $.get(apiBaseUrl + 'disposaldelivery?' + 
            'fromBuildingType=' + fromBuildingType + '&' +
            'lorryType=' + lorrySize, 
        function(data, status){
            if(data.success){

                // set the price 
                var payload = JSON.parse(data.payload);
                console.log(payload);

                control.text = payload.total.toFixed(0);
                price_fuel.text = payload.fuel.toFixed(0);
                price_maintenace.text = payload.maintenance.toFixed(0);
                price_labor.text = payload.labor.toFixed(0);
                price_partner.text = payload.partner.toFixed(0);
                price_justlorry.text = payload.justlorry.toFixed(0);

            } else {
                phonon.i18n().get(['error_general', 'button_ok'], function(values) {
                    phonon.alert('', values['error_general'], false, values['button_ok']);
                });
            }
        });   
    }
}

var validateNumber = function(evt) {
    
    var theEvent = evt || window.event;
    var key = theEvent.keyCode || theEvent.which;
    key = String.fromCharCode( key );
    var regex = /[0-9]|\./;
    if( !regex.test(key) ) {
        theEvent.returnValue = false;
        if(theEvent.preventDefault) {
            theEvent.preventDefault();
        }   
    }
}

var blocking = null;
var promoCodeHandler = function (promoCode) {

    if(blocking !== null){
        return;
    }
    // validate promo code here
    if(promoCode.length > 0) {

        blocking = phonon.indicator("", false);
        $.post(apiBaseUrl + 'voucher?promoCode=' + promoCode, 
           null,
            function(data, status){
                
                blocking.close();
                blocking = null;
                console.log(data);

                if(data.success){

                    // keep the voucher code
                    phonon.i18n().get('promo_code_valid', function(values) {
                        phonon.notif(values, 3000, false);
                    });

                    promoCodeValue = promoCode;
                    return;
                }

                // display error message
                console.log('' + data.errorCode);
                phonon.i18n().get('' + data.errorCode, function(values) {
                    console.log(values);
                    phonon.notif(values, 3000, true);
                });
            });
    }
}

var QueryString = function () {
    // This function is anonymous, is executed immediately and 
    // the return value is assigned to QueryString!
    var query_string = {};
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i=0;i<vars.length;i++) {
        var pair = vars[i].split("=");
        // If first entry with this name
        if (typeof query_string[pair[0]] === "undefined") {
            query_string[pair[0]] = decodeURIComponent(pair[1]);
        // If second entry with this name
        } else if (typeof query_string[pair[0]] === "string") {
            var arr = [ query_string[pair[0]],decodeURIComponent(pair[1]) ];
            query_string[pair[0]] = arr;
        // If third or later entry with this name
        } else {
            query_string[pair[0]].push(decodeURIComponent(pair[1]));
        }
    }
    return query_string;
}();