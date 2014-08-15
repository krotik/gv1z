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
    deepEqual(wrappedGraph.nodes[0].pos, { x:10, y:0 });
    equal(wrappedGraph.nodes[0].mass, 10);
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

    deepEqual(wrappedGraph.nodes[0].acc, { x: 1.496353732878798,
                                           y: 0.16296921843234416 });
    deepEqual(wrappedGraph.nodes[1].acc, { x: -1.496353732878798,
                                           y: -0.16296921843234416 });

    // Test edges retract - pulling nodes together

    layout._applyHookesLaw(wrappedGraph);

    deepEqual(wrappedGraph.nodes[0].acc, { x: -180.62121718405956,
                                           y: -19.671617713115374 });
    deepEqual(wrappedGraph.nodes[1].acc, { x: 180.62121718405956,
                                           y: 19.671617713115374 });

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
    deepEqual(wrappedGraph.nodes[0].vel, { x: -90.35060859202979,
                                           y: -10.275808856557687 });
    deepEqual(wrappedGraph.nodes[1].acc, { x: 0, y: 0 });
    deepEqual(wrappedGraph.nodes[1].vel, { x: 94.31060859202978,
                                           y: 9.835808856557687 });
    
    equal(wrappedGraph.totalEnergy, 86300.29374734228);
    
    // Now apply a complete simulation step
    
    layout._simulationStep(wrappedGraph, 0.03);
    
    // Energy level got up because the nodes are now on the move
    
    equal(wrappedGraph.totalEnergy, 499.7011274848018);

    // Wait until the energy level reaches a minimum
    // (because of the damping factor).

    var i = 0;
    while(wrappedGraph.totalEnergy > 0.1) {
        layout._simulationStep(wrappedGraph, 0.03);
        i++;
    }

    equal(i, 153);
    equal(wrappedGraph.totalEnergy, 0.09899069477462706);

    deepEqual(wrappedGraph.nodes[0].acc, { x : 0, y: 0 });
    deepEqual(wrappedGraph.nodes[0].vel, { x : 0.1391751582571491,
                                           y : 0.001373527633620788 });
    deepEqual(wrappedGraph.nodes[1].acc, { x : 0, y: 0 });
    deepEqual(wrappedGraph.nodes[1].vel, { x : -0.013877117772184332,
                                           y : -0.015295532131950094 });

    deepEqual(wrappedGraph.nodes[0].pos, { x : -3.772050971714288,
                                           y : 0.16269504046745376 });

    deepEqual(wrappedGraph.nodes[1].pos, { x : -1.4411774081320283,
                                           y : 0.41655255729324353 });
    
    
});
