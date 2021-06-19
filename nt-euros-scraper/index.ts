import puppeteer from 'puppeteer';
import fs from 'fs';
import cheerio from 'cheerio';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
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
  for (const eventId of eventIds) {
    const eventPage = await browser.newPage();
    await eventPage.goto(
      `https://www.norsk-tipping.no/sport/oddsen/sportsbook/event/${eventId}`,
      {
        waitUntil: 'networkidle2',
      }
    );
    await eventPage.screenshot({
      fullPage: true,
      path: `${eventId}.png`,
    });
  }
  console.log(eventIds);
  await browser.close();
})();
