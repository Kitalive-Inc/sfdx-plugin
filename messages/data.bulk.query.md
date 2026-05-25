# summary

Bulk query records.

# examples

- Query Account records and save to specified path:

  <%= config.bin %> <%= command.id %> -q "SELECT Id, Name FROM Account" -f ./path/to/Account.csv

- Query Account records from SOQL file:

  <%= config.bin %> <%= command.id %> --query-file ./path/to/Account.soql -f ./path/to/Account.csv

- Query Account records with object field labels:

  <%= config.bin %> <%= command.id %> -q "SELECT Id, Name FROM Account" --object-field-label

- Query Account records with custom field label mapping:

  <%= config.bin %> <%= command.id %> -q "SELECT Id, Name FROM Account" --field-label-mapping ./path/to/field-label-mapping.json

# flags.query.summary

SOQL query to export

# flags.query-file.summary

SOQL query file to export

# flags.csv-file.summary

[default: standard output] Output csv file

# flags.object-field-label.summary

Output field names with object field labels

# flags.field-label-mapping.summary

JSON file that maps field API names to output field names

# flags.all.summary

include deleted or archived records

# errors.invalidFieldLabelMapping

Invalid field label mapping file: %s

# errors.duplicatedFieldLabel

Duplicated output field name: %s

# flags.wait.summary

The number of minutes to wait for the command to complete before displaying the results
