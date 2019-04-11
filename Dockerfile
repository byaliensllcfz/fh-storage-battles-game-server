# Dockerfile extending the generic Node image with application files for a
# single application.
FROM gcr.io/google_appengine/nodejs

# Check to see if the the version included in the base runtime satisfies
# '>=8.9.4', if not then do an npm install of the latest available
# version that satisfies it.
RUN /usr/local/bin/install_node '>=8.9.4'
COPY . /app/

RUN git config --global credential.helper 'store'
RUN echo "REPLACE_CREDENTIALS" >> ~/.git-credentials

ENV NODE_ENV production

# Install DataDog
RUN DD_API_KEY=dummy-key DD_INSTALL_ONLY=true bash -c "$(curl -L https://raw.githubusercontent.com/DataDog/datadog-agent/master/cmd/agent/install_script.sh)"
COPY ./datadog.yaml /etc/datadog-agent/datadog.yaml
COPY ./datadog-log.yaml /etc/datadog-agent/conf.d/conf.yaml

# You have to specify "--unsafe-perm" with npm install
# when running as root.  Failing to do this can cause
# install to appear to succeed even if a preinstall
# script fails, and may have other adverse consequences
# as well.
# This command will also cat the npm-debug.log file after the
# build, if it exists.
RUN yarn --unsafe-perms --frozen-lockfile || \
  ((if [ -f yarn-debug.log ]; then \
      cat yarn-debug.log; \
    fi) && false)

RUN rm ~/.git-credentials

CMD npm start
