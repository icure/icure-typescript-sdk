#!/usr/bin/env bash

# Initialize an empty JSON array for the report
report='[]'

# Install dependencies in all workspaces
yarn install > /dev/null 2>&1

# Get the list of workspaces and extract their locations
workspaces=$(yarn workspaces list --json | awk -F\" '/location/ {print $4}')

# Iterate through each workspace
for workspace in $workspaces; do
  # Change to the workspace directory
  cd "$workspace" || exit

  # Check if dependencies are listed in package.json
  if grep -q '"dependencies"' package.json; then
    # Get the list of production dependencies
    dependencies=$(jq -r ' .dependencies | keys[]' package.json)

    # Iterate through each dependency
    for dependency in $dependencies; do
      # Path to the dependency's package.json file within the workspace's node_modules
      depPath="node_modules/$dependency/package.json"

      # If not found, check the global node_modules directory
      [[ ! -f $depPath ]] && depPath="../../node_modules/$dependency/package.json"

      # Check if the package.json file exists
      if [[ -f $depPath ]]; then
        # Get the repository, license, and version information
        repo=$(jq -r '.repository? | if type == "object" then .url else . end // "null"' "$depPath")
        license=$(jq -r '.license // "null"' "$depPath" | sed 's/AND/&/g')
        version=$(jq -r '.version // "null"' "$depPath")

        # Add the information to the JSON array
        report=$(echo $report | jq --arg dep "$dependency" --arg repo $repo --arg license "$license" --arg version "$version" '. + [{dependency: $dep, repository: $repo, license: $license, version: $version}]')
      fi
    done
  fi

  # Change back to the root directory
  # shellcheck disable=SC2164
  cd - > /dev/null
done

# Deduplicate entries based on dependency name and version
report=$(echo "$report" | jq 'unique_by(.dependency, .version)')

# Write the report to stdout
echo "$report" | jq '.'
