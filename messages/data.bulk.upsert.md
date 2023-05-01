# examples

- Upsert Account records with mapping.json:

  <%= config.bin %> <%= command.id %> -o Account -f ./path/to/Account.csv -m ./path/to/mapping.json

- Upsert MyObject\_\_c with convert.js and external ID

  <%= config.bin %> <%= command.id %> -o MyObject**c -f ./path/to/MyObject**c.csv -c ./path/to/convert.js -i MyExternalId\_\_c -w 10

# flags.externalid.summary

The column name of the external ID
