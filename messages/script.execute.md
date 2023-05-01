# summary

Execute Node.js scripts in SfCommand context.

# description

Available variables in Node.js scripts

- argv: Parsed command line arguments after the file option
- conn: jsforce Connection
- context: SfCommand

# examples

- Execute from js file:

  <%= config.bin %> <%= command.id %> -f ./path/to/script.js

- Execute in REPL mode:

  <%= config.bin %> <%= command.id %> -o target-org

- query a account from org in REPL

  > await conn.query('SELECT Id, Name FROM Account LIMIT 1')

  Top level await is not enabled by default in REPL before Node.js v16
  $ NODE_OPTIONS=--experimental-repl-await <%= config.bin %> <%= command.id %>

# flags.file.summary

The path of the Node.js script file to execute.

# repl.start

Starting REPL mode
Available variables

- conn: jsforce Connection
- context: SfCommand

Type .exit or Press Ctrl+D to exit the REPL
