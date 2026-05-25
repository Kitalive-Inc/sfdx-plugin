# summary

Bulk query records.

# examples

- Query Account records and save to specified path:

  <%= config.bin %> <%= command.id %> -q "SELECT Id, Name FROM Account" -f ./path/to/Account.csv

- Query Account records from SOQL file:

  <%= config.bin %> <%= command.id %> --query-file ./path/to/Account.soql -f ./path/to/Account.csv

# flags.query.summary

SOQL query to export

# flags.query-file.summary

SOQL query file to export

# flags.csv-file.summary

[default: standard output] Output csv file

# flags.all.summary

include deleted or archived records

# flags.wait.summary

The number of minutes to wait for the command to complete before displaying the results
