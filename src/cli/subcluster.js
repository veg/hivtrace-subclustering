#!/usr/bin/env node

var fs = require("fs");

var commander = require("commander");
var winston = require("winston");
var moment = require("moment");
var _ = require("underscore");

var subcluster = require("../subcluster");
var _networkCDCDateField = "hiv_aids_dx_dt";
var today = new Date();

commander
  .option("-i --input <input>", "Input HIV-TRACE results file")
  .option(
    "-o --output <output>",
    "Output HIV-TRACE results file with subclusters"
  )
  .option(
    "-d --startdate [date]",
    "start date - formatted as YYYYMMDD"
  )
  .parse(process.argv);

fs.readFile(commander.input, (err, data) => {

  let shiv_results = JSON.parse(data);
  let start_date = today;
  
  if(!_.isEmpty(commander.startdate)) {

    let parsed = moment(commander.startdate, 'YYYYMMDD', true);

    if(parsed !== "Invalid Date") {
      start_date = parsed.toDate();
    } else {
      throw parsed;
    }

  }

  let new_json = subcluster.annotate_priority_clusters(
    shiv_results.trace_results,
    0.005,
    _networkCDCDateField,
    36,
    12,
    start_date
  );

  // Write out new json with subclusters
  fs.writeFile(commander.output, JSON.stringify(new_json), d => {
    winston.info(
      "Subcluster inference completed. Please proceed with further downstream analysis."
    );
  });

});
