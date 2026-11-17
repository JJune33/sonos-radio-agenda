# Sonos Radio Agenda

Een persoonlijke, responsive Sonos-radiogids. Programma's per weekdag plannen, bestaande Sonos-favorieten uit je account kiezen en met één klik afspelen. Geen automatische zenderwissel.

## Techniek

- **Frontend:** `index.html`, `style.css`, `app.js` in de root, geen buildstap.
- **Backend:** Cloudflare Pages Functions in `functions/api/`.
- **Opslag:** Cloudflare KV voor de gedeelde agenda, veilige Sonos OAuth-tokenopslag en sessies. OAuth-state is tijdelijk ondertekend en sessiegebonden.
- **Authenticatie:** eigen wachtwoord met 30 dagen geldige HttpOnly sessiecookie. Sonos Client Secret en tokens gaan nooit naar browser of GitHub.
- **Hosting:** private GitHub repo gekoppeld aan Cloudflare Pages met automatische deployments.

## Stap 1: GitHub

Maak een **nieuwe private GitHub repository**, bijvoorbeeld `sonos-radio-agenda`, en upload de inhoud van deze map, met bestanden direct in de root. Kies geen bestaande repository van een andere app. GitHub maakt deze repository niet automatisch aan via dit ZIP-bestand.

## Stap 2: Cloudflare Pages

In Cloudflare: **Workers & Pages > Create > Pages > Connect to Git** en selecteer de nieuwe GitHub-repository.

- Framework preset: **None**.
- Build command: **leeg**.
- Build output directory: `.` (punt, de root).
- Root directory: `/` (standaard).
- Production branch: `main`.

Cloudflare publiceert dan bijvoorbeeld `https://sonos-radio-agenda.pages.dev` als deze projectnaam beschikbaar is. Het daadwerkelijke adres staat in Cloudflare.

## Stap 3: Cloudflare KV

Maak een KV Namespace, bijvoorbeeld `sonos-radio-kv`. Open daarna de Pages-projectinstellingen, ga naar **Bindings** en koppel die namespace aan de Pages Function met **variable name exact `RADIO_KV`**. Deploy opnieuw nadat je de binding hebt ingesteld.

## Stap 4: Variables en Secrets

Ga in het Cloudflare Pages-project naar **Settings > Variables and Secrets** (de menunamen kunnen wijzigen). Zet bij Production:

| Naam | Waarde | Type |
|---|---|---|
| `SONOS_CLIENT_ID` | Je bestaande Sonos API Key / Client ID | Secret |
| `SONOS_CLIENT_SECRET` | Je bestaande Sonos Client Secret | Secret |
| `SONOS_REDIRECT_URI` | `https://JOUW-PROJECT.pages.dev/api/oauth/callback` | Variable |
| `APP_PASSWORD` | Een nieuw sterk wachtwoord voor je privé radioagenda | Secret |
| `SESSION_SECRET` | Een lange willekeurige waarde van minstens 32 tekens, los van het wachtwoord | Secret |

**Zet deze waarden nooit in GitHub of in app.js.** Na wijziging van Cloudflare-instellingen: opnieuw deployen. Als Cloudflare meerdere omgevingen toont, configureer Production. Een previewdeployment kan Sonos OAuth niet afhandelen met de productie Redirect URI.

## Stap 5: Sonos Developer Portal

Open je bestaande Sonos-integratie. Vervang de lokale Redirect URI `http://localhost:8000` door de exacte waarde van `SONOS_REDIRECT_URI`, dus bijvoorbeeld:

`https://sonos-radio-agenda.pages.dev/api/oauth/callback`

Let op: kies jouw **werkelijke** Cloudflare-URL. Het hele adres inclusief `/api/oauth/callback` moet exact overeenkomen. Vervolgens open je de live Pages-site, log je in met `APP_PASSWORD` en klik je op **Sonos koppelen**. Sonos vraagt je één keer toestemming. Hierna verschijnen je eigen Sonos-favorieten en de huidige kamers/groepen.

## Gebruik

1. Kies onder *Afspelen op* de juiste kamer of groep.
2. Klik op *+ Programma toevoegen* en vul naam, dag, starttijd, eventueel eindtijd en Sonos-favoriet in.
3. Kies een dag of *Hele week*. De huidige dag wordt bij openen standaard getoond.
4. Klik op *Afspelen* naast een programma om de Sonos-favoriet direct te starten.

De agenda is centraal opgeslagen in Cloudflare KV en daarom zichtbaar op je iPad, iPhone, Android en laptop. Gebruik overal dezelfde Cloudflare-URL en log op elk apparaat eenmalig in. De computer hoeft niet aan te blijven. Je Sonos-systeem moet voor cloudbediening online zijn.

## Belangrijke opmerkingen

- Sonos-favorieten worden via de officiële Cloud API opgehaald. Pinned items en Sonos Playlists vallen niet onder het Sonos `getFavorites`-endpoint.
- Als je in Sonos een favoriet verwijdert, kan de eerder ingeplande agenda-regel blijven staan, maar niet meer worden afgespeeld. Kies dan een nieuwe favoriet.
- De app begint en stopt **nooit automatisch** met afspelen. Een eindtijd is alleen informatief.
- Sonos API-aanvragen werken pas wanneer de integratie is geautoriseerd. De code kon hier niet tegen jouw eigen Sonos-account worden getest.
- KV ondersteunt eventual consistency. Bij gelijktijdige wijzigingen vanaf meerdere apparaten kan een conflict optreden; de app controleert de opgeslagen revisie en waarschuwt zo veel mogelijk.
- Zet de app niet zonder `APP_PASSWORD` online; Cloudflare Secrets worden niet meegestuurd met GitHub.

## Originele documentatie

- Sonos: https://docs.sonos.com/docs/authorize
- Sonos favorieten: https://docs.sonos.com/reference/favorites-getfavorites-householdid
- Sonos afspelen: https://docs.sonos.com/reference/favorites-loadfavorite-groupid
- Cloudflare Pages Functions: https://developers.cloudflare.com/pages/functions/get-started/
- Cloudflare KV bindings: https://developers.cloudflare.com/pages/functions/bindings/
