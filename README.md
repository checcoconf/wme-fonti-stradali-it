# WME Fonti Stradali IT

Userscript per il **Waze Map Editor** che confronta i segmenti con i civici ufficiali
**ANNCSU** (Istat / Agenzia delle Entrate): evidenzia i segmenti in lista, mostra i civici
sulla mappa e compila nome via/contrada, località, comune e numeri civici (con lettera, es. 343/A).

Creato da **checcoconf** · dati: ANNCSU, open data.

## Installazione

1. Installa [Tampermonkey](https://www.tampermonkey.net/).
2. Clicca qui: **[Installa / Aggiorna lo script](https://github.com/checcoconf/wme-fonti-stradali-it/releases/latest/download/wme-fonti-stradali-it.user.js)**

Gli aggiornamenti arrivano da soli: lo script controlla l'ultima release pubblicata.

## Come si usa (in breve)

1. **Scarica la tua regione** (una volta sola): i civici ANNCSU restano in cache locale.
2. **ALT + clic** sui segmenti: si evidenziano sulla mappa ed entrano in lista.
3. **Confronta con ANNCSU**: per ogni odonimo vedi comune, località, distanza e i civici colorati.
4. Correggi il nome nella casella se serve, **Applica ai segmenti** (regola IT fuori centro abitato:
   PN senza città + AN con città) e **salva**.
5. **+N civici su Waze**: elenco di controllo con spunte, numeri modificabili e "già su Waze";
   confermi e lo script inserisce solo i selezionati. Poi salva di nuovo.

La guida completa è nel pannello dello script ("Come funziona").

## Note per gli editor

- Lo script modifica **solo ciò che differisce**, salta ciò che è già a posto e lavora a piccoli
  lotti: **rivedi sempre l'elenco modifiche prima di salvare**.

## Sviluppo e rilasci

- Lo script vive in `wme-fonti-stradali-it.user.js` (root del repo).
- Il versionamento è **manuale**: alza la riga `// @version` nello script (es. `0.0.1` → `0.0.2`)
  e fai push su `main`: la CI pubblica la release `v<versione>`. Se fai push senza alzare la
  versione, non viene pubblicato nulla.
- Il file `.meta.js` è generato dalla CI: **non** va committato.

## Licenza

MIT — vedi [LICENSE](LICENSE).
