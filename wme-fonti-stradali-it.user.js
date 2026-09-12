// ==UserScript==
// @name         WME Fonti Stradali IT
// @namespace    wme-fonti-it
// @version      0.3.0
// @description  Confronta i segmenti del WME con i civici ufficiali ANNCSU (Istat/Agenzia Entrate): evidenzia i segmenti in lista, mostra i civici sulla mappa e compila nome via/contrada, localita, comune e numeri civici. A cura di checcoconf.
// @author       Francesco Conforti (checcoconf)
// @copyright    2026 Francesco Conforti
// @homepageURL  https://github.com/checcoconf/wme-fonti-stradali-it
// @supportURL   https://github.com/checcoconf/wme-fonti-stradali-it/issues
// @updateURL    https://github.com/checcoconf/wme-fonti-stradali-it/releases/latest/download/wme-fonti-stradali-it.meta.js
// @downloadURL  https://github.com/checcoconf/wme-fonti-stradali-it/releases/latest/download/wme-fonti-stradali-it.user.js
// @icon         data:image/svg+xml,%3Csvg%20xmlns%3D%22http://www.w3.org/2000/svg%22%20viewBox%3D%220%200%2048%2048%22%20width%3D%2248%22%20height%3D%2248%22%3E%3Cdefs%3E%3CclipPath%20id%3D%22wfitTile%22%3E%3Crect%20x%3D%222%22%20y%3D%222%22%20width%3D%2244%22%20height%3D%2244%22%20rx%3D%2211%22/%3E%3C/clipPath%3E%3C/defs%3E%3Cg%20clip-path%3D%22url(%23wfitTile)%22%3E%3Crect%20x%3D%222%22%20y%3D%222%22%20width%3D%2214.7%22%20height%3D%2244%22%20fill%3D%22%23009246%22/%3E%3Crect%20x%3D%2216.7%22%20y%3D%222%22%20width%3D%2214.6%22%20height%3D%2244%22%20fill%3D%22%23f7f7f5%22/%3E%3Crect%20x%3D%2231.3%22%20y%3D%222%22%20width%3D%2214.7%22%20height%3D%2244%22%20fill%3D%22%23ce2b37%22/%3E%3Cpath%20d%3D%22M17.5%2046%20L22.6%2011%20L25.4%2011%20L30.5%2046%20Z%22%20fill%3D%22%2323272e%22/%3E%3Cpath%20d%3D%22M23.7%2043.5%20L24%2014.5%22%20stroke%3D%22%23ffd75e%22%20stroke-width%3D%221.7%22%20stroke-dasharray%3D%223.4%202.8%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22/%3E%3Ccircle%20cx%3D%2224%22%20cy%3D%229.4%22%20r%3D%224.1%22%20fill%3D%22%23ffd75e%22%20stroke%3D%22%2323272e%22%20stroke-width%3D%221.6%22/%3E%3Ccircle%20cx%3D%2224%22%20cy%3D%229.4%22%20r%3D%221.4%22%20fill%3D%22%2323272e%22/%3E%3C/g%3E%3Crect%20x%3D%222%22%20y%3D%222%22%20width%3D%2244%22%20height%3D%2244%22%20rx%3D%2211%22%20fill%3D%22none%22%20stroke%3D%22%231d2127%22%20stroke-width%3D%222.2%22/%3E%3C/svg%3E
// @match        https://www.waze.com/editor*
// @match        https://www.waze.com/*/editor*
// @match        https://beta.waze.com/editor*
// @match        https://beta.waze.com/*/editor*
// @exclude      https://www.waze.com/user/editor*
// @exclude      https://www.waze.com/editor/sdk/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @grant        GM_getResourceText
// @resource     comuni       https://raw.githubusercontent.com/checcoconf/wme-fonti-stradali-it/main/data/comuni.json
// @resource     odonimi      https://raw.githubusercontent.com/checcoconf/wme-fonti-stradali-it/main/data/odonimi.json
// @connect      anncsu.open.agenziaentrate.gov.it
// @connect      www.istat.it
// @connect      istat.it
// @connect      raw.githubusercontent.com
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @run-at       document-end
// @license      GPL-3.0-or-later; https://www.gnu.org/licenses/gpl-3.0.txt
// ==/UserScript==

/* global getWmeSdk, GM_xmlhttpRequest, GM_getResourceText, GM_info */

/*
 * WME Fonti Stradali IT
 * Copyright (C) 2026 Francesco Conforti (checcoconf)
 *
 * Questo programma e' software libero: puoi ridistribuirlo e/o modificarlo secondo i termini
 * della GNU General Public License come pubblicata dalla Free Software Foundation, nella
 * versione 3 della licenza o (a tua scelta) in una qualsiasi versione successiva.
 *
 * Il programma e' distribuito nella speranza che sia utile, ma SENZA ALCUNA GARANZIA, senza
 * neppure la garanzia implicita di COMMERCIABILITA' o IDONEITA' A UNO SCOPO PARTICOLARE.
 * Vedi la GNU General Public License per i dettagli: https://www.gnu.org/licenses/gpl-3.0.txt
 *
 * Se modifichi e ridistribuisci questo script devi: conservare questa nota di copyright,
 * indicare in modo evidente che si tratta di una versione modificata e da chi, pubblicare il
 * codice della tua versione con la stessa licenza, e usare un NOME DIVERSO dall'originale
 * ("WME Fonti Stradali IT" identifica il progetto dell'autore, non i lavori derivati).
 *
 * Dati ANNCSU (Istat / Agenzia delle Entrate): open data con licenza CC-BY 4.0.
 */

(function () {
    'use strict';

    /* Ambito rispetto alle "Guidelines for Bulk Editing Scripts" (Waze, Official Announcements)
       - Nomi di via/contrada, localita' e comune: rientra in "Map Maintenance & Integrity >
         Naming Checks" (validazione e standardizzazione dei nomi dei segmenti).
       - Numeri civici da ANNCSU: rientra in "Mass Address Imports", che le linee guida
         ammettono nelle regioni indicate e SOLO con fonte approvata. Per l'Italia serve
         quindi il via libera di Waze staff sulla fonte prima di usarlo su larga scala:
         finche' non c'e', usare la parte civici solo su casi puntuali e concordati.
       - Nessun edit farming: lo script scrive solo cio' che differisce dal dato ufficiale,
         salta cio' che e' gia' a posto e non salva mai da solo. Non ci sono soglie sul numero
         di oggetti per operazione: le linee guida non le impongono e la revisione dell'elenco
         prima del salvataggio resta in mano all'editor.
       - Trasparenza: codice pubblico su GitHub (vedi @homepageURL). */
    const SCRIPT_ID = 'wme-fonti-it';
    const SCRIPT_NAME = 'WME Fonti Stradali IT';
    const AUTORE = 'checcoconf';
    // Contatto Slack dell'autore (workspace della community italiana Waze)
    const SLACK_NICK = 'checcoconf';
    const SLACK_ID = 'U0BHX22AFHS';
    // app_redirect apre direttamente il messaggio diretto con l'autore: nell'app desktop se installata,
    // altrimenti nel browser dopo il login al workspace
    const SLACK_URL = `https://slack.com/app_redirect?channel=${SLACK_ID}`;
    const slackLink = (txt) => `<a class="wfit-slack" href="${SLACK_URL}" target="_blank" rel="noopener noreferrer" title="Apre il messaggio diretto con @${SLACK_NICK} su Slack (community Waze Italia)">${txt || ('@' + SLACK_NICK)}</a>`;
    const VERSION = (typeof GM_info !== 'undefined' && GM_info.script) ? GM_info.script.version : 'dev';
    const STORE_KEY = 'wmeFontiIT_v3';
    const GRID_CELL = 0.004; // ~440 m in latitudine
    const BYTES_PER_CIVICO = 16; // lon(4) + lat(4) + gid(4) + civico(2) + esponente(2)
    const STALE_DAYS = 35; // ANNCSU aggiorna i dataset regionali con cadenza mensile: oltre questa soglia, avviso (mai scarico automatico)
    const ANNCSU_DL = 'https://anncsu.open.agenziaentrate.gov.it/age-inspire/opendata/anncsu/getds.php?INDIR_';
    const ISTAT_COMUNI = 'https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.csv';
    // Licenza degli open data ANNCSU (Istat / Agenzia delle Entrate)
    const LIC_NOME = 'CC-BY 4.0';
    const LIC_URL = 'https://creativecommons.org/licenses/by/4.0/deed.it';
    // Licenza del codice dello script
    const CODE_LIC = 'GPL-3.0-or-later';
    const CODE_LIC_URL = 'https://www.gnu.org/licenses/gpl-3.0.html';
    const AUTORE_FULL = 'Francesco Conforti';
    const codeLicLink = () => `<a class="wfit-lic" href="${CODE_LIC_URL}" target="_blank" rel="noopener noreferrer" title="GNU General Public License v3 o successive: chi modifica e ridistribuisce lo script deve citare l'autore, dichiarare le modifiche e pubblicare il codice con la stessa licenza">${CODE_LIC}</a>`;
    const licLink = (txt) => `<a class="wfit-lic" href="${LIC_URL}" target="_blank" rel="noopener noreferrer" title="Creative Commons Attribuzione 4.0 Internazionale &ndash; testo della licenza">${txt || LIC_NOME}</a>`;
    // Guida completa del progetto (README su GitHub): qui nel pannello c'e' il riassunto,
    // le regole per esteso, gli esempi e la tabella degli errori stanno la'
    const GUIDA_URL = 'https://github.com/checcoconf/wme-fonti-stradali-it/blob/main/README.md';
    const guidaLink = (txt) => `<a class="wfit-lic" href="${GUIDA_URL}" target="_blank" rel="noopener noreferrer" title="Guida completa del progetto su GitHub: regole per esteso, esempi con immagini, tabella degli errori e note per gli editor">${txt || 'guida completa'}</a>`;
    // Sito ufficiale dell'Archivio Nazionale dei Numeri Civici e delle Strade Urbane
    const ANNCSU_URL = 'https://www.anncsu.gov.it/it/';
    const anncsuLink = (txt) => `<a class="wfit-lic" href="${ANNCSU_URL}" target="_blank" rel="noopener noreferrer" title="ANNCSU &ndash; Archivio Nazionale dei Numeri Civici e delle Strade Urbane, sito ufficiale">${txt || 'ANNCSU'}</a>`;

    /* ---------------------------------------------------------------- */
    /* CONFIGURAZIONE ACCESSO (foglio Google + Apps Script)               */
    /* ---------------------------------------------------------------- */
    // 1) Pubblica il Web App di Apps Script (Distribuisci > Nuova distribuzione > Applicazione web,
    //    "Esegui come: me", "Chi ha accesso: chiunque") e incolla qui l'URL che finisce con /exec.
    // 2) Incolla lo STESSO token che hai messo in Proprieta' script su Apps Script (WFIT_TOKEN).
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbyqY5rbcjPdShWcFFmBBc6P-wZmgL0Vn4t4ya_jqwGnR7iO9rVHTZ_f1zfzFj1TDftNSA/exec'; // es. https://script.google.com/macros/s/AKfy.../exec
    const GAS_TOKEN = '1aa4f7f7330e4164bc8cc4ef3a5ea9886892ebc1'; // stringa lunga a caso, uguale a quella su Apps Script

    const AUTH_KEY = 'wmeFontiIT_auth_v1';
    const LOGQ_KEY = 'wmeFontiIT_logq_v1';
    const AUTH_TTL_H = 2;     // ogni quante ore si richiede di nuovo il permesso al foglio
    const AUTH_RECHECK_MIN = 30; // ricontrollo periodico mentre l'editor resta aperto
    const AUTH_GRACE_H = 72;  // se il foglio non risponde, per quante ore vale l'ultimo "autorizzato"
    // Apps Script parte a freddo e ci mette il suo: 20 secondi erano troppo pochi e
    // facevano scadere la verifica a gente perfettamente abilitata.
    const GAS_TIMEOUT_MS = 40000;
    const GAS_TENTATIVI = 2;      // un secondo tentativo se cade la rete o scade il tempo
    const GAS_ATTESA_MS = 2500;   // pausa fra un tentativo e l'altro
    const LOG_MAX_QUEUE = 2000;

    const REGIONI = [
        ['ABRU', 'Abruzzo'], ['BASI', 'Basilicata'], ['CALA', 'Calabria'], ['CAMP', 'Campania'],
        ['EMIL', 'Emilia-Romagna'], ['FRIU', 'Friuli-Venezia Giulia'], ['LAZI', 'Lazio'], ['LIGU', 'Liguria'],
        ['LOMB', 'Lombardia'], ['MARC', 'Marche'], ['MOLI', 'Molise'], ['PIEM', 'Piemonte'],
        ['PUGL', 'Puglia'], ['SARD', 'Sardegna'], ['SICI', 'Sicilia'], ['TOSC', 'Toscana'],
        ['TREN', 'Trentino-Alto Adige'], ['UMBR', 'Umbria'], ['VALL', "Valle d'Aosta"], ['VENE', 'Veneto']
    ];
    const regNome = code => (REGIONI.find(r => r[0] === code) || [code, code])[1];
    // Due livelli: i pallini dei civici (cliccabili: il clic evidenzia la riga nell'elenco) e
    // l'evidenziazione dei segmenti in lista, che NON deve mai intercettare i clic: sotto c'e'
    // il segmento del WME, e ALT+clic deve arrivarci per toglierlo dalla lista.
    const LAYER = 'wfit-civici';
    const LAYER_HL = 'wfit-segmenti';
    const PALETTE = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#9a6324'];
    // Elenchi e regole stanno in file JSON dentro il repo (cartella data/), non incollati
    // qui dentro: sono dati, restano leggibili e correggibili senza rimettere mano al codice.
    // Tampermonkey li scarica una volta sola con lo script (@resource); se la risorsa manca
    // si passa alla copia in IndexedDB e poi alla rete.
    const DATA_BASE = 'https://raw.githubusercontent.com/checcoconf/wme-fonti-stradali-it/main/data/';
    const COMUNI_URL = DATA_BASE + 'comuni.json';
    const ODONIMI_URL = DATA_BASE + 'odonimi.json';

    /* ------------------------------------------------------------------ */
    /* Stato                                                               */
    /* ------------------------------------------------------------------ */

    let sdk = null;
    let ui = {};
    // Indice compatto in memoria (tutte le regioni caricate, unite)
    let mem = { n: 0, lons: new Float32Array(0), lats: new Float32Array(0), gids: new Uint32Array(0), civn: new Uint16Array(0), cive: new Uint16Array(0), esps: [''], groups: [] };
    let grid = new Map();             // "gx_gy" -> array di indici civico
    let belNome = new Map();          // Belfiore -> nome comune (da ISTAT)
    let captured = new Map();         // segmentId -> {coords:[[lon,lat],...]}
    let lastFailedIds = new Set();    // segmenti su cui l'ultimo Applica e' fallito
    let lastResults = [];
    let lastHNScan = { hn: 0, segs: 0, rpp: 0, ok: true, come: '' }; // ultima lettura dei civici gia' su Waze
    // Civici inseriti dallo script in questa sessione: finche' non salvi, il WME puo' non
    // restituirli, e senza questa memoria tornerebbero nell'elenco come se mancassero.
    let civiciInseriti = [];
    let lastPtsByG = new Map();       // gid -> [{lon,lat,label,d}] civici agganciati (deduplicati)
    let lastDotFeatures = [];         // ultime feature disegnate (per riaccendere la spunta al volo)
    const dotIndex = new Map();       // id della feature -> { g, p }: serve al clic sul pallino
    let lastDupCount = 0;             // doppioni civici scartati nell'ultimo confronto
    let analyzeTimer = null;
    let busy = false;
    let authInfo = { ok: false, user: '', reason: '', code: 401 };
    let panelEl = null;
    let batchRunning = false;         // ciclo su piu' regioni in corso
    let abortBatch = false;           // richiesta di fermarsi dopo la regione in corso

    /* ------------------------------------------------------------------ */
    /* Utilita' di base                                                    */
    /* ------------------------------------------------------------------ */

    // Codici dei tasti modificatori: non sono ammessi come tasto di cattura personalizzato.
    // Sta qui in alto perche' normKeyChoice() la usa gia' durante la lettura delle impostazioni.
    const MOD_CODES = /^(Alt|Shift|Control|Meta|OS)(Left|Right)?$/;

    // Plurale italiano: pl(1,'civico','civici') -> 'civico'
    const pl = (n, uno, molti) => (n === 1 ? uno : molti);
    // Conteggio per motivo, usato nei riepiloghi di fine operazione
    const bump = (obj, key, n = 1) => { obj[key] = (obj[key] || 0) + n; };
    const tick = () => new Promise(r => setTimeout(r, 0));
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    /* ------------------------------------------------------------------ */
    /* Impostazioni                                                        */
    /* ------------------------------------------------------------------ */

    // Dimensioni dei pallini dei civici sulla mappa: raggio del punto, corpo del numero e
    // distanza dell'etichetta dal punto. 'normale' e' esattamente quello che lo script ha
    // sempre disegnato: chi non tocca nulla continua a vedere la mappa di prima.
    const DOT_SIZES = {
        piccoli:  { label: 'Piccoli',      r: 3.5, f: 9,  y: 10 },
        normale:  { label: 'Normali',      r: 5,   f: 10, y: 12 },
        grandi:   { label: 'Grandi',       r: 7,   f: 13, y: 16 },
        maxi:     { label: 'Molto grandi', r: 9,   f: 16, y: 20 },
        enormi:   { label: 'Enormi',       r: 12,  f: 20, y: 25 }
    };
    const dotSize = () => DOT_SIZES[settings.dotSize] || DOT_SIZES.normale;

    const RAGGIO_MAX = 50;   // oltre i 45 m Waze rifiuta i civici: un raggio piu' largo non serve

    const DEFAULT_SETTINGS = {
        raggio: 10, titleCase: true, captureMode: 'alt', applyMode: 'extra', zonaSoloMie: true,
        autoAnalyze: true, showDots: true, dotSize: 'normale', hlColor: '#00e5ff', captureKey: null
    };

    // Riporta al formato attuale le impostazioni salvate dalle versioni precedenti e
    // ripara i valori rovinati: qui dentro sta TUTTA la retrocompatibilita'.
    function migrateSettings(s) {
        if (!Array.isArray(s.nameRules)) s.nameRules = [];
        if (!/^#[0-9a-f]{6}$/i.test(s.hlColor || '')) s.hlColor = '#00e5ff';
        // Tasto personalizzato: se il salvataggio e' rovinato o mancante si torna ad ALT (default di sempre)
        if (s.captureKey && typeof s.captureKey !== 'object') s.captureKey = null;
        // porta al formato attuale anche i tasti salvati dalla versione precedente (un tasto solo)
        s.captureKey = normKeyChoice(s.captureKey);
        if (s.captureMode === 'custom' && !s.captureKey) s.captureMode = 'alt';
        if (!s.applyMode) s.applyMode = 'extra';
        // civici in un formato che Waze non accetta (20/1, 12/BIS): 'nonins' (predefinito: restano
        // in lista, senza spunta) o 'escludi' (fuori dalla lista). Dalla 0.2.2 non esiste piu'
        // 'includi': Waze accetta solo numeri seguiti da al massimo due lettere minuscole.
        if (!['nonins', 'escludi'].includes(s.suspMode)) s.suspMode = 'nonins';
        // Raggio: dalla 0.1.5 si parte da 10 m e il massimo scende a 1000 m. Chi aveva ancora
        // il vecchio predefinito (150) passa al nuovo, una volta sola: da li' in poi vale
        // sempre la tua scelta, anche se torni a 150.
        if (!s.raggioV2) { if (!(s.raggio > 0) || s.raggio === 150) s.raggio = DEFAULT_SETTINGS.raggio; s.raggioV2 = 1; }
        // Dalla 0.3.0 il massimo e' 50 m: oltre i 45 Waze rifiuta i civici, quindi un raggio
        // piu' largo gonfiava solo i risultati. I valori salvati piu' grandi scendono a 50.
        s.raggio = Math.min(RAGGIO_MAX, Math.max(1, parseInt(s.raggio, 10) || DEFAULT_SETTINGS.raggio));
        s.zonaSoloMie = s.zonaSoloMie !== false;
        // Dimensione dei pallini sulla mappa: se il valore salvato non esiste piu', si torna a 'normale'
        if (!DOT_SIZES[s.dotSize]) s.dotSize = 'normale';
        return s;
    }

    const settings = migrateSettings(Object.assign(
        {}, DEFAULT_SETTINGS,
        (() => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch { return {}; } })()
    ));
    const saveSettings = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch { /* ignora */ } };
    const log = (...a) => console.log(`${SCRIPT_NAME}:`, ...a);

    /* ------------------------------------------------------------------ */
    /* IndexedDB                                                           */
    /* ------------------------------------------------------------------ */

    let dbPromise = null;
    function db() {
        if (!dbPromise) {
            dbPromise = new Promise((res, rej) => {
                const q = indexedDB.open('wfit-db', 2);
                q.onupgradeneeded = e => {
                    const d = e.target.result;
                    if (!d.objectStoreNames.contains('regioni')) d.createObjectStore('regioni', { keyPath: 'reg' });
                    if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'k' });
                };
                q.onsuccess = e => res(e.target.result);
                q.onerror = () => rej(q.error);
            });
        }
        return dbPromise;
    }
    // Una sola transazione generica: le operazioni cambiano solo per la richiesta interna
    async function idbTx(store, mode, run) {
        const d = await db();
        return new Promise((res, rej) => {
            const t = d.transaction(store, mode);
            const q = run(t.objectStore(store));
            t.oncomplete = () => res(q ? q.result : undefined);
            t.onerror = () => rej(t.error);
        });
    }
    const idb = {
        put: (store, val) => idbTx(store, 'readwrite', o => { o.put(val); }),
        get: (store, key) => idbTx(store, 'readonly', o => o.get(key)),
        all: async store => (await idbTx(store, 'readonly', o => o.getAll())) || [],
        clear: store => idbTx(store, 'readwrite', o => { o.clear(); })
    };

    /* ------------------------------------------------------------------ */
    /* Autorizzazione e log (foglio Google tramite Apps Script)            */
    /* ------------------------------------------------------------------ */

    // Id di sessione: serve solo a raggruppare nel foglio le righe di log di una stessa
    // sessione di lavoro (non identifica nulla di piu' del nome utente WME, gia' pubblico).
    const SESSION_ID = Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

    // Copia-incolla tollerante: spazi, a capo, barra finale e ?query vengono tolti da soli
    const gasUrl = () => String(GAS_URL || '').trim().replace(/[?#].*$/, '').replace(/\/+$/, '');
    const gasToken = () => String(GAS_TOKEN || '').trim();
    const gasConfigured = () => /^https:\/\/script\.google\.com\/macros\/s\/[^\s]+\/exec$/.test(gasUrl());

    // Perche' la configurazione non va bene: messaggio che dice cosa ha letto davvero lo script
    function gasConfigProblema() {
        const u = gasUrl();
        if (!u || /^INCOLLA/i.test(u)) return 'la riga GAS_URL e\' ancora quella di esempio: apri lo script in Tampermonkey e incolla l\'indirizzo che finisce con /exec.';
        if (/\/dev$/.test(u)) return 'hai incollato l\'indirizzo di prova (/dev): serve quello della distribuzione, che finisce con /exec.';
        if (!/^https:\/\/script\.google\.com\//.test(u)) return `l'indirizzo non e' quello di un web app Apps Script (letto: ${u.slice(0, 60)}).`;
        if (!/\/exec$/.test(u)) return `l'indirizzo non finisce con /exec (letto: ${u.slice(0, 60)}\u2026).`;
        return `indirizzo non riconosciuto (letto: ${u.slice(0, 60)}\u2026).`;
    }

    // Un guasto di rete non e' un rifiuto: lo marchiamo per poterlo distinguere piu' avanti
    // e per sapere quando ha senso riprovare.
    function erroreRete(msg) { const e = new Error(msg); e.rete = true; return e; }

    // Chiamata al Web App. Content-Type text/plain: Apps Script lo accetta e non scatena
    // preflight; il corpo resta comunque JSON.
    function gasCall(payload, timeoutMs = GAS_TIMEOUT_MS) {
        return new Promise((resolve, reject) => {
            if (!gasConfigured()) { reject(new Error('web app non configurato')); return; }
            try {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: gasUrl(),
                    timeout: timeoutMs,
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    data: JSON.stringify(Object.assign({ token: gasToken(), client: VERSION }, payload)),
                    onload: r => {
                        if (r.status < 200 || r.status >= 300) { reject(new Error('HTTP ' + r.status)); return; }
                        let j = null;
                        try { j = JSON.parse(r.responseText); }
                        catch { reject(new Error('risposta non leggibile dal foglio')); return; }
                        resolve(j);
                    },
                    onerror: () => reject(erroreRete('rete non raggiungibile')),
                    ontimeout: () => reject(erroreRete('nessuna risposta entro il tempo massimo'))
                });
            } catch (e) { reject(e); }
        });
    }

    // Solo per la verifica dell'abilitazione: se cade la rete o scade il tempo si riprova
    // una volta. Sui log non si riprova, altrimenti si rischiano righe doppie sul foglio.
    async function gasCallRipetuta(payload) {
        let ultimo = null;
        for (let i = 1; i <= GAS_TENTATIVI; i++) {
            try { return await gasCall(payload); }
            catch (e) {
                ultimo = e;
                if (!e.rete || i === GAS_TENTATIVI) break;
                log(`foglio non raggiungibile (${e.message}): riprovo fra ${Math.round(GAS_ATTESA_MS / 1000)}s`);
                await sleep(GAS_ATTESA_MS);
            }
        }
        throw ultimo;
    }

    // Tutto quello che lo script chiede all'SDK ufficiale del WME, con il perche'.
    // Le versioni del WME non espongono sempre le stesse cose: all'avvio si controlla una per
    // una e si scrive nel log cosa manca, cosi' un buco si vede subito (wfitDiag).
    const SDK_NEEDS = [
        ['State.getUserInfo', 'nome utente e livello', true],
        ['Events.on', 'eventi (selezione, salvataggio)', true],
        ['Sidebar.registerScriptTab', 'pannello nella barra laterale', true],
        ['DataModel.Segments.getById', 'geometria e indirizzo dei segmenti', true],
        ['DataModel.Segments.getAll', 'segmenti caricati (tutta la via, accessi)', true],
        ['DataModel.Segments.getAddress', 'indirizzo attuale del segmento', true],
        ['DataModel.Segments.updateAddress', 'Applica ai segmenti', true],
        ['DataModel.Segments.addAlternateStreet', 'nome alternativo', false],
        ['DataModel.Segments.updateSegment', 'obbligo fari accesi', false],
        ['DataModel.Venues.addVenue', 'creazione dei luoghi residenziali (RPP)', false],
        ['DataModel.Venues.updateAddress', 'via e civico dell\'RPP', false],
        ['DataModel.Venues.updateVenueIsResidential', 'RPP contrassegnato come residenziale', false],
        ['DataModel.Venues.replaceNavigationPoints', 'punto di arrivo dell\'RPP', false],
        ['DataModel.Streets.getStreet', 'trova la via', true],
        ['DataModel.Streets.addStreet', 'crea la via', true],
        ['DataModel.Streets.getById', 'nome della via (sigle, riepiloghi)', true],
        ['DataModel.Cities.getAll', 'citta\' e citta\' vuota "Nessuno"', true],
        ['DataModel.Cities.getById', 'nome della citta\'', false],
        ['DataModel.HouseNumbers.addHouseNumber', 'inserimento dei civici', true],
        ['DataModel.HouseNumbers.getHouseNumbers', 'civici gia\' su Waze (doppioni)', true],
        ['DataModel.Venues.getAll', 'luoghi residenziali (RPP)', false],
        ['DataModel.Venues.getAddress', 'indirizzo dei luoghi residenziali', false],
        ['Editing.getSelection', 'cattura dei segmenti', true],
        ['Editing.clearSelection', 'chiusura del pannello del segmento', false],
        ['Editing.setSelection', 'selezione dal pannello (e deselezione di riserva)', false],
        ['Editing.getUnsavedChangesCount', 'blocco civici con modifiche non salvate', true],
        ['Editing.isEditingAllowed', 'blocco in sola lettura', false],
        ['Editing.isSnapshotModeOn', 'blocco in modalit\u00e0 snapshot', false],
        ['Editing.isPracticeModeOn', 'blocco in modalit\u00e0 pratica', false],
        ['Map.addLayer', 'civici ed evidenziazione sulla mappa', true],
        ['Map.addFeaturesToLayer', 'disegno dei civici', true],
        ['Map.removeAllFeaturesFromLayer', 'pulizia della mappa', true],
        ['Map.setMapCenter', 'centratura sui civici', true],
        ['Map.getMapCenter', '"+ Aggiungi al centro mappa"', true],
        ['Map.getMapExtent', 'controllo della zona a schermo', false],
        ['Map.setZoomLevel', 'zoom automatico del controllo zona', false],
        ['Events.off', 'aggiornamento automatico del controllo zona', false],
        ['Map.getZoomLevel', 'controllo della zona a schermo', false],
        ['Map.setLayerZIndex', 'civici sopra gli altri evidenziatori', false],
        ['Map.getLayerZIndex', 'civici sopra gli altri evidenziatori', false],
        ['Map.setLayerVisibility', 'livello acceso', false],
        ['Events.trackLayerEvents', 'clic sui pallini', false],
        ['Events.stopLayerEventsTracking', 'clic sui pallini solo a elenco aperto', false],
        ['StreetView.open', 'bottone Street View', false],
        ['Shortcuts.createShortcut', 'scorciatoia da tastiera', false]
    ];
    let sdkMancanti = [];

    function sdkHas(path) {
        try {
            let o = sdk;
            const parts = path.split('.');
            for (const k of parts.slice(0, -1)) { o = o && o[k]; if (!o) return false; }
            return typeof o[parts[parts.length - 1]] === 'function';
        } catch { return false; }
    }

    // Autotest: elenca cosa manca e quali funzioni ne risentono
    function sdkSelfTest() {
        sdkMancanti = SDK_NEEDS.filter(([path]) => !sdkHas(path))
            .map(([path, a_che_serve, essenziale]) => ({ metodo: path, a_che_serve, essenziale }));
        if (!sdkMancanti.length) { log(`autotest SDK: tutti i ${SDK_NEEDS.length} metodi richiesti sono presenti`); return; }
        const gravi = sdkMancanti.filter(m => m.essenziale);
        log(`autotest SDK: ${sdkMancanti.length} metodi mancanti su ${SDK_NEEDS.length}`, sdkMancanti);
        if (gravi.length) {
            toast('Questa versione del WME non espone ' + gravi.length + ' ' + pl(gravi.length, 'funzione necessaria', 'funzioni necessarie') +
                ' allo script (' + gravi.map(m => m.a_che_serve).join('; ') + '). Scrivi wfitDiag() nella console e mandami il risultato.', 15000);
        }
    }

    // Nome utente WME dall'SDK (UserSession). L'SDK non espone piu' l'id numerico
    // dell'utente (dato personale): nel foglio il campo id resta vuoto.
    function currentUser() {
        const out = { name: '', rank: null, id: null };
        try {
            const i = sdk.State.getUserInfo();
            if (i) { out.name = i.userName || ''; out.rank = i.rank != null ? i.rank : null; }
        } catch { /* utente non ancora disponibile */ }
        return out;
    }

    // Il WME conta i rank da zero: rank 0 = L1, rank 1 = L2... Nei fogli scriviamo il
    // livello come lo legge l'editor, non il numero interno.
    const livelloDaRank = r => (r == null || r === '' || isNaN(r)) ? '' : Number(r) + 1;

    function readAuthCache(user) {
        try {
            const c = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
            if (!c || c.user !== user) return null;
            return c;
        } catch { return null; }
    }
    function writeAuthCache(c) { try { localStorage.setItem(AUTH_KEY, JSON.stringify(c)); } catch { /* ignora */ } }
    function clearAuthCache() { try { localStorage.removeItem(AUTH_KEY); } catch { /* ignora */ } }

    // Esiti possibili, da tenere ben separati:
    //   ok: true    si lavora (eventualmente in tolleranza, se il foglio tace ma la cache regge)
    //   code 401    il foglio ha risposto e ha detto di no: serve l'abilitazione
    //   code 503    il foglio non ha risposto: non ne sappiamo niente, non e' colpa dell'utente
    //   code 500    lo script e' configurato male: problema dell'autore, non dell'editor
    async function checkAuthorization(force) {
        const u = currentUser();
        if (!u.name) return { ok: false, code: 503, user: '', reason: 'non riesco a leggere il tuo nome utente Waze: ricarica l\'editor e riprova.' };
        if (!gasConfigured()) {
            return { ok: false, code: 500, user: u.name, reason: gasConfigProblema() };
        }
        if (!gasToken() || /^INCOLLA/i.test(gasToken())) {
            return { ok: false, code: 500, user: u.name, reason: 'la riga GAS_TOKEN e\' ancora quella di esempio: incolla il token stampato da setup() sul foglio.' };
        }
        const cached = readAuthCache(u.name);
        if (!force && cached && cached.ok && Date.now() - cached.ts < AUTH_TTL_H * 3600000) {
            return { ok: true, user: u.name, ruolo: cached.ruolo, nota: cached.nota };
        }
        try {
            const r = await gasCallRipetuta({ action: 'auth', user: u.name, rank: u.rank, livello: livelloDaRank(u.rank), userId: u.id, sessione: SESSION_ID });
            const ok = !!(r && r.ok && r.autorizzato);
            writeAuthCache({ user: u.name, ok, ts: Date.now(), ruolo: r && r.ruolo, nota: r && r.nota });
            if (ok) return { ok: true, user: u.name, ruolo: r.ruolo, nota: r.nota };
            return { ok: false, code: 401, user: u.name, reason: (r && (r.messaggio || r.motivo)) || 'utente non presente nell\'elenco degli abilitati.' };
        } catch (e) {
            // Il foglio non risponde: se poco fa eri abilitato si continua per un periodo di
            // tolleranza. Scaduta quella si chiude, ma dicendo la verita': non sappiamo,
            // non "non sei abilitato".
            if (cached && cached.ok && Date.now() - cached.ts < AUTH_GRACE_H * 3600000) {
                return { ok: true, user: u.name, ruolo: cached.ruolo, offline: true, reason: e.message };
            }
            return { ok: false, code: 503, user: u.name, reason: e.message };
        }
    }

    // Un timeout non e' un rifiuto: chi non e' stato verificato non va mandato dai
    // coordinatori, perche' loro non possono farci niente.
    function bloccoHtml(info) {
        const code = info.code || 503;
        const testa = `
  <div class="wfit-head">${logoSvg(30, 8)}<div><div class="t">${SCRIPT_NAME}</div><div class="by">Civici e odonimi ufficiali ANNCSU &middot; a cura di ${AUTORE}</div></div><span class="wfit-ver">v${VERSION}</span></div>`;
        const utente = `<p><b>Utente Waze:</b> ${escapeHtml(info.user || 'sconosciuto')}</p>`;
        const dettaglio = info.reason ? `<p class="wfit-muted">Dettaglio: ${escapeHtml(info.reason)}</p>` : '';

        if (code === 401) {
            return testa + `
  <div class="wfit-sec wfit-bloc wfit-bloc-no">
    <div class="wfit-bloccode">Abilitazione non presente</div>
    ${utente}
    <p>Questo script &egrave; riservato agli editor abilitati, e il tuo nome non risulta nell'elenco.</p>
    ${dettaglio}
    <div class="wfit-row">
      <button class="wfit-btn wfit-primary" id="wfit-auth-retry">Ho ricevuto l'abilitazione: ricontrolla</button>
    </div>
    <p class="wfit-muted">Per l'abilitazione scrivi ai coordinatori della community italiana o all'autore ${slackLink()}.</p>
  </div>`;
        }
        if (code === 500) {
            return testa + `
  <div class="wfit-sec wfit-bloc wfit-bloc-no">
    <div class="wfit-bloccode">Script configurato male</div>
    ${utente}
    <p>Non &egrave; un problema tuo n&eacute; della tua abilitazione: manca o &egrave; sbagliata una riga di configurazione dello script.</p>
    ${dettaglio}
    <p class="wfit-muted">Segnalalo all'autore ${slackLink()}: i coordinatori non possono risolverlo.</p>
  </div>`;
        }
        return testa + `
  <div class="wfit-sec wfit-bloc wfit-bloc-forse">
    <div class="wfit-bloccode">Verifica non riuscita</div>
    ${utente}
    <p>Non sono riuscito a raggiungere il foglio delle abilitazioni, quindi <b>non so</b> se sei abilitato: non &egrave; detto che tu non lo sia.</p>
    ${dettaglio}
    <p>Di solito &egrave; passeggero. Riprova fra qualche minuto, o ricarica il WME.</p>
    <div class="wfit-row">
      <button class="wfit-btn wfit-primary" id="wfit-auth-retry">Riprova</button>
    </div>
    <p class="wfit-muted">Se va avanti per ore, segnalalo all'autore ${slackLink()}: scrivere ai coordinatori non serve, l'elenco non c'entra.</p>`
            + `</div>`;
    }

    function renderBlocked(info) {
        if (!panelEl) return;
        panelEl.innerHTML = bloccoHtml(info);
        const b = panelEl.querySelector('#wfit-auth-retry');
        if (b) b.addEventListener('click', async () => {
            b.disabled = true; b.textContent = 'Controllo in corso\u2026';
            // La cache si butta solo dopo un no esplicito: se e' stato un guasto di rete
            // quella copia e' l'unica cosa che tiene in piedi la tolleranza.
            if (info.code === 401) clearAuthCache();
            const r = await checkAuthorization(true);
            if (r.ok) { authInfo = r; startFeatures(); }
            else { renderBlocked(r); }
        });
        log(`bloccato (${info.code || 503}):`, info.reason);
    }

    /* ------------------- permalink e segmento di un punto ------------------- */

    // Ambiente dell'editor (row / usa / il): si legge dall'indirizzo, non si indovina
    function wmeEnv() {
        try { return new URL(location.href).searchParams.get('env') || 'row'; }
        catch { return 'row'; }
    }

    // Permalink nella forma usata dal WME, con il segmento gia' selezionato:
    // https://www.waze.com/it/editor?env=row&lat=..&lon=..&zoomLevel=19&segments=..
    function permalink(lon, lat, segId, zoom = 19) {
        if (lon == null || lat == null) return '';
        try {
            const base = location.origin + location.pathname.replace(/\/+$/, '');
            let u = `${base}?env=${wmeEnv()}&lat=${Number(lat).toFixed(5)}&lon=${Number(lon).toFixed(5)}&zoomLevel=${zoom}`;
            if (segId != null && segId !== '') u += `&segments=${segId}`;
            return u;
        } catch { return ''; }
    }

    // Segmenti candidati per capire a quale strada e' finito un civico: prima quelli
    // caricati nell'editor, in mancanza quelli che hai in lista. Si calcola una volta
    // per lotto, non a ogni civico.
    let segsPerLog = null;
    function resetSegsPerLog() { segsPerLog = null; }
    function segmentoDelPunto(lon, lat) {
        try {
            if (!segsPerLog) {
                segsPerLog = loadedSegmentGeometries();
                if (!segsPerLog || !segsPerLog.length) {
                    segsPerLog = [...captured.entries()]
                        .filter(([, v]) => v && v.coords && v.coords.length > 1)
                        .map(([id, v]) => ({ id, c: v.coords }));
                }
            }
            return nearestLoadedSegment(segsPerLog, lon, lat);
        } catch { return null; }
    }

    /* ---------------------------- coda dei log ---------------------------- */

    let logQueue = [];
    let logFlushTimer = null, logFlushing = false;

    // Righe che descrivono una modifica alla mappa: restano qui finche' l'editor non salva.
    // Solo in memoria: se ricarichi la pagina senza salvare, le modifiche non esistono piu'
    // e le loro righe se ne vanno con loro.
    let pendingLog = [];
    let lastUndoAt = 0, saveEventSeen = false, saveTracking = true;
    let saveWay = '', lastUnsaved = 0, saveWatch = null;
    const PENDING_MAX_MIN = 10;   // oltre questo, una riga in attesa viene scritta comunque

    function loadLogQueue() {
        try { const a = JSON.parse(localStorage.getItem(LOGQ_KEY) || '[]'); if (Array.isArray(a)) logQueue = a; }
        catch { logQueue = []; }
    }
    function saveLogQueue() {
        try { localStorage.setItem(LOGQ_KEY, JSON.stringify(logQueue.slice(-LOG_MAX_QUEUE))); } catch { /* ignora */ }
    }

    // Una riga di log. I campi vengono mappati sulle colonne dal lato Google:
    // aggiungere una chiave qui e la colonna nel foglio basta, l'ordine non conta.
    function logEvent(azione, extra) {
        if (!authInfo.ok) return;
        const u = authInfo.user || '';
        const riga = Object.assign({
            ts: new Date().toISOString(),
            utente: u,
            livello: livelloDaRank(authInfo.rank),
            versione: VERSION,
            sessione: SESSION_ID,
            azione
        }, extra || {});

        // Nel registro finisce SOLO cio' che cambia davvero la mappa e viene salvato.
        // Errori, duplicati, "gia' a posto" e scarichi di dati non lasciano traccia: li
        // vedi nel riepilogo a schermo, non nell'archivio permanente.
        const modificaMappa = riga.esito === 'modificato' || riga.esito === 'inserito';
        if (!modificaMappa) return;
        if (saveTracking) {
            pendingLog.push(riga);
            if (pendingLog.length > LOG_MAX_QUEUE) pendingLog.splice(0, pendingLog.length - LOG_MAX_QUEUE);
            avviaSaveWatch();
        } else {
            riga.motivo = (riga.motivo ? riga.motivo + ' \u00b7 ' : '') + 'salvataggio non verificabile su questo editor';
            enqueueLog(riga);
        }
    }

    // Una riga vera e propria della coda di invio
    function enqueueLog(riga) {
        logQueue.push(riga);
        if (logQueue.length > LOG_MAX_QUEUE) logQueue.splice(0, logQueue.length - LOG_MAX_QUEUE);
        saveLogQueue();
        scheduleLogFlush(3000);
    }

    /* ------------------ aggancio al salvataggio del WME ------------------ */

    // Eventi ufficiali dell'SDK: 'wme-save-finished' dice se il salvataggio e' riuscito,
    // 'wme-no-edits' scatta quando non resta piu' nulla da salvare o da annullare (dopo un
    // salvataggio o dopo l'ultimo annullamento). Niente piu' controllo a tempo del contatore.
    // Eventi ufficiali PIU' un controllo di riserva sul contatore delle modifiche: se su
    // qualche versione del WME l'evento non arriva, le righe finirebbero nel limbo e il
    // registro resterebbe vuoto senza che nessuno se ne accorga.
    function initSaveTracking() {
        let agganciati = 0;
        const on = (eventName, eventHandler) => {
            try { sdk.Events.on({ eventName, eventHandler }); agganciati++; }
            catch (e) { log('evento', eventName, 'non disponibile', e); }
        };
        on('wme-save-finished', p => onSaveEvent(p));
        on('wme-after-undo', () => { lastUndoAt = Date.now(); });
        on('wme-no-edits', onNoEdits);
        const n = unsavedCount();
        const contatoreOk = n !== null;
        lastUnsaved = n || 0;
        saveTracking = agganciati > 0 || contatoreOk;
        if (!saveTracking) {
            log('salvataggi non rilevabili: le righe verranno scritte subito, con nota');
            return;
        }
        log(`salvataggi seguiti \u00b7 eventi SDK: ${agganciati}/3 \u00b7 contatore modifiche: ${contatoreOk ? 'ok' : 'non disponibile'}`);
    }

    // Il controllo gira SOLO quando c'e' qualcosa in attesa: a riposo non costa nulla.
    function avviaSaveWatch() {
        if (saveWatch || !saveTracking) return;
        saveWatch = setInterval(controllaSalvataggio, 2000);
    }
    function fermaSaveWatch() {
        if (!saveWatch) return;
        clearInterval(saveWatch);
        saveWatch = null;
    }

    // Il contatore delle modifiche torna a zero: o hai salvato, o hai annullato tutto.
    function controllaSalvataggio() {
        if (!pendingLog.length) { fermaSaveWatch(); return; }
        const n = unsavedCount();
        if (n != null) {
            if (lastUnsaved > 0 && n === 0) {
                if (Date.now() - lastUndoAt < 4000) scartaPending();
                else promuoviPending('', 'contatore modifiche');
            }
            lastUnsaved = n;
        }
        scadenzaPending();
    }

    // Rete di sicurezza: se il salvataggio non si riesce proprio a rilevare, dopo
    // PENDING_MAX_MIN le righe vengono scritte lo stesso, dicendo che non e' stato verificato.
    // Meglio una riga con la nota che nessuna riga.
    function scadenzaPending() {
        if (!pendingLog.length || saveWay) return;   // se sappiamo rilevare i salvataggi si aspetta
        const limite = Date.now() - PENDING_MAX_MIN * 60000;
        const scadute = pendingLog.filter(r => Date.parse(r.ts) < limite);
        if (!scadute.length) return;
        pendingLog = pendingLog.filter(r => Date.parse(r.ts) >= limite);
        for (const r of scadute) {
            r.motivo = (r.motivo ? r.motivo + ' \u00b7 ' : '') + 'salvataggio non verificato';
            enqueueLog(r);
        }
        log(`${scadute.length} ${pl(scadute.length, 'riga scritta', 'righe scritte')} senza conferma di salvataggio`);
        aggiornaPendingUI();
        flushLogs();
    }

    function onSaveEvent(p) {
        if (p && p.success === false) return;   // salvataggio fallito: si resta in attesa
        saveEventSeen = true;
        lastUnsaved = 0;
        promuoviPending('', 'evento wme-save-finished');
    }

    // Niente piu' da salvare subito dopo un annullamento: hai annullato tutto, e le righe
    // di quelle modifiche non devono finire nel registro.
    function onNoEdits() {
        if (pendingLog.length && Date.now() - lastUndoAt < 4000) scartaPending();
    }

    function promuoviPending(nota, come) {
        if (come && !saveWay) { saveWay = come; log('salvataggi rilevati con:', come); }
        if (!pendingLog.length) return;
        const n = pendingLog.length;
        for (const r of pendingLog) {
            if (nota) r.motivo = (r.motivo ? r.motivo + ' \u00b7 ' : '') + nota;
            enqueueLog(r);
        }
        pendingLog = [];
        fermaSaveWatch();
        log(`${n} ${pl(n, 'riga registrata', 'righe registrate')} dopo il salvataggio`);
        aggiornaPendingUI();
        flushLogs();
    }

    function scartaPending() {
        const n = pendingLog.length;
        pendingLog = [];
        fermaSaveWatch();
        log(`${n} ${pl(n, 'riga scartata', 'righe scartate')}: modifiche annullate prima del salvataggio`);
        aggiornaPendingUI();
    }

    // Promemoria nel pannello: quello che non e' ancora salvato non e' ancora nel registro
    function aggiornaPendingUI() {
        if (!ui || !ui.datastatus) return;
        const vecchio = document.getElementById('wfit-pending');
        if (vecchio) vecchio.remove();
        if (!pendingLog.length) return;
        const d = document.createElement('div');
        d.id = 'wfit-pending';
        d.className = 'wfit-muted';
        d.textContent = `${pendingLog.length} ${pl(pendingLog.length, 'modifica in attesa di salvataggio', 'modifiche in attesa di salvataggio')}: finiranno nel registro solo dopo Ctrl+S.`;
        ui.datastatus.parentNode.insertBefore(d, ui.datastatus.nextSibling);
    }

    function scheduleLogFlush(ms) {
        clearTimeout(logFlushTimer);
        logFlushTimer = setTimeout(flushLogs, ms);
    }

    async function flushLogs() {
        if (logFlushing || !logQueue.length || !authInfo.ok || !gasConfigured()) return;
        logFlushing = true;
        const batch = logQueue.slice(0, 300);
        try {
            const r = await gasCall({ action: 'log', user: authInfo.user, sessione: SESSION_ID, rows: batch }, 30000);
            if (r && r.ok) {
                logQueue.splice(0, batch.length);
                saveLogQueue();
            }
            // il foglio risponde SEMPRE anche con lo stato di abilitazione: se nel frattempo
            // l'utente e' stato tolto dall'elenco, lo script si chiude subito
            if (r && r.autorizzato === false) {
                lockDown(r.messaggio || 'abilitazione revocata dai coordinatori.', 401);
                return;
            }
        } catch (e) {
            log('log non inviati (riprovo piu\' tardi):', e.message);
        } finally {
            logFlushing = false;
            if (logQueue.length) scheduleLogFlush(60000);
        }
    }

    if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', saveLogQueue);
        setInterval(() => { if (logQueue.length) flushLogs(); }, 120000);
    }

    async function controllaAbilitazione() {
        if (!authInfo.ok) return;
        const c = await checkAuthorization(true);
        if (!c.ok) lockDown(c.reason, c.code);
    }

    // Chiusura immediata mentre l'editor e' aperto. Il codice dice perche': 401 se
    // l'abilitazione e' stata tolta, 503 se il foglio non risponde da piu' del periodo
    // di tolleranza. Nel secondo caso la cache NON si tocca: e' l'unica cosa che
    // rimetterebbe in piedi la tolleranza al prossimo avvio.
    function lockDown(reason, code) {
        if (!authInfo.ok) return;
        const user = authInfo.user;
        authInfo = { ok: false, user, reason, code: code || 401 };
        if (authInfo.code === 401) clearAuthCache();
        captured.clear();
        pendingLog = [];
        clearCiviciLayer();
        try { sdk.Events.off({ eventName: 'wme-selection-changed', eventHandler: onSelectionChanged }); } catch { /* ignora */ }
        renderBlocked(authInfo);
    }

    /* ------------------------------------------------------------------ */
    /* Bootstrap                                                           */
    /* ------------------------------------------------------------------ */

    const sdkPromise = (typeof unsafeWindow !== 'undefined' && unsafeWindow.SDK_INITIALIZED)
        ? unsafeWindow.SDK_INITIALIZED : (window.SDK_INITIALIZED || null);
    if (sdkPromise) sdkPromise.then(bootstrap).catch(e => console.error(`${SCRIPT_NAME}: SDK KO`, e));
    else console.error(`${SCRIPT_NAME}: SDK_INITIALIZED assente.`);

    async function bootstrap() {
        const gw = (typeof unsafeWindow !== 'undefined' && unsafeWindow.getWmeSdk) ? unsafeWindow.getWmeSdk
            : (typeof getWmeSdk === 'function' ? getWmeSdk : null);
        if (!gw) return;
        sdk = gw({ scriptId: SCRIPT_ID, scriptName: SCRIPT_NAME });
        if (!sdk.State || !sdk.State.isReady || !sdk.State.isReady()) {
            await sdk.Events.once({ eventName: 'wme-ready' });
        }
        log(`avviato v${VERSION}`);
        sdkSelfTest();
        await buildTab();               // per ora il pannello mostra solo "verifica in corso"
        loadLogQueue();

        const r = await checkAuthorization(false);
        authInfo = r;
        if (!r.ok) { renderBlocked(r); return; }   // niente cattura, niente dati, niente civici
        const u = currentUser();
        authInfo.rank = u.rank;
        log(`utente ${r.user} autorizzato${r.ruolo ? ' (' + r.ruolo + ')' : ''}${r.offline ? ' - in tolleranza, foglio non raggiungibile' : ''}`);
        startFeatures();
    }

    // Tutto cio' che lo script sa fare parte solo dopo l'OK del foglio autorizzazioni
    function startFeatures() {
        mountPanel();
        initData();
        try { sdk.Events.on({ eventName: 'wme-selection-changed', eventHandler: onSelectionChanged }); }
        catch (e) { log('evento selezione KO', e); }
        registerShortcut();
        initSaveTracking();
        loadCache();
        flushLogs();
        // Ricontrollo periodico: copre sia la revoca dell'abilitazione sia una nuova
        // versione minima imposta dai coordinatori mentre l'editor e' gia' aperto.
        setInterval(controllaAbilitazione, AUTH_RECHECK_MIN * 60000);
    }

    // Scorciatoia (se l'SDK la supporta) per passare al volo tra ALT+clic / Sempre / Spenta
    function registerShortcut() {
        const cycle = () => {
            // con un tasto personalizzato registrato entra anche lui nel giro
            const ring = settings.captureKey ? ['alt', 'altshift', 'custom', 'always', 'off'] : ['alt', 'altshift', 'always', 'off'];
            const i = ring.indexOf(settings.captureMode);
            settings.captureMode = ring[(i + 1) % ring.length];
            saveSettings();
            syncCapUI();
            toast(capModeLabel());
        };
        const tries = [
            () => sdk.Shortcuts.createShortcut({ shortcutId: 'wfit-capture-mode', description: 'Fonti IT: cambia modalit\u00e0 cattura', shortcutKeys: 'A+c', callback: cycle }),
            () => sdk.Shortcuts.createShortcut({ shortcutId: 'wfit-capture-mode', description: 'Fonti IT: cambia modalit\u00e0 cattura', shortcutKeys: null, callback: cycle })
        ];
        for (const t of tries) { try { t(); log('scorciatoia registrata'); return; } catch { /* prossima */ } }
        log('scorciatoie SDK non disponibili');
    }

    // Legge un file dati in tre passaggi, dal piu' economico al piu' costoso:
    // 1) risorsa scaricata da Tampermonkey insieme allo script (nessuna rete a runtime),
    // 2) copia in IndexedDB, 3) rete. Se salta tutto, si va avanti con i valori di scorta.
    function readResource(name) {
        try {
            if (typeof GM_getResourceText !== 'function') return null;
            const t = GM_getResourceText(name);
            if (t && t.length > 50) return JSON.parse(t);
        } catch (e) { log(`risorsa ${name} non leggibile:`, e.message); }
        return null;
    }

    async function loadDataFile(resName, url, cacheKey, maxAgeDays) {
        const fromRes = readResource(resName);
        if (fromRes) return fromRes;
        let cached = null;
        try { cached = await idb.get('meta', cacheKey); } catch { /* niente cache */ }
        const fresca = cached && cached.data && (Date.now() - (cached.quando || 0)) < maxAgeDays * 86400000;
        if (fresca) return cached.data;
        try {
            const buf = await gmFetchBinary(url, null, 30000);
            const data = JSON.parse(new TextDecoder('utf-8').decode(buf));
            try { await idb.put('meta', { k: cacheKey, data, quando: Date.now() }); } catch { /* pazienza */ }
            return data;
        } catch (e) {
            log(`file dati non raggiungibile (${url}):`, e.message);
        }
        return (cached && cached.data) || null;
    }

    async function loadComuni() {
        const j = await loadDataFile('comuni', COMUNI_URL, 'comuniPack', 120);
        const map = j && (j.comuni || (typeof j === 'object' && !Array.isArray(j) ? j : null));
        if (!map) { log('elenco comuni non disponibile: ci provo con ISTAT online'); return 0; }
        let n = 0;
        for (const k of Object.keys(map)) {
            if (/^[A-Z]\d{3}$/.test(k) && map[k]) { belNome.set(k, String(map[k])); n++; }
        }
        log(`comuni caricati da data/comuni.json: ${n}`);
        return n;
    }

    async function loadOdonimi() {
        const j = await loadDataFile('odonimi', ODONIMI_URL, 'odonimiRules', 120);
        setOdonimi(j);
        log(j ? 'regole odonimi caricate da data/odonimi.json' : 'regole odonimi: uso quelle di scorta');
    }

    // Elenco comuni e regole di scrittura: prima i file del repo, poi ISTAT come aggiornamento.
    async function initData() {
        await loadOdonimi();
        const n = await loadComuni();
        await loadIstat();
        if (!belNome.size) {
            status('<span style="color:#c60"><b>Elenco comuni non caricato: al posto del nome del comune vedrai il codice catastale. Controlla la connessione e ricarica il WME.</b></span>');
        } else if (!n) {
            log(`elenco comuni preso da ISTAT: ${belNome.size}`);
        }
    }

    // Accende il bottone "Aggiorna" quando almeno una regione in locale ha passato STALE_DAYS:
    // e' solo un promemoria visivo, lo scarico resta sempre una scelta dell'editor.
    function markUpdateDue(regs) {
        if (!ui.aggiorna) return;
        const vecchie = (regs || []).filter(r => r.quando && (Date.now() - r.quando) / 86400000 > STALE_DAYS);
        const due = vecchie.length > 0;
        ui.aggiorna.classList.toggle('wfit-due', due);
        if (due) {
            const g = Math.max(...vecchie.map(r => Math.floor((Date.now() - r.quando) / 86400000)));
            ui.aggiorna.title = `Sono passati ${g} giorni dallo scarico di ${vecchie.map(r => r.nomeReg || r.reg).join(', ')}: ANNCSU aggiorna i dataset ogni mese, conviene riscaricare.`;
        } else {
            ui.aggiorna.title = "Riscarica le regioni che hai gia' in locale, per prendere i dataset ANNCSU piu' recenti";
        }
    }

    async function loadCache() {
        try {
            const regs = await idb.all('regioni');
            if (regs.length) {
                rebuildMemory(regs);
                let s = `Cache pronta: ${fmtN(mem.n)} civici (${regs.map(r => r.nomeReg || r.reg).join(', ')}).${regionsFreshnessLabel(regs)}`;
                if (regs.some(r => !r.pv || r.pv < 9)) {
                    s += ` <span style="color:#c60"><b>Cache di una versione precedente: gli esponenti dei civici possono mancare o essere incompleti (es. 343/A, 20/1). Premi "Scarica regione" per rigenerarla.</b></span>`;
                }
                // colonna esponente sospetta: si vede nel pannello, non solo nel log
                const bad = regs.filter(r => r.espShare > 0.5);
                if (bad.length) {
                    s += ` <span style="color:#c60"><b>Colonna esponente sospetta in ${bad.map(r => r.nomeReg || r.reg).join(', ')}:`
                       + ` ${(bad[0].espShare * 100).toFixed(0)}% dei civici ne ha uno`
                       + `${bad[0].espTop ? ` (${bad[0].espTop})` : ''}. I numeri tipo "1/3" potrebbero non essere reali.</b></span>`;
                }
                // Il conteggio giorni sopra e' sempre visibile; qui solo la spiegazione, e solo
                // quando almeno una regione ha superato la soglia (MAI uno scarico automatico).
                if (regs.some(r => r.quando && (Date.now() - r.quando) / 86400000 > STALE_DAYS)) {
                    s += ` <span class="wfit-muted">ANNCSU aggiorna i dataset regionali con cadenza mensile: quando vuoi, "Scarica regione" prende i dati pi\u00f9 freschi.</span>`;
                }
                status(s);
            } else {
                status('Nessun dato: scegli la regione e premi Scarica.');
            }
            markUpdateDue(regs);
        } catch (e) { log('cache KO', e); }
    }

    /* ------------------------------------------------------------------ */
    /* UI                                                                  */
    /* ------------------------------------------------------------------ */

    const LOGO_SVG_RAW = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="__W__" height="__W__" style="vertical-align:-__V__px">
  <defs><clipPath id="wfitTile"><rect x="2" y="2" width="44" height="44" rx="11"/></clipPath></defs>
  <g clip-path="url(#wfitTile)">
    <rect x="2" y="2" width="14.7" height="44" fill="#009246"/>
    <rect x="16.7" y="2" width="14.6" height="44" fill="#f7f7f5"/>
    <rect x="31.3" y="2" width="14.7" height="44" fill="#ce2b37"/>
    <path d="M17.5 46 L22.6 11 L25.4 11 L30.5 46 Z" fill="#23272e"/>
    <path d="M23.7 43.5 L24 14.5" stroke="#ffd75e" stroke-width="1.7" stroke-dasharray="3.4 2.8" fill="none" stroke-linecap="round"/>
    <circle cx="24" cy="9.4" r="4.1" fill="#ffd75e" stroke="#23272e" stroke-width="1.6"/>
    <circle cx="24" cy="9.4" r="1.4" fill="#23272e"/>
  </g>
  <rect x="2" y="2" width="44" height="44" rx="11" fill="none" stroke="#1d2127" stroke-width="2.2"/>
</svg>`;
    const logoSvg = (w, v) => LOGO_SVG_RAW.replace(/__W__/g, w).replace(/__V__/g, v);
    const LOGO_SVG = logoSvg(18, 4);

    const CSS = `
#wfit-panel .wfit-bloc { border-radius:8px; }
#wfit-panel .wfit-bloc p { margin:6px 0; }
#wfit-panel .wfit-bloccode { font-weight:700; font-size:15px; letter-spacing:.5px; margin-bottom:6px; }
#wfit-panel .wfit-bloc-no { border:1px solid #e2b4b4; background:#fdf3f3; }
#wfit-panel .wfit-bloc-no .wfit-bloccode { color:#a5232f; }
#wfit-panel .wfit-bloc-forse { border:1px solid #e4cf9a; background:#fdf9ef; }
#wfit-panel .wfit-bloc-forse .wfit-bloccode { color:#8a6316; }
#wfit-panel { --wg:#009246; --ww:#f4f4f2; --wr:#ce2b37; --blu:#0b5ed7; --ink:#22262c; font-size:12px; color:var(--ink);
  container-type:inline-size; max-width:100%; overflow-x:hidden; padding:4px 10px 18px; }
#wfit-panel, #wfit-panel * { box-sizing:border-box; }
#wfit-panel select, #wfit-panel input { max-width:100%; min-width:0; }
#wfit-panel .wfit-res, #wfit-panel .wfit-box { word-break:break-word; overflow-wrap:anywhere; }
#wfit-panel h4 { display:flex; align-items:center; gap:6px; margin:15px 0 9px; font-size:11.5px; font-weight:700;
  text-transform:uppercase; letter-spacing:.6px; color:#333; border-bottom:2px solid;
  border-image:linear-gradient(90deg,var(--wg) 33%,#c9c9c9 33% 66%,var(--wr) 66%) 1; padding-bottom:3px; }
#wfit-panel .wfit-row { display:flex; gap:6px; align-items:center; margin:8px 0; flex-wrap:wrap; }
#wfit-panel .wfit-row.wfit-nowrap { flex-wrap:nowrap; }
#wfit-panel .wfit-btn.wfit-due { background:#e8f7ec; border-color:#2e9e52; color:#1d6b37; font-weight:700; }
#wfit-panel .wfit-btn.wfit-due::before { content:'\\2022 '; color:#2e9e52; font-size:14px; line-height:0; }
#wfit-panel .wfit-btn.wfit-due:hover { background:#d7f0de; }
#wfit-panel .wfit-row.wfit-nowrap .wfit-btn { flex:1 1 0; min-width:0; padding-left:6px; padding-right:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
#wfit-panel input[type=number], #wfit-panel input[type=text], #wfit-panel select { flex:1; min-width:60px; padding:6px 8px; border:1px solid #ccc;
  border-radius:7px; font-size:12px; background:#fff; transition:border-color .15s; }
#wfit-panel input:focus, #wfit-panel select:focus { border-color:var(--blu); outline:none; }
#wfit-panel button.wfit-btn { border:1px solid #c3c3c3; background:#fafafa; border-radius:8px; padding:6px 11px; cursor:pointer;
  font-size:12px; transition:background .15s, box-shadow .15s, transform .05s; }
#wfit-panel button.wfit-btn:hover { background:#f0f0f0; box-shadow:0 1px 3px rgba(0,0,0,.12); }
#wfit-panel button.wfit-btn:active { transform:translateY(1px); }
#wfit-panel button.wfit-btn:disabled { opacity:.45; cursor:default; box-shadow:none; }
#wfit-panel button.wfit-primary { background:linear-gradient(135deg,#1266e3,#0a4fc0); border-color:#0a4fc0; color:#fff; font-weight:600; }
#wfit-panel button.wfit-primary:hover { background:linear-gradient(135deg,#0f5cd0,#0946ab); }
#wfit-panel .wfit-muted { color:#767c85; font-size:11px; }
#wfit-panel .wfit-box { background:#f5f8f5; border:1px solid #e2e9e2; border-radius:9px; padding:8px 9px; }
#wfit-panel .wfit-chip { display:inline-block; background:#eaf3ea; border:1px solid #c6d9c6; border-radius:999px;
  padding:1px 5px 1px 8px; margin:1px 2px; font-size:10px; cursor:pointer; white-space:nowrap; transition:background .15s; }
#wfit-panel .wfit-chip:hover { background:#dcecdc; }
#wfit-panel .wfit-chip.wfit-bad { background:#fdecec; border-color:#e5a3a3; }
#wfit-panel .wfit-x { color:#b23a3a; margin-left:4px; cursor:pointer; font-weight:bold; }
#wfit-panel .wfit-res { border:1px solid #e3e3e3; border-left:5px solid var(--wg); border-radius:10px; padding:9px 10px; margin:9px 0;
  background:#fff; box-shadow:0 1px 4px rgba(0,0,0,.07); }
#wfit-panel .wfit-name-in { width:100%; box-sizing:border-box; font-weight:650; font-size:13px; padding:4px 7px;
  border:1px solid #bbb; border-radius:7px; margin:4px 0 2px; }
#wfit-panel .wfit-name-in:focus { border-color:var(--blu); outline:none; box-shadow:0 0 0 2px rgba(11,94,215,.15); }
#wfit-panel .wfit-badge { display:inline-block; background:#e9efff; color:#23407e; border-radius:999px; padding:0 7px;
  font-size:10px; font-weight:600; }
#wfit-panel .wfit-toast { position:sticky; bottom:0; background:#24282e; color:#fff; padding:6px 9px; border-radius:8px;
  margin-top:8px; display:none; box-shadow:0 2px 8px rgba(0,0,0,.25); }
#wfit-panel progress { width:100%; height:8px; border-radius:4px; }
#wfit-panel details { margin:8px 0; } #wfit-panel summary { cursor:pointer; padding:2px 0; }
#wfit-panel .wfit-head { display:flex; align-items:center; gap:9px; margin:8px 0 2px; padding:9px 11px;
  background:linear-gradient(135deg,#fafcf9,#f2f6f2); border:1px solid #e2e8e2; border-radius:12px; }
#wfit-panel .wfit-sec { background:#fff; border:1px solid #e8e8e8; border-radius:12px; padding:11px 12px 12px;
  margin:11px 0; box-shadow:0 1px 4px rgba(0,0,0,.06); }
#wfit-panel .wfit-sec > h4:first-child { margin-top:0; }
#wfit-panel .wfit-head .t { font-size:15px; font-weight:800; letter-spacing:.2px; }
#wfit-panel .wfit-head .by { font-size:10.5px; color:#767c85; margin-top:-2px; }
#wfit-panel .wfit-ver { background:#eef1f5; border:1px solid #dde2e9; color:#5a6270; border-radius:999px; font-size:9.5px; padding:0 6px; margin-left:auto; }
#wfit-panel .wfit-guide ol { margin:4px 0 4px 18px; padding:0; }
#wfit-panel .wfit-guide li { margin:5px 0; line-height:1.35; }
#wfit-panel .wfit-guide li::marker { color:var(--wr); font-weight:700; }
#wfit-panel .wfit-guide p { margin:7px 0; line-height:1.45; }
#wfit-panel .wfit-guide .wfit-gnum { color:var(--wr); font-weight:800; }
#wfit-panel .wfit-guide .wfit-key { background:#fff8e6; border:1px solid #eedfb2; border-radius:8px; padding:8px 9px; }
#wfit-panel .wfit-foot { margin-top:10px; padding-top:6px; border-top:1px dashed #d8d8d8; color:#767c85; font-size:10.5px; }
#wfit-panel .wfit-keybadge { display:inline-block; min-width:52px; text-align:center; padding:2px 7px; border:1px solid #cfd4db; border-bottom-width:2px; border-radius:5px; background:#f6f7f9; font-family:monospace; font-size:11px; font-weight:700; color:#2b3138; }
#wfit-panel .wfit-keybadge.wfit-rec { border-color:#d33; color:#d33; background:#fff2f2; cursor:pointer; min-width:0; font-family:inherit; font-weight:600; }
#wfit-panel .wfit-keybadge.wfit-pend { border-color:#c98a00; color:#8a5f00; background:#fff9e8; }
#wfit-panel a.wfit-lic { color:#1a73c7; text-decoration:underline; font-weight:600; }
#wfit-panel a.wfit-slack { color:#611f69; text-decoration:underline; font-weight:700; }
#wfit-panel a.wfit-slack:hover { color:#3d1442; }
#wfit-panel a.wfit-lic:hover { color:#0f4f8f; }
#wfit-panel .wfit-actions { display:flex; gap:5px; flex-wrap:wrap; margin-top:4px; }
#wfit-panel .wfit-hnrev { margin-top:7px; border-top:1px dashed #d8d8d8; padding-top:6px; }
#wfit-panel .wfit-hnrev .wfit-hnlist { max-height:260px; overflow:auto; margin:4px 0; border:1px solid #eee; border-radius:7px; padding:3px 4px; }
/* riga civico: prima fascia con spunta+numero+distanza, sotto la nota quando serve.
   Il bordo colorato a sinistra e' l'unico segnale di stato: niente sfondi pieni, che
   nel pannello stretto facevano l'effetto insegna luminosa. */
#wfit-panel .wfit-hnrow { padding:3px 4px 3px 7px; border-radius:6px; cursor:pointer; border-left:3px solid transparent; }
#wfit-panel .wfit-hnrow:hover { background:#f2f6fc; }
#wfit-panel .wfit-hntop { display:flex; align-items:center; gap:7px; min-width:0; }
#wfit-panel .wfit-hnd { flex:1; min-width:0; text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
#wfit-panel .wfit-hnnote { display:none; margin:1px 0 0 24px; font-size:11px; line-height:1.35; color:#6a7078; }
#wfit-panel .wfit-n-warn { color:#a32b2b; font-weight:600; }
#wfit-panel .wfit-n-dup  { color:#8a6100; }
#wfit-panel .wfit-n-waze { color:#2c6791; }
#wfit-panel .wfit-n-moved { color:#8a4b12; font-weight:600; }
#wfit-panel .wfit-n-ovl  { color:#5b3fa0; font-weight:600; }
#wfit-panel .wfit-n-rpp  { color:#1f6e6a; font-weight:600; }
#wfit-panel .wfit-n-seq  { color:#8a6400; font-weight:600; }
#wfit-panel .wfit-hndup  { border-left-color:#e8b530; }
#wfit-panel .wfit-hnwaze { border-left-color:#7fa8c9; opacity:.72; }
#wfit-panel .wfit-hnmoved { border-left-color:#e07b28; background:#fdf6f0; }
#wfit-panel .wfit-hnovl  { border-left-color:#7d5bd0; background:#f7f4fd; }
#wfit-panel .wfit-hnsusp { border-left-color:#cc3b3b; background:#fdf4f4; }
#wfit-panel .wfit-hnrpp  { border-left-color:#1f8f8a; background:#f0faf9; }
#wfit-panel .wfit-hnseq  { border-left-color:#b8860b; background:#fbf7ea; }
#wfit-panel .wfit-hnflash { outline:2px solid var(--blu); outline-offset:1px; }
#wfit-panel .wfit-sv { border:1px solid #bbb; border-radius:5px; background:#fff; color:var(--blu); padding:1px 5px; line-height:0; cursor:pointer; }
#wfit-panel .wfit-sv:hover { border-color:var(--blu); }
/* barra di scelta: segmenti affiancati, non link sparsi nel testo */
#wfit-panel .wfit-hnsuspbar { display:flex; align-items:center; flex-wrap:wrap; gap:5px; margin:5px 0 2px; }
#wfit-panel .wfit-suspmode { padding:2px 8px; border:1px solid #d3d8de; border-radius:999px; text-decoration:none; color:#5a6068; background:#fff; font-size:11px; }
#wfit-panel .wfit-suspmode:hover { border-color:#9aa3ad; color:#2b3138; }
#wfit-panel .wfit-suspmode.wfit-on { background:#2b3138; border-color:#2b3138; color:#fff; font-weight:600; }
#wfit-panel .wfit-hnleg { display:flex; flex-wrap:wrap; align-items:flex-start; gap:3px 12px; margin:3px 0 0; font-size:11px; }
/* voce di legenda: il pallino non si stringe mai, il testo va a capo dentro la voce e la voce
   intera scende sotto quando nella riga non ci sta piu' */
#wfit-panel .wfit-legitem { display:inline-flex; align-items:flex-start; max-width:100%; line-height:1.35; }
#wfit-panel .wfit-legitem .wfit-swatch { flex:0 0 auto; margin-top:2px; }
#wfit-panel .wfit-hnscan { margin:4px 0 0; font-size:11px; font-style:italic; line-height:1.35; overflow-wrap:anywhere; }
#wfit-panel .wfit-scanbad { color:#a32b2b; font-style:normal; font-weight:600; }
#wfit-panel .wfit-swatch { display:inline-block; width:3px; height:11px; border-radius:2px; vertical-align:-2px; margin-right:5px; flex:0 0 auto; }
#wfit-panel .wfit-sw-dup  { background:#e8b530; }
#wfit-panel .wfit-sw-waze { background:#7fa8c9; }
#wfit-panel .wfit-sw-moved { background:#e07b28; }
#wfit-panel .wfit-sw-ovl   { background:#7d5bd0; }
#wfit-panel .wfit-sw-susp { background:#cc3b3b; }
#wfit-panel .wfit-sw-rpp  { background:#1f8f8a; }
#wfit-panel .wfit-sw-seq  { background:#b8860b; }
#wfit-panel .wfit-zona { margin-top:6px; padding:6px 8px; border:1px solid #d6d9de; border-radius:8px; background:#fbfcfe; }
#wfit-panel .wfit-zrow { display:flex; align-items:center; gap:6px; padding:2px 0; cursor:pointer; }
#wfit-panel .wfit-zrow:hover { background:#eef3fb; border-radius:5px; }
#wfit-panel .wfit-zdot { width:10px; height:10px; border-radius:50%; flex:0 0 auto; }
#wfit-panel .wfit-rppbtn { display:none; font-size:10px; font-weight:700; line-height:1.4; color:#1f6e6a; }
#wfit-panel .wfit-hnrpp .wfit-rppbtn { display:inline-block; }
#wfit-panel .wfit-norpp .wfit-rppbtn { display:none !important; }
#wfit-panel .wfit-hnrow b { min-width:44px; }
#wfit-panel .wfit-hnnum { width:70px; min-width:56px; padding:2px 5px; border:1px solid #bbb; border-radius:5px; font-weight:650; font-size:12px; }
#wfit-panel .wfit-hnnum:focus { border-color:var(--blu); outline:none; }
#wfit-panel .wfit-hnnum.wfit-bad-in { border-color:#c33; background:#fdeaea; }
#wfit-panel .wfit-hnadd { display:flex; gap:5px; margin-top:5px; align-items:center; }
#wfit-panel .wfit-hnadd input { flex:1; padding:4px 6px; border:1px solid #bbb; border-radius:6px; font-size:12px; }
#wfit-panel .wfit-actions .wfit-btn { flex:1 1 auto; white-space:nowrap; }
/* Sidebar stretta: righe che si impilano, bottoni a tutta larghezza */
@container (max-width: 270px) {
  /* sidebar strettissima: ogni voce di legenda si prende una riga tutta sua */
  #wfit-panel .wfit-hnleg { gap:2px 8px; }
  #wfit-panel .wfit-legitem { flex:1 1 100%; }
  #wfit-panel .wfit-row > select { flex:1 1 100%; }
  #wfit-panel .wfit-row .wfit-btn { flex:1 1 auto; }
  #wfit-panel .wfit-actions .wfit-btn { flex:1 1 100%; white-space:normal; }
  #wfit-panel .wfit-head .t { font-size:14px; }
}
/* Sidebar larga: un filo piu' d'aria */
@container (min-width: 380px) {
  #wfit-panel { font-size:12.5px; }
  #wfit-panel .wfit-res { padding:9px 10px; }
}
/* Dispositivi touch: bersagli piu' grandi */
@media (pointer: coarse) {
  #wfit-panel { font-size:13px; }
  #wfit-panel button.wfit-btn { padding:8px 12px; }
  #wfit-panel input[type=number], #wfit-panel select { padding:7px 8px; }
  #wfit-panel .wfit-name-in { padding:7px 9px; font-size:14px; }
  #wfit-panel .wfit-chip { font-size:11.5px; padding:4px 8px 4px 11px; }
  #wfit-panel .wfit-x { padding:0 4px; }
  #wfit-panel input[type=checkbox], #wfit-panel input[type=radio] { transform:scale(1.25); margin-right:4px; }
  /* la riga dei tre bottoni dati resta comunque su una riga sola, solo piu' compatta */
  #wfit-panel .wfit-row.wfit-nowrap button.wfit-btn { padding:8px 4px; font-size:12px; }
}
`;

    // Struttura del pannello: blocco di sola presentazione, tenuto fuori da buildTab,
    // che si occupa invece di montarlo e collegarlo.
    const PANEL_HTML = `
  <div class="wfit-head">${logoSvg(30, 8)}<div><div class="t">${SCRIPT_NAME}</div><div class="by">Civici e odonimi ufficiali ANNCSU &middot; a cura di ${AUTORE}</div></div><span class="wfit-ver">v${VERSION}</span></div>

  <div class="wfit-sec">
  <h4>Dati ANNCSU</h4>
  <div class="wfit-row">
    <select id="wfit-regione">${REGIONI.map(r => `<option value="${r[0]}">${r[1]}</option>`).join('')}</select>
    <button class="wfit-btn wfit-primary" id="wfit-scarica">Scarica regione</button>
  </div>
  <progress id="wfit-prog" max="100" value="0" style="display:none"></progress>
  <div class="wfit-muted" id="wfit-datastatus">Avvio&hellip;</div>
  <details><summary class="wfit-muted">Altre opzioni dati</summary>
    <div class="wfit-row wfit-nowrap">
      <button class="wfit-btn" id="wfit-scarica-tutte" title="Scarica una dopo l'altra tutte e 20 le regioni: ci vogliono alcuni minuti e parecchia memoria">Scarica tutte</button>
      <button class="wfit-btn" id="wfit-aggiorna" title="Riscarica le regioni che hai gia' in locale, per prendere i dataset ANNCSU piu' recenti">Aggiorna</button>
      <button class="wfit-btn" id="wfit-svuota-cache" title="Cancella tutte le regioni salvate in locale">Svuota dati</button>
    </div>
  </details>
  </div>

  <div class="wfit-sec">
  <h4>Segmenti</h4>
  <div class="wfit-row">
    <label>Cattura</label>
    <select id="wfit-capmode">
      <option value="alt">&#8997; ALT + clic</option>
      <option value="altshift">&#8997;&#8679; ALT + MAIUSC + clic</option>
      <option value="ctrlalt">&#8963;/&#8984;&#8997; CTRL + ALT + clic</option>
      <option value="custom">&#9000; Un tasto a tua scelta + clic</option>
      <option value="always">Sempre (ogni clic finisce in lista)</option>
      <option value="off">Spenta</option>
    </select>
  </div>
  <div class="wfit-row" id="wfit-keyrow" title="Un solo tasto della tastiera, quello che tieni premuto mentre clicchi un segmento. Si registra una volta, resta salvato e vale per sempre. ALT, MAIUSC e CTRL non si scelgono qui: per quelli ci sono le voci fisse del menu Cattura.">
    <label>Tasto (uno solo)</label>
    <span class="wfit-keybadge" id="wfit-keyshow">nessuno</span>
    <button class="wfit-btn" id="wfit-keyset">Cambia</button>
    <button class="wfit-btn wfit-primary" id="wfit-keyok" title="Salva questo tasto">Conferma</button>
    <button class="wfit-btn" id="wfit-keyredo" title="Scegline un altro">Rifai</button>
    <button class="wfit-btn" id="wfit-keyclr" title="Torna ad ALT + clic">Azzera</button>
  </div>
  <div class="wfit-box" id="wfit-selinfo">Lista vuota.</div>
  <div class="wfit-row">
    <button class="wfit-btn" id="wfit-clear-cap">Svuota lista</button>
  </div>
  <div class="wfit-row">
    <label>Evidenzia</label>
    <select id="wfit-hlcolor">
      <option value="#00e5ff">Ciano elettrico</option>
      <option value="#ff2bd6">Fucsia</option>
      <option value="#ffe600">Giallo fluo</option>
      <option value="#a6ff00">Verde lime</option>
      <option value="#ff9500">Arancione acceso</option>
    </select>
  </div>
  <div class="wfit-row">
    <label>Raggio (m)</label><input type="number" id="wfit-raggio" min="1" max="50" step="1" style="max-width:70px" title="Distanza massima civico-segmento per il confronto (da 1 a 50 m, predefinito 10). Oltre i 45 m Waze rifiuta i civici, quindi un raggio piu' largo non servirebbe. Nota: i punti ANNCSU stanno su edifici/ingressi, spesso 5-20 m dall'asse strada: con raggi molto stretti potresti perdere civici legittimi, con raggi larghi tirare dentro le vie vicine.">
    <label><input type="checkbox" id="wfit-titlecase"> Formato Waze</label>
  </div>
  <div class="wfit-row">
    <label><input type="checkbox" id="wfit-autoan"> Auto-analisi</label>
    <label><input type="checkbox" id="wfit-dots"> Civici sulla mappa</label>
  </div>
  <div class="wfit-row" id="wfit-dotsizerow" title="Quanto grandi disegnare i pallini dei civici e i loro numeri sulla mappa. Serve solo a vederci meglio: non cambia nulla di quello che finisce su Waze.">
    <label>Pallini</label>
    <select id="wfit-dotsize">
      <option value="piccoli">Piccoli</option>
      <option value="normale">Normali (predefinito)</option>
      <option value="grandi">Grandi</option>
      <option value="maxi">Molto grandi</option>
      <option value="enormi">Enormi</option>
    </select>
  </div>
  <div class="wfit-row" title="Regola Waze Italia per i segmenti fuori dal centro abitato: nome primario con citt&agrave; vuota (Nessuno), nome alternativo con via + citt&agrave;">
    <label>Applica come:</label>
    <label><input type="radio" name="wfit-am" id="wfit-am-urb" value="urb"> Dentro il centro abitato (PN con citt&agrave;)</label>
    <label><input type="radio" name="wfit-am" id="wfit-am-extra" value="extra"> Fuori centro abitato (PN senza citt&agrave; + AN con citt&agrave;)</label>
  </div>
  <div class="wfit-row"><button class="wfit-btn wfit-primary" id="wfit-analizza" style="flex:1">&#128269; Confronta con ANNCSU</button></div>
  <div class="wfit-row"><button class="wfit-btn" id="wfit-zona" style="flex:1" title="Sola lettura: colora le strade a schermo confrontandole con ANNCSU (rosso = senza nome, giallo = nome diverso, verde = civici da inserire) e mostra i civici del database. Non modifica NULLA. Pensato per le zone agro e le contrade: in centro abitato, con la vista larga, si supera subito il limite di 500 strade.">&#128506;&#65039; Controlla la zona (non modifica)</button></div>
  </div>

  <div class="wfit-sec">
  <h4>Risultati</h4>
  <div id="wfit-results" class="wfit-muted">Qui appariranno via/contrada, localit&agrave;, comune e i civici agganciati. Scarica la regione e cattura qualche segmento per iniziare.</div>

  </div>

  <details class="wfit-guide"><summary><b>&#8505;&#65039; Come funziona</b></summary>
    <p><span class="wfit-gnum">1 &middot; Scarica i dati.</span> Scegli la regione e premi <b>Scarica regione</b>: lo script legge l'archivio ufficiale ANNCSU (Istat / Agenzia delle Entrate) e salva in locale tutti i civici georiferiti. La cache resta anche ai prossimi avvii, quindi non serve rifarlo a ogni sessione. ANNCSU aggiorna per&ograve; i dataset regionali con <b>cadenza mensile</b> e in questo periodo i Comuni stanno completando la georeferenziazione dei civici (in Italia solo una parte &egrave; ancora geolocalizzata): un giro ogni <b>4&ndash;6 settimane</b> pu&ograve; far comparire strade e numeri prima assenti. Nel pannello trovi sempre scritto da quanti giorni hai scaricato ogni regione (si evidenzia oltre 35 giorni, solo come promemoria: <b>lo script non riscarica mai da solo</b>). Sotto <b>Altre opzioni dati</b>, <b>Scarica tutte</b> le prende una dopo l'altra (alcuni minuti: te lo chiede prima di partire), mentre <b>Aggiorna</b> riscarica quelle che hai gi&agrave; in locale (e si accende di verde quando i tuoi dati hanno passato i 35 giorni); in tutti e due i casi il bottone diventa <b>Ferma</b> e il ciclo si interrompe dopo la regione in corso. <b>Svuota dati</b> riparte da zero. I dati ANNCSU sono <b>open data</b> rilasciati con licenza ${licLink('Creative Commons Attribuzione 4.0 (CC-BY 4.0)')}: si possono riutilizzare anche su Waze, purch&eacute; sia citata la fonte.</p>
    <p><span class="wfit-gnum">2 &middot; Cattura i segmenti.</span> <b>ALT + clic</b> su un segmento lo mette in lista e lo evidenzia sulla mappa (bordo scuro + tratteggio nel colore che scegli dal menu <b>Evidenzia</b>). Ri-clic lo toglie, la &times; sul chip pure, il clic sul chip lo seleziona nell'editor. Dal menu <b>Cattura</b> puoi passare a <b>ALT + MAIUSC</b> o <b>CTRL/&#8984; + ALT</b> (combinazioni scelte apposta perch&eacute; non le usano n&eacute; il WME n&eacute; gli script pi&ugrave; diffusi: MAIUSC e CTRL da soli, invece, servono al WME per la multi&#8209;selezione), alla modalit&agrave; "Sempre" o spegnerla. Cattura pochi segmenti alla volta, quelli che stai davvero guardando: cos&igrave; il confronto con i civici gi&agrave; su Waze resta valido e non rischi di dare lo stesso nome a un tratto che sul posto si chiama diversamente. I chip rossi indicano i segmenti dove l'ultimo Applica &egrave; fallito.</p>
    <p><span class="wfit-gnum">2b &middot; Il tuo tasto.</span> Se ALT ti sta scomodo, scegli <b>Un tasto a tua scelta</b> nel menu <b>Cattura</b>: compare un riquadro rosso con scritto <b>"cliccami per attivare l'ascolto del tasto"</b>. Cliccalo e premi <b>un solo tasto</b> della tastiera (uno soltanto: per ALT, MAIUSC e CTRL ci sono gi&agrave; le voci fisse del menu). Il tasto letto ti viene mostrato in attesa di conferma: <b>Conferma</b> lo salva, <b>Rifai</b> riapre l'ascolto per sceglierne un altro, ESC annulla. Da quel momento tieni premuto quel tasto e clicchi il segmento: <b>resta salvato</b> anche alle prossime sessioni. Mentre lo tieni premuto lo script blocca l'eventuale scorciatoia del WME sullo stesso tasto, cos&igrave; non fa danni: scegline comunque uno che non usi spesso, perch&eacute; i tasti singoli sono la fascia che WME, Toolbox e gli altri script si contendono. <b>Azzera</b> lo cancella e riporta tutto ad ALT + clic, che resta la scelta predefinita.</p>
    <p><span class="wfit-gnum">3 &middot; Confronta con ANNCSU.</span> Con l'<b>Auto-analisi</b> il confronto parte da solo, altrimenti premi il bottone: entro il <b>Raggio</b> scelto compaiono fino a 8 odonimi ordinati per distanza, ognuno col suo colore, con comune, localit&agrave;/contrada e numero di civici distinti. Il raggio va da <b>1 a 50 m</b> (predefinito 10): oltre i 45 m Waze rifiuta i civici, quindi un raggio pi&ugrave; largo non servirebbe. Consigliati <b>~10 m</b> in paese e in citt&agrave; (segmenti corti, vie parallele vicine) e <b>20&ndash;30 m</b> fuori dal centro abitato e nelle contrade (segmenti lunghi, edifici arretrati). Parti stretto e allarga poco per volta.</p>
    <p><span class="wfit-gnum">4 &middot; Applica i nomi.</span> Il nome &egrave; in una <b>casella modificabile</b>: correggilo secondo le linee guida (per "Strada Contrada&hellip;" c'&egrave; il link rapido "usa Contrada&hellip;") e lo script <b>impara la tua regola</b>, precompilando cos&igrave; le prossime caselle. Scegli la modalit&agrave;: <b>Dentro il centro abitato</b> (PN con citt&agrave;) o <b>Fuori centro abitato</b> (regola IT: PN senza citt&agrave; + AN con citt&agrave;). "Applica ai segmenti" tocca <b>solo ci&ograve; che differisce</b>, preserva gli alternativi esistenti e dopo ogni scrittura <b>verifica</b> che il WME abbia registrato davvero; se trova alternativi non conformi te li elenca e li rimuove <b>solo se confermi</b>. I segmenti fuori vista vengono recuperati spostando la mappa. Poi <b>salva</b>.</p>
    <p><span class="wfit-gnum">5 &middot; Numeri civici.</span> Dopo il salvataggio, <b>+N civici su Waze</b> apre l'<b>elenco di controllo</b>: clic sulla riga e la mappa si centra sul civico, il bottone con l'occhio apre <b>Street View</b>. Il numero &egrave; gi&agrave; nel formato che Waze accetta &mdash; numero pi&ugrave; al massimo due lettere minuscole, quindi <b>343/A &rarr; 343a</b> &mdash; e quelli che Waze non accetta (<b>20/1</b>, <b>12/BIS</b>) restano in lista senza spunta, da inserire a mano. Arrivano senza spunta anche: i civici <b>gi&agrave; su Waze</b> (mai reinseriti, nemmeno spuntandoli a mano), quelli oltre <b>45 m</b> dalla strada, quelli con <b>lato o sequenza insoliti</b>, e quelli il cui <b>accesso &egrave; su un'altra via</b>: per questi ultimi il bottone <b>RPP</b> crea un luogo residenziale con via, civico e punto di arrivo sull'ingresso. Ogni civico viene agganciato al segmento della sua via, e il confronto coi civici gi&agrave; presenti vale solo su ci&ograve; che l'editor ha caricato: lavora per <b>tratti brevi</b>, da vicino.</p>
    <p><span class="wfit-gnum">6 &middot; Controlla la zona.</span> Il bottone <b>Controlla la zona</b> &egrave; in <b>sola lettura</b>: non modifica nulla, colora le strade a schermo confrontandole con ANNCSU e mostra i civici del database. <b>Rosso</b> = strada senza nome (manca tutto), <b>giallo</b> = nome diverso da ANNCSU (da verificare), <b>verde</b> = nome a posto, mancano solo i civici. Le strade gi&agrave; a posto non compaiono. All'accensione lo script si porta allo <b>zoom 16</b> e da l&igrave; ti segue mentre giri la mappa; la spunta <b>"nascondi le strade che non posso modificare"</b> tiene fuori quelle bloccate sopra il tuo livello. <b>&Egrave; pensato per le zone agro e le contrade</b>, dove le strade sono poche e lunghe: in centro abitato, con la vista larga, si superano subito le <b>500 strade</b> del limite. Quel limite c'&egrave; apposta: su Waze si lavora di precisione, un tratto per volta, non a colpi di massa.</p>
    <p><span class="wfit-gnum">7 &middot; Se qualcosa viene rifiutato.</span> Lo script non pu&ograve; lavorare dove non puoi lavorare tu: se un segmento &egrave; <b>bloccato sopra il tuo livello</b> o comunque non hai i permessi per modificarlo, l'inserimento fallisce e il riepilogo te lo dice &mdash; in quel caso <b>chiedi lo sblocco (unlock) alla community</b> prima di riprovare. Gli altri casi: <b>"strada senza nome"</b> &rarr; dai prima il nome alla strada (puoi catturarla con lo script); <b>"gi&agrave; su Waze"</b> &rarr; il civico esiste gi&agrave; e non viene reinserito; <b>"gi&agrave; su Waze ma posizionato male"</b> &rarr; il numero c'&egrave; gi&agrave; su questa strada in un altro punto: trascina quello esistente sul punto giusto, non aggiungerne un altro. Negli errori del salvataggio WME: "gi&agrave; esistente" &rarr; elimina il doppione; "lato errato" o "fuori sequenza" &rarr; ricontrolla i punti e, se sono corretti sul territorio, usa <b>Salva &rarr; Forza</b>; "troppo lontano dal segmento" &rarr; piazzalo a mano vicino alla strada e trascinalo sul punto reale.</p>
    <p class="wfit-key"><span class="wfit-gnum">8 &middot; La regola pi&ugrave; importante.</span> Questo script <b>non sostituisce il lavoro umano di noi editor: lo facilita</b>. Ogni modifica apportata va controllata con i <b>cartelli stradali</b> e i <b>numeri civici reali</b> dove presenti, con la <b>conoscenza del territorio</b> da parte dell'editor e con <b>buon senso civico</b> nell'utilizzo. Lo strumento propone: la responsabilit&agrave; di ci&ograve; che finisce sulla mappa resta di chi salva.</p>
    <div class="wfit-muted">Lo script modifica solo ci&ograve; che differisce e salta ci&ograve; che &egrave; gi&agrave; a posto: <b>rivedi comunque sempre l'elenco modifiche prima di salvare</b>.</div>
    <p>&#128214; Questa &egrave; la <b>guida rapida</b>. Regole per esteso, esempi con immagini, tabella degli errori e note per gli editor sono nella ${guidaLink('<b>guida completa</b>')} del progetto.</p>
    <p>&#128172; Info, idee o problemi? Scrivimi su <b>Slack</b>: ${slackLink()}.</p>
  </details>

  <div class="wfit-foot">${logoSvg(13, 3)} <b>${SCRIPT_NAME}</b> &middot; &copy; 2026 <b>${AUTORE_FULL}</b> (${AUTORE}) &middot; codice ${codeLicLink()} &middot; dati: ${anncsuLink()} (Istat / Agenzia delle Entrate), open data con licenza ${licLink()} &middot; ${guidaLink()} &middot; info: Slack ${slackLink()}.</div>
  <div class="wfit-toast" id="wfit-toast"></div>`;

    // Raccoglie in un solo posto i riferimenti agli elementi interattivi del pannello
    function collectUi(p) {
        return {
                regione: p.querySelector('#wfit-regione'),
                scarica: p.querySelector('#wfit-scarica'),
                scaricaTutte: p.querySelector('#wfit-scarica-tutte'),
                aggiorna: p.querySelector('#wfit-aggiorna'),
                prog: p.querySelector('#wfit-prog'),
                datastatus: p.querySelector('#wfit-datastatus'),
                svuotaCache: p.querySelector('#wfit-svuota-cache'),
                capmode: p.querySelector('#wfit-capmode'),
                keyrow: p.querySelector('#wfit-keyrow'),
                keyshow: p.querySelector('#wfit-keyshow'),
                keyset: p.querySelector('#wfit-keyset'),
                keyok: p.querySelector('#wfit-keyok'),
                keyredo: p.querySelector('#wfit-keyredo'),
                keyclr: p.querySelector('#wfit-keyclr'),
                hlcolor: p.querySelector('#wfit-hlcolor'),
                selinfo: p.querySelector('#wfit-selinfo'),
                clearCap: p.querySelector('#wfit-clear-cap'),
                raggio: p.querySelector('#wfit-raggio'),
                titlecase: p.querySelector('#wfit-titlecase'),
                autoan: p.querySelector('#wfit-autoan'),
                dots: p.querySelector('#wfit-dots'),
                dotsize: p.querySelector('#wfit-dotsize'),
                dotsizerow: p.querySelector('#wfit-dotsizerow'),
                amExtra: p.querySelector('#wfit-am-extra'),
                amUrb: p.querySelector('#wfit-am-urb'),
                analizza: p.querySelector('#wfit-analizza'),
                zona: p.querySelector('#wfit-zona'),
                results: p.querySelector('#wfit-results'),
                toast: p.querySelector('#wfit-toast')
        };
    }

    // Porta nel pannello i valori salvati nelle impostazioni
    function applySettingsToUi() {
        ui.raggio.value = settings.raggio;
        ui.titlecase.checked = settings.titleCase;
        ui.capmode.value = settings.captureMode;
        ui.hlcolor.value = settings.hlColor;
        if (ui.hlcolor.value !== settings.hlColor) { settings.hlColor = '#00e5ff'; ui.hlcolor.value = settings.hlColor; }
        ui.autoan.checked = settings.autoAnalyze;
        ui.dots.checked = settings.showDots;
        ui.dotsize.value = settings.dotSize;
        if (!ui.dotsize.value) { settings.dotSize = 'normale'; ui.dotsize.value = 'normale'; }
        ui.dotsizerow.style.display = settings.showDots ? '' : 'none';
        (settings.applyMode === 'urb' ? ui.amUrb : ui.amExtra).checked = true;
        if (settings.reg) ui.regione.value = settings.reg;

    }

    // Collega ogni comando del pannello alla sua azione
    function wireUi() {
        ui.regione.addEventListener('change', () => { settings.reg = ui.regione.value; saveSettings(); });
        ui.raggio.addEventListener('change', () => {
            settings.raggio = Math.min(RAGGIO_MAX, Math.max(1, parseInt(ui.raggio.value, 10) || DEFAULT_SETTINGS.raggio));
            ui.raggio.value = settings.raggio; // il valore corretto si vede subito nella casella
            saveSettings();
        });
        ui.titlecase.addEventListener('change', () => { settings.titleCase = ui.titlecase.checked; saveSettings(); renderResults(lastResults); });
        ui.capmode.addEventListener('change', () => {
            const v = ui.capmode.value;
            if (v === 'custom') {
                // scelta "personalizzata": ci si mette subito in ascolto, senza far premere altri bottoni
                settings.captureMode = 'custom'; saveSettings(); updateKeyRow();
                startKeyRecording();
                return;
            }
            cancelKeyRecording();
            settings.captureMode = v; saveSettings(); updateKeyRow(); updateCapturedUI(); toast(capModeLabel());
        });
        ui.keyshow.addEventListener('click', armKeyListening);
        ui.keyset.addEventListener('click', () => { if (recordingKey) cancelKeyRecording('Ascolto interrotto.'); else startKeyRecording(); });
        ui.keyok.addEventListener('click', confirmKeyCombo);
        ui.keyredo.addEventListener('click', startKeyRecording);
        ui.keyclr.addEventListener('click', () => {
            pendingKey = null;
            settings.captureKey = null;
            if (settings.captureMode === 'custom') settings.captureMode = 'alt';
            saveSettings(); syncCapUI();
            toast('Tasto personalizzato azzerato: si torna ad ALT + clic.');
        });
        updateKeyRow();
        ui.hlcolor.addEventListener('change', () => { settings.hlColor = ui.hlcolor.value; saveSettings(); refreshMapLayer(); });
        ui.autoan.addEventListener('change', () => { settings.autoAnalyze = ui.autoan.checked; saveSettings(); });
        ui.dots.addEventListener('change', () => {
            settings.showDots = ui.dots.checked; saveSettings();
            ui.dotsizerow.style.display = settings.showDots ? '' : 'none';
            if (!settings.showDots) { refreshMapLayer(); return; }
            if (lastDotFeatures.length) refreshMapLayer();
            else if (captured.size && mem.n) analyze();
        });
        // La misura sta nelle proprieta' di ogni punto: per cambiarla basta ridisegnare i punti
        ui.dotsize.addEventListener('change', () => {
            settings.dotSize = DOT_SIZES[ui.dotsize.value] ? ui.dotsize.value : 'normale';
            saveSettings();
            resizeDotFeatures();
        });
        ui.amExtra.addEventListener('change', () => { if (ui.amExtra.checked) { settings.applyMode = 'extra'; saveSettings(); } });
        ui.amUrb.addEventListener('change', () => { if (ui.amUrb.checked) { settings.applyMode = 'urb'; saveSettings(); } });
        // ogni operazione sui dati fallisce allo stesso modo: messaggio + bottoni riabilitati
        const onDataError = e => { toast('Errore: ' + e.message, 8000); endBusy(); };
        ui.scarica.addEventListener('click', () => downloadRegion(ui.regione.value).catch(onDataError));
        ui.scaricaTutte.addEventListener('click', () => downloadAllRegions().catch(onDataError));
        ui.aggiorna.addEventListener('click', () => refreshDownloadedRegions().catch(onDataError));
        ui.svuotaCache.addEventListener('click', async () => {
            await idb.clear('regioni');
            rebuildMemory([]);
            markUpdateDue([]);
            status('Dati locali eliminati.');
        });
        ui.clearCap.addEventListener('click', () => { captured.clear(); lastFailedIds.clear(); updateCapturedUI(); clearResultsUI(); });
        ui.analizza.addEventListener('click', analyze);
        zonaSoloMie = settings.zonaSoloMie !== false;
        ui.zona.addEventListener('click', () => { if (zonaAttiva) spegniZona(); else controllaZona(); });
    }

    async function buildTab() {
        const { tabLabel, tabPane } = await sdk.Sidebar.registerScriptTab();
        tabLabel.innerHTML = `${LOGO_SVG} <span>Fonti IT</span>`;
        tabLabel.title = SCRIPT_NAME;

        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        const p = document.createElement('div');
        p.id = 'wfit-panel';
        p.innerHTML = `
  <div class="wfit-head">${logoSvg(30, 8)}<div><div class="t">${SCRIPT_NAME}</div><div class="by">Civici e odonimi ufficiali ANNCSU &middot; a cura di ${AUTORE}</div></div><span class="wfit-ver">v${VERSION}</span></div>
  <div class="wfit-sec"><div class="wfit-muted">Verifica dell'abilitazione in corso&hellip;</div></div>`;
        tabPane.appendChild(p);
        panelEl = p;
    }

    // Il pannello vero e proprio: viene montato solo a verifica superata
    function mountPanel() {
        panelEl.innerHTML = PANEL_HTML;
        ui = collectUi(panelEl);
        applySettingsToUi();
        wireUi();
    }

    function toast(msg, ms = 4000) {
        if (!ui.toast) return;
        ui.toast.textContent = msg;
        ui.toast.style.display = 'block';
        clearTimeout(ui.toast._t);
        ui.toast._t = setTimeout(() => { ui.toast.style.display = 'none'; }, ms);
    }
    function status(html) { if (ui.datastatus) ui.datastatus.innerHTML = html; }
    function setProgress(pct) {
        if (!ui.prog) return;
        if (pct == null) { ui.prog.style.display = 'none'; return; }
        ui.prog.style.display = 'block';
        ui.prog.value = Math.max(0, Math.min(100, Math.round(pct)));
    }
    const dlButtons = () => [ui.scarica, ui.scaricaTutte, ui.aggiorna, ui.svuotaCache].filter(Boolean);
    function beginBusy() { busy = true; dlButtons().forEach(b => { b.disabled = true; }); }
    function endBusy() {
        busy = false;
        batchRunning = false; abortBatch = false;
        dlButtons().forEach(b => { b.disabled = false; });
        if (ui.scaricaTutte) ui.scaricaTutte.textContent = 'Scarica tutte';
        if (ui.aggiorna) ui.aggiorna.textContent = 'Aggiorna';
        setProgress(null);
    }
    const fmtN = n => n.toLocaleString('it-IT');

    // Riepilogo "Regione: DD/MM/AAAA" per le regioni di cui conosciamo la data del dataset
    function regionsDateLabel(regs) {
        const withDate = regs.filter(r => r.fileDate);
        if (!withDate.length) return '';
        return ' &middot; dataset del: ' + withDate.map(r => `${r.nomeReg || r.reg} ${r.fileDate}`).join(', ');
    }

    // Data del dataset + giorni trascorsi dal TUO scarico, per ogni regione, SEMPRE mostrati
    // (non solo oltre soglia): il numero lo vedi comunque, il colore/grassetto scatta solo
    // oltre STALE_DAYS come promemoria visivo. Nessuno scarico automatico: decidi tu leggendo il numero.
    function regionsFreshnessLabel(regs) {
        const parts = regs.map(r => {
            const bits = [];
            if (r.fileDate) bits.push(`dataset del ${r.fileDate}`);
            if (r.quando) {
                const giorni = Math.floor((Date.now() - r.quando) / 86400000);
                const txt = `scaricata ${giorni} ${pl(giorni, 'giorno', 'giorni')} fa`;
                bits.push(giorni > STALE_DAYS ? `<b style="color:#b36b00">${txt}</b>` : txt);
            }
            if (!bits.length) return r.nomeReg || r.reg;
            return `${r.nomeReg || r.reg} (${bits.join(', ')})`;
        });
        return parts.length ? ' &middot; ' + parts.join('; ') : '';
    }

    /* ------------------------------------------------------------------ */
    /* Elenco comuni ISTAT (solo per tradurre Belfiore -> nome comune)     */
    /* ------------------------------------------------------------------ */

    // Aggiornamento facoltativo dell'elenco comuni: prova ISTAT, poi il mirror GitHub.
    // Se entrambi falliscono non importa: data/comuni.json copre gia' tutti i comuni.
    async function loadIstat() {
        try {
            const cached = await idb.get('meta', 'istat');
            if (cached && cached.rows && cached.rows.length) {
                for (const [b, n] of cached.rows) belNome.set(b, n);
                return;
            }
            let rows = null;
            try {
                const buf = await gmFetchBinary(ISTAT_COMUNI);
                let text = new TextDecoder('utf-8').decode(buf);
                if (/\u00c3[\u0080-\u00bf]/.test(text) || text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(buf);
                const lines = text.split(/\r?\n/);
                const head = (lines[0] || '').toLowerCase().split(';');
                const iBel = head.findIndex(h => h.includes('catastale'));
                let iNome = head.findIndex(h => h.includes('denominazione in italiano'));
                if (iNome < 0) iNome = head.findIndex(h => h.includes('denominazione'));
                if (iBel < 0 || iNome < 0) throw new Error('intestazione non riconosciuta');
                rows = [];
                for (let i = 1; i < lines.length; i++) {
                    const f = lines[i].split(';');
                    const bel = (f[iBel] || '').trim().toUpperCase();
                    if (/^[A-Z]\d{3}$/.test(bel)) rows.push([bel, (f[iNome] || '').trim()]);
                }
                if (!rows.length) throw new Error('elenco vuoto');
            } catch (e1) {
                const buf = await gmFetchBinary('https://raw.githubusercontent.com/matteocontrini/comuni-json/master/comuni.json');
                const arr = JSON.parse(new TextDecoder('utf-8').decode(buf));
                rows = arr.filter(c => /^[A-Z]\d{3}$/.test(c.codiceCatastale || ''))
                    .map(c => [c.codiceCatastale.toUpperCase(), c.nome]);
                if (!rows.length) throw e1;
            }
            for (const [b, n] of rows) belNome.set(b, n);
            await idb.put('meta', { k: 'istat', rows, quando: Date.now() });
            log(`elenco comuni aggiornato online: ${rows.length}`);
        } catch (e) {
            log('aggiornamento comuni non riuscito (resta quello di data/comuni.json):', e.message);
        }
    }

    /* ------------------------------------------------------------------ */
    /* Download regione + parsing in indice compatto                       */
    /* ------------------------------------------------------------------ */

    // Scarica + elabora UNA regione e la salva in IndexedDB. Non tocca busy ne' la memoria:
    // cosi' la stessa funzione serve sia al singolo scarico sia ai cicli su piu' regioni.
    // onProgress(frazione 0..1, testo) permette al chiamante di comporre una barra complessiva.
    async function fetchRegionRecord(reg, onProgress) {
        const nome = regNome(reg);
        const buf = await gmFetchBinary(ANNCSU_DL + reg,
            p => onProgress(p * 0.45, `Scarico indirizzario ${nome}\u2026 ${Math.round(p * 100)}%`));
        onProgress(0.45, `Elaboro ${nome}\u2026`);

        // Nome del file CSV dentro lo ZIP: l'Agenzia ci scrive la data di creazione dell'estratto
        // (non e' una colonna del CSV, va letta li'). Se il pattern cambia, il nome grezzo resta in console.
        let fileName = null, fileDate = null;
        try {
            const u8peek = new Uint8Array(buf);
            if (u8peek.length > 4 && u8peek[0] === 0x50 && u8peek[1] === 0x4b) {
                fileName = findZipEntry(u8peek).name;
                fileDate = extractDateFromFilename(fileName);
            }
        } catch { /* niente data, non e' bloccante */ }
        log('file dentro lo zip:', fileName, '\u00b7 data riconosciuta:', fileDate || '(pattern non riconosciuto)');

        const rec = await parseIndirToRecord(new Uint8Array(buf), reg, nome,
            (p, read, kept) => onProgress(0.45 + p * 0.55, `Elaboro ${nome}\u2026 ${Math.round(p * 100)}% &middot; lette ${fmtN(read)} &middot; con coordinate ${fmtN(kept)}`));
        rec.fileDate = fileDate;
        if (rec.count) await idb.put('regioni', rec);
        return rec;
    }

    function readyStatus(regs) {
        markUpdateDue(regs);
        const mb = (mem.n * BYTES_PER_CIVICO / 1048576).toFixed(0);
        status(`Pronto: <b>${fmtN(mem.n)}</b> civici in memoria (~${mb} MB, ${regs.map(r => r.nomeReg || r.reg).join(', ')}).${regionsDateLabel(regs)} Cache locale: al prossimo avvio &egrave; gi&agrave; tutto caricato.`);
    }

    async function downloadRegion(reg) {
        if (busy) return;
        beginBusy();
        const rec = await fetchRegionRecord(reg, (f, txt) => { setProgress(f * 100); status(txt); });
        if (!rec.count) {
            status(`<span style="color:#c00">Nessun civico con coordinate riconosciuto in ${regNome(reg)}.</span> Prima riga del file (per diagnosi) in console.`);
            log('DIAGNOSI prima riga dati:', rec.diag || '(vuota)');
            endBusy();
            return;
        }
        const regs = await idb.all('regioni');
        rebuildMemory(regs);
        endBusy();
        readyStatus(regs);
        toast(`${regNome(reg)}: ${fmtN(rec.count)} civici georiferiti, ${fmtN(rec.groups.length)} odonimi.` + (rec.fileDate ? ` Dataset del ${rec.fileDate}.` : ''));
    }

    // Ciclo su piu' regioni: una alla volta, con barra complessiva e possibilita' di fermarsi.
    // La memoria viene ricostruita una volta sola alla fine, non a ogni regione.
    async function downloadRegions(list, titolo, btn) {
        if (busy || !list.length) return;
        beginBusy();
        batchRunning = true; abortBatch = false;
        if (btn) { btn.disabled = false; btn.textContent = 'Ferma'; }
        const ok = [], ko = [];
        for (let i = 0; i < list.length; i++) {
            if (abortBatch) break;
            const reg = list[i];
            const capo = `${titolo} ${i + 1}/${list.length}`;
            try {
                const rec = await fetchRegionRecord(reg, (f, txt) => {
                    setProgress(((i + f) / list.length) * 100);
                    status(`${capo} &middot; ${txt}`);
                });
                if (rec.count) ok.push(regNome(reg)); else ko.push(regNome(reg));
            } catch (e) {
                ko.push(regNome(reg));
                log(`regione ${reg} KO:`, e && e.message);
            }
            await tick();
        }
        const fermato = abortBatch;
        const regs = await idb.all('regioni');
        rebuildMemory(regs);
        endBusy();
        readyStatus(regs);
        let msg = fermato ? 'Fermato dall\'utente. ' : '';
        msg += `${ok.length} ${pl(ok.length, 'regione', 'regioni')} a posto`;
        if (ko.length) msg += `, ${ko.length} ${pl(ko.length, 'non riuscita', 'non riuscite')}: ${ko.join(', ')} (riprova singolarmente)`;
        toast(msg + '.', ko.length ? 12000 : 7000);
    }

    // Richiesta di stop: il ciclo si ferma dopo la regione che sta elaborando (quella non si butta via)
    function stopBatch(btn) {
        abortBatch = true;
        if (btn) { btn.textContent = 'Mi fermo\u2026'; btn.disabled = true; }
        toast('Mi fermo appena finisce la regione in corso.', 6000);
    }

    async function downloadAllRegions() {
        if (busy) { if (batchRunning) stopBatch(ui.scaricaTutte); return; }
        const conferma = confirm(
            'Scarico tutte e 20 le regioni, una dopo l\'altra.\n\n' +
            'Ci vogliono alcuni minuti e i dati occupano parecchio spazio fra cache locale e memoria ' +
            'del browser. Se ti servono poche zone, conviene scaricare le singole regioni.\n\n' +
            'Puoi fermarti quando vuoi con il tasto "Ferma".\n\nVuoi procedere?'
        );
        if (!conferma) return;
        await downloadRegions(REGIONI.map(r => r[0]), 'Scarico tutte le regioni', ui.scaricaTutte);
    }

    async function refreshDownloadedRegions() {
        if (busy) { if (batchRunning) stopBatch(ui.aggiorna); return; }
        const regs = await idb.all('regioni');
        const list = regs.map(r => r.reg).filter(Boolean);
        if (!list.length) { toast('Non hai ancora nessuna regione in locale: scaricane una con "Scarica regione".', 7000); return; }
        await downloadRegions(list, 'Aggiorno le regioni scaricate', ui.aggiorna);
    }

    // Legge lo ZIP (o CSV) e produce un record compatto: Float32 lon/lat + id gruppo per civico,
    // gruppi = odonimi distinti {den, loc, bel}.
    // Accumulatore in blocchi tipizzati: evita milioni di Number JS durante il parsing
    function growBuf(Type) {
        return {
            blocks: [], cur: new Type(131072), len: 0, total: 0,
            push(v) {
                if (this.len === this.cur.length) { this.blocks.push(this.cur); this.cur = new Type(131072); this.len = 0; }
                this.cur[this.len++] = v; this.total++;
            },
            done() {
                const out = new Type(this.total);
                let o = 0;
                for (const b of this.blocks) { out.set(b, o); o += b.length; }
                out.set(this.cur.subarray(0, this.len), o);
                this.blocks = []; this.cur = null;
                return out;
            }
        };
    }

    // Dizionario compatto testo -> indice (l'indice 0 e' sempre la stringa vuota).
    // Serve sia in fase di parsing sia quando si fondono piu' regioni in memoria.
    function interner(limit) {
        const list = [''];
        const map = new Map([['', 0]]);
        return {
            list,
            index(v) {
                if (!v) return 0;
                let i = map.get(v);
                if (i === undefined) {
                    // con gli esponenti numerici (20/1 ... 20/240) una regione supera facilmente i 255
                    // valori distinti: oltre il tetto l'esponente si perdeva e il civico diventava nudo
                    if (list.length >= limit) return 0;
                    i = list.length; list.push(v); map.set(v, i);
                }
                return i;
            }
        };
    }

    async function parseIndirToRecord(u8, reg, nomeReg, onProgress) {
        const lons = growBuf(Float32Array), lats = growBuf(Float32Array),
            gids = growBuf(Uint32Array), civn = growBuf(Uint16Array), cive = growBuf(Uint16Array);
        const groups = [];
        const gmap = new Map();
        const espDict = interner(65535);  // dizionario esponenti: indice 0 = nessuno
        const esps = espDict.list;
        let mapping = null, read = 0, diag = '', firstLine = true;
        // controllo di sanita' sulla colonna esponente: se quasi tutti i civici ne hanno uno,
        // quasi certamente stiamo leggendo la colonna sbagliata (un progressivo, un codice) e
        // ogni civico si ritroverebbe un "/n" che nella realta' non esiste
        let withEsp = 0; const espTally = new Map(); let mapSource = '?';

        const handleLine = line => {
            if (!line || line.length < 5) return;
            const f = line.split(';');
            if (f.length < 5) return;
            if (!mapping) {
                if (firstLine) {
                    firstLine = false;
                    const hm = detectHeaderMapping(f);
                    if (hm) { mapping = hm; mapSource = 'intestazione ufficiale'; log('mappatura da intestazione ufficiale:', JSON.stringify(hm)); return; }
                }
                mapping = detectMapping(f);
                if (!mapping) { if (!diag) diag = line.slice(0, 300); return; }
                mapSource = 'euristica (nessuna intestazione)'; log('mappatura euristica:', JSON.stringify(mapping));
            }
            read++;
            const lon = parseItFloat(f[mapping.lon]);
            const lat = parseItFloat(f[mapping.lat]);
            if (!isFinite(lon) || !isFinite(lat) || lon < 6 || lon > 19 || lat < 35 || lat > 48) return;
            const den = (f[mapping.den] || '').trim();
            if (!den) return;
            const bel = (f[mapping.bel] || '').trim().toUpperCase();
            const loc = mapping.loc >= 0 ? (f[mapping.loc] || '').trim() : '';
            const key = bel + '|' + den + '|' + loc;
            let g = gmap.get(key);
            if (g === undefined) { g = groups.length; gmap.set(key, g); groups.push([den, loc, bel]); }
            lons.push(lon); lats.push(lat); gids.push(g);

            let nc = 0, es = '';
            if (mapping.civ >= 0) {
                const raw = (f[mapping.civ] || '').trim();
                nc = parseInt(raw, 10);
                if (!isFinite(nc) || nc < 0 || nc > 65535) nc = 0;
                const emb = /\/\s*([A-Za-z0-9]{1,4})\s*$/.exec(raw); // es. "21/A" tutto in un campo
                if (emb) es = emb[1].toUpperCase();
            }
            if (!es && mapping.esp >= 0) es = (f[mapping.esp] || '').trim().toUpperCase();
            civn.push(nc);
            cive.push(espDict.index(es));
            if (es) { withEsp++; espTally.set(es, (espTally.get(es) || 0) + 1); }
        };

        const isZip = u8.length > 4 && u8[0] === 0x50 && u8[1] === 0x4b;
        if (isZip) await zipCsvLines(u8, handleLine, p => onProgress && onProgress(p, read, lons.total));
        else await plainCsvLines(u8, handleLine, p => onProgress && onProgress(p, read, lons.total));

        // referto sulla colonna esponente, visibile nel log: serve a smascherare subito una
        // colonna letta male, che altrimenti si nota solo civico per civico sulla mappa
        const tot = lons.total || 1;
        const quota = withEsp / tot;
        const topEsp = [...espTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
            .map(([v, n]) => `${v} (${n})`).join(', ');
        log(`esponenti: ${withEsp} civici su ${tot} (${(quota * 100).toFixed(1)}%) \u2014 mappatura ${mapSource}` +
            (topEsp ? ` \u2014 piu' frequenti: ${topEsp}` : ' \u2014 nessuno'));
        if (quota > 0.5) {
            log(`ATTENZIONE: piu' di meta' dei civici risulta avere un esponente. E' molto probabile che ` +
                `la colonna letta come ESPONENTE sia in realta' un'altra (progressivo o codice interno). ` +
                `Controlla i valori qui sopra: se sono numeri consecutivi e non lettere, segnala il problema.`);
        }
        return {
            reg, nomeReg, quando: Date.now(), count: lons.total, read, diag, pv: 9,
            espShare: quota, espTop: topEsp,
            lons: lons.done().buffer,
            lats: lats.done().buffer,
            gids: gids.done().buffer,
            civn: civn.done().buffer,
            cive: cive.done().buffer,
            esps,
            groups
        };
    }

    // Spezza in righe un flusso di testo che arriva a pezzi, tenendo da parte la riga
    // a cavallo fra un pezzo e il successivo. La usano sia il CSV nudo sia lo ZIP.
    function lineFeeder(onLine) {
        const dec = new TextDecoder('utf-8');
        let carry = '';
        return {
            feed(chunk, last) {
                const lines = (carry + dec.decode(chunk, { stream: !last })).split(/\r?\n/);
                carry = lines.pop();
                for (const l of lines) onLine(l);
            },
            end() {
                carry += dec.decode();
                if (carry) for (const l of carry.split(/\r?\n/)) onLine(l);
                carry = '';
            }
        };
    }

    async function plainCsvLines(u8, onLine, onProgress) {
        const feeder = lineFeeder(onLine);
        const STEP = 8 * 1024 * 1024;
        for (let off = 0; off < u8.length; off += STEP) {
            const last = off + STEP >= u8.length;
            feeder.feed(u8.subarray(off, off + STEP), last);
            if (last) feeder.end();
            onProgress && onProgress(Math.min(u8.length, off + STEP) / u8.length);
            await tick();
        }
    }

    /* ------------------------------------------------------------------ */
    /* Lettore ZIP autonomo (niente librerie esterne):                     */
    /* central directory + DecompressionStream('deflate-raw')              */
    /* ------------------------------------------------------------------ */

    // La data del dataset non e' una colonna del CSV: l'Agenzia la scrive nel NOME del file
    // dentro lo ZIP. Proviamo i pattern piu' comuni; se nessuno combacia restituiamo null
    // (il nome grezzo resta comunque in console per una verifica manuale).
    function extractDateFromFilename(name) {
        if (!name) return null;
        let m = /(20\d{2})[-_]?(0[1-9]|1[0-2])[-_]?(0[1-9]|[12]\d|3[01])(?!\d)/.exec(name);
        if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        m = /(0[1-9]|[12]\d|3[01])[-_]?(0[1-9]|1[0-2])[-_]?(20\d{2})(?!\d)/.exec(name);
        if (m) return `${m[1]}/${m[2]}/${m[3]}`;
        return null;
    }

    function findZipEntry(u8) {
        const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
        // End Of Central Directory: firma 0x06054b50, cercata dalla fine
        let eocd = -1;
        const min = Math.max(0, u8.length - 66000);
        for (let i = u8.length - 22; i >= min; i--) {
            if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
        }
        if (eocd < 0) throw new Error('ZIP non valido (EOCD mancante)');
        const cdCount = dv.getUint16(eocd + 10, true);
        let off = dv.getUint32(eocd + 16, true);
        if (off === 0xFFFFFFFF) throw new Error('ZIP64 non supportato');
        let best = null;
        const td = new TextDecoder('utf-8');
        for (let k = 0; k < cdCount; k++) {
            if (dv.getUint32(off, true) !== 0x02014b50) break;
            const method = dv.getUint16(off + 10, true);
            const compSize = dv.getUint32(off + 20, true);
            const nameLen = dv.getUint16(off + 28, true);
            const extraLen = dv.getUint16(off + 30, true);
            const commLen = dv.getUint16(off + 32, true);
            const lho = dv.getUint32(off + 42, true);
            const name = td.decode(u8.subarray(off + 46, off + 46 + nameLen));
            if (/\.(csv|txt)$/i.test(name) && (!best || compSize > best.compSize)) {
                best = { name, method, compSize, lho };
            }
            off += 46 + nameLen + extraLen + commLen;
        }
        if (!best) throw new Error('nessun CSV dentro lo ZIP');
        if (best.compSize === 0xFFFFFFFF) throw new Error('ZIP64 non supportato');
        // Local header: dove iniziano davvero i dati compressi
        if (dv.getUint32(best.lho, true) !== 0x04034b50) throw new Error('ZIP non valido (local header)');
        const nl = dv.getUint16(best.lho + 26, true);
        const el = dv.getUint16(best.lho + 28, true);
        best.dataStart = best.lho + 30 + nl + el;
        return best;
    }

    async function zipCsvLines(u8, onLine, onProgress) {
        const e = findZipEntry(u8);
        const comp = u8.subarray(e.dataStart, e.dataStart + e.compSize);
        if (e.method === 0) { await plainCsvLines(comp, onLine, onProgress); return; }
        if (e.method !== 8) throw new Error('compressione ZIP non supportata (metodo ' + e.method + ')');
        if (typeof DecompressionStream === 'undefined') throw new Error('browser troppo vecchio: manca DecompressionStream');

        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        const reader = ds.readable.getReader();
        const STEP = 1024 * 1024;
        // alimenta lo stream in background (con backpressure)
        const feeding = (async () => {
            for (let off = 0; off < comp.length; off += STEP) {
                await writer.write(comp.subarray(off, Math.min(comp.length, off + STEP)));
                onProgress && onProgress(Math.min(1, (off + STEP) / comp.length));
            }
            await writer.close();
        })();

        const feeder = lineFeeder(onLine);
        let chunks = 0;
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            feeder.feed(value, false);
            if ((++chunks & 15) === 0) await tick();
        }
        feeder.end();
        await feeding;
    }

    /* ------------------------------------------------------------------ */
    /* Parsing riga ANNCSU                                                 */
    /* ------------------------------------------------------------------ */

    function parseItFloat(s) {
        if (s == null) return NaN;
        return parseFloat(String(s).trim().replace(',', '.'));
    }

    // Mappatura dall'intestazione ufficiale del file INDIR (schema reale:
    // CODICE_COMUNE;CODICE_ISTAT;PROGRESSIVO_NAZIONALE;CODICE_COMUNALE;ODONIMO;LOCALITA';
    // DIZIONE_LINGUA1;DIZIONE_LINGUA2;PROGRESSIVO_ACCESSO;CODICE_COMUNALE_ACCESSO;CIVICO;
    // ESPONENTE;SPECIFICITA;METRICO;COORD_X_COMUNE;COORD_Y_COMUNE;QUOTA;METODO)
    function detectHeaderMapping(f) {
        const norm = f.map(s => String(s || '').replace(/["'\s]/g, '').toUpperCase());
        const find = pred => norm.findIndex(pred);
        const m = {
            bel: find(h => h === 'CODICE_COMUNE' || h === 'CODICE_BELFIORE' || h === 'CODICEBELFIORE'),
            den: find(h => h === 'ODONIMO' || h === 'DENOMINAZIONE'),
            loc: find(h => h.startsWith('LOCALITA') || h.startsWith('DENOMINAZIONE_LOCALITA')),
            civ: find(h => h === 'CIVICO'),
            esp: find(h => h === 'ESPONENTE'),
            lon: find(h => h.startsWith('COORD_X') || h === 'LON' || h === 'LONGITUDE'),
            lat: find(h => h.startsWith('COORD_Y') || h === 'LAT' || h === 'LATITUDE')
        };
        if (m.bel < 0 || m.den < 0 || m.lon < 0 || m.lat < 0) return null;
        // completa i campi mancanti dalla posizione canonica dello schema ufficiale
        if (m.loc < 0 && m.den + 1 < m.lon) m.loc = m.den + 1;              // LOCALITA' segue ODONIMO
        if (m.civ >= 0 && m.esp < 0 && m.civ + 1 < m.lon) m.esp = m.civ + 1; // ESPONENTE segue CIVICO
        return m;
    }

    function detectMapping(f) {
        let bel = -1, lon = -1, lat = -1;
        for (let i = 0; i < f.length; i++) {
            if (bel < 0 && /^[A-Z]\d{3}$/.test((f[i] || '').trim().toUpperCase())) bel = i;
        }
        for (let i = 0; i < f.length - 1; i++) {
            const a = parseItFloat(f[i]), b = parseItFloat(f[i + 1]);
            if (isFinite(a) && isFinite(b) && a >= 6 && a <= 19 && b >= 35 && b <= 48) { lon = i; lat = i + 1; break; }
            if (isFinite(a) && isFinite(b) && b >= 6 && b <= 19 && a >= 35 && a <= 48) { lat = i; lon = i + 1; break; }
        }
        if (bel < 0 || lon < 0) return null;
        let den = -1, best = 0;
        for (let i = bel + 1; i < lon; i++) {
            const v = (f[i] || '').trim();
            if (!v || /^\d+$/.test(v)) continue;
            let score = v.length + (/\s/.test(v) ? 10 : 0) +
                (/^(VIA|VIALE|VICOLO|PIAZZA|PIAZZALE|CORSO|CONTRADA|C\.DA|LARGO|STRADA|LOCALITA|LOCALIT\u00c0|TRAVERSA|SALITA|DISCESA|BORGO|FRAZIONE|LUNGOMARE|RAMPA|CALATA|VILLAGGIO|REGIONE|SS|SP|SR|SC)\b/i.test(v) ? 40 : 0);
            if (score > best) { best = score; den = i; }
        }
        if (den < 0) return null;
        const loc = (den + 1 < lon && !/^\d+$/.test((f[den + 1] || '').trim())) ? den + 1 : -1;
        let civ = -1;
        for (let i = Math.max(den + 1, loc + 1); i < lon; i++) {
            const v = (f[i] || '').trim();
            if (v && /^\d{1,5}[A-Z]?(\/[A-Z0-9]+)?$/i.test(v)) { civ = i; break; }
        }
        // Esponente nel riconoscimento EURISTICO (solo quando manca l'intestazione ufficiale):
        // qui accettiamo esclusivamente lettere ("A", "BIS") o campo vuoto. Accettare anche le cifre
        // sarebbe comodo per 20/1 e 20/2, ma da una riga sola non si distingue un vero esponente
        // numerico da una colonna qualsiasi di numeri (progressivo, codice interno): il risultato
        // sarebbe appiccicare un "/n" a ogni civico. Gli esponenti numerici arrivano comunque
        // corretti dalla colonna ESPONENTE quando il file ha l'intestazione, che e' il caso normale.
        let esp = -1;
        if (civ >= 0 && civ + 1 < lon) {
            const v = (f[civ + 1] || '').trim();
            if (v === '' || /^[A-Za-z]{1,4}$/.test(v)) esp = civ + 1;
        }
        return { bel, den, loc, civ, esp, lon, lat };
    }

    /* ------------------------------------------------------------------ */
    /* Memoria unificata + griglia spaziale                                */
    /* ------------------------------------------------------------------ */

    function rebuildMemory(regionRecords) {
        let total = 0;
        for (const r of regionRecords) total += r.count;
        const lons = new Float32Array(total);
        const lats = new Float32Array(total);
        const gids = new Uint32Array(total);
        const civn = new Uint16Array(total);
        const cive = new Uint16Array(total);
        const groups = [];
        const espDict = interner(65535);
        const esps = espDict.list;
        let base = 0;
        for (const r of regionRecords) {
            const gOff = groups.length;
            for (const g of r.groups) groups.push([g[0], g[1], g[2], r.fileDate || null]);
            lons.set(new Float32Array(r.lons), base);
            lats.set(new Float32Array(r.lats), base);
            if (r.civn) civn.set(new Uint16Array(r.civn), base);
            // rimappa gli esponenti locali del record sul dizionario globale
            let emapLocal = null;
            if (r.cive && r.esps) {
                emapLocal = r.esps.map(v => espDict.index(v));
                const rc = new Uint16Array(r.cive);
                for (let i = 0; i < rc.length; i++) cive[base + i] = emapLocal[rc[i]] || 0;
            }
            const rg = new Uint32Array(r.gids);
            for (let i = 0; i < rg.length; i++) gids[base + i] = rg[i] + gOff;
            base += r.count;
        }
        mem = { n: total, lons, lats, gids, civn, cive, esps, groups };
        grid = new Map();
        for (let i = 0; i < total; i++) gridAdd(lons[i], lats[i], i);
        lastDotFeatures = [];
        refreshMapLayer();
        log(`indice ricostruito: ${total} civici, ${groups.length} odonimi, ${esps.length - 1} esponenti distinti, ${grid.size} celle`);
    }

    function gridKey(lon, lat) { return Math.floor(lon / GRID_CELL) + '_' + Math.floor(lat / GRID_CELL); }
    function gridAdd(lon, lat, idx) {
        const k = gridKey(lon, lat);
        let a = grid.get(k);
        if (!a) { a = []; grid.set(k, a); }
        a.push(idx);
    }
    // Scorre gli indici dei civici che cadono nel riquadro, cella per cella.
    // A callback invece che con un array: su una citta' densa l'elenco dei candidati e'
    // enorme e "out.push(...a)" era sia lento sia a rischio di stack overflow.
    function gridForEachInBBox(minLon, minLat, maxLon, maxLat, cb) {
        const x0 = Math.floor(minLon / GRID_CELL), x1 = Math.floor(maxLon / GRID_CELL);
        const y0 = Math.floor(minLat / GRID_CELL), y1 = Math.floor(maxLat / GRID_CELL);
        for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
            const a = grid.get(x + '_' + y);
            if (!a) continue;
            for (let k = 0; k < a.length; k++) cb(a[k]);
        }
    }

    /* ------------------------------------------------------------------ */
    /* Rete                                                                */
    /* ------------------------------------------------------------------ */

    function gmFetchBinary(url, onProgress, timeoutMs = 600000) {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== 'function') { reject(new Error('GM_xmlhttpRequest non disponibile')); return; }
            GM_xmlhttpRequest({
                method: 'GET', url, responseType: 'arraybuffer', timeout: timeoutMs,
                onprogress: e => { if (onProgress && e.total) onProgress(e.loaded / e.total); },
                onload: r => (r.status >= 200 && r.status < 300) ? resolve(r.response) : reject(new Error('HTTP ' + r.status)),
                onerror: () => reject(new Error('errore di rete')),
                ontimeout: () => reject(new Error('timeout'))
            });
        });
    }

    /* ------------------------------------------------------------------ */
    /* Selezione: cattura/toggle senza cambio pannello                     */
    /* ------------------------------------------------------------------ */

    function getSelectedSegmentIds() {
        try {
            const sel = sdk.Editing.getSelection();
            return (sel && sel.objectType === 'segment' && sel.ids && sel.ids.length) ? sel.ids.slice() : [];
        } catch { return []; }
    }

    // Dopo ogni cattura la selezione del WME va svuotata: se resta, il pannello del segmento
    // rimane aperto e un nuovo clic sullo stesso segmento non genera nessun evento, quindi non
    // si potrebbe piu' togliere dalla lista. Si prova l'SDK e si VERIFICA che abbia funzionato;
    // solo se nessun metodo dell'SDK ci riesce si usa il WME direttamente (e lo si scrive nel log).
    let clearWay = '';
    const selectionEmpty = () => getSelectedSegmentIds().length === 0;
    async function clearWmeSelection() {
        if (selectionEmpty()) return true;
        const ways = [
            ['sdk.clearSelection', () => sdk.Editing.clearSelection()],
            ['sdk.setSelection', () => sdk.Editing.setSelection({ selection: { ids: [], objectType: 'segment' } })],
            ['wme.unselectAll', () => {
                const W = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).W;
                W.selectionManager.unselectAll();
            }]
        ];
        for (const [nome, fn] of ways) {
            try { fn(); } catch { continue; }
            await sleep(40);   // il WME aggiorna la selezione un attimo dopo
            if (selectionEmpty()) {
                if (clearWay !== nome) { clearWay = nome; log('deselezione riuscita con', nome); }
                return true;
            }
        }
        log('deselezione non riuscita: premi Esc per chiudere il pannello del segmento');
        return false;
    }

    // Combinazioni di modificatori delle modalita' fisse. Sono scelte apposta fra quelle che il WME
    // NON usa (MAIUSC e CTRL da soli servono alla multi-selezione) e che non si accavallano con le
    // scorciatoie degli script piu' diffusi, che lavorano quasi sempre a tasto singolo.
    const MODE_MODS = {
        alt: { alt: true, shift: false, ctrl: false },
        altshift: { alt: true, shift: true, ctrl: false },
        ctrlalt: { alt: true, shift: false, ctrl: true }
    };
    const MODE_TXT = {
        alt: 'ALT',
        altshift: 'ALT + MAIUSC',
        ctrlalt: 'CTRL/\u2318 + ALT'
    };
    // corrispondenza ESATTA: cosi' ALT+MAIUSC non fa scattare per sbaglio la modalita' ALT
    function modsMatch(m, e) {
        return !!m.alt === !!e.alt && !!m.shift === !!e.shift && !!m.ctrl === !!e.ctrl;
    }

    let lastMouse = { alt: false, shift: false, ctrl: false, custom: false, t: 0 };
    let suppressUntil = 0;

    /* ------------------------------------------------------------------ */
    /* Tasto di cattura personalizzato                                     */
    /* ------------------------------------------------------------------ */
    // ALT resta il default: qui l'editor puo' registrare UN SOLO tasto della tastiera, che viene
    // salvato in locale e da quel momento vale sempre (anche ai riavvii del browser). Un tasto solo,
    // non combinazioni: e' quello che si tiene premuto mentre si clicca il segmento.

    const heldKeys = new Set();       // tasti fisici attualmente premuti (e.code)
    let recordingKey = false;         // true mentre si aspetta il tasto da registrare
    let listenArmed = false;          // true dopo il clic sul badge: solo allora si legge la tastiera
    let pendingKey = null;            // tasto letto ma non ancora confermato dall'editor

    // Ripulisce il tasto salvato: deve essere UN tasto solo, mai un modificatore.
    function normKeyChoice(k) {
        if (!k || typeof k !== 'object') return null;
        const code = k.code;
        if (!code || MOD_CODES.test(code)) return null;
        return { code, name: k.name || codeName(code, '') };
    }

    // Etichetta leggibile del tasto: "Q", "F2", "SPAZIO"...
    function keyLabel(k) {
        return (k && k.name) ? k.name : 'nessuno';
    }

    // Nome breve del tasto fisico, indipendente dalla lingua della tastiera
    function codeName(code, key) {
        if (!code) return '';
        let m = /^Key([A-Z])$/.exec(code); if (m) return m[1];
        m = /^Digit(\d)$/.exec(code); if (m) return m[1];
        m = /^Numpad(\d)$/.exec(code); if (m) return 'Num' + m[1];
        m = /^(F\d{1,2})$/.exec(code); if (m) return m[1];
        if (code === 'Space') return 'SPAZIO';
        if (code === 'Backquote') return '`';
        if (code === 'Minus') return '-';
        if (code === 'Equal') return '=';
        if (code === 'BracketLeft') return '[';
        if (code === 'BracketRight') return ']';
        if (code === 'Backslash') return '\\';
        if (code === 'Semicolon') return ';';
        if (code === 'Quote') return "'";
        if (code === 'Comma') return ',';
        if (code === 'Period') return '.';
        if (code === 'Slash') return '/';
        if (code === 'CapsLock') return 'BLOC MAIUSC';
        const k = String(key || '').trim();
        return k && k.length <= 12 ? k.toUpperCase() : code;
    }

    function isTypingTarget(el) {
        if (!el) return false;
        const t = (el.tagName || '').toUpperCase();
        return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || el.isContentEditable === true;
    }

    // Il tasto registrato e' premuto in questo istante? I modificatori non contano: conta solo
    // che il tasto scelto sia giu' al momento del clic.
    function customKeyActive() {
        const k = settings.captureKey;
        return !!(k && k.code && heldKeys.has(k.code));
    }

    // E' il tasto scelto? Serve a zittire la scorciatoia WME mentre lo si tiene premuto.
    function isChosenCode(code) {
        const k = settings.captureKey;
        return !!(k && k.code === code);
    }

    function startKeyRecording() {
        if (recordingKey) return;
        recordingKey = true;
        listenArmed = false;   // prima il clic sul badge: cosi' il focus e' qui e la tastiera si legge davvero
        pendingKey = null;
        heldKeys.clear();
        updateKeyRow();
        toast('Clicca il riquadro rosso per attivare l\'ascolto, poi premi UN SOLO tasto della tastiera. ESC annulla.', 9000);
    }

    // Il clic sul badge arma la lettura: da qui in poi il primo tasto premuto viene letto
    function armKeyListening() {
        if (!recordingKey) { startKeyRecording(); return; }
        if (listenArmed) return;
        listenArmed = true;
        heldKeys.clear();
        updateKeyRow();
        toast('In ascolto: premi ora UN SOLO tasto della tastiera, quello che vuoi tenere premuto mentre clicchi i segmenti. ESC annulla.', 9000);
    }

    // Letto il tasto: NON si salva subito, prima lo si mostra e si chiede conferma
    function keyRead(code, key) {
        const k = normKeyChoice({ code, name: codeName(code, key) });
        if (!k) return;
        recordingKey = false;
        listenArmed = false;
        pendingKey = k;
        updateKeyRow();
        toast(`Letto il tasto ${keyLabel(k)}. Premi "Conferma" per salvarlo oppure "Rifai" per sceglierne un altro.`, 9000);
    }

    // Conferma esplicita dell'editor: solo qui il tasto diventa quello buono
    function confirmKeyCombo() {
        if (!pendingKey) return;
        const k = pendingKey;
        pendingKey = null;
        listenArmed = false;
        settings.captureKey = k;
        settings.captureMode = 'custom';
        saveSettings();
        syncCapUI();
        toast(`Tasto salvato: tieni premuto ${keyLabel(k)} e clicca un segmento per metterlo in lista. Resta attivo anche alle prossime sessioni.`, 8000);
    }

    function cancelKeyRecording(msg) {
        if (!recordingKey && !pendingKey) return;
        recordingKey = false;
        listenArmed = false;
        pendingKey = null;
        // annullata senza aver mai confermato nulla: si torna al default ALT, mai una cattura muta
        if (settings.captureMode === 'custom' && !settings.captureKey) { settings.captureMode = 'alt'; saveSettings(); }
        syncCapUI();
        if (msg) toast(msg);
    }

    // Badge e bottoni della riga: tre stati (in ascolto / in attesa di conferma / a riposo)
    function updateKeyRow() {
        if (!ui.keyshow) return;
        const show = (el, on) => { if (el) el.style.display = on ? '' : 'none'; };
        ui.keyshow.classList.toggle('wfit-rec', !!recordingKey);
        ui.keyshow.classList.toggle('wfit-pend', !recordingKey && !!pendingKey);
        if (recordingKey) {
            ui.keyshow.textContent = listenArmed ? 'premi un tasto\u2026' : 'cliccami per attivare l\'ascolto del tasto';
            ui.keyshow.title = listenArmed ? 'In ascolto: premi il tasto che vuoi usare' : 'Clicca qui, poi premi il tasto che vuoi usare';
            if (ui.keyset) ui.keyset.textContent = 'Annulla';
        } else {
            ui.keyshow.textContent = keyLabel(pendingKey || settings.captureKey);
            ui.keyshow.title = pendingKey ? 'Tasto letto: conferma o rifai' : 'Tasto attualmente in uso';
            if (ui.keyset) ui.keyset.textContent = 'Cambia';
        }
        show(ui.keyset, !pendingKey || recordingKey);
        show(ui.keyok, !recordingKey && !!pendingKey);
        show(ui.keyredo, !recordingKey && !!pendingKey);
        show(ui.keyclr, !recordingKey && !pendingKey);
        if (ui.keyrow) ui.keyrow.style.display = (settings.captureMode === 'custom' || settings.captureKey || recordingKey || pendingKey) ? '' : 'none';
        if (ui.keyclr) ui.keyclr.disabled = !settings.captureKey;
    }

    // Riallinea tutta la UI della cattura dopo un cambio da codice (scorciatoia, azzeramento...)
    function syncCapUI() {
        if (ui.capmode) ui.capmode.value = settings.captureMode;
        updateKeyRow();
        updateCapturedUI();
    }

    if (typeof document !== 'undefined') {
        document.addEventListener('mousedown', e => {
            lastMouse = { alt: e.altKey, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, custom: customKeyActive(), t: Date.now() };
        }, true);

        document.addEventListener('keydown', e => {
            if (recordingKey) {
                if (!listenArmed) return;   // non ancora armato: la tastiera resta al WME
                if (isTypingTarget(e.target) && e.key !== 'Escape') return;
                e.preventDefault(); e.stopPropagation();
                if (e.key === 'Escape') { cancelKeyRecording('Registrazione annullata: resta il tasto di prima.'); return; }
                if (e.repeat) return;
                // un tasto solo: i modificatori (ALT, MAIUSC, CTRL) non si possono scegliere qui,
                // per quelli ci sono gia' le voci fisse del menu Cattura
                if (MOD_CODES.test(e.code || '')) {
                    toast('ALT, MAIUSC e CTRL non valgono come tasto personalizzato: per quelli usa le voci del menu Cattura. Premi un tasto normale.', 7000);
                    return;
                }
                keyRead(e.code, e.key);
                return;
            }
            if (e.repeat) return;
            heldKeys.add(e.code);
            // mentre si tiene premuto il tasto scelto zittiamo l'eventuale scorciatoia del WME
            // sullo stesso tasto (non quando si sta scrivendo in un campo)
            if (settings.captureMode === 'custom' && isChosenCode(e.code) && !isTypingTarget(e.target)) {
                e.preventDefault(); e.stopPropagation();
            }
        }, true);

        document.addEventListener('keyup', e => { heldKeys.delete(e.code); }, true);
        window.addEventListener('blur', () => { heldKeys.clear(); if (recordingKey) cancelKeyRecording(); });
        document.addEventListener('visibilitychange', () => { if (document.hidden) heldKeys.clear(); });
    }

    function capModeLabel() {
        const m = settings.captureMode;
        if (MODE_TXT[m]) return `Cattura con ${MODE_TXT[m]} + clic: clic normale = editor normale.`;
        switch (m) {
            case 'custom': return `Cattura con ${keyLabel(settings.captureKey)} + clic: clic normale = editor normale.`;
            case 'always': return 'Cattura sempre attiva: ogni clic sui segmenti finisce in lista.';
            default: return 'Cattura spenta: riaccendila dal menu Cattura per mettere i segmenti in lista.';
        }
    }

    function onSelectionChanged() {
        if (Date.now() < suppressUntil) return;
        const ids = getSelectedSegmentIds();
        if (!ids.length) return; // ignora deselezioni (incluse le nostre)
        const mode = settings.captureMode;
        if (mode === 'off') return;
        if (mode !== 'always') {
            const fresh = Date.now() - lastMouse.t < 900;
            const key = mode === 'custom' ? lastMouse.custom
                : (MODE_MODS[mode] ? modsMatch(MODE_MODS[mode], lastMouse) : false);
            if (!(fresh && key)) return;
        }
        captureIds(ids, true);
        setTimeout(clearWmeSelection, 50);
    }

    function captureIds(ids, toggle) {
        if (!ids.length) { toast('Nessun segmento selezionato.'); return; }
        let removed = false, added = false;
        for (const id of ids) {
            if (toggle && captured.has(id)) { captured.delete(id); removed = true; continue; }
            const coords = segGeometry(id);
            if (coords && coords.length) { captured.set(id, { coords }); added = true; }
        }
        updateCapturedUI();
        refreshMapLayer();
        if (!captured.size) { clearResultsUI(); return; }
        // dopo una rimozione i risultati vanno SEMPRE ricalcolati (quelli vecchi confondono);
        // dopo un'aggiunta decide l'Auto-analisi
        if (mem.n && (removed || (added && settings.autoAnalyze))) {
            clearTimeout(analyzeTimer);
            analyzeTimer = setTimeout(analyze, 250);
        }
    }

    // Lista vuota: via risultati, civici disegnati ed evidenziazioni
    function clearResultsUI() {
        setTimeout(syncDotTracking, 0);
        lastResults = [];
        lastPtsByG = new Map();
        lastDotFeatures = [];
        lastDupCount = 0;
        refreshMapLayer();
        if (ui.results) ui.results.innerHTML = 'Lista vuota: cattura qualche segmento per vedere qui odonimi e civici.';
    }

    function updateCapturedUI() {
        if (!ui.selinfo) return;
        if (!captured.size) {
            const keyTxt = MODE_TXT[settings.captureMode] || (settings.captureMode === 'custom' ? escapeHtml(keyLabel(settings.captureKey)) : null);
            ui.selinfo.innerHTML = `Lista vuota. ${keyTxt ? `<b>${keyTxt} + clic</b> su un segmento per aggiungerlo (stessa combinazione per toglierlo).` : settings.captureMode === 'always' ? 'Clicca i segmenti sulla mappa.' : 'Riaccendi la cattura dal menu qui sopra.'}`;
            return;
        }
        const ids = [...captured.keys()];
        const MAXCHIP = 30;
        let html = `<b>${ids.length}</b> ${pl(ids.length, 'segmento', 'segmenti')} in lista &middot; `;
        html += ids.slice(0, MAXCHIP).map(id =>
            `<span class="wfit-chip${lastFailedIds.has(id) ? ' wfit-bad' : ''}" data-id="${id}" title="clic: mostra nell'editor${lastFailedIds.has(id) ? ' (ultimo Applica fallito qui)' : ''}">${String(id).slice(-5)}<b class="wfit-x" data-id="${id}" title="togli dalla lista">&times;</b></span>`
        ).join('');
        if (ids.length > MAXCHIP) html += ` <span class="wfit-muted">e altri ${ids.length - MAXCHIP}&hellip;</span>`;
        ui.selinfo.innerHTML = html;
        ui.selinfo.querySelectorAll('.wfit-x').forEach(x => x.addEventListener('click', ev => {
            ev.stopPropagation();
            captured.delete(coerceId(x.dataset.id));
            updateCapturedUI();
            refreshMapLayer();
            if (!captured.size) { clearResultsUI(); return; }
            if (mem.n) analyze();
        }));
        ui.selinfo.querySelectorAll('.wfit-chip').forEach(ch => ch.addEventListener('click', () => {
            const id = coerceId(ch.dataset.id);
            suppressUntil = Date.now() + 800; // il clic sul chip non deve ri-catturare
            try { sdk.Editing.setSelection({ selection: { ids: [id], objectType: 'segment' } }); }
            catch { toast('Selezione via SDK non disponibile.'); }
        }));
    }

    // gli id dei segmenti possono essere numerici o stringhe a seconda della versione
    function coerceId(s) {
        if (captured.has(s)) return s;
        const n = Number(s);
        if (captured.has(n)) return n;
        // confronto testuale esatto: il suffisso NON basta, "12345" combacerebbe con "9912345"
        for (const k of captured.keys()) if (String(k) === String(s)) return k;
        return s;
    }

    /* ------------------------------------------------------------------ */
    /* Geometria                                                           */
    /* ------------------------------------------------------------------ */

    function merc2wgs(x, y) {
        const lon = (x / 20037508.34) * 180;
        let lat = (y / 20037508.34) * 180;
        lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
        return [lon, lat];
    }

    function segGeometry(id) {
        try {
            const seg = sdk.DataModel.Segments.getById({ segmentId: id });
            return (seg && seg.geometry && seg.geometry.coordinates) || null;
        } catch { return null; }
    }

    // distanza punto-segmento su piano locale (metri)
    // Distanza in metri fra due punti (lon/lat)
    function haversine(lon1, lat1, lon2, lat2) {
        const R = 6371000, rad = Math.PI / 180;
        const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * R * Math.asin(Math.sqrt(a));
    }

    // Punto a metà lunghezza di una polilinea (per centrare la mappa su un segmento)
    function lineMidpoint(coords) {
        if (!coords || !coords.length) return null;
        if (coords.length === 1) return [coords[0][0], coords[0][1]];
        let tot = 0;
        for (let i = 1; i < coords.length; i++) {
            tot += Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1]);
        }
        if (!tot) return [coords[0][0], coords[0][1]];
        let half = tot / 2;
        for (let i = 1; i < coords.length; i++) {
            const d = Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1]);
            if (half <= d) {
                const t = d ? half / d : 0;
                return [coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t,
                        coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t];
            }
            half -= d;
        }
        return [coords[coords.length - 1][0], coords[coords.length - 1][1]];
    }

    const M_PER_DEG = 111320;

    // Porta la polilinea su un piano locale in metri: [x0,y0,x1,y1,...].
    // Va fatto UNA volta per segmento, non a ogni civico da confrontare.
    function projectPolyline(coords, cosLat) {
        const p = new Float64Array(coords.length * 2);
        for (let i = 0, j = 0; i < coords.length; i++) {
            p[j++] = coords[i][0] * M_PER_DEG * cosLat;
            p[j++] = coords[i][1] * M_PER_DEG;
        }
        return p;
    }

    // Distanza (metri) fra un punto gia' proiettato e una polilinea gia' proiettata
    function distToProjected(px, py, proj) {
        let best = Infinity;
        let ax = proj[0], ay = proj[1];
        for (let j = 2; j < proj.length; j += 2) {
            const bx = proj[j], by = proj[j + 1];
            const dx = bx - ax, dy = by - ay;
            let t = 0;
            const l2 = dx * dx + dy * dy;
            if (l2 > 0) t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
            const qx = ax + t * dx, qy = ay + t * dy;
            const d = Math.hypot(px - qx, py - qy);
            if (d < best) best = d;
            ax = bx; ay = by;
        }
        return best;
    }

    // Comodo per i confronti isolati (un punto contro una polilinea sola)
    function distPointToPolyline(lon, lat, coords, cosLat) {
        return distToProjected(lon * M_PER_DEG * cosLat, lat * M_PER_DEG, projectPolyline(coords, cosLat));
    }

    /* ------------------------------------------------------------------ */
    /* Livello mappa dei civici (SDK)                                      */
    /* ------------------------------------------------------------------ */

    let layerReady = false, layerFailed = false;

    // Legge una proprieta' della feature dallo styleContext dell'SDK, col suo valore di riserva
    const featProp = (name, fallback) => ctx => {
        const p = ctx && ctx.feature && ctx.feature.properties;
        return (p && p[name] != null && p[name] !== '') ? p[name] : fallback;
    };

    function ensureLayer() {
        if (layerReady || layerFailed) return layerReady;
        try {
            for (const layerName of [LAYER_HL, LAYER]) addStyledLayer(layerName);
            // clic su un pallino: si evidenzia la sua riga nell'elenco dei civici (vedi syncDotTracking)
            try { sdk.Events.on({ eventName: 'wme-layer-feature-clicked', eventHandler: onDotClicked }); }
            catch (e) { log('clic sui pallini non disponibile', e); }
            layerReady = true;
        } catch (e) {
            layerFailed = true;
            log('livello mappa non disponibile in questo SDK:', e);
            toast('Questa versione del WME non permette allo script di disegnare i civici sulla mappa.', 6000);
        }
        return layerReady;
    }

    function addStyledLayer(layerName) {
        sdk.Map.addLayer({
            layerName,
            styleRules: [{
                predicate: () => true,
                style: {
                    pointRadius: '${pointRadius}',
                    fillColor: '${fillColor}',
                    fillOpacity: 0.9,
                    strokeColor: '${strokeColor}',
                    strokeWidth: '${strokeWidth}',
                    strokeOpacity: '${strokeOpacity}',
                    strokeDashstyle: '${strokeDashstyle}',
                    strokeLinecap: 'round',
                    label: '${label}',
                    fontColor: '#111111',
                    fontSize: '${fontSize}',
                    fontWeight: 'bold',
                    labelOutlineColor: '#ffffff',
                    labelOutlineWidth: 3,
                    labelYOffset: '${labelYOffset}'
                }
            }],
            styleContext: {
                // misure dei pallini: viaggiano con la feature, cosi' cambiare dimensione
                // significa semplicemente ridisegnare i punti (le linee usano i valori di riserva)
                pointRadius: featProp('pr', DOT_SIZES.normale.r),
                fontSize: featProp('fs', DOT_SIZES.normale.f + 'px'),
                labelYOffset: featProp('yo', DOT_SIZES.normale.y),
                fillColor: featProp('color', '#777777'),
                strokeColor: featProp('stroke', '#ffffff'),
                strokeWidth: featProp('w', 1.5),
                strokeOpacity: featProp('so', 1),
                strokeDashstyle: featProp('dash', 'solid'),
                label: featProp('label', '')
            }
        });
        try { sdk.Map.setLayerVisibility({ layerName, visibility: true }); } catch { /* facoltativo */ }
    }

    // I pallini diventano cliccabili SOLO mentre un elenco dei civici e' aperto: un livello
    // "tracciato" si prende i clic, e con l'elenco chiuso ALT+clic deve arrivare sempre ai
    // segmenti del WME, anche dove un pallino ci sta sopra. Il livello dei segmenti evidenziati
    // non viene mai tracciato.
    let dotTracking = false;
    function syncDotTracking() {
        const want = !!document.querySelector('.wfit-hnrev');
        if (want === dotTracking) return;
        if (want ? !ensureLayer() : !layerReady) return;
        try {
            if (want) sdk.Events.trackLayerEvents({ layerName: LAYER });
            else sdk.Events.stopLayerEventsTracking({ layerName: LAYER });
            dotTracking = want;
        } catch { /* tracciamento non disponibile */ }
    }

    function onDotClicked(ev) {
        if (!ev || ev.layerName !== LAYER) return;
        const info = dotIndex.get(ev.featureId);
        if (!info) return;
        const p = info.p;
        const same = x => Math.abs(x.lon - p.lon) < 1e-9 && Math.abs(x.lat - p.lat) < 1e-9;
        const rows = [...document.querySelectorAll('.wfit-hnrev .wfit-hnrow')];
        const row = rows.find(r => r.wfitP && same(r.wfitP));
        if (row) {
            try { row.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { /* vecchio browser */ }
            row.classList.add('wfit-hnflash');
            setTimeout(() => row.classList.remove('wfit-hnflash'), 1800);
            return;
        }
        const r = lastResults.find(x => x.g === info.g);
        toast(`Civico ${p.label}${r ? ' \u00b7 ' + toWazeCase(r.name) : ''} \u00b7 apri l'elenco con "+N civici su Waze" per inserirlo`, 5000);
    }

    function setLayerFeatures(layerName, features) {
        try { sdk.Map.removeAllFeaturesFromLayer({ layerName }); } catch { /* ignora */ }
        if (!features.length) return;
        try { sdk.Map.addFeaturesToLayer({ layerName, features }); }
        catch (e) { log('addFeaturesToLayer KO', layerName, e); }
    }

    // Gli script di evidenziazione (Color Highlights ecc.) disegnano sopra i livelli aggiunti dopo:
    // riportiamo il nostro in cima a ogni ridisegno, cosi' la selezione resta sempre visibile.
    // Si usa Map.setLayerZIndex dell'SDK: niente piu' mani negli interni della mappa.
    let zBumpLogged = false;
    const LAYER_Z = 990;   // sopra i livelli degli oggetti, sotto i controlli della mappa
    function raiseOwnLayer() {
        try {
            if (sdk.Map.getLayerZIndex({ layerName: LAYER }) >= LAYER_Z) return;
            sdk.Map.setLayerZIndex({ layerName: LAYER_HL, zIndex: LAYER_Z - 1 });
            sdk.Map.setLayerZIndex({ layerName: LAYER, zIndex: LAYER_Z });
            if (!zBumpLogged) { zBumpLogged = true; log('livelli portati sopra gli evidenziatori'); }
        } catch { /* il colore acceso resta comunque */ }
    }

    function clearCiviciLayer() {
        if (!layerReady) return;
        for (const layerName of [LAYER_HL, LAYER]) {
            try { sdk.Map.removeAllFeaturesFromLayer({ layerName }); } catch { /* ignora */ }
        }
    }

    // Evidenziazione dei segmenti in lista: casing scuro + tratteggio nel colore scelto.
    // Il tratteggio e' la firma (gli evidenziatori comuni usano tinte piene) e il casing
    // scuro tiene visibile la linea anche sulle strade bianche della mappa standard.
    const HL_CASING = '#06232e';
    function segHighlightFeatures() {
        const F = [];
        for (const [id, v] of captured) {
            if (!v.coords || v.coords.length < 2) continue;
            const geometry = { type: 'LineString', coordinates: v.coords };
            F.push({ id: 'wfit-hl-c-' + id, type: 'Feature', geometry, properties: { stroke: HL_CASING, w: 8.5, so: 0.9, dash: 'solid', label: '' } });
            F.push({ id: 'wfit-hl-l-' + id, type: 'Feature', geometry, properties: { stroke: settings.hlColor, w: 4, so: 0.95, dash: 'dash', label: '' } });
        }
        return F;
    }

    // Cambio di dimensione: si riscrivono le misure sui punti gia' calcolati e si ridisegna.
    // Non serve rifare l'analisi, i civici agganciati sono gli stessi.
    function resizeDotFeatures() {
        const sz = dotSize();
        for (const f of [...lastDotFeatures, ...zonaDots]) {
            if (!f.properties || f.geometry.type !== 'Point') continue;
            f.properties.pr = sz.r;
            f.properties.fs = sz.f + 'px';
            f.properties.yo = sz.y;
        }
        refreshMapLayer();
    }

    // Ridisegna il livello: prima le linee tricolore, sopra i puntini dei civici (se attivi)
    function refreshMapLayer() {
        const hl = [...zonaFeatures, ...segHighlightFeatures()];
        const dots = [...zonaDots, ...(settings.showDots ? lastDotFeatures : [])];
        if (!hl.length && !dots.length) { clearCiviciLayer(); return; }
        if (!ensureLayer()) return;
        setLayerFeatures(LAYER_HL, hl);
        setLayerFeatures(LAYER, dots);
        raiseOwnLayer();
    }

    /* ------------------------------------------------------------------ */
    /* Controlla la zona: sola lettura, niente modifiche                   */
    /* ------------------------------------------------------------------ */

    // Colori e spiegazione dei tre problemi cercati. L'ordine conta: un segmento finisce
    // nella prima categoria che lo riguarda.
    // Colori a semaforo, dal peggio al meglio: rosso = manca tutto, giallo = c'e' qualcosa che
    // non torna e va verificato, verde = strada a posto, mancano solo i civici (si puo' lavorare).
    const ZONA_TIPI = [
        ['senzanome', '#d81b1b', '\ud83d\udd34 strada senza nome: manca tutto'],
        ['diverso', '#efb100', '\ud83d\udfe1 nome diverso da ANNCSU: da verificare'],
        ['mancanti', '#1faa4b', '\ud83d\udfe2 nome a posto: civici da inserire']
    ];
    // Zoom da cui parte il controllo: abbastanza largo da capire dove cominciare, abbastanza
    // stretto da avere i civici caricati. Se su una strada i civici non ci sono ancora, quella
    // strada non viene valutata (te lo dice) invece di dare numeri sbagliati.
    const ZONA_MIN_ZOOM = 16;
    const ZONA_MAX_SEG = 500;      // tetto di sicurezza sul numero di segmenti
    const ZONA_MANCANTI_MIN = 5;   // quanti civici devono mancare perche' valga la pena dirlo
    // Il controllo zona NON usa il Raggio del pannello: quello serve quando scegli tu i segmenti.
    // Qui si guarda tutta la banca dati a schermo e ogni civico viene assegnato alla strada piu'
    // vicina, purche' entro questa distanza (oltre, il civico non appartiene a nessuna strada).
    const ZONA_MAX_D = 25;
    // Strade bloccate sopra il tuo livello: puoi nasconderle, cosi' vedi solo il lavoro
    // che puoi davvero fare. La scelta resta salvata.
    let zonaSoloMie = true;   // valore vero letto dalle impostazioni all'avvio
    const ZONA_MAX_DOT = 1200;     // tetto ai pallini disegnati dal controllo zona
    let zonaAttiva = false;
    let zonaFeatures = [];
    let zonaDots = [];
    let zonaMoveOff = null, zonaMoveTimer = null, zonaInCorso = false;

    // Finche' il controllo e' acceso segue la mappa: appena ti fermi, rifa' il giro sulla
    // nuova vista. Si aggancia all'evento di fine spostamento, cosi' non ricalcola a ogni pixel.
    function seguiMappa(accendi) {
        clearTimeout(zonaMoveTimer);
        if (!accendi) {
            if (zonaMoveOff) { try { zonaMoveOff(); } catch { /* gia' staccato */ } zonaMoveOff = null; }
            return;
        }
        if (zonaMoveOff) return;
        const rifai = () => {
            clearTimeout(zonaMoveTimer);
            zonaMoveTimer = setTimeout(() => { if (zonaAttiva && !zonaInCorso && !busy) controllaZona(true); }, 700);
        };
        try {
            const off = sdk.Events.on({ eventName: 'wme-map-move-end', eventHandler: rifai });
            zonaMoveOff = typeof off === 'function' ? off
                : () => { try { sdk.Events.off({ eventName: 'wme-map-move-end', eventHandler: rifai }); } catch { /* pazienza */ } };
        } catch (e) { log('aggiornamento automatico della zona non disponibile', e); }
    }

    function spegniZona() {
        zonaAttiva = false;
        zonaFeatures = [];
        zonaDots = [];
        seguiMappa(false);
        if (ui.zona) ui.zona.textContent = '\ud83d\uddfa\ufe0f Controlla la zona (non modifica)';
        const box = document.getElementById('wfit-zonabox');
        if (box) box.remove();
        refreshMapLayer();
    }

    // Segmenti carrabili con nome o senza, dentro la vista attuale
    function segmentiAVista() {
        let bbox = null;
        try { bbox = sdk.Map.getMapExtent(); } catch { /* niente riquadro: si prende tutto il caricato */ }
        const out = [];
        let all = [];
        try { all = sdk.DataModel.Segments.getAll() || []; } catch { return out; }
        for (const sg of all) {
            const c = sg && sg.geometry && sg.geometry.coordinates;
            if (!c || c.length < 2) continue;
            if (sg.isDrivable === false || sg.roadType === RT_RAMP) continue;
            if (bbox) {
                let dentro = false;
                for (const q of c) {
                    if (q[0] >= bbox[0] && q[0] <= bbox[2] && q[1] >= bbox[1] && q[1] <= bbox[3]) { dentro = true; break; }
                }
                if (!dentro) continue;
            }
            // hasHouseNumbers lo dice Waze anche quando i civici non sono caricati sullo schermo:
            // e' l'unico modo per non scambiare "non li vedo" con "non ci sono".
            out.push({ id: sg.id, c, pn: sg.primaryStreetId, haCivici: sg.hasHouseNumbers === true, lock: sg.lockRank != null ? sg.lockRank : null });
            if (out.length > ZONA_MAX_SEG) break;
        }
        return out;
    }

    // Civici gia' su Waze, per segmento, letti da quello che l'editor ha in memoria
    // (niente rete: il controllo zona deve restare veloce).
    function civiciCaricatiPerSegmento() {
        const per = new Map();
        const add = h => {
            if (!h) return;
            const sid = h.segmentId != null ? h.segmentId : (h.segID != null ? h.segID : h.segmentID);
            const num = h.number != null ? h.number : h.houseNumber;
            if (sid == null || num == null) return;
            const k = String(sid);
            if (!per.has(k)) per.set(k, new Set());
            per.get(k).add(hnKey(num));
        };
        try {
            const HN = sdk.DataModel.HouseNumbers;
            if (HN && typeof HN.getAll === 'function') (HN.getAll() || []).forEach(add);
        } catch { /* sotto */ }
        if (!per.size) {
            try {
                const W = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).W;
                const repo = W && W.model && W.model.segmentHouseNumbers;
                const arr = repo && typeof repo.getObjectArray === 'function' ? repo.getObjectArray() : null;
                if (arr) arr.forEach(o => add(o && (o.attributes || o)));
            } catch { /* nessun civico noto */ }
        }
        return per;
    }

    // Confronto nome Waze / nome ANNCSU, tollerante su maiuscole e accenti
    const nomeUguale = (a, b) => deacc(String(a || '')).replace(/[^a-z0-9]+/g, '') === deacc(String(b || '')).replace(/[^a-z0-9]+/g, '');

    // auto = rifatto da solo dopo uno spostamento della mappa: niente finestre, avvisi discreti
    async function controllaZona(auto) {
        if (zonaAttiva && !auto) { spegniZona(); return; }
        if (!mem.n) { if (!auto) toast('Prima scarica i dati della regione.'); return; }
        if (busy || zonaInCorso) { if (!auto) toast('Attendi la fine dell\'operazione in corso.'); return; }
        let zoom = 99;
        try { zoom = sdk.Map.getZoomLevel(); } catch { /* si prova lo stesso */ }
        if (zoom < ZONA_MIN_ZOOM) {
            // All'accensione ci si porta da soli allo zoom giusto: da li' in poi giri la mappa
            // e il controllo ti segue. Se sei tu ad allontanarti dopo, non ti si tira indietro.
            if (auto) {
                zonaFeatures = []; zonaDots = []; refreshMapLayer();
                zonaNota(`Sei allo zoom ${zoom}: troppo lontano per il controllo. Avvicinati allo zoom ${ZONA_MIN_ZOOM}.`);
                return;
            }
            const spostato = await portaAZoom(ZONA_MIN_ZOOM);
            if (!spostato) {
                toast(`Avvicinati allo zoom ${ZONA_MIN_ZOOM} (ora ${zoom}) e riprova: da pi\u00f9 lontano il controllo non \u00e8 affidabile.`, 8000);
                return;
            }
            toast(`Zoom portato a ${ZONA_MIN_ZOOM}. Gira la mappa: il controllo ti segue. Se qualche strada resta non valutata, avvicinati ancora un po'.`, 8000);
            // si aspetta che l'editor carichi i dati della nuova vista
            try { await Promise.race([sdk.Events.once({ eventName: 'wme-map-data-loaded' }), sleep(4000)]); }
            catch { await sleep(1200); }
            await sleep(300);
        }
        const segs = segmentiAVista();
        if (!segs.length) {
            if (auto) { zonaFeatures = []; zonaDots = []; refreshMapLayer(); zonaNota('Nessuna strada carrabile caricata in questa vista.'); }
            else toast('Nessuna strada carrabile caricata in questa vista.');
            return;
        }
        if (segs.length > ZONA_MAX_SEG) {
            const msg = `Qui ci sono pi\u00f9 di ${ZONA_MAX_SEG} strade: stringi la vista.`;
            if (auto) { zonaFeatures = []; zonaDots = []; refreshMapLayer(); zonaNota(msg); }
            else toast(msg + ' Poi riprova.', 8000);
            return;
        }

        zonaInCorso = true;
        beginBusy();
        const t0 = Date.now();
        try {
            status(`Controllo la zona: ${segs.length} ${pl(segs.length, 'strada', 'strade')}\u2026`);
            const hnPerSeg = civiciCaricatiPerSegmento();
            const dLat = ZONA_MAX_D / M_PER_DEG;
            const trovati = [];
            let k = 0, nonValutate = 0, aPosto = 0;

            // 1) Ogni civico ANNCSU a schermo va alla strada PIU' VICINA, una volta sola: cosi'
            //    due vie parallele non si contendono gli stessi numeri.
            const miglior = new Map();   // indice del civico -> { si: posizione del segmento, d }
            for (const [si, sg] of segs.entries()) {
                if (si % 25 === 0) { setProgress(50 * si / segs.length); await tick(); }
                let minLon = 999, minLat = 999, maxLon = -999, maxLat = -999;
                for (const q of sg.c) {
                    if (q[0] < minLon) minLon = q[0];
                    if (q[0] > maxLon) maxLon = q[0];
                    if (q[1] < minLat) minLat = q[1];
                    if (q[1] > maxLat) maxLat = q[1];
                }
                const cosLat = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
                const dLon = ZONA_MAX_D / (M_PER_DEG * cosLat);
                const proj = projectPolyline(sg.c, cosLat);
                const kx = M_PER_DEG * cosLat;
                gridForEachInBBox(minLon - dLon, minLat - dLat, maxLon + dLon, maxLat + dLat, i => {
                    const d = distToProjected(mem.lons[i] * kx, mem.lats[i] * M_PER_DEG, proj);
                    if (d > ZONA_MAX_D) return;
                    const pre = miglior.get(i);
                    if (!pre || d < pre.d) miglior.set(i, { si, d });
                });
            }

            // 2) I civici di ogni strada, raggruppati per odonimo
            const perSeg = new Map();    // posizione del segmento -> Map(odonimo -> {chiavi, punti})
            for (const [i, best] of miglior) {
                let perG = perSeg.get(best.si);
                if (!perG) { perG = new Map(); perSeg.set(best.si, perG); }
                const g = mem.gids[i];
                let v = perG.get(g);
                if (!v) { v = { chiavi: new Set(), punti: [] }; perG.set(g, v); }
                const cv = mem.civn[i] || 0, ce = mem.cive[i] || 0;
                const chiave = (cv || ce) ? cv * 1024 + ce : -(i + 1);
                if (v.chiavi.has(chiave)) continue;
                v.chiavi.add(chiave);
                v.punti.push({ lon: mem.lons[i], lat: mem.lats[i], label: (cv ? String(cv) : '') + (ce ? '/' + mem.esps[ce] : '') });
            }

            // 3) Come sta ogni strada rispetto ad ANNCSU
            const ur = userRank();
            let bloccate = 0;
            for (const [si, perG] of perSeg) {
                k++;
                if (k % 25 === 0) { setProgress(50 + 50 * k / perSeg.size); status(`Controllo la zona: ${k}/${perSeg.size}\u2026`); await tick(); }
                const sg = segs[si];
                // strada bloccata sopra il tuo livello: non potresti modificarla
                const bloccata = ur != null && sg.lock != null && sg.lock > ur;
                if (bloccata) { bloccate++; if (zonaSoloMie) continue; }
                let gBest = null, nBest = 0;
                for (const [g, v] of perG) if (v.chiavi.size > nBest) { gBest = g; nBest = v.chiavi.size; }
                const puntiBest = (perG.get(gBest) || {}).punti || [];
                const nomeAnncsu = toWazeCase((mem.groups[gBest] || [])[0] || '');
                const nomeWaze = sg.pn != null ? streetNameById(sg.pn) : '';
                const mid = lineMidpoint(sg.c);
                if (!nomeWaze) {
                    trovati.push({ tipo: 'senzanome', id: sg.id, c: sg.c, mid, nomeAnncsu, nomeWaze: '', n: nBest, punti: puntiBest, bloccata });
                    continue;
                }
                if (!nomeUguale(nomeWaze, nomeAnncsu)) {
                    trovati.push({ tipo: 'diverso', id: sg.id, c: sg.c, mid, nomeAnncsu, nomeWaze, n: nBest, punti: puntiBest, bloccata });
                    continue;
                }
                const suWaze = hnPerSeg.get(String(sg.id));
                // Il WME carica i civici solo da un certo zoom in su e solo per la zona a schermo.
                // Se Waze dice che questa strada ha civici ma noi non li abbiamo, NON possiamo
                // sapere quanti ne mancano: meglio tacere che segnalare un falso allarme.
                if (sg.haCivici && !suWaze) { nonValutate++; continue; }
                // Si confrontano i NUMERI, non le quantita': se su Waze ci sono gli stessi civici
                // di ANNCSU la strada e' gia' a posto e non deve comparire fra le cose da fare.
                const daFare = puntiBest.filter(q => !(suWaze && suWaze.has(hnKey(q.label))));
                if (daFare.length < ZONA_MANCANTI_MIN) { aPosto++; continue; }
                trovati.push({ tipo: 'mancanti', id: sg.id, c: sg.c, mid, nomeAnncsu, nomeWaze, n: nBest, mancanti: daFare.length, punti: daFare, bloccata });
            }
            setProgress(null);
            status('');
            mostraZona(trovati, segs.length, Date.now() - t0, nonValutate, aPosto, bloccate);
        } catch (e) {
            log('controllo zona KO', e);
            if (!auto) toast('Controllo della zona non riuscito: ' + errText(e), 8000);
        } finally {
            zonaInCorso = false;
            endBusy();
        }
    }

    // Porta la mappa allo zoom richiesto. Le firme cambiano fra le versioni dell'SDK, quindi
    // si provano tutte e poi si VERIFICA leggendo lo zoom: niente successi dati per scontati.
    async function portaAZoom(z) {
        const modi = [
            ['setZoomLevel({zoomLevel})', () => sdk.Map.setZoomLevel({ zoomLevel: z })],
            ['setZoomLevel(z)', () => sdk.Map.setZoomLevel(z)],
            ['setZoom({zoomLevel})', () => sdk.Map.setZoom({ zoomLevel: z })],
            ['setMapCenter({lonLat,zoomLevel})', () => {
                const c = mapCenter();
                if (!c) throw new Error('centro mappa sconosciuto');
                sdk.Map.setMapCenter({ lonLat: { lon: c[0], lat: c[1] }, zoomLevel: z });
            }]
        ];
        for (const [nome, fn] of modi) {
            try { fn(); } catch { continue; }
            await sleep(250);
            if (zoomOra() >= z) { log('zoom portato a', z, 'con', nome); return true; }
        }
        log('nessun modo di cambiare zoom ha funzionato');
        return false;
    }

    // Messaggio nella scheda quando il ricalcolo automatico non puo' girare
    function zonaNota(txt) {
        const box = document.getElementById('wfit-zonabox');
        if (!box) return;
        box.innerHTML = '';
        const d = document.createElement('div');
        d.className = 'wfit-muted';
        d.innerHTML = `<b>Controllo zona</b> \u00b7 ${escapeHtml(txt)} Il controllo resta acceso e riparte da solo.`;
        box.appendChild(d);
    }

    function mostraZona(trovati, nSeg, ms, nonValutate, aPosto, bloccate) {
        zonaAttiva = true;
        seguiMappa(true);
        if (ui.zona) ui.zona.textContent = '\u2716\ufe0e Togli i colori del controllo zona';
        const colore = t => (ZONA_TIPI.find(x => x[0] === t) || [])[1] || '#888';
        const sz = dotSize();
        zonaFeatures = [];
        zonaDots = [];
        let nd = 0;
        for (const x of trovati) {
            const geometry = { type: 'LineString', coordinates: x.c };
            const col = colore(x.tipo);
            zonaFeatures.push({ id: 'wfit-z-c-' + x.id, type: 'Feature', geometry, properties: { stroke: '#1d1d1d', w: 9, so: 0.6, dash: 'solid', label: '' } });
            zonaFeatures.push({ id: 'wfit-z-l-' + x.id, type: 'Feature', geometry, properties: { stroke: col, w: 5, so: 0.95, dash: 'solid', label: '' } });
            // i civici ANNCSU della strada segnalata: cosi' si vede subito dove puntare
            for (const q of (x.punti || [])) {
                if (nd >= ZONA_MAX_DOT) break;
                zonaDots.push({
                    id: 'wfit-zd-' + x.id + '-' + (nd++),
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [q.lon, q.lat] },
                    properties: { color: col, label: q.label, pr: sz.r, fs: sz.f + 'px', yo: sz.y }
                });
            }
        }
        refreshMapLayer();

        const vecchio = document.getElementById('wfit-zonabox');
        if (vecchio) vecchio.remove();
        const box = document.createElement('div');
        box.id = 'wfit-zonabox';
        box.className = 'wfit-zona';
        const head = document.createElement('div');
        head.className = 'wfit-muted';
        head.innerHTML = `<b>Controllo zona</b> \u00b7 ${nSeg} ${pl(nSeg, 'strada esaminata', 'strade esaminate')} in ${(ms / 1000).toFixed(1)}s \u00b7 `
            + `${trovati.length} ${pl(trovati.length, 'da guardare', 'da guardare')}`
            + (zonaDots.length ? ` \u00b7 ${zonaDots.length} civici ANNCSU mostrati sulla mappa` : '')
            + '. Nessuna modifica \u00e8 stata fatta, e il controllo si aggiorna da solo quando sposti la mappa.';
        head.title = 'Il controllo zona non usa il Raggio del pannello (quello vale quando scegli tu i segmenti): '
            + `qui ogni civico ANNCSU a schermo viene assegnato alla strada pi\u00f9 vicina, entro ${ZONA_MAX_D} m.`;
        box.appendChild(head);
        // il tratteggio colorato dei segmenti in lista non c'entra col semaforo: si spiega,
        // altrimenti sembra una quarta categoria senza legenda
        if (captured.size) {
            const nota = document.createElement('div');
            nota.className = 'wfit-muted';
            nota.style.marginTop = '4px';
            nota.innerHTML = `<span class="wfit-zdot" style="display:inline-block;background:${settings.hlColor}"></span> `
                + `il tratteggio \u00e8 ${pl(captured.size, 'il segmento che hai', 'i segmenti che hai')} in lista (${captured.size}), non fa parte del controllo.`;
            box.appendChild(nota);
        }
        // spunta per nascondere le strade bloccate sopra il proprio livello
        if (bloccate || !zonaSoloMie) {
            const lab = document.createElement('label');
            lab.className = 'wfit-muted';
            lab.style.display = 'flex';
            lab.style.alignItems = 'center';
            lab.style.gap = '6px';
            lab.style.marginTop = '4px';
            lab.title = 'Una strada bloccata a un livello superiore al tuo non la puoi modificare: '
                + 'con la spunta attiva resta fuori dall\'elenco e dalla mappa.';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = zonaSoloMie;
            cb.addEventListener('change', () => {
                zonaSoloMie = cb.checked;
                settings.zonaSoloMie = zonaSoloMie;
                saveSettings();
                controllaZona(true);
            });
            lab.appendChild(cb);
            lab.appendChild(document.createTextNode(
                zonaSoloMie
                    ? `nascondi le strade che non posso modificare${bloccate ? ` (${bloccate} ${pl(bloccate, 'nascosta', 'nascoste')})` : ''}`
                    : `nascondi le strade che non posso modificare${bloccate ? ` (${bloccate} ${pl(bloccate, 'bloccata', 'bloccate')} \ud83d\udd12)` : ''}`));
            box.appendChild(lab);
        }
        if (nonValutate) {
            const w = document.createElement('div');
            w.className = 'wfit-hnnote wfit-n-warn';
            w.textContent = `\u26a0\ufe0f ${nonValutate} ${pl(nonValutate, 'strada ha gi\u00e0 civici su Waze ma non', 'strade hanno gi\u00e0 civici su Waze ma non')} `
                + `${pl(nonValutate, 'li ho potuti contare', 'li ho potuti contare')} a questo zoom: ${pl(nonValutate, 'non \u00e8 stata valutata', 'non sono state valutate')}. `
                + `Avvicinati un altro po'${zoomOra() != null ? ' (sei allo zoom ' + zoomOra() + ')' : ''} e il controllo si rif\u00e0 da solo.`;
            box.appendChild(w);
        }
        for (const [tipo, col, txt] of ZONA_TIPI) {
            const gruppo = trovati.filter(x => x.tipo === tipo);
            if (!gruppo.length) continue;
            const t = document.createElement('div');
            t.className = 'wfit-muted';
            t.style.marginTop = '4px';
            t.innerHTML = `<b>${gruppo.length}</b> \u00b7 ${txt}`;
            box.appendChild(t);
            for (const x of gruppo.slice(0, 12)) {
                const r = document.createElement('div');
                r.className = 'wfit-zrow';
                const d = document.createElement('span');
                d.className = 'wfit-zdot';
                d.style.background = col;
                const label = document.createElement('span');
                label.textContent = (x.bloccata ? '\ud83d\udd12 ' : '') + (tipo === 'senzanome' ? `${x.nomeAnncsu || '(odonimo ignoto)'} \u00b7 ${x.n} civici ANNCSU da mettere`
                    : tipo === 'diverso' ? `${x.nomeWaze} \u2192 ANNCSU: ${x.nomeAnncsu}`
                    : `${x.nomeWaze} \u00b7 ${x.mancanti} civici da inserire subito`);
                r.appendChild(d); r.appendChild(label);
                r.title = 'Clic: centra la mappa su questa strada e la seleziona nell\'editor.';
                r.addEventListener('click', () => {
                    if (x.mid) quickCenter(x.mid[0], x.mid[1]);
                    suppressUntil = Date.now() + 900;
                    try { sdk.Editing.setSelection({ selection: { ids: [x.id], objectType: 'segment' } }); } catch { /* pazienza */ }
                });
                box.appendChild(r);
            }
            if (gruppo.length > 12) {
                const more = document.createElement('div');
                more.className = 'wfit-muted';
                more.textContent = `\u2026 e altre ${gruppo.length - 12} (colorate sulla mappa)`;
                box.appendChild(more);
            }
        }
        if (aPosto) {
            const ok = document.createElement('div');
            ok.className = 'wfit-muted';
            ok.style.marginTop = '4px';
            ok.textContent = `\u2713 ${aPosto} ${pl(aPosto, 'strada gi\u00e0 a posto', 'strade gi\u00e0 a posto')}: nome giusto e stessi civici di ANNCSU, niente da fare.`;
            box.appendChild(ok);
        }
        if (!trovati.length) {
            const ok = document.createElement('div');
            ok.className = 'wfit-muted';
            ok.style.marginTop = '4px';
            ok.textContent = '\u2713 In questa vista non c\'\u00e8 niente da sistemare secondo ANNCSU: sposta la mappa, il controllo ti segue.';
            box.appendChild(ok);
        }
        if (ui.results && ui.results.parentNode) ui.results.parentNode.insertBefore(box, ui.results);
    }

    /* ------------------------------------------------------------------ */
    /* Analisi automatica: segmenti vs civici                              */
    /* ------------------------------------------------------------------ */

    function analyze() {
        let segs = [...captured.values()].map(v => v.coords);
        if (!segs.length) {
            segs = getSelectedSegmentIds().map(id => segGeometry(id)).filter(c => c && c.length);
        }
        if (!segs.length) { toast('Clicca prima qualche segmento sulla mappa.'); return; }
        if (!mem.n) { toast('Prima scarica i dati della regione.'); return; }

        const radius = settings.raggio;
        const dLat = radius / M_PER_DEG;
        const results = new Map(); // gid -> {dist, count}
        // Lo stesso record ANNCSU puo' cadere entro il raggio di PIU' segmenti della lista (una via
        // spezzata in tronconi, le due carreggiate di un viale, una laterale catturata insieme).
        // E' sempre lo stesso civico: lo teniamo una volta sola, con la distanza minima trovata.
        const ptBest = new Map(); // indice record -> {i, g, d}

        for (const coords of segs) {
            let minLon = 999, minLat = 999, maxLon = -999, maxLat = -999;
            for (const c of coords) {
                if (c[0] < minLon) minLon = c[0];
                if (c[0] > maxLon) maxLon = c[0];
                if (c[1] < minLat) minLat = c[1];
                if (c[1] > maxLat) maxLat = c[1];
            }
            const midLat = (minLat + maxLat) / 2;
            const cosLat = Math.cos(midLat * Math.PI / 180);
            const dLon = radius / (M_PER_DEG * cosLat);
            const proj = projectPolyline(coords, cosLat);
            const kx = M_PER_DEG * cosLat;
            gridForEachInBBox(minLon - dLon, minLat - dLat, maxLon + dLon, maxLat + dLat, i => {
                const d = distToProjected(mem.lons[i] * kx, mem.lats[i] * M_PER_DEG, proj);
                if (d > radius) return;
                const g = mem.gids[i];
                let r = results.get(g);
                if (!r) { r = { dist: d, count: 0, uniq: new Set() }; results.set(g, r); }
                // civici distinti: numero + esponente; gli accessi senza numero contano singolarmente
                const cv = mem.civn[i] || 0, ce = mem.cive[i] || 0;
                r.uniq.add((cv || ce) ? cv * 1024 + ce : -(i + 1));
                if (d < r.dist) r.dist = d;
                const prev = ptBest.get(i);
                if (!prev) ptBest.set(i, { i, g, d });
                else if (d < prev.d) prev.d = d;
            });
        }
        // il totale dei civici distinti si legge alla fine, non a ogni punto trovato
        for (const r of results.values()) r.count = r.uniq.size;
        const pts = [...ptBest.values()]; // civici agganciati, uno per record: {i, g, d}

        lastResults = [...results.entries()]
            .map(([g, r]) => {
                const [den, loc, bel, fileDate] = mem.groups[g];
                return { g, name: den, locality: loc, comune: belNome.get(bel) || bel, dist: r.dist, count: r.count, fileDate };
            })
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 8);
        lastResults.forEach((r, idx) => { r.color = PALETTE[idx % PALETTE.length]; });

        // civici agganciati per odonimo. NON si butta via niente di numerato: lo stesso numero puo'
        // esistere su PIU' record ANNCSU distinti (piu' accessi allo stesso civico: portone, passo
        // carrabile, ingresso secondario) e solo chi edita, guardando il territorio, sa quale
        // posizione e' quella giusta. Attenzione: qui i record sono gia' unici (vedi ptBest), quindi
        // una ripetizione e' una ripetizione vera dell'archivio, non lo stesso punto contato due volte. Le ripetizioni le marchiamo (dup) e le mostriamo:
        // in elenco arrivano spuntate solo le prime occorrenze, le altre restano visibili da valutare.
        // Unica eccezione: gli accessi SENZA numero identici allo stesso punto, che non aggiungono
        // nulla da valutare (stesso puntino sulla mappa, nessun numero da confrontare).
        lastPtsByG = new Map();
        pts.sort((a, b) => a.d - b.d); // ordine per distanza: la prima occorrenza e' la piu' vicina
        const seenHN = new Map();      // chiave -> {n, lon, lat} della prima occorrenza
        const dupLog = [];
        lastDupCount = 0;
        for (const p of pts) {
            const cv = mem.civn[p.i] || 0, ce = mem.cive[p.i] || 0;
            const label = (cv ? String(cv) : '') + (ce ? '/' + mem.esps[ce] : '');
            const lon = mem.lons[p.i], lat = mem.lats[p.i];
            // numerati: chiave odonimo + numero/esponente (il punto NON entra nella chiave: cosi'
            // due rilievi dello stesso civico a pochi metri risultano ripetizioni dello stesso numero)
            const key = label
                ? p.g + '|#' + label
                : p.g + '|@' + Math.round(lon * 1e5) + '|' + Math.round(lat * 1e5);
            const first = seenHN.get(key);
            const rep = first ? first.n : 0;
            if (!first) seenHN.set(key, { n: 1, lon, lat });
            else first.n++;
            if (!label && rep) continue; // accesso senza numero gia' visto in quel punto esatto
            // quanto dista dalla prima occorrenza? e' il dato che dice se e' rumore d'archivio
            // (pochi metri, stesso portone rilevato due volte) o un secondo accesso vero
            const twinD = first ? haversine(first.lon, first.lat, lon, lat) : 0;
            if (rep) {
                lastDupCount++;
                dupLog.push(`${label}: punto ${rep + 1} a ${Math.round(twinD)} m dal punto 1 ` +
                    `(${lat.toFixed(6)}, ${lon.toFixed(6)}) \u2014 odonimo "${(mem.groups[p.g] || [])[0] || '?'}"`);
            }
            let a = lastPtsByG.get(p.g);
            if (!a) { a = []; lastPtsByG.set(p.g, a); }
            a.push({ lon, lat, label, d: p.d, dup: rep > 0, rep: rep + 1, twinD });
        }
        if (lastDupCount) {
            log(`numeri civici ripetuti nel match (mostrati comunque): ${lastDupCount}`);
            log('dettaglio ripetizioni (numero, distanza dal gemello, coordinate):\n' + dupLog.join('\n'));
        }

        if (!lastResults.length) {
            if (ui.results) ui.results.innerHTML = `Nessun civico ANNCSU entro ${radius} m. Aumenta il raggio, oppure il Comune non ha ancora caricato le coordinate nell'archivio.`;
            lastDotFeatures = [];
            refreshMapLayer();
            return;
        }
        renderResults(lastResults);
        drawCivici();
    }

    // Disegna sulla mappa i civici agganciati, colorati come i risultati, con etichetta = numero/esponente.
    // Usa la stessa lista di lastPtsByG, ripetizioni comprese: cosi' i puntini sulla mappa e le righe
    // dell'elenco di controllo mostrano sempre esattamente le stesse cose.
    function drawCivici() {
        dotIndex.clear();
        const colorOf = new Map(lastResults.map(r => [r.g, r.color]));
        const sz = dotSize();
        const features = [];
        let n = 0;
        for (const [g, arr] of lastPtsByG) {
            const color = colorOf.get(g);
            if (!color) continue;
            for (const p of arr) {
                const fid = 'wfit-' + g + '-' + (n++);
                dotIndex.set(fid, { g, p });
                features.push({
                    id: fid,
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
                    properties: { color, label: p.label, pr: sz.r, fs: sz.f + 'px', yo: sz.y }
                });
                if (features.length >= 1500) break;
            }
            if (features.length >= 1500) break;
        }
        lastDotFeatures = features;
        refreshMapLayer();
    }

    /* ------------------------------------------------------------------ */
    /* Formattazione nomi                                                  */
    /* ------------------------------------------------------------------ */

    // Regole di scrittura degli odonimi: arrivano da data/odonimi.json (loadOdonimi).
    // Qui resta solo il minimo di scorta, cosi' i nomi restano sensati anche se il file
    // non e' raggiungibile.
    const ODONIMI_FALLBACK = {
        abbreviazioni: { diramazione: 'dir', diramazioni: 'dir', diramaz: 'dir', diram: 'dir' },
        espansioni: {
            'mons.': 'Monsignor', 'dott.': 'Dottor', 'prof.': 'Professor', 'gen.': 'Generale', 'col.': 'Colonnello',
            'cap.': 'Capitano', 'ten.': 'Tenente', 'magg.': 'Maggiore', 'on.': 'Onorevole', 'avv.': 'Avvocato',
            'ing.': 'Ingegner', 'sen.': 'Senatore', 'card.': 'Cardinale', 'f.lli': 'Fratelli', 'c.da': 'Contrada',
            'c/da': 'Contrada', 'p.zza': 'Piazza', 'p.za': 'Piazza', 'v.le': 'Viale', 'l.go': 'Largo', 'c.so': 'Corso',
            'loc.': 'Localit\u00e0', 'fraz.': 'Frazione', 'str.': 'Strada', 'vic.': 'Vicolo', 'trav.': 'Traversa',
            'circ.': 'Circonvallazione', 'racc.': 'Raccordo', 'var.': 'Variante'
        },
        elisioni: ['dell', 'dall', 'nell', 'sull', 'all', 'coll', 'degl', 'dagl', 'negl', 'sugl', 'agl', 'd', 'un'],
        cognomiConApostrofo: ["d'annunzio", "d'azeglio", "d'acquisto", "d'amico", "d'angelo", "d'alessandro", "d'agostino", "d'amato", "d'onofrio"],
        minuscole: ['il', 'lo', 'la', 'i', 'gli', 'le', 'di', 'del', 'dello', 'della', 'dei', 'degli', 'delle', 'da', 'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle', 'de', 'd', 'li', 'e', 'ed', 'a', 'ad', 'al', 'allo', 'alla', 'ai', 'agli', 'alle', 'in', 'nel', 'nello', 'nella', 'nei', 'negli', 'nelle', 'su', 'sul', 'sulla', 'sui', 'sugli', 'sulle', 'con', 'col', 'per', 'tra', 'fra', 'un', 'uno', 'una'],
        particelleCognome: ['di', 'de', 'del', 'dello', 'della', 'dei', 'degli', 'delle', 'da', 'dal', 'dalla', 'dalle', 'la', 'lo', 'li'],
        cognomiConParticella: ['de amicis', 'de gasperi', 'de nicola', 'de sanctis', 'de sica', 'della chiesa', 'dalla chiesa', 'di giacomo', 'di pietro', 'di vittorio', 'la malfa', 'lo bianco'],
        euristicaCognome: true,
        particelleEuristica: ['di', 'de'],
        eccezioniParticella: ['di savoia', 'di rienzo', 'dei mille', 'dalle bande nere', 'della francesca'],
        toponimiReligiosi: ['san', 'santa', 'santo', 'sant', 'ss', 'madonna', 'nostra', 'signora', 'beata', 'beato', 'chiesa', 'cappella', 'santuario', 'convento', 'abbazia', 'pieve'],
        romaniAmbigui: ['c', 'd', 'i', 'l', 'm', 'v', 'x', 'ci', 'di', 'li', 'mi', 'vi'],
        contestoRomanoPrima: ['vico', 'papa', 'pio', 'giovanni', 'paolo', 'leone', 'benedetto', 'gregorio', 'clemente', 'sisto', 'urbano', 'vittorio', 'emanuele', 'umberto', 'carlo', 'luigi', 'federico', 'enrico', 'ferdinando', 're', 'regina', 'traversa', 'parallela', 'lotto'],
        romanoMaxAmbiguo: 10,
        contestoRomanoDopo: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
        nomiPropri: ['alcide', 'antonio', 'carlo', 'cesare', 'francesco', 'giovanni', 'giuseppe', 'luigi', 'marco', 'mario', 'pietro', 'vittorio']
    };
    let ODO = null;       // regole in uso
    let ODO_SET = null;   // le stesse regole gia' in Set/Map: non si ricostruiscono a ogni nome

    // minuscolo e senza accenti: serve solo per confrontare con gli elenchi, mai per scrivere
    function deacc(x) {
        return String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }

    function setOdonimi(j) {
        ODO = Object.assign({}, ODONIMI_FALLBACK, j || {});
        const S = a => new Set((Array.isArray(a) ? a : []).map(deacc));
        const L = a => (Array.isArray(a) ? a : []).map(deacc);
        const abb = new Map();
        for (const k of Object.keys(ODO.abbreviazioni || {})) abb.set(deacc(k), String(ODO.abbreviazioni[k]));
        ODO_SET = {
            abbrev: abb,
            minuscole: S(ODO.minuscole),
            particelle: S(ODO.particelleCognome),
            partEur: S(ODO.particelleEuristica),
            religiosi: S(ODO.toponimiReligiosi),
            ambigui: S(ODO.romaniAmbigui),
            prima: S(ODO.contestoRomanoPrima),
            dopo: S(ODO.contestoRomanoDopo),
            nomi: S(ODO.nomiPropri),
            cognomi: L(ODO.cognomiConParticella),
            cognomiApo: L(ODO.cognomiConApostrofo),
            elisioni: S(ODO.elisioni),
            espansioni: new Map(Object.entries(ODO.espansioni || {}).map(([k, v]) => [deacc(k), String(v)])),
            eccezioni: L(ODO.eccezioniParticella)
        };
    }

    const ROMAN = /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

    // stacca la punteggiatura dal corpo della parola: "G." -> core "G", post "."
    function splitTok(t) {
        const m = /^([^0-9A-Za-z\u00c0-\u024f]*)(.*?)([^0-9A-Za-z\u00c0-\u024f]*)$/.exec(t);
        return { pre: m[1], core: m[2], post: m[3] };
    }

    function capIt(w) {
        return w.replace(/(^|[\u2019'-])([a-z\u00e0-\u00ff])/g, (m, a, c) => a + c.toUpperCase());
    }

    // Numero romano vero: solo lettere romane e sequenza valida (II, IV, XXIII, ...)
    function isRoman(core) {
        return !!core && /^[mdclxvi]+$/.test(core) && ROMAN.test(core.toUpperCase());
    }

    const ROMAN_VAL = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };

    function romanValue(core) {
        let tot = 0;
        for (let i = 0; i < core.length; i++) {
            const v = ROMAN_VAL[core[i]];
            tot += (v < (ROMAN_VAL[core[i + 1]] || 0)) ? -v : v;
        }
        return tot;
    }

    // Nome pronto per Waze secondo la guida "Denominazione delle strade" della Wazeopedia Italia.
    // Il Title Case si puo' spegnere (e' stile); le altre regole valgono sempre (sono regole di nome).
    // toWazeCaseInfo restituisce anche le note da mostrare nella scheda.
    function toWazeCaseInfo(s) {
        const notes = [];
        let t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
        if (!t) return { name: t, notes };
        t = fixAccents(t);
        t = expandDotted(t);
        t = t.replace(/\b([A-Za-z])\.(?=[A-Za-z]{2,})/g, '$1. ');   // "G.MARCONI" -> "G. MARCONI"
        if (settings.titleCase) t = titleCaseIT(t);
        t = applySigle(t);
        t = applyAbbrev(t);
        t = applyDates(t);
        t = applyOrdinals(t);
        t = dropInitials(t, notes);
        return { name: t.replace(/\s+/g, ' ').trim(), notes };
    }
    function toWazeCase(s) { return toWazeCaseInfo(s).name; }

    // Accento scritto come apostrofo in fondo alla parola: LIBERTA' -> LIBERTÀ, NICOLO' -> NICOLÒ.
    // Solo parole di almeno 3 lettere: de', da', po', ca' sono troncamenti veri e restano cosi'.
    const ACCENTI = { a: '\u00e0', e: '\u00e8', i: '\u00ec', o: '\u00f2', u: '\u00f9', A: '\u00c0', E: '\u00c8', I: '\u00cc', O: '\u00d2', U: '\u00d9' };
    // Numeri romani con l'apostrofo (XXIII', VI'): la vecchia tabella TTS lo chiedeva, la guida
    // dice che non serve piu'. Si toglie l'apostrofo, senza scambiarlo per un accento.
    function fixAccents(t) {
        t = t.replace(/(^|\s)([IVXLC]{1,7})['\u2019](?=\s|$|[,;)])/g,
            (m, lead, r) => (ROMAN.test(r) && r.toUpperCase() !== 'LI') ? lead + r : m);
        return t.replace(/([A-Za-z\u00c0-\u024f]{2,})([aeiouAEIOU])['\u2019](?=\s|$|[,;.)])/g, (m, pre, v) => pre + ACCENTI[v]);
    }

    // Abbreviazioni puntate sciolte per esteso (Mons. -> Monsignor, F.lli -> Fratelli, C.da ->
    // Contrada): la guida vuole il nome per esteso, e il TTS le punteggiate non le legge bene.
    // L'elenco sta in data/odonimi.json ("espansioni").
    function expandDotted(t) {
        if (!ODO_SET.espansioni.size) return t;
        return t.split(' ').map(w => {
            const v = ODO_SET.espansioni.get(deacc(w));
            if (!v) return w;
            return w === w.toUpperCase() ? v.toUpperCase() : v;
        }).join(' ');
    }

    // Sigle di autostrade, statali, regionali, provinciali e NSA: maiuscole e senza spazi,
    // con il suffisso minuscolo attaccato (SS12, SP20bis, SS591var, SS20dir, NSA122).
    const SIGLA_TIPO = t => {
        const k = t.toLowerCase().replace(/[\s.]+/g, '');
        if (/^(stradastatale|ss)$/.test(k)) return 'SS';
        if (/^(stradaregionale|sr)$/.test(k)) return 'SR';
        if (/^(stradaprovinciale|sp)$/.test(k)) return 'SP';
        if (/^(nuovastradaanas|nsa)$/.test(k)) return 'NSA';
        if (k === 'sc') return 'SC';
        return 'A';
    };
    const SIGLA_SUF = { bis: 'bis', ter: 'ter', quater: 'quater', dir: 'dir', diramazione: 'dir', var: 'var', variante: 'var', racc: 'racc', raccordo: 'racc', radd: 'radd', raddoppio: 'radd' };
    const SIGLA_FIND = /(^|\s)(strada\s+statale|strada\s+regionale|strada\s+provinciale|nuova\s+strada\s+anas|autostrada\s+a|autostrada|s\.\s?s\.|s\.\s?r\.|s\.\s?p\.|s\.\s?c\.|nsa|ss|sr|sp|sc|(?=a\s?\d)a)\s*(?:n[.\u00b0\u00ba]?\s*)?(\d{1,4})(?:\s*(bis|ter|quater|dir|diramazione|var|variante|racc|raccordo|radd|raddoppio)\.?)?(?=\s|$|[,;)-])/gi;
    function applySigle(t) {
        // SGC (Strada di Grande Comunicazione): sigla che il TTS legge per esteso, sempre maiuscola
        t = t.replace(/(^|\s)s\.?\s?g\.?\s?c\.?(?=\s|$)/gi, '$1SGC');
        return t.replace(SIGLA_FIND, (m, lead, tipo, num, suf, off) => {
            // "A14" da solo vale solo a inizio nome ("Via A 14" non e' un'autostrada)
            if (/^a$/i.test(tipo) && off > 0) return m;
            return lead + SIGLA_TIPO(tipo.replace(/^autostrada\s+a$/i, 'a')) + num + (suf ? SIGLA_SUF[suf.toLowerCase()] : '');
        });
    }

    // Date con numeri arabi anche se scritte in romano o in lettere (Via 4 Novembre, Via 25 Aprile,
    // Via 20 Settembre). Unica eccezione della guida: Via 1\u00ba Maggio, con l'indicatore ordinale \u00ba.
    const MESI = new Set(['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']);
    const NUM_PAROLE = { primo: 1, uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, undici: 11, dodici: 12, tredici: 13,
        quattordici: 14, quindici: 15, sedici: 16, diciassette: 17, diciotto: 18, diciannove: 19, venti: 20, ventuno: 21, ventidue: 22, ventitre: 23,
        ventiquattro: 24, venticinque: 25, ventisei: 26, ventisette: 27, ventotto: 28, ventinove: 29, trenta: 30, trentuno: 31 };
    function applyDates(t) {
        const toks = t.split(' ');
        for (let i = 0; i < toks.length - 1; i++) {
            const mese = deacc(splitTok(toks[i + 1]).core);
            if (!MESI.has(mese)) continue;
            const p = splitTok(toks[i]);
            const c = deacc(p.core);
            let n = null;
            if (/^\d{1,2}$/.test(c)) n = parseInt(c, 10);
            else if (isRoman(c) && romanValue(c) <= 31) n = romanValue(c);
            else if (NUM_PAROLE[c]) n = NUM_PAROLE[c];
            if (!n || n > 31) continue;
            toks[i] = p.pre + (n === 1 && mese === 'maggio' ? '1\u00ba' : String(n));
        }
        return toks.join(' ');
    }

    // Aggettivi ordinali davanti al tipo di strada: numeri arabi con l'apice a (1\u00aa Traversa,
    // 2\u00aa Strada). Vale per la forma in lettere (Seconda), in romano (II) e per "2^"/"2a".
    // "2\u00b0" (col simbolo dei gradi, sbagliato) diventa "2\u00ba".
    const ORD_F = { prima: 1, seconda: 2, terza: 3, quarta: 4, quinta: 5, sesta: 6, settima: 7, ottava: 8, nona: 9, decima: 10,
        undicesima: 11, dodicesima: 12, tredicesima: 13, quattordicesima: 14, quindicesima: 15, sedicesima: 16,
        diciassettesima: 17, diciottesima: 18, diciannovesima: 19, ventesima: 20 };
    const DUG_F = new Set(['traversa', 'strada', 'rampa', 'salita', 'discesa', 'scesa', 'calata', 'via', 'piazza', 'contrada', 'cupa', 'stradella', 'viuzza']);
    const PREP_DI = new Set(['di', 'del', 'dello', 'della', 'dei', 'degli', 'delle']);
    // dopo il tipo di strada il romano e' un numero d'ordine ("Traversa II Via Roma", "Vico II"): resta com'e'
    const DUG_TUTTI = new Set([...DUG_F, 'vico', 'vicolo', 'viale', 'corso', 'largo', 'supportico', 'fondaco', 'cortile', 'trav']);
    function applyOrdinals(t) {
        const toks = t.split(' ');
        for (let i = 0; i < toks.length - 1; i++) {
            const p = splitTok(toks[i]);
            const c = deacc(p.core);
            const next = deacc(splitTok(toks[i + 1]).core);
            if (!c || !next) continue;
            // il numero d'ordine puo' stare prima del tipo di strada ("Prima Traversa Via Roma")
            // oppure dopo ("Traversa Prima di Via delle Arti", "Traversa Prima Via Roma").
            // Dopo vale solo se segue un'altra strada, con o senza "di": "Via Seconda Guerra
            // Mondiale" non e' una numerazione e resta com'e'.
            const prev = i > 0 ? deacc(splitTok(toks[i - 1]).core) : '';
            const after2 = i + 2 < toks.length ? deacc(splitTok(toks[i + 2]).core) : '';
            const numerata = DUG_F.has(next)
                || (DUG_TUTTI.has(prev) && PREP_DI.has(next) && DUG_TUTTI.has(after2));
            let out = null;
            const dg = /^(\d{1,2})(a?)$/.exec(c);
            if (dg && (p.post === '^' || p.post === '\u00aa')) out = dg[1] + '\u00aa';
            else if (dg && !dg[2] && (p.post === '\u00b0' || p.post === '\u00ba')) out = dg[1] + '\u00ba';
            else if (numerata) {
                if (ORD_F[c]) out = ORD_F[c] + '\u00aa';
                else if (dg && dg[2]) out = dg[1] + '\u00aa';
                else if (isRoman(c) && romanValue(c) <= 20 && !DUG_TUTTI.has(prev)) out = romanValue(c) + '\u00aa';
            }
            if (out) toks[i] = p.pre + out;
        }
        return toks.join(' ');
    }

    // Lettere puntate: la guida vuole il nome per esteso oppure niente ("Via Garibaldi", non
    // "Via G. Garibaldi"), perche' il TTS non le legge. Le iniziali di persona si tolgono;
    // "S." e "SS." (San, Santa, Santo, Santi, Santissima) non si possono sciogliere da soli.
    function dropInitials(t, notes) {
        const toks = t.split(' ');
        const out = [];
        for (let i = 0; i < toks.length; i++) {
            const w = toks[i];
            if (i > 0 && /^s{1,2}\.$/i.test(w)) {
                notes.push(`"${w.toUpperCase()}" \u00e8 un'abbreviazione puntata che il TTS non legge: scrivi per esteso San, Santa, Santo, Santi o Santissima`);
                out.push(w);
                continue;
            }
            if (i > 0 && i < toks.length - 1 && /^([A-Za-z]\.){1,3}$/.test(w)) {
                notes.push(`tolta l'iniziale puntata "${w.toUpperCase()}": se conosci il nome, scrivilo per esteso`);
                continue;
            }
            out.push(w);
        }
        return out.join(' ');
    }

    function applyAbbrev(s) {
        if (!ODO_SET.abbrev.size) return s;
        return s.split(' ').map(t => {
            const p = splitTok(t);
            const v = ODO_SET.abbrev.get(deacc(p.core));
            // il punto dopo l'abbreviazione si toglie: la tabella TTS vuole "dir", non "dir."
            return v ? p.pre + v + p.post.replace(/^\./, '') : t;
        }).join(' ');
    }

    function titleCaseIT(s) {
        const toks = s.split(' ');
        const parts = toks.map(splitTok);
        const core = parts.map(p => deacc(p.core));         // per i confronti
        const low = parts.map(p => p.core.toLowerCase());   // testo vero, accenti compresi

        // "di vittorio" contro l'elenco: confronto per parole intere, non per prefisso
        const startsAny = (list, i) => {
            const rest = core.slice(i).filter(Boolean).join(' ');
            return list.some(e => rest === e || rest.startsWith(e + ' '));
        };
        // Un romano ambiguo (DI, VI, I...) vale come numero solo con il contesto giusto.
        // Il tetto sul valore fa da primo filtro: DI = 501 e LI = 51 non sono numeri di
        // traversa, sono la preposizione e l'articolo.
        const romanOk = i => {
            const c = core[i];
            if (!isRoman(c)) return false;
            if (!ODO_SET.ambigui.has(c)) return true;                 // II, IV, XXIII: nessun dubbio
            // Negli odonimi i numeri restano piccoli: le traverse arrivano a una decina,
            // i papi a XXIII. Un ambiguo che varrebbe 50, 100 o 501 non e' un numero:
            // e' la parola italiana (DI = 501, LI = 51, MI = 1001, C = 100).
            if (romanValue(c) > (ODO.romanoMaxAmbiguo || 10)) return false;
            if (ODO_SET.dopo.has(core[i + 1] || '')) return true;     // VI Novembre
            if (ODO_SET.prima.has(core[i - 1] || '')) return true;     // Traversa VI, Pio VI
            // Ultima parola del nome, dopo un nome di persona: "Via Carlo Alberto I",
            // "Via Umberto I". Se seguisse altro ("Via i Mille") sarebbe l'articolo.
            const prev = core[i - 1] || '';
            return i === core.length - 1 && i > 0 && !!prev && !ODO_SET.minuscole.has(prev) && !DUG_TUTTI.has(prev);
        };
        // "Giuseppe Di Vittorio" si', "Madonna delle Grazie" no
        const isCognome = i => {
            const c = core[i];
            if (/[\u2019']$/.test(parts[i].core)) return false;      // de', da': restano minuscoli
            if (startsAny(ODO_SET.eccezioni, i)) return false;
            if (startsAny(ODO_SET.cognomi, i)) return true;
            if (!ODO.euristicaCognome || !ODO_SET.partEur.has(c)) return false;
            const next = core[i + 1] || '';
            if (!next || ODO_SET.minuscole.has(next)) return false;
            if (core.slice(0, i).some(w => ODO_SET.religiosi.has(w))) return false;
            const prev = core[i - 1] || '';
            const prevIniziale = prev.length === 1 && parts[i - 1].post.indexOf('.') >= 0;
            return ODO_SET.nomi.has(prev) || prevIniziale;           // nome di persona o iniziale puntata
        };

        // "d'" maiuscola solo nei cognomi (Gabriele D'Annunzio), minuscola altrove (Lama d'Oro,
        // San Francesco d'Assisi): stesso ragionamento delle particelle "di"/"de"
        const isCognomeApo = i => {
            if (ODO_SET.cognomiApo.includes(core[i])) return true;
            if (core.slice(0, i).some(w => ODO_SET.religiosi.has(w))) return false;
            const prev = core[i - 1] || '';
            const prevIniziale = prev.length === 1 && parts[i - 1].post.indexOf('.') >= 0;
            return ODO_SET.nomi.has(prev) || prevIniziale;
        };

        return parts.map((p, i) => {
            if (!p.core) return toks[i];
            const c = core[i];
            // preposizione o articolo eliso in mezzo al nome: minuscolo come "della", la parola
            // dopo l'apostrofo maiuscola (Via dell'Arte, Contrada Lama d'Oro, ISTAT: Anzola dell'Emilia)
            const ap = i > 0 ? /^(.+?)(['\u2019])(.+)$/.exec(p.core) : null;
            if (ap && ODO_SET.elisioni.has(deacc(ap[1]))) {
                const pre = deacc(ap[1]) === 'd' && isCognomeApo(i) ? 'D' : ap[1].toLowerCase();
                return p.pre + pre + ap[2] + capIt(ap[3].toLowerCase()) + p.post;
            }
            // iniziale puntata: "A. De Gasperi", "G. Marconi"
            if (c.length === 1 && p.post.indexOf('.') >= 0) return p.pre + p.core.toUpperCase() + p.post;
            if (romanOk(i)) return p.pre + p.core.toUpperCase() + p.post;
            if (i > 0 && ODO_SET.minuscole.has(c)) {
                const w = ODO_SET.particelle.has(c) && isCognome(i) ? capIt(low[i]) : low[i];
                return p.pre + w + p.post;
            }
            return p.pre + capIt(low[i]) + p.post;
        }).join(' ');
    }

    setOdonimi(null);   // regole di scorta subito pronte; loadOdonimi le sostituisce all'avvio

    const HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => HTML_ESC[c]);
    }

    // Regole di rinomina apprese dall'utente (es. "Strada Contrada " -> "Contrada ")
    function applyNameRules(name) {
        for (const r of settings.nameRules) {
            if (r && r.from && name.toLowerCase().startsWith(r.from.toLowerCase())) {
                return r.to + name.slice(r.from.length);
            }
        }
        return name;
    }

    function learnNameRule(suggested, used) {
        if (!suggested || !used || suggested === used) return null;
        const sl = suggested.toLowerCase(), ul = used.toLowerCase();
        // il nome usato deve essere il suggerito senza una singola parola iniziale (es. senza "Strada ")
        if (!sl.endsWith(ul) || sl.length <= ul.length) return null;
        const removed = suggested.slice(0, suggested.length - used.length);
        if (!/^[A-Za-z\u00c0-\u00fa.']+\s$/.test(removed)) return null;
        const firstWord = used.split(/\s+/)[0];
        if (!firstWord) return null;
        const rule = { from: removed + firstWord + ' ', to: firstWord + ' ' };
        if (settings.nameRules.some(r => r.from.toLowerCase() === rule.from.toLowerCase())) return null;
        settings.nameRules.push(rule);
        if (settings.nameRules.length > 12) settings.nameRules.shift();
        saveSettings();
        return rule;
    }

    /* ------------------------------------------------------------------ */
    /* Risultati + applicazione                                            */
    /* ------------------------------------------------------------------ */

    function renderResults(results) {
        if (!ui.results || !results || !results.length) return;
        ui.results.innerHTML = '';
        syncDotTracking();
        if (lastDupCount) {
            const note = document.createElement('div');
            note.className = 'wfit-muted';
            note.style.marginBottom = '5px';
            note.title = 'Stesso odonimo e stesso numero civico presenti piu\' volte nei dati ANNCSU (piu\' accessi allo stesso civico) o agganciati da piu\' segmenti. Sono mostrati tutti: nell\'elenco dei civici le ripetizioni sono marcate e arrivano senza spunta, decidi tu quale posizione e\' quella giusta.';
            note.innerHTML = `&#8505;&#65039; ${lastDupCount} ${pl(lastDupCount, 'numero civico ripetuto', 'numeri civici ripetuti')} nell'archivio: ${pl(lastDupCount, 'mostrato', 'mostrati')} comunque, da valutare.`;
            ui.results.appendChild(note);
        }
        // Com'e' la strada su Waze adesso, cosi' si capisce subito se c'e' qualcosa da fare
        const oraSuWaze = new Map();
        for (const id of captured.keys()) {
            let lab = '(senza strada)';
            try { const st = segAddressState(id); if (st.pn != null) lab = streetLabel(st.pn); } catch { /* ignoto */ }
            oraSuWaze.set(lab, (oraSuWaze.get(lab) || 0) + 1);
        }
        if (oraSuWaze.size) {
            const d = document.createElement('div');
            d.className = 'wfit-muted';
            d.style.marginBottom = '5px';
            d.textContent = 'Su Waze ora: ' + [...oraSuWaze.entries()].sort((a, b) => b[1] - a[1])
                .map(([k, v]) => `${k} (${v})`).join(' \u00b7 ');
            ui.results.appendChild(d);
        }
        const extraMode = settings.applyMode !== 'urb';
        for (const r of results) {
            const info = toWazeCaseInfo(r.name);
            const base = info.name;
            const prefill = applyNameRules(base);
            const div = document.createElement('div');
            div.className = 'wfit-res';
            if (r.color) div.style.borderLeftColor = r.color;

            const head = document.createElement('div');
            head.innerHTML = `<span class="wfit-badge">ANNCSU</span>` +
                (r.color ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${r.color};margin-left:6px" title="colore dei civici sulla mappa"></span>` : '') +
                ` <span class="wfit-muted">originale: ${escapeHtml(r.name)}</span>`;
            div.appendChild(head);

            // Casella modificabile: qui decidi il nome secondo le linee guida Waze
            const nameIn = document.createElement('input');
            nameIn.type = 'text';
            nameIn.className = 'wfit-name-in';
            nameIn.value = prefill;
            nameIn.title = 'Nome che verrà scritto su Waze: modificalo liberamente prima di applicare';
            div.appendChild(nameIn);

            // Avvisi della guida "Denominazione delle strade" (lettere puntate e simili)
            for (const n of info.notes) {
                const w = document.createElement('div');
                w.className = 'wfit-hnnote wfit-n-warn';
                w.textContent = '\u26a0\ufe0f ' + n;
                div.appendChild(w);
            }
            // Strada con sigla: la guida vuole solo la sigla nel nome principale
            const sg = applyNames(prefill);
            const atteso = extraMode ? sg.pn : `${sg.pn}, ${r.comune}`;
            const giaCosi = oraSuWaze.get(atteso) || 0;
            if (giaCosi) {
                const ok = document.createElement('div');
                ok.className = 'wfit-muted';
                ok.textContent = `\u2713 nome principale gi\u00e0 cos\u00ec su ${giaCosi} di ${captured.size} ${pl(captured.size, 'segmento', 'segmenti')}`;
                div.appendChild(ok);
            }
            if (sg.sigla) {
                const h = document.createElement('div');
                h.className = 'wfit-muted';
                h.textContent = sg.full
                    ? `Strada con sigla: nome principale "${sg.pn}", nome esteso "${sg.an}" negli alternativi con la citt\u00e0.`
                    : `Strada con sigla: nome principale "${sg.pn}".`;
                div.appendChild(h);
            }

            // Suggerimento rapido per il caso classico "Strada Contrada X" -> "Contrada X"
            const m = /^strada\s+((?:contrada|c\.da)\s+.+)$/i.exec(prefill);
            if (m) {
                const sugg = toWazeCase(m[1]);
                const a = document.createElement('a');
                a.href = 'javascript:void(0)';
                a.className = 'wfit-muted';
                a.style.display = 'inline-block';
                a.style.margin = '0 0 3px 2px';
                a.textContent = `usa "${sugg}"`;
                a.addEventListener('click', () => { nameIn.value = sugg; nameIn.focus(); });
                div.appendChild(a);
            }

            const infoRow = document.createElement('div');
            infoRow.innerHTML = `<span class="wfit-muted">Comune: <b>${escapeHtml(r.comune)}</b>` +
                (r.locality ? ` &middot; Localit&agrave;: ${escapeHtml(toWazeCase(r.locality))}` : '') +
                ` &middot; ~${Math.round(r.dist)} m &middot; ${r.count} ${pl(r.count, 'civico', 'civici')}` +
                (r.fileDate ? ` &middot; dati ANNCSU del ${r.fileDate}` : '') + `</span>`;
            div.appendChild(infoRow);

            // Citta' da scrivere: il comune, oppure la frazione nella forma della guida
            // "nomefrazione, nomecomune" quando la strada e' nel centro abitato di una frazione
            const loc = r.locality ? toWazeCase(r.locality) : '';
            const cityOpts = [r.comune];
            if (loc && deacc(loc) !== deacc(r.comune)) cityOpts.push(`${loc}, ${r.comune}`);
            let citySel = null;
            if (cityOpts.length > 1) {
                const cr = document.createElement('div');
                cr.className = 'wfit-muted';
                cr.textContent = 'Citt\u00e0: ';
                citySel = document.createElement('select');
                for (const c of cityOpts) { const o = document.createElement('option'); o.value = c; o.textContent = c; citySel.appendChild(o); }
                citySel.title = 'Se la strada \u00e8 nel centro abitato di una frazione, la guida vuole la citt\u00e0 nella forma "frazione, comune". '
                    + 'La localit\u00e0 ANNCSU non \u00e8 sempre una frazione: scegli tu guardando i cartelli di inizio centro abitato.';
                cr.appendChild(citySel);
                div.appendChild(cr);
            }

            const readName = () => {
                const v = nameIn.value.trim();
                if (!v) { toast('Il nome è vuoto: scrivilo nella casella.'); return null; }
                return v;
            };
            const bCopy = document.createElement('button');
            bCopy.className = 'wfit-btn'; bCopy.textContent = 'Copia';
            bCopy.addEventListener('click', () => {
                const v = readName();
                if (v) navigator.clipboard.writeText(v).then(() => toast('Nome copiato.'));
            });
            const bApply = document.createElement('button');
            bApply.className = 'wfit-btn wfit-primary'; bApply.textContent = 'Applica ai segmenti';
            bApply.addEventListener('click', () => {
                const v = readName();
                if (v) applyToSegments(v, citySel ? citySel.value : r.comune, prefill);
            });
            const numerati = (lastPtsByG.get(r.g) || []).filter(p => p.label).length;
            const bHn = document.createElement('button');
            bHn.className = 'wfit-btn';
            bHn.textContent = `+${numerati} civici su Waze`;
            bHn.title = 'Apre l\'elenco di controllo: scegli tu quali civici ANNCSU inserire su Waze (con lettera, es. 343/A)';
            if (!numerati) bHn.disabled = true;
            bHn.addEventListener('click', () => toggleHnReview(div, r));
            const row = document.createElement('div');
            row.className = 'wfit-actions';
            row.appendChild(bCopy); row.appendChild(bApply); row.appendChild(bHn);
            div.appendChild(row);
            ui.results.appendChild(div);
        }
    }

    // Modifiche non salvate nell'editor (il WME vieta i civici su segmenti modificati)
    function unsavedCount() {
        try {
            const n = sdk.Editing.getUnsavedChangesCount();
            return typeof n === 'number' ? n : null;
        } catch { return null; }
    }

    // Snapshot, modalita' pratica o editor in sola lettura: qui lo script non deve scrivere
    // nulla, perche' le modifiche non arriverebbero mai sulla mappa. null = si puo' editare.
    function editingBlock() {
        try { if (sdk.Editing.isSnapshotModeOn()) return 'sei in modalit\u00e0 snapshot (vista di ci\u00f2 che \u00e8 live nell\'app): esci dalla snapshot e riprova'; } catch { /* metodo assente */ }
        try { if (sdk.Editing.isPracticeModeOn()) return 'sei in modalit\u00e0 pratica: le modifiche non verrebbero salvate sulla mappa'; } catch { /* metodo assente */ }
        try { if (!sdk.Editing.isEditingAllowed()) return 'in questo momento l\'editor non permette modifiche'; } catch { /* metodo assente */ }
        return null;
    }

    // Traduce gli errori del WME in indicazioni azionabili
    function niceReason(msg) {
        const m = String(msg || 'errore');
        if (/projected segment|not allowed to add a house number|point is a required/i.test(m)) {
            return 'segmento con modifiche non salvate: salva (Ctrl+S) e ripremi il bottone';
        }
        if (/not found in data model/i.test(m)) {
            return 'segmento non pi\u00f9 caricato nell\'editor: torna sulla strada (o riduci lo zoom finch\u00e9 la vedi tutta) e ripremi il bottone';
        }
        if (/exists|duplicate/i.test(m)) return 'civico gi\u00e0 presente';
        if (/permission|rank|lock/i.test(m)) return 'permessi insufficienti sul segmento';
        return m;
    }

    // Come si presenta una riga in forma 20/1, secondo la modalita' scelta dall'utente
    const suspNote = () => ['warn', '\u26a0\ufe0f formato non accettato da Waze: va inserito a mano'];

    const HN_MAX_D = 45; // Waze rifiuta i civici troppo lontani dal segmento: oltre questo limite si salta
    // Soglia dei civici "sovrapposti": deliberatamente strettissima. Serve a prendere SOLO i punti
    // che stanno sulla stessa identica coordinata (l'archivio arrotonda a 5-6 decimali, cioe' circa
    // un metro), non i vicini di casa: in centro due portoni distinti stanno spesso a 4-6 m e
    // accorparli vorrebbe dire far perdere civici veri.
    const HN_OVERLAP_D = 1.5;
    const HN_OVERLAP_TXT = String(HN_OVERLAP_D).replace('.', ',');
    const HN_SAME_D = 40;   // entro questa distanza consideriamo che sia lo stesso civico
    const HN_SAME_DEG = 6e-4; // pre-filtro grossolano prima della distanza vera (evita mille haversine)

    // Il civico numero X esiste gia' su Waze qui vicino? Unico posto in cui si decide.
    function findExistingHN(existing, label, lon, lat) {
        if (!existing || !existing.length) return null;
        const k = hnKey(label);
        return existing.find(h => !h.rpp && hnKey(h.num) === k &&
            Math.abs(h.c[0] - lon) < HN_SAME_DEG && Math.abs(h.c[1] - lat) < HN_SAME_DEG &&
            haversine(h.c[0], h.c[1], lon, lat) < HN_SAME_D) || null;
    }

    // Lo stesso numero esiste gia' sui segmenti in lista, ma sta LONTANO dal punto ANNCSU:
    // e' un civico messo male, non un civico mancante. Prima della 0.1.5 il controllo guardava
    // solo il raggio di 40 m e quindi non lo vedeva: la riga arrivava spuntata e l'inserimento
    // creava un doppione (che Waze rifiuta al salvataggio, o peggio accetta lasciando due punti).
    // Si guarda solo ai civici della strada in lista: un "5" di una via vicina non c'entra nulla.
    function findMisplacedHN(existing, label, lon, lat) {
        if (!existing || !existing.length) return null;
        let best = null, bestD = Infinity;
        const k = hnKey(label);
        for (const h of existing) {
            if (!h.own || h.rpp || hnKey(h.num) !== k) continue;
            const d = haversine(h.c[0], h.c[1], lon, lat);
            if (d < HN_SAME_D) return null; // ce n'e' uno gia' al posto giusto: caso normale
            if (d < bestD) { bestD = d; best = h; }
        }
        return best ? { hn: best, d: bestD } : null;
    }

    // Civici che cadono praticamente nello stesso punto (portone e passo carrabile rilevati
    // sulla stessa coordinata, numeri diversi sullo stesso ingresso, doppie righe d'archivio):
    // sulla mappa le etichette si stampano una sopra l'altra e diventano illeggibili, e su Waze
    // due punti sovrapposti sono comunque un errore. Qui si marcano a gruppi: l'elenco li
    // presenta tutti senza spunta e ne fa scegliere UNO solo.
    function markOverlaps(list) {
        for (const p of list) { p.ovl = 0; p.ovlN = 0; }
        let g = 0;
        for (let i = 0; i < list.length; i++) {
            const a = list[i];
            for (let j = i + 1; j < list.length; j++) {
                const b = list[j];
                // pre-filtro grossolano: ~3 m di lato, evita di calcolare mille distanze vere
                if (Math.abs(a.lon - b.lon) > 3e-5 || Math.abs(a.lat - b.lat) > 3e-5) continue;
                if (haversine(a.lon, a.lat, b.lon, b.lat) > HN_OVERLAP_D) continue;
                if (a.ovl && b.ovl) {
                    if (a.ovl === b.ovl) continue;
                    const vecchio = b.ovl; // due gruppi che si toccano diventano uno solo
                    for (const x of list) if (x.ovl === vecchio) x.ovl = a.ovl;
                } else if (a.ovl) b.ovl = a.ovl;
                else if (b.ovl) a.ovl = b.ovl;
                else { a.ovl = b.ovl = ++g; }
            }
        }
        const n = new Map();
        for (const p of list) if (p.ovl) n.set(p.ovl, (n.get(p.ovl) || 0) + 1);
        for (const p of list) if (p.ovl) p.ovlN = n.get(p.ovl);
        return g;
    }

    function hnCandidates(r) {
        const all = (lastPtsByG.get(r.g) || []).filter(p => p.label);
        const list = all.filter(p => p.d <= HN_MAX_D);
        return { all, list, tooFar: all.length - list.length };
    }

    // Lettura tollerante: "18/B" -> [18, 'B'], "18" -> [18, '']. Serve per ordinare e classificare
    // etichette che arrivano dall'archivio, dove l'esponente puo' essere qualsiasi cosa.
    const splitHn = lbl => {
        const m = /^\s*(\d+)\s*\/?\s*(.*?)\s*$/.exec(String(lbl || ''));
        return m ? [parseInt(m[1], 10), m[2]] : [0, ''];
    };

    // Formato dei civici su Waze (Wazeopedia Italia, "Numeri civici"): numeri seguiti da al
    // massimo 2 lettere minuscole, mai una lettera in testa (34a, 3ce, 729ar). Niente barra.
    // ANNCSU scrive "343/A": su Waze diventa "343a".
    const HN_WAZE_RE = /^\d{1,5}[a-z]{0,2}$/;
    function wazeHn(lbl) {
        const m = /^\s*(\d{1,5})\s*(?:\/?\s*([A-Za-z]{1,2}))?\s*$/.exec(String(lbl == null ? '' : lbl));
        return m ? m[1] + (m[2] || '').toLowerCase() : null;
    }
    // Chiave di confronto fra civici scritti in modi diversi: 18/B, 18B, 18 b -> 18b.
    // La barra davanti a una cifra resta: "20/1" non deve diventare il civico 201.
    const hnKey = v => String(v == null ? '' : v).toLowerCase().replace(/\s+/g, '').replace(/\/(?=[a-z])/g, '');

    // Civici che Waze non accetta cosi' come sono: esponente numerico ("20/1", spesso una
    // colonna del CSV letta male) o di piu' lettere ("12/BIS"). Si mostrano, ma non si inseriscono.
    const isSusp = lbl => !wazeHn(lbl);

    // Validazione di quello che l'utente scrive nella casella: "18b" / "18 B" / "18/b" -> "18b".
    // null se Waze non lo accetterebbe.
    function normHn(s) {
        const v = wazeHn(s);
        return v && HN_WAZE_RE.test(v) ? v : null;
    }

    function mapCenter() {
        try {
            const c = sdk.Map.getMapCenter();
            return (c && c.lon != null && c.lat != null) ? [c.lon, c.lat] : null;
        } catch { return null; }
    }

    function nearestCapturedDist(lon, lat) {
        if (!captured.size) return 0;
        const cosLat = Math.cos(lat * Math.PI / 180);
        let best = Infinity;
        for (const v of captured.values()) {
            if (!v.coords || v.coords.length < 2) continue;
            const d = distPointToPolyline(lon, lat, v.coords, cosLat);
            if (d < best) best = d;
        }
        return isFinite(best) ? best : 0;
    }

    function quickCenter(lon, lat) {
        try { sdk.Map.setMapCenter({ lonLat: { lon, lat } }); return true; }
        catch { return false; }
    }

    // Civici gia' presenti su Waze: prova a caricarli davvero (SDK per-segmento, store, legacy)
    // Tutti i segmenti CARICATI che appartengono alla stessa via di quelli in lista.
    // I civici gia' su Waze non stanno per forza sul pezzo che hai catturato: il "5" puo'
    // trovarsi cento metri piu' avanti, su un altro troncone dello stesso odonimo (o su una
    // carreggiata gemella). Chiedendo i civici solo per i segmenti in lista non lo si vedeva
    // e il doppione passava. Il legame e' l'ID della strada (primario o alternativo), non il
    // nome scritto: cosi' due vie omonime in comuni diversi restano separate.
    // Limite noto: si vede solo cio' che l'editor ha caricato (SDK Segments.getAll).
    function sameStreetSegmentIds() {
        const ids = new Set([...captured.keys()]);
        const streets = new Set();
        for (const id of captured.keys()) {
            try {
                const seg = sdk.DataModel.Segments.getById({ segmentId: id });
                if (!seg) continue;
                if (seg.primaryStreetId != null) streets.add(seg.primaryStreetId);
                for (const a of (seg.alternateStreetIds || [])) if (a != null) streets.add(a);
            } catch { /* prossimo */ }
        }
        if (!streets.size) return [...ids];
        try {
            for (const seg of (sdk.DataModel.Segments.getAll() || [])) {
                if (!seg || ids.has(seg.id)) continue;
                // hasHouseNumbers === false = il segmento non ne ha: inutile chiederglieli
                if (seg.hasHouseNumbers === false) continue;
                const stessa = (seg.primaryStreetId != null && streets.has(seg.primaryStreetId)) ||
                    (seg.alternateStreetIds || []).some(a => streets.has(a));
                if (stessa) ids.add(seg.id);
                if (ids.size >= 400) break; // una via lunghissima non deve bloccare il pannello
            }
        } catch { /* restano i segmenti in lista */ }
        return [...ids];
    }

    async function loadExistingHNs() {
        const HN = sdk.DataModel && sdk.DataModel.HouseNumbers;
        const out = [];
        // "mio" = civico che sta su un segmento DELLA STESSA VIA, non solo su quelli catturati
        const viaIds = sameStreetSegmentIds();
        const capIds = new Set(viaIds.map(String));
        // Serve a distinguere il numero 5 di QUESTA via da un 5 qualsiasi caricato in zona su
        // un'altra strada: solo il primo e' un doppione, anche se il punto e' lontano.
        const segIdOf = h => (h.segmentId != null ? h.segmentId : (h.segID != null ? h.segID : h.segmentID));
        const isOwn = (h, forced) => {
            if (forced) return true;
            const sid = segIdOf(h);
            return sid != null && capIds.has(String(sid));
        };
        const push = (h, forced) => {
            if (!h) return;
            // i nomi dei campi sono cambiati fra le versioni dell'SDK: si accettano entrambi
            const num = h.number != null ? h.number : (h.houseNumber != null ? h.houseNumber : null);
            let c = (h.geometry && h.geometry.coordinates) || (h.point && h.point.coordinates) || null;
            // il modello interno del WME tiene le coordinate in metri (Mercator)
            if (!c && h.geometry && h.geometry.x != null && h.geometry.y != null) c = merc2wgs(h.geometry.x, h.geometry.y);
            if (num == null || !c || c.length < 2) return;
            out.push({ num: String(num), c: [c[0], c[1]], own: isOwn(h, forced) });
        };
        // getHouseNumbers puo' rispondere sincrona o con una promessa, a seconda della versione
        const collect = async (arg, forced) => {
            let r = HN.getHouseNumbers(arg);
            if (r && typeof r.then === 'function') r = await r;
            if (!Array.isArray(r)) return null;
            r.forEach(h => push(h, forced));
            return r.length;
        };
        // SOLO i segmenti davvero caricati: un id scaricato dall'editor fa fallire l'intera
        // richiesta ("segment ... not found in data model"), e il confronto salterebbe in
        // silenzio facendo ricomparire come mancanti civici che su Waze ci sono gia'.
        const nums = viaIds.map(Number).filter(n => !isNaN(n) && segmentoCaricato(n));
        const scaricati = viaIds.length - nums.length;
        const hasHN = HN && typeof HN.getHouseNumbers === 'function' && nums.length;
        // Waze sa gia' se un segmento ha civici: se ne ha e noi non ne leggiamo nessuno,
        // la lettura non ha funzionato e NON si deve dire "nessun civico".
        let attesi = 0;
        for (const id of nums) {
            try { const sg = sdk.DataModel.Segments.getById({ segmentId: id }); if (sg && sg.hasHouseNumbers) attesi++; }
            catch { /* prossimo */ }
        }

        // Il controllo dei doppioni e' troppo importante per fidarsi di una sola strada: si
        // provano tutte le sorgenti note, dalla piu' precisa alla piu' generica, e si va avanti
        // finche' una non risponde davvero. Se NESSUNA risponde non si dice "nessun civico":
        // si avvisa che il confronto non e' stato fatto.
        const sorgenti = [
            ['SDK, tutta la via in blocco', async () => hasHN ? collect({ segmentIds: nums }, true) : null],
            ['SDK, segmento per segmento', async () => {
                if (!hasHN) return null;
                let tot = null, errori = 0;
                for (const id of nums) {
                    // un segmento che fallisce non deve far saltare tutti gli altri
                    try {
                        const n = await collect({ segmentIds: [id] }, true);
                        if (n != null) tot = (tot || 0) + n;
                    } catch { errori++; }
                }
                if (errori) log(`civici esistenti: ${errori} ${pl(errori, 'segmento non leggibile', 'segmenti non leggibili')} su ${nums.length}`);
                return tot;
            }],
            ['SDK, firma segmentId singolo', async () => {
                if (!hasHN) return null;
                let tot = null;
                for (const id of nums) {
                    try {
                        const n = await collect({ segmentId: id }, true);
                        if (n != null) tot = (tot || 0) + n;
                    } catch { /* prossimo segmento */ }
                }
                return tot;
            }],
        ];
        const locali = [
            ['SDK, tutti i civici caricati', async () => {
                if (!HN || typeof HN.getAll !== 'function') return null;
                const r = HN.getAll();
                if (!Array.isArray(r)) return null;
                r.forEach(h => push(h, false));
                return r.length;
            }],
            ['modello del WME', async () => {
                const W = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).W;
                const repo = W && W.model && W.model.segmentHouseNumbers;
                const arr = repo && typeof repo.getObjectArray === 'function' ? repo.getObjectArray() : null;
                if (!Array.isArray(arr)) return null;
                arr.forEach(o => push(o && (o.attributes || o), false));
                return arr.length;
            }]
        ];
        let ok = false, come = '', letti = 0;
        for (const [nome, fn] of sorgenti) {
            let n = null;
            try { n = await fn(); }
            catch (e) { log('civici esistenti \u00b7 ' + nome + ' KO', e); continue; }
            if (n == null) continue;          // sorgente non disponibile su questo editor
            ok = true; come = nome; letti = n;
            if (out.length) break;            // qualcosa di utile e' arrivato: basta cosi'
        }
        // Le sorgenti qui sopra leggono quello che il WME ha gia' salvato. I civici appena
        // aggiunti (tuoi o di un altro script) stanno solo nel modello locale: si aggiungono
        // SEMPRE, altrimenti un civico inserito e non ancora salvato tornerebbe nell'elenco
        // come mancante, con la spunta.
        for (const [nome, fn] of locali) {
            try { const n = await fn(); if (n != null) { ok = true; if (!come) come = nome; letti += n; } }
            catch (e) { log('civici esistenti \u00b7 ' + nome + ' KO', e); }
        }
        // Controllo di validita' PRIMA di aggiungere i civici inseriti da noi in questa sessione:
        // altrimenti i nostri stessi inserimenti maschererebbero una lettura fallita.
        // se Waze dice che su questi segmenti ci sono civici e noi non ne abbiamo letto
        // nemmeno uno, il confronto NON e' valido
        const civiciLetti = out.filter(h => h.own).length;
        if (attesi > 0 && civiciLetti === 0) {
            ok = false;
            log(`civici esistenti: ${attesi} ${pl(attesi, 'segmento ha', 'segmenti hanno')} civici secondo il WME, ma non se n'e' letto nessuno`);
        }
        // ultima rete: quello che ha inserito lo script in questa sessione
        const vieOra = viaStreetIds(viaIds);
        for (const h of civiciInseriti) {
            const stessaVia = (h.segId != null && capIds.has(String(h.segId)))
                || (h.streets && [...h.streets].some(x => vieOra.has(String(x))));
            if (stessaVia) out.push({ num: h.num, c: h.c, own: true });
        }
        lastHNScan = { hn: 0, segs: nums.length, rpp: 0, ok, come, scaricati, attesi };
        log(`civici gia' su Waze: ${out.length} utili su ${letti} letti, ${nums.length}/${viaIds.length} segmenti caricati della stessa via ` +
            `(${captured.size} in lista)${ok ? ' \u00b7 sorgente: ' + come : ' \u00b7 LETTURA NON RIUSCITA'}`);
        // Luoghi residenziali (RPP) della stessa via: per la guida un indirizzo gia' fatto come RPP
        // non va inserito anche come civico normale
        try {
            const streets = viaStreetIds(viaIds);
            for (const v of (sdk.DataModel.Venues.getAll() || [])) {
                if (!v || !v.isResidential) continue;
                let ad = null;
                try { ad = sdk.DataModel.Venues.getAddress({ venueId: v.id }); } catch { continue; }
                if (!ad || !ad.houseNumber || !ad.street || !streets.has(String(ad.street.id))) continue;
                const c = venuePoint(v);
                if (!c) continue;
                out.push({ num: String(ad.houseNumber), c, own: true, rpp: true });
                lastHNScan.rpp++;
            }
        } catch { /* modello dei luoghi non disponibile */ }
        const seen = new Map();
        const uniq = [];
        for (const h of out) {
            const k = h.num + '|' + Math.round(h.c[0] * 1e5) + '|' + Math.round(h.c[1] * 1e5);
            const old = seen.get(k);
            if (old) { if (h.own) old.own = true; continue; } // stesso civico letto da piu' sorgenti
            seen.set(k, h);
            uniq.push(h);
        }
        lastHNScan.hn = uniq.filter(h => h.own && !h.rpp).length;
        return uniq;
    }

    // ID delle vie (primario e alternativi) dei segmenti indicati
    function viaStreetIds(segIds) {
        const out = new Set();
        for (const id of segIds) {
            try {
                const seg = sdk.DataModel.Segments.getById({ segmentId: Number(id) });
                if (!seg) continue;
                if (seg.primaryStreetId != null) out.add(String(seg.primaryStreetId));
                for (const a of (seg.alternateStreetIds || [])) if (a != null) out.add(String(a));
            } catch { /* prossimo */ }
        }
        return out;
    }

    // Punto di un luogo: il punto stesso, o il centro del poligono
    function venuePoint(v) {
        const g = v && v.geometry;
        if (!g || !g.coordinates) return null;
        if (g.type === 'Point') return g.coordinates;
        const ring = g.type === 'Polygon' ? g.coordinates[0] : null;
        if (!ring || !ring.length) return null;
        let x = 0, y = 0;
        for (const q of ring) { x += q[0]; y += q[1]; }
        return [x / ring.length, y / ring.length];
    }

    // Segmenti caricati divisi in "della via" e "di altre vie con nome". Servono a due cose:
    // agganciare il civico al segmento giusto (addHouseNumber con segmentId) e accorgersi degli
    // accessi che stanno su un'altra strada, che per la guida vanno fatti come RPP.
    const RT_RAMP = 4;
    // Un segmento in lista puo' non essere piu' nel modello: l'editor scarica quello che esce
    // dalla vista. Un id scaricato passato a addHouseNumber fa fallire l'inserimento
    // ("segment ... not found in data model"), quindi qui si tiene solo cio' che c'e' davvero.
    function segmentoCaricato(id) {
        try { return !!sdk.DataModel.Segments.getById({ segmentId: Number(id) }); }
        catch { return false; }
    }

    // Nomi della via su cui stiamo lavorando: quelli dei segmenti in lista (primario e
    // alternativi) piu' l'odonimo ANNCSU. Servono perche' lo stesso nome puo' avere piu' ID
    // diversi (con citta' e senza, frazioni, tronconi creati in momenti diversi): senza questo
    // controllo un troncone della STESSA via verrebbe scambiato per un'altra strada.
    function nomiDellaVia(viaIds, odonimo) {
        const out = new Set();
        const add = n => { const k = deacc(String(n || '')).replace(/[^a-z0-9]+/g, ''); if (k) out.add(k); };
        if (odonimo) add(odonimo);
        for (const id of viaIds) {
            try {
                const seg = sdk.DataModel.Segments.getById({ segmentId: Number(id) });
                if (!seg) continue;
                if (seg.primaryStreetId != null) add(streetNameById(seg.primaryStreetId));
                for (const a of (seg.alternateStreetIds || [])) if (a != null) add(streetNameById(a));
            } catch { /* prossimo */ }
        }
        return out;
    }

    function hnSegmentContext(odonimo) {
        const viaIds = new Set(sameStreetSegmentIds().map(String));
        const nomiVia = nomiDellaVia(viaIds, odonimo);
        const stessoNome = n => {
            const k = deacc(String(n || '')).replace(/[^a-z0-9]+/g, '');
            return !!k && nomiVia.has(k);
        };
        const own = [], other = [];
        let all = [];
        try { all = sdk.DataModel.Segments.getAll() || []; } catch { /* sotto */ }
        for (const sg of all) {
            const c = sg && sg.geometry && sg.geometry.coordinates;
            if (!c || c.length < 2) continue;
            if (viaIds.has(String(sg.id))) { own.push({ id: sg.id, c }); continue; }
            if (sg.primaryStreetId == null || sg.isDrivable === false || sg.roadType === RT_RAMP) continue;
            // stesso nome = stessa via, anche se l'ID della strada e' diverso (citta' diversa,
            // frazione, troncone creato a parte): va fra i "nostri", non fra gli accessi altrui
            if (stessoNome(streetNameById(sg.primaryStreetId))) { own.push({ id: sg.id, c }); continue; }
            other.push({ id: sg.id, c, street: sg.primaryStreetId });
        }
        // i segmenti della lista non piu' caricati entrano solo come geometria (id a null):
        // servono a capire la distanza, ma non si possono usare per agganciare il civico
        for (const [id, v] of captured) {
            if (!v || !v.coords || v.coords.length < 2) continue;
            if (own.some(o => sameId(o.id, id))) continue;
            own.push({ id: segmentoCaricato(id) ? id : null, c: v.coords });
        }
        return { own, other };
    }

    // Segmento piu' vicino a un punto: { id, d, street } oppure null
    function nearestSeg(segs, lon, lat) {
        if (!segs) return null;
        const cosLat = Math.cos(lat * Math.PI / 180);
        let best = null;
        for (const sg of segs) {
            let inBox = false;
            for (const q of sg.c) { if (Math.abs(q[0] - lon) < 0.003 && Math.abs(q[1] - lat) < 0.002) { inBox = true; break; } }
            if (!inBox) continue;
            const d = distPointToPolyline(lon, lat, sg.c, cosLat);
            if (!best || d < best.d) best = { id: sg.id, d, street: sg.street };
        }
        return best;
    }

    // Segmenti in fila, dal primo all'ultimo, con il verso di percorrenza. null se non formano
    // una strada unica senza diramazioni (incroci a T fra tronconi con lo stesso nome, buchi).
    function orderChain(ids) {
        const S = sdk.DataModel.Segments;
        const segs = [];
        for (const id of ids) {
            try { const sg = S.getById({ segmentId: Number(id) }); if (sg && sg.fromNodeId != null && sg.toNodeId != null && sg.geometry) segs.push(sg); }
            catch { return null; }
        }
        if (!segs.length) return null;
        const deg = new Map();
        for (const sg of segs) for (const nd of [sg.fromNodeId, sg.toNodeId]) deg.set(nd, (deg.get(nd) || 0) + 1);
        if ([...deg.values()].some(v => v > 2)) return null;
        const ends = [...deg.entries()].filter(([, v]) => v === 1).map(([nd]) => nd);
        if (ends.length !== 2) return null;
        const out = [];
        const used = new Set();
        let node = ends[0];
        while (out.length < segs.length) {
            const sg = segs.find(x => !used.has(x.id) && (x.fromNodeId === node || x.toNodeId === node));
            if (!sg) return null;
            used.add(sg.id);
            const rev = sg.toNodeId === node;
            out.push({ id: sg.id, rev, c: sg.geometry.coordinates });
            node = rev ? sg.fromNodeId : sg.toNodeId;
        }
        return out;
    }

    // Posizione di un punto rispetto a una linea percorsa nel suo verso: metri dall'inizio e lato
    // (+1 sinistra, -1 destra, 0 praticamente sopra la linea)
    function alongSide(c, lon, lat) {
        const k = Math.cos(lat * Math.PI / 180) * 111320, h = 110540;
        let best = null, acc = 0;
        for (let i = 0; i < c.length - 1; i++) {
            const ax = c[i][0] * k, ay = c[i][1] * h, bx = c[i + 1][0] * k, by = c[i + 1][1] * h;
            const px = lon * k, py = lat * h;
            const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
            let t = ((px - ax) * dx + (py - ay) * dy) / (L * L);
            t = Math.max(0, Math.min(1, t));
            const qx = ax + t * dx, qy = ay + t * dy;
            const d = Math.hypot(px - qx, py - qy);
            if (!best || d < best.d) {
                const cross = dx * (py - ay) - dy * (px - ax);
                best = { d, along: acc + t * L, side: d < 1 ? 0 : Math.sign(cross) };
            }
            acc += L;
        }
        return best ? { along: best.along, side: best.side, len: acc } : null;
    }

    // Anteprima dei due errori "forzabili" della guida Numeri civici: civico dal lato opposto
    // agli altri della stessa parita' e civico fuori sequenza. Si controlla solo quando il quadro
    // e' chiaro (strada unica, dispari e pari su lati opposti, maggioranze nette) e mai nelle
    // piazze, dove la numerazione gira intorno e la guida avverte che i falsi allarmi sono normali.
    function annotateNumbering(ctx) {
        if (/^(piazza|piazzale|largo|piazzetta|slargo)\b/i.test(String(ctx.rName || '').trim())) return 0;
        const cand = ctx.rows.filter(x => !x.p.manual && x.p.segId != null && /^\d+/.test(x.p.label));
        if (cand.length < 6) return 0;
        const ids = [...new Set(cand.map(x => String(x.p.segId)))];
        const chain = orderChain(ids);
        let offset = 0;
        const pos = new Map();
        const place = (x, segEntry, off) => {
            const a = alongSide(segEntry.c, x.p.lon, x.p.lat);
            if (!a) return;
            pos.set(x, { along: off + (segEntry.rev ? a.len - a.along : a.along), side: segEntry.rev ? -a.side : a.side });
        };
        if (chain) {
            const offOf = new Map();
            for (const e of chain) {
                offOf.set(String(e.id), { e, off: offset });
                const a = alongSide(e.c, e.c[0][0], e.c[0][1]);
                offset += a ? a.len : 0;
            }
            for (const x of cand) { const o = offOf.get(String(x.p.segId)); if (o) place(x, o.e, o.off); }
        } else if (ids.length === 1) {
            const c = segGeometry(Number(ids[0]));
            if (c) for (const x of cand) place(x, { c, rev: false }, 0);
        } else return 0;

        const num = x => parseInt(x.p.label, 10);
        const gruppi = [cand.filter(x => num(x) % 2 === 1), cand.filter(x => num(x) % 2 === 0)];
        const maggioranza = g => {
            const lati = g.map(x => (pos.get(x) || {}).side).filter(v => v);
            if (lati.length < 3) return 0;
            const sx = lati.filter(v => v > 0).length;
            if (sx / lati.length >= 0.75) return 1;
            if ((lati.length - sx) / lati.length >= 0.75) return -1;
            return 0;
        };
        const mDisp = maggioranza(gruppi[0]), mPari = maggioranza(gruppi[1]);
        const flagged = new Map();
        // lato: solo se dispari e pari stanno davvero su lati opposti
        if (mDisp && mPari && mDisp !== mPari) {
            gruppi.forEach((g, gi) => {
                const m = gi === 0 ? mDisp : mPari;
                for (const x of g) { const q = pos.get(x); if (q && q.side && q.side !== m) flagged.set(x, gi === 0 ? 'lato dei pari' : 'lato dei dispari'); }
            });
        }
        // sequenza: solo con la strada in fila dall'inizio alla fine
        if (chain) {
            for (const g of gruppi) {
                const seq = g.filter(x => pos.has(x)).sort((a, b) => pos.get(a).along - pos.get(b).along);
                if (seq.length < 4) continue;
                const lis = (arr, cmp) => {
                    const n = arr.length, len = new Array(n).fill(1), prev = new Array(n).fill(-1);
                    let bi = 0;
                    for (let i = 0; i < n; i++) {
                        for (let j = 0; j < i; j++) if (cmp(num(arr[j]), num(arr[i])) && len[j] + 1 > len[i]) { len[i] = len[j] + 1; prev[i] = j; }
                        if (len[i] > len[bi]) bi = i;
                    }
                    const keep = new Set();
                    for (let i = bi; i >= 0; i = prev[i]) keep.add(arr[i]);
                    return keep;
                };
                const up = lis(seq, (a, b) => a <= b), down = lis(seq, (a, b) => a >= b);
                const keep = up.size >= down.size ? up : down;
                if (keep.size / seq.length < 0.7) continue;   // quadro confuso: meglio tacere
                for (const x of seq) if (!keep.has(x) && !flagged.has(x)) flagged.set(x, 'fuori sequenza');
            }
        }
        let n = 0;
        for (const [x, perche] of flagged) {
            if (!x.cb.checked) continue;   // riga gia' senza spunta per un altro motivo
            x.cb.checked = false;
            x.p.seq = perche;
            x.row.classList.add('wfit-hnseq');
            x.setNote('seq', perche === 'fuori sequenza'
                ? 'fuori sequenza rispetto ai vicini: Waze lo contester\u00e0 al salvataggio'
                : `sul ${perche}: Waze lo contester\u00e0 come "lato errato"`);
            x.row.title = 'Rispetto agli altri civici della via questo numero sembra ' + (perche === 'fuori sequenza' ? 'fuori ordine' : 'dal lato sbagliato')
                + '. Spesso \u00e8 un punto ANNCSU messo male. Controlla su Street View: se \u00e8 giusto, spuntalo e al salvataggio '
                + 'Waze chieder\u00e0 di forzarlo (guida Numeri civici, errori forzabili); se \u00e8 sbagliato, lascialo fuori.';
            n++;
        }
        if (n) ctx.addLegend('<span class="wfit-swatch wfit-sw-seq"></span> lato o sequenza insoliti');
        return n;
    }

    // Per ogni riga: a quale segmento della via va agganciato il civico, e se l'accesso sta
    // invece su un'altra strada con nome (piu' vicina di almeno 2 m).
    const nameCache = new Map();
    function annotateAccessStreet(ctx, segCtx) {
        nameCache.clear();
        let n = 0;
        for (const x of ctx.rows) {
            const own = nearestSeg(segCtx.own, x.p.lon, x.p.lat);
            x.p.segId = own ? own.id : null;
            if (x.p.manual || !own) continue;
            const oth = nearestSeg(segCtx.other, x.p.lon, x.p.lat);
            if (!oth || oth.d + 2 >= own.d) continue;
            const k = String(oth.street);
            if (!nameCache.has(k)) nameCache.set(k, streetNameById(oth.street));
            if (!nameCache.get(k)) continue;   // strada senza nome: niente civici, niente RPP
            // ultimo controllo: se si chiama come la via su cui stai lavorando non e' un'altra via
            if (nomeUguale(nameCache.get(k), ctx.rName ? toWazeCase(ctx.rName) : '')) continue;
            x.p.altro = { nome: nameCache.get(k), d: Math.round(oth.d), segId: oth.id };
            x.cb.checked = false;
            x.row.classList.add('wfit-hnrpp');
            x.setNote('rpp', `accesso su ${x.p.altro.nome} (~${x.p.altro.d} m): per la guida va fatto come luogo residenziale (RPP), non come civico`);
            x.row.title = `Il punto ANNCSU di questo civico \u00e8 a ~${x.p.altro.d} m da ${x.p.altro.nome} e a ~${Math.round(own.d)} m dalla sua strada. `
                + 'Se l\'ingresso \u00e8 davvero su un\'altra via (controviale, casa con accesso laterale), la guida Numeri civici della '
                + 'Wazeopedia Italia chiede un luogo residenziale (Residential Point Place, RPP: un Place di categoria Residenziale '
                + 'con via e numero civico e il punto di arrivo sull\'ingresso), non un civico normale. '
                + 'Controlla su Street View: se l\'ingresso \u00e8 sulla sua strada, spuntalo pure.';
            n++;
        }
        if (n) ctx.addLegend('<span class="wfit-swatch wfit-sw-rpp"></span> accesso su un\'altra via: serve un luogo residenziale (RPP)');
        return n;
    }

    /* ------------------------------------------------------------------ */
    /* Elenco di controllo dei civici                                      */
    /* ------------------------------------------------------------------ */

    // I civici vivono solo su strade CON nome: se i segmenti in lista sono "Senza strada", prima il nome.
    // null = non e' stato possibile leggere l'indirizzo di nessun segmento (non blocchiamo per questo).
    function capturedHaveNamedStreet() {
        let checkedAny = false;
        for (const id of captured.keys()) {
            try {
                const ad = sdk.DataModel.Segments.getAddress({ segmentId: id });
                checkedAny = true;
                if (ad && !ad.isEmpty && ad.street && ad.street.name) return true;
            } catch { /* prossimo */ }
        }
        return checkedAny ? false : null;
    }

    // Motivo per cui l'elenco non si puo' aprire, oppure null se si puo'
    function hnReviewBlocker(cand) {
        if (!cand.all.length) return { msg: 'Per questo odonimo non ci sono civici numerati agganciati.' };
        if (!cand.list.length) {
            return {
                msg: `Tutti i ${cand.all.length} civici di questo odonimo sono oltre ${HN_MAX_D} m dalla strada: Waze li rifiuterebbe al salvataggio. Vanno inseriti a mano (piazzali vicino alla strada e trascinali sul punto reale).`,
                ms: 12000
            };
        }
        return null;
    }

    // Scheda vuota: intestazione, legenda, elenco e lo stato condiviso fra tutti i pezzi
    function createHnReviewBox(shown, cand) {
        const box = document.createElement('div');
        box.className = 'wfit-hnrev';
        const head = document.createElement('div');
        head.className = 'wfit-muted';
        head.innerHTML = `<b>Controlla e conferma</b> \u00b7 ${shown.length} ${pl(shown.length, 'civico pronto', 'civici pronti')}` +
            ' \u00b7 tutti in ordine di numero' +
            (cand.tooFar ? ` \u00b7 ${cand.tooFar} oltre ${HN_MAX_D} m esclusi` : '') +
            ` \u00b7 numero modificabile \u00b7 <a href="javascript:void(0)" data-a="all">tutti</a> / <a href="javascript:void(0)" data-a="none">nessuno</a>`;
        box.appendChild(head);
        // legenda dei motivi per cui una riga arriva senza spunta
        const legend = document.createElement('div');
        legend.className = 'wfit-muted wfit-hnleg';
        legend.style.display = 'none';
        box.appendChild(legend);
        // riga di servizio: su quanti civici gia' su Waze e' stato fatto il confronto
        const scan = document.createElement('div');
        scan.className = 'wfit-muted wfit-hnscan';
        scan.style.display = 'none';
        box.appendChild(scan);
        const listDiv = document.createElement('div');
        listDiv.className = 'wfit-hnlist';
        box.appendChild(listDiv);

        const bGo = document.createElement('button');
        const ctx = { box, head, legend, scan, listDiv, bGo, rows: [], legendBits: [], ovlWarned: new Set() };
        ctx.updateGo = () => {
            const k = ctx.rows.filter(x => x.cb.checked).length;
            bGo.textContent = `Inserisci ${k} ${pl(k, 'civico', 'civici')}`;
            bGo.disabled = !k;
        };
        ctx.refreshLegend = () => {
            // ogni voce e' un blocco indivisibile: pallino + testo restano insieme e, se sulla
            // riga non ci sta, la voce intera va a capo (niente piu' separatori a mezz'aria)
            legend.innerHTML = ctx.legendBits.map(b => `<span class="wfit-legitem">${b}</span>`).join('');
            legend.style.display = ctx.legendBits.length ? '' : 'none';
        };
        ctx.addLegend = bit => { ctx.legendBits.push(bit); ctx.refreshLegend(); };
        ctx.addRow = p => addHnRow(p, ctx);
        return ctx;
    }

    // Spiegazione della riga, diversa a seconda di come e' arrivato quel civico
    function hnRowTitle(p) {
        const base = p.susp
            ? `Waze accetta solo numeri seguiti da al massimo due lettere minuscole (34a, 3ce): "${p.label}" cos\u00ec non si pu\u00f2 inserire. `
                + 'Se sul posto il civico \u00e8 davvero questo, va inserito a mano seguendo la guida Numeri civici della Wazeopedia. '
                + 'Se hai verificato che il numero giusto \u00e8 un altro, correggilo nella casella e spuntalo.'
            : p.ovl
            ? `Questo civico sta sulla stessa coordinata di altri ${p.ovlN - 1} (meno di ${HN_OVERLAP_TXT} m): sulla mappa i numeri si stampano uno sopra l\'altro e non si leggono. Per questo il gruppo arriva senza spunta e la scelta la fai tu: guarda il posto su Street View e spunta quelli che esistono davvero \u2014 anche piu\' di uno, se sul posto ci sono davvero piu\' ingressi. Quelli che inserisci nascono tutti in questo punto: poi vanno TRASCINATI uno per uno sull\'ingresso giusto, prima di salvare. Clic sulla riga per centrare la mappa.`
            : p.dup
            ? 'Questo numero compare su piu\' record ANNCSU distinti (stesso comune, stesso odonimo, stessa localita\'): qui vedi un\'altra posizione dello stesso civico. Clic per centrarla e confrontarla con Street View; Waze accetta un solo punto per numero. Pochi metri di distanza = stesso accesso rilevato due volte; decine di metri = secondo accesso reale o errore d\'archivio.'
            : 'Clic sulla riga: la mappa si centra su questo civico. Il numero \u00e8 modificabile (es. 18 \u2192 18b).';
        return base + (p.manual ? '' : `\nCoordinate: ${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`);
    }

    // Una riga dell'elenco: spunta, numero modificabile, distanza e nota.
    // Layout su due righe: sopra spunta, numero e distanza (sempre corti, mai a capo),
    // sotto la nota solo quando serve. Su una riga sola, in un pannello stretto,
    // il testo si spezzava una parola per riga.
    function addHnRow(p, ctx) {
        const row = document.createElement('div');
        p.susp = !p.manual && isSusp(p.label);
        row.className = 'wfit-hnrow' + (p.susp ? ' wfit-hnsusp' : p.ovl ? ' wfit-hnovl' : p.dup ? ' wfit-hndup' : '');
        row.title = hnRowTitle(p);

        // ripetizioni, civici sovrapposti e numeri che Waze non accetta arrivano senza spunta:
        // restano visibili, ma di loro iniziativa non finiscono su Waze
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.checked = !p.dup && !p.ovl && !p.susp;
        if (p.susp && settings.suspMode === 'escludi') row.style.display = 'none';
        const inp = document.createElement('input');
        // nella casella c'e' gia' il numero come lo vuole Waze (343/A -> 343a)
        inp.type = 'text'; inp.className = 'wfit-hnnum'; inp.value = p.manual ? p.label : (wazeHn(p.label) || p.label);
        inp.addEventListener('input', () => {
            inp.classList.remove('wfit-bad-in');
            // il numero e' cambiato: quello che sapevamo del civico gia' su Waze non vale piu'
            if (p.wazeFar) { p.wazeFar = null; row.classList.remove('wfit-hnmoved'); setNote('', ''); }
        });
        const dist = document.createElement('span'); dist.className = 'wfit-muted wfit-hnd';
        dist.textContent = p.manual ? 'aggiunto da te' : `~${Math.round(p.d)} m`;
        const top = document.createElement('div'); top.className = 'wfit-hntop';
        top.appendChild(cb); top.appendChild(inp); top.appendChild(dist);
        const sv = document.createElement('button');
        sv.type = 'button'; sv.className = 'wfit-sv'; sv.innerHTML = SV_ICON;
        sv.title = 'Apri Street View su questo civico';
        sv.addEventListener('click', ev => { ev.stopPropagation(); openStreetView(p.lon, p.lat); });
        top.appendChild(sv);
        // RPP: compare SOLO sulle righe in cui l'accesso sembra su un'altra strada (classe
        // wfit-hnrpp, messa da annotateAccessStreet). Lo crea lo script, poi controlli e salvi tu.
        const rppBtn = document.createElement('button');
        rppBtn.type = 'button'; rppBtn.className = 'wfit-sv wfit-rppbtn'; rppBtn.textContent = 'RPP';
        rppBtn.title = 'Crea qui un luogo residenziale (RPP): Place residenziale con questa via e questo numero, '
            + 'e punto di arrivo sull\'accesso. Serve quando l\'ingresso \u00e8 su una strada diversa da quella dell\'indirizzo '
            + '(controviali, case con ingresso laterale), come chiede la guida Numeri civici.';
        rppBtn.addEventListener('click', ev => { ev.stopPropagation(); creaRPP(p, ctx.r, ctx); });
        top.appendChild(rppBtn);
        row.wfitP = p;
        const note = document.createElement('div'); note.className = 'wfit-hnnote';
        row.appendChild(top); row.appendChild(note);

        const setNote = (kind, txt) => {
            note.className = 'wfit-hnnote' + (kind ? ' wfit-n-' + kind : '');
            note.textContent = txt || '';
            note.style.display = txt ? '' : 'none';
        };
        if (p.susp) setNote(...suspNote());
        else if (p.ovl) setNote('ovl', `${p.ovlN} civici sulla stessa coordinata: scegli quelli veri, poi vanno spostati`);
        else if (p.dup) setNote('dup', `stesso numero, punto ${p.rep} \u00b7 ${Math.round(p.twinD || 0)} m dal punto 1`);
        else setNote('', '');

        row.addEventListener('click', ev => { if (ev.target !== cb && ev.target !== inp && ev.target !== sv && ev.target !== rppBtn && !ev.target.closest('button') && ev.target.tagName !== 'A') quickCenter(p.lon, p.lat); });
        cb.addEventListener('change', () => {
            // civici sulla stessa coordinata: la scelta e' libera, se ne possono spuntare anche
            // piu' di uno. Ma se ne prendi due o piu' nascono uno sopra l'altro, quindi lo si
            // ricorda subito: vanno trascinati sui rispettivi ingressi prima di salvare.
            if (p.ovl && cb.checked) {
                const altri = ctx.rows.filter(x => x.cb !== cb && x.p.ovl === p.ovl && x.cb.checked).length;
                if (altri && !ctx.ovlWarned.has(p.ovl)) {
                    ctx.ovlWarned.add(p.ovl);
                    toast(`Stai inserendo ${altri + 1} civici sulla stessa coordinata: nasceranno uno sopra l'altro. `
                        + 'Va benissimo se sul posto esistono davvero, ma poi trascinali sui rispettivi ingressi prima di salvare.', 11000);
                }
            }
            ctx.updateGo();
        });
        ctx.listDiv.appendChild(row);
        ctx.rows.push({ cb, inp, p, row, setNote });
        return row;
    }

    // Icona del bottone Street View: un occhio (disegno originale, colore dal tema del pannello)
    const SV_ICON = '<svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">'
        + '<path d="M1 6c1.8-3.3 4.3-5 7-5s5.2 1.7 7 5c-1.8 3.3-4.3 5-7 5S2.8 9.3 1 6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
        + '<circle cx="8" cy="6" r="2.6" fill="currentColor"/><circle cx="9" cy="5" r=".8" fill="#fff"/></svg>';

    // Street View sul punto: si centra la mappa e si apre il pannello con il modulo StreetView
    // dell'SDK. Se la firma con il punto non c'e', il pannello si apre sul centro mappa.
    async function openStreetView(lon, lat) {
        quickCenter(lon, lat);
        try { await sdk.StreetView.open({ lonLat: { lon, lat } }); return; } catch { /* firma senza punto */ }
        try { await sdk.StreetView.open(); } catch {
            toast('Street View non si apre da script in questa versione del WME: trascina l\'omino sul punto centrato.', 7000);
        }
    }

    // Punto sulla linea piu' vicino a un punto dato (per il punto di arrivo sull'accesso)
    function projectOnLine(c, lon, lat) {
        const k = Math.cos(lat * Math.PI / 180) * 111320, h = 110540;
        let best = null;
        for (let i = 0; i < c.length - 1; i++) {
            const ax = c[i][0] * k, ay = c[i][1] * h, bx = c[i + 1][0] * k, by = c[i + 1][1] * h;
            const px = lon * k, py = lat * h;
            const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
            let t = ((px - ax) * dx + (py - ay) * dy) / L2;
            t = Math.max(0, Math.min(1, t));
            const qx = ax + t * dx, qy = ay + t * dy;
            const d = Math.hypot(px - qx, py - qy);
            if (!best || d < best.d) best = { d, p: [qx / k, qy / h] };
        }
        return best ? best.p : null;
    }

    // Crea un luogo residenziale (RPP) per un indirizzo il cui accesso sta su un'altra strada,
    // come chiede la guida Numeri civici: Place residenziale nel punto del civico, via e numero
    // dell'odonimo ANNCSU, punto di arrivo sulla strada dell'accesso.
    function rppSupportato() {
        const V = sdk.DataModel && sdk.DataModel.Venues;
        return !!(V && typeof V.addVenue === 'function' && typeof V.updateAddress === 'function');
    }

    function creaRPP(p, r, ctx) {
        const V = sdk.DataModel.Venues;
        const blocco = editingBlock();
        if (blocco) { toast(`Niente RPP: ${blocco}.`, 9000); return; }
        // la via dell'indirizzo: quella del segmento ANNCSU, non quella dell'accesso
        let streetId = null;
        try { const st = segAddressState(p.segId); streetId = st.pn; } catch { /* sotto */ }
        if (streetId == null) { toast('Non riesco a capire la via di questo civico: prima premi "Applica ai segmenti" e salva.', 9000); return; }
        const num = normHn(p.label);
        if (!num) { toast('Numero non valido per un RPP: Waze accetta un numero seguito da al massimo 2 lettere.', 8000); return; }
        const viaTxt = streetLabel(streetId);
        if (!confirm(`Creo un luogo residenziale (RPP) qui:\n\n\u2022 indirizzo: ${viaTxt} ${num}\n`
            + `\u2022 punto del Place: sul civico ANNCSU\n`
            + `\u2022 punto di arrivo: ${p.altro ? 'su ' + p.altro.nome : 'sulla strada pi\u00f9 vicina'}\n\n`
            + 'Poi controlla e salva tu (Ctrl+S). Procedo?')) return;
        let venueId = null;
        try {
            venueId = String(V.addVenue({ category: 'RESIDENTIAL', geometry: { type: 'Point', coordinates: [p.lon, p.lat] } }));
        } catch (e) { toast('Creazione del luogo non riuscita: ' + errText(e), 9000); return; }
        const passi = [];
        try { V.updateAddress({ venueId, addressData: { streetId, houseNumber: num } }); }
        catch (e) {
            try { V.updateAddress({ venueId, streetId, houseNumber: num }); }   // firma precedente
            catch { passi.push('via e numero civico'); log('RPP: indirizzo KO', e); }
        }
        try { if (typeof V.updateVenueIsResidential === 'function') V.updateVenueIsResidential({ venueId, isResidential: true }); }
        catch (e) { log('RPP: flag residenziale KO', e); }
        // punto di arrivo sull'accesso reale
        try {
            let dest = null;
            if (p.altro && p.altro.segId) {
                const c = segGeometry(p.altro.segId);
                if (c) dest = projectOnLine(c, p.lon, p.lat);
            }
            if (dest && typeof V.replaceNavigationPoints === 'function') {
                V.replaceNavigationPoints({ venueId, navigationPoints: [{ point: { type: 'Point', coordinates: dest }, isPrimary: true }] });
            } else if (p.altro) passi.push('punto di arrivo');
        } catch (e) { passi.push('punto di arrivo'); log('RPP: punto di arrivo KO', e); }

        logEvent('rpp', {
            esito: 'inserito', motivo: passi.length ? 'da completare a mano: ' + passi.join(', ') : '',
            comune: r.comune || '', localita: r.locality || '', odonimo: toWazeCase(r.name), civico: num,
            permalink: permalink(p.lon, p.lat, p.segId),
            lat: Number(p.lat.toFixed(7)), lon: Number(p.lon.toFixed(7)), dataset: r.fileDate || ''
        });
        flushLogs();
        // la riga esce dall'elenco: l'indirizzo ora e' l'RPP, non va anche come civico
        if (ctx) {
            const row = ctx.rows.find(x => x.p === p);
            if (row) {
                row.cb.checked = false;
                row.p.rpp = true;
                row.row.classList.remove('wfit-hnrpp');   // fatto: via il bottone
                row.row.classList.add('wfit-hnwaze');
                row.setNote('rpp', `RPP creato: ${viaTxt} ${num} \u00b7 controlla e salva`);
                ctx.updateGo();
            }
        }
        quickCenter(p.lon, p.lat);
        toast(passi.length
            ? `Luogo residenziale creato, ma ${passi.join(' e ')} ${pl(passi.length, 'va impostato', 'vanno impostati')} a mano nel pannello del Place. Poi salva.`
            : `Luogo residenziale creato: ${viaTxt} ${num}. \u00c8 selezionato sulla mappa: controlla nome e punto di arrivo, poi salva.`, 12000);
    }

    // Civico trovato su Street View: lo scrivi tu e nasce alla posizione attuale del centro mappa
    function buildHnAddBox(ctx) {
        const addBox = document.createElement('div');
        addBox.className = 'wfit-hnadd';
        const addIn = document.createElement('input');
        addIn.type = 'text'; addIn.placeholder = 'es. 18b (da Street View)';
        const addBtn = document.createElement('button');
        addBtn.className = 'wfit-btn'; addBtn.textContent = '+ Aggiungi al centro mappa';
        addBtn.title = 'Centra prima la mappa sul portone (clic su un civico vicino e poi trascina), scrivi il numero e premi: la riga nasce l\u00ec, gi\u00e0 spuntata';
        addBox.appendChild(addIn); addBox.appendChild(addBtn);
        const doAdd = () => {
            const v = normHn(addIn.value);
            if (!v) { toast('Numero non valido: Waze accetta un numero seguito da al massimo 2 lettere (18, 18b, 7ab).'); addIn.focus(); return; }
            const c = mapCenter();
            if (!c) { toast('Non riesco a leggere il centro mappa in questa versione del WME.'); return; }
            const d = nearestCapturedDist(c[0], c[1]);
            if (d > HN_MAX_D) { toast(`Il centro mappa \u00e8 a ~${Math.round(d)} m dai segmenti in lista: oltre ${HN_MAX_D} m Waze lo rifiuterebbe. Avvicinati alla strada e riprova.`, 9000); return; }
            const row = ctx.addRow({ lon: c[0], lat: c[1], label: v, d, manual: true });
            ctx.listDiv.prepend(row);
            addIn.value = '';
            ctx.updateGo();
        };
        addBtn.addEventListener('click', doAdd);
        addIn.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); doAdd(); } });
        return addBox;
    }

    // Raccoglie i civici spuntati, segnalando numeri non validi e numeri ripetuti
    function collectHnSelection(ctx) {
        const sel = [];
        let bad = false;
        for (const x of ctx.rows) {
            if (!x.cb.checked) continue;
            const v = normHn(x.inp.value);
            if (!v) { x.inp.classList.add('wfit-bad-in'); bad = true; continue; }
            sel.push({ lon: x.p.lon, lat: x.p.lat, d: x.p.d, label: v, far: x.p.wazeFar || 0, ovl: x.p.ovl || 0,
                segId: x.p.segId != null ? x.p.segId : null, altro: x.p.altro || null, rpp: !!x.p.rpp });
        }
        // due o piu' civici dello stesso gruppo: nascono sovrapposti e andranno separati a mano
        const perGruppo = {};
        for (const x of sel) if (x.ovl) bump(perGruppo, x.ovl);
        for (const x of sel) x.stack = !!(x.ovl && perGruppo[x.ovl] > 1);
        if (bad) { toast('Controlla i numeri evidenziati in rosso: Waze accetta un numero seguito da al massimo 2 lettere (18, 18b, 7ab).', 7000); return null; }
        if (!sel.length) return null;
        // regole della guida Numeri civici: indirizzo gia' fatto come RPP, o accesso su un'altra via
        const rpp = sel.filter(x => x.rpp);
        if (rpp.length && !confirm(
            `${rpp.length} ${pl(rpp.length, 'numero che hai spuntato esiste', 'numeri che hai spuntato esistono')} gi\u00e0 su questa via come luogo residenziale (RPP): `
            + `${rpp.slice(0, 6).map(x => x.label).join(', ')}${rpp.length > 6 ? '\u2026' : ''}.\n\n`
            + 'La guida Numeri civici chiede di NON inserire anche il civico normale per un indirizzo gi\u00e0 fatto come RPP.\n\n'
            + 'Vuoi inserirli lo stesso?'
        )) return null;
        if (!lastHNScan.ok) toast('Attenzione: non sono riuscito a leggere i civici gi\u00e0 su Waze, quindi il controllo dei doppioni non \u00e8 stato fatto. Controlla la mappa prima di salvare.', 12000);
        const altro = sel.filter(x => x.altro);
        if (altro.length && !confirm(
            `${altro.length} ${pl(altro.length, 'civico che hai spuntato ha', 'civici che hai spuntato hanno')} l'accesso pi\u00f9 vicino a un'altra via `
            + `(${altro.slice(0, 4).map(x => x.label + ' \u2192 ' + x.altro.nome).join(', ')}${altro.length > 4 ? '\u2026' : ''}).\n\n`
            + 'Se l\'ingresso \u00e8 davvero su quella via, la guida chiede un luogo residenziale (RPP), non un civico. '
            + 'Se invece hai verificato che l\'ingresso \u00e8 sulla sua strada, puoi procedere.\n\nVuoi inserirli come civici?'
        )) return null;
        // Numeri che su questa via esistono gia' (qui vicino o altrove): non si inseriscono,
        // punto. Si tolgono dalla selezione e si spiega il perche'.
        const gia = sel.filter(x => x.far || x.rpp);
        if (gia.length) {
            const restano = sel.filter(x => !x.far && !x.rpp);
            toast(`${gia.length} ${pl(gia.length, 'numero non verr\u00e0 inserito perch\u00e9 esiste', 'numeri non verranno inseriti perch\u00e9 esistono')} gi\u00e0 su questa via `
                + `(${gia.slice(0, 6).map(x => x.label).join(', ')}${gia.length > 6 ? '\u2026' : ''}): `
                + 'Waze accetta un solo punto per numero. Se quello sulla mappa \u00e8 messo male, TRASCINALO sul punto giusto.', 12000);
            sel.length = 0;
            for (const x of restano) sel.push(x);
            if (!sel.length) return null;
        }
        // Waze tiene un solo punto per numero sulla stessa via: se ne hai spuntati due uguali
        // te lo diciamo, ma la scelta resta tua (il secondo verra' rifiutato al salvataggio)
        const cnt = {};
        for (const x of sel) bump(cnt, x.label);
        const rip = Object.entries(cnt).filter(([, n]) => n > 1).map(([v]) => v);
        if (rip.length) {
            toast(`Hai selezionato lo stesso numero in piu' punti (${rip.slice(0, 6).join(', ')}${rip.length > 6 ? '\u2026' : ''}): Waze ne accetta uno solo per via, gli altri verranno rifiutati al salvataggio. Se sai qual e' quello giusto, togli la spunta agli altri.`, 11000);
        }
        return sel;
    }

    // Bottoni "Inserisci" / "Annulla" e i collegamenti "tutti" / "nessuno"
    function buildHnFooter(ctx, r) {
        const foot = document.createElement('div');
        foot.className = 'wfit-actions';
        ctx.bGo.className = 'wfit-btn wfit-primary';
        const bNo = document.createElement('button');
        bNo.className = 'wfit-btn'; bNo.textContent = 'Annulla';
        foot.appendChild(ctx.bGo); foot.appendChild(bNo);
        bNo.addEventListener('click', () => { ctx.box.remove(); syncDotTracking(); });
        ctx.bGo.addEventListener('click', () => {
            const sel = collectHnSelection(ctx);
            if (!sel) return;
            ctx.box.remove();
            syncDotTracking();
            runHnInsert(r, sel);
        });
        ctx.head.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
            const v = a.dataset.a === 'all';
            // "tutti" non tira dentro i numeri che Waze non accetta, ne' gli indirizzi da fare come RPP
            let skipped = 0, kept = 0, over = 0;
            ctx.rows.forEach(x => {
                if (v && x.p.susp) { skipped++; return; }
                if (v && (x.p.rpp || x.p.altro || x.p.seq)) { kept++; return; }
                // nemmeno i numeri gia' presenti sulla via ma messi male: quelli si spostano a mano
                if (v && x.p.wazeFar) { kept++; return; }
                // nemmeno i civici sovrapposti: li' dentro la scelta e' una sola e la fai tu
                if (v && x.p.ovl) { over++; return; }
                x.cb.checked = v;
            });
            if (skipped) toast(`${skipped} ${pl(skipped, 'numero \u00e8', 'numeri sono')} in un formato che Waze non accetta: ${pl(skipped, 'resta', 'restano')} senza spunta (vanno ${pl(skipped, 'inserito', 'inseriti')} a mano).`, 8000);
            if (kept) toast(`${kept} ${pl(kept, 'numero esiste', 'numeri esistono')} gi\u00e0 su questa strada in un altro punto: ${pl(kept, 'va spostato', 'vanno spostati')} a mano, quindi ${pl(kept, 'resta', 'restano')} senza spunta.`, 9000);
            if (over) toast(`${over} ${pl(over, 'civico sta', 'civici stanno')} sulla stessa coordinata di ${pl(over, 'un altro', 'altri')}: ${pl(over, 'va scelto', 'vanno scelti')} a mano, uno per uno, quindi ${pl(over, 'resta', 'restano')} senza spunta.`, 9000);
            ctx.updateGo();
        }));
        return foot;
    }

    // Numeri in un formato che Waze non accetta (20/1, 12/BIS): si possono mostrare o nascondere
    // tutti insieme. Inserirli no: Waze accetta solo numero + al massimo 2 lettere minuscole.
    const SUSP_MODES = [
        ['nonins', 'mostra', 'Predefinito: restano visibili in lista, senza spunta. Se il numero giusto \u00e8 un altro, correggilo nella casella e spuntalo.'],
        ['escludi', 'nascondi', 'Li toglie dalla lista.']
    ];

    function buildHnSuspBar(shown, ctx) {
        const nSusp = shown.filter(p => isSusp(p.label)).length;
        if (!nSusp) return;
        const bar = document.createElement('div');
        bar.className = 'wfit-muted wfit-hnsuspbar';
        const label = document.createElement('span');
        label.innerHTML = `<b>${nSusp}</b> in un formato che Waze non accetta (20/1, 12/BIS):`;
        bar.appendChild(label);

        const applySuspMode = () => {
            const m = settings.suspMode;
            for (const x of ctx.rows) {
                if (!x.p.susp) continue;
                x.row.style.display = (m === 'escludi') ? 'none' : '';
                x.cb.checked = false;
                x.setNote(...suspNote());
            }
            ctx.updateGo();
        };
        const btns = [];
        for (const [mode, txt, tip] of SUSP_MODES) {
            const a = document.createElement('a');
            a.href = 'javascript:void(0)'; a.textContent = txt; a.title = tip;
            a.className = 'wfit-suspmode';
            a.addEventListener('click', () => {
                settings.suspMode = mode; saveSettings();
                btns.forEach(b => b.el.classList.toggle('wfit-on', b.mode === mode));
                applySuspMode();
            });
            btns.push({ el: a, mode });
            bar.appendChild(a);
        }
        btns.forEach(b => b.el.classList.toggle('wfit-on', b.mode === settings.suspMode));
        ctx.legend.parentNode.insertBefore(bar, ctx.legend.nextSibling);
        ctx.addLegend('<span class="wfit-swatch wfit-sw-susp"></span> formato non accettato da Waze');
    }

    const zoomOra = () => { try { return sdk.Map.getZoomLevel(); } catch { return null; } };

    // Annota i civici gia' presenti su Waze e toglie loro la spunta
    function annotateExistingHNs(ctx) {
        return loadExistingHNs().then(ex => {
            try { annotateAccessStreet(ctx, hnSegmentContext(ctx.rName ? toWazeCase(ctx.rName) : '')); } catch (e) { log('controllo accessi KO', e); }
            const rppKeys = new Set(ex.filter(h => h.rpp).map(h => hnKey(h.num)));
            // si dice sempre su cosa e' stato fatto il confronto: se la via e' lunga e ne hai
            // caricato solo un pezzo, un doppione fuori vista lo script non puo' vederlo
            if (ctx.scan) {
                const rppTxt = lastHNScan.rpp ? `${lastHNScan.rpp} ${pl(lastHNScan.rpp, 'luogo residenziale', 'luoghi residenziali')} (RPP) sulla via \u00b7 ` : '';
                const segTxt = `${lastHNScan.segs} ${pl(lastHNScan.segs, 'segmento', 'segmenti')} di questa via caricati nell'editor`
                    + (lastHNScan.scaricati ? ` (${lastHNScan.scaricati} in lista ma non pi\u00f9 ${pl(lastHNScan.scaricati, 'caricato', 'caricati')})` : '');
                ctx.scan.classList.toggle('wfit-scanbad', !lastHNScan.ok);
                ctx.scan.textContent = !lastHNScan.ok
                    ? '\u26a0\ufe0f Su questa via ci sono gi\u00e0 dei civici, ma il tuo editor non me li fa leggere: non posso dirti quali numeri esistono di gi\u00e0. '
                        + (zoomOra() != null && zoomOra() < 18
                            ? `Sei allo zoom ${zoomOra()}: avvicinati sul tratto che stai lavorando (l'editor carica i civici di solito dal 16-18 in su) e riapri l'elenco. `
                            : 'Prova a ricaricare l\'editor e a riaprire l\'elenco. ')
                        + 'Se vai avanti cos\u00ec, guarda tu sulla mappa quali civici ci sono gi\u00e0: i doppioni verrebbero rifiutati al salvataggio.'
                    : rppTxt + (lastHNScan.hn
                        ? `Confrontati con ${lastHNScan.hn} ${pl(lastHNScan.hn, 'civico gi\u00e0 su Waze', 'civici gi\u00e0 su Waze')} su ${segTxt}.`
                        : `Nessun civico gi\u00e0 su Waze sui ${segTxt}.`);
                ctx.scan.title = (lastHNScan.ok ? '' : 'Il WME carica i numeri civici solo dallo zoom 18 in su e solo per la zona a schermo: '
                        + 'piu' + '\u00f9 lontano lo script non pu\u00f2 sapere quali esistono gi\u00e0.\n\n')
                    + 'Il controllo dei doppioni guarda TUTTI i segmenti della stessa via caricati nell\'editor, non solo quelli che hai in lista: '
                    + 'cosi\' trova il civico anche se sta cento metri piu\' avanti. Quello che l\'editor non ha ancora caricato per\u00f2 non si vede: '
                    + 'se la via \u00e8 lunga, prima di aprire l\'elenco allarga la vista sulla strada intera.';
                ctx.scan.style.display = '';
            }
            if (!ex.length) {
                try { annotateNumbering(ctx); } catch (e) { log('controllo lato/sequenza KO', e); }
                ctx.updateGo();
                return;
            }
            let marked = 0, moved = 0, rpp = 0;
            for (const x of ctx.rows) {
                if (x.p.manual) continue;
                const label = normHn(x.inp.value) || x.p.label;
                if (rppKeys.has(hnKey(label))) {
                    x.cb.checked = false;
                    x.p.rpp = true;
                    x.row.classList.add('wfit-hnwaze');
                    x.setNote('waze', 'gi\u00e0 su Waze come luogo residenziale (RPP): non va aggiunto anche come civico');

                    x.row.title = 'Su questa via esiste gi\u00e0 un luogo residenziale (RPP) con questo numero. Per la guida Numeri civici '
                        + 'un indirizzo fatto come RPP non va inserito anche come civico normale.';
                    rpp++;
                    continue;
                }
                const near = findExistingHN(ex, label, x.p.lon, x.p.lat);
                if (near) {
                    x.cb.checked = false;
                    x.p.wazeFar = null;
                    x.row.classList.add('wfit-hnwaze');
                    x.setNote('waze', 'gi\u00e0 su Waze, niente da fare');
                    x.row.title = `Questo civico esiste gi\u00e0 sulla mappa a ${Math.round(haversine(near.c[0], near.c[1], x.p.lon, x.p.lat))} m da qui: `
                        + 'per questo arriva senza spunta. Se lo reinserisci, Waze lo rifiuta come duplicato. '
                        + 'Spuntalo solo se sei sicuro che quello esistente sia messo male e vuoi provare a correggerlo.'
                        + `\nCoordinate ANNCSU: ${x.p.lat.toFixed(6)}, ${x.p.lon.toFixed(6)}`;
                    marked++;
                    continue;
                }
                // stesso numero gia' sulla via, ma piazzato altrove: NON e' un civico da aggiungere
                const far = findMisplacedHN(ex, label, x.p.lon, x.p.lat);
                if (!far) continue;
                x.cb.checked = false;
                x.p.wazeFar = Math.round(far.d);
                x.row.classList.add('wfit-hnmoved');
                x.setNote('moved', `gi\u00e0 su Waze ma a ~${Math.round(far.d)} m: da spostare, non da aggiungere`);
                x.row.title = `Il civico ${label} esiste gi\u00e0 su questa strada, ma si trova a ~${Math.round(far.d)} m dal punto ANNCSU: `
                    + 'quasi sempre vuol dire che quello sulla mappa \u00e8 posizionato male. La cosa giusta \u00e8 '
                    + 'TRASCINARE il civico esistente sul punto corretto, non aggiungerne un secondo: Waze '
                    + 'accetta un solo punto per numero e il doppione viene rifiutato al salvataggio. '
                    + 'Per questo la riga arriva senza spunta e, se la spunti, lo script ti chiede conferma.'
                    + `\nCoordinate ANNCSU: ${x.p.lat.toFixed(6)}, ${x.p.lon.toFixed(6)}`
                    + `\nCoordinate del civico su Waze: ${far.hn.c[1].toFixed(6)}, ${far.hn.c[0].toFixed(6)}`;
                moved++;
            }
            if (marked || rpp) ctx.addLegend('<span class="wfit-swatch wfit-sw-waze"></span> gi\u00e0 su Waze');
            if (moved) {
                ctx.addLegend('<span class="wfit-swatch wfit-sw-moved"></span> gi\u00e0 su Waze, posizionato male');
                log(`civici gia' presenti sulla via ma lontani dal punto ANNCSU: ${moved} (non inseriti)`);
            }
            try { annotateNumbering(ctx); } catch (e) { log('controllo lato/sequenza KO', e); }
            ctx.updateGo();
        }).catch(() => { /* niente annotazioni */ });
    }

    // Passo di controllo: l'utente vede, verifica e SCEGLIE i civici prima dell'inserimento
    function toggleHnReview(card, r) {
        const oldBox = card.querySelector('.wfit-hnrev');
        if (oldBox) { oldBox.remove(); syncDotTracking(); return; }
        const HN = sdk.DataModel && sdk.DataModel.HouseNumbers;
        if (!HN || typeof HN.addHouseNumber !== 'function') {
            toast('Questa versione del WME non espone ancora addHouseNumber nell\'SDK: aggiorna l\'editor e riprova.', 8000);
            return;
        }
        if (capturedHaveNamedStreet() === false) {
            toast('Questi segmenti sono "Senza strada": i numeri civici si possono inserire SOLO su strade con il nome della via. Prima premi "Applica ai segmenti" e salva, poi riapri l\'elenco dei civici.', 11000);
            return;
        }
        const cand = hnCandidates(r);
        const stop = hnReviewBlocker(cand);
        if (stop) { toast(stop.msg, stop.ms); return; }

        // ordine per numero civico (poi per esponente): il giro di verifica segue la strada,
        // non la distanza dal segmento. Nessun tetto: si mostrano TUTTI i civici validi.
        cand.list.sort((a, b) => {
            const ka = splitHn(a.label), kb = splitHn(b.label);
            return (ka[0] - kb[0]) || ka[1].localeCompare(kb[1]);
        });
        const shown = cand.list;
        // civici praticamente nello stesso punto: si marcano prima di costruire le righe,
        // cosi' arrivano gia' senza spunta e con la nota che spiega il perche'
        const nOverlap = markOverlaps(shown);

        const ctx = createHnReviewBox(shown, cand);
        ctx.rName = r.name;
        ctx.r = r;
        if (!rppSupportato()) ctx.box.classList.add('wfit-norpp');
        for (const p of shown) ctx.addRow(p);
        ctx.box.appendChild(buildHnAddBox(ctx));
        ctx.box.appendChild(buildHnFooter(ctx, r));
        ctx.updateGo();
        buildHnSuspBar(shown, ctx);
        if (nOverlap) {
            ctx.addLegend('<span class="wfit-swatch wfit-sw-ovl"></span> stessa coordinata, da spostare dopo');
            const nPunti = shown.filter(p => p.ovl).length;
            toast(`${nPunti} civici stanno sulla stessa coordinata di ${pl(nOverlap, 'un altro', 'altri')} (${nOverlap} ${pl(nOverlap, 'gruppo', 'gruppi')}, meno di ${HN_OVERLAP_TXT} m): `
                + 'sulla mappa i numeri si stampano uno sopra l\'altro e non si leggono, quindi li ho lasciati tutti senza spunta. '
                + 'Controlla su Street View e spunta quelli che esistono davvero, anche piu\' di uno: '
                + 'nascono in questo punto e poi li trascini sugli ingressi giusti prima di salvare. '
                + 'I civici semplicemente vicini fra loro non sono toccati.', 14000);
        }
        if (shown.some(p => p.dup)) ctx.addLegend('<span class="wfit-swatch wfit-sw-dup"></span> stesso numero, pi\u00f9 punti');
        card.appendChild(ctx.box);
        syncDotTracking();
        annotateExistingHNs(ctx);
    }

    // Il WME rifiuta i civici su segmenti "proiettati", cioe' in stato transitorio
    const isProjectedError = m => /projected|not allowed to add a house number/i.test(m);
    const errText = e => String((e && e.message) || 'errore');

    // addHouseNumber({ number, point, segmentId }): con segmentId il civico si aggancia al
    // segmento della sua via; senza, l'SDK userebbe il segmento piu' vicino, che su un
    // civico d'angolo puo' essere la traversa.
    function makeHouseNumberAdder(HN) {
        return (num, pt, segId) => {
            const args = { number: num, point: { type: 'Point', coordinates: pt } };
            // segmentId solo se quel segmento e' davvero nel modello adesso
            if (segId != null && segmentoCaricato(segId)) args.segmentId = Number(segId);
            try { HN.addHouseNumber(args); }
            catch (e) {
                // l'id era gia' sparito fra il controllo e la chiamata: si lascia scegliere
                // il segmento al WME, che prende il piu' vicino
                if (args.segmentId == null || !/not found in data model/i.test(errText(e))) throw e;
                log('civico', num, ': segmento', args.segmentId, 'non piu\' caricato, aggancio automatico');
                HN.addHouseNumber({ number: num, point: { type: 'Point', coordinates: pt } });
            }
        };
    }

    // Inserisce l'elenco confermato, tenendo da parte i rifiuti da "segmento proiettato"
    function ricordaInserito(p, streets) {
        civiciInseriti.push({ segId: p.segId != null ? p.segId : null, num: String(p.label), c: [p.lon, p.lat], streets: streets || null });
        if (civiciInseriti.length > 3000) civiciInseriti.splice(0, civiciInseriti.length - 3000);
    }

    async function insertHouseNumbers(list, addOne, existing, tally, rec) {
        // le vie dei segmenti in lista: servono a ricordare i civici inseriti anche quando
        // il segmento non e' piu' caricato
        const vieLista = viaStreetIds(sameStreetSegmentIds());
        // Ultimo filtro prima di scrivere sulla mappa: un numero che su questa via esiste gia'
        // NON viene inserito, in nessun caso. Waze accetta un solo punto per numero, e un
        // doppione verrebbe rifiutato al salvataggio o creerebbe confusione.
        const giaSullaVia = new Set(existing.filter(h => h.own).map(h => hnKey(h.num)));
        const one = p => {
            if (findExistingHN(existing, p.label, p.lon, p.lat)) { tally.dup++; rec(p, 'gia_presente', 'civico gia\' su Waze'); return; }
            const far = findMisplacedHN(existing, p.label, p.lon, p.lat);
            if (far) {
                tally.moved++;
                rec(p, 'non_inserito', `civico gia' su questa strada a ~${Math.round(far.d)} m: va spostato, non aggiunto`);
                return;
            }
            // stesso numero sulla via letto da una sorgente senza coordinate utili (o come RPP)
            if (giaSullaVia.has(hnKey(p.label))) {
                tally.dup++;
                rec(p, 'gia_presente', 'numero gi\u00e0 presente su questa via');
                return;
            }
            try {
                addOne(p.label, [p.lon, p.lat], p.segId);
                ricordaInserito(p, vieLista);
                tally.ok++;
                if (p.stack) tally.stacked++;
                rec(p, 'inserito', '');
            }
            catch (e) {
                const m = errText(e);
                if (isProjectedError(m)) { tally.projFails.push(p); return; }
                bump(tally.reasons, niceReason(m));
                rec(p, 'errore', niceReason(m));
            }
        };
        let k = 0;
        for (const p of list) {
            k++;
            if (k % 5 === 0) { status(`Inserisco civici: ${k}/${list.length}\u2026`); await tick(); }
            one(p);
        }
    }

    // "projected segment" SENZA modifiche pendenti = segmento in stato transitorio
    // (post-salvataggio o aggancio a segmento nuovo/senza nome): ricarica la zona e ritenta una volta
    async function retryProjectedFails(addOne, tally, rec) {
        const uns = unsavedCount();
        if (!((uns == null || uns === 0) && canPan())) return;
        status(`Il WME ha rifiutato ${tally.projFails.length} civici (segmento in transizione): ricarico la zona e ritento\u2026`);
        suppressUntil = Date.now() + 9000;
        const retry = tally.projFails.splice(0);
        const mid = [
            retry.reduce((s, p) => s + p.lon, 0) / retry.length,
            retry.reduce((s, p) => s + p.lat, 0) / retry.length
        ];
        await panTo(mid);
        for (const p of retry) {
            try { addOne(p.label, [p.lon, p.lat], p.segId); ricordaInserito(p, viaStreetIds(sameStreetSegmentIds())); tally.ok++; rec(p, 'inserito', 'riuscito al secondo tentativo'); }
            catch (e) {
                const m = errText(e);
                if (isProjectedError(m)) tally.projFails.push(p);
                else { bump(tally.reasons, niceReason(m)); rec(p, 'errore', niceReason(m)); }
            }
        }
    }

    // Segmenti caricati, ridotti a id + geometria: serve per capire a quale strada
    // apparteneva un civico rifiutato
    function loadedSegmentGeometries() {
        try {
            if (!sdk.DataModel.Segments || typeof sdk.DataModel.Segments.getAll !== 'function') return null;
            return (sdk.DataModel.Segments.getAll() || [])
                .map(s => (s && s.geometry && s.geometry.coordinates && s.geometry.coordinates.length > 1)
                    ? { id: s.id, c: s.geometry.coordinates } : null)
                .filter(Boolean);
        } catch { return null; }
    }

    // Segmento caricato piu' vicino a un punto (pre-filtro a riquadro, poi distanza vera)
    function nearestLoadedSegment(segs, lon, lat) {
        const b = nearestSeg(segs, lon, lat);
        return b ? b.id : null;
    }

    function segmentIsNamed(id) {
        try {
            const ad = sdk.DataModel.Segments.getAddress({ segmentId: id });
            return !!(ad && !ad.isEmpty && ad.street && ad.street.name);
        } catch { return true; /* nel dubbio non accusiamo la strada */ }
    }

    // Perche' quei civici sono stati rifiutati? lock troppo alto, strada senza nome, o altro
    function diagnoseProjectedFails(projFails, reasons) {
        const uns = unsavedCount();
        if (uns != null && uns > 0) {
            bump(reasons, 'segmento con modifiche non salvate: salva (Ctrl+S) e riconferma', projFails.length);
            return;
        }
        const segs = loadedSegmentGeometries();
        const ur = userRank();
        const cnt = { lock: 0, unnamed: 0, other: 0 };
        for (const p of projFails) {
            const id = nearestLoadedSegment(segs, p.lon, p.lat);
            if (id != null) {
                const lk = segEffLock(id);
                if (ur != null && lk != null && lk > ur) { cnt.lock++; continue; }
                if (!segmentIsNamed(id)) { cnt.unnamed++; continue; }
            }
            cnt.other++;
        }
        if (cnt.lock) bump(reasons, 'non hai i permessi su questa strada (bloccata sopra il tuo livello): chiedi lo sblocco alla community', cnt.lock);
        if (cnt.unnamed) bump(reasons, 'la strada pi\u00f9 vicina al punto \u00e8 senza nome: dalle prima un nome (catturala con lo script), poi riprova', cnt.unnamed);
        if (cnt.other) bump(reasons, 'rifiutato dal WME: zooma di pi\u00f9 sulla zona o ricarica la pagina e riprova (oppure inseriscilo a mano)', cnt.other);
    }

    function hnInsertSummary(tally, nome) {
        let msg = `${tally.ok} ${pl(tally.ok, 'civico confermato e inserito', 'civici confermati e inseriti')} per "${nome}"`;
        if (tally.dup) msg += ` \u00b7 ${tally.dup} gi\u00e0 su Waze: ${pl(tally.dup, 'non reinserito', 'non reinseriti')}`;
        if (tally.moved) msg += ` \u00b7 ${tally.moved} gi\u00e0 su Waze ma ${pl(tally.moved, 'posizionato', 'posizionati')} male: `
            + `${pl(tally.moved, 'va spostato', 'vanno spostati')} a mano, non ${pl(tally.moved, 'aggiunto', 'aggiunti')}`;
        const rk = Object.entries(tally.reasons);
        if (rk.length) msg += ' \u00b7 falliti: ' + rk.map(([m, c]) => `${c}\u00d7 ${m}`).join('; ');
        msg += tally.ok ? '. Controlla i civici sulla mappa e salva.' : '.';
        // promemoria: quelli inseriti sulla stessa coordinata stanno uno sopra l'altro
        if (tally.stacked > 1) msg += ` ATTENZIONE: ${tally.stacked} civici sono nati sulla stessa coordinata, `
            + 'uno sopra l\'altro: trascinali sui rispettivi ingressi PRIMA di salvare, altrimenti sulla mappa resta un mucchietto illeggibile.';
        return { msg, failed: rk.length || tally.stacked > 1 };
    }

    // Inserisce SOLO i civici confermati dall'utente
    async function runHnInsert(r, list) {
        const HN = sdk.DataModel && sdk.DataModel.HouseNumbers;
        if (!HN || typeof HN.addHouseNumber !== 'function') return;
        if (!list || !list.length) return;
        const blocco = editingBlock();
        if (blocco) { toast(`Niente inserimento: ${blocco}.`, 9000); return; }
        const uns = unsavedCount();
        if (uns != null && uns > 0) {
            toast(`Hai ${uns} ${pl(uns, 'modifica non salvata', 'modifiche non salvate')}: il WME non permette di aggiungere civici su segmenti modificati. Salva (Ctrl+S), poi riapri l'elenco e riconferma.`, 10000);
            return;
        }
        if (busy) { toast('Attendi la fine dell\'operazione in corso.'); return; }
        beginBusy();
        suppressUntil = Date.now() + 4000;
        try {
            // civici gia' presenti su Waze (caricati per davvero, quando possibile)
            const existing = await loadExistingHNs();
            const addOne = makeHouseNumberAdder(HN);
            // civici senza segmento assegnato (righe aggiunte a mano, elenco non ancora annotato)
            const segCtx = hnSegmentContext(r && r.name ? toWazeCase(r.name) : '');
            for (const p of list) {
                if (p.segId == null) { const o = nearestSeg(segCtx.own, p.lon, p.lat); p.segId = o ? o.id : null; }
            }
            const tally = { ok: 0, dup: 0, moved: 0, stacked: 0, reasons: {}, projFails: [] };
            resetSegsPerLog();
            const rec = (p, esito, motivo) => {
                const segId = segmentoDelPunto(p.lon, p.lat);
                logEvent('civico', {
                    esito,
                    motivo: motivo || '',
                    comune: r.comune || '',
                    localita: r.locality || '',
                    odonimo: toWazeCase(r.name),
                    civico: p.label,
                    segmento: segId != null ? String(segId) : '',
                    permalink: permalink(p.lon, p.lat, segId),
                    lat: p.lat != null ? Number(p.lat.toFixed(7)) : '',
                    lon: p.lon != null ? Number(p.lon.toFixed(7)) : '',
                    distanza_m: p.d != null ? Math.round(p.d) : '',
                    dataset: r.fileDate || ''
                });
            };

            await insertHouseNumbers(list, addOne, existing, tally, rec);
            if (tally.projFails.length) await retryProjectedFails(addOne, tally, rec);
            if (tally.projFails.length) {
                diagnoseProjectedFails(tally.projFails, tally.reasons);
                for (const p of tally.projFails) rec(p, 'errore', 'rifiutato dal WME (segmento proiettato)');
            }

            status('');
            const { msg, failed } = hnInsertSummary(tally, toWazeCase(r.name));
            toast(msg, failed ? 15000 : 8000);
            aggiornaPendingUI();
            flushLogs();
        } finally {
            endBusy();
        }
    }

    // Stato attuale dell'indirizzo di un segmento (per evitare modifiche a vuoto)
    function segAddressState(id) {
        let pn = null, alts = null;
        try {
            const seg = sdk.DataModel.Segments.getById({ segmentId: id });
            if (seg) {
                if (seg.primaryStreetId != null) pn = seg.primaryStreetId;
                if (Array.isArray(seg.alternateStreetIds)) alts = seg.alternateStreetIds.slice();
            }
        } catch { /* sotto */ }
        try {
            if (pn == null || alts == null) {
                const ad = sdk.DataModel.Segments.getAddress({ segmentId: id });
                if (ad) {
                    if (pn == null && ad.street && ad.street.id != null) pn = ad.street.id;
                    if (alts == null && Array.isArray(ad.altStreets)) alts = ad.altStreets.map(s => s && s.id).filter(x => x != null);
                }
            }
        } catch { /* ignoto */ }
        return { pn, alts };
    }

    // Etichetta leggibile "Nome, Comune" di una via (per il dialogo di conferma)
    function cityNameById(cid) {
        try { const c = sdk.DataModel.Cities.getById({ cityId: cid }); return (c && c.name) || ''; }
        catch { return ''; }
    }
    // Solo il nome della via (senza citta'): serve a riconoscere le sigle negli alternativi
    function streetNameById(id) {
        try { const s = sdk.DataModel.Streets.getById({ streetId: id }); return (s && s.name) || ''; }
        catch { return ''; }
    }
    function streetLabel(id) {
        try {
            const s = sdk.DataModel.Streets.getById({ streetId: id });
            if (s) { const c = cityNameById(s.cityId); return (s.name || '(senza nome)') + (c ? ', ' + c : ''); }
        } catch { /* sotto */ }
        return '#' + id;
    }

    // Gli ID delle vie possono arrivare come numero o come testo: confronto tollerante
    const sameId = (a, b) => a != null && b != null && String(a) === String(b);

    // Prima proprieta' non nulla fra quelle indicate (0 e' un valore valido: solo null/undefined saltano)
    const pick = (o, ...keys) => {
        if (!o) return null;
        for (const k of keys) if (o[k] != null) return o[k];
        return null;
    };

    // Livello dell'utente (0-based: L1 = 0)
    function userRank() {
        try { return pick(sdk.State.getUserInfo(), 'rank'); } catch { return null; }
    }

    // Lock effettivo del segmento (manuale se presente, altrimenti automatico)
    function segEffLock(id) {
        try { return pick(sdk.DataModel.Segments.getById({ segmentId: id }), 'lockRank', 'rank'); }
        catch { return null; }
    }

    // Strade con sigla (Wazeopedia Italia, "Denominazione delle strade"): A1, SS12, SR31,
    // SP20bis, SS591var, SS20dir, NSA122. Il PN porta SOLO la sigla; il nome esteso
    // ("SP231 Andria-Canosa") va nell'AN, con la citta'.
    const SIGLA_RE = /^((?:A|SS|SR|SP|NSA)\d+(?:bis|ter|quater|dir|var|racc|radd)*)(?:\s+(.+))?$/;
    // negli alternativi si proteggono anche le sigle che il TTS sa leggere (SC, SGC)
    const isSiglaName = n => SIGLA_RE.test(String(n || '')) || /^(?:SC\d+|SGC\b)/.test(String(n || ''));
    function applyNames(streetName) {
        const m = SIGLA_RE.exec(streetName);
        if (!m) return { pn: streetName, an: streetName, sigla: false, full: false };
        return { pn: m[1], an: streetName, sigla: true, full: !!m[2] };
    }

    // Le vie da usare secondo la modalita' scelta:
    // - dentro il centro abitato: PN = via + citta' (per le sigle con nome esteso, AN = nome esteso + citta');
    // - fuori dal centro abitato: PN = via senza citta' ("Nessuno"), AN = via + citta'.
    function resolveApplyStreets(streetName, cityName, extra) {
        const city = resolveCity(cityName);
        if (!city) throw new Error(`citt\u00e0 "${cityName}" non risolvibile via SDK (impostala una volta a mano su un segmento vicino)`);
        const nm = applyNames(streetName);
        if (!extra) {
            return {
                pnStreet: getOrAddStreet(nm.pn, city.id),
                anStreet: nm.sigla && nm.full ? getOrAddStreet(nm.an, city.id) : null,
                nm
            };
        }
        const emptyCity = resolveEmptyCity(city);
        if (!emptyCity) throw new Error('citt\u00e0 vuota ("Nessuno") della regione giusta non trovata nel modello: apri o aggiungi in zona un segmento senza citt\u00e0 e riprova');
        return {
            pnStreet: getOrAddStreet(nm.pn, emptyCity.id),
            anStreet: getOrAddStreet(nm.an, city.id),
            nm
        };
    }

    // Pre-scansione: c'e' qualcosa di non allineato (vecchi alternativi, doppioni)?
    // Se si', si chiede conferma UNA volta e poi si riallinea tutto il lotto.
    function askStaleCleanup(ids, staleOf) {
        const staleLabels = new Set();
        let staleSegs = 0, staleTot = 0;
        for (const id of ids) {
            let st = null;
            try { st = segAddressState(id); } catch { continue; }
            const stale = staleOf(st);
            if (!stale.length) continue;
            staleSegs++; staleTot += stale.length;
            for (const a of stale) { if (staleLabels.size < 8) staleLabels.add(streetLabel(a)); }
        }
        if (!staleTot) return false;
        const esempi = [...staleLabels].slice(0, 6).join('; ');
        return window.confirm(
            `${SCRIPT_NAME}: su ${staleSegs} ${pl(staleSegs, 'segmento', 'segmenti')} ci sono ${staleTot} ${pl(staleTot, 'nome alternativo', 'nomi alternativi')} ${pl(staleTot, 'NON previsto', 'NON previsti')} dalle scelte dello script:\n` +
            `\u2022 ${esempi}${staleLabels.size > 6 ? '\u2026' : ''}\n\n` +
            `Attenzione: per la guida gli alternativi possono contenere anche nomi locali non ufficiali e, nelle regioni bilingui, ` +
            `il nome nella seconda lingua. Le sigle (SS, SP, SR...) non sono in questo elenco: restano sempre.\n\n` +
            `OK = rimuovili e riallinea tutto (PN/AN come impostato)\n` +
            `Annulla = mantienili (lo script aggiunge senza togliere)`);
    }

    const applyFailReason = m => /lock|rank|permission|not allowed|consentit/i.test(m)
        ? 'segmento bloccato o permessi insufficienti (serve un unlock)' : m;

    // Applica SOLO cio' che manca a un segmento, poi VERIFICA che il WME abbia registrato davvero:
    // se la prima strategia non lascia il segmento come voluto si prova l'altra; se anche quella
    // fallisce il segmento finisce fra i falliti (niente successi fantasma).
    // Restituisce 'ok', 'notloaded', oppure il motivo del fallimento.
    // Fuori dal centro abitato la guida vuole su tutte le strade l'attributo "obbligo
    // accensione dei fari". Si imposta e si verifica; se non riesce il segmento non fallisce,
    // lo si conta a parte nel riepilogo.
    function setHeadlights(id) {
        try {
            sdk.DataModel.Segments.updateSegment({ segmentId: id, flagAttributes: { headlights: true } });
            const s = sdk.DataModel.Segments.getById({ segmentId: id });
            return !!(s && s.flagAttributes && s.flagAttributes.headlights);
        } catch { return false; }
    }

    function makeSegmentApplier(plan) {
        const { pnStreet, anStreet, targetAlts, staleOf, cleanMode, fari, tally } = plan;
        return async id => {
            let seg = null;
            try { seg = sdk.DataModel.Segments.getById({ segmentId: id }); } catch { /* sotto */ }
            if (!seg) return 'notloaded';
            // regole della guida: le rampe restano senza citta' con i nomi di direzione, e i
            // segmenti non carrabili (sentieri, ferrovie...) non si editano
            if (seg.roadType === RT_RAMP) return 'rampa: per la guida resta senza citt\u00e0 e con i nomi di direzione, non si nomina con ANNCSU';
            if (seg.isDrivable === false) return 'segmento non carrabile (sentiero, ferrovia...): per la guida non va editato';

            const st = segAddressState(id);
            const known = Array.isArray(st.alts);
            const stale = staleOf(st);
            const needPn = !sameId(st.pn, pnStreet.id);
            const anPresent = anStreet && known && st.alts.some(a => sameId(a, anStreet.id));
            const needAn = !!anStreet && !anPresent;
            const needClean = cleanMode && stale.length > 0;
            const needFari = !!fari && !!seg.flagAttributes && seg.flagAttributes.headlights !== true;
            if (!needPn && !needAn && !needClean) {
                if (needFari) {
                    if (setHeadlights(id)) { tally.applied++; tally.fari++; } else { tally.skipped++; tally.fariKo++; }
                    return 'ok';
                }
                tally.skipped++;
                return 'ok';
            }

            const wantAlts = known
                ? (needClean ? [...new Set(targetAlts)] : [...new Set([...st.alts, ...targetAlts])])
                : null;

            const upd = addressData => sdk.DataModel.Segments.updateAddress({ segmentId: id, addressData });
            const strategies = [];
            if (wantAlts) {
                strategies.push(() => upd({ primaryStreetId: pnStreet.id, alternateStreetIds: wantAlts }));
                // firma delle versioni precedenti dell'SDK (campi al primo livello)
                strategies.push(() => sdk.DataModel.Segments.updateAddress({ segmentId: id, primaryStreetId: pnStreet.id, alternateStreetIds: wantAlts }));
            } else {
                strategies.push(() => {
                    upd({ primaryStreetId: pnStreet.id });
                    if (needAn) sdk.DataModel.Segments.addAlternateStreet({ segmentIds: [id], streetId: anStreet.id });
                });
            }

            let lastErr = null, lastNow = null;
            for (const run of strategies) {
                try { run(); } catch (e) { lastErr = e; continue; }
                await tick(); // un respiro: il modello deve digerire la modifica prima della verifica
                // verifica: com'e' DAVVERO il segmento adesso? (confronto tollerante sugli ID)
                const now = segAddressState(id);
                lastNow = now;
                const pnOk = sameId(now.pn, pnStreet.id);
                const anNow = !anStreet ? true : (Array.isArray(now.alts) ? now.alts.some(a => sameId(a, anStreet.id)) : anPresent);
                // se non si doveva ripulire, gli alternativi che c'erano devono esserci ancora
                const keptOk = !known || needClean || !Array.isArray(now.alts) || st.alts.every(a => now.alts.some(b => sameId(a, b)));
                if (pnOk && (anNow || !needAn) && keptOk) {
                    tally.applied++;
                    if (needAn) { if (anNow) tally.anOk++; else tally.anManual++; }
                    if (needClean) {
                        const still = staleOf(now);
                        if (!still.length) tally.cleaned += stale.length;
                        else tally.cleanFailed += still.length;
                    }
                    if (needFari) { if (setHeadlights(id)) tally.fari++; else tally.fariKo++; }
                    return 'ok';
                }
                lastErr = new Error(keptOk ? 'il WME non ha registrato la modifica come richiesto' : 'il WME ha tolto degli alternativi che dovevano restare');
            }
            log('verifica fallita', id, '\u00b7 PN atteso', pnStreet.id, '\u00b7 letto', lastNow && lastNow.pn, '\u00b7 alternativi letti', lastNow && lastNow.alts);
            return applyFailReason(lastErr && lastErr.message ? String(lastErr.message) : 'modifica rifiutata dal WME');
        };
    }

    // Segmenti fuori dall'area caricata: ci si sposta sopra uno per uno e si riprova
    async function retryOffscreenSegments(notLoaded, tryApply, noteFail, recSeg, esitoDi, tally) {
        const fuoriArea = 'fuori dall\'area caricata: torna sulla zona e ripremi Applica';
        if (!canPan()) {
            for (const it of notLoaded) {
                noteFail(it.id, fuoriArea, false);
                recSeg(it.id, 'errore', fuoriArea, it.before);
            }
            return;
        }
        let j = 0;
        for (const it of notLoaded) {
            j++;
            status(`Recupero segmenti fuori vista: ${j}/${notLoaded.length}\u2026`);
            suppressUntil = Date.now() + 6000;
            const info = captured.get(it.id);
            const mid = info && info.coords ? lineMidpoint(info.coords) : null;
            if (!mid) {
                noteFail(it.id, 'geometria non memorizzata', false);
                recSeg(it.id, 'errore', 'geometria non memorizzata', it.before);
                continue;
            }
            await panTo(mid);
            const skippedBefore = tally.skipped;
            const r = await tryApply(it.id);
            if (r === 'notloaded') {
                const m = 'non caricato neppure dopo lo spostamento (se hai salvato di recente l\'id potrebbe essere cambiato: ricatturalo)';
                noteFail(it.id, m, false);
                recSeg(it.id, 'errore', m, it.before);
            } else {
                if (r !== 'ok') noteFail(it.id, r);
                recSeg(it.id, esitoDi(r, skippedBefore), r === 'ok' ? '' : r, it.before);
            }
        }
    }

    function applySummary(tally, failReasons, extra, nm, cityName, hasAn) {
        let msg = extra
            ? `PN "${nm.pn}" (citt\u00e0: Nessuno): ${tally.applied} ${pl(tally.applied, 'modificato', 'modificati')}`
            : `"${nm.pn}" (${cityName}): ${tally.applied} ${pl(tally.applied, 'modificato', 'modificati')}`;
        if (tally.skipped) msg += ` \u00b7 gi\u00e0 a posto (nessuna modifica): ${tally.skipped}`;
        if (tally.cleaned) msg += ` \u00b7 riallineati: ${tally.cleaned} ${pl(tally.cleaned, 'alternativo non conforme rimosso', 'alternativi non conformi rimossi')}`;
        if (tally.cleanFailed) msg += ` \u00b7 ${tally.cleanFailed} ${pl(tally.cleanFailed, 'alternativo non rimovibile', 'alternativi non rimovibili')} via SDK: toglili a mano`;
        if (hasAn && tally.anOk) msg += ` \u00b7 AN "${nm.an}, ${cityName}" ${pl(tally.anOk, 'aggiunto', 'aggiunti')}: ${tally.anOk}`;
        if (hasAn && tally.anManual) msg += ` \u00b7 AN da aggiungere a mano: ${tally.anManual}`;
        if (tally.fari) msg += ` \u00b7 obbligo fari accesi impostato: ${tally.fari}`;
        if (tally.fariKo) msg += ` \u00b7 obbligo fari da impostare a mano: ${tally.fariKo}`;
        if (failReasons.size) {
            const perMotivo = {};
            for (const m of failReasons.values()) bump(perMotivo, m);
            msg += ' \u00b7 falliti (in rosso in lista): ' +
                Object.entries(perMotivo).map(([m, c]) => `${c}\u00d7 ${m}`).join('; ');
        }
        return msg;
    }

    async function applyToSegments(streetName, cityName, suggestedName) {
        const ids = captured.size ? [...captured.keys()] : getSelectedSegmentIds();
        if (!ids.length) { toast('Nessun segmento in lista.'); return; }
        if (busy) { toast('Attendi la fine dell\'operazione in corso.'); return; }
        const blocco = editingBlock();
        if (blocco) { toast(`Niente modifiche: ${blocco}.`, 9000); return; }
        suppressUntil = Date.now() + 2500;
        const extra = settings.applyMode !== 'urb';
        beginBusy();
        try {
            const { pnStreet, anStreet, nm } = resolveApplyStreets(streetName, cityName, extra);
            const targetAlts = anStreet ? [anStreet.id] : [];
            // alternativi presenti che non rientrano nelle scelte dello script. Le sigle (SS11,
            // SP13...) non si toccano mai: la guida le vuole negli alternativi.
            const siglaCache = new Map();
            const isSiglaAlt = a => {
                const k = String(a);
                if (!siglaCache.has(k)) siglaCache.set(k, isSiglaName(streetNameById(a)));
                return siglaCache.get(k);
            };
            const staleOf = st => Array.isArray(st.alts)
                ? st.alts.filter(a => !sameId(a, pnStreet.id) && !targetAlts.some(t => sameId(t, a)) && !isSiglaAlt(a))
                : [];

            const tally = { applied: 0, skipped: 0, anOk: 0, anManual: 0, cleaned: 0, cleanFailed: 0, fari: 0, fariKo: 0 };
            const failReasons = new Map();
            const noteFail = (id, r, verbose = true) => {
                failReasons.set(id, r);
                if (verbose) log('Applica fallito', id, r);
            };
            const tryApply = makeSegmentApplier({
                pnStreet, anStreet, targetAlts, staleOf, fari: extra,
                cleanMode: askStaleCleanup(ids, staleOf), tally
            });

            // Registra l'esito di un segmento. Il segmento non ancora caricato non produce
            // nessuna riga: si aspetta il recupero, e nel registro finisce solo com'e' finita.
            const recSeg = (id, esito, motivo, before) => {
                if (esito === 'rimandato') return;
                const mid = (() => {
                    const c = (captured.get(id) && captured.get(id).coords) || segGeometry(id);
                    return c && c.length ? lineMidpoint(c) : null;
                })();
                logEvent('segmento', {
                    esito,
                    motivo: motivo || '',
                    comune: cityName || '',
                    odonimo: streetName,
                    segmento: String(id),
                    permalink: mid ? permalink(mid[0], mid[1], id, 17) : permalink(null, null, id),
                    lat: mid ? Number(mid[1].toFixed(7)) : '',
                    lon: mid ? Number(mid[0].toFixed(7)) : '',
                    prima: before || '',
                    dopo: (extra ? `${nm.pn} (PN citt\u00e0 Nessuno)` : `${nm.pn}, ${cityName}`) + (anStreet ? ` + AN ${nm.an}, ${cityName}` : '')
                });
            };
            const esitoDi = (r, skippedBefore) =>
                r === 'ok' ? (tally.skipped > skippedBefore ? 'gia_a_posto' : 'modificato')
                    : (r === 'notloaded' ? 'rimandato' : 'errore');
            const nomePrima = id => {
                try { const st = segAddressState(id); return st.pn != null ? streetLabel(st.pn) : '(senza strada)'; }
                catch { return ''; }
            };

            const notLoaded = [];
            let k = 0;
            for (const id of ids) {
                k++;
                if (ids.length > 3) status(`Applico: ${k}/${ids.length}\u2026`);
                if (k % 6 === 0) await tick();
                const before = nomePrima(id);
                const skippedBefore = tally.skipped;
                const r = await tryApply(id);
                if (r === 'notloaded') { notLoaded.push({ id, before }); continue; }
                if (r !== 'ok') noteFail(id, r);
                recSeg(id, esitoDi(r, skippedBefore), r === 'ok' ? '' : r, before);
            }
            if (notLoaded.length) await retryOffscreenSegments(notLoaded, tryApply, noteFail, recSeg, esitoDi, tally);
            status('');

            lastFailedIds = new Set(failReasons.keys());
            updateCapturedUI();

            let msg = applySummary(tally, failReasons, extra, nm, cityName, !!anStreet);
            if (tally.applied > 0 && suggestedName) {
                const rule = learnNameRule(suggestedName, streetName);
                if (rule) msg += ` \u00b7 regola memorizzata: "${rule.from.trim()}" \u2192 "${rule.to.trim()}" (le prossime caselle si precompilano cos\u00ec)`;
            }
            msg += tally.applied ? '. Rivedi le modifiche e salva.' : '.';
            toast(msg, failReasons.size ? 15000 : 8000);
            aggiornaPendingUI();
            flushLogs();
        } catch (e) {
            navigator.clipboard && navigator.clipboard.writeText(streetName);
            toast('Applicazione non riuscita (' + e.message + '). Nome copiato negli appunti.', 8000);
        } finally {
            endBusy();
        }
    }

    function canPan() { return sdk.Map && typeof sdk.Map.setMapCenter === 'function'; }

    // Centra la mappa su un punto e aspetta che il WME carichi i dati della zona
    async function panTo(mid) {
        if (!quickCenter(mid[0], mid[1])) return false;
        try {
            await Promise.race([sdk.Events.once({ eventName: 'wme-map-data-loaded' }), sleep(6000)]);
        } catch { await sleep(1500); }
        await sleep(350);
        return true;
    }

    function getOrAddStreet(streetName, cityId) {
        let street = null;
        try { street = sdk.DataModel.Streets.getStreet({ cityId, streetName }); } catch { /* non esiste ancora */ }
        if (!street) street = sdk.DataModel.Streets.addStreet({ cityId, streetName });
        if (!street || street.id == null) throw new Error('impossibile creare la via "' + streetName + '"');
        try {
            const S = sdk.DataModel.Streets;
            if (typeof S.getById === 'function') {
                const chk = S.getById({ streetId: street.id });
                if (chk && chk.name != null && String(chk.name).trim().toLowerCase() !== streetName.trim().toLowerCase()) {
                    throw new Error('la via ottenuta ("' + chk.name + '") non corrisponde a "' + streetName + '": riprova');
                }
            }
        } catch (e) {
            if (/non corrisponde/.test(String(e && e.message))) throw e;
        }
        return street;
    }

    // La citta' vuota ("Nessuno"): ce n'e' una per regione (stato), e vicino a un confine
    // regionale nel modello ne sono caricate piu' d'una. Si prende quella della regione della
    // citta' vera; se non si capisce quale sia, meglio fermarsi che scrivere quella sbagliata.
    function resolveEmptyCity(target) {
        let all = [];
        try { all = (sdk.DataModel.Cities.getAll() || []).filter(x => x && x.id != null && (x.isEmpty === true || !x.name)); }
        catch { return null; }
        if (!all.length) return null;
        const st = target && target.stateId;
        const same = st != null ? all.find(x => sameId(x.stateId, st)) : null;
        if (same) return same;
        return all.length === 1 ? all[0] : null;
    }

    // Solo la citta' richiesta: se non si trova (e non si puo' creare) ci si ferma. Mai una
    // citta' diversa da quella scelta.
    function resolveCity(cityName) {
        const C = sdk.DataModel.Cities;
        if (!C || !cityName) return null;
        const attempts = [];
        if (cityName) {
            attempts.push(() => (typeof C.getCity === 'function') ? C.getCity({ cityName }) : null);
            attempts.push(() => {
                if (typeof C.getAll === 'function') {
                    const all = C.getAll();
                    return all && all.find(c => c.name && c.name.toLowerCase() === cityName.toLowerCase());
                }
                return null;
            });
            attempts.push(() => (typeof C.addCity === 'function') ? C.addCity({ cityName }) : null);
        }
        for (const fn of attempts) {
            try { const r = fn(); if (r && r.id != null) return r; } catch { /* prossimo */ }
        }
        return null;
    }

    // Diagnostica richiamabile dalla console del WME: wfitDiag()
    try {
        const w = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
        w.wfitDiag = () => {
            const d = {
                versione: VERSION,
                utente: authInfo.user,
                autorizzato: authInfo.ok,
                urlConfigurato: gasConfigured(),
                tokenConfigurato: !!gasToken() && !/^INCOLLA/i.test(gasToken()),
                righeInAttesaDiSalvataggio: pendingLog.length,
                righeInCodaDiInvio: logQueue.length,
                modificheNonSalvate: unsavedCount(),
                salvataggiSeguiti: saveTracking,
                salvataggioRilevatoCon: saveWay || '(nessun salvataggio ancora visto)',
                deselezioneCon: clearWay || '(non ancora usata)',
                sdkMetodiMancanti: sdkMancanti.length ? sdkMancanti.map(m => m.metodo + (m.essenziale ? ' (essenziale)' : '')).join(', ') : 'nessuno',
                letturaCiviciEsistenti: lastHNScan.segs
                    ? `${lastHNScan.ok ? 'ok' : 'NON RIUSCITA'} \u00b7 ${lastHNScan.hn} civici + ${lastHNScan.rpp} RPP su ${lastHNScan.segs} segmenti caricati`
                        + `${lastHNScan.scaricati ? ' (+' + lastHNScan.scaricati + ' non caricati)' : ''}`
                        + `${lastHNScan.attesi ? ' \u00b7 segmenti con civici secondo il WME: ' + lastHNScan.attesi : ''}`
                        + `${lastHNScan.come ? ' \u00b7 sorgente: ' + lastHNScan.come : ''}`
                    : '(elenco civici non ancora aperto)',
                eventoSalvataggioVisto: saveEventSeen
            };
            console.table(d);
            return d;
        };
        // forza l'invio subito, utile per capire se il foglio risponde
        w.wfitInvia = () => { promuoviPending('invio forzato dall\'utente', 'comando wfitInvia()'); return flushLogs(); };
        // ricontrollo immediato di abilitazione e versione minima
        w.wfitControlla = () => { clearAuthCache(); return controllaAbilitazione(); };
    } catch { /* niente console */ }

})();