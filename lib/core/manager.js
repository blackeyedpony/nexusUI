
/** 
  @title NexusUI API
  @overview NexusUI is a JavaScript toolkit for easily creating musical interfaces in web browsers. Interfaces are rendered on HTML5 canvases and are ideal for web audio projects, mobile apps, or for sending OSC to external audio applications like Max.
  @author Ben Taylor, Jesse Allison, Yemin Oh, Sébastien Piquemal
  @copyright &copy; 2011-2014
  @license MIT
 */ 
 

var timingUtils = require('../utils/timing');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var transmit = require('../utils/transmit');


var manager = module.exports = function() {

/** 

  @class nx
  @description Central nexusUI manager with shared utility functions for all nexusUI objects
  
*/

  EventEmitter.apply(this)
  this.widgets = new Object();

  /**  @property {integer} throttlePeriod Throttle time in ms (for nx.throttle). */
  this.throttlePeriod = 20;
  this.elemTypeArr = new Array();
  this.aniItems = new Array();
  /**  @property {boolean} showLabels Whether or not to draw an automatic text label on each interface component. */
  this.showLabels = false;
  this.starttime = new Date().getTime();
  if (transmit) {
    /**  
    @method sendsTo 
    @param {string or function} [destination] Protocol for transmitting data from interfaces (i.e. "js", "ajax", "ios", "max", or "node"). Also accepts custom functions.
    ```js
    nx.sendsTo("ajax")

    // or

    nx.sendsTo(function(data) {
         //define a custom transmission function
    })
    ```
    */
    this.sendsTo = transmit.setGlobalTransmit;
    /**  
    @method setAjaxPath 
    @param {string} [path] If sending via AJAX, define the path to ajax destination
    */
    this.setAjaxPath = transmit.setAjaxPath;
    /**  @property {string} destination NexusUI's transmission protocol (i.e. "js" or "ajax"). Defaults to "js". We recommend setting this property using nx.sendsTo() which ensures that all widgets receive this setting. */
    this.destination = "js";
    /**  @property {string} ajaxPath If sending via AJAX, the destination path. Defaults to "lib/nexusOSCRelay.php". We recommend setting this property using nx.setAjaxPath() which ensures that all widgets receive this setting. */
    this.ajaxPath = "lib/nexusOSCRelay.php";
  }

  /** @property {boolean} isTouchDevice Returns true if page is loaded on a touch device. */
  this.isTouchDevice = ('ontouchstart' in document.documentElement)? true:false;
  this.metas = document.getElementsByTagName('meta');

  /**  @property {boolean} globalWidgets Whether or not to instantiate a global variable for each widget (i.e. button1). Defaults to true. Designers of other softwares who wish to keep nexusUI entirely encapsulated in the nx object may set this property to false. In that case, all widgets are accessible in nx.widgets */
  this.globalWidgets = true;

  this.font = "gill sans";
  this.fontSize = 14;
  this.fontWeight = "bold";
}

util.inherits(manager, EventEmitter)


/** 
  @method add 
  Adds a NexusUI element to the webpage. This will create an HTML5 canvas and draw the interface on it.
  @param {string} [type] NexusUI widget type (i.e. "dial").
  @param {object} [settings] (Optional.) Extra settings for the new widget. This settings object may have any of the following properties: x (integer in px), y, w (width), h (height), name (widget's OSC name and canvas ID), parent (the ID of the element you wish to add the canvas into). If no settings are provided, the element will be at default size and appended to the body of the HTML document.
  */
manager.prototype.add = function(type, args) {
  //args may have optional properties: x, y, w, h, name, parent

  if(type) {
      var canv = document.createElement("canvas");
      canv.setAttribute('nx', type);
      if (args) {
        if (args.x || args.y) {
           canv.style.position = "absolute";
        }
        if (args.x) {
           canv.style.left = args.x + "px";
        }
        if (args.y) {
           canv.style.top = args.y + "px";
        }
        if (args.w) {
           canv.style.width = args.w;
           canv.width = args.w;
        }
        if (args.h) {
           canv.style.height = args.h;
           canv.height = args.h;
        }
        if (args.parent) {
          var parent;
          if (typeof args.parent === "string") {
            parent = document.getElementById(args.parent);
          } else if (args.parent instanceof HTMLElement){
            parent = args.parent;
          } else if (args.parent instanceof jQuery){
            parent = args.parent[0];            
          }
        }
        if (args.name) {
           canv.id = args.name
        }
      }
      if (!parent) {
        var parent = document.body
      }
      parent.appendChild(canv);
      return this.transform(canv);
  }
}

/** @method transform 
Transform an existing canvas into a NexusUI widget.
@param {string} [canvasID] The ID of the canvas to be transformed.
@param {string} [type] (Optional.) Specify which type of widget the canvas will become. If no type is given, the canvas must have an nx attribute with a valid widget type.
*/
manager.prototype.transform = function(canvas, type) {
  for (var key in nx.widgets) {
    if (nx.widgets[key].canvasID == canvas.id) {
      return;
    }
  }
  if (type) {
    var nxType = type;
  } else {
    var nxType = canvas.getAttribute("nx");
  }

  if (!nxType) {
    return;
  }
  var elemCount = 0;
  var newObj;

  /* find out how many of the same elem type have come before
    i.e. nx.elemTypeArr will look like [ dial, dial, toggle, toggle ]
    allowing you to count how many dials already exist on the page
    and give your new dial the appropriate index and id: dial3 */

  for (j=0;j<this.elemTypeArr.length;j++) {
    if (this.elemTypeArr[j] === nxType) {
      elemCount++;
    }
  }

  // add your new nexus element type to the element list
  this.elemTypeArr.push(nxType);

  // check to see if it has a pre-given ID
  // and use that as its id if so
  if (!canvas.id) {
    var idNum = elemCount + 1;
    canvas.id = nxType + idNum;
  }

  if(nxType) {
    try {
      var newObj = new (require('../widgets')[nxType])(canvas.id);
    } catch (err) {
      console.log(nxType);
    }
  }

  this.widgets[newObj.canvasID] = newObj;
  if (this.globalWidgets) {
    window[newObj.canvasID] = this.widgets[newObj.canvasID]
  }

  newObj.init();
  return newObj;
}

/** @method transmit 
The "output" instructions for sending a widget's data to another application or to a JS callback. Inherited by each widget and executed when each widget is interacted with or its value changes. Set using nx.sendsTo() to ensure that all widgets inherit the new function correctly.
@param {object} [data] The data to be transmitted. Each property of the object will become its own OSC message. (This works with objects nested to up to 2 levels).
*/

manager.prototype.transmit = function(data) {
    this.makeOSC(this.emit, data);
    this.emit('*',data);
} 

/** 
  @method colorize
  @param {string} [aspect] Which part of ui to change, i.e. "accent" "fill", "border"
  @param {string} [color] Hex or rgb color code
  Change the color of all nexus objects, by aspect ([fill, accent, border, accentborder]
  
  ```js
  nx.colorize("#00ff00") // changes the accent color by default
  nx.colorize("border", "#000000") // changes the border color
  ```

**/
manager.prototype.colorize = function(aspect, newCol) {
  
  if (!newCol) {
    // just sending in a color value colorizes the accent
    newCol = aspect;
    aspect = "accent";
  }
  
  this.colors[aspect] = newCol;
  
  for (var key in this.widgets) {
    this.widgets[key].colors[aspect] = newCol;
    this.widgets[key].draw();
  }
}
  

/** @method setThrottlePeriod 
Set throttle time of nx.throttle, which controls rapid network transmissions of widget data.
@param {integer} [throttle time] Throttle time in milliseconds. 
*/
manager.prototype.setThrottlePeriod = function(newThrottle) {
  this.throttlePeriod = newThrottle;
  for (var key in this.widgets) {
    this.widgets[key].throttlePeriod = this.throttlePeriod;
  }
}



  /*  
   *    GUI
   */

/**  @property {object} colors The interface's color settings. Set with nx.colorize(). */
manager.prototype.colors = { 
  "accent": "#ff5500", 
  "fill": "#eee", 
  "border": "#bbb",
  "black": "#000",
  "white": "#FFF"
};
  
/**  @method startPulse 
  Start an animation interval for animated widgets (calls nx.pulse() every 30 ms). Executed by default when NexusUI loads.
*/
manager.prototype.startPulse = function() {
  this.pulseInt = setInterval("nx.pulse()", 30);
}

/**  @method stopPulse 
  Stop the animation pulse interval.
*/
manager.prototype.stopPulse = function() {
  clearInterval(this.pulseInt);
}

/**  @method pulse 
  Animation pulse which executes all functions stored in the nx.aniItems array.
*/
manager.prototype.pulse = function() {
  for (var i=0;i<this.aniItems.length;i++) {
    this.aniItems[i]();
  }
} 

manager.prototype.addAni = function(fn) {

}

manager.prototype.removeAni = function(fn) {
  this.aniItems.splice(this.aniItems.indexOf(fn));
}
  
manager.prototype.addStylesheet = function() {
  var htmlstr = '<style>'
    + 'select {'
    + 'width: 150px;'
    + 'padding: 5px 5px;'
    + 'font-size: 16px;'
    + 'color:#666666;'
    + 'border: solid 0px #CCC;'
    + 'border-radius: 5;'
    + 'outline: black;'
    + 'cursor:pointer;'
    + 'background-color:#EEE;'
    + 'font-family:gill sans;'
    + '}'
    + ''
    + 'canvas { '
    + 'cursor:pointer;'
    + 'border-radius:5px;'
    + 'moz-border-radius:5px;'
    + 'webkit-border-radius:5px;'
    + 'box-sizing:border-box;'
    + '-moz-box-sizing:border-box;'
    + '-webkit-box-sizing:border-box;'
    + '}'
    + '</style>';

  document.head.innerHTML = document.head.innerHTML + htmlstr
}

/**  @method setViewport
    Set mobile viewport scale (similar to a zoom)
    @param {integer} [scale] Zoom ratio (i.e. 0.5, 1, 2) */
manager.prototype.setViewport = function(scale) {
  for (i=0; i<this.metas.length; i++) {
    if (this.metas[i].name == "viewport") {
      this.metas[i].content = "minimum-scale="+scale+", maximum-scale="+scale;
    }
  }
}

/**  @method setLabels
    Tell all widgets whether or not draw text labels on widgets
    @param {boolean} [on/off] true to add labels, false to remove labels
 */
manager.prototype.setLabels = function(onoff) {
  if (onoff=="on") {
    this.showLabels = true;
  } else {
    this.showLabels = false;
  }
  for (var key in this.widgets) {
    this.widgets[key].draw()
  }
}

manager.prototype.setProp = function(prop,val) {
  if (prop && val) {
    nx[prop] = val;
    for (var key in this.widgets) {
      this.widgets[key][prop] = val;
      this.widgets[key].draw()
    } 
  }
}

manager.prototype.blockMove = function(e) {
  if (e.target.tagName == 'CANVAS') {
     e.preventDefault();
     e.stopPropogation();
  }
}