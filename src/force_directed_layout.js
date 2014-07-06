// Force directed graph layout
// ===========================

// Simple debug flag which enables console.log logging
gv.ForceDirectedLayoutDebug = false;

gv.default_layout_options.ForceDirectedLayout = {
    "stiffness"     : 400.0,
    "repulsion"     : 400.0,
    "damping"       : 0.5,
    "stopThreshold" : 0.1
};

gv.ForceDirectedLayout = gv.AbstractLayout.create({

    init : function (xpad, ypad, options) {
        "use strict";

        if (xpad === undefined) {
            xpad = 50;
        }
        if (ypad === undefined) {
            ypad = 100;
        }

        if (options === undefined) {
            options = {};
        }
        var setOptionDefault = function (option, defaultValue) {
            options[option] = options[option] === undefined ? defaultValue : options[option];
        }
        setOptionDefault("stiffness", gv.default_layout_options.ForceDirectedLayout["stiffness"]);
        setOptionDefault("repulsion", gv.default_layout_options.ForceDirectedLayout["repulsion"]);
        setOptionDefault("damping", gv.default_layout_options.ForceDirectedLayout["damping"]);
        setOptionDefault("stopThreshold", gv.default_layout_options.ForceDirectedLayout["stopThreshold"]);


        this._xpad = xpad;
        this._ypad = ypad;
        this._options = options;
    },

    applyLayout : function (originalGraph, viewWidth, viewHeight, controller, state) {
        "use strict";

        var wrappedGraph = this._wrapGraph(originalGraph);

        wrappedGraph.totalEnergy = 1;
        while(wrappedGraph.totalEnergy > 0.5) {
            this._simulationStep(wrappedGraph, 0.03);
        }

        // Move the nodes of the original graph

        for (var i=0; i < originalGraph.nodes.length; i++) {
            var node = originalGraph.nodes[i];
            var wnode = wrappedGraph.nodeLookup[node.id];

            node.movePosition({
                x: Math.round(wnode.pos.x * this._xpad),
                y: Math.round(wnode.pos.y * this._ypad)
            });
        }
    },

    _wrapGraph : function (originalGraph) {
        "use strict";

        var nodes = {},
            wrappedGraph = {
                nodes : [],
                edges : []
            },
            delta = 2 * Math.PI / originalGraph.nodes.length,
            step = 0;

        for (var i = 0; i < originalGraph.nodes.length; i++) {
            var node = new gv.LayoutModel.NodeWrapper(originalGraph.nodes[i]);

            // Add layout specific attributes
            node.pos  = {
                x : Math.cos(step) * this._xpad,
                y : Math.sin(step) * this._ypad
            };
            node.mass = 1;
            node.vel  = { x:0, y:0 };
            node.acc  = { x:0, y:0 };

            wrappedGraph.nodes.push(node);
            nodes[originalGraph.nodes[i].id] = node;

            step += delta;
        }

        for (i = 0; i < originalGraph.edges.length; i++) {
            var edge = new gv.LayoutModel.EdgeWrapper(originalGraph.edges[i]),
                isRecursive = edge.wrappedEdge.getEnd1() === edge.wrappedEdge.getEnd2();
            if (isRecursive) {
                // Ignore recursive edges
                continue;
            }

            // Add layout specific attributes
            edge.springlength = 1;

            edge.src = nodes[originalGraph.edges[i].getEnd1().id];
            edge.src.edges.push(edge);
            edge.dest = nodes[originalGraph.edges[i].getEnd2().id];
            edge.dest.edges.push(edge);
            edge.src.neighbours.push(edge.dest);
            edge.dest.neighbours.push(edge.src);

            // Add layout specific attributes
            edge.length = 1;

            wrappedGraph.edges.push(edge);
        }

        wrappedGraph.nodeLookup = nodes;

        wrappedGraph.totalEnergy = null;

        return wrappedGraph;
    },

    _stepLoop : function () {
        "use strict";
        console.log("t");

        window.setTimeout(gv.bind(this._stepLoop, this), 100);
    },

    // Apply coulomb's law to a wrapped Graph. Nodes are seen as electrostatic
    // particles which repulse each other.
    //
    // See: http://en.wikipedia.org/wiki/Coulomb%27s_law
    //
    // wrappedGraph - The wrapped graph to process.
    //
    _applyCoulombsLaw : function (wrappedGraph) {
        "use strict";

        for (var i = 0; i < wrappedGraph.nodes.length; i++) {
            var node1 = wrappedGraph.nodes[i];

            for (var j = 0; j < wrappedGraph.nodes.length; j++) {
                var node2 = wrappedGraph.nodes[j];

                if (i !== j) {
                    var distV = {
                        x : node1.pos.x - node2.pos.x,
                        y : node1.pos.y - node2.pos.y
                    },
                    // Avoid great forces at small distances
                    dist = Math.sqrt(distV.x * distV.x + distV.y * distV.y) + 0.1,
                    ndistV = {
                        x : distV.x / dist,
                        y : distV.y / dist
                    };

                    this._applyForce(node1, {
                        x : (ndistV.x * this._options.repulsion)  / (dist * dist * 0.5),
                        y : (ndistV.y * this._options.repulsion)  / (dist * dist * 0.5)
                    });
                    this._applyForce(node2, {
                        x : (ndistV.x * this._options.repulsion)  / (dist * dist * -0.5),
                        y : (ndistV.y * this._options.repulsion)  / (dist * dist * -0.5)
                    });
                }
            }
        }
    },

    // Apply hooke's law to a wrapped graph. Every edge is seen as a spring which has
    // been pulled and is now retracting.
    //
    // See: http://en.wikipedia.org/wiki/Hooke%27s_law
    //
    // wrappedGraph - The wrapped graph to process.
    //
    _applyHookesLaw : function (wrappedGraph) {
        "use strict";

        for (var i = 0; i < wrappedGraph.edges.length; i++) {
            var edge = wrappedGraph.edges[i],
                distV = {
                    x : edge.src.pos.x - edge.dest.pos.x,
                    y : edge.src.pos.y - edge.dest.pos.y
                },
                dist = Math.sqrt(distV.x * distV.x + distV.y * distV.y),
                displacement = edge.springlength - dist,
                ndistV = {
                    x : distV.x / dist,
                    y : distV.y / dist
                };

                this._applyForce(edge.src, {
                    x : ndistV.x * this._options.stiffness * displacement * 0.5,
                    y : ndistV.y * this._options.stiffness * displacement * 0.5
                });
                this._applyForce(edge.dest, {
                    x : ndistV.x * this._options.stiffness * displacement * -0.5,
                    y : ndistV.y * this._options.stiffness * displacement * -0.5
                });
        }
    },

    // Apply a rather weak force which pulls the node towards the center.
    //
    // node - Node to process.
    //
    _attractToCenter : function (node) {
        "use strict";

        this._applyForce(node, {
            x : node.pos.x * -1.0 * (this._options.repulsion / 50),
            y : node.pos.y * -1.0 * (this._options.repulsion / 50)
        });
    },

    // Update the positions of all nodes after forces have been applied to them.
    //
    // wrappedGraph - The wrapped graph to process.
    // timedelta    - Simulation timedelta.
    //
    _updatePosition : function (wrappedGraph, timedelta) {
        "use strict";

        var totalEnergy = 0;

        for (var i = 0; i < wrappedGraph.nodes.length; i++) {
            var node = wrappedGraph.nodes[i];
            this._attractToCenter(node);

            // Update velocity
            node.vel.x = (node.vel.x + node.acc.x * timedelta) * this._options.damping;
            node.vel.y = (node.vel.y + node.acc.y * timedelta) * this._options.damping;
            node.acc = { x:0, y:0 };

            // Update position
            node.pos.x += node.vel.x * timedelta;
            node.pos.y += node.vel.y * timedelta;

            // Calculate total energy
            var speed = Math.sqrt(node.vel.x * node.vel.x + node.vel.y * node.vel.y);
            totalEnergy += 0.5 * node.mass * speed * speed;
        }

        // Update total energy
        wrappedGraph.totalEnergy = totalEnergy;
    },

    // Apply force to a node - this will modify its acceleration.
    //
    // node  - Node to process.
    // force - Force to apply.
    //
    _applyForce : function (node, force) {
        node.acc.x += force.x / node.mass;
        node.acc.y += force.y / node.mass;
    },

    // Do a full simulation step.
    //
    // wrappedGraph - The wrapped graph to process.
    // timedelta    - Simulation timedelta.
    //
    _simulationStep : function (wrappedGraph, timedelta) {
        this._applyCoulombsLaw(wrappedGraph);
        this._applyHookesLaw(wrappedGraph);
        this._updatePosition(wrappedGraph, timedelta);
    },

    moveView : function (originalGraph, viewWidth, viewHeight, controller, state) {
        controller.centerViewToModel();
    }

});
