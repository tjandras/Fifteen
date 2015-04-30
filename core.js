(function(core) {
	'use strict';
	
	var self = core;

	self.documentReadyStates = {
		loading: 'loading',
		interactive: 'interactive',
		complete: 'complete'
	};

	self.onLoaded = function(func, waitFor) {
		if (!waitFor) {
			waitFor = 'complete'; //'interactive'; // complete
		}
		var readyStateCheckInterval = setInterval(function() {
			if (document.readyState === waitFor) {
				func();
				clearInterval(readyStateCheckInterval);
			}
		}, 10);
	};

	self.addEventListener = function(target, type, listener) {
		if (document.addEventListener) {
			// W3C DOM 2 Events model (For non-IE browsers)
			target.addEventListener(type, listener, false);
		} else if (document.attachEvent) {
			// Internet Explorer Events model
			// prevent adding the same listener twice, since DOM 2 Events ignores duplicates like this
		    if (findListener(target, type, listener) != -1) {
				return;
			}

			// listener2 calls listener as a method of target in one of two ways,
		    // depending on what this version of IE supports, and passes it the global
	    	// event object as an argument
	    	var listener2 = function() {
			  	var event = window.event;
			  	
			  	if (Function.prototype.call) {
			  		listener.call(target, event);
				} else {
			  		target._currentListener = listener;
				  	target._currentListener(event);
				  	target._currentListener = null;
				}
			};
			
			// add listener2 using IE's attachEvent method
			target.attachEvent("on" + type, listener2);
			
			// create an object describing this listener so we can clean it up later
			var listenerRecord = {
			  	target: target,
			  	type: type,
			  	listener: listener,
			  	listener2: listener2
			};
			
			// get a reference to the window object containing target
		    var targetDocument = target.document || target;
	    	var targetWindow = targetDocument.parentWindow;

		    // create a unique ID for this listener
	    	var listenerId = "l" + core._listenerCounter++;

		    // store a record of this listener in the window object
	    	if (!targetWindow._allListeners) {
			  	targetWindow._allListeners = {};
			}
		    targetWindow._allListeners[listenerId] = listenerRecord;
		    
		    // store this listener's ID in target
		    if (!target._listeners) {
			  	target._listeners = [];
			}
			target._listeners[target._listeners.length] = listenerId;
			
			// set up Core._removeAllListeners to clean up all listeners on unload
			if (targetWindow._unloadListenerAdded) {
			  	targetWindow._unloadListenerAdded = true;
			  	targetWindow.attachEvent("onunload", core._removeAllListeners);
			}
		}
	};

	self.removeEventListener = function(target, type, listener) {
		if (document.addEventListener) {
			target.removeEventListener (type, listener, false);
		} else if (document.attachEvent) {
			// find out if the listener was actually added to target
			var listenerIndex = core._findListener (target, type, listener);
			if (listenerIndex == -1) {
				return;
			}
			
			// get a reference to the window object containing target
			var targetDocument = target.document || target;
			var targetWindow = targetDocument.parentWindow;
			
			// obtain the record of the listener from the window object
			var listenerId = target._listeners[listenerIndex];
			var listenerRecord = targetWindow._allListeners[listenerId];
			
			// remove the listener, and remove its ID from target
			target.detachEvent("on" + type, listenerRecord.listener2);
			target._listeners.splice(listenerIndex, 1);
			
			// remove the record of the listener from the window object
			delete targetWindow._allListeners[listenerId];
		}
	};

	self.preventDefault = function(event) {
		if (document.addEventListener) {
			event.preventDefault();
		} else if (document.attachEvent) {
			event.returnValue = false;
		}
	};

	self.stopPropogation = function() {
		if (document.addEventListener) {
			event.stopPropogation();
		} else if (document.attachEvent) {
			event.cancelBubble = true;
		}
	};

	self.removeAllListeners = function() {
		var targetWindow = this;
		
		for (var id in targetWindow._allListeners) {
			var listenerRecord = targetWindow._allListeners[id];
			listenerRecord.target.detachEvent (
				"on" + listenerRecord.type, listenerRecord.listener2);
			delete targetWindow._allListeners[id];
		}
	};

	self.isFunction = function(obj) {
		return !!(obj && obj.constructor && obj.call && obj.apply);
	};

	self.getElementsByClass = function(theClass) {
		var elementArray = [];

		if (typeof document.all !== "undefined") {
			elementArray = document.all;
		} else {
			elementArray = document.getElementsByTagName ("*");
		}

		var matchedArray = [];
		var pattern = new RegExp("(^| )" + theClass + "( |$)");

		for (var i = 0; i < elementArray.length; i++) {
			if (pattern.test(elementArray[i].className)) {
				matchedArray[matchedArray.length] = elementArray[i];
			}
		}
		return matchedArray;
	};

	self.hasClass = function(target, theClass) {
		var pattern = new RegExp("(^| )" + theClass + "( |$)");

		if (target.className === '') {
			return false;
		}

		if (pattern.test(target.className)) {
			return true;
		}

		return false;
	};

	self.addClass = function(target, theClass) {
		if (!self.hasClass(target, theClass)) {
			if (target.className === "") {
				target.className = theClass;
			} else {
				target.className += " " + theClass;
			}
		}
	};

	self.removeClass = function(target, theClass) {
		var pattern = new RegExp("(^| )" + theClass + "( |$)");

		//Using empty string the erase
		target.className = target.className.replace(pattern, "$1");
		//removing extra spaces
		target.className = target.className.replace(/ $/, "");
	};

	self.removeAllClass = function(target) {
		target.className = '';
	};

	self.getStyle = function(target, styleAttribute) {
		return target.currentStyle ?
			target.currentStyle[styleAttribute] :
			document.defaultView.getComputedStyle(target, null).getPropertyValue(styleAttribute);
	};

	var findListener = function (target, type, listener) {
	  	// get the array of listener IDs added to target
	  	var listeners = target._listeners;
	  	if (!listeners) {
		    return -1;
		}
		
		// get a reference to the window object containing target
    	var targetDocument = target.document || target;
	    var targetWindow = targetDocument.parentWindow;
	    
	    // searching backward (to speed up onunload processing), find the listener
	    for (var i = listeners.length - 1; i >= 0; i--) {
		  	// get the listener's ID from target
		  	var listenerId = listeners[i];
		  	
		  	// get the record of the listener from the window object
		  	var listenerRecord = targetWindow._allListeners[listenerId];
		  	 
		  	// compare type and listener with the retrieved record
		  	if (listenerRecord.type == type && listenerRecord.listener == listener) {
				return i;
			}
		}
		return -1;
	};

}(core = window.core || {}));