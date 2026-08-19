# summary

Generate a minimal draft Flow metadata file

# flags.name.summary

Flow API name.

# flags.label.summary

Flow label. Defaults to the Flow API name.

# flags.process-type.summary

Flow processType value.

# flags.api-version.summary

Metadata API version. Defaults to the current API version.

# flags.output-dir.summary

Directory in which the Flow metadata file is generated.

# flags.force.summary

Overwrite the Flow metadata file if it already exists.

# examples

- <%= config.bin %> <%= command.id %> --name Test --label Test --process-type Flow --api-version 67.0 --output-dir output/flows
