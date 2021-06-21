import puppeteer from 'puppeteer';
import cheerio from 'cheerio';
import Bluebird from 'bluebird';
import { Storage } from '@google-cloud/storage';
import axios from 'axios';

const storage = new Storage();
try {
  (async () => {
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
    const results = await Bluebird.map(
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
          const key = `${selections[0].homeTeam}_${selections[0].awayTeam}`;
          const file = storage.bucket('nt-odds').file(`${key}.json`);
          try {
            await file.save(JSON.stringify(selections), {
              gzip: true,
              resumable: false,
            });
            console.log(`uploaded ${key}`);
          } catch (ex) {
            console.log(`failed for ${key}`, ex.message);
            console.log(JSON.stringify(ex.response, null, 2));
            setTimeout(() => {
              process.exit(1);
            }, 100);
          }
          return res.data.data;
        } catch (ex) {
          console.error(ex);
        }
      },
      { concurrency: 3 }
    );
    await browser.close();
  })();
} catch (ex) {
  console.error(ex.message);
}
