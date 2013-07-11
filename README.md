# sdb2aztbl - Data converter to Windows Azure Table from Amazon Web Services SimpleDB

The sdb2aztbl is data migration commandline tool to Windows Azure Table storage from Amazon SimpleDB!

## License

Apache License Version 2.0

## Supported Environments

### Targeted platforms
- Amazon Linux
- CentOS
- Ubuntu Linux
- Windows XP or later
- Mac OS X

### Required software
- node.js v0.8 or later.

## Usage

    node sdb2aztbl.js --config settings.json [--tables table1,table2...] [--awsKey aws_access_key] [--awsSecret aws_secret_key]
    [--sdbHostName sdb.ap-northeast-1.amazonaws.com] [--azureAccount azure_account]
    [--azureSecret azure_secret] [--partitionKey azure_storage_partition_key_template] 
    [--rowKey azure_storage_partition_key_template] 

### Arguments

| Arg            | Description                                                                           | Example                       |
|:---------------|:--------------------------------------------------------------------------------------|:------------------------------|
| **config**     | Configration file of sdb2aztbl.                                                       |                               |
| *sdbHostName*  | Migration source AWS SimpleDB's  region endpoint. The default value are Tokyo region. | `sdb.ap-northeast-1.amazonaws.com` |
| *awsKey*       | Key of AWS                                                                            |                               |
| *awsSecret*    | Sercret key of AWS                                                                    |                               |
| *tables*       | Migration source domain name (or table name) to be migrated, comma delimited.    |                               |
| *azureAccount* | Migration destination Windows Azure Table storage account name.                       |                               |
| *azureSecret*  | Migration destination Windows Azure Table storage account sercret key.                |                               |
| *partitionKey* | Format string of the Windows Azure Table's partition key.                             | `"%Attribute1%-%Attribute2%"` |
| *rowKey*       | Format string of the Windows Azure Table's row key.                                   | `"%Attribute1%-%Attribute2%"` |

You can formatting value of `partitionKey` and `rowKey`. See also "About partionKey and rowKey" section.


## Configration file

The sdb2aztbl can configured other details from `setting.json`. If you configured arguments and settings.json both, an arguments is preferred priority over settings.json.

    {
        "awsKey": "<Your Key of AWS>",
        "awsSecret": "<Your Secret key of AWS>",
        "sdbHostName": "sdb.ap-northeast-1.amazonaws.com",
        "azureAccount": "<Your Windows Azure Table storage account name>",
        "azureSecret": "<Your Windows Azure Table storage account secret key>",
        "tables": {
              "Amazon SimpleDB's domain name or table name": {
              "replace": {
                  "PartitionKey": "%Attribute1%-%Attribute2%",
                  "RowKey": "%Attribute1%-%Attribute2%"
              },
             "type": {
                  "StringAttribute":"Edm.String",
                  "IntAttribute": "Edm.Int32",
                  "Int64Attribute": "Edm.Int64",
                  "DoubleAttribute": "Edm.Double",
                  "BoolAttribute": "Edm.Boolean",
                  "GUIDAttribute": "Edm.Guid",
                  "DateTimeAttribute": "Edm.DateTime"
             },
             "where": "`BoolTest` = '1'"
             }
        }
    }

### About `partitionKey` and `rowKey`

You can formatting value of `partitionKey` and `rowKey`. 

    "partitionKey": "Any value of the fixed"

You will output the value of any directly. In the following example, The `partitionKey` combined FirstName and LastName attribute of SimpleDB.

    "partitionKey": "%FirstName% %LastName%"

### Special identifier

| Identifier    | Value                             |
|:--------------|:----------------------------------|
| "%$ItemName%" | `ItemName()` row of AWS SimpleDB. |
| "%$Identity%" | Sequence number of zero origin.   |
| "%$Guid%"     | Generate new GUID.                |

It is also possible to use a combination of several of these features.
    
    "Azure_%Guid%_%FirstName%_%Identity%"

If the value of the Attribute FirstName of SimpleDB was ** PNOP **, PartitionKey similar to the following is generated.

    "Azure_ACBB16CA-E78D-3B13-041-3CD2-8CC57221_PNOP_0"

### About `type` key

When you import, you can specify the type explicitly. The sdb2aztbl will import as a Edm.String If not specified. The type can be one of the following types that can be specified in the Windows Azure. 

- Edm.String
- Edm.Int32
- Edm.Int64
- Edm.Double
- Edm.Boolean
- Edm.Guid
- Edm.DateTime

Notes: You do not designate type a `partitionKey` and `rowKey`.

### tables define

        "tables": {
              "Migration source Amazon SimpleDB's domain name": {
              "replace": {
                  "PartitionKey": "%Attribute1%-%Attribute2%",
                  "RowKey": "%Attribute1%-%Attribute2%"
              },
             "type": {
                  "PartitionKey": "Edm.String",
                  "RowKey": "Edm.String",
                  "StringAttribute":"Edm.String",
                  "IntAttribute": "Edm.Int32",
                  "Int64Attribute": "Edm.Int64",
                  "DoubleAttribute": "Edm.Double",
                  "BoolAttribute": "Edm.Boolean",
                  "GUIDAttribute": "Edm.Guid",
                  "DateTimeAttribute": "Edm.DateTime"
             },
             "where": "`BoolTest` = '1'"
             }
        }

## Errors
The sdb2aztbl's error detail output to standard error output. And sdb2aztbl stop immediately when caught the exception. (ex: string cannot be used for import) 

## How to install node.js on Windows / Max OS X

You can get the installer from [http://nodejs.org/download/](http://nodejs.org/download/). node.js install according to the installation wizard after download.


## How to install node.js on Linux
You can using [https://github.com/isaacs/nave](https://github.com/isaacs/nave "nave"). The node.js distribute built binary to user environment after install.

    wget https://github.com/isaacs/nave/raw/master/nave.sh
    bash nave.sh install stable
    bash nave.sh use stable
