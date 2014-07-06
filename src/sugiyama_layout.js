// Sugiyama-style graph layout
// ===========================

// Simple debug flag which enables console.log logging
gv.SugiyamaLayoutDebug = false;

gv.default_layout_options.SugiyamaLayout = {
    "insertDummyVertices" : false,
    "optimizeLayout"      : true
};

gv.SugiyamaLayout = gv.AbstractLayout.create({

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
        setOptionDefault("insertDummyVertices", gv.default_layout_options.SugiyamaLayout["insertDummyVertices"]);
        setOptionDefault("optimizeLayout", gv.default_layout_options.SugiyamaLayout["optimizeLayout"]);

        // Special options which are used if dummy vertices are
        // inserted into the original graph
        setOptionDefault("dummyVertexCreateId", gv.LayoutModel.dummyVertexCreateId);
        setOptionDefault("dummyVertexCreate", function (id) {
            return new gv.SimpleDummyNode(id, new gv.Point(0,0));
        });
        setOptionDefault("dummyEdgeCreate", function (node1, node2) {
            return new gv.SimpleEdge(node1, node2);
        });

        this._xpad = xpad;
        this._ypad = ypad;
        this._options = options;
    },

    applyLayout : function (originalGraph, viewWidth, viewHeight, controller, state) {
        "use strict";

        // Wrap the original graph
        var wrappedGraph = this._wrapGraph(originalGraph);

        if (this._options["insertDummyVertices"] === true) {
            wrappedGraph.originalGraph = originalGraph;
            wrappedGraph.dummyVertexCreateId = this._options["dummyVertexCreateId"];
            wrappedGraph.dummyVertexCreate = this._options["dummyVertexCreate"];
            wrappedGraph.dummyEdgeCreate = this._options["dummyEdgeCreate"];
        }

        // Reset dummy counter
        gv.LayoutModel.dummyCounter = 0;

        // Remove cycles in wrapped graph
        this._removeCycles(wrappedGraph);

        // Assign layers using the longest path algorithm
        var layering = {};
        this._assignLayersLongestPath(wrappedGraph, function (vertex, layer) {
            layering[vertex.id] = layer;
        });

        if (this._options["optimizeLayout"] === true) {
            // Optimize layering using vertex promotion
            var optLayering = this._optimizeLayersVertexPromotion(wrappedGraph, layering);
        } else {
            optLayering = layering;
        }

        // Add dummy vertices
        var layers = this._createLayersWithDummyNodes(wrappedGraph, optLayering);

        // Move vertices to bary center
        this._moveNodesToBaryCenter(wrappedGraph, layers);

        // Move the nodes of the original graph
        for (var i=0; i < originalGraph.nodes.length; i++) {
            var node = originalGraph.nodes[i];
            var wnode = wrappedGraph.nodeLookup[node.id];

            node.movePosition({
                x: wnode.xpos * this._xpad,
                y: -wnode.layer * this._ypad
            });
        }
    },

    moveView : function (originalGraph, viewWidth, viewHeight, controller, state) {
        controller.centerViewToModel();
    },


    _wrapGraph : function (originalGraph) {
        "use strict";

        var nodes = {},
            wrappedGraph = {
                nodes : [],
                edges : []
            };

        for (var i = 0; i < originalGraph.nodes.length; i++) {
            var node = new gv.LayoutModel.NodeWrapper(originalGraph.nodes[i]);
            wrappedGraph.nodes.push(node);
            nodes[originalGraph.nodes[i].id] = node;
        }

        for (i = 0; i < originalGraph.edges.length; i++) {
            var edge = new gv.LayoutModel.EdgeWrapper(originalGraph.edges[i]),
                isRecursive = edge.wrappedEdge.getEnd1() === edge.wrappedEdge.getEnd2();
            if (isRecursive) {
                // Ignore recursive edges
                continue;
            }
            edge.src = nodes[originalGraph.edges[i].getEnd1().id];
            edge.src.edges.push(edge);
            edge.dest = nodes[originalGraph.edges[i].getEnd2().id];
            edge.dest.edges.push(edge);
            edge.src.neighbours.push(edge.dest);
            edge.dest.neighbours.push(edge.src);

            wrappedGraph.edges.push(edge);
        }

        wrappedGraph.nodeLookup = nodes;

        return wrappedGraph;
    },

    // Remove cycles on a wrapped graph
    //
    // wrappedGraph - Wrapped graph to work on.
    //
    _removeCycles : function (wrappedGraph) {
        "use strict";

        if (gv.SugiyamaLayoutDebug) console.log("Removing cycles");

        var vertexSet = new gv.LayoutModel.VertexSet(wrappedGraph.nodes);

        // Make sure we check all nodes in the graph for cycles
        while(vertexSet.size !== 0) {
            var startNode;

            // Pick a node from the set
            vertexSet.each(function (item) {
                startNode = item;
                return false;
            })

            if (gv.SugiyamaLayoutDebug) console.log("Starting cycle removal from " + startNode.id);

            gv.common.depthFirstSearch(startNode, function (node) {
            }, function (node) {
                vertexSet.remove(node);
                return node.getOutgoingNeighbours();
            }, function (src, alreadyVisitedNode, path) {
                if (path.indexOf(alreadyVisitedNode.id) !== -1) {
                    for (var i = 0; i < src.edges.length; i++) {
                        var edge = src.edges[i];
                        if (edge.src === src && edge.dest == alreadyVisitedNode) {
                            if (gv.SugiyamaLayoutDebug) console.log("Changing direction of edge: " +
                                                                    edge.src.id + " -> " + edge.dest.id);
                            var temp = edge.src;
                            edge.src = edge.dest;
                            edge.dest = temp;
                            edge.src.notifyEdgesChanged();
                            edge.dest.notifyEdgesChanged();
                        }
                    }
                }
            });
        }
    },

    // Assign layers on a wrapped graph using the Longest-Path algorithm.
    //
    // wrappedGraph - Wrapped graph to work on (graph is not changed).
    // assignFunc   - Called every time a layer is assigned parameters are vertex and layer.
    //
    _assignLayersLongestPath : function (wrappedGraph, assignFunc) {
        "use strict";

        if (gv.SugiyamaLayoutDebug) console.log("Assign layers with Longest-Path algorithm");

            // Vertices assigned to current layer
        var u = new gv.LayoutModel.VertexSet(),
            // Vertices assigned to layer below the current layer
            z = new gv.LayoutModel.VertexSet(),
            // Current layer  being build
            current_layer = 1,
            // Set of all vertices
            vertices = new gv.LayoutModel.VertexSet(wrappedGraph.nodes);

        // Select a vertex from vertices which has all its immediate successors
        // already assigned to layers below the current one.
        var selectVertex = function () {
            var ret = undefined;

            vertices.each(function (vertex) {
                if (z.containsAll(vertex.getOutgoingNeighbours())) {
                    ret = vertex;
                    if (gv.SugiyamaLayoutDebug) console.log("Select vertex: " + ret.id);
                    return false;
                }
            });

            return ret;
        };

        while (vertices.size !== 0) {
            var vertex = selectVertex();
            if (vertex !== undefined) {
                assignFunc(vertex, current_layer);
                u.add(vertices.remove(vertex));
            } else {
                current_layer++;
                z.union(u);
                u = new gv.LayoutModel.VertexSet();
                if (gv.SugiyamaLayoutDebug) console.log("Next layer: " + current_layer);
            }
        }
    },

    // Optimize layering by reducing dummy vertices using promotion of vertices
    // (algorithm by Nikolov and Tarassov).
    //
    // wrappedGraph - Wrapped graph to work on (graph is not changed).
    // layering     - Simple layering object mapping node id to layer.
    //
    // Returns an optimized layering as a simple layering object mapping
    // node id to layer - (the original layering will not be modified)
    //
    _optimizeLayersVertexPromotion : function (wrappedGraph, layering) {

            // Promote a vertix in the graph. This
            // will modify the given layering array.
        var promoteVertex = function (v, layering) {
                var predecessors = v.getIncomingNeighbours(),
                    dummydiff = 0;

                for (var i = 0; i < predecessors.length; i++) {
                    var u = predecessors[i]
                    if (layering[u.id] === layering[v.id] + 1) {
                        dummydiff = dummydiff + promoteVertex(u, layering);
                    }
                }

                layering[v.id] = layering[v.id] + 1;

                dummydiff = dummydiff - v.getIncomingNeighbours().length + v.getOutgoingNeighbours().length;

                return dummydiff
            },
            // Restore a layering copy to the original state
            restoreLayering = function (modifiedLayering, originalLayering) {
                for (var vertexId in originalLayering) {
                    modifiedLayering[vertexId] = originalLayering[vertexId];
                }
                return modifiedLayering;
            },
            layeringCopy = restoreLayering({}, layering),
            promotions = -1;

        while(promotions !== 0) {
            promotions = 0;
            for (var i = 0; i < wrappedGraph.nodes.length; i++) {
                var v = wrappedGraph.nodes[i];
                if (v.getIncomingNeighbours().length > 0) {
                    var promoteResult = promoteVertex(v, layeringCopy);
                    if (promoteResult < 0) {
                        if (gv.SugiyamaLayoutDebug) console.log("Promoting: " + v.id + " -> success " + promoteResult);
                        promotions++;
                        layering = layeringCopy;
                        layeringCopy = restoreLayering({}, layering);
                    } else {
                        if (gv.SugiyamaLayoutDebug) console.log("Promoting: " + v.id + " -> fail");
                        restoreLayering(layeringCopy, layering);
                    }
                }
            }
        }

        if (gv.SugiyamaLayoutDebug) console.log("Promoting vertices complete", layering);

        return layering;
    },

    // Calculate the number of edge crossings between a 2 layered subgraph.
    //
    // wrappedGraph - Wrapped graph to work on (graph is not changed).
    // lUp          - Upper layer (as list of node ids)
    // lDown        - Lower layer (as list of node ids)
    //
    // Returns the number of edge crossings between the given layers.
    //
    _calculateEdgeCrossings : function (wrappedGraph, lUp, lDown) {

        var ordRet = {},
            ordState = { up : true, i : 0, c : 1 },
            ordFunc = gv.bind(function () {
                if (this.up && lUp.length > this.i) {
                    ordRet.ord = this.c;
                    ordRet.vid = lUp[this.i];
                } else if (lDown.length > this.i) {
                    ordRet.ord = this.c + 1;
                    ordRet.vid = lDown[this.i];
                    this.c += 2;
                    this.i++;
                } else {
                    return undefined;
                }
                this.up = !this.up;
                return ordRet;
            }, ordState),
            ordLookup = {},
            ord;

        // Create order lookup and reset state of ord func
        while((ord = ordFunc()) !== undefined) {
            ordLookup[ord.vid] = ord.ord;
        }
        ordState.up = true;
        ordState.i = 0;
        ordState.c = 1;

        var endpointsOfActiveEdges = function(w) {
                var neighbours = wrappedGraph.nodeLookup[w].getNeighbours(),
                    activeEdgeEndpoints = [],
                    ordW = ordLookup[w];
                for (var i = 0; i < neighbours.length; i++) {
                    var neighbour = neighbours[i];
                    if (ordLookup[neighbour.id] > ordW) {
                        activeEdgeEndpoints.push(neighbour.id);
                    }
                }
                return activeEdgeEndpoints;
            },
            // Loop variables
            ul = [], // Contains the end nodes of edges of the upper level
            ll = [], // Contains the end nodes of edges of the lower level
            lastOccurrence = {},
            nrCrossings = 0,
            i, activeEdgeEndpoints, lo, idel, k1,k2,k3;

        // Alternate between layers
        while((ord = ordFunc()) !== undefined) {
            var w = ord.vid;

            if (ord.ord % 2 !== 0) {
                // Order is odd (upper layer)
                idel = [];
                lo = lastOccurrence[w];
                if (lo !== undefined) {
                    k1 = 0; k2 = 0; k3 = 0;
                    // Calculate crossings
                    for (i = 0; i < lo+1; i++) {
                        if (ul[i] === w) {
                            k1++;
                            k3+=k2;
                            idel.push(i);
                        } else {
                            k2++;
                        }
                    }
                    for (i = idel.length - 1; i >= 0; i--) {
                        ul.splice(idel[i], 1);
                    }
                    nrCrossings += (k1 * ll.length) + k3;
                }

                // Store "active" edges i.e. the edges start left to the sweep line but
                // end right to it - Ord(v) < Ord(v')

                activeEdgeEndpoints = endpointsOfActiveEdges(w);
                for (i = 0; i < activeEdgeEndpoints.length; i++) {
                    lastOccurrence[activeEdgeEndpoints[i]] = ll.length;
                    ll.push(activeEdgeEndpoints[i]);
                }

            } else {
                // Order is even (lower layer)
                idel = [];
                lo = lastOccurrence[w];
                if (lo !== undefined) {
                    k1 = 0; k2 = 0; k3 = 0;
                    // Calculate crossings
                    for (i = 0; i < lo+1; i++) {
                        if (ll[i] === w) {
                            k1++;
                            k3+=k2;
                            idel.push(i);
                        } else {
                            k2++;
                        }
                    }
                    for (i = idel.length - 1; i >= 0; i--) {
                        ll.splice(idel[i], 1);
                    }
                    nrCrossings += (k1 * ul.length) + k3;
                }

                activeEdgeEndpoints = endpointsOfActiveEdges(w);
                for (i = 0; i < activeEdgeEndpoints.length; i++) {
                    lastOccurrence[activeEdgeEndpoints[i]] = ul.length;
                    ul.push(activeEdgeEndpoints[i]);
                }
            }
        }

        return nrCrossings;
    },

    // Extend a given wrapped graph with dummy nodes and
    // create a layer object which contains the nodes.
    //
    // wrappedGraph - Wrapped graph to work on (graph is not changed).
    // layering     - Simple layering object mapping node id to layer.
    //
    // Returns a layering object which includes all nodes and dummy nodes.
    // The object maps layer number to a list of node ids.
    _createLayersWithDummyNodes : function (wrappedGraph, layering) {
        "use strict";

        var layers = {},
            getLayer = function (layer) {
                if (layers[layer] === undefined) {
                    layers[layer] = [];
                }
                return layers[layer];
            },
            // Function to create layers in layers object
            // and insert dummy nodes if necessary.
            assignToLayer = function (nid) {
                var nlayer = layering[nid];
                getLayer(nlayer).push(nid);

                // Check if dummy vertices need to be inserted
                var node = wrappedGraph.nodeLookup[nid],
                    incomingVertices = node.getIncomingNeighbours();

                for (var i = 0; i < incomingVertices.length; i++) {
                    var tid = incomingVertices[i].id,
                        targetLayer = layering[tid];

                    // Insert dummy nodes if necessary
                    if (targetLayer !== nlayer + 1) {
                        var dummynode = node.getEdgeTo(tid)
                            .insertDummyNode(wrappedGraph, nid);
                        layering[dummynode.id] = nlayer + 1;
                        // Assign layering for dummy node
                        assignToLayer(dummynode.id);
                    }
                }
            },
            nid;

        // Build node layers with dummy nodes
        for (nid in layering) {
            assignToLayer(nid);
        }

        return layers;
    },

    // Move the nodes of a given wrapped graph to their bary center based
    // on the nodes of the layer below. After this method has finished each
    // node in the wrappedGraph should have a xpos attribute.
    //
    // wrappedGraph - Wrapped graph to work on (graph is not changed).
    // layers       - Layering object which includes all nodes and dummy nodes.
    //                The object should map layer number to a list of node ids.
    //
    _moveNodesToBaryCenter : function (wrappedGraph, layers) {

        var layer,
            graphHeight = 0,
            graphWidth = 0;

        // Go through all layers and get some stats
        for (layer in layers) {
            graphHeight++;
            graphWidth = Math.max(graphWidth, layers[layer].length);
        }

        if (gv.SugiyamaLayoutDebug) console.log("Arranging nodes for " + graphWidth +
                                                "x" + graphHeight + " graph");

        // Calculate initial positions
        var startPosDelta = 1;
            startPos = startPosDelta,
            maxSamePositionNodes = 0, // Max number of nodes on a layer which have the same position
            cluster = [],
            clusterPos = -1;

        // Now go through the layers and arrange the nodes in the barycenter
        for (i = 1; i <= graphHeight; i++) {
            layer = layers[i];
            var layerposstat = {};
            for (var j = 0; j < layer.length; j++) {
                var node = wrappedGraph.nodeLookup[layer[j]],
                    ln = node.getOutgoingNeighbours(),
                    pos = 0;

                if (ln.length === 0) {
                    pos = startPos;
                    startPos+=startPosDelta;
                } else {
                    for (var k = 0; k < ln.length; k++) {
                        pos += ln[k].xpos;
                    }
                    pos = pos / ln.length;
                }

                node.xpos = pos;
                node.layer = i;
                layerposstat[pos] = layerposstat[pos] === undefined ? 1 : layerposstat[pos] + 1;
                maxSamePositionNodes = Math.max(maxSamePositionNodes, layerposstat[pos]);
                if (gv.SugiyamaLayoutDebug) console.log("Setting initial position " + pos + " for " + node.id);
            }
        }

        if (gv.SugiyamaLayoutDebug) console.log("Max number of nodes with same position: " +
                                                maxSamePositionNodes);

        // Now go through the whole graph again and resolve clustering by putting proper
        // spacing between the nodes.

        for (i = 1; i <= graphHeight; i++) {
            layer = layers[i];

            cluster = [],
            clusterPos = -1;

            for (var j = 0; j < layer.length; j++) {
                var node = wrappedGraph.nodeLookup[layer[j]];

                if (node.xpos === clusterPos) {
                    // We found a node which belongs to a cluster
                    cluster.push(node);
                    // Check if this was the last node in the cluster
                    if (j === layer.length - 1 || wrappedGraph.nodeLookup[layer[j+1]].xpos !== node.xpos) {
                        // Resolve the cluster
                        if (gv.SugiyamaLayoutDebug) console.log("Resolving cluster of " + cluster.length + " at pos " + (clusterPos * maxSamePositionNodes));

                        var clusterStart = (clusterPos * maxSamePositionNodes) - (maxSamePositionNodes * 0.5);

                        startPosDelta = maxSamePositionNodes / (cluster.length + 1);
                        startPos = clusterStart + startPosDelta;
                        for (k = 0; k < cluster.length; k++) {
                            cluster[k].xpos = startPos;
                            if (gv.SugiyamaLayoutDebug) console.log("New pos " + cluster[k].xpos +
                                                                    " for cluster node " + cluster[k].id);
                            startPos += startPosDelta;
                        }
                        cluster = [],
                        clusterPos = -1;
                    }
                } else if (j < layer.length - 1 && wrappedGraph.nodeLookup[layer[j+1]].xpos === node.xpos) {
                    // We found a new node cluster
                    clusterPos = node.xpos;
                    cluster.push(node);
                } else {
                    node.xpos = node.xpos * maxSamePositionNodes;
                    if (gv.SugiyamaLayoutDebug) console.log("New pos " + node.xpos +
                                                            " for " + node.id);
                }
            }
        }
    }
});
