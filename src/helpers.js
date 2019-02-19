var d3 = require("d3");

function describe_vector(vector, as_list) {

  var d = {};

  if (vector.length) {
    vector.sort(d3.ascending);

    var d = {
      min: d3.min(vector),
      max: d3.max(vector),
      median: d3.median(vector),
      Q1: d3.quantile(vector, 0.25),
      Q3: d3.quantile(vector, 0.75),
      mean: d3.mean(vector)
    };
  } else {
    var d = {
      min: null,
      max: null,
      median: null,
      Q1: null,
      Q3: null,
      mean: null
    };
  }

  if (as_list) {
    d =
      "<pre>Range  :" +
      d["min"] +
      "-" +
      d["max"] +
      "\n" +
      "IQR    :" +
      d["Q1"] +
      "-" +
      d["Q3"] +
      "\n" +
      "Mean   :" +
      d["mean"] +
      "\n" +
      "Median :" +
      d["median"] +
      "\n" +
      "</pre>";

    /*d =
    "<dl class = 'dl-horizontal'>" +
    "<dt>Range</dt><dd>" + d['min'] + "-" + d['max'] + "</dd>" +
    "<dt>IQR</dt><dd>" + d['Q1'] + "-" + d['Q3'] +  "</dd>" +
    "<dt>Mean</dt><dd>" + d['mean'] +  "</dd>" +
    "<dt>Median</dt><dd>" + d['median'] + "</dd></dl>";*/
  }

  return d;

}

exports.describe_vector = describe_vector;
