var fs = require("fs"),
    _  = require("underscore");

var tape = require("tape"),
    subcluster = require("../src/subcluster");

tape("subcluster", function(test) {

  let correct = JSON.parse(String(fs.readFileSync(__dirname + "/data/correct.json")));
  let dummy_data = __dirname + "/data/DummyNetworkAttributes.json";

  var _networkCDCDateField = "hiv_aids_dx_dt";
  var today = new Date();


  fs.readFile(dummy_data, (err, data) => {

    let shiv_results = JSON.parse(data);
    let start_date = today;
    
    let new_json = subcluster.annotate_priority_clusters(
      shiv_results.trace_results,
      0.005,
      _networkCDCDateField,
      36,
      12,
      start_date
    );

    let tested = new_json.Nodes.map(d => { return [d.id, d.in_rr]; });
    let f = _.filter(correct, d => { return d[1]; } );
    let t = _.filter(tested, d => { return d[1]; } );

    const diff = _.intersection(f, t);
    test.notOk(diff.length);

    test.end();

    
  });


});

