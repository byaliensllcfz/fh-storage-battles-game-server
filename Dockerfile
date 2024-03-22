# syntax=docker/dockerfile:experimental
# Dockerfile extending the generic Node image with application files for a
# single application.
FROM node:gallium-buster

ENV NODE_ENV production
ENV NPM_TOKEN "REPLACE_NPM_TOKEN"

COPY --chown=${USER_ID}:${USER_GID} . /app/
WORKDIR /app/

EXPOSE 2567

# You have to specify "--unsafe-perm" with npm install
# when running as root.  Failing to do this can cause
# install to appear to succeed even if a preinstall
# script fails, and may have other adverse consequences
# as well.
# This command will also cat the npm-debug.log file after the
# build, if it exists.
RUN --mount=type=secret,id=npmtoken,mode=666 \
  NPM_TOKEN=$(cat /run/secrets/npmtoken) yarn --unsafe-perms --frozen-lockfile || \
  ((if [ -f yarn-debug.log ]; then \
      cat yarn-debug.log; \
    fi) && false)

CMD yarn start
