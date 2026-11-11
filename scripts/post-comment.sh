#!/usr/bin/env bash
# Posts the report as a PR comment, or updates the comment from an earlier
# run (found by its hidden marker) so a PR never collects a pile of them.
set -euo pipefail

body_file="$1"
marker="<!-- ui-guard -->"

existing=$(gh api --paginate "repos/$REPO/issues/$PR_NUMBER/comments" \
  --jq ".[] | select(.body | startswith(\"$marker\")) | .id" | head -n 1)

if [ -n "$existing" ]; then
  gh api --method PATCH "repos/$REPO/issues/comments/$existing" -F "body=@$body_file" > /dev/null
  echo "Updated comment $existing"
else
  gh api --method POST "repos/$REPO/issues/$PR_NUMBER/comments" -F "body=@$body_file" > /dev/null
  echo "Posted a new comment"
fi
