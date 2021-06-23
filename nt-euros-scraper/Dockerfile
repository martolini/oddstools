FROM buildkite/puppeteer:latest

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package.json yarn.lock ./

RUN yarn

COPY . .

RUN yarn build

CMD node build/index.js fetch-odds --forever