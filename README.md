# WME Fonti Stradali IT

Userscript per il **Waze Map Editor** che confronta i segmenti selezionati con i civici e gli odonimi
ufficiali **ANNCSU** (Archivio Nazionale dei Numeri Civici e delle Strade Urbane – Istat / Agenzia
delle Entrate): evidenzia i segmenti in lista, mostra i civici sulla mappa, compila nome via/contrada,
località, comune e inserisce i numeri civici (esponente compreso: `343/A` diventa `343a`, come vuole Waze).

Nomi e civici seguono le guide della [**Wazeopedia Italia**](https://www.waze.com/discuss/c/wazeopedia/italy-wazeopedia/5205)
(Denominazione delle strade, Numeri civici, Centro abitato & City Boundary) e lo script usa **solo
l'SDK ufficiale del WME**.

Creato da **checcoconf** · dati: ANNCSU, open data con licenza [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.it).

> **Lo script non sostituisce il lavoro dell'editor: lo facilita.** Ogni modifica va verificata con i
> cartelli stradali, i civici reali, la conoscenza del territorio e buon senso. Lo strumento propone,
> la responsabilità di ciò che finisce sulla mappa resta di chi salva.

---

## Indice

1. [Installazione](#1--installazione)
2. [Accessi e abilitazione](#2--accessi-e-abilitazione)
3. [Flusso di lavoro in breve](#3--flusso-di-lavoro-in-breve)
4. [Dati ANNCSU](#4--dati-anncsu)
5. [Segmenti (cattura)](#5--segmenti-cattura)
6. [Il Raggio](#6--il-raggio)
7. [Confronta con ANNCSU](#7--confronta-con-anncsu)
8. [Applica i nomi ai segmenti](#8--applica-i-nomi-ai-segmenti)
9. [Inserimento dei numeri civici](#9--inserimento-dei-numeri-civici)
10. [Traccia le vie dell'agro](#10--traccia-le-vie-dellagro)

In fondo: [Se qualcosa non funziona](#se-qualcosa-non-funziona) · [Errori e cosa fare](#errori-e-cosa-fare) · [Note per gli editor](#note-per-gli-editor) · [Licenza](#licenza)

---

## 1 · Installazione

1. Installa [Tampermonkey](https://www.tampermonkey.net/).
2. Clicca qui: **[Installa / Aggiorna lo script](https://github.com/checcoconf/wme-fonti-stradali-it/releases/latest/download/wme-fonti-stradali-it.user.js)**
3. Ricarica il Waze Map Editor: il pannello compare nella scheda **Script** della barra laterale.

Gli aggiornamenti arrivano da soli: Tampermonkey controlla l'ultima release pubblicata. In caso di
dubbio: *Tampermonkey → Utility → Controlla aggiornamenti degli userscript*.

**Requisiti**

| Requisito | Dettaglio |
|---|---|
| Editor | `waze.com/editor` o `beta.waze.com/editor` (SDK WME) |
| Gestore userscript | Tampermonkey (serve `GM_xmlhttpRequest` per scaricare i dataset) |
| Spazio locale | IndexedDB: circa **16 byte per civico**, una regione grande occupa poche decine di MB |
| Abilitazione | l'utente Waze deve essere nell'elenco degli abilitati (vedi sotto) |

---

## 2 · Accessi e abilitazione

Lo script è **riservato agli editor abilitati**. La verifica avviene all'avvio, prima che venga
attivata qualunque funzione: finché non arriva l'OK non si cattura nulla, non si scaricano dati e non
si disegna niente sulla mappa.

**Come funziona il controllo**

1. Alla partenza lo script legge il tuo **nome utente Waze** (dall'SDK, in mancanza dal modello legacy).
2. Interroga il foglio Google degli abilitati tramite un Web App Apps Script, inviando nome utente,
   livello e un identificativo di sessione (l'SDK del WME non espone più l'id numerico dell'utente).
3. Se sei in elenco, il pannello si apre e tutte le funzioni si attivano.
4. Se non lo sei, il pannello mostra **401 Unauthorized** con il tuo nome utente e il motivo, più il
   bottone **"Ho ricevuto l'abilitazione: ricontrolla"** per rifare la verifica al volo.

**Tempi e casi limite**

| Situazione | Comportamento |
|---|---|
| Esito positivo | resta valido **2 ore** in cache locale, poi si richiede di nuovo |
| Editor aperto a lungo | ricontrollo automatico ogni **30 minuti** |
| Abilitazione revocata mentre lavori | chiusura immediata: lista svuotata, civici rimossi dalla mappa, pannello 401 |
| Foglio non raggiungibile | se poco prima eri abilitato si continua per un massimo di **72 ore** di tolleranza; in caso di dubbio non si apre |
| Versione minima imposta dallo sviluppatore | se la tua è più vecchia il pannello mostra **"Aggiornamento necessario"** e blocca tutto finché non aggiorni |

**Per farti abilitare** scrivi ai coordinatori della community italiana di Waze. Il link diretto è nel pannello, in fondo e nella schermata 401.

---

## 3 · Flusso di lavoro in breve

1. **Scarica la tua regione** (una volta sola): i civici ANNCSU restano in cache locale.
2. **Imposta il Raggio** in base al contesto (predefinito 10 m: paese ~10 m, fuori centro abitato 20–30 m).
3. **ALT + clic** sui segmenti: si evidenziano sulla mappa ed entrano in lista. Con **Seleziona tutta la
   via** prendi in un colpo tutti i tronconi caricati della stessa strada.
4. **Confronta con ANNCSU**: per ogni odonimo vedi comune, località, distanza, i civici colorati e come
   è scritta la strada su Waze adesso.
5. Controlla il nome proposto (e gli avvisi sotto la casella), scegli la città se ti viene chiesto,
   **Applica ai segmenti** e **salva**.
6. **+N civici su Waze**: elenco di controllo con spunte. Quelli già su Waze, quelli da fare come RPP e
   quelli che Waze non accetta arrivano senza spunta. Controlla con **Street View**, poi **Inserisci** e
   salva di nuovo.

---

## 4 · Dati ANNCSU

Sezione **Dati ANNCSU** del pannello.

| Comando | Cosa fa |
|---|---|
| **Scarica regione** | scarica il dataset ANNCSU della regione scelta, lo analizza e lo salva in locale (IndexedDB) |
| **Scarica tutte** | scorre tutte e 20 le regioni una dopo l'altra (alcuni minuti e parecchia memoria: te lo chiede prima di partire) |
| **Aggiorna** | riscarica solo le regioni che hai già in locale |
| **Svuota dati** | cancella tutte le regioni salvate e riparte da zero |

Durante uno scarico multiplo il bottone diventa **Ferma**: il ciclo si interrompe alla fine della
regione in corso, senza lasciare dati a metà.

**Freschezza dei dati.** ANNCSU aggiorna i dataset regionali con **cadenza mensile**, e in questo
periodo i Comuni stanno completando la georeferenziazione dei civici: un giro ogni **4–6 settimane**
può far comparire strade e numeri prima assenti. Il pannello scrive sempre da quanti giorni hai
scaricato ogni regione e, superati i **35 giorni**, il bottone *Aggiorna* si accende di verde. È solo
un promemoria: **lo script non riscarica mai da solo**.

**Controlli automatici sulla qualità.** Al termine dell'analisi lo script verifica la colonna
`ESPONENTE`: se più della metà dei civici risulta averne uno, quasi certamente si sta leggendo la
colonna sbagliata (un progressivo, un codice interno) e il pannello ti avvisa in arancione. Stesso
avviso se la cache proviene da una versione precedente dello script, nel qual caso gli esponenti
possono mancare: basta ripremere *Scarica regione* per rigenerarla.

**Elenco comuni.** I codici Belfiore vengono tradotti in nomi di comune con l'elenco ISTAT di
`data/comuni.json`, che Tampermonkey scarica insieme allo script: funziona anche offline.

---

## 5 · Segmenti (cattura)

### Modalità di cattura

Menu **Cattura**:

| Modalità | Come si usa |
|---|---|
| **⌥ ALT + clic** *(predefinita)* | tieni ALT e clicca il segmento |
| **⌥⇧ ALT + MAIUSC + clic** | alternativa se ALT ti serve per altro |
| **⌃/⌘⌥ CTRL + ALT + clic** | idem, su combinazione ancora più libera |
| **⌨ Un tasto a tua scelta + clic** | vedi sotto |
| **Spenta** | nessuna cattura al clic: usi solo *Aggiungi selezione attuale* |

MAIUSC e CTRL **da soli** non sono selezionabili di proposito: il WME li usa per la multi-selezione.
Se l'SDK lo consente, la scorciatoia **A + C** cicla al volo fra le modalità.

**Tasto personalizzato.** Scegli *Un tasto a tua scelta*: compare un riquadro rosso "cliccami per
attivare l'ascolto del tasto". Cliccalo e premi **un solo tasto**; il tasto letto resta in attesa di
conferma (**Conferma** salva, **Rifai** riapre l'ascolto, **ESC** annulla, **Azzera** torna ad ALT).
Resta salvato anche nelle sessioni successive. Mentre lo tieni premuto lo script blocca l'eventuale
scorciatoia WME sullo stesso tasto, ma conviene comunque sceglierne uno poco usato: i tasti singoli
sono la fascia che WME, Toolbox e gli altri script si contendono.

> **Lavora per tratti brevi.** Cattura i segmenti che stai davvero guardando, non tutta la via in un
> colpo: il nome sui cartelli può cambiare da un tratto all'altro, e il confronto con i civici già su
> Waze vale solo su ciò che l'editor ha caricato.

### La lista dei segmenti

I segmenti catturati compaiono come **chip** sotto il menu:

- clic sul chip → lo seleziona nell'editor;
- clic sulla **×** (o ri-clic sul segmento con il modificatore) → lo toglie dalla lista;
- **chip rosso** → su quel segmento l'ultimo *Applica* è fallito;
- **Aggiungi selezione attuale** → mette in lista i segmenti selezionati nell'editor. Comodo dopo una
  multi-selezione o dopo aver cliccato una via nel [tracciato dell'agro](#10--traccia-le-vie-dellagro);
- **Svuota lista** → azzera tutto (risultati e civici sulla mappa si riallineano da soli).

### Le altre opzioni

| Opzione | Cosa fa |
|---|---|
| **Evidenzia** | colore del tratteggio con cui i segmenti in lista vengono marcati sulla mappa (ciano, fucsia, giallo, lime, arancione) |
| **Raggio (m)** | distanza massima civico–segmento per il confronto → [Il Raggio](#6--il-raggio) |
| **Formato Waze** | scrive il nome con maiuscole e minuscole all'italiana (`VIA MARGHERITA DI SAVOIA` → `Via Margherita di Savoia`). Spegnendola resta il maiuscolo di ANNCSU, ma le altre correzioni (sigle, date, abbreviazioni) valgono comunque |
| **Auto-analisi** | il confronto riparte da solo a ogni modifica della lista |
| **Civici sulla mappa** | disegna i punti ANNCSU etichettati col numero (343, 343/A…), colorati per odonimo |
| **Pallini** | dimensione dei punti e dei numeri disegnati sulla mappa: *Piccoli*, *Normali* (predefinito), *Grandi*, *Molto grandi*, *Enormi*. Comodo su schermi grandi o quando i civici sono fitti; non cambia nulla di ciò che finisce su Waze. Compare solo con *Civici sulla mappa* attivo |
| **Applica come** | regola di scrittura dell'indirizzo → [Applica](#8--applica-i-nomi-ai-segmenti) |

---

## 6 · Il Raggio

Il **Raggio** è la distanza massima, in metri, entro cui un civico ANNCSU viene considerato
"appartenente" ai segmenti che hai in lista. È la variabile che determina la corrispondenza fra
numerazione civica e segmento selezionato: **più il valore tende verso lo zero, più l'accuratezza è
precisa**.

Il campo parte da **10 m** e accetta valori da **1 a 50 m**: oltre i 45 m Waze rifiuta i civici, quindi
un raggio più largo gonfierebbe solo i risultati. Il valore giusto si trova partendo stretti e
allargando poco per volta, non il contrario.

### Come lo usa lo script

Per ogni segmento in lista lo script cerca i civici ANNCSU entro il raggio, misurando la distanza dalla
**linea del segmento** (non dal centro né dai vertici). Li raggruppa per odonimo e tiene una sola volta
il civico agganciato da più tronconi della stessa via. Restano al massimo **8 odonimi**, ordinati per
distanza, ciascuno col suo colore.

### Valori consigliati

| Contesto | Raggio | Perché |
|---|---|---|
| **Strada di paese / centro abitato** | **~10 m** | i segmenti sono corti e le vie parallele sono vicine: un raggio stretto evita di agganciare i civici della via accanto |
| **Fuori dal centro abitato / contrade** | **~20–30 m** | i segmenti sono molto più lunghi, gli edifici arretrati dalla strada e non tutti i civici sono inseriti dall'ente comunale |
| **Ricognizione iniziale** | fino a 50 m | utile solo per capire *quali* odonimi insistono sulla zona, mai per applicare o inserire |

Il valore predefinito è **10 m**: buono per la stragrande maggioranza delle strade di paese e di città.

**Due limiti da tenere a mente**

- **Sotto i ~10 m si rischia di perdere civici legittimi.** I punti ANNCSU stanno sugli edifici e
  sugli ingressi, non sull'asse stradale: spesso sono a 5–20 m dalla mezzeria. Un raggio troppo
  stretto taglia fuori numeri veri, soprattutto dove la carreggiata è larga o c'è un marciapiede
  ampio.
- **Oltre i 45 m i civici non si possono inserire.** Waze li rifiuta, quindi anche col raggio a 50 m
  quelli più lontani restano fuori dall'elenco di inserimento (te lo scrive).

### ✅ Raggio configurato bene

**Situazione civica in una strada di paese — raggio consigliato: ~10 metri**

![Raggio 10 m: solo i civici della via selezionata](docs/img/raggio-ok-10m.png)

Il confronto aggancia **77 civici**, tutti effettivamente appartenenti al segmento su cui si sta
lavorando. La numerazione è leggibile, coerente e pronta da applicare.

### ❌ Raggio configurato male

**Stesso segmento, raggio 100 metri**

![Raggio 100 m: civici di mezzo paese sopra il segmento](docs/img/raggio-ko-100m.png)

Il confronto aggancia **110 civici** allo stesso odonimo e riempie la mappa con i punti di tutte le
vie limitrofe: otto odonimi diversi, numerazioni sovrapposte, impossibile capire quale numero
appartiene a quale strada. Applicare o inserire in queste condizioni significa sporcare la mappa.

> **Regola pratica:** parti stretto e allarga solo se mancano civici che vedi sul territorio. Se la
> lista dei risultati contiene odonimi che non c'entrano nulla con il segmento selezionato, il raggio
> è troppo largo.

---

## 7 · Confronta con ANNCSU

Con **Auto-analisi** attiva il confronto parte da solo a ogni cattura; altrimenti premi
**🔍 Confronta con ANNCSU**.

Per ogni odonimo trovato compare una scheda con:

- il **nome originale ANNCSU** (in maiuscolo, come nell'archivio);
- una **casella modificabile** con il nome già pronto per Waze;
- **Comune**, **Località/contrada**, **distanza minima** dal segmento, **numero di civici distinti** e
  la **data del dataset** ANNCSU da cui provengono;
- il **pallino colorato** che corrisponde ai punti disegnati sulla mappa;
- la spunta **✓ nome principale già così su N di M segmenti** quando su Waze c'è già il nome proposto;
- i bottoni **Copia**, **Applica ai segmenti**, **+N civici su Waze**.

In testa ai risultati la riga **Su Waze ora** dice come sono scritti adesso i segmenti in lista
(es. `Via Roma, Andria (4) · (senza strada) (1)`), così vedi subito se c'è qualcosa da fare.

Sotto la casella possono comparire:

- **avvisi in arancione** quando c'è qualcosa che solo tu puoi decidere (per esempio `S.` o `SS.`: San,
  Santa, Santo, Santi o Santissima?);
- per le **strade con sigla**, come verrà divisa fra nome principale e alternativi;
- il menu **Città** quando ANNCSU indica una località diversa dal comune: puoi scegliere fra il comune
  e la forma per le frazioni, `frazione, comune` (es. `Miramare, Rimini`). La località
  ANNCSU non è sempre una frazione: decidi guardando i cartelli di inizio centro abitato.

### Il nome proposto

Nella casella trovi il nome già scritto come lo vuole Waze Italia: maiuscole e minuscole a posto,
accenti, sigle (`SP20bis`), date in numeri arabi (`Via 4 Novembre`), ordinali con l'apice (`2ª Traversa`),
abbreviazioni sciolte (`Mons.` → `Monsignor`). Le lettere puntate di nome proprio vengono tolte, perché
il navigatore non le legge.

Resta modificabile: quello che scrivi tu vince sempre.

Quando lo script non può decidere da solo compare un **avviso arancione** sotto la casella. Il caso
tipico è `S.` o `SS.`: solo tu sai se è San, Santa, Santo, Santi o Santissima, quindi scrivilo per
esteso prima di applicare.

Se la strada ha una **sigla** (SS, SR, SP, NSA, autostrada), una riga ti dice cosa finirà nel nome
principale e cosa negli alternativi.

Se ANNCSU indica una **località** diversa dal comune compare il menu **Città**, per scegliere fra il
comune e la forma `frazione, comune`. La località ANNCSU non è sempre una frazione: decidi guardando i
cartelli di inizio centro abitato.

Le liste usate per i nomi (abbreviazioni, preposizioni, cognomi con particella) stanno in
`data/odonimi.json`: si correggono lì, senza toccare lo script.

**Il nome si impara.** Se correggi il nome proposto (per esempio da `Strada Contrada Fontanelle` a
`Contrada Fontanelle`) lo script memorizza la regola e precompila così anche le schede successive. Per
questo caso classico c'è pure il link rapido *usa "Contrada…"*.

**Civici ripetuti.** Se lo stesso numero compare su più record ANNCSU distinti, un avviso in testa ai
risultati te lo dice: sono mostrati tutti, ma nell'elenco di inserimento arrivano senza spunta.

---

## 8 · Applica i nomi ai segmenti

### Le due modalità

| Modalità | Cosa scrive |
|---|---|
| **Dentro il centro abitato** | Nome primario = via **con** città |
| **Fuori centro abitato** *(regola IT)* | Nome primario = via con città **"Nessuno"** + nome alternativo = via **con** città + **obbligo fari accesi** |

Scegli la modalità **prima** di premere Applica: è la casella *Applica come* nel pannello.

Con una strada che ha una **sigla** (SS, SR, SP, NSA, autostrade) lo script mette da solo la sigla nel
nome principale e il nome esteso negli alternativi. Nella scheda vedi in anticipo come verrà scritta.

### Cosa fa esattamente *Applica ai segmenti*

- Tocca **solo ciò che differisce**: i segmenti già a posto vengono saltati e conteggiati a parte.
- **Preserva gli alternativi esistenti**: aggiunge senza togliere, e verifica che nessuno sparisca.
- Se trova alternativi **non conformi** alle impostazioni, li elenca in una finestra di conferma e li
  rimuove **solo se dai l'OK**; altrimenti li lascia dove sono. Le sigle non finiscono mai in
  quell'elenco. Leggi la finestra prima di confermare: fra gli alternativi possono esserci nomi locali
  o, nelle regioni bilingui, il nome nella seconda lingua.
- **Fuori dal centro abitato** imposta anche l'attributo **obbligo accensione dei fari**.
- **Rampe** e segmenti **non carrabili** non vengono toccati.
- In **modalità snapshot**, **modalità pratica** o con l'editor in sola lettura non scrive niente.
- Dopo ogni scrittura **rilegge il segmento** per verificare che la modifica sia passata davvero: se
  non passa, il segmento finisce fra i falliti (niente successi fantasma).
- I segmenti **fuori dall'area caricata** vengono recuperati spostando la mappa uno per uno.
- Alla fine il riepilogo dice quanti modificati, quanti già a posto, quanti alternativi riallineati e
  quanti falliti, con il motivo.

Poi **salva** (Ctrl+S).

---

## 9 · Inserimento dei numeri civici

Il bottone **+N civici su Waze** apre l'**elenco di controllo**: nulla viene scritto sulla mappa
finché non confermi.

**Prerequisiti:** una strada **con nome** e **nessuna modifica pendente** (il WME vieta di aggiungere
civici su segmenti modificati). Se manca qualcosa, lo script te lo dice prima.

Nella casella il numero è già nel formato che Waze accetta: `343/A` di ANNCSU diventa `343a`. Quelli
che Waze non accetta (`20/1`, `12/BIS`) restano in lista ma senza spunta, e vanno inseriti a mano.

Ogni civico viene agganciato al segmento **della sua via** più vicino, così un civico d'angolo non
finisce sulla traversa.

### Cosa vedi nell'elenco

| Elemento | Significato |
|---|---|
| **Spunta** | il civico verrà inserito |
| **Numero modificabile** | già nel formato Waze; si normalizza da solo: `18/B`, `18 B` → `18b` |
| **Distanza** | quanto dista il punto ANNCSU dal segmento |
| Riga con bordo **azzurro** | **già su Waze**: esiste un civico con lo stesso numero entro 40 m → spunta tolta |
| Riga con bordo **arancione** | **già su Waze ma posizionato male**: il numero esiste su questa strada, ma a più di 40 m dal punto ANNCSU → spunta tolta, va **spostato** non aggiunto (vedi sotto) |
| Riga con bordo **giallo** | **ripetizione**: lo stesso numero su un altro record ANNCSU → spunta tolta, decidi tu |
| Riga con bordo **viola** | **civici sovrapposti**: due o più punti sulla stessa identica coordinata (meno di 1,5 m) → tutto il gruppo senza spunta, scegli tu quali inserire e poi vanno spostati (vedi sotto) |
| Riga con bordo **ocra** | **lato o sequenza insoliti**: un dispari in mezzo ai pari (o viceversa), o un numero fuori ordine lungo la via → spunta tolta. Sono i due errori che Waze contesta al salvataggio (*lato errato*, *fuori sequenza*): controlla su Street View; se il civico è giusto spuntalo e al salvataggio va **forzato** |
| Riga con bordo **verde acqua** | **accesso su un'altra via**: il punto ANNCSU è più vicino a un'altra strada con nome che alla sua → spunta tolta; se l'ingresso è davvero lì serve un **luogo residenziale (RPP)**, non un civico |
| Riga azzurra *già su Waze come RPP* | su questa via esiste già un luogo residenziale con quel numero: non va aggiunto anche come civico |
| Riga con bordo **rosso** | numero in un **formato che Waze non accetta** (`20/1`, `12/BIS`) → vedi sotto |
| Riga esclusa | oltre **45 m** dalla strada: Waze la rifiuterebbe, va inserita a mano |

Un clic sulla riga **centra la mappa** su quel civico; il bottone con l'**occhio** apre direttamente **Street View**
su quel punto. Al contrario, un clic su un **pallino sulla mappa** evidenzia la sua riga nell'elenco.

**RPP** è il *Residential Point Place*: un Place residenziale con via e numero civico, e il punto di
arrivo sull'ingresso. Serve quando l'ingresso è su una strada diversa da quella dell'indirizzo
(controviali, case con accesso laterale). Lo stesso indirizzo non va messo sia come RPP sia come civico
normale.

### Creare un RPP

Il bottone **RPP** compare **solo sulle righe verde acqua**, quelle in cui l'accesso sembra su un'altra
via: sui civici normali non serve e non c'è. Premendolo lo script chiede conferma e poi crea:

- un **Place residenziale** nel punto del civico ANNCSU;
- **via e numero civico** dell'indirizzo (la via dell'odonimo, non quella dell'accesso);
- il **punto di arrivo** sulla strada dell'accesso, nel punto più vicino al civico.

La riga esce dall'elenco dei civici da inserire, perché lo stesso indirizzo non va messo due volte.
Il Place resta da controllare: guarda punto e indirizzo nel pannello del Place, poi **salva tu** con
Ctrl+S. Se il tuo editor non espone i metodi per i Place, il bottone non compare.

### Come vengono trovati i civici già presenti

Sotto la legenda una riga dice **su quanti civici già su Waze è stato fatto il confronto**.

Se al suo posto compare un **avviso rosso**, vuol dire che su quella via dei civici ci sono, ma l'editor
non li ha caricati e quindi lo script non può sapere quali numeri esistono già. Succede quando sei
troppo lontano, perché il WME i civici li carica solo da vicino. Avvicinati sul tratto che stai
lavorando e riapri l'elenco. Se vai avanti lo stesso, controlla tu sulla mappa: i doppioni verrebbero
rifiutati al salvataggio.

**Un numero già presente su questa via non viene mai inserito**, nemmeno se spunti la riga a mano. Se
quello sulla mappa è messo male, la cosa giusta è **trascinarlo** sul punto corretto.


Il confronto non guarda solo i segmenti che hai in lista: legge i civici di **tutti i tronconi della
stessa via caricati nell'editor**. Serve perché un civico già presente spesso non sta sul pezzo che hai
catturato, ma cento metri più avanti.

Il limite è che si vede solo ciò che l'editor ha **caricato in quel momento**. Per questo conviene
lavorare per tratti brevi, da vicino, sul pezzo di strada che stai guardando: così il confronto è
sempre valido. La riga sotto la legenda ti dice comunque su quanti segmenti è stato fatto.

### Civici già presenti ma posizionati male

Capita spesso: il civico `5` è già sulla mappa, ma qualcuno l'ha piazzato in fondo alla via, sul lato
sbagliato o addirittura su un altro edificio. Il punto ANNCSU dice un'altra cosa e i due non si toccano.

Il controllo sui civici già presenti è doppio:

1. **stesso numero entro 40 m** → *già su Waze*, riga azzurra: non c'è niente da fare;
2. **stesso numero sulla stessa strada ma oltre 40 m** → *già su Waze ma posizionato male*, riga
   arancione con la distanza (`già su Waze ma a ~120 m: da spostare, non da aggiungere`).

Il controllo guarda **solo i civici della stessa via** (segmenti in lista e altri tronconi caricati
con la stessa strada): un `5` di una via vicina non fa scattare nulla.

**Cosa fare:** apri il civico che c'è già e **trascinalo** sul punto corretto. È l'unica strada giusta:
Waze accetta **un solo punto per numero** sulla stessa via, quindi aggiungerne un secondo non
correggerebbe niente.

La riga arriva senza spunta, il link *tutti* non la seleziona e, se la spunti comunque, prima di
inserire lo script apre una finestra di conferma con l'elenco dei numeri interessati e la distanza. La
scelta resta tua, ma consapevole. Nel riepilogo finale i civici fermati per questo motivo sono contati
a parte.

### Civici sovrapposti (stessa coordinata)

Capita che due o più accessi ANNCSU cadano **sulla stessa identica coordinata**: numeri diversi sullo
stesso ingresso, portone e passo carrabile rilevati nel medesimo punto, oppure semplici doppie righe
d'archivio. Sulla mappa le etichette si stampano una sopra l'altra e diventano illeggibili (`52` e
`52/A` che si accavallano in un unico blocco nero), e su Waze due civici sovrapposti restano comunque
un errore.

Lo script raggruppa i civici che distano **meno di 1,5 m** fra loro e li presenta così:

- riga **viola**, con la nota `N civici sulla stessa coordinata: scegli quelli veri, poi vanno spostati`;
- **tutto il gruppo arriva senza spunta**, nessuno viene inserito di iniziativa dello script;
- il link *tutti* non li seleziona, per lo stesso motivo;
- puoi spuntarne **uno, alcuni o tutti**: la scelta è libera, lo script non decide al posto tuo;
- se ne spunti più di uno, un avviso ti ricorda che nasceranno sovrapposti;
- al termine dell'inserimento il riepilogo lo ripete, dicendoti quanti civici sono nati sullo stesso
  punto e vanno separati.

> I civici semplicemente **vicini** (due portoni a 4–6 m, normali in centro storico) non finiscono qui:
> restano righe indipendenti e spuntate.

**Cosa fare:** clicca la riga per centrare la mappa sul punto e guarda il posto su Street View.

- Se lì esiste **un solo civico** (gli altri sono doppioni d'archivio), spunta quello e basta.
- Se esistono **davvero più ingressi** ma l'archivio li ha messi tutti sulla stessa coordinata,
  **spuntali tutti**: vengono inseriti in quel punto, uno sopra l'altro, e poi li **trascini** ciascuno
  sul proprio portone. È la via più rapida, perché il numero è già scritto e non lo devi digitare.

In entrambi i casi lo spostamento va fatto **prima di salvare**: due punti sovrapposti sulla mappa
restano illeggibili per chi naviga e possono far scattare i controlli di Waze. In alternativa puoi
inserirne uno solo adesso e creare gli altri con **+ Aggiungi al centro mappa**, dopo aver centrato la
mappa sul portone giusto: nascono già nella posizione corretta.

### Numeri che Waze non accetta (`20/1`, `12/BIS`)

Waze vuole un numero seguito da al massimo due lettere minuscole. Un esponente numerico (`2/4`, spesso
una colonna del CSV letta male) o di più lettere (`BIS`, `TER`) non si può inserire così com'è: la riga
resta senza spunta con l'avviso *formato non accettato da Waze*. Se hai verificato che il numero giusto
è un altro, correggilo nella casella e spuntalo; altrimenti va inserito a mano.

La barra sopra la lista li **mostra** (predefinito) o li **nasconde** tutti insieme; la scelta resta
salvata fra le sessioni.

### Aggiungere un civico letto su Street View

Con **+ Aggiungi al centro mappa**: centra la mappa sul portone, scrivi il numero (es. `18b`) e premi. La riga
nasce lì, già spuntata. Se il centro mappa è a più di 45 m dai segmenti in lista lo script te lo
impedisce, perché Waze lo rifiuterebbe.

### Conferma

**Inserisci** scrive tutti i civici spuntati (senza limite di numero), lavorando a piccoli lotti. Se
hai spuntato lo stesso numero in più punti lo script ti avvisa: Waze ne accetta uno solo per via.
Se hai spuntato a mano un numero già fatto come RPP o con l'accesso su un'altra via, prima di inserire
ti chiede conferma.
Al termine arriva un riepilogo con inseriti, saltati e motivi dei rifiuti. **Poi salva.**

---

## 10 · Traccia le vie dell'agro

Nelle campagne il problema non è scrivere il nome: è **capire quale via è quale**. Le strade sono
lunghe, si incrociano, spesso non hanno nome sulla mappa, e i cartelli non ci sono. Questo bottone
risponde a quella domanda, e solo a quella: **i civici non si vedono e non si inseriscono da qui**, si
lavorano come sempre catturando i segmenti.

> **Serve fuori dai centri abitati.** In paese le vie sono corte, fitte e quasi sempre già a nome: lì
> non aggiunge niente, e con la vista larga si superano subito le **500 strade** del limite. Se lo apri
> in centro abitato, la scheda te lo dice.

Premendolo, lo script prende i civici ANNCSU a schermo, assegna ogni civico al segmento più vicino
(fino a 25 m) e traccia **solo i segmenti che su Waze non hanno nome**, colorandoli secondo la via a cui
appartengono. Le strade già a nome non vengono colorate: quelle non sono lavoro da fare. È in **sola
lettura**: finché non sei tu a chiederlo, non cambia niente sulla mappa.

### Come si usa

**1. Accendi le vie che ti interessano.** All'apertura la mappa resta pulita: nell'elenco, accanto a
ogni via, c'è un **quadratino colorato** che accende o spegne il suo tracciato. Un clic sul quadratino
colora solo quella; un clic sulla **riga** la colora, ci porta sopra la mappa e ne seleziona i segmenti
nell'editor. Sopra l'elenco, *tutte* e *nessuna* per fare in blocco.

Il tracciato acceso mostra il percorso con il nome scritto sopra: così vedi dove comincia e dove
finisce e capisci se è davvero la via che pensavi. **Il colore di una via non cambia** quando sposti la
mappa: è legato alla via, non alla posizione nell'elenco.

**2. Se il nome è giusto, premi Applica.** Scrive quel nome sui segmenti **senza nome** di quella via
(quelli che un nome ce l'hanno non vengono toccati), tutti in un colpo,
con le regole di *Applica come*: dentro il centro abitato il nome principale con la città, fuori il
nome principale senza città più l'alternativo con la città. Prima di scrivere ti chiede conferma, e
vale tutto quello che vale per il bottone *Applica ai segmenti*: verifica segmento per segmento,
rampe escluse, alternativi rispettati.

**3. I civici li fai dopo, come sempre.** Una volta che la via ha il nome, catturi i segmenti con
ALT + clic e usi l'elenco di controllo: è lì che i civici si vedono, si scelgono e si inseriscono.

Ogni riga dice **quale contrada è** secondo ANNCSU, quanti segmenti restano da nominare e su quanti
civici si basa la conclusione. Se altri tronconi della stessa via hanno già un nome, lo trovi in coda
alla riga: è l'indizio più forte per capire di che contrada si tratta.

| In coda alla riga | Significato |
|---|---|
| **✓ N già a nome** | altri tronconi si chiamano già come dice ANNCSU: puoi procedere tranquillo |
| **≠ N già a nome** | altri tronconi hanno un nome **diverso** da ANNCSU: controlla quale dei due è giusto prima di applicare |
| nessuna coda | nessun troncone con nome nei dintorni: fidati dei civici, ma verifica sul posto |

Più civici ci sono, più la conclusione è solida: una via con quaranta civici è quasi certa, una con tre
è un indizio.

La spunta **"nascondi le strade che non posso modificare"** tiene fuori quelle bloccate sopra il tuo
livello.

Quando in una vista non resta niente da nominare, la scheda te lo dice e puoi passare oltre.

**Come si comporta:** all'accensione si porta da solo allo **zoom 16** e poi ti segue mentre giri la
mappa; non usa il **Raggio** del pannello, che vale solo quando scegli tu i segmenti; le vie tracciate
sono a tratto pieno, mentre il **tratteggio** sono i segmenti che hai in lista.

> Quello che vedi è **ANNCSU, non il vangelo**: un odonimo può essere diverso da quello sui cartelli e
> qualche civico può essere fuori posto. Il tracciato ti dice dove guardare, la decisione resta tua.

---

## Se qualcosa non funziona

Quasi tutti i problemi si risolvono con tre mosse:

1. **Salva** (Ctrl+S) e riprova: con modifiche non salvate il WME non accetta nuovi civici.
2. **Avvicinati** sul tratto che stai lavorando e riapri l'elenco: lo script vede solo quello che
   l'editor ha caricato, e i civici già presenti li carica solo da vicino.
3. **Ricarica la pagina** dell'editor.

Quando lo script non riesce a fare una cosa te lo dice a schermo, con il motivo: leggi il messaggio,
spesso contiene già la soluzione. Gli errori più comuni sono elencati [qui sotto](#errori-e-cosa-fare).

Se il problema resta, segnalalo all'autore con il messaggio che hai visto e il permalink della zona.

---

## Errori e cosa fare

| Messaggio | Cosa significa | Cosa fare |
|---|---|---|
| *segmento bloccato o permessi insufficienti* | il segmento ha un lock sopra il tuo livello | chiedi lo **unlock** alla community, poi riprova |
| *strada senza nome* | i civici esistono solo su strade con nome | dai prima il nome alla strada (puoi catturarla con lo script) |
| *già su Waze* | il civico esiste già lì vicino | niente da fare: non viene reinserito |
| *già su Waze ma posizionato male* | il numero esiste su questa strada, ma lontano dal punto ANNCSU | **trascina** il civico esistente sul punto giusto; non aggiungerne un secondo |
| *segmento con modifiche non salvate* | il WME vieta i civici su segmenti modificati | salva con **Ctrl+S**, riapri l'elenco e riconferma |
| *già esistente / duplicate* (in salvataggio) | doppione | elimina il civico in più |
| *lato errato* / *fuori sequenza* | Waze contesta la posizione | ricontrolla i punti; se sono corretti sul territorio usa **Salva → Forza** |
| *troppo lontano dal segmento* | oltre il limite Waze | piazzalo a mano vicino alla strada e trascinalo sul punto reale |
| *fuori dall'area caricata* | segmento non caricato nell'editor | torna sulla zona e ripremi *Applica* |
| *città non risolvibile via SDK* | il comune (o la frazione) non esiste ancora nel modello | impostalo una volta a mano su un segmento vicino |
| *città vuota ("Nessuno") della regione giusta non trovata* | serve per la regola fuori centro abitato | apri o aggiungi in zona un segmento senza città e riprova |
| *rampa: …* | hai catturato una rampa | toglila dalla lista: le rampe non si nominano con ANNCSU |
| *formato non accettato da Waze* | esponente numerico o di più di due lettere | inseriscilo a mano |
| *accesso su …* | l'ingresso sembra su un'altra via | verifica su Street View; se è così usa il bottone **RPP** |
| *sei in modalità snapshot / pratica* | l'editor non salverebbe le modifiche | esci dalla modalità e riprova |
| *Nessun civico ANNCSU entro N m* | raggio troppo stretto o comune non ancora georiferito | allarga il raggio; se resta vuoto, il Comune non ha caricato le coordinate |

---

## Note per gli editor

- Lo script modifica **solo ciò che differisce**, salta ciò che è già a posto e lavora a piccoli lotti:
  **rivedi sempre l'elenco modifiche prima di salvare**.
- I dati ANNCSU sono open data **CC-BY 4.0**: riutilizzabili anche su Waze, purché sia citata la fonte.
- In Italia la georeferenziazione dei civici è ancora in corso: l'assenza di un civico in ANNCSU non significa che non esista sul territorio.
<br> ➡️ [Consulta i miei report automatici mensili sulla banca dati](https://github.com/checcoconf/anncsu-report/releases/latest) </br>

---

## Licenza

Copyright © 2026 **Francesco Conforti** (checcoconf).

Codice: **GPL-3.0-or-later** — vedi [LICENSE](LICENSE) e [NOTICE](NOTICE).

Puoi usarlo, studiarlo, modificarlo e ridistribuirlo. Se lo ridistribuisci modificato devi citare
l'autore, dire che si tratta di una versione modificata e pubblicare il codice con la stessa licenza.
Il nome *WME Fonti Stradali IT* identifica il progetto originale: le versioni derivate ne usino uno
diverso.

Dati: [ANNCSU](https://www.anncsu.gov.it/it/) (Istat / Agenzia delle Entrate), open data con licenza
[CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.it).

Waze e Waze Map Editor sono marchi di Waze Mobile / Google. Progetto indipendente, non affiliato.

💬 Info, idee o problemi? Scrivimi su **Slack**: [`@checcoconf`](https://slack.com/app_redirect?channel=U0BHX22AFHS) (workspace della community italiana Waze).