# summary

Delete Flows and all their versions

# flags.name.summary

Flow API name. Specify the flag multiple times to delete multiple Flows.

# flags.keep-latest-version.summary

Keep the latest Flow version even when it is inactive.

# flags.inactive-versions.summary

Delete only inactive Flow versions and keep the active version.

# examples

- <%= config.bin %> <%= command.id %> --target-org my-org --name Flow1 --name Flow2

- <%= config.bin %> <%= command.id %> --target-org my-org --keep-latest-version --name Flow1 --name Flow2

- <%= config.bin %> <%= command.id %> --target-org my-org --inactive-versions --name Flow1 --name Flow2
