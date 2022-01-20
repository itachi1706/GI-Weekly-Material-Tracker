FROM gitpod/workspace-full

LABEL maintainer="dockerimages@itachi1706.com"

ENV FLUTTER_HOME=/home/gitpod/flutter \
    FLUTTER_VERSION=2.2.2-stable

# Install dart
USER root

RUN curl https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    apt-get update && \
    apt-get -y install libpulse0 build-essential libkrb5-dev gcc make android-sdk && \
    apt-get clean && \
    apt-get -y autoremove && \
    apt-get -y clean && \
    rm -rf /var/lib/apt/lists/*;

USER gitpod

# Install Flutter sdk
RUN cd /home/gitpod && \
  wget -qO flutter_sdk.tar.xz https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_VERSION}.tar.xz && \
  tar -xvf flutter_sdk.tar.xz && rm flutter_sdk.tar.xz

RUN $FLUTTER_HOME/bin/flutter channel stable && $FLUTTER_HOME/bin/flutter upgrade && $FLUTTER_HOME/bin/flutter config --enable-web

# Change the PUB_CACHE to /workspace so dependencies are preserved.
ENV PUB_CACHE=/workspace/.pub_cache
ENV ANDROID_HOME=/usr/lib/android-sdk

# Install Android SDK necessary files
RUN wget https://dl.google.com/android/repository/commandlinetools-linux-6609375_latest.zip && \
unzip commandlinetools-linux-6609375_latest.zip -d cmdline-tools && \
sudo mv cmdline-tools $ANDROID_HOME/
RUN yes | /usr/lib/android-sdk/cmdline-tools/tools/bin/sdkmanager --licenses
RUN echo y | /usr/lib/android-sdk/cmdline-tools/tools/bin/sdkmanager "platform-tools" >/dev/null
RUN echo y | /usr/lib/android-sdk/cmdline-tools/tools/bin/sdkmanager "cmdline-tools;latest" >/dev/null

# add executables to PATH
RUN echo 'export PATH=${ANDROID_HOME}/cmdline-tools/tools/bin:${FLUTTER_HOME}/bin:${FLUTTER_HOME}/bin/cache/dart-sdk/bin:${PUB_CACHE}/bin:${FLUTTER_HOME}/.pub-cache/bin:$PATH' >>~/.bashrc
