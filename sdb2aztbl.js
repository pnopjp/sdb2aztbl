//   Copyright 2013 pnop.inc
//   Author Kazumi HIROSE <kazumihirose@hotmail.com>
//
//   Licensed under the Apache License, Version 2.0 (the "License");
//   you may not use this file except in compliance with the License.
//   You may obtain a copy of the License at
//
//       http://www.apache.org/licenses/LICENSE-2.0
//
//   Unless required by applicable law or agreed to in writing, software
//   distributed under the License is distributed on an "AS IS" BASIS,
//   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//   See the License for the specific language governing permissions and
//   limitations under the License.

var aws = require('aws-sdk'),
fs = require('fs'),
argv = require('optimist').argv,
azure = require('azure'),
async = require('async'),
sprintf = require("sprintf-js").sprintf,
util = require("util");

var Format = function (template, replacement) {
	if (typeof replacement != "object") {
		replacement = Array.prototype.slice.call(arguments, 1);
	}
	return template.replace(/\%(.+?)\%/g, function (m, c) {
		return (replacement[c] !== null) ? replacement[c] : m;
	});
};

var Guid = function () {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = Math.random() * 16 | 0,
		v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
};

function azType(type, v) {
	if (!type) {
		type = "Edm.String";
	} else if (type == "Edm.Boolean") {
		if (v == "0" || v.toLowerCase() == "false" || v == "" || v == undefined) {
			v = false;
		} else {
			v = true;
		}
	}
	return {
		"$" : {
			type : type
		},
		"_" : v
	};
}

// parse settings.json
var options = {};
if (argv.config) {
	try {
		var config = JSON.parse(fs.readFileSync(argv.config, 'utf8'));
		for (var key in config) {
			options[key] = config[key];
		}
	} catch (e) {
		console.error('Invalid JSON config file or file not found.: ' + options.config);
		process.exit(-1);
	}
} else {
	console.info('pnop AWS Simple DB to Windows Azure Table Storage Converter');
	console.info('Usage:');
	console.info('--config settings.json');
	console.info('[--awsKey aws_access_key] Optional AWS access key');
	console.info('[--awsSecret aws_secret_key] Optional AWS secret key');
	console.info('[--sdbHostName us-east-1]  Optional AWS Simple DB endpoint FQDN');
	console.info('[--azureAccount azure_account] Optional Windows Azure Storage account name');
	console.info('[--azureSecret azure_secret] Optional Windows Azure Storage secret key');
	console.info('[--partitionKey azure_storage_partition_key_template]  Optional Windows Azure Storage partition key template');
	console.info('[--rowKey azure_storage_partition_key_template] Optional Windows Azure Storage row key template');
	console.info('[-s] Optional error skip mode');
	process.exit(0);
}

// parse argument
options.awsKey = options.awsKey || argv.awsKey;
options.awsSecret = options.awsSecret || argv.awsSecret;
options.sdbHostName = options.sdbHostName || argv.sdbHostName || 'us-east-1';
options.azureAccount = options.azureAccount || argv.azureAccountName;
options.azureSecret = options.azureSecret || argv.azureSecret;

if (!(options.awsKey || options.awsSecret || options.azureAccount || options.azureSecret)) {
	console.error("Option azure or aws keys not specified.");
	process.exit(-1);
}

var targetDomains = [];
if (argv.tables) {
	targetDomains = argv.tables.split(',');
} else {
	targetDomains = Object.keys(options.tables);
}

async.forEach(targetDomains, function (domainName) {

	if (!options.tables[domainName]) {
		if ((argv.partitionKey && argv.rowKey)) {
			options.tables[domainName] = JSON.parse(Format('{"replace":{"PartitionKey" : {"Value" : "%0%"},"RowKey" : {"Value" : "%1%"}},"type": {"PartitionKey": "Edm.String","RowKey": "Edm.String"}}', [argv.partitionKey, argv.rowKey]));
		} else {
			console.error("Option partitionKey or rowKey not specified");
			process.exit(-1);
		}
	}
});

if (!options.tables) {
	console.error("Option tables  not specified.");
	process.exit(-1);
}

var Request = function (sdb, selectParam, domainName, tableService, counter) {
	var startcount = counter;
	sdb.select(selectParam, function(err, res) {
		if (err) {
			console.error("Error sdb domain not found.  Error was: " + JSON.stringify(err));
			process.exit(-1);
		} else {
			var resultset = [];
			res.Items.forEach(function(item) {
				var row = {};
				row['$Identity'] = counter;
				row['$Guid'] = Guid();
				row['$ItemName'] = item.Name;
				item.Attributes.forEach(function(col) {
					row[col.Name] = col.Value;
				});

				var partitionKey = Format(options.tables[domainName]['replace']['PartitionKey']['Value'], row);
				var rowKey = Format(options.tables[domainName]['replace']['RowKey']['Value'], row);

				if (options.tables[domainName]['replace']['PartitionKey']['Padding']) {
					partitionKey = sprintf("%0" + options.tables[domainName]['replace']['PartitionKey']['Padding'] + "d", parseInt(partitionKey));
				}

				if (options.tables[domainName]['replace']['RowKey']['Padding']) {
					rowKey = sprintf("%0" + options.tables[domainName]['replace']['RowKey']['Padding'] + "d", parseInt(rowKey));
				}

				var entity = {
					PartitionKey : azType(options.tables[domainName]['type']['PartitionKey'], partitionKey),
					RowKey : azType(options.tables[domainName]['type']['RowKey'], rowKey)
				};

				for (var key in row) {
					if (!(key == '$ItemName' || key == '$Identity' || key == '$Guid')) {

						if (row[key]=="[object Object]") {
							row[key] = ""
						}
						
						entity[key] = azType(options.tables[domainName]['type'][key], row[key]);
					}
				}

				insertEntity(tableService, domainName, entity, res, resultset, sdb, selectParam, counter, startcount);
				counter ++;
			});
			/*
			if (res.NextToken) {
				selectParam.NextToken = res.NextToken;
				//Request(sdb, selectParam, domainName, tableService, counter);
			}
			*/
		}
	});
};

function insertEntity (tableService, domainName, entity, res, resultset, sdb, selectParam, counter, startcount) {
	tableService.insertEntity(domainName, entity, function (error) {
		if (error) {
			switch (error['code']) {
				case 'ECONNRESET':
				case 'AuthenticationFailed':
					// retry
					console.log("raise " + error['code'] + ", " + JSON.stringify(error));
					insertEntity(tableService, domainName, entity, res, resultset, sdb, selectParam, counter, startcount);
					break;
				default:
					// error
					console.error("Windows Azure Table Storage Insert Error occurred.  Error was: " + JSON.stringify(error));
					console.error(JSON.stringify(entity) + "\n");
					if (!argv.s) {
						process.exit(-1);
					}
					break;
			}
		}
	}, function (error, entity, response) {
		resultset.push(response.headers.location);
		if (res.Items.length === resultset.length && res.NextToken) {
			startcount += resultset.length;
			console.log(startcount);
			resultset = [];
			selectParam.NextToken = res.NextToken;
			Request(sdb, selectParam, domainName, tableService, startcount);
		}
	});
}

async.forEach(targetDomains, function (domainName) {

	// Connect to SimpleDB.
	var tableService = azure.createTableService(options.azureAccount, options.azureSecret);
	
	awsCredentials = new aws.Credentials(options.awsKey, options.awsSecret);
	var sdb = new aws.SimpleDB({
		credentials: awsCredentials,
		apiVersion: '2009-04-15',
		region: options.sdbHostName,
		maxRetries: 10,
		sslEnabled: true
	});
	
	// Azure
	tableService.createTableIfNotExists(domainName, function (error) {
		if (error) {
			console.error("Windows Azure Table Storage Create Table Error occurred.  Error was: " + error);
			process.exit(-1);
		}
	});

	// Building Query
	var sdbQuery;
	if (options.tables[domainName]['where']) {
		sdbQuery = Format('SELECT * FROM %0% WHERE %1%', domainName, options.tables[domainName]['where']);
	} else {
		sdbQuery = Format('SELECT * FROM %0%', domainName);
	}
	var selectParam = {
		SelectExpression: sdbQuery,
		ConsistentRead: true
	};

	Request(sdb, selectParam, domainName, tableService, 0);
});
