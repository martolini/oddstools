import puppeteer from 'puppeteer';
import fs from 'fs';
import cheerio from 'cheerio';
import admin from 'firebase-admin';
import { chunk } from 'lodash';
import { Storage } from '@google-cloud/storage';

const storage = new Storage();

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();
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
    await page.screenshot({
      path: 'page.jpg',
      fullPage: true,
    });
    const content = await page.content();
    fs.writeFileSync('content.html', content);
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
    await Promise.all(
      eventIds.slice(1, 3).map(async (eventId) => {
        const eventPage = await browser.newPage();
        await eventPage.setRequestInterception(true);
        eventPage.on('request', (req) => req.continue());
        eventPage.on('response', async (res) => {
          if (res.url().endsWith('/services/content/get')) {
            const json = await res.json();
            if (json.data && json.data.idfoevent && json.data.markets) {
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
                    startTime: admin.firestore.Timestamp.fromDate(
                      new Date(market.tsstart)
                    ),
                    outcomeName: sel.name,
                    price: sel.currentpriceup / sel.currentpricedown + 1,
                    scrapedAtMillis: Date.now(),
                  }))
                )
                .flat();
              const key = `${markets[0].participantname_home}_${markets[0].participantname_away}`;
              fs.writeFileSync(`${key}.json`, JSON.stringify(selections));
              await storage
                .bucket('nt-odds')
                .upload(`${key}.json`, { gzip: true });

              // const chunks = chunk(selections, 200);
              // for (const c of chunks) {
              //   const batch = db.batch();
              //   c.forEach((selection: any) => {
              //     const ref = db
              //       .collection('selections')
              //       .doc(selection.selectionId);
              //     batch.set(ref, selection);
              //   });
              //   await batch.commit();
              // }
            }
          }
        });
        await eventPage.goto(
          `https://www.norsk-tipping.no/sport/oddsen/sportsbook/event/${eventId}`,
          {
            waitUntil: 'networkidle2',
          }
        );
        await eventPage.screenshot({ fullPage: true, path: `${eventId}.png` });
        const $ = cheerio.load(await eventPage.content());
        const title = $('h1').text();
        console.log(title);
        const teams = title.split('-').map((t) => t.trim());
        console.log(teams);
        const events = $('.event')
          .map((i, elem) => {
            const runners = $(elem)
              .find('[tabindex="-1"]')
              .map((i, elem) => {
                const spans = $(elem)
                  .find('span')
                  .map((i, elem) => $(elem).text());
                const [name, odds] = spans;
                return [name, +odds];
              })
              .toArray();
            return {
              marketType: $(elem).find('p').first().text(),
              runners,
            };
          })
          .toArray();
        console.log(events.length);
        await eventPage.close();
      })
    );
    await browser.close();
  })();
} catch (ex) {
  console.error(ex);
}
