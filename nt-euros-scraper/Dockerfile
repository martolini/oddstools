FROM node:14-alpine AS builder

# Create app directory
WORKDIR /usr/src/app
COPY package.json yarn.lock ./

RUN yarn

COPY tsconfig.json .
COPY src src

RUN yarn build

FROM node:14-alpine
ENV NODE_ENV=production
RUN apk add --no-cache tini
WORKDIR /usr/src/app

RUN chown node:node .
USER node
COPY package.json yarn.lock ./
RUN yarn

COPY --from=builder /usr/src/app/build build/

CMD /sbin/tini -- node build/index.js fetch-odds --forever