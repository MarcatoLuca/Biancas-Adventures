# Bianca's Adventures — Design Spec

Data: 2026-09-24
Stato: Approvato per pianificazione implementazione

## 1. Scopo e contesto

Bianca's Adventures è una **Progressive Web App (PWA)** personale, gratuita, installabile
sull'iPhone dell'utente tramite "Aggiungi a Home" da Safari (nessun App Store, nessun
account Apple Developer, nessuna firma/sideload necessaria).

L'app legge le foto di un **Album Condiviso iCloud** (link pubblico), le geolocalizza
(manualmente, assistite da un'AI generativa) e le mostra su una mappa del mondo stilizzata
a schermo intero, in stile "gioco", raggruppate per luogo.

Vincolo trasversale: **tutto deve restare gratuito**, nessuna funzionalità a pagamento,
nessun servizio con costi ricorrenti previsti nell'uso personale.

## 2. Decisioni fondamentali (e perché)

- **Nessun login Apple ID / iCloud completo.** Non esiste un'API pubblica ufficiale per
  accedere alla libreria Foto completa di un account; le uniche alternative sono librerie
  non ufficiali che richiedono credenziali e 2FA nel codice, fragili e contro i Termini di
  Servizio Apple. **Scartato.**
- **Album Condiviso (link pubblico) come sorgente**, invece di iCloud Drive. È la funzione
  ufficiale pensata per la condivisione pubblica, stabile e legittima. **Limite noto e
  accettato:** l'endpoint pubblico espone tipicamente le ~1000 foto più recenti dell'album;
  non si prevede alcun meccanismo di multi-album per aggirare il limite.
- **Nessun dato GPS/EXIF disponibile.** Verificato empiricamente sullo schema dati restituito
  dall'endpoint pubblico dell'album condiviso (usato da librerie open source consolidate):
  i campi disponibili per foto sono `photoGuid`, `caption`, `dateCreated`,
  `contributorFullName`, `derivatives` (URL/dimensioni immagine). **Nessun campo di
  posizione.** Apple rimuove i metadati di localizzazione dagli Album Condivisi per
  privacy. Conseguenza: **la posizione è sempre assente all'origine** e va sempre assegnata
  (manualmente o via suggerimento AI accettato).
- **Nessuna app nativa / cross-platform compilata.** Qualunque tecnologia (Swift nativo,
  React Native, Flutter) produce comunque un `.ipa` che richiede firma con Apple ID e, senza
  Mac, un tool di sideload esterno (es. Sideloadly) con re-firma ogni 7 giorni. Scartato a
  favore della PWA, che elimina completamente il problema.

## 3. Architettura generale

```
┌─────────────────────────┐      ┌────────────────────────────┐      ┌──────────────────────┐
│   PWA (React + Vite)     │◄────►│   Cloudflare Worker (API)   │◄────►│  iCloud Shared Album  │
│   installata su iPhone   │      │   - proxy album condiviso    │      │  (endpoint pubblico)  │
│   (Home Screen icon)     │      │   - proxy Gemini (key server) │     └──────────────────────┘
└───────────┬───────────────┘      │   - proxy Nominatim geocoding│
            │                      └─────────────┬────────────────┘
            ▼                                    ▼
   Service Worker (cache offline)      Supabase (Postgres, free tier)
                                       - posizioni foto (photos)
                                       - cache suggerimenti AI (ai_suggestions)
                                       - temi colore città (city_themes)
```

Nessuna chiave API (Gemini, Supabase service key) è mai esposta nel bundle frontend: tutte
le chiamate esterne sensibili passano dal Cloudflare Worker.

## 4. Autenticazione e privacy (multi-tenant ready)

Pur essendo pubblicata su internet come PWA (nessuno store), l'app **non deve mostrare le
foto a chiunque trovi l'URL**. Si usa **Supabase Auth** (incluso nel tier gratuito già in
uso per il database, nessun servizio aggiuntivo):

- **Login**: schermata iniziale (email + password, o magic link via email) prima di
  accedere alla mappa. La sessione persiste sul dispositivo (nessun login ripetuto ad ogni
  apertura della PWA).
- **Isolamento dati per utente**: le tabelle `photos`, `ai_suggestions`, `user_settings`
  includono `user_id`; **Row Level Security** attiva su Supabase garantisce che ogni utente
  legga/scriva solo le proprie righe, imposta a livello di database (non solo applicativo).
- **Worker**: ogni richiesta porta il token di sessione Supabase; il Worker lo valida,
  estrae `user_id` e lo usa per tutte le query e per determinare quale album iCloud
  sincronizzare per quell'utente.
- **`city_themes` resta condivisa** tra tutti gli utenti (dato non sensibile, palette
  colori riutilizzabile).
- **Oggi**: un solo account (il tuo). **In futuro**: si possono aggiungere altri utenti
  senza alcuna riscrittura, l'isolamento è già strutturale fin dal primo rilascio.

### Tabella `user_settings`
| Campo | Tipo | Note |
|---|---|---|
| `user_id` | uuid, PK, FK → auth.users | |
| `icloud_album_token` | text | Estratto dal link dell'Album Condiviso incollato dall'utente |
| `updated_at` | timestamptz | |

Una schermata **Impostazioni** nella PWA permette a ciascun utente di incollare il link del
proprio Album Condiviso (es. `https://www.icloud.com/sharedalbum/#TOKEN`); il Worker ne
estrae il token e lo salva in `user_settings`. Il sync per un utente usa sempre e solo il
proprio token — nessuna configurazione condivisa o hardcoded nel Worker.

## 5. Sorgente dati e sincronizzazione

- Il token dell'Album Condiviso è per-utente (vedi §4, tabella `user_settings`), non più
  una variabile d'ambiente globale del Worker.
- Il Worker interroga l'endpoint pubblico **on-demand all'apertura dell'app**, con cache
  breve (~5 minuti) per evitare chiamate eccessive; nessun polling continuo in background.
- Ogni foto è identificata in modo stabile dal suo `photoGuid`, usato come chiave primaria
  in Supabase per collegare posizione e stato AI nel tempo, anche tra sync successivi.
- Ad ogni sync, il Worker confronta i `photoGuid` ricevuti con quelli già noti in Supabase:
  i nuovi vengono inseriti con posizione `NULL` (appariranno nella coda "da posizionare").

## 6. Modello dati (Supabase / Postgres)

### Tabella `photos`
| Campo | Tipo | Note |
|---|---|---|
| `photo_guid` | text, PK | Identificatore stabile dall'album iCloud |
| `date_created` | timestamptz | Dalla risposta dell'album |
| `caption` | text | Dalla risposta dell'album (può essere vuota) |
| `thumb_url`, `full_url` | text | URL derivativi correnti (rinfrescati ad ogni sync, gli URL scadono) |
| `latitude`, `longitude` | double precision, nullable | NULL finché non posizionata |
| `location_source` | enum: `manual` \| `ai_accepted` | (nessun valore `exif`: mai disponibile in questa sorgente) |
| `location_label` | text | Nome luogo/città da reverse geocoding |
| `updated_at` | timestamptz | |

### Tabella `ai_suggestions`
| Campo | Tipo | Note |
|---|---|---|
| `photo_guid` | text, FK → photos | |
| `suggested_lat`, `suggested_lng` | double precision | |
| `suggested_label` | text | Luogo suggerito in linguaggio naturale |
| `reasoning` | text | Spiegazione breve generata da Gemini (es. "stessi vestiti della foto del 12/07 a Roma") |
| `status` | enum: `pending` \| `accepted` \| `rejected` | Se `rejected`, non riproposto automaticamente (rigenerabile manualmente su richiesta esplicita) |
| `created_at` | timestamptz | |

### Tabella `city_themes`
| Campo | Tipo | Note |
|---|---|---|
| `city_label` | text, PK | Nome città/luogo normalizzato (da reverse geocoding) |
| `color_1`, `color_2`, `color_3` | text (hex) | Palette generata da Gemini |
| `reasoning` | text | Motivazione culturale/architettonica breve |
| `created_at` | timestamptz | Popolata una sola volta per città; riusata per tutte le foto successive nella stessa città |

## 7. Flusso di assegnazione posizione

1. **Foto senza posizione**: vive fuori dalla mappa, in una coda dedicata "Da posizionare"
   (accessibile da un pulsante HUD con badge contatore), ordinata per data.
2. **Apertura foto senza posizione** → il Worker chiama **Gemini (vision)** automaticamente,
   passando come contesto: l'immagine stessa, alcune foto vicine per data (già posizionate
   o no), e un campione di foto già geolocalizzate come riferimento visivo. Gemini ragiona
   su somiglianze (stessi vestiti, paesaggio simile, data vicina) per proporre un luogo
   plausibile con una breve motivazione testuale.
3. **UI di suggerimento**: banner animato con mini-mappa del luogo proposto, motivazione,
   pulsanti grandi **Accetta** / **Rifiuta**.
   - *Accetta* → salva `latitude/longitude`, `location_source = ai_accepted`, calcola
     `location_label` (Nominatim), verifica/crea `city_themes` per quella città.
   - *Rifiuta* → apre il selettore manuale sulla mappa; suggerimento marcato `rejected`.
4. **Foto già posizionata**: il pulsante "Modifica posizione" nella vista foto singola apre
   **direttamente** il selettore manuale sulla mappa (nessuna nuova chiamata AI). Conferma →
   `location_source = manual`, ricalcolo eventuale città/tema se cambia zona.
5. **Conferma di una posizione (in entrambi i casi)** → animazione "volo" della foto dal
   pannello verso il punto sulla mappa, con piccolo effetto "pop" all'atterraggio; la foto
   scompare dalla coda "da posizionare" (se applicabile) e appare nell'album di quel luogo.

**Nota sui costi AI**: le chiamate a Gemini per suggerimento posizione avvengono una sola
volta per foto (risultato cachato in `ai_suggestions`); le chiamate per palette colore
avvengono una sola volta per città unica (cache in `city_themes`). Anche con migliaia di
foto, il volume di chiamate AI resta contenuto e compatibile con il tier gratuito.

## 8. Mappa stilizzata "da gioco" (canvas a tutto schermo)

- **Motore**: MapLibre GL JS, come **sfondo a tutto schermo** dell'intera app (non un widget
  dentro una UI classica). HUD, badge e album-card sono overlay fluttuanti sopra il canvas.
- **Tile**: vettoriali OpenFreeMap (gratis, nessuna API key, nessun limite di richieste).
- **Stile visivo**: style JSON personalizzato, colori piatti e saturi, contorni spessi,
  forme semplificate (no etichette stradali dettagliate), ispirato a mappe di
  giochi/parchi a tema.
- **Colorazione per bioma (globale, automatica)**: layer vettoriali di land-cover /
  land-use / elevazione usati per colorare dinamicamente il terreno sotto ogni zona:
  montagna → verde/marrone/bianco in quota, costa/mare → giallo sabbia/blu, foresta →
  verde scuro, area urbana generica → grigio caldo. Copre tutto il mondo senza
  configurazione manuale.
- **Temi colore per città (automatici via AI, vedi §7 e §6)**: applicati come un "alone" di
  colore soffuso (radial wash) attorno ai marker-album di quella zona, sopra la
  colorazione di base per bioma — non una riscrittura dei layer vettoriali globali (troppo
  fragile/costoso a livello di tile). Effetto: ogni città ha un'atmosfera cromatica
  distintiva, generata e cachata automaticamente, infinitamente espandibile senza curatela
  manuale.
- **Marker "album"**: card fluttuante stile "polaroid" con 2 foto in anteprima leggermente
  ruotate, ombra e bordo bianco spesso, per ogni gruppo di foto nello stesso luogo.
- **Clustering**: gruppi vicini si uniscono in un'icona cluster (stile forziere/isola) con
  contatore quando zoomati lontano; "esplodono" nei singoli album quando si zooma o si
  clicca (via supercluster, integrato in MapLibre tramite sorgente GeoJSON clusterizzata).
- **HUD di gioco**: pulsanti circolari fluttuanti attorno ai bordi della mappa (non una
  toolbar piatta): "Tutte le foto", "Da posizionare" (con badge contatore), "Impostazioni".
  Animazione "squish/bounce" al tocco.

## 9. Interazioni e animazioni (Framer Motion)

- **Apertura album**: tap sulla card "polaroid" → animazione a molla che apre un pannello a
  tutto schermo con griglia delle foto di quel luogo.
- **Vista foto singola**: swipe orizzontale tra le foto del luogo; overlay leggero con
  didascalia/data; pulsante "Modifica posizione".
- **Conferma posizione**: animazione di volo foto → punto mappa + effetto "pop" (vedi §7.5).
- **Suggerimento AI**: banner animato dal basso, mini-mappa di anteprima, motivazione
  testuale, pulsanti Accetta/Rifiuta ben visibili.

## 10. PWA, installazione e offline

- **Installazione**: apertura URL in Safari iPhone → "Aggiungi a Home" → icona a tutto
  schermo. Nessun Apple ID Developer, nessuna firma, nessun sideload.
- **Offline**: Service Worker cachea l'app shell e le miniature già visualizzate; senza
  rete restano visibili mappa e foto già aperte, ma non è possibile scaricare foto non
  ancora viste (l'album è comunque servito da iCloud, serve rete al primo caricamento).
- **Notifiche push**: fuori scope per ora (richiederebbero configurazione aggiuntiva non
  banale); il conteggio "da posizionare" resta un badge puramente in-app.

## 11. Stack tecnico

| Livello | Scelta | Motivazione |
|---|---|---|
| Frontend | React + Vite + TypeScript, PWA (`vite-plugin-pwa`) | Leggero, installabile su iPhone senza store |
| Mappa | MapLibre GL JS + tile OpenFreeMap | Gratis, nessuna API key, stile personalizzabile |
| Animazioni | Framer Motion | Interazioni a molla/gesture, stile "gioco" |
| Backend | Cloudflare Worker (Hono) | Proxy album iCloud + Gemini + Nominatim, chiavi mai esposte, free tier permanente |
| Database | Supabase (Postgres), free tier | Posizioni foto, cache suggerimenti AI, temi colore città |
| AI | Google Gemini, free tier | Vision (suggerimento posizione) + testo (palette colore città) |
| Geocoding | Nominatim (OpenStreetMap), gratis | Nome città/luogo da coordinate |
| Hosting frontend | Cloudflare Pages, gratis | Stesso ecosistema del Worker |

Tutti i servizi scelti hanno un tier gratuito permanente adatto a un progetto personale a
basso volume (poche migliaia di foto, decine/centinaia di città uniche).

## 12. Fuori scope (per ora)

- Login/accesso completo all'account Apple ID / libreria iCloud intera.
- Notifiche push.
- Supporto multi-album per superare il limite di ~1000 foto dell'Album Condiviso.
- Chat AI generale/esplorativa oltre al suggerimento di posizione (possibile estensione
  futura, non inclusa in questa fase).
- Funzionalità social/condivisione tra utenti: il multi-tenant (§4) isola i dati per
  utente, ma non è prevista alcuna condivisione incrociata di foto/album tra account
  diversi in questa fase.
