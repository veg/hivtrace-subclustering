var subcluster = require("../subcluster");

var commander = require('commander');
var fs = require('fs');

var _networkCDCDateField = "hiv_aids_dx_dt";

var today = new Date();

fs.readFile('./DummyNetwork.json', (err, data) => {

	let shiv_results = JSON.parse(data);

	let new_json = subcluster.annotate_priority_clusters(
		shiv_results.trace_results,
		0.005,
		_networkCDCDateField,
		36,
		12,
		today
	);

	// Write out new json with subclusters

});

