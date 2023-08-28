# @kitalive/sfdx-plugin

[![Version](https://img.shields.io/npm/v/@kitalive/sfdx-plugin.svg)](https://npmjs.org/package/@kitalive/sfdx-plugin)
[![License](https://img.shields.io/npm/l/@kitalive/sfdx-plugin.svg)](https://github.com/Kitalive-Inc/sfdx-plugin/blob/main/package.json)

## Install

```
sf plugins install @kitalive/sfdx-plugin
```

## Usage

<!-- usage -->

```sh-session
$ npm install -g @kitalive/sfdx-plugin
$ sf COMMAND
running command...
$ sf (--version)
@kitalive/sfdx-plugin/0.5.1 darwin-arm64 node-v18.15.0
$ sf --help [COMMAND]
USAGE
  $ sf COMMAND
...
```

<!-- usagestop -->

## Commands

<!-- commands -->

- [`sf kit data bulk delete`](#sf-kit-data-bulk-delete)
- [`sf kit data bulk insert`](#sf-kit-data-bulk-insert)
- [`sf kit data bulk query`](#sf-kit-data-bulk-query)
- [`sf kit data bulk update`](#sf-kit-data-bulk-update)
- [`sf kit data bulk upsert`](#sf-kit-data-bulk-upsert)
- [`sf kit data csv convert`](#sf-kit-data-csv-convert)
- [`sf kit layout assignments deploy`](#sf-kit-layout-assignments-deploy)
- [`sf kit layout assignments retrieve`](#sf-kit-layout-assignments-retrieve)
- [`sf kit object fields describe`](#sf-kit-object-fields-describe)
- [`sf kit object fields setup`](#sf-kit-object-fields-setup)
- [`sf kit script`](#sf-kit-script)
- [`sf kit script execute`](#sf-kit-script-execute)

## `sf kit data bulk delete`

Bulk delete records by SOQL select query.

```
USAGE
  $ sf kit data bulk delete -q <value> -o <value> [--json] [--hard] [--concurrencymode <value>] [-s <value>] [-w <value>]
    [--api-version <value>]

FLAGS
  -o, --target-org=<value>   (required) Username or alias of the target org.
  -q, --query=<value>        (required) SOQL query to delete
  -s, --batchsize=<value>    [default: 10000] The batch size of the job
  -w, --wait=<value>         The number of minutes to wait for the command to complete before displaying the results
  --api-version=<value>      Override the api version used for api requests made by this command
  --concurrencymode=<value>  [default: Parallel] The concurrency mode (Parallel or Serial) for the job
  --hard                     Perform a hard delete

GLOBAL FLAGS
  --json  Format output as json.

EXAMPLES
  Delete Opportunity records with CloseDate older than 2 years:

    $ sf kit data bulk delete -q "SELECT Id FROM Opportunity WHERE CloseDate < LAST_N_YEARS:2"
```

## `sf kit data bulk insert`

For information about CSV file formats, see [Prepare CSV Files](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_csv_preparing.htm) in the Bulk API Developer Guide.

```
USAGE
  $ sf kit data bulk insert -s <value> -f <value> -o <value> [--json] [-r <value>] [-e <value>] [-d <value>] [-q <value>]
    [--skiplines <value>] [--trim] [-m <value>] [-c <value>] [--setnull] [--convertonly] [--concurrencymode <value>]
    [--assignmentruleid <value>] [--batchsize <value>] [-w <value>] [--api-version <value>]

FLAGS
  -c, --converter=<value>     The path of the script to convert CSV rows
  -d, --delimiter=<value>     [default: ,] The input CSV file delimiter
  -e, --encoding=<value>      [default: utf8] The input CSV file encoding
  -f, --csvfile=<value>       (required) The CSV file path that defines the records to insert
  -m, --mapping=<value>       The path of the JSON file that defines CSV column mappings
  -o, --target-org=<value>    (required) Username or alias of the target org.
  -q, --quote=<value>         [default: "] The input CSV file quote character
  -r, --resultfile=<value>    The CSV file path for writing the insert results
  -s, --sobject=<value>       (required) The SObject name to insert
  -w, --wait=<value>          The number of minutes to wait for the command to complete before displaying the results
  --api-version=<value>       Override the api version used for api requests made by this command
  --assignmentruleid=<value>  The ID of a specific assignment rule to run for a case or a lead
  --batchsize=<value>         [default: 10000] The batch size of the job
  --concurrencymode=<value>   [default: Parallel] The concurrency mode (Parallel or Serial) for the job
  --convertonly               Output converted.csv file and skip insert for debugging
  --setnull                   Set blank values as null values during insert operations (default: empty field values are
                              ignored)
  --skiplines=<value>         The number of lines to skip
  --trim                      Trim all white space from columns

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  For information about CSV file formats, see [Prepare CSV
  Files](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_csv_preparing.htm) in
  the Bulk API Developer Guide.

EXAMPLES
  Insert Account records with mapping.json:

    $ sf kit data bulk insert -o Account -f ./path/to/Account.csv -m ./path/to/mapping.json

  Insert MyObject\_\_c records with convert.js:

    $ sf kit data bulk insert -o MyObject**c -f ./path/to/MyObject**c.csv -c ./path/to/convert.js -w 10
```

## `sf kit data bulk query`

Bulk query records.

```
USAGE
  $ sf kit data bulk query -q <value> -o <value> [--json] [-f <value>] [--api-version <value>]

FLAGS
  -f, --csvfile=<value>     [default: standard output] Output csv file
  -o, --target-org=<value>  (required) Username or alias of the target org.
  -q, --query=<value>       (required) SOQL query to export
  --api-version=<value>     Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

EXAMPLES
  Query Account records and save to specified path:

    $ sf kit data bulk query -q "SELECT Id, Name FROM Account" -f ./path/to/Account.csv
```

## `sf kit data bulk update`

For information about CSV file formats, see [Prepare CSV Files](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_csv_preparing.htm) in the Bulk API Developer Guide.

```
USAGE
  $ sf kit data bulk update -s <value> -f <value> -o <value> [--json] [-r <value>] [-e <value>] [-d <value>] [-q <value>]
    [--skiplines <value>] [--trim] [-m <value>] [-c <value>] [--setnull] [--convertonly] [--concurrencymode <value>]
    [--assignmentruleid <value>] [--batchsize <value>] [-w <value>] [--api-version <value>]

FLAGS
  -c, --converter=<value>     The path of the script to convert CSV rows
  -d, --delimiter=<value>     [default: ,] The input CSV file delimiter
  -e, --encoding=<value>      [default: utf8] The input CSV file encoding
  -f, --csvfile=<value>       (required) The CSV file path that defines the records to update
  -m, --mapping=<value>       The path of the JSON file that defines CSV column mappings
  -o, --target-org=<value>    (required) Username or alias of the target org.
  -q, --quote=<value>         [default: "] The input CSV file quote character
  -r, --resultfile=<value>    The CSV file path for writing the update results
  -s, --sobject=<value>       (required) The SObject name to update
  -w, --wait=<value>          The number of minutes to wait for the command to complete before displaying the results
  --api-version=<value>       Override the api version used for api requests made by this command
  --assignmentruleid=<value>  The ID of a specific assignment rule to run for a case or a lead
  --batchsize=<value>         [default: 10000] The batch size of the job
  --concurrencymode=<value>   [default: Parallel] The concurrency mode (Parallel or Serial) for the job
  --convertonly               Output converted.csv file and skip update for debugging
  --setnull                   Set blank values as null values during update operations (default: empty field values are
                              ignored)
  --skiplines=<value>         The number of lines to skip
  --trim                      Trim all white space from columns

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  For information about CSV file formats, see [Prepare CSV
  Files](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_csv_preparing.htm) in
  the Bulk API Developer Guide.

EXAMPLES
  Update Account records with mapping.json:

    $ sf kit data bulk update -o Account -f ./path/to/Account.csv -m ./path/to/mapping.json

  Update MyObject\_\_c records with convert.js:

    $ sf kit data bulk update -o MyObject**c -f ./path/to/MyObject**c.csv -c ./path/to/convert.js -w 10
```

## `sf kit data bulk upsert`

For information about CSV file formats, see [Prepare CSV Files](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_csv_preparing.htm) in the Bulk API Developer Guide.

```
USAGE
  $ sf kit data bulk upsert -s <value> -f <value> -o <value> -i <value> [--json] [-r <value>] [-e <value>] [-d <value>]
    [-q <value>] [--skiplines <value>] [--trim] [-m <value>] [-c <value>] [--setnull] [--convertonly] [--concurrencymode
    <value>] [--assignmentruleid <value>] [--batchsize <value>] [-w <value>] [--api-version <value>]

FLAGS
  -c, --converter=<value>     The path of the script to convert CSV rows
  -d, --delimiter=<value>     [default: ,] The input CSV file delimiter
  -e, --encoding=<value>      [default: utf8] The input CSV file encoding
  -f, --csvfile=<value>       (required) The CSV file path that defines the records to upsert
  -i, --externalid=<value>    (required) [default: Id] The column name of the external ID
  -m, --mapping=<value>       The path of the JSON file that defines CSV column mappings
  -o, --target-org=<value>    (required) Username or alias of the target org.
  -q, --quote=<value>         [default: "] The input CSV file quote character
  -r, --resultfile=<value>    The CSV file path for writing the upsert results
  -s, --sobject=<value>       (required) The SObject name to upsert
  -w, --wait=<value>          The number of minutes to wait for the command to complete before displaying the results
  --api-version=<value>       Override the api version used for api requests made by this command
  --assignmentruleid=<value>  The ID of a specific assignment rule to run for a case or a lead
  --batchsize=<value>         [default: 10000] The batch size of the job
  --concurrencymode=<value>   [default: Parallel] The concurrency mode (Parallel or Serial) for the job
  --convertonly               Output converted.csv file and skip upsert for debugging
  --setnull                   Set blank values as null values during upsert operations (default: empty field values are
                              ignored)
  --skiplines=<value>         The number of lines to skip
  --trim                      Trim all white space from columns

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  For information about CSV file formats, see [Prepare CSV
  Files](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_csv_preparing.htm) in
  the Bulk API Developer Guide.

EXAMPLES
  Upsert Account records with mapping.json:

    $ sf kit data bulk upsert -o Account -f ./path/to/Account.csv -m ./path/to/mapping.json

  Upsert MyObject\_\_c with convert.js and external ID

    $ sf kit data bulk upsert -o MyObject**c -f ./path/to/MyObject**c.csv -c ./path/to/convert.js -i \
      MyExternalId\_\_c -w 10
```

## `sf kit data csv convert`

Convert CSV data using column mapping file or Node.js script.

```
USAGE
  $ sf kit data csv convert [--json] [-i <value>] [-o <value>] [-e <value>] [-d <value>] [-q <value>] [--skiplines
    <value>] [--trim] [-m <value>] [-c <value>]

FLAGS
  -c, --converter=<value>  The path of the script to convert CSV rows
  -d, --delimiter=<value>  [default: ,] The input CSV file delimiter
  -e, --encoding=<value>   [default: utf8] The input CSV file encoding
  -i, --input=<value>      [default: standard input] The path of the input CSV file
  -m, --mapping=<value>    The path of the JSON file that defines CSV column mappings
  -o, --output=<value>     [default: standard output] The path of the output CSV file
  -q, --quote=<value>      [default: "] The input CSV file quote character
  --skiplines=<value>      The number of lines to skip
  --trim                   Trim all white space from columns

GLOBAL FLAGS
  --json  Format output as json.

EXAMPLES
  Convert csv file using mapping file and output to standard output:

    $ sf kit data csv convert -i ./path/to/input.csv -m ./path/to/mapping.json

  Convert csv file using script and output to specified path:

    $ sf kit data csv convert -i ./path/to/input.csv -o ./path/to/output.csv -c ./path/to/convert.js
```

## `sf kit layout assignments deploy`

Deploy page layout assignments from JSON file.

```
USAGE
  $ sf kit layout assignments deploy -f <value> -o <value> [--json] [--api-version <value>]

FLAGS
  -f, --file=<value>        (required) [default: config/layout-assignments.json] Input file path of page layout
                            assignment settings.
  -o, --target-org=<value>  (required) Username or alias of the target org.
  --api-version=<value>     Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

EXAMPLES
  Deploy from the default file path to the default org:

    $ sf kit layout assignments deploy

  Deploy from the specified file to the default org:

    $ sf kit layout assignments deploy -f config/layout-assignments.scratch.json

  Deploy from the specified file to the specified org:

    $ sf kit layout assignments deploy -o me@my.org -f config/layout-assignments.sandbox.json
```

## `sf kit layout assignments retrieve`

Retrieve page layout assignments and save to JSON file.

```
USAGE
  $ sf kit layout assignments retrieve -f <value> -o <value> [--json] [-p <value>] [-s <value>] [--merge] [--api-version
  <value>]

FLAGS
  -f, --file=<value>        (required) [default: config/layout-assignments.json] Output file path of page layout
                            assignment settings.
  -o, --target-org=<value>  (required) Username or alias of the target org.
  -p, --profile=<value>...  [default: all profiles] Profile names to retrieve
  -s, --sobject=<value>...  [default: sobjects which have multiple layouts] SObject names to retrieve
  --api-version=<value>     Override the api version used for api requests made by this command
  --merge                   Merge retrieved configurations with existing file.

GLOBAL FLAGS
  --json  Format output as json.

EXAMPLES
  Retrieve page layout assignments from the default org and save to the default path:

    $ sf kit layout assignments retrieve

  Retrieve Admin profile's Account and Contact page layout assignments and save to the specified path:

    $ sf kit layout assignments retrieve -p Admin -s Account -s Contact -f config/layout-assignments.scratch.json

  Retrieve page layout assignments from the specified org and save to the specified path:

    $ sf kit layout assignments retrieve -o me@my.org -f config/layout-assignments.sandbox.json
```

## `sf kit object fields describe`

Describe sobject fields information.

```
USAGE
  $ sf kit object fields describe -s <value> -o <value> [--json] [-f <value>] [--api-version <value>]

FLAGS
  -f, --file=<value>        Output csv file path
  -o, --target-org=<value>  (required) Username or alias of the target org.
  -s, --sobject=<value>     (required) SObject name to describe
  --api-version=<value>     Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

EXAMPLES
  Describe Account fields of the default org and save to csv file:

    $ sf kit object fields describe -s Account -f path/to/account_fields.csv

  Output CustomObject\_\_c fields of the specified org as JSON format:

    $ sf kit object fields describe -o me@my.org -s CustomObject\_\_c --json
```

## `sf kit object fields setup`

Upsert and delete sobject fields from a CSV file.

```
USAGE
  $ sf kit object fields setup -s <value> -f <value> -o <value> [--json] [--delete] [--force] [--api-version <value>]

FLAGS
  -f, --file=<value>        (required) Input csv file path
  -o, --target-org=<value>  (required) Username or alias of the target org.
  -s, --sobject=<value>     (required) SObject name to setup
  --api-version=<value>     Override the api version used for api requests made by this command
  --delete                  Delete fields that are not in the csv file
  --force                   Do not confirm when deleting

GLOBAL FLAGS
  --json  Format output as json.

EXAMPLES
  Upsert Account fields to the default org:

    $ sf kit object fields setup -s Account -f path/to/account_fields.csv

  Upsert and delete CustomObject\_\_c fields to the specified org:

    $ sf kit object fields setup -o me@my.org -s CustomObject\_\_c -f path/to/custom_object_fields.csv --delete
```

## `sf kit script`

Execute Node.js scripts in SfCommand context.

```
USAGE
  $ sf kit script [--json] [-f <value>] [-o <value>] [--api-version <value>]

FLAGS
  -f, --file=<value>        The path of the Node.js script file to execute.
  -o, --target-org=<value>
  --api-version=<value>     Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Execute Node.js scripts in SfCommand context.

  Available variables in Node.js scripts

  - argv: Parsed command line arguments after the file option
  - conn: jsforce Connection
  - context: SfCommand

ALIASES
  $ sf kit script

EXAMPLES
  Execute from js file:

    $ sf kit script -f ./path/to/script.js

  Execute in REPL mode:

    $ sf kit script -o target-org

  query a account from org in REPL
  > await conn.query('SELECT Id, Name FROM Account LIMIT 1')
  Top level await is not enabled by default in REPL before Node.js v16
  $ NODE_OPTIONS=--experimental-repl-await sf kit script
```

## `sf kit script execute`

Execute Node.js scripts in SfCommand context.

```
USAGE
  $ sf kit script execute [--json] [-f <value>] [-o <value>] [--api-version <value>]

FLAGS
  -f, --file=<value>        The path of the Node.js script file to execute.
  -o, --target-org=<value>
  --api-version=<value>     Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Execute Node.js scripts in SfCommand context.

  Available variables in Node.js scripts

  - argv: Parsed command line arguments after the file option
  - conn: jsforce Connection
  - context: SfCommand

ALIASES
  $ sf kit script

EXAMPLES
  Execute from js file:

    $ sf kit script execute -f ./path/to/script.js

  Execute in REPL mode:

    $ sf kit script execute -o target-org

  query a account from org in REPL
  > await conn.query('SELECT Id, Name FROM Account LIMIT 1')
  Top level await is not enabled by default in REPL before Node.js v16
  $ NODE_OPTIONS=--experimental-repl-await sf kit script execute
```

<!-- commandsstop -->
