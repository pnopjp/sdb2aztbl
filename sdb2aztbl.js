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

var simpledb = require('simpledb'),
    fs = require('fs'),
    argv = require('optimist').argv,
    azure = require('azure'),
    async = require('async');

var Format = function (template, replacement) {
    if (typeof replacement != "object") {
        replacement = Array.prototype.slice.call(arguments, 1);
    }
    return template.replace(/\%(.+?)\%/g, function (m, c) {
        return (replacement[c] !== null) ? replacement[c] : m
    });
}

var Guid = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function azType(type, v) {
    if (!type) {
        type = "Edm.String";
    }
    return { "$": { type: type }, "_": v };
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
        console.warn('Invalid JSON config file: ' + options.config);
        throw e;
    }
} else {
    console.info('pnop AWS Simple DB to Windows Azure Table Storage Converter');
    console.info('Usage:');
    console.info('--config settings.json');
    console.info('[--awsKey aws_access_key] Optional AWS access key');
    console.info('[--awsSecret aws_secret_key] Optional AWS secret key');
    console.info('[--sdbHostName sdb.ap-northeast-1.amazonaws.com]  Optional AWS Simple DB endpoint FQDN');
    console.info('[--azureAccount azure_account] Optional Windows Azure Storage account name');
    console.info('[--azureSecret azure_secret] Optional Windows Azure Storage secret key');
    console.info('[--partitionKey azure_storage_partition_key_template]  Optional Windows Azure Storage partition key template');
    console.info('[--rowKey azure_storage_partition_key_template] Optional Windows Azure Storage row key template');
    process.exit(0);
}

// parse argument
options['awsKey'] = options['awsKey'] || argv.awsKey;
options['awsSecret'] = options['awsSecret'] || argv.awsSecret;
options['sdbHostName'] = options['sdbHostName'] || argv.sdbHostName || 'sdb.ap-northeast-1.amazonaws.com';
options['azureAccount'] = options['azureAccount'] || argv.azureAccountName;
options['azureSecret'] = options['azureSecret'] || argv.azureSecret;

if (!(options.awsKey || options.awsSecret || options.azureAccount || options.azureSecret)) {
    console.error("Option azure or aws keys not specified.");
    process.exit(-1);
}

var targetDomains = [];
if (argv.tables) {
    targetDomains = argv.tables.split(',');
} else {
    targetDomains = Object.keys(options['tables']);
}

async.forEach(targetDomains, function (domainName) {

    if (!options['tables'][domainName]) {
        if ((argv.partitionKey && argv.rowKey)) {
            options['tables'][domainName] = JSON.parse(Format('{"replace":{"PartitionKey": "%0%","RowKey": "%1%"},"type": {"PartitionKey": "Edm.String","RowKey": "Edm.String"}}', [argv.partitionKey, argv.rowKey]));
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

async.forEach(targetDomains, function (domainName) {

    // Connect to SimpleDB.
    var sdb = new simpledb.SimpleDB({keyid: options.awsKey, secret: options.awsSecret, host: options.sdbHostName, nolimit: true});
    var tableService = azure.createTableService(options['azureAccount'], options['azureSecret']);

    // Azure
    tableService.createTableIfNotExists(domainName, function (error) {
        if (error) {
            console.error("Windows Azure Table Storage Create Table Error occurred.  Error was: " + error);
            process.exit(-1);
        }
    });

    // Building Query
    var sdbQuery;
    if (options['tables'][domainName]['where']) {
        sdbQuery = Format('SELECT * FROM %0% WHERE %1%', domainName, options['tables'][domainName]['where']);
    } else {
        sdbQuery = Format('SELECT * FROM %0%', domainName);
    }

    while (sdb.select(sdbQuery, function (err, res, metadata) {
        var counter = 0;
        if (res) {
            res.forEach(function (item) {
                sdb.getItem(domainName, item["$ItemName"], function (error, row, rowMeta) {
                    row['$Identity'] = counter;
                    row['$Guid'] = Guid();

                    var entity = {
                        PartitionKey: azType(options['tables'][domainName]['type']['PartitionKey'], Format(options['tables'][domainName]['replace']['PartitionKey'], row)),
                        RowKey: azType(options['tables'][domainName]['type']['RowKey'], Format(options['tables'][domainName]['replace']['RowKey'], row))
                    };

                    for (var key in row) {
                        if (!(key == '$ItemName' || key == '$Identity' || key == '$Guid')) {
                            entity[key] = azType(options['tables'][domainName]['type'][key], row[key]);
                        }
                    }

                    tableService.insertEntity(domainName, entity, function (error) {
                        if (error) {
                            console.error("Windows Azure Table Storage Insert Error occurred.  Error was: " + JSON.stringify(error));
                            console.error(JSON.stringify(entity) + "\n");
                            process.exit(-1);
                        }
                    })
                    counter++;
                });
            });
        } else {
            console.error("Error sdb domain not found.  Error was: " + JSON.stringify(err));
            process.exit(-1);
        }
    }));
});

