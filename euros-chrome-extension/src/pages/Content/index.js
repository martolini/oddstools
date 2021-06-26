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
  {
    ntline: 'Uavgjort tilbakebetales',
    betfairline: 'H/B – ingen spill på uavgjort',
  },
  ...['0.5', '1.5', '2.5', '3.5', '4.5', '5.5', '6.5', '7.5', '8.5'].map(
    (e) => ({
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
    })
  ),
  ...['0.5', '1.5', '2.5', '3.5', '4.5', '5.5', '6.5', '7.5', '8.5'].map(
    (e) => ({
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
    })
  ),
  {
    ntline: 'Korrekt resultat',
    betfairline: 'Riktig resultat',
  },
  {
    ntline: 'Pauseresultat',
    betfairline: 'Pause',
  },
  {
    ntline: 'Scorer mål',
    betfairline: 'To Score',
  },
  {
    ntline: '1. målscorer',
    betfairline: 'Første målscorer',
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
    try {
      switch (i) {
        case 0:
          return selections.find((item) => item.outcomeName === item.homeTeam)
            .price;
        case 1:
          return selections.find((item) => item.outcomeName === item.awayTeam)
            .price;
        case 2:
          return selections.find((item) => item.outcomeName === 'Uavgjort')
            .price;
        default:
          return 0.0;
      }
    } catch (ex) {
      return null;
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
        const betfairPrice = $(runner)
          .find('.back-selection-button span.bet-button-price')
          .first()
          .text()
          .trim();
        let price = getHUBMarkets(selections, i);
        if (price > 0 && betfairPrice > 0) {
          const diff = (price / betfairPrice) * 100 - 100;
          name.text(
            `${name.text().split(' (NT:')[0]} (NT: ${price.toFixed(
              2
            )} [${diff.toFixed(1)}%])`
          );
          if (diff >= -1) name.css({ color: 'green' });
        }
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
        const betfairPrice = $(rline)
          .find('.back-selection-button span.bet-button-price')
          .first()
          .text()
          .trim();
        const nameText = name.text().trim();
        let price;
        try {
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
          } else if (
            foundMapper.betfairline === 'H/B – ingen spill på uavgjort'
          ) {
            price = getHUBMarkets(selections, nthRLine);
          } else if (
            ['To Score', 'Første målscorer'].includes(foundMapper.betfairline)
          ) {
            price = selections.find(
              (item) =>
                item.outcomeName.toLowerCase() === nameText.toLowerCase()
            ).price;
            console.log(selections, nameText);
          }
          if (price > 0 && betfairPrice > 0) {
            const diff = (price / betfairPrice) * 100 - 100;
            name.text(
              `${name.text().split(' (NT:')[0]} (NT: ${price.toFixed(
                2
              )} [${diff.toFixed(1)}%])`
            );
            if (diff >= -1) name.css({ color: 'green' });
          }
        } catch (err) {}
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
  const ably = new Ably.Realtime('D-YYEA.2oCC3w:B_ZsAflF5oLdFqf2');
  const channel = ably.channels.get('nt-odds');
  const regexp = new RegExp(
    'https://www.betfair.com/exchange/plus/no/fotball/uefa-em-2020/*',
    'i'
  );
  if (regexp.test(window.location.href)) {
    let state = await askForNTOdds();
    if (state.length) {
    } else {
      console.log(`NO INITIAL STATE...`);
    }
    await populateBetfairWithOdds(state);
    channel.subscribe((data) => {
      if (state.length) {
        const sampleEvent = state[0];
        if (sampleEvent) {
          data.data = data.data.filter(
            (sel) => (sel || {}).eventId === sampleEvent.eventId
          );
        }
      }
      switch (data.name) {
        case 'odds-created':
          state = [...state, data.data];
          break;
        case 'odds-changed':
          state = state.map(
            (sel) =>
              data.data.find((s) => s.selectionId === sel.selectionId) || sel
          );
          break;
        case 'odds-deleted':
          state = state.filter(
            (sel) => !data.data.find((s) => s.selectionId === sel.selectionId)
          );
          break;
        default:
          break;
      }
    });
    let currentTitle = $('span.title > span').first().text();
    setInterval(async () => {
      const title = $('span.title > span').first().text();
      if (!title) {
        return;
      }
      if (currentTitle !== title) {
        currentTitle = title;
        state = await askForNTOdds();
      }
      const teams = title.split('–').map((t) => t.trim());
      if (teams[0] && teams[1]) {
        populateBetfairWithOdds(
          state.filter(
            (sel) => sel.homeTeam === teams[0] && sel.awayTeam === teams[1]
          )
        );
      }
    }, 5000);
    ably.connection.on('connected', () => {
      console.log(`Connected to socket`);
    });
    ably.connection.on('failed', () => {
      console.error(`Failed connecting`);
    });
  }
})();
