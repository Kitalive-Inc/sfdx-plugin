# summary

Convert CSV data using column mapping file or Node.js script.

# examples

- Convert csv file using mapping file and output to standard output:

  <%= config.bin %> <%= command.id %> -i ./path/to/input.csv -m ./path/to/mapping.json

- Convert csv file using script and output to specified path:

  <%= config.bin %> <%= command.id %> -i ./path/to/input.csv -f ./path/to/output.csv -c ./path/to/convert.js

# flags.input.summary

[default: standard input] The path of the input CSV file

# flags.output.summary

[default: standard output] The path of the output CSV file

# flags.encoding.summary

The input CSV file encoding

# flags.delimiter.summary

The input CSV file delimiter

# flags.quote.summary

The input CSV file quote character

# flags.skip-lines.summary

The number of lines to skip

# flags.trim.summary

Trim all white space from columns

# flags.mapping.summary

The path of the JSON file that defines CSV column mappings

# flags.converter.summary

The path of the script to convert CSV rows
