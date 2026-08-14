// Tek seferlik düzeltme scripti: 5. Sınıf Fen Bilimleri konularında kelime sayısı 60'ın altında kalan
// bölümlere ek madde eklemek ve kazanım bağlantısı olmayan bölümlere bağlantı eklemek için kullanıldı.
const { rest } = require('./lib/topic-content-pipeline');

const sectionUpdates = {
  220: `- Güneş, kendi ışığını üreten sıcak bir gaz küresidir; katı bir yüzeyi yoktur.
- Büyük oranda **hidrojen** ve **helyum** gazından oluşur.
- Güneş Sistemi'ndeki en büyük ve en kütleli gök cismidir.
- Çekirdeğe yaklaştıkça sıcaklık ve basınç artar; en yüksek sıcaklık **çekirdek** bölgesindedir.
- Dünya'ya en yakın yıldız olduğu için gökyüzünde en parlak ve en büyük görünen gök cismidir.
- Güneş'in kütlesi, Güneş Sistemi'ndeki toplam kütlenin yaklaşık %99'unu oluşturur.`,

  222: `- Güneş, gaz halinde olduğu için tüm yüzeyi aynı hızda dönmez.
- **Ekvator bölgesi** yaklaşık 25 günde, kutuplara yakın bölgeler yaklaşık 35 günde bir tam dönüş tamamlar.
- Bu farklı dönme hızına **diferansiyel dönme** denir.
- Güneş'in kendi ekseni etrafındaki dönme hareketi, katı gezegenlerin dönme hareketinden farklıdır.
- Dönme hareketi, güneş lekelerinin konumundaki değişim izlenerek doğrulanabilir.
- Diferansiyel dönme, Güneş'in gaz ve plazmadan oluşan akışkan yapısının doğal bir sonucudur.`,

  223: `- Güneş, Dünya'daki canlılar için temel **ısı** ve **ışık** kaynağıdır.
- Bitkilerin fotosentez yapabilmesi Güneş ışığına bağlıdır.
- Güneş'ten Dünya'ya ulaşan enerji, hava olaylarını ve mevsimlerin oluşmasını etkiler.
- Güneş hakkında araçlarla toplanan veriler (leke konumu, sıcaklık, katman bilgisi) düzenli olarak kaydedilerek yapısı ve hareketleri hakkındaki bilgiler doğrulanır.
- Bu kayıtlar, Güneş'in yapısı ve dönme hareketiyle ilgili bilgilerin güvenilir kaynaklara dayandırılmasını sağlar.
- Güneş'in çekirdeğinde gerçekleşen füzyon tepkimeleri, açığa çıkan bu ısı ve ışığın asıl kaynağıdır.`,

  224: `- Ay, Dünya'nın tek doğal **uydusu**dur.
- Kendi ışığı yoktur; gökyüzünde parlak görünmesinin sebebi Güneş ışığını yansıtmasıdır.
- Yüzeyinde **kraterler** (çukurlar), dağlar ve düz ovalar bulunur.
- Kraterler, genellikle gök taşı çarpmaları sonucu oluşmuştur.
- Atmosferi yoktur; bu yüzden yüzeyinde rüzgâr, yağmur gibi hava olayları yaşanmaz ve krater izleri milyonlarca yıl silinmeden kalır.
- Ay'ın çapı yaklaşık 3.474 kilometredir; yüzey sıcaklığı gündüz ve gece arasında çok büyük farklılık gösterir.`,

  225: `- Ay, kendi ekseni etrafında **dönme hareketi** yapar.
- Aynı zamanda Dünya'nın çevresinde **dolanma hareketi** yapar.
- Her iki hareketini de yaklaşık 27,3 günde tamamlar; bu nedenle bu iki süre birbirine eşittir.
- Dönme ve dolanma sürelerinin eşit olması nedeniyle Ay, Dünya'dan her zaman aynı yüzüyle görülür.
- Gözlemlerle elde edilen bu hareket verileri düzenli olarak kaydedilerek Ay'ın davranışı hakkında bilgi oluşturulur.
- Bu özel duruma **eşzamanlı (senkron) dönme** denir ve birçok doğal uyduda gözlenen ortak bir özelliktir.`,

  226: `- **Ay evreleri**, Ay'ın Dünya çevresindeki dolanması sırasında Güneş'e göre konumunun değişmesiyle oluşur.
- Ay'ın Güneş ışığıyla aydınlanan kısmının Dünya'dan görünen oranı sürekli değişir.
- Sırasıyla **yeni ay**, **hilal**, **ilk dördün**, **dolunay** ve **son dördün** evreleri gözlenir.
- Bir evreden aynı evreye dönüş yaklaşık 29,5 gün sürer.
- Toplanan gözlem verileri karşılaştırılıp değerlendirilerek evre sıralamasının düzenli bir döngü izlediği sonucuna varılır.
- Evreler gözlemlenirken Ay'ın kendisi şekil değiştirmez, yalnızca aydınlanan kısmının görünen oranı değişir.`,

  228: `- Güneş, Dünya ve Ay büyüklük bakımından birbirinden oldukça farklıdır.
- **Güneş**, üçü arasında en büyük gök cismidir; çapı Dünya'nın çapından yaklaşık 100 kat büyüktür.
- **Dünya**, Güneş'ten çok küçük olmasına rağmen Ay'dan büyüktür.
- **Ay**, üçü arasında en küçük olanıdır; çapı Dünya'nın çapının yaklaşık dörtte biri kadardır.
- Bu büyüklük farkları, model oluştururken cisimlerin gerçek oranlarına uygun ölçek seçilmesini gerektirir.
- Bu oranlar, üç gök cismi arasındaki büyüklük farkının ne denli belirgin olduğunu gösterir.`,

  229: `- Dünya ile Güneş arasındaki uzaklık, Dünya ile Ay arasındaki uzaklıktan çok daha fazladır.
- Dünya-Güneş arası uzaklık yaklaşık 150 milyon kilometredir.
- Dünya-Ay arası uzaklık ise yaklaşık 384 bin kilometredir.
- Bu büyük uzaklık farkı, gökyüzünde Güneş ve Ay'ın benzer büyüklükte görünmesine rağmen gerçekte çok farklı boyutlarda olmasının nedenidir.
- Model çalışmalarında hem büyüklük hem uzaklık oranlarının aynı anda gösterilmesi oldukça zordur.
- Işığın Güneş'ten Dünya'ya ulaşması yaklaşık 8 dakika sürerken Ay'dan yansıyan ışık saniyeler içinde ulaşır.`,

  233: `- **Dinamometre**, kuvvetin büyüklüğünü ölçmeye yarayan bir araçtır.
- İçindeki yayın, uygulanan kuvvetle orantılı olarak uzamasından yararlanılarak ölçüm yapılır.
- Ölçülecek cisim, dinamometrenin kancasına asılır ve yayın uzama miktarı üzerindeki ölçekten okunur.
- Kuvvet arttıkça yay daha fazla uzar, ölçekteki değer büyür.
- Dinamometre, hem çekme hem de itme kuvvetlerinin büyüklüğünü belirlemek için kullanılabilir.
- Dinamometrenin içindeki yay, belirli bir kuvvet sınırının üzerinde kalıcı olarak şeklini kaybedebileceğinden dikkatli kullanılmalıdır.`,

  234: `- Kuvvetin büyüklüğü **Newton (N)** birimiyle ifade edilir.
- Bu birim, kuvvet ve hareket yasalarını ortaya koyan bilim insanı **Isaac Newton**'ın adından gelir.
- Dinamometre üzerindeki ölçek genellikle Newton cinsinden derecelendirilmiştir.
- Bir cisme uygulanan kuvvet ne kadar büyükse, ölçülen Newton değeri de o kadar büyük olur.
- Kuvvetin birimini bilmek, farklı ölçümlerin karşılaştırılabilmesi için gereklidir.
- Küçük kuvvetler için bazen Newton'un binde biri olan milinewton (mN) birimi de kullanılabilir.`,

  236: `- **Kütle**, bir cisimde bulunan madde miktarıdır.
- Kütle, **terazi** ile ölçülür ve birimi **kilogram (kg)** veya **gram (g)** dır.
- Bir cismin kütlesi, bulunduğu yere göre değişmez; Dünya'da da Ay'da da aynı kalır.
- Kütlesi büyük olan bir cisim, aynı hacimdeki kütlesi küçük cisme göre daha fazla madde içerir.
- Cisimlerin kütlesi karşılaştırılırken eşit kollu terazi gibi araçlardan yararlanılır.
- Terazi kollarının dengeye gelmesi, karşılaştırılan iki cismin kütlelerinin birbirine eşit olduğunu gösterir.`,

  237: `- **Ağırlık**, bir cisme etki eden yer çekimi kuvvetidir.
- Ağırlık, kütleden farklı olarak bir **kuvvet** türüdür ve birimi Newton (N) dır.
- Bir cismin ağırlığı, bulunduğu gök cisminin yer çekimine göre değişir.
- Aynı cisim, Ay'da Dünya'dakinden daha az ağırlığa sahip olur çünkü Ay'ın yer çekimi Dünya'dan küçüktür.
- Yer çekimi kuvveti, cisimleri gök cisminin merkezine doğru çeker.
- Dünya'nın merkezine yaklaşıldıkça ya da uzaklaşıldıkça yer çekimi kuvvetinin şiddeti de değişiklik gösterebilir.`,

  238: `- **Kütle**, madde miktarını; **ağırlık** ise cisme etki eden yer çekimi kuvvetini ifade eder.
- Kütle değişmezken ağırlık, bulunulan yere göre değişebilir.
- Kütle terazi ile, ağırlık ise dinamometre ile ölçülür.
- Kütlenin birimi kilogram, ağırlığın birimi Newton'dur.
- Günlük dilde "ağırlık" kelimesi kütle yerine kullanılsa da bilimsel olarak bu iki kavram birbirinden farklıdır.
- Bir cismin kütlesi sıfır olamaz ama uzayın derinliklerinde yer çekiminden uzakta ağırlığı sıfıra yaklaşabilir.`,

  239: `- Bir cismin ağırlığı **dinamometre** kullanılarak ölçülür.
- Ölçüm yapılırken cisim dinamometrenin kancasına asılır.
- Cismin ağırlığı nedeniyle yay uzar ve ölçekteki değer Newton cinsinden okunur.
- Aynı cismin farklı dinamometrelerle ölçülen ağırlığı, ölçüm hatası olmadığı sürece aynı çıkar.
- Ölçüm sonuçları kaydedilerek cisimlerin ağırlıkları birbiriyle karşılaştırılabilir.
- Ölçüm sırasında dinamometrenin dik tutulması, doğru bir sonuç elde edilmesi için önemlidir.
- Farklı büyüklükteki cisimlerin ağırlıkları karşılaştırılarak hangisinin yer çekiminden daha fazla etkilendiği belirlenir.`,

  240: `- **Sürtünme kuvveti**, birbirine temas eden iki yüzey arasında harekete karşı ortaya çıkan kuvvettir.
- Bu kuvvet, hareket eden bir cismi yavaşlatır veya durdurur.
- Sürtünme, yüzeylerin pürüzlülüğünden kaynaklanır; pürüzlü yüzeylerde sürtünme daha fazladır.
- Bisiklet fren yaparken, top yerde yuvarlanırken yavaşça durduğunda sürtünme kuvveti etkilidir.
- Günlük yaşamdaki gözlemler, hareket eden her cismin bir süre sonra sürtünme nedeniyle yavaşladığını gösterir.
- Sürtünme kuvvetinin yönü, her zaman cismin hareket yönüne ters yöndedir.`,

  241: `- Sürtünme kuvveti, cismin bulunduğu ortama göre farklı şiddette etki eder.
- **Buz** gibi pürüzsüz yüzeylerde sürtünme azdır, cisimler kolay kayar.
- **Halı** veya **kum** gibi pürüzlü yüzeylerde sürtünme fazladır, hareket zorlaşır.
- **Su** ve **hava** içinde hareket eden cisimler de bu ortamların direnciyle karşılaşır.
- Farklı ortamlardaki gözlemler bir araya getirildiğinde, yüzey pürüzlülüğü arttıkça sürtünmenin de arttığı genellemesine ulaşılır.
- Kayak takımının kar üzerinde kolay kaymasının nedeni, kar-metal yüzeyleri arasındaki düşük sürtünmedir.`,

  242: `- **Sürtünmeyi azaltan** etkenler: yüzeyin cilalanması, yağ veya yağlayıcı kullanılması, tekerlek ya da bilye eklenmesi.
- **Sürtünmeyi artıran** etkenler: yüzeyin pürüzlü olması, cisme uygulanan basıncın (ağırlığın) artması.
- Araçların lastiklerindeki desenler, yolla temas yüzeyinde sürtünmeyi artırarak kaymayı önler.
- Makine parçalarına yağ sürülmesi ise sürtünmeyi azaltarak aşınmayı engeller.
- Sürtünme, bazen istenmeyen bir etkiyken (enerji kaybı) bazen de gerekli bir etkidir (yürüme, tutunma).
- Islak zeminlerde sürtünmenin azalması, kayma ve düşme riskini artırdığı için dikkat gerektirir.`,

  244: `- **Hücre**, canlıların yapı ve görev bakımından en küçük birimidir.
- **Hücre zarı**, hücreyi çevreleyen ve madde giriş çıkışını kontrol eden ince bir yapıdır.
- **Sitoplazma**, hücre zarının içini dolduran, organelleri içinde barındıran jel kıvamındaki maddedir.
- **Çekirdek**, hücrenin yönetim merkezidir; kalıtım bilgisini taşır.
- **Mitokondri**, hücrenin enerji üretiminden sorumlu organelidir.
- Bazı canlılar tek bir hücreden, insan gibi canlılar ise trilyonlarca hücreden oluşur.`,

  245: `- Bitki ve hayvan hücrelerinin ikisinde de **hücre zarı** bulunur.
- Her iki hücre türünde de **sitoplazma** ve **çekirdek** yer alır.
- Her iki hücrede de **mitokondri** bulunur ve enerji üretimini sağlar.
- Her iki hücre de canlılık faaliyetlerini sürdürmek için benzer temel organellere sahiptir.
- Bu ortak yapılar, hem bitkilerin hem hayvanların hücreden oluştuğunu gösterir.
- Bu ortak organeller, hücrenin yaşamsal faaliyetlerini sürdürebilmesi için gerekli temel yapı taşlarıdır.`,

  246: `- Bitki hücresinde **hücre çeperi** bulunur; bu sert yapı hücreye desteklik sağlar, hayvan hücresinde yoktur.
- Bitki hücresinde **kloroplast** bulunur ve fotosentez burada gerçekleşir; hayvan hücresinde kloroplast yoktur.
- Bitki hücresinde büyük bir **koful** bulunur; hayvan hücresindeki koful daha küçüktür.
- Bitki hücreleri genellikle köşeli ve sabit şekillidir, hayvan hücreleri daha esnek ve düzensiz şekillidir.
- Bu farklılıklar, bitkilerin kendi besinini üretebilmesiyle ilişkilidir.
- Kloroplastın yeşil renkli olması, bitkilerin yapraklarının ve gövdelerinin yeşil görünmesinin temel nedenidir.`,

  248: `- **İskelet sistemi**, vücuda destek olan ve iç organları koruyan kemiklerden oluşur.
- **Kemikler**, sert ve dayanıklı yapıdadır; vücudun şeklini korur.
- **Kıkırdak**, kemiklere göre daha esnek bir destek dokusudur (ör. kulak, burun ucu).
- **Eklemler**, iki kemiğin birleştiği ve hareketi sağlayan noktalardır (ör. diz, dirsek, omuz).
- Kemikler sertlik ve destek özelliğine göre, eklemler ise hareket yönüne göre farklı gruplara ayrılabilir.
- Yetişkin bir insan vücudunda yaklaşık 206 kemik bulunur.`,

  249: `- **Kaslar**, kasılıp gevşeyerek vücudun hareket etmesini sağlayan yapılardır.
- **İskelet kasları**, kemiklere bağlıdır ve isteğimizle çalışır (ör. kol, bacak kasları).
- **Düz kaslar**, iç organların çeperinde bulunur ve istemsiz çalışır (ör. mide, bağırsak).
- **Kalp kası**, sadece kalpte bulunan, istemsiz ve düzenli çalışan özel bir kas türüdür.
- Bu üç kas türü, çalışma şekline (istemli/istemsiz) ve bulunduğu yere göre gruplandırılıp etiketlenebilir.
- Vücuttaki kasların büyük çoğunluğunu iskelet kasları oluşturur.`,

  251: `- **Işık kaynağı**, kendisi ışık üreten her cisimdir.
- **Doğal ışık kaynakları**na örnek olarak Güneş, yıldızlar ve ateş verilebilir.
- **Yapay ışık kaynakları**na örnek olarak ampul, mum ve el feneri verilebilir.
- Ay, kendi ışığını üretmediği için ışık kaynağı değildir; Güneş ışığını yansıtır.
- Bir kaynaktan çıkan ışığın izlediği yol gözlemlenerek onun düz mü yoksa eğri mi ilerlediği belirlenebilir.
- Bir cismin ışık kaynağı sayılabilmesi için kendi enerjisiyle ışık üretmesi gerekir.`,

  252: `- Delikli kartlarla yapılan bir deneyde, ışık kaynağı ile göz arasına konan kartlardaki delikler aynı hizaya getirildiğinde ışık gözlemlenebilir.
- Delikler farklı hizaya getirildiğinde ışık gözlemlenemez.
- Bu gözlem, ışığın **düz bir çizgi (doğru)** boyunca ilerlediğini gösterir.
- Işığın izlediği bu düz yola **ışın** denir.
- Deney sonuçları çizim veya not olarak kaydedilerek ışığın yayılma yolu hakkında kanıt oluşturulur.
- Bu deney, karanlık bir ortamda tekrarlandığında ışığın yolu daha belirgin biçimde gözlemlenebilir.`,

  254: `- **Saydam (şeffaf) maddeler**, üzerlerine gelen ışığın büyük bölümünü geçirir.
- Bu maddelerin arkasındaki cisimler net biçimde görülebilir.
- Cam, temiz su ve bazı plastik türleri saydam maddelere örnektir.
- Pencere camlarının saydam olması, ışığın içeri girmesini ve dışarının görülmesini sağlar.
- Saydam maddelerin ışığı geçirme özelliği, gözlük camı gibi araçların yapımında kullanılır.
- Havanın da saydam bir madde olduğu, çevremizi net görebilmemizden anlaşılır.`,

  255: `- **Yarı saydam maddeler**, üzerlerine gelen ışığın bir kısmını geçirir, bir kısmını geçirmez.
- Bu maddelerin arkasındaki cisimler net değil, bulanık biçimde görülür.
- Buzlu cam, yağlı kâğıt ve ince perde kumaşı yarı saydam maddelere örnektir.
- Banyo pencerelerinde kullanılan buzlu cam, ışığın içeri girmesini sağlarken mahremiyeti korur.
- Yarı saydam maddeler, saydam ile opak maddeler arasında bir geçirgenlik seviyesine sahiptir.
- Yarı saydam bir kâğıdın arkasına tutulan bir resim, hafifçe belli belirsiz görülebilir.`,

  256: `- **Opak (saydam olmayan) maddeler**, üzerlerine gelen ışığı hiç geçirmez.
- Bu maddelerin arkasındaki cisimler görülemez.
- Tahta, metal, karton ve duvar opak maddelere örnektir.
- Opak bir madde ışığın önüne konduğunda arkasında **gölge** oluşur.
- Perde, kapı gibi eşyaların opak olması, ışığı tamamen engelleyerek arkasını gizler.
- Güneşli bir günde yürüyen bir kişinin yere düşen gölgesi, vücudun opak olmasından kaynaklanır.
- Opak maddelerin rengi koyu ya da açık olsun, ışık geçirgenliği bakımından bir fark yaratmaz.`,

  259: `- Tam gölge deneyinde bir ışık kaynağı, opak bir cisim (ör. karton kesme) ve bir perde kullanılır.
- Cismin ışık kaynağına ve perdeye olan uzaklığı değiştirilerek gölgenin boyutu gözlemlenir.
- Her deneme sonucunda gölgenin uzunluğu ve şekli ölçülüp not edilir.
- Elde edilen ölçümler bir tabloya kaydedilerek karşılaştırma yapılabilir hâle getirilir.
- Bu kayıtlar, gölgenin büyüklüğünü hangi etkenlerin değiştirdiğini ortaya çıkarmak için kullanılır.
- Deney birkaç kez tekrarlanarak ölçüm sonuçlarının tutarlı olup olmadığı kontrol edilir.`,

  260: `- Cismin **ışık kaynağına yakınlığı** arttıkça gölgenin boyutu büyür.
- Cismin **perdeye yakınlığı** arttıkça gölgenin boyutu küçülür ve kenarları netleşir.
- Cismin **kendi büyüklüğü** de gölgenin boyutunu doğrudan etkiler; büyük cisim daha büyük gölge oluşturur.
- Işık kaynağının büyüklüğü değiştiğinde gölgenin netliği de değişebilir.
- Bu değişkenlerden yalnızca biri değiştirilip diğerleri sabit tutularak gölge üzerindeki etkisi ayrı ayrı incelenebilir.
- Bu değişkenlerin etkisini net görebilmek için deney sırasında ışık kaynağının gücü sabit tutulur.`,

  261: `- Bütün maddeler, gözle görülemeyecek kadar küçük **tanecik**lerden oluşur.
- Tanecikler arasında, madde türüne göre değişen miktarda **boşluk** bulunur.
- Tanecikler sürekli **hareket** hâlindedir; bu hareket madde türüne göre farklı hızda gerçekleşir.
- Tanecikli, boşluklu ve hareketli yapı, tüm katı, sıvı ve gaz maddeler için geçerlidir.
- Bu üç özellik (tanecik, boşluk, hareket) birlikte değerlendirilerek maddenin hangi hâlde olduğu belirlenir.
- Tanecikler arasındaki bu boşluk ve hareket, çıplak gözle görülemeyecek kadar küçük ölçekte gerçekleşir.`,

  262: `- Katı maddelerde tanecikler birbirine çok yakın ve **düzenli** biçimde dizilidir.
- Tanecikler arasındaki boşluk oldukça azdır.
- Katı maddelerdeki tanecikler yer değiştirmez; sadece bulundukları noktada titreşim hareketi yapar.
- Bu sıkı ve düzenli yapı, katı maddelerin belirli bir şekle ve hacme sahip olmasını sağlar.
- Katı maddeler bu özellikleri sayesinde diğer hâllerden ayrıştırılabilir.
- Bu düzenli dizilim, katı maddelerin sıkıştırılmaya karşı sıvı ve gazlara göre daha dirençli olmasını sağlar.`,

  263: `- Sıvı maddelerde tanecikler arasındaki boşluk katıya göre daha fazladır; tanecikler birbirinin üzerinden kayarak hareket eder.
- Bu nedenle sıvılar, bulundukları kabın şeklini alır ama hacimleri değişmez.
- Gaz maddelerde tanecikler arasındaki boşluk çok fazladır; tanecikler her yöne serbestçe ve hızlı hareket eder.
- Gazlar bu serbest hareket sayesinde bulundukları kabın her yerini doldurur.
- Tanecik hareketi katıdan sıvıya, sıvıdan gaza doğru gidildikçe artar.
- Bu farklar, aynı miktardaki maddenin katı, sıvı ve gaz hâlinde farklı hacim kaplamasına yol açar.`,

  265: `- **Isı**, sıcak bir maddeden soğuk bir maddeye aktarılan bir **enerji** türüdür.
- **Sıcaklık**, bir maddenin ne kadar sıcak veya soğuk olduğunu gösteren bir ölçüdür.
- Isı, **kalorimetre** benzeri araçlarla; sıcaklık ise **termometre** ile ölçülür.
- Isının birimi kalori veya joule, sıcaklığın birimi ise genellikle santigrat derece (°C) dir.
- Bir maddeye ısı verildiğinde o maddenin sıcaklığı genellikle yükselir.
- Ateşe yaklaşan bir kişi, ısının kendisine doğru aktarıldığını sıcaklık artışıyla hisseder.`,

  267: `- Farklı sıcaklıktaki iki sıvı bir araya getirildiğinde aralarında **ısı alışverişi** olur.
- Isı, her zaman sıcak olan sıvıdan soğuk olan sıvıya doğru akar.
- Bu alışveriş, iki sıvının sıcaklığı eşitlenene kadar devam eder.
- Sıcak sıvı ısı verdiği için soğur, soğuk sıvı ısı aldığı için ısınır.
- Bu süreç, ısının maddeler arasında nasıl yayıldığını gösteren temel bir örnektir.
- Isı alışverişi, iki sıvı arasında herhangi bir madde geçişi olmadan gerçekleşir.`,

  268: `- Sıcak ve soğuk sıvılar karıştırılmadan önce termometre ile ayrı ayrı sıcaklıkları ölçülüp kaydedilir.
- Sıvılar karıştırıldıktan bir süre sonra karışımın sıcaklığı tekrar ölçülüp kaydedilir.
- Karışımın sıcaklığının, sıcak sıvının ilk sıcaklığından düşük, soğuk sıvının ilk sıcaklığından yüksek çıktığı görülür.
- Bu sonuç, sıcak sıvıdan soğuk sıvıya ısı aktarıldığını değerlendirmek için kullanılır.
- Ölçüm sonuçlarının tabloya kaydedilmesi, ısı alışverişinin karşılaştırmalı olarak incelenmesini sağlar.
- Ölçümlerin doğru yapılabilmesi için termometrenin sıvı içine tam olarak daldırılması gerekir.`,

  269: `- **Erime**, bir katı maddenin ısı alarak sıvı hâle geçmesidir.
- **Donma**, bir sıvı maddenin ısı vererek katı hâle geçmesidir.
- Buzun ısıtıldığında suya dönüşmesi erimeye, suyun dondurucuda katılaşması donmaya örnektir.
- Her madde belirli bir sıcaklıkta erir veya donar; bu sıcaklığa **erime/donma noktası** denir.
- Günlük deneyimlerden yola çıkarak "ısı verilen katı madde erir" gibi bir önerme oluşturulabilir; bu önerme deneyle sınanır.
- Suyun donma noktası 0°C, kaynama noktası ise 100°C'dir.`,

  271: `- **Süblimleşme**, bir katı maddenin sıvı hâle geçmeden doğrudan gaz hâline geçmesidir.
- Naftalinin zamanla küçülüp havaya karışması süblimleşmeye bir örnektir.
- Kuru buzun (katı karbondioksit) oda sıcaklığında sıvılaşmadan buharlaşması da süblimleşme ile açıklanır.
- Bu gözlemlerden yola çıkılarak "bazı katılar ısı alınca sıvı aşamasından geçmeden gaza dönüşebilir" sonucuna varılır.
- Süblimleşme, hâl değişimlerinin her zaman aynı sırayla (katı-sıvı-gaz) gerçekleşmeyebileceğini gösteren bir kanıttır.
- Süblimleşme sırasında madde sıvı hâlde hiç gözlemlenmediği için bu geçiş dikkat çekici bir örnektir.`,

  272: `- Bir maddenin hangi ısı miktarında hâl değiştireceği, önceki gözlemlerden yararlanılarak tahmin edilebilir.
- Örneğin bir maddenin ısıtıldığında eriyeceği, önceki erime gözlemlerine dayanılarak öngörülebilir.
- Bu tahminlerin geçerliği, gerçek deneyle test edilerek sorgulanır.
- Tahmin ile deney sonucu uyuşmuyorsa, tahminin dayandığı varsayımlar yeniden gözden geçirilir.
- Isı verilmesi maddeyi katıdan sıvıya, sıvıdan gaza; ısı alınması ise gazdan sıvıya, sıvıdan katıya doğru değiştirir.
- Yapılan tahminlerin sınanması, bilimsel bilginin güvenilir hâle gelmesinde önemli bir adımdır.`,

  273: `- **Isı iletkeni** maddeler, ısıyı hızlı biçimde bir uçtan diğer uca aktarır.
- Demir, bakır, alüminyum gibi **metaller** iyi ısı iletkenidir.
- Tencere ve tava gibi mutfak eşyalarının gövdesi, ısıyı hızlı iletmesi için metalden yapılır.
- Bir metal çubuğun bir ucu ısıtıldığında kısa sürede diğer ucunun da ısındığı hissedilir.
- Bu hızlı ısı aktarımı, ısı iletkeni maddeleri tanımanın temel yoludur.
- Elektrik kablolarının içindeki bakır tel de iyi bir ısı iletkeni özelliği taşır.`,

  274: `- **Isı yalıtkanı** maddeler, ısıyı çok yavaş iletir ya da neredeyse hiç iletmez.
- Tahta, plastik, kumaş, cam yünü ve strafor gibi maddeler ısı yalıtkanıdır.
- Tencere sapının plastik veya tahta olması, elin sıcaktan korunmasını sağlar.
- Kışlık kıyafetlerin kalın kumaştan yapılması, vücut ısısının dışarı kaçmasını yavaşlatır.
- Bina duvarlarına yalıtım malzemesi konması, iç ortamın ısısını korumaya yardımcı olur.
- Termos içindeki çift cidarlı yapı da ısı yalıtımı ilkesinden yararlanılarak tasarlanmıştır.`,

  277: `- Elektrik devrelerindeki her eleman, devre şemalarında belirli bir **sembol** ile gösterilir.
- **Pil**, uzun ve kısa çizgilerden oluşan bir sembolle gösterilir; enerji kaynağını temsil eder.
- **Ampul**, içinde çarpı işareti bulunan bir çember sembolüyle gösterilir.
- **Anahtar (switch)**, devreyi açıp kapatan elemandır ve eğik bir çizgiyle gösterilir.
- **İletken tel**, elemanları birbirine bağlayan düz çizgilerle gösterilir.
- Semboller kullanılması, devrenin karmaşık gerçek görünümü yerine sade ve anlaşılır biçimde ifade edilmesini sağlar.`,

  278: `- Devre sembolleri, temsil ettikleri elemanın görevine göre gruplara ayrıştırılabilir.
- **Enerji kaynağı** sembolleri: pil ve pil grubu.
- **Tüketici** sembolleri: ampul gibi elektrik enerjisini ışığa veya harekete dönüştüren elemanlar.
- **Kontrol elemanı** sembolleri: anahtar gibi devreden geçen akımı açıp kapatan elemanlar.
- **Bağlantı elemanı** sembolleri: iletken teller ve bağlantı noktaları; bu gruplandırma her sembolün doğru şekilde etiketlenmesini kolaylaştırır.
- Bu gruplandırma, karmaşık bir devre şemasının kolayca okunup anlaşılmasını sağlar.`,

  279: `- **Devre şeması**, gerçek bir elektrik devresinin sembollerle çizilmiş hâlidir.
- Şema çizilirken her eleman kendi sembolüyle gösterilir ve teller düz çizgilerle birleştirilir.
- Elemanlar, gerçek devrede olduğu gibi kapalı bir döngü oluşturacak şekilde bağlanır.
- Devre şemasında pilin yönü, ampulün ve anahtarın devredeki konumu doğru gösterilmelidir.
- Doğru çizilmiş bir şema, devrenin gerçekte nasıl kurulacağını göstermeye yeter; devreyi kurmadan önce plan yapmayı sağlar.
- Şema üzerinde kısa notlar veya oklar kullanılarak akımın yönü de gösterilebilir.`,

  281: `- Bir elektrik devresinde ampulün ne kadar parlak yandığını birden fazla etken belirler.
- Devredeki **pil sayısı**, ampulün parlaklığını etkileyen değişkenlerden biridir.
- Devredeki **ampul sayısı**, aynı devrede paylaşılan enerji miktarını etkileyerek parlaklığı değiştirir.
- Tellerin uzunluğu ve bağlantı şekli de parlaklığa etki edebilir.
- Bu değişkenlerin her biri ayrı ayrı incelenerek ampul parlaklığı üzerindeki etkisi belirlenir.
- Bu değişkenlerden hangisinin daha etkili olduğunu anlamak için deneyler birer birer tasarlanır.`,

  285: `- **Evsel atıklar**, evlerde günlük yaşam sırasında ortaya çıkan ve artık kullanılmayan maddelerdir.
- Yemek artıkları, kâğıt, karton, cam şişe, plastik ambalaj ve metal kutu evsel atıklara örnektir.
- Bazı atıklar doğada kısa sürede çürüyerek yok olur, bazıları ise yüzyıllarca doğada kalabilir.
- Plastik atıkların doğada çözünmesi çok uzun yıllar alır.
- Evsel atıkların türüne göre tanınması, doğru şekilde ayrıştırılmasının ilk adımıdır.
- Atıkların türüne göre ayrılması, geri dönüşüm sürecinin ilk ve en önemli basamağıdır.`,

  286: `- Evsel atıklar, **geri dönüştürülebilen** ve **geri dönüştürülemeyen** olarak ikiye ayrıştırılır.
- Kâğıt, karton, cam, plastik ve metal atıklar geri dönüştürülebilen gruba girer.
- Yemek artığı gibi organik atıklar ve kirli/yağlı ambalajlar genellikle geri dönüştürülemeyen gruba girer.
- Geri dönüştürülebilen atıklar kendi içinde de türüne göre (kâğıt, cam, plastik, metal) gruplandırılır.
- Bu gruplandırma, atıkların renkli kutulara doğru şekilde etiketlenerek atılmasını sağlar.
- Kirli veya yağlı kâğıt ambalajlar, geri dönüştürülebilir görünse de genellikle dönüştürülemeyen grubuna girer.`,

  287: `- **Kaynakların etkili kullanımı**, doğal kaynakların gereksiz yere tüketilmemesi ve israf edilmemesidir.
- Geri dönüşüm, kullanılmış maddelerin yeniden işlenerek yeni ürünlere dönüştürülmesidir.
- Geri dönüşüm sayesinde ağaç, su ve enerji gibi doğal kaynaklar daha az tüketilir.
- Bir bölgede toplanan geri dönüştürülebilir atık miktarı düzenli olarak kaydedilerek zaman içindeki değişim izlenebilir.
- Kaydedilen veriler değerlendirildiğinde, geri dönüşüm oranı arttıkça doğal kaynak tüketiminin azaldığı görülür.
- Bir kilogram kâğıdın geri dönüştürülmesi, birkaç ağacın kesilmesini önleyebilir.`,
};

// Kazanım bağlantısı olmayan bölümlere eklenecek bağlantılar: [topicId, code, sectionId]
const missingOutcomeLinks = [
  [367, 'a', 228],
  [367, 'a', 229],
  [367, 'a', 230],
  [369, 'a', 238],
  [370, 'b', 242],
  [380, 'a', 279],
];

function wc(md) {
  const cleaned = md.split('\n').map((l) => l.replace(/^\s*-\s?/, '')).join(' ');
  return cleaned.trim().split(/\s+/).filter(Boolean).length;
}

async function main() {
  // 1) Yinelenen (boş) topic_content kaydını sil
  const del = await rest('DELETE', 'topic_contents?id=eq.406');
  console.log('406 nolu boş yinelenen topic_content silindi.');

  // 2) Kelime sayısı düşük bölümleri güncelle
  for (const [id, text] of Object.entries(sectionUpdates)) {
    const n = wc(text);
    if (n < 60 || n > 120) {
      console.warn(`   UYARI: bölüm ${id} yeni kelime sayısı ${n} (beklenen 60-120)`);
    }
    await rest('PATCH', `topic_content_sections?id=eq.${id}`, { body_markdown: text });
    console.log(`bölüm ${id} güncellendi (${n} kelime)`);
  }

  // 3) Kazanım bağlantısı eksik bölümlere bağlantı ekle
  for (const [topicId, code, sectionId] of missingOutcomeLinks) {
    const outcomes = await rest('GET', `outcomes?topic_id=eq.${topicId}&code=eq.${code}&select=id`);
    if (!outcomes.length) {
      console.warn(`   UYARI: konu ${topicId} kod ${code} için kazanım bulunamadı`);
      continue;
    }
    await rest('POST', 'topic_content_section_outcomes', [{ section_id: sectionId, outcome_id: outcomes[0].id }]);
    console.log(`bölüm ${sectionId} <- konu ${topicId} kazanım ${code} bağlandı`);
  }

  console.log('\nTÜM DÜZELTMELER UYGULANDI.');
}

main().catch((e) => {
  console.error('HATA:', e);
  process.exit(1);
});
