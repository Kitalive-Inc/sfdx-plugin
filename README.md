@kitalive/sfdx-plugin
=====================

[![Version](https://img.shields.io/npm/v/@kitalive/sfdx-plugin.svg)](https://npmjs.org/package/@kitalive/sfdx-plugin)
[![License](https://img.shields.io/npm/l/@kitalive/sfdx-plugin.svg)](https://github.com/Kitalive-Inc/sfdx-plugin/blob/main/package.json)

## Install

```
sfdx plugins:install @kitalive/sfdx-plugin
```

## Usage

<!-- usage -->
```sh-session
$ npm install -g @kitalive/sfdx-plugin
$ sfdx COMMAND
running command...
$ sfdx (-v|--version|version)
@kitalive/sfdx-plugin/0.2.1 darwin-x64 node-v14.15.0
$ sfdx --help [COMMAND]
USAGE
  $ sfdx COMMAND
...
```
<!-- usagestop -->

## Commands

<!-- commands -->
* [`sfdx kit:data:bulk:delete -q <string> [--hard] [--concurrencymode <string>] [-s <integer>] [-w <integer>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-kitdatabulkdelete--q-string---hard---concurrencymode-string--s-integer--w-integer--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx kit:data:bulk:insert -o <string> -f <filepath> [-r <filepath>] [-e <string>] [-d <string>] [-q <string>] [--skiplines <integer>] [--trim] [-m <filepath>] [-c <filepath>] [--setnull] [--convertonly] [--concurrencymode <string>] [--assignmentruleid <string>] [-s <integer>] [-w <integer>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-kitdatabulkinsert--o-string--f-filepath--r-filepath--e-string--d-string--q-string---skiplines-integer---trim--m-filepath--c-filepath---setnull---convertonly---concurrencymode-string---assignmentruleid-string--s-integer--w-integer--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx kit:data:bulk:query -q <string> [-f <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-kitdatabulkquery--q-string--f-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx kit:data:bulk:update -o <string> -f <filepath> [-r <filepath>] [-e <string>] [-d <string>] [-q <string>] [--skiplines <integer>] [--trim] [-m <filepath>] [-c <filepath>] [--setnull] [--convertonly] [--concurrencymode <string>] [--assignmentruleid <string>] [-s <integer>] [-w <integer>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-kitdatabulkupdate--o-string--f-filepath--r-filepath--e-string--d-string--q-string---skiplines-integer---trim--m-filepath--c-filepath---setnull---convertonly---concurrencymode-string---assignmentruleid-string--s-integer--w-integer--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx kit:data:bulk:upsert -o <string> -f <filepath> -i <string> [-r <filepath>] [-e <string>] [-d <string>] [-q <string>] [--skiplines <integer>] [--trim] [-m <filepath>] [-c <filepath>] [--setnull] [--convertonly] [--concurrencymode <string>] [--assignmentruleid <string>] [-s <integer>] [-w <integer>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-kitdatabulkupsert--o-string--f-filepath--i-string--r-filepath--e-string--d-string--q-string---skiplines-integer---trim--m-filepath--c-filepath---setnull---convertonly---concurrencymode-string---assignmentruleid-string--s-integer--w-integer--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx kit:data:csv:convert [-f <filepath>] [-o <filepath>] [-e <string>] [-d <string>] [-q <string>] [--skiplines <integer>] [--trim] [-m <filepath>] [-c <filepath>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-kitdatacsvconvert--f-filepath--o-filepath--e-string--d-string--q-string---skiplines-integer---trim--m-filepath--c-filepath---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx kit:layout:assignments:deploy -f <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-kitlayoutassignmentsdeploy--f-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx kit:layout:assignments:retrieve -f <string> [-p <string>] [-o <string>] [--merge] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-kitlayoutassignmentsretrieve--f-string--p-string--o-string---merge--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx kit:script:execute [-f <filepath>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-kitscriptexecute--f-filepath--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx kit:data:bulk:delete -q <string> [--hard] [--concurrencymode <string>] [-s <integer>] [-w <integer>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

bulk delete records by SOQL select query

```
USAGE
  $ sfdx kit:data:bulk:delete -q <string> [--hard] [--concurrencymode <string>] [-s <integer>] [-w <integer>] [-u 
  <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -q, --query=query                                                                 (required) SOQL query to delete

  -s, --batchsize=batchsize                                                         [default: 10000] the batch size of
                                                                                    the job

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  -w, --wait=wait                                                                   the number of minutes to wait for
                                                                                    the command to complete before
                                                                                    displaying the results

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --concurrencymode=concurrencymode                                                 [default: Parallel] the concurrency
                                                                                    mode (Parallel or Serial) for the
                                                                                    job

  --hard                                                                            perform a hard delete

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLE
  $ sfdx kit:data:bulk:delete -q 'SELECT Id FROM Opportunity WHERE CloseDate < LAST_N_YEARS:5'
```

_See code: [src/commands/kit/data/bulk/delete.ts](https://github.com/Kitalive-Inc/sfdx-plugin/blob/v0.2.1/src/commands/kit/data/bulk/delete.ts)_

## `sfdx kit:data:bulk:insert -o <string> -f <filepath> [-r <filepath>] [-e <string>] [-d <string>] [-q <string>] [--skiplines <integer>] [--trim] [-m <filepath>] [-c <filepath>] [--setnull] [--convertonly] [--concurrencymode <string>] [--assignmentruleid <string>] [-s <integer>] [-w <integer>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

bulk insert records from a CSV file

```
USAGE
  $ sfdx kit:data:bulk:insert -o <string> -f <filepath> [-r <filepath>] [-e <string>] [-d <string>] [-q <string>] 
  [--skiplines <integer>] [--trim] [-m <filepath>] [-c <filepath>] [--setnull] [--convertonly] [--concurrencymode 
  <string>] [--assignmentruleid <string>] [-s <integer>] [-w <integer>] [-u <string>] [--apiversion <string>] [--json] 
  [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --converter=converter                                                         the path of the script to convert
                                                                                    CSV rows

  -d, --delimiter=delimiter                                                         [default: ,] the input CSV file
                                                                                    delimiter

  -e, --encoding=encoding                                                           [default: utf8] the input CSV file
                                                                                    encoding

  -f, --csvfile=csvfile                                                             (required) the CSV file path that
                                                                                    defines the records to insert

  -m, --mapping=mapping                                                             the path of the JSON file that
                                                                                    defines CSV column mappings

  -o, --object=object                                                               (required) the sObject name to
                                                                                    insert

  -q, --quote=quote                                                                 [default: "] the input CSV file
                                                                                    quote character

  -r, --resultfile=resultfile                                                       the CSV file path for writing the
                                                                                    insert results

  -s, --batchsize=batchsize                                                         [default: 10000] the batch size of
                                                                                    the job

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  -w, --wait=wait                                                                   the number of minutes to wait for
                                                                                    the command to complete before
                                                                                    displaying the results

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --assignmentruleid=assignmentruleid                                               the ID of a specific assignment rule
                                                                                    to run for a case or a lead.

  --concurrencymode=concurrencymode                                                 [default: Parallel] the concurrency
                                                                                    mode (Parallel or Serial) for the
                                                                                    job

  --convertonly                                                                     output converted.csv file and skip
                                                                                    insert for debugging

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --setnull                                                                         set blank values as null values
                                                                                    during insert operations (default:
                                                                                    empty field values are ignored)

  --skiplines=skiplines                                                             [default: 0] the number of lines to
                                                                                    skip

  --trim                                                                            trim all white space from columns

DESCRIPTION
  For information about CSV file formats, see [Prepare CSV 
  Files](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_csv_preparing.htm) in 
  the Bulk API Developer Guide.

EXAMPLES
  $ sfdx kit:data:bulk:insert -o Account -f ./path/to/Account.csv -m ./path/to/mapping.json
  $ sfdx kit:data:bulk:insert -o MyObject__c -f ./path/to/MyObject__c.csv -c ./path/to/convert.js -w 10
```

_See code: [src/commands/kit/data/bulk/insert.ts](https://github.com/Kitalive-Inc/sfdx-plugin/blob/v0.2.1/src/commands/kit/data/bulk/insert.ts)_

## `sfdx kit:data:bulk:query -q <string> [-f <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

bulk query records

```
USAGE
  $ sfdx kit:data:bulk:query -q <string> [-f <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -f, --csvfile=csvfile                                                             output csv file (default: standard
                                                                                    output)

  -q, --query=query                                                                 (required) SOQL query to export

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLE
  $ sfdx kit:data:bulk:query -q 'SELECT Id, Name FROM Account' -f ./path/to/Account.csv
```

_See code: [src/commands/kit/data/bulk/query.ts](https://github.com/Kitalive-Inc/sfdx-plugin/blob/v0.2.1/src/commands/kit/data/bulk/query.ts)_

## `sfdx kit:data:bulk:update -o <string> -f <filepath> [-r <filepath>] [-e <string>] [-d <string>] [-q <string>] [--skiplines <integer>] [--trim] [-m <filepath>] [-c <filepath>] [--setnull] [--convertonly] [--concurrencymode <string>] [--assignmentruleid <string>] [-s <integer>] [-w <integer>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

bulk update records from a CSV file

```
USAGE
  $ sfdx kit:data:bulk:update -o <string> -f <filepath> [-r <filepath>] [-e <string>] [-d <string>] [-q <string>] 
  [--skiplines <integer>] [--trim] [-m <filepath>] [-c <filepath>] [--setnull] [--convertonly] [--concurrencymode 
  <string>] [--assignmentruleid <string>] [-s <integer>] [-w <integer>] [-u <string>] [--apiversion <string>] [--json] 
  [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --converter=converter                                                         the path of the script to convert
                                                                                    CSV rows

  -d, --delimiter=delimiter                                                         [default: ,] the input CSV file
                                                                                    delimiter

  -e, --encoding=encoding                                                           [default: utf8] the input CSV file
                                                                                    encoding

  -f, --csvfile=csvfile                                                             (required) the CSV file path that
                                                                                    defines the records to update

  -m, --mapping=mapping                                                             the path of the JSON file that
                                                                                    defines CSV column mappings

  -o, --object=object                                                               (required) the sObject name to
                                                                                    update

  -q, --quote=quote                                                                 [default: "] the input CSV file
                                                                                    quote character

  -r, --resultfile=resultfile                                                       the CSV file path for writing the
                                                                                    update results

  -s, --batchsize=batchsize                                                         [default: 10000] the batch size of
                                                                                    the job

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  -w, --wait=wait                                                                   the number of minutes to wait for
                                                                                    the command to complete before
                                                                                    displaying the results

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --assignmentruleid=assignmentruleid                                               the ID of a specific assignment rule
                                                                                    to run for a case or a lead.

  --concurrencymode=concurrencymode                                                 [default: Parallel] the concurrency
                                                                                    mode (Parallel or Serial) for the
                                                                                    job

  --convertonly                                                                     output converted.csv file and skip
                                                                                    update for debugging

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --setnull                                                                         set blank values as null values
                                                                                    during update operations (default:
                                                                                    empty field values are ignored)

  --skiplines=skiplines                                                             [default: 0] the number of lines to
                                                                                    skip

  --trim                                                                            trim all white space from columns

DESCRIPTION
  For information about CSV file formats, see [Prepare CSV 
  Files](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_csv_preparing.htm) in 
  the Bulk API Developer Guide.

EXAMPLES
  $ sfdx kit:data:bulk:update -o Account -f ./path/to/Account.csv -m ./path/to/mapping.json
  $ sfdx kit:data:bulk:update -o MyObject__c -f ./path/to/MyObject__c.csv -c ./path/to/convert.js -w 10
```

_See code: [src/commands/kit/data/bulk/update.ts](https://github.com/Kitalive-Inc/sfdx-plugin/blob/v0.2.1/src/commands/kit/data/bulk/update.ts)_

## `sfdx kit:data:bulk:upsert -o <string> -f <filepath> -i <string> [-r <filepath>] [-e <string>] [-d <string>] [-q <string>] [--skiplines <integer>] [--trim] [-m <filepath>] [-c <filepath>] [--setnull] [--convertonly] [--concurrencymode <string>] [--assignmentruleid <string>] [-s <integer>] [-w <integer>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

bulk upsert records from a CSV file

```
USAGE
  $ sfdx kit:data:bulk:upsert -o <string> -f <filepath> -i <string> [-r <filepath>] [-e <string>] [-d <string>] [-q 
  <string>] [--skiplines <integer>] [--trim] [-m <filepath>] [-c <filepath>] [--setnull] [--convertonly] 
  [--concurrencymode <string>] [--assignmentruleid <string>] [-s <integer>] [-w <integer>] [-u <string>] [--apiversion 
  <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --converter=converter                                                         the path of the script to convert
                                                                                    CSV rows

  -d, --delimiter=delimiter                                                         [default: ,] the input CSV file
                                                                                    delimiter

  -e, --encoding=encoding                                                           [default: utf8] the input CSV file
                                                                                    encoding

  -f, --csvfile=csvfile                                                             (required) the CSV file path that
                                                                                    defines the records to upsert

  -i, --externalid=externalid                                                       (required) [default: Id] the column
                                                                                    name of the external ID

  -m, --mapping=mapping                                                             the path of the JSON file that
                                                                                    defines CSV column mappings

  -o, --object=object                                                               (required) the sObject name to
                                                                                    upsert

  -q, --quote=quote                                                                 [default: "] the input CSV file
                                                                                    quote character

  -r, --resultfile=resultfile                                                       the CSV file path for writing the
                                                                                    upsert results

  -s, --batchsize=batchsize                                                         [default: 10000] the batch size of
                                                                                    the job

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  -w, --wait=wait                                                                   the number of minutes to wait for
                                                                                    the command to complete before
                                                                                    displaying the results

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --assignmentruleid=assignmentruleid                                               the ID of a specific assignment rule
                                                                                    to run for a case or a lead.

  --concurrencymode=concurrencymode                                                 [default: Parallel] the concurrency
                                                                                    mode (Parallel or Serial) for the
                                                                                    job

  --convertonly                                                                     output converted.csv file and skip
                                                                                    upsert for debugging

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --setnull                                                                         set blank values as null values
                                                                                    during upsert operations (default:
                                                                                    empty field values are ignored)

  --skiplines=skiplines                                                             [default: 0] the number of lines to
                                                                                    skip

  --trim                                                                            trim all white space from columns

DESCRIPTION
  For information about CSV file formats, see [Prepare CSV 
  Files](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_csv_preparing.htm) in 
  the Bulk API Developer Guide.

EXAMPLES
  $ sfdx kit:data:bulk:upsert -o Account -f ./path/to/Account.csv -m ./path/to/mapping.json
  $ sfdx kit:data:bulk:upsert -o MyObject__c -f ./path/to/MyObject__c.csv -c ./path/to/convert.js -i MyExternalId__c -w 
  10
```

_See code: [src/commands/kit/data/bulk/upsert.ts](https://github.com/Kitalive-Inc/sfdx-plugin/blob/v0.2.1/src/commands/kit/data/bulk/upsert.ts)_

## `sfdx kit:data:csv:convert [-f <filepath>] [-o <filepath>] [-e <string>] [-d <string>] [-q <string>] [--skiplines <integer>] [--trim] [-m <filepath>] [-c <filepath>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

convert CSV data using column mapping file or Node.js script

```
USAGE
  $ sfdx kit:data:csv:convert [-f <filepath>] [-o <filepath>] [-e <string>] [-d <string>] [-q <string>] [--skiplines 
  <integer>] [--trim] [-m <filepath>] [-c <filepath>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --converter=converter                                                         the path of the script to convert
                                                                                    CSV rows

  -d, --delimiter=delimiter                                                         [default: ,] the input CSV file
                                                                                    delimiter

  -e, --encoding=encoding                                                           [default: utf8] the input CSV file
                                                                                    encoding

  -f, --inputfile=inputfile                                                         the path of the input CSV file
                                                                                    (default: standard input)

  -m, --mapping=mapping                                                             the path of the JSON file that
                                                                                    defines CSV column mappings

  -o, --outputfile=outputfile                                                       the path of the output CSV file
                                                                                    (default: standard output)

  -q, --quote=quote                                                                 [default: "] the input CSV file
                                                                                    quote character

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --skiplines=skiplines                                                             [default: 0] the number of lines to
                                                                                    skip

  --trim                                                                            trim all white space from columns

EXAMPLES
  $ sfdx kit:data:csv:convert -f ./path/to/input.csv -m ./path/to/mapping.json
  $ sfdx kit:data:csv:convert -f ./path/to/input.csv -o ./path/to/output.csv -c ./path/to/convert.js -e cp932 -d :
```

_See code: [src/commands/kit/data/csv/convert.ts](https://github.com/Kitalive-Inc/sfdx-plugin/blob/v0.2.1/src/commands/kit/data/csv/convert.ts)_

## `sfdx kit:layout:assignments:deploy -f <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

deploy page layout assignments from JSON file

```
USAGE
  $ sfdx kit:layout:assignments:deploy -f <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -f, --file=file                                                                   (required) [default:
                                                                                    config/layout-assignments.json]
                                                                                    input file path

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  $ sfdx kit:layout:assignments:deploy
  $ sfdx kit:layout:assignments:deploy -f config/layout-assignments.scratch.json
  $ sfdx kit:layout:assignments:deploy -u me@my.org -f config/layout-assignments.sandbox.json
```

_See code: [src/commands/kit/layout/assignments/deploy.ts](https://github.com/Kitalive-Inc/sfdx-plugin/blob/v0.2.1/src/commands/kit/layout/assignments/deploy.ts)_

## `sfdx kit:layout:assignments:retrieve -f <string> [-p <string>] [-o <string>] [--merge] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

retrieve page layout assignments and save to JSON file

```
USAGE
  $ sfdx kit:layout:assignments:retrieve -f <string> [-p <string>] [-o <string>] [--merge] [-u <string>] [--apiversion 
  <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -f, --file=file                                                                   (required) [default:
                                                                                    config/layout-assignments.json]
                                                                                    output file path

  -o, --object=object                                                               comma separated object names to
                                                                                    retrieve (default: objects which
                                                                                    have multiple layouts)

  -p, --profile=profile                                                             comma separated profile names to
                                                                                    retrieve (default: all profiles)

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --merge                                                                           merge retrieved configurations with
                                                                                    existing file

EXAMPLES
  $ sfdx kit:layout:assignments:retrieve
  $ sfdx kit:layout:assignments:retrieve -p Admin,Standard,StandardAul -o Account,CustomObject__c -f 
  config/layout-assignments.scratch.json
  $ sfdx kit:layout:assignments:retrieve -u me@my.org -f config/layout-assignments.sandbox.json
```

_See code: [src/commands/kit/layout/assignments/retrieve.ts](https://github.com/Kitalive-Inc/sfdx-plugin/blob/v0.2.1/src/commands/kit/layout/assignments/retrieve.ts)_

## `sfdx kit:script:execute [-f <filepath>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

execute Node.js scripts in SfdxCommand context

```
USAGE
  $ sfdx kit:script:execute [-f <filepath>] [-u <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -f, --file=file                                                                   the path of the Node.js script file
                                                                                    to execute

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

DESCRIPTION
  Available variables in Node.js scripts
    argv: Parsed command line arguments after the file option
    conn: jsforce Connection
    context: SfdxCommand

ALIASES
  $ sfdx kit:script

EXAMPLES
  $ sfdx kit:script -f ./path/to/script.js
  $ sfdx kit:script:execute
  > await conn.query('SELECT Id, Name FROM Account LIMIT 1')
  Top level await is not enabled by default in REPL before Node.js v16
  $ NODE_OPTIONS=--experimental-repl-await sfdx kit:script:execute
```

_See code: [src/commands/kit/script/execute.ts](https://github.com/Kitalive-Inc/sfdx-plugin/blob/v0.2.1/src/commands/kit/script/execute.ts)_
<!-- commandsstop -->
