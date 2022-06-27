#! /bin/bash

len=$(cat ./LATEST | wc -m)
echo Length of Release Notes: $len characters
if (( $len <= 500 ))
then
  echo "Release notes length within limits. Allowed to continue"
  exit 0
else
  echo "Release notes outside of limits. Requires it to be less than 500 characters. Aborting"
  exit 1
fi