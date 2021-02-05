@kitalive/sfdx-plugin
=====================

[![Version](https://img.shields.io/npm/v/@kitalive/sfdx-plugin.svg)](https://npmjs.org/package/@kitalive/sfdx-plugin)
[![License](https://img.shields.io/npm/l/@kitalive/sfdx-plugin.svg)](https://github.com/Kitalive-Inc/sfdx-plugin/blob/master/package.json)

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
@kitalive/sfdx-plugin/0.0.1 darwin-x64 node-v14.15.0
$ sfdx --help [COMMAND]
USAGE
  $ sfdx COMMAND
...
```
<!-- usagestop -->

## Commands

<!-- commands -->
* [`sfdx kit:layout:assignments:deploy -f <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-kitlayoutassignmentsdeploy--f-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx kit:layout:assignments:retrieve -f <string> [-p <string>] [-o <string>] [--merge] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-kitlayoutassignmentsretrieve--f-string--p-string--o-string---merge--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx kit:layout:assignments:deploy -f <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

deploy page layout assignments

```
deploy page layout assignments

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

## `sfdx kit:layout:assignments:retrieve -f <string> [-p <string>] [-o <string>] [--merge] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

retrieve page layout assignments

```
retrieve page layout assignments

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
<!-- commandsstop -->
