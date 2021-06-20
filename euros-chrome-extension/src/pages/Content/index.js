import $ from 'jquery';

async function waitForSelector(selectorString) {
  if ($(selectorString).length) {
    return $(selectorString);
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
  return waitForSelector(selectorString);
}

const populateBetfairWithOdds = async (data, teams) => {
  const mainMarket = await waitForSelector('bf-main-marketview');
  const marketType = $(mainMarket)
    .find('h2[class="market-type"]')
    .first()
    .text();
  if (marketType === 'Kampodds') {
    const selections = data.filter((item) => item.marketType === 'HUB');
    $(mainMarket)
      .find('tr[class="runner-line"]')
      .each((i, runner) => {
        const name = $(runner).find('h3[class="runner-name"]').first();
        let ntOdds;
        switch (i) {
          case 0:
            ntOdds = selections.find(
              (item) => item.outcomeName === item.homeTeam
            ).price;
            break;
          case 1:
            ntOdds = selections.find(
              (item) => item.outcomeName === item.awayTeam
            ).price;
            break;
          case 2:
            ntOdds = selections.find(
              (item) => item.outcomeName === 'Uavgjort'
            ).price;
            break;
          default:
            throw new Error('wtf');
        }
        name.text(`${name.text().split(' (NT:')[0]} (NT: ${ntOdds})`);
      });
  }
};

const askForNTOdds = async () => {
  const title = (await waitForSelector('span.title > span')).first().text();
  const teams = title.split('–').map((t) => t.trim());
  chrome.runtime.sendMessage({ teams }, (response) => {
    populateBetfairWithOdds(response, teams);
  });
};

const host = window.location.host;
if (/betfair/gi.test(host)) {
  setInterval(() => {
    askForNTOdds();
  }, 3000);
}
