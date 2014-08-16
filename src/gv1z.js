/*
 Gv1z - Graph Visualization Engine

 by Matthias Ladkau (matthias@devt.de)

 A simple graph visualization engine.

 -------
The MIT License (MIT)

Copyright (c) 2013 Matthias Ladkau

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE
 -------
*/

if (gv === undefined) {
    var gv = {};
}

// Utility functions
// =================
gv.$ = function(id) { "use strict"; return document.getElementById(id); };
gv.create = function(tag) { "use strict"; return document.createElement(tag); };
gv.copyObject = function (o1, o2) {
    "use strict";
    for (var attr in o1) {
        o2[attr] = o1[attr];
    }
};
gv.bind = function () {
    "use strict";
    var f = arguments[0],
        t = Array.prototype.slice.call(arguments, 1),
        a = t.splice(1);
    return function() {
        return f.apply(t[0],
                       a.concat(Array.prototype.slice.call(arguments, 0)));
    };
};
gv.timedLoop = function (func, steps, steptime) {
    "use strict";
    var loopbody = function (loopbody, func, step, steps, steptime) {
        func(step);
        if (step < steps) {
            window.setTimeout(gv.bind(loopbody, this, loopbody, func,
                                      step + 1, steps, steptime),
                              steptime);
        }
    };
    window.setTimeout(gv.bind(loopbody, this, loopbody,
                              func, 1, steps, steptime),
                      steptime);
};

// Calculate delta for mouse wheel events
//
// Based on: http://adomas.org/javascript-mouse-wheel/ (adomas.paltanavicius@gmail.com)
//       and http://www.ogonek.net/mousewheel/demo.html (themonnie@gmail.com)
//
gv.calculateWheelDelta = function (event) {
    "use strict";
    var scroll = 0;
    // Get the event
    if (!event) {
        event = window.event;
    }
    // Check for wheelDelta
    if (event.wheelDelta) {
        scroll = event.wheelDelta / 120;
        // Negate if we are in opera
        if (window.opera) {
            scroll = -scroll;
        }
    }
    // For Firefox
    else if (event.detail) {
        scroll = -event.detail / 3;
    }

    // Stop the event
    if (event) {
        gv.stopBubbleEvent(event);
    }

    return Math.round(scroll); //Safari Round
};

// Get the point of a mouse event.
//
// event   - Mouse event.
// element - Element where the click point should be calculated.
//           The point will be relative to the element's position.
//           If undefined then the click point is absolute on the document.
//
gv.calculateClickPoint = function (event, element) {
    "use strict";

    if (event._gv_cp !== undefined) {
        return event._gv_cp;
    }

    var docElement = document.documentElement,
        body = document.body || { scrollLeft: 0, scrollTop: 0 },
        getX = function () {
          return event.pageX || (event.clientX +
                 (docElement.scrollLeft || body.scrollLeft) -
                 (docElement.clientLeft || 0));
        },
        getY = function () {
          return  event.pageY || (event.clientY +
                  (docElement.scrollTop || body.scrollTop) -
                  (docElement.clientTop || 0));
        },
        getOffset = function (element) {
            var top = 0,
                left = 0;

            if (element.parentNode) {

              while(element !== null) {

                top  += element.offsetTop  || 0;
                left += element.offsetLeft || 0;
                element = element.offsetParent;
              }
            }

            return {
                left : left,
                top  : top
            };
        },
        cp;

    if (!element) {
        cp = {
            x : getX(),
            y : getY()
        };
    } else {
        var offset = getOffset(element);

        cp = {
            x : getX() - offset.left,
            y : getY() - offset.top
        };
    }

    event._gv_cp = cp;

    return cp;
};

// Stop the bubbling of an event
//
gv.stopBubbleEvent = function (event) {
    "use strict";
    event = event ? event : window.event;
    if (event.stopPropagation) {
        event.stopPropagation();
    }
    if (event.cancelBubble !== null) {
        event.cancelBubble = true;
    }
};


// Class implementation
// ====================
// Class objects with constructor and multi-inheritance support.
//
// Based on: Simple JavaScript Inheritance by John Resig
// http://ejohn.org/blog/simple-javascript-inheritance/
//
// Inspired by base2 and Prototype
//
gv.Class = function() {};
(function(){

    // Pattern which checks if a given function uses the function _super - this test
    // returns always true if toString on a function does not return the function code
    var functionUsesSuper = /abc/.test(function () { abc(); }) ? /\b_super\b/ : /.*/;

    // Flag which is used to detect if we are currently initialising
    var initializing = false;

    // Add create function to the new class object
    gv.Class.create = function() {

        // Get the current prototype as the super prototype of the new class
        var _super = this.prototype;

        // Clone the current class object (without running the init constructor function)
        initializing = true;
        var prototype = new this();
        initializing = false;

        // Go through all given mixin objects. Each object should be either
        // a normal properties object or a constructor function.
        for (var i = 0; i < arguments.length; i++) {
            var properties = arguments[i];

            // Check if the given mixin is a constructor funtion
            if (typeof properties === "function") {
                // Use the prototype as properties
                properties = properties.prototype;
            }

            // Copy the given properties to the cloned class object
            for (var name in properties) {

                // Check if we're overwriting an existing function and if the new function uses
                // it by calling _super
                if (typeof properties[name] == "function" &&
                    typeof _super[name] == "function" &&
                    functionUsesSuper.test(properties[name])) {

                    // If _super is called we need to wrap the given function
                    // in a closure and provide the right environment
                    prototype[name] = (
                        function(name, func, _super) {
                            return function() {
                                var t, ret;
                                // Save the current value in _super
                                t = this._super;
                                // Add the function from the current class object as _super function
                                this._super = _super[name];
                                // Run the function which calls _super
                                ret = func.apply(this, arguments);
                                // Restore the old value in _super
                                this._super = t;
                                // Return the result
                                return ret;
                            };
                        }
                    )(name, properties[name], _super);

                } else {

                    prototype[name] = properties[name];
                }
            }

            // Once the mixin is added it becomes the new super class
            // so we can have this._super call chains
            _super = properties;
        }

        // Defining a constructor function which is used to call the constructor function init on objects
        var Class = function () {
          if ( !initializing && this.init ) {
            this.init.apply(this, arguments);
          }
        };

        // Put our constructed prototype object in place
        Class.prototype = prototype;

        // Constructor of the new object should be Class
        // (this must be done AFTER the prototype was assigned)
        Class.prototype.constructor = Class;

        // The current function becomes the create function
        // on the new object
        Class.create = arguments.callee;

        return Class;
    };
})();

// Model Classes
// =============

gv.Point = gv.Class.create({

    init : function (x, y) {
        "use strict";
        this.x = x;
        this.y = y;
    }
});

// Abstract class for a node.
//
gv.AbstractNode = gv.Class.create({

    // Constructor for a node.
    //
    // id    -  Unique ID of the node.
    // point -  Middle point of the node.
    // width -  Width of the node.
    // height - height of the node.
    //
    init : function (id, point, width, height) {
        "use strict";

        // Set main node attributes
        if (point === undefined) {
            point = new gv.Point(0,0);
        }
        this.x = point.x;
        this.y = point.y;
        this._newX = point.x;
        this._newY = point.y;

        if (width === undefined) {
            width = 1;
        }
        this.width = width;

        if (height === undefined) {
            height = 1;
        }
        this.height = height;

        // Each node must have a unique identifier
        // This id is either given as parameter or automatically generated
        if (id === undefined) {
            // If no id is given we generate one
            if (gv._nodeIndex === undefined) {
                gv._nodeIndex = 0;
            }
            id = gv._nodeIndex;
            gv._nodeIndex++;
        }
        this.id = id;

        // Read only attribute which is automatically
        // updated by the rendering engine.
        this.visible = false;

        // Automatically filled by the edges when they are defined.
        // This is only used by some layout algorithms - not by the
        // MainController.
        this.edges = [];
    },

    // Notification function which is called if this.edges has changed.
    //
    notifyEdgesChanged : function () {
    },

    // Set the position of this node (immediately) to a specific point.
    // This function should only be called by the view controller.
    // External algorithms which want to move nodes should use movePosition.
    _setPosition : function (point) {
        "use strict";
        this.x = point.x;
        this.y = point.y;
        this._newX = point.x;
        this._newY = point.y;
    },

    getPosition : function () {
        "use strict";
        return {
            x : this.x,
            y : this.y
        };
    },

    getNewPosition : function () {
        "use strict";
        return {
            x : this._newX,
            y : this._newY
        };
    },

    getDimension : function () {
        "use strict";
        return {
            width  : this.width,
            height : this.height
        };
    },

    // Move the node to a specific position.
    //
    movePosition : function (point) {
        "use strict";
        this._newX = point.x;
        this._newY = point.y;
    },

    // Check if this node is moving
    //
    // Returns either undefined if the node is not moving or
    // the new coordinates if it is moving.
    checkMoving : function () {
        "use strict";
        if (this._newX !== this.x ||
            this._newY !== this.y) {

            return {
                x : this._newX,
                y : this._newY
            };
        }
        return undefined;
    },

    // Check if this node is visible
    //
    isVisible : function (canvasPoint, canvasWidth, canvasHeight,
                          state) {
        "use strict";
        var v = {
                x : (state.viewX - this.x) * state.zoom,
                y : (state.viewY - this.y) * state.zoom
            },
            dist = Math.sqrt(v.x * v.x + v.y * v.y);

        return dist < Math.max(canvasWidth, canvasHeight);
    },

    // Draw the node given the canvas, its coordinates (middle of shape)
    // and the current zoom level
    //
    // canvasContext - Canvas context to draw on
    // canvasPoint   - Point on the canvas where the node should be drawn
    //                 (middle point).
    // canvasZoom    - Zoom factor with which the node should be drawn
    draw : function (canvasContext, canvasPoint, canvasZoom) {
        "use strict";
    }
});

// Abstract class for a node association.
//
gv.AbstractNodeAssociation =  gv.Class.create({

    // Constructor for a node.
    //
    // nodes - Nodes which should be associated with this association.
    //
    init : function (nodes) {
        "use strict";

        this._nodes = nodes;

        // Read only attribute which is automatically
        // updated by the rendering engine.
        this.visible = false;

        for (var i=0;i<nodes.length;i++) {
            nodes[i].edges.push(this);
        }
    },

    // Check if this association is visible
    //
    isVisible : function (canvasPoints, canvasWidth, canvasHeight,
                          state) {
        "use strict";
        return true;
    },

    // Draw the node association given the canvas, the coordinates
    // of its nodes (middle of shape) and the current zoom level
    //
    // canvasContext - Canvas context to draw on
    // canvasPoints  - Points on the canvas of all associated nodes
    //                 (middle point).
    // canvasZoom    - Zoom factor with which the node should be drawn
    //
    draw : function (canvasContext, canvasPoints, canvasZoom) {
    }
});

gv.SimpleNode = gv.AbstractNode.create({

    init : function (id, point, width, height, getLabelFunc) {
        "use strict";

        // Default value
        this.color    = "#000000";
        this.fontsize = 10;
        this.fontpadding = 5;
        if (width === undefined) {
            width = 10;
        }
        if (height === undefined) {
            height = 10;
        }

        if (getLabelFunc !== undefined) {
            this.getLabel = getLabelFunc;
        } else {
            this.getLabel = function () {
                return this.id;
            }
        }

        // Add height for text
        this._super(id, point, width, height);
    },

    // Get all neighbour nodes (ignores recursive edges)
    getNeighbours : function () {
        "use strict";
        var nodes = [];
        for (var i=0; i<this.edges.length; i++) {
            var otherEnd = this.edges[i].getOtherEnd(this);
            // Ignore recursive edges
            if (otherEnd !== this) {
                nodes.push(otherEnd);
            }
        }
        return nodes;
    },

    draw : function (canvasContext, canvasPoint, canvasZoom) {
        "use strict";
        var w = this.width  * canvasZoom,
            h = this.height * canvasZoom;

        canvasContext.fillStyle = this.color;

        // Draw node
        canvasContext.fillRect(canvasPoint.x - w / 2,
                               canvasPoint.y - h / 2,
                               w,
                               h);

        // Do not draw text on high zoom levels since
        // it takes a lot of time and is not readable
        // anyway.
        if (canvasZoom < 0.5) {
            return;
        }

        this._drawLabel(canvasContext, canvasPoint, canvasZoom, this.getLabel(), 20);
    },

    _drawLabel : function (canvasContext, canvasPoint, canvasZoom, label, splitCharacters) {
        "use strict";

        var labelLines,
            th = (this.fontsize * canvasZoom) * 0.48;

        splitCharacters = splitCharacters === undefined ? 20 : splitCharacters;
        if (splitCharacters > 0) {
            labelLines = this._splitLine(label, splitCharacters);
        } else {
            labelLines = [ label ];
        }

        // Draw label
        canvasContext.font = th  + "pt Arial";
        canvasContext.fillStyle = "#222222";

        for (var i = 0; i < labelLines.length; i++) {
            var tw = canvasContext.measureText(labelLines[i]).width;
            canvasContext.fillText(
                labelLines[i],
                canvasPoint.x - (tw / 2),
                canvasPoint.y + (this.height * canvasZoom / 2) +
                6 * canvasZoom +
                (th + 5) * i);
        }
    },

    _splitLine : function (line, split) {
        "use strict";

        var lines = [],
            currentline = "";

        for (var i=0; i < line.length; i++) {
            var c = line.charAt(i);
            if (c === ' ' && currentline.length > split) {
                lines.push(currentline);
                currentline = "";
            } else {
                currentline += c;
            }
        }
        if (currentline.length > 0) {
            lines.push(currentline);
        }

        return lines;
    }
});

// Dummy node which may be used to draw long edges.
//
gv.SimpleDummyNode = gv.SimpleNode.create({

    init : function (id, point) {
        "use strict";

        this._super(id, point, 5, 5);
        this.color    = "#555555";
    },

    draw : function (canvasContext, canvasPoint, canvasZoom) {
        "use strict";
        var w = this.width  * canvasZoom,
            h = this.height * canvasZoom;

        canvasContext.fillStyle = this.color;

        // Draw node
        canvasContext.fillRect(canvasPoint.x - w / 2,
                               canvasPoint.y - h / 2,
                               w,
                               h);
    }
});

gv.SimpleEdge = gv.AbstractNodeAssociation.create({

    init : function (node1, node2, bend) {
        "use strict";
        this._super([node1, node2]);

        // Flag if the edge line should be bend.
        // This helps to avoid placing nodes on
        // non-related edges in grid based layouts.
        this.bend = bend === undefined ? false : bend;
    },

    // Get one end of this edge.
    //
    getEnd1 : function () {
        "use strict";
        return this._nodes[0];
    },

    // Get one end of this edge.
    //
    getEnd2 : function () {
        "use strict";
        return this._nodes[1];
    },

    // Get the other end from a given end.
    //
    getOtherEnd : function (node) {
        "use strict";
        if (this._nodes[0] === node) {
            return this._nodes[1];
        } else if (this._nodes[1] === node) {
            return this._nodes[0];
        }
        return undefined;
    },

    // Check if this edge is visible
    //
    isVisible : function (canvasPoints, canvasWidth, canvasHeight,
                          state) {
        "use strict";

        // If one of the end points if visible then the edge is
        // definitely visible
        if (this._nodes[0].isVisible(canvasPoints[0], canvasWidth,
                                     canvasHeight, state) ||
            this._nodes[1].isVisible(canvasPoints[1], canvasWidth,
                                     canvasHeight, state)) {
            return true;
        }

        // Calculate vectors and lengths view to edge and edge.
        var viewToEnd1 = {
            x : state.viewX - this._nodes[0].x,
            y : state.viewY - this._nodes[0].y
        },
        lenViewToEnd1 = Math.sqrt(viewToEnd1.x * viewToEnd1.x +
                                  viewToEnd1.y * viewToEnd1.y),
        viewToEnd2 = {
            x : state.viewX - this._nodes[1].x,
            y : state.viewY - this._nodes[1].y
        },
        lenViewToEnd2 = Math.sqrt(viewToEnd2.x * viewToEnd2.x +
                                  viewToEnd2.y * viewToEnd2.y),
        end1ToEnd2 = {
            x : this._nodes[1].x - this._nodes[0].x,
            y : this._nodes[1].y - this._nodes[0].y
        },
        lenEnd1ToEnd2 = Math.sqrt(end1ToEnd2.x * end1ToEnd2.x +
                                  end1ToEnd2.y * end1ToEnd2.y);

        // Use scalar product of view to end1 and edge
        // to get the distance from view to edge.

        // Calculate scalar product
        var sp = end1ToEnd2.x * viewToEnd1.x +
                 end1ToEnd2.y * viewToEnd1.y;
        // Extract the angle
        sp /= lenEnd1ToEnd2;
        sp /= lenViewToEnd1;
        var alpha = Math.acos(sp);
        // Get the distance (assumes the edge has no ends)
        var dist = Math.sin(alpha) * lenViewToEnd1;

        // Use simple pytagoras to calculate if the view
        // is next to the edge or if the edge bounds are
        // far away.
        var ds = dist * dist,
            p = Math.sqrt(lenViewToEnd1 * lenViewToEnd1 - ds),
            q = Math.sqrt(lenViewToEnd2 * lenViewToEnd2 - ds),
            edgeIsNextToView = p < lenEnd1ToEnd2 && q < lenEnd1ToEnd2;

        // Draw the edge if it is next to the view and it is in a
        // visible distance
        return edgeIsNextToView &&
               dist * state.zoom < Math.max(canvasWidth, canvasHeight);
    },

    // Draw the edge given the canvas, the coordinates
    // of its nodes (middle of shape) and the current zoom level
    //
    // canvasContext - Canvas context to draw on
    // canvasPoints  - Points on the canvas of all associated nodes
    //                 (middle point).
    // canvasZoom    - Zoom factor with which the node should be drawn
    //
    draw : function (canvasContext, canvasPoints, canvasZoom) {
        "use strict";
        var lw;

        canvasContext.strokeStyle = "#777777";

        // Set line width
        // (don't use save/restore for better performance)
        if (canvasContext.lineWidth !== 1.5 * canvasZoom) {
            lw = canvasContext.lineWidth;
            canvasContext.lineWidth = 1.5 * canvasZoom;
        }

        // Draw the line
        canvasContext.beginPath();
        canvasContext.moveTo(canvasPoints[0].x, canvasPoints[0].y);

        if (this.bend) {
            var v = {
                    x : canvasPoints[0].x - canvasPoints[1].x,
                    y : canvasPoints[0].y - canvasPoints[1].y
                },
                c = {
                    x : canvasPoints[1].x + v.x / 2,
                    y : canvasPoints[1].y + v.y / 2
                },
                vlen = Math.sqrt(v.x * v.x + v.y * v.y);

            canvasContext.quadraticCurveTo(c.x + (v.y / vlen) * 25,
                                           c.y + (v.x / vlen) * 25,
                                           canvasPoints[1].x,
                                           canvasPoints[1].y);
        } else {

            canvasContext.lineTo(canvasPoints[1].x, canvasPoints[1].y);
        }

        canvasContext.stroke();

        // Reset line width
        if (lw !== undefined) {
            lw = canvasContext.lineWidth;
        }
    }
});

// Handler functions
// =================

// Default event handler
//
gv.default_eventHandler = {

    // Handle mouse wheel events
    //
    eventMouseWheel : function (event) {
        "use strict";
        event = event || window.event;
        var delta = gv.calculateWheelDelta(event);
        delta = (delta / 10) * 8;
        this.changeZoom(delta);
        event.preventDefault();
    },

    // Handle mouse click events
    //
    eventMouseClick : function (event) {
        "use strict";
        event = event || window.event;

        // Check for a click on a scrollbar
        if (this._handleScrollBarClick(event, true) === true) {
            // Ignore click event (event is handled by mouse up and down handlers)
            return;
        }
        // Check for a click on the zoombar
        if (this._handleZoomBarClick(event, true) === true) {
            // Ignore click event (event is handled by mouse up and down handlers)
            return;
        }
        // Check for click on an icon
        if (this._handleIconClick(event) === true) {
            return;
        }

        // Check for double-click (two clicks within 400 ms)
        if (this._event_prevClick !== true) {
            window.setTimeout(function () {
                if (this._event_prevClick === true) {
                    this._event_prevClick = undefined;
                }
            }.bind(this), 400);
            this._event_prevClick = true;
        } else {
            // Handle double click
            var p = gv.calculateClickPoint(event, this._screen);
            this.moveView(this._translateCanvasPointToModelPoint(p));
            this._event_prevClick = undefined;
        }
    },
    eventMouseUp   : function (event) {
        "use strict";
        // Check if a scrollbar action has ended
        if (this._handleScrollBarRelease() === true) {
            return true;
        }

        // Check if a zoombar action has ended
        if (this._handleZoomBarRelease() === true) {
            return true;
        }

        // Handle general mouse up
        if (this._handleMouseUp(event) === true) {
            return true;
        }
    },
    eventMouseDown : function (event) {
        "use strict";
        // Handle scroll bar clicks
        if (this._handleScrollBarClick(event) === true) {
            return true;
        }

        // Handle zoom bar clicks
        if (this._handleZoomBarClick(event) === true) {
            return true;
        }

        // Handle general mouse down
        if (this._handleMouseDown(event) === true) {
            return true;
        }
    },

    eventMouseMove : function (event) {
        "use strict";

        // Handle move of the scrollbar
        if (this._handleScrollBarMove(event) === true) {
            return true;
        }

        // Handle move of the zoom bar
        if (this._handleZoomBarMove(event) === true) {
            return true;
        }

        // Handle general mouse move
        if (this._handleMouseMove(event) === true) {
            return true;
        }

        this._checkControlHover(event);
    },

    // Handle key events
    //
    eventKeyDown : function (event) {
        "use strict";
        event = event || window.event;
        switch (event.keyCode) {
            // Put key handling code here ...
            // case 32: console.log("doit"); break;
        }
    }
};

// Default event handler for overview
//
gv.default_overview_eventHandler = {

    eventMouseUp   : function (event) {
        "use strict";
        this._mouse_dragging = undefined;
    },
    eventMouseDown : function (event) {
        "use strict";
        var p = gv.calculateClickPoint(event, this._screen);
        this._options.parentView.setView(this._translateCanvasPointToModelPoint(p));
        this._mouse_dragging = true;
    },
    eventMouseMove : function (event) {
        "use strict";
        if (this._mouse_dragging !== undefined) {
            var p = gv.calculateClickPoint(event, this._screen);
            this._options.parentView.setView(this._translateCanvasPointToModelPoint(p));
        }
    }
};

// Images for icons
// ================

gv.images = {
        pan     : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAQAAAD8x0bcAAAAAmJLR0" +
                  "QA/4ePzL8AAAAJcEhZcwAADsQAAA7EAZUrDhsAAAAHdElNRQfeBA0KHiwIBH8IAAAAvklEQVQoz5" +
                  "2SMQ6CMBSGP4zpxCF6DMPk6MRAOAY7HsCBkYGJidHBAzAymd5ER11d6kDFB7Qx8W/SNO/9/d/f1x" +
                  "dZy09sloGefkWKPkoG2GHQwIACsqWSQaMxLqhISGiWpIfHiQJaSTowANqlX25vSKmArbw3PytSWa" +
                  "6lJeM6aSVCLx6VGnLgvPKUA3CXfdp729hxGkkFlyAt/noq6AIf8gT5Oh9qKtmnoysZgJ1Q2ttslV" +
                  "NGTEFFHRCK/ponH95xy0SZbhbE3wAAAABJRU5ErkJggg==",
        select  : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAQAAAD8x0bcAAAAAmJLR0" +
                  "QA/4ePzL8AAAAJcEhZcwAADsQAAA7EAZUrDhsAAAAHdElNRQfeBA0KHgutDspjAAAAgUlEQVQoz2" +
                  "P8/5+BIGBiYCBJ0QHiTNpBjCIFHMqQFP1gYGBQYFhGjMONGCbjU/QOSrtiKMMaBOjKcISTK0MrIU" +
                  "W7GXYz8CEpY0FIvYUqcGVgYMjFZ91uqGWluBXtZshlyGVYiz+cEJYko5r1Hwso+X/9fwkSH0cQzG" +
                  "XoRuIxEpPoAD6DOX/QbmPnAAAAAElFTkSuQmCC",
        fit_all : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAQAAAD8x0bcAAAAAmJLR0" +
                  "QA/4ePzL8AAAAJcEhZcwAADsQAAA7EAZUrDhsAAAAHdElNRQfeBA0KIA6coSWRAAAAXUlEQVQoz2" +
                  "P8/5+BIGBiIAKwMDAwMMxiYGBgYEhDk0IS/f////+Z/3EBiAxR1jGiOvwIlLbB7fAjWFhoilAljp" +
                  "AaBDRRhOojG1wm2eDQQL0QZ0FEJvYIxhItFAQBAIpeVNbb1TglAAAAAElFTkSuQmCC",
        zoom    : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAQAAAD8x0bcAAAAAmJLR0" +
                  "QA/4ePzL8AAAAJcEhZcwAADsQAAA7EAZUrDhsAAAAHdElNRQfeBA0KHwwqcW6BAAAAy0lEQVQoz5" +
                  "3SMUoDQRTG8V9MYCFrs1gIi9jbpgiewMt4hZR7BS9h5QXstdNKWULsUmZjsWhEXIuMYZllo/gVM4" +
                  "/Hn/c9vplB0/hVB/6g0U9RhnuNaQQNtnaloSy0FlYuulBp6LbVnETYCN6d4FyK2p3MS3fxDwhIik" +
                  "TThb5AvTvH1n0RpOowr5J0I6gsaK0+D1OjCG7kjmQqzL0aezCLIa692UhsfDo08eRREUNtFU7llu" +
                  "5d9UPMHDvbYT0PXHi2lO+z2+qS/Xb/+E/fcJZAueAkgf8AAAAASUVORK5CYII="
};

// Constants
// =========

// Operation modes for controller
//
gv.mode = {
    NAVIGATION : 0,
    DRAGGING   : 1,
    ZOOM       : 2
};

// Model update event types
//
gv.modelupdate = {
    NODE_MOVE        : 0,
    NEW_MODEL_BOUNDS : 1
};

// Default Options
// ===============

gv.default_options = {

    // Handler functions (registered on MainController construction
    // with "this" pointing at the MainController object)
    // =============================================================
    eventHandler         : gv.default_eventHandler,
    eventHandlerOverview : gv.default_overview_eventHandler,

    // Draw handler is called after each draw
    drawHandler   : function (canvas, canvasWidth, canvasHeight, state) {},

    // Event listener functions
    // ========================

    // Model change events (first parameter is the type,
    // second parameter is data related to the event type)
    modelChangeListeners : [],

    // Rendering options
    // =================

    // Show scrollbars / zoombar / icons
    scrollbars    : true,
    zoombar       : true,
    icons         : true,

    // Screen rendering resolution
    screenWidth   : 640,
    screenHeight  : 400,

    overviewScreenWidth  : 320,
    overviewScreenHeight : 200,

    // Constant rate for moving
    moveRate       : 30,

    // Drawing more than 10000 edges at a time
    // does not show anything useful
    maxVisibleEdges : 10000,

    // Move speed for objects
    moveSpeed     : 30,

    // Initial view position
    defaultViewX  : 0,
    defaultViewY  : 0,
    defaultZoom   : 1,

    // Initial mode of operation
    initialMode   : gv.mode.NAVIGATION
};

// Layouts can register their options here
gv.default_layout_options = {};

// Main Controller
// ===============

gv.MainController = gv.Class.create({

    // Constants
    TWO_PI   : Math.PI * 2,

    // Main attributes
    _screen   : undefined,
    _ctx      : undefined,
    _options  : undefined,
    _debug    : undefined,

    // Dimensions of the actual graph drawing area
    viewWidth    : undefined,
    viewHeight   : undefined,

    // Mode of operation
    mode         : undefined,

    // Runtime state
    _state   : undefined,

    // Images
    _img_pan     : undefined,
    _img_select  : undefined,
    _img_fit_all : undefined,
    _img_zoom    : undefined,

    // Initialise the controller.
    //
    // screen_id            - Id of main screen element (this should be a canvas).
    // options              - Options for the controller.
    // debug_output_element - Element which should display debug output
    //                        (may be undefined).
    //
    init : function(screen_id, options, debug_output_element) {
        "use strict";

        // Initialise essential runtime variables
        this.running   = true;
        this._state    = {};
        this._options  = {};
        this._lastMouseDownPos = {};
        this._selectedNodes = [];
        this._internalModelChangeListeners = [];
        this._internalStopListeners = [];
        this.console = {
            _text   : [],
            setText : gv.bind(function (text) {
                this.console._text = String(text).split("\n");
            }, this),
            reset   : gv.bind(function (text) {
                this.console._text = [];
            }, this)
        };

        // Load images
        this._img_pan           = new Image();
        this._img_pan.src       = gv.images.pan;
        this._img_pan_hover     = false;
        this._img_select        = new Image();
        this._img_select.src    = gv.images.select;
        this._img_select_hover  = false;
        this._img_fit_all       = new Image();
        this._img_fit_all.src   = gv.images.fit_all;
        this._img_fit_all_hover = false;
        this._img_zoom          = new Image();
        this._img_zoom.src      = gv.images.zoom;
        this._img_zoom_hover    = false;

        // Get screen and context
        this._screen = gv.$(screen_id);

        if (this._screen === null) {
            throw new Error("No main screen found");
        }
        this._ctx = this._screen.getContext("2d");

        // Check for debug display
        this._debug = gv.$(debug_output_element);

        // Set options
        gv.copyObject(gv.default_options, this._options);
        if (options !== undefined) {
            gv.copyObject(options, this._options);
        }

        // Ensure drawHandler has this controller as context
        this._options.drawHandler = gv.bind(this._options.drawHandler,
                                            this);

        // Set initial mode
        this.setMode(this._options.initialMode);

        // Set dimensions of main screen
        this._screen.width  = this._options.screenWidth;
        this._screen.height = this._options.screenHeight;
        this._screen.style.width  = this._options.screenWidth + "px";
        this._screen.style.height = this._options.screenHeight + "px";

        // Add scrollbars (if configured)
        var reservex = 0,
            reservey = 0;

        if (this._options.scrollbars === true) {
            this.scrollbar = {
                x         : 0,  // horizontal position
                y         : 0,  // vertical position
                sizex     : 0,  // width of horizontal scrollbar
                sizey     : 0,  // height of vertical scrollbar
                thickness : 8,  // thickness of scrollbar
                hoverx     : false, // Mouse is hovering horizontal scrollbar
                hovery     : false  // Mouse is hovering vertical scrollbar
            };
            reservex = this.scrollbar.thickness;
            reservey = this.scrollbar.thickness;
        }

        if (this._options.zoombar === true) {
            this.zoombar = {
                length    : 30, // length (in percent of available width)
                thickness : 8,  // thickness of zoombar
                hover     : false // Mouse is hovering
            };
        }

        this.viewWidth = this._screen.width - reservex;
        this.viewHeight = this._screen.height - reservey;

        // Register event handlers
        this.registerEventHandlers();
    },

    // Start the visualization.
    //
    // graph - The graph to display.
    //
    start : function(graph) {
        "use strict";

        if (graph.nodes === undefined) {
            throw new Error("No nodes found");
        }
        if (graph.edges === undefined) {
            throw new Error("No edges found");
        }

        // Set the graph
        this._state.graph = graph;

        this._state.viewX = this._options.defaultViewX;
        this._state.viewY = this._options.defaultViewY;
        this._state.zoom = this._options.defaultZoom;

        // Calculate initial node points
        this._state.nodePoints = {};
        this._updateNodePoints();

        this._moveLoop();
        this._drawLoop();
    },

    // Stop the visualization.
    //
    stop : function () {
        "use strict";
        this.running = false;
        this.deRegisterEventHandlers();
        for (var i = 0; i < this._internalStopListeners.length; i++) {
            this._internalStopListeners[i].stop();
        }
    },

    // Change current operation mode.
    //
    setMode : function (mode) {
        "use strict";
        this.mode = mode;

        if (mode === gv.mode.NAVIGATION) {
            this._screen.style.cursor = "pointer";
        } else if (mode === gv.mode.DRAGGING) {
            this._screen.style.cursor = "default";
        } else if (mode === gv.mode.ZOOM) {
            this._screen.style.cursor = "crosshair";
        }
    },

    // Create an overview view.
    //
    // overview_screen_id - Canvas element for overview view.
    //
    // Returns controller for overview view.
    //
    startOverview : function (overview_screen_id) {
        "use strict";

        var options = {},
            overViewController;
        gv.copyObject(this._options, options);

        // Configure overview specific options
        options.screenWidth  = this._options.overviewScreenWidth;
        options.screenHeight = this._options.overviewScreenHeight;
        options.eventHandler = this._options.eventHandlerOverview;
        options.scrollbars   = false;
        options.zoombar      = false;
        options.icons        = false;

        // Add option for reference to parent view
        options.parentView   = this;

        // Register draw handler to draw a rectangle of the parent view
        options.drawHandler  = function (canvas, canvasWidth, canvasHeight, state) {
            var parentView = this._options.parentView.getViewBoundaries(),
            v1 = this._translateModelPointToCanvasPoint({
                x : parentView.x1,
                y : parentView.y1,
            }),
            v2 = this._translateModelPointToCanvasPoint({
                x : parentView.x2,
                y : parentView.y2
            });

            // Draw a rectangle which shows the parent view
            canvas.strokeStyle = "#0000FF";
            canvas.lineWidth = 1.5;
            canvas.strokeRect(v1.x, v1.y, v2.x - v1.x, v2.y - v1.y);
        };

        overViewController = new gv.OverviewController(overview_screen_id,
                                                       options);

        // Register internal model change listeners which updates the
        // the overview if the model changes.
        this._internalModelChangeListeners.push(
            gv.bind(function (overViewController, type, data) {
                if (type === gv.modelupdate.NEW_MODEL_BOUNDS) {
                    overViewController._modelBoundaries = undefined;
                    overViewController.centerViewToModel(true);
                }
            }, this, overViewController));

        // Also register the overview to be stopped if the
        // controller is stopped
        this._internalStopListeners.push(overViewController);

        overViewController.start(this._state.graph);
        overViewController.centerViewToModel(true);

        return overViewController;
    },

    // Apply a layout
    //
    // layout      - Layout to apply.
    // callback    - Function to call after all nodes have been moved into place.
    // fireUpdates - Fire movment updates to external event handlers.
    //               Disabled by default for better performance.
    //
    applyLayout : function (layout, callback, fireUpdates) {
        "use strict";

        if (!layout instanceof gv.AbstractLayout) {
            throw new Error("Layout must be subclass of gv.AbstractLayout");
        }

        if (fireUpdates !== true) {
            this._suspendEvents = true;
        }

        layout.applyLayout(this._state.graph,
                           this.viewWidth,
                           this.viewHeight,
                           this,
                           this._state);

        // Recalculate model boundaries and center view to new model
        this._modelBoundaries = undefined;
        layout.moveView(this._state.graph,
                        this.viewWidth,
                        this.viewHeight,
                        this,
                        this._state);

        // Activate updates only after the layout stopped moving stuff
        var movmentCheck = gv.bind(function () {
            if (this.moving === true) {
                window.setTimeout(movmentCheck, 100);
            } else {
                // Enable events
                this._suspendEvents = undefined;
                // Calculate the model boundaries again so
                // all external listeners are notified this time
                this._modelBoundaries = undefined;
                this.getModelBoundaries();
                if (callback !== undefined) {
                    callback();
                }
            }
        }, this);
        window.setTimeout(movmentCheck, 100);
    },

    getSelectedNodes : function () {
        "use strict";
        return this._selectedNodes;
    },

    selectNode : function (node) {
        "use strict";
        this._selectedNodes.push(node);
    },

    clearSelectedNodes : function () {
        "use strict";
        this._selectedNodes = [];
    },

    // Internal method to define event handlers
    // (may be overridden in subclasses).
    //
    _defineEventHandlers : function () {
        "use strict";
        this._registeredEventHandlers = [
                             // Global event handlers
                             [document,
                              'keydown',
                              gv.bind(this._options.eventHandler.eventKeyDown,
                                      this)],
                             [document,
                              'mouseup',
                              gv.bind(this._options.eventHandler.eventMouseUp,
                                      this)],
                             [document,
                              'mousemove',
                              gv.bind(this._options.eventHandler.eventMouseMove,
                                      this)],
                             // Canvas specific event handlers
                             [this._screen,
                              'click',
                              gv.bind(this._options.eventHandler.eventMouseClick,
                                      this)],
                             [this._screen,
                              'mousedown',
                              gv.bind(this._options.eventHandler.eventMouseDown,
                                      this)],
                             [this._screen,
                              'mousewheel',
                              gv.bind(this._options.eventHandler.eventMouseWheel,
                                      this)],
                             [this._screen,
                              'DOMMouseScroll',
                              gv.bind(this._options.eventHandler.eventMouseWheel,
                                      this)]
        ];
    },

    // Register event handlers for the visualization engine.
    //
    registerEventHandlers : function () {
        "use strict";

        this._defineEventHandlers();

        // Add canvas specific event handlers
        for (var i=0; i < this._registeredEventHandlers.length; i++) {

            var element   = this._registeredEventHandlers[i][0],
                eventName = this._registeredEventHandlers[i][1],
                responder = this._registeredEventHandlers[i][2];

            if (element.addEventListener) {
                element.addEventListener(eventName, responder, false);
            } else {
                element.attachEvent("on" + eventName, responder);
            }
        }
    },

    // Deregister event handlers for the visualization engine.
    //
    deRegisterEventHandlers : function () {
        "use strict";

        document.onkeydown = null;
        document.onmouseup = null;
        document.onmousemove = null;

        // Remove canvas specific event handlers
        for (var i=0;i<this._registeredEventHandlers.length;i++) {

            var eventName  = this._registeredEventHandlers[i][1],
                responder  = this._registeredEventHandlers[i][2];

            if (this._screen.removeEventListener) {
                this._screen.removeEventListener(eventName, responder, false);
            } else {
                this._screen.detachEvent("on" + eventName, responder);
            }
        }
    },

    // Print something in the debug area (if one was specified).
    //
    printDebug : function (str) {
        "use strict";

        if (this._debug !== null) {
            this._debug.innerHTML += str+"<br>";
        }
    },

    changeZoom : function (delta) {
        "use strict";

        // Do some acceleration / deceleration
        // at certain zoom levels
        if (this._state.zoom < 1.5) {
            delta = delta / 4;
        }
        if (this._state.zoom > 5.5) {
            delta = delta * 2;
        }

        // Calculate new zoom level
        this._state.zoom += delta;

        // Set some limits
        if (this._state.zoom < 0.2) {
            this._state.zoom = 0.2;
        } else if (this._state.zoom > 11) {
            this._state.zoom = 11;
        }
    },

    // Center the view to a point in the model
    moveView : function (point, newZoom) {
        "use strict";

        // Calculate delta vector
        var v = {
            x : point.x - this._state.viewX,
            y : point.y - this._state.viewY
        }, dz = 0;

        // Calculate the delta zoom
        if (newZoom !== undefined) {
            dz = (this._state.zoom - newZoom);
        }

        // Move the view 10 times and to a step every 15ms
        gv.timedLoop(gv.bind(function (dx, dy, dz, index) {
                                 this._state.viewX += dx;
                                 this._state.viewY += dy;
                                 if (dz !== undefined) {
                                     this._state.zoom -= dz;
                                 }
                             }, this, v.x / 10, v.y / 10, dz / 10),
                     10, 15);
    },

    // Set the view instantly to a point
    setView : function (point, newZoom) {
        "use strict";

        // Calculate delta vector
        var v = {
                x : point.x - this._state.viewX,
                y : point.y - this._state.viewY
            },
            dz = 0;

        // Calculate the delta zoom
        if (newZoom !== undefined) {
            dz = (this._state.zoom - newZoom);
        }

        this._state.viewX += v.x;
        this._state.viewY += v.y;
        this._state.zoom -= dz;
    },

    // Center the view on the model such that
    // all model elements are displayed.
    //
    // setView - Boolean if the view should move or be set instantly.
    //
    centerViewToModel : function (setView) {
        "use strict";
        var maxrec = this.getModelBoundaries();
        this.centerViewToRect({ x : maxrec.x1 - 5, y : maxrec.y1 - 15},
                              { x : maxrec.x2 + 5, y : maxrec.y2 + 20},
                              setView);
    },

    // Center and zoom in the view to a rectangle
    // given by two points in the model.
    //
    // p1      - First point.
    // p2      - Second point.
    // setView - Boolean if the view should move or be set instantly.
    //
    centerViewToRect : function (p1, p2, setView) {
        "use strict";

        var ux, uy, lx, ly;

        // Get upper left and lower right corners
        if (p1.x >= p2.x) {
            lx = p1.x;
            ux = p2.x;
        } else {
            lx = p2.x;
            ux = p1.x;
        }
        if (p1.y >= p2.y) {
            ly = p1.y;
            uy = p2.y;
        } else {
            ly = p2.y;
            uy = p1.y;
        }

        // Calculate vertical vector
        var v = {
            x : lx - ux,
            y : ly - uy
        }, zh, zv, newZoom;

        // Calculate horizontal and vertical zoom values
        zh = this.viewWidth / v.x;
        zv = this.viewHeight / v.y;

        // Choose the smaller one (to make sure we display
        // everything which is in the rectangle)
        if (zh > zv) {
            newZoom = zv;
        } else {
            newZoom = zh;
        }

        if (setView === true) {

            // Set the view to the middle of the area
            this.setView({
                x : ux + v.x / 2,
                y : uy + v.y / 2
            }, newZoom);

        } else {

            // Move the view to the middle of the area
            this.moveView({
                x : ux + v.x / 2,
                y : uy + v.y / 2
            }, newZoom);
        }
    },

    // Get boundaries of the current model
    //
    getModelBoundaries : function () {
        "use strict";

        // This needs to be reset after an animation
        //
        if (this._modelBoundaries !== undefined) {
            return this._modelBoundaries;
        }

        var nodes = this._state.graph.nodes,
            maxrec;

        if (nodes.length === 0) {
            return {
                x1 : 0, y1 : 0,
                x2 : 0, y2 : 0
            };
        }

        // Calculate an inital maxrec from the first node
        var inpos = nodes[0].getNewPosition();
        maxrec = {
            x1 : inpos.x - nodes[0].width / 2,
            y1 : inpos.y - nodes[0].height / 2,
            x2 : inpos.x + nodes[0].width / 2,
            y2 : inpos.y + nodes[0].height / 2
        };

        // Go through all nodes and get the maximum boudaries
        for(var i = 0; i < nodes.length; i++) {
            var node = nodes[i],
                npos = node.getNewPosition(),
                x1 = npos.x - node.width / 2,
                y1 = npos.y - node.height / 2,
                x2 = npos.x + node.width / 2,
                y2 = npos.y + node.height / 2;

            if (x1 < maxrec.x1) {
                maxrec.x1 = x1;
            }
            if (y1 < maxrec.y1) {
                maxrec.y1 = y1;
            }
            if (x2 > maxrec.x2) {
                maxrec.x2 = x2;
            }
            if (y2 > maxrec.y2) {
                maxrec.y2 = y2;
            }
        }

        // Store the calculated result
        this._modelBoundaries = maxrec;
        this._fireModelUpdate(gv.modelupdate.NEW_MODEL_BOUNDS, maxrec);

        return maxrec;
    },

    // Return the current visible boundaries
    //
    getViewBoundaries : function () {
        "use strict";
        return {
            x1 : this._state.viewX - (this.viewWidth  / 2) / this._state.zoom,
            y1 : this._state.viewY - (this.viewHeight / 2) / this._state.zoom,
            x2 : this._state.viewX + (this.viewWidth  / 2) / this._state.zoom,
            y2 : this._state.viewY + (this.viewHeight / 2) / this._state.zoom
        };
    },

    // Internal methods
    // ================

    // Notify external event listeners of a model change.
    //
    _fireModelUpdate : function (type, data) {
        "use strict";

        if (this._suspendEvents === true) {
            return;
        }

        for (var i=0;i<this._options.modelChangeListeners.length;i++) {
            this._options.modelChangeListeners[i](type, data);
        }
        for (var j=0;j<this._internalModelChangeListeners.length;j++) {
            this._internalModelChangeListeners[j](type, data);
        }
    },

    // Move loop of this engine.
    //
    _moveLoop : function () {
        "use strict";

      var moveLoopTime = new Date().getTime(),
          timeDelta = moveLoopTime - this._lastMoveCycleTime;

        // Do the move and compensation for the time delta
        this._move(timeDelta);

        // Calculate the next move time and adjust it according to the time lag
        var nextMoveLoopTime = 1000 / this._options.moveRate;
        if (timeDelta > nextMoveLoopTime) {
            nextMoveLoopTime = Math.max(1, nextMoveLoopTime -
                                        (timeDelta - nextMoveLoopTime));
        }

        this._lastMoveCycleTime = moveLoopTime;

        if (this.running) {
            setTimeout(gv.bind(this._moveLoop, this), nextMoveLoopTime);
        }
    },

    // Move entities in the graph.
    //
    _move : function (timeDelta) {
        "use strict";

        var player = this._state.player;

        // Calculate a correction multiplier for the time lag
        var timeCorrection = timeDelta / this._options.moveRate;
        if (isNaN(timeCorrection)) timeCorrection = 1;

        // Move the nodes
        var moveEvent    = false,
            moveFinished = false;

        for(var i = 0; i < this._state.graph.nodes.length; i++) {
            var node = this._state.graph.nodes[i],
                np = node.checkMoving();

            if (np !== undefined) {
                moveEvent = true;

                // Calculate new entity coordinates
                var moveStep = timeCorrection * this._options.moveSpeed;

                // Calculate move vector and length of move path
                var mv = {
                    x : np.x - node.x,
                    y : np.y - node.y
                }, mp = Math.sqrt(mv.x * mv.x + mv.y * mv.y);

                if (mp <= moveStep) {
                    node.x = np.x;
                    node.y = np.y;
                } else {
                    node.x += (mv.x / mp) * moveStep;
                    node.y += (mv.y / mp) * moveStep;
                }

                // Check if the node reached its destination
                if (node.x === np.x && node.y === np.y) {
                    moveFinished = true;
                }
            }
        }
        if (moveFinished === true) {
            // Invalidate the current model boundaries
            this._modelBoundaries = undefined;
            this._fireModelUpdate(gv.modelupdate.NODE_MOVE);
            this.getModelBoundaries();
        }

        this.moving = moveEvent;
    },

    _drawLoop : function () {
        "use strict";

        var start = 0;

        // Clear screen canvas
        var ctx = this._ctx;
        ctx.clearRect(0,0,this._screen.width,this._screen.height);

        if (this._debug !== null) {
            this._debug.innerHTML = "";
            start = new Date().getTime();
        }

        // Draw the scene
        this._draw();

        // Call external handler
        this._options.drawHandler(ctx,
                                  this.viewWidth,
                                  this.viewHeight,
                                  this._state);

        // Calculate FPS
        if (start !== 0) {
            var runtime = new Date().getTime() - start;
            this.printDebug("Runtime:" + runtime);
            var now = new Date().getTime();
            var timeDelta = now - this._debug_lastRenderCycleTime;
            this._debug_lastRenderCycleTime = now;
            var fps = Math.floor(1000 / timeDelta);
            this.printDebug("FPS:" + fps);
        }

        if (this.running) {
            setTimeout(gv.bind(this._drawLoop, this), 20);
        }
    },

    _draw : function () {
        "use strict";

        var drawnObjects = 0;

        // Clear everything
        this._ctx.fillStyle = "#FFFFFF";
        this._ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);

        this._updateNodePoints();

        // Check how many edges should be drawn
        var visibleEdges = 0;
        for(var j = 0; j < this._state.graph.edges.length; j++) {
            var edge = this._state.graph.edges[j],
                nodePoint1 = this._state.nodePoints[edge.getEnd1().id],
                nodePoint2 = this._state.nodePoints[edge.getEnd2().id];

            this._ctx.strokeStyle = "#000000";
            this._ctx.fillStyle = "#000000";

            if (edge.isVisible([nodePoint1, nodePoint2], this.viewWidth,
                               this.viewHeight, this._state)) {
                edge.visible = true;
                visibleEdges++;
            } else {
                edge.visible = false;
            }
        }
        if (visibleEdges < this._options.maxVisibleEdges) {
            // Draw edges
            for(j = 0; j < this._state.graph.edges.length; j++) {
                var vedge = this._state.graph.edges[j],
                    vnodePoint1 = this._state.nodePoints[vedge.getEnd1().id],
                    vnodePoint2 = this._state.nodePoints[vedge.getEnd2().id];

                this._ctx.strokeStyle = "#000000";
                this._ctx.fillStyle = "#000000";

                if (vedge.visible) {
                    vedge.draw(this._ctx, [vnodePoint1, vnodePoint2], this._state.zoom);
                    drawnObjects++;
                }
            }
        }

        // Draw nodes
        for(j = 0; j < this._state.graph.nodes.length; j++) {
            var node = this._state.graph.nodes[j],
                nodePoint = this._state.nodePoints[node.id];

            this._ctx.strokeStyle = "#000000";
            this._ctx.fillStyle = "#000000";

            if (node.isVisible(nodePoint, this.viewWidth, this.viewHeight,
                               this._state)) {

                // Check if the node is selected
                if ((this._mouse_dragging !== undefined &&
                     this._mouse_dragging.node === node) ||
                    this._selectedNodes.indexOf(node) !== -1) {

                    var w = node.width  * this._state.zoom,
                        h = node.height * this._state.zoom,
                        b = this._state.zoom * 2;

                    this._ctx.fillStyle = "#FFAA77";
                    this._ctx.fillRect(nodePoint.x - b - w / 2,
                                       nodePoint.y - b - h / 2,
                                       w + b * 2,
                                       h + b * 2);
                    this._ctx.fillStyle = "#000000";
                }

                node.visible = true;
                node.draw(this._ctx, nodePoint, this._state.zoom);

                drawnObjects++;
            } else {
                node.visible = false;
            }
        }

        // Draw selection box
        if (this.mode === gv.mode.DRAGGING ||
            this.mode === gv.mode.ZOOM) {

            if (this._mouse_dragging !== undefined &&
                this._mouse_dragging.drag !== undefined) {

                this._ctx.lineWidth = 1.5;
                this._ctx.strokeStyle = "#FF0077";
                this._ctx.strokeRect(this._mouse_dragging.click.x,
                                     this._mouse_dragging.click.y,
                                     this._mouse_dragging.drag.x -
                                        this._mouse_dragging.click.x,
                                     this._mouse_dragging.drag.y -
                                        this._mouse_dragging.click.y);

            }
        }

        // Draw scrollbars
        if (this.scrollbar !== undefined) {

            // Delete scroll area
            this._ctx.fillStyle = "#BBBBBB";

            // Draw horizontal background
            this._ctx.fillRect(0,
                               this.viewHeight,
                               this.viewWidth + this.scrollbar.thickness,
                               this.scrollbar.thickness);
            // Draw vertical background
            this._ctx.fillRect(this.viewWidth,
                               0,
                               this.scrollbar.thickness,
                               this.viewHeight + this.scrollbar.thickness);

            // Draw scrollbars
            var sd = this._getScrollBarsDefinition();

            this._ctx.fillStyle = this.scrollbar.hoverx === true ? "#FFAA77"
                                                                 : "#777777";

            // Draw horizontal scrollbar
            this._ctx.fillRect(sd.hpos, this.viewHeight, sd.hsize, this.scrollbar.thickness);

            this._ctx.fillStyle = this.scrollbar.hovery === true ? "#FFAA77"
                                                                 : "#777777";

            // Draw vertical scrollbar
            this._ctx.fillRect(this.viewWidth, sd.vpos, this.scrollbar.thickness, sd.vsize);
        }

        // Draw zoombar
        if (this.zoombar !== undefined) {

            // Delete scroll area
            this._ctx.fillStyle = "#BBBBBB";

            // Draw background
            this.zoombar.ztotallength = this.viewWidth * this.zoombar.length / 100;
            this.zoombar.zsize        = Math.floor(this.zoombar.ztotallength / 10);
            // Zoom value for display (putting more emphasis on the smaller numbers)
            this.zoombar.zdisplay     = (this._state.zoom-1) < 10 ? (this._state.zoom-1) * 10
                                                                  : 100;
            this.zoombar.zoffset      = (this.zoombar.ztotallength-this.zoombar.zsize) /
                                        100 * this.zoombar.zdisplay;

            this._ctx.fillRect(this.viewWidth - this.zoombar.ztotallength - 13,
                               0,
                               this.zoombar.ztotallength + 13,
                               this.zoombar.thickness);

            this._ctx.fillStyle = this.zoombar.hover === true ? "#FFAA77"
                                                              : "#777777";

            this._ctx.fillRect(this.viewWidth - this.zoombar.ztotallength + this.zoombar.zoffset,
                               0,
                               this.zoombar.zsize,
                               this.zoombar.thickness);

        }

        // Draw icons
        if (this._options.icons === true) {
            var yoffset = this.zoombar !== undefined ? this.zoombar.thickness
                                                     : 0,
                xoffset = this.viewWidth - 77;

            this._ctx.fillStyle = "#777777";
            this._ctx.fillRect(xoffset, yoffset, 77, 20);

            if (this._img_pan_hover === true || this.mode === gv.mode.NAVIGATION) {
                this._ctx.fillStyle = this.mode === gv.mode.NAVIGATION ? "#FF0000"
                                                                       : "#FFAA77";
                this._ctx.fillRect(xoffset, yoffset, 20, 20);
            }
            this._ctx.drawImage(this._img_pan,     xoffset + 1,  yoffset + 1);
            if (this._img_select_hover === true || this.mode === gv.mode.DRAGGING) {
                this._ctx.fillStyle = this.mode === gv.mode.DRAGGING ? "#FF0000"
                                                                     : "#FFAA77";
                this._ctx.fillRect(xoffset+19, yoffset, 20, 20);
            }
            this._ctx.drawImage(this._img_select,  xoffset + 20, yoffset + 1);
            if (this._img_fit_all_hover === true) {
                this._ctx.fillStyle = "#FFAA77";
                this._ctx.fillRect(xoffset+38, yoffset, 20, 20);
            }
            this._ctx.drawImage(this._img_fit_all, xoffset + 39, yoffset + 1);
            if (this._img_zoom_hover === true || this.mode === gv.mode.ZOOM) {
                this._ctx.fillStyle = this.mode === gv.mode.ZOOM ? "#FF0000"
                                                                 : "#FFAA77";
                this._ctx.fillRect(xoffset+57, yoffset, 20, 20);
            }
            this._ctx.drawImage(this._img_zoom,    xoffset + 58, yoffset + 1);
        }

        // Draw console text
        this._ctx.font = "8pt Arial";
        this._ctx.fillStyle = "#555555";
        for(j = 0; j < this.console._text.length; j++) {
            this._ctx.fillText(this.console._text[j], 5, 10 + (10 * j));
        }

        // Add some debug output
        this.printDebug("Objects drawn: " + drawnObjects);
        this.printDebug("Zoom: " + this._state.zoom);
    },

    // Calculations
    // ============

    // Update nodepoint map in the state. This map contains the canvas points
    // of all nodes in the model.
    //
    _updateNodePoints : function () {
        "use strict";

        for(var i = 0; i < this._state.graph.nodes.length; i++) {
            var dx, dy,
                node = this._state.graph.nodes[i];

            // Calculate coordinates in model with zoom
            dx = node.x * this._state.zoom;
            dy = node.y * this._state.zoom;

            // Calculate position in the canvas with zoom
            dx = dx - this._state.viewX * this._state.zoom + this.viewWidth  / 2;
            dy = dy - this._state.viewY * this._state.zoom + this.viewHeight  / 2;

            this._state.nodePoints[node.id] = {
                x : dx,
                y : dy
            };
        }
    },

    // Translate from a point in the model to a point on the canvas
    //
    _translateModelPointToCanvasPoint : function (p) {
        "use strict";
        return {
            x : (p.x - this._state.viewX) * this._state.zoom + this.viewWidth / 2,
            y : (p.y - this._state.viewY) * this._state.zoom + this.viewHeight / 2
        };
    },

    // Translate from a point on the canvas to a point in the model
    //
    _translateCanvasPointToModelPoint : function (p) {
        "use strict";
        // Find out where the point is from the center and
        // take the zoom into consideration
        return {
            x : this._state.viewX + (p.x - this.viewWidth / 2) / this._state.zoom,
            y : this._state.viewY + (p.y - this.viewHeight / 2) / this._state.zoom
        };
    },

    // Calculate position of scrollbars
    //
    _getScrollBarsDefinition : function () {
        "use strict";
        var vb, mb, vx,vy, mx, my,
            scrollHSize, scrollVSize;

        // Get boundaries
        vb = this.getViewBoundaries();
        vx = vb.x1 - vb.x2;
        vy = vb.y1 - vb.y2;
        mb = this.getModelBoundaries();
        mx = mb.x1 - mb.x2;
        my = mb.y1 - mb.y2;

        // Calculate scrollbar sizes
        // (No need to check for <0 as this
        //  case is covert by the zoom level logic)
        scrollHSize = this.viewWidth * vx / mx;
        if (scrollHSize > this.viewWidth) {
            scrollHSize = this.viewWidth;
        }
        scrollVSize = this.viewHeight * vy / my;
        if (scrollVSize > this.viewHeight) {
            scrollVSize = this.viewHeight;
        }

        // Calculate scrollbar offset
        vx = vb.x1 - mb.x1;
        vx = - vx * this.viewWidth / mx;
        if (vx < 0) {
            vx = 0;
        }
        if (vx > this.viewWidth - scrollHSize) {
            vx = this.viewWidth - scrollHSize;
        }

        vy = vb.y1 - mb.y1;
        vy = - vy * this.viewHeight / my;
        if (vy < 0) {
            vy = 0;
        }
        if (vy > this.viewHeight - scrollVSize) {
            vy = this.viewHeight - scrollVSize;
        }

        return {
            hpos  : vx,
            hsize : scrollHSize,
            vpos  : vy,
            vsize : scrollVSize
        };
    },

    // Mouse dragging
    // ==============

    _handleMouseDown : function (event) {
        "use strict";
        var p = gv.calculateClickPoint(event, this._screen);

        this._mouse_dragging = {
            click : p,
            view  : {
                x : this._state.viewX,
                y : this._state.viewY
            }
        };

        if (this.mode === gv.mode.DRAGGING) {
            var node = this.getClickedNode(event);
            if (node === undefined) {
                this._selectedNodes = [];
            } else if (this._selectedNodes.indexOf(node) === -1) {
                this._selectedNodes = [ node ];
                this._mouse_dragging.node = node;
            } else {
                this._mouse_dragging.offsets = [];
                for (var i=0; i < this._selectedNodes.length; i++) {
                    var snode = this._selectedNodes[i],
                        mp = this._translateCanvasPointToModelPoint(p);

                    this._mouse_dragging.offsets.push({
                        x : snode.x - mp.x,
                        y : snode.y - mp.y
                    });
                }
            }
        }

        return true;
    },

    _handleMouseMove : function (event) {
        "use strict";

        if (this._mouse_dragging !== undefined) {

            var p = gv.calculateClickPoint(event, this._screen);

            if (this.mode === gv.mode.NAVIGATION) {

                var v = {
                    x : p.x - this._mouse_dragging.click.x,
                    y : p.y - this._mouse_dragging.click.y
                };
                this._state.viewX = this._mouse_dragging.view.x - v.x /
                                    this._state.zoom;
                this._state.viewY = this._mouse_dragging.view.y - v.y /
                                    this._state.zoom;
                return true;

            } else if (this.mode === gv.mode.DRAGGING) {

                var mp = this._translateCanvasPointToModelPoint(p);

                if (this._mouse_dragging.node !== undefined) {

                    this._mouse_dragging.node._setPosition(mp);
                    return true;

                } else if (this._selectedNodes.length > 0 &&
                           this._mouse_dragging.offsets !== undefined) {

                    for (var i=0; i < this._selectedNodes.length; i++) {
                        var node = this._selectedNodes[i],
                            offset = this._mouse_dragging.offsets[i];

                        node._setPosition({
                            x : mp.x + offset.x,
                            y : mp.y + offset.y
                        });
                    }
                    return true;
                }
            }

            this._mouse_dragging.drag = p;

            return true;
        }

        return false;
    },

    _handleMouseUp : function (event) {
        "use strict";

        if (this._mouse_dragging !== undefined &&
            this._mouse_dragging.drag !== undefined) {

            // Swap click and drag if necessary
            var swap;
            if (this._mouse_dragging.drag.x < this._mouse_dragging.click.x) {
                swap = this._mouse_dragging.drag.x;
                this._mouse_dragging.drag.x = this._mouse_dragging.click.x;
                this._mouse_dragging.click.x = swap;
            }
            if (this._mouse_dragging.drag.y < this._mouse_dragging.click.y) {
                swap = this._mouse_dragging.drag.y;
                this._mouse_dragging.drag.y = this._mouse_dragging.click.y;
                this._mouse_dragging.click.y = swap;
            }
        }

        if (this.mode === gv.mode.ZOOM &&
            this._mouse_dragging !== undefined &&
            this._mouse_dragging.drag !== undefined) {

            var v = {
                x : this._mouse_dragging.drag.x -
                        this._mouse_dragging.click.x,
                y : this._mouse_dragging.drag.y -
                        this._mouse_dragging.click.y
            };

            if (v.x > 10 && v.y > 10) {
                var p1 = this._translateCanvasPointToModelPoint(
                             this._mouse_dragging.click),
                    p2 = this._translateCanvasPointToModelPoint(
                             this._mouse_dragging.drag);

                this.centerViewToRect(p1, p2);
            }

        } else if (this.mode === gv.mode.DRAGGING &&
                   this._mouse_dragging !== undefined) {

            if (this._mouse_dragging.drag !== undefined) {

                // Check which nodes were selected
                this._selectedNodes = [];

                for(var i = 0; i < this._state.graph.nodes.length; i++) {
                    var node = this._state.graph.nodes[i],
                        nodePoint = this._state.nodePoints[node.id];

                    if (nodePoint.x > this._mouse_dragging.click.x &&
                        nodePoint.y > this._mouse_dragging.click.y &&
                        nodePoint.x < this._mouse_dragging.drag.x  &&
                        nodePoint.y < this._mouse_dragging.drag.y) {

                        this._selectedNodes.push(node);
                    }
                }

            } else if (this._mouse_dragging.offsets !== undefined) {

                // Invalidate model bounds. Model update event is fired
                // during the normal draw loop.
                this._modelBoundaries = undefined;

            } else if (this._mouse_dragging.node !== undefined) {

                // Invalidate model bounds. Model update event is fired
                // during the normal draw loop.
                this._modelBoundaries = undefined;
            }
        }

        this._mouse_dragging = undefined;

        return true;
    },

    // Get the current node at a given mouse position
    // event - mouse event
    getClickedNode : function (event) {
        "use strict";

        if (event._gv_found_node !== undefined) {
            return event._gv_found_node;
        }

        var p = gv.calculateClickPoint(event, this._screen);

        // Search for node
        for (var i = 0; i < this._state.graph.nodes.length; i++) {
                var node = this._state.graph.nodes[i],
                    np = this._state.nodePoints[node.id],
                    w = node.width * this._state.zoom / 2,
                    h = node.height * this._state.zoom / 2;

                if (p.x > np.x - w && p.x < np.x + w &&
                    p.y > np.y - h && p.y < np.y + h) {

                    event._gv_found_node = node;
                    return node;
                }
        }

        return undefined;
    },

    // Icon handling
    // =============

    // Handle click on icons.
    //
    // This function should be called by the mouse click handler.
    // This function returns true if the event was handled.
    _handleIconClick : function (event) {
        "use strict";
        if (this._options.icons !== true) {
            return false;
        }
        if (!this._scrollBarAction &&
            !this._zoomBarAction) {

            var p  = gv.calculateClickPoint(event, this._screen),
                yiconoffset = this.zoombar !== undefined ? this.zoombar.thickness
                                                         : 0,
                xiconoffset = this.viewWidth - 77;

            if (p.y > yiconoffset && p.y < yiconoffset + 20) {
                if (p.x > xiconoffset && p.x < xiconoffset + 20) {
                    this.setMode(gv.mode.NAVIGATION);
                    return true;
                }
                if (p.x > xiconoffset + 19 && p.x < xiconoffset + 39) {
                    this.setMode(gv.mode.DRAGGING);
                    return true;
                }
                if (p.x > xiconoffset + 38 && p.x < xiconoffset + 58) {
                    this.centerViewToModel();
                    return true;
                }
                if (p.x > xiconoffset + 57 && p.x < xiconoffset + 77) {
                    this.setMode(gv.mode.ZOOM);
                    return true;
                }
            }
        }
        return false;
    },

    // Scrollbar / zoombar handling
    // ============================

    // Handle manual move of scrollbars.
    //
    // This function should be called by the mouse move handler.
    // This function returns true if the event was handled.
    _handleScrollBarMove : function (event) {
        "use strict";
        if (this.scrollbar === undefined) {
            return false;
        }
        var p  = gv.calculateClickPoint(event, this._screen),
            dx = p.x - this._lastMouseDownPos.x,
            dy = p.y - this._lastMouseDownPos.y;

        // Move the scrollbars
        if (this._scrollBarAction === true) {
            var b = this.getModelBoundaries();
            if (this._scrollBarStickX) {
                this._state.viewX = this._state.viewX + dx /
                                    (this.viewWidth / (b.x2 - b.x1));
                this._lastMouseDownPos = p;
            } else if (this._scrollBarStickY) {
                this._state.viewY = this._state.viewY + dy /
                                    (this.viewHeight / (b.y2 - b.y1));
                this._lastMouseDownPos = p;
            }
            return true;
        }

        return false;
    },

    // Handle release of scrollbars.
    //
    // This function should be called by the mouse up handler.
    // This function returns true if the event was handled.
    _handleScrollBarRelease : function () {
        "use strict";
        if (this.scrollbar === undefined) {
            return;
        }
        if (this._scrollBarAction) {
            this._scrollBarStickX = undefined;
            this._scrollBarStickY = undefined;
            this._scrollBarAction = undefined;
            return true;
        }

        return false;
    },

    // Handle the click (and hold) on scrollbars.
    //
    // This function should be called by the mouse down and click
    // event handlers. The click event handler should pass the
    // click parameter as true and ignore the event if true is returned.
    // This function returns true if the event was handled.
    _handleScrollBarClick : function (event, click) {
        "use strict";
        if (this.scrollbar === undefined) {
            return false;
        }
        var p = gv.calculateClickPoint(event, this._screen),
            boundaries,
            offset,
            scrollVert,
            scrollHor;

        // Check if the click is on the scrollbar area
        if (p.x > this.viewWidth &&
            p.x < this.viewWidth + this.scrollbar.thickness) {
            // Vertical scroll bar

            if (click !== true) {
                // Save the clicked position and indicate a scroll bar action
                this._lastMouseDownPos = p;
                this._scrollBarAction = true;

                // Check if the click was on the scrollbar
                var vsd = this._getScrollBarsDefinition();
                if (p.y > vsd.vpos && p.y < vsd.vpos + vsd.vsize) {
                    this._scrollBarStickY = true;
                } else {
                    // Click was not on it - move the view
                    scrollVert = 100 * p.y / this.viewHeight;
                    boundaries = this.getModelBoundaries();
                    offset = boundaries.y2 - boundaries.y1;
                    offset = scrollVert * offset / 100;
                    this.moveView({
                        x : this._state.viewX,
                        y : boundaries.y1 + offset
                    });
                }
            }
            return true;

        } else if (p.y > this.viewHeight &&
                   p.y < this.viewHeight + this.scrollbar.thickness) {
            // Horizontal scroll bar

            if (click !== true) {
                // Save the clicked position and indicate a scroll bar action
                this._lastMouseDownPos = p;
                this._scrollBarAction = true;

                // Check if the click was on the scrollbar
                var hsd = this._getScrollBarsDefinition();
                if (p.x > hsd.hpos && p.x < hsd.hpos + hsd.hsize) {
                    this._scrollBarStickX = true;
                } else {
                    // Click was not on it - move the view
                    scrollHor = 100 * p.x / this.viewWidth;
                    boundaries = this.getModelBoundaries();
                    offset = boundaries.x2 - boundaries.x1;
                    offset = scrollHor * offset / 100;
                    this.moveView({
                        x : boundaries.x1 + offset,
                        y : this._state.viewY
                    });
                }
            }
            return true;
        }

        return false;
    },

    // Handle the click (and possible hold) on the zoombar.
    //
    // This function should be called by the mouse down and click
    // event handlers. The click event handler should pass the
    // click parameter as true and ignore the event if true is returned.
    // This function returns true if the event was handled.
    _handleZoomBarClick : function (event, click, move) {
        "use strict";
        if (this.zoombar === undefined) {
            return false;
        }

        var p = gv.calculateClickPoint(event, this._screen),
            boundaries,
            offset,
            scrollVert,
            scrollHor;

        if (p.x > this.viewWidth - this.zoombar.ztotallength - 13 &&
            p.x < this.viewWidth &&
            (move === true || p.y < this.zoombar.thickness)) {

            if (click !== true) {
                offset = p.x - (this.viewWidth - this.zoombar.ztotallength);

                this._zoomBarAction = true;

                offset = offset * 10 /
                        (this.zoombar.ztotallength-this.zoombar.zsize);

                if (offset > 20) {
                    offset = 20;
                } else if (offset < 0.2) {
                    offset = 0.2;
                }

                this._state.zoom = offset;
            }
            return true;
        }
        return false;
    },

    // Handle manual move of the zoombar.
    //
    // This function should be called by the mouse move handler.
    // This function returns true if the event was handled.
    _handleZoomBarMove : function (event) {
        "use strict";
        if (this.zoombar === undefined) {
            return false;
        }
        if (this._zoomBarAction === true) {
            return this._handleZoomBarClick(event, undefined, true);
        }
        return false;
    },

    // Handle release of the zoombar.
    //
    // This function should be called by the mouse up handler.
    // This function returns true if the event was handled.
    _handleZoomBarRelease : function () {
        "use strict";
        if (this.zoombar === undefined) {
            return false;
        }
        if (this._zoomBarAction === true) {
            this._zoomBarAction = undefined;
            return true;
        }

        return false;
    },

    // Function to check if the mouse if hovering above a control.
    //
    // This function should be called by the mouse move handler.
    _checkControlHover : function (event) {
        "use strict";
        var p = gv.calculateClickPoint(event, this._screen);

        this._img_fit_all_hover = false;
        this._img_select_hover = false;
        this._img_pan_hover = false;
        this._img_zoom_hover = false;

        if (this.scrollbar !== undefined) {
            this.scrollbar.hoverx = false;
            this.scrollbar.hovery = false;
        }
        if (this.zoombar !== undefined) {
            this.zoombar.hover = false;
        }

        if (this._options.icons === true &&
            !this._scrollBarAction &&
            !this._zoomBarAction) {

            var yiconoffset = this.zoombar !== undefined ? this.zoombar.thickness
                                                         : 0,
                xiconoffset = this.viewWidth - 77;

            if (p.y > yiconoffset && p.y < yiconoffset+20) {
                if (p.x > xiconoffset && p.x < xiconoffset+20) {
                    this._img_pan_hover = true;
                    return;
                }
                if (p.x > xiconoffset+19 && p.x < xiconoffset+39) {
                    this._img_select_hover = true;
                    return;
                }
                if (p.x > xiconoffset+38 && p.x < xiconoffset+58) {
                    this._img_fit_all_hover = true;
                    return;
                }
                if (p.x > xiconoffset+57 && p.x < xiconoffset+77) {
                    this._img_zoom_hover = true;
                    return;
                }
            }
        }
        if (this.scrollbar !== undefined) {
            if (p.x > 0 && p.x < this.viewWidth + this.scrollbar.thickness &&
                p.y > this.viewHeight && p.y < this.viewHeight + this.scrollbar.thickness) {

                this.scrollbar.hoverx = true;
                return;
            }
            if (p.x > this.viewWidth && p.x < this.viewWidth + this.scrollbar.thickness &&
                p.y > 0 && p.y < this.viewHeight + this.scrollbar.thickness) {

                this.scrollbar.hovery = true;
                return;
            }
        }
        if (this.zoombar !== undefined) {
            var zoffset = this.viewWidth - this.zoombar.ztotallength;
            if (this._zoomBarAction ||
                (p.x > zoffset && p.x < zoffset + this.zoombar.ztotallength &&
                 p.y > 0 && p.y < this.zoombar.thickness)) {

                this.zoombar.hover = true;
                return;
            }
        }
    }
});

// Controller for overview objects.
// This should not be used directly - use startOverview()
// on the main controller instead.
//
gv.OverviewController = gv.MainController.create({

    // No move operation for overview.
    _moveLoop             : function () { },
    _move                 : function () { },

    _defineEventHandlers : function () {
        "use strict";
        this._registeredEventHandlers = [
                             // Global event handlers
                             [document,
                              'mouseup',
                              gv.bind(this._options.eventHandler.eventMouseUp,
                                      this)],
                             [this._screen,
                              'mousemove',
                              gv.bind(this._options.eventHandler.eventMouseMove,
                                      this)],
                             [this._screen,
                              'mousedown',
                              gv.bind(this._options.eventHandler.eventMouseDown,
                                      this)]
        ];
    }
});


// Layouts
// =======


gv.LayoutModel = {

    NodeWrapper : gv.Class.create({

        init : function (originalNode) {
            "use strict";

            this.id = originalNode.id;

            // To be filled by wrap graph
            this.neighbours  = [];
            this.edges  = [];

            // Layzily generated
            this._outgoingNeighbours = undefined;
            this._incomingNeighbours = undefined;

            // Wrapped node reference
            this.wrappedNode = originalNode;
        },

        getNeighbours : function () {
            "use strict";
            return this.neighbours;
        },

        getEdgeTo : function (vertexId) {
            if (vertexId === this.id) {
                throw Error("Invalid vertex id");
            }
            for (var i = 0; i < this.edges.length; i++) {
                if (this.edges[i].src.id === vertexId ||
                    this.edges[i].dest.id === vertexId) {

                    return this.edges[i];
                }
            }
        },

        getOutgoingNeighbours : function () {
            if (this._outgoingNeighbours === undefined) {
                this._outgoingNeighbours = [];
                for (var i = 0; i < this.edges.length; i++) {
                    var edge = this.edges[i];
                    if (edge.src === this) {
                        this._outgoingNeighbours.push(edge.dest);
                    }
                }
            }
            return this._outgoingNeighbours;
        },

        getIncomingNeighbours : function () {
            if (this._incomingNeighbours === undefined) {
                this._incomingNeighbours = [];
                for (var i = 0; i < this.edges.length; i++) {
                    var edge = this.edges[i];
                    if (edge.dest === this) {
                        this._incomingNeighbours.push(edge.src);
                    }
                }
            }
            return this._incomingNeighbours;
        },

        // Notify this node that its edges have changed.
        //
        notifyEdgesChanged : function () {

            // Incoming and outgoing edges have to be recalculated
            this._outgoingNeighbours = undefined;
            this._incomingNeighbours = undefined;
        }
    }),

    EdgeWrapper : gv.Class.create({

        // Attributes holding node wrapper objects
        // (these attributes give direction to the edge).
        src  : undefined,
        dest : undefined,

        init : function (originalEdge) {
            "use strict";

            // Wrapped edge reference
            this.wrappedEdge = originalEdge;
        },

        // Split this edge in two and insert a dummy node
        // in the middle.
        //
        // wrappedGraph - Graph which should contain the new
        //                dummy node and edge.
        // srcId        - Source end which will stay on this edge
        //                the other end will be connected to the
        //                dummy node with a new edge.
        //
        // Returns the new dummy node.
        //
        insertDummyNode : function (wrappedGraph, srcId) {

            var dummyVertexCreatedId = wrappedGraph.dummyVertexCreateId !== undefined
                                          ? wrappedGraph.dummyVertexCreateId()
                                          : gv.LayoutModel.dummyVertexCreateId(),
                dummyedge = new gv.LayoutModel.DummyEdge(),
                dummynode = new gv.LayoutModel.DummyNode({
                    id : dummyVertexCreatedId
                });

            if (gv.SugiyamaLayoutDebug) console.log("Insert dummy node " + dummynode.id +
                                                    " between " + srcId + " and " +
                                                    (srcId === this.src.id ? this.dest.id
                                                                           : this.src.id));

            // Check if the dummy node should be inserted into the original graph
            if (wrappedGraph.originalGraph) {
                var originalDummyNode = wrappedGraph.dummyVertexCreate(dummyVertexCreatedId),
                    originalSrc = this.wrappedEdge.getEnd1(),
                    originalDest = this.wrappedEdge.getEnd2(),
                    originalDummyEdge1, originalDummyEdge2;

                // Remove edge in original graph
                wrappedGraph.originalGraph.edges.splice(
                    wrappedGraph.originalGraph.edges.indexOf(this.wrappedEdge), 1);
                originalSrc.edges.splice(originalSrc.edges.indexOf(this.wrappedEdge), 1);
                originalSrc.notifyEdgesChanged();
                originalDest.edges.splice(originalDest.edges.indexOf(this.wrappedEdge), 1);
                originalDest.notifyEdgesChanged();

                // Insert dummy node in original graph
                wrappedGraph.originalGraph.nodes.push(originalDummyNode);
                // Insert dummy edges in original graph
                originalDummyEdge1 = wrappedGraph.dummyEdgeCreate(originalSrc, originalDummyNode);
                wrappedGraph.originalGraph.edges.push(originalDummyEdge1);
                originalDummyEdge2 = wrappedGraph.dummyEdgeCreate(originalDummyNode, originalDest);
                wrappedGraph.originalGraph.edges.push(originalDummyEdge2);
            }

            // Add new nodes and edges to the graph
            wrappedGraph.nodes.push(dummynode);
            wrappedGraph.nodeLookup[dummynode.id] = dummynode;
            wrappedGraph.edges.push(dummyedge);

            // Update neighbours list on nodes
            this.dest.neighbours.splice(this.dest.neighbours.indexOf(this.src));
            this.dest.neighbours.push(dummynode);
            this.src.neighbours.splice(this.src.neighbours.indexOf(this.dest));
            this.src.neighbours.push(dummynode);
            dummynode.neighbours.push(this.dest);
            dummynode.neighbours.push(this.src);

            // Invalidate edges on nodes
            this.dest.notifyEdgesChanged();
            this.src.notifyEdgesChanged();

            if (srcId === this.src.id) {
                // Remove this edge from the dest node
                this.dest.edges.splice(this.dest.edges.indexOf(this), 1);
                // Insert dummy edge
                this.dest.edges.push(dummyedge);
                // Correct the node pointers on the edges
                dummyedge.dest = this.dest;
                dummyedge.src = dummynode;
                this.dest = dummynode;
            } else {
                // Remove this edge from the src node
                this.src.edges.splice(this.src.edges.indexOf(this), 1);
                // Insert dummy edge
                this.src.edges.push(dummyedge);
                // Correct the node pointers on the edges
                dummyedge.src = this.src;
                dummyedge.dest = dummynode;
                this.src = dummynode;
            }

            dummynode.edges.push(dummyedge);
            dummynode.edges.push(this);

            if (wrappedGraph.originalGraph) {
                // Update wrappedEdge pointers on the edges
                if (originalDummyEdge1.getEnd1().id === srcId) {
                    this.wrappedEdge = originalDummyEdge1;
                    dummyedge.wrappedEdge = originalDummyEdge2;
                } else {
                    this.wrappedEdge = originalDummyEdge2;
                    dummyedge.wrappedEdge = originalDummyEdge1;
                }
            }

            return dummynode;
        }
    }),

    dummyCounter : 0,

    dummyVertexCreateId : function () {
        var dummyCounterValue = gv.LayoutModel.dummyCounter;
        // Increase dummy counter
        gv.LayoutModel.dummyCounter++;
        return "dummy" + dummyCounterValue;
    },

    // Class to represent a set of vertexes
    //
    VertexSet : gv.Class.create({

        // Internal object to store data
        _set : undefined,

        // Size of this set
        size : undefined,

        // Constructor for new VertexSet
        //
        // vertexList - List of vertexes which should be
        //              added to the set.
        //
        init : function (vertexList) {
            "use strict";

            this._set = {};

            if (vertexList !== undefined) {
                for (var i = 0; i < vertexList.length; i++) {
                    var item = vertexList[i];
                    this._set[item.id] = item;
                }
                this.size = vertexList.length;
            } else {
                this.size = 0;
            }
        },

        // Check if a vertex is in this set.
        //
        // vertex - Vertex object.
        //
        contains : function (vertex) {
            "use strict";
            return this._set[vertex.id] !== undefined;
        },

        // Check if any of the vertices in a given list is in this set.
        //
        // vertexList - List of vertices.
        //
        containsAny : function (vertexList) {
            "use strict";

            for (var i = 0; i < vertexList.length; i++) {
                if (this.contains(vertexList[i])) {
                    return true;
                }
            }

            return false;
        },

        // Check if all of the vertices in a given list are in this set.
        //
        // vertexList - List of vertices.
        //
        containsAll : function (vertexList) {
            "use strict";

            for (var i = 0; i < vertexList.length; i++) {
                if (!this.contains(vertexList[i])) {
                    return false;
                }
            }

            return true;
        },

        // Check if this set has the same elements
        // as another set.
        //
        // vertexSet - Other set to check against.
        //
        equals : function (vertexSet) {

            if (this.size !== vertexSet.size) {
                return false;
            }

            for (key in this._set) {
                if (!(key in vertexSet._set)) {
                    return false;
                }
            }

            return true;
        },

        // Add a vertex to the set.
        //
        // vertex - Vertex object.
        //
        add : function (vertex) {
            if (!this.contains(vertex)) {
                this._set[vertex.id] = vertex;
                this.size++;
            }
            return vertex;
        },

        // Remove a vertex from the set.
        //
        // vertex - Vertex object.
        //
        remove : function (vertex) {
            "use strict";
            if (this.contains(vertex)) {
                delete this._set[vertex.id];
                this.size--;
            }
            return vertex;
        },

        // Set operation union
        //
        union : function (vertexSet) {
            "use strict";
            var this_set = this;
            vertexSet.each(function (item) {
                this_set.add(item);
            });
        },

        // Iterate over all vertices in this set.
        //
        // f - Iterator function - break if this function returns false.
        //
        each : function (f) {
            "use strict";
            for (var key in this._set) {
                if (f(this._set[key]) === false) {
                    return;
                }
            }
        },

        // Return the contents of this set as an array.
        //
        toList : function () {
            var list = [];
            this.each(function (item) {
                list.push(item);
            });
            return list;
        }
    })
};

gv.LayoutModel.DummyNode = gv.LayoutModel.NodeWrapper.create({
}),

gv.LayoutModel.DummyEdge = gv.LayoutModel.EdgeWrapper.create({
}),

// Abstract class for a layout algorithm.
//
gv.AbstractLayout = gv.Class.create({

    // Apply the layout.
    //
    // graph      - Graph to layout.
    // viewWidth  - Width of view.
    // viewHeight - Height of view.
    // controller - View controller.
    // state      - State of view controller.
    //
    applyLayout : function (graph, viewWidth, viewHeight, controller, state) { },

    // Move the view in position after the layout has been applied.
    //
    // graph      - Graph to layout.
    // viewWidth  - Width of view.
    // viewHeight - Height of view.
    // controller - View controller.
    // state      - State of view controller.
    //
    moveView    : function (graph, viewWidth, viewHeight, controller, state) {
        controller.centerViewToModel();
    }
});


// Simple square layout.
//
gv.SquareLayout = gv.AbstractLayout.create({

    init : function (xpad, ypad) {
        "use strict";

        if (xpad === undefined) {
            xpad = 10;
        }
        if (ypad === undefined) {
            ypad = 30;
        }
        this._xpad = xpad;
        this._ypad = ypad;
    },

    applyLayout : function (graph, viewWidth, viewHeight, controller, state) {
        "use strict";

        var ht  = 0,
            col = 0,
            row = 0,
            maxheight = 0;

        for (var i=0; i < graph.nodes.length; i++) {
            var node = graph.nodes[i];

            maxheight = Math.max(maxheight, node.height);

            node.movePosition({x:col, y:row});
            col += node.width + this._xpad;

            if (col > viewWidth - this._xpad*2) {
                row += maxheight + this._ypad;
                col = 0;
                maxheight = 0;
            }
        }
    },

    moveView : function (graph, viewWidth, viewHeight, controller, state) {

        // Move view to the top
        controller.moveView({
            x: viewWidth / 2 - this._xpad,
            y: viewHeight / 3
        }, 1);
    }
});


// Simple circle layout.
//
gv.CircleLayout = gv.AbstractLayout.create({

    init : function (xpad, ypad) {
        "use strict";

        if (xpad === undefined) {
            xpad = 50;
        }
        if (ypad === undefined) {
            ypad = 50;
        }
        this._xpad = xpad;
        this._ypad = ypad;
    },

    applyLayout : function (graph, viewWidth, viewHeight, controller, state) {
        "use strict";

        var delta = 2 * Math.PI / graph.nodes.length,
            step = 0;


        for (var i=0; i < graph.nodes.length; i++) {
            var node = graph.nodes[i];

            node.movePosition({
                x : Math.cos(step) * this._xpad,
                y : Math.sin(step) * this._ypad
            });

            step += delta;
        }
    },

    moveView : function (graph, viewWidth, viewHeight, controller, state) {
        "use strict";
       controller.centerViewToModel();
     }
});


// Common functions
// ================


gv.common = {

    breadthFirstSearch : function (rootNode, visitFunction, getNeighbourFunction) {
        "use strict";
        var queue = [],
            visited = {};

        queue.push(rootNode);
        visitFunction(rootNode)
        visited[rootNode.id] = rootNode;

        while(queue.length > 0) {
            var visitedNode = queue.shift(),
                neighbours;

            if (getNeighbourFunction === undefined) {
                neighbours = visitedNode.getNeighbours();
            } else {
                neighbours = getNeighbourFunction(visitedNode);
            }

            for (var i = 0; i < neighbours.length; i++) {
                var neighbour = neighbours[i];

                if (visited[neighbour.id] === undefined) {
                    queue.push(neighbour);
                    visitFunction(neighbour)
                    visited[neighbour.id] = neighbour;
                }
            }
        }
    },

    depthFirstSearch : function (rootNode, visitFunction, getNeighbourFunction,
                                 cycleFoundFunction) {
        "use strict";

        var visited = {},
            search = function (visitedNode, path) {
                var neighbours;

                if (cycleFoundFunction !== undefined) {
                    // Keep track of path if we look for cycles
                    path = path.concat([visitedNode.id])
                }
                visitFunction(visitedNode)
                visited[visitedNode.id] = visitedNode;

                if (getNeighbourFunction === undefined) {
                    neighbours = visitedNode.getNeighbours();
                } else {
                    neighbours = getNeighbourFunction(visitedNode);
                }

                for (var i = 0; i < neighbours.length; i++) {
                    var neighbour = neighbours[i];

                    if (visited[neighbour.id] === undefined) {
                        search(neighbour, path);
                    } else if (cycleFoundFunction !== undefined) {
                        cycleFoundFunction(visitedNode, neighbour, path);
                    }
                }
            };

        search(rootNode, []);
    }
}


// Polyfill functions
// ==================


// Production steps of ECMA-262, Edition 5, 15.4.4.19
// Reference: http://es5.github.com/#x15.4.4.19
// Taken from: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map
if (!Array.prototype.map) {

  Array.prototype.map = function (callback, thisArg) {

    var T, A, k;

    if (this == null) {
      throw new TypeError(" this is null or not defined");
    }

    // 1. Let O be the result of calling ToObject passing the |this| value as the argument.
    var O = Object(this);

    // 2. Let lenValue be the result of calling the Get internal method of O with the argument "length".
    // 3. Let len be ToUint32(lenValue).
    var len = O.length >>> 0;

    // 4. If IsCallable(callback) is false, throw a TypeError exception.
    // See: http://es5.github.com/#x9.11
    if (typeof callback !== "function") {
      throw new TypeError(callback + " is not a function");
    }

    // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
    if (thisArg) {
      T = thisArg;
    }

    // 6. Let A be a new array created as if by the expression new Array( len) where Array is
    // the standard built-in constructor with that name and len is the value of len.
    A = new Array(len);

    // 7. Let k be 0
    k = 0;

    // 8. Repeat, while k < len
    while (k < len) {

      var kValue, mappedValue;

      // a. Let Pk be ToString(k).
      //   This is implicit for LHS operands of the in operator
      // b. Let kPresent be the result of calling the HasProperty internal method of O with argument Pk.
      //   This step can be combined with c
      // c. If kPresent is true, then
      if (k in O) {

        var Pk = k.toString(); // This was missing per item a. of the above comment block and was not working in IE8 as a result

        // i. Let kValue be the result of calling the Get internal method of O with argument Pk.
        kValue = O[Pk];

        // ii. Let mappedValue be the result of calling the Call internal method of callback
        // with T as the this value and argument list containing kValue, k, and O.
        mappedValue = callback.call(T, kValue, k, O);

        // iii. Call the DefineOwnProperty internal method of A with arguments
        // Pk, Property Descriptor {Value: mappedValue, Writable: true, Enumerable: true, Configurable: true},
        // and false.

        // In browsers that support Object.defineProperty, use the following:
        // Object.defineProperty( A, Pk, { value: mappedValue, writable: true, enumerable: true, configurable: true });

        // For best browser support, use the following:
        A[Pk] = mappedValue;
      }
      // d. Increase k by 1.
      k++;
    }

    // 9. return A
    return A;
  };
}
