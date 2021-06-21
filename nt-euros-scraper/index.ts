import puppeteer from 'puppeteer';
import cheerio from 'cheerio';
import Bluebird from 'bluebird';
import { Storage } from '@google-cloud/storage';

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
        waitUntil: 'networkidle0',
      }
    );
    const content = await page.content();
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
    await Bluebird.map(
      eventIds,
      async (eventId) => {
        const eventPage = await browser.newPage();
        await eventPage.setRequestInterception(true);

        eventPage.on('request', (req) => req.continue());
        eventPage.on('response', async (res) => {
          if (res.url().endsWith('/services/content/get')) {
            const json = await res.json();
            if (
              json.data &&
              json.data.idfoevent &&
              json.data.markets &&
              json.data.markets.length > 0
            ) {
              const { markets } = json.data;
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
                console.log(selections[0]);
              } catch (ex) {
                console.log(`failed for ${key}`, ex.message);
                console.log(JSON.stringify(ex.response, null, 2));
                setTimeout(() => {
                  process.exit(1);
                }, 100);
              }
            }
          }
        });
        await eventPage.goto(
          `https://www.norsk-tipping.no/sport/oddsen/sportsbook/event/${eventId}`,
          {
            waitUntil: 'networkidle2',
          }
        );
        await eventPage.close();
      },
      { concurrency: 3 }
    );
    await browser.close();
  })();
} catch (ex) {
  console.error(ex.message);
}
