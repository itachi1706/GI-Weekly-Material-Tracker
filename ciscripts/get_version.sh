#! /bin/sh
echo "Updating versioning number for flutter app"
APP_VERSION=$(cat ./VERSION)
sed -i.bak "s|version: 1.0.0+1|version: $APP_VERSION+$APP_BUILD_VER.b$GIT_COMMIT_COUNT|g" pubspec.yaml
rm pubspec.yaml.bak
builddate="$(date +"%A, %d %B %Y %T %Z")"
echo "Version $APP_VERSION ($APP_BUILD_VER.b$GIT_COMMIT_COUNT) Commit SHA #$CI_COMMIT_SHORT_SHA $APP_TYPE Application build on $builddate on branch $CI_COMMIT_REF_NAME with Pipeline $GIT_RUN_NUMBER"
