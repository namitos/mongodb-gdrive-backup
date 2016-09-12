FROM node:latest

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY . /usr/src/app
RUN apt-get update \
	&& apt-get install -y tar \
	&& npm install --unsafe-perm

CMD [ "node", "app" ]