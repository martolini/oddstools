import $ from 'jquery';
const yesNoOutcome = [
  {
    nt: 'Nei',
    betfair: 'No',
  },
  {
    nt: 'Ja',
    betfair: 'Yes',
  },
];
const mappers = [
  {
    ntline: 'Begge lag scorer',
    betfairline: 'Begge lag scorer?',
    outcomes: yesNoOutcome,
  },
  {
    ntline: 'Blir det rødt kort?',
    betfairline: 'Utvisning?',
    outcomes: yesNoOutcome,
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
  ...['0.5', '1.5', '2.5', '3.5', '4.5', '5.5', '6.5', '7.5', '8.5'].map(
    (e) => ({
      ntline: `Antall kort over/under ${e}`,
      betfairline: `Cards Over/Under ${e}`,
    })
  ),
  ...[
    '1.5',
    '2.5',
    '3.5',
    '4.5',
    '5.5',
    '6.5',
    '7.5',
    '8.5',
    '9.5',
    '10.5',
    '11.5',
    '12.5',
    '13.5',
    '14.5',
    '15.5',
    '16.5',
    '17.5',
    '18.5',
    '19.5',
  ].map((e) => ({
    ntline: `Totalt antall hjørnespark - over/under ${e}`,
    betfairline: `Corners Over/Under ${e}`,
  })),
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
  {
    ntline: 'HUB',
    betfairline: 'Kampodds',
  },
  {
    ntline: 'Halvtid/Fulltid',
    betfairline: 'Pause/Fulltid',
  },
  {
    ntline: 'Hvilket lag vinner til slutt',
    betfairline: 'Kvalifiserer seg',
  },
  {
    ntline: 'Spiller får kort',
    betfairline: 'Shown a card?',
  },
  {
    ntline: 'Hjørnespark HUB',
    betfairline: 'Spill på hjørnespark i kampen',
  },
  {
    ntline: '',
    betfairline: 'Asiatisk handikap',
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
  const getHUBMarkets = (selections, i, flip) => {
    try {
      switch (i) {
        case 0:
          return selections[flip ? 2 : 0].price;
        case 1:
          return selections[flip ? 0 : 2].price;
        case 2:
          return selections[1].price;
        default:
          return 0.0;
      }
    } catch (ex) {
      return null;
    }
  };
  // Find minimarkets
  const miniMarkets = await waitForSelector(
    'bf-mini-marketview, bf-main-marketview, bf-ah-marketview'
  );
  const $miniMarketLines = $(miniMarkets);

  let homeTeamEng, awayTeamEng;
  let homeTeam, awayTeam;
  try {
    homeTeam = data[0].homeTeam;
    awayTeam = data[0].awayTeam;
    const teamHackElem = data.filter(
      (elem) => elem.marketType === 'Halvtid/Fulltid'
    )[2];
    [awayTeamEng, homeTeamEng] = teamHackElem.outcomeName.split(' - ');
    const newLines = ['-4', '-3', '-2', '-1', '0', '+1', '+2', '+3', '+4'].map(
      (i) => ({
        ntline: `Handikap 3-veis ${i}`,
        betfairline:
          parseInt(i) > 0
            ? `${homeTeamEng} ${i}`
            : `${awayTeamEng} +${i.charAt(1)}`,
      })
    );
    const goalsHome = ['0.5', '1.5', '2.5', '3.5'].map((el) => ({
      betfairline: `${homeTeam} over/under ${el} mål`,
      ntline: `Totalt antall ${homeTeam} mål over/under ${el}`,
    }));
    const goalsAway = goalsHome.map((gh) => ({
      betfairline: gh.betfairline.replace(homeTeam, awayTeam),
      ntline: gh.ntline.replace(homeTeam, awayTeam),
    }));
    const winAndNoGoals = [homeTeam, awayTeam].map((team) => ({
      ntline: `${team} vinner og holder nullen`,
      betfairline: `${team} vinner og holder nullen`,
      outcomes: yesNoOutcome,
    }));
    mappers.push(...newLines, ...goalsHome, ...goalsAway, ...winAndNoGoals);
  } catch (err) {
    console.error(err);
  }

  $miniMarketLines.each((i, line) => {
    const lineObj = $(line);
    let title = lineObj.find('span.market-name-label, h2.market-type');
    const titleText = title.first().text().trim();
    const foundMapper = mappers.find((m) => m.betfairline === titleText);
    if (foundMapper) {
      let selections = data.filter(
        (item) => item.marketType === foundMapper.ntline
      );
      const findSelection = (tester) =>
        (selections.find((item) => item.outcomeName === tester) || {}).price;
      lineObj.find('tr.runner-line, li.runner-item').each((nthRLine, rline) => {
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
          } else if (
            [
              'Pause',
              'Kampodds',
              'Spill på hjørnespark i kampen',
              'H/B – ingen spill på uavgjort',
            ].includes(foundMapper.betfairline)
          ) {
            price = getHUBMarkets(selections, nthRLine);
          } else if (foundMapper.ntline.indexOf('Handikap 3-veis') === 0) {
            price = getHUBMarkets(
              selections,
              nthRLine,
              foundMapper.betfairline.indexOf(awayTeamEng) === 0
            );
          } else if (foundMapper.betfairline === 'Pause/Fulltid') {
            const map = {
              0: 0,
              1: 3,
              2: 6,
              3: 1,
              4: 4,
              5: 7,
              6: 2,
              7: 5,
              8: 8,
            };
            price = selections[map[nthRLine]].price;
          } else if (
            / over\/under \d\.\d mål|Cards Over\/Under \d\.\d|Corners Over\/Under \d+\.\d/.test(
              foundMapper.betfairline
            )
          ) {
            price = (selections[nthRLine ? 0 : 1] || {}).price;
          } else if (foundMapper.betfairline === 'Kvalifiserer seg') {
            price = selections[nthRLine].price;
          } else if (foundMapper.betfairline === 'Asiatisk handikap') {
            const [, team, handicapLine] =
              nameText.match(/^([^\d]+) (.*)$/) || [];
            const selection = data.find(
              (el) =>
                el.marketType.indexOf('Handikap 2-veis') === 0 &&
                el.outcomeName ===
                  `${
                    team === homeTeamEng ? el.homeTeam : el.awayTeam
                  } ${handicapLine}`
            );
            if (selection) {
              price = selection.price;
            }
          } else if (
            ['To Score', 'Første målscorer'].includes(foundMapper.betfairline)
          ) {
            price = selections.find(
              (item) =>
                item.outcomeName.toLowerCase() === nameText.toLowerCase()
            ).price;
          } else if (foundMapper.betfairline === 'Shown a card?') {
            price = selections.find(
              (item) =>
                item.outcomeName
                  .substring(0, item.outcomeName.length - 3)
                  .toLowerCase() === nameText.toLowerCase()
            ).price;
          }
          if (price > 0 && betfairPrice > 0) {
            const diff = (price / betfairPrice) * 100 - 100;
            name.text(
              `${name.text().split(' (NT:')[0]} (NT: ${price.toFixed(
                2
              )} [${diff.toFixed(1)}%])`
            );
            if (diff >= -1) name.css({ color: 'green' });
            else name.css({ color: 'inherit' });
          }
        } catch (err) {
          console.error(err);
        }
      });
    }
  });
};

const askForNTOdds = async () => {
  const teams = window.location.pathname
    .match(/.*\/(?:([^-]+)-([^-]+).+?)$/)
    .slice(1, 3)
    .map((team) => team.charAt(0).toUpperCase() + team.slice(1));
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ teams }, (response) => {
      resolve(response);
    });
  });
};

async function runConditionally() {
  const regexp = new RegExp('https://www.betfair.com/exchange/plus/.*', 'i');
  if (regexp.test(window.location.href)) {
    try {
      const odds = await askForNTOdds();
      if (odds && odds.length) {
        await populateBetfairWithOdds(odds);
      }
    } catch (ex) {
      console.error(ex);
    }
  }
}

(async () => {
  setInterval(runConditionally, 5000);
})();
