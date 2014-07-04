/*
 Unit tests for sugiyama_layout.js
 */

test("Test Wrapped Graph", function() {
    "use strict";
    var graph = {

        nodes : [
            new gv.SimpleNode("0", new gv.Point(0,0)),
            new gv.SimpleNode("1", new gv.Point(0,0)),
            new gv.SimpleNode("2", new gv.Point(0,0)),
            new gv.SimpleNode("3", new gv.Point(0,0)),
            new gv.SimpleNode("4", new gv.Point(0,0)),
            new gv.SimpleNode("5", new gv.Point(0,0))
        ]
    };

    graph.edges = [
        new gv.SimpleEdge(graph.nodes[0], graph.nodes[1]),
        new gv.SimpleEdge(graph.nodes[0], graph.nodes[2]),
        new gv.SimpleEdge(graph.nodes[0], graph.nodes[3]),
        new gv.SimpleEdge(graph.nodes[0], graph.nodes[4]),
        new gv.SimpleEdge(graph.nodes[4], graph.nodes[5]),
        new gv.SimpleEdge(graph.nodes[5], graph.nodes[0]),
        new gv.SimpleEdge(graph.nodes[1], graph.nodes[2])
    ];

    var layout = new gv.SugiyamaLayout(),
        wrappedGraph = layout._wrapGraph(graph);

    // Reset dummy counter
    gv.LayoutModel.dummyCounter = 0;

    deepEqual(wrappedGraph.nodes[0].getIncomingNeighbours().map(function (item) {
        return item.id;
    }), ["5"], "Correct incoming edges are calculated" );

    deepEqual(wrappedGraph.nodes[0].getOutgoingNeighbours().map(function (item) {
        return item.id;
    }), ["1", "2", "3", "4"], "Correct outgoing edges are calculated" );
});

test("Test Cycle Removal", function() {
    "use strict";

    var graph = {

        nodes : [
            new gv.SimpleNode("0", new gv.Point(0,0)),
            new gv.SimpleNode("1", new gv.Point(0,0)),
            new gv.SimpleNode("2", new gv.Point(0,0)),
            new gv.SimpleNode("3", new gv.Point(0,0)),
            new gv.SimpleNode("4", new gv.Point(0,0)),
            new gv.SimpleNode("5", new gv.Point(0,0))
        ]
    };

    graph.edges = [
        new gv.SimpleEdge(graph.nodes[0], graph.nodes[1]),
        new gv.SimpleEdge(graph.nodes[0], graph.nodes[2]),
        new gv.SimpleEdge(graph.nodes[0], graph.nodes[3]),
        new gv.SimpleEdge(graph.nodes[0], graph.nodes[4]),
        new gv.SimpleEdge(graph.nodes[4], graph.nodes[5]),
        new gv.SimpleEdge(graph.nodes[5], graph.nodes[0]),
        new gv.SimpleEdge(graph.nodes[1], graph.nodes[2])
    ];

    var layout = new gv.SugiyamaLayout(),
        wrappedGraph = layout._wrapGraph(graph);

    // Reset dummy counter
    gv.LayoutModel.dummyCounter = 0;

    // Check that nodes and edges have been wrapped

    for (var i = 0; i < wrappedGraph.nodes.length; i++) {
        var node = wrappedGraph.nodes[i];
        ok(node instanceof gv.LayoutModel.NodeWrapper, "Node wrapped" );
    }

    for (var i = 0; i < wrappedGraph.edges.length; i++) {
        var edge = wrappedGraph.edges[i];
        ok(edge instanceof gv.LayoutModel.EdgeWrapper, "Edge wrapped" );
    }

    // Do a BFS and DFS to check if the connectivity is correct

    var bfsnodes = [];
    // BFS search on the undirected graph
    gv.common.breadthFirstSearch(wrappedGraph.nodes[5], function (node) {
        bfsnodes.push(node.id);
    });

    deepEqual(bfsnodes, ["5", "4", "0", "1", "2", "3"], "Breadth first search returns the correct order" );

    bfsnodes = [];
    // BFS search on the directed graph
    gv.common.breadthFirstSearch(wrappedGraph.nodes[5], function (node) {
        bfsnodes.push(node.id);
    }, function (node) {
        return node.getOutgoingNeighbours();
    });

    deepEqual(bfsnodes, ["5", "0", "1", "2", "3", "4"], "Breadth first search returns the correct order" );

    var dfsnodes = [],
        dfscycle = [];
    // DFS search on the directed graph with cycle detection
    gv.common.depthFirstSearch(wrappedGraph.nodes[5], function (node) {
        dfsnodes.push(node.id);
    }, function (node) {
        return node.getOutgoingNeighbours();
    }, function (src, alreadyVisitedNode, path) {
        if (path.indexOf(alreadyVisitedNode.id) !== -1) {
            dfscycle.push(src.id);
            dfscycle.push(alreadyVisitedNode.id);
        }
    });

    deepEqual(dfsnodes, ["5", "0", "1", "2", "3", "4"], "Depth first search returns the correct order" );
    deepEqual(dfscycle, ["4", "5"], "Depth first search detects cycle correctly" );

    // Check cycle removal

    layout._removeCycles(wrappedGraph);

    dfscycle = [];
    // DFS search on the directed graph with cycle detection
    gv.common.depthFirstSearch(wrappedGraph.nodes[5], function (node) {
    }, function (node) {
        return node.getOutgoingNeighbours();
    }, function (src, alreadyVisitedNode, path) {
        if (path.indexOf(alreadyVisitedNode.id) !== -1) {
            dfscycle.push(src.id);
            dfscycle.push(alreadyVisitedNode.id);
        }
    });
    deepEqual(dfscycle, [], "No more cycles after cycle removal" );

});

test("Test Vertex Set", function() {
    "use strict";

    var nodes = [
        new gv.SimpleNode("0", new gv.Point(0,0)),
        new gv.SimpleNode("1", new gv.Point(0,0)),
        new gv.SimpleNode("2", new gv.Point(0,0)),
        new gv.SimpleNode("3", new gv.Point(0,0)),
        new gv.SimpleNode("4", new gv.Point(0,0))
    ],
    vertexSet = new gv.LayoutModel.VertexSet(nodes),
    testList;

    ok(vertexSet.contains(new gv.SimpleNode("2", new gv.Point(0,0))), "Set contains expected node");
    equal(vertexSet.contains(new gv.SimpleNode("6", new gv.Point(0,0))), false);

    // Remove an item from the set

    vertexSet.remove(nodes[2]);

    equal(vertexSet.contains(new gv.SimpleNode("2", new gv.Point(0,0))), false);

    // Check that the set has the correct content

    testList = [];
    vertexSet.each(function (vertex) {
        testList.push(vertex.id);
    });
    testList.sort();
    deepEqual(testList, [ "0", "1", "3", "4" ], "Item is removed from the set" );

    // Add an item to the set

    vertexSet.add(new gv.SimpleNode("5", new gv.Point(0,0)));

    // Check that the entry was added

    ok(vertexSet.contains(new gv.SimpleNode("5", new gv.Point(0,0))), "Set contains expected node");
    ok(vertexSet.containsAny( [ new gv.SimpleNode("50", new gv.Point(0,0)),
                                new gv.SimpleNode("60", new gv.Point(0,0)),
                                new gv.SimpleNode("5", new gv.Point(0,0)) ] ), "Set contains expected nodes");

    ok(vertexSet.containsAll( [ new gv.SimpleNode("1", new gv.Point(0,0)),
                                new gv.SimpleNode("3", new gv.Point(0,0)),
                                new gv.SimpleNode("5", new gv.Point(0,0)) ] ), "Set contains all expected nodes");

    ok(!vertexSet.containsAll( [ new gv.SimpleNode("10", new gv.Point(0,0)),
                                 new gv.SimpleNode("2", new gv.Point(0,0)),
                                 new gv.SimpleNode("5", new gv.Point(0,0)) ] ), "Set contains expected nodes");

    testList = [];
    vertexSet.each(function (vertex) {
        testList.push(vertex.id);
    });
    testList.sort();
    deepEqual(testList, [ "0", "1", "3", "4", "5" ], "Item is added to the set" );

    var vertexSet1 = new gv.LayoutModel.VertexSet(),
        vertexSet2 = new gv.LayoutModel.VertexSet();

    vertexSet1.add(new gv.SimpleNode("1", new gv.Point(0,0)));
    vertexSet1.add(new gv.SimpleNode("2", new gv.Point(0,0)));
    vertexSet1.add(new gv.SimpleNode("3", new gv.Point(0,0)));

    vertexSet2.add(new gv.SimpleNode("1", new gv.Point(0,0)));
    vertexSet2.add(new gv.SimpleNode("2", new gv.Point(0,0)));

    equal(vertexSet2.equals(vertexSet1), false);
    equal(vertexSet1.equals(vertexSet2), false);

    vertexSet2.add(new gv.SimpleNode("3", new gv.Point(0,0)));

    equal(vertexSet1.equals(vertexSet2), true);
});

test("Test Layer Assignment", function() {
    "use strict";

    var graph = {

        nodes : [
            new gv.SimpleNode("0", new gv.Point(0,0)),
            new gv.SimpleNode("1", new gv.Point(0,0)),
            new gv.SimpleNode("2", new gv.Point(0,0)),
            new gv.SimpleNode("3", new gv.Point(0,0)),
            new gv.SimpleNode("4", new gv.Point(0,0)),
            new gv.SimpleNode("5", new gv.Point(0,0)),
            new gv.SimpleNode("6", new gv.Point(0,0)),
            new gv.SimpleNode("7", new gv.Point(0,0))
        ]
    };

    graph.edges = [
        new gv.SimpleEdge(graph.nodes[1], graph.nodes[0]),
        new gv.SimpleEdge(graph.nodes[2], graph.nodes[0]),
        new gv.SimpleEdge(graph.nodes[3], graph.nodes[1]),
        new gv.SimpleEdge(graph.nodes[3], graph.nodes[4]),
        new gv.SimpleEdge(graph.nodes[7], graph.nodes[3]),
        new gv.SimpleEdge(graph.nodes[7], graph.nodes[4]),
        new gv.SimpleEdge(graph.nodes[7], graph.nodes[6]),
        new gv.SimpleEdge(graph.nodes[6], graph.nodes[4]),
        new gv.SimpleEdge(graph.nodes[6], graph.nodes[5])
    ];

    var layout = new gv.SugiyamaLayout(),
        wrappedGraph = layout._wrapGraph(graph),
        layers = [];

    // Reset dummy counter
    gv.LayoutModel.dummyCounter = 0;

    layout._assignLayersLongestPath(wrappedGraph, function (vertex, layer) {
        layers.push([layer, vertex.id]);
    });

    deepEqual(layers, [ [1, "0"], [1, "4"], [1, "5"],
                        [2, "1"], [2, "2"], [2, "6"],
                        [3, "3"],
                        [4, "7"] ],
              "Layers get correctly assigned");

    // Test further with vertex promotion

    // Construct the layering as a vertex map with the
    // vertex id as key and the layer as value.
    var layering = {};
    layout._assignLayersLongestPath(wrappedGraph, function (vertex, layer) {
        layering[vertex.id] = layer;
    });


    var newLayering = layout._optimizeLayersVertexPromotion(wrappedGraph, layering);

    deepEqual(layering, {
        "0": 1,
        "4": 1,
        "5": 1,
        "2": 2,
        "1": 2,
        "6": 2,
        "3": 3,
        "7": 4
    });

    deepEqual(newLayering, {
        "0": 1,
        "2": 2,
        "1": 2,
        "4": 2,
        "5": 2,
        "3": 3,
        "6": 3,
        "7": 4
    });
});

test("Test Node Dummy Node Insertion", function() {
    "use strict";

    var graph = {

        nodes : [
            new gv.SimpleNode("0", new gv.Point(0,0)),
            new gv.SimpleNode("1", new gv.Point(0,0)),
            new gv.SimpleNode("2", new gv.Point(0,0)),
            new gv.SimpleNode("3", new gv.Point(0,0)),
            new gv.SimpleNode("4", new gv.Point(0,0)),
            new gv.SimpleNode("5", new gv.Point(0,0)),
            new gv.SimpleNode("6", new gv.Point(0,0)),
            new gv.SimpleNode("7", new gv.Point(0,0))
        ]
    };

    graph.edges = [
        new gv.SimpleEdge(graph.nodes[1], graph.nodes[0]),
        new gv.SimpleEdge(graph.nodes[2], graph.nodes[0]),
        new gv.SimpleEdge(graph.nodes[3], graph.nodes[1]),
        new gv.SimpleEdge(graph.nodes[3], graph.nodes[4]),
        new gv.SimpleEdge(graph.nodes[7], graph.nodes[3]),
        new gv.SimpleEdge(graph.nodes[7], graph.nodes[4]),
        new gv.SimpleEdge(graph.nodes[7], graph.nodes[6]),
        new gv.SimpleEdge(graph.nodes[6], graph.nodes[4]),
        new gv.SimpleEdge(graph.nodes[6], graph.nodes[5])
    ];

    var layout = new gv.SugiyamaLayout(),
        wrappedGraph = layout._wrapGraph(graph),
        layers;

    // Reset dummy counter
    gv.LayoutModel.dummyCounter = 0;

    var layering = {};
    layout._assignLayersLongestPath(wrappedGraph, function (vertex, layer) {
        layering[vertex.id] = layer;
    });

    deepEqual(layering, {
        "0": 1,
        "4": 1,
        "5": 1,
        "2": 2,
        "1": 2,
        "6": 2,
        "3": 3,
        "7": 4
    });

    // Create dummy vertices for the original layout
    layers = layout._createLayersWithDummyNodes(wrappedGraph, layering);

    deepEqual(layers, {
        "4": [ "7" ],
        "3": [ "3", "dummy2", "dummy3" ],
        "2": [ "1", "2", "dummy0", "dummy1", "6" ],
        "1": [ "0", "4", "5" ]
    });

    deepEqual(wrappedGraph.nodes.length, 12);
    deepEqual(wrappedGraph.edges.length, 13);

    // Make sure the dummy nodes and edges are there as expected
    deepEqual(wrappedGraph.nodeLookup["dummy0"].neighbours.map(function (item) { return item.id }), [ "4", "3" ]);
    deepEqual(wrappedGraph.nodeLookup["dummy1"].neighbours.map(function (item) { return item.id }), [ "4", "dummy2" ]);
    deepEqual(wrappedGraph.nodeLookup["dummy2"].neighbours.map(function (item) { return item.id }), [ "dummy1", "7" ]);
    deepEqual(wrappedGraph.nodeLookup["dummy3"].neighbours.map(function (item) { return item.id }), [ "6", "7" ]);

    ok(wrappedGraph.nodeLookup["4"].getEdgeTo("3") === undefined, "No direct edge from 4 to 3");
    equal(wrappedGraph.nodeLookup["4"].getEdgeTo("dummy0").src.id, "dummy0");
    equal(wrappedGraph.nodeLookup["dummy0"].getEdgeTo("3").src.id, "3");
    equal(wrappedGraph.nodeLookup["4"].getEdgeTo("dummy1").src.id, "dummy1");
    equal(wrappedGraph.nodeLookup["dummy1"].getEdgeTo("dummy2").src.id, "dummy2");
    equal(wrappedGraph.nodeLookup["dummy2"].getEdgeTo("7").src.id, "7");
    equal(wrappedGraph.nodeLookup["6"].getEdgeTo("dummy3").src.id, "dummy3");
    equal(wrappedGraph.nodeLookup["dummy3"].getEdgeTo("7").src.id, "7");

    // Produce another wrapped graph and now try the optimized version of the layering

    wrappedGraph = layout._wrapGraph(graph),

    layering = {}
    layout._assignLayersLongestPath(wrappedGraph, function (vertex, layer) {
        layering[vertex.id] = layer;
    });

    var newLayering = layout._optimizeLayersVertexPromotion(wrappedGraph, layering);

    // Reset dummy counter
    gv.LayoutModel.dummyCounter = 0;

    layers = layout._createLayersWithDummyNodes(wrappedGraph, newLayering);

    // Only one dummy vertex should be inserted

    deepEqual(wrappedGraph.nodes.length, 9);
    deepEqual(wrappedGraph.edges.length, 10);

    deepEqual(layers, {
        "4": [ "7" ],
        "3": [ "3", "dummy0", "6" ],
        "2": [ "1", "2", "4", "5" ],
        "1": [ "0" ]
    });

    deepEqual(wrappedGraph.nodeLookup["dummy0"].neighbours.map(function (item) { return item.id }), [ "4", "7" ]);

    equal(wrappedGraph.nodeLookup["4"].getEdgeTo("dummy0").src.id, "dummy0");
    equal(wrappedGraph.nodeLookup["dummy0"].getEdgeTo("7").src.id, "7");
});

test("Test Node Positioning", function() {
    "use strict";

    var graph = {

        nodes : [
            new gv.SimpleNode("0", new gv.Point(0,0)),
            new gv.SimpleNode("1", new gv.Point(0,0)),
            new gv.SimpleNode("2", new gv.Point(0,0)),
            new gv.SimpleNode("3", new gv.Point(0,0)),
            new gv.SimpleNode("4", new gv.Point(0,0)),
            new gv.SimpleNode("5", new gv.Point(0,0)),
            new gv.SimpleNode("6", new gv.Point(0,0)),
            new gv.SimpleNode("7", new gv.Point(0,0))
        ]
    };

    graph.edges = [
        new gv.SimpleEdge(graph.nodes[1], graph.nodes[0]),
        new gv.SimpleEdge(graph.nodes[2], graph.nodes[0]),
        new gv.SimpleEdge(graph.nodes[3], graph.nodes[1]),
        new gv.SimpleEdge(graph.nodes[3], graph.nodes[4]),
        new gv.SimpleEdge(graph.nodes[7], graph.nodes[3]),
        new gv.SimpleEdge(graph.nodes[7], graph.nodes[4]),
        new gv.SimpleEdge(graph.nodes[7], graph.nodes[6]),
        new gv.SimpleEdge(graph.nodes[6], graph.nodes[4]),
        new gv.SimpleEdge(graph.nodes[6], graph.nodes[5])
    ];

    var layout = new gv.SugiyamaLayout(),
        wrappedGraph = layout._wrapGraph(graph),
        layers;

    // Reset dummy counter
    gv.LayoutModel.dummyCounter = 0;

    var layering = {};
    layout._assignLayersLongestPath(wrappedGraph, function (vertex, layer) {
        layering[vertex.id] = layer;
    });

    layers = layout._createLayersWithDummyNodes(wrappedGraph, layering);

    deepEqual(layers, {
        "4": [ "7" ],
        "3": [ "3", "dummy2", "dummy3" ],
        "2": [ "1", "2", "dummy0", "dummy1", "6" ],
        "1": [ "0", "4", "5" ]
    });

    layout._moveNodesToBaryCenter(wrappedGraph, layers);

    equal(wrappedGraph.nodeLookup["0"].xpos, 2);
    equal(wrappedGraph.nodeLookup["4"].xpos, 4);
    equal(wrappedGraph.nodeLookup["5"].xpos, 6);
    equal(wrappedGraph.nodeLookup["1"].xpos, 1.6666666666666665);
    equal(wrappedGraph.nodeLookup["2"].xpos, 2.333333333333333);
    equal(wrappedGraph.nodeLookup["dummy0"].xpos, 3.6666666666666665);
    equal(wrappedGraph.nodeLookup["dummy1"].xpos, 	4.333333333333333);
    equal(wrappedGraph.nodeLookup["6"].xpos, 5);
    equal(wrappedGraph.nodeLookup["3"].xpos, 3);
    equal(wrappedGraph.nodeLookup["dummy2"].xpos, 4);
    equal(wrappedGraph.nodeLookup["dummy3"].xpos, 5);
    equal(wrappedGraph.nodeLookup["7"].xpos, 4);

    // Do the test again with the optimized version

    wrappedGraph = layout._wrapGraph(graph);
    var layering = {};
    layout._assignLayersLongestPath(wrappedGraph, function (vertex, layer) {
        layering[vertex.id] = layer;
    });

    var newLayering = layout._optimizeLayersVertexPromotion(wrappedGraph, layering);

    // Reset dummy counter
    gv.LayoutModel.dummyCounter = 0;

    layers = layout._createLayersWithDummyNodes(wrappedGraph, newLayering);

    layout._moveNodesToBaryCenter(wrappedGraph, layers);

    deepEqual(layers, {
        "4": [ "7" ],
        "3": [ "3", "dummy0", "6" ],
        "2": [ "1", "2", "4", "5" ],
        "1": [ "0" ]
    });

    equal(wrappedGraph.nodeLookup["0"].xpos, 2);
    equal(wrappedGraph.nodeLookup["1"].xpos, 1.6666666666666665);
    equal(wrappedGraph.nodeLookup["2"].xpos, 2.333333333333333);
    equal(wrappedGraph.nodeLookup["4"].xpos, 4);
    equal(wrappedGraph.nodeLookup["5"].xpos, 6);
    equal(wrappedGraph.nodeLookup["3"].xpos, 3);
    equal(wrappedGraph.nodeLookup["dummy0"].xpos, 4);
    equal(wrappedGraph.nodeLookup["6"].xpos, 5);
    equal(wrappedGraph.nodeLookup["7"].xpos, 4);
});

test("Test Edge Crossing Detection", function() {
    "use strict";

    var graph = {

        nodes : [
            new gv.SimpleNode("a", new gv.Point(0,0)), // 0
            new gv.SimpleNode("b", new gv.Point(0,0)), // 1
            new gv.SimpleNode("c", new gv.Point(0,0)), // 2
            new gv.SimpleNode("d", new gv.Point(0,0)), // 3
            new gv.SimpleNode("e", new gv.Point(0,0)), // 4
            new gv.SimpleNode("f", new gv.Point(0,0)), // 5
            new gv.SimpleNode("g", new gv.Point(0,0))  // 6
        ]
    };

    graph.edges = [
        new gv.SimpleEdge(graph.nodes[4], graph.nodes[2]),
        new gv.SimpleEdge(graph.nodes[5], graph.nodes[0]),
        new gv.SimpleEdge(graph.nodes[5], graph.nodes[1]),
        new gv.SimpleEdge(graph.nodes[5], graph.nodes[3]),
        new gv.SimpleEdge(graph.nodes[6], graph.nodes[1]),
        new gv.SimpleEdge(graph.nodes[6], graph.nodes[2])
    ];

    var layout = new gv.SugiyamaLayout(),
        wrappedGraph = layout._wrapGraph(graph),
        layers = {
            "2" : [ "a", "b", "c", "d" ],
            "1" : [ "e", "f", "g" ]
        };

    // Reset dummy counter
    gv.LayoutModel.dummyCounter = 0;

    // Parameters
    var lUp = layers["2"],
        lDown = layers["1"];

    ok(5 === layout._calculateEdgeCrossings(wrappedGraph, lUp, lDown),
       "Correct number of edge crossings");
});

test("Test Special cases", function() {
    "use strict";

    var graph = {

        nodes : [
            new gv.SimpleNode("0", new gv.Point(0,0)),
            new gv.SimpleNode("1", new gv.Point(0,0)),
            new gv.SimpleNode("2", new gv.Point(0,0)),
            new gv.SimpleNode("3", new gv.Point(0,0)),
            new gv.SimpleNode("4", new gv.Point(0,0)),
            new gv.SimpleNode("5", new gv.Point(0,0)),
            new gv.SimpleNode("6", new gv.Point(0,0)),
            new gv.SimpleNode("7", new gv.Point(0,0)),

            // Create a separate graph
            new gv.SimpleNode("a", new gv.Point(0,0)), //  8
            new gv.SimpleNode("b", new gv.Point(0,0)), //  9
            new gv.SimpleNode("c", new gv.Point(0,0)), // 10
            new gv.SimpleNode("d", new gv.Point(0,0)), // 11

            // Create orphan nodes
            new gv.SimpleNode("o1", new gv.Point(0,0)), // 12
            new gv.SimpleNode("o2", new gv.Point(0,0))  // 13
        ]
    };

    graph.edges = [
        new gv.SimpleEdge(graph.nodes[1], graph.nodes[0]),
        new gv.SimpleEdge(graph.nodes[2], graph.nodes[0]),
        new gv.SimpleEdge(graph.nodes[3], graph.nodes[1]),
        new gv.SimpleEdge(graph.nodes[3], graph.nodes[4]),
        new gv.SimpleEdge(graph.nodes[7], graph.nodes[3]),
        new gv.SimpleEdge(graph.nodes[7], graph.nodes[4]),
        new gv.SimpleEdge(graph.nodes[7], graph.nodes[6]),
        new gv.SimpleEdge(graph.nodes[6], graph.nodes[4]),
        new gv.SimpleEdge(graph.nodes[6], graph.nodes[5]),

        // Create a circle
        new gv.SimpleEdge(graph.nodes[0], graph.nodes[3]),

        // Create a recursive relationship
        new gv.SimpleEdge(graph.nodes[2], graph.nodes[2]),
        new gv.SimpleEdge(graph.nodes[0], graph.nodes[0]),

        // Create a circle in a separate graph
        new gv.SimpleEdge(graph.nodes[8], graph.nodes[9]),
        new gv.SimpleEdge(graph.nodes[9], graph.nodes[10]),
        new gv.SimpleEdge(graph.nodes[10], graph.nodes[8]),
        new gv.SimpleEdge(graph.nodes[10], graph.nodes[11])
    ];

    var layout = new gv.SugiyamaLayout(),
        wrappedGraph = layout._wrapGraph(graph),
        layers;

    var detectCycle = function (startNode) {
        var dfscycle = [];
        // DFS search on the directed graph with cycle detection
        gv.common.depthFirstSearch(startNode, function (node) {
        }, function (node) {
            return node.getOutgoingNeighbours();
        }, function (src, alreadyVisitedNode, path) {
            if (path.indexOf(alreadyVisitedNode.id) !== -1) {
                dfscycle.push([src.id, alreadyVisitedNode.id]);
            }
        });
        return dfscycle;
    }

    // Recursive edges are ignored in the original graph
    deepEqual(graph.nodes[0].getNeighbours().map(function (i) { return i.id }),
              ["1", "2", "3"]);

    // Recursive edges are ignored in the wrapped graph
    deepEqual(wrappedGraph.nodes[0].getNeighbours().map(function (i) { return i.id }),
              ["1", "2", "3"]);

    ok(detectCycle(wrappedGraph.nodes[0]).length > 0, "There should be a cycle");
    ok(detectCycle(wrappedGraph.nodes[8]).length > 0, "There should be a cycle");

    // Check cycle removal on all subgraphs

    layout._removeCycles(wrappedGraph);

    ok(detectCycle(wrappedGraph.nodes[0]).length === 0, "There should be no cycle");
    ok(detectCycle(wrappedGraph.nodes[8]).length === 0, "There should be no cycle");

    var layering = {}
    layout._assignLayersLongestPath(wrappedGraph, function (vertex, layer) {
        layering[vertex.id] = layer;
    });

    var newLayering = layout._optimizeLayersVertexPromotion(wrappedGraph, layering);

    // Reset dummy counter
    gv.LayoutModel.dummyCounter = 0;

    layers = layout._createLayersWithDummyNodes(wrappedGraph, newLayering);

    deepEqual(layers, {
        "1": [ "1", "4", "5", "d", "o1", "o2" ],
        "2": [ "dummy0", "3", "dummy1", "6", "c" ],
        "3": [ "0", "7", "dummy2", "b" ],
        "4": [ "2", "a" ]
    });

    layout._moveNodesToBaryCenter(wrappedGraph, layers);

    equal(wrappedGraph.nodeLookup["0"].xpos, 2.5);
    equal(wrappedGraph.nodeLookup["a"].xpos, 8);
    equal(wrappedGraph.nodeLookup["o1"].xpos, 10);
});
