# summary

Add explicitly selected field-reference edits to an existing source delta

# flags.from.summary

Git revision used when the selected source does not already exist in preDeploy.

# flags.field.summary

CustomField API name whose references are removed. May be specified multiple times.

# flags.path.summary

Repository-relative metadata path to edit. Existing preDeploy content is edited cumulatively. May be specified multiple times.

# flags.output-dir.summary

Existing source delta output directory to update.

# flags.target-org.summary

Org alias or username written to the regenerated deployment instructions. No org connection is made.

# flags.force.summary

Ignore existing preDeploy source and regenerate selected files from the Git revision or working tree.

# examples

- <%= config.bin %> <%= command.id %> --from origin/main --field Account.Value__c --path force-app/main/default/flexipages/Account_Record_Page.flexipage-meta.xml --target-org production

- <%= config.bin %> <%= command.id %> --from HEAD~1 --field Account.Value__c --path force-app/main/default/classes/UsesValue.cls --force
