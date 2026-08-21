# PLAN.md — Årshjulet, steg 1: börja här

> För en ny Claude Code-session i den här mappen. Läs `CLAUDE.md` (miljö) och
> `specs/datum-vecka-och-koncept.md` (vad och varför) först. Den här filen säger **i vilken
> ordning, med vilka gränser, och vad som redan är verifierat** så du slipper gräva fram det igen.
>
> **Status 2026-08-21: planen är godkänd som riktning av Paul men varje PR startas på hans "bygg".**
> Gör inget förrän han säger det, och aldrig mer än en PR i taget utan att han sett den förra.

## Vad det här är — och inte är

Fyra små PR:er som gör årshjulsappen till ett komplett tvåkalenders-verktyg (verksamhetsplan +
mediekalender) med korrekt datum↔vecka-logik och en import som tar en hel verksamhetsplan från
Word. Allt är **additivt och reversibelt** i den här appen och databasen.

Det är **inte** flytten av verksamhetsplanen till CRM:et. Den är ett *eventuellt* steg 2, beskrivet
i `../crm-mistral-flow/specs/arshjul-tab.md`, och avgörs först efter att steg 1 använts ett tag.
Rör inte CRM-repot härifrån.

## Arbetssätt (gäller varje PR)

Följ build-skill-pipelinen: spec (finns) → branch `feat/<slug>` eller `fix/<slug>` → bygg →
verifiera → PR → **stopp**. Paul mergar efter review i en ny session; du mergar aldrig själv.

- Inga nya beroenden utan socket.dev-koll + exakt version (`npm install --save-exact`). Den enda
  förväntade nya deppen är ev. `mammoth` för .docx — och den är **out of scope** för steg 1.
- `npm ci` i Dockerfile, aldrig `npm install`. Ändra inte andra versioner i förbifarten.
- Verifiera med det appen faktiskt deployar med: `docker compose build` lokalt före PR
  (och `docker builder prune -f` + `docker image prune -f` efteråt — Pauls Docker Desktop är full).
  Läs exit-koden ur loggen innan du skriver "Built".
- Alla routes är auth-gated på router-nivå (`router.use(verifyDirectusToken)` i `activities.ts`
  och `concepts.ts`; per-route i `ai.ts`). Behåll det. Verifierat 2026-08-20: `GET /api/concepts`
  utan token → 401.
- Migreringsscript: **dry-run som default**, `--apply` för att skriva, utskrift av varje ändring,
  och kör dem **lokalt genom SSH-tunneln** (`ssh -L 5433:127.0.0.1:5433 glsfbg -N`, `DATABASE_URL`
  i `.env.local`). Ta en `pg_dump` av `fbg_planning` innan `--apply`.
- Deploy sker av Paul efter merge. OBS: mappen på VPS:en heter **`~/fbg-planning`**, inte
  `fbg-year-plan` (se `CLAUDE.md`).
- Ingen dark mode i appen. Svenska i UI-texter.

## De fyra PR:erna, i ordning

### PR 1 — `fix/ritregel-datum-vecka` · ritregeln + ISO-veckor (rör ingen data)

**Mål:** samma aktivitet ser likadan ut i hjul, timeline och sheet: en daterad endagsaktivitet är
en prick (`·`), en veckoaktivitet eller flerdagars är en stapel (`---`).

Varför det är trasigt idag (verifierat i kod):
- `components/Wheel.tsx` ~rad 276–310: datum först (olika start/slut → båge, lika → prick),
  fallback `weeks[]` → **en prick per vecka**.
- `components/Timeline.tsx` ~rad 71–105 (`getActivitySegments`): `weeks[]` **först** → stapel över
  veckorna, fallback datum. Dessutom en egen `getWeekNumber` (rad 17) — ersätt med
  `date-fns`:s `getISOWeek`/`getISOWeekYear` (date-fns finns redan i projektet? **kontrollera
  `package.json`**; om inte, är det den enda tillåtna nya deppen i denna PR, socket.dev först).
- `components/SpreadsheetView.tsx` ~rad 596: 52 veckokryssrutor styrda av `weeks.includes(week)`.

Gör i PR 1 (utan schemaändring — `precision` finns inte än, så härled den):
```
effektivPrecision = weeks.length > 0 && !start_date            → 'week'
                    start_date && end_date && end_date > start  → 'span'  (ritas som stapel)
                    annars                                      → 'day'   (prick)
ritas som stapel  om 'week' eller 'span'
ritas som prick   om 'day'
```
En gemensam helper i `lib/` (t.ex. `lib/activity-time.ts`) som alla tre vyer använder:
`segmentsFor(activity): {startDate, endDate, kind: 'dot'|'bar'}[]`, med ISO-veckor. Timelinen ska
rita pricken *inuti* veckocellen på dagens position, inte en cellbred stapel. Tooltip visar alltid
både datum och vecka: "22 mars (v12)" / "v42 (13–19 okt)".

Acceptans: de tre vyerna använder samma helper; enhetstester för helpern (endag, flerdagars,
bara-vecka, hoppande veckor → flera segment, årsskifte v52/v1); inga ändringar i API eller DB.

### PR 2 — `feat/precision-modell` · `precision` in, `weeks[]` ut

**Mål:** en sanning (datum) + `precision: 'day' | 'week'`. Spec §1.

- Migration `db/migration-precision.sql` + script `scripts/migrate-precision.ts` (dry-run default).
  Regler och antal per fall står i spec §1 "Migrering". Datan per 2026-08-21: 140 aktiviteter,
  107 endag, 10 flerdagars, 117 med både datum och veckor, 4 bara veckor, 18 varken eller,
  3 med hoppande veckor. Kontrollfråga (kör före och efter, read-only):
  ```sql
  SELECT count(*) FILTER (WHERE cardinality(weeks)>0 AND start_date IS NULL) AS weeks_only,
         count(*) FILTER (WHERE start_date IS NULL AND cardinality(weeks)=0) AS neither,
         count(*) FILTER (WHERE end_date > start_date) AS multi_day FROM activities;
  ```
- `start_date`/`end_date` blir NOT NULL **efter** att de 18 odaterade hanterats (spec: de visas i
  en "Odaterade"-lista tills någon rättar — så NOT NULL får vänta till en uppföljnings-PR, eller
  så hanteras de manuellt av Paul först; fråga).
- API: `POST/PUT /api/activities` tar `precision`, avvisar `weeks`. `types.ts` uppdateras.
  AI-routernas JSON-schema (`server/routes/ai.ts` ~rad 344 och 632) byter `weeks` → `precision`.
- Sheet: veckokolumnerna blir beräknade (read-only); ny inmatning "Datum eller vecka" som tolkar
  `2026-03-22`, `22/3`, `v42`, `v42–44` → datum + precision. Helpern från PR 1 tar över
  `precision` i stället för att härleda.

Acceptans: dry-run-rapport bifogad i PR:en; efter apply visar alla tre vyer exakt som före PR 2
för de 117 "normala" raderna (jämför skärmdumpar före/efter på samma år).

### PR 3 — `feat/konceptvaxlare` · Verksamhetsplan | Media

**Mål:** två riktiga kalendrar. Spec §2.

- `App.tsx` har redan `selectedConceptId` (rad ~34) och en meny med **"Alla koncept"** som default
  (rad ~269). Gör om till en segmenterad kontroll överst: `Verksamhetsplan | Media` (+ "Alla" som
  tredje, icke-default läge). Val i URL `?koncept=` och `localStorage`.
- Nytt koncept "Media" med kategorier (förslag: Kampanj, SoMe, Magasin, Press, Event) och egna
  färger — läggs in via UI eller ett litet seed-script (dry-run default). Fokusområden, filter,
  AI-generering och rapport är redan scopeade på `conceptId`.
- Inga media-specifika fält i denna PR. De läggs till när behovet är konkret.

Acceptans: byter man koncept ändras kategorier, filter och alla tre vyer; reload behåller valet;
AI-assistenten skapar i valt koncept.

### PR 4 — `feat/import-fran-word` · höjt tak, paste-chip, förhandsgranskning

**Mål:** klistra in en hel verksamhetsplan (eller medieplan) och få kalendern populerad. Spec §3.

- `server/routes/ai.ts:296`: taket 10 000 tecken är en artefakt. Höj till ~250 000 (sanity-guard).
  Ingen chunkning som design; bara som fallback om JSON-svaret blir instabilt (mät).
- Paste-chip i `components/AIActivityAssistant/`: inklistring > ~1 500 tecken blir en chip
  "Inklistrad text · N tecken · ~S sidor" med `×`, klick öppnar texten för läsning/redigering,
  flera chips tillåts. Rutan förblir fri för instruktioner. Skickas som `description` som idag.
- Förhandsgranskning: tabell med föreslagna aktiviteter (kategori, datum/vecka, precision,
  ansvarig) → bocka av/redigera → skapa. **Aldrig direkt-skrivning** av resultatet.
- Prompten får precision-regeln: "står bara en vecka → precision week, måndag–söndag".
- .docx-uppladdning (`mammoth`) är out of scope; copy-paste räcker.

Acceptans: 40 000 tecken inklistrat → chip, förslag, förhandsgranskning, skapande i valt koncept;
`description.length` 250 001 → 400 med svenskt felmeddelande.

## Out of scope för hela steg 1

Kopplingar till företag/personer/grupper, agent, flytt till Directus/CRM, delat komponentpaket,
Excel-importen (används knappt, rörs inte), publika kalendrar.

## När du är klar med en PR

Posta PR-länken och skriv som vanligt:

> PR:en är klar: <url>. Öppna en NY Claude Code-session och kör:
> "Review PR #<n>. You did not write this code. Check it against
> specs/datum-vecka-och-koncept.md and PLAN.md. Look for: auth regressions on routes, the
> migration's dry-run/apply split, data loss paths, deviations from the render rule, and
> anything that touches the CRM repo (it must not). Be adversarial."
