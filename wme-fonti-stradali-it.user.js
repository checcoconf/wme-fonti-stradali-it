// ==UserScript==
// @name         WME Fonti Stradali IT
// @namespace    wme-fonti-it
// @version      0.0.4.b
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
// @connect      anncsu.open.agenziaentrate.gov.it
// @connect      www.istat.it
// @connect      istat.it
// @connect      raw.githubusercontent.com
// @run-at       document-end
// @license      MIT
// ==/UserScript==

/* global getWmeSdk, GM_xmlhttpRequest */

(function () {
    'use strict';

    const SCRIPT_ID = 'wme-fonti-it';
    const SCRIPT_NAME = 'WME Fonti Stradali IT';
    const AUTORE = 'checcoconf';
    const VERSION = (typeof GM_info !== 'undefined' && GM_info.script) ? GM_info.script.version : 'dev';
    const STORE_KEY = 'wmeFontiIT_v3';
    const GRID_CELL = 0.004; // ~440 m in latitudine
    const STALE_DAYS = 35; // ANNCSU aggiorna i dataset regionali con cadenza mensile: oltre questa soglia, avviso (mai scarico automatico)
    const ANNCSU_DL = 'https://anncsu.open.agenziaentrate.gov.it/age-inspire/opendata/anncsu/getds.php?INDIR_';
    const ISTAT_COMUNI = 'https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.csv';

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
    const COMUNI_PACK = "A001 Abano Terme|A004 Abbadia Cerreto|A005 Abbadia Lariana|A006 Abbadia San Salvatore|A007 Abbasanta|A008 Abbateggio|A010 Abbiategrasso|M376 Abetone Cutigliano|A013 Abriola|A014 Acate|A015 Accadia|A016 Acceglio|A017 Accettura|A018 Acciano|A019 Accumoli|A020 Acerenza|A023 Acerno|A024 Acerra|A025 Aci Bonaccorsi|A026 Aci Castello|A027 Aci Catena|A029 Aci Sant'Antonio|A028 Acireale|A032 Acquafondata|A033 Acquaformosa|A034 Acquafredda|A035 Acqualagna|A039 Acquanegra Cremonese|A038 Acquanegra sul Chiese|A040 Acquapendente|A041 Acquappesa|A043 Acquaro|A044 Acquasanta Terme|A045 Acquasparta|A050 Acquaviva Collecroce|A051 Acquaviva d'Isernia|A048 Acquaviva delle Fonti|A047 Acquaviva Picena|A049 Acquaviva Platani|M211 Acquedolci|A052 Acqui Terme|A053 Acri|A054 Acuto|A055 Adelfia|A056 Adrano|A057 Adrara San Martino|A058 Adrara San Rocco|A059 Adria|A060 Adro|A061 Affi|A062 Affile|A064 Afragola|A065 Africo|A067 Agazzano|A068 Agerola|A069 Aggius|A070 Agira|A071 Agliana|A072 Agliano Terme|A074 Agliè|H848 Aglientu|A075 Agna|A076 Agnadello|A077 Agnana Calabra|A080 Agnone|A082 Agnosine|A083 Agordo|A084 Agosta|A085 Agra|A087 Agrate Brianza|A088 Agrate Conturbia|A089 Agrigento|A091 Agropoli|A092 Agugliano|A093 Agugliaro|A096 Aicurzio|A097 Aidomaggiore|A098 Aidone|A100 Aielli|A102 Aiello Calabro|A103 Aiello del Friuli|A101 Aiello del Sabato|A105 Aieta|A106 Ailano|A107 Ailoche|A109 Airasca|A110 Airola|A111 Airole|A112 Airuno|A113 Aisone|A116 Ala|A115 Alà dei Sardi|A117 Ala di Stura|A118 Alagna|A119 Alagna Valsesia|A120 Alanno|A121 Alano di Piave|A122 Alassio|A123 Alatri|A124 Alba|A125 Alba Adriatica|A126 Albagiara|A127 Albairate|A128 Albanella|A131 Albano di Lucania|A132 Albano Laziale|A129 Albano Sant'Alessandro|A130 Albano Vercellese|A134 Albaredo Arnaboldi|A137 Albaredo d'Adige|A135 Albaredo per San Marco|A138 Albareto|A139 Albaretto della Torre|A143 Albavilla|A145 Albenga|A146 Albera Ligure|A149 Alberobello|A150 Alberona|A153 Albese con Cassano|A154 Albettone|A155 Albi|A158 Albiano|A157 Albiano d'Ivrea|A159 Albiate|A160 Albidona|A161 Albignasego|A162 Albinea|A163 Albino|A164 Albiolo|A166 Albisola Superiore|A165 Albissola Marina|A167 Albizzate|A171 Albonese|A172 Albosaggia|A173 Albugnano|A175 Albuzzano|A176 Alcamo|A177 Alcara li Fusi|A178 Aldeno|A179 Aldino|A180 Ales|A182 Alessandria|A183 Alessandria del Carretto|A181 Alessandria della Rocca|A184 Alessano|A185 Alezio|A186 Alfano|A187 Alfedena|A188 Alfianello|A189 Alfiano Natta|A191 Alfonsine|A192 Alghero|A193 Algua|A194 Alì|A201 Alì Terme|A195 Alia|A196 Aliano|A197 Alice Bel Colle|A198 Alice Castello|A200 Alife|A202 Alimena|A203 Aliminusa|A204 Allai|A206 Alleghe|A205 Allein|A207 Allerona|A208 Alliste|A210 Allumiere|M397 Alluvioni Piovera|A214 Almè|A216 Almenno San Bartolomeo|A217 Almenno San Salvatore|A218 Almese|A220 Alonte|M375 Alpago|A221 Alpette|A222 Alpignano|A223 Alseno|A224 Alserio|M386 Alta Val Tidone|M383 Alta Valle Intelvi|A225 Altamura|A226 Altare|M349 Altavalle|A228 Altavilla Irpina|A229 Altavilla Milicia|A227 Altavilla Monferrato|A230 Altavilla Silentina|A231 Altavilla Vicentina|A233 Altidona|A234 Altilia|A235 Altino|A236 Altissimo|A237 Altivole|A238 Alto|M369 Alto Reno Terme|M389 Alto Sermenza|A239 Altofonte|A240 Altomonte|A241 Altopascio|M350 Altopiano della Vigolana|A242 Alviano|A243 Alvignano|A244 Alvito|A246 Alzano Lombardo|A245 Alzano Scrivia|A249 Alzate Brianza|A251 Amalfi|A252 Amandola|A253 Amantea|A254 Amaro|A255 Amaroni|A256 Amaseno|A257 Amato|A258 Amatrice|A259 Ambivere|M351 Amblar-Don|A261 Ameglia|A262 Amelia|A263 Amendolara|A264 Ameno|A265 Amorosi|A267 Ampezzo|A268 Anacapri|A269 Anagni|A270 Ancarano|A271 Ancona|A272 Andali|A274 Andalo|A273 Andalo Valtellino|A275 Andezeno|A278 Andora|A280 Andorno Micca|A281 Andrano|A282 Andrate|A283 Andreis|A284 Andretta|A285 Andria|A286 Andriano|A287 Anela|A288 Anfo|A290 Angera|A291 Anghiari|A292 Angiari|A293 Angolo Terme|A294 Angri|A295 Angrogna|A297 Anguillara Sabazia|A296 Anguillara Veneta|A299 Annicco|A301 Annone di Brianza|A302 Annone Veneto|A303 Anoia|A304 Antegnate|A306 Anterivo|A305 Antey-Saint-André|A309 Anticoli Corrado|A312 Antignano|A313 Antillo|A314 Antonimina|A315 Antrodoco|A317 Antrona Schieranco|A318 Anversa degli Abruzzi|A319 Anzano del Parco|A320 Anzano di Puglia|A321 Anzi|A323 Anzio|A325 Anzola d'Ossola|A324 Anzola dell'Emilia|A326 Aosta|A327 Apecchio|A328 Apice|A329 Apiro|A330 Apollosa|A333 Appiano Gentile|A332 Appiano sulla strada del vino|A334 Appignano|A335 Appignano del Tronto|A337 Aprica|A338 Apricale|A339 Apricena|A340 Aprigliano|A341 Aprilia|A343 Aquara|A344 Aquila d'Arroscia|A346 Aquileia|A347 Aquilonia|A348 Aquino|A350 Aradeo|A351 Aragona|A352 Aramengo|A354 Arba|A357 Arborea|A358 Arborio|A359 Arbus|A360 Arcade|A363 Arce|A365 Arcene|A366 Arcevia|A367 Archi|A369 Arcidosso|A370 Arcinazzo Romano|A371 Arcisate|A372 Arco|A373 Arcola|A374 Arcole|A375 Arconate|A376 Arcore|A377 Arcugnano|A379 Ardara|A380 Ardauli|M213 Ardea|A382 Ardenno|A383 Ardesio|A385 Ardore|A386 Arena|A387 Arena Po|A388 Arenzano|A389 Arese|A390 Arezzo|A391 Argegno|A392 Argelato|A393 Argenta|A394 Argentera|A396 Arguello|A397 Argusto|A398 Ari|A399 Ariano Irpino|A400 Ariano nel Polesine|A401 Ariccia|A402 Arielli|A403 Arienzo|A405 Arignano|A407 Aritzo|A409 Arizzano|A412 Arlena di Castro|A413 Arluno|A414 Armeno|A415 Armento|A418 Armo|A419 Armungia|A424 Arnad|A421 Arnara|A422 Arnasco|A425 Arnesano|A427 Arola|A429 Arona|A430 Arosio|A431 Arpaia|A432 Arpaise|A433 Arpino|A434 Arquà Petrarca|A435 Arquà Polesine|A437 Arquata del Tronto|A436 Arquata Scrivia|A438 Arre|A439 Arrone|A441 Arsago Seprio|A443 Arsiè|A444 Arsiero|A445 Arsita|A446 Arsoli|A447 Arta Terme|A448 Artegna|A449 Artena|A451 Artogne|A452 Arvier|A453 Arzachena|A440 Arzago d'Adda|A454 Arzana|A455 Arzano|A458 Arzergrande|A459 Arzignano|A460 Ascea|A461 Asciano|A462 Ascoli Piceno|A463 Ascoli Satriano|A464 Ascrea|A465 Asiago|A467 Asigliano Veneto|A466 Asigliano Vercellese|A470 Asola|A471 Asolo|A473 Assago|A474 Assemini|A475 Assisi|A476 Asso|A477 Assolo|A478 Assoro|A479 Asti|A480 Asuni|A481 Ateleta|A482 Atella|A484 Atena Lucana|A485 Atessa|A486 Atina|A487 Atrani|A488 Atri|A489 Atripalda|A490 Attigliano|A491 Attimis|A492 Atzara|A494 Augusta|A495 Auletta|A496 Aulla|A497 Aurano|A499 Aurigo|A501 Auronzo di Cadore|A502 Ausonia|A503 Austis|A506 Avegno|A507 Avelengo|A508 Avella|A509 Avellino|A511 Averara|A512 Aversa|A514 Avetrana|A515 Avezzano|A516 Aviano|A517 Aviatico|A518 Avigliana|A519 Avigliano|M258 Avigliano Umbro|A520 Avio|A521 Avise|A522 Avola|A523 Avolasca|A094 Ayas|A108 Aymavilles|A525 Azeglio|A526 Azzanello|A527 Azzano d'Asti|A530 Azzano Decimo|A529 Azzano Mella|A528 Azzano San Paolo|A531 Azzate|A532 Azzio|A533 Azzone|A534 Baceno|A535 Bacoli|A536 Badalucco|M214 Badesi|A537 Badia|A540 Badia Calavena|A538 Badia Pavese|A539 Badia Polesine|A541 Badia Tedalda|A542 Badolato|A544 Bagaladi|A546 Bagheria|A547 Bagnacavallo|A552 Bagnara Calabra|A551 Bagnara di Romagna|A550 Bagnaria|A553 Bagnaria Arsa|A555 Bagnasco|A557 Bagnatica|A560 Bagni di Lucca|A564 Bagno a Ripoli|A565 Bagno di Romagna|A567 Bagnoli del Trigno|A568 Bagnoli di Sopra|A566 Bagnoli Irpino|A570 Bagnolo Cremasco|A572 Bagnolo del Salento|A574 Bagnolo di Po|A573 Bagnolo in Piano|A569 Bagnolo Mella|A571 Bagnolo Piemonte|A575 Bagnolo San Vito|A576 Bagnone|A577 Bagnoregio|A578 Bagolino|A579 Baia e Latina|A580 Baiano|A584 Bairo|A586 Baiso|A581 Bajardo|A587 Balangero|A588 Baldichieri d'Asti|A590 Baldissero Canavese|A589 Baldissero d'Alba|A591 Baldissero Torinese|A592 Balestrate|A593 Balestrino|A594 Ballabio|A597 Ballao|A599 Balme|A600 Balmuccia|A601 Balocco|A603 Balsorano|A604 Balvano|A605 Balzola|A606 Banari|A607 Banchette|A610 Bannio Anzino|A612 Banzi|A613 Baone|A614 Baradili|A615 Baragiano|A616 Baranello|A617 Barano d'Ischia|A618 Baranzate|A619 Barasso|A621 Baratili San Pietro|A625 Barbania|A626 Barbara|M401 Barbarano Mossano|A628 Barbarano Romano|A629 Barbaresco|A630 Barbariga|A631 Barbata|A632 Barberino di Mugello|M408 Barberino Tavarnelle|A634 Barbianello|A635 Barbiano|A637 Barbona|A638 Barcellona Pozzo di Gotto|A640 Barcis|A643 Bard|A645 Bardello|A646 Bardi|A647 Bardineto|A650 Bardolino|A651 Bardonecchia|A652 Bareggio|A653 Barengo|A655 Baressa|A656 Barete|A657 Barga|A658 Bargagli|A660 Barge|A661 Barghe|A662 Bari|A663 Bari Sardo|A664 Bariano|A665 Baricella|A666 Barile|A667 Barisciano|A668 Barlassina|A669 Barletta|A670 Barni|A671 Barolo|A673 Barone Canavese|A674 Baronissi|A676 Barrafranca|A677 Barrali|A678 Barrea|A681 Barumini|A683 Barzago|A684 Barzana|A686 Barzanò|A687 Barzio|A689 Basaluzzo|A690 Bascapè|A691 Baschi|A692 Basciano|A694 Baselga di Pinè|A696 Baselice|A697 Basiano|A698 Basicò|A699 Basiglio|A700 Basiliano|A702 Bassano Bresciano|A703 Bassano del Grappa|A706 Bassano in Teverina|A704 Bassano Romano|A707 Bassiano|A708 Bassignana|A709 Bastia Mondovì|A710 Bastia Umbra|A712 Bastida Pancarana|A713 Bastiglia|A714 Battaglia Terme|A716 Battifollo|A717 Battipaglia|A718 Battuda|A719 Baucina|A721 Bauladu|A722 Baunei|A725 Baveno|A728 Bedero Valcuvia|A729 Bedizzole|A730 Bedollo|A731 Bedonia|A732 Bedulita|A733 Bee|A734 Beinasco|A735 Beinette|A736 Belcastro|A737 Belfiore|A740 Belforte all'Isauro|A739 Belforte del Chienti|A738 Belforte Monferrato|A741 Belgioioso|A742 Belgirate|A743 Bella|M335 Bellagio|A745 Bellano|A746 Bellante|A747 Bellaria-Igea Marina|A749 Bellegra|A750 Bellino|A751 Bellinzago Lombardo|A752 Bellinzago Novarese|M294 Bellizzi|A755 Bellona|A756 Bellosguardo|A757 Belluno|A759 Bellusco|A762 Belmonte Calabro|A763 Belmonte Castello|A761 Belmonte del Sannio|A765 Belmonte in Sabina|A764 Belmonte Mezzagno|A760 Belmonte Piceno|A766 Belpasso|A768 Belsito|A772 Belvedere di Spinello|A774 Belvedere Langhe|A773 Belvedere Marittimo|A769 Belvedere Ostrense|A770 Belveglio|A776 Belvì|A777 Bema|A778 Bene Lario|A779 Bene Vagienna|A780 Benestare|A781 Benetutti|A782 Benevello|A783 Benevento|A784 Benna|A785 Bentivoglio|A786 Berbenno|A787 Berbenno di Valtellina|A788 Berceto|A789 Berchidda|A791 Beregazzo con Figliaro|A792 Bereguardo|A793 Bergamasco|A794 Bergamo|A795 Bergantino|A796 Bergeggi|A798 Bergolo|A799 Berlingo|A801 Bernalda|A802 Bernareggio|A804 Bernate Ticino|A805 Bernezzo|A809 Bertinoro|A810 Bertiolo|A811 Bertonico|A812 Berzano di San Pietro|A813 Berzano di Tortona|A816 Berzo Demo|A817 Berzo Inferiore|A815 Berzo San Fermo|A818 Besana in Brianza|A819 Besano|A820 Besate|A821 Besenello|A823 Besenzone|A825 Besnate|A826 Besozzo|A827 Bessude|A831 Bettola|A832 Bettona|A834 Beura-Cardezza|A835 Bevagna|A836 Beverino|A837 Bevilacqua|A841 Biancavilla|A842 Bianchi|A843 Bianco|A844 Biandrate|A845 Biandronno|A846 Bianzano|A847 Bianzè|A848 Bianzone|A849 Biassono|A850 Bibbiano|A851 Bibbiena|A852 Bibbona|A853 Bibiana|A854 Biccari|A855 Bicinicco|A856 Bidonì|A859 Biella|A861 Bienno|A863 Bieno|A864 Bientina|A870 Binago|A872 Binasco|A874 Binetto|A876 Bioglio|A877 Bionaz|A878 Bione|A880 Birori|A881 Bisaccia|A882 Bisacquino|A883 Bisceglie|A884 Bisegna|A885 Bisenti|A887 Bisignano|A889 Bistagno|A891 Bisuschio|A892 Bitetto|A893 Bitonto|A894 Bitritto|A895 Bitti|A896 Bivona|A897 Bivongi|A898 Bizzarone|A902 Bleggio Superiore|A903 Blello|A857 Blera|A904 Blessagno|A905 Blevio|M268 Blufi|A906 Boara Pisani|A909 Bobbio|A910 Bobbio Pellice|A911 Boca|A912 Bocchigliero|A914 Boccioleto|A916 Bocenago|A918 Bodio Lomnago|A919 Boffalora d'Adda|A920 Boffalora sopra Ticino|A922 Bogliasco|A925 Bognanco|A929 Bogogno|A931 Boissano|A930 Bojano|A932 Bolano|A937 Bolgare|A940 Bollate|A941 Bollengo|A944 Bologna|A945 Bolognano|A946 Bolognetta|A947 Bolognola|A948 Bolotana|A949 Bolsena|A950 Boltiere|A952 Bolzano|A953 Bolzano Novarese|A954 Bolzano Vicentino|A955 Bomarzo|A956 Bomba|A957 Bompensiere|A958 Bompietro|A959 Bomporto|A960 Bonarcado|A961 Bonassola|A963 Bonate Sopra|A962 Bonate Sotto|A964 Bonavigo|A965 Bondeno|A968 Bondone|A970 Bonea|A971 Bonefro|A972 Bonemerse|A973 Bonifati|A975 Bonito|A976 Bonnanaro|A977 Bono|A978 Bonorva|A979 Bonvicino|A981 Borbona|A982 Borca di Cadore|A983 Bordano|A984 Bordighera|A986 Bordolano|A987 Bore|A988 Boretto|A989 Borgarello|A990 Borgaro Torinese|A991 Borgetto|A993 Borghetto d'Arroscia|A998 Borghetto di Borbera|A992 Borghetto di Vara|A995 Borghetto Lodigiano|A999 Borghetto Santo Spirito|B001 Borghi|B002 Borgia|B003 Borgiallo|B005 Borgio Verezzi|B007 Borgo a Mozzano|M352 Borgo Chiese|B009 Borgo d'Ale|M429 Borgo d'Anaunia|B010 Borgo di Terzo|M353 Borgo Lares|M396 Borgo Mantovano|B026 Borgo Pace|B028 Borgo Priolo|B033 Borgo San Dalmazzo|B035 Borgo San Giacomo|B017 Borgo San Giovanni|B036 Borgo San Lorenzo|B037 Borgo San Martino|B038 Borgo San Siro|B043 Borgo Ticino|B044 Borgo Tossignano|B042 Borgo Val di Taro|M421 Borgo Valbelluna|B006 Borgo Valsugana|A996 Borgo Velino|M402 Borgo Veneto|B046 Borgo Vercelli|M340 Borgo Virgilio|M406 Borgocarbonara|B015 Borgofranco d'Ivrea|B016 Borgolavezzaro|B018 Borgomale|B019 Borgomanero|B020 Borgomaro|B021 Borgomasino|M370 Borgomezzavalle|B024 Borgone Susa|B025 Borgonovo Val Tidone|B029 Borgoratto Alessandrino|B030 Borgoratto Mormorolo|B031 Borgoricco|B008 Borgorose|B040 Borgosatollo|B041 Borgosesia|B048 Bormida|B049 Bormio|B051 Bornasco|B054 Borno|B055 Boroneddu|B056 Borore|B057 Borrello|B058 Borriana|B061 Borso del Grappa|B062 Bortigali|B063 Bortigiadas|B064 Borutta|B067 Borzonasca|B068 Bosa|B069 Bosaro|B070 Boschi Sant'Anna|B073 Bosco Chiesanuova|B071 Bosco Marengo|B075 Bosconero|B076 Boscoreale|B077 Boscotrecase|B079 Bosia|B080 Bosio|B081 Bosisio Parini|B082 Bosnasco|B083 Bossico|B084 Bossolasco|B085 Botricello|B086 Botrugno|B088 Bottanuco|B091 Botticino|B094 Bottidda|B097 Bova|B099 Bova Marina|B098 Bovalino|B100 Bovegno|B101 Boves|B102 Bovezzo|A720 Boville Ernica|B104 Bovino|B105 Bovisio-Masciago|B106 Bovolenta|B107 Bovolone|B109 Bozzole|B110 Bozzolo|B111 Bra|B112 Bracca|B114 Bracciano|B115 Bracigliano|B116 Braies|B117 Brallo di Pregola|B118 Brancaleone|B120 Brandico|B121 Brandizzo|B123 Branzi|B124 Braone|B126 Brebbia|B128 Breda di Piave|B131 Bregano|B132 Breganze|B134 Bregnano|B137 Brembate|B138 Brembate di Sopra|B141 Brembio|B142 Breme|B143 Brendola|B144 Brenna|B145 Brennero|B149 Breno|B150 Brenta|B152 Brentino Belluno|B153 Brentonico|B154 Brenzone sul Garda|B156 Brescello|B157 Brescia|B158 Bresimo|B159 Bressana Bottarone|B160 Bressanone|B161 Bressanvido|B162 Bresso|B166 Brezzo di Bedero|B167 Briaglia|B169 Briatico|B171 Bricherasio|B172 Brienno|B173 Brienza|B175 Briga Alta|B176 Briga Novarese|B178 Brignano Gera d'Adda|B179 Brignano-Frascata|B180 Brindisi|B181 Brindisi Montagna|B182 Brinzio|B183 Briona|B184 Brione|B187 Briosco|B188 Brisighella|B191 Brissago-Valtravaglia|B192 Brissogne|B193 Brittoli|B194 Brivio|B195 Broccostella|B196 Brogliano|B197 Brognaturo|B198 Brolo|B200 Brondello|B201 Broni|B202 Bronte|B203 Bronzolo|B204 Brossasco|B205 Brosso|B207 Brovello-Carpugnino|B209 Brozolo|B212 Brugherio|B213 Brugine|B214 Brugnato|B215 Brugnera|B216 Bruino|B217 Brumano|B218 Brunate|B219 Brunello|B220 Brunico|B221 Bruno|B223 Brusaporto|B225 Brusasco|B227 Brusciano|B228 Brusimpiano|B229 Brusnengo|B230 Brusson|B232 Bruzolo|B234 Bruzzano Zeffirio|B235 Bubbiano|B236 Bubbio|B237 Buccheri|B238 Bucchianico|B239 Bucciano|B240 Buccinasco|B242 Buccino|B243 Bucine|B246 Buddusò|B247 Budoia|B248 Budoni|B249 Budrio|B250 Buggerru|B251 Buggiano|B255 Buglio in Monte|B256 Bugnara|B258 Buguggiate|B259 Buja|B261 Bulciago|B262 Bulgarograsso|B264 Bultei|B265 Bulzi|B266 Buonabitacolo|B267 Buonalbergo|B269 Buonconvento|B270 Buonvicino|B272 Burago di Molgora|B274 Burcei|B275 Burgio|B276 Burgos|B278 Buriasco|B279 Burolo|B280 Buronzo|B281 Busachi|B282 Busalla|B284 Busano|B285 Busca|B286 Buscate|B287 Buscemi|B288 Buseto Palizzolo|B289 Busnago|B292 Bussero|B293 Busseto|B294 Bussi sul Tirino|B295 Busso|B296 Bussolengo|B297 Bussoleno|B300 Busto Arsizio|B301 Busto Garolfo|B302 Butera|B303 Buti|B304 Buttapietra|B305 Buttigliera Alta|B306 Buttigliera d'Asti|B309 Buttrio|B311 Cabella Ligure|B313 Cabiate|B314 Cabras|B315 Caccamo|B319 Caccuri|B326 Cadegliano-Viconago|B328 Cadelbosco di Sopra|B332 Cadeo|B335 Caderzone Terme|B345 Cadoneghe|B346 Cadorago|M425 Cadrezzate con Osmate|B349 Caerano di San Marco|B350 Cafasse|B351 Caggiano|B352 Cagli|B354 Cagliari|B355 Caglio|B358 Cagnano Amiterno|B357 Cagnano Varano|B361 Caianello|B362 Caiazzo|B364 Caines|B365 Caino|B366 Caiolo|B367 Cairano|B368 Cairate|B369 Cairo Montenotte|B371 Caivano|B374 Calabritto|B375 Calalzo di Cadore|B376 Calamandrana|B377 Calamonaci|B378 Calangianus|B379 Calanna|B380 Calasca-Castiglione|B381 Calascibetta|B382 Calascio|B383 Calasetta|B384 Calatabiano|B385 Calatafimi-Segesta|B388 Calcata|B389 Calceranica al Lago|B390 Calci|B391 Calciano|B392 Calcinaia|B393 Calcinate|B394 Calcinato|B395 Calcio|B396 Calco|B397 Caldaro sulla strada del vino|B398 Caldarola|B399 Calderara di Reno|B400 Caldes|B402 Caldiero|B403 Caldogno|B404 Caldonazzo|B405 Calendasco|B406 Calenzano|B408 Calestano|B410 Calice al Cornoviglio|B409 Calice Ligure|B413 Calimera|B415 Calitri|B416 Calizzano|B417 Callabiana|B418 Calliano|B419 Calliano|B423 Calolziocorte|B424 Calopezzati|B425 Calosso|B426 Caloveto|B427 Caltabellotta|B428 Caltagirone|B429 Caltanissetta|B430 Caltavuturo|B431 Caltignaga|B432 Calto|B433 Caltrano|B434 Calusco d'Adda|B435 Caluso|B436 Calvagese della Riviera|B437 Calvanico|B439 Calvatone|B440 Calvello|B441 Calvene|B442 Calvenzano|B443 Calvera|B444 Calvi|B446 Calvi dell'Umbria|B445 Calvi Risorta|B447 Calvignano|B448 Calvignasco|B450 Calvisano|B452 Calvizzano|B453 Camagna Monferrato|B455 Camaiore|B457 Camandona|B460 Camastra|B461 Cambiago|B462 Cambiano|B463 Cambiasca|B465 Camburzano|B467 Camerana|B468 Camerano|B469 Camerano Casasco|B471 Camerata Cornello|B472 Camerata Nuova|B470 Camerata Picena|B473 Cameri|B474 Camerino|B476 Camerota|B477 Camigliano|B481 Camini|B482 Camino|B483 Camino al Tagliamento|B484 Camisano|B485 Camisano Vicentino|B486 Cammarata|B490 Camogli|B492 Campagna|B493 Campagna Lupia|B496 Campagnano di Roma|B497 Campagnatico|B498 Campagnola Cremasca|B499 Campagnola Emilia|B500 Campana|B501 Camparada|B502 Campegine|B504 Campello sul Clitunno|B505 Campertogno|B507 Campi Bisenzio|B506 Campi Salentina|M373 Campiglia Cervo|B511 Campiglia dei Berici|B509 Campiglia Marittima|B512 Campiglione Fenile|B513 Campione d'Italia|B514 Campitello di Fassa|B515 Campli|B516 Campo Calabro|B526 Campo di Giove|B529 Campo di Trens|B538 Campo Ligure|B553 Campo nell'Elba|B564 Campo San Martino|B570 Campo Tures|B519 Campobasso|B520 Campobello di Licata|B521 Campobello di Mazara|B522 Campochiaro|B524 Campodarsego|B525 Campodenno|B527 Campodimele|B528 Campodipietra|B530 Campodolcino|B531 Campodoro|B533 Campofelice di Fitalia|B532 Campofelice di Roccella|B534 Campofilone|B535 Campofiorito|B536 Campoformido|B537 Campofranco|B539 Campogalliano|B541 Campolattaro|B543 Campoli Appennino|B542 Campoli del Monte Taburno|B544 Campolieto|B546 Campolongo Maggiore|M311 Campolongo Tapogliano|B549 Campomaggiore|B550 Campomarino|B551 Campomorone|B554 Camponogara|B555 Campora|B556 Camporeale|B557 Camporgiano|B559 Camporosso|B562 Camporotondo di Fiastrone|B561 Camporotondo Etneo|B563 Camposampiero|B565 Camposano|B566 Camposanto|B567 Campospinoso|B569 Campotosto|B572 Camugnano|B577 Canal San Bovo|B573 Canale|B574 Canale d'Agordo|B576 Canale Monterano|B578 Canaro|B579 Canazei|B580 Cancellara|B581 Cancello ed Arnone|B582 Canda|B584 Candela|B586 Candelo|B588 Candia Canavese|B587 Candia Lomellina|B589 Candiana|B590 Candida|B591 Candidoni|B592 Candiolo|B593 Canegrate|B594 Canelli|B597 Canepina|B598 Caneva|B602 Canicattì|B603 Canicattini Bagni|B604 Canino|B605 Canischio|B606 Canistro|B607 Canna|B608 Cannalonga|B609 Cannara|B610 Cannero Riviera|B613 Canneto Pavese|B612 Canneto sull'Oglio|B615 Cannobio|B616 Cannole|B617 Canolo|B618 Canonica d'Adda|B619 Canosa di Puglia|B620 Canosa Sannita|B621 Canosio|C669 Canossa|B624 Cansano|B626 Cantagallo|B627 Cantalice|B628 Cantalupa|B631 Cantalupo in Sabina|B629 Cantalupo Ligure|B630 Cantalupo nel Sannio|B633 Cantarana|B634 Cantello|B635 Canterano|B636 Cantiano|B637 Cantoira|B639 Cantù|B640 Canzano|B641 Canzo|B642 Caorle|B643 Caorso|B644 Capaccio Paestum|B645 Capaci|B646 Capalbio|B647 Capannoli|B648 Capannori|B649 Capena|B650 Capergnanica|B651 Capestrano|B653 Capiago Intimiano|B655 Capistrano|B656 Capistrello|B658 Capitignano|B660 Capizzi|B661 Capizzone|B666 Capo d'Orlando|B664 Capo di Ponte|B663 Capodimonte|B667 Capodrise|B669 Capoliveri|B670 Capolona|B671 Caponago|B672 Caporciano|B674 Caposele|B675 Capoterra|B676 Capovalle|B677 Cappadocia|B679 Cappella Cantone|B680 Cappella de' Picenardi|B678 Cappella Maggiore|B681 Cappelle sul Tavo|B682 Capracotta|B684 Capraia e Limite|B685 Capraia Isola|B686 Capralba|B688 Capranica|B687 Capranica Prenestina|B690 Caprarica di Lecce|B691 Caprarola|B692 Caprauna|B693 Caprese Michelangelo|B694 Caprezzo|B696 Capri|B695 Capri Leone|B697 Capriana|B698 Capriano del Colle|B701 Capriata d'Orba|B703 Capriate San Gervasio|B704 Capriati a Volturno|B705 Caprie|B706 Capriglia Irpina|B707 Capriglio|B708 Caprile|B710 Caprino Bergamasco|B709 Caprino Veronese|B711 Capriolo|B712 Capriva del Friuli|B715 Capua|B716 Capurso|B718 Caraffa del Bianco|B717 Caraffa di Catanzaro|B719 Caraglio|B720 Caramagna Piemonte|B722 Caramanico Terme|B724 Carapelle|B725 Carapelle Calvisio|B726 Carasco|B727 Carassai|B729 Carate Brianza|B730 Carate Urio|B731 Caravaggio|B732 Caravate|B733 Caravino|B734 Caravonica|B735 Carbognano|B741 Carbonara al Ticino|B740 Carbonara di Nola|B736 Carbonara Scrivia|B742 Carbonate|B743 Carbone|B744 Carbonera|B745 Carbonia|B748 Carcare|B749 Carceri|B752 Carcoforo|B754 Cardano al Campo|B755 Cardè|M285 Cardedu|B756 Cardeto|B758 Cardinale|B759 Cardito|B760 Careggine|B762 Carema|B763 Carenno|B765 Carentino|B766 Careri|B767 Caresana|B768 Caresanablot|B769 Carezzano|B771 Carfizzi|B772 Cargeghe|B774 Cariati|B776 Carife|B777 Carignano|B778 Carimate|B779 Carinaro|B780 Carini|B781 Carinola|B782 Carisio|B783 Carisolo|B784 Carlantino|B785 Carlazzo|B787 Carlentini|B788 Carlino|B789 Carloforte|B790 Carlopoli|B791 Carmagnola|B792 Carmiano|B794 Carmignano|B795 Carmignano di Brenta|B796 Carnago|B798 Carnate|B801 Carobbio degli Angeli|B802 Carolei|B803 Carona|B804 Caronia|B805 Caronno Pertusella|B807 Caronno Varesino|B808 Carosino|B809 Carovigno|B810 Carovilli|B812 Carpaneto Piacentino|B813 Carpanzano|B816 Carpegna|B817 Carpenedolo|B818 Carpeneto|B819 Carpi|B820 Carpiano|B822 Carpignano Salentino|B823 Carpignano Sesia|B825 Carpineti|B827 Carpineto della Nora|B828 Carpineto Romano|B826 Carpineto Sinello|B829 Carpino|B830 Carpinone|B832 Carrara|B835 Carrè|B836 Carrega Ligure|B838 Carro|B839 Carrodano|B840 Carrosio|B841 Carrù|B842 Carsoli|B844 Cartigliano|B845 Cartignano|B846 Cartoceto|B847 Cartosio|B848 Cartura|B850 Carugate|B851 Carugo|B853 Carunchio|B854 Carvico|B856 Carzano|B857 Casabona|B858 Casacalenda|B859 Casacanditella|B860 Casagiove|B870 Casal Cermelli|B872 Casal di Principe|B895 Casal Velino|B861 Casalanguida|B862 Casalattico|B864 Casalbeltrame|B865 Casalbordino|B866 Casalbore|B867 Casalborgone|B868 Casalbuono|B869 Casalbuttano ed Uniti|B871 Casalciprano|B873 Casalduni|B876 Casale Corte Cerro|B881 Casale Cremasco-Vidolasco|B877 Casale di Scodosia|B875 Casale Litta|B878 Casale Marittimo|B885 Casale Monferrato|B879 Casale sul Sile|B880 Casalecchio di Reno|B882 Casaleggio Boiro|B883 Casaleggio Novara|B886 Casaleone|B889 Casaletto Ceredano|B890 Casaletto di Sopra|B887 Casaletto Lodigiano|B888 Casaletto Spartano|B891 Casaletto Vaprio|B892 Casalfiumanese|B893 Casalgrande|B894 Casalgrasso|M385 Casali del Manco|B896 Casalincontrada|B897 Casalino|B898 Casalmaggiore|B899 Casalmaiocco|B900 Casalmorano|B901 Casalmoro|B902 Casalnoceto|B905 Casalnuovo di Napoli|B904 Casalnuovo Monterotaro|B907 Casaloldo|B910 Casalpusterlengo|B911 Casalromano|B912 Casalserugo|B916 Casaluce|B917 Casalvecchio di Puglia|B918 Casalvecchio Siculo|B919 Casalvieri|B920 Casalvolone|B921 Casalzuigno|B922 Casamarciano|B923 Casamassima|B924 Casamicciola Terme|B925 Casandrino|B928 Casanova Elvo|B927 Casanova Lerrone|B929 Casanova Lonati|B932 Casape|M260 Casapesenna|B933 Casapinta|B934 Casaprota|B935 Casapulla|B936 Casarano|B937 Casargo|B938 Casarile|B940 Casarsa della Delizia|B939 Casarza Ligure|B941 Casasco|B943 Casatenovo|B945 Casatisma|B946 Casavatore|B947 Casazza|B948 Cascia|B949 Casciago|M327 Casciana Terme Lari|B950 Cascina|B953 Cascinette d'Ivrea|B954 Casei Gerola|B955 Caselette|B956 Casella|B959 Caselle in Pittari|B961 Caselle Landi|B958 Caselle Lurani|B960 Caselle Torinese|B963 Caserta|B965 Casier|B966 Casignana|B967 Casina|B971 Casirate d'Adda|B974 Caslino d'Erba|B977 Casnate con Bernate|B978 Casnigo|B980 Casola di Napoli|B979 Casola in Lunigiana|B982 Casola Valsenio|B984 Casole d'Elsa|B985 Casoli|B988 Casorate Primo|B987 Casorate Sempione|B989 Casorezzo|B990 Casoria|B991 Casorzo|A472 Casperia|B993 Caspoggio|B994 Cassacco|B996 Cassago Brianza|C002 Cassano all'Ionio|C003 Cassano d'Adda|B998 Cassano delle Murge|B997 Cassano Irpino|C004 Cassano Magnago|M388 Cassano Spinola|B999 Cassano Valcuvia|C006 Cassaro|C007 Cassiglio|C014 Cassina de' Pecchi|C020 Cassina Rizzardi|C024 Cassina Valsassina|C022 Cassinasco|C027 Cassine|C030 Cassinelle|C033 Cassinetta di Lugagnano|C034 Cassino|C037 Cassola|C038 Cassolnovo|C041 Castagnaro|C044 Castagneto Carducci|C045 Castagneto Po|C046 Castagnito|C049 Castagnole delle Lanze|C047 Castagnole Monferrato|C048 Castagnole Piemonte|C050 Castana|C052 Castano Primo|C053 Casteggio|C055 Castegnato|C056 Castegnero|C058 Castel Baronia|C064 Castel Boglione|C065 Castel Bolognese|B494 Castel Campagnano|C040 Castel Castagna|C183 Castel Condino|C075 Castel d'Aiano|C076 Castel d'Ario|C078 Castel d'Azzano|C082 Castel del Giudice|C083 Castel del Monte|C085 Castel del Piano|C086 Castel del Rio|B969 Castel di Casio|C090 Castel di Ieri|C091 Castel di Iudica|C093 Castel di Lama|C094 Castel di Lucio|C096 Castel di Sangro|C097 Castel di Sasso|C098 Castel di Tora|C102 Castel Focognano|C114 Castel Frentano|C115 Castel Gabbiano|C116 Castel Gandolfo|C117 Castel Giorgio|C118 Castel Goffredo|C121 Castel Guelfo di Bologna|M354 Castel Ivano|C203 Castel Madama|C204 Castel Maggiore|C208 Castel Mella|C211 Castel Morrone|C252 Castel Ritaldi|C253 Castel Rocchero|C255 Castel Rozzone|C259 Castel San Giorgio|C261 Castel San Giovanni|C262 Castel San Lorenzo|C263 Castel San Niccolò|C266 Castel San Pietro Romano|C265 Castel San Pietro Terme|C270 Castel San Vincenzo|C268 Castel Sant'Angelo|C269 Castel Sant'Elia|C289 Castel Viscardo|C110 Castel Vittorio|C291 Castel Volturno|C057 Castelbaldo|C059 Castelbelforte|C060 Castelbellino|C062 Castelbello-Ciardes|C063 Castelbianco|C066 Castelbottaccio|C067 Castelbuono|C069 Castelcivita|C072 Castelcovati|C073 Castelcucco|C074 Casteldaccia|C080 Casteldelci|C081 Casteldelfino|C089 Casteldidone|C100 Castelfidardo|C101 Castelfiorentino|C104 Castelforte|C105 Castelfranci|C113 Castelfranco di Sotto|C107 Castelfranco Emilia|C106 Castelfranco in Miscano|M322 Castelfranco Piandiscò|C111 Castelfranco Veneto|M393 Castelgerundo|C119 Castelgomberto|C120 Castelgrande|C122 Castelguglielmo|C123 Castelguidone|C127 Castell'Alfero|C145 Castell'Arquato|C147 Castell'Azzara|C051 Castell'Umberto|C125 Castellabate|C126 Castellafiume|C128 Castellalto|C130 Castellammare del Golfo|C129 Castellammare di Stabia|C133 Castellamonte|C134 Castellana Grotte|C135 Castellana Sicula|C136 Castellaneta|C137 Castellania Coppi|C139 Castellanza|C142 Castellar Guidobono|C141 Castellarano|C143 Castellaro|C148 Castellazzo Bormida|C149 Castellazzo Novarese|C153 Castelleone|C152 Castelleone di Suasa|C154 Castellero|C155 Castelletto Cervo|C156 Castelletto d'Erro|C158 Castelletto d'Orba|C157 Castelletto di Branduzzo|C160 Castelletto Merli|C161 Castelletto Molina|C162 Castelletto Monferrato|C166 Castelletto sopra Ticino|C165 Castelletto Stura|C167 Castelletto Uzzone|C169 Castelli|C079 Castelli Calepio|C172 Castellina in Chianti|C174 Castellina Marittima|C173 Castellinaldo d'Alba|C175 Castellino del Biferno|C176 Castellino Tanaro|C177 Castelliri|B312 Castello Cabiaglio|C184 Castello d'Agogna|C185 Castello d'Argile|C178 Castello del Matese|C186 Castello dell'Acqua|A300 Castello di Annone|C187 Castello di Brianza|C188 Castello di Cisterna|C190 Castello di Godego|C194 Castello Tesino|C189 Castello-Molina di Fiemme|C195 Castellucchio|C198 Castelluccio dei Sauri|C199 Castelluccio Inferiore|C201 Castelluccio Superiore|C202 Castelluccio Valmaggiore|C205 Castelmagno|C206 Castelmarte|C207 Castelmassa|C197 Castelmauro|C209 Castelmezzano|C210 Castelmola|C213 Castelnovetto|C215 Castelnovo Bariano|C217 Castelnovo del Friuli|C218 Castelnovo di Sotto|C219 Castelnovo ne' Monti|C216 Castelnuovo|C226 Castelnuovo Belbo|C227 Castelnuovo Berardenga|C228 Castelnuovo Bocca d'Adda|C229 Castelnuovo Bormida|C220 Castelnuovo Bozzente|C230 Castelnuovo Calcea|C231 Castelnuovo Cilento|C225 Castelnuovo del Garda|C222 Castelnuovo della Daunia|C214 Castelnuovo di Ceva|C235 Castelnuovo di Conza|C224 Castelnuovo di Farfa|C236 Castelnuovo di Garfagnana|C237 Castelnuovo di Porto|C244 Castelnuovo di Val di Cecina|C232 Castelnuovo Don Bosco|C240 Castelnuovo Magra|C241 Castelnuovo Nigra|C223 Castelnuovo Parano|C242 Castelnuovo Rangone|C243 Castelnuovo Scrivia|C245 Castelpagano|C246 Castelpetroso|C247 Castelpizzuto|C248 Castelplanio|C250 Castelpoto|C251 Castelraimondo|C254 Castelrotto|C267 Castelsantangelo sul Nera|C271 Castelsaraceno|C272 Castelsardo|C273 Castelseprio|B968 Castelsilano|C274 Castelspina|C275 Casteltermini|C181 Castelveccana|C278 Castelvecchio Calvisio|C276 Castelvecchio di Rocca Barbena|C279 Castelvecchio Subequo|C280 Castelvenere|B129 Castelverde|C200 Castelverrino|C284 Castelvetere in Val Fortore|C283 Castelvetere sul Calore|C286 Castelvetrano|C287 Castelvetro di Modena|C288 Castelvetro Piacentino|C290 Castelvisconti|C292 Castenaso|C293 Castenedolo|M288 Castiadas|C318 Castiglion Fibocchi|C319 Castiglion Fiorentino|C308 Castiglione a Casauria|C302 Castiglione Chiavarese|C301 Castiglione Cosentino|C304 Castiglione d'Adda|C313 Castiglione d'Orcia|C296 Castiglione dei Pepoli|C306 Castiglione del Genovesi|C309 Castiglione del Lago|C310 Castiglione della Pescaia|C312 Castiglione delle Stiviere|C303 Castiglione di Garfagnana|C297 Castiglione di Sicilia|C314 Castiglione Falletto|C315 Castiglione in Teverina|C298 Castiglione Messer Marino|C316 Castiglione Messer Raimondo|C300 Castiglione Olona|C317 Castiglione Tinella|C307 Castiglione Torinese|C321 Castignano|C322 Castilenti|C323 Castino|C325 Castione Andevenno|C324 Castione della Presolana|C327 Castions di Strada|C329 Castiraga Vidardo|C330 Casto|C331 Castorano|C332 Castrezzato|C334 Castri di Lecce|C335 Castrignano de' Greci|C336 Castrignano del Capo|C337 Castro|M261 Castro|C338 Castro dei Volsci|C339 Castrocaro Terme e Terra del Sole|C340 Castrocielo|C341 Castrofilippo|C108 Castrolibero|C343 Castronno|C344 Castronovo di Sicilia|C345 Castronuovo di Sant'Andrea|C346 Castropignano|C347 Castroreale|C348 Castroregio|C349 Castrovillari|C351 Catania|C352 Catanzaro|C353 Catenanuova|C354 Catignano|C357 Cattolica|C356 Cattolica Eraclea|C285 Caulonia|C359 Cautano|C361 Cava de' Tirreni|C360 Cava Manara|C363 Cavaglià|C364 Cavaglietto|C365 Cavaglio d'Agogna|C369 Cavagnolo|C370 Cavaion Veronese|C372 Cavalese|C375 Cavallerleone|C376 Cavallermaggiore|C377 Cavallino|M308 Cavallino-Treporti|C378 Cavallirio|C380 Cavareno|C381 Cavargna|C382 Cavaria con Premezzo|C383 Cavarzere|C384 Cavaso del Tomba|C385 Cavasso Nuovo|C387 Cavatore|C389 Cavazzo Carnico|C390 Cave|C392 Cavedago|C393 Cavedine|C394 Cavenago d'Adda|C395 Cavenago di Brianza|C396 Cavernago|C398 Cavezzo|C400 Cavizzana|C404 Cavour|C405 Cavriago|C406 Cavriana|C407 Cavriglia|C409 Cazzago Brabbia|C408 Cazzago San Martino|C412 Cazzano di Tramigna|C410 Cazzano Sant'Andrea|C413 Ceccano|C414 Cecima|C415 Cecina|C417 Cedegolo|C418 Cedrasco|C420 Cefalà Diana|C421 Cefalù|C422 Ceggia|C424 Ceglie Messapica|C426 Celano|C428 Celenza sul Trigno|C429 Celenza Valfortore|C430 Celico|C435 Cella Dati|C432 Cella Monte|C436 Cellamare|C437 Cellara|C438 Cellarengo|C439 Cellatica|C444 Celle di Bulgheria|C441 Celle di Macra|C442 Celle di San Vito|C440 Celle Enomondo|C443 Celle Ligure|C446 Celleno|C447 Cellere|C449 Cellino Attanasio|C448 Cellino San Marco|M398 Cellio con Breia|M262 Cellole|M355 Cembra Lisignago|C453 Cenadi|C456 Cenate Sopra|C457 Cenate Sotto|C458 Cencenighe Agordino|C459 Cene|C461 Ceneselli|C463 Cengio|C466 Centallo|C469 Cento|C470 Centola|C472 Centrache|M394 Centro Valle Intelvi|C471 Centuripe|C474 Cepagatti|C476 Ceppaloni|C478 Ceppo Morelli|C479 Ceprano|C480 Cerami|C481 Ceranesi|C483 Cerano|C482 Cerano d'Intelvi|C484 Ceranova|C485 Ceraso|C486 Cercemaggiore|C487 Cercenasco|C488 Cercepiccola|C489 Cerchiara di Calabria|C492 Cerchio|C493 Cercino|C494 Cercivento|C495 Cercola|C496 Cerda|C498 Cerea|C500 Ceregnano|C501 Cerenzia|C497 Ceres|C502 Ceresara|C503 Cereseto|C504 Ceresole Alba|C505 Ceresole Reale|C506 Cerete|C508 Ceretto Lomellina|C509 Cergnago|C510 Ceriale|C511 Ceriana|C512 Ceriano Laghetto|C513 Cerignale|C514 Cerignola|C515 Cerisano|C516 Cermenate|A022 Cermes|C517 Cermignano|C520 Cernobbio|C521 Cernusco Lombardone|C523 Cernusco sul Naviglio|C528 Cerreto d'Asti|C524 Cerreto d'Esi|C527 Cerreto di Spoleto|C507 Cerreto Grue|C529 Cerreto Guidi|C518 Cerreto Laziale|C525 Cerreto Sannita|C530 Cerretto Langhe|C531 Cerrina Monferrato|C532 Cerrione|C536 Cerro al Lambro|C534 Cerro al Volturno|C537 Cerro Maggiore|C533 Cerro Tanaro|C538 Cerro Veronese|C539 Cersosimo|C540 Certaldo|C541 Certosa di Pavia|C542 Cerva|C543 Cervara di Roma|C544 Cervarese Santa Croce|C545 Cervaro|C547 Cervasca|C548 Cervatto|C549 Cerveno|C550 Cervere|C551 Cervesina|C552 Cerveteri|C553 Cervia|C554 Cervicati|C555 Cervignano d'Adda|C556 Cervignano del Friuli|C557 Cervinara|C558 Cervino|C559 Cervo|C560 Cerzeto|C561 Cesa|C563 Cesana Brianza|C564 Cesana Torinese|C565 Cesano Boscone|C566 Cesano Maderno|C567 Cesara|C568 Cesarò|C569 Cesate|C573 Cesena|C574 Cesenatico|C576 Cesinali|C578 Cesio|C577 Cesiomaggiore|C580 Cessalto|C581 Cessaniti|C582 Cessapalombo|C583 Cessole|C584 Cetara|C585 Ceto|C587 Cetona|C588 Cetraro|C589 Ceva|C591 Cevo|C593 Challand-Saint-Anselme|C594 Challand-Saint-Victor|C595 Chambave|B491 Chamois|C596 Champdepraz|B540 Champorcher|C598 Charvensod|C294 Châtillon|C599 Cherasco|C600 Cheremule|C604 Chialamberto|C605 Chiampo|C606 Chianche|C608 Chianciano Terme|C609 Chianni|C610 Chianocco|C612 Chiaramonte Gulfi|C613 Chiaramonti|C614 Chiarano|C615 Chiaravalle|C616 Chiaravalle Centrale|C618 Chiari|C619 Chiaromonte|C620 Chiauci|C621 Chiavari|C623 Chiavenna|C624 Chiaverano|C625 Chienes|C627 Chieri|C630 Chies d'Alpago|C628 Chiesa in Valmalenco|C629 Chiesanuova|C631 Chiesina Uzzanese|C632 Chieti|C633 Chieuti|C634 Chieve|C635 Chignolo d'Isola|C637 Chignolo Po|C638 Chioggia|C639 Chiomonte|C640 Chions|C641 Chiopris-Viscone|C648 Chitignano|C649 Chiuduno|C650 Chiuppano|C651 Chiuro|C652 Chiusa|C653 Chiusa di Pesio|C655 Chiusa di San Michele|C654 Chiusa Sclafani|C656 Chiusaforte|C657 Chiusanico|C658 Chiusano d'Asti|C659 Chiusano di San Domenico|C660 Chiusavecchia|C661 Chiusdino|C662 Chiusi|C663 Chiusi della Verna|C665 Chivasso|M272 Ciampino|C668 Cianciana|C672 Cibiana di Cadore|C673 Cicagna|C674 Cicala|C675 Cicciano|C676 Cicerale|C677 Ciciliano|C678 Cicognolo|C679 Ciconio|C680 Cigliano|C681 Cigliè|C684 Cigognola|C685 Cigole|C686 Cilavegna|C689 Cimadolmo|C691 Cimbergo|C695 Ciminà|C696 Ciminna|C697 Cimitile|C699 Cimolais|C700 Cimone|C701 Cinaglio|C702 Cineto Romano|C703 Cingia de' Botti|C704 Cingoli|C705 Cinigiano|C707 Cinisello Balsamo|C708 Cinisi|C709 Cino|C710 Cinquefrondi|C711 Cintano|C712 Cinte Tesino|C714 Cinto Caomaggiore|C713 Cinto Euganeo|C715 Cinzano|C716 Ciorlano|C718 Cipressa|C719 Circello|C722 Ciriè|C723 Cirigliano|C724 Cirimido|C725 Cirò|C726 Cirò Marina|C727 Cis|C728 Cisano Bergamasco|C729 Cisano sul Neva|C730 Ciserano|C732 Cislago|C733 Cisliano|C735 Cison di Valmarino|C738 Cissone|C739 Cisterna d'Asti|C740 Cisterna di Latina|C741 Cisternino|C742 Citerna|C744 Città della Pieve|C745 Città di Castello|C750 Città Sant'Angelo|C743 Cittadella|C746 Cittaducale|C747 Cittanova|C749 Cittareale|C751 Cittiglio|C752 Civate|C755 Civezza|C756 Civezzano|C757 Civiasco|C758 Cividale del Friuli|C759 Cividate al Piano|C760 Cividate Camuno|C763 Civita|C765 Civita Castellana|C766 Civita d'Antino|C764 Civitacampomarano|C768 Civitaluparella|C769 Civitanova del Sannio|C770 Civitanova Marche|C771 Civitaquana|C773 Civitavecchia|C778 Civitella Alfedena|C779 Civitella Casanova|C780 Civitella d'Agliano|C781 Civitella del Tronto|C777 Civitella di Romagna|C774 Civitella in Val di Chiana|C776 Civitella Messer Raimondo|C782 Civitella Paganico|C783 Civitella Roveto|C784 Civitella San Paolo|C785 Civo|C787 Claino con Osteno|C790 Claut|C791 Clauzetto|C792 Clavesana|C793 Claviere|C794 Cles|C795 Cleto|C796 Clivio|C800 Clusone|C801 Coassolo Torinese|C803 Coazze|C804 Coazzolo|C806 Coccaglio|C807 Cocconato|C810 Cocquio-Trevisago|C811 Cocullo|C812 Codevigo|C813 Codevilla|C814 Codigoro|C815 Codognè|C816 Codogno|C817 Codroipo|C818 Codrongianos|C819 Coggiola|C820 Cogliate|C821 Cogne|C823 Cogoleto|C824 Cogollo del Cengio|C826 Cogorno|C829 Colazza|M426 Colceresa|C835 Colere|C836 Colfelice|C838 Coli|C839 Colico|C841 Collalto Sabino|C844 Collarmele|C845 Collazzone|C851 Colle Brianza|C854 Colle d'Anchise|C857 Colle di Tora|C847 Colle di Val d'Elsa|C870 Colle San Magno|C846 Colle Sannita|C872 Colle Santa Lucia|C848 Colle Umberto|C850 Collebeato|C852 Collecchio|C853 Collecorvino|C311 Colledara|C855 Colledimacine|C856 Colledimezzo|C858 Colleferro|C859 Collegiove|C860 Collegno|C862 Collelongo|C864 Collepardo|C865 Collepasso|C866 Collepietro|C867 Colleretto Castelnuovo|C868 Colleretto Giacosa|C869 Collesalvetti|C871 Collesano|C875 Colletorto|C876 Collevecchio|C878 Colli a Volturno|M380 Colli al Metauro|C877 Colli del Tronto|C880 Colli sul Velino|M419 Colli Verdi|C879 Colliano|C882 Collinas|C883 Collio|C884 Collobiano|C885 Colloredo di Monte Albano|C886 Colmurano|C888 Colobraro|C890 Cologna Veneta|C893 Cologne|C894 Cologno al Serio|C895 Cologno Monzese|C897 Colognola ai Colli|C900 Colonna|C901 Colonnella|C902 Colonno|C903 Colorina|C904 Colorno|C905 Colosimi|C908 Colturano|M336 Colverde|C910 Colzate|C911 Comabbio|C912 Comacchio|C914 Comano|M314 Comano Terme|C917 Comazzo|C918 Comeglians|C920 Comelico Superiore|C922 Comerio|C925 Comezzano-Cizzago|C926 Comignago|C927 Comiso|C928 Comitini|C929 Comiziano|C930 Commessaggio|C931 Commezzadura|C933 Como|C934 Compiano|C937 Comun Nuovo|C935 Comunanza|C938 Cona|C941 Conca Casale|C940 Conca dei Marini|C939 Conca della Campania|C943 Concamarise|C946 Concerviano|C948 Concesio|C950 Concordia Sagittaria|C951 Concordia sulla Secchia|C952 Concorezzo|C954 Condofuri|C955 Condove|C956 Condrò|C957 Conegliano|C958 Confienza|C959 Configni|C960 Conflenti|C962 Coniolo|C963 Conselice|C964 Conselve|M356 Contà|C968 Contessa Entellina|C969 Contigliano|C971 Contrada|C972 Controguerra|C973 Controne|C974 Contursi Terme|C975 Conversano|C976 Conza della Campania|C977 Conzano|C978 Copertino|C979 Copiano|C980 Copparo|C982 Corana|C983 Corato|C984 Corbara|C986 Corbetta|C987 Corbola|C988 Corchiano|C990 Corciano|C991 Cordenons|C992 Cordignano|C993 Cordovado|C996 Coreglia Antelminelli|C995 Coreglia Ligure|C998 Coreno Ausonio|C999 Corfinio|D003 Cori|D004 Coriano|D006 Corigliano d'Otranto|M403 Corigliano-Rossano|D007 Corinaldo|D008 Corio|D009 Corleone|D011 Corleto Monforte|D010 Corleto Perticara|D013 Cormano|D014 Cormons|D015 Corna Imagna|D016 Cornalba|M338 Cornale e Bastida|D018 Cornaredo|D019 Cornate d'Adda|B799 Cornedo all'Isarco|D020 Cornedo Vicentino|D021 Cornegliano Laudense|D022 Corneliano d'Alba|D026 Corniglio|D027 Corno di Rosazzo|D028 Corno Giovine|D029 Cornovecchio|D030 Cornuda|D037 Correggio|D038 Correzzana|D040 Correzzola|D041 Corrido|D042 Corridonia|D043 Corropoli|D044 Corsano|D045 Corsico|D046 Corsione|D048 Cortaccia sulla strada del vino|D049 Cortale|D050 Cortandone|D051 Cortanze|D052 Cortazzone|D054 Corte Brugnatella|D056 Corte de' Cortesi con Cignone|D057 Corte de' Frati|D058 Corte Franca|D068 Corte Palasio|D061 Cortemaggiore|D062 Cortemilia|D064 Corteno Golgi|D065 Cortenova|D066 Cortenuova|M372 Corteolona e Genzone|D072 Cortiglione|A266 Cortina d'Ampezzo|D075 Cortina sulla strada del vino|D076 Cortino|D077 Cortona|D078 Corvara|D079 Corvara in Badia|D081 Corvino San Quirico|D082 Corzano|D085 Coseano|D086 Cosenza|D087 Cosio d'Arroscia|D088 Cosio Valtellino|D089 Cosoleto|D093 Cossano Belbo|D092 Cossano Canavese|D094 Cossato|D095 Cosseria|D096 Cossignano|D099 Cossogno|D100 Cossoine|D101 Cossombrato|D109 Costa de' Nobili|D110 Costa di Mezzate|D105 Costa di Rovigo|D112 Costa Masnaga|D111 Costa Serina|D103 Costa Valle Imagna|D102 Costa Vescovato|D117 Costa Volpino|D107 Costabissara|D108 Costacciaro|D113 Costanzana|D114 Costarainera|D118 Costermano sul Garda|D119 Costigliole d'Asti|D120 Costigliole Saluzzo|D121 Cotignola|D123 Cotronei|D124 Cottanello|D012 Courmayeur|D126 Covo|D127 Cozzo|D128 Craco|D131 Crandola Valsassina|D132 Cravagliana|D133 Cravanzana|D134 Craveggia|D136 Creazzo|D137 Crecchio|D139 Credaro|D141 Credera Rubbiano|D142 Crema|D143 Cremella|D144 Cremenaga|D145 Cremeno|D147 Cremia|D149 Cremolino|D150 Cremona|D151 Cremosano|D154 Crescentino|D156 Crespadoro|D159 Crespiatica|M328 Crespina Lorenzana|D161 Crespino|D162 Cressa|D165 Crevacuore|D166 Crevalcore|D168 Crevoladossola|D170 Crispano|D171 Crispiano|D172 Crissolo|D175 Crocefieschi|C670 Crocetta del Montello|D177 Crodo|D179 Crognaleto|D180 Cropalati|D181 Cropani|D184 Crosia|D185 Crosio della Valle|D122 Crotone|D186 Crotta d'Adda|D187 Crova|D188 Croviana|D189 Crucoli|D192 Cuasso al Monte|D195 Cuccaro Vetere|D196 Cucciago|D197 Cuceglio|D198 Cuggiono|D199 Cugliate-Fabiasco|D200 Cuglieri|D201 Cugnoli|D202 Cumiana|D203 Cumignano sul Naviglio|D204 Cunardo|D205 Cuneo|D207 Cunico|D208 Cuorgnè|D209 Cupello|D210 Cupra Marittima|D211 Cupramontana|B824 Cura Carpignano|D214 Curcuris|D216 Cureggio|D217 Curiglia con Monteviasco|D218 Curinga|D219 Curino|D221 Curno|D222 Curon Venosta|D223 Cursi|D226 Curtarolo|D227 Curtatone|D228 Curti|D229 Cusago|D231 Cusano Milanino|D230 Cusano Mutri|D232 Cusino|D233 Cusio|D234 Custonaci|D236 Cutro|D237 Cutrofiano|D238 Cuveglio|D239 Cuvio|D244 Dairago|D245 Dalmine|D246 Dambel|D247 Danta di Cadore|D251 Darfo Boario Terme|D253 Dasà|D255 Davagna|D256 Daverio|D257 Davoli|D258 Dazio|D259 Decimomannu|D260 Decimoputzu|D261 Decollatura|D264 Dego|D265 Deiva Marina|D266 Delebio|D267 Delia|D268 Delianuova|D269 Deliceto|D270 Dello|D271 Demonte|D272 Denice|D273 Denno|D277 Dernice|D278 Derovere|D279 Deruta|D280 Dervio|D281 Desana|D284 Desenzano del Garda|D286 Desio|D287 Desulo|D289 Diamante|D293 Diano Arentino|D296 Diano Castello|D291 Diano d'Alba|D297 Diano Marina|D298 Diano San Pietro|D299 Dicomano|D300 Dignano|M366 Dimaro Folgarida|D303 Dinami|D304 Dipignano|D305 Diso|D309 Divignano|D310 Dizzasco|D311 Dobbiaco|D312 Doberdò del Lago|D314 Dogliani|D315 Dogliola|D316 Dogna|D317 Dolcè|D318 Dolceacqua|D319 Dolcedo|D321 Dolegna del Collio|D323 Dolianova|D325 Dolo|D327 Dolzago|D328 Domanico|D329 Domaso|D330 Domegge di Cadore|D331 Domicella|D332 Domodossola|D333 Domus de Maria|D334 Domusnovas|D339 Donato|D341 Dongo|D338 Donnas|D344 Donori|D345 Dorgali|D346 Dorio|D347 Dormelletto|D348 Dorno|D350 Dorzano|D351 Dosolo|D352 Dossena|D355 Dosso del Liro|D356 Doues|D357 Dovadola|D358 Dovera|D360 Dozza|D361 Dragoni|D364 Drapia|D365 Drena|D366 Drenchia|D367 Dresano|D371 Dro|D372 Dronero|D373 Druento|D374 Druogno|D376 Dualchi|D377 Dubino|M300 Due Carrare|D379 Dueville|D380 Dugenta|D383 Duino Aurisina|D384 Dumenza|D385 Duno|D386 Durazzano|C772 Duronia|D388 Dusino San Michele|D390 Eboli|D391 Edolo|D392 Egna|D394 Elice|D395 Elini|D398 Ello|D399 Elmas|D401 Elva|D402 Emarèse|D403 Empoli|D406 Endine Gaiano|D407 Enego|D408 Enemonzo|C342 Enna|D410 Entracque|D411 Entratico|D412 Envie|D414 Episcopia|D415 Eraclea|D416 Erba|D419 Erbè|D420 Erbezzo|D421 Erbusco|D422 Erchie|H243 Ercolano|D423 Erice|D424 Erli|D426 Erto e Casso|M292 Erula|D428 Erve|D429 Esanatoglia|D430 Escalaplano|D431 Escolca|D434 Esine|D436 Esino Lario|D440 Esperia|D441 Esporlatu|D442 Este|D443 Esterzili|D444 Etroubles|D445 Eupilio|D433 Exilles|D447 Fabbrica Curone|M319 Fabbriche di Vergemoli|D450 Fabbrico|D451 Fabriano|D452 Fabrica di Roma|D453 Fabrizia|D454 Fabro|D455 Faedis|D456 Faedo Valtellino|D458 Faenza|D459 Faeto|D461 Fagagna|D462 Faggeto Lario|D463 Faggiano|D465 Fagnano Alto|D464 Fagnano Castello|D467 Fagnano Olona|D468 Fai della Paganella|D469 Faicchio|D470 Falcade|D471 Falciano del Massico|D473 Falconara Albanese|D472 Falconara Marittima|D474 Falcone|D475 Faleria|D476 Falerna|D477 Falerone|D480 Fallo|D482 Faloppio|D483 Falvaterra|D484 Falzes|D486 Fanano|D487 Fanna|D488 Fano|D489 Fano Adriano|D494 Fara Filiorum Petri|D490 Fara Gera d'Adda|D493 Fara in Sabina|D492 Fara Novarese|D491 Fara Olivana con Sola|D495 Fara San Martino|D496 Fara Vicentino|D497 Fardella|D499 Farigliano|D501 Farindola|D502 Farini|D503 Farnese|D504 Farra d'Isonzo|D505 Farra di Soligo|D508 Fasano|D509 Fascia|D510 Fauglia|D511 Faule|D512 Favale di Malvaro|D514 Favara|D518 Favignana|D520 Favria|D523 Feisoglio|D524 Feletto|D526 Felino|D527 Felitto|D528 Felizzano|D530 Feltre|D531 Fenegrò|D532 Fenestrelle|D537 Fénis|D538 Ferentillo|D539 Ferentino|D540 Ferla|D541 Fermignano|D542 Fermo|D543 Ferno|D544 Feroleto Antico|D545 Feroleto della Chiesa|D547 Ferrandina|D548 Ferrara|D549 Ferrara di Monte Baldo|D550 Ferrazzano|D551 Ferrera di Varese|D552 Ferrera Erbognone|D554 Ferrere|D555 Ferriere|D557 Ferruzzano|D560 Fiamignano|D562 Fiano|D561 Fiano Romano|D564 Fiastra|D565 Fiavè|D567 Ficarazzi|D568 Ficarolo|D569 Ficarra|D570 Ficulle|B034 Fidenza|D571 Fiè allo Sciliar|D573 Fierozzo|D574 Fiesco|D575 Fiesole|D576 Fiesse|D578 Fiesso d'Artico|D577 Fiesso Umbertiano|D579 Figino Serenza|M321 Figline e Incisa Valdarno|D582 Figline Vegliaturo|D586 Filacciano|D587 Filadelfia|D588 Filago|D589 Filandari|D590 Filattiera|D591 Filettino|D592 Filetto|D593 Filiano|D594 Filighera|D595 Filignano|D596 Filogaso|D597 Filottrano|D599 Finale Emilia|D600 Finale Ligure|D604 Fino del Monte|D605 Fino Mornasco|D606 Fiorano al Serio|D608 Fiorano Canavese|D607 Fiorano Modenese|D611 Fiorenzuola d'Arda|D612 Firenze|D613 Firenzuola|D614 Firmo|M323 Fiscaglia|D615 Fisciano|A310 Fiuggi|D617 Fiumalbo|D619 Fiumara|D621 Fiume Veneto|D622 Fiumedinisi|D624 Fiumefreddo Bruzio|D623 Fiumefreddo di Sicilia|M400 Fiumicello Villa Vicentina|M297 Fiumicino|D628 Fiuminata|D629 Fivizzano|D630 Flaibano|D634 Flero|D635 Floresta|D636 Floridia|D637 Florinas|D638 Flumeri|D639 Fluminimaggiore|D640 Flussio|D641 Fobello|D643 Foggia|D644 Foglianise|D645 Fogliano Redipuglia|D646 Foglizzo|D649 Foiano della Chiana|D650 Foiano di Val Fortore|D651 Folgaria|D652 Folignano|D653 Foligno|D654 Follina|D655 Follo|D656 Follonica|D660 Fombio|D661 Fondachelli-Fantina|D662 Fondi|D665 Fonni|D666 Fontainemore|D667 Fontana Liri|D670 Fontanafredda|D671 Fontanarosa|D668 Fontanelice|D672 Fontanella|D673 Fontanellato|D674 Fontanelle|D675 Fontaneto d'Agogna|D676 Fontanetto Po|D677 Fontanigorda|D678 Fontanile|D679 Fontaniva|D680 Fonte|M309 Fonte Nuova|D681 Fontecchio|D682 Fontechiari|D683 Fontegreca|D684 Fonteno|D685 Fontevivo|D686 Fonzaso|D688 Foppolo|D689 Forano|D691 Force|D693 Forchia|D694 Forcola|D695 Fordongianus|D696 Forenza|D697 Foresto Sparso|D700 Forgaria nel Friuli|D701 Forino|D702 Forio|D704 Forlì|D703 Forlì del Sannio|D705 Forlimpopoli|D706 Formazza|D707 Formello|D708 Formia|D709 Formicola|D710 Formigara|D711 Formigine|D712 Formigliana|D714 Fornace|D715 Fornelli|D718 Forni Avoltri|D719 Forni di Sopra|D720 Forni di Sotto|D725 Forno Canavese|D728 Fornovo di Taro|D727 Fornovo San Giovanni|D730 Forte dei Marmi|D731 Fortezza|D732 Fortunago|D733 Forza d'Agrò|D734 Fosciandora|D735 Fosdinovo|D736 Fossa|D738 Fossacesia|D740 Fossalta di Piave|D741 Fossalta di Portogruaro|D737 Fossalto|D742 Fossano|D745 Fossato di Vico|D744 Fossato Serralta|D748 Fossò|D749 Fossombrone|D750 Foza|D751 Frabosa Soprana|D752 Frabosa Sottana|D559 Fraconalto|D754 Fragagnano|D755 Fragneto l'Abate|D756 Fragneto Monforte|D757 Fraine|D758 Framura|D763 Francavilla al Mare|D762 Francavilla Angitola|D759 Francavilla Bisio|D760 Francavilla d'Ete|D765 Francavilla di Sicilia|D761 Francavilla Fontana|D766 Francavilla in Sinni|D764 Francavilla Marittima|D767 Francica|D768 Francofonte|D769 Francolise|D770 Frascaro|D771 Frascarolo|D773 Frascati|D774 Frascineto|D775 Frassilongo|D776 Frassinelle Polesine|D777 Frassinello Monferrato|D780 Frassineto Po|D781 Frassinetto|D782 Frassino|D783 Frassinoro|D785 Frasso Sabino|D784 Frasso Telesino|D788 Fratta Polesine|D787 Fratta Todina|D789 Frattamaggiore|D790 Frattaminore|D791 Fratte Rosa|D793 Frazzanò|D794 Fregona|D796 Fresagrandinaria|D797 Fresonara|D798 Frigento|D799 Frignano|D802 Frinco|D803 Frisa|D804 Frisanco|D805 Front|D807 Frontino|D808 Frontone|D810 Frosinone|D811 Frosolone|D812 Frossasco|D813 Frugarolo|D814 Fubine Monferrato|D815 Fucecchio|D817 Fuipiano Valle Imagna|D818 Fumane|D819 Fumone|D821 Funes|D823 Furci|D824 Furci Siculo|D825 Furnari|D826 Furore|D827 Furtei|D828 Fuscaldo|D829 Fusignano|D830 Fusine|D832 Futani|D834 Gabbioneta-Binanuova|D835 Gabiano|D836 Gabicce Mare|D839 Gaby|D841 Gadesco-Pieve Delmona|D842 Gadoni|D843 Gaeta|D844 Gaggi|D845 Gaggiano|D847 Gaggio Montano|D848 Gaglianico|D850 Gagliano Aterno|D849 Gagliano Castelferrato|D851 Gagliano del Capo|D852 Gagliato|D853 Gagliole|D854 Gaiarine|D855 Gaiba|D856 Gaiola|D858 Gaiole in Chianti|D859 Gairo|D860 Gais|D861 Galati Mamertino|D862 Galatina|D863 Galatone|D864 Galatro|D865 Galbiate|D867 Galeata|D868 Galgagnano|D869 Gallarate|D870 Gallese|D872 Galliate|D871 Galliate Lombardo|D873 Galliavola|D874 Gallicano|D875 Gallicano nel Lazio|D876 Gallicchio|D878 Galliera|D879 Galliera Veneta|D881 Gallinaro|D882 Gallio|D883 Gallipoli|D884 Gallo Matese|D885 Gallodoro|D886 Galluccio|D888 Galtellì|D889 Galzignano Terme|D890 Gamalero|D891 Gambara|D892 Gambarana|D894 Gambasca|D895 Gambassi Terme|D896 Gambatesa|D897 Gambellara|D898 Gamberale|D899 Gambettola|D901 Gambolò|D902 Gambugliano|D903 Gandellino|D905 Gandino|D906 Gandosso|D907 Gangi|D909 Garaguso|D910 Garbagna|D911 Garbagna Novarese|D912 Garbagnate Milanese|D913 Garbagnate Monastero|D915 Garda|D917 Gardone Riviera|D918 Gardone Val Trompia|D920 Garessio|D921 Gargallo|D923 Gargazzone|D924 Gargnano|D925 Garlasco|D926 Garlate|D927 Garlenda|D928 Garniga Terme|D930 Garzeno|D931 Garzigliana|D932 Gasperina|D933 Gassino Torinese|D934 Gattatico|D935 Gatteo|M416 Gattico-Veruno|D938 Gattinara|D940 Gavardo|D942 Gavello|D943 Gaverina Terme|D944 Gavi|D945 Gavignano|D946 Gavirate|D947 Gavoi|D948 Gavorrano|D949 Gazoldo degli Ippoliti|D951 Gazzada Schianno|D952 Gazzaniga|D956 Gazzo|D957 Gazzo Veronese|D958 Gazzola|D959 Gazzuolo|D960 Gela|D961 Gemmano|D962 Gemona del Friuli|D963 Gemonio|D964 Genazzano|D965 Genga|D966 Genivolta|D967 Genola|D968 Genoni|D969 Genova|D970 Genuri|D971 Genzano di Lucania|D972 Genzano di Roma|D974 Gera Lario|D975 Gerace|D977 Geraci Siculo|D978 Gerano|D980 Gerenzago|D981 Gerenzano|D982 Gergei|D983 Germagnano|D984 Germagno|D987 Germignaga|D988 Gerocarne|D990 Gerola Alta|D993 Gerre de' Caprioli|D994 Gesico|D995 Gessate|D996 Gessopalena|D997 Gesturi|D998 Gesualdo|D999 Ghedi|E001 Ghemme|E003 Ghiffa|E004 Ghilarza|E006 Ghisalba|E007 Ghislarengo|E008 Giacciano con Baruchella|E009 Giaglione|E010 Gianico|E012 Giano dell'Umbria|E011 Giano Vetusto|E013 Giardinello|E014 Giardini-Naxos|E015 Giarole|E016 Giarratana|E017 Giarre|E019 Giave|E020 Giaveno|E021 Giavera del Montello|E022 Giba|E023 Gibellina|E024 Gifflenga|E025 Giffone|E026 Giffoni Sei Casali|E027 Giffoni Valle Piana|E028 Gignese|E029 Gignod|E030 Gildone|E031 Gimigliano|E033 Ginestra|E034 Ginestra degli Schiavoni|E036 Ginosa|E037 Gioi|E040 Gioia dei Marsi|E038 Gioia del Colle|E039 Gioia Sannitica|E041 Gioia Tauro|E044 Gioiosa Ionica|E043 Gioiosa Marea|E045 Giove|E047 Giovinazzo|E048 Giovo|E049 Girasole|E050 Girifalco|E052 Gissi|E053 Giuggianello|E054 Giugliano in Campania|E055 Giuliana|E057 Giuliano di Roma|E056 Giuliano Teatino|E058 Giulianova|E060 Giungano|E061 Giurdignano|E062 Giussago|E063 Giussano|E064 Giustenice|E065 Giustino|E066 Giusvalla|E067 Givoletto|E068 Gizzeria|E069 Glorenza|E071 Godega di Sant'Urbano|E072 Godiasco Salice Terme|E074 Godrano|E078 Goito|E079 Golasecca|E081 Golferenzo|M274 Golfo Aranci|E082 Gombito|E083 Gonars|E084 Goni|E086 Gonnesa|E087 Gonnoscodina|E085 Gonnosfanadiga|D585 Gonnosnò|E088 Gonnostramatza|E089 Gonzaga|E090 Gordona|E091 Gorga|E092 Gorgo al Monticano|E093 Gorgoglione|E094 Gorgonzola|E096 Goriano Sicoli|E098 Gorizia|E101 Gorla Maggiore|E102 Gorla Minore|E100 Gorlago|E103 Gorle|E104 Gornate Olona|E106 Gorno|E107 Goro|E109 Gorreto|E111 Gorzegno|E113 Gosaldo|E114 Gossolengo|E115 Gottasecca|E116 Gottolengo|E118 Govone|E120 Gozzano|E122 Gradara|E124 Gradisca d'Isonzo|E125 Grado|E126 Gradoli|E127 Graffignana|E128 Graffignano|E130 Graglia|E131 Gragnano|E132 Gragnano Trebbiense|E133 Grammichele|E134 Grana|E136 Granarolo dell'Emilia|E139 Grandate|E141 Grandola ed Uniti|E142 Graniti|E143 Granozzo con Monticello|E144 Grantola|E145 Grantorto|E146 Granze|E147 Grassano|E148 Grassobbio|E149 Gratteri|M315 Gravedona ed Uniti|E152 Gravellona Lomellina|E153 Gravellona Toce|E154 Gravere|E156 Gravina di Catania|E155 Gravina in Puglia|E158 Grazzanise|E159 Grazzano Badoglio|E160 Greccio|E161 Greci|E163 Greggio|E164 Gremiasco|E165 Gressan|E167 Gressoney-La-Trinité|E168 Gressoney-Saint-Jean|E169 Greve in Chianti|E170 Grezzago|E171 Grezzana|E172 Griante|E173 Gricignano di Aversa|E177 Grignasco|E178 Grigno|E179 Grimacco|E180 Grimaldi|E182 Grinzane Cavour|E184 Grisignano di Zocco|E185 Grisolia|E187 Grizzana Morandi|E188 Grognardo|E189 Gromo|E191 Grondona|E192 Grone|E193 Grontardo|E195 Gropello Cairoli|E196 Gropparello|E199 Groscavallo|E200 Grosio|E201 Grosotto|E202 Grosseto|E203 Grosso|E204 Grottaferrata|E205 Grottaglie|E206 Grottaminarda|E207 Grottammare|E208 Grottazzolina|E209 Grotte|E210 Grotte di Castro|E212 Grotteria|E213 Grottole|E214 Grottolella|E215 Gruaro|E216 Grugliasco|E217 Grumello Cremonese ed Uniti|E219 Grumello del Monte|E221 Grumento Nova|E223 Grumo Appula|E224 Grumo Nevano|E226 Grumolo delle Abbadesse|E227 Guagnano|E228 Gualdo|E229 Gualdo Cattaneo|E230 Gualdo Tadino|E232 Gualtieri|E233 Gualtieri Sicaminò|E234 Guamaggiore|E235 Guanzate|E236 Guarcino|E240 Guarda Veneta|E237 Guardabosone|E238 Guardamiglio|E239 Guardavalle|E241 Guardea|E245 Guardia Lombardi|E246 Guardia Perticara|E242 Guardia Piemontese|E249 Guardia Sanframondi|E243 Guardiagrele|E244 Guardialfiera|E248 Guardiaregia|E250 Guardistallo|E251 Guarene|E252 Guasila|E253 Guastalla|E255 Guazzora|E256 Gubbio|E258 Gudo Visconti|E259 Guglionesi|E261 Guidizzolo|E263 Guidonia Montecelio|E264 Guiglia|E266 Guilmi|E269 Gurro|E270 Guspini|E271 Gussago|E272 Gussola|E273 Hône|E280 Idro|E281 Iglesias|E282 Igliano|E283 Ilbono|E284 Illasi|E285 Illorai|E287 Imbersago|E288 Imer|E289 Imola|E290 Imperia|E291 Impruneta|E292 Inarzo|E295 Incisa Scapaccino|E297 Incudine|E299 Induno Olona|E301 Ingria|E304 Intragna|E305 Introbio|E306 Introd|E307 Introdacqua|E309 Inverigo|E310 Inverno e Monteleone|E311 Inverso Pinasca|E313 Inveruno|E314 Invorio|E317 Inzago|E321 Ionadi|E323 Irgoli|E325 Irma|E326 Irsina|E327 Isasca|E328 Isca sullo Ionio|E329 Ischia|E330 Ischia di Castro|E332 Ischitella|E333 Iseo|E334 Isera|E335 Isernia|E336 Isili|E337 Isnello|E338 Isola d'Asti|E341 Isola del Cantone|E348 Isola del Giglio|E343 Isola del Gran Sasso d'Italia|E340 Isola del Liri|E351 Isola del Piano|E349 Isola della Scala|E350 Isola delle Femmine|E339 Isola di Capo Rizzuto|E353 Isola di Fondra|E356 Isola Dovarese|E358 Isola Rizza|E360 Isola Sant'Antonio|E354 Isola Vicentina|E345 Isolabella|E346 Isolabona|E363 Isole Tremiti|E364 Isorella|E365 Ispani|E366 Ispica|E367 Ispra|E368 Issiglio|E369 Issime|E370 Isso|E371 Issogne|E373 Istrana|E374 Itala|E375 Itri|E376 Ittireddu|E377 Ittiri|E379 Ivrea|E380 Izano|E274 Jacurso|E381 Jelsi|E382 Jenne|E386 Jerago con Orago|E387 Jerzu|E388 Jesi|C388 Jesolo|E320 Jolanda di Savoia|E389 Joppolo|E390 Joppolo Giancaxio|E391 Jovençan|A345 L'Aquila|E394 La Cassa|E423 La Loggia|E425 La Maddalena|A308 La Magdeleine|E430 La Morra|E458 La Salle|E463 La Spezia|E470 La Thuile|E491 La Valle|E490 La Valle Agordina|M348 La Valletta Brianza|E392 Labico|E393 Labro|E395 Lacchiarella|E396 Lacco Ameno|E397 Lacedonia|E398 Laces|E400 Laconi|M212 Ladispoli|E401 Laerru|E402 Laganadi|E403 Laghi|E405 Laglio|E406 Lagnasco|E407 Lago|E409 Lagonegro|E410 Lagosanto|E412 Lagundo|E414 Laigueglia|E415 Lainate|E416 Laino|E417 Laino Borgo|E419 Laino Castello|E420 Laion|E421 Laives|E413 Lajatico|E422 Lallio|E424 Lama dei Peligni|E426 Lama Mocogno|E428 Lambrugo|M208 Lamezia Terme|E429 Lamon|E431 Lampedusa e Linosa|E432 Lamporecchio|E433 Lamporo|E434 Lana|E435 Lanciano|E436 Landiona|E437 Landriano|E438 Langhirano|E439 Langosco|E441 Lanusei|C767 Lanuvio|E443 Lanzada|E445 Lanzo Torinese|E447 Lapedona|E448 Lapio|E450 Lappano|E451 Larciano|E454 Lardirago|M207 Lariano|E456 Larino|E464 Las Plassas|E457 Lasa|E459 Lascari|E462 Lasnigo|E465 Lastebasse|E466 Lastra a Signa|E467 Latera|M392 Laterina Pergine Valdarno|E469 Laterza|E471 Latiano|E472 Latina|E473 Latisana|E474 Latronico|E475 Lattarico|E476 Lauco|E480 Laureana Cilento|E479 Laureana di Borrello|E481 Lauregno|E482 Laurenzana|E483 Lauria|E484 Lauriano|E485 Laurino|E486 Laurito|E487 Lauro|E488 Lavagna|E489 Lavagno|E492 Lavarone|E493 Lavello|E494 Lavena Ponte Tresa|E496 Laveno-Mombello|E497 Lavenone|E498 Laviano|E500 Lavis|E502 Lazise|E504 Lazzate|E506 Lecce|E505 Lecce nei Marsi|E507 Lecco|M313 Ledro|E509 Leffe|E510 Leggiuno|E512 Legnago|E514 Legnano|E515 Legnaro|E517 Lei|E518 Leini|E519 Leivi|E520 Lemie|E522 Lendinara|E523 Leni|E524 Lenna|E526 Leno|E527 Lenola|E528 Lenta|E530 Lentate sul Seveso|E531 Lentella|E532 Lentini|E535 Leonessa|E536 Leonforte|E537 Leporano|E538 Lequile|E540 Lequio Berria|E539 Lequio Tanaro|E541 Lercara Friddi|E542 Lerici|E543 Lerma|E544 Lesa|E546 Lesegno|E547 Lesignano de' Bagni|E549 Lesina|E550 Lesmo|E551 Lessolo|M371 Lessona|E553 Lestizza|E554 Letino|E555 Letojanni|E557 Lettere|E558 Lettomanoppello|E559 Lettopalena|E560 Levanto|E562 Levate|E563 Leverano|E564 Levice|E565 Levico Terme|E566 Levone|E569 Lezzeno|E570 Liberi|E571 Librizzi|E573 Licata|E574 Licciana Nardi|E576 Licenza|E578 Licodia Eubea|E581 Lierna|E583 Lignana|E584 Lignano Sabbiadoro|E587 Lillianes|E588 Limana|E589 Limatola|E590 Limbadi|E591 Limbiate|E592 Limena|E593 Limido Comasco|E594 Limina|E597 Limone Piemonte|E596 Limone sul Garda|E599 Limosano|E600 Linarolo|E602 Linguaglossa|E605 Lioni|E606 Lipari|E607 Lipomo|E608 Lirio|E610 Liscate|E611 Liscia|E613 Lisciano Niccone|E615 Lisio|E617 Lissone|E620 Liveri|E621 Livigno|E622 Livinallongo del Col di Lana|E623 Livo|E624 Livo|E625 Livorno|E626 Livorno Ferraris|E627 Livraga|E629 Lizzanello|E630 Lizzano|A771 Lizzano in Belvedere|E632 Loano|E633 Loazzolo|E635 Locana|E639 Locate di Triulzi|E638 Locate Varesino|E640 Locatello|E644 Loceri|E645 Locorotondo|D976 Locri|E646 Loculi|E647 Lodè|E648 Lodi|E651 Lodi Vecchio|E649 Lodine|E652 Lodrino|E654 Lograto|E655 Loiano|M275 Loiri Porto San Paolo|E656 Lomagna|E659 Lomazzo|E660 Lombardore|E661 Lombriasco|E662 Lomello|E664 Lona-Lases|E665 Lonate Ceppino|E666 Lonate Pozzolo|M312 Lonato del Garda|E668 Londa|E669 Longano|E671 Longare|M342 Longarone|E673 Longhena|E674 Longi|E675 Longiano|E677 Longobardi|E678 Longobucco|E679 Longone al Segrino|E681 Longone Sabino|E682 Lonigo|E683 Loranzè|E684 Loreggia|E685 Loreglia|E687 Lorenzago di Cadore|E689 Loreo|E690 Loreto|E691 Loreto Aprutino|E692 Loria|E693 Loro Ciuffenna|E694 Loro Piceno|E695 Lorsica|E698 Losine|E700 Lotzorai|E704 Lovere|E705 Lovero|E706 Lozio|E707 Lozza|E709 Lozzo Atestino|E708 Lozzo di Cadore|E711 Lozzolo|M420 Lu e Cuccaro Monferrato|E713 Lubriano|E715 Lucca|E714 Lucca Sicula|E716 Lucera|E718 Lucignano|E719 Lucinasco|E722 Lucito|E723 Luco dei Marsi|E724 Lucoli|E726 Lugagnano Val d'Arda|E729 Lugnano in Teverina|E730 Lugo|E731 Lugo di Vicenza|E734 Luino|E735 Luisago|E736 Lula|E737 Lumarzo|E738 Lumezzane|E742 Lunamatrona|E743 Lunano|B387 Lungavilla|E745 Lungro|G143 Luni|E746 Luogosano|E747 Luogosanto|E748 Lupara|E749 Lurago d'Erba|E750 Lurago Marinone|E751 Lurano|E752 Luras|E753 Lurate Caccivio|E754 Lusciano|E757 Luserna|E758 Luserna San Giovanni|E759 Lusernetta|E760 Lusevera|E761 Lusia|M427 Lusiana Conco|E763 Lusigliè|E764 Luson|E767 Lustra|E769 Luvinate|E770 Luzzana|E772 Luzzara|E773 Luzzi|M339 Maccagno con Pino e Veddasca|E777 Maccastorna|E778 Macchia d'Isernia|E780 Macchia Valfortore|E779 Macchiagodena|E782 Macello|E783 Macerata|E784 Macerata Campania|E785 Macerata Feltria|E786 Macherio|E787 Maclodio|E788 Macomer|E789 Macra|E790 Macugnaga|E791 Maddaloni|E342 Madesimo|E793 Madignano|E794 Madone|E795 Madonna del Sasso|M357 Madruzzo|E798 Maenza|E799 Mafalda|E800 Magasa|E801 Magenta|E803 Maggiora|E804 Magherno|E805 Magione|E806 Magisano|E809 Magliano Alfieri|E808 Magliano Alpi|E811 Magliano de' Marsi|E807 Magliano di Tenna|E810 Magliano in Toscana|E813 Magliano Romano|E812 Magliano Sabina|E814 Magliano Vetere|E815 Maglie|E816 Magliolo|E817 Maglione|E818 Magnacavallo|E819 Magnago|E821 Magnano|E820 Magnano in Riviera|E825 Magomadas|E829 Magrè sulla strada del vino|E830 Magreglio|E834 Maida|E835 Maierà|E836 Maierato|E837 Maiolati Spontini|E838 Maiolo|E839 Maiori|E840 Mairago|E841 Mairano|E842 Maissana|E833 Majano|E843 Malagnino|E844 Malalbergo|E847 Malborghetto Valbruna|E848 Malcesine|E850 Malé|E851 Malegno|E852 Maleo|E853 Malesco|E854 Maletto|E855 Malfa|E856 Malgesso|E858 Malgrate|E859 Malito|E860 Mallare|E862 Malles Venosta|E863 Malnate|E864 Malo|E865 Malonno|E868 Maltignano|E869 Malvagna|E870 Malvicino|E872 Malvito|E873 Mammola|E874 Mamoiada|E875 Manciano|E876 Mandanici|E877 Mandas|E878 Mandatoriccio|B632 Mandela|E879 Mandello del Lario|E880 Mandello Vitta|E882 Manduria|E883 Manerba del Garda|E884 Manerbio|E885 Manfredonia|E887 Mango|E888 Mangone|M283 Maniace|E889 Maniago|E891 Manocalzati|E892 Manoppello|E893 Mansuè|E894 Manta|E896 Mantello|E897 Mantova|E899 Manzano|E900 Manziana|E901 Mapello|M316 Mappano|E902 Mara|E903 Maracalagonis|E904 Maranello|E906 Marano di Napoli|E911 Marano di Valpolicella|E908 Marano Equo|E910 Marano Lagunare|E914 Marano Marchesato|E915 Marano Principato|E905 Marano sul Panaro|E907 Marano Ticino|E912 Marano Vicentino|E917 Maranzana|E919 Maratea|E921 Marcallo con Casone|E922 Marcaria|E923 Marcedusa|E924 Marcellina|E925 Marcellinara|E927 Marcetelli|E928 Marcheno|E929 Marchirolo|E930 Marciana|E931 Marciana Marina|E932 Marcianise|E933 Marciano della Chiana|E934 Marcignago|E936 Marcon|E938 Marebbe|E939 Marene|E940 Mareno di Piave|E941 Marentino|E944 Maretto|E945 Margarita|E946 Margherita di Savoia|E947 Margno|E949 Mariana Mantovana|E951 Mariano Comense|E952 Mariano del Friuli|E953 Marianopoli|E954 Mariglianella|E955 Marigliano|E956 Marina di Gioiosa Ionica|E957 Marineo|E958 Marino|E959 Marlengo|E960 Marliana|E961 Marmentino|E962 Marmirolo|E963 Marmora|E965 Marnate|E967 Marone|E968 Maropati|E970 Marostica|E971 Marradi|E972 Marrubiu|E973 Marsaglia|E974 Marsala|E975 Marsciano|E976 Marsico Nuovo|E977 Marsicovetere|E978 Marta|E979 Martano|E980 Martellago|E981 Martello|E982 Martignacco|E983 Martignana di Po|E984 Martignano|E986 Martina Franca|E987 Martinengo|E988 Martiniana Po|E989 Martinsicuro|E990 Martirano|E991 Martirano Lombardo|E992 Martis|E993 Martone|E994 Marudo|E995 Maruggio|B689 Marzabotto|E999 Marzano|E998 Marzano Appio|E997 Marzano di Nola|F001 Marzi|F002 Marzio|M270 Masainas|F003 Masate|F004 Mascali|F005 Mascalucia|F006 Maschito|F007 Masciago Primo|F009 Maser|F010 Masera|F011 Maserà di Padova|F012 Maserada sul Piave|F013 Masi|F016 Masi Torello|F015 Masio|F017 Maslianico|F020 Masone|F023 Massa|F022 Massa d'Albe|M289 Massa di Somma|F025 Massa e Cozzile|F021 Massa Fermana|F029 Massa Lombarda|F030 Massa Lubrense|F032 Massa Marittima|F024 Massa Martana|F027 Massafra|F028 Massalengo|F033 Massanzago|F035 Massarosa|F037 Massazza|F041 Massello|F042 Masserano|F044 Massignano|F045 Massimeno|F046 Massimino|F047 Massino Visconti|F048 Massiola|F050 Masullas|F051 Matelica|F052 Matera|F053 Mathi|F054 Matino|F055 Matrice|F058 Mattie|F059 Mattinata|F061 Mazara del Vallo|F063 Mazzano|F064 Mazzano Romano|F065 Mazzarino|F066 Mazzarrà Sant'Andrea|M271 Mazzarrone|F067 Mazzè|F068 Mazzin|F070 Mazzo di Valtellina|F074 Meana di Susa|F073 Meana Sardo|F078 Meda|F080 Mede|F081 Medea|F082 Medesano|F083 Medicina|F084 Mediglia|F085 Medolago|F086 Medole|F087 Medolla|F088 Meduna di Livenza|F089 Meduno|F092 Megliadino San Vitale|F093 Meina|F095 Melara|F096 Melazzo|F097 Meldola|F098 Mele|F100 Melegnano|F101 Melendugno|F102 Meleti|F104 Melfi|F105 Melicuccà|F106 Melicucco|F107 Melilli|F108 Melissa|F109 Melissano|F111 Melito di Napoli|F112 Melito di Porto Salvo|F110 Melito Irpino|F113 Melizzano|F114 Melle|F115 Mello|F117 Melpignano|F118 Meltina|F119 Melzo|F120 Menaggio|F122 Menconico|F123 Mendatica|F125 Mendicino|F126 Menfi|F127 Mentana|F130 Meolo|F131 Merana|F132 Merano|F133 Merate|F134 Mercallo|F135 Mercatello sul Metauro|F136 Mercatino Conca|F138 Mercato San Severino|F139 Mercato Saraceno|F140 Mercenasco|F141 Mercogliano|F144 Mereto di Tomba|F145 Mergo|F146 Mergozzo|F147 Merì|F148 Merlara|F149 Merlino|F151 Merone|F152 Mesagne|F153 Mese|F154 Mesenzana|F155 Mesero|F156 Mesola|F157 Mesoraca|F158 Messina|F161 Mestrino|F162 Meta|F165 Mezzago|F168 Mezzana|F170 Mezzana Bigli|F167 Mezzana Mortigliengo|F171 Mezzana Rabattone|F172 Mezzane di Sotto|F173 Mezzanego|F175 Mezzanino|F176 Mezzano|F182 Mezzenile|F183 Mezzocorona|F184 Mezzojuso|F186 Mezzoldo|F187 Mezzolombardo|F188 Mezzomerico|F189 Miagliano|F190 Miane|F191 Miasino|F192 Miazzina|F193 Micigliano|F194 Miggiano|F196 Miglianico|F200 Miglierina|F201 Miglionico|F202 Mignanego|F203 Mignano Monte Lungo|F205 Milano|F206 Milazzo|E618 Milena|F207 Mileto|F208 Milis|F209 Militello in Val di Catania|F210 Militello Rosmarino|F213 Millesimo|F214 Milo|F216 Milzano|F217 Mineo|F218 Minerbe|F219 Minerbio|F221 Minervino di Lecce|F220 Minervino Murge|F223 Minori|F224 Minturno|F225 Minucciano|F226 Mioglia|F229 Mira|F230 Mirabella Eclano|F231 Mirabella Imbaccari|F232 Mirabello Monferrato|F233 Mirabello Sannitico|F238 Miradolo Terme|F239 Miranda|F240 Mirandola|F241 Mirano|F242 Mirto|F244 Misano Adriatico|F243 Misano di Gera d'Adda|F246 Misilmeri|F247 Misinto|F248 Missaglia|F249 Missanello|F250 Misterbianco|F251 Mistretta|F254 Moasca|F256 Moconesi|F257 Modena|F258 Modica|F259 Modigliana|F261 Modolo|F262 Modugno|F263 Moena|F265 Moggio|F266 Moggio Udinese|F267 Moglia|F268 Mogliano|F269 Mogliano Veneto|F270 Mogorella|F272 Mogoro|F274 Moiano|F275 Moimacco|F277 Moio Alcantara|F276 Moio de' Calvi|F278 Moio della Civitella|F279 Moiola|F280 Mola di Bari|F281 Molare|F283 Molazzana|F284 Molfetta|M255 Molina Aterno|F287 Molinara|F288 Molinella|F290 Molini di Triora|F293 Molino dei Torti|F294 Molise|F295 Moliterno|F297 Mollia|F301 Molochio|F304 Molteno|F305 Moltrasio|F307 Molveno|F308 Mombaldone|F309 Mombarcaro|F310 Mombaroccio|F311 Mombaruzzo|F312 Mombasiglio|F315 Mombello di Torino|F313 Mombello Monferrato|F316 Mombercelli|F317 Momo|F318 Mompantero|F319 Mompeo|F320 Momperone|F322 Monacilioni|F323 Monale|F324 Monasterace|F325 Monastero Bormida|F327 Monastero di Lanzo|F326 Monastero di Vasco|F329 Monasterolo Casotto|F328 Monasterolo del Castello|F330 Monasterolo di Savigliano|F332 Monastier di Treviso|F333 Monastir|F335 Moncalieri|F336 Moncalvo|D553 Moncenisio|F337 Moncestino|F338 Monchiero|F340 Monchio delle Corti|F342 Moncrivello|F343 Moncucco Torinese|F346 Mondaino|F347 Mondavio|F348 Mondolfo|F351 Mondovì|F352 Mondragone|F354 Moneglia|F355 Monesiglio|F356 Monfalcone|F358 Monforte d'Alba|F359 Monforte San Giorgio|F360 Monfumo|F361 Mongardino|F363 Monghidoro|F364 Mongiana|F365 Mongiardino Ligure|F368 Mongiuffi Melia|F369 Mongrando|F370 Mongrassano|F371 Monguelfo-Tesido|F372 Monguzzo|F373 Moniga del Garda|F374 Monleale|F375 Monno|F376 Monopoli|F377 Monreale|F378 Monrupino|F379 Monsampietro Morico|F380 Monsampolo del Tronto|F381 Monsano|F382 Monselice|F383 Monserrato|F384 Monsummano Terme|F385 Montà|F386 Montabone|F387 Montacuto|F390 Montafia|F391 Montagano|F392 Montagna|F393 Montagna in Valtellina|F394 Montagnana|F395 Montagnareale|F397 Montaguto|F398 Montaione|F400 Montalbano Elicona|F399 Montalbano Jonico|M378 Montalcino|F403 Montaldeo|F404 Montaldo Bormida|F405 Montaldo di Mondovì|F408 Montaldo Roero|F409 Montaldo Scarampi|F407 Montaldo Torinese|F410 Montale|F411 Montalenghe|F414 Montallegro|M387 Montalto Carpasio|F415 Montalto delle Marche|F419 Montalto di Castro|F420 Montalto Dora|F417 Montalto Pavese|F416 Montalto Uffugo|F422 Montanaro|F423 Montanaso Lombardo|F424 Montanera|F426 Montano Antilia|F427 Montano Lucino|F428 Montappone|F429 Montaquila|F430 Montasola|F432 Montauro|F433 Montazzoli|F437 Monte Argentario|F456 Monte Castello di Vibio|F460 Monte Cavallo|F467 Monte Cerignone|F477 Monte Compatri|F434 Monte Cremasco|F486 Monte di Malo|F488 Monte di Procida|F517 Monte Giberto|F524 Monte Grimano Terme|F532 Monte Isola|F561 Monte Marenzo|F589 Monte Porzio|F590 Monte Porzio Catone|F599 Monte Rinaldo|F600 Monte Roberto|F603 Monte Romano|F616 Monte San Biagio|F618 Monte San Giacomo|F620 Monte San Giovanni Campano|F619 Monte San Giovanni in Sabina|F621 Monte San Giusto|F622 Monte San Martino|F626 Monte San Pietrangeli|F627 Monte San Pietro|F628 Monte San Savino|F634 Monte San Vito|F631 Monte Sant'Angelo|F629 Monte Santa Maria Tiberina|F653 Monte Urano|F664 Monte Vidon Combatte|F665 Monte Vidon Corrado|F440 Montebello della Battaglia|F441 Montebello di Bertona|D746 Montebello Jonico|B268 Montebello sul Sangro|F442 Montebello Vicentino|F443 Montebelluna|F445 Montebruno|F446 Montebuono|F450 Montecalvo in Foglia|F448 Montecalvo Irpino|F449 Montecalvo Versiggia|F452 Montecarlo|F453 Montecarotto|F454 Montecassiano|F455 Montecastello|F457 Montecastrilli|F458 Montecatini Val di Cecina|A561 Montecatini-Terme|F461 Montecchia di Crosara|F462 Montecchio|F463 Montecchio Emilia|F464 Montecchio Maggiore|F465 Montecchio Precalcino|F469 Montechiaro d'Acqui|F468 Montechiaro d'Asti|F473 Montechiarugolo|F474 Monteciccardo|F475 Montecilfone|F478 Montecopiolo|F479 Montecorice|F480 Montecorvino Pugliano|F481 Montecorvino Rovella|F482 Montecosaro|F483 Montecrestese|F484 Montecreto|F487 Montedinove|F489 Montedoro|F491 Montefalcione|F492 Montefalco|F493 Montefalcone Appennino|F494 Montefalcone di Val Fortore|F495 Montefalcone nel Sannio|F496 Montefano|F497 Montefelcino|F498 Monteferrante|F499 Montefiascone|F500 Montefino|F502 Montefiore Conca|F501 Montefiore dell'Aso|F503 Montefiorino|F504 Monteflavio|F507 Monteforte Cilento|F508 Monteforte d'Alpone|F506 Monteforte Irpino|F509 Montefortino|F510 Montefranco|F511 Montefredane|F512 Montefusco|F513 Montegabbione|F514 Montegalda|F515 Montegaldella|F516 Montegallo|F518 Montegioco|F519 Montegiordano|F520 Montegiorgio|F522 Montegranaro|F523 Montegridolfo|F526 Montegrino Valtravaglia|F527 Montegrosso d'Asti|F528 Montegrosso Pian Latte|F529 Montegrotto Terme|F531 Monteiasi|F533 Montelabbate|F534 Montelanico|F535 Montelapiano|F543 Monteleone d'Orvieto|F536 Monteleone di Fermo|F538 Monteleone di Puglia|F540 Monteleone di Spoleto|F542 Monteleone Rocca Doria|F541 Monteleone Sabino|F544 Montelepre|F545 Montelibretti|F546 Montella|F547 Montello|F548 Montelongo|F549 Montelparo|F550 Montelupo Albese|F551 Montelupo Fiorentino|F552 Montelupone|F553 Montemaggiore Belsito|F556 Montemagno|F558 Montemale di Cuneo|F559 Montemarano|F560 Montemarciano|F562 Montemarzino|F563 Montemesola|F564 Montemezzo|F565 Montemignaio|F566 Montemiletto|F568 Montemilone|F569 Montemitro|F570 Montemonaco|F572 Montemurlo|F573 Montemurro|F574 Montenars|F576 Montenero di Bisaccia|F579 Montenero Sabino|F580 Montenero Val Cocchiara|F578 Montenerodomo|F582 Monteodorisio|F586 Montepaone|F587 Monteparano|F591 Monteprandone|F592 Montepulciano|F594 Monterchi|F595 Montereale|F596 Montereale Valcellina|F597 Monterenzio|F598 Monteriggioni|F601 Monteroduni|F605 Monteroni d'Arbia|F604 Monteroni di Lecce|F606 Monterosi|F609 Monterosso al Mare|F610 Monterosso Almo|F607 Monterosso Calabro|F608 Monterosso Grana|F611 Monterotondo|F612 Monterotondo Marittimo|F614 Monterubbiano|F623 Montesano Salentino|F625 Montesano sulla Marcellana|F636 Montesarchio|F637 Montescaglioso|F638 Montescano|F639 Montescheno|F640 Montescudaio|M368 Montescudo-Monte Colombo|F642 Montese|F644 Montesegale|F646 Montesilvano|F648 Montespertoli|F651 Monteu da Po|F654 Monteu Roero|F655 Montevago|F656 Montevarchi|F657 Montevecchia|F660 Monteverde|F661 Monteverdi Marittimo|F662 Monteviale|F666 Montezemolo|F667 Monti|F668 Montiano|F672 Monticelli Brusati|F671 Monticelli d'Ongina|F670 Monticelli Pavese|F674 Monticello Brianza|F675 Monticello Conte Otto|F669 Monticello d'Alba|F471 Montichiari|F676 Monticiano|F677 Montieri|M302 Montiglio Monferrato|F679 Montignoso|F680 Montirone|F367 Montjovet|F681 Montodine|F682 Montoggio|F685 Montone|F687 Montopoli di Sabina|F686 Montopoli in Val d'Arno|F688 Montorfano|F690 Montorio al Vomano|F689 Montorio nei Frentani|F692 Montorio Romano|M330 Montoro|F696 Montorso Vicentino|F697 Montottone|F698 Montresta|F701 Montù Beccaria|F703 Monvalle|F704 Monza|F705 Monzambano|F706 Monzuno|F708 Morano Calabro|F707 Morano sul Po|F709 Moransengo|F710 Moraro|F711 Morazzone|F712 Morbegno|F713 Morbello|F716 Morciano di Leuca|F715 Morciano di Romagna|F717 Morcone|F718 Mordano|F720 Morengo|F721 Mores|F722 Moresco|F723 Moretta|F724 Morfasso|F725 Morgano|F726 Morgex|F727 Morgongiori|F728 Mori|F729 Moriago della Battaglia|F730 Moricone|F731 Morigerati|D033 Morimondo|F732 Morino|F733 Moriondo Torinese|F734 Morlupo|F735 Mormanno|F736 Mornago|F737 Mornese|F738 Mornico al Serio|F739 Mornico Losana|F740 Morolo|F743 Morozzo|F744 Morra De Sanctis|F745 Morro d'Alba|F747 Morro d'Oro|F746 Morro Reatino|F748 Morrone del Sannio|F749 Morrovalle|F750 Morsano al Tagliamento|F751 Morsasco|F754 Mortara|F756 Mortegliano|F758 Morterone|F760 Moruzzo|F761 Moscazzano|F762 Moschiano|F764 Mosciano Sant'Angelo|F765 Moscufo|F766 Moso in Passiria|F767 Mossa|F771 Motta Baluffi|F772 Motta Camastra|F773 Motta d'Affermo|F774 Motta de' Conti|F770 Motta di Livenza|F777 Motta Montecorvino|F779 Motta San Giovanni|F781 Motta Sant'Anastasia|F780 Motta Santa Lucia|F783 Motta Visconti|F775 Mottafollone|F776 Mottalciata|B012 Motteggiana|F784 Mottola|F785 Mozzagrogna|F786 Mozzanica|F788 Mozzate|F789 Mozzecane|F791 Mozzo|F793 Muccia|F795 Muggia|F797 Muggiò|F798 Mugnano del Cardinale|F799 Mugnano di Napoli|F801 Mulazzano|F802 Mulazzo|F806 Mura|F808 Muravera|F809 Murazzano|F811 Murello|F813 Murialdo|F814 Murisengo|F815 Murlo|F816 Muro Leccese|F817 Muro Lucano|F818 Muros|F820 Muscoline|F822 Musei|F826 Musile di Piave|F828 Musso|F829 Mussolente|F830 Mussomeli|F832 Muzzana del Turgnano|F833 Muzzano|F835 Nago-Torbole|F836 Nalles|F838 Nanto|F839 Napoli|F840 Narbolia|F841 Narcao|F842 Nardò|F843 Nardodipace|F844 Narni|F845 Naro|F846 Narzole|F847 Nasino|F848 Naso|F849 Naturno|F851 Nave|F852 Navelli|F856 Naz-Sciaves|F857 Nazzano|F858 Ne|F859 Nebbiuno|F861 Negrar di Valpolicella|F862 Neirone|F863 Neive|F864 Nembro|F865 Nemi|F866 Nemoli|F867 Neoneli|F868 Nepi|F870 Nereto|F871 Nerola|F872 Nervesa della Battaglia|F874 Nerviano|F876 Nespolo|F877 Nesso|F878 Netro|F880 Nettuno|F881 Neviano|F882 Neviano degli Arduini|F883 Neviglie|F884 Niardo|F886 Nibbiola|F887 Nibionno|F889 Nichelino|F890 Nicolosi|F891 Nicorvo|F892 Nicosia|F893 Nicotera|F894 Niella Belbo|F895 Niella Tanaro|F898 Nimis|F899 Niscemi|F900 Nissoria|F901 Nizza di Sicilia|F902 Nizza Monferrato|F904 Noale|F906 Noasca|F907 Nocara|F908 Nocciano|F912 Nocera Inferiore|F913 Nocera Superiore|F910 Nocera Terinese|F911 Nocera Umbra|F914 Noceto|F915 Noci|F916 Nociglia|F917 Noepoli|F918 Nogara|F920 Nogaredo|F921 Nogarole Rocca|F922 Nogarole Vicentino|F923 Noicattaro|F924 Nola|F925 Nole|F926 Noli|F927 Nomaglio|F929 Nomi|F930 Nonantola|F931 None|F932 Nonio|F933 Noragugume|F934 Norbello|F935 Norcia|F937 Norma|F939 Nosate|F942 Notaresco|F943 Noto|F949 Nova Levante|F944 Nova Milanese|F950 Nova Ponente|A942 Nova Siri|F137 Novafeltria|F947 Novaledo|F948 Novalesa|F952 Novara|F951 Novara di Sicilia|F956 Novate Mezzola|F955 Novate Milanese|F957 Nove|F958 Novedrate|M430 Novella|F960 Novellara|F961 Novello|F963 Noventa di Piave|F962 Noventa Padovana|F964 Noventa Vicentina|F966 Novi di Modena|F965 Novi Ligure|F967 Novi Velia|F968 Noviglio|F970 Novoli|F972 Nucetto|F975 Nughedu San Nicolò|F974 Nughedu Santa Vittoria|F976 Nule|F977 Nulvi|F978 Numana|F979 Nuoro|F980 Nurachi|F981 Nuragus|F982 Nurallao|F983 Nuraminis|F985 Nureci|F986 Nurri|F987 Nus|F988 Nusco|F989 Nuvolento|F990 Nuvolera|F991 Nuxis|F992 Occhieppo Inferiore|F993 Occhieppo Superiore|F994 Occhiobello|F995 Occimiano|F996 Ocre|F997 Odalengo Grande|F998 Odalengo Piccolo|F999 Oderzo|G001 Odolo|G002 Ofena|G003 Offagna|G004 Offanengo|G005 Offida|G006 Offlaga|G007 Oggebbio|G008 Oggiona con Santo Stefano|G009 Oggiono|G010 Oglianico|G011 Ogliastro Cilento|G015 Olbia|G016 Olcenengo|G018 Oldenico|G019 Oleggio|G020 Oleggio Castello|G021 Olevano di Lomellina|G022 Olevano Romano|G023 Olevano sul Tusciano|G025 Olgiate Comasco|G026 Olgiate Molgora|G028 Olgiate Olona|G030 Olginate|G031 Oliena|G032 Oliva Gessi|G034 Olivadi|G036 Oliveri|G039 Oliveto Citra|G040 Oliveto Lario|G037 Oliveto Lucano|G041 Olivetta San Michele|G042 Olivola|G043 Ollastra|G044 Ollolai|G045 Ollomont|G046 Olmedo|G047 Olmeneta|G049 Olmo al Brembo|G048 Olmo Gentile|G050 Oltre il Colle|G054 Oltressenda Alta|G056 Oltrona di San Mamette|G058 Olzai|G061 Ome|G062 Omegna|G063 Omignano|G064 Onanì|G065 Onano|G066 Oncino|G068 Oneta|G070 Onifai|G071 Oniferi|G074 Ono San Pietro|G075 Onore|G076 Onzo|G078 Opera|G079 Opi|G080 Oppeano|G081 Oppido Lucano|G082 Oppido Mamertina|G083 Ora|G084 Orani|G086 Oratino|G087 Orbassano|G088 Orbetello|G090 Orciano Pisano|D522 Orco Feglino|M266 Ordona|G093 Orero|G095 Orgiano|G097 Orgosolo|G098 Oria|G102 Oricola|G103 Origgio|G105 Orino|G108 Orio al Serio|G109 Orio Canavese|G107 Orio Litta|G110 Oriolo|G111 Oriolo Romano|G113 Oristano|G114 Ormea|G115 Ormelle|G116 Ornago|G117 Ornavasso|G118 Ornica|G119 Orosei|G120 Orotelli|G121 Orria|G122 Orroli|G123 Orsago|G124 Orsara Bormida|G125 Orsara di Puglia|G126 Orsenigo|G128 Orsogna|G129 Orsomarso|G130 Orta di Atella|G131 Orta Nova|G134 Orta San Giulio|G133 Ortacesus|G135 Orte|G136 Ortelle|G137 Ortezzano|G139 Ortignano Raggiolo|G140 Ortisei|G141 Ortona|G142 Ortona dei Marsi|G144 Ortovero|G145 Ortucchio|G146 Ortueri|G147 Orune|G148 Orvieto|B595 Orvinio|G149 Orzinuovi|G150 Orzivecchi|G151 Osasco|G152 Osasio|G153 Oschiri|G154 Osidda|G155 Osiglia|G156 Osilo|G157 Osimo|G158 Osini|G159 Osio Sopra|G160 Osio Sotto|G161 Osnago|G163 Osoppo|G164 Ospedaletti|G168 Ospedaletto|G165 Ospedaletto d'Alpinolo|G167 Ospedaletto Euganeo|G166 Ospedaletto Lodigiano|G169 Ospitale di Cadore|G170 Ospitaletto|G171 Ossago Lodigiano|G173 Ossana|G178 Ossi|G179 Ossimo|G181 Ossona|G183 Ostana|G184 Ostellato|G185 Ostiano|G186 Ostiglia|F401 Ostra|F581 Ostra Vetere|G187 Ostuni|G188 Otranto|G189 Otricoli|G191 Ottana|G192 Ottati|G190 Ottaviano|G193 Ottiglio|G194 Ottobiano|G195 Ottone|G196 Oulx|G197 Ovada|G198 Ovaro|G199 Oviglio|G200 Ovindoli|G201 Ovodda|G012 Oyace|G202 Ozegna|G203 Ozieri|G205 Ozzano dell'Emilia|G204 Ozzano Monferrato|G206 Ozzero|G207 Pabillonis|G209 Pace del Mela|G208 Paceco|G210 Pacentro|G211 Pachino|G212 Paciano|G213 Padenghe sul Garda|G215 Paderna|G218 Paderno d'Adda|G220 Paderno Dugnano|G217 Paderno Franciacorta|G222 Paderno Ponchielli|G224 Padova|G225 Padria|M301 Padru|G226 Padula|G227 Paduli|G228 Paesana|G229 Paese|G230 Pagani|G232 Paganico Sabino|G233 Pagazzano|G234 Pagliara|G237 Paglieta|G238 Pagnacco|G240 Pagno|G241 Pagnona|G242 Pago del Vallo di Lauro|G243 Pago Veiano|G247 Paisco Loveno|G248 Paitone|G249 Paladina|G250 Palagano|G251 Palagianello|G252 Palagiano|G253 Palagonia|G254 Palaia|G255 Palanzano|G257 Palata|G258 Palau|G259 Palazzago|G263 Palazzo Adriano|G262 Palazzo Canavese|G260 Palazzo Pignano|G261 Palazzo San Gervasio|G267 Palazzolo Acreide|G268 Palazzolo dello Stella|G264 Palazzolo sull'Oglio|G266 Palazzolo Vercellese|G270 Palazzuolo sul Senio|G271 Palena|G272 Palermiti|G273 Palermo|G274 Palestrina|G275 Palestro|G276 Paliano|G277 Palizzi|G278 Pallagorio|G280 Pallanzeno|G281 Pallare|G283 Palma Campania|G282 Palma di Montechiaro|G284 Palmanova|G285 Palmariggi|G286 Palmas Arborea|G288 Palmi|G289 Palmiano|G290 Palmoli|G291 Palo del Colle|G293 Palombara Sabina|G294 Palombaro|G292 Palomonte|G295 Palosco|G297 Palù|G296 Palù del Fersina|G298 Paludi|G300 Paluzza|G302 Pamparato|G303 Pancalieri|G304 Pancarana|G305 Panchià|G306 Pandino|G307 Panettieri|G308 Panicale|G311 Pannarano|G312 Panni|G315 Pantelleria|G316 Pantigliate|G317 Paola|G318 Paolisi|G320 Papasidero|G323 Papozze|G324 Parabiago|G325 Parabita|G327 Paratico|G328 Parcines|G330 Parella|G331 Parenti|G333 Parete|G334 Pareto|G335 Parghelia|G336 Parlasco|G337 Parma|G338 Parodi Ligure|G339 Paroldo|G340 Parolise|G342 Parona|G344 Parrano|G346 Parre|G347 Partanna|G348 Partinico|G349 Paruzzaro|G350 Parzanica|G352 Pasian di Prato|G353 Pasiano di Pordenone|G354 Paspardo|G358 Passerano Marmorito|G359 Passignano sul Trasimeno|G361 Passirano|G362 Pastena|G364 Pastorano|G365 Pastrengo|G367 Pasturana|G368 Pasturo|M269 Paterno|G371 Paternò|G372 Paterno Calabro|G370 Paternopoli|G374 Patrica|G376 Pattada|G377 Patti|G378 Patù|G379 Pau|G381 Paularo|G382 Pauli Arbarei|G384 Paulilatino|G385 Paullo|G386 Paupisi|G387 Pavarolo|G388 Pavia|G389 Pavia di Udine|G392 Pavone Canavese|G391 Pavone del Mella|G393 Pavullo nel Frignano|G394 Pazzano|G395 Peccioli|G397 Pecetto di Valenza|G398 Pecetto Torinese|G402 Pedara|G403 Pedaso|G404 Pedavena|G406 Pedemonte|G408 Pederobba|G410 Pedesina|G411 Pedivigliano|G412 Pedrengo|G415 Peglio|G416 Peglio|G417 Pegognaga|G418 Peia|G419 Peio|G420 Pelago|G421 Pella|G424 Pellegrino Parmense|G426 Pellezzano|G428 Pellizzano|G429 Pelugo|G430 Penango|G432 Penna in Teverina|G436 Penna San Giovanni|G437 Penna Sant'Andrea|G433 Pennabilli|G434 Pennadomo|G435 Pennapiedimonte|G438 Penne|G439 Pentone|G441 Perano|G442 Perarolo di Cadore|G443 Perca|G444 Percile|G445 Perdasdefogu|G446 Perdaxius|G447 Perdifumo|G449 Pereto|G450 Perfugas|G452 Pergine Valsugana|G453 Pergola|G454 Perinaldo|G455 Perito|G456 Perledo|G457 Perletto|G458 Perlo|G459 Perloz|G461 Pernumia|C013 Pero|G463 Perosa Argentina|G462 Perosa Canavese|G465 Perrero|G469 Persico Dosimo|G471 Pertengo|G474 Pertica Alta|G475 Pertica Bassa|G476 Pertosa|G477 Pertusio|G478 Perugia|G479 Pesaro|G480 Pescaglia|G481 Pescantina|G482 Pescara|G483 Pescarolo ed Uniti|G484 Pescasseroli|G485 Pescate|G486 Pesche|G487 Peschici|G488 Peschiera Borromeo|G489 Peschiera del Garda|G491 Pescia|G492 Pescina|G494 Pesco Sannita|G493 Pescocostanzo|G495 Pescolanciano|G496 Pescopagano|G497 Pescopennataro|G498 Pescorocchiano|G499 Pescosansonesco|G500 Pescosolido|G502 Pessano con Bornago|G504 Pessina Cremonese|G505 Pessinetto|G506 Petacciato|G508 Petilia Policastro|G509 Petina|G510 Petralia Soprana|G511 Petralia Sottana|G513 Petrella Salto|G512 Petrella Tifernina|G514 Petriano|G515 Petriolo|G516 Petritoli|G517 Petrizzi|G518 Petronà|M281 Petrosino|G519 Petruro Irpino|G520 Pettenasco|G521 Pettinengo|G522 Pettineo|G523 Pettoranello del Molise|G524 Pettorano sul Gizio|G525 Pettorazza Grimani|G526 Peveragno|G528 Pezzana|G529 Pezzaze|G532 Pezzolo Valle Uzzone|G535 Piacenza|G534 Piacenza d'Adige|M418 Piadena Drizzona|G538 Piaggine|G546 Pian Camuno|G542 Piana Crixia|G543 Piana degli Albanesi|G541 Piana di Monte Verna|G547 Piancastagnaio|G549 Piancogno|G551 Piandimeleto|G553 Piane Crati|G555 Pianella|G556 Pianello del Lario|G557 Pianello Val Tidone|G558 Pianengo|G559 Pianezza|G560 Pianezze|G561 Pianfei|G564 Pianico|G565 Pianiga|G568 Piano di Sorrento|D546 Pianopoli|G570 Pianoro|G571 Piansano|G572 Piantedo|G574 Piario|G575 Piasco|G576 Piateda|G577 Piatto|G582 Piazza al Serchio|G580 Piazza Armerina|G579 Piazza Brembana|G583 Piazzatorre|G587 Piazzola sul Brenta|G588 Piazzolo|G589 Picciano|G590 Picerno|G591 Picinisco|G592 Pico|G593 Piea|G594 Piedicavallo|G597 Piedimonte Etneo|G596 Piedimonte Matese|G598 Piedimonte San Germano|G600 Piedimulera|G601 Piegaro|G602 Pienza|G603 Pieranica|G612 Pietra de' Giorgi|G605 Pietra Ligure|G619 Pietra Marazzi|G606 Pietrabbondante|G607 Pietrabruna|G608 Pietracamela|G609 Pietracatella|G610 Pietracupa|G611 Pietradefusi|G613 Pietraferrazzana|G615 Pietrafitta|G616 Pietragalla|G618 Pietralunga|G620 Pietramelara|G604 Pietramontecorvino|G621 Pietranico|G622 Pietrapaola|G623 Pietrapertosa|G624 Pietraperzia|G625 Pietraporzio|G626 Pietraroja|G627 Pietrarubbia|G628 Pietrasanta|G629 Pietrastornina|G630 Pietravairano|G631 Pietrelcina|G636 Pieve a Nievole|G635 Pieve Albignola|G647 Pieve d'Olmi|G639 Pieve del Cairo|M422 Pieve del Grappa|M365 Pieve di Bono-Prezzo|G642 Pieve di Cadore|G643 Pieve di Cento|G645 Pieve di Soligo|G632 Pieve di Teco|G634 Pieve Emanuele|G096 Pieve Fissiraga|G648 Pieve Fosciana|G646 Pieve Ligure|G650 Pieve Porto Morone|G651 Pieve San Giacomo|G653 Pieve Santo Stefano|G656 Pieve Tesino|G657 Pieve Torina|G658 Pieve Vergonte|G649 Pievepelago|G659 Piglio|G660 Pigna|G662 Pignataro Interamna|G661 Pignataro Maggiore|G663 Pignola|G664 Pignone|G665 Pigra|G666 Pila|G669 Pimentel|G670 Pimonte|G671 Pinarolo Po|G672 Pinasca|G673 Pincara|G674 Pinerolo|F831 Pineto|G676 Pino d'Asti|G678 Pino Torinese|G680 Pinzano al Tagliamento|G681 Pinzolo|G682 Piobbico|G683 Piobesi d'Alba|G684 Piobesi Torinese|G685 Piode|G686 Pioltello|G687 Piombino|G688 Piombino Dese|G690 Pioraco|G691 Piossasco|G692 Piovà Massaia|G693 Piove di Sacco|G694 Piovene Rocchette|G696 Piozzano|G697 Piozzo|G699 Piraino|G702 Pisa|G703 Pisano|G705 Piscina|M291 Piscinas|G707 Pisciotta|G710 Pisogne|G704 Pisoniano|G712 Pisticci|G713 Pistoia|G716 Pitigliano|G717 Piubega|G718 Piuro|G719 Piverone|G720 Pizzale|G721 Pizzighettone|G722 Pizzo|G724 Pizzoferrato|G726 Pizzoli|G727 Pizzone|G728 Pizzoni|G729 Placanica|G733 Plataci|G734 Platania|G735 Platì|G299 Plaus|G737 Plesio|G740 Ploaghe|G741 Plodio|G742 Pocapaglia|G743 Pocenia|G746 Podenzana|G747 Podenzano|G749 Pofi|G751 Poggiardo|G752 Poggibonsi|G754 Poggio a Caiano|G756 Poggio Bustone|G757 Poggio Catino|G761 Poggio Imperiale|G763 Poggio Mirteto|G764 Poggio Moiano|G765 Poggio Nativo|G766 Poggio Picenze|G768 Poggio Renatico|G753 Poggio Rusco|G770 Poggio San Lorenzo|G771 Poggio San Marcello|D566 Poggio San Vicino|B317 Poggio Sannita|M324 Poggio Torriana|G758 Poggiodomo|G760 Poggiofiorito|G762 Poggiomarino|G767 Poggioreale|G769 Poggiorsini|G431 Poggiridenti|G772 Pogliano Milanese|G773 Pognana Lario|G774 Pognano|G775 Pogno|G777 Poirino|G776 Pojana Maggiore|G779 Polaveno|G780 Polcenigo|G782 Polesella|M367 Polesine Zibello|G784 Poli|G785 Polia|G786 Policoro|G787 Polignano a Mare|G789 Polinago|G790 Polino|G791 Polistena|G792 Polizzi Generosa|G793 Polla|G794 Pollein|G795 Pollena Trocchia|F567 Pollenza|G796 Pollica|G797 Pollina|G798 Pollone|G799 Pollutri|G800 Polonghera|G801 Polpenazze del Garda|G802 Polverara|G803 Polverigi|G804 Pomarance|G805 Pomaretto|G806 Pomarico|G807 Pomaro Monferrato|G808 Pomarolo|G809 Pombia|G811 Pomezia|G812 Pomigliano d'Arco|G813 Pompei|G814 Pompeiana|G815 Pompiano|G816 Pomponesco|G817 Pompu|G818 Poncarale|G820 Ponderano|G821 Ponna|G822 Ponsacco|G823 Ponso|G826 Pont-Canavese|G854 Pont-Saint-Martin|G825 Pontassieve|G545 Pontboset|G827 Ponte|G833 Ponte Buggianese|G842 Ponte dell'Olio|G844 Ponte di Legno|G846 Ponte di Piave|G830 Ponte Gardena|G829 Ponte in Valtellina|G847 Ponte Lambro|B662 Ponte nelle Alpi|G851 Ponte Nizza|F941 Ponte Nossa|G855 Ponte San Nicolò|G856 Ponte San Pietro|G831 Pontebba|G834 Pontecagnano Faiano|G836 Pontecchio Polesine|G837 Pontechianale|G838 Pontecorvo|G839 Pontecurone|G840 Pontedassio|G843 Pontedera|G848 Pontelandolfo|G849 Pontelatone|G850 Pontelongo|G852 Pontenure|G853 Ponteranica|G858 Pontestura|G859 Pontevico|G860 Pontey|G861 Ponti|G862 Ponti sul Mincio|G864 Pontida|G865 Pontinia|G866 Pontinvrea|G867 Pontirolo Nuovo|G869 Pontoglio|G870 Pontremoli|G871 Ponza|G873 Ponzano di Fermo|G872 Ponzano Monferrato|G874 Ponzano Romano|G875 Ponzano Veneto|G877 Ponzone|G878 Popoli|G879 Poppi|G881 Porano|G882 Porcari|G886 Porcia|G888 Pordenone|G889 Porlezza|G890 Pornassio|G891 Porpetto|G894 Portacomaro|G895 Portalbera|G900 Porte|M358 Porte di Rendena|G902 Portici|G903 Portico di Caserta|G904 Portico e San Benedetto|G905 Portigliola|E680 Porto Azzurro|G906 Porto Ceresio|M263 Porto Cesareo|F299 Porto Empedocle|G917 Porto Mantovano|G919 Porto Recanati|G920 Porto San Giorgio|G921 Porto Sant'Elpidio|G923 Porto Tolle|G924 Porto Torres|G907 Porto Valtravaglia|G926 Porto Viro|G909 Portobuffolè|G910 Portocannone|G912 Portoferraio|G913 Portofino|G914 Portogruaro|G916 Portomaggiore|M257 Portopalo di Capo Passero|G922 Portoscuso|G925 Portovenere|G927 Portula|G929 Posada|G931 Posina|G932 Positano|G933 Possagno|G934 Posta|G935 Posta Fibreno|G936 Postal|G937 Postalesio|G939 Postiglione|G940 Postua|G942 Potenza|F632 Potenza Picena|G943 Pove del Grappa|G944 Povegliano|G945 Povegliano Veronese|G947 Poviglio|G949 Povoletto|G951 Pozzaglia Sabina|B914 Pozzaglio ed Uniti|G953 Pozzallo|G954 Pozzilli|G955 Pozzo d'Adda|G960 Pozzol Groppo|G959 Pozzolengo|G957 Pozzoleone|G961 Pozzolo Formigaro|G962 Pozzomaggiore|G963 Pozzonovo|G964 Pozzuoli|G966 Pozzuolo del Friuli|G965 Pozzuolo Martesana|G968 Pradalunga|G969 Pradamano|G970 Pradleves|G973 Pragelato|G975 Praia a Mare|G976 Praiano|G977 Pralboino|G978 Prali|G979 Pralormo|G980 Pralungo|G981 Pramaggiore|G982 Pramollo|G985 Prarolo|G986 Prarostino|G987 Prasco|G988 Prascorsano|G993 Prata Camportaccio|G992 Prata d'Ansidonia|G994 Prata di Pordenone|G990 Prata di Principato Ultra|G991 Prata Sannita|G995 Pratella|G997 Pratiglione|G999 Prato|H004 Prato allo Stelvio|H002 Prato Carnico|H001 Prato Sesia|H007 Pratola Peligna|H006 Pratola Serra|M329 Pratovecchio Stia|H010 Pravisdomini|G974 Pray|H011 Prazzo|H042 Pré-Saint-Didier|H014 Precenicco|H015 Preci|M344 Predaia|H017 Predappio|H018 Predazzo|H019 Predoi|H020 Predore|H021 Predosa|H022 Preganziol|H026 Pregnana Milanese|H027 Prelà|H028 Premana|H029 Premariacco|H030 Premeno|H033 Premia|H034 Premilcuore|H036 Premolo|H037 Premosello-Chiovenda|H038 Preone|H040 Prepotto|H043 Preseglie|H045 Presenzano|H046 Presezzo|M428 Presicce-Acquarica|H048 Pressana|H052 Pretoro|H055 Prevalle|H056 Prezza|H059 Priero|H062 Prignano Cilento|H061 Prignano sulla Secchia|H063 Primaluna|M359 Primiero San Martino di Castrozza|H068 Priocca|H069 Priola|M279 Priolo Gargallo|G698 Priverno|H070 Prizzi|H071 Proceno|H072 Procida|H073 Propata|H074 Proserpio|H076 Prossedi|H078 Provaglio d'Iseo|H077 Provaglio Val Sabbia|H081 Proves|H083 Provvidenti|H085 Prunetto|H086 Puegnago del Garda|H087 Puglianello|H088 Pula|H089 Pulfero|H090 Pulsano|H091 Pumenengo|H094 Pusiano|H095 Putifigari|H096 Putignano|H097 Quadrelle|H098 Quadri|H100 Quagliuzzo|H101 Qualiano|H102 Quaranti|M414 Quaregna Cerreto|H104 Quargnento|H106 Quarna Sopra|H107 Quarna Sotto|H108 Quarona|H109 Quarrata|H110 Quart|H114 Quarto|H117 Quarto d'Altino|H118 Quartu Sant'Elena|H119 Quartucciu|H120 Quassolo|H121 Quattordio|H122 Quattro Castella|M332 Quero Vas|H126 Quiliano|H127 Quincinetto|H128 Quindici|H129 Quingentole|H130 Quintano|H131 Quinto di Treviso|H132 Quinto Vercellese|H134 Quinto Vicentino|H140 Quinzano d'Oglio|H143 Quistello|H146 Rabbi|H147 Racale|H148 Racalmuto|H150 Racconigi|H151 Raccuja|H152 Racines|H153 Radda in Chianti|H154 Raddusa|H156 Radicofani|H157 Radicondoli|H159 Raffadali|M287 Ragalna|H161 Ragogna|H163 Ragusa|H166 Raiano|H168 Ramacca|H173 Rancio Valcuvia|H174 Ranco|H175 Randazzo|H176 Ranica|H177 Ranzanico|H180 Ranzo|H182 Rapagnano|H183 Rapallo|H184 Rapino|H185 Rapolano Terme|H186 Rapolla|H187 Rapone|H188 Rassa|H189 Rasun-Anterselva|H192 Rasura|H194 Ravanusa|H195 Ravarino|H196 Ravascletto|H198 Ravello|H199 Ravenna|H200 Raveo|H202 Raviscanina|H203 Re|H204 Rea|H205 Realmonte|H206 Reana del Rojale|H207 Reano|H210 Recale|H211 Recanati|H212 Recco|H213 Recetto|H214 Recoaro Terme|H216 Redavalle|H218 Redondesco|H219 Refrancore|H220 Refrontolo|H221 Regalbuto|H222 Reggello|H224 Reggio di Calabria|H223 Reggio nell'Emilia|H225 Reggiolo|H227 Reino|H228 Reitano|H229 Remanzacco|H230 Remedello|H233 Renate|H235 Rende|H236 Renon|H238 Resana|H240 Rescaldina|H242 Resia|H244 Resiutta|H245 Resuttano|H246 Retorbido|H247 Revello|H250 Revigliasco d'Asti|H253 Revine Lago|H255 Rezzago|H256 Rezzato|H257 Rezzo|H258 Rezzoaglio|H262 Rhêmes-Notre-Dame|H263 Rhêmes-Saint-Georges|H264 Rho|H265 Riace|H266 Rialto|H267 Riano|H268 Riardo|H269 Ribera|H270 Ribordone|H271 Ricadi|H272 Ricaldone|H273 Riccia|H274 Riccione|H275 Riccò del Golfo di Spezia|H276 Ricengo|H277 Ricigliano|H280 Riese Pio X|H281 Riesi|H282 Rieti|H284 Rifiano|H285 Rifreddo|H288 Rignano Flaminio|H287 Rignano Garganico|H286 Rignano sull'Arno|H289 Rigolato|H293 Rimella|H294 Rimini|M391 Rio|H299 Rio di Pusteria|H298 Rio Saliceto|H300 Riofreddo|H301 Riola Sardo|H302 Riolo Terme|H303 Riolunato|H304 Riomaggiore|H307 Rionero in Vulture|H308 Rionero Sannitico|H320 Ripa Teatina|H311 Ripabottoni|H312 Ripacandida|H313 Ripalimosani|H314 Ripalta Arpina|H315 Ripalta Cremasca|H316 Ripalta Guerina|H319 Riparbella|H321 Ripatransone|H323 Ripe San Ginesio|H324 Ripi|H325 Riposto|H326 Rittana|H330 Riva del Garda|M410 Riva del Po|H331 Riva di Solto|H328 Riva Ligure|H337 Riva presso Chieri|H333 Rivalba|H334 Rivalta Bormida|H335 Rivalta di Torino|H327 Rivamonte Agordino|H336 Rivanazzano Terme|H338 Rivara|H340 Rivarolo Canavese|H341 Rivarolo del Re ed Uniti|H342 Rivarolo Mantovano|H343 Rivarone|H344 Rivarossa|H346 Rive|H347 Rive d'Arcano|H348 Rivello|H350 Rivergaro|M317 Rivignano Teor|H353 Rivisondoli|H354 Rivodutri|H355 Rivoli|H356 Rivoli Veronese|H357 Rivolta d'Adda|H359 Rizziconi|H361 Roana|H362 Roaschia|H363 Roascio|H365 Roasio|H366 Roatto|H367 Robassomero|G223 Robbiate|H369 Robbio|H371 Robecchetto con Induno|H372 Robecco d'Oglio|H375 Robecco Pavese|H373 Robecco sul Naviglio|H376 Robella|H377 Robilante|H378 Roburent|H386 Rocca Canavese|H387 Rocca Canterano|H391 Rocca Cigliè|H392 Rocca d'Arazzo|H393 Rocca d'Arce|H398 Rocca d'Evandro|H395 Rocca de' Baldi|H396 Rocca de' Giorgi|H399 Rocca di Botte|H400 Rocca di Cambio|H401 Rocca di Cave|H402 Rocca di Mezzo|H403 Rocca di Neto|H404 Rocca di Papa|H414 Rocca Grimalda|H416 Rocca Imperiale|H421 Rocca Massima|H429 Rocca Pia|H379 Rocca Pietore|H432 Rocca Priora|H437 Rocca San Casciano|H438 Rocca San Felice|H439 Rocca San Giovanni|H440 Rocca Santa Maria|H441 Rocca Santo Stefano|H446 Rocca Sinibalda|H450 Rocca Susella|H382 Roccabascerana|H383 Roccabernarda|H384 Roccabianca|H385 Roccabruna|H389 Roccacasale|H394 Roccadaspide|H405 Roccafiorita|H390 Roccafluvione|H408 Roccaforte del Greco|H406 Roccaforte Ligure|H407 Roccaforte Mondovì|H409 Roccaforzata|H410 Roccafranca|H411 Roccagiovine|H412 Roccagloriosa|H413 Roccagorga|H417 Roccalbegna|H418 Roccalumera|H420 Roccamandolfi|H422 Roccamena|H423 Roccamonfina|H424 Roccamontepiano|H425 Roccamorice|H426 Roccanova|H427 Roccantica|H428 Roccapalumba|H431 Roccapiemonte|H433 Roccarainola|H434 Roccaraso|H436 Roccaromana|H442 Roccascalegna|H443 Roccasecca|H444 Roccasecca dei Volsci|H445 Roccasicura|H447 Roccasparvera|H448 Roccaspinalveti|H449 Roccastrada|H380 Roccavaldina|H451 Roccaverano|H452 Roccavignale|H453 Roccavione|H454 Roccavivara|H456 Roccella Ionica|H455 Roccella Valdemone|H458 Rocchetta a Volturno|H462 Rocchetta Belbo|H461 Rocchetta di Vara|H459 Rocchetta e Croce|H465 Rocchetta Ligure|H460 Rocchetta Nervina|H466 Rocchetta Palafea|H467 Rocchetta Sant'Antonio|H468 Rocchetta Tanaro|H470 Rodano|H472 Roddi|H473 Roddino|H474 Rodello|H475 Rodengo|H477 Rodengo Saiano|H478 Rodero|H480 Rodi Garganico|H479 Rodì Milici|H481 Rodigo|H484 Roè Volciano|H485 Rofrano|H486 Rogeno|H488 Roggiano Gravina|H489 Roghudi|H490 Rogliano|H491 Rognano|H492 Rogno|H493 Rogolo|H494 Roiate|H495 Roio del Sangro|H497 Roisan|H498 Roletto|H500 Rolo|H501 Roma|H503 Romagnano al Monte|H502 Romagnano Sesia|H505 Romagnese|H507 Romana|H508 Romanengo|H511 Romano Canavese|H512 Romano d'Ezzelino|H509 Romano di Lombardia|H514 Romans d'Isonzo|H516 Rombiolo|H517 Romeno|H518 Romentino|H519 Rometta|H521 Ronago|H522 Roncà|H523 Roncade|H525 Roncadelle|H527 Roncaro|H528 Roncegno Terme|H529 Roncello|H531 Ronchi dei Legionari|H532 Ronchi Valsugana|H533 Ronchis|H534 Ronciglione|H540 Ronco all'Adige|H538 Ronco Biellese|H537 Ronco Briantino|H539 Ronco Canavese|H536 Ronco Scrivia|H535 Roncobello|H541 Roncoferraro|H542 Roncofreddo|H544 Roncola|H546 Rondanina|H547 Rondissone|H549 Ronsecco|M303 Ronzo-Chienis|H552 Ronzone|H553 Roppolo|H554 Rorà|H556 Rosà|H558 Rosarno|H559 Rosasco|H560 Rosate|H561 Rosazza|H562 Rosciano|H564 Roscigno|H565 Rose|H566 Rosello|H572 Roseto Capo Spulico|F585 Roseto degli Abruzzi|H568 Roseto Valfortore|H570 Rosignano Marittimo|H569 Rosignano Monferrato|H573 Rosolina|H574 Rosolini|H575 Rosora|H577 Rossa|H578 Rossana|H580 Rossano Veneto|H581 Rossiglione|H583 Rosta|H584 Rota d'Imagna|H585 Rota Greca|H588 Rotella|H589 Rotello|H590 Rotonda|H591 Rotondella|H592 Rotondi|H593 Rottofreno|H594 Rotzo|H555 Roure|H364 Rovasenda|H598 Rovato|H599 Rovegno|H601 Rovellasca|H602 Rovello Porro|H604 Roverbella|H606 Roverchiara|H607 Roverè della Luna|H608 Roverè Veronese|H610 Roveredo di Guà|H609 Roveredo in Piano|H612 Rovereto|H614 Rovescala|H615 Rovetta|H618 Roviano|H620 Rovigo|H621 Rovito|H622 Rovolon|H623 Rozzano|H625 Rubano|H627 Rubiana|H628 Rubiera|H629 Ruda|H630 Rudiano|H631 Rueglio|H632 Ruffano|H633 Ruffia|H634 Ruffrè-Mendola|H635 Rufina|F271 Ruinas|H639 Rumo|H641 Ruoti|H642 Russi|H643 Rutigliano|H644 Rutino|H165 Ruviano|H646 Ruvo del Monte|H645 Ruvo di Puglia|H647 Sabaudia|H650 Sabbio Chiese|H652 Sabbioneta|H654 Sacco|H655 Saccolongo|H657 Sacile|H658 Sacrofano|H659 Sadali|H661 Sagama|H662 Sagliano Micca|H665 Sagrado|H666 Sagron Mis|H669 Saint-Christophe|H670 Saint-Denis|H671 Saint-Marcel|H672 Saint-Nicolas|H673 Saint-Oyen|H674 Saint-Pierre|H675 Saint-Rhémy-en-Bosses|H676 Saint-Vincent|H682 Sala Baganza|H681 Sala Biellese|H678 Sala Bolognese|H679 Sala Comacina|H683 Sala Consilina|H677 Sala Monferrato|H687 Salandra|H688 Salaparuta|H689 Salara|H690 Salasco|H691 Salassa|H684 Salbertrand|F810 Salcedo|H693 Salcito|H694 Sale|H695 Sale delle Langhe|H699 Sale Marasino|H704 Sale San Giovanni|H700 Salemi|H686 Salento|H702 Salerano Canavese|H701 Salerano sul Lambro|H703 Salerno|H706 Salgareda|H707 Sali Vercellese|H708 Salice Salentino|H710 Saliceto|H713 Salisano|H714 Salizzole|H715 Salle|H716 Salmour|H717 Salò|H719 Salorno|H720 Salsomaggiore Terme|H723 Saltrio|H724 Saludecio|H725 Saluggia|H726 Salussola|H727 Saluzzo|H729 Salve|H731 Salvirola|H732 Salvitelle|H734 Salza di Pinerolo|H733 Salza Irpina|H735 Salzano|H736 Samarate|H738 Samassi|H739 Samatzai|H743 Sambuca di Sicilia|H744 Sambuca Pistoiese|H745 Sambuci|H746 Sambuco|H749 Sammichele di Bari|H013 Samo|H752 Samolaco|H753 Samone|H754 Samone|H755 Sampeyre|H756 Samugheo|H763 San Bartolomeo al Mare|H764 San Bartolomeo in Galdo|H760 San Bartolomeo Val Cavargna|H765 San Basile|H766 San Basilio|H767 San Bassano|H768 San Bellino|H770 San Benedetto Belbo|H772 San Benedetto dei Marsi|H769 San Benedetto del Tronto|H773 San Benedetto in Perillis|H771 San Benedetto Po|H774 San Benedetto Ullano|G566 San Benedetto Val di Sambro|H775 San Benigno Canavese|H777 San Bernardino Verbano|H780 San Biagio della Cima|H781 San Biagio di Callalta|H778 San Biagio Platani|H779 San Biagio Saracinisco|H782 San Biase|H783 San Bonifacio|H784 San Buono|H785 San Calogero|H786 San Candido|H787 San Canzian d'Isonzo|H789 San Carlo Canavese|H790 San Casciano dei Bagni|H791 San Casciano in Val di Pesa|M264 San Cassiano|H792 San Cataldo|M295 San Cesareo|H793 San Cesario di Lecce|H794 San Cesario sul Panaro|H795 San Chirico Nuovo|H796 San Chirico Raparo|H797 San Cipirello|H798 San Cipriano d'Aversa|H800 San Cipriano Picentino|H799 San Cipriano Po|H801 San Clemente|H803 San Colombano al Lambro|H804 San Colombano Belmonte|H802 San Colombano Certenoli|H805 San Cono|H806 San Cosmo Albanese|H808 San Costantino Albanese|H807 San Costantino Calabro|H809 San Costanzo|H810 San Cristoforo|H814 San Damiano al Colle|H811 San Damiano d'Asti|H812 San Damiano Macra|H816 San Daniele del Friuli|H815 San Daniele Po|H818 San Demetrio Corone|H819 San Demetrio ne' Vestini|H820 San Didero|H823 San Donà di Piave|H822 San Donaci|H826 San Donato di Lecce|H825 San Donato di Ninea|H827 San Donato Milanese|H824 San Donato Val di Comino|D324 San Dorligo della Valle|H831 San Fele|H834 San Felice a Cancello|H836 San Felice Circeo|H838 San Felice del Benaco|H833 San Felice del Molise|H835 San Felice sul Panaro|M277 San Ferdinando|H839 San Ferdinando di Puglia|H840 San Fermo della Battaglia|H841 San Fili|H842 San Filippo del Mela|H843 San Fior|H844 San Fiorano|H845 San Floriano del Collio|H846 San Floro|H847 San Francesco al Campo|H850 San Fratello|H856 San Gavino Monreale|H857 San Gemini|H858 San Genesio Atesino|H859 San Genesio ed Uniti|H860 San Gennaro Vesuviano|H862 San Germano Chisone|H861 San Germano Vercellese|H865 San Gervasio Bresciano|H867 San Giacomo degli Schiavoni|H870 San Giacomo delle Segnate|H868 San Giacomo Filippo|B952 San Giacomo Vercellese|H873 San Gillio|H875 San Gimignano|H876 San Ginesio|H892 San Giorgio a Cremano|H880 San Giorgio a Liri|H881 San Giorgio Albanese|H883 San Giorgio Bigarello|H890 San Giorgio Canavese|H894 San Giorgio del Sannio|H891 San Giorgio della Richinvelda|H893 San Giorgio delle Pertiche|H885 San Giorgio di Lomellina|H895 San Giorgio di Nogaro|H896 San Giorgio di Piano|H897 San Giorgio in Bosco|H882 San Giorgio Ionico|H898 San Giorgio La Molara|H888 San Giorgio Lucano|H878 San Giorgio Monferrato|H889 San Giorgio Morgeto|H887 San Giorgio Piacentino|H899 San Giorgio Scarampi|H884 San Giorgio su Legnano|H900 San Giorio di Susa|H907 San Giovanni a Piro|H906 San Giovanni al Natisone|H910 San Giovanni Bianco|H912 San Giovanni del Dosso|M390 San Giovanni di Fassa|H903 San Giovanni di Gerace|H914 San Giovanni Gemini|H916 San Giovanni Ilarione|H918 San Giovanni in Croce|H919 San Giovanni in Fiore|H920 San Giovanni in Galdo|H921 San Giovanni in Marignano|G467 San Giovanni in Persiceto|H917 San Giovanni Incarico|H922 San Giovanni la Punta|H923 San Giovanni Lipioni|H924 San Giovanni Lupatoto|H926 San Giovanni Rotondo|G287 San Giovanni Suergiu|D690 San Giovanni Teatino|H901 San Giovanni Valdarno|H928 San Giuliano del Sannio|H929 San Giuliano di Puglia|H930 San Giuliano Milanese|A562 San Giuliano Terme|H933 San Giuseppe Jato|H931 San Giuseppe Vesuviano|H935 San Giustino|H936 San Giusto Canavese|H937 San Godenzo|H941 San Gregorio d'Ippona|H942 San Gregorio da Sassola|H940 San Gregorio di Catania|H943 San Gregorio Magno|H939 San Gregorio Matese|H938 San Gregorio nelle Alpi|H945 San Lazzaro di Savena|H949 San Leo|H951 San Leonardo|H952 San Leonardo in Passiria|H953 San Leucio del Sannio|H955 San Lorenzello|H959 San Lorenzo|H957 San Lorenzo al Mare|H961 San Lorenzo Bellizzi|H962 San Lorenzo del Vallo|H956 San Lorenzo di Sebato|M345 San Lorenzo Dorsino|H958 San Lorenzo in Campo|H964 San Lorenzo Isontino|H967 San Lorenzo Maggiore|H969 San Lorenzo Nuovo|H970 San Luca|H971 San Lucido|H973 San Lupo|H976 San Mango d'Aquino|H977 San Mango Piemonte|H975 San Mango sul Calore|H978 San Marcellino|H979 San Marcello|M377 San Marcello Piteglio|H981 San Marco Argentano|H982 San Marco d'Alunzio|H984 San Marco dei Cavoti|F043 San Marco Evangelista|H985 San Marco in Lamis|H986 San Marco la Catola|H999 San Martino al Tagliamento|H987 San Martino Alfieri|I003 San Martino Buon Albergo|H997 San Martino Canavese|H994 San Martino d'Agri|I005 San Martino dall'Argine|I007 San Martino del Lago|H992 San Martino di Finita|I008 San Martino di Lupari|H996 San Martino di Venezze|H988 San Martino in Badia|H989 San Martino in Passiria|H990 San Martino in Pensilis|I011 San Martino in Rio|I012 San Martino in Strada|I002 San Martino Sannita|I014 San Martino Siccomario|H991 San Martino sulla Marrucina|I016 San Martino Valle Caudina|I018 San Marzano di San Giuseppe|I017 San Marzano Oliveto|I019 San Marzano sul Sarno|I023 San Massimo|I024 San Maurizio Canavese|I025 San Maurizio d'Opaglio|I028 San Mauro Castelverde|I031 San Mauro Cilento|H712 San Mauro di Saline|I029 San Mauro Forte|I032 San Mauro la Bruca|I026 San Mauro Marchesato|I027 San Mauro Pascoli|I030 San Mauro Torinese|I040 San Michele al Tagliamento|I042 San Michele all'Adige|I035 San Michele di Ganzaria|I034 San Michele di Serino|I037 San Michele Mondovì|I045 San Michele Salentino|I046 San Miniato|I049 San Nazzaro|I052 San Nazzaro Sesia|I051 San Nazzaro Val Cavargna|I054 San Nicandro Garganico|I060 San Nicola Arcella|I061 San Nicola Baronia|I058 San Nicola da Crissa|I057 San Nicola dell'Alto|I056 San Nicola la Strada|I062 San Nicola Manfredi|A368 San Nicolò d'Arcidano|I063 San Nicolò di Comelico|G383 San Nicolò Gerrei|I065 San Pancrazio|I066 San Pancrazio Salentino|G407 San Paolo|B906 San Paolo Albanese|I073 San Paolo Bel Sito|B310 San Paolo d'Argon|I072 San Paolo di Civitate|I071 San Paolo di Jesi|I076 San Paolo Solbrito|I079 San Pellegrino Terme|I082 San Pier d'Isonzo|I084 San Pier Niceto|I086 San Piero Patti|I093 San Pietro a Maida|I092 San Pietro al Natisone|I089 San Pietro al Tanagro|I095 San Pietro Apostolo|I096 San Pietro Avellana|I098 San Pietro Clarenza|I088 San Pietro di Cadore|I102 San Pietro di Caridà|I103 San Pietro di Feletto|I105 San Pietro di Morubio|I108 San Pietro in Amantea|I109 San Pietro in Cariano|I110 San Pietro in Casale|G788 San Pietro in Cerro|I107 San Pietro in Gu|I114 San Pietro in Guarano|I115 San Pietro in Lama|I113 San Pietro Infine|I116 San Pietro Mosezzo|I117 San Pietro Mussolino|I090 San Pietro Val Lemina|I119 San Pietro Vernotico|I120 San Pietro Viminario|I121 San Pio delle Camere|I123 San Polo d'Enza|I125 San Polo dei Cavalieri|I124 San Polo di Piave|I122 San Polo Matese|I126 San Ponso|I128 San Possidonio|I130 San Potito Sannitico|I129 San Potito Ultra|I131 San Prisco|I132 San Procopio|I133 San Prospero|I135 San Quirico d'Orcia|I136 San Quirino|I137 San Raffaele Cimena|I139 San Roberto|I140 San Rocco al Porto|I142 San Romano in Garfagnana|I143 San Rufo|I147 San Salvatore di Fitalia|I144 San Salvatore Monferrato|I145 San Salvatore Telesino|I148 San Salvo|I151 San Sebastiano al Vesuvio|I150 San Sebastiano Curone|I152 San Sebastiano da Po|I154 San Secondo di Pinerolo|I153 San Secondo Parmense|I157 San Severino Lucano|I156 San Severino Marche|I158 San Severo|I162 San Siro|I163 San Sossio Baronia|I164 San Sostene|I165 San Sosti|I166 San Sperate|I373 San Stino di Livenza|I261 San Tammaro|I328 San Teodoro|I329 San Teodoro|I347 San Tomaso Agordino|I376 San Valentino in Abruzzo Citeriore|I377 San Valentino Torio|I381 San Venanzo|I382 San Vendemiano|I384 San Vero Milis|I390 San Vincenzo|I388 San Vincenzo La Costa|I389 San Vincenzo Valle Roveto|I391 San Vitaliano|I402 San Vito|I403 San Vito al Tagliamento|I404 San Vito al Torre|I394 San Vito Chietino|I396 San Vito dei Normanni|I392 San Vito di Cadore|I405 San Vito di Fagagna|I401 San Vito di Leguzzano|I407 San Vito Lo Capo|I400 San Vito Romano|I393 San Vito sullo Ionio|I408 San Vittore del Lazio|I409 San Vittore Olona|I414 San Zeno di Montagna|I412 San Zeno Naviglio|I415 San Zenone al Lambro|I416 San Zenone al Po|I417 San Zenone degli Ezzelini|H757 Sanarica|H821 Sandigliano|H829 Sandrigo|H851 Sanfrè|H852 Sanfront|H855 Sangano|H872 Sangiano|H877 Sangineto|H944 Sanguinetto|H974 Sanluri|I048 Sannazzaro de' Burgondi|I053 Sannicandro di Bari|I059 Sannicola|I138 Sanremo|I155 Sansepolcro|I189 Sant'Agapito|I191 Sant'Agata Bolognese|I197 Sant'Agata de' Goti|I198 Sant'Agata del Bianco|I192 Sant'Agata di Esaro|I199 Sant'Agata di Militello|I193 Sant'Agata di Puglia|I201 Sant'Agata Feltria|I190 Sant'Agata Fossili|I202 Sant'Agata li Battiati|I196 Sant'Agata sul Santerno|I208 Sant'Agnello|I210 Sant'Albano Stura|I213 Sant'Alessio con Vialone|I214 Sant'Alessio in Aspromonte|I215 Sant'Alessio Siculo|I216 Sant'Alfio|I258 Sant'Ambrogio di Torino|I259 Sant'Ambrogio di Valpolicella|I256 Sant'Ambrogio sul Garigliano|I262 Sant'Anastasia|I263 Sant'Anatolia di Narco|I266 Sant'Andrea Apostolo dello Ionio|I265 Sant'Andrea del Garigliano|I264 Sant'Andrea di Conza|I271 Sant'Andrea Frius|I277 Sant'Angelo a Cupolo|I278 Sant'Angelo a Fasanella|I280 Sant'Angelo a Scala|I279 Sant'Angelo all'Esca|I273 Sant'Angelo d'Alife|I281 Sant'Angelo dei Lombardi|I282 Sant'Angelo del Pesco|I283 Sant'Angelo di Brolo|I275 Sant'Angelo di Piove di Sacco|I286 Sant'Angelo in Pontano|I287 Sant'Angelo in Vado|I288 Sant'Angelo Le Fratte|I289 Sant'Angelo Limosano|I274 Sant'Angelo Lodigiano|I276 Sant'Angelo Lomellina|I290 Sant'Angelo Muxaro|I284 Sant'Angelo Romano|M209 Sant'Anna Arresi|I292 Sant'Anna d'Alfaedo|I293 Sant'Antimo|I294 Sant'Antioco|I296 Sant'Antonino di Susa|I300 Sant'Antonio Abate|M276 Sant'Antonio di Gallura|I302 Sant'Apollinare|I305 Sant'Arcangelo|F557 Sant'Arcangelo Trimonte|I306 Sant'Arpino|I307 Sant'Arsenio|I318 Sant'Egidio alla Vibrata|I317 Sant'Egidio del Monte Albino|I319 Sant'Elena|B466 Sant'Elena Sannita|I320 Sant'Elia a Pianisi|I321 Sant'Elia Fiumerapido|I324 Sant'Elpidio a Mare|I332 Sant'Eufemia a Maiella|I333 Sant'Eufemia d'Aspromonte|I335 Sant'Eusanio del Sangro|I336 Sant'Eusanio Forconese|I342 Sant'Ilario d'Enza|I341 Sant'Ilario dello Ionio|I344 Sant'Ippolito|I346 Sant'Olcese|I348 Sant'Omero|M333 Sant'Omobono Terme|I350 Sant'Onofrio|I352 Sant'Oreste|I354 Sant'Orsola Terme|I375 Sant'Urbano|I168 Santa Brigida|I171 Santa Caterina Albanese|I170 Santa Caterina dello Ionio|I169 Santa Caterina Villarmosa|I172 Santa Cesarea Terme|I176 Santa Cristina d'Aspromonte|I175 Santa Cristina e Bissone|I174 Santa Cristina Gela|I173 Santa Cristina Valgardena|I178 Santa Croce Camerina|I179 Santa Croce del Sannio|I181 Santa Croce di Magliano|I177 Santa Croce sull'Arno|I183 Santa Domenica Talao|I184 Santa Domenica Vittoria|I185 Santa Elisabetta|I187 Santa Fiora|I188 Santa Flavia|I203 Santa Giuletta|I205 Santa Giusta|I206 Santa Giustina|I207 Santa Giustina in Colle|I217 Santa Luce|I220 Santa Lucia del Mela|I221 Santa Lucia di Piave|I219 Santa Lucia di Serino|I224 Santa Margherita di Belice|I230 Santa Margherita di Staffora|I225 Santa Margherita Ligure|I232 Santa Maria a Monte|I233 Santa Maria a Vico|I234 Santa Maria Capua Vetere|M284 Santa Maria Coghinas|C717 Santa Maria del Cedro|I238 Santa Maria del Molise|I237 Santa Maria della Versa|I240 Santa Maria di Licodia|I242 Santa Maria di Sala|I243 Santa Maria Hoè|I244 Santa Maria Imbaro|M273 Santa Maria la Carità|I247 Santa Maria la Fossa|I248 Santa Maria la Longa|I249 Santa Maria Maggiore|I251 Santa Maria Nuova|I253 Santa Marina|I254 Santa Marina Salina|I255 Santa Marinella|I291 Santa Ninfa|I301 Santa Paolina|I308 Santa Severina|I310 Santa Sofia|I309 Santa Sofia d'Epiro|I311 Santa Teresa di Riva|I312 Santa Teresa Gallura|I314 Santa Venerina|I316 Santa Vittoria d'Alba|I315 Santa Vittoria in Matenano|I182 Santadi|I304 Santarcangelo di Romagna|I326 Sante Marie|I327 Santena|I330 Santeramo in Colle|I337 Santhià|I339 Santi Cosma e Damiano|I365 Santo Stefano al Mare|I367 Santo Stefano Belbo|I368 Santo Stefano d'Aveto|I357 Santo Stefano del Sole|C919 Santo Stefano di Cadore|I370 Santo Stefano di Camastra|I363 Santo Stefano di Magra|I359 Santo Stefano di Rogliano|I360 Santo Stefano di Sessanio|I371 Santo Stefano in Aspromonte|I362 Santo Stefano Lodigiano|I356 Santo Stefano Quisquina|I372 Santo Stefano Roero|I361 Santo Stefano Ticino|I260 Santomenna|I351 Santopadre|I353 Santorso|I374 Santu Lussurgiu|I410 Sanza|I411 Sanzeno|I418 Saonara|I420 Saponara|I421 Sappada|I422 Sapri|I423 Saracena|I424 Saracinesco|I425 Sarcedo|I426 Sarconi|I428 Sardara|I429 Sardigliano|I430 Sarego|I431 Sarentino|I432 Sarezzano|I433 Sarezzo|I434 Sarmato|I435 Sarmede|I436 Sarnano|I437 Sarnico|I438 Sarno|I439 Sarnonico|I441 Saronno|I442 Sarre|I443 Sarroch|I444 Sarsina|I445 Sarteano|I447 Sartirana Lomellina|I448 Sarule|I449 Sarzana|I451 Sassano|I452 Sassari|I453 Sassello|I454 Sassetta|I455 Sassinoro|I457 Sasso di Castalda|G972 Sasso Marconi|M413 Sassocorvaro Auditore|I460 Sassofeltrio|I461 Sassoferrato|I462 Sassuolo|I463 Satriano|G614 Satriano di Lucania|I464 Sauris|I466 Sauze d'Oulx|I465 Sauze di Cesana|I467 Sava|I468 Savelli|I469 Saviano|I470 Savigliano|I471 Savignano Irpino|I473 Savignano sul Panaro|I472 Savignano sul Rubicone|I475 Savignone|I476 Saviore dell'Adamello|I477 Savoca|I478 Savogna|I479 Savogna d'Isonzo|H730 Savoia di Lucania|I480 Savona|I482 Scafa|I483 Scafati|I484 Scagnello|I486 Scala|I485 Scala Coeli|I487 Scaldasole|I489 Scalea|I490 Scalenghe|I492 Scaletta Zanclea|I493 Scampitella|I494 Scandale|I496 Scandiano|B962 Scandicci|I497 Scandolara Ravara|I498 Scandolara Ripa d'Oglio|I499 Scandriglia|I501 Scanno|I503 Scano di Montiferro|I504 Scansano|M256 Scanzano Jonico|I506 Scanzorosciate|I507 Scapoli|I510 Scarlino|I511 Scarmagno|I512 Scarnafigi|M326 Scarperia e San Piero|I519 Scena|I520 Scerni|I522 Scheggia e Pascelupo|I523 Scheggino|I526 Schiavi di Abruzzo|I527 Schiavon|I529 Schignano|I530 Schilpario|I531 Schio|I532 Schivenoglia|I533 Sciacca|I534 Sciara|I535 Scicli|I536 Scido|D290 Scigliano|I537 Scilla|I538 Scillato|I539 Sciolze|I540 Scisciano|I541 Sclafani Bagni|I543 Scontrone|I544 Scopa|I545 Scopello|I546 Scoppito|I548 Scordia|I549 Scorrano|I551 Scorzè|I553 Scurcola Marsicana|I554 Scurelle|I555 Scurzolengo|I556 Seborga|I558 Secinaro|I559 Seclì|I561 Secugnago|I562 Sedegliano|I563 Sedico|I564 Sedilo|I565 Sedini|I566 Sedriano|I567 Sedrina|I569 Sefro|I570 Segariu|I571 Seggiano|I573 Segni|I576 Segonzano|I577 Segrate|I578 Segusino|I580 Selargius|I581 Selci|I582 Selegas|M360 Sella Giudicarie|I585 Sellano|I588 Sellero|I589 Sellia|I590 Sellia Marina|I593 Selva dei Molini|I592 Selva di Cadore|I594 Selva di Progno|I591 Selva di Val Gardena|I595 Selvazzano Dentro|I597 Selvino|I598 Semestene|I599 Semiana|I600 Seminara|I601 Semproniano|I602 Senago|I603 Senale-San Felice|I604 Senales|I605 Seneghe|I606 Senerchia|I607 Seniga|I608 Senigallia|I609 Senis|I610 Senise|I611 Senna Comasco|I612 Senna Lodigiana|I613 Sennariolo|I614 Sennori|I615 Senorbì|I618 Sepino|I621 Sequals|I622 Seravezza|I624 Serdiana|I625 Seregno|I626 Seren del Grappa|I627 Sergnano|I628 Seriate|I629 Serina|I630 Serino|I631 Serle|I632 Sermide e Felonica|I634 Sermoneta|I635 Sernaglia della Battaglia|I636 Sernio|I637 Serole|I642 Serra d'Aiello|I643 Serra de' Conti|I640 Serra Riccò|I639 Serra San Bruno|I653 Serra San Quirico|I654 Serra Sant'Abbondio|I641 Serracapriola|I644 Serradifalco|I646 Serralunga d'Alba|I645 Serralunga di Crea|I647 Serramanna|F357 Serramazzoni|I648 Serramezzana|I649 Serramonacesca|I651 Serrapetrona|I652 Serrara Fontana|I655 Serrastretta|I656 Serrata|I662 Serravalle a Po|I661 Serravalle di Chienti|I659 Serravalle Langhe|I660 Serravalle Pistoiese|I657 Serravalle Scrivia|I663 Serravalle Sesia|I666 Serre|I667 Serrenti|I668 Serri|I669 Serrone|I671 Sersale|C070 Servigliano|I676 Sessa Aurunca|I677 Sessa Cilento|I678 Sessame|I679 Sessano del Molise|E070 Sesta Godano|I681 Sestino|I687 Sesto|I686 Sesto al Reghena|I688 Sesto Calende|I682 Sesto Campano|I683 Sesto ed Uniti|I684 Sesto Fiorentino|I690 Sesto San Giovanni|I689 Sestola|I693 Sestri Levante|I692 Sestriere|I695 Sestu|I696 Settala|I697 Settefrati|I698 Settime|I700 Settimo Milanese|I701 Settimo Rottaro|I699 Settimo San Pietro|I703 Settimo Torinese|I702 Settimo Vittone|I704 Settingiano|I705 Setzu|I706 Seui|I707 Seulo|I709 Seveso|I711 Sezzadio|I712 Sezze|I714 Sfruz|I715 Sgonico|I716 Sgurgola|I717 Siamaggiore|I718 Siamanna|I720 Siano|I721 Siapiccia|M253 Sicignano degli Alburni|I723 Siculiana|I724 Siddi|I725 Siderno|I726 Siena|I727 Sigillo|I728 Signa|I729 Silandro|I730 Silanus|F116 Silea|I732 Siligo|I734 Siliqua|I735 Silius|M347 Sillano Giuncugnano|I736 Sillavengo|I738 Silvano d'Orba|I739 Silvano Pietra|I741 Silvi|I742 Simala|I743 Simaxis|I744 Simbario|I745 Simeri Crichi|I747 Sinagra|A468 Sinalunga|I748 Sindia|I749 Sini|I750 Sinio|I751 Siniscola|I752 Sinnai|I753 Sinopoli|I754 Siracusa|I756 Sirignano|I757 Siris|I633 Sirmione|I758 Sirolo|I759 Sirone|I761 Sirtori|M325 Sissa Trecasali|I765 Siurgus Donigala|E265 Siziano|I767 Sizzano|I771 Sluderno|I774 Smerillo|I775 Soave|I777 Socchieve|I778 Soddì|I779 Sogliano al Rubicone|I780 Sogliano Cavour|I781 Soglio|I782 Soiano del Lago|I783 Solagna|I785 Solarino|I786 Solaro|I787 Solarolo|I790 Solarolo Rainerio|I791 Solarussa|I793 Solbiate Arno|M412 Solbiate con Cagno|I794 Solbiate Olona|I796 Soldano|I797 Soleminis|I798 Solero|I799 Solesino|I800 Soleto|I801 Solferino|I802 Soliera|I803 Solignano|I805 Solofra|I808 Solonghello|I809 Solopaca|I812 Solto Collina|I813 Solza|I815 Somaglia|I817 Somano|I819 Somma Lombardo|I820 Somma Vesuviana|I821 Sommacampagna|I822 Sommariva del Bosco|I823 Sommariva Perno|I824 Sommatino|I825 Sommo|I826 Sona|I827 Soncino|I828 Sondalo|I829 Sondrio|I830 Songavazzo|I831 Sonico|I832 Sonnino|I838 Sora|I839 Soraga di Fassa|I840 Soragna|I841 Sorano|I844 Sorbo San Basile|I843 Sorbo Serpico|M411 Sorbolo Mezzani|I847 Sordevolo|I848 Sordio|I849 Soresina|I850 Sorgà|I851 Sorgono|I852 Sori|I853 Sorianello|I854 Soriano Calabro|I855 Soriano nel Cimino|I856 Sorico|I857 Soriso|I858 Sorisole|I860 Sormano|I861 Sorradile|I862 Sorrento|I863 Sorso|I864 Sortino|I865 Sospiro|I866 Sospirolo|I867 Sossano|I868 Sostegno|I869 Sotto il Monte Giovanni XXIII|I871 Sover|I872 Soverato|I873 Sovere|I874 Soveria Mannelli|I875 Soveria Simeri|I876 Soverzene|I877 Sovicille|I878 Sovico|I879 Sovizzo|I673 Sovramonte|I880 Sozzago|I881 Spadafora|I884 Spadola|I885 Sparanise|I886 Sparone|I887 Specchia|I888 Spello|I891 Sperlinga|I892 Sperlonga|I893 Sperone|I894 Spessa|I895 Spezzano Albanese|I896 Spezzano della Sila|I899 Spiazzo|I901 Spigno Monferrato|I902 Spigno Saturnia|I903 Spilamberto|I904 Spilimbergo|I905 Spilinga|I906 Spinadesco|I907 Spinazzola|I908 Spinea|I909 Spineda|I910 Spinete|I911 Spineto Scrivia|I912 Spinetoli|I914 Spino d'Adda|I916 Spinone al Lago|I917 Spinoso|I919 Spirano|I921 Spoleto|I922 Spoltore|I923 Spongano|I924 Spormaggiore|I925 Sporminore|I926 Spotorno|I927 Spresiano|I928 Spriana|I929 Squillace|I930 Squinzano|I932 Staffolo|I935 Stagno Lombardo|I936 Staiti|I937 Stalettì|I938 Stanghella|I939 Staranzano|M298 Statte|I941 Stazzano|I942 Stazzema|I943 Stazzona|I945 Stefanaconi|I946 Stella|G887 Stella Cilento|I947 Stellanello|I948 Stelvio|I949 Stenico|I950 Sternatia|I951 Stezzano|I953 Stienta|I954 Stigliano|I955 Stignano|I956 Stilo|I959 Stimigliano|M290 Stintino|I960 Stio|I962 Stornara|I963 Stornarella|I964 Storo|I965 Stra|I968 Stradella|I969 Strambinello|I970 Strambino|I973 Strangolagalli|I974 Stregna|I975 Strembo|I976 Stresa|I977 Strevi|I978 Striano|I980 Strona|I981 Stroncone|I982 Strongoli|I984 Stroppiana|I985 Stroppo|I986 Strozza|I990 Sturno|B014 Suardi|I991 Subbiano|I992 Subiaco|I993 Succivo|I994 Sueglio|I995 Suelli|I996 Suello|I997 Suisio|I998 Sulbiate|I804 Sulmona|L002 Sulzano|L003 Sumirago|L004 Summonte|L006 Suni|L007 Suno|L008 Supersano|L009 Supino|L010 Surano|L011 Surbo|L013 Susa|L014 Susegana|L015 Sustinente|L016 Sutera|L017 Sutri|L018 Sutrio|L019 Suvereto|L020 Suzzara|L022 Taceno|L023 Tadasuni|L024 Taggia|L025 Tagliacozzo|L026 Taglio di Po|L027 Tagliolo Monferrato|L030 Taibon Agordino|L032 Taino|G736 Taipana|L034 Talamello|L035 Talamona|L036 Talana|L037 Taleggio|L038 Talla|L039 Talmassons|L040 Tambre|L042 Taormina|L046 Tarano|L047 Taranta Peligna|L048 Tarantasca|L049 Taranto|L050 Tarcento|D024 Tarquinia|L055 Tarsia|L056 Tartano|L057 Tarvisio|L058 Tarzo|L059 Tassarolo|L061 Taurano|L062 Taurasi|L063 Taurianova|L064 Taurisano|L065 Tavagnacco|L066 Tavagnasco|F260 Tavazzano con Villavesco|L069 Tavenna|L070 Taverna|L071 Tavernerio|L073 Tavernola Bergamasca|C698 Tavernole sul Mella|L074 Taviano|L075 Tavigliano|L078 Tavoleto|L081 Tavullia|L082 Teana|L083 Teano|D292 Teggiano|L084 Teglio|L085 Teglio Veneto|L086 Telese Terme|L087 Telgate|L088 Telti|L089 Telve|L090 Telve di Sopra|L093 Tempio Pausania|L094 Temù|L096 Tenna|L097 Tenno|L100 Teolo|L102 Teora|L103 Teramo|L104 Terdobbiate|L105 Terelle|L106 Terento|E548 Terenzo|M282 Tergu|L108 Terlano|L109 Terlizzi|M210 Terme Vigliatore|L111 Termeno sulla strada del vino|L112 Termini Imerese|L113 Termoli|L115 Ternate|L116 Ternengo|L117 Terni|L118 Terno d'Isola|L120 Terracina|L121 Terragnolo|L122 Terralba|L124 Terranova da Sibari|L125 Terranova dei Passerini|L126 Terranova di Pollino|L127 Terranova Sappo Minulio|L123 Terranuova Bracciolini|L131 Terrasini|L132 Terrassa Padovana|L134 Terravecchia|L136 Terrazzo|M407 Terre d'Adige|M381 Terre del Reno|M379 Terre Roveresche|L138 Terricciola|L139 Terruggia|L140 Tertenia|L142 Terzigno|L143 Terzo|L144 Terzo d'Aquileia|L145 Terzolas|L146 Terzorio|L147 Tesero|L149 Tesimo|L150 Tessennano|L152 Testico|L153 Teti|L154 Teulada|L155 Teverola|L156 Tezze sul Brenta|L157 Thiene|L158 Thiesi|L160 Tiana|L164 Ticengo|L165 Ticineto|L166 Tiggiano|L167 Tiglieto|L168 Tigliole|L169 Tignale|L172 Tinnura|L173 Tione degli Abruzzi|L174 Tione di Trento|L175 Tirano|L176 Tires|L177 Tiriolo|L178 Tirolo|L180 Tissi|L181 Tito|L182 Tivoli|L183 Tizzano Val Parma|L184 Toano|L185 Tocco Caudio|L186 Tocco da Casauria|L187 Toceno|L188 Todi|L189 Toffia|L190 Toirano|L191 Tolentino|L192 Tolfa|L193 Tollegno|L194 Tollo|L195 Tolmezzo|L197 Tolve|L199 Tombolo|L200 Ton|L202 Tonara|L203 Tonco|L204 Tonengo|D717 Tonezza del Cimone|L205 Tora e Piccilli|L206 Torano Castello|L207 Torano Nuovo|L210 Torbole Casaglia|L211 Torcegno|L212 Torchiara|L213 Torchiarolo|L214 Torella dei Lombardi|L215 Torella del Sannio|L216 Torgiano|L217 Torgnon|L219 Torino|L218 Torino di Sangro|L220 Toritto|L221 Torlino Vimercati|L223 Tornaco|L224 Tornareccio|L225 Tornata|L227 Tornimparte|L228 Torno|L229 Tornolo|L230 Toro|L231 Torpè|L233 Torraca|L235 Torralba|L237 Torrazza Coste|L238 Torrazza Piemonte|L239 Torrazzo|L245 Torre Annunziata|L250 Torre Beretti e Castellaro|L251 Torre Boldone|L252 Torre Bormida|L243 Torre Cajetani|L247 Torre Canavese|L256 Torre d'Arese|L269 Torre d'Isola|L257 Torre de' Busi|L262 Torre de' Negri|L263 Torre de' Passeri|L258 Torre de' Picenardi|L265 Torre de' Roveri|L259 Torre del Greco|L267 Torre di Mosto|L240 Torre di Ruggiero|L244 Torre di Santa Maria|L272 Torre Le Nocelle|L241 Torre Mondovì|L274 Torre Orsaia|L276 Torre Pallavicina|L277 Torre Pellice|L278 Torre San Giorgio|L279 Torre San Patrizio|L280 Torre Santa Susanna|L246 Torreano|L248 Torrebelvicino|L253 Torrebruna|L254 Torrecuso|L270 Torreglia|L271 Torregrotta|L273 Torremaggiore|M286 Torrenova|L281 Torresina|L282 Torretta|L285 Torrevecchia Pia|L284 Torrevecchia Teatina|L287 Torri del Benaco|L297 Torri di Quartesolo|L286 Torri in Sabina|L290 Torrice|L294 Torricella|L296 Torricella del Pizzo|L293 Torricella in Sabina|L291 Torricella Peligna|L295 Torricella Sicura|L292 Torricella Verzate|L298 Torriglia|L299 Torrile|L301 Torrioni|L303 Torrita di Siena|L302 Torrita Tiberina|A355 Tortolì|L304 Tortona|L305 Tortora|L306 Tortorella|L307 Tortoreto|L308 Tortorici|L309 Torviscosa|L312 Toscolano-Maderno|L314 Tossicia|L316 Tovo di Sant'Agata|L315 Tovo San Giacomo|L317 Trabia|L319 Tradate|L321 Tramatza|L322 Trambileno|L323 Tramonti|L324 Tramonti di Sopra|L325 Tramonti di Sotto|L326 Tramutola|L327 Trana|L328 Trani|L330 Traona|L331 Trapani|L332 Trappeto|L333 Trarego Viggiona|L334 Trasacco|L335 Trasaghis|L336 Trasquera|L337 Tratalias|I236 Travacò Siccomario|L339 Travagliato|L342 Travedona-Monate|L345 Traversella|L346 Traversetolo|L340 Traves|L347 Travesio|L348 Travo|M361 Tre Ville|L349 Trebaseleghe|L353 Trebisacce|M280 Trecase|L355 Trecastagni|M318 Trecastelli|L356 Trecate|L357 Trecchina|L359 Trecenta|L361 Tredozio|L363 Treglio|L364 Tregnago|L366 Treia|L367 Treiso|L369 Tremestieri Etneo|M341 Tremezzina|L372 Tremosine sul Garda|L377 Trentinara|L378 Trento|L379 Trentola Ducenta|L380 Trenzano|L382 Treppo Grande|M399 Treppo Ligosullo|L383 Trepuzzi|L384 Trequanda|L386 Tresana|L388 Trescore Balneario|L389 Trescore Cremasco|M409 Tresignana|L392 Tresivio|L393 Tresnuraghes|L396 Trevenzuolo|L397 Trevi|L398 Trevi nel Lazio|L399 Trevico|L400 Treviglio|L402 Trevignano|L401 Trevignano Romano|L403 Treville|L404 Treviolo|L407 Treviso|L406 Treviso Bresciano|L408 Trezzano Rosa|L409 Trezzano sul Naviglio|L411 Trezzo sull'Adda|L410 Trezzo Tinella|L413 Trezzone|L414 Tribano|L415 Tribiano|L416 Tribogna|L418 Tricarico|L419 Tricase|L420 Tricerro|L421 Tricesimo|L423 Triei|L424 Trieste|L425 Triggiano|L426 Trigolo|L427 Trinità|L428 Trinità d'Agultu e Vignola|B915 Trinitapoli|L429 Trino|L430 Triora|L431 Tripi|L432 Trisobbio|L433 Trissino|L434 Triuggio|L435 Trivento|L437 Trivigliano|L438 Trivignano Udinese|L439 Trivigno|L440 Trivolzio|L444 Trodena nel parco naturale|L445 Trofarello|L447 Troia|L448 Troina|L449 Tromello|L450 Trontano|A705 Tronzano Lago Maggiore|L451 Tronzano Vercellese|L452 Tropea|L453 Trovo|L454 Truccazzano|L455 Tubre|L458 Tufara|L459 Tufillo|L460 Tufino|L461 Tufo|L462 Tuglie|L463 Tuili|L464 Tula|L466 Tuoro sul Trasimeno|G507 Turania|L469 Turano Lodigiano|L470 Turate|L471 Turbigo|L472 Turi|L473 Turri|L474 Turriaco|L475 Turrivalignani|L477 Tursi|L478 Tusa|L310 Tuscania|C789 Ubiale Clanezzo|L480 Uboldo|L482 Ucria|L483 Udine|L484 Ugento|L485 Uggiano la Chiesa|L487 Uggiate-Trevano|L488 Ulà Tirso|L489 Ulassai|L490 Ultimo|D786 Umbertide|L492 Umbriatico|L494 Urago d'Oglio|L496 Uras|L497 Urbana|L498 Urbania|L499 Urbe|L500 Urbino|L501 Urbisaglia|L502 Urgnano|L503 Uri|L505 Ururi|L506 Urzulei|L507 Uscio|L508 Usellus|L509 Usini|L511 Usmate Velate|L512 Ussana|L513 Ussaramanna|L514 Ussassai|L515 Usseaux|L516 Usseglio|L517 Ussita|L519 Ustica|L521 Uta|L522 Uzzano|L524 Vaccarizzo Albanese|L525 Vacone|L526 Vacri|L527 Vadena|L528 Vado Ligure|L533 Vagli Sotto|L529 Vaglia|L532 Vaglio Basilicata|L531 Vaglio Serra|L537 Vaiano|L535 Vaiano Cremasco|L538 Vaie|L539 Vailate|L540 Vairano Patenora|M265 Vajont|M334 Val Brembilla|L555 Val della Torre|M405 Val di Chy|L562 Val di Nizza|L564 Val di Vizze|M374 Val di Zoldo|M384 Val Liona|L638 Val Masino|H259 Val Rezzo|L544 Valbondione|L545 Valbrembo|M423 Valbrenta|L546 Valbrevenna|L547 Valbrona|M415 Valchiusa|L551 Valdagno|M343 Valdaone|L552 Valdaora|L554 Valdastico|L556 Valdengo|G319 Valderice|L557 Valdidentro|L558 Valdieri|M417 Valdilana|L561 Valdina|L563 Valdisotto|L565 Valdobbiadene|L566 Valduggia|L568 Valeggio|L567 Valeggio sul Mincio|L569 Valentano|L570 Valenza|L571 Valenzano|L572 Valera Fratta|L573 Valfabbrica|L574 Valfenera|L575 Valfloriana|M382 Valfornace|L576 Valfurva|L577 Valganna|L578 Valgioie|L579 Valgoglio|L580 Valgrana|L581 Valgreghentino|L582 Valgrisenche|L583 Valguarnera Caropepe|L584 Vallada Agordina|L586 Vallanzengo|L588 Vallarsa|L589 Vallata|L594 Valle Agricola|L595 Valle Aurina|M404 Valle Cannobina|L597 Valle Castellana|G540 Valle dell'Angelo|L590 Valle di Cadore|L601 Valle di Casies|L591 Valle di Maddaloni|L593 Valle Lomellina|L617 Valle Salimbene|L620 Valle San Nicolao|L596 Vallebona|L598 Vallecorsa|L599 Vallecrosia|L603 Valledolmo|L604 Valledoria|I322 Vallefiorita|M331 Vallefoglia|M362 Vallelaghi|L607 Vallelonga|L609 Vallelunga Pratameno|L605 Vallemaio|L611 Vallepietra|L612 Vallerano|L613 Vallermosa|L614 Vallerotonda|L616 Vallesaccarda|L623 Valleve|L624 Valli del Pasubio|L625 Vallinfreda|L626 Vallio Terme|L628 Vallo della Lucania|L627 Vallo di Nera|L629 Vallo Torinese|L631 Valloriate|L633 Valmacca|L634 Valmadrera|L639 Valmontone|L640 Valmorea|L641 Valmozzola|L642 Valnegra|L643 Valpelline|L644 Valperga|B510 Valprato Soana|M320 Valsamoggia|L647 Valsavarenche|D513 Valsinni|C936 Valsolda|L651 Valstrona|L653 Valtopina|L655 Valtorta|L654 Valtournenche|L656 Valva|M395 Valvarrone|M346 Valvasone Arzene|L658 Valverde|L468 Valvestino|L660 Vandoies|L664 Vanzaghello|L665 Vanzago|L666 Vanzone con San Carlo|L667 Vaprio d'Adda|L668 Vaprio d'Agogna|L669 Varallo|L670 Varallo Pombia|L671 Varano Borghi|L672 Varano de' Melegari|L673 Varapodio|L675 Varazze|L676 Varco Sabino|L677 Varedo|L680 Varenna|L682 Varese|L681 Varese Ligure|L685 Varisella|L686 Varmo|L687 Varna|L689 Varsi|L690 Varzi|L691 Varzo|A701 Vasanello|L693 Vasia|E372 Vasto|L696 Vastogirardi|L698 Vauda Canavese|L699 Vazzano|L700 Vazzola|L702 Vecchiano|L704 Vedano al Lambro|L703 Vedano Olona|L706 Vedelago|L707 Vedeseta|L709 Veduggio con Colzano|L710 Veggiano|L711 Veglie|L712 Veglio|L713 Vejano|L715 Veleso|L716 Velezzo Lomellina|L719 Velletri|L720 Vellezzo Bellini|L723 Velo d'Astico|L722 Velo Veronese|L724 Velturno|L725 Venafro|L727 Venaria Reale|L728 Venarotta|L729 Venasca|L726 Venaus|L730 Vendone|L733 Venegono Inferiore|L734 Venegono Superiore|L735 Venetico|L736 Venezia|L737 Veniano|L738 Venosa|M364 Ventasso|L739 Venticano|L741 Ventimiglia|L740 Ventimiglia di Sicilia|L742 Ventotene|L743 Venzone|L745 Verano|L744 Verano Brianza|L746 Verbania|L747 Verbicaro|L748 Vercana|L749 Verceia|L750 Vercelli|L751 Vercurago|L752 Verdellino|L753 Verdello|M337 Verderio|L758 Verduno|L762 Vergato|L764 Verghereto|L765 Vergiate|M424 Vermezzo con Zelo|L769 Vermiglio|L771 Vernante|L772 Vernasca|L773 Vernate|L774 Vernazza|L775 Vernio|L776 Vernole|L777 Verolanuova|L778 Verolavecchia|L779 Verolengo|L780 Veroli|L781 Verona|D193 Veronella|L783 Verrayes|C282 Verrès|L784 Verretto|L785 Verrone|L788 Verrua Po|L787 Verrua Savoia|L792 Vertemate con Minoprio|L795 Vertova|L797 Verucchio|L799 Vervio|L801 Verzegnis|L802 Verzino|L804 Verzuolo|L805 Vescovana|L806 Vescovato|L807 Vesime|L808 Vespolate|L809 Vessalico|L810 Vestenanova|L811 Vestignè|L812 Vestone|L814 Vetralla|L815 Vetto|L817 Vezza d'Alba|L816 Vezza d'Oglio|L819 Vezzano Ligure|L820 Vezzano sul Crostolo|L823 Vezzi Portio|L826 Viadana|L827 Viadanica|L828 Viagrande|L829 Viale|L830 Vialfrè|L831 Viano|L833 Viareggio|L834 Viarigi|F537 Vibo Valentia|L835 Vibonati|L836 Vicalvi|L837 Vicari|L838 Vicchio|L840 Vicenza|L842 Vico del Gargano|L845 Vico Equense|L843 Vico nel Lazio|L841 Vicoforte|L846 Vicoli|L847 Vicolungo|L850 Vicopisano|L851 Vicovaro|M259 Viddalba|L854 Vidigulfo|L856 Vidor|L857 Vidracco|L858 Vieste|L859 Vietri di Potenza|L860 Vietri sul Mare|L866 Viganò|L865 Vigano San Martino|L868 Vigarano Mainarda|L869 Vigasio|L872 Vigevano|L873 Viggianello|L874 Viggiano|L876 Viggiù|L878 Vighizzolo d'Este|L880 Vigliano Biellese|L879 Vigliano d'Asti|L881 Vignale Monferrato|L882 Vignanello|L883 Vignate|L885 Vignola|L886 Vignola-Falesina|L887 Vignole Borbera|L888 Vignolo|L889 Vignone|L890 Vigo di Cadore|L892 Vigodarzere|L894 Vigolo|L897 Vigolzone|L898 Vigone|L899 Vigonovo|L900 Vigonza|L904 Viguzzolo|L912 Villa Bartolomea|L913 Villa Basilica|L917 Villa Biscossi|L919 Villa Carcina|L920 Villa Castelli|L922 Villa Celiera|L926 Villa Collemandina|L928 Villa Cortese|L929 Villa d'Adda|A215 Villa d'Almè|L938 Villa d'Ogna|L933 Villa del Bosco|L934 Villa del Conte|D801 Villa di Briano|L907 Villa di Chiavenna|L936 Villa di Serio|L908 Villa di Tirano|L937 Villa Estense|L943 Villa Faraldi|L956 Villa Guardia|L957 Villa Lagarina|A081 Villa Latina|L844 Villa Literno|L969 Villa Minozzo|M018 Villa San Giovanni|H913 Villa San Giovanni in Tuscia|I118 Villa San Pietro|M019 Villa San Secondo|M023 Villa Sant'Angelo|I298 Villa Sant'Antonio|L905 Villa Santa Lucia|M021 Villa Santa Lucia degli Abruzzi|M022 Villa Santa Maria|L909 Villa Santina|I364 Villa Santo Stefano|A609 Villa Verde|L915 Villabassa|L916 Villabate|L923 Villachiara|L924 Villacidro|L931 Villadeati|L939 Villadose|L906 Villadossola|L942 Villafalletto|L945 Villafranca d'Asti|L949 Villafranca di Verona|L946 Villafranca in Lunigiana|L947 Villafranca Padovana|L948 Villafranca Piemonte|L944 Villafranca Sicula|L950 Villafranca Tirrena|L951 Villafrati|L952 Villaga|L953 Villagrande Strisaili|L958 Villalago|L959 Villalba|L961 Villalfonsina|L963 Villalvernia|L964 Villamagna|L965 Villamaina|L966 Villamar|L967 Villamarzana|L968 Villamassargia|L970 Villamiroglio|L971 Villandro|L978 Villanova Biellese|L982 Villanova Canavese|L975 Villanova d'Albenga|L983 Villanova d'Ardenghi|L984 Villanova d'Asti|L973 Villanova del Battista|L985 Villanova del Ghebbo|L977 Villanova del Sillaro|L979 Villanova di Camposampiero|L988 Villanova Marchesana|L974 Villanova Mondovì|L972 Villanova Monferrato|L989 Villanova Monteleone|L990 Villanova Solaro|L980 Villanova sull'Arda|L991 Villanova Truschedu|L992 Villanova Tulo|L986 Villanovaforru|L987 Villanovafranca|L994 Villanterio|L995 Villanuova sul Clisi|M278 Villaperuccio|B903 Villapiana|L998 Villaputzu|L999 Villar Dora|M007 Villar Focchiardo|M013 Villar Pellice|M014 Villar Perosa|M015 Villar San Costanzo|M002 Villarbasse|M003 Villarboit|M004 Villareggia|G309 Villaricca|M009 Villaromagnano|M011 Villarosa|M016 Villasalto|M017 Villasanta|B738 Villasimius|M025 Villasor|M026 Villaspeciosa|M027 Villastellone|M028 Villata|M030 Villaurbana|M031 Villavallelonga|M032 Villaverla|M363 Ville d'Anaunia|M431 Ville di Fiemme|L981 Villeneuve|M043 Villesse|M041 Villetta Barrea|M042 Villette|M044 Villimpenta|M045 Villongo|M048 Villorba|M050 Vilminore di Scalve|M052 Vimercate|M053 Vimodrone|M055 Vinadio|M057 Vinchiaturo|M058 Vinchio|M059 Vinci|M060 Vinovo|M062 Vinzaglio|M063 Viola|M065 Vione|M067 Vipiteno|M069 Virle Piemonte|M070 Visano|M071 Vische|M072 Visciano|M073 Visco|M077 Visone|M078 Visso|M079 Vistarino|M080 Vistrorio|M081 Vita|M082 Viterbo|M083 Viticuso|M085 Vito d'Asio|M086 Vitorchiano|M088 Vittoria|M089 Vittorio Veneto|M090 Vittorito|M091 Vittuone|M093 Vitulano|M092 Vitulazio|M094 Viù|M096 Vivaro|M095 Vivaro Romano|M098 Viverone|M100 Vizzini|M101 Vizzola Ticino|M102 Vizzolo Predabissi|M103 Vo'|M104 Vobarno|M105 Vobbia|M106 Vocca|M108 Vodo Cadore|M109 Voghera|M110 Voghiera|M111 Vogogna|M113 Volano|M115 Volla|M116 Volongo|M118 Volpago del Montello|M119 Volpara|M120 Volpedo|M121 Volpeglino|M122 Volpiano|M125 Volta Mantovana|M123 Voltaggio|M124 Voltago Agordino|M126 Volterra|M127 Voltido|M131 Volturara Appula|M130 Volturara Irpina|M132 Volturino|M133 Volvera|M136 Vottignasco|M138 Zaccanopoli|M139 Zafferana Etnea|M140 Zagarise|M141 Zagarolo|M143 Zambrone|M144 Zandobbio|M145 Zanè|M147 Zanica|M267 Zapponeta|M150 Zavattarello|M152 Zeccone|M153 Zeddiani|M156 Zelbio|M158 Zelo Buon Persico|M161 Zeme|M162 Zenevredo|M163 Zenson di Piave|M165 Zerba|M166 Zerbo|M167 Zerbolò|M168 Zerfaliu|M169 Zeri|M170 Zermeghedo|M171 Zero Branco|M172 Zevio|M173 Ziano di Fiemme|L848 Ziano Piacentino|M176 Zibido San Giacomo|M177 Zignago|M178 Zimella|M179 Zimone|M180 Zinasco|M182 Zoagli|M183 Zocca|M184 Zogno|M185 Zola Predosa|M187 Zollino|M188 Zone|M189 Zoppè di Cadore|M190 Zoppola|M194 Zovencedo|M196 Zubiena|M197 Zuccarello|M199 Zugliano|M200 Zuglio|M201 Zumaglia|M202 Zumpano|M203 Zungoli|M204 Zungri";

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
    let lastPtsByG = new Map();       // gid -> [{lon,lat,label,d}] civici agganciati (deduplicati)
    let lastDotFeatures = [];         // ultime feature disegnate (per riaccendere la spunta al volo)
    let analyzeTimer = null;
    let busy = false;

    const settings = Object.assign(
        { raggio: 150, titleCase: true, captureMode: 'alt', applyMode: 'extra', autoAnalyze: true, showDots: true, hlColor: '#00e5ff', nameRules: [] },
        (() => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; } })()
    );
    if (!Array.isArray(settings.nameRules)) settings.nameRules = [];
    if (!/^#[0-9a-f]{6}$/i.test(settings.hlColor || '')) settings.hlColor = '#00e5ff';
    if (!settings.captureMode) settings.captureMode = (settings.capture === false) ? 'off' : 'alt'; // migrazione dalla vecchia spunta
    if (!settings.applyMode) settings.applyMode = 'extra';
    const saveSettings = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* ignora */ } };
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
    const idb = {
        put: async (store, val) => {
            const d = await db();
            return new Promise((res, rej) => {
                const t = d.transaction(store, 'readwrite');
                t.objectStore(store).put(val);
                t.oncomplete = res; t.onerror = () => rej(t.error);
            });
        },
        get: async (store, key) => {
            const d = await db();
            return new Promise((res, rej) => {
                const q = d.transaction(store, 'readonly').objectStore(store).get(key);
                q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
            });
        },
        all: async store => {
            const d = await db();
            return new Promise((res, rej) => {
                const q = d.transaction(store, 'readonly').objectStore(store).getAll();
                q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error);
            });
        },
        del: async (store, key) => {
            const d = await db();
            return new Promise((res, rej) => {
                const t = d.transaction(store, 'readwrite');
                t.objectStore(store).delete(key);
                t.oncomplete = res; t.onerror = () => rej(t.error);
            });
        },
        clear: async store => {
            const d = await db();
            return new Promise((res, rej) => {
                const t = d.transaction(store, 'readwrite');
                t.objectStore(store).clear();
                t.oncomplete = res; t.onerror = () => rej(t.error);
            });
        }
    };

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
        initComuniFromPack();
        await buildTab();
        try { sdk.Events.on({ eventName: 'wme-selection-changed', eventHandler: onSelectionChanged }); }
        catch (e) { log('evento selezione KO', e); }
        registerShortcut();
        loadIstat();
        loadCache();
    }

    // Scorciatoia (se l'SDK la supporta) per passare al volo tra ALT+clic / Sempre / Spenta
    function registerShortcut() {
        const cycle = () => {
            settings.captureMode = settings.captureMode === 'alt' ? 'always' : settings.captureMode === 'always' ? 'off' : 'alt';
            saveSettings();
            if (ui.capmode) ui.capmode.value = settings.captureMode;
            updateCapturedUI();
            toast(capModeLabel());
        };
        const tries = [
            () => sdk.Shortcuts.createShortcut({ shortcutId: 'wfit-capture-mode', description: 'Fonti IT: cambia modalit\u00e0 cattura', shortcutKeys: 'A+c', callback: cycle }),
            () => sdk.Shortcuts.createShortcut({ shortcutId: 'wfit-capture-mode', description: 'Fonti IT: cambia modalit\u00e0 cattura', shortcutKeys: null, callback: cycle })
        ];
        for (const t of tries) { try { t(); log('scorciatoia registrata'); return; } catch (e) { /* prossima */ } }
        log('scorciatoie SDK non disponibili');
    }

    function initComuniFromPack() {
        try {
            if (COMUNI_PACK && COMUNI_PACK.length > 100) {
                for (const e of COMUNI_PACK.split('|')) belNome.set(e.slice(0, 4), e.slice(5));
                log(`comuni incorporati: ${belNome.size}`);
            }
        } catch (e) { log('pack comuni KO', e); }
    }

    async function loadCache() {
        try {
            const regs = await idb.all('regioni');
            if (regs.length) {
                rebuildMemory(regs);
                let s = `Cache pronta: ${fmtN(mem.n)} civici (${regs.map(r => r.nomeReg || r.reg).join(', ')}).${regionsFreshnessLabel(regs)}`;
                if (regs.some(r => !r.pv || r.pv < 8)) {
                    s += ` <span style="color:#c60"><b>Cache di una versione precedente: mancano le lettere dei civici (es. 343/A). Premi "Scarica regione" per rigenerarla.</b></span>`;
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
#wfit-panel { --wg:#009246; --ww:#f4f4f2; --wr:#ce2b37; --blu:#0b5ed7; --ink:#22262c; font-size:12px; color:var(--ink);
  container-type:inline-size; max-width:100%; overflow-x:hidden; padding:4px 10px 18px; }
#wfit-panel, #wfit-panel * { box-sizing:border-box; }
#wfit-panel select, #wfit-panel input { max-width:100%; min-width:0; }
#wfit-panel .wfit-res, #wfit-panel .wfit-box { word-break:break-word; overflow-wrap:anywhere; }
#wfit-panel h4 { display:flex; align-items:center; gap:6px; margin:15px 0 9px; font-size:11.5px; font-weight:700;
  text-transform:uppercase; letter-spacing:.6px; color:#333; border-bottom:2px solid;
  border-image:linear-gradient(90deg,var(--wg) 33%,#c9c9c9 33% 66%,var(--wr) 66%) 1; padding-bottom:3px; }
#wfit-panel .wfit-row { display:flex; gap:6px; align-items:center; margin:8px 0; flex-wrap:wrap; }
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
#wfit-panel .wfit-actions { display:flex; gap:5px; flex-wrap:wrap; margin-top:4px; }
#wfit-panel .wfit-hnrev { margin-top:7px; border-top:1px dashed #d8d8d8; padding-top:6px; }
#wfit-panel .wfit-hnrev .wfit-hnlist { max-height:190px; overflow:auto; margin:4px 0; border:1px solid #eee; border-radius:7px; padding:3px 4px; }
#wfit-panel .wfit-hnrow { display:flex; align-items:center; gap:6px; padding:2px 3px; border-radius:5px; cursor:pointer; }
#wfit-panel .wfit-hnrow:hover { background:#eef4ff; }
#wfit-panel .wfit-hnrow b { min-width:44px; }
#wfit-panel .wfit-hnnum { width:70px; min-width:56px; padding:2px 5px; border:1px solid #bbb; border-radius:5px; font-weight:650; font-size:12px; }
#wfit-panel .wfit-hnnum:focus { border-color:var(--blu); outline:none; }
#wfit-panel .wfit-hnnum.wfit-bad-in { border-color:#c33; background:#fdeaea; }
#wfit-panel .wfit-hnadd { display:flex; gap:5px; margin-top:5px; align-items:center; }
#wfit-panel .wfit-hnadd input { flex:1; padding:4px 6px; border:1px solid #bbb; border-radius:6px; font-size:12px; }
#wfit-panel .wfit-actions .wfit-btn { flex:1 1 auto; white-space:nowrap; }
/* Sidebar stretta: righe che si impilano, bottoni a tutta larghezza */
@container (max-width: 270px) {
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
}
`;

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

  <div class="wfit-sec">
  <h4>Dati ANNCSU</h4>
  <div class="wfit-row">
    <select id="wfit-regione">${REGIONI.map(r => `<option value="${r[0]}">${r[1]}</option>`).join('')}</select>
    <button class="wfit-btn wfit-primary" id="wfit-scarica">Scarica regione</button>
  </div>
  <progress id="wfit-prog" max="100" value="0" style="display:none"></progress>
  <div class="wfit-muted" id="wfit-datastatus">Avvio&hellip;</div>
  <details><summary class="wfit-muted">Altre opzioni dati</summary>
    <div class="wfit-row"><button class="wfit-btn" id="wfit-svuota-cache">Svuota tutti i dati salvati</button></div>
  </details>
  </div>

  <div class="wfit-sec">
  <h4>Segmenti</h4>
  <div class="wfit-row">
    <label>Cattura</label>
    <select id="wfit-capmode">
      <option value="alt">&#8997; ALT + clic (consigliata)</option>
      <option value="shift">&#8679; MAIUSC + clic</option>
      <option value="ctrl">&#8963;/&#8984; CTRL + clic (il WME lo usa per la multi-selezione)</option>
      <option value="always">Sempre (ogni clic finisce in lista)</option>
      <option value="off">Spenta (usa "Aggiungi selezione")</option>
    </select>
  </div>
  <div class="wfit-box" id="wfit-selinfo">Lista vuota.</div>
  <div class="wfit-row">
    <button class="wfit-btn" id="wfit-add-sel">Aggiungi selezione attuale</button>
    <button class="wfit-btn" id="wfit-clear-cap">Svuota lista</button>
  </div>
  <div class="wfit-row">
    <label>Evidenzia</label>
    <select id="wfit-hlcolor">
      <option value="#00e5ff">Ciano elettrico (consigliato)</option>
      <option value="#ff2bd6">Fucsia</option>
      <option value="#ffe600">Giallo fluo</option>
      <option value="#a6ff00">Verde lime</option>
      <option value="#ff9500">Arancione acceso</option>
    </select>
  </div>
  <div class="wfit-row">
    <label>Raggio (m)</label><input type="number" id="wfit-raggio" min="20" max="2000" step="10" style="max-width:70px">
    <label><input type="checkbox" id="wfit-titlecase"> Formato Waze</label>
  </div>
  <div class="wfit-row">
    <label><input type="checkbox" id="wfit-autoan"> Auto-analisi</label>
    <label><input type="checkbox" id="wfit-dots"> Civici sulla mappa</label>
  </div>
  <div class="wfit-row" title="Regola Waze Italia per i segmenti fuori dal centro abitato: nome primario con citt&agrave; vuota (Nessuno), nome alternativo con via + citt&agrave;">
    <label>Applica come:</label>
    <label><input type="radio" name="wfit-am" id="wfit-am-extra" value="extra"> Fuori centro abitato (PN senza citt&agrave; + AN con citt&agrave;)</label>
    <label><input type="radio" name="wfit-am" id="wfit-am-urb" value="urb"> Dentro il centro abitato (PN con citt&agrave;)</label>
  </div>
  <div class="wfit-row"><button class="wfit-btn wfit-primary" id="wfit-analizza" style="flex:1">&#128269; Confronta con ANNCSU</button></div>
  </div>

  <div class="wfit-sec">
  <h4>Risultati</h4>
  <div id="wfit-results" class="wfit-muted">Qui appariranno via/contrada, localit&agrave;, comune e i civici agganciati. Scarica la regione e cattura qualche segmento per iniziare.</div>

  </div>

  <details class="wfit-guide"><summary><b>&#8505;&#65039; Come funziona</b></summary>
    <p><span class="wfit-gnum">1 &middot; Scarica i dati.</span> Scegli la regione e premi <b>Scarica regione</b>: lo script legge l'archivio ufficiale ANNCSU (Istat / Agenzia delle Entrate) e salva in locale tutti i civici georiferiti. La cache resta anche ai prossimi avvii, quindi non serve rifarlo a ogni sessione. ANNCSU aggiorna per&ograve; i dataset regionali con <b>cadenza mensile</b> e in questo periodo i Comuni stanno completando la georeferenziazione dei civici (in Italia solo una parte &egrave; ancora geolocalizzata): un giro ogni <b>4&ndash;6 settimane</b> pu&ograve; far comparire strade e numeri prima assenti. Nel pannello trovi sempre scritto da quanti giorni hai scaricato ogni regione (si evidenzia oltre 35 giorni, solo come promemoria: <b>lo script non riscarica mai da solo</b>). "Svuota tutti i dati salvati" riparte da zero.</p>
    <p><span class="wfit-gnum">2 &middot; Cattura i segmenti.</span> <b>ALT + clic</b> su un segmento lo mette in lista e lo evidenzia sulla mappa (bordo scuro + tratteggio nel colore che scegli dal menu <b>Evidenzia</b>). Ri-clic lo toglie, la &times; sul chip pure, il clic sul chip lo seleziona nell'editor. Dal menu <b>Cattura</b> puoi usare un altro tasto (MAIUSC, CTRL/&#8984; &mdash; attenzione: il WME lo usa per la multi-selezione), la modalit&agrave; "Sempre" o spegnerla e usare "Aggiungi selezione attuale". I chip rossi indicano i segmenti dove l'ultimo Applica &egrave; fallito.</p>
    <p><span class="wfit-gnum">3 &middot; Confronta con ANNCSU.</span> Con l'<b>Auto-analisi</b> il confronto parte da solo, altrimenti premi il bottone: entro il <b>Raggio</b> scelto compaiono fino a 8 odonimi ordinati per distanza, ognuno col suo colore, con comune, localit&agrave;/contrada e numero di civici distinti. Con <b>Civici sulla mappa</b> vedi i punti etichettati (343, 343/A&hellip;). Se togli segmenti dalla lista, risultati e mappa si riallineano da soli.</p>
    <p><span class="wfit-gnum">4 &middot; Applica i nomi.</span> Il nome &egrave; in una <b>casella modificabile</b>: correggilo secondo le linee guida (per "Strada Contrada&hellip;" c'&egrave; il link rapido "usa Contrada&hellip;") e lo script <b>impara la tua regola</b>, precompilando cos&igrave; le prossime caselle. Scegli la modalit&agrave;: <b>Fuori centro abitato</b> (regola IT: PN senza citt&agrave; + AN con citt&agrave;) o <b>Dentro</b> (PN con citt&agrave;). "Applica ai segmenti" tocca <b>solo ci&ograve; che differisce</b>, preserva gli alternativi esistenti e dopo ogni scrittura <b>verifica</b> che il WME abbia registrato davvero; se trova alternativi non conformi te li elenca e li rimuove <b>solo se confermi</b>. I segmenti fuori vista vengono recuperati spostando la mappa. Poi <b>salva</b>.</p>
    <p><span class="wfit-gnum">5 &middot; Numeri civici.</span> Dopo il salvataggio, <b>+N civici su Waze</b> apre l'<b>elenco di controllo</b>: clic sulla riga e la mappa si centra sul civico; il numero &egrave; modificabile e si normalizza da solo (18b &rarr; 18/B); i civici oltre <b>45 m</b> dalla strada vengono esclusi (Waze li rifiuterebbe); quelli gi&agrave; presenti compaiono come <b>"gi&agrave; su Waze"</b> e si deselezionano da soli; con <b>"+ Aggiungi al centro mappa"</b> inserisci un civico letto su Street View nel punto dove hai centrato la mappa. Confermi con "Inserisci" (lotti da 50) e salvi. Servono una strada <b>con nome</b> e nessuna modifica pendente: se manca qualcosa, lo script te lo dice prima.</p>
    <p><span class="wfit-gnum">6 &middot; Se qualcosa viene rifiutato.</span> Lo script non pu&ograve; lavorare dove non puoi lavorare tu: se un segmento &egrave; <b>bloccato sopra il tuo livello</b> o comunque non hai i permessi per modificarlo, l'inserimento fallisce e il riepilogo te lo dice &mdash; in quel caso <b>chiedi lo sblocco (unlock) alla community</b> prima di riprovare. Gli altri casi: <b>"strada senza nome"</b> &rarr; dai prima il nome alla strada (puoi catturarla con lo script); <b>"gi&agrave; su Waze"</b> &rarr; il civico esiste gi&agrave; e non viene reinserito. Negli errori del salvataggio WME: "gi&agrave; esistente" &rarr; elimina il doppione; "lato errato" o "fuori sequenza" &rarr; ricontrolla i punti e, se sono corretti sul territorio, usa <b>Salva &rarr; Forza</b>; "troppo lontano dal segmento" &rarr; piazzalo a mano vicino alla strada e trascinalo sul punto reale.</p>
    <p class="wfit-key"><span class="wfit-gnum">7 &middot; La regola pi&ugrave; importante.</span> Questo script <b>non sostituisce il lavoro umano di noi editor: lo facilita</b>. Ogni modifica apportata va controllata con i <b>cartelli stradali</b> e i <b>numeri civici reali</b> dove presenti, con la <b>conoscenza del territorio</b> da parte dell'editor e con <b>buon senso civico</b> nell'utilizzo. Lo strumento propone: la responsabilit&agrave; di ci&ograve; che finisce sulla mappa resta di chi salva.</p>
    <div class="wfit-muted">Lo script modifica solo ci&ograve; che differisce e salta ci&ograve; che &egrave; gi&agrave; a posto: <b>rivedi comunque sempre l'elenco modifiche prima di salvare</b>.</div>
    <p>&#128172; Info, idee o problemi? Scrivimi su <b>Slack</b>: <b>checcoconf</b>.</p>
  </details>

  <div class="wfit-foot">${logoSvg(13, 3)} <b>${SCRIPT_NAME}</b> &middot; a cura di <b>${AUTORE}</b> &middot; dati: ANNCSU (Istat / Agenzia delle Entrate), open data &middot; info: Slack <b>checcoconf</b>.</div>
  <div class="wfit-toast" id="wfit-toast"></div>`;
        tabPane.appendChild(p);

        ui = {
            regione: p.querySelector('#wfit-regione'),
            scarica: p.querySelector('#wfit-scarica'),
            prog: p.querySelector('#wfit-prog'),
            datastatus: p.querySelector('#wfit-datastatus'),
            svuotaCache: p.querySelector('#wfit-svuota-cache'),
            capmode: p.querySelector('#wfit-capmode'),
            hlcolor: p.querySelector('#wfit-hlcolor'),
            selinfo: p.querySelector('#wfit-selinfo'),
            addSel: p.querySelector('#wfit-add-sel'),
            clearCap: p.querySelector('#wfit-clear-cap'),
            raggio: p.querySelector('#wfit-raggio'),
            titlecase: p.querySelector('#wfit-titlecase'),
            autoan: p.querySelector('#wfit-autoan'),
            dots: p.querySelector('#wfit-dots'),
            amExtra: p.querySelector('#wfit-am-extra'),
            amUrb: p.querySelector('#wfit-am-urb'),
            analizza: p.querySelector('#wfit-analizza'),
            results: p.querySelector('#wfit-results'),
            toast: p.querySelector('#wfit-toast')
        };

        ui.raggio.value = settings.raggio;
        ui.titlecase.checked = settings.titleCase;
        ui.capmode.value = settings.captureMode;
        ui.hlcolor.value = settings.hlColor;
        if (ui.hlcolor.value !== settings.hlColor) { settings.hlColor = '#00e5ff'; ui.hlcolor.value = settings.hlColor; }
        ui.autoan.checked = settings.autoAnalyze;
        ui.dots.checked = settings.showDots;
        (settings.applyMode === 'urb' ? ui.amUrb : ui.amExtra).checked = true;
        if (settings.reg) ui.regione.value = settings.reg;

        ui.regione.addEventListener('change', () => { settings.reg = ui.regione.value; saveSettings(); });
        ui.raggio.addEventListener('change', () => { settings.raggio = Math.max(20, parseInt(ui.raggio.value, 10) || 150); saveSettings(); });
        ui.titlecase.addEventListener('change', () => { settings.titleCase = ui.titlecase.checked; saveSettings(); renderResults(lastResults); });
        ui.capmode.addEventListener('change', () => { settings.captureMode = ui.capmode.value; saveSettings(); toast(capModeLabel()); });
        ui.hlcolor.addEventListener('change', () => { settings.hlColor = ui.hlcolor.value; saveSettings(); refreshMapLayer(); });
        ui.autoan.addEventListener('change', () => { settings.autoAnalyze = ui.autoan.checked; saveSettings(); });
        ui.dots.addEventListener('change', () => {
            settings.showDots = ui.dots.checked; saveSettings();
            if (!settings.showDots) { refreshMapLayer(); return; }
            if (lastDotFeatures.length) refreshMapLayer();
            else if (captured.size && mem.n) analyze();
        });
        ui.amExtra.addEventListener('change', () => { if (ui.amExtra.checked) { settings.applyMode = 'extra'; saveSettings(); } });
        ui.amUrb.addEventListener('change', () => { if (ui.amUrb.checked) { settings.applyMode = 'urb'; saveSettings(); } });
        ui.scarica.addEventListener('click', () => downloadRegion(ui.regione.value).catch(e => { toast('Errore: ' + e.message, 8000); endBusy(); }));
        ui.svuotaCache.addEventListener('click', async () => {
            await idb.clear('regioni');
            rebuildMemory([]);
            status('Dati locali eliminati.');
        });
        ui.addSel.addEventListener('click', () => captureIds(getSelectedSegmentIds(), false));
        ui.clearCap.addEventListener('click', () => { captured.clear(); lastFailedIds.clear(); updateCapturedUI(); clearResultsUI(); });
        ui.analizza.addEventListener('click', analyze);
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
    function beginBusy() { busy = true; if (ui.scarica) ui.scarica.disabled = true; }
    function endBusy() { busy = false; if (ui.scarica) ui.scarica.disabled = false; setProgress(null); }
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
                const txt = `scaricata ${giorni} giorn${giorni === 1 ? 'o' : 'i'} fa`;
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
    // Se entrambi falliscono non importa: l'elenco incorporato nello script copre gia tutto.
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
            log('aggiornamento comuni non riuscito (uso l\'elenco incorporato):', e.message);
        }
    }

    /* ------------------------------------------------------------------ */
    /* Download regione + parsing in indice compatto                       */
    /* ------------------------------------------------------------------ */

    async function downloadRegion(reg) {
        if (busy) return;
        beginBusy();
        status(`Scarico indirizzario ${regNome(reg)}\u2026`);
        const buf = await gmFetchBinary(ANNCSU_DL + reg, p => { setProgress(p * 45); status(`Scarico indirizzario ${regNome(reg)}\u2026 ${Math.round(p * 100)}%`); });
        status(`Elaboro ${regNome(reg)}\u2026`);

        // Nome del file CSV dentro lo ZIP: l'Agenzia ci scrive la data di creazione dell'estratto
        // (non e' una colonna del CSV, va letta li'). Se il pattern cambia, il nome grezzo resta in console.
        let fileName = null, fileDate = null;
        try {
            const u8peek = new Uint8Array(buf);
            if (u8peek.length > 4 && u8peek[0] === 0x50 && u8peek[1] === 0x4b) {
                fileName = findZipEntry(u8peek).name;
                fileDate = extractDateFromFilename(fileName);
            }
        } catch (e) { /* niente data, non e' bloccante */ }
        log('file dentro lo zip:', fileName, '\u00b7 data riconosciuta:', fileDate || '(pattern non riconosciuto)');

        const rec = await parseIndirToRecord(new Uint8Array(buf), reg, regNome(reg),
            (p, read, kept) => { setProgress(45 + p * 55); status(`Elaboro ${regNome(reg)}\u2026 ${Math.round(p * 100)}% &middot; lette ${fmtN(read)} &middot; con coordinate ${fmtN(kept)}`); });
        rec.fileName = fileName;
        rec.fileDate = fileDate;
        if (!rec.count) {
            status(`<span style="color:#c00">Nessun civico con coordinate riconosciuto in ${regNome(reg)}.</span> Prima riga del file (per diagnosi) in console.`);
            log('DIAGNOSI prima riga dati:', rec.diag || '(vuota)');
            endBusy();
            return;
        }
        await idb.put('regioni', rec);
        const regs = await idb.all('regioni');
        rebuildMemory(regs);
        endBusy();
        const mb = (mem.n * 14 / 1048576).toFixed(0);
        status(`Pronto: <b>${fmtN(mem.n)}</b> civici in memoria (~${mb} MB, ${regs.map(r => r.nomeReg || r.reg).join(', ')}).${regionsDateLabel(regs)} Cache locale: al prossimo avvio &egrave; gi&agrave; tutto caricato.`);
        toast(`${regNome(reg)}: ${fmtN(rec.count)} civici georiferiti, ${fmtN(rec.groups.length)} odonimi.` + (fileDate ? ` Dataset del ${fileDate}.` : ''));
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

    async function parseIndirToRecord(u8, reg, nomeReg, onProgress) {
        const lons = growBuf(Float32Array), lats = growBuf(Float32Array),
            gids = growBuf(Uint32Array), civn = growBuf(Uint16Array), cive = growBuf(Uint8Array);
        const groups = [];
        const gmap = new Map();
        const esps = [''];               // dizionario esponenti: indice 0 = nessuno
        const emap = new Map([['', 0]]);
        let mapping = null, read = 0, diag = '', firstLine = true;

        const espIndex = s => {
            if (!s) return 0;
            let i = emap.get(s);
            if (i === undefined) {
                if (esps.length >= 255) return 0; // limite Uint8: improbabile, ma sicuro
                i = esps.length; esps.push(s); emap.set(s, i);
            }
            return i;
        };

        const handleLine = line => {
            if (!line || line.length < 5) return;
            const f = line.split(';');
            if (f.length < 5) return;
            if (!mapping) {
                if (firstLine) {
                    firstLine = false;
                    const hm = detectHeaderMapping(f);
                    if (hm) { mapping = hm; log('mappatura da intestazione ufficiale:', JSON.stringify(hm)); return; }
                }
                mapping = detectMapping(f);
                if (!mapping) { if (!diag) diag = line.slice(0, 300); return; }
                log('mappatura euristica:', JSON.stringify(mapping));
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
            cive.push(espIndex(es));
        };

        const isZip = u8.length > 4 && u8[0] === 0x50 && u8[1] === 0x4b;
        if (isZip) await zipCsvLines(u8, handleLine, p => onProgress && onProgress(p, read, lons.total));
        else await plainCsvLines(u8, handleLine, p => onProgress && onProgress(p, read, lons.total));

        return {
            reg, nomeReg, quando: Date.now(), count: lons.total, read, diag, pv: 8,
            lons: lons.done().buffer,
            lats: lats.done().buffer,
            gids: gids.done().buffer,
            civn: civn.done().buffer,
            cive: cive.done().buffer,
            esps,
            groups
        };
    }

    async function plainCsvLines(u8, onLine, onProgress) {
        const dec = new TextDecoder('utf-8');
        let carry = '', done = 0;
        const STEP = 8 * 1024 * 1024;
        for (let off = 0; off < u8.length; off += STEP) {
            const last = off + STEP >= u8.length;
            const txt = carry + dec.decode(u8.subarray(off, off + STEP), { stream: !last });
            const lines = txt.split(/\r?\n/);
            carry = last ? '' : lines.pop();
            for (const l of lines) onLine(l);
            if (last && carry) onLine(carry);
            done = Math.min(u8.length, off + STEP);
            onProgress && onProgress(done / u8.length);
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

        const dec = new TextDecoder('utf-8');
        let carry = '', chunks = 0;
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            const txt = carry + dec.decode(value, { stream: true });
            const lines = txt.split(/\r?\n/);
            carry = lines.pop();
            for (const l of lines) onLine(l);
            if ((++chunks & 15) === 0) await tick();
        }
        carry += dec.decode();
        if (carry) for (const l of carry.split(/\r?\n/)) onLine(l);
        await feeding;
    }

    const tick = () => new Promise(r => setTimeout(r, 0));

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
        // Esponente (es. "A", "N", "BIS"): campo di sole lettere subito dopo il civico
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
        const esps = [''];
        const emap = new Map([['', 0]]);
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
                emapLocal = r.esps.map(s => {
                    let i = emap.get(s);
                    if (i === undefined) { i = esps.length; esps.push(s); emap.set(s, i); }
                    return i;
                });
                const rc = new Uint8Array(r.cive);
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
    function gridQueryBBox(minLon, minLat, maxLon, maxLat) {
        const out = [];
        const x0 = Math.floor(minLon / GRID_CELL), x1 = Math.floor(maxLon / GRID_CELL);
        const y0 = Math.floor(minLat / GRID_CELL), y1 = Math.floor(maxLat / GRID_CELL);
        for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
            const a = grid.get(x + '_' + y);
            if (a) out.push(...a);
        }
        return out;
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
            if (sel && sel.objectType === 'segment' && sel.ids && sel.ids.length) return sel.ids.slice();
        } catch (e) { /* fallback */ }
        try {
            const W = (typeof unsafeWindow !== 'undefined' ? unsafeWindow.W : window.W);
            if (W && W.selectionManager) {
                return W.selectionManager.getSelectedDataModelObjects()
                    .filter(o => o.type === 'segment').map(o => o.getID());
            }
        } catch (e) { /* niente */ }
        return [];
    }

    function clearWmeSelection() {
        try { if (typeof sdk.Editing.clearSelection === 'function') { sdk.Editing.clearSelection(); return; } } catch (e) { /* oltre */ }
        try { if (typeof sdk.Editing.setSelection === 'function') { sdk.Editing.setSelection({ selection: { ids: [], objectType: 'segment' } }); return; } } catch (e) { /* oltre */ }
        try {
            const W = (typeof unsafeWindow !== 'undefined' ? unsafeWindow.W : window.W);
            if (W && W.selectionManager && W.selectionManager.unselectAll) W.selectionManager.unselectAll();
        } catch (e) { /* pazienza */ }
    }

    let lastMouse = { alt: false, shift: false, ctrl: false, t: 0 };
    let suppressUntil = 0;
    if (typeof document !== 'undefined') {
        document.addEventListener('mousedown', e => {
            lastMouse = { alt: e.altKey, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, t: Date.now() };
        }, true);
    }

    function capModeLabel() {
        switch (settings.captureMode) {
            case 'alt': return 'Cattura con ALT+clic: clic normale = editor normale.';
            case 'shift': return 'Cattura con MAIUSC+clic: clic normale = editor normale.';
            case 'ctrl': return 'Cattura con CTRL/\u2318+clic (attento: il WME lo usa per la multi-selezione).';
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
            const key = mode === 'alt' ? lastMouse.alt : mode === 'shift' ? lastMouse.shift : lastMouse.ctrl;
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
        refreshMapLayer();
        if (ui.results) ui.results.innerHTML = 'Lista vuota: cattura qualche segmento per vedere qui odonimi e civici.';
    }

    function updateCapturedUI() {
        if (!ui.selinfo) return;
        if (!captured.size) {
            const keyTxt = settings.captureMode === 'alt' ? 'ALT' : settings.captureMode === 'shift' ? 'MAIUSC' : settings.captureMode === 'ctrl' ? 'CTRL/\u2318' : null;
            ui.selinfo.innerHTML = `Lista vuota. ${keyTxt ? `<b>${keyTxt}+clic</b> su un segmento per aggiungerlo (${keyTxt}+ri-clic per toglierlo).` : settings.captureMode === 'always' ? 'Clicca i segmenti sulla mappa.' : 'Usa "Aggiungi selezione attuale".'}`;
            return;
        }
        const ids = [...captured.keys()];
        const MAXCHIP = 30;
        let html = `<b>${ids.length}</b> segment${ids.length === 1 ? 'o' : 'i'} in lista &middot; `;
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
            catch (e) { toast('Selezione via SDK non disponibile.'); }
        }));
    }

    // gli id dei segmenti possono essere numerici o stringhe a seconda della versione
    function coerceId(s) {
        if (captured.has(s)) return s;
        const n = Number(s);
        if (captured.has(n)) return n;
        for (const k of captured.keys()) if (String(k) === String(s) || String(k).endsWith(String(s))) return k;
        return s;
    }

    /* ------------------------------------------------------------------ */
    /* Geometria                                                           */
    /* ------------------------------------------------------------------ */

    function segGeometry(id) {
        try {
            const seg = sdk.DataModel.Segments.getById({ segmentId: id });
            if (seg && seg.geometry && seg.geometry.coordinates) return seg.geometry.coordinates;
        } catch (e) { /* fallback */ }
        try {
            const W = (typeof unsafeWindow !== 'undefined' ? unsafeWindow.W : window.W);
            const seg = W.model.segments.getObjectById(id);
            const g = seg.getOLGeometry ? seg.getOLGeometry() : seg.geometry;
            if (g && g.components) return g.components.map(c => merc2wgs(c.x, c.y));
        } catch (e) { /* niente */ }
        return null;
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

    function distPointToPolyline(lon, lat, coords, cosLat) {
        const px = lon * 111320 * cosLat, py = lat * 111320;
        let best = Infinity;
        let ax = coords[0][0] * 111320 * cosLat, ay = coords[0][1] * 111320;
        for (let i = 1; i < coords.length; i++) {
            const bx = coords[i][0] * 111320 * cosLat, by = coords[i][1] * 111320;
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

    /* ------------------------------------------------------------------ */
    /* Livello mappa dei civici (SDK)                                      */
    /* ------------------------------------------------------------------ */

    let layerReady = false, layerFailed = false;

    function ensureLayer() {
        if (layerReady || layerFailed) return layerReady;
        try {
            sdk.Map.addLayer({
                layerName: LAYER,
                styleRules: [{
                    predicate: () => true,
                    style: {
                        pointRadius: 5,
                        fillColor: '${fillColor}',
                        fillOpacity: 0.9,
                        strokeColor: '${strokeColor}',
                        strokeWidth: '${strokeWidth}',
                        strokeOpacity: '${strokeOpacity}',
                        strokeDashstyle: '${strokeDashstyle}',
                        strokeLinecap: 'round',
                        label: '${label}',
                        fontColor: '#111111',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        labelOutlineColor: '#ffffff',
                        labelOutlineWidth: 3,
                        labelYOffset: 12
                    }
                }],
                styleContext: {
                    fillColor: ctx => (ctx && ctx.feature && ctx.feature.properties && ctx.feature.properties.color) || '#777777',
                    strokeColor: ctx => (ctx && ctx.feature && ctx.feature.properties && ctx.feature.properties.stroke) || '#ffffff',
                    strokeWidth: ctx => {
                        const p = ctx && ctx.feature && ctx.feature.properties;
                        return (p && p.w != null) ? p.w : 1.5;
                    },
                    strokeOpacity: ctx => {
                        const p = ctx && ctx.feature && ctx.feature.properties;
                        return (p && p.so != null) ? p.so : 1;
                    },
                    strokeDashstyle: ctx => (ctx && ctx.feature && ctx.feature.properties && ctx.feature.properties.dash) || 'solid',
                    label: ctx => (ctx && ctx.feature && ctx.feature.properties && ctx.feature.properties.label) || ''
                }
            });
            try { sdk.Map.setLayerVisibility({ layerName: LAYER, visibility: true }); } catch (e) { /* facoltativo */ }
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
        try { sdk.Map.removeAllFeaturesFromLayer({ layerName: LAYER }); } catch (e) { /* ignora */ }
        try { sdk.Map.addFeaturesToLayer({ layerName: LAYER, features }); }
        catch (e) { log('addFeaturesToLayer KO', e); }
        raiseOwnLayer();
    }

    // Gli script di evidenziazione (Color Highlights ecc.) disegnano sopra i livelli aggiunti dopo:
    // riportiamo il nostro in cima a ogni ridisegno, cosi' la selezione resta sempre visibile.
    let zBumpLogged = false;
    function raiseOwnLayer() {
        try {
            const W = (typeof unsafeWindow !== 'undefined' ? unsafeWindow.W : window.W);
            if (!W || !W.map || !Array.isArray(W.map.layers) || typeof W.map.setLayerIndex !== 'function') return;
            const lyr = W.map.layers.find(l => l && typeof l.name === 'string' && l.name.indexOf(LAYER) !== -1);
            if (!lyr) return;
            W.map.setLayerIndex(lyr, W.map.layers.length - 1);
            if (!zBumpLogged) { zBumpLogged = true; log('livello portato sopra gli evidenziatori'); }
        } catch (e) { /* il colore acceso resta comunque */ }
    }

    function clearCiviciLayer() {
        if (!layerReady) return;
        try { sdk.Map.removeAllFeaturesFromLayer({ layerName: LAYER }); } catch (e) { /* ignora */ }
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
        const dLat = radius / 111320;
        const results = new Map(); // gid -> {dist, count}
        const pts = [];            // civici agganciati: {i, g, d}

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
            const dLon = radius / (111320 * cosLat);
            const cand = gridQueryBBox(minLon - dLon, minLat - dLat, maxLon + dLon, maxLat + dLat);
            for (const i of cand) {
                const d = distPointToPolyline(mem.lons[i], mem.lats[i], coords, cosLat);
                if (d > radius) continue;
                const g = mem.gids[i];
                let r = results.get(g);
                if (!r) { r = { dist: d, count: 0, uniq: new Set() }; results.set(g, r); }
                // civici distinti: numero + esponente; gli accessi senza numero contano singolarmente
                const cv = mem.civn[i] || 0, ce = mem.cive[i] || 0;
                r.uniq.add((cv || ce) ? cv * 1024 + ce : -(i + 1));
                r.count = r.uniq.size;
                if (d < r.dist) r.dist = d;
                pts.push({ i, g, d });
            }
        }

        lastResults = [...results.entries()]
            .map(([g, r]) => {
                const [den, loc, bel, fileDate] = mem.groups[g];
                return { g, name: den, locality: loc, comune: belNome.get(bel) || bel, dist: r.dist, count: r.count, fileDate };
            })
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 8);
        lastResults.forEach((r, idx) => { r.color = PALETTE[idx % PALETTE.length]; });

        // civici agganciati per odonimo (deduplicati): servono al disegno e all'inserimento su Waze
        lastPtsByG = new Map();
        pts.sort((a, b) => a.d - b.d);
        const seenHN = new Set();
        for (const p of pts) {
            const cv = mem.civn[p.i] || 0, ce = mem.cive[p.i] || 0;
            const label = (cv ? String(cv) : '') + (ce ? '/' + mem.esps[ce] : '');
            const lon = mem.lons[p.i], lat = mem.lats[p.i];
            const key = p.g + '|' + label + '|' + Math.round(lon * 1e5) + '|' + Math.round(lat * 1e5);
            if (seenHN.has(key)) continue;
            seenHN.add(key);
            let a = lastPtsByG.get(p.g);
            if (!a) { a = []; lastPtsByG.set(p.g, a); }
            if (a.length < 300) a.push({ lon, lat, label, d: p.d });
        }

        if (!lastResults.length) {
            ui.results.innerHTML = `Nessun civico ANNCSU entro ${radius} m. Aumenta il raggio, oppure il Comune non ha ancora caricato le coordinate nell'archivio.`;
            lastDotFeatures = [];
            refreshMapLayer();
            return;
        }
        renderResults(lastResults);
        drawCivici(pts);
    }

    // Disegna sulla mappa i civici agganciati, colorati come i risultati, con etichetta = numero/esponente
    function drawCivici(pts) {
        const colorOf = new Map(lastResults.map(r => [r.g, r.color]));
        pts.sort((a, b) => a.d - b.d);
        const seen = new Set();
        const features = [];
        for (const p of pts) {
            if (!colorOf.has(p.g)) continue;
            const lon = mem.lons[p.i], lat = mem.lats[p.i];
            const cv = mem.civn[p.i] || 0, ce = mem.cive[p.i] || 0;
            const label = (cv ? String(cv) : '') + (ce ? '/' + mem.esps[ce] : '');
            // duplicati: stesso odonimo + stesso civico/esponente + stesso punto (quantizzato ~1 m)
            const key = p.g + '|' + label + '|' + Math.round(lon * 1e5) + '|' + Math.round(lat * 1e5);
            if (seen.has(key)) continue;
            seen.add(key);
            features.push({
                id: 'wfit-' + p.i,
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [lon, lat] },
                properties: { color: colorOf.get(p.g), label }
            });
            if (features.length >= 500) break;
        }
        lastDotFeatures = features;
        refreshMapLayer();
    }

    /* ------------------------------------------------------------------ */
    /* Formattazione nomi                                                  */
    /* ------------------------------------------------------------------ */

    const LOWER_WORDS = new Set(['di', 'del', 'della', 'dei', 'degli', 'delle', 'da', 'dal', 'dalla', 'de', 'la', 'le', 'lo', 'li', 'e', 'ed', 'a', 'al', 'allo', 'alla', 'ai', 'agli', 'alle', 'in', 'nel', 'nella', 'su', 'sul', 'sulla', 'per', 'tra', 'fra', 'un', 'una']);
    const ROMAN = /^(?=[MDCLXVI])M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

    function toWazeCase(s) {
        if (!settings.titleCase) return s;
        return s.toLowerCase().split(/\s+/).map((w, i) => {
            if (!w) return w;
            const up = w.toUpperCase();
            if (ROMAN.test(up) && up.length <= 6 && up !== 'I' && i > 0) return up;
            if (i > 0 && LOWER_WORDS.has(w)) return w;
            return w.replace(/(^|['\u2019-])([a-z\u00e0-\u00fa])/g, (m, p, c) => p + c.toUpperCase());
        }).join(' ');
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
                ` &middot; ~${Math.round(r.dist)} m &middot; ${r.count} civic${r.count === 1 ? 'o' : 'i'}` +
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
            const W = (typeof unsafeWindow !== 'undefined' ? unsafeWindow.W : window.W);
            const am = W && W.model && W.model.actionManager;
            if (am) {
                if (typeof am.unsavedActionsNum === 'function') return am.unsavedActionsNum();
                if (typeof am.getActions === 'function') return (am.getActions() || []).length;
            }
        } catch (e) { /* sconosciuto */ }
        return null;
    }

    // Traduce gli errori del WME in indicazioni azionabili
    function niceReason(msg) {
        const m = String(msg || 'errore');
        if (/projected segment|not allowed to add a house number/i.test(m)) return 'segmento con modifiche non salvate: salva (Ctrl+S) e ripremi il bottone';
        if (/point is a required/i.test(m)) return 'segmento con modifiche non salvate: salva (Ctrl+S) e ripremi il bottone';
        if (/exists|duplicate/i.test(m)) return 'civico gi\u00e0 presente';
        if (/permission|rank|lock/i.test(m)) return 'permessi insufficienti sul segmento';
        return m;
    }

    const HN_MAX_D = 45; // Waze rifiuta i civici troppo lontani dal segmento: oltre questo limite si salta

    function hnCandidates(r) {
        const all = (lastPtsByG.get(r.g) || []).filter(p => p.label);
        const list = all.filter(p => p.d <= HN_MAX_D);
        return { all, list, tooFar: all.length - list.length };
    }

    // "18b" / "18 B" / "18/b" -> "18/B"; solo numero -> com'e'. null se non valido.
    function normHn(s) {
        let v = String(s || '').trim().toUpperCase().replace(/\s+/g, '');
        const m = /^(\d{1,5})(?:[\/]?([A-Z0-9]{1,4}))?$/.exec(v);
        if (!m) return null;
        return m[2] ? m[1] + '/' + m[2] : m[1];
    }

    function mapCenter() {
        try {
            const c = sdk.Map.getMapCenter();
            if (c) {
                if (c.lon != null && c.lat != null) return [c.lon, c.lat];
                if (c.lonLat && c.lonLat.lon != null) return [c.lonLat.lon, c.lonLat.lat];
            }
        } catch (e) { /* legacy */ }
        try {
            const W = (typeof unsafeWindow !== 'undefined' ? unsafeWindow.W : window.W);
            const c = W.map.getCenter();
            if (c) return merc2wgs(c.lon != null ? c.lon : c.x, c.lat != null ? c.lat : c.y);
        } catch (e) { /* niente */ }
        return null;
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
        try { sdk.Map.setMapCenter({ lonLat: { lon, lat } }); return; } catch (e) { /* variante */ }
        try { sdk.Map.setMapCenter({ lon, lat }); } catch (e) { /* pazienza */ }
    }

    // Civici gia' presenti su Waze: prova a caricarli davvero (SDK per-segmento, store, legacy)
    async function loadExistingHNs() {
        const HN = sdk.DataModel && sdk.DataModel.HouseNumbers;
        const out = [];
        const push = h => {
            if (!h) return;
            const num = h.houseNumber != null ? h.houseNumber : (h.number != null ? h.number : null);
            let c = (h.point && h.point.coordinates) || (h.geometry && h.geometry.coordinates) || null;
            if (!c && h.geometry && h.geometry.x != null && h.geometry.y != null) c = merc2wgs(h.geometry.x, h.geometry.y);
            if (num == null || !c || c.length < 2) return;
            out.push({ num: String(num), c: [c[0], c[1]] });
        };
        try {
            if (HN && typeof HN.getHouseNumbers === 'function' && captured.size) {
                let r = HN.getHouseNumbers({ segmentIds: [...captured.keys()] });
                if (r && typeof r.then === 'function') r = await r;
                if (Array.isArray(r)) r.forEach(push);
            }
        } catch (e) { /* sorgente successiva */ }
        try {
            if (HN && typeof HN.getHouseNumbers === 'function' && captured.size) {
                for (const id of captured.keys()) {
                    try {
                        let r = HN.getHouseNumbers({ segmentId: id });
                        if (r && typeof r.then === 'function') r = await r;
                        if (Array.isArray(r)) r.forEach(push);
                    } catch (e2) { break; /* firma non supportata */ }
                }
            }
        } catch (e) { /* oltre */ }
        try { if (HN && typeof HN.getAll === 'function') (HN.getAll() || []).forEach(push); } catch (e) { /* oltre */ }
        try {
            const W = (typeof unsafeWindow !== 'undefined' ? unsafeWindow.W : window.W);
            const repo = W.model && W.model.segmentHouseNumbers;
            const arr = repo && typeof repo.getObjectArray === 'function' ? repo.getObjectArray() : null;
            if (arr) arr.forEach(o => push(o && (o.attributes || o)));
        } catch (e) { /* pazienza */ }
        const seen = new Set();
        return out.filter(h => {
            const k = h.num + '|' + Math.round(h.c[0] * 1e5) + '|' + Math.round(h.c[1] * 1e5);
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
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
        // I civici vivono solo su strade CON nome: se i segmenti in lista sono "Senza strada", prima il nome
        let checkedAny = false, anyNamed = false;
        for (const id of captured.keys()) {
            try {
                const ad = sdk.DataModel.Segments.getAddress({ segmentId: id });
                checkedAny = true;
                if (ad && !ad.isEmpty && ad.street && ad.street.name) { anyNamed = true; break; }
            } catch (e) { /* prossimo */ }
        }
        if (checkedAny && !anyNamed) {
            toast('Questi segmenti sono "Senza strada": i numeri civici si possono inserire SOLO su strade con il nome della via. Prima premi "Applica ai segmenti" e salva, poi riapri l\'elenco dei civici.', 11000);
            return;
        }
        const cand = hnCandidates(r);
        if (!cand.all.length) { toast('Per questo odonimo non ci sono civici numerati agganciati.'); return; }
        if (!cand.list.length) {
            toast(`Tutti i ${cand.all.length} civici di questo odonimo sono oltre ${HN_MAX_D} m dalla strada: Waze li rifiuterebbe al salvataggio. Vanno inseriti a mano (piazzali vicino alla strada e trascinali sul punto reale).`, 12000);
            return;
        }
        const shown = cand.list.slice(0, 50);


        const box = document.createElement('div');
        box.className = 'wfit-hnrev';
        const head = document.createElement('div');
        head.className = 'wfit-muted';
        head.innerHTML = `<b>Controlla e conferma</b> \u00b7 ${shown.length} civic${shown.length === 1 ? 'o' : 'i'} pront${shown.length === 1 ? 'o' : 'i'}` +
            (cand.list.length > 50 ? ' (primi 50 per distanza: il resto al giro dopo)' : '') +
            (cand.tooFar ? ` \u00b7 ${cand.tooFar} oltre ${HN_MAX_D} m esclusi` : '') +
            ` \u00b7 numero modificabile \u00b7 <a href="javascript:void(0)" data-a="all">tutti</a> / <a href="javascript:void(0)" data-a="none">nessuno</a>`;
        box.appendChild(head);
        const listDiv = document.createElement('div');
        listDiv.className = 'wfit-hnlist';
        box.appendChild(listDiv);
        const rows = [];
        const bGo = document.createElement('button');
        const updateGo = () => {
            const k = rows.filter(x => x.cb.checked).length;
            bGo.textContent = `Inserisci ${k} civic${k === 1 ? 'o' : 'i'}`;
            bGo.disabled = !k;
        };
        const addRowEl = p => {
            const row = document.createElement('div');
            row.className = 'wfit-hnrow';
            row.title = 'Clic sulla riga: la mappa si centra su questo civico. Il numero \u00e8 modificabile (es. 18 \u2192 18/B).';
            const cb = document.createElement('input');
            cb.type = 'checkbox'; cb.checked = true;
            const inp = document.createElement('input');
            inp.type = 'text'; inp.className = 'wfit-hnnum'; inp.value = p.label;
            inp.addEventListener('input', () => inp.classList.remove('wfit-bad-in'));
            const dist = document.createElement('span'); dist.className = 'wfit-muted';
            dist.textContent = p.manual ? 'aggiunto da te' : `~${Math.round(p.d)} m`;
            row.appendChild(cb); row.appendChild(inp); row.appendChild(dist);
            row.addEventListener('click', ev => { if (ev.target !== cb && ev.target !== inp) quickCenter(p.lon, p.lat); });
            cb.addEventListener('change', updateGo);
            listDiv.appendChild(row);
            rows.push({ cb, inp, p, dist });
            return row;
        };
        for (const p of shown) addRowEl(p);

        // Civico trovato su Street View: lo scrivi tu e nasce alla posizione attuale del centro mappa
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
            const p = { lon: c[0], lat: c[1], label: v, d, manual: true };
            const row = addRowEl(p);
            listDiv.prepend(row);
            addIn.value = '';
            updateGo();
        };
        addBtn.addEventListener('click', doAdd);
        addIn.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); doAdd(); } });
        box.appendChild(addBox);
        const foot = document.createElement('div');
        foot.className = 'wfit-actions';
        bGo.className = 'wfit-btn wfit-primary';
        const bNo = document.createElement('button');
        bNo.className = 'wfit-btn'; bNo.textContent = 'Annulla';
        foot.appendChild(bGo); foot.appendChild(bNo); box.appendChild(foot);
        updateGo();
        head.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
            const v = a.dataset.a === 'all';
            rows.forEach(x => { x.cb.checked = v; });
            updateGo();
        }));
        bNo.addEventListener('click', () => box.remove());
        bGo.addEventListener('click', () => {
            const sel = [];
            let bad = false;
            for (const x of rows) {
                if (!x.cb.checked) continue;
                const v = normHn(x.inp.value);
                if (!v) { x.inp.classList.add('wfit-bad-in'); bad = true; continue; }
                sel.push({ lon: x.p.lon, lat: x.p.lat, d: x.p.d, label: v });
            }
            if (bad) { toast('Controlla i numeri evidenziati in rosso (formati validi: 18, 18/B, 12/BIS).', 7000); return; }
            if (!sel.length) return;
            box.remove();
            runHnInsert(r, sel);
        });
        card.appendChild(box);
        // annota i civici gia' presenti su Waze e togli loro la spunta
        loadExistingHNs().then(ex => {
            if (!ex.length) return;
            let marked = 0;
            for (const x of rows) {
                if (x.p.manual) continue;
                const lbl = normHn(x.inp.value) || x.p.label;
                const near = ex.find(h => h.num === lbl &&
                    Math.abs(h.c[0] - x.p.lon) < 6e-4 && Math.abs(h.c[1] - x.p.lat) < 6e-4 &&
                    haversine(h.c[0], h.c[1], x.p.lon, x.p.lat) < 40);
                if (near) { x.cb.checked = false; x.dist.textContent += ' \u00b7 gi\u00e0 su Waze'; marked++; }
            }
            if (marked) updateGo();
        }).catch(() => { /* niente annotazioni */ });
    }

    // Inserisce SOLO i civici confermati dall'utente
    async function runHnInsert(r, list) {
        const HN = sdk.DataModel && sdk.DataModel.HouseNumbers;
        if (!HN || typeof HN.addHouseNumber !== 'function') return;
        if (!list || !list.length) return;
        const uns = unsavedCount();
        if (uns != null && uns > 0) {
            toast(`Hai ${uns} modifich${uns === 1 ? 'a' : 'e'} non salvat${uns === 1 ? 'a' : 'e'}: il WME non permette di aggiungere civici su segmenti modificati. Salva (Ctrl+S), poi riapri l'elenco e riconferma.`, 10000);
            return;
        }
        if (busy) { toast('Attendi la fine dell\'operazione in corso.'); return; }
        beginBusy();
        suppressUntil = Date.now() + 4000;
        try {
            // civici già presenti su Waze (caricati per davvero, quando possibile)
            const existing = await loadExistingHNs();

            // Firma documentata: { houseNumber, point }; ripiego { number, point }.
            let shape = -1;
            const shapes = [
                (num, pt) => HN.addHouseNumber({ houseNumber: num, point: { type: 'Point', coordinates: pt } }),
                (num, pt) => HN.addHouseNumber({ number: num, point: { type: 'Point', coordinates: pt } })
            ];
            const addOne = (num, pt) => {
                if (shape >= 0) { shapes[shape](num, pt); return; }
                for (let i = 0; i < shapes.length; i++) {
                    try { shapes[i](num, pt); shape = i; return; }
                    catch (e) {
                        const m = String((e && e.message) || '');
                        if (i < shapes.length - 1 && /invalid argument/i.test(m)) continue;
                        throw e;
                    }
                }
            };

            let ok = 0, dup = 0, k = 0;
            const reasons = {};
            const projFails = [];
            const isProj = m => /projected|not allowed to add a house number/i.test(m);
            const tryPoint = async p => {
                if (existing.length) {
                    const near = existing.find(h => h.num === p.label &&
                        Math.abs(h.c[0] - p.lon) < 6e-4 && Math.abs(h.c[1] - p.lat) < 6e-4 &&
                        haversine(h.c[0], h.c[1], p.lon, p.lat) < 40);
                    if (near) { dup++; return; }
                }
                try { addOne(p.label, [p.lon, p.lat]); ok++; return; }
                catch (e) {
                    const m = String((e && e.message) || 'errore');
                    if (isProj(m)) { projFails.push(p); return; }
                    if (p.label.includes('/') && /invalid|format|number/i.test(m)) {
                        try { addOne(p.label.replace('/', ''), [p.lon, p.lat]); ok++; return; }
                        catch (e2) {
                            const m2 = String((e2 && e2.message) || 'errore');
                            if (isProj(m2)) { projFails.push(p); return; }
                            reasons[niceReason(m2)] = (reasons[niceReason(m2)] || 0) + 1; return;
                        }
                    }
                    reasons[niceReason(m)] = (reasons[niceReason(m)] || 0) + 1;
                }
            };
            for (const p of list.slice(0, 50)) {
                k++;
                if (k % 5 === 0) { status(`Inserisco civici: ${k}/${Math.min(list.length, 50)}\u2026`); await tick(); }
                await tryPoint(p);
            }

            // "projected segment" SENZA modifiche pendenti = segmento in stato transitorio
            // (post-salvataggio o aggancio a segmento nuovo/senza nome): ricarica la zona e ritenta una volta
            if (projFails.length) {
                const uns2 = unsavedCount();
                if ((uns2 == null || uns2 === 0) && canPan()) {
                    status(`Il WME ha rifiutato ${projFails.length} civici (segmento in transizione): ricarico la zona e ritento\u2026`);
                    suppressUntil = Date.now() + 9000;
                    const mid = [
                        projFails.reduce((s, p) => s + p.lon, 0) / projFails.length,
                        projFails.reduce((s, p) => s + p.lat, 0) / projFails.length
                    ];
                    await panTo(mid);
                    const retry = projFails.splice(0);
                    for (const p of retry) {
                        try { addOne(p.label, [p.lon, p.lat]); ok++; }
                        catch (e) {
                            const m = String((e && e.message) || 'errore');
                            if (isProj(m)) projFails.push(p);
                            else reasons[niceReason(m)] = (reasons[niceReason(m)] || 0) + 1;
                        }
                    }
                }
                if (projFails.length) {
                    const uns3 = unsavedCount();
                    if (uns3 != null && uns3 > 0) {
                        const m = 'segmento con modifiche non salvate: salva (Ctrl+S) e riconferma';
                        reasons[m] = (reasons[m] || 0) + projFails.length;
                    } else {
                        // diagnosi per punto: lock troppo alto / strada senza nome / altro
                        let segsAll2 = null;
                        try {
                            if (sdk.DataModel.Segments && typeof sdk.DataModel.Segments.getAll === 'function') {
                                segsAll2 = (sdk.DataModel.Segments.getAll() || [])
                                    .map(s => (s && s.geometry && s.geometry.coordinates && s.geometry.coordinates.length > 1)
                                        ? { id: s.id, c: s.geometry.coordinates } : null)
                                    .filter(Boolean);
                            }
                        } catch (e) { segsAll2 = null; }
                        const ur = userRank();
                        let maxLv = -1;
                        const cnt = { lock: 0, unnamed: 0, other: 0 };
                        for (const p of projFails) {
                            let bestD = Infinity, bestId = null;
                            if (segsAll2) {
                                const cosLat = Math.cos(p.lat * Math.PI / 180);
                                for (const s of segsAll2) {
                                    let inBox = false;
                                    for (const q of s.c) { if (Math.abs(q[0] - p.lon) < 0.003 && Math.abs(q[1] - p.lat) < 0.002) { inBox = true; break; } }
                                    if (!inBox) continue;
                                    const d = distPointToPolyline(p.lon, p.lat, s.c, cosLat);
                                    if (d < bestD) { bestD = d; bestId = s.id; }
                                }
                            }
                            if (bestId != null) {
                                const lk = segEffLock(bestId);
                                if (ur != null && lk != null && lk > ur) { cnt.lock++; if (lk > maxLv) maxLv = lk; continue; }
                                let named = true;
                                try {
                                    const ad = sdk.DataModel.Segments.getAddress({ segmentId: bestId });
                                    named = !!(ad && !ad.isEmpty && ad.street && ad.street.name);
                                } catch (e) { /* lascia true */ }
                                if (!named) { cnt.unnamed++; continue; }
                            }
                            cnt.other++;
                        }
                        if (cnt.lock) {
                            const m = 'non hai i permessi su questa strada (bloccata sopra il tuo livello): chiedi lo sblocco alla community';
                            reasons[m] = (reasons[m] || 0) + cnt.lock;
                        }
                        if (cnt.unnamed) {
                            const m = 'la strada pi\u00f9 vicina al punto \u00e8 senza nome: dalle prima un nome (catturala con lo script), poi riprova';
                            reasons[m] = (reasons[m] || 0) + cnt.unnamed;
                        }
                        if (cnt.other) {
                            const m = 'rifiutato dal WME: zooma di pi\u00f9 sulla zona o ricarica la pagina e riprova (oppure inseriscilo a mano)';
                            reasons[m] = (reasons[m] || 0) + cnt.other;
                        }
                    }
                }
            }
            status('');
            let msg = `${ok} civic${ok === 1 ? 'o' : 'i'} confermat${ok === 1 ? 'o' : 'i'} e inserit${ok === 1 ? 'o' : 'i'} per "${toWazeCase(r.name)}"`;
            if (dup) msg += ` \u00b7 ${dup} gi\u00e0 su Waze: non reinserit${dup === 1 ? 'o' : 'i'}`;
            if (list.length > 50) msg += ` \u00b7 ne restano ~${list.length - 50}: salva e riapri l'elenco`;
            const rk = Object.entries(reasons);
            if (rk.length) msg += ' \u00b7 falliti: ' + rk.map(([m, c]) => `${c}\u00d7 ${m}`).join('; ');
            msg += ok ? '. Controlla i civici sulla mappa e salva.' : '.';
            toast(msg, rk.length ? 15000 : 8000);
            if (ok) log(`house number inseriti con firma #${shape}`);
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
        } catch (e) { /* sotto */ }
        try {
            if (pn == null || alts == null) {
                const ad = sdk.DataModel.Segments.getAddress({ segmentId: id });
                if (ad) {
                    if (pn == null && ad.street && ad.street.id != null) pn = ad.street.id;
                    if (alts == null && Array.isArray(ad.altStreets)) alts = ad.altStreets.map(s => s && s.id).filter(x => x != null);
                }
            }
        } catch (e) { /* ignoto */ }
        try {
            if (pn == null || alts == null) {
                const W = (typeof unsafeWindow !== 'undefined' ? unsafeWindow.W : window.W);
                const s = W.model.segments.getObjectById(id);
                const a = s && (s.attributes || s);
                if (a) {
                    if (pn == null && a.primaryStreetID != null) pn = a.primaryStreetID;
                    if (alts == null && Array.isArray(a.streetIDs)) alts = a.streetIDs.slice();
                }
            }
        } catch (e) { /* pazienza */ }
        return { pn, alts };
    }

    // Etichetta leggibile "Nome, Comune" di una via (per il dialogo di conferma)
    function cityNameById(cid) {
        try {
            const C = sdk.DataModel.Cities;
            if (C && typeof C.getById === 'function') { const c = C.getById({ cityId: cid }); if (c && c.name) return c.name; }
        } catch (e) { /* sotto */ }
        try {
            const W = (typeof unsafeWindow !== 'undefined' ? unsafeWindow.W : window.W);
            const c = W.model.cities.getObjectById(cid);
            if (c) return (c.attributes && c.attributes.name) || '';
        } catch (e) { /* niente */ }
        return '';
    }
    function streetLabel(id) {
        try {
            const S = sdk.DataModel.Streets;
            if (S && typeof S.getById === 'function') {
                const s = S.getById({ streetId: id });
                if (s) { const c = cityNameById(s.cityId); return (s.name || '(senza nome)') + (c ? ', ' + c : ''); }
            }
        } catch (e) { /* sotto */ }
        try {
            const W = (typeof unsafeWindow !== 'undefined' ? unsafeWindow.W : window.W);
            const s = W.model.streets.getObjectById(id);
            if (s) {
                const a = s.attributes || s;
                let cn = '';
                try { const c = W.model.cities.getObjectById(a.cityID); cn = (c && c.attributes && c.attributes.name) || ''; } catch (e2) { /* vuoto */ }
                return (a.name || '(senza nome)') + (cn ? ', ' + cn : '');
            }
        } catch (e) { /* niente */ }
        return '#' + id;
    }

    // Gli ID delle vie possono arrivare come numero o come testo: confronto tollerante
    const sameId = (a, b) => a != null && b != null && String(a) === String(b);

    // Livello dell'utente (0-based: L1 = 0)
    function userRank() {
        try {
            if (sdk.State && typeof sdk.State.getUserInfo === 'function') {
                const u = sdk.State.getUserInfo();
                if (u && u.rank != null) return u.rank;
            }
        } catch (e) { /* legacy */ }
        try {
            const W = (typeof unsafeWindow !== 'undefined' ? unsafeWindow.W : window.W);
            const u = W.loginManager && W.loginManager.user;
            if (u) {
                if (u.rank != null) return u.rank;
                if (u.attributes && u.attributes.rank != null) return u.attributes.rank;
                if (typeof u.getRank === 'function') return u.getRank();
            }
        } catch (e) { /* ignoto */ }
        return null;
    }

    // Lock effettivo del segmento (manuale se presente, altrimenti automatico)
    function segEffLock(id) {
        try {
            const s = sdk.DataModel.Segments.getById({ segmentId: id });
            if (s) {
                if (s.lockRank != null) return s.lockRank;
                if (s.rank != null) return s.rank;
            }
        } catch (e) { /* legacy */ }
        try {
            const W = (typeof unsafeWindow !== 'undefined' ? unsafeWindow.W : window.W);
            const s = W.model.segments.getObjectById(id);
            const a = s && (s.attributes || s);
            if (a) {
                if (a.lockRank != null) return a.lockRank;
                if (a.rank != null) return a.rank;
            }
        } catch (e) { /* ignoto */ }
        return null;
    }

    async function applyToSegments(streetName, cityName, suggestedName) {
        const ids = captured.size ? [...captured.keys()] : getSelectedSegmentIds();
        if (!ids.length) { toast('Nessun segmento in lista.'); return; }
        if (busy) { toast('Attendi la fine dell\'operazione in corso.'); return; }
        suppressUntil = Date.now() + 2500;
        const extra = settings.applyMode !== 'urb';
        beginBusy();
        try {
            const city = resolveCity(cityName);
            if (!city) throw new Error(`comune "${cityName}" non risolvibile via SDK (impostalo una volta a mano su un segmento vicino)`);

            let pnStreet, anStreet = null;
            if (extra) {
                const emptyCity = resolveEmptyCity();
                if (!emptyCity) throw new Error('citt\u00e0 vuota ("Nessuno") non trovata nel modello: apri/aggiungi in zona un segmento senza citt\u00e0 e riprova');
                pnStreet = getOrAddStreet(streetName, emptyCity.id);
                anStreet = getOrAddStreet(streetName, city.id);
            } else {
                pnStreet = getOrAddStreet(streetName, city.id);
            }

            let applied = 0, skipped = 0, anOk = 0, anManual = 0, cleaned = 0, cleanFailed = 0;
            const failReasons = new Map();
            const targetAlts = anStreet ? [anStreet.id] : [];
            const staleOf = st => Array.isArray(st.alts)
                ? st.alts.filter(a => !sameId(a, pnStreet.id) && !targetAlts.some(t => sameId(t, a)))
                : [];

            // Pre-scansione: c'e' qualcosa di non allineato (vecchi alternativi, doppioni)?
            // Se si', si chiede conferma UNA volta e poi si riallinea tutto il lotto.
            let cleanMode = false;
            {
                const staleLabels = new Set();
                let staleSegs = 0, staleTot = 0;
                for (const id of ids) {
                    let st = null;
                    try { st = segAddressState(id); } catch (e) { continue; }
                    const stale = staleOf(st);
                    if (stale.length) {
                        staleSegs++; staleTot += stale.length;
                        for (const a of stale) { if (staleLabels.size < 8) staleLabels.add(streetLabel(a)); }
                    }
                }
                if (staleTot > 0) {
                    const esempi = [...staleLabels].slice(0, 6).join('; ');
                    cleanMode = window.confirm(
                        `${SCRIPT_NAME}: su ${staleSegs} segment${staleSegs === 1 ? 'o' : 'i'} ci sono ${staleTot} nom${staleTot === 1 ? 'e' : 'i'} alternativ${staleTot === 1 ? 'o' : 'i'} NON previst${staleTot === 1 ? 'o' : 'i'} dalle scelte dello script:\n` +
                        `\u2022 ${esempi}${staleLabels.size > 6 ? '\u2026' : ''}\n\n` +
                        `OK = rimuovili e riallinea tutto (PN/AN come impostato)\n` +
                        `Annulla = mantienili (lo script aggiunge senza togliere)`);
                }
            }

            const applyReason = m => /lock|rank|permission|not allowed|consentit/i.test(m)
                ? 'segmento bloccato o permessi insufficienti (serve un unlock)' : m;

            // Applica SOLO ciò che manca, poi VERIFICA che il WME abbia registrato davvero:
            // se la prima strategia non lascia il segmento come voluto, si prova l'altra;
            // se anche quella fallisce, il segmento finisce tra i falliti (niente successi fantasma).
            const tryApply = async id => {
                let seg = null;
                try { seg = sdk.DataModel.Segments.getById({ segmentId: id }); } catch (e) { /* sotto */ }
                if (!seg) return 'notloaded';

                const st = segAddressState(id);
                const known = Array.isArray(st.alts);
                const stale = staleOf(st);
                const needPn = !sameId(st.pn, pnStreet.id);
                const anPresent = anStreet && known && st.alts.some(a => sameId(a, anStreet.id));
                const needAn = !!anStreet && !anPresent;
                const needClean = cleanMode && stale.length > 0;

                if (!needPn && !needAn && !needClean) { skipped++; return 'ok'; }

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
                        applied++;
                        if (needAn) { if (anNow) anOk++; else anManual++; }
                        if (needClean) {
                            const still = staleOf(now);
                            if (!still.length) cleaned += stale.length;
                            else cleanFailed += still.length;
                        }
                        return 'ok';
                    }
                    lastErr = new Error('il WME non ha registrato la modifica come richiesto');
                }
                log('verifica fallita', id, '\u00b7 PN atteso', pnStreet.id, '\u00b7 letto', lastNow && lastNow.pn, '\u00b7 alternativi letti', lastNow && lastNow.alts);
                return applyReason(lastErr && lastErr.message ? String(lastErr.message) : 'modifica rifiutata dal WME');
            };

            const notLoaded = [];
            let k = 0;
            for (const id of ids) {
                k++;
                if (ids.length > 3) status(`Applico: ${k}/${ids.length}\u2026`);
                if (k % 6 === 0) await tick();
                const r = await tryApply(id);
                if (r === 'notloaded') notLoaded.push(id);
                else if (r !== 'ok') { failReasons.set(id, r); log('Applica fallito', id, r); }
            }

            if (notLoaded.length) {
                if (canPan()) {
                    let j = 0;
                    for (const id of notLoaded) {
                        j++;
                        status(`Recupero segmenti fuori vista: ${j}/${notLoaded.length}\u2026`);
                        suppressUntil = Date.now() + 6000;
                        const info = captured.get(id);
                        const mid = info && info.coords ? lineMidpoint(info.coords) : null;
                        if (!mid) { failReasons.set(id, 'geometria non memorizzata'); continue; }
                        await panTo(mid);
                        const r = await tryApply(id);
                        if (r === 'notloaded') failReasons.set(id, 'non caricato neppure dopo lo spostamento (se hai salvato di recente l\'id potrebbe essere cambiato: ricatturalo)');
                        else if (r !== 'ok') { failReasons.set(id, r); log('Applica fallito', id, r); }
                    }
                } else {
                    for (const id of notLoaded) failReasons.set(id, 'fuori dall\'area caricata: torna sulla zona e ripremi Applica');
                }
            }
            status('');

            lastFailedIds = new Set(failReasons.keys());
            updateCapturedUI();

            let msg = extra
                ? `PN "${streetName}" (citt\u00e0: Nessuno): ${applied} modificat${applied === 1 ? 'o' : 'i'}`
                : `"${streetName}" (${cityName}): ${applied} modificat${applied === 1 ? 'o' : 'i'}`;
            if (skipped) msg += ` \u00b7 gi\u00e0 a posto (nessuna modifica): ${skipped}`;
            if (cleaned) msg += ` \u00b7 riallineati: ${cleaned} alternativ${cleaned === 1 ? 'o' : 'i'} non conform${cleaned === 1 ? 'e' : 'i'} rimoss${cleaned === 1 ? 'o' : 'i'}`;
            if (cleanFailed) msg += ` \u00b7 ${cleanFailed} alternativ${cleanFailed === 1 ? 'o' : 'i'} non rimovibil${cleanFailed === 1 ? 'e' : 'i'} via SDK: toglili a mano`;
            if (extra && anOk) msg += ` \u00b7 AN "${streetName}, ${cityName}" aggiunt${anOk === 1 ? 'o' : 'i'}: ${anOk}`;
            if (extra && anManual) msg += ` \u00b7 AN da aggiungere a mano: ${anManual}`;
            if (failReasons.size) {
                const perMotivo = {};
                for (const m of failReasons.values()) perMotivo[m] = (perMotivo[m] || 0) + 1;
                msg += ' \u00b7 falliti (in rosso in lista): ' +
                    Object.entries(perMotivo).map(([m, c]) => `${c}\u00d7 ${m}`).join('; ');
            }
            if (applied > 0 && suggestedName) {
                const rule = learnNameRule(suggestedName, streetName);
                if (rule) msg += ` \u00b7 regola memorizzata: "${rule.from.trim()}" \u2192 "${rule.to.trim()}" (le prossime caselle si precompilano cos\u00ec)`;
            }
            msg += applied ? '. Rivedi le modifiche e salva.' : '.';
            toast(msg, failReasons.size ? 15000 : 8000);
        } catch (e) {
            navigator.clipboard && navigator.clipboard.writeText(streetName);
            toast('Applicazione non riuscita (' + e.message + '). Nome copiato negli appunti.', 8000);
        } finally {
            endBusy();
        }
    }

    function canPan() { return sdk.Map && typeof sdk.Map.setMapCenter === 'function'; }

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // Centra la mappa su un punto e aspetta che il WME carichi i dati della zona
    async function panTo(mid) {
        try { sdk.Map.setMapCenter({ lonLat: { lon: mid[0], lat: mid[1] } }); }
        catch (e1) {
            try { sdk.Map.setMapCenter({ lon: mid[0], lat: mid[1] }); }
            catch (e2) { return false; }
        }
        try {
            await Promise.race([sdk.Events.once({ eventName: 'wme-map-data-loaded' }), sleep(6000)]);
        } catch (e) { await sleep(1500); }
        await sleep(350);
        return true;
    }

    function getOrAddStreet(streetName, cityId) {
        let street = null;
        try { street = sdk.DataModel.Streets.getStreet({ cityId, streetName }); } catch (e) { /* non esiste ancora */ }
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
        try {
            if (C && typeof C.getAll === 'function') {
                const c = C.getAll().find(x => x && (x.isEmpty === true || x.name === '' || x.name == null));
                if (c && c.id != null) return c;
            }
        } catch (e) { /* oltre */ }
        try {
            const W = (typeof unsafeWindow !== 'undefined' ? unsafeWindow.W : window.W);
            const c = W.model.cities.getObjectArray().find(x => x.attributes && x.attributes.isEmpty);
            if (c) return { id: c.attributes.id, isEmpty: true };
        } catch (e) { /* niente */ }
        return null;
    }

    // Nome alternativo con azione legacy quando l'SDK non lo supporta
    function legacyAddAlternate(segmentId, streetId) {
        try {
            const W = (typeof unsafeWindow !== 'undefined' ? unsafeWindow.W : window.W);
            const req = (typeof unsafeWindow !== 'undefined' && unsafeWindow.require) ? unsafeWindow.require
                : (typeof require === 'function' ? require : null);
            if (!W || !req) return false;
            const AddAlt = req('Waze/Action/AddAlternateStreet');
            const seg = W.model.segments.getObjectById(segmentId);
            if (!AddAlt || !seg) return false;
            if ((seg.getAttribute ? seg.getAttribute('streetIDs') : seg.attributes.streetIDs || []).includes(streetId)) return true;
            W.model.actionManager.add(new AddAlt(seg, streetId));
            return true;
        } catch (e) { return false; }
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
            try { const r = fn(); if (r && r.id != null) return r; } catch (e) { /* prossimo */ }
        }
        return null;
    }

    // Hook per test automatici fuori dal browser (in WME "module" non esiste: blocco inerte)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { parseItFloat, detectMapping, findZipEntry, zipCsvLines, plainCsvLines, parseIndirToRecord, extractDateFromFilename };
    }

})();