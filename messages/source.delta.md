# summary

Generate a Git delta deployment with unsupported CustomField type conversion handling

# flags.from.summary

Git revision from which the diff is generated.

# flags.output-dir.summary

Directory in which deploy and preDeploy artifacts are generated.

# flags.force.summary

Delete and recreate the output directory if it already exists.

# flags.verbose.summary

Output Tooling API query criteria and results used to resolve CustomFields.

# examples

- <%= config.bin %> <%= command.id %> --from origin/main --target-org my-org

- <%= config.bin %> <%= command.id %> --from HEAD~1 --target-org my-org
