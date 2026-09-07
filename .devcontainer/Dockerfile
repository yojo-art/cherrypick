FROM mcr.microsoft.com/devcontainers/javascript-node:4.0.3-24-trixie

USER root
RUN apt-get update \
	&& apt-get -y install libgtk2.0-0 libgtk-3-0 libgbm-dev libnotify-dev libnss3 libxss1 libasound2 libxtst6 xauth xvfb \
	&& rm -rf /var/lib/apt/lists/*
USER node
