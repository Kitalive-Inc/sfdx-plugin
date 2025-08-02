# examples

- %s Account records with mapping.json:

  <%= config.bin %> <%= command.id %> -o Account -f ./path/to/Account.csv -m ./path/to/mapping.json

- %s MyObject__c records with convert.js:

  <%= config.bin %> <%= command.id %> -o MyObject__c -f ./path/to/MyObject__c.csv -c ./path/to/convert.js -w 10

# description

For information about CSV file formats, see [Prepare CSV Files](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_csv_preparing.htm) in the Bulk API Developer Guide.

# flags.sobject.summary

The SObject name to %s

# flags.csv-file.summary

The CSV file path that defines the records to %s

# flags.result-file.summary

The CSV file path for writing the %s results

# flags.set-null.summary

Set blank values as null values during %s operations (default: empty field values are ignored)

# flags.convert-only.summary

Output converted.csv file and skip %s for debugging

# flags.concurrency-mode.summary

The concurrency mode (Parallel or Serial) for the job

# flags.batch-size.summary

The batch size of the job

# flags.wait.summary

The number of minutes to wait for the command to complete before displaying the results

# flags.assignment-rule-id.summary

The ID of a specific assignment rule to run for a case or a lead

# asyncJob

Check bulk job status with the command:
%s org open -o %s -p "lightning/setup/AsyncApiJobStatus/page?address=%2F%s"
