FROM node:buster

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY . /usr/src/app

ENV APT_KEY_DONT_WARN_ON_DANGEROUS_USAGE=DontWarn

RUN wget -qO - https://www.mongodb.org/static/pgp/server-4.4.asc | apt-key add - \
  && echo "deb http://repo.mongodb.org/apt/debian buster/mongodb-org/4.4 main" | tee /etc/apt/sources.list.d/mongodb-org-4.4.list \
  && apt-get update \
  && apt-get install -y tar mongodb-org-tools \
  && npm install --unsafe-perm

CMD [ "node", "app" ]
