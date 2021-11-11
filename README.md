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
@kitalive/sfdx-plugin/0.1.4 darwin-x64 node-v16.12.0
$ sfdx --help [COMMAND]
USAGE
  $ sfdx COMMAND
...
```
<!-- usagestop -->

## Commands

<!-- commands -->
* [`sfdx kit:data:bulk:upsert -o <string> -i <string> -f <filepath> [-r <filepath>] [-e <string>] [-d <string>] [-q <string>] [--skiplines <integer>] [--trim] [-m <filepath>] [-c <filepath>] [--setnull] [--convertonly] [--concurrencymode <string>] [--assignmentruleid <string>] [-s <integer>] [-w <integer>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-kitdatabulkupsert--o-string--i-string--f-filepath--r-filepath--e-string--d-string--q-string---skiplines-integer---trim--m-filepath--c-filepath---setnull---convertonly---concurrencymode-string---assignmentruleid-string--s-integer--w-integer--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx kit:data:csv:convert [-f <filepath>] [-o <filepath>] [-e <string>] [-d <string>] [-q <string>] [--skiplines <integer>] [--trim] [-m <filepath>] [-c <filepath>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-kitdatacsvconvert--f-filepath--o-filepath--e-string--d-string--q-string---skiplines-integer---trim--m-filepath--c-filepath---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx kit:layout:assignments:deploy -f <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-kitlayoutassignmentsdeploy--f-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx kit:layout:assignments:retrieve -f <string> [-p <string>] [-o <string>] [--merge] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-kitlayoutassignmentsretrieve--f-string--p-string--o-string---merge--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx kit:data:bulk:upsert -o <string> -i <string> -f <filepath> [-r <filepath>] [-e <string>] [-d <string>] [-q <string>] [--skiplines <integer>] [--trim] [-m <filepath>] [-c <filepath>] [--setnull] [--convertonly] [--concurrencymode <string>] [--assignmentruleid <string>] [-s <integer>] [-w <integer>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

bulk upsert records from a CSV file

```
bulk upsert records from a CSV file
Upsert records using Bulk API and returns a job ID and a batch ID. Use these IDs to check job status with data:bulk:status.
For information about CSV file formats, see [Prepare CSV Files](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_csv_preparing.htm) in the Bulk API Developer Guide.

USAGE
  $ sfdx kit:data:bulk:upsert -o <string> -i <string> -f <filepath> [-r <filepath>] [-e <string>] [-d <string>] [-q 
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

  --skiplines=skiplines                                                             the number of lines to skip

  --trim                                                                            trim all white space from columns

DESCRIPTION
  Upsert records using Bulk API and returns a job ID and a batch ID. Use these IDs to check job status with 
  data:bulk:status.
  For information about CSV file formats, see [Prepare CSV 
  Files](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_csv_preparing.htm) in 
  the Bulk API Developer Guide.

EXAMPLES
  $ sfdx kit:data:bulk:upsert -o Account -f ./path/to/Account.csv -m ./path/to/mapping.json
  $ sfdx kit:data:bulk:upsert -o MyObject__c -f ./path/to/MyObject__c.csv -c ./path/to/convert.js -i MyExternalId__c -w 
  10
```

_See code: [src/commands/kit/data/bulk/upsert.ts](https://github.com/Kitalive-Inc/sfdx-plugin/blob/v0.1.4/src/commands/kit/data/bulk/upsert.ts)_

## `sfdx kit:data:csv:convert [-f <filepath>] [-o <filepath>] [-e <string>] [-d <string>] [-q <string>] [--skiplines <integer>] [--trim] [-m <filepath>] [-c <filepath>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

convert CSV data using column mapping file or Node.js script

```
convert CSV data using column mapping file or Node.js script

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

  --skiplines=skiplines                                                             the number of lines to skip

  --trim                                                                            trim all white space from columns

EXAMPLES
  $ sfdx kit:data:csv:convert -f ./path/to/input.csv -m ./path/to/mapping.json
  $ sfdx kit:data:csv:convert -f ./path/to/input.csv -o ./path/to/output.csv -c ./path/to/convert.js -e cp932 -d :
```

_See code: [src/commands/kit/data/csv/convert.ts](https://github.com/Kitalive-Inc/sfdx-plugin/blob/v0.1.4/src/commands/kit/data/csv/convert.ts)_

## `sfdx kit:layout:assignments:deploy -f <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

deploy page layout assignments from JSON file

```
deploy page layout assignments from JSON file

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

_See code: [src/commands/kit/layout/assignments/deploy.ts](https://github.com/Kitalive-Inc/sfdx-plugin/blob/v0.1.4/src/commands/kit/layout/assignments/deploy.ts)_

## `sfdx kit:layout:assignments:retrieve -f <string> [-p <string>] [-o <string>] [--merge] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

retrieve page layout assignments and save to JSON file

```
retrieve page layout assignments and save to JSON file

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

_See code: [src/commands/kit/layout/assignments/retrieve.ts](https://github.com/Kitalive-Inc/sfdx-plugin/blob/v0.1.4/src/commands/kit/layout/assignments/retrieve.ts)_
<!-- commandsstop -->
