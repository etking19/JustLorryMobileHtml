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

var apiBaseUrl = "http://52.40.249.160/just/api/";
//var apiBaseUrl = "http://localhost:56883/api/";

var oneSignalIdentifier = null;
var distance = 0;
var lorrySize = 1;
var orderCode = null;
var totalAmount = null;

var lorryType = 1;
var fromBuildingType = 1, toBuildingType = 1;
var laborCount = 0;
var assemblyBedCount = 0;
var assemblyDiningCount = 0;
var assemblyWardrobeCount = 0;
var assemblyTableCount = 0;
var promoCodeValue = null;
var recommendedLaborCount = 0;

var fromPostcode = null, toPostcode = null;		// not in use, for reference only
var fromLocation = null, toLocation = null;

var fromAddUnit = null, fromAddStreet = null, toAddUnit = null, toAddStreet = null;
var contactName = null, contactNumber = null, contactEmail = null;
var deliverDateTime = null;


// price details controls
var price_fuel, price_maintenace, price_labor, price_partner, price_justlorry;

var colorSelected = "rgb(254, 255, 208)";
var colorDeselect = "rgb(241, 241, 241)"

// handling for language selections
document.querySelector('.lang-en').on('tap', function(evt){
    phonon.updateLocale('en-US');
});

document.querySelector('.lang-ms').on('tap', function(evt){
    phonon.updateLocale('ms');
});

$.ajaxSetup({
    headers: 
    { 
        'Authorization': 'basic anVzdFBhcnRuZXJBcHA=',
        'Content-Type' : 'application/json'
    },
    dataType: 'json'
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

			console.log('promo code');
            phonon.i18n().get(['bottom_promo', 'button_ok', 'button_cancel', 'promo_code_placeholder'], function(values) {

                var prompt = phonon.prompt(values['promo_code_placeholder'], values['bottom_promo'], true, values['button_ok'], values['button_cancel']);
                prompt.on('confirm', function(inputValue)
                    {
                        promoCodeHandler(inputValue, currentPrice);
                    });
            });          

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
        $.post(apiBaseUrl + 'delivery/postcode', 
               JSON.stringify({
                    'deliverFrom': from,
                    'deliverTo': to
                }),
        function(data, status){
            console.log(data);
            
            if(status == 'success') {
                // keep the data
                if(data.DeliveryPostcodeValidationResult.success){
                    
                    var payload = JSON.parse(data.DeliveryPostcodeValidationResult.payload);
                    console.log(payload);
                    
                    fromLocation = payload.postCodeAddFrom;
                    toLocation = payload.postCodeAddTo;
                    distance = payload.distance / 1000;
                    
                    // generate price
                    generatePrice(currentPrice);
                    
                } else {

                    entryFrom.value = '';
                    entryTo.value = '';
                    phonon.alert('', data.DeliveryPostcodeValidationResult.errorMessage, false, 'OK');
                }
                
            } else {
                displayPostcodeError();
            }
        });
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

            if(lorryType == 1) {
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
            entryTo.required = true;
            generatePrice(currentPrice);

            ga('send', 'event', 'mobile', 'click', 'standard_delivery');
        });

        $('#stepone-disposal').on('click', function(){

            if(lorryType == 2) {
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

    });
    
    activity.onReady(function(){
        // setup the location base on the postcode insert
		
		console.log(fromLocation);
		console.log(toLocation);
		console.log(lorryType);
        console.log(lorrySize);

        switch(lorryType){
            case 1:
            {
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
            }
            case 2: 
            {
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
            }
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
		minDate.set
		dateTime.value = minDate.format("YYYY-MM-DDT08:00");
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
            if(dateTime.validity.valid == false ||
              name.validity.valid == false ||
              contact.validity.valid == false ||
              email.validity.valid == false ||
			  fromAddUnitCtrl.validity.valid == false ||
			  fromAddStreetCtrl.validity.valid == false ||
			  toAddStreetCtrl.validity.valid == false ||
			  toAddStreetCtrl.validity.valid == false) {
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
        phonon.i18n().get(['bottom_promo', 'button_ok', 'button_cancel', 'promo_code_placeholder'], function(values) {
            console.log(values);

            var prompt = phonon.prompt(values['promo_code_placeholder'], values['bottom_promo'], true, values['button_ok'], values['button_cancel']);
            prompt.on('confirm', function(inputValue)
                {
                    promoCodeHandler(inputValue, currentPrice);
                });
        });  

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
    });
    
    activity.onReady(function() {
        
        console.log(lorryType);
        console.log(lorrySize);

        switch(lorryType){
            case 1:
            {
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
            }
            case 2: 
            {
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
            }
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
            "contactNumber" : contactNumber
        }];

        if(lorryType == 2){
            // disposal should not pass in address to
            addressTo = [];
        }

        $.post(apiBaseUrl + 'user/profile', JSON.stringify(
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
                $.post(apiBaseUrl + 'user/device', JSON.stringify(
                {
                    "userId" : userId,
                    "identifier" : oneSignalIdentifier
                }))
            }
        })
        .done(function(){
            
            $.post(apiBaseUrl + 'job', JSON.stringify(
            {
                "ownerUserId" : userId,
                "jobTypeId" : lorryType,
                "fleetTypeId" : lorrySize,          // server to transfer size to type
                "amount" : currentPrice.text,      // TODO: to be discuss for server side double confirm
                "workerAssistant" : laborCount,
                "deliveryDate" : deliverDateTime,
                "remarks" : '',
                "addressFrom" : [{
                    "address1" : fromAddUnit,
                    "address2" : fromAddStreet,
                    "address3" : fromLocation,
                    //"stateId" : '1', // TODO
                    //"countryId" : '1', // TODO
                    "postcode" : fromPostcode,
                    "contactPerson" :  contactName,
                    "contactNumber" : contactNumber
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
        phonon.i18n().get(['bottom_promo', 'button_ok', 'button_cancel', 'promo_code_placeholder'], function(values) {
            console.log(values);

            var prompt = phonon.prompt(values['promo_code_placeholder'], values['bottom_promo'], true, values['button_ok'], values['button_cancel']);
            prompt.on('confirm', function(inputValue)
                {
                    promoCodeHandler(inputValue, currentPrice);
                });
        });  

        ga('send', 'event', 'mobile', 'click', 'promo_code');
    };
}); // 'confirm' page end 

app.on({page: 'home', content: 'home.html'}, function(activity){
    
    var newOrderBtn;
    var makePaymentBtn;

    activity.onCreate(function(){

        // get the passed in param
        var queryStr = QueryString;
        if(queryStr != null &&
            queryStr.identifier != null){

            console.log(queryStr);
            oneSignalIdentifier = queryStr.identifier;
        }

        newOrderBtn = document.querySelector('#home-newOrder');
        makePaymentBtn = document.querySelector('#home-payment');
    });

    activity.onReady(function() {

        newOrderBtn.on('tap', function(evt){
            app.changePage('stepone');
        });

        makePaymentBtn.on('tap', onPayment);

    });

    var onPayment = function(evt) {
        phonon.i18n().get(['home_payment_orderId_title', 'button_ok', 'button_cancel', 'home_payment_orderId_placeholder'], function(values) {

            var prompt = phonon.prompt(values['home_payment_orderId_placeholder'], values['home_payment_orderId_title'], true, values['button_ok'], values['button_cancel']);
            prompt.on('confirm', function(inputValue) {
                // validate the order id
                $.get(apiBaseUrl + 'job?uniqueId=' + inputValue, 
                       JSON.stringify({
                        }),
                function(data, status){
                    console.log(data);
                    
                    if(status == 'success') {
                        // keep the data
                        if(data.success){
                            app.changePage('payment', inputValue);    
                            return;                  
                        }
                    }

                    displayPaymentError();

                });
            });
        });  
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

        $.post(apiBaseUrl + 'payment', 
               JSON.stringify({
                    'uniqueId': orderCode
                }),
        function(data, status){
            console.log(data);
            
            if(data.PaymentMakeResult.success) {
                // keep the data
                console.log(data.PaymentMakeResult.payload);
                window.location.href = data.PaymentMakeResult.payload;

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
                
                if(status == 'success') {
                    // keep the data
                    if(data.success){
                        
                        orderCode = orderId;
                        orderIdCtrl.text = orderId;

                        var payload = JSON.parse(data.payload);

                        totalAmount = payload.amount;
                        totalCostCtrl.text = totalAmount; 

                        if(oneSignalIdentifier != null){
                            $.post(apiBaseUrl + 'user/device', JSON.stringify(
                            {
                                "userId" : payload.ownerUserId,
                                "identifier" : oneSignalIdentifier
                            }))
                        }                       
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
        $.get(apiBaseUrl + 'delivery/price?' +
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
            if(status == 'success' &&
                data.PriceGenerateResult.success){

                // set the price 
                var payload = JSON.parse(data.PriceGenerateResult.payload);
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
        $.get(apiBaseUrl + 'disposal/price?' + 
            'fromBuildingType=' + fromBuildingType + '&' +
            'lorryType=' + lorrySize, 
        function(data, status){
            if(status == 'success' &&
                data.PriceGenerateDisposalResult.success){

                // set the price 
                var payload = JSON.parse(data.PriceGenerateDisposalResult.payload);
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

var promoCodeHandler = function (promoCode, priceCtrl) {

    // validate promo code here
    if(promoCode.length > 0) {

        phonon.i18n().get('promo_code_wait', function(values) {
            var indicator = phonon.notif(values, 1000, false);

            $.post(apiBaseUrl + 'voucher', 
               JSON.stringify({
                    'promoCode': promoCode
                }),
                function(data, status){
                    
                    console.log(data);

                    if(status == 'success') {
                        // keep the data
                        if(data.ValidateVoucherResult.success){

                            // keep the voucher code
                            phonon.i18n().get('promo_code_valid', function(values) {
                                phonon.notif(values, 3000, false);
                            });

                            promoCodeValue = promoCode;
                            generatePrice(priceCtrl);
                            return;
                        }
                    }

                    // display error message
                    console.log('' + data.ValidateVoucherResult.errorCode);
                    phonon.i18n().get('' + data.ValidateVoucherResult.errorCode, function(values) {
                        console.log(values);
                        phonon.notif(values, 3000, false);
                    });
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