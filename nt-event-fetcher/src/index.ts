import puppeteer from 'puppeteer';
import cheerio from 'cheerio';
import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const BUCKET_NAME = 'nt-odds';

async function fetchEventIds() {
  const browser = await puppeteer.launch({
    headless: false,
  });
  const page = await browser.newPage();
  await page.goto(
    'https://www.norsk-tipping.no/sport/oddsen/sportsbook/event-group/44849.1',
    {
      waitUntil: 'networkidle2',
    }
  );
  const $ = cheerio.load(await page.content());
  const eventIds = $('a')
    .map((_, elem) => {
      const dataId = $(elem).attr('data-id');
      if (dataId && dataId.startsWith('navigation')) {
        return dataId.split('_').slice(-1)[0];
      }
      return null;
    })
    .toArray()
    .filter((e) => e !== null);
  await page.close();
  await browser.close();
  const file = storage.bucket(BUCKET_NAME).file('eventids.json');
  await file.save(JSON.stringify(eventIds), {
    gzip: true,
    resumable: true,
  });
}

fetchEventIds()
  .then(() => {
    console.log(`Success!`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
