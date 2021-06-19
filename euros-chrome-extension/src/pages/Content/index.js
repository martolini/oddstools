import $ from 'jquery';

const marketTypeTranslation = {
  Kampodds: 'NTvarianten',
};

async function run() {
  const title = (await waitForSelector('span.title > span')).first().text();
  const teams = title.split('–').map((t) => t.trim());
  console.log(teams);

  const mainMarket = await waitForSelector('bf-main-marketview');
  const marketType = $(mainMarket)
    .find('h2[class="market-type"]')
    .first()
    .text();
  console.log(marketType);
  const runners = $(mainMarket)
    .find('tr[class="runner-line"]')
    .map((_, runner) => ({
      name: $(runner).find('h3[class="runner-name"]').first().text(),
    }))
    .toArray();
  console.log(runners);
}

async function waitForSelector(selectorString) {
  if ($(selectorString).length) {
    return $(selectorString);
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
  return waitForSelector(selectorString);
}

run();
