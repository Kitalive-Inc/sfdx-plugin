# examples

- Upsert Account records with mapping.json:

  <%= config.bin %> <%= command.id %> -o Account -f ./path/to/Account.csv -m ./path/to/mapping.json

- Upsert MyObject__c with convert.js and external ID

  <%= config.bin %> <%= command.id %> -o MyObject__c -f ./path/to/MyObject__c.csv -c ./path/to/convert.js -i MyExternalId__c -w 10

# flags.externalid.summary

The column name of the external ID
