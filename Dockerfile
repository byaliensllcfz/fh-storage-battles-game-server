# Dockerfile extending the generic Node image with application files for a
# single application.
FROM gcr.io/google_appengine/nodejs

# Check to see if the the version included in the base runtime satisfies
# '>=8.9.4', if not then do an npm install of the latest available
# version that satisfies it.
RUN /usr/local/bin/install_node '>=8.9.4'
COPY . /app/

ENV NPM_TOKEN KzUrhGQgrXyZdD3JKETT2q1ihhtQ3dfcPQHj3UQqV18=

ENV NODE_ENV production

EXPOSE 2567

RUN yarn --unsafe-perms --frozen-lockfile || \
  ((if [ -f yarn-debug.log ]; then \
      cat yarn-debug.log; \
    fi) && false)

CMD npm start
