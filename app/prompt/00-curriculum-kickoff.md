{grade} {lesson} dersinin müfredatını baştan sona hazırlayıp yayınla.

Önce "feedback-content-generation-focus" hafızasındaki kurallara bak ve harfiyen uygula — özellikle:
- Kazanım verisini önce kalite kontrolünden geçir (yanlış topic_id, tekrar eden satır, anlamsız ham kod); sorun bulursan sessizce atlama, bana raporla, onay al, sonra düzelt.
- Her konuyu ayrı bir subagent'a (Agent tool) yaptır — tek tek, izole, ana oturumda freehand yazma.
- Her subagent, göreve başlarken app/prompt/01-topic-section-plan.md ve app/prompt/02-section-content.md dosyalarını kendisi okusun (Read tool ile, hafızadan değil).
- Her subagent işini bitirince node scripts/lib/lint-section-content.js --topic-id <id> ile kendini doğrulasın; hata varsa o bölümü sıfırdan yeniden yazsın (toplu/formülaik yama yok).
- Kardeş konular (aynı ünitede birbirine çok benzer kazanım kalıbı olan konular) varsa, her birinin kendi konusuna özgü somut terimlerle yazılmasını, birbirinin kopyası olmamasını özellikle vurgula.

Bitince kısa bir özet rapor ver: kaç konu/alt başlık işlendi, kazanım verisinde ne değiştiyse, ve gözden geçirmemi önerdiğin noktalar.
