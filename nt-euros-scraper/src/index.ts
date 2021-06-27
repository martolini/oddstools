import Bluebird from 'bluebird';
import { Storage } from '@google-cloud/storage';
import axios from 'axios';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import Ably from 'ably';
import { reduce } from 'lodash';

const storage = new Storage();
const BUCKET_NAME = 'nt-odds';

async function fetchOdds(channel: Ably.Types.RealtimeChannelCallbacks) {
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
        const { markets = [] } = res.data.data;
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
          .flat()
          .filter((sel) => !!sel.price);
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
            if (oldSelection && c.price && oldSelection.price !== c.price) {
              return [...p, c];
            }
            return p;
          }, []);
          const deletedSelections = oldSelections.filter(
            (sel) => !selections.find((s) => s.selectionId === sel.selectionId)
          );
          const newSelections = selections.filter(
            (sel) =>
              !oldSelections.find((s) => s.selectionId === sel.selectionId)
          );
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
  const numberOfUpdates = reduce(
    updates,
    (result, value, key) => result + value,
    0
  );
  if (numberOfUpdates > 0) console.log(JSON.stringify(updates, null, 2));
}

yargs(hideBin(process.argv))
  .demandCommand(1)
  .command(
    'fetch-odds',
    'Fetch odds for the available event ids',
    {
      forever: {
        alias: 'f',
        default: false,
        type: 'boolean',
      },
      ablyKey: {
        default: process.env.ABLY_KEY,
        demand: true,
        type: 'string',
      },
    },
    async (argv) => {
      if (!argv.ablyKey) {
        console.error(
          `You need to have a key to ably in order to stream the odds.`
        );
        process.exit(1);
      }
      const ably = new Ably.Realtime(argv.ablyKey);
      const channel = ably.channels.get('nt-odds');
      if (argv.forever) {
        const LOOP_TIME = 5;
        while (true) {
          let timeNow = Date.now();
          await fetchOdds(channel);
          const timeSpent = Date.now() - timeNow;
          await new Promise((resolve) =>
            setTimeout(resolve, Math.max(LOOP_TIME * 1000 - timeSpent, 0))
          );
        }
      } else {
        await fetchOdds(channel);
        process.exit(0);
      }
    }
  ).argv;
