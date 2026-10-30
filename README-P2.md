# Aimes.fi / P2 — kertomukset ilman käyttäjätiliä

Julkinen sivu on yhä yksi index.html. Aito yhteinen tallennus tarvitsee sen rinnalle Cloudflare Pages Functionin ja D1-tietokannan. Maksuja tai maksullisia ominaisuuksia ei ole lisätty.

## Käytösmalli
- Yksityinen tallennus säilyy selaimessa. Sitä ei lähetetä palvelimelle.
- Lähetä tarkistettavaksi vaatii erillisen julkaisuluvan ja painalluksen.
- Lähetys odottaa ylläpidon tarkistusta, eikä näy vielä muille.
- Lähettäjä saa salaisen hallintalinkin. Sen voi ladata tekstitiedostoksi. Linkki antaa oikeuden muokata ja poistaa kertomus; älä jaa sitä muille.
- Julkaistun kertomuksen muokkaus poistaa vanhan version julkisesta kokoelmasta ja palauttaa uuden tarkistukseen.
- Poisto peruu julkaisuluvan ja poistaa rivin tietokannasta. Palveluntarjoajan varmuuskopioilla on erillinen vanhenemisaika.
- Julkinen kokoelma on haettava ja sivutettu. Ihmisten kokemuksia ei esitetä varmennettuina tosiasioina.

## Tuotannossa 30.10.2026
P2 on julkaistu aimes.fi:n olemassa olevaan Pages-projektiin GitHubin main-haarasta. DB-sidonta, ylläpidon salaisuudet ja hyväksytty yhteysosoite on asetettu Cloudflaren tuotantoympäristöön. Tuotannossa kokeiltiin vastaanotto, tarkistus, julkaisu, kirjoittajan korjaus ja poisto; testikertomus poistettiin. Alla olevat käyttöönottoaskeleet ovat palautusta tai toiseen ympäristöön siirtämistä varten.

## Käyttöönotto olemassa olevaan Pages-projektiin
Älä luo toista sivustoa tai muuta domainin DNS:ää. Varmista ensin, että aimes.fi on tämän repon Cloudflare Pages -projekti. Jos julkaisu on Workers Static Assets, sama API-ydin pitää liittää sen Worker-reititykseen; älä oleta Pagesia.

1. Kirjaudu Cloudflareen: `npx wrangler login`.
2. Selvitä nykyinen projekti: `npx wrangler pages project list`.
3. Luo D1: `npx wrangler d1 create aimes-stories --location=weur`.
4. Liitä tietokanta olemassa olevan Pages-projektin tuotantoon nimellä `DB` (Settings → Bindings). Älä jaa tuotannon tietokantaa avoimien esikatselujen kanssa.
5. Luo tyhjään tietokantaan rakenne: `npx wrangler d1 execute aimes-stories --remote --file=migrations/0001_stories.sql`.
6. Aseta saman Pages-projektin tuotantoympäristöön salaisuudet:
   - `ADMIN_TOKEN`: satunnainen 32 tavun arvo, 64 heksamerkkiä.
   - `RATE_SECRET`: toinen itsenäinen satunnainen 32 tavun arvo.
   - `CONTACT`: ylläpitäjän oikea yhteysosoite, `mailto:...` tai `https://...`.
   Cloudflaren Secrets-kenttiä tai `wrangler pages secret put` -komentoa voi käyttää. Älä laita salaisuuksia tähän repoon, HTML:ään tai GitHub-issueen.
7. Julkaise olemassa olevan GitHub → Cloudflare -ketjun kautta. Functions-kansio kuuluu repon juureen. Jos projektilla on muu output-kansio, sovita index.html ja _routes.json sen mukaan.
8. Tarkista `/api/status`: `ready: true`. Varmista sitten testikertomuksella vastaanotto, salainen hallintalinkki, tarkistus, julkaisu ja poisto. Poista testikertomus lopuksi.

Ilman kaikkia neljää palvelinasetusta vastaanotto pysyy pois käytöstä. Sivu ei väitä lähettävänsä tekstiä.

## Ylläpito
Avaa `https://aimes.fi/#toimitus` ja anna `ADMIN_TOKEN`. Tämä ei ole tavallisen kävijän kirjautuminen. Avain säilyy vain näkymän muistissa, ja sulkeminen tyhjentää sen. Tarkista jokainen kertomus: muiden yksityisyys, tunnistettavuus, suorat syytökset, julkaistavaksi sopivuus ja mahdolliset huijauslinkit. Hyväksyntä ei vahvista kertomusta todeksi.

Ylläpidon avainta ei saa lähettää sähköpostina eteenpäin tai sisällyttää julkiseen osoitteeseen. Avaimen voi vaihtaa Cloudflaren salaisuuksista. Älä ota API-pyyntöjen runkojen tai Authorization-otsakkeen lokitusta käyttöön.

## Tietojen käsittely
Tallennetaan teksti, otsikko, tyyppi, nimimerkki, vapaaehtoinen paikka/ajankohta, kieli, tila, julkaisuluvan versio, aikaleimat ja versionumero. Hallinta-avaimesta tallennetaan vain SHA-256-tiiviste. Sähköpostia, tiliä tai tarkkaa sijaintia ei kysytä.

Roskapostin ensimmäinen raja: neljä lähetysyritystä/IP/tunti, piilotettu houkutuskenttä, pituusrajat ja saman alkuperän tarkistus. IP:stä lasketaan salaisuuteen ja tuntiin sidottu tiiviste; raakaa IP:tä ei kirjoiteta D1:een. Tämä on kevyt aloitussuoja, ei lupaus bottien täydellisestä torjunnasta. Käyttömäärien kasvaessa tarvitaan lisäsuojausta sekä ylläpidon työaikaa.

Julkaisemattomat lähetykset vanhenevat 90 päivässä; siivous tehdään seuraavan API-pyynnön yhteydessä. Vanhentuneet roskapostirajoitusrivit siivotaan samalla. Julkaistut tekstit säilyvät poistoon asti. Verkkopalvelun tarjoajalla voi olla yhteyslokeja ja varmuuskopioita: täydellistä teknistä anonymiteettiä ei luvata. Ennen avaamista varmista ylläpitäjän yhteystiedot ja palveluntarjoajan tietojenkäsittelyehdot.

## Julkaisun tila
Cloudflare vahvisti julkaisun onnistuneeksi ja tuotannon API-toimintakoe läpäistiin 30.10.2026. Samsungin käyttöliittymää ei ole tässä istunnossa voitu tarkistaa selaimessa.

Myöhemmin voi lisätä vapaaehtoisen tukimaksun tai erillisen maksullisen lisäpalvelun. Nyt ei ole maksukoodia, maksuseinää tai tilauksia. Käyttäjien kertomuksia ei ole tarkoitettu myytäväksi.
