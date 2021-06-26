# NT euros scraper

Scrapes NT every few seconds for all odds to the euro games and both pushes it to GCS and ships it on a queue for people to subscribe to.

## Getting Started

### Install dependencies

```bash
yarn
export ABLY_KEY=your-ably-api-key # Key to the ably service used for queue
export GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json # Google service account for access to GCS
yarn start # this will run it once
```

### Run

`yarn start` will run it once

```
code blocks for commands
```
