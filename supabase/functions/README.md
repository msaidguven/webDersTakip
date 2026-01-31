# Supabase Fonksiyonları

## grades tablosu fonksiyonları

### 1. get_active_grades()
Aktif olan tüm sınıfları listeler (order_no'ya göre sıralı).

```sql
SELECT * FROM get_active_grades();
```

**Döndürdüğü kolonlar:**
- `id` (bigint)
- `name` (text)
- `order_no` (integer)
- `question_count` (integer)

---

### 2. get_active_grades_paginated(page_size, page_offset)
Aktif sınıfları sayfalama ile listeler.

```sql
-- İlk 10 kayıt
SELECT * FROM get_active_grades_paginated(10, 0);

-- 11-20 arası kayıtlar
SELECT * FROM get_active_grades_paginated(10, 10);
```

**Parametreler:**
- `page_size`: Sayfa başına kayıt sayısı (default: 10)
- `page_offset`: Atlanacak kayıt sayısı (default: 0)

---

### 3. get_grade_by_id(grade_id)
Belirli bir sınıfın detayını getirir.

```sql
SELECT * FROM get_grade_by_id(1);
```

**Parametreler:**
- `grade_id`: Sınıf ID'si (bigint)

---

## Supabase'de Kullanım (JavaScript/TypeScript)

```typescript
// Aktif sınıfları getir
const { data, error } = await supabase
  .rpc('get_active_grades');

// Sayfalama ile getir
const { data, error } = await supabase
  .rpc('get_active_grades_paginated', {
    page_size: 10,
    page_offset: 0
  });

// Tekil sınıf getir
const { data, error } = await supabase
  .rpc('get_grade_by_id', {
    grade_id: 1
  });
```

## Kurulum

SQL Editor'de çalıştır:

1. `get_active_grades.sql`
2. `get_active_grades_paginated.sql` (opsiyonel)
3. `get_grade_by_id.sql` (opsiyonel)
