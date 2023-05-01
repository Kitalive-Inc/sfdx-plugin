# summary

Describe sobject fields information.

# examples

- Describe Account fields of the default org and save to csv file:

  <%= config.bin %> <%= command.id %> -s Account -f path/to/account_fields.csv

- Output CustomObject\_\_c fields of the specified org as JSON format:

  <%= config.bin %> <%= command.id %> -o me@my.org -s CustomObject\_\_c --json

# flags.sobject.summary

SObject name to describe

# flags.file.summary

Output csv file path

# spinner.start

Describe %s fields
