# Akıllı İçerik Ekleme - Veritabanı Şeması (Güncel)

Admin panelindeki "Akıllı İçerik Ekleme" özelliği için veritabanı şeması.
**Not:** Bu sadece içerik (konu anlatımı) ekleme içindir, soru ekleme değildir.

---

## 📋 İçerik Yapısı

```
Ders (lessons)
    └── Ünite (units)
            └── Konu (topics)
                    └── İçerik (topic_contents)
                            └── Hafta (topic_content_weeks)
```

---

## 🗂️ Tablolar

### 1. Konu İçerikleri (`topic_contents`)

Konulara ait anlatım metinlerini saklar.

```sql
CREATE TABLE public.topic_contents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  topic_id bigint NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  title text NOT NULL,                    -- İçerik başlığı (örn: "Fotosentez Nedir?")
  content text NOT NULL,                  -- HTML/Markdown içerik metni
  order_no integer DEFAULT 0,             -- Sıralama (birden fazla içerik varsa)
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

**Örnek Veri:**
```sql
INSERT INTO topic_contents (topic_id, title, content, order_no) VALUES
(1, 'Fotosentezin Tanımı', 'Fotosentez bitkilerin...', 1),
(1, 'Fotosentezin Aşamaları', 'Fotosentez iki aşamada...', 2);
```

---

### 2. İçerik-Hafta İlişkisi (`topic_content_weeks`)

Her içeriğin hangi müfredat haftasına ait olduğunu belirtir.

```sql
CREATE TABLE public.topic_content_weeks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  topic_content_id bigint NOT NULL REFERENCES public.topic_contents(id) ON DELETE CASCADE,
  curriculum_week integer NOT NULL,       -- Müfredat haftası (1, 2, 3...)
  created_at timestamp with time zone DEFAULT now()
);
```

**Örnek Veri:**
```sql
-- 1. içerik 3. haftaya ait
INSERT INTO topic_content_weeks (topic_content_id, curriculum_week) VALUES (1, 3);

-- 2. içerik 4. haftaya ait  
INSERT INTO topic_content_weeks (topic_content_id, curriculum_week) VALUES (2, 4);
```

---

### 3. Haftalık İçerik Görünümü (View)

Hangi haftada hangi içerikler var görmek için:

```sql
CREATE OR REPLACE VIEW weekly_contents AS
SELECT 
  g.name AS grade_name,
  l.name AS lesson_name,
  u.title AS unit_title,
  t.title AS topic_title,
  tc.id AS content_id,
  tc.title AS content_title,
  tcw.curriculum_week,
  tc.order_no
FROM topic_content_weeks tcw
JOIN topic_contents tc ON tc.id = tcw.topic_content_id
JOIN topics t ON t.id = tc.topic_id
JOIN units u ON u.id = t.unit_id
JOIN lesson_grades lg ON lg.lesson_id = u.lesson_id
JOIN lessons l ON l.id = u.lesson_id
JOIN grades g ON g.id = lg.grade_id
ORDER BY tcw.curriculum_week, tc.order_no;
```

**Kullanım:**
```sql
-- 3. haftadaki tüm içerikler
SELECT * FROM weekly_contents WHERE curriculum_week = 3;

-- 5. sınıf, matematik, 2. hafta içerikleri
SELECT * FROM weekly_contents 
WHERE grade_name = '5. Sınıf' 
  AND lesson_name = 'Matematik' 
  AND curriculum_week = 2;
```

---

## 🔗 Hiyerarşi Tabloları (Mevcut)

### Dersler (`lessons`)
```sql
CREATE TABLE public.lessons (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,        -- Matematik, Türkçe, Fen...
  icon text,                        -- Emoji veya icon adı
  slug text UNIQUE,
  order_no integer DEFAULT 0,
  is_active boolean DEFAULT true
);
```

### Üniteler (`units`)
```sql
CREATE TABLE public.units (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lesson_id bigint NOT NULL REFERENCES public.lessons(id),
  title text NOT NULL,              -- Ünite 1: Doğal Sayılar
  description text,                 -- Ünite açıklaması
  slug text UNIQUE,
  order_no integer DEFAULT 0,
  is_active boolean DEFAULT true
);
```

### Konular (`topics`)
```sql
CREATE TABLE public.topics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  unit_id bigint NOT NULL REFERENCES public.units(id),
  title text NOT NULL,              -- Fotosentez, Bölme İşlemi...
  slug text NOT NULL,
  order_no integer DEFAULT 0,
  is_active boolean DEFAULT true
);
```

### Sınıf-Ders İlişkisi (`lesson_grades`)
```sql
CREATE TABLE public.lesson_grades (
  lesson_id bigint NOT NULL REFERENCES public.lessons(id),
  grade_id bigint NOT NULL REFERENCES public.grades(id),
  is_active boolean DEFAULT true,
  PRIMARY KEY (lesson_id, grade_id)
);
```

### Sınıflar (`grades`)
```sql
CREATE TABLE public.grades (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,               -- 5. Sınıf, 6. Sınıf...
  order_no integer UNIQUE,
  is_active boolean DEFAULT true
);
```

---

## 🤖 AI İçerik Üretim Tablosu

AI destekli içerik üretimi için prompt şablonları:

```sql
CREATE TABLE public.ai_content_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  lesson_id bigint REFERENCES public.lessons(id),  -- Belirli ders için (NULL = tümü)
  prompt_template text NOT NULL,
  variables jsonb DEFAULT '["topicTitle", "unitTitle", "gradeName"]',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Örnek: Matematik için AI kuralı
INSERT INTO ai_content_rules (name, description, lesson_id, prompt_template) VALUES
('Matematik Anlatımı', 'Matematik konusu için öğrenci dostu anlatım', 1,
'Matematik Konusu: {{topicTitle}}
Sınıf: {{gradeName}}

Bu konu için:
1. Konunun tanımı
2. Formüller (varsa)
3. Çözümlü örnek sorular (en az 3 adet)
4. Konu ile ilgili pratik ipuçları

Dil: Türkçe
Seviye: {{gradeName}} öğrencisine uygun');

-- Örnek: Fen Bilimleri için AI kuralı
INSERT INTO ai_content_rules (name, description, lesson_id, prompt_template) VALUES
('Fen Bilimleri Anlatımı', 'Fen konusu için bilimsel ama anlaşılır anlatım', 3,
'Fen Konusu: {{topicTitle}}
Ünite: {{unitTitle}}

Bu konu için:
1. Bilimsel tanım
2. Günlük hayattan örnekler
3. Deney önerileri (varsa)
4. Önemli kavramlar

Dil: Türkçe
Tarz: Öğrencinin merakını uyandıran, soru-cevap formatında');
```

---

## 📝 SQL Fonksiyonları

### 1. İçerik Ekleme (Tek Fonksiyon)

```sql
CREATE OR REPLACE FUNCTION insert_topic_content(
  p_topic_id bigint,
  p_title text,
  p_content text,
  p_curriculum_week integer,
  p_order_no integer DEFAULT 0
) RETURNS bigint AS $$
DECLARE
  v_content_id bigint;
BEGIN
  -- İçeriği ekle
  INSERT INTO topic_contents (topic_id, title, content, order_no)
  VALUES (p_topic_id, p_title, p_content, p_order_no)
  RETURNING id INTO v_content_id;
  
  -- Hafta ilişkisini ekle
  INSERT INTO topic_content_weeks (topic_content_id, curriculum_week)
  VALUES (v_content_id, p_curriculum_week);
  
  RETURN v_content_id;
END;
$$ LANGUAGE plpgsql;
```

**Kullanım:**
```sql
SELECT insert_topic_content(
  5,                                    -- topic_id
  'Fotosentezin Önemi',                 -- başlık
  'Fotosentez canlılar için hayati...', -- içerik
  3,                                    -- 3. hafta
  1                                     -- sıra no
);
```

### 2. Haftaya Göre İçerik Getirme

```sql
CREATE OR REPLACE FUNCTION get_contents_by_week(
  p_grade_id bigint,
  p_lesson_id bigint,
  p_week integer
) RETURNS TABLE (
  content_id bigint,
  content_title text,
  topic_title text,
  unit_title text,
  order_no integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tc.id,
    tc.title,
    t.title,
    u.title,
    tc.order_no
  FROM topic_contents tc
  JOIN topic_content_weeks tcw ON tcw.topic_content_id = tc.id
  JOIN topics t ON t.id = tc.topic_id
  JOIN units u ON u.id = t.unit_id
  JOIN lesson_grades lg ON lg.lesson_id = u.lesson_id
  WHERE u.lesson_id = p_lesson_id
    AND lg.grade_id = p_grade_id
    AND tcw.curriculum_week = p_week
    AND lg.is_active = true
  ORDER BY tc.order_no;
END;
$$ LANGUAGE plpgsql;
```

**Kullanım:**
```sql
-- 5. sınıf, matematik, 2. hafta içerikleri
SELECT * FROM get_contents_by_week(1, 1, 2);
```

---

## 📊 Admin Panel Akışı

```
┌─────────────────┐
│  Kullanıcı      │
│  Seçim Yapar:   │
│  - Sınıf        │
│  - Ders         │
│  - Ünite        │
│  - Konu         │
│  - Hafta        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI Prompt      │
│  Hazırlanır:    │
│  - Konu başlığı │
│  - Hafta bilgisi│
│  - Ders tipi    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI İçerik      │
│  Üretir         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Önizleme       │
│  (Onay/Red)     │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
 Onayla     Düzenle
    │         │
    └────┬────┘
         ▼
┌─────────────────┐
│  insert_topic_  │
│  content()      │
│  Fonksiyonu     │
└─────────────────┘
```

---

## 🚀 Kullanım Senaryoları

### Senaryo 1: Yeni İçerik Ekleme

```sql
-- 1. Konuyu bul (örn: Fotosentez)
SELECT id FROM topics WHERE title = 'Fotosentez';
-- Sonuç: id = 5

-- 2. Fonksiyon ile ekle
SELECT insert_topic_content(5, 'Fotosentez Nedir?', '...içerik...', 3, 1);
```

### Senaryo 2: Haftalık İçerik Listesi

```sql
-- 3. haftada hangi konular işleniyor?
SELECT 
  t.title AS konu,
  tc.title AS içerik_başlığı,
  tcw.curriculum_week AS hafta
FROM topic_content_weeks tcw
JOIN topic_contents tc ON tc.id = tcw.topic_content_id
JOIN topics t ON t.id = tc.topic_id
WHERE tcw.curriculum_week = 3
ORDER BY t.title;
```

### Senaryo 3: Ders Programı Çıkarma

```sql
-- 5. sınıf matematik için haftalık program
SELECT 
  tcw.curriculum_week AS hafta,
  STRING_AGG(tc.title, ', ') AS konular
FROM topic_content_weeks tcw
JOIN topic_contents tc ON tc.id = tcw.topic_content_id
JOIN topics t ON t.id = tc.topic_id
JOIN units u ON u.id = t.unit_id
JOIN lesson_grades lg ON lg.lesson_id = u.lesson_id
WHERE lg.grade_id = 1 AND u.lesson_id = 1
GROUP BY tcw.curriculum_week
ORDER BY tcw.curriculum_week;
```

---

## ⚠️ Önemli Notlar

1. **Bir konuda birden fazla içerik olabilir** (`order_no` ile sıralanır)

2. **Bir içerik birden fazla haftaya atanabilir** (ama tek hafta önerilir)

3. **lesson_grades kontrolü:** İçerik eklemeden önce o dersin o sınıfta aktif olduğunu kontrol edin

4. **RLS Politikası:**
```sql
-- Sadece admin kullanıcılar içerik ekleyebilir
ALTER TABLE topic_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage contents" ON topic_contents
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ));
```

5. **Trigger - updated_at:**
```sql
CREATE TRIGGER update_topic_contents_updated_at
  BEFORE UPDATE ON topic_contents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```
