# summary

Generate custom metadata records from a CSV file.

# examples

- Generate records in the default output directory:

  <%= config.bin %> <%= command.id %> --csv-file config/my-metadata.csv --type MyType__mdt

- Generate records with custom input and output directories:

  <%= config.bin %> <%= command.id %> -i force-app/main/default/objects -d force-app/main/default/customMetadata -f config/my-metadata.csv -t MyType__mdt

# flags.output-directory.summary

Directory for generated custom metadata records.

# flags.input-directory.summary

Directory containing custom metadata type object definitions. Defaults to the objects directory next to the output directory.

# flags.csv-file.summary

Path to the input CSV file.

# flags.type.summary

Custom metadata type API name, including the __mdt suffix.

# result

Generated %s custom metadata record(s) in %s.

# error.invalidType

The custom metadata type API name must end with __mdt: %s

# error.fieldsNotFound

The custom metadata field definition directory was not found: %s

# error.missingDeveloperName

Each CSV row must include a DeveloperName value.
