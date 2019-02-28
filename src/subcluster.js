var hivtrace_cluster_depthwise_traversal = require("./compute-cluster.js")
  .hivtrace_cluster_depthwise_traversal;
var _compute_cluster_degrees = require("./compute-cluster.js")
  ._compute_cluster_degrees;
var _extract_single_cluster = require("./compute-cluster.js")
  ._extract_single_cluster;

var helpers = require("./helpers.js");

var d3 = require("d3");
var _ = require("underscore");

var _networkMissing = "missing";
var _networkNodeAttributeID = "patient_attributes";

var _defaultDateFormats = [
  d3.time.format("%Y-%m-%dT%H:%M:%S.%LZ"),
  d3.time.format("%Y-%m-%dT%H:%M:%S.%LZ")
];

function _n_months_ago(reference_date, months) {
  var past_date = new Date(reference_date);
  var past_months = past_date.getMonth();
  var diff_year = Math.floor(months / 12);
  var left_over = months - diff_year * 12;

  if (left_over > past_months) {
    past_date.setFullYear(past_date.getFullYear() - diff_year - 1);
    past_date.setMonth(12 - (left_over - past_months));
  } else {
    past_date.setFullYear(past_date.getFullYear() - diff_year);
    past_date.setMonth(past_months - left_over);
  }

  //past_date.setTime (past_date.getTime () - months * 30 * 24 * 3600000);
  return past_date;
}

_parse_dates = function(value, lower_bound, upper_bound) {
  lower_bound = lower_bound || 1970;
  upper_bound = upper_bound || new Date().getFullYear();

  if (value instanceof Date) {
    return value;
  }

  var parsed_value = null;

  var passed = _.any(_defaultDateFormats, function(f) {
    parsed_value = f.parse(value);
    return parsed_value;
  });

  if (passed) {
    if (
      parsed_value.getFullYear() < lower_bound ||
      parsed_value.getFullYear() > upper_bound
    ) {
      throw "Invalid date";
    }

    return parsed_value;
  }

  throw "Invalid date";
};

attribute_node_value_by_id = function(d, id, number) {
  if(!_.isObject(d)) {
    return _networkMissing;
  }

  try {
    if (_networkNodeAttributeID in d && id) {
      if (id in d[_networkNodeAttributeID]) {
        var v = d[_networkNodeAttributeID][id];

        if (_.isString(v)) {
          if (v.length == 0) {
            return _networkMissing;
          } else {
            if (number) {
              v = +v;
              return _.isNaN(v) ? _networkMissing : v;
            }
          }
        }
        return v;
      }
    }
  } catch (e) {
    console.log("attribute_node_value_by_id", e, d, id, number);
  }

  return _networkMissing;
};

function filter_by_date(cutoff, node, date_field, start_date) {

  let node_dx = attribute_node_value_by_id(node, date_field);

  if (node_dx instanceof Date) {
    return node_dx >= cutoff && node_dx <= start_date;
  } else {
    try {
      node_dx = _parse_dates(attribute_node_value_by_id(node, date_field));
      if (node_dx instanceof Date) {
        return node_dx >= cutoff && node_dx <= start_date;
      }
    } catch (err) {
      return undefined;
    }
  }

  return false;

};


function get_subcluster_summary_stats(subclusters, cutoff_long, date_field, start_date, cluster_nodes) {

  var subcluster_summary_stats = {};

  /** now, for each subcluster, extract the recent and rapid part */

  /** Recent & Rapid (R&R) Cluster: the part of the Sub-Cluster inferred using only cases dx’d in the previous 36 months
          and at least two cases dx’d in the previous 12 months; there is a path between all nodes in an R&R Cluster

          20180406 SLKP: while unlikely, this definition could result in multiple R&R clusters
          per subclusters; for now we will add up all the cases for prioritization, and
          display the largest R&R cluster if there is more than one
      */
  _.each(subclusters, function(sub) {

    // extract nodes based on dates
    var subcluster_json = _extract_single_cluster(

      _.filter(sub.children, _.partial(filter_by_date, cutoff_long, date_field, start_date)),
      null,
      true,
      cluster_nodes
    );

    var rr_cluster = _.filter(
      hivtrace_cluster_depthwise_traversal(
        subcluster_json.Nodes,
        _.filter(subcluster_json.Edges, function(e) {
          return e.length <= subcluster_threshold;
        })
      ),
      function(cc) {
        return cc.length > 1;
      }
    );

    sub.rr_count = rr_cluster.length;

    rr_cluster.sort(function(a, b) {
      return b.length - a.length;
    });

    sub.priority_score = [];
    sub.recent_nodes = [];

    _.each(rr_cluster, function(recent_cluster) {

      var priority_nodes = _.groupBy(
        recent_cluster,
        _.partial(filter_by_date, cutoff_short)
      );

      sub.recent_nodes.push(recent_cluster.length);

      if (true in priority_nodes) {

        sub.priority_score.push(priority_nodes[true].length);
        _.each(priority_nodes[true], function(n) {
          n.priority_flag = filter_by_date(start_date, n) ? 4 : 1;
          if (priority_nodes[true].length >= 3) {
            n.in_rr = true;
            if (n.priority_flag == 1) {
              n.priority_flag = 2;
            }
          }
        });

      }

      if (false in priority_nodes) {
        _.each(priority_nodes[false], function(n) {
          n.priority_flag = 3;
        });
      }

    });

    subcluster_summary_stats[sub.parent_cluster_id] = subcluster_summary_stats[sub.parent_cluster_id] || {};

    // Create subcluster summary statistics field for json
    subcluster_summary_stats[sub.parent_cluster_id][sub.subcluster_id] = { priority_score : sub.priority_score, recent_nodes: sub.recent_nodes }; 

  });

  return subcluster_summary_stats;

}

let annotate_priority_clusters = function(
  json,
  subcluster_threshold,
  date_field,
  span_months,
  recent_months,
  start_date
) {

  let today = new Date();
  let nodes = json.Nodes;
  let edges = json.Edges;
  let clusters = _.groupBy(nodes, "cluster");
  json.subcluster_summary_stats = {};

  try {

    start_date = start_date || today;

    var cutoff_long = _n_months_ago(start_date, span_months);
    var cutoff_short = _n_months_ago(start_date, recent_months);
    var node_iterator;

    if (start_date == today) {
      node_iterator = nodes;
    } else {

      let beginning_of_time = new Date();
      beginning_of_time.setYear(1900);

      node_iterator = [];

      _.each(nodes, function(node) {

        let filter_result = filter_by_date(beginning_of_time, node, date_field, start_date);

        if (_.isUndefined(filter_result)) {
          node.priority_flag = 6;
        } else {
          if (filter_result) {
            node.priority_flag = 5;
            node_iterator.push(node);
          } else {
            node.priority_flag = 4;
          }
        }
      });

    }

    var oldest_nodes_first = function(n1, n2) {

      // consistent node sorting, older nodes first
      var node1_dx = attribute_node_value_by_id(n1, date_field);
      var node2_dx = attribute_node_value_by_id(n2, date_field);

      if (node1_dx == node2_dx) {
        return n1.id < n2.id ? -1 : 1;
      } else {
        return node1_dx < node2_dx ? -1 : 1;
      }

      return 0;

    };

    // extract all clusters at once to avoid inefficiencies of multiple edge-set traverals

    var split_clusters = {};
    var node_id_to_local_cluster = {};

    // reset all annotations
    _.each(node_iterator, function(node) {
      if (node.cluster) {
        if (!(node.cluster in split_clusters)) {
          split_clusters[node.cluster] = { Nodes: [], Edges: [] };
        }
        node_id_to_local_cluster[node.id] =
          split_clusters[node.cluster]["Nodes"].length;
        split_clusters[node.cluster]["Nodes"].push(node);
      }
    });

    _.each(edges, function(edge) {
      if (edge.length <= subcluster_threshold) {
        var edge_cluster = json.Nodes[edge.source].cluster;

        var source_id = json.Nodes[edge.source].id,
          target_id = json.Nodes[edge.target].id;

        if (
          source_id in node_id_to_local_cluster &&
          target_id in node_id_to_local_cluster
        ) {
          var copied_edge = _.clone(edge);
          copied_edge.source = node_id_to_local_cluster[source_id];
          copied_edge.target = node_id_to_local_cluster[target_id];

          split_clusters[edge_cluster]["Edges"].push(copied_edge);
        }
      }
    });

    _.each(split_clusters, function(cluster_nodes, cluster_index) {

      /** extract subclusters; all nodes at given threshold */
      /** Sub-Cluster: all nodes connected at 0.005 subs/site; there can be multiple sub-clusters per cluster */
      cluster_mapping = {};

      _.each(clusters, (d, i) => {
        clusters[i] = { nodes: d, priority_score: 0 };
      });

      let array_index = cluster_index;

      /** all clusters with more than one member connected at 'threshold' edge length */
      var edges = [];

      var subclusters = _.filter(
        hivtrace_cluster_depthwise_traversal(
          cluster_nodes.Nodes,
          cluster_nodes.Edges,
          null,
          edges
        ),
        function(cc) {
          return cc.length > 1;
        }
      );

      edges = _.filter(edges, function(es) {
        return es.length > 1;
      });

      /** sort subclusters by oldest node */

      _.each(subclusters, function(c, i) {
        c.sort(oldest_nodes_first);
      });

      subclusters.sort(function(c1, c2) {
        return oldest_nodes_first(c1[0], c2[0]);
      });

      subclusters = _.map(subclusters, function(c, i) {

        let parent_cluster_id = array_index;
        let subcluster_id = i+1;
        let label = parent_cluster_id + "-" + subcluster_id;

        _.each(c, function(n) {
          n.subcluster_label = label;
          n.parent_cluster_id = parent_cluster_id;
          n.subcluster_id = subcluster_id;
          n.priority_flag = 0;
          n.in_rr = 0;
        });

        return {
          children: _.clone(c),
          parent_cluster: clusters[array_index],
          cluster_id: label,
          subcluster_id: subcluster_id,
          parent_cluster_id : parent_cluster_id,
          distances: helpers.describe_vector(
            _.map(edges[i], function(e) {
              return e.length;
            })
          )
        };
      });


      _.each(subclusters, function(c) {
        _compute_cluster_degrees(c);
      });

      clusters[array_index].subclusters = subclusters;

      let ss = get_subcluster_summary_stats(subclusters, cutoff_long, date_field, start_date, cluster_nodes);
      json.subcluster_summary_stats = _.extend(json.subcluster_summary_stats, ss);

    });

  } catch (err) {
    console.log(err);
  }

  return json;

};

exports.annotate_priority_clusters = annotate_priority_clusters;
exports.subcluster_summary_stats = get_subcluster_summary_stats;

