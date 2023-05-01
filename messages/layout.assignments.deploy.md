# summary

Deploy page layout assignments from JSON file.

# examples

- Deploy from the default file path to the default org:

  <%= config.bin %> <%= command.id %>

- Deploy from the specified file to the default org:

  <%= config.bin %> <%= command.id %> -f config/layout-assignments.scratch.json

- Deploy from the specified file to the specified org:
  <%= config.bin %> <%= command.id %> -o me@my.org -f config/layout-assignments.sandbox.json

# flags.file.summary

Input file path of page layout assignment settings.

# spinner.start

Deploy page layout assignments from %s
