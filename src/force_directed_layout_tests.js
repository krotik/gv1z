/*
 Unit tests for force_directed_layout.js
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

    var layout = new gv.ForceDirectedLayout(),
        wrappedGraph = layout._wrapGraph(graph);

    // Reset dummy counter
    gv.LayoutModel.dummyCounter = 0;

    deepEqual(wrappedGraph.nodes[0].getIncomingNeighbours().map(function (item) {
        return item.id;
    }), ["5"], "Correct incoming edges are calculated" );

    deepEqual(wrappedGraph.nodes[0].getOutgoingNeighbours().map(function (item) {
        return item.id;
    }), ["1", "2", "3", "4"], "Correct outgoing edges are calculated" );

    // Nodes have expected attributes
    deepEqual(wrappedGraph.nodes[0].pos, { x:50, y:0 });
    equal(wrappedGraph.nodes[0].mass, 1);
    deepEqual(wrappedGraph.nodes[0].vel, { x:0, y:0 });
    deepEqual(wrappedGraph.nodes[0].acc, { x:0, y:0 });
});

test("Test Main Physics", function() {
    "use strict";

    var graph = {

        nodes : [
            new gv.SimpleNode("0", new gv.Point(0,0)),
            new gv.SimpleNode("1", new gv.Point(0,0))
        ]
    };

    graph.edges = [
        new gv.SimpleEdge(graph.nodes[0], graph.nodes[1])
    ];

    var layout = new gv.ForceDirectedLayout(),
        wrappedGraph = layout._wrapGraph(graph);

    wrappedGraph.nodes[0].pos.x = 0.1;
    wrappedGraph.nodes[0].pos.y = 1.1;

    // Test nodes repulse each other

    layout._applyCoulombsLaw(wrappedGraph);

    deepEqual(wrappedGraph.nodes[0].acc, { x: 0.6331887903550433,
                                           y: 0.013902348690429939 });
    deepEqual(wrappedGraph.nodes[1].acc, { x: -0.6331887903550433,
                                           y: -0.013902348690429939 });

    // Test edges retract - pulling nodes together

    layout._applyHookesLaw(wrappedGraph);

    deepEqual(wrappedGraph.nodes[0].acc, { x: -9819.415000766554,
                                           y: -215.59593814058059 });
    deepEqual(wrappedGraph.nodes[1].acc, { x: 9819.415000766554,
                                           y: 215.59593814058059 });

    // Test nodes are slightly attracted to the center

    var dummyNode = {
        acc  : {
            x : 89.65760688043551,
            y: 986.2336756847908
        },
        mass : 1,
        pos  : {
            x : 0.1,
            y : 1.1
        }
    }

    layout._attractToCenter(dummyNode);
    
    deepEqual(dummyNode.acc, { x: 88.85760688043551,
                               y: 977.4336756847908 });

    // Now the acceleration has been computed we can update the positions
    
    layout._updatePosition(wrappedGraph, 1);

    deepEqual(wrappedGraph.nodes[0].acc, { x: 0, y: 0 });
    deepEqual(wrappedGraph.nodes[0].vel, { x: -4910.107500383277,
                                           y: -112.1979690702903 });
    deepEqual(wrappedGraph.nodes[1].acc, { x: 0, y: 0 });
    deepEqual(wrappedGraph.nodes[1].vel, { x: 5109.707500383277,
                                           y: 107.79796907029025 });
    
    equal(wrappedGraph.totalEnergy, 25121237.595596194);
    
    // Now apply a complete simulation step
    
    layout._simulationStep(wrappedGraph, 0.03);
    
    // Energy level got up because the nodes are now on the move
    
    equal(wrappedGraph.totalEnergy, 784344594.3151748);

    // Wait until the energy level reaches a minimum
    // (because of the damping factor).

    var i = 0;
    while(wrappedGraph.totalEnergy > 0.1) {
        layout._simulationStep(wrappedGraph, 0.03);
        i++;
    }

    equal(i, 563);
    equal(wrappedGraph.totalEnergy, 0.09923331533679589);

    deepEqual(wrappedGraph.nodes[0].acc, { x : 0, y: 0 });
    deepEqual(wrappedGraph.nodes[0].vel, { x : -0.31493668751053067,
                                           y : 0.006942492109450636 });
    deepEqual(wrappedGraph.nodes[1].acc, { x : 0, y: 0 });
    deepEqual(wrappedGraph.nodes[1].vel, { x : -0.3149366875105321,
                                           y : 0.006942492109450562 });

    deepEqual(wrappedGraph.nodes[0].pos, { x : 0.14702761677500506,
                                           y : -0.05367291705453648 });

    deepEqual(wrappedGraph.nodes[1].pos, { x : 2.4393742339877518,
                                           y : -0.003341953403159622 });
    
    
});
