import puppeteer from 'puppeteer';
import cheerio from 'cheerio';
import Bluebird from 'bluebird';
import { Storage } from '@google-cloud/storage';
import axios from 'axios';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import Ably from 'ably';

const storage = new Storage();
const BUCKET_NAME = 'nt-odds';

const ably = new Ably.Realtime('D-YYEA.CZdDxA:2RsgpCy_H6pZ2WGs');
const channel = ably.channels.get('nt-odds');

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

async function fetchOdds() {
  const [eventResult] = await storage
    .bucket(BUCKET_NAME)
    .file('eventids.json')
    .download();
  const eventIds = JSON.parse(eventResult.toString());
  const updates = {
    new: 0,
    changed: 0,
    deleted: 0,
  };
  await Bluebird.map(
    eventIds,
    async (eventId) => {
      try {
        const res = await axios.post(
          'https://www.norsk-tipping.no/sport/oddsen/sportsbook/services/content/get',
          {
            contentId: { type: 'event', id: eventId },
            clientContext: { language: 'NO', ipAddress: '0.0.0.0' },
          },
          {
            headers: {
              ['sec-ch-ua']:
                '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
              ['sec-ch-ua-mobile']: '?0',
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
              Origin: 'https://www.norsk-tipping.no',
              ['Sec-Fetch-Site']: 'same-origin',
              ['Sec-Fetch-Mode']: 'cors',
              ['Sec-Fetch-Dest']: 'empty',
              Referer: `https://www.norsk-tipping.no/sport/oddsen/sportsbook/event/${eventId}`,
              ['Accept-Language']: 'en-US,en;q=0.9,nb-NO;q=0.8,nb;q=0.7',
            },
          }
        );
        const { markets } = res.data.data;
        const selections = markets
          .map((market: any) =>
            market.selections.map((sel: any) => ({
              eventId: market.idfoevent,
              selectionId: sel.idfoselection,
              marketType: market.name,
              marketTypeId: market.idfomarkettype,
              homeTeam: market.participantname_home,
              awayTeam: market.participantname_away,
              startTime: new Date(market.tsstart).getTime(),
              outcomeName: sel.name,
              price: sel.currentpriceup / sel.currentpricedown + 1,
              scrapedAtMillis: Date.now(),
            }))
          )
          .flat();
        if (!selections.length) {
          return false;
        }
        const key = `${selections[0].homeTeam}_${selections[0].awayTeam}`;
        const file = storage.bucket(BUCKET_NAME).file(`${key}.json`);
        try {
          const [old] = await file.download();
          const oldSelections = JSON.parse(old.toString()) as any[];
          const changedSelections = selections.reduce((p: any[], c: any) => {
            const oldSelection = oldSelections.find(
              (sel: any) => sel.selectionId === c.selectionId
            );
            if (oldSelection && oldSelection.price !== c.price) {
              return [...p, c];
            }
            return p;
          }, []);
          const deletedSelections = oldSelections
            .map((sel) =>
              selections.find((s) => s.selectionId === sel.selectionId)
            )
            .filter((sel) => !sel);
          const newSelections = selections
            .map((sel) =>
              oldSelections.find((s) => s.selectionId === sel.selectionId)
            )
            .filter((s) => !s);
          if (newSelections.length > 0) {
            updates.new += newSelections.length;
            await channel.publish('odds-created', newSelections);
          }
          if (deletedSelections.length > 0) {
            updates.deleted += deletedSelections.length;
            await channel.publish('odds-deleted', deletedSelections);
          }
          if (changedSelections.length > 0) {
            updates.changed += changedSelections.length;
            await channel.publish('odds-changed', changedSelections);
          }
        } catch (ex) {
          console.log(`Could not find old file.`);
        }
        try {
          await file.save(JSON.stringify(selections), {
            gzip: true,
            resumable: false,
          });
          console.log(`uploaded ${key}`);
        } catch (ex) {
          console.log(`failed for ${key}`, ex.message);
        }
        return res.data.data;
      } catch (ex) {
        console.error(ex);
      }
    },
    { concurrency: 3 }
  );
  console.log(JSON.stringify(updates, null, 2));
}

const argv = yargs(hideBin(process.argv))
  .command(
    'fetch-events',
    'Fetch event ids for euros 2020',
    () => {},
    async (argv) => {
      await fetchEventIds();
      process.exit(0);
    }
  )
  .command(
    'fetch-odds',
    'Fetch odds for the available event ids',
    () => {},
    async (argv) => {
      await fetchOdds();
      process.exit(0);
    }
  ).argv;
