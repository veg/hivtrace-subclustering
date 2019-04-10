var _ = require("underscore");
var d3 = require("d3");

var helpers = require("./helpers.js");

function is_edge_injected(e) {
  //console.log (e, "edge_type" in e);
  return "edge_type" in e;
}

function hivtrace_cluster_depthwise_traversal(
  nodes,
  edges,
  edge_filter,
  save_edges,
  seed_nodes
) {

  var clusters = [],
    adjacency = {},
    by_node = {};

  seed_nodes = seed_nodes || nodes;

  _.each(nodes, function(n) {
    n.visited = false;
    adjacency[n.id] = [];
  });

  if (edge_filter) {
    edges = _.filter(edges, edge_filter);
  }

  _.each(edges, function(e) {
    try {
      adjacency[nodes[e.source].id].push([nodes[e.target], e]);
      adjacency[nodes[e.target].id].push([nodes[e.source], e]);
    } catch (err) {
      console.log(
        "Edge does not map to an existing node " + e.source + " to " + e.target
      );
      throw "Edge does not map to an existing node " +
        e.source +
        " to " +
        e.target;
    }
  });

  var traverse = function(node) {

    if (!(node.id in by_node)) {
      clusters.push([node]);
      by_node[node.id] = clusters.length - 1;
      if (save_edges) {
        save_edges.push([]);
      }
    }

    node.visited = true;

    _.each(adjacency[node.id], function(neighbor) {
      if (!neighbor[0].visited) {
        by_node[neighbor[0].id] = by_node[node.id];
        clusters[by_node[neighbor[0].id]].push(neighbor[0]);
        if (save_edges) {
          save_edges[by_node[neighbor[0].id]].push(neighbor[1]);
        }
        traverse(neighbor[0]);
      }
    });

  };

  _.each(seed_nodes, function(n) {
    if (!n.visited) {
      traverse(n);
    }
  });

  return clusters;

}

function _compute_cluster_degrees(d) {
  var degrees = d.children.map(function(c) {
    return c.degree;
  });
  degrees.sort(d3.ascending);
  d.degrees = helpers.describe_vector(degrees);
}

function _extract_single_cluster(
  nodes,
  filter,
  no_clone,
  given_json,
  include_extra_edges
) {

  /**
    Extract the nodes and edges between them into a separate objects
    @param nodes [array]  the list of nodes to extract
    @param filter [function, optional] (edge) -> bool filtering function for deciding which edges will be used to define clusters
    @param no_clone [bool] if set to T, node objects are not shallow cloned in the return object
    @return [dict] the object representing "Nodes" and "Edges" in the extracted cluster
	*/


  var cluster_json = {};
  var map_to_id = {};

  cluster_json.Nodes = _.map(nodes, function(c, i) {

    map_to_id[c.id] = i;
    if (no_clone) {
      return c;
    }

    var cc = _.clone(c);
    cc.cluster = 1;
    return cc;

  });

  given_json = given_json || json;

  cluster_json.Edges = _.filter(given_json.Edges, function(e) {
    if (_.isUndefined(e.source) || _.isUndefined(e.target)) {
      return false;
    }

    return (
      given_json.Nodes[e.source].id in map_to_id &&
      given_json.Nodes[e.target].id in map_to_id &&
      (include_extra_edges || !is_edge_injected(e))
    );

  });

  if (filter) {
    cluster_json.Edges = _.filter(cluster_json.Edges, filter);
  }

  cluster_json.Edges = _.map(cluster_json.Edges, function(e) {
    var ne = _.clone(e);
    ne.source = map_to_id[given_json.Nodes[e.source].id];
    ne.target = map_to_id[given_json.Nodes[e.target].id];
    return ne;
  });

  return cluster_json;
}

exports.hivtrace_cluster_depthwise_traversal = hivtrace_cluster_depthwise_traversal;
exports._compute_cluster_degrees = _compute_cluster_degrees;
exports._extract_single_cluster = _extract_single_cluster;
