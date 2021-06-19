import $ from 'jquery';

const NT_DATA_KEY = 'ntdata';

const getFromStorage = (key) =>
  new Promise((resolve) =>
    chrome.storage.sync.get([key], (data) => {
      resolve(data);
    })
  );

const setStorage = (key, data) =>
  new Promise((resolve) =>
    chrome.storage.sync.set({ [key]: data }, () => {
      resolve();
    })
  );

async function getBetfairData() {
  const { ntdata } = await getFromStorage(NT_DATA_KEY);
  const title = (await waitForSelector('span.title > span')).first().text();
  const teams = title.split('–').map((t) => t.trim());
  console.log(teams);

  const mainMarket = await waitForSelector('bf-main-marketview');
  const marketType = $(mainMarket)
    .find('h2[class="market-type"]')
    .first()
    .text();
  console.log(ntdata);
  const ntMarket = marketType === 'Kampodds' ? ntdata.HUB : null;
  console.log(marketType);
  console.log(ntMarket);
  const runners = $(mainMarket)
    .find('tr[class="runner-line"]')
    .each((i, runner) => {
      const name = $(runner).find('h3[class="runner-name"]').first();
      let ntOdds;
      switch (i) {
        case 0:
          ntOdds = ntMarket.runners[1];
          break;
        case 1:
          ntOdds = ntMarket.runners[5];
          break;
        case 2:
          ntOdds = ntMarket.runners[3];
          break;
        default:
          throw new Error('wtf');
      }
      name.text(`${name.text()} (NT: ${ntOdds})`);
    });
}

async function waitForSelector(selectorString) {
  if ($(selectorString).length) {
    return $(selectorString);
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
  return waitForSelector(selectorString);
}

async function getNorskTippingData() {
  const title = (await waitForSelector('h1')).text();
  const teams = title.split('-').map((t) => t.trim());
  await new Promise((resolve) => setTimeout(resolve, 5000));
  await waitForSelector('.event p:contains("HUB")');
  const eventNodes = $('.event');
  const events = eventNodes
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
  const HUB = events.find((event) => event.marketType === 'HUB');
  await setStorage(NT_DATA_KEY, { HUB, teams, events });
  await setStorage('random', Math.random());
  console.log(teams);
}

const host = window.location.host;
if (/betfair/gi.test(host)) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (changes[NT_DATA_KEY]) {
      getBetfairData();
    }
  });
  getBetfairData();
} else if (/norsk-tipping/gi.test(host)) {
  getNorskTippingData();
  const interval = setInterval(() => {
    getNorskTippingData();
  }, 10000);
}
