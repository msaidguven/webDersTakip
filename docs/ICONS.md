# Ortak Icon Kullanım Rehberi

Bu dokümanda tüm platformlar (Web, Flutter/Android, iOS) için ortak icon sistemini bulabilirsiniz.

## 📋 Icon Mapping

| Ders | Emoji | Flutter (Material) | Flutter (Cupertino) | Web (Lucide) |
|------|-------|-------------------|---------------------|--------------|
| Matematik | 🔢 | `Icons.calculate` | `CupertinoIcons.function` | `Calculator` |
| Türkçe | 📝 | `Icons.menu_book` | `CupertinoIcons.book` | `BookOpen` |
| Fen Bilimleri | 🔬 | `Icons.science` | `CupertinoIcons.lab_flask` | `FlaskConical` |
| Fizik | ⚛️ | `Icons.bolt` | `CupertinoIcons.bolt` | `Zap` |
| Kimya | ⚗️ | `Icons.biotech` | `CupertinoIcons.lab_flask` | `FlaskConical` |
| Biyoloji | 🧬 | `Icons.biotech` | `CupertinoIcons.helm` | `Dna` |
| Tarih | 📜 | `Icons.history_edu` | `CupertinoIcons.time` | `History` |
| Coğrafya | 🌍 | `Icons.public` | `CupertinoIcons.globe` | `Globe` |
| İngilizce | 🇬🇧 | `Icons.translate` | `CupertinoIcons.globe` | `Languages` |
| Almanca | 🇩🇪 | `Icons.translate` | `CupertinoIcons.globe` | `Languages` |
| Bilişim Teknolojileri | 💻 | `Icons.computer` | `CupertinoIcons.desktopcomputer` | `Monitor` |
| Yazılım | 💿 | `Icons.code` | `CupertinoIcons.chevron_left_slash_chevron_right` | `Code` |
| Robotik | 🤖 | `Icons.smart_toy` | `CupertinoIcons.gear` | `Bot` |
| Din Kültürü | 🕌 | `Icons.mosque` | `CupertinoIcons.book` | `BookOpen` |
| İnkılap Tarihi | ⭐ | `Icons.star` | `CupertinoIcons.star` | `Star` |
| Sosyal Bilgiler | 🏛️ | `Icons.account_balance` | `CupertinoIcons.building_2_fill` | `Building` |
| Felsefe | 🧠 | `Icons.psychology` | `CupertinoIcons.brain` | `Brain` |
| Müzik | 🎵 | `Icons.music_note` | `CupertinoIcons.double_music_note` | `Music` |
| Görsel Sanatlar | 🎨 | `Icons.palette` | `CupertinoIcons.paintbrush` | `Palette` |
| Beden Eğitimi | ⚽ | `Icons.sports_soccer` | `CupertinoIcons.sportscourt` | `Activity` |
| Rehberlik | 🎯 | `Icons.school` | `CupertinoIcons.person_2` | `Users` |

## 🔧 Flutter Kullanımı

### Emoji ile Kullanım (Önerilen)
```dart
// Supabase'den gelen emoji'yi doğrudan kullan
Text(lesson.icon, style: TextStyle(fontSize: 32))
```

### Custom Widget
```dart
class LessonIcon extends StatelessWidget {
  final String icon; // Emoji: '🔢', '💻', '🕌'
  final double size;
  
  const LessonIcon({required this.icon, this.size = 32});
  
  @override
  Widget build(BuildContext context) {
    return Text(
      icon,
      style: TextStyle(fontSize: size),
    );
  }
}
```

## 🌐 Web (Next.js) Kullanımı

```tsx
<span className="text-4xl">{lesson.icon}</span>
```

## 📱 Öneri: Emoji Kullanımı

**Neden Emoji?**
1. ✅ Tüm platformlarda (Web, Flutter, iOS, Android) çalışır
2. ✅ Ek kütüphane gerekmez
3. ✅ Tutarlı görünüm
4. ✅ Boyut ve renk ayarı kolay

**Flutter'da Emoji Font Sorunu**
```yaml
# pubspec.yaml - Android için
flutter:
  fonts:
    - family: NotoColorEmoji
      fonts:
        - asset: assets/fonts/NotoColorEmoji-Regular.ttf
```

```dart
Text(
  lesson.icon, // 🔢, 💻, 🕌
  style: TextStyle(fontSize: 32),
)
```
