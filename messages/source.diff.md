# summary

Compare metadata at a Git revision with metadata retrieved from an org

# flags.base.summary

Git revision used as the comparison base.

# flags.manifest.summary

Manifest that specifies metadata to retrieve and compare.

# flags.source-dir.summary

Source directory at the base revision to retrieve and compare. May be specified multiple times.

# flags.ignore-element.summary

Metadata type and XML element to ignore during comparison, in MetadataType:element format. May be specified multiple times.

# flags.worktree-dir.summary

Directory for the detached Git worktree. A temporary directory is used when omitted.

# examples

- <%= config.bin %> <%= command.id %> --target-org my-org --manifest output/deploy/package.xml

- <%= config.bin %> <%= command.id %> --base origin/main --target-org my-org --source-dir force-app/main/default/objects/Account --ignore-element CustomObject:enableFeeds
