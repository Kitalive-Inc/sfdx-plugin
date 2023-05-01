# summary

Bulk delete records by SOQL select query.

# examples

- Delete Opportunity records with CloseDate older than 2 years:

  <%= config.bin %> <%= command.id %> -q "SELECT Id FROM Opportunity WHERE CloseDate < LAST_N_YEARS:2"

# flags.query.summary

SOQL query to delete

# flags.hard.summary

Perform a hard delete
