-- Türkçe karakterleri destekleyen slug fonksiyonu
CREATE OR REPLACE FUNCTION generate_slug(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    -- Türkçe karakterleri ASCII'ye çevir
    result := input_text;
    result := REPLACE(result, 'ç', 'c');
    result := REPLACE(result, 'Ç', 'C');
    result := REPLACE(result, 'ğ', 'g');
    result := REPLACE(result, 'Ğ', 'G');
    result := REPLACE(result, 'ı', 'i');
    result := REPLACE(result, 'İ', 'I');
    result := REPLACE(result, 'ö', 'o');
    result := REPLACE(result, 'Ö', 'O');
    result := REPLACE(result, 'ş', 's');
    result := REPLACE(result, 'Ş', 'S');
    result := REPLACE(result, 'ü', 'u');
    result := REPLACE(result, 'Ü', 'U');
    
    -- Küçük harfe çevir
    result := LOWER(result);
    
    -- Alfanümerik olmayan karakterleri tire ile değiştir (Türkçe harfler hariç)
    result := REGEXP_REPLACE(result, '[^a-z0-9]+', '-', 'g');
    
    -- Baştaki ve sondaki tireleri kaldır
    result := TRIM(BOTH '-' FROM result);
    
    -- Birden fazla tireyi tek tireye çevir
    result := REGEXP_REPLACE(result, '-+', '-', 'g');
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Boş slug'ları doldur
UPDATE lessons 
SET slug = generate_slug(name) 
WHERE slug IS NULL OR slug = '';

-- Benzersizlik kontrolü için son ek ekleme fonksiyonu
CREATE OR REPLACE FUNCTION ensure_unique_lesson_slug()
RETURNS TRIGGER AS $$
DECLARE
    base_slug TEXT;
    new_slug TEXT;
    counter INTEGER := 1;
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        base_slug := generate_slug(NEW.name);
        new_slug := base_slug;
        
        -- Benzersiz olana kadar dene
        WHILE EXISTS (SELECT 1 FROM lessons WHERE slug = new_slug AND id != NEW.id) LOOP
            new_slug := base_slug || '-' || counter;
            counter := counter + 1;
        END LOOP;
        
        NEW.slug := new_slug;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger oluştur (otomatik slug oluşturma)
DROP TRIGGER IF EXISTS auto_lesson_slug ON lessons;
CREATE TRIGGER auto_lesson_slug
    BEFORE INSERT OR UPDATE ON lessons
    FOR EACH ROW
    EXECUTE FUNCTION ensure_unique_lesson_slug();
