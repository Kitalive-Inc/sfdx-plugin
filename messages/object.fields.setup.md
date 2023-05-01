# summary

Upsert and delete sobject fields from a CSV file.

# examples

- Upsert Account fields to the default org:

  <%= config.bin %> <%= command.id %> -s Account -f path/to/account_fields.csv

- Upsert and delete CustomObject\_\_c fields to the specified org:

  <%= config.bin %> <%= command.id %> -o me@my.org -s CustomObject\_\_c -f path/to/custom_object_fields.csv --delete

# flags.sobject.summary

SObject name to setup

# flags.file.summary

Input csv file path

# flags.delete.summary

Delete fields that are not in the csv file

# flags.force.summary

Do not confirm when deleting
