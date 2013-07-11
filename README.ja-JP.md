# sdb2aztbl - Data converter to Windows Azure Table from Amazon Web Services SimpleDB #
Amazon SimpleDBからWindows Azure Table storageへデーターを移行する為のソフトウェアです。
CLIで操作します。

## License##

Apache License Version 2.0

## Supported Environments　##

### OS ###
- Amazon Linux
- CentOS
- Ubuntu Linux
- Windows XP 以降
- Mac OS X

### 必要なソフトウェア ###
- node.js v0.8以降

## USAGE ##

    node sdb2aztbl.js --config settings.json [ --tables table1,table2...] [--awsKey aws_access_key] [--awsSecret aws_secret_key]
    [--sdbHostName sdb.ap-northeast-1.amazonaws.com] [--azureAccount azure_account]
    [--azureSecret azure_secret] [--partitionKey azure_storage_partition_key_template] 
    [--rowKey azure_storage_partition_key_template] 

### 引数 ###
    config 設定ファイル
    tables 移行するドメイン名（テーブル名）カンマ区切りで複数指定可能
    awsKey AWSのキー
    awsSecret AWSシークレットキー
    sdbHostName 移行元のAmazon SimpleDBのリージョンエンドポイント デフォルトは東京リージョン
    azureAccount Windows Azure Storage アカウント名
    azureSecret Windows Azure Storage シークレットキー
    partitionKey "%Attribute1%-%Attribute2%"
    rowKey "%Attribute1%-%Attribute2%"

PartitionKey、RowKeyの値文字列のフォーマットが可能です、後述のPartitionKeyとRowKeyについてを確認してください。

## 設定ファイル ##
引数に指定する他にsetting.jsonに指定する事も可能です。引数が指定されている場合は、引数の値が優先されます。

    {
        "awsKey": "AWSのキー",
        "awsSecret": "AWSシークレットキー",
        "sdbHostName": "移行元のAmazon SimpleDBのリージョンエンドポイント デフォルトはsdb.ap-northeast-1.amazonaws.com",
        "azureAccount": "Windows Azure Storage アカウント名",
        "azureSecret": "Windows Azure Storage シークレットキー",
        "tables": {
              "移行元のAmazon SimpleDBのドメイン名": {
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

## PartitionKeyとRowKeyについて ##

PartitionKeyとRowKeyは任意のフォーマットを指定可能です。SimpleDBのアトリビュート名や特殊識別子を%で囲んで指定します。

    "partitionKey": "固定の任意の値"

そのまま任意の値を出力します

    "partitionKey": "%FirstName% %LastName%"

SimpleDBのAttribute FirstNameとLastNameをスペースで結合して出力します。

### 特殊識別子について ###

    "%$ItemName%" AWS SimpleDB のItemName()列を出力します
    "%$Identity%" 連番 0開始で1行づつインクリメントします
    "%$Guid%" GUID値を生成します

これらの機能を複数組み合わせて使う事も可能です。
    
    "Azure_%Guid%_%FirstName%_%Identity%"

### 例 ###

SimpleDBのAttribute FirstNameの値が**PNOP**であった場合、以下のようなPartitionKeyが生成されます。

    "Azure_ACBB16CA-E78D-3B13-041-3CD2-8CC57221_PNOP_0"

## typeについて ##

インポートする際に、明示的に型を指定する事ができます。指定が無い場合はEdm.Stringであるとしてインポートします。
型はWindows Azureで指定可能な以下の型のいずれかを指定します。なお、PartitionKeyとRowKeyはEdm.Stringの指定が必須の為、指定する必要はありません。

- Edm.String
- Edm.Int32
- Edm.Int64
- Edm.Double
- Edm.Boolean
- Edm.Guid
- Edm.DateTime

## テーブル定義について ##
設定ファイルには、移行先の移行元のAmazon SimpleDBのドメイン名を指定した、以下のフォーマットの定義が必要です。Edmで始まる型を指定する事でインポート時に型を付与する事ができます。

テーブル定義が存在する場合、引数のtablesは指定の必要がありません、テーブル定義からテーブル名を取得します。
また、定義が存在する場合に引数tablesが指定された場合は、引数tablesで指定したテーブルを移行対象とし、移行の情報はテーブル定義を参照します。その際、定義が存在しない場合はEdm.Stringであるものとして移行します。

        "tables": {
              "移行元のAmazon SimpleDBのドメイン名": {
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

## エラー時 ##
エラー出力にエラーの内容を出力します。また、インポート時に使えない文字列や最大入力から溢れた場合や例外発生時は、その場でエラーとして停止します。

## Windows / Max OS Xのnode.jsインストール##

[http://nodejs.org/download/
](http://nodejs.org/download/)

より、各プラットフォーム向けにインストーラーをダウンロード後、ウィザードに従いインストールを行ってください。

## Linux環境でのnode.jsインストール ##
naveを使い、ビルド済みのバイナリをユーザー環境に構築できます。

    wget https://github.com/isaacs/nave/raw/master/nave.sh
    bash nave.sh install stable
    bash nave.sh use stable
