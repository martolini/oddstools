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
  for (const eventId of eventIds.slice(0, 1)) {
    const eventPage = await browser.newPage();
    await eventPage.goto(
      `https://www.norsk-tipping.no/sport/oddsen/sportsbook/event/${eventId}`,
      {
        waitUntil: 'networkidle2',
      }
    );
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
    console.log(events);

    fs.writeFileSync(`${eventId}.html`, await eventPage.content());
  }
  await browser.close();
})();
