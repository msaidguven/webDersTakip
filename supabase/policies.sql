-- RLS Politikalarını Düzelt - Public Read Erişimi

-- grades tablosu için
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "grades_public_read" ON grades;
CREATE POLICY "grades_public_read" ON grades FOR SELECT USING (true);

-- lessons tablosu için
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lessons_public_read" ON lessons;
CREATE POLICY "lessons_public_read" ON lessons FOR SELECT USING (true);

-- units tablosu için
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "units_public_read" ON units;
CREATE POLICY "units_public_read" ON units FOR SELECT USING (true);

-- topics tablosu için
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "topics_public_read" ON topics;
CREATE POLICY "topics_public_read" ON topics FOR SELECT USING (true);

-- topic_contents tablosu için
ALTER TABLE topic_contents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "topic_contents_public_read" ON topic_contents;
CREATE POLICY "topic_contents_public_read" ON topic_contents FOR SELECT USING (true);

-- outcomes tablosu için
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "outcomes_public_read" ON outcomes;
CREATE POLICY "outcomes_public_read" ON outcomes FOR SELECT USING (true);

-- lesson_grades tablosu için
ALTER TABLE lesson_grades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lesson_grades_public_read" ON lesson_grades;
CREATE POLICY "lesson_grades_public_read" ON lesson_grades FOR SELECT USING (true);

-- unit_grades tablosu için
ALTER TABLE unit_grades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "unit_grades_public_read" ON unit_grades;
CREATE POLICY "unit_grades_public_read" ON unit_grades FOR SELECT USING (true);
