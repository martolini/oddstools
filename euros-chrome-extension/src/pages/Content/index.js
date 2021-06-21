import $ from 'jquery';
import Ably from 'ably';

const mappers = [
  {
    ntline: 'Begge lag scorer',
    betfairline: 'Begge lag scorer?',
    outcomes: [
      {
        nt: 'Nei',
        betfair: 'No',
      },
      {
        nt: 'Ja',
        betfair: 'Yes',
      },
    ],
  },
  ...['0.5', '1.5', '2.5', '3.5', '4.5', '5.5'].map((e) => ({
    ntline: `Totalt antall mål - over/under ${e}`,
    betfairline: `Over/under ${e} mål`,
    outcomes: [
      {
        nt: `Under ${e}`,
        betfair: `Under ${e} Goals`,
      },
      {
        nt: `Over ${e}`,
        betfair: `Over ${e} Goals`,
      },
    ],
  })),
  ...['0.5', '1.5', '2.5', '3.5', '4.5', '5.5'].map((e) => ({
    ntline: `1. omgang - totalt antall mål - over/under ${e}`,
    betfairline: `First Half Goals ${e}`,
    outcomes: [
      {
        nt: `Under ${e}`,
        betfair: `Under ${e} Goals`,
      },
      {
        nt: `Over ${e}`,
        betfair: `Over ${e} Goals`,
      },
    ],
  })),
  {
    ntline: 'Korrekt resultat',
    betfairline: 'Riktig resultat',
  },
  {
    ntline: 'Pauseresultat',
    betfairline: 'Pause',
  },
];

async function waitForSelector(selectorString) {
  if ($(selectorString).length) {
    return $(selectorString);
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
  return waitForSelector(selectorString);
}

const populateBetfairWithOdds = async (data) => {
  const getHUBMarkets = (selections, i) => {
    switch (i) {
      case 0:
        return selections.find((item) => item.outcomeName === item.homeTeam)
          .price;
      case 1:
        return selections.find((item) => item.outcomeName === item.awayTeam)
          .price;
      case 2:
        return selections.find((item) => item.outcomeName === 'Uavgjort').price;
      default:
        return 0.0;
    }
  };
  const mainMarket = await waitForSelector('bf-main-marketview');
  const marketType = $(mainMarket).find('h2.market-type').first().text();
  if (marketType === 'Kampodds') {
    const selections = data.filter((item) => item.marketType === 'HUB');
    $(mainMarket)
      .find('tr.runner-line')
      .each((i, runner) => {
        const name = $(runner).find('h3.runner-name').first();
        let ntOdds = getHUBMarkets(selections, i);
        name.text(`${name.text().split(' (NT:')[0]} (NT: ${ntOdds})`);
      });
  }
  // Find minimarkets
  const miniMarkets = await waitForSelector('bf-mini-marketview');
  const $miniMarketLines = $(miniMarkets);
  $miniMarketLines.each((i, line) => {
    const lineObj = $(line);
    const title = lineObj.find('span.market-name-label');
    const titleText = title.first().text().trim();
    const foundMapper = mappers.find((m) => m.betfairline === titleText);
    if (foundMapper) {
      const selections = data.filter(
        (item) => item.marketType === foundMapper.ntline
      );
      const findSelection = (tester) =>
        (selections.find((item) => item.outcomeName === tester) || {}).price;
      lineObj.find('tr.runner-line').each((nthRLine, rline) => {
        const name = $(rline).find('h3.runner-name').first();
        const nameText = name.text().trim();
        let price;
        const currentOutcome = (foundMapper.outcomes || []).find(
          (el) => el.betfair === nameText
        );
        if (currentOutcome) {
          price = findSelection(currentOutcome.nt);
        } else if (foundMapper.betfairline === 'Riktig resultat') {
          const [hg, bg] = nameText.split(' - ');
          if (hg === bg) {
            price = findSelection(`Uavgjort ${hg}-${bg}`);
          } else if (parseInt(bg) < parseInt(hg)) {
            price = (
              selections.find(
                (item) => item.outcomeName === `${item.homeTeam} ${hg}-${bg}`
              ) || {}
            ).price;
          } else {
            price = (
              selections.find(
                (item) => item.outcomeName === `${item.awayTeam} ${bg}-${hg}`
              ) || {}
            ).price;
          }
        } else if (foundMapper.betfairline === 'Pause') {
          price = getHUBMarkets(selections, nthRLine);
        }
        if (price) name.text(`${name.text().split(' (NT:')[0]} (NT: ${price})`);
      });
    }
  });
};

const askForNTOdds = async () => {
  const title = (await waitForSelector('span.title > span')).first().text();
  const teams = title.split('–').map((t) => t.trim());
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ teams }, (response) => {
      resolve(response);
    });
  });
};

(async () => {
  const host = window.location.host;
  if (/betfair/gi.test(host)) {
    const ably = new Ably.Realtime('D-YYEA.CZdDxA:2RsgpCy_H6pZ2WGs');
    const channel = ably.channels.get('nt-odds');
    let state = await askForNTOdds();
    await populateBetfairWithOdds(state);
    channel.subscribe((data) => {
      switch (data.name) {
        case 'odds-created':
          state = [...state, data.data];
          break;
        case 'odds-changed':
          state = data.data.reduce(
            (p, c) => {
              return state.map((s) =>
                s.selectionId === c.selectionId ? c : s
              );
            },
            [state]
          );
          break;
        case 'odds-deleted':
          state = state.filter(
            (sel) => !data.data.find((s) => s.selectionId === sel.selectionId)
          );
          break;
      }
      populateBetfairWithOdds(state);
    });
    ably.connection.on('connected', () => {
      console.log(`Connected to socket`);
    });
    ably.connection.on('failed', () => {
      console.error(`Failed connecting`);
    });
  }
})();
