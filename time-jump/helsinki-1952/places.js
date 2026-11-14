'use strict';

window.travelPlaces = [
  {
    name: 'Kauppatori',
    district: 'Eteläsatama',
    image: 'market',
    alt: 'Tekoälykuva kauppatorin myyntikojuista ja laiturin pienveneistä.',
    line: 'Veneet keinuvat laiturissa. Myyntipöydän äärestä kuuluu puheensorinaa.',
    finds: [
      {
        label: 'Katso laiturille', title: 'Kala myytiin veneestä', kind: 'Todennettu tieto',
        body: 'Kauppatori syntyi 1800-luvun alussa, kun maalaistavaran myynti siirrettiin Senaatintorilta rantaan. Kalastajat myivät saalistaan suoraan veneistä, kun taas maalta tulleet myyjät käyttivät toripöytiä.',
        source: ['Helsingin kaupunki · Esplanadit ja Kauppatori', 'https://historia.hel.fi/fi/alueet/etelainen/esplanadit-ja-kauppatori-kaupungin-sykkiva-sydan']
      },
      {
        label: 'Lue myyjän sanat', title: 'Paperiin kääritty ostos', kind: 'Kuvitteellinen kohtaaminen',
        body: '”Pitäkää tuosta kulmasta, ettei kostu takki”, myyjä sanoo ja ojentaa paketin tiskin yli. Takana joku kysyy, miten stadionille pääsee.'
      }
    ]
  },
  {
    name: 'Senaatintori',
    district: 'Kruununhaka',
    image: 'square',
    alt: 'Tekoälykuva Senaatintorista, kirkon portaista ja toria ylittävistä ihmisistä.',
    line: 'Askeleet kaikuvat kiveyksellä. Portaiden yläpuolella näkyvät kirkon vihreät kupolit.',
    finds: [
      {
        label: 'Tutki patsasta', title: 'Suomi-neito jalustalla', kind: 'Todennettu tieto',
        body: 'Aleksanteri II:n patsas valmistui vuonna 1894. Yksi jalustan neljästä veistoksesta on Laki eli Lex. Siinä Suomi-neidolla on miekka ja hänen vierellään leijona.',
        source: ['Helsingin yliopisto · Senaatintorin veistosten symbolit', 'https://www.helsinki.fi/fi/uutiset/kulttuuri/kaarmeita-ja-uhripatoja-yliopiston-nurkilla-mita-rakennusten-symboleilla-haluttu-kertoa']
      },
      {
        label: 'Tarkastele katukuvaa', title: 'Mistä näkymä on rakennettu?', kind: 'Perusteltu rekonstruktio',
        body: 'Kirkon portaat, toriaukio ja Aleksanteri II:n muistomerkki ankkuroivat näkymän Senaatintorille. Heinäkuun valo, ohikulkijat ja heidän reittinsä on sommiteltu tätä matkaa varten.'
      }
    ]
  },
  {
    name: 'Olympiastadion',
    district: 'Töölö',
    image: 'stadium',
    alt: 'Tekoälykuva Olympiastadionin vaaleasta tornista ja katsomoon kulkevista ihmisistä.',
    line: 'Vaalea torni nousee väkijoukon ylle. Portille kulkee ihmisiä pienissä ryhmissä.',
    finds: [
      {
        label: 'Katso tornin huipulle', title: 'Olympiatuli nousee torniin', kind: 'Todennettu tieto',
        body: 'Helsingin kisat avattiin 19.7.1952. Paavo Nurmi toi olympiatulen stadionille ja sytytti kentän tulen. Tornin huipulla tulen sytytti Hannes Kolehmainen.',
        source: ['Olympiastadion · Olympiasoihdun matka 72 metrin korkeuteen', 'https://www.stadion.fi/fi/info/ajankohtaista/olympiasoihdun-matka-72-metrin-korkeuteen']
      },
      {
        label: 'Avaa taitettu lappu', title: 'Tavataan tornin alla', kind: 'Kuvitteellinen esine',
        body: 'Lyijykynällä kirjoitetun lapun kulmaan on piirretty pieni torni. ”Jos eksytään, tavataan täällä. Älä lähde portilta ennen kuin löydän sinut.”'
      }
    ]
  }
];
