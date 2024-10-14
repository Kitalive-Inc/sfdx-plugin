#!/bin/sh -e

DEVHUB_USER=$1
ALIAS=$2

if [ -z $ALIAS ]; then
  echo "usage: $0 devhub_username alias [org create scratch options...]"
  exit 1
fi

shift 2

sf org create scratch -f config/project-scratch-def.json -v $DEVHUB_USER -a $ALIAS "$@"
sf project deploy start -o $ALIAS
sf org assign permset -n Dev -o $ALIAS
