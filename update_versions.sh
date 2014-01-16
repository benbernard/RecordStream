#!/bin/bash
new_version=$1
if [[ -z $new_version ]]; then
    echo "usage: `basename $0` <new version>"
    exit 1
fi
set -e

# Replace any existing version declaration with the new one
git grep -lP 'our \$VERSION = "[\d.]+";' \
    | xargs perl -pi -e 's/(?<=our \$VERSION = ")[\d.]+(?=";)/'"$new_version"'/'
