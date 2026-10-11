# Onkel Ottos Testament – Das Regelwerk

*Ein chaotisches Erbschaftsspiel für 2 bis 15 gierige Verwandte. Dauer: etwa 20 bis 35 Minuten.*

## Die Geschichte

Der exzentrische Millionär **Onkel Otto** ist gestorben. Er hinterlässt eine Villa voller Schätze, einen Tresor, einen launischen Keller und eine Familie, die sich nicht leiden kann. Ihr seid seine Verwandten und wollt das Erbe. Das Problem: Ottos Testament ist völlig verrückt. **Jede Runde verliest der Notar eine neue Klausel, die die Regeln verändert.**

Wer nach der Testamentseröffnung das meiste Vermögen hat, erbt die Villa.

## Was ihr braucht

- **Einen gemeinsamen Bildschirm**: Fernseher, Beamer oder Laptop. Dort läuft das Spielbrett.
- **Ein Handy pro Person**. Es dient als geheime Kartenhand und Controller. Eine App ist nicht nötig, nur der Browser.
- Alle Geräte im **selben WLAN**.

## Spiel starten

1. Auf dem Computer im Projektordner einmalig `npm install` ausführen, danach `npm start`.
2. Im Browser `http://localhost:3000` öffnen und **„Spiel eröffnen“** wählen. Diesen Bildschirm am besten auf den Fernseher bringen.
3. Die Sprache des Notars wählen (Deutsch oder Türkçe) und **„Testament eröffnen“** drücken.
4. Alle scannen den **QR-Code** mit dem Handy oder geben die angezeigte Adresse und den vierstelligen **Raumcode** ein.
5. Namen eingeben, ein **Porträtfoto** von sich machen (mit Filtern wie „Ölgemälde“ oder „Gespenst“) und beitreten. Wer kein Foto will, nimmt ein Tiergesicht. Jedes Handy kann seine eigene Sprache wählen.
6. Optional: **Bot-Verwandte** hinzufügen (praktisch bei 2 bis 3 Personen), **Rundenzahl** und **Planungszeit** einstellen.
7. **„Spiel starten“** drücken.

## Ziel des Spiels

Am Ende das größte **Vermögen** haben. Das Vermögen besteht aus deinen **Talern** plus dem **geheimen Wert deiner Erbstücke** plus allen Boni aus der Testamentseröffnung.

Jeder startet mit **300 Talern** und **2 Karten**.

## Ablauf einer Runde

Ein Spiel dauert 5 bis 12 Runden (Standard: 8). Jede Runde hat bis zu sechs Phasen. Alle spielen **gleichzeitig**, niemand wartet auf einen Zug.

### 1. Die Klausel

Der Notar verliest eine neue **Testamentsklausel**. Sie gilt nur für diese Runde. Manche Klauseln wirken sofort (zum Beispiel Steuern oder Robin Hood), andere verändern Räume, Karten oder Duelle, und einige kündigen eine **Abstimmung** am Ende der Runde an.

Die **letzte Runde** hat immer dieselbe Klausel: Alle Räume zahlen dreifach.

### 2. Geheime Planung

Auf dem Handy wählt jeder **geheim**:

- **einen Raum**, in den er geht, und
- **höchstens eine Karte**, die er spielt (manche Klauseln erlauben zwei oder verbieten Karten).

Bis der Countdown abläuft, darf man den Plan noch ändern. Wer nichts wählt, landet im Garten. Sind alle fertig, geht es sofort weiter.

**Am Tisch darf und soll verhandelt, gelogen und gedroht werden.**

### 3. Die Enthüllung

Alle Figuren laufen gleichzeitig in ihre Räume. Danach werden die gespielten Karten in dieser **festen Reihenfolge** ausgeführt:

1. Mein Anwalt! (Schutz) und Fälschung
2. Absperrband, Stinkbombe
3. Stromausfall, Dinnerglocke
4. Lockvogel, Nachahmer, Platztausch, Bananenschale
5. Taschendieb, Anwaltsrechnung, Geldmagnet, Kartenklau, Paparazzi, Schlafpulver, Weinprobe
6. Erpressung, Vergiftetes Geschenk
7. Fluch, Würfelglück, Erbschleicher, Glücksklee, Partytröte

### 4. Familienstreit (Duell)

Treffen mehrere Erben aufeinander, gibt es Streit:

- **Zwei Personen im Tresorraum** duellieren sich um die Beute.
- **Zwei oder mehr im Schlafzimmer** duellieren sich um das Erbstück.

Alle Duellanten spielen **gleichzeitig dasselbe Minispiel** auf dem Handy. Gewertet wird pro Raum. Bei der Klausel „Die Alarmanlage ist faul“ streiten sich auch drei Personen um den Tresor.

### 5. Abrechnung

Jeder Raum zahlt aus (siehe Tabelle unten). Danach wirken Klauseln, die sich auf die Verteilung beziehen. Wer jetzt **0 Taler** hat, wird zum **Geist**.

### 6. Abstimmung (nur bei manchen Klauseln)

Bei Klauseln wie „Schweigeklausel“ oder „Alibi-Prüfung“ stimmen alle auf dem Handy ab. Wer die meisten Stimmen bekommt, erhält den Bonus oder die Strafe der Klausel. Bei Gleichstand entscheidet das Los. Man kann nicht für sich selbst stimmen.

## Die Räume

| Raum | Wirkung |
|---|---|
| 💰 **Tresorraum** | Allein: **+150**. Zu zweit: Duell, Sieger +150, Verlierer +40. Ab 3 Personen: **ALARM**, alle −50. |
| 🍳 **Küche** | Jeder zieht **eine Karte** (Handlimit 4, die älteste fällt raus). |
| 📚 **Bibliothek** | **+40** und du erfährst heimlich die **Rolle** eines zufälligen anderen Spielers. |
| 🛏️ **Schlafzimmer** | Ein **Erbstück** mit geheimem Wert. Mehrere Personen: Duell, nur der Sieger bekommt es. |
| 🕳️ **Keller** | Glücksspiel für jeden einzeln: 45 % **+180**, 35 % **−90**, 20 % nur Ratten. |
| 🌳 **Garten** | **+20**. Wer im Garten steht, ist **immun** gegen alle Karten, die auf ihn zielen (Bananenschale, Lockvogel, Taschendieb, Geschenk), und gegen Erpressung. Stromausfall wirkt trotzdem. |
| 🕸️ **Dachboden** *(ab 9 Spielern)* | **+30** und eine Karte. |
| 💃 **Ballsaal** *(ab 9 Spielern)* | Alle Anwesenden teilen sich **300**. |

## Die Karten

| Karte | Wirkung |
|---|---|
| 🍌 **Bananenschale** | Dein Ziel rutscht in einen zufälligen **anderen** Raum (nicht, wenn es im Garten steht). |
| 🧤 **Taschendieb** | Stiehl **60** von deinem Ziel (nicht im Garten). |
| 📜 **Fälschung** | Deine Raum-Einnahmen zählen diese Runde **doppelt**. |
| ⚖️ **Mein Anwalt!** | Diese Runde wirkt **keine Karte**, die auf dich zielt, und der Stromausfall verschont dich. |
| 🔌 **Stromausfall** | **Alle** landen in zufälligen offenen Räumen. |
| 🪤 **Lockvogel** | Zieh dein Ziel in **deinen** Raum (nicht aus dem Garten). Perfekt, um jemanden in ein Duell zu zwingen. |
| 🚧 **Absperrband** | Sperre einen Raum (außer Garten). Wer dort steht, fliegt in den Garten. |
| 🎁 **Vergiftetes Geschenk** | Schenke dem Ziel ein **zufälliges Erbstück** von dir. Ist es verflucht? Niemand weiß es! |
| 💼 **Erpressung** | Nimm **30** von jedem anderen in deinem Raum. |
| 🔄 **Platztausch** | Du tauschst den Raum mit deinem Ziel. |
| 🧲 **Geldmagnet** | Zieh von **jedem** anderen Erben **10** Taler an (nicht von Geschützten und Leuten im Garten). |
| 🍀 **Glücksklee** | Im **Keller** gibt es garantiert den Jackpot (+180). Sonst bekommst du +40. |
| 💤 **Schlafpulver** | Dein Ziel verschläft die Runde und **verdient im Raum nichts**. |
| 🧾 **Anwaltsrechnung** | Dein Ziel zahlt dir **10 %** seines Vermögens (mindestens 20). |
| 🐒 **Nachahmer** | Du folgst deinem Ziel in **seinen** Raum. Ideal, um ihm den Tresor zu verderben. |
| 🎲 **Würfelglück** | Halbe-halbe: **+120** oder **−60**. |
| 🔔 **Dinnerglocke** | **Alle anderen** rennen in die Küche (ist sie gesperrt, in den Garten). Nur du bleibst, wo du bist. |
| 🕯️ **Fluch** | Jeder im gewählten Raum verliert **40**. Auch du, wenn du dort stehst! |
| 🎺 **Partytröte** | **+25** für jeden anderen Erben in deinem Raum. |
| 📸 **Paparazzi** | Du erfährst heimlich die **Rolle** deines Ziels. |
| 🐍 **Kartenklau** | Stiehl deinem Ziel eine zufällige Karte. |
| 🍷 **Weinprobe** | Dein Ziel ist beschwipst und **verliert diese Runde jedes Duell**. |
| 💨 **Stinkbombe** | Alle im gewählten Raum flüchten in zufällige andere Räume. |
| 🏺 **Erbschleicher** | Zahl **80** und nimm dir sofort ein geheimes Erbstück. Gut oder verflucht? |

## Die geheimen Rollen

Zu Beginn bekommt jeder heimlich eine Rolle auf dem Handy. Niemand darf auf fremde Handys schauen.

| Rolle | Ab | Wirkung |
|---|---|---|
| 🤑 **Gieriger Verwandter** | immer | Werde einfach der Reichste. |
| 👶 **Uneheliches Kind** | 4 Spieler | Wirst du am Ende **nicht entlarvt**, bekommst du **+50 %** auf dein Vermögen. |
| 🤵 **Butler** | 5 Spieler | Wirst du am Ende **nicht entlarvt**, stiehlst du **allen anderen 15 %** ihres Vermögens. |
| 🐈‍⬛ **Ottos Katze** | 6 Spieler | **9 Leben:** Die ersten **3 Karten** gegen dich prallen ab. Bist du am Ende **am ärmsten**, bekommst du **+400** Futtergeld. |
| 🔮 **Wahrsagerin** | 7 Spieler | Deine Kristallkugel zeigt dir **jede Runde heimlich eine fremde Rolle**. Beim Finale bringt dir jeder richtige Tipp **+200** statt +80. |
| 🤡 **Familienclown** | 8 Spieler | Wirst du in einer **Abstimmung** gewählt, wird jede **Strafe zum Bonus** (und jeder Bonus verdoppelt). Hält dich die Familie beim Finale mehrheitlich für den **Butler** oder das **Kind**, kassierst du jeweils **+250**. Also: Benimm dich verdächtig! |

Hinweise auf Rollen gibt es in der **Bibliothek**, bei der **Wahrsagerin**, durch Klauseln wie „Der Notar flüstert“, „Vaterschaftstest“ oder „Miau?“ und wenn Karten an jemandem „abprallen“.

## Erbstücke

Im Schlafzimmer liegen 20 Erbstücke, von der goldenen Taschenuhr bis zur unheimlichen Puppe. Ihr **Wert bleibt geheim** bis zur Testamentseröffnung. Manche sind **verflucht** und kosten am Ende Geld. Mit dem *Vergifteten Geschenk* kannst du ein Erbstück loswerden, aber vielleicht verschenkst du gerade den Diamantring.

## Geister: Niemand scheidet aus

Wer **0 Taler** hat, wird zum **Geist** 👻. Geister:

- wählen jede Runde einen Raum, den sie **heimsuchen**,
- bekommen von **jedem Lebenden** in diesem Raum **25 Taler**,
- werden **wieder lebendig**, sobald sie **100 Taler** haben,
- können keine Karten spielen und nicht als Ziel gewählt werden.

Die Klausel „Séance“ holt alle Geister mit 120 Talern zurück.

## Die Minispiele im Familienstreit

| Minispiel | So geht's | Gewinner |
|---|---|---|
| 👆 **Tipp-Wahnsinn** | Tippe in 5,5 Sekunden so oft wie möglich. | Die meisten Tipps |
| 🤠 **Revolverheld** | Warte, bis der Bildschirm grün wird, dann tippe. Zu früh heißt raus. | Schnellste Reaktion |
| 🤔 **Schätzfrage** | Schätze eine Zahl (z. B. Höhe des Eiffelturms). | Am nächsten dran |
| ⏱️ **Ottos Taschenuhr** | Starte die Uhr und stoppe bei genau 5,00 Sekunden. Nach 2 Sekunden wird sie unsichtbar. | Am nächsten an 5,00 s |
| 🧠 **Ottos Gedächtnis** | Merke dir die Farbfolge und tippe sie nach. Jede Runde wird sie länger. Ein Fehler beendet das Spiel. | Längste Folge |
| 🧮 **Steuerberater** | Löse in 15 Sekunden so viele Rechenaufgaben wie möglich (vier Antworten zur Auswahl). | Meiste richtige |
| 🎈 **Luftballon** | Pumpe den Ballon auf und kassiere rechtzeitig. Platzt er, hast du nichts. Alle haben denselben Ballon. | Meiste Pumpstöße ohne Platzen |
| 🎨 **Farbchaos** | Das Wort „ROT“ steht in blauer Schrift: Tippe die **Farbe der Schrift**, nicht das Wort. Fehler kosten einen Punkt. | Meiste Punkte |
| 🔨 **Hau den Verwandten** | Hau auf die Verwandten, die aus den Löchern schauen. Ottos Katze kostet 2 Punkte. | Meiste Punkte |
| 🪙 **Münzen zählen** | Ein Haufen Münzen erscheint für 3 Sekunden. Wie viele waren es? | Am nächsten dran |
| 🔐 **Tresor knacken** | Errate die Zahl von 1 bis 100. Nach jedem Tipp kommt „höher“ oder „niedriger“. | Wenigste Versuche |
| 🔍 **Finde den Unterschied** | In einem Raster ist ein Bild anders als die anderen. Finde es, so oft wie möglich. | Meiste Treffer |
| ⬆️ **Pfeilregen** | Tippe die Richtung des Pfeils. Ist der Pfeil **rot**, tippe die **Gegenrichtung**! | Meiste Punkte |
| 🤑 **Gierschlund** | Wähle eine Zahl von 1 bis 10. Gewinnt die **höchste Zahl, die nur einer gewählt hat**. Gleiche Zahlen heben sich auf. | Höchste einzigartige Zahl |

Die Klausel „Verkehrte Welt“ dreht alles um: Dann gewinnt der Schlechteste. Manche Klauseln legen das Minispiel fest (Quizabend, Tippfieber, Jahrmarkt, Gedächtnistraining, Steuerprüfung).

## Die Testamentseröffnung (Finale)

Nach der letzten Runde:

1. **Letzte Verdächtigung:** Alle stimmen geheim ab, wer der **Butler** und wer das **uneheliche Kind** ist (sofern es diese Rollen gibt). Jeder richtige Tipp bringt **+80** (der Wahrsagerin **+200**).
2. **Die Erbstücke** jedes Spielers werden geschätzt. Verfluchte Stücke ziehen Geld ab.
3. **Butler und Kind** werden enthüllt. Liegt die Familie mit den meisten Stimmen richtig, ist die Rolle **erwischt**. Sonst greift ihr Bonus.
4. **Die Wahrsagerin** wird enthüllt, mit ihren Treffern.
5. **Der Familienclown** wird enthüllt. Für jede Verdächtigung, die mehrheitlich auf ihn fiel, gibt es +250.
6. **Die Katze** wird enthüllt. Ist sie die Ärmste, bekommt sie +400.
7. Bei **Familienzweigen** bekommt jedes Mitglied der reichsten Familie +100.
8. **Alle Rollen** werden aufgedeckt, dann folgt das **Siegerpodest**.

## Spielerzahl: 2 bis 15

| Spieler | Was sich ändert |
|---|---|
| 2–3 | Nur gierige Verwandte. Tipp: Bot-Verwandte hinzufügen, damit die Villa voller wird. |
| 4 | Ein **uneheliches Kind** ist dabei. |
| 5 | Zusätzlich ein **Butler**. |
| 6 | Zusätzlich **Ottos Katze**. |
| 7 | Zusätzlich die **Wahrsagerin**. |
| 8 | Zusätzlich der **Familienclown**. Ab hier gibt es alle sechs Rollen. |
| 9 | Die Villa bekommt **Dachboden** und **Ballsaal** (8 Räume). |
| 10–15 | **Familienzweige**: Teams aus etwa 3 Personen. Jeder spielt für sich, aber die reichste Familie bekommt am Ende einen Bonus. Familienmitglieder stehen im Dossier. |

## Geheime Nachrichten (Chat)

Über den Knopf **💬** auf dem Handy kann jeder **privat** mit jedem anderen schreiben: Bündnisse schmieden, lügen, drohen, bestechen. Bei **Familienzweigen** (ab 10 Spielern) gibt es zusätzlich einen **Familienchat**, den nur die eigene Familie lesen kann.

Der Fernseher zeigt **nie den Inhalt**, aber er verrät, **dass** geflüstert wird: „Elif flüstert Murat etwas zu…“. Das sorgt garantiert für Misstrauen. Auch die Bot-Verwandten antworten, allerdings selten hilfreich.

## Bot-Verwandte

Bots heißen zum Beispiel **Ayşe Teyze**, **Mehmet Amca** oder **Hüseyin Dede**. Sie füllen leere Plätze auf, wählen ihre Räume aber ziemlich planlos, spielen nur ab und zu eine Karte und sind in den Minispielen eher mittelmäßig. Gut zum Üben, schlagbar für jeden.

## Musik, Soundeffekte und Notar-Stimme

- **Musik 🎵:** Eigene Stücke für Lobby (unheimlicher Walzer), Planung (Schleich-Musik), Duelle (Galopp) und Finale (Fanfaren). Läuft auf dem Fernseher und wird leiser, sobald der Notar spricht.
- **Soundeffekte 🔊:** Jede Karte hat ihren eigenen Klang: Rutschpfeife bei der Bananenschale, Hammer beim Anwalt, Klebeband-Ratschen beim Absperrband, Kassenklingeln bei der Erpressung, „Miau“ bei der Katze, Treppensturz im Keller, Rülpser bei verdorbenem Essen und vieles mehr.
- **Notar-Stimme 🗣️:** Der Notar spricht mit einer natürlichen Stimme (auf Deutsch und Türkisch). Die Sätze sind als Audiodateien im Spiel gespeichert und funktionieren deshalb in **jedem Browser**, auch offline. Alle drei lassen sich oben rechts am Fernseher einzeln abschalten.

## Einstellungen

- **Runden:** 5, 6, 8, 10 oder 12.
- **Planungszeit:** 20 bis 60 Sekunden.
- **Musik, Ton, Notar-Stimme:** einzeln ein- und ausschaltbar (🎵 🔊 🗣️).
- **Weiter ⏭:** Überspringt die aktuelle Wartezeit.
- **Sitzung beenden 🚪:** Beendet das Spiel nach einer Sicherheitsabfrage sofort für alle. Fernseher und Handys zeigen den Endstand, danach kann eine neue Sitzung eröffnet werden.
- **Vollbild ⛶** für den Fernseher.

## Strategie-Tipps

- **Der Tresor ist verlockend, aber gefährlich.** Wenn alle hingehen, gibt es Alarm.
- **Lockvogel plus Duell:** Zieh einen schwachen Tipper in dein Schlafzimmer.
- **Lügen ist erlaubt.** „Ich gehe in den Keller“ heißt gar nichts.
- **Der Garten ist sicher, aber langweilig.** Gut, wenn du viel Geld hast und Diebe fürchtest.
- **Die Bibliothek gewinnt das Finale.** Wer die Rollen kennt, tippt richtig und stoppt Butler und Kind.
- **Als Katze:** Gib dich arm. Verliere absichtlich und kassiere am Ende 400.
- **Als Butler:** Sei unauffällig. Wer zu laut verdächtigt, wird verdächtig.
- **Als Clown:** Sei laut, verdächtig und peinlich. Je öfter du gewählt wirst, desto besser.
- **Als Wahrsagerin:** Verrate nicht zu früh, was du weißt. Sonst wirst du zur Zielscheibe.
- **Chat nutzen:** Ein geheimes Bündnis für den Tresor ist Gold wert. Ob es hält, ist eine andere Frage.

## Die 100 Testamentsklauseln

Die vollständige Liste steht in **KLAUSELN.md** und im Regelwerk im Browser unter `http://localhost:3000/regeln`.
