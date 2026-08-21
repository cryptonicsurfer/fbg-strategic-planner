# Datum ↔ vecka, konceptväxlare och AI-import — utkast

> **Status: POTENTIELLT.** Underlag (2026-08-21) för tre förbättringar i årshjulsappen som är
> värda att göra **oavsett** om verksamhetsplanen flyttar in i CRM:et
> (se `crm-mistral-flow/specs/arshjul-tab.md`). Om flytten blir av gäller samma modell där.

## 1. Datum ↔ vecka: en sanning, två precisioner

### Problemet (verifierat i kod + data 2026-08-21)

Aktiviteter bär **två** tidsrepresentationer, `start_date/end_date` och `weeks[]`, och vyerna
prioriterar dem **omvänt**:

| Vy | Läser först | Fallback | Effekt |
|---|---|---|---|
| `Wheel.tsx` | datum (olika start/slut → båge, lika → prick) | `weeks[]` → **en prick per vecka** | "pågår v42" (bara vecka) blir en prick, inte `---` |
| `Timeline.tsx` | `weeks[]` → **stapel över veckorna** | datum → veckor | "22/3" (endag, men med v12 ifyllt) blir en hel veckostapel, inte `.` |
| `SpreadsheetView.tsx` | 52 veckokryssrutor (`weeks.includes(w)`) | — | användaren kryssar veckor oberoende av datum |

Datan (`fbg_planning`, 140 aktiviteter): 107 endag (start = slut), 10 flerdagars, **117 har både
datum och veckor**, 4 bara veckor, 18 varken eller, 3 med icke-sammanhängande veckor. Det vanliga
fallet — en daterad endagsaktivitet med veckan ikryssad — är alltså just det som ritas fel i
timelinen.

### Modellen

**Datum är sanningen. Veckor är en inmatnings- och visningsform.** Plus en flagga för hur exakt
användaren menade det:

```
start_date  date  NOT NULL
end_date    date  NOT NULL   -- = start_date för endag
precision   'day' | 'week'  -- hur tiden angavs
```

- Skriver man ett datum → `precision = 'day'`, start = slut.
- Skriver man "v42" → start = måndag v42, slut = söndag v42, `precision = 'week'`.
  "v42–44" → måndag v42 … söndag v44. ISO 8601-veckor (måndagsstart, svensk standard) — **inte**
  `Timeline.tsx`:s egna `getWeekNumber`, som ska bytas mot `date-fns/getISOWeek`.
- `weeks[]` **tas bort** som lagrat fält. Det som visas/kryssas i sheet-vyn beräknas från datumen.

### Ritregeln — samma i alla tre vyer

```
prick  (·)   om precision = 'day'  OCH start = slut
stapel (---) annars                 (precision = 'week', eller start < slut)
```

- Hjulet: prick på datumets vinkel; stapel = båge från start till slut (veckoaktivitet = måndag→söndag).
- Timelinen: prick **inuti** veckocellen på dagens position (inte en cellbred stapel); stapel = över
  cellerna start→slut.
- Sheet: veckokolumnerna är *beräknade* (read-only markering), och en inmatningsruta "Datum eller
  vecka" som tolkar `2026-03-22`, `22/3`, `v42`, `v42–44`.
- Tooltip visar alltid både: "22 mars (v12)" respektive "v42 (13–19 okt)". Det är kopplingen
  datum ↔ vecka "och tvärtom" som efterfrågats — den sker i presentationen, inte i lagringen.

### Migrering av befintlig data (engångs, dry-run först)

| Fall | Antal | Regel |
|---|---|---|
| datum + veckor, veckorna = datumens veckor | majoriteten av 117 | `precision = 'day'`, veckor slängs |
| datum + veckor, veckorna *vidare* än datumen | kontrolleras i dry-run | `precision = 'week'`, datum vidgas till veckornas måndag–söndag; loggas för manuell koll |
| bara veckor | 4 | `precision = 'week'`, datum = måndag–söndag (året från kontexten/`year`) |
| bara datum | 1 | `precision = 'day'` |
| varken | 18 | behålls, `start_date` null tillåts *tillfälligt* och visas i en "Odaterade"-lista, aldrig i hjulet; rättas för hand |
| icke-sammanhängande veckor | 3 | delas i en aktivitet per sammanhängande block (samma namn, suffix "(1/2)") |

## 2. Växla verksamhetsplan / mediekalender

`strategic_concepts` finns redan med `is_time_based`; `App.tsx` har `selectedConceptId` och en
meny med **"Alla koncept" som default**. Det räcker inte för två riktiga kalendrar:

- **Konceptväxlare överst** som segmenterad kontroll: `Verksamhetsplan | Media`. Ingen "Alla"
  som default — två kalendrar med olika kategorier blandade i ett hjul är brus. ("Alla" kan finnas
  kvar som tredje läge för den som vill.)
- Valet i URL (`?koncept=media`) och i `localStorage` så man landar där man var.
- Fokusområden/kategorier, filter, AI-generering och rapport är redan scopeade på `conceptId` —
  det faller på plats gratis när växlaren finns.
- Nytt koncept "Media" med kategorier t.ex. Kampanj, SoMe, Magasin, Press, Event — egna färger.
- Media-specifika fält (kanal, publiceringsdatum, asset-länk, status "publicerad") läggs till
  **här** när behovet är konkret, aldrig i CRM:et.

## 3. Populera en kalender från ett Word-dokument

`/api/ai/generate-activities` finns redan: tar `description` + valfria bilder + `conceptId` +
`year`, hämtar konceptets fokusområden och låter Mistral föreslå aktiviteter (`start_date`,
`end_date`, `weeks`). Det som saknas för "klistra in hela verksamhetsplanen":

1. **Teckentaket 10 000 är en gammal artefakt, inte en gräns** (`server/routes/ai.ts:296`,
   server-sidan; inget `maxLength` i frontend). Mistral Medium 3.5 (appens default) tar 128k
   tokens ≈ 300–400k tecken svensk text. Höj server-guarden till ~250 000 tecken — en sanity-
   gräns mot misstag, inte en produktgräns — och **chunka inte** som design; en hel
   verksamhetsplan ska gå in i ett anrop så modellen ser helheten (kapitel, årsrytm, upprepningar).
   Chunkning bara som fallback om JSON-svaret visar sig bli instabilt över en viss storlek.
   **Paste-chip i stället för väggtext (Paul 2026-08-21):** klistrar man in mer än ~1 500 tecken
   blir det inte text i rutan utan en liten **bilaga-chip** — ikon + "Inklistrad text · 42 310
   tecken · ~8 sidor" + ett `×` för att ångra. Rutan förblir fri för egna instruktioner
   ("skapa bara aktiviteter för hösten", "hoppa över kapitel 2"). Samma mönster som bilderna
   redan har i assistenten, och samma som Claude/ChatGPT gör vid långa inklistringar. Klick på
   chippen visar texten i en dialog (läs/redigera). Flera chips tillåts (flera dokument). Chippen
   skickas som `description` precis som idag — ingen API-ändring utöver taket.
2. **Förhandsgranska innan skapande** — tabell med föreslagna aktiviteter, kategori, datum/vecka,
   precision; bocka av, redigera, skapa. Aldrig direkt-skrivning av 40 rader från en prompt.
3. **Output-schemat** följer §1: `start_date`, `end_date`, `precision` — inte `weeks`. Prompten
   får regeln uttryckt: "står bara en vecka → precision week och måndag–söndag".
4. **.docx direkt** i stället för copy-paste är en liten sak (`mammoth` → text), men copy-paste
   räcker för att börja. Socket.dev-koll före ny dep, som vanligt.
5. Excel-importen (`/parse-excel`) används knappt löpande (Paul 2026-08-21) — behålls i
   årshjulsappen, portas inte någon annanstans.

## 4. Ordning, om det görs — och varför detta är steg 1 av två

Paul (2026-08-21): **först allt detta i årshjulsappen, sedan eventuellt verksamhetsplanen in i
CRM:et.** Rätt ordning, eftersom allt här är additivt och reversibelt — ingen migrering mellan
system, ingen nedsida om steg 2 aldrig sker — medan steg 2 är en flytt. Dessutom städas datan
(precision, odaterade, hoppande veckor) här, där man kan jämföra mot igår, så en senare flytt
kopierar ren data. Det man *inte* får förrän steg 2: kopplingar företag ↔ aktivitet, agenten, en
app. Steg 1 löser alltså inte silo-problemet — det ger beslutsunderlaget för om steg 2 är värt det.

1. §1 ritregel + ISO-veckor i de tre vyerna (liten PR, rör ingen data, synlig vinst direkt).
2. §1 modell + migrering (`precision`, `weeks[]` bort) — dry-run, diff, apply.
3. §2 konceptväxlare + koncept "Media".
4. §3 höjt tak + paste-chip + förhandsgranskning.

~2–2½ dagar. Därefter en paus med verklig användning innan steg 2 (`crm-mistral-flow/specs/
arshjul-tab.md`) avgörs. Allt märkt potentiellt tills Paul säger bygg.
