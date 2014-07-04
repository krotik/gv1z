# Gv1z - Graph Visualization Engine

Canvas based graph visualization engine. This implementation is not bound to any library (i.e. works with or without Prototype / JQuery) and should work with all recent browsers which support the canvas element.

## Author

Gv1z was written by [Matthias Ladkau](http://www.ladkau.de).

The gv.ForceDirectedLayout layout is based on: 

Springy
by Dennis Hotson
http://github.com/dhotson/springy

## License

Gv1z is released under the [MIT license](http://mit-license.org).

## How to use

Best take a look in the example folder. There are simple demos which demonstrate the basic concepts.

1. Define a graph

```js
var graph = {

    nodes : [
        new gv.SimpleNode("0", new gv.Point(0,0)),
        new gv.SimpleNode("1", new gv.Point(0,0)),
        ...
    ]
};

graph.edges = [
    new gv.SimpleEdge(graph.nodes[1], graph.nodes[0]),
    ...
];
```

You can add custom functionality to the objects by subclassing.

```js
var MyNodeClass = gv.SimpleNode.create({

    init : function (id, point) {
        "use strict";
        this._super(id, point);

        // HERE: custom constructor code
    },
    
    myFunction : function (arg1, arg2) {
        "use strict";

        // HERE: custom function code
    }
});
```

after this you can simply write:

```js
new MyNodeClass("3", new gv.Point(0,0))
```

Before you can start you need to define the main controller:

```js
var controller = new gv.MainController("<id of main canvas>", {
        screenWidth  : 400,
        screenHeight : 400,
        moveSpeed    : 200,
        ...
    });
```

The main canvas object which is given here will be resized according to the given dimensions.
Other available options (with their default values) are:

```
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

// Move speed for objects
moveSpeed     : 30,

// Drawing more than 10000 edges at a time
// does not show anything useful
maxVisibleEdges : 10000,

// Initial view position
defaultViewX  : 0,
defaultViewY  : 0,
defaultZoom   : 1,

// Initial mode of operation
initialMode   : gv.mode.NAVIGATION (other modes are: gv.mode.DRAGGING and gv.mode.ZOOM)
```

After the controller has been defined you need to start the graph rendering by giving the controller the graph:

```js
c.start(graph);
```

If desired the controller can also render an overview on a smaller canvas. An overview allows you to quickly navigate in the graph.

```js
controller.startOverview("<id of overview canvas>");
```

After the graph is now rendering it is time to assign a layout:

```js
controller.applyLayout(new gv.CircleLayout(50, 100));
```

## Layouts

Each layout is given the xpad and ypad parameter which determines the spacing between nodes. For more complex layouts there might be a third option object available.
Depending on the included files the following layouts are available:

### gv.SquareLayout (build-in)

Simple layout which arranges all nodes in a square without considering edges.

### gv.CircleLayout (build-in)

Simple layout which arranges all nodes in a circle without considering edges.

### gv.SugiyamaLayout

Hierarchical layout based on the Sugiyama framework.

Available options (with their defaults):

```
// Insert dummy vertices into the graph (this gives better edge routing)
insertDummyVertices : false

// Apply a heuristic to minimize insertion of dummy nodes (this gives a more compact layout)
optimizeLayout      : true
```

### gv.ForceDirectedLayout

Simple force directed layout. A simulation where edges are seen as springs and nodes are seen as charged particles which repulse each other.

Available options (with their defaults):

```
// Stiffness of the edges (springs)
stiffness : 400.0
// Repulsion factor of the nodes (charged particles)
repulsion : 400.0
// Damping factor which determines how quickly the simulation finishes (how quickly energy is consumed).
damping   : 0.5
// Threshold which determines when the simulation finishes (minimal amount of energy which can be simulated).
stopThreshold : 0.1
```