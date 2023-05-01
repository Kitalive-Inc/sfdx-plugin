# summary

Retrieve page layout assignments and save to JSON file.

# examples

- Retrieve page layout assignments from the default org and save to the default path:

  <%= config.bin %> <%= command.id %>

- Retrieve Admin profile's Account and Contact page layout assignments and save to the specified path:

  <%= config.bin %> <%= command.id %> -p Admin -s Account -s Contact -f config/layout-assignments.scratch.json

- Retrieve page layout assignments from the specified org and save to the specified path:
  <%= config.bin %> <%= command.id %> -o me@my.org -f config/layout-assignments.sandbox.json

# flags.file.summary

Output file path of page layout assignment settings.

# flags.profile.summary

[default: all profiles] Profile names to retrieve

# flags.sobject.summary

[default: sobjects which have multiple layouts] SObject names to retrieve

# flags.merge.summary

Merge retrieved configurations with existing file.

# spinner.start

Retrieve page layout assignments

# result

Saved to %s:
profiles: %s
sobjects: %s

# error.noSObjects

There are no sobjects to retrieve.
