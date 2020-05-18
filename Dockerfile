# Dockerfile extending the generic Node image with application files for a
# single application.
FROM gcr.io/google_appengine/nodejs

# Check to see if the the version included in the base runtime satisfies
# '>=8.9.4', if not then do an npm install of the latest available
# version that satisfies it.
RUN /usr/local/bin/install_node '>=8.9.4'
COPY . /app/

ENV NODE_ENV production
ENV NPM_TOKEN zxBEd6yrWCcmIxwPMPgrRTCpWLiHtbQ0ziMJvwn+tYAN/y5bCY4CrN1NIIhz/zXlJCGrO754fBzV9y04IZUHJHi7mvpAqzHUZeCXM3/Py2Q=

EXPOSE 2567
EXPOSE 8081

RUN yarn --unsafe-perms --frozen-lockfile || \
  ((if [ -f yarn-debug.log ]; then \
      cat yarn-debug.log; \
    fi) && false)

CMD npm start
