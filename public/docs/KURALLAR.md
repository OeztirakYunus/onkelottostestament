# Otto Amca'nın Vasiyeti – Oyun Kuralları

*2 ile 15 açgözlü akraba için kaotik bir miras oyunu. Süre: yaklaşık 20–35 dakika.*

## Hikâye

Eksantrik milyoner **Otto Amca** öldü. Geride hazinelerle dolu bir konak, bir kasa, keyfi kaçık bir bodrum ve birbirini hiç sevmeyen bir aile bıraktı. Siz onun akrabalarısınız ve mirası istiyorsunuz. Sorun şu: Otto'nun vasiyeti tamamen çılgın. **Noter her tur kuralları değiştiren yeni bir madde okuyor.**

Vasiyetin açılışından sonra en büyük servete sahip olan konağın sahibi olur.

## Gerekenler

- **Ortak bir ekran**: televizyon, projeksiyon ya da dizüstü bilgisayar. Oyun tahtası burada görünür.
- **Kişi başı bir telefon**. Gizli kart elin ve kumandan olur. Uygulama gerekmez, sadece tarayıcı.
- Tüm cihazlar **aynı Wi-Fi ağında** olmalı.

## Oyunu başlatmak

1. Bilgisayarda proje klasöründe bir kez `npm install`, ardından `npm start` çalıştır.
2. Tarayıcıda `http://localhost:3000` adresini aç ve **„Oyunu aç“** seç. Bu ekranı mümkünse televizyona yansıt.
3. Noterin dilini seç (Deutsch ya da Türkçe) ve **„Vasiyeti aç“** düğmesine bas.
4. Herkes telefonuyla **QR kodu** tarar ya da gösterilen adresi ve dört harfli **oda kodunu** girer.
5. İsmini gir, kendinin bir **portre fotoğrafını** çek („Yağlı boya“ ya da „Hayalet“ gibi filtrelerle) ve katıl. Fotoğraf istemeyen bir hayvan yüzü seçer. Her telefon kendi dilini seçebilir.
6. İsteğe bağlı: **Bot akraba** ekle (2–3 kişide çok işe yarar), **tur sayısını** ve **plan süresini** ayarla.
7. **„Oyunu başlat“** düğmesine bas.

## Oyunun amacı

Oyun sonunda en büyük **servete** sahip olmak. Servet; **Altınların**, **miras eşyalarının gizli değeri** ve vasiyet açılışındaki bonuslardan oluşur.

Herkes **300 Altın** ve **2 kartla** başlar.

## Bir turun akışı

Bir oyun 5 ile 12 tur sürer (standart: 8). Her turda altıya kadar aşama vardır. Herkes **aynı anda** oynar, kimse sırasını beklemez.

### 1. Madde

Noter yeni bir **vasiyet maddesi** okur. Madde sadece o tur geçerlidir. Bazı maddeler hemen etki eder (örneğin vergiler ya da Robin Hood), bazıları odaları, kartları ya da düelloları değiştirir, bazıları da tur sonunda bir **oylama** duyurur.

**Son tur** her zaman aynı maddeye sahiptir: Tüm odalar üç kat öder.

### 2. Gizli plan

Herkes telefonunda **gizlice** seçer:

- gideceği **bir oda** ve
- oynayacağı **en fazla bir kart** (bazı maddeler iki karta izin verir ya da kartları yasaklar).

Geri sayım bitene kadar plan değiştirilebilir. Hiçbir şey seçmeyen bahçeye düşer. Herkes hazırsa oyun hemen devam eder.

**Masada pazarlık etmek, yalan söylemek ve tehdit etmek serbesttir, hatta istenir.**

### 3. Açılış

Tüm figürler aynı anda odalarına yürür. Ardından oynanan kartlar bu **sabit sırayla** uygulanır:

1. Avukatım! (koruma) ve Sahte Vasiyet
2. Şerit, Koku Bombası
3. Elektrik Kesintisi, Yemek Zili
4. Yem, Taklitçi, Yer Değiştir, Muz Kabuğu
5. Yankesici, Avukat Faturası, Para Mıknatısı, Kart Hırsızı, Paparazzi, Uyku İlacı, Şarap Tadımı
6. Şantaj, Zehirli Hediye
7. Lanet, Zar, Miras Avcısı, Dört Yapraklı Yonca, Parti Düdüğü

### 4. Aile kavgası (düello)

Birden fazla mirasçı karşılaşırsa kavga çıkar:

- **Kasa odasında iki kişi** ganimet için düello yapar.
- **Yatak odasında iki veya daha fazla kişi** miras eşyası için düello yapar.

Tüm düellocular telefonda **aynı anda aynı mini oyunu** oynar. Sonuç oda oda değerlendirilir. „Alarm tembel“ maddesinde kasa için üç kişi de kavga edebilir.

### 5. Hesaplaşma

Her oda ödemesini yapar (aşağıdaki tabloya bakın). Ardından dağılıma bağlı maddeler etki eder. **0 Altını** kalan herkes **hayalet** olur.

### 6. Oylama (sadece bazı maddelerde)

„Sessizlik maddesi“ ya da „Mazeret kontrolü“ gibi maddelerde herkes telefondan oy verir. En çok oy alan kişi maddenin bonusunu ya da cezasını alır. Beraberlikte kura çekilir. Kimse kendine oy veremez.

### Turlar arasında: Açık artırma ve sürpriz

- Her **üç turda bir** bir **miras eşyası açık artırmaya** çıkar (bkz. „Miras eşyası açık artırması“).
- 2. turdan itibaren her an bir **büyük sürpriz** patlayabilir (oyun başına en fazla üç, son turdan önce asla).

## Odalar

| Oda | Etkisi |
|---|---|
| 💰 **Kasa Odası** | Tek başına: **+150**. İki kişi: düello, kazanan +150, kaybeden +40. 3 kişiden itibaren: **ALARM**, herkes −50. |
| 🍳 **Mutfak** | Herkes **bir kart** çeker (el sınırı 4, en eski kart düşer). |
| 📚 **Kütüphane** | **+40** ve uşak ya da çocuk hakkında gizli bir **ipucu** (bkz. „İpucu toplamak“). |
| 🛏️ **Yatak Odası** | Gizli değerli bir **miras eşyası**. Birden fazla kişi: düello, sadece kazanan alır. |
| 🕳️ **Bodrum** | Herkes için ayrı kumar: %45 **+180**, %35 **−90**, %20 sadece fareler. |
| 🌳 **Bahçe** | **+20**. Bahçedeki kişi, kendisini hedef alan tüm kartlara (Muz Kabuğu, Yem, Yankesici, Hediye) ve şantaja karşı **bağışıktır**. Elektrik kesintisi yine de etkiler. |
| 🕸️ **Tavan Arası** *(9 oyuncudan itibaren)* | **+30** ve bir kart. |
| 💃 **Balo Salonu** *(9 oyuncudan itibaren)* | Oradaki herkes **300**'ü paylaşır. |

## Kartlar

| Kart | Etkisi |
|---|---|
| 🍌 **Muz Kabuğu** | Hedefin rastgele **başka** bir odaya kayar (bahçedeyse işlemez). |
| 🧤 **Yankesici** | Hedefinden **60** çal (bahçede işlemez). |
| 📜 **Sahte Vasiyet** | Bu tur oda kazancın **iki katına** çıkar. |
| ⚖️ **Avukatım!** | Bu tur seni hedef alan **hiçbir kart** işlemez ve elektrik kesintisi seni etkilemez. |
| 🔌 **Elektrik Kesintisi** | **Herkes** rastgele açık odalara dağılır. |
| 🪤 **Yem** | Hedefini **kendi** odana çek (bahçeden çekemezsin). Birini düelloya zorlamak için ideal. |
| 🚧 **Şerit** | Bir odayı kapat (bahçe hariç). Oradakiler bahçeye atılır. |
| 🎁 **Zehirli Hediye** | Hedefe **rastgele bir miras eşyanı** hediye et. Lanetli mi? Kimse bilmiyor! |
| 💼 **Şantaj** | Odandaki diğer herkesten **30** al. |
| 🔄 **Yer Değiştir** | Hedefinle odanızı değiştirirsiniz. |
| 🧲 **Para Mıknatısı** | **Diğer her** mirasçıdan **10** Altın çek (korunanlardan ve bahçedekilerden hariç). |
| 🍀 **Dört Yapraklı Yonca** | **Bodrumda** büyük ikramiye (+180) garanti. Değilse +40 alırsın. |
| 💤 **Uyku İlacı** | Hedefin turu uyuyarak geçirir ve **odada hiçbir şey kazanmaz**. |
| 🧾 **Avukat Faturası** | Hedefin sana servetinin **%10** kadarını öder (en az 20). |
| 🐒 **Taklitçi** | Hedefini **onun** odasına kadar takip edersin. Kasayı ona zehir etmek için ideal. |
| 🎲 **Zar** | Yarı yarıya: **+120** ya da **−60**. |
| 🔔 **Yemek Zili** | **Diğer herkes** mutfağa koşar (mutfak kapalıysa bahçeye). Sadece sen yerinde kalırsın. |
| 🕯️ **Lanet** | Seçilen odadaki herkes **40** kaybeder. Oradaysan sen de! |
| 🎺 **Parti Düdüğü** | Odandaki diğer her mirasçı için **+25**. |
| 📸 **Paparazzi** | Hedefinin gizli bir rolü **olup olmadığını** öğrenirsin – ama hangisi olduğunu değil. |
| 🐍 **Kart Hırsızı** | Hedefinden rastgele bir kart çal. |
| 🍷 **Şarap Tadımı** | Hedefin çakırkeyif olur ve **bu tur her düelloyu kaybeder**. |
| 💨 **Koku Bombası** | Seçilen odadaki herkes rastgele başka odalara kaçar. |
| 🏺 **Miras Avcısı** | **80** öde ve hemen gizli bir miras eşyası al. İyi mi, lanetli mi? |

## Gizli roller

Başlangıçta herkes telefonunda gizlice bir rol alır. Kimse başkasının telefonuna bakamaz.

| Rol | Kaç kişiden itibaren | Etkisi |
|---|---|---|
| 🤑 **Açgözlü Akraba** | her zaman | Sadece en zengin ol. |
| 👶 **Gayrimeşru Çocuk** | 4 oyuncu | Sonunda **yakalanmazsan** servetine **%50** bonus alırsın. |
| 🤵 **Uşak** | 5 oyuncu | Sonunda **yakalanmazsan** diğer herkesin servetinin **%15**'ini çalarsın. |
| 🐈‍⬛ **Otto'nun Kedisi** | 6 oyuncu | **9 can:** Sana karşı oynanan ilk **3 kart** seker. Sonunda **en fakir** sen olursan **+400** mama parası alırsın. |
| 🔮 **Falcı** | 7 oyuncu | Kristal küren **her tur** fısıldar: Uşak ya da çocuk **iki kişiden biridir**. Finalde her doğru tahminin +80 yerine **+200** getirir. |
| 🤡 **Aile Soytarısı** | 8 oyuncu | Bir **oylamada** seçilirsen her **ceza bonusa** dönüşür (her bonus da iki katına çıkar). Finalde aile seni çoğunlukla **uşak** ya da **çocuk** sanırsa her biri için **+250** kazanırsın. Yani: şüpheli davran! |

Rollerle ilgili ipuçları **kütüphanede**, **falcıda**, „Noter fısıldıyor“, „Babalık testi“ ya da „Miyav?“ gibi maddelerde ve kartlar birinin üzerinden „sektiğinde“ ortaya çıkar.

### İpucu toplamak

Kimse bir rolü doğrudan öğrenmez. Sadece **ipuçları** vardır ve bir dedektif gibi birleştirilmeleri gerekir:

- **Kütüphane:** ya „Uşak şu üç kişiden biri: A, B ya da C“ ya da „A kesinlikle gayrimeşru çocuk değil“.
- **Falcı:** her tur „Çocuk ya A ya da B“.
- **Paparazzi:** sadece „A'nın gizli bir rolü var“ ya da „A zararsız“, ama hangi rol olduğu değil.
- **Rol değişimi (sürpriz):** Sonrasında eski ipuçları yanlış olabilir.

Tüm ipuçları tur numarasıyla telefondaki dosyada 📂 durur. İpuçları her zaman doğrudur, ama ancak birkaçı bir araya gelince kimin kim olduğu anlaşılır. Onları paylaşmak, satmak (anlaşma!) ya da kendine saklamak senin elinde.

## Miras eşyaları

Yatak odasında altın cep saatinden ürkütücü bebeğe kadar 20 miras eşyası var. **Değerleri vasiyet açılana kadar gizlidir.** Bazıları **lanetlidir** ve sonunda para kaybettirir. *Zehirli Hediye* ile bir eşyadan kurtulabilirsin, ama belki de pırlanta yüzüğü hediye ediyorsun.

## Hayaletler: Kimse elenmez

**0 Altını** kalan **hayalet** 👻 olur. Hayaletler:

- her tur **musallat olacakları** bir oda seçer,
- o odadaki **her canlıdan 25 Altın** alır,
- **100 Altına** ulaşınca **yeniden canlanır**,
- kart oynayamaz ve hedef seçilemez.

„Ruh çağırma seansı“ maddesi tüm hayaletleri 120 Altınla geri getirir.

## Aile kavgasının mini oyunları

| Mini oyun | Nasıl oynanır | Kazanan |
|---|---|---|
| 👆 **Dokunma Çılgınlığı** | 5,5 saniyede olabildiğince çok dokun. | En çok dokunan |
| 🤠 **Silahşör** | Ekran yeşil olunca dokun. Erken dokunan elenir. | En hızlı tepki |
| 🤔 **Tahmin Sorusu** | Bir sayı tahmin et (örneğin Eyfel Kulesi'nin yüksekliği). | En yakın tahmin |
| ⏱️ **Otto'nun Cep Saati** | Saati başlat ve tam 5,00 saniyede durdur. 2 saniye sonra saat görünmez olur. | 5,00 sn'ye en yakın |
| 🧠 **Otto'nun Hafızası** | Renk sırasını aklında tut ve tekrarla. Her tur uzar. Tek hata oyunu bitirir. | En uzun sıra |
| 🧮 **Mali Müşavir** | 15 saniyede olabildiğince çok işlem çöz (dört şık). | En çok doğru |
| 🎈 **Balon** | Balonu şişir ve zamanında parayı al. Patlarsa elin boş kalır. Herkesin balonu aynıdır. | Patlatmadan en çok pompa |
| 🎨 **Renk Kaosu** | Mavi renkle „KIRMIZI“ yazıyor: Kelimenin değil **yazının rengine** dokun. Hata bir puan götürür. | En çok puan |
| 🔨 **Akrabaya Vur** | Deliklerden çıkan akrabalara vur. Otto'nun kedisi 2 puan götürür. | En çok puan |
| 🪙 **Altın Say** | Bir yığın altın 3 saniyeliğine görünür. Kaç taneydi? | En yakın tahmin |
| 🔐 **Kasayı Kır** | 1 ile 100 arasındaki sayıyı bul. Her tahminden sonra „daha büyük“ ya da „daha küçük“ yazar. | En az deneme |
| 🔍 **Farklı Olanı Bul** | Izgarada bir resim diğerlerinden farklı. Olabildiğince çok bul. | En çok isabet |
| ⬆️ **Ok Yağmuru** | Okun yönüne dokun. Ok **kırmızıysa** **ters yöne** dokun! | En çok puan |
| 🤑 **Açgözlü** | 1 ile 10 arasında bir sayı seç. **Sadece bir kişinin seçtiği en yüksek sayı** kazanır. Aynı sayılar birbirini götürür. | En yüksek tek sayı |

„Ters dünya“ maddesi her şeyi tersine çevirir: O zaman en kötü olan kazanır. Bazı maddeler mini oyunu belirler (bilgi yarışması, dokunma ateşi, panayır, hafıza antrenmanı, vergi denetimi).

## Vasiyetin açılışı (final)

Son turdan sonra:

1. **Son şüphe:** Herkes gizlice **uşağın** ve **gayrimeşru çocuğun** kim olduğunu oylar (bu roller varsa). Her doğru tahmin **+80** getirir (falcıya **+200**).
2. Her oyuncunun **miras eşyaları** değerlenir. Lanetli eşyalar para kaybettirir.
3. **Uşak ve çocuk** açıklanır. Aile en çok oyla doğru kişiyi seçtiyse rol **yakalanmış** olur. Yoksa bonusu işler.
4. **Falcı** isabetleriyle birlikte açıklanır.
5. **Aile soytarısı** açıklanır. Çoğunluğun ondan şüphelendiği her soru için +250 alır.
6. **Kedi** açıklanır. En fakir oyuncuysa +400 alır.
7. **Ailelerle** oynanıyorsa en zengin ailenin her üyesi +100 alır.
8. **Otto Ödülleri:** Oyunun en büyük rezaletleri için en fazla sekiz eğlenceli ödül – örn. 🥀 *Ebedi kurban* (en çok soyulan), 💬 *Geveze*, 🍌 *Altın muz kabuğu*, 🍅 *Domatesçi*, 🎰 *Yılın kumarbazı*, 🐍 *Yılan* ya da 🔨 *Alışveriş bağımlısı*. Herkes ödüllerini telefonunda da görür.
9. **Tüm roller** açılır ve ardından **kürsü** gelir.

## Seyirciler: Bahis ve sabotaj

Bir aile kavgasında **oynamayan** sadece izlemez:

- **Bahis:** Duyuru ve oyun sırasında bir düellocuya 10 ile 200 Altın arasında bahis yaparsın. O kazanırsa yatırdığının **(rakip sayısı) katını** kazanırsın (ikili düelloda iki katı). Kaybederse para gider. Tüm bahisler televizyonda canlı görünür.
- **Sabotaj:** Mini oyun sürerken **3 atış** hakkın var ve bir düellocuyu hedef alırsın:
  - 🍅 **Domates** – telefonuna yapışır,
  - 📳 **Sallantı** – ekranı titrer,
  - 🌫️ **Sis** – her şey bulanıklaşır,
  - 🙃 **Ters dönme** – ekranı bir anlığına baş aşağı olur.
  
  Televizyonda atışlar kurbana doğru uçar. Hayaletler sabote edebilir ama bahis oynayamaz.

## Fotoğraf şakaları ve aranıyor afişi

- **Kaybedenler süslenir:** Düello kaybeden ya da oylamada ceza alan bir tur boyunca portresinde **palyaço burnu**, **bıyık**, **gangster gözlüğü** ya da **tuvalet kâğıdı türbanı** taşır – televizyonda ve tüm telefonlarda.
- **ARANIYOR:** 2. turdan itibaren plan başında televizyonda **en zengin mirasçının** afişi asılır. Bu turda onu ilk soyan (hırsız, fatura ya da kart çalma) **+50 ödül** daha alır.

## Selfie düelloları

Beş madde (📸) **selfie düellosudur**: Tüm insanlar telefonla maddenin konusuna uygun bir selfie çeker („Olabildiğince zengin bakın!“). Fotoğraflar televizyonda polaroid olarak görünür, aile en iyisini oylar (+100). Selfie profil fotoğrafının yerini almaz. İkiden az kişi selfie çekerse herkes arasında normal oylama yapılır.

## Ticaret ve anlaşmalar

Telefonun üstündeki **🤝** düğmesiyle istediğin zaman (lobi ve final hariç) **anlaşma** teklif edebilirsin:

- **Ben ödüyorum**, **ben istiyorum**, **elimden bir kart veriyorum**,
- ve/veya bir **söz**: „Gelecek tur kasaya girmeyeceğim“, „Sana karşı kart oynamayacağım“, „Asla sana karşı oy vermeyeceğim“, „Seninle aynı odaya gireceğim“, „Seni bir daha asla soymayacağım“ ya da **kendi metnin**.

Karşı taraf **imzalar** ya da **reddeder**. İmzalanınca para ve kart hemen el değiştirir. Sözlerin tutulup tutulmadığını kimse kontrol etmez. Ama her taraf istediği zaman **🚨 Sözleşme ihlalini bildir**ebilir. O zaman diğeri televizyonda herkesin önünde **YILAN** ilan edilir, söz okunur ve portresinde bir tur boyunca 🐍 durur. Haksız yere bildiren mi? Onu masada konuşursunuz. Kişi başına en fazla 3 açık teklif.

## Miras eşyası açık artırması

Her üç turda bir, bir miras eşyası açık artırmaya çıkar. Herkes telefonda **gizlice** teklif verir, **en yüksek teklif** kazanır ve teklif ettiği parayı öder (eşitlikte kura). Eşyanın değeri gizlidir ve ancak finalde belli olur – **lanetli** de olabilir. Televizyonda teklifler küçükten büyüğe açılır, sonra tokmak iner: „Satıldı!“

## Büyük sürprizler

Bazen iki tur arasında hiç beklenmedik bir şey olur. Televizyon kocaman bir **BÜYÜK SÜRPRİZ!** gösterir:

| Sürpriz | Ne olur |
|---|---|
| ⚰️ **Otto yaşıyor!** | Sadece ölü taklidi yapıyormuş. Otto herkesten %20 toplayıp toplamı eşit dağıtır. |
| 🚔 **Vergi baskını!** | Herkes telefonda gizlice bir odaya saklanır. Müfettişler rastgele bir odayı basar: Orada saklanan %30 kaybeder. |
| 📜 **İkinci vasiyet!** | En zengin 150 öder, en fakir (en fazla üç) kişi 150'şer alır. |
| 🌋 **Deprem!** | Bütün miras eşyaları karışır ve yeni sahiplerine düşer. |
| 🎭 **Rol değişimi!** | İki akraba gizlice rollerini değiştirir. Sadece o ikisi telefonda öğrenir. |
| 🗝️ **Hazine avı!** | Herkes 9 saniye boyunca deli gibi „KAZ!“ düğmesine dokunur. En hızlı üç kişi 150, 100 ve 50 alır. |
| 🦅 **Akbabalar geliyor!** | Bütün eldeki kartlar gider, herkes 2 yeni kart alır. |
| 🤠 **Amerikalı kuzen!** | Teksaslı kuzen Billy payını ister: Herkes %10 öder. |

Oyun başına en fazla üç sürpriz, hiçbiri iki kez gelmez.

## Oyuncu sayısı: 2–15

| Oyuncu | Ne değişir |
|---|---|
| 2–3 | Sadece açgözlü akrabalar. İpucu: Konak dolsun diye bot akraba ekleyin. |
| 4 | Bir **gayrimeşru çocuk** oyunda. |
| 5 | Ayrıca bir **uşak**. |
| 6 | Ayrıca **Otto'nun kedisi**. |
| 7 | Ayrıca **falcı**. |
| 8 | Ayrıca **aile soytarısı**. Buradan itibaren altı rolün hepsi oyunda. |
| 9 | Konağa **tavan arası** ve **balo salonu** eklenir (8 oda). |

## Aileler (serbestçe ayarlanır)

Ev sahibi lobide ailelerle oynanıp oynanmayacağını belirler, hem de **her oyuncu sayısında**:

| Ayar | Nasıl çalışır |
|---|---|
| **Kapalı** | Herkes kendi başına oynar. |
| **Rastgele** | Oyun başlarken herkes ailelere eşit şekilde kurayla dağıtılır. |
| **Kendin seç** | Herkes ailesini telefonundan seçer. Ev sahibi televizyonda birine (botlara da) dokunarak onu başka aileye alabilir. Seçmeyen en küçük aileye girer. |

**2 ile 6 aile** vardır, her birinin kendi arması, rengi ve sloganı var:

| Arma | Aile | Slogan |
|---|---|---|
| 🦷 | **Takma Diş Çetesi** | „Dişimizi sıkarız!“ |
| 🥙 | **Kebap Klanı** | „Acı ama samimi.“ |
| 🥿 | **Terlik Kahramanları** | „Rahat rahat zenginliğe.“ |
| 🍯 | **Baklava Hanedanı** | „Tatlı, yapışkan, tehlikeli.“ |
| 🦊 | **Miras Avcıları** | „Önce gülümse, sonra miras al.“ |
| 🧦 | **Çorap Çetesi** | „Başkalarının sakladığını hep buluruz.“ |

Oyun başlarken televizyon aileleri törenle tanıtır. Oyunda herkes ailesinin armasını taşır, bir **aile sohbeti** vardır ve sonunda **en zengin ailenin her üyesi +100** alır. Yine de sonunda tek bir kişi kazanır: Aile güzel ama para paradır.

## Gizli mesajlar (sohbet)

Telefondaki **💬** düğmesiyle herkes herkese **özel** mesaj yazabilir: ittifak kur, yalan söyle, tehdit et, rüşvet ver. **Ailelerle** oynanıyorsa sadece kendi ailenin okuyabildiği bir **aile sohbeti** de vardır.

Televizyon **mesajların içeriğini asla göstermez**, ama **fısıldaşıldığını** belli eder: „Elif, Murat kişisinin kulağına bir şey fısıldıyor…“. Bu da güvensizliği garanti eder. Bot akrabalar da cevap verir, ama pek işe yarar şeyler söylemezler.

## Bot akrabalar

Botların adları örneğin **Ayşe Teyze**, **Mehmet Amca** ya da **Hüseyin Dede**. Boş yerleri doldururlar ama odalarını oldukça plansız seçerler, sadece arada bir kart oynarlar ve mini oyunlarda vasattırlar. Alıştırma için ideal, herkes yenebilir.

## Müzik, ses efektleri ve noterin sesi

- **Müzik 🎵:** Lobi (ürkütücü vals), plan (sinsi müzik), düello (dörtnala) ve final (fanfar) için özel parçalar. Televizyonda çalar ve noter konuşunca kısılır.
- **Ses efektleri 🔊:** Her kartın kendi sesi var: muz kabuğunda kayma düdüğü, avukatta tokmak, şeritte bant sesi, şantajda yazar kasa, kedide „miyav“, bodrumda merdivenden düşme, bozuk yemekte geğirme ve daha fazlası.
- **Noterin sesi 🗣️:** Noter doğal bir sesle konuşur (Almanca ve Türkçe). Cümleler oyunun içinde ses dosyası olarak kayıtlıdır, bu yüzden **her tarayıcıda**, internetsiz de çalışır. Üçü de televizyonun sağ üst köşesinden ayrı ayrı kapatılabilir.

## Ayarlar

- **Tur:** 5, 6, 8, 10 veya 12.
- **Plan süresi:** 20 ile 60 saniye.
- **Müzik, ses, noter sesi:** ayrı ayrı açılıp kapatılabilir (🎵 🔊 🗣️).
- **Geç ⏭:** Mevcut bekleme süresini atlar.
- **Oturumu bitir 🚪:** Bir onaydan sonra oyunu herkes için hemen bitirir. Televizyon ve telefonlar son durumu gösterir, ardından yeni bir oturum açılabilir.
- **Tam ekran ⛶** televizyon için.

## Strateji ipuçları

- **Kasa cazip ama tehlikeli.** Herkes oraya giderse alarm çalar.
- **Yem artı düello:** Yavaş dokunan birini yatak odana çek.
- **Yalan serbest.** „Bodruma gidiyorum“ hiçbir şey ifade etmez.
- **Bahçe güvenli ama sıkıcı.** Çok paran varsa ve hırsızlardan korkuyorsan ideal.
- **Kütüphane finali kazandırır.** Çok ipucu toplayıp birleştiren doğru tahmin eder ve uşakla çocuğu durdurur.
- **Kedi olarak:** Fakir görün. Bilerek kaybet ve sonunda 400'ü cebe at.
- **Uşak olarak:** Göze batma. Çok yüksek sesle suçlayan şüphe çeker.
- **Soytarı olarak:** Gürültücü, şüpheli ve utandırıcı ol. Ne kadar çok seçilirsen o kadar iyi.
- **Falcı olarak:** Bildiklerini erkenden açık etme. Yoksa hedef olursun.
- **Sohbeti kullan:** Kasa için gizli bir ittifak altın değerinde. Dayanıp dayanmayacağı ayrı bir soru.

## 105 vasiyet maddesi

Tam liste **KLAUSELN.md** dosyasında ve tarayıcıda `http://localhost:3000/regeln` adresindeki kurallarda yer alıyor.
