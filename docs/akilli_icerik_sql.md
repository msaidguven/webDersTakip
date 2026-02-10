# Akıllı İçerik Ekleme - Veritabanı Şeması

Bu doküman, admin panelindeki "Akıllı İçerik Ekleme" özelliği için veritabanı şemasını ve SQL sorgularını içerir.

## 📋 İçerik Tipleri

| Tip | Tablo | Açıklama |
|-----|-------|----------|
| `question` | `questions` + alt tablolar | Çoktan seçmeli, doğru/yanlış, boşluk doldurma, eşleştirme, klasik sorular |
| `topic_content` | `topic_contents` | Konu anlatımı metinleri |
| `unit_description` | `units` | Ünite açıklaması ve kazanımlar |

---

## 🗂️ Tablo Yapısı

### 1. Sorular (`questions`)

Ana soru tablosu. Tüm soru tipleri için ortak alanlar.

```sql
CREATE TABLE public.questions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_type_id smallint NOT NULL REFERENCES public.question_types(id),
  question_text text NOT NULL,
  difficulty smallint DEFAULT 1 CHECK (difficulty >= 1 AND difficulty <= 5),
  score smallint DEFAULT 1 CHECK (score >= 1 AND score <= 10),
  created_at timestamp without time zone DEFAULT now()
);
```

**Soru Tipleri (`question_types`):**
```sql
INSERT INTO question_types (id, code) VALUES
  (1, 'multiple_choice'),    -- Çoktan seçmeli
  (2, 'true_false'),         -- Doğru/Yanlış
  (3, 'fill_blank'),         -- Boşluk doldurma
  (4, 'matching'),           -- Eşleştirme
  (5, 'classical');          -- Klasik
```

---

### 2. Çoktan Seçmeli Soru Seçenekleri (`question_choices`)

```sql
CREATE TABLE public.question_choices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id bigint NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  choice_text text NOT NULL,
  is_correct boolean DEFAULT false
);
```

**Örnek Ekleme:**
```sql
-- Soru ekle
INSERT INTO questions (question_type_id, question_text, difficulty, score)
VALUES (1, '5 + 3 kaç eder?', 1, 1)
RETURNING id;

-- Seçenekleri ekle (question_id = 1 varsayalım)
INSERT INTO question_choices (question_id, choice_text, is_correct) VALUES
  (1, '7', false),
  (1, '8', true),
  (1, '9', false),
  (1, '10', false);
```

---

### 3. Boşluk Doldurma Seçenekleri (`question_blank_options`)

```sql
CREATE TABLE public.question_blank_options (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id bigint NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  is_correct boolean DEFAULT false,
  order_no integer DEFAULT 0
);
```

**Örnek Ekleme:**
```sql
-- Boşluk doldurma sorusu
INSERT INTO questions (question_type_id, question_text, difficulty, score)
VALUES (3, 'Türkiye''nin başkenti ____''dır.', 1, 1)
RETURNING id;

-- Doğru cevap
INSERT INTO question_blank_options (question_id, option_text, is_correct, order_no)
VALUES (2, 'Ankara', true, 1);
```

---

### 4. Eşleştirme Soruları (`question_matching_pairs`)

```sql
CREATE TABLE public.question_matching_pairs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id bigint NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  left_text text NOT NULL,
  right_text text NOT NULL,
  order_no integer DEFAULT 0
);
```

**Örnek Ekleme:**
```sql
-- Eşleştirme sorusu
INSERT INTO questions (question_type_id, question_text, difficulty, score)
VALUES (4, 'Aşağıdaki başkentleri eşleştirin.', 2, 2)
RETURNING id;

-- Eşleştirme çiftleri
INSERT INTO question_matching_pairs (question_id, left_text, right_text, order_no) VALUES
  (3, 'Türkiye', 'Ankara', 1),
  (3, 'Fransa', 'Paris', 2),
  (3, 'Almanya', 'Berlin', 3),
  (3, 'İtalya', 'Roma', 4);
```

---

### 5. Klasik Sorular (`question_classical`)

```sql
CREATE TABLE public.question_classical (
  question_id bigint PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
  model_answer text
);
```

**Örnek Ekleme:**
```sql
-- Klasik soru
INSERT INTO questions (question_type_id, question_text, difficulty, score)
VALUES (5, 'Fotosentez nedir? Açıklayınız.', 3, 5)
RETURNING id;

-- Model cevap
INSERT INTO question_classical (question_id, model_answer)
VALUES (4, 'Bitkilerin güneş ışığı enerjisini kullanarak...');
```

---

### 6. Konu Anlatımı (`topic_contents`)

```sql
CREATE TABLE public.topic_contents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  topic_id bigint NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  order_no integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);
```

**Örnek Ekleme:**
```sql
INSERT INTO topic_contents (topic_id, title, content, order_no)
VALUES (
  1, 
  'Fotosentez Nedir?',
  'Fotosentez, bitkilerin güneş ışığını kullanarak...',
  1
);
```

---

### 7. Soru-Konu İlişkisi (`question_usages`)

Soruların hangi konuda kullanıldığını belirtir.

```sql
CREATE TABLE public.question_usages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id bigint NOT NULL REFERENCES public.questions(id),
  topic_id bigint NOT NULL REFERENCES public.topics(id),
  usage_type text CHECK (usage_type = ANY (ARRAY['weekly', 'topic_end'])),
  curriculum_week integer,
  order_no smallint DEFAULT 0
);
```

**Örnek Ekleme:**
```sql
-- Soruyu konuya bağla
INSERT INTO question_usages (question_id, topic_id, usage_type, curriculum_week)
VALUES (1, 5, 'weekly', 3);
```

---

## 🔗 Hiyerarşi Tabloları

### Sınıf-Ünite İlişkisi

```sql
-- Bir ünite hangi sınıflarda görülür
CREATE TABLE public.unit_grades (
  unit_id bigint NOT NULL REFERENCES public.units(id),
  grade_id bigint NOT NULL REFERENCES public.grades(id),
  start_week integer,
  end_week smallint,
  PRIMARY KEY (unit_id, grade_id)
);
```

### Ünite-Konu İlişkisi

```sql
-- Konular üniteye bağlıdır
CREATE TABLE public.topics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  unit_id bigint NOT NULL REFERENCES public.units(id),
  title text NOT NULL,
  slug text NOT NULL,
  order_no integer DEFAULT 0,
  is_active boolean DEFAULT true
);
```

---

## 🤖 AI Üretim İçin Prompt Tablosu (Önerilen)

```sql
-- AI kuralları ve prompt şablonları için
CREATE TABLE public.ai_content_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  content_type text CHECK (content_type = ANY (ARRAY['question', 'topic_content', 'unit_description'])),
  prompt_template text NOT NULL,
  variables jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Örnek AI kuralı
INSERT INTO ai_content_rules (name, description, content_type, prompt_template, variables)
VALUES (
  'Çoktan Seçmeli Soru',
  'Konuya uygun 4 seçenekli sorular üretir',
  'question',
  'Konu: {{topicTitle}}\nÜnite: {{unitTitle}}\n\n{{count}} adet çoktan seçmeli soru üret.',
  '["topicTitle", "unitTitle", "count"]'
);
```

---

## 📊 Özet: İçerik Ekleme Akışı

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Kullanıcı     │────▶│  Admin Panel    │────▶│   AI Üretimi    │
│   Seçim Yapar   │     │  (SmartContent) │     │  (Prompt+AI)    │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                              ┌──────────────────────────┘
                              ▼
                    ┌─────────────────┐
                    │  Önizleme       │
                    │  (Onay/Red)     │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
    ┌─────────────────┐           ┌─────────────────┐
    │  Soru Ekleme    │           │ Konu İçeriği    │
    │  questions      │           │ topic_contents  │
    │  + alt tablolar │           └─────────────────┘
    └─────────────────┘
```

---

## 📝 SQL Fonksiyonları (Önerilen)

### Soru Ekleme Fonksiyonu

```sql
CREATE OR REPLACE FUNCTION insert_question_with_choices(
  p_question_text text,
  p_question_type_id smallint,
  p_difficulty smallint,
  p_score smallint,
  p_choices jsonb  -- [{"text": "A", "is_correct": true}, ...]
) RETURNS bigint AS $$
DECLARE
  v_question_id bigint;
  choice jsonb;
BEGIN
  -- Soruyu ekle
  INSERT INTO questions (question_type_id, question_text, difficulty, score)
  VALUES (p_question_type_id, p_question_text, p_difficulty, p_score)
  RETURNING id INTO v_question_id;
  
  -- Çoktan seçmeli ise seçenekleri ekle
  IF p_question_type_id = 1 THEN
    FOR choice IN SELECT * FROM jsonb_array_elements(p_choices)
    LOOP
      INSERT INTO question_choices (question_id, choice_text, is_correct)
      VALUES (
        v_question_id,
        choice->>'text',
        (choice->>'is_correct')::boolean
      );
    END LOOP;
  END IF;
  
  RETURN v_question_id;
END;
$$ LANGUAGE plpgsql;
```

---

## 🚀 Kullanım Örnekleri

### 1. Çoktan Seçmeli Soru Ekleme

```sql
SELECT insert_question_with_choices(
  '5 + 3 kaç eder?',
  1,  -- multiple_choice
  1,  -- zorluk
  1,  -- puan
  '[
    {"text": "7", "is_correct": false},
    {"text": "8", "is_correct": true},
    {"text": "9", "is_correct": false},
    {"text": "10", "is_correct": false}
  ]'::jsonb
);
```

### 2. Konu Anlatımı Ekleme

```sql
INSERT INTO topic_contents (topic_id, title, content, order_no)
VALUES (
  1,
  'Fotosentezin Aşamaları',
  'Fotosentez iki ana aşamada gerçekleşir:...',
  1
)
RETURNING id;
```

### 3. Ünite Açıklaması Güncelleme

```sql
UPDATE units
SET description = 'Bu ünite temel matematik işlemlerini kapsar.'
WHERE id = 1;
```

---

## ⚠️ Önemli Notlar

1. **Foreign Key Kontrolleri:** Soru eklemeden önce ilgili `topic_id`, `unit_id` vb. değerlerin var olduğundan emin olun.

2. **Order No:** İçeriklerin sıralaması için `order_no` alanını kullanın.

3. **Slug:** URL'ler için `slug` alanını benzersiz ve URL-friendly yapın (örn: `fotosentez-nedir`).

4. **Silme Cascade:** `ON DELETE CASCADE` ayarlı tablolar (örn: `question_choices`) üst kayıt silindiğinde otomatik silinir.

5. **RLS (Row Level Security):** Supabase'de tablolara RLS politikaları eklemeyi unutmayın.
```sql
-- Örnek RLS
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access" ON questions
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');
```
