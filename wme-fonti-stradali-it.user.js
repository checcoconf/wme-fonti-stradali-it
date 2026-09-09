// ==UserScript==
// @name         WME Fonti Stradali IT
// @namespace    wme-fonti-it
// @version      0.2.0
// @description  Confronta i segmenti del WME con i civici ufficiali ANNCSU (Istat/Agenzia Entrate): evidenzia i segmenti in lista, mostra i civici sulla mappa e compila nome via/contrada, localita, comune e numeri civici. A cura di checcoconf.
// @author       checcoconf
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
// @license      MIT
// ==/UserScript==

/* global getWmeSdk, GM_xmlhttpRequest, GM_getResourceText, GM_info */

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

    const DOWNLOAD_URL = 'https://github.com/checcoconf/wme-fonti-stradali-it/releases/latest/download/wme-fonti-stradali-it.user.js';
    const AUTH_KEY = 'wmeFontiIT_auth_v1';
    const LOGQ_KEY = 'wmeFontiIT_logq_v1';
    const AUTH_TTL_H = 2;     // ogni quante ore si richiede di nuovo il permesso al foglio
    const AUTH_RECHECK_MIN = 30; // ricontrollo periodico mentre l'editor resta aperto
    const AUTH_GRACE_H = 72;  // se il foglio non risponde, per quante ore vale l'ultimo "autorizzato"
    const LOG_MAX_QUEUE = 2000;

    const REGIONI = [
        ['ABRU', 'Abruzzo'], ['BASI', 'Basilicata'], ['CALA', 'Calabria'], ['CAMP', 'Campania'],
        ['EMIL', 'Emilia-Romagna'], ['FRIU', 'Friuli-Venezia Giulia'], ['LAZI', 'Lazio'], ['LIGU', 'Liguria'],
        ['LOMB', 'Lombardia'], ['MARC', 'Marche'], ['MOLI', 'Molise'], ['PIEM', 'Piemonte'],
        ['PUGL', 'Puglia'], ['SARD', 'Sardegna'], ['SICI', 'Sicilia'], ['TOSC', 'Toscana'],
        ['TREN', 'Trentino-Alto Adige'], ['UMBR', 'Umbria'], ['VALL', "Valle d'Aosta"], ['VENE', 'Veneto']
    ];
    const regNome = code => (REGIONI.find(r => r[0] === code) || [code, code])[1];
    const LAYER = 'wfit-civici';
    const PALETTE = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#9a6324'];
    // Elenco comuni italiani (fonte ISTAT) incorporato: "BELFIORE Nome|BELFIORE Nome|..."
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
    let lastHNScan = { hn: 0, segs: 0 }; // esito dell'ultima lettura dei civici gia' su Waze
    let lastPtsByG = new Map();       // gid -> [{lon,lat,label,d}] civici agganciati (deduplicati)
    let lastDotFeatures = [];         // ultime feature disegnate (per riaccendere la spunta al volo)
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

    // Il WME legacy vive su window.W (unsafeWindow sotto Tampermonkey): si legge una volta sola.
    const WME = () => (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).W;
    const WREQ = () => {
        const w = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
        return typeof w.require === 'function' ? w.require : (typeof require === 'function' ? require : null);
    };

    // Prima funzione che restituisce qualcosa di utile, saltando quelle che esplodono.
    // E' il modo in cui lo script prova l'SDK e poi ripiega sul modello legacy del WME.
    function firstOk(...fns) {
        for (const fn of fns) {
            try { const r = fn(); if (r != null && r !== false) return r; } catch { /* prossima */ }
        }
        return null;
    }

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

    const DEFAULT_SETTINGS = {
        raggio: 10, titleCase: true, captureMode: 'alt', applyMode: 'extra',
        autoAnalyze: true, showDots: true, dotSize: 'normale', hlColor: '#00e5ff', captureKey: null
    };

    // Riporta al formato attuale le impostazioni salvate dalle versioni precedenti e
    // ripara i valori rovinati: qui dentro sta TUTTA la retrocompatibilita'.
    function migrateSettings(s) {
        if (!Array.isArray(s.nameRules)) s.nameRules = [];
        if (!/^#[0-9a-f]{6}$/i.test(s.hlColor || '')) s.hlColor = '#00e5ff';
        // MAIUSC e CTRL da soli erano scegliabili fino alla 0.0.5.b, poi sono stati tolti perche'
        // il WME li usa per la multi-selezione: chi li aveva salvati passa alla combinazione libera.
        if (s.captureMode === 'shift') s.captureMode = 'altshift';
        if (s.captureMode === 'ctrl') s.captureMode = 'ctrlalt';
        // Tasto personalizzato: se il salvataggio e' rovinato o mancante si torna ad ALT (default di sempre)
        if (s.captureKey && typeof s.captureKey !== 'object') s.captureKey = null;
        // porta al formato attuale anche i tasti salvati dalla versione precedente (un tasto solo)
        s.captureKey = normKeyChoice(s.captureKey);
        if (s.captureMode === 'custom' && !s.captureKey) s.captureMode = 'alt';
        if (!s.applyMode) s.applyMode = 'extra';
        // come trattare i civici in forma numero/numero (20/1, 20/2): 'nonins' (predefinito: restano
        // in lista ma non vengono inseriti), 'includi' (civici normali), 'escludi' (fuori dalla lista)
        if (!['nonins', 'includi', 'escludi'].includes(s.suspMode)) s.suspMode = 'nonins';
        // Raggio: dalla 0.1.5 si parte da 10 m e il massimo scende a 1000 m. Chi aveva ancora
        // il vecchio predefinito (150) passa al nuovo, una volta sola: da li' in poi vale
        // sempre la tua scelta, anche se torni a 150.
        if (!s.raggioV2) { if (!(s.raggio > 0) || s.raggio === 150) s.raggio = DEFAULT_SETTINGS.raggio; s.raggioV2 = 1; }
        s.raggio = Math.min(1000, Math.max(1, parseInt(s.raggio, 10) || DEFAULT_SETTINGS.raggio));
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

    // Chiamata al Web App. Content-Type text/plain: Apps Script lo accetta e non scatena
    // preflight; il corpo resta comunque JSON.
    function gasCall(payload, timeoutMs = 20000) {
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
                    onerror: () => reject(new Error('rete non raggiungibile')),
                    ontimeout: () => reject(new Error('nessuna risposta entro il tempo massimo'))
                });
            } catch (e) { reject(e); }
        });
    }

    // Nome utente WME: prima l'SDK, poi il modello legacy
    function currentUser() {
        const out = { name: '', rank: null, id: null };
        try {
            const i = (sdk.State && typeof sdk.State.getUserInfo === 'function') ? sdk.State.getUserInfo() : null;
            if (i) { out.name = i.userName || i.username || i.name || ''; out.rank = i.rank != null ? i.rank : null; out.id = i.id != null ? i.id : null; }
        } catch { /* sotto */ }
        if (!out.name) {
            try {
                const u = WME().loginManager && WME().loginManager.user;
                const a = u && (u.attributes || u);
                if (a) { out.name = a.userName || a.username || ''; if (out.rank == null && a.rank != null) out.rank = a.rank; if (out.id == null && a.id != null) out.id = a.id; }
            } catch { /* pazienza */ }
        }
        if (out.rank == null) out.rank = userRank();
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

    // Ritorna { ok, user, reason, ruolo, offline }
    async function checkAuthorization(force) {
        const u = currentUser();
        if (!u.name) return { ok: false, code: 401, user: '', reason: 'non riesco a leggere il tuo nome utente Waze: ricarica l\'editor e riprova.' };
        if (!gasConfigured()) {
            return { ok: false, code: 401, user: u.name, reason: gasConfigProblema() };
        }
        if (!gasToken() || /^INCOLLA/i.test(gasToken())) {
            return { ok: false, code: 401, user: u.name, reason: 'la riga GAS_TOKEN e\' ancora quella di esempio: incolla il token stampato da setup() sul foglio.' };
        }
        const cached = readAuthCache(u.name);
        if (!force && cached && cached.ok && Date.now() - cached.ts < AUTH_TTL_H * 3600000) {
            return { ok: true, user: u.name, ruolo: cached.ruolo, nota: cached.nota, versioneMin: cached.versioneMin, cached: true };
        }
        try {
            const r = await gasCall({ action: 'auth', user: u.name, rank: u.rank, livello: livelloDaRank(u.rank), userId: u.id, sessione: SESSION_ID });
            const ok = !!(r && r.ok && r.autorizzato);
            writeAuthCache({ user: u.name, ok, ts: Date.now(), ruolo: r && r.ruolo, nota: r && r.nota, versioneMin: r && r.versioneMin });
            if (ok) return { ok: true, user: u.name, ruolo: r.ruolo, nota: r.nota, versioneMin: r.versioneMin };
            return { ok: false, code: 401, user: u.name, reason: (r && (r.messaggio || r.motivo)) || 'utente non presente nell\'elenco degli abilitati.' };
        } catch (e) {
            // Il foglio non risponde: se poco fa eri abilitato si continua per un periodo di
            // tolleranza, altrimenti si resta chiusi (in caso di dubbio non si apre).
            if (cached && cached.ok && Date.now() - cached.ts < AUTH_GRACE_H * 3600000) {
                return { ok: true, user: u.name, ruolo: cached.ruolo, offline: true, reason: e.message };
            }
            return { ok: false, code: 401, user: u.name, reason: 'non riesco a verificare l\'abilitazione (' + e.message + ').' };
        }
    }

    // Confronta 0.2.10 e 0.3.0 come si deve: -1 se a e' precedente a b
    function confrontaVersioni(a, b) {
        const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const x = pa[i] || 0, y = pb[i] || 0;
            if (x !== y) return x < y ? -1 : 1;
        }
        return 0;
    }

    // Versione troppo vecchia: si blocca e si manda ad aggiornare. Serve quando una
    // versione ha un difetto che sporca la mappa o il registro.
    function renderAggiorna(minima) {
        if (!panelEl) return;
        panelEl.innerHTML = `
  <div class="wfit-head">${logoSvg(30, 8)}<div><div class="t">${SCRIPT_NAME}</div><div class="by">Civici e odonimi ufficiali ANNCSU &middot; a cura di ${AUTORE}</div></div><span class="wfit-ver">v${VERSION}</span></div>
  <div class="wfit-sec wfit-401">
    <div class="wfit-401code">Aggiornamento necessario</div>
    <p>Stai usando la versione <b>${VERSION}</b>, ma i coordinatori richiedono almeno la <b>${escapeHtml(String(minima))}</b>.</p>
    <p>Apri il link qui sotto: Tampermonkey propone l'aggiornamento, poi ricarica il WME.</p>
    <div class="wfit-row">
      <a class="wfit-btn wfit-primary" href="${DOWNLOAD_URL}" target="_blank" rel="noopener">Aggiorna adesso</a>
    </div>
    <p class="wfit-muted">In alternativa: Tampermonkey &rarr; Utility &rarr; Controlla aggiornamenti degli userscript.</p>
  </div>`;
        log(`versione ${VERSION} troppo vecchia: richiesta almeno la ${minima}`);
    }

    function deniedHtml(info) {
        return `
  <div class="wfit-head">${logoSvg(30, 8)}<div><div class="t">${SCRIPT_NAME}</div><div class="by">Civici e odonimi ufficiali ANNCSU &middot; a cura di ${AUTORE}</div></div><span class="wfit-ver">v${VERSION}</span></div>
  <div class="wfit-sec wfit-401">
    <div class="wfit-401code">401 Unauthorized</div>
    <p><b>Utente Waze:</b> ${escapeHtml(info.user || 'sconosciuto')}</p>
    <p>Questo script &egrave; riservato agli editor abilitati. <b>Contattare i coordinatori per l'abilitazione.</b></p>
    <p class="wfit-muted">Dettaglio: ${escapeHtml(info.reason || '')}</p>
    <div class="wfit-row">
      <button class="wfit-btn wfit-primary" id="wfit-401-retry">Ho ricevuto l'abilitazione: ricontrolla</button>
    </div>
    <p class="wfit-muted">Per l'abilitazione scrivi ai coordinatori della community italiana o all'autore ${slackLink()}.</p>
  </div>`;
    }

    function renderDenied(info) {
        if (!panelEl) return;
        panelEl.innerHTML = deniedHtml(info);
        const b = panelEl.querySelector('#wfit-401-retry');
        if (b) b.addEventListener('click', async () => {
            b.disabled = true; b.textContent = 'Controllo in corso\u2026';
            clearAuthCache();
            const r = await checkAuthorization(true);
            if (r.ok) { authInfo = r; startFeatures(); }
            else { renderDenied(r); }
        });
        log('accesso negato:', info.reason);
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
    let lastUnsaved = 0, lastUndoAt = 0, saveEventSeen = false, saveTracking = true;
    let contatoreOk = false;
    const PENDING_MAX_MIN = 10;   // oltre questo, una riga in sospeso viene scritta comunque

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

    // Nomi possibili dell'evento di salvataggio: l'SDK li ha aggiunti in versioni diverse,
    // si prova a registrarli tutti e vale quello che risponde. Se non ne funziona nessuno
    // resta il contatore delle modifiche non salvate come riprova.
    const SAVE_EVENTS = ['wme-save-finished', 'wme-save-succeeded', 'wme-save-success', 'wme-save-completed'];

    function initSaveTracking() {
        let agganciati = 0;
        for (const nome of SAVE_EVENTS) {
            try {
                sdk.Events.on({ eventName: nome, eventHandler: p => onSaveEvent(p) });
                agganciati++;
            } catch { /* questa versione dell'SDK non ha questo evento */ }
        }
        try { sdk.Events.on({ eventName: 'wme-after-undo', eventHandler: () => { lastUndoAt = Date.now(); } }); }
        catch { /* senza questo, un annullamento potrebbe passare per salvataggio */ }

        const n = unsavedCount();
        contatoreOk = (n !== null);
        lastUnsaved = n || 0;
        saveTracking = contatoreOk || agganciati > 0;
        if (!saveTracking) {
            log('salvataggi non rilevabili su questa versione del WME: le righe verranno scritte subito');
            return;
        }
        setInterval(controllaSalvataggio, 2000);
        log(`salvataggi seguiti \u00b7 eventi SDK agganciati: ${agganciati} \u00b7 contatore modifiche: ${contatoreOk ? 'ok' : 'non disponibile'}`);
    }

    function onSaveEvent(p) {
        if (p && (p.success === false || p.error)) return;   // salvataggio fallito: si resta in attesa
        saveEventSeen = true;
        promuoviPending('');
    }

    // Il contatore delle modifiche non salvate torna a zero: o hai salvato, o hai annullato tutto.
    // Un annullamento appena avvenuto fa scartare le righe, non scriverle.
    function controllaSalvataggio() {
        const n = unsavedCount();
        if (n != null) {
            if (!contatoreOk) { contatoreOk = true; log('contatore modifiche ora disponibile'); }
            if (lastUnsaved > 0 && n === 0 && pendingLog.length) {
                if (Date.now() - lastUndoAt < 4000) scartaPending();
                else promuoviPending('');
            }
            lastUnsaved = n;
        }
        scadenzaPending();
    }

    // Rete di sicurezza: se il salvataggio non si riesce a rilevare (evento mai arrivato e
    // contatore non disponibile), dopo PENDING_MAX_MIN le righe vengono scritte lo stesso,
    // segnalando che il salvataggio non e' stato verificato. Meglio una riga con la nota
    // che nessuna riga.
    function scadenzaPending() {
        if (!pendingLog.length) return;
        if (contatoreOk || saveEventSeen) return;   // il rilevamento funziona: si aspetta
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

    function promuoviPending(nota) {
        if (!pendingLog.length) return;
        const n = pendingLog.length;
        for (const r of pendingLog) {
            if (nota) r.motivo = (r.motivo ? r.motivo + ' \u00b7 ' : '') + nota;
            enqueueLog(r);
        }
        pendingLog = [];
        log(`${n} ${pl(n, 'riga registrata', 'righe registrate')} dopo il salvataggio`);
        aggiornaPendingUI();
        flushLogs();
    }

    function scartaPending() {
        const n = pendingLog.length;
        pendingLog = [];
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
                lockDown((r.messaggio || 'abilitazione revocata dai coordinatori.'));
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
        if (!c.ok) { lockDown(c.reason); return; }
        if (c.versioneMin && confrontaVersioni(VERSION, c.versioneMin) < 0) {
            authInfo = { ok: false, user: c.user, reason: 'versione troppo vecchia', code: 426 };
            pendingLog = [];
            captured.clear();
            try { sdk.Map.removeAllFeaturesFromLayer({ layerName: LAYER }); } catch { /* ignora */ }
            try { sdk.Events.off({ eventName: 'wme-selection-changed', eventHandler: onSelectionChanged }); } catch { /* ignora */ }
            renderAggiorna(c.versioneMin);
        }
    }

    // Chiusura immediata: l'abilitazione e' stata tolta mentre l'editor era aperto
    function lockDown(reason) {
        if (!authInfo.ok) return;
        const user = authInfo.user;
        authInfo = { ok: false, user, reason, code: 401 };
        clearAuthCache();
        captured.clear();
        pendingLog = [];
        try { sdk.Map.removeAllFeaturesFromLayer({ layerName: LAYER }); } catch { /* ignora */ }
        try { sdk.Events.off({ eventName: 'wme-selection-changed', eventHandler: onSelectionChanged }); } catch { /* ignora */ }
        renderDenied(authInfo);
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
        await buildTab();               // per ora il pannello mostra solo "verifica in corso"
        loadLogQueue();

        const r = await checkAuthorization(false);
        authInfo = r;
        if (!r.ok) { renderDenied(r); return; }   // niente cattura, niente dati, niente civici
        if (r.versioneMin && confrontaVersioni(VERSION, r.versioneMin) < 0) {
            renderAggiorna(r.versioneMin);
            return;
        }
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
#wfit-panel .wfit-401 { border:1px solid #e2b4b4; background:#fdf3f3; border-radius:8px; }
#wfit-panel .wfit-401code { font-weight:700; font-size:15px; color:#a5232f; letter-spacing:.5px; margin-bottom:6px; }
#wfit-panel .wfit-401 p { margin:6px 0; }
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
#wfit-panel .wfit-n-ok   { color:#2f7a44; }
#wfit-panel .wfit-hndup  { border-left-color:#e8b530; }
#wfit-panel .wfit-hnwaze { border-left-color:#7fa8c9; opacity:.72; }
#wfit-panel .wfit-hnmoved { border-left-color:#e07b28; background:#fdf6f0; }
#wfit-panel .wfit-hnovl  { border-left-color:#7d5bd0; background:#f7f4fd; }
#wfit-panel .wfit-hnsusp { border-left-color:#cc3b3b; background:#fdf4f4; }
#wfit-panel .wfit-hnok   { border-left-color:#3fa055; }
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
#wfit-panel .wfit-swatch { display:inline-block; width:3px; height:11px; border-radius:2px; vertical-align:-2px; margin-right:5px; flex:0 0 auto; }
#wfit-panel .wfit-sw-dup  { background:#e8b530; }
#wfit-panel .wfit-sw-waze { background:#7fa8c9; }
#wfit-panel .wfit-sw-moved { background:#e07b28; }
#wfit-panel .wfit-sw-ovl   { background:#7d5bd0; }
#wfit-panel .wfit-sw-susp { background:#cc3b3b; }
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
      <option value="off">Spenta (usa "Aggiungi selezione")</option>
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
    <button class="wfit-btn" id="wfit-add-sel">Aggiungi selezione attuale</button>
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
    <label>Raggio (m)</label><input type="number" id="wfit-raggio" min="1" max="1000" step="1" style="max-width:70px" title="Distanza massima civico-segmento per il confronto (da 1 a 1000 m, predefinito 10). Nota: i punti ANNCSU stanno su edifici/ingressi, spesso 5-20 m dall'asse strada: con raggi molto stretti potresti perdere civici legittimi, con raggi larghi tirare dentro le vie vicine.">
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
  </div>

  <div class="wfit-sec">
  <h4>Risultati</h4>
  <div id="wfit-results" class="wfit-muted">Qui appariranno via/contrada, localit&agrave;, comune e i civici agganciati. Scarica la regione e cattura qualche segmento per iniziare.</div>

  </div>

  <details class="wfit-guide"><summary><b>&#8505;&#65039; Come funziona</b></summary>
    <p><span class="wfit-gnum">1 &middot; Scarica i dati.</span> Scegli la regione e premi <b>Scarica regione</b>: lo script legge l'archivio ufficiale ANNCSU (Istat / Agenzia delle Entrate) e salva in locale tutti i civici georiferiti. La cache resta anche ai prossimi avvii, quindi non serve rifarlo a ogni sessione. ANNCSU aggiorna per&ograve; i dataset regionali con <b>cadenza mensile</b> e in questo periodo i Comuni stanno completando la georeferenziazione dei civici (in Italia solo una parte &egrave; ancora geolocalizzata): un giro ogni <b>4&ndash;6 settimane</b> pu&ograve; far comparire strade e numeri prima assenti. Nel pannello trovi sempre scritto da quanti giorni hai scaricato ogni regione (si evidenzia oltre 35 giorni, solo come promemoria: <b>lo script non riscarica mai da solo</b>). Sotto <b>Altre opzioni dati</b>, <b>Scarica tutte</b> le prende una dopo l'altra (alcuni minuti: te lo chiede prima di partire), mentre <b>Aggiorna</b> riscarica quelle che hai gi&agrave; in locale (e si accende di verde quando i tuoi dati hanno passato i 35 giorni); in tutti e due i casi il bottone diventa <b>Ferma</b> e il ciclo si interrompe dopo la regione in corso. <b>Svuota dati</b> riparte da zero. I dati ANNCSU sono <b>open data</b> rilasciati con licenza ${licLink('Creative Commons Attribuzione 4.0 (CC-BY 4.0)')}: si possono riutilizzare anche su Waze, purch&eacute; sia citata la fonte.</p>
    <p><span class="wfit-gnum">2 &middot; Cattura i segmenti.</span> <b>ALT + clic</b> su un segmento lo mette in lista e lo evidenzia sulla mappa (bordo scuro + tratteggio nel colore che scegli dal menu <b>Evidenzia</b>). Ri-clic lo toglie, la &times; sul chip pure, il clic sul chip lo seleziona nell'editor. Dal menu <b>Cattura</b> puoi passare a <b>ALT + MAIUSC</b> o <b>CTRL/&#8984; + ALT</b> (combinazioni scelte apposta perch&eacute; non le usano n&eacute; il WME n&eacute; gli script pi&ugrave; diffusi: MAIUSC e CTRL da soli, invece, servono al WME per la multi&#8209;selezione), alla modalit&agrave; "Sempre" o spegnerla e usare "Aggiungi selezione attuale". I chip rossi indicano i segmenti dove l'ultimo Applica &egrave; fallito.</p>
    <p><span class="wfit-gnum">2b &middot; Il tuo tasto.</span> Se ALT ti sta scomodo, scegli <b>Un tasto a tua scelta</b> nel menu <b>Cattura</b>: compare un riquadro rosso con scritto <b>"cliccami per attivare l'ascolto del tasto"</b>. Cliccalo e premi <b>un solo tasto</b> della tastiera (uno soltanto: per ALT, MAIUSC e CTRL ci sono gi&agrave; le voci fisse del menu). Il tasto letto ti viene mostrato in attesa di conferma: <b>Conferma</b> lo salva, <b>Rifai</b> riapre l'ascolto per sceglierne un altro, ESC annulla. Da quel momento tieni premuto quel tasto e clicchi il segmento: <b>resta salvato</b> anche alle prossime sessioni. Mentre lo tieni premuto lo script blocca l'eventuale scorciatoia del WME sullo stesso tasto, cos&igrave; non fa danni: scegline comunque uno che non usi spesso, perch&eacute; i tasti singoli sono la fascia che WME, Toolbox e gli altri script si contendono. <b>Azzera</b> lo cancella e riporta tutto ad ALT + clic, che resta la scelta predefinita.</p>
    <p><span class="wfit-gnum">3 &middot; Confronta con ANNCSU.</span> Con l'<b>Auto-analisi</b> il confronto parte da solo, altrimenti premi il bottone: entro il <b>Raggio</b> scelto compaiono fino a 8 odonimi ordinati per distanza, ognuno col suo colore, con comune, localit&agrave;/contrada e numero di civici distinti. Il raggio parte da <b>10 m</b> e arriva al massimo a <b>1000 m</b>: <b>pi&ugrave; il valore tende a zero, pi&ugrave; l'accuratezza &egrave; precisa</b>. Valori consigliati: <b>~10 m</b> in paese e in citt&agrave; (segmenti corti, vie parallele vicine), <b>20&ndash;30 m</b> fuori dal centro abitato e nelle contrade (segmenti lunghi, edifici arretrati), <b>50&ndash;100 m</b> solo per capire <i>quali</i> odonimi insistono sulla zona, <b>mai</b> per applicare o inserire. Parti stretto e allarga poco per volta: se fra i risultati compaiono odonimi che con il tuo segmento non c'entrano nulla, il raggio &egrave; troppo largo. Attenzione anche al limite opposto: i punti ANNCSU stanno sugli edifici e sugli ingressi, spesso 5&ndash;20 m dalla mezzeria, quindi un raggio troppo stretto taglia fuori civici veri; e oltre <b>45 m</b> il raggio non serve a inserire, perch&eacute; Waze rifiuta comunque i civici troppo lontani dal segmento. Con <b>Civici sulla mappa</b> vedi i punti etichettati (343, 343/A&hellip;) e col menu <b>Pallini</b> li ingrandisci quanto ti serve, fino a <b>Enormi</b>: &egrave; solo un aiuto per gli occhi, non cambia nulla di quello che finisce su Waze. Se togli segmenti dalla lista, risultati e mappa si riallineano da soli.</p>
    <p><span class="wfit-gnum">4 &middot; Applica i nomi.</span> Il nome &egrave; in una <b>casella modificabile</b>: correggilo secondo le linee guida (per "Strada Contrada&hellip;" c'&egrave; il link rapido "usa Contrada&hellip;") e lo script <b>impara la tua regola</b>, precompilando cos&igrave; le prossime caselle. Scegli la modalit&agrave;: <b>Dentro il centro abitato</b> (PN con citt&agrave;) o <b>Fuori centro abitato</b> (regola IT: PN senza citt&agrave; + AN con citt&agrave;). "Applica ai segmenti" tocca <b>solo ci&ograve; che differisce</b>, preserva gli alternativi esistenti e dopo ogni scrittura <b>verifica</b> che il WME abbia registrato davvero; se trova alternativi non conformi te li elenca e li rimuove <b>solo se confermi</b>. I segmenti fuori vista vengono recuperati spostando la mappa. Poi <b>salva</b>.</p>
    <p><span class="wfit-gnum">5 &middot; Numeri civici.</span> Dopo il salvataggio, <b>+N civici su Waze</b> apre l'<b>elenco di controllo</b>: clic sulla riga e la mappa si centra sul civico; il numero &egrave; modificabile e si normalizza da solo (18b &rarr; 18/B); i civici oltre <b>45 m</b> dalla strada vengono esclusi (Waze li rifiuterebbe); quelli gi&agrave; presenti compaiono come <b>"gi&agrave; su Waze"</b> e si deselezionano da soli; se invece il numero esiste gi&agrave; <b>su questa strada ma in un punto sbagliato</b>, la riga arriva arancione con scritto <b>"gi&agrave; su Waze ma a ~N m: da spostare, non da aggiungere"</b> e senza spunta: in quel caso <b>trascina il civico che c'&egrave; gi&agrave;</b> sul punto giusto invece di aggiungerne un secondo (Waze accetta un solo punto per numero); se lo spunti lo stesso, prima di inserirlo lo script te lo chiede; se lo stesso numero compare in <b>pi&ugrave; punti dell'archivio</b> te li mostra <b>tutti</b>, su sfondo giallo e senza spunta, perch&eacute; solo tu puoi vedere quale posizione &egrave; quella vera: Waze ne accetta comunque uno solo per via; se due o pi&ugrave; civici cadono sulla <b>stessa identica coordinata</b> (meno di <b>1,5 m</b>) la riga diventa viola e tutto il gruppo arriva <b>senza spunta</b>, perch&eacute; i numeri si stampano uno sopra l'altro e diventano illeggibili. La scelta resta tua: controlla su Street View e spunta <b>quelli che esistono davvero</b>, anche pi&ugrave; di uno se sul posto ci sono davvero pi&ugrave; ingressi. Quelli che inserisci nascono tutti in quel punto, quindi <b>trascinali uno per uno sull'ingresso giusto prima di salvare</b>: il riepilogo finale te lo ricorda. La soglia &egrave; volutamente strettissima: i civici semplicemente <b>vicini</b> fra loro (portoni a 4&ndash;6 m, normalissimi in centro) <b>non</b> vengono toccati; con <b>"+ Aggiungi al centro mappa"</b> inserisci un civico letto su Street View nel punto dove hai centrato la mappa. Confermi con "Inserisci" (tutti quelli spuntati, senza limite di numero) e salvi. Servono una strada <b>con nome</b> e nessuna modifica pendente: se manca qualcosa, lo script te lo dice prima.</p>
    <p><span class="wfit-gnum">6 &middot; Se qualcosa viene rifiutato.</span> Lo script non pu&ograve; lavorare dove non puoi lavorare tu: se un segmento &egrave; <b>bloccato sopra il tuo livello</b> o comunque non hai i permessi per modificarlo, l'inserimento fallisce e il riepilogo te lo dice &mdash; in quel caso <b>chiedi lo sblocco (unlock) alla community</b> prima di riprovare. Gli altri casi: <b>"strada senza nome"</b> &rarr; dai prima il nome alla strada (puoi catturarla con lo script); <b>"gi&agrave; su Waze"</b> &rarr; il civico esiste gi&agrave; e non viene reinserito; <b>"gi&agrave; su Waze ma posizionato male"</b> &rarr; il numero c'&egrave; gi&agrave; su questa strada in un altro punto: trascina quello esistente sul punto giusto, non aggiungerne un altro. Negli errori del salvataggio WME: "gi&agrave; esistente" &rarr; elimina il doppione; "lato errato" o "fuori sequenza" &rarr; ricontrolla i punti e, se sono corretti sul territorio, usa <b>Salva &rarr; Forza</b>; "troppo lontano dal segmento" &rarr; piazzalo a mano vicino alla strada e trascinalo sul punto reale.</p>
    <p class="wfit-key"><span class="wfit-gnum">7 &middot; La regola pi&ugrave; importante.</span> Questo script <b>non sostituisce il lavoro umano di noi editor: lo facilita</b>. Ogni modifica apportata va controllata con i <b>cartelli stradali</b> e i <b>numeri civici reali</b> dove presenti, con la <b>conoscenza del territorio</b> da parte dell'editor e con <b>buon senso civico</b> nell'utilizzo. Lo strumento propone: la responsabilit&agrave; di ci&ograve; che finisce sulla mappa resta di chi salva.</p>
    <div class="wfit-muted">Lo script modifica solo ci&ograve; che differisce e salta ci&ograve; che &egrave; gi&agrave; a posto: <b>rivedi comunque sempre l'elenco modifiche prima di salvare</b>.</div>
    <p>&#128214; Questa &egrave; la <b>guida rapida</b>. Regole per esteso, esempi con immagini, tabella degli errori e note per gli editor sono nella ${guidaLink('<b>guida completa</b>')} del progetto.</p>
    <p>&#128172; Info, idee o problemi? Scrivimi su <b>Slack</b>: ${slackLink()}.</p>
  </details>

  <div class="wfit-foot">${logoSvg(13, 3)} <b>${SCRIPT_NAME}</b> &middot; a cura di <b>${AUTORE}</b> &middot; dati: ${anncsuLink()} (Istat / Agenzia delle Entrate), open data con licenza ${licLink()} &middot; ${guidaLink()} &middot; info: Slack ${slackLink()}.</div>
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
                addSel: p.querySelector('#wfit-add-sel'),
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
            settings.raggio = Math.min(1000, Math.max(1, parseInt(ui.raggio.value, 10) || DEFAULT_SETTINGS.raggio));
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
        ui.addSel.addEventListener('click', () => captureIds(getSelectedSegmentIds(), false));
        ui.clearCap.addEventListener('click', () => { captured.clear(); lastFailedIds.clear(); updateCapturedUI(); clearResultsUI(); });
        ui.analizza.addEventListener('click', analyze);
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
        rec.fileName = fileName;
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
            espShare: quota, espTop: topEsp, mapSource,
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
        return firstOk(
            () => {
                const sel = sdk.Editing.getSelection();
                return (sel && sel.objectType === 'segment' && sel.ids && sel.ids.length) ? sel.ids.slice() : null;
            },
            () => {
                const W = WME();
                if (!W || !W.selectionManager) return null;
                return W.selectionManager.getSelectedDataModelObjects()
                    .filter(o => o.type === 'segment').map(o => o.getID());
            }
        ) || [];
    }

    function clearWmeSelection() {
        firstOk(
            () => { if (typeof sdk.Editing.clearSelection !== 'function') return null; sdk.Editing.clearSelection(); return true; },
            () => {
                if (typeof sdk.Editing.setSelection !== 'function') return null;
                sdk.Editing.setSelection({ selection: { ids: [], objectType: 'segment' } });
                return true;
            },
            () => {
                const W = WME();
                if (!W || !W.selectionManager || !W.selectionManager.unselectAll) return null;
                W.selectionManager.unselectAll();
                return true;
            }
        );
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
            default: return 'Cattura spenta: usa "Aggiungi selezione attuale".';
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
            ui.selinfo.innerHTML = `Lista vuota. ${keyTxt ? `<b>${keyTxt} + clic</b> su un segmento per aggiungerlo (stessa combinazione per toglierlo).` : settings.captureMode === 'always' ? 'Clicca i segmenti sulla mappa.' : 'Usa "Aggiungi selezione attuale".'}`;
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

    function segGeometry(id) {
        return firstOk(
            () => {
                const seg = sdk.DataModel.Segments.getById({ segmentId: id });
                return (seg && seg.geometry && seg.geometry.coordinates) || null;
            },
            () => {
                const seg = WME().model.segments.getObjectById(id);
                const g = seg.getOLGeometry ? seg.getOLGeometry() : seg.geometry;
                return (g && g.components) ? g.components.map(c => merc2wgs(c.x, c.y)) : null;
            }
        );
    }

    function merc2wgs(x, y) {
        const lon = (x / 20037508.34) * 180;
        let lat = (y / 20037508.34) * 180;
        lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
        return [lon, lat];
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
            sdk.Map.addLayer({
                layerName: LAYER,
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
            try { sdk.Map.setLayerVisibility({ layerName: LAYER, visibility: true }); } catch { /* facoltativo */ }
            layerReady = true;
        } catch (e) {
            layerFailed = true;
            log('livello mappa non disponibile in questo SDK:', e);
            toast('Questa versione del WME non permette allo script di disegnare i civici sulla mappa.', 6000);
        }
        return layerReady;
    }

    function updateCiviciLayer(features) {
        if (!ensureLayer()) return;
        try { sdk.Map.removeAllFeaturesFromLayer({ layerName: LAYER }); } catch { /* ignora */ }
        try { sdk.Map.addFeaturesToLayer({ layerName: LAYER, features }); }
        catch (e) { log('addFeaturesToLayer KO', e); }
        raiseOwnLayer();
    }

    // Gli script di evidenziazione (Color Highlights ecc.) disegnano sopra i livelli aggiunti dopo:
    // riportiamo il nostro in cima a ogni ridisegno, cosi' la selezione resta sempre visibile.
    let zBumpLogged = false;
    function raiseOwnLayer() {
        try {
            const W = WME();
            if (!W || !W.map || !Array.isArray(W.map.layers) || typeof W.map.setLayerIndex !== 'function') return;
            const lyr = W.map.layers.find(l => l && typeof l.name === 'string' && l.name.indexOf(LAYER) !== -1);
            if (!lyr) return;
            W.map.setLayerIndex(lyr, W.map.layers.length - 1);
            if (!zBumpLogged) { zBumpLogged = true; log('livello portato sopra gli evidenziatori'); }
        } catch { /* il colore acceso resta comunque */ }
    }

    function clearCiviciLayer() {
        if (!layerReady) return;
        try { sdk.Map.removeAllFeaturesFromLayer({ layerName: LAYER }); } catch { /* ignora */ }
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
        for (const f of lastDotFeatures) {
            if (!f.properties || f.geometry.type !== 'Point') continue;
            f.properties.pr = sz.r;
            f.properties.fs = sz.f + 'px';
            f.properties.yo = sz.y;
        }
        refreshMapLayer();
    }

    // Ridisegna il livello: prima le linee tricolore, sopra i puntini dei civici (se attivi)
    function refreshMapLayer() {
        const feats = [...segHighlightFeatures(), ...(settings.showDots ? lastDotFeatures : [])];
        if (!feats.length) { clearCiviciLayer(); return; }
        updateCiviciLayer(feats);
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
        const colorOf = new Map(lastResults.map(r => [r.g, r.color]));
        const sz = dotSize();
        const features = [];
        let n = 0;
        for (const [g, arr] of lastPtsByG) {
            const color = colorOf.get(g);
            if (!color) continue;
            for (const p of arr) {
                features.push({
                    id: 'wfit-' + g + '-' + (n++),
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
        abbreviazioni: { diramazione: 'Dir', diramazioni: 'Dir', diramaz: 'Dir', diram: 'Dir' },
        minuscole: ['di', 'del', 'dello', 'della', 'dei', 'degli', 'delle', 'da', 'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle', 'de', 'd', 'la', 'le', 'lo', 'li', 'e', 'ed', 'a', 'ad', 'al', 'allo', 'alla', 'ai', 'agli', 'alle', 'in', 'nel', 'nello', 'nella', 'nei', 'negli', 'nelle', 'su', 'sul', 'sulla', 'sui', 'sugli', 'sulle', 'con', 'col', 'per', 'tra', 'fra', 'un', 'uno', 'una'],
        particelleCognome: ['di', 'de', 'del', 'dello', 'della', 'dei', 'degli', 'delle', 'da', 'dal', 'dalla', 'dalle', 'la', 'lo', 'li'],
        cognomiConParticella: ['de amicis', 'de gasperi', 'de nicola', 'de sanctis', 'de sica', 'della chiesa', 'dalla chiesa', 'di giacomo', 'di pietro', 'di vittorio', 'la malfa', 'lo bianco'],
        euristicaCognome: true,
        particelleEuristica: ['di', 'de'],
        eccezioniParticella: ['di savoia', 'di rienzo', 'dei mille', 'dalle bande nere', 'della francesca'],
        toponimiReligiosi: ['san', 'santa', 'santo', 'sant', 'ss', 'madonna', 'nostra', 'signora', 'beata', 'beato', 'chiesa', 'cappella', 'santuario', 'convento', 'abbazia', 'pieve'],
        romaniAmbigui: ['c', 'd', 'i', 'l', 'm', 'v', 'x', 'ci', 'di', 'li', 'mi', 'vi'],
        contestoRomanoPrima: ['papa', 'pio', 'giovanni', 'paolo', 'leone', 'benedetto', 'gregorio', 'clemente', 'sisto', 'urbano', 'vittorio', 'emanuele', 'umberto', 'carlo', 'luigi', 'federico', 'enrico', 'ferdinando', 're', 'regina', 'traversa', 'parallela', 'lotto'],
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

    // Nome pronto per Waze: maiuscole all'italiana + abbreviazioni (Diramazione -> Dir).
    // Le abbreviazioni valgono anche a Title Case spento: sono regole di nome, non di stile.
    function toWazeCase(s) {
        const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
        if (!t) return t;
        return applyAbbrev(settings.titleCase ? titleCaseIT(t) : t);
    }

    function applyAbbrev(s) {
        if (!ODO_SET.abbrev.size) return s;
        return s.split(' ').map(t => {
            const p = splitTok(t);
            const v = ODO_SET.abbrev.get(deacc(p.core));
            return v ? p.pre + v + p.post : t;
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
        // un numero romano ambiguo (DI, VI, I...) vale come numero solo con il contesto giusto
        const romanCtx = i => ODO_SET.prima.has(core[i - 1] || '') || ODO_SET.dopo.has(core[i + 1] || '');
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
            return ODO_SET.nomi.has(prev) || /^[a-z]$/.test(prev);   // nome di persona o iniziale
        };

        return parts.map((p, i) => {
            if (!p.core) return toks[i];
            const c = core[i];
            // iniziale puntata: "A. De Gasperi", "G. Marconi"
            if (c.length === 1 && p.post.indexOf('.') >= 0) return p.pre + p.core.toUpperCase() + p.post;
            if (isRoman(c) && (!ODO_SET.ambigui.has(c) || romanCtx(i))) return p.pre + p.core.toUpperCase() + p.post;
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
        if (lastDupCount) {
            const note = document.createElement('div');
            note.className = 'wfit-muted';
            note.style.marginBottom = '5px';
            note.title = 'Stesso odonimo e stesso numero civico presenti piu\' volte nei dati ANNCSU (piu\' accessi allo stesso civico) o agganciati da piu\' segmenti. Sono mostrati tutti: nell\'elenco dei civici le ripetizioni sono marcate e arrivano senza spunta, decidi tu quale posizione e\' quella giusta.';
            note.innerHTML = `&#8505;&#65039; ${lastDupCount} ${pl(lastDupCount, 'numero civico ripetuto', 'numeri civici ripetuti')} nell'archivio: ${pl(lastDupCount, 'mostrato', 'mostrati')} comunque, da valutare.`;
            ui.results.appendChild(note);
        }
        for (const r of results) {
            const base = toWazeCase(r.name);
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

            const info = document.createElement('div');
            info.innerHTML = `<span class="wfit-muted">Comune: <b>${escapeHtml(r.comune)}</b>` +
                (r.locality ? ` &middot; Localit&agrave;: ${escapeHtml(toWazeCase(r.locality))}` : '') +
                ` &middot; ~${Math.round(r.dist)} m &middot; ${r.count} ${pl(r.count, 'civico', 'civici')}` +
                (r.fileDate ? ` &middot; dati ANNCSU del ${r.fileDate}` : '') + `</span>`;
            div.appendChild(info);

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
                if (v) applyToSegments(v, r.comune, prefill);
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
            if (sdk.Editing && typeof sdk.Editing.getUnsavedChangesCount === 'function') {
                const n = sdk.Editing.getUnsavedChangesCount();
                if (typeof n === 'number') return n;
            }
        } catch { /* si prova col modello interno */ }
        try {
            const W = WME();
            const am = W && W.model && W.model.actionManager;
            if (am) {
                if (typeof am.unsavedActionsNum === 'function') return am.unsavedActionsNum();
                if (typeof am.getActions === 'function') return (am.getActions() || []).length;
            }
        } catch { /* sconosciuto */ }
        return null;
    }

    // Traduce gli errori del WME in indicazioni azionabili
    function niceReason(msg) {
        const m = String(msg || 'errore');
        if (/projected segment|not allowed to add a house number|point is a required/i.test(m)) {
            return 'segmento con modifiche non salvate: salva (Ctrl+S) e ripremi il bottone';
        }
        if (/exists|duplicate/i.test(m)) return 'civico gi\u00e0 presente';
        if (/permission|rank|lock/i.test(m)) return 'permessi insufficienti sul segmento';
        return m;
    }

    // Come si presenta una riga in forma 20/1, secondo la modalita' scelta dall'utente
    const suspNote = () => settings.suspMode === 'includi'
        ? ['ok', 'incluso su tua scelta']
        : ['warn', '\u26a0\ufe0f non inserito'];

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
        return existing.find(h => h.num === label &&
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
        for (const h of existing) {
            if (!h.own || h.num !== label) continue;
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

    // Un esponente tutto NUMERICO ("2/4", "1/3") e' l'impronta tipica di una colonna del CSV letta
    // male: un progressivo o un codice interno appiccicato al civico. Puo' anche essere reale,
    // ma non lo possiamo sapere da qui: si segnala e decide l'utente, che il territorio lo vede.
    const isSusp = lbl => { const e = splitHn(lbl)[1]; return !!e && /^\d+$/.test(e); };

    // Validazione stretta di quello che l'utente scrive nella casella:
    // "18b" / "18 B" / "18/b" -> "18/B"; solo numero -> com'e'. null se non valido.
    function normHn(s) {
        const m = /^(\d{1,5})(?:\/?([A-Z0-9]{1,4}))?$/.exec(String(s || '').trim().toUpperCase().replace(/\s+/g, ''));
        if (!m) return null;
        return m[2] ? m[1] + '/' + m[2] : m[1];
    }

    function mapCenter() {
        return firstOk(
            () => {
                const c = sdk.Map.getMapCenter();
                if (!c) return null;
                if (c.lon != null && c.lat != null) return [c.lon, c.lat];
                if (c.lonLat && c.lonLat.lon != null) return [c.lonLat.lon, c.lonLat.lat];
                return null;
            },
            () => {
                const c = WME().map.getCenter();
                return c ? merc2wgs(c.lon != null ? c.lon : c.x, c.lat != null ? c.lat : c.y) : null;
            }
        );
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

    // Le due firme conosciute di setMapCenter, provate in ordine. true se una ha funzionato.
    function quickCenter(lon, lat) {
        return !!firstOk(
            () => { sdk.Map.setMapCenter({ lonLat: { lon, lat } }); return true; },
            () => { sdk.Map.setMapCenter({ lon, lat }); return true; }
        );
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
        const isOwn = (h, forced) => {
            if (forced) return true;
            const sid = h.segID != null ? h.segID : (h.segmentId != null ? h.segmentId : h.segmentID);
            return sid != null && capIds.has(String(sid));
        };
        const push = (h, forced) => {
            if (!h) return;
            const num = h.houseNumber != null ? h.houseNumber : (h.number != null ? h.number : null);
            let c = (h.point && h.point.coordinates) || (h.geometry && h.geometry.coordinates) || null;
            if (!c && h.geometry && h.geometry.x != null && h.geometry.y != null) c = merc2wgs(h.geometry.x, h.geometry.y);
            if (num == null || !c || c.length < 2) return;
            out.push({ num: String(num), c: [c[0], c[1]], own: isOwn(h, forced) });
        };
        // getHouseNumbers puo' rispondere sincrona o con una promessa, a seconda della versione
        const collect = async (arg, forced) => {
            let r = HN.getHouseNumbers(arg);
            if (r && typeof r.then === 'function') r = await r;
            if (Array.isArray(r)) r.forEach(h => push(h, forced));
        };
        const hasHN = HN && typeof HN.getHouseNumbers === 'function' && viaIds.length;
        // Firma documentata dell'SDK: getHouseNumbers({ segmentIds }) -> Promise<HouseNumber[]>,
        // con { id, number, segmentId, geometry }. Chiesti per TUTTA la via: qualunque cosa
        // torni e' roba di questa strada, quindi vale come doppione ovunque si trovi.
        try { if (hasHN) await collect({ segmentIds: viaIds }, true); }
        catch { /* sorgente successiva */ }
        // il giro per segmento serve solo se la chiamata in blocco non ha dato nulla
        if (hasHN && !out.length) {
            for (const id of viaIds) {
                try { await collect({ segmentId: id }, true); }
                catch { break; /* firma non supportata */ }
            }
        }
        lastHNScan = { hn: 0, segs: viaIds.length };
        log(`civici gia' su Waze: ${out.length} letti su ${viaIds.length} segmenti della stessa via ` +
            `(${captured.size} in lista)`);
        try { if (HN && typeof HN.getAll === 'function') (HN.getAll() || []).forEach(h => push(h)); } catch { /* oltre */ }
        try {
            const W = WME();
            const repo = W.model && W.model.segmentHouseNumbers;
            const arr = repo && typeof repo.getObjectArray === 'function' ? repo.getObjectArray() : null;
            if (arr) arr.forEach(o => push(o && (o.attributes || o)));
        } catch { /* pazienza */ }
        const seen = new Map();
        const uniq = [];
        for (const h of out) {
            const k = h.num + '|' + Math.round(h.c[0] * 1e5) + '|' + Math.round(h.c[1] * 1e5);
            const old = seen.get(k);
            if (old) { if (h.own) old.own = true; continue; } // stesso civico letto da piu' sorgenti
            seen.set(k, h);
            uniq.push(h);
        }
        lastHNScan.hn = uniq.filter(h => h.own).length;
        return uniq;
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
            ? 'Numero in forma numero/numero ("2/4"): pu\u00f2 essere un civico reale, un intervallo scritto male o una colonna del CSV letta male. Di base non viene inserito. Se sul posto esiste davvero cosi\', spuntalo; per trattarli tutti allo stesso modo usa la barra sopra la lista.'
            : p.ovl
            ? `Questo civico sta sulla stessa coordinata di altri ${p.ovlN - 1} (meno di ${HN_OVERLAP_TXT} m): sulla mappa i numeri si stampano uno sopra l\'altro e non si leggono. Per questo il gruppo arriva senza spunta e la scelta la fai tu: guarda il posto su Street View e spunta quelli che esistono davvero \u2014 anche piu\' di uno, se sul posto ci sono davvero piu\' ingressi. Quelli che inserisci nascono tutti in questo punto: poi vanno TRASCINATI uno per uno sull\'ingresso giusto, prima di salvare. Clic sulla riga per centrare la mappa.`
            : p.dup
            ? 'Questo numero compare su piu\' record ANNCSU distinti (stesso comune, stesso odonimo, stessa localita\'): qui vedi un\'altra posizione dello stesso civico. Clic per centrarla e confrontarla con Street View; Waze accetta un solo punto per numero. Pochi metri di distanza = stesso accesso rilevato due volte; decine di metri = secondo accesso reale o errore d\'archivio.'
            : 'Clic sulla riga: la mappa si centra su questo civico. Il numero \u00e8 modificabile (es. 18 \u2192 18/B).';
        return base + (p.manual ? '' : `\nCoordinate: ${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`);
    }

    // Una riga dell'elenco: spunta, numero modificabile, distanza e nota.
    // Layout su due righe: sopra spunta, numero e distanza (sempre corti, mai a capo),
    // sotto la nota solo quando serve. Su una riga sola, in un pannello stretto,
    // il testo si spezzava una parola per riga.
    function addHnRow(p, ctx) {
        const row = document.createElement('div');
        p.susp = !p.manual && isSusp(p.label);
        row.className = 'wfit-hnrow' + (p.susp && settings.suspMode !== 'includi' ? ' wfit-hnsusp'
            : p.susp ? ' wfit-hnok' : p.ovl ? ' wfit-hnovl' : p.dup ? ' wfit-hndup' : '');
        row.title = hnRowTitle(p);

        // ripetizioni, civici sovrapposti e numeri in forma 20/1 arrivano senza spunta: restano
        // visibili e spuntabili a mano, ma di loro iniziativa non finiscono su Waze
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.checked = !p.dup && !p.ovl && !(p.susp && settings.suspMode !== 'includi');
        if (p.susp && settings.suspMode === 'escludi') row.style.display = 'none';
        const inp = document.createElement('input');
        inp.type = 'text'; inp.className = 'wfit-hnnum'; inp.value = p.label;
        inp.addEventListener('input', () => {
            inp.classList.remove('wfit-bad-in');
            // il numero e' cambiato: quello che sapevamo del civico gia' su Waze non vale piu'
            if (p.wazeFar) { p.wazeFar = null; row.classList.remove('wfit-hnmoved'); setNote('', ''); }
        });
        const dist = document.createElement('span'); dist.className = 'wfit-muted wfit-hnd';
        dist.textContent = p.manual ? 'aggiunto da te' : `~${Math.round(p.d)} m`;
        const top = document.createElement('div'); top.className = 'wfit-hntop';
        top.appendChild(cb); top.appendChild(inp); top.appendChild(dist);
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

        row.addEventListener('click', ev => { if (ev.target !== cb && ev.target !== inp && ev.target.tagName !== 'A') quickCenter(p.lon, p.lat); });
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

    // Civico trovato su Street View: lo scrivi tu e nasce alla posizione attuale del centro mappa
    function buildHnAddBox(ctx) {
        const addBox = document.createElement('div');
        addBox.className = 'wfit-hnadd';
        const addIn = document.createElement('input');
        addIn.type = 'text'; addIn.placeholder = 'es. 18/B (da Street View)';
        const addBtn = document.createElement('button');
        addBtn.className = 'wfit-btn'; addBtn.textContent = '+ Aggiungi al centro mappa';
        addBtn.title = 'Centra prima la mappa sul portone (clic su un civico vicino e poi trascina), scrivi il numero e premi: la riga nasce l\u00ec, gi\u00e0 spuntata';
        addBox.appendChild(addIn); addBox.appendChild(addBtn);
        const doAdd = () => {
            const v = normHn(addIn.value);
            if (!v) { toast('Numero non valido: usa formati come 18, 18/B, 12/BIS.'); addIn.focus(); return; }
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
            sel.push({ lon: x.p.lon, lat: x.p.lat, d: x.p.d, label: v, far: x.p.wazeFar || 0, ovl: x.p.ovl || 0 });
        }
        // due o piu' civici dello stesso gruppo: nascono sovrapposti e andranno separati a mano
        const perGruppo = {};
        for (const x of sel) if (x.ovl) bump(perGruppo, x.ovl);
        for (const x of sel) x.stack = !!(x.ovl && perGruppo[x.ovl] > 1);
        if (bad) { toast('Controlla i numeri evidenziati in rosso (formati validi: 18, 18/B, 12/BIS).', 7000); return null; }
        if (!sel.length) return null;
        // hai spuntato a mano dei numeri che su questa via esistono gia', solo altrove: prima di
        // creare un doppione te lo diciamo chiaramente e decidi tu
        const moved = sel.filter(x => x.far);
        if (moved.length && !confirm(
            `${moved.length} ${pl(moved.length, 'numero che hai spuntato esiste', 'numeri che hai spuntato esistono')} gi\u00e0 su questa strada, `
            + `ma in un altro punto (${moved.slice(0, 6).map(x => x.label + ' a ~' + x.far + ' m').join(', ')}${moved.length > 6 ? '\u2026' : ''}).\n\n`
            + 'Di solito la cosa giusta \u00e8 trascinare il civico gi\u00e0 sulla mappa nella posizione corretta: '
            + 'aggiungerne un altro crea un doppione e Waze ne accetta uno solo per via.\n\n'
            + 'Vuoi inserirli lo stesso?'
        )) return null;
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
        bNo.addEventListener('click', () => ctx.box.remove());
        ctx.bGo.addEventListener('click', () => {
            const sel = collectHnSelection(ctx);
            if (!sel) return;
            ctx.box.remove();
            runHnInsert(r, sel);
        });
        ctx.head.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
            const v = a.dataset.a === 'all';
            // "tutti" non tira dentro i numero/numero finche' la modalita' e' "non inserito":
            // il loro stato lo decidi con la barra sopra, non di rimbalzo
            let skipped = 0, kept = 0, over = 0;
            ctx.rows.forEach(x => {
                if (v && x.p.susp && settings.suspMode !== 'includi') { skipped++; return; }
                // nemmeno i numeri gia' presenti sulla via ma messi male: quelli si spostano a mano
                if (v && x.p.wazeFar) { kept++; return; }
                // nemmeno i civici sovrapposti: li' dentro la scelta e' una sola e la fai tu
                if (v && x.p.ovl) { over++; return; }
                x.cb.checked = v;
            });
            if (skipped) toast(`${skipped} ${pl(skipped, 'numero', 'numeri')} in forma 20/1 non ${pl(skipped, 'incluso', 'inclusi')}: usa "includi" nella barra, oppure ${pl(skipped, 'spuntalo', 'spuntali')} a mano.`, 8000);
            if (kept) toast(`${kept} ${pl(kept, 'numero esiste', 'numeri esistono')} gi\u00e0 su questa strada in un altro punto: ${pl(kept, 'va spostato', 'vanno spostati')} a mano, quindi ${pl(kept, 'resta', 'restano')} senza spunta.`, 9000);
            if (over) toast(`${over} ${pl(over, 'civico sta', 'civici stanno')} sulla stessa coordinata di ${pl(over, 'un altro', 'altri')}: ${pl(over, 'va scelto', 'vanno scelti')} a mano, uno per uno, quindi ${pl(over, 'resta', 'restano')} senza spunta.`, 9000);
            ctx.updateGo();
        }));
        return foot;
    }

    // Scelta in blocco sui numeri in forma numero/numero: si includono o si escludono tutti
    // insieme, senza sbloccarli uno per uno. La scelta resta salvata.
    const SUSP_MODES = [
        ['nonins', 'non inserito', 'Predefinito: restano visibili in lista ma senza spunta, quindi non vengono inseriti. Se ne vuoi uno, spuntalo a mano.'],
        ['includi', 'includi', 'Li tratta come civici normali, gi\u00e0 spuntati. Usalo se nella tua zona questa forma \u00e8 reale.'],
        ['escludi', 'escludi', 'Li toglie dalla lista: non li vedi e non li inserisci.']
    ];

    function buildHnSuspBar(shown, ctx) {
        const nSusp = shown.filter(p => isSusp(p.label)).length;
        if (!nSusp) return;
        const bar = document.createElement('div');
        bar.className = 'wfit-muted wfit-hnsuspbar';
        const label = document.createElement('span');
        label.innerHTML = `<b>${nSusp}</b> in forma 20/1:`;
        bar.appendChild(label);

        const applySuspMode = () => {
            const m = settings.suspMode;
            for (const x of ctx.rows) {
                if (!x.p.susp) continue;
                x.row.style.display = (m === 'escludi') ? 'none' : '';
                x.row.classList.toggle('wfit-hnsusp', m !== 'includi');
                x.row.classList.toggle('wfit-hnok', m === 'includi');
                x.cb.checked = (m === 'includi');
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
        if (settings.suspMode !== 'includi') ctx.addLegend('<span class="wfit-swatch wfit-sw-susp"></span> forma 20/1, non inserito');
    }

    // Annota i civici gia' presenti su Waze e toglie loro la spunta
    function annotateExistingHNs(ctx) {
        return loadExistingHNs().then(ex => {
            // si dice sempre su cosa e' stato fatto il confronto: se la via e' lunga e ne hai
            // caricato solo un pezzo, un doppione fuori vista lo script non puo' vederlo
            if (ctx.scan) {
                ctx.scan.textContent = lastHNScan.hn
                    ? `Confrontati con ${lastHNScan.hn} ${pl(lastHNScan.hn, 'civico gi\u00e0 su Waze', 'civici gi\u00e0 su Waze')} su ${lastHNScan.segs} ${pl(lastHNScan.segs, 'segmento', 'segmenti')} di questa via caricati nell'editor.`
                    : `Nessun civico gi\u00e0 su Waze sui ${lastHNScan.segs} ${pl(lastHNScan.segs, 'segmento', 'segmenti')} di questa via caricati nell'editor.`;
                ctx.scan.title = 'Il controllo dei doppioni guarda TUTTI i segmenti della stessa via caricati nell\'editor, non solo quelli che hai in lista: '
                    + 'cosi\' trova il civico anche se sta cento metri piu\' avanti. Quello che l\'editor non ha ancora caricato per\u00f2 non si vede: '
                    + 'se la via \u00e8 lunga, prima di aprire l\'elenco allarga la vista sulla strada intera.';
                ctx.scan.style.display = '';
            }
            if (!ex.length) return;
            let marked = 0, moved = 0;
            for (const x of ctx.rows) {
                if (x.p.manual) continue;
                const label = normHn(x.inp.value) || x.p.label;
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
            if (marked) ctx.addLegend('<span class="wfit-swatch wfit-sw-waze"></span> gi\u00e0 su Waze');
            if (moved) {
                ctx.addLegend('<span class="wfit-swatch wfit-sw-moved"></span> gi\u00e0 su Waze, posizionato male');
                log(`civici gia' presenti sulla via ma lontani dal punto ANNCSU: ${moved} (non inseriti)`);
            }
            if (marked || moved) ctx.updateGo();
        }).catch(() => { /* niente annotazioni */ });
    }

    // Passo di controllo: l'utente vede, verifica e SCEGLIE i civici prima dell'inserimento
    function toggleHnReview(card, r) {
        const oldBox = card.querySelector('.wfit-hnrev');
        if (oldBox) { oldBox.remove(); return; }
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
        annotateExistingHNs(ctx);
    }

    // Il WME rifiuta i civici su segmenti "proiettati", cioe' in stato transitorio
    const isProjectedError = m => /projected|not allowed to add a house number/i.test(m);
    const errText = e => String((e && e.message) || 'errore');

    // Firma documentata: { houseNumber, point }; ripiego { number, point }.
    // La prima che funziona vale per tutto il lotto: si sceglie una volta sola.
    function makeHouseNumberAdder(HN) {
        const shapes = [
            (num, pt) => HN.addHouseNumber({ houseNumber: num, point: { type: 'Point', coordinates: pt } }),
            (num, pt) => HN.addHouseNumber({ number: num, point: { type: 'Point', coordinates: pt } })
        ];
        let shape = -1;
        const add = (num, pt) => {
            if (shape >= 0) { shapes[shape](num, pt); return; }
            for (let i = 0; i < shapes.length; i++) {
                try { shapes[i](num, pt); shape = i; return; }
                catch (e) {
                    if (i < shapes.length - 1 && /invalid argument/i.test(errText(e))) continue;
                    throw e;
                }
            }
        };
        add.usedShape = () => shape;
        return add;
    }

    // Inserisce l'elenco confermato, tenendo da parte i rifiuti da "segmento proiettato"
    async function insertHouseNumbers(list, addOne, existing, tally, rec) {
        const one = p => {
            if (findExistingHN(existing, p.label, p.lon, p.lat)) { tally.dup++; rec(p, 'gia_presente', 'civico gia\' su Waze'); return; }
            // rete di sicurezza: se l'elenco non ha fatto in tempo ad annotarlo (o l'annotazione
            // e' fallita), qui il doppione lontano viene comunque fermato. Passa solo quello
            // che l'utente ha confermato consapevolmente nella finestra di avviso.
            if (!p.far) {
                const far = findMisplacedHN(existing, p.label, p.lon, p.lat);
                if (far) {
                    tally.moved++;
                    rec(p, 'non_inserito', `civico gia' su questa strada a ~${Math.round(far.d)} m: va spostato, non aggiunto`);
                    return;
                }
            }
            try { addOne(p.label, [p.lon, p.lat]); tally.ok++; if (p.stack) tally.stacked++; rec(p, 'inserito', ''); return; }
            catch (e) {
                const m = errText(e);
                if (isProjectedError(m)) { tally.projFails.push(p); return; }
                // alcune installazioni rifiutano la barra: si ritenta con "18B" al posto di "18/B"
                if (p.label.includes('/') && /invalid|format|number/i.test(m)) {
                    try { addOne(p.label.replace('/', ''), [p.lon, p.lat]); tally.ok++; rec(p, 'inserito', 'numero scritto senza barra'); return; }
                    catch (e2) {
                        const m2 = errText(e2);
                        if (isProjectedError(m2)) tally.projFails.push(p);
                        else { bump(tally.reasons, niceReason(m2)); rec(p, 'errore', niceReason(m2)); }
                        return;
                    }
                }
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
            try { addOne(p.label, [p.lon, p.lat]); tally.ok++; rec(p, 'inserito', 'riuscito al secondo tentativo'); }
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
        if (!segs) return null;
        const cosLat = Math.cos(lat * Math.PI / 180);
        let bestD = Infinity, bestId = null;
        for (const s of segs) {
            let inBox = false;
            for (const q of s.c) { if (Math.abs(q[0] - lon) < 0.003 && Math.abs(q[1] - lat) < 0.002) { inBox = true; break; } }
            if (!inBox) continue;
            const d = distPointToPolyline(lon, lat, s.c, cosLat);
            if (d < bestD) { bestD = d; bestId = s.id; }
        }
        return bestId;
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
            if (tally.ok) log(`house number inseriti con firma #${addOne.usedShape()}`);
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
                const a = seg.alternateStreetIds || seg.streetIds;
                if (Array.isArray(a)) alts = a.slice();
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
        try {
            if (pn == null || alts == null) {
                const s = WME().model.segments.getObjectById(id);
                const a = s && (s.attributes || s);
                if (a) {
                    if (pn == null && a.primaryStreetID != null) pn = a.primaryStreetID;
                    if (alts == null && Array.isArray(a.streetIDs)) alts = a.streetIDs.slice();
                }
            }
        } catch { /* pazienza */ }
        return { pn, alts };
    }

    // Etichetta leggibile "Nome, Comune" di una via (per il dialogo di conferma)
    function cityNameById(cid) {
        try {
            const C = sdk.DataModel.Cities;
            if (C && typeof C.getById === 'function') { const c = C.getById({ cityId: cid }); if (c && c.name) return c.name; }
        } catch { /* sotto */ }
        try {
            const c = WME().model.cities.getObjectById(cid);
            if (c) return (c.attributes && c.attributes.name) || '';
        } catch { /* niente */ }
        return '';
    }
    function streetLabel(id) {
        try {
            const S = sdk.DataModel.Streets;
            if (S && typeof S.getById === 'function') {
                const s = S.getById({ streetId: id });
                if (s) { const c = cityNameById(s.cityId); return (s.name || '(senza nome)') + (c ? ', ' + c : ''); }
            }
        } catch { /* sotto */ }
        try {
            const W = WME();
            const s = W.model.streets.getObjectById(id);
            if (s) {
                const a = s.attributes || s;
                let cn = '';
                try { const c = W.model.cities.getObjectById(a.cityID); cn = (c && c.attributes && c.attributes.name) || ''; } catch { /* vuoto */ }
                return (a.name || '(senza nome)') + (cn ? ', ' + cn : '');
            }
        } catch { /* niente */ }
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
        return firstOk(
            () => (sdk.State && typeof sdk.State.getUserInfo === 'function') ? pick(sdk.State.getUserInfo(), 'rank') : null,
            () => {
                const W = WME();
                const u = W.loginManager && W.loginManager.user;
                if (!u) return null;
                const r = pick(u, 'rank') != null ? pick(u, 'rank') : pick(u.attributes, 'rank');
                if (r != null) return r;
                return typeof u.getRank === 'function' ? u.getRank() : null;
            }
        );
    }

    // Lock effettivo del segmento (manuale se presente, altrimenti automatico)
    function segEffLock(id) {
        return firstOk(
            () => pick(sdk.DataModel.Segments.getById({ segmentId: id }), 'lockRank', 'rank'),
            () => {
                const s = WME().model.segments.getObjectById(id);
                return pick(s && (s.attributes || s), 'lockRank', 'rank');
            }
        );
    }

    // Le due vie da usare secondo la modalita' scelta: fuori dal centro abitato il nome primario
    // va sulla citta' vuota ("Nessuno") e quello alternativo sulla citta' vera.
    function resolveApplyStreets(streetName, cityName, extra) {
        const city = resolveCity(cityName);
        if (!city) throw new Error(`comune "${cityName}" non risolvibile via SDK (impostalo una volta a mano su un segmento vicino)`);
        if (!extra) return { pnStreet: getOrAddStreet(streetName, city.id), anStreet: null };
        const emptyCity = resolveEmptyCity();
        if (!emptyCity) throw new Error('citt\u00e0 vuota ("Nessuno") non trovata nel modello: apri/aggiungi in zona un segmento senza citt\u00e0 e riprova');
        return {
            pnStreet: getOrAddStreet(streetName, emptyCity.id),
            anStreet: getOrAddStreet(streetName, city.id)
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
            `OK = rimuovili e riallinea tutto (PN/AN come impostato)\n` +
            `Annulla = mantienili (lo script aggiunge senza togliere)`);
    }

    const applyFailReason = m => /lock|rank|permission|not allowed|consentit/i.test(m)
        ? 'segmento bloccato o permessi insufficienti (serve un unlock)' : m;

    // Applica SOLO cio' che manca a un segmento, poi VERIFICA che il WME abbia registrato davvero:
    // se la prima strategia non lascia il segmento come voluto si prova l'altra; se anche quella
    // fallisce il segmento finisce fra i falliti (niente successi fantasma).
    // Restituisce 'ok', 'notloaded', oppure il motivo del fallimento.
    function makeSegmentApplier(plan) {
        const { pnStreet, anStreet, targetAlts, staleOf, cleanMode, tally } = plan;
        return async id => {
            let seg = null;
            try { seg = sdk.DataModel.Segments.getById({ segmentId: id }); } catch { /* sotto */ }
            if (!seg) return 'notloaded';

            const st = segAddressState(id);
            const known = Array.isArray(st.alts);
            const stale = staleOf(st);
            const needPn = !sameId(st.pn, pnStreet.id);
            const anPresent = anStreet && known && st.alts.some(a => sameId(a, anStreet.id));
            const needAn = !!anStreet && !anPresent;
            const needClean = cleanMode && stale.length > 0;
            if (!needPn && !needAn && !needClean) { tally.skipped++; return 'ok'; }

            const wantAlts = known
                ? (needClean ? [...new Set(targetAlts)] : [...new Set([...st.alts, ...targetAlts])])
                : null;

            let anViaLegacy = false;
            const strategies = [];
            if (wantAlts) {
                strategies.push(() => {
                    sdk.DataModel.Segments.updateAddress({ segmentId: id, primaryStreetId: pnStreet.id, alternateStreetIds: wantAlts });
                });
            }
            strategies.push(() => {
                sdk.DataModel.Segments.updateAddress({ segmentId: id, primaryStreetId: pnStreet.id });
                if (needAn) anViaLegacy = legacyAddAlternate(id, anStreet.id);
            });

            let lastErr = null, lastNow = null;
            for (const run of strategies) {
                anViaLegacy = false;
                try { run(); } catch (e) { lastErr = e; continue; }
                await tick(); // un respiro: il modello deve digerire la modifica prima della verifica
                // verifica: com'e' DAVVERO il segmento adesso? (confronto tollerante sugli ID)
                const now = segAddressState(id);
                lastNow = now;
                const pnOk = sameId(now.pn, pnStreet.id);
                const anNow = !anStreet ? true
                    : (Array.isArray(now.alts) ? now.alts.some(a => sameId(a, anStreet.id)) : anViaLegacy || anPresent);
                if (pnOk && (anNow || !needAn)) {
                    tally.applied++;
                    if (needAn) { if (anNow) tally.anOk++; else tally.anManual++; }
                    if (needClean) {
                        const still = staleOf(now);
                        if (!still.length) tally.cleaned += stale.length;
                        else tally.cleanFailed += still.length;
                    }
                    return 'ok';
                }
                lastErr = new Error('il WME non ha registrato la modifica come richiesto');
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

    function applySummary(tally, failReasons, extra, streetName, cityName) {
        let msg = extra
            ? `PN "${streetName}" (citt\u00e0: Nessuno): ${tally.applied} ${pl(tally.applied, 'modificato', 'modificati')}`
            : `"${streetName}" (${cityName}): ${tally.applied} ${pl(tally.applied, 'modificato', 'modificati')}`;
        if (tally.skipped) msg += ` \u00b7 gi\u00e0 a posto (nessuna modifica): ${tally.skipped}`;
        if (tally.cleaned) msg += ` \u00b7 riallineati: ${tally.cleaned} ${pl(tally.cleaned, 'alternativo non conforme rimosso', 'alternativi non conformi rimossi')}`;
        if (tally.cleanFailed) msg += ` \u00b7 ${tally.cleanFailed} ${pl(tally.cleanFailed, 'alternativo non rimovibile', 'alternativi non rimovibili')} via SDK: toglili a mano`;
        if (extra && tally.anOk) msg += ` \u00b7 AN "${streetName}, ${cityName}" ${pl(tally.anOk, 'aggiunto', 'aggiunti')}: ${tally.anOk}`;
        if (extra && tally.anManual) msg += ` \u00b7 AN da aggiungere a mano: ${tally.anManual}`;
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
        suppressUntil = Date.now() + 2500;
        const extra = settings.applyMode !== 'urb';
        beginBusy();
        try {
            const { pnStreet, anStreet } = resolveApplyStreets(streetName, cityName, extra);
            const targetAlts = anStreet ? [anStreet.id] : [];
            // alternativi presenti che non rientrano nelle scelte dello script
            const staleOf = st => Array.isArray(st.alts)
                ? st.alts.filter(a => !sameId(a, pnStreet.id) && !targetAlts.some(t => sameId(t, a)))
                : [];

            const tally = { applied: 0, skipped: 0, anOk: 0, anManual: 0, cleaned: 0, cleanFailed: 0 };
            const failReasons = new Map();
            const noteFail = (id, r, verbose = true) => {
                failReasons.set(id, r);
                if (verbose) log('Applica fallito', id, r);
            };
            const tryApply = makeSegmentApplier({
                pnStreet, anStreet, targetAlts, staleOf,
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
                    dopo: extra ? `${streetName} (PN citt\u00e0 Nessuno) + AN ${streetName}, ${cityName}` : `${streetName}, ${cityName}`
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

            let msg = applySummary(tally, failReasons, extra, streetName, cityName);
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

    // La "citta vuota" (Nessuno) del paese in cui si sta editando
    function resolveEmptyCity() {
        const C = sdk.DataModel.Cities;
        return firstOk(
            () => {
                if (!C || typeof C.getAll !== 'function') return null;
                const c = C.getAll().find(x => x && (x.isEmpty === true || x.name === '' || x.name == null));
                return (c && c.id != null) ? c : null;
            },
            () => {
                const c = WME().model.cities.getObjectArray().find(x => x.attributes && x.attributes.isEmpty);
                return c ? { id: c.attributes.id, isEmpty: true } : null;
            }
        );
    }

    // Nome alternativo con azione legacy quando l'SDK non lo supporta
    function legacyAddAlternate(segmentId, streetId) {
        try {
            const W = WME();
            const req = WREQ();
            if (!W || !req) return false;
            const AddAlt = req('Waze/Action/AddAlternateStreet');
            const seg = W.model.segments.getObjectById(segmentId);
            if (!AddAlt || !seg) return false;
            if ((seg.getAttribute ? seg.getAttribute('streetIDs') : seg.attributes.streetIDs || []).includes(streetId)) return true;
            W.model.actionManager.add(new AddAlt(seg, streetId));
            return true;
        } catch { return false; }
    }

    function resolveCity(cityName) {
        const C = sdk.DataModel.Cities;
        if (!C) return null;
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
        attempts.push(() => (typeof C.getTopCity === 'function') ? C.getTopCity() : null);
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
                contatoreDisponibile: contatoreOk,
                eventoSalvataggioVisto: saveEventSeen
            };
            console.table(d);
            return d;
        };
        // forza l'invio subito, utile per capire se il foglio risponde
        w.wfitInvia = () => { promuoviPending('invio forzato dall\'utente'); return flushLogs(); };
        // ricontrollo immediato di abilitazione e versione minima
        w.wfitControlla = () => { clearAuthCache(); return controllaAbilitazione(); };
    } catch { /* niente console */ }

    // Hook per test automatici fuori dal browser (in WME "module" non esiste: blocco inerte)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { parseItFloat, detectMapping, findZipEntry, zipCsvLines, plainCsvLines, parseIndirToRecord, extractDateFromFilename };
    }

})();