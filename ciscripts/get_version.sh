#! /bin/sh
echo "Updating versioning number for apk"
APP_VERSION=$(cat ./ciscripts/VERSION)
sed -i "s|version: 1.0.0+1|version: $APP_VERSION+$APP_BUILD_VER.b$CI_PIPELINE_IID|g" pubspec.yaml
builddate="$(date +"%A, %d %B %Y %T %Z")"
echo "Version $APP_VERSION ($APP_BUILD_VER.b$GIT_COMMIT_COUNT) Commit SHA #$CI_COMMIT_SHORT_SHA Android Application build on $builddate on branch $CI_COMMIT_REF_NAME with Pipleline $CI_PIPELINE_IID"
