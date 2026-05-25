# summary

Bulk delete records by SOQL select query.

# examples

- Delete Opportunity records with CloseDate older than 2 years:

  <%= config.bin %> <%= command.id %> -q "SELECT Id FROM Opportunity WHERE CloseDate < LAST_N_YEARS:2"

- Delete Opportunity records by SOQL file:

  <%= config.bin %> <%= command.id %> --query-file ./path/to/Opportunity.soql

# flags.query.summary

SOQL query to delete

# flags.query-file.summary

SOQL query file to delete

# flags.hard.summary

Perform a hard delete
