'use client';

// Yıllık Plan Yükleme — DOCX yıllık plan tablosunu okuyup Üniteler/Konular/Kazanımlar
// olarak Supabase'e aktarır. Eski yillik_plan/ (Python/Flask) aracının React portu;
// topic_contents'e hiç dokunmaz — bkz. app/src/lib/yillikPlan/importer.ts üstündeki not.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { TymmUnit, TymmRawSections, TymmLearningOutcome } from '@/app/src/lib/tymm/tymmParser';
import { norm as tymmNorm } from '@/app/src/lib/tymm/compareUnits';

type ParsedRow = {
  week_no: number | null;
  Hafta: string;
  ünite: string;
  konu: string;
  kazanım: string[];
  saat: number | null;
};

// Tablo satırlarını index yerine kalıcı bir _id ile takip ediyoruz: satır silindiğinde
// React DOM node'larını index'e göre eşleştirip (defaultValue'lu, kontrolsüz inputlarla
// birleşince) yanlış satırın içeriğini gösterebiliyordu — sanki farklı bir satır
// silinmiş gibi görünüyordu. _id, React key'i olarak kullanılınca her satırın kendi DOM
// node'u kalıyor, silme her zaman doğru satırı hedefliyor. Sunucuya gönderilmeden önce
// _id ayıklanıyor (API sadece ParsedRow şeklini bekliyor).
type EditableRow = ParsedRow & { _id: number };

// XLSX çerçeve yıllık planları genelde her sınıf için ayrı bir sayfa içeriyor (ör. BTY_5,
// BTY_6) — parse-xlsx sayfa başına bir sonuç döner, admin hangisinin hedeflediği sınıfa ait
// olduğunu seçer (bkz. handleFile, sayfa seçici kartı).
type XlsxSheetResult = { sheetName: string; rows: ParsedRow[]; total: number; clean: number; uniteler: string[]; konu_count: number; kazanim_count: number };

type LogLevel = 'info' | 'success' | 'warning' | 'error';
type LogEntry = { msg: string; level: LogLevel };
type StepResult = { basarili: number; atlanmis: number; hata: number; hafta_atlanmis?: number };
type StepKey = 'units' | 'topics' | 'outcomes';

type LessonRow = { id: number; name: string };
type GradeRow = { id: number; name: string };

// Kaydetmeden ÖNCE, konu bazlı özet: kaç kazanım aynen kalacak, kaç tanesi yeni eklenecek,
// kaç tanesi (DB'de is_current=true ama TYMM'de artık yok diye) arşivlenecek. saveTymmUnit
// (app/src/lib/tymm/importUnit.ts) ile BİREBİR AYNI eşleşme kuralını (topic_id + description
// tam string eşitliği) kullanan /api/admin/tymm/fetch tarafında hesaplanır — önizleme hiçbir
// zaman kaydetmenin gerçekte yapacağından farklı bir şey göstermesin diye.
type TymmTopicDiff = {
  topicTitle: string;
  topicExists: boolean;
  topicId: number | null;
  unchanged: number;
  new: number;
  toArchive: number;
  newDescriptions: string[];
  toArchiveOutcomes: { id: number; description: string }[];
};

// SADECE ÇEKME (yazma yok) sonucu — admin bunu düzenleyip onayladıktan sonra ayrı bir
// istekle (save) kaydedilir, bkz. Card 4 üstündeki not.
type TymmFetchResult = {
  unit: TymmUnit;
  unmatchedLines: string[];
  boundaryWarnings: string[];
  rawSections: TymmRawSections;
  topicDiffs?: TymmTopicDiff[];
};

// DB'YE YAZMA sonucu
type TymmImportResult = {
  ok: true;
  unitId: number;
  unitTitle: string;
  topicsCreated: number;
  outcomesCreated: number;
  outcomesSkipped: number;
};

type BulkFetchItem =
  | { url: string; title: string; ok: true; unit: TymmUnit; unmatchedLines: string[]; boundaryWarnings: string[]; rawSections: TymmRawSections }
  | { url: string; title: string; ok: false; error: string };
type BulkFetchResponse = { unitsFound: number; results: BulkFetchItem[] };

// Toplu modda her ünite kendi bağımsız önizleme/düzenleme/kaydetme durumunu taşır — bir
// ünitenin kaydedilmesi diğerlerini etkilemez, hiçbiri admin tıklamadan kaydedilmez.
type BulkPreviewItem = {
  url: string;
  title: string;
  unit: TymmUnit | null;
  unmatchedLines: string[];
  boundaryWarnings: string[];
  rawSections: TymmRawSections | null;
  fetchError: string | null;
  saving: boolean;
  saveResult: TymmImportResult | null;
  saveErr: string | null;
};

type WeekAssignResult =
  | { ok: true; assignments: { outcomeId: number; startWeek: number; endWeek: number }[] }
  | { ok: false; reason: 'no-docx-rows'; uniteName: string }
  | { ok: false; reason: 'topic-count-mismatch'; tymmCount: number; docxCount: number; dbTopicTitles: string[]; docxTitles: string[] }
  | { ok: false; reason: 'outcome-count-mismatch'; topicIndex: number; dbTopicTitle: string; dbCount: number; docxTopicTitle: string; docxCount: number };

type MatchPreviewTopic = {
  topicId: number;
  topicTitle: string;
  outcomes: { id: number; code: string | null; description: string; startWeek: number; endWeek: number }[];
};
type MatchPreviewResponse = { unitTitle: string; result: WeekAssignResult; preview: MatchPreviewTopic[] | null };
type CommitWeeksResponse = { ok: true; weeksWritten: number };

type UnitContentResponse = {
  unit: { id: number; title: string; duration_hours: number | null; key_concepts: string[] | null };
  topics: {
    id: number;
    title: string;
    learningOutcome: string | null;
    outcomes: { id: number; code: string | null; description: string }[];
    // Konu → öğrenme çıktısı grubu → kazanım hiyerarşisi (bkz. topic_learning_outcomes
    // migration'ı) — sadece bundan sonra TYMM'den aktarılan üniteler dolduruyor, eski
    // üniteler için boş gelir ve ungroupedOutcomes'a (aynı outcomes listesi) düşülür.
    learningOutcomeGroups: { id: number; code: string | null; title: string; outcomes: { id: number; code: string | null; description: string }[] }[];
    ungroupedOutcomes: { id: number; code: string | null; description: string }[];
  }[];
};

// topicDiffs verildiğinde (toplu karşılaştırma raporundan açılırsa) modal, DB'deki her
// kazanımı TYMM'deki karşılığıyla eşleşiyor mu diye yeşil/kırmızı renklendirir ve
// düzenleme/ekleme aksiyonlarını gösterir — verilmezse (kaydettikten hemen sonraki
// "İncele" gibi) eski sade liste davranışına düşer.
type InspectTarget = { unitId: number; tymmUrl: string; unitTitle: string; topicDiffs?: CompareTopicDiff[] };

// Konu içindeki TEK bir öğrenme çıktısının kendi kıyası — konu birden fazla öğrenme çıktısı
// içerebiliyor (bkz. topic_learning_outcomes), her biri kendi a/b/c kazanımlarıyla burada
// hiyerarşik gösteriliyor. Eski/gruplanmamış konularda bu dizi boş gelir.
type CompareLearningOutcomeDiff = {
  code: string;
  title: string;
  status: 'same' | 'changed' | 'tymm-only' | 'db-only';
  dbGroupId: number | null;
  learningOutcomeChanged: boolean;
  outcomesAdded: string[];
  outcomesRemoved: { id: number; code: string | null; description: string }[];
  outcomesOverridden: { id: number; code: string | null; description: string }[];
  tymmOutcomeTexts: string[];
};
type CompareTopicDiff = {
  status: 'same' | 'changed' | 'tymm-only' | 'db-only';
  title: string;
  dbTopicId: number | null;
  learningOutcomeChanged: boolean;
  learningOutcomeDiffs: CompareLearningOutcomeDiff[];
  outcomesAdded: string[];
  outcomesRemoved: { id: number; code: string | null; description: string }[];
  outcomesOverridden: { id: number; code: string | null; description: string }[];
  tymmOutcomeTexts: string[];
};
type CompareUnitDiff = {
  status: 'same' | 'changed' | 'tymm-only' | 'db-only';
  tymmUrl: string;
  tymmTitle: string;
  dbUnitId: number | null;
  dbUnitTitle: string | null;
  durationHoursChanged: boolean;
  keyConceptsAdded: string[];
  keyConceptsRemoved: string[];
  topics: CompareTopicDiff[];
};
type CompareBulkResponse = {
  unitsFound: number;
  results: CompareUnitDiff[];
  fetchErrors: { url: string; title: string; error: string }[];
};

const STEP_ENDPOINTS: Record<StepKey, string> = {
  units: '/api/admin/yillik-plan/import-units',
  topics: '/api/admin/yillik-plan/import-topics',
  outcomes: '/api/admin/yillik-plan/import-outcomes',
};

export default function YillikPlanPanel() {
  // Karışık görünmesin diye üç ayrı iş akışı sekmelere ayrıldı — DOCX yükleme ve Ders/Sınıf
  // seçimi ise her sekmede kullanıldığı için sekmelerin dışında, hep görünür kalıyor.
  const [activeTab, setActiveTab] = useState<'docx' | 'tymm' | 'weeks' | 'compare'>('docx');

  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [lessonGrades, setLessonGrades] = useState<
    { lesson_id: number; grade_id: number; tymm_page_url: string | null; tymm_verified: boolean }[]
  >([]);
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [gradeId, setGradeId] = useState<number | null>(null);
  // Önce sınıf seçilsin — dersler o sınıfta okutulanlarla (lesson_grades) sınırlı. Bir
  // sınıfın hiç bilinen dersi yoksa liste bilerek boş/kilitli kalır — yanlış sınıf/ders
  // kombinasyonu seçilmesindense admin'in önce doğru eşleşmeyi (lesson_grades'e satır
  // ekleyerek) kurması daha güvenli.
  const availableLessons = gradeId == null ? [] : lessons.filter((l) => lessonGrades.some((lg) => lg.lesson_id === l.id && lg.grade_id === gradeId));
  // Seçili sınıfta, TYMM ile doğrulanmış (tam eşleşme ya da elle işaretlenmiş) dersler —
  // Ders PickList'inde yeşil tik olarak gösterilir.
  const verifiedLessonIds = new Set(
    gradeId == null ? [] : lessonGrades.filter((lg) => lg.grade_id === gradeId && lg.tymm_verified).map((lg) => lg.lesson_id)
  );

  const [fileName, setFileName] = useState('');
  const [xlsxSheets, setXlsxSheets] = useState<XlsxSheetResult[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<EditableRow[] | null>(null);
  const nextRowId = useRef(0);
  const withIds = useCallback((list: ParsedRow[]): EditableRow[] => list.map((r) => ({ ...r, _id: nextRowId.current++ })), []);
  const [uniteler, setUniteler] = useState<string[]>([]);
  const [konuCount, setKonuCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [rawJson, setRawJson] = useState('');
  const [rawJsonError, setRawJsonError] = useState<string | null>(null);

  const [stepLogs, setStepLogs] = useState<Record<StepKey, LogEntry[]>>({ units: [], topics: [], outcomes: [] });
  const [stepResult, setStepResult] = useState<Record<StepKey, StepResult | null>>({ units: null, topics: null, outcomes: null });
  const [stepRunning, setStepRunning] = useState<Record<StepKey, boolean>>({ units: false, topics: false, outcomes: false });

  // TYMM'den Aktar sekmesi (bağımsız): TYMM'den içerik ÇEK (yazma yok) → önizle/düzelt → elle ONAYLA (o
  // zaman kaydedilir). Aynı ünite iki farklı curriculum_year ile art arda "aktarılınca"
  // (fetch+save tek adımdı) mükerrer kazanım oluşmuştu — artık kaydetme adımı ayrı ve
  // admin'in tıkladığı tek bir istek, bu yüzden yanlışlıkla iki kez tetiklenemiyor.
  const [tymmBulkMode, setTymmBulkMode] = useState(false);
  const [tymmUrl, setTymmUrl] = useState('');
  const [tymmYear, setTymmYear] = useState('2026-2027');
  // Admin'in AÇIKÇA seçtiği niyet: "Yeni Yıllık Plan Ekle" mi yoksa "Eskisini Güncelle" mi.
  // Kod tarafında saveTymmUnit her iki durumu da zaten doğru hallediyor (varsa günceller,
  // yoksa oluşturur) — bu seçim sadece bir GÜVENLİK KEMERİ: seçilen niyetle TYMM'den gelen
  // gerçek eşleşme durumu çelişirse uyarı gösterir, ve "Güncelle" seçilince arşivlenecek
  // kazanımları admin ONAYLAMADAN kaydetmeyi engeller (kullanıcının 2026-09-22 ısrarı:
  // "bana sorsun, ben elle düzeltebilmeliyim, sorular kaybolmasın").
  const [importMode, setImportMode] = useState<'new' | 'update' | null>(null);
  const [archiveReviewConfirmed, setArchiveReviewConfirmed] = useState(false);

  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [previewUnit, setPreviewUnit] = useState<TymmUnit | null>(null);
  const [previewUnmatched, setPreviewUnmatched] = useState<string[]>([]);
  const [previewBoundaryWarnings, setPreviewBoundaryWarnings] = useState<string[]>([]);
  const [previewRawSections, setPreviewRawSections] = useState<TymmRawSections | null>(null);
  const [previewTopicDiffs, setPreviewTopicDiffs] = useState<TymmTopicDiff[] | undefined>(undefined);
  const [comparePreviewOpen, setComparePreviewOpen] = useState(false);
  // "Yeni" görünen bir kazanım metnini admin elle eski bir kazanım id'sine eşlerse burada
  // tutulur (comp.text → eski outcome id) — fuzzy eşleşmenin kaçırdığı, 1-2 kelime değişen
  // ama aynı kazanım olan durumlar için (bkz. TymmSaveDiffSummary, kullanıcının 2026-09-22
  // isteği: "sorular kaybolmasın, ben elle eşleştirebilmeliyim").
  const [manualOutcomeMerges, setManualOutcomeMerges] = useState<Record<string, number>>({});

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<(TymmImportResult & { sourceUrl: string }) | null>(null);

  const [bulkPageUrl, setBulkPageUrl] = useState('');
  const [bulkFetching, setBulkFetching] = useState(false);
  const [bulkFetchErr, setBulkFetchErr] = useState<string | null>(null);
  const [bulkItems, setBulkItems] = useState<BulkPreviewItem[] | null>(null);
  const [bulkCompareIndex, setBulkCompareIndex] = useState<number | null>(null);
  // "🤖 Tüm Üniteleri AI ile Ayrıştır" panelinin doldurduğu, her ünitenin KENDİ inline
  // AiAssistPanel'ine verilecek başlangıç JSON metni — version, aynı üniteye ikinci kez
  // doldurulduğunda AiAssistPanel'i yeni bir `key` ile yeniden monte edip pasteValue'yu
  // sıfırlamak için (bkz. AiBulkAssistPanel onFillOne).
  const [bulkAiPrefill, setBulkAiPrefill] = useState<Record<number, { text: string; version: number }>>({});

  // Aktarılan içeriği canlı TYMM sayfasıyla yan yana karşılaştırma modalı
  const [inspecting, setInspecting] = useState<InspectTarget | null>(null);

  // Hafta Ata sekmesi (ayrı, elle onaylanır): TYMM'den aktarılan ünitenin kazanımlarına DOCX'ten
  // hafta ata — sıra+sayı eşleşmesine dayanır, bkz. assignWeeksFromDocx.ts üstündeki not.
  // weekUnitId eskiden admin'in elle yazması gereken çıplak bir sayıydı ("TYMM'den Aktar"
  // sekmesinden az önce kaydettiyse otomatik doluyordu, ama TYMM aktarımı ÖNCEKİ bir
  // oturumda yapıldıysa admin'in ID'yi bilmesinin hiçbir yolu yoktu — kullanıcının 2026-09-10
  // bildirdiği sorun). Artık seçili sınıf/derse ait üniteler DB'den çekilip isimle seçiliyor.
  const [weekUnitId, setWeekUnitId] = useState('');
  const [weekUniteName, setWeekUniteName] = useState('');
  const [weekUnits, setWeekUnits] = useState<{ id: number; title: string }[]>([]);
  const [weekPreviewing, setWeekPreviewing] = useState(false);
  const [weekPreview, setWeekPreview] = useState<MatchPreviewResponse | null>(null);
  const [weekPreviewErr, setWeekPreviewErr] = useState<string | null>(null);
  const [weekCommitting, setWeekCommitting] = useState(false);
  const [weekCommitResult, setWeekCommitResult] = useState<CommitWeeksResponse | null>(null);
  const [weekCommitErr, setWeekCommitErr] = useState<string | null>(null);

  // Kontrol Et sekmesi (sadece okuma): seçili ders/sınıfın TYMM sayfasındaki tüm ünitelerini
  // canlı çekip DB'deki mevcut içerikle toplu kıyaslar — hiçbir şey yazmaz.
  const [comparePageUrl, setComparePageUrl] = useState('');
  const [comparing, setComparing] = useState(false);
  const [compareErr, setCompareErr] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<CompareBulkResponse | null>(null);
  const [compareExpanded, setCompareExpanded] = useState<Set<number>>(new Set());

  async function runCompare() {
    if (!comparePageUrl.trim() || !lessonId || !gradeId) return;
    setComparing(true);
    setCompareErr(null);
    setCompareResult(null);
    setCompareExpanded(new Set());
    try {
      const res = await fetch('/api/admin/tymm/compare-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageUrl: comparePageUrl.trim(), lessonId, gradeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCompareErr(data?.error || 'Karşılaştırma başarısız');
        return;
      }
      const result = data as CompareBulkResponse;
      setCompareResult(result);
      const url = comparePageUrl.trim();
      const allMatched = result.unitsFound > 0 && result.results.every((r) => r.status === 'same');
      void patchLessonGrade({ tymmPageUrl: url, ...(allMatched ? { tymmVerified: true } : {}) });
    } catch {
      setCompareErr('İstek başarısız (ağ hatası)');
    } finally {
      setComparing(false);
    }
  }

  // Seçili ders/sınıf çiftine tymm_page_url ve/veya tymm_verified yazar — Kontrol Et tam
  // eşleşme bulduğunda otomatik, admin "Doğru olarak işaretle" dediğinde elle çağrılır.
  // Silme sonrası tymm_verified'ı false'a çekmek DB trigger'larıyla yapılıyor (bkz.
  // supabase/migrations/add_lesson_grades_tymm_page_url.sql), burada sadece yazma var.
  async function patchLessonGrade(fields: { tymmPageUrl?: string; tymmVerified?: boolean }) {
    if (!lessonId || !gradeId) return;
    const currentEntry = lessonGrades.find((lg) => lg.lesson_id === lessonId && lg.grade_id === gradeId);
    const body: Record<string, unknown> = { lessonId, gradeId };
    if (fields.tymmPageUrl !== undefined && currentEntry?.tymm_page_url !== fields.tymmPageUrl) {
      body.tymmPageUrl = fields.tymmPageUrl;
    }
    if (fields.tymmVerified !== undefined && currentEntry?.tymm_verified !== fields.tymmVerified) {
      body.tymmVerified = fields.tymmVerified;
    }
    if (Object.keys(body).length <= 2) return;
    try {
      const res = await fetch('/api/admin/manage/lesson-grades', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;
      setLessonGrades((prev) => {
        const next = prev.map((lg) =>
          lg.lesson_id === lessonId && lg.grade_id === gradeId
            ? {
                ...lg,
                ...(body.tymmPageUrl !== undefined ? { tymm_page_url: body.tymmPageUrl as string } : {}),
                ...(body.tymmVerified !== undefined ? { tymm_verified: body.tymmVerified as boolean } : {}),
              }
            : lg
        );
        if (!currentEntry) {
          next.push({
            lesson_id: lessonId,
            grade_id: gradeId,
            tymm_page_url: (body.tymmPageUrl as string) ?? null,
            tymm_verified: (body.tymmVerified as boolean) ?? false,
          });
        }
        return next;
      });
    } catch {
      // sessizce yok say — bir dahaki denemede tekrar gönderilir
    }
  }

  function toggleCompareExpanded(idx: number) {
    setCompareExpanded((s) => {
      const next = new Set(s);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: lessonsData }, { data: gradesData }, { data: lessonGradesData }] = await Promise.all([
        supabase.from('lessons').select('id, name').order('order_no'),
        supabase.from('grades').select('id, name').order('order_no'),
        // is_active burada güvenilir değil (Matematik gibi kesin okutulan derslerde bile
        // false görülüyor) — bu yüzden filtrelemiyoruz, sadece eşleşme var mı bakıyoruz.
        supabase.from('lesson_grades').select('lesson_id, grade_id, tymm_page_url, tymm_verified'),
      ]);
      setLessons((lessonsData as LessonRow[] | null) || []);
      setGrades((gradesData as GradeRow[] | null) || []);
      setLessonGrades(
        (lessonGradesData as { lesson_id: number; grade_id: number; tymm_page_url: string | null; tymm_verified: boolean }[] | null) || []
      );
    })();
  }, []);

  // Hafta Ata sekmesindeki ünite seçimi için — sınıf/ders değişince o ikilideki üniteleri
  // DB'den çeker (bkz. weekUnitId üstündeki not).
  useEffect(() => {
    if (gradeId == null || lessonId == null) {
      setWeekUnits([]);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from('units')
      .select('id, title')
      .eq('grade_id', gradeId)
      .eq('lesson_id', lessonId)
      .order('order_no', { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setWeekUnits((data as { id: number; title: string }[] | null) || []);
      });
    return () => {
      cancelled = true;
    };
  }, [gradeId, lessonId]);

  // Kontrol Et VE TYMM'den toplu aktarım sekmelerinde daha önce bu ders/sınıf için
  // kaydedilmiş bir TYMM sayfa URL'i varsa otomatik doldur — admin her seferinde linki
  // yeniden aramak zorunda kalmasın (ikisi de aynı "ders/sınıf sayfası" URL'ini kullanıyor).
  useEffect(() => {
    if (gradeId == null || lessonId == null) return;
    const saved = lessonGrades.find((lg) => lg.lesson_id === lessonId && lg.grade_id === gradeId)?.tymm_page_url;
    setComparePageUrl(saved || '');
    setBulkPageUrl(saved || '');
  }, [gradeId, lessonId, lessonGrades]);

  function selectGrade(id: number) {
    setGradeId(id);
    setLessonId((current) => (current != null && lessonGrades.some((lg) => lg.lesson_id === current && lg.grade_id === id) ? current : null));
  }

  const applyParsedRows = useCallback((rows: ParsedRow[], uniteler: string[], konuCount: number) => {
    setRows(withIds(rows));
    setUniteler(uniteler);
    setKonuCount(konuCount);
    setRawJson(JSON.stringify(rows, null, 2));
  }, [withIds]);

  const handleFile = useCallback(async (file: File) => {
    const nameLower = file.name.toLowerCase();
    const isDocx = nameLower.endsWith('.docx');
    const isXlsx = nameLower.endsWith('.xlsx');
    if (!isDocx && !isXlsx) {
      setParseError('Sadece .docx veya .xlsx dosyası kabul edilir.');
      return;
    }
    setFileName(file.name);
    setParsing(true);
    setParseError(null);
    setRows(null);
    setXlsxSheets(null);
    setStepLogs({ units: [], topics: [], outcomes: [] });
    setStepResult({ units: null, topics: null, outcomes: null });

    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(isDocx ? '/api/admin/yillik-plan/parse-docx' : '/api/admin/yillik-plan/parse-xlsx', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setParseError(data?.error || 'Ayrıştırma başarısız.');
        return;
      }
      if (isDocx) {
        applyParsedRows(data.rows, data.uniteler || [], data.konu_count || 0);
        return;
      }
      // XLSX genelde her sınıf için ayrı bir sayfa içeriyor (ör. BTY_5, BTY_6) — tek
      // kullanılabilir sayfa bulunduysa DOCX'teki gibi otomatik uygulanır, birden fazlaysa
      // admin hangisinin hedeflediği sınıfa ait olduğunu seçer (bkz. sayfa seçici kartı).
      const sheets: XlsxSheetResult[] = data.sheets || [];
      if (sheets.length === 1) {
        applyParsedRows(sheets[0].rows, sheets[0].uniteler, sheets[0].konu_count);
      } else {
        setXlsxSheets(sheets);
      }
    } catch {
      setParseError('Dosya işlenirken bir hata oluştu.');
    } finally {
      setParsing(false);
    }
  }, [applyParsedRows]);

  async function runStep(step: StepKey) {
    if (!rows || !lessonId || !gradeId) return;
    setStepRunning((s) => ({ ...s, [step]: true }));
    setStepLogs((s) => ({ ...s, [step]: [{ msg: 'Başlıyor…', level: 'info' }] }));
    try {
      const cleanRows = rows.map(({ _id, ...rest }) => rest);
      const res = await fetch(STEP_ENDPOINTS[step], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: cleanRows, lessonId, gradeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStepLogs((s) => ({ ...s, [step]: [{ msg: data?.error || 'Hata oluştu.', level: 'error' }] }));
        return;
      }
      setStepLogs((s) => ({ ...s, [step]: data.logs || [] }));
      setStepResult((s) => ({ ...s, [step]: data.result || null }));
    } catch {
      setStepLogs((s) => ({ ...s, [step]: [{ msg: 'İstek başarısız.', level: 'error' }] }));
    } finally {
      setStepRunning((s) => ({ ...s, [step]: false }));
    }
  }

  async function runTymmFetch() {
    if (!tymmUrl.trim()) return;
    setFetching(true);
    setFetchErr(null);
    setPreviewUnit(null);
    setPreviewUnmatched([]);
    setPreviewBoundaryWarnings([]);
    setPreviewRawSections(null);
    setPreviewTopicDiffs(undefined);
    setManualOutcomeMerges({});
    setArchiveReviewConfirmed(false);
    setSaveResult(null);
    setSaveErr(null);
    try {
      const res = await fetch('/api/admin/tymm/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tymmUrl: tymmUrl.trim(), lessonId, gradeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFetchErr(data?.error || 'Çekme başarısız');
        return;
      }
      const result = data as TymmFetchResult;
      setPreviewUnit(result.unit);
      setPreviewUnmatched(result.unmatchedLines);
      setPreviewBoundaryWarnings(result.boundaryWarnings);
      setPreviewRawSections(result.rawSections);
      setPreviewTopicDiffs(result.topicDiffs);
    } catch {
      setFetchErr('İstek başarısız (ağ hatası)');
    } finally {
      setFetching(false);
    }
  }

  async function runTymmSave(): Promise<boolean> {
    if (!previewUnit || !lessonId || !gradeId) return false;
    setSaving(true);
    setSaveErr(null);
    try {
      const res = await fetch('/api/admin/tymm/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit: previewUnit,
          gradeId,
          lessonId,
          curriculumYear: tymmYear.trim() || null,
          manualOutcomeMerges: Object.keys(manualOutcomeMerges).length ? manualOutcomeMerges : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveErr(data?.error || 'Kaydetme başarısız');
        return false;
      }
      const result = data as TymmImportResult;
      setSaveResult({ ...result, sourceUrl: tymmUrl.trim() });
      setPreviewUnit(null);
      setManualOutcomeMerges({});
      setWeekUnitId(String(result.unitId));
      return true;
    } catch {
      setSaveErr('İstek başarısız (ağ hatası)');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function runTymmBulkFetch() {
    if (!bulkPageUrl.trim()) return;
    setBulkFetching(true);
    setBulkFetchErr(null);
    setBulkItems(null);
    try {
      const res = await fetch('/api/admin/tymm/fetch-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageUrl: bulkPageUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBulkFetchErr(data?.error || 'Bulma başarısız');
        return;
      }
      const result = data as BulkFetchResponse;
      void patchLessonGrade({ tymmPageUrl: bulkPageUrl.trim() });
      setBulkItems(
        result.results.map((r) => ({
          url: r.url,
          title: r.title,
          unit: r.ok ? r.unit : null,
          unmatchedLines: r.ok ? r.unmatchedLines : [],
          boundaryWarnings: r.ok ? r.boundaryWarnings : [],
          rawSections: r.ok ? r.rawSections : null,
          fetchError: r.ok ? null : r.error,
          saving: false,
          saveResult: null,
          saveErr: null,
        }))
      );
    } catch {
      setBulkFetchErr('İstek başarısız (ağ hatası)');
    } finally {
      setBulkFetching(false);
    }
  }

  function updateBulkItemUnit(index: number, mutator: (u: TymmUnit) => TymmUnit) {
    setBulkItems((items) => (items ? items.map((it, i) => (i === index && it.unit ? { ...it, unit: mutator(it.unit) } : it)) : items));
  }

  async function saveBulkItem(index: number): Promise<boolean> {
    const item = bulkItems?.[index];
    if (!item || !item.unit || !lessonId || !gradeId) return false;
    setBulkItems((items) => items!.map((it, i) => (i === index ? { ...it, saving: true, saveErr: null } : it)));
    try {
      const res = await fetch('/api/admin/tymm/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit: item.unit, gradeId, lessonId, curriculumYear: tymmYear.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBulkItems((items) => items!.map((it, i) => (i === index ? { ...it, saving: false, saveErr: data?.error || 'Kaydetme başarısız' } : it)));
        return false;
      }
      const result = data as TymmImportResult;
      setBulkItems((items) => items!.map((it, i) => (i === index ? { ...it, saving: false, saveResult: result, saveErr: null } : it)));
      setWeekUnitId(String(result.unitId));
      return true;
    } catch {
      setBulkItems((items) => items!.map((it, i) => (i === index ? { ...it, saving: false, saveErr: 'İstek başarısız (ağ hatası)' } : it)));
      return false;
    }
  }

  async function runWeekPreview() {
    const unitId = parseInt(weekUnitId, 10);
    if (!rows || !Number.isFinite(unitId) || !weekUniteName) return;
    setWeekPreviewing(true);
    setWeekPreviewErr(null);
    setWeekPreview(null);
    setWeekCommitResult(null);
    setWeekCommitErr(null);
    try {
      const cleanRows = rows.map(({ _id, ...rest }) => rest);
      const res = await fetch('/api/admin/tymm/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId, uniteName: weekUniteName, rows: cleanRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWeekPreviewErr(data?.error || 'Önizleme başarısız');
        return;
      }
      setWeekPreview(data as MatchPreviewResponse);
    } catch {
      setWeekPreviewErr('İstek başarısız (ağ hatası)');
    } finally {
      setWeekPreviewing(false);
    }
  }

  async function runWeekCommit() {
    const unitId = parseInt(weekUnitId, 10);
    if (!rows || !Number.isFinite(unitId) || !weekUniteName) return;
    setWeekCommitting(true);
    setWeekCommitErr(null);
    setWeekCommitResult(null);
    try {
      const cleanRows = rows.map(({ _id, ...rest }) => rest);
      const res = await fetch('/api/admin/tymm/commit-weeks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId, uniteName: weekUniteName, rows: cleanRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWeekCommitErr(data?.error || 'Kaydetme başarısız');
        return;
      }
      setWeekCommitResult(data as CommitWeeksResponse);
    } catch {
      setWeekCommitErr('İstek başarısız (ağ hatası)');
    } finally {
      setWeekCommitting(false);
    }
  }

  function applyRawJson() {
    try {
      const parsed = JSON.parse(rawJson);
      if (!Array.isArray(parsed)) throw new Error('Kök eleman bir dizi olmalı.');
      setRows(withIds(parsed));
      setRawJsonError(null);
    } catch (e) {
      setRawJsonError(e instanceof Error ? e.message : 'Geçersiz JSON');
    }
  }

  function updateRow(id: number, field: keyof ParsedRow, value: string) {
    if (!rows) return;
    const next = rows.map((r) => {
      if (r._id !== id) return r;
      if (field === 'week_no' || field === 'saat') {
        return { ...r, [field]: value.trim() ? parseInt(value, 10) : null };
      }
      return { ...r, [field]: value };
    });
    setRows(next);
    setRawJson(JSON.stringify(next.map(({ _id, ...rest }) => rest), null, 2));
  }

  function updateKazanim(id: number, value: string) {
    if (!rows) return;
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) throw new Error();
      const next = rows.map((r) => (r._id === id ? { ...r, kazanım: parsed } : r));
      setRows(next);
      setRawJson(JSON.stringify(next.map(({ _id, ...rest }) => rest), null, 2));
    } catch {
      // geçersiz JSON — sessizce yoksay, kullanıcı düzeltene kadar bekle
    }
  }

  function deleteRow(id: number) {
    if (!rows) return;
    const next = rows.filter((r) => r._id !== id);
    setRows(next);
    setRawJson(JSON.stringify(next.map(({ _id, ...rest }) => rest), null, 2));
  }

  function addRow() {
    const next = [...(rows || []), { week_no: null, Hafta: '', ünite: '', konu: '', kazanım: [], saat: null, _id: nextRowId.current++ }];
    setRows(next);
    setRawJson(JSON.stringify(next.map(({ _id, ...rest }) => rest), null, 2));
  }

  const ready = !!rows && rows.length > 0 && lessonId != null && gradeId != null;

  // "Eskisini Güncelle" seçiliyken, arşivlenecek (eşleşmeyen) kazanım varsa admin ONAY
  // VERMEDEN kaydedemez — elle eşleştirilenler (manualOutcomeMerges) zaten sayılmaz, geriye
  // kalan gerçekten "değişti/kayboldu" sanılacaklar için bilinçli bir onay istiyoruz
  // (kullanıcının 2026-09-22 ısrarı: sorular sessizce kaybolmasın).
  const unresolvedArchiveCount = (previewTopicDiffs || []).reduce((n, d) => {
    const mergedIds = new Set(d.newDescriptions.filter((desc) => manualOutcomeMerges[desc] != null).map((desc) => manualOutcomeMerges[desc]));
    return n + d.toArchiveOutcomes.filter((o) => !mergedIds.has(o.id)).length;
  }, 0);
  const needsArchiveReview = importMode === 'update' && unresolvedArchiveCount > 0 && !archiveReviewConfirmed;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <StepFlow rows={rows} results={stepResult} />

      {/* DOSYA YÜKLE — her iki sekmede de (klasik aktarım + hafta atama) kullanıldığı için sekmelerin dışında, hep görünür */}
      <Card title="DOCX / XLSX Yükle">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-indigo-400 bg-indigo-500/10' : 'border-border hover:border-border'
          }`}
        >
          <input
            type="file"
            accept=".docx,.xlsx"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <div className="text-3xl mb-2">📄</div>
          <p className="text-sm font-bold text-foreground">DOCX veya XLSX sürükle veya tıkla</p>
          <p className="text-xs text-muted-foreground mt-1">Yıllık plan tablosu içeren .docx dosyası ya da MEB çerçeve plan .xlsx&apos;i (kitapsız dersler için — bkz. proje sohbeti 2026-09-10)</p>
          {fileName && <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 mt-3">{parsing ? '⏳ ' : '✅ '}{fileName}</p>}
        </div>
        {parseError && <p className="text-sm text-red-600 dark:text-red-400 mt-3">❌ {parseError}</p>}

        {xlsxSheets && !rows && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-bold text-muted-foreground">Bu Excel&apos;de birden fazla sayfa var — hedeflediğiniz sınıfa ait olanı seçin:</p>
            {xlsxSheets.map((s) => (
              <button
                key={s.sheetName}
                onClick={() => applyParsedRows(s.rows, s.uniteler, s.konu_count)}
                className="w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3 text-left hover:border-indigo-400 transition-colors"
              >
                <span className="text-sm font-bold text-foreground">{s.sheetName}</span>
                <span className="text-[11px] text-muted-foreground">{s.uniteler.length} ünite · {s.konu_count} konu · {s.kazanim_count} kazanım</span>
              </button>
            ))}
          </div>
        )}

        {rows && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Ünite" value={uniteler.length} />
              <Stat label="Konu" value={konuCount} />
              <Stat label="Satır" value={rows.length} />
            </div>
            {uniteler.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {uniteler.map((u) => (
                  <span key={u} className="px-2 py-1 rounded-md text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                    {u}
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={() => setEditorOpen((v) => !v)}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-300 hover:text-indigo-500 dark:hover:text-indigo-200 transition-colors"
            >
              {editorOpen ? '▲ Düzenleyiciyi Kapat' : '✏️ Kaydetmeden önce düzenle'}
            </button>
          </div>
        )}
      </Card>

      {editorOpen && rows && (
        <Card title="Veri Düzenleyici">
          <RowTable rows={rows} onUpdate={updateRow} onUpdateKazanim={updateKazanim} onDelete={deleteRow} onAdd={addRow} />
          <details className="mt-4">
            <summary className="text-xs font-bold text-muted-foreground cursor-pointer">Ham JSON olarak düzenle</summary>
            <textarea
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              rows={10}
              spellCheck={false}
              className="w-full mt-2 rounded-lg border border-border bg-surface p-3 text-xs font-mono text-emerald-600 dark:text-emerald-300 resize-y outline-none focus:border-indigo-400"
            />
            <div className="flex items-center gap-3 mt-2">
              <button onClick={applyRawJson} className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-400 transition-colors">
                JSON&apos;u Uygula
              </button>
              {rawJsonError && <span className="text-xs text-red-600 dark:text-red-400">❌ {rawJsonError}</span>}
            </div>
          </details>
        </Card>
      )}

      {/* DERS / SINIF SEÇ — sekmelerin dışında, klasik aktarım da TYMM aktarımı da bunu kullanır */}
      <Card title="Sınıf ve Ders Seç">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PickList label="Sınıf" items={grades} selectedId={gradeId} onSelect={selectGrade} />
          <PickList
            label="Ders"
            items={availableLessons}
            selectedId={lessonId}
            onSelect={setLessonId}
            disabled={gradeId == null}
            emptyMessage={gradeId == null ? 'Önce sınıf seçin' : 'Bu sınıfta ders bulunamadı'}
            verifiedIds={verifiedLessonIds}
          />
        </div>
      </Card>

      {/* SEKMELER — üç ayrı iş akışı karışmasın diye ayrıldı */}
      <TabBar
        tabs={[
          { key: 'docx', label: '📄 Klasik Aktarım' },
          { key: 'tymm', label: '🌐 TYMM’den Aktar' },
          { key: 'weeks', label: '📅 Hafta Ata' },
          { key: 'compare', label: '🔍 Kontrol Et' },
        ]}
        active={activeTab}
        onSelect={(k) => setActiveTab(k as typeof activeTab)}
      />

      {activeTab === 'docx' && (
      <Card title="Üniteler · Konular · Kazanımlar">
        <div className="space-y-4">
          <StepRunner
            step="units"
            title="Üniteler"
            description="Benzersiz üniteler units tablosuna eklenir; lesson_grades bağlantısı oluşturulur."
            ready={ready}
            running={stepRunning.units}
            logs={stepLogs.units}
            result={stepResult.units}
            onRun={() => runStep('units')}
          />
          <StepRunner
            step="topics"
            title="Konular"
            description="Benzersiz (ünite, konu) çiftleri topics tablosuna eklenir."
            ready={ready}
            running={stepRunning.topics}
            logs={stepLogs.topics}
            result={stepResult.topics}
            onRun={() => runStep('topics')}
          />
          <StepRunner
            step="outcomes"
            title="Kazanımlar"
            description="Kazanımlar outcomes tablosuna (baştaki a), b) numaralandırması silinip) eklenir, geçtiği haftalar outcome_weeks'e (start/end) yazılır, kod (a, b, c...) otomatik atanır."
            ready={ready}
            running={stepRunning.outcomes}
            logs={stepLogs.outcomes}
            result={stepResult.outcomes}
            onRun={() => runStep('outcomes')}
          />
        </div>
      </Card>
      )}

      {activeTab === 'tymm' && (
      <Card title="TYMM'den İçerik Aktar">
        <p className="text-xs text-muted-foreground mb-4">
          Yeni müfredat (tymm.meb.gov.tr) sayfasındaki ünite/konu/kazanım/anahtar kavram metnini önce ÇEKER ve
          önizler — hiçbir şey otomatik kaydedilmez. Gerekirse metni düzeltip ünite ünite elle onaylayınca DB&apos;ye
          yazılır. Hafta ataması &quot;Hafta Ata&quot; sekmesinde ayrı bir adımda yapılır.
        </p>

        <div className="flex gap-1.5 mb-4">
          <button
            onClick={() => setTymmBulkMode(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              !tymmBulkMode ? 'border-indigo-400 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'border-border text-muted-foreground hover:border-border'
            }`}
          >
            Tek Ünite
          </button>
          <button
            onClick={() => setTymmBulkMode(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              tymmBulkMode ? 'border-indigo-400 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'border-border text-muted-foreground hover:border-border'
            }`}
          >
            Toplu (Ders/Sınıf Sayfası)
          </button>
        </div>

        <div className="mb-3">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Müfredat Yılı (ör. 2025-2026)</label>
          <input
            value={tymmYear}
            onChange={(e) => setTymmYear(e.target.value)}
            placeholder="2025-2026"
            className="w-full sm:w-64 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-indigo-400"
          />
          <p className="text-[11px] text-muted-foreground mt-1">Kaydetmeden hemen önce kontrol et — sonradan değiştirirsen aynı içerik yeniden (mükerrer) kaydedilir.</p>
        </div>

        {(!lessonId || !gradeId) && (
          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
            ⚠️ Kaydetmeden önce yukarıda Ders ve Sınıf seçin.
          </p>
        )}

        <div className="h-px bg-border mb-4" />

        {!tymmBulkMode ? (
          <>
            {/* Admin önce niyetini AÇIKÇA seçer — sistem sessizce "var mı yok mu" diye karar
                vermez. Seçime göre aşağıda uyumsuzluk uyarısı ve (Güncelle'de) arşiv onayı
                zorunlu hale gelir (kullanıcının 2026-09-22 ısrarı). */}
            <div className="mb-3">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Ne yapıyorsun?</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setImportMode('new')}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                    importMode === 'new'
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-surface text-muted-foreground border-border hover:border-emerald-400'
                  }`}
                >
                  🆕 Yeni Yıllık Plan Ekle
                </button>
                <button
                  onClick={() => setImportMode('update')}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                    importMode === 'update'
                      ? 'bg-indigo-500 text-white border-indigo-500'
                      : 'bg-surface text-muted-foreground border-border hover:border-indigo-400'
                  }`}
                >
                  🔄 Eskisini Güncelle
                </button>
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">TYMM Ünite URL&apos;i</label>
              <input
                value={tymmUrl}
                onChange={(e) => setTymmUrl(e.target.value)}
                placeholder="https://tymm.meb.gov.tr/.../unite/408"
                disabled={!importMode}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-indigo-400 disabled:opacity-40"
              />
            </div>

            <button
              onClick={runTymmFetch}
              disabled={fetching || !tymmUrl.trim() || !importMode}
              className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {fetching ? 'Çekiliyor…' : !importMode ? 'Önce yukarıdan seç' : '👁 Getir ve Önizle'}
            </button>

            {fetchErr && <p className="text-sm text-red-600 dark:text-red-400 mt-3">❌ {fetchErr}</p>}

            {previewUnit && (
              <div className="mt-4 rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{previewUnit.unitTitle}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Set(previewUnit.learningOutcomes.map((o) => o.topicTitle)).size} konu ·{' '}
                      {previewUnit.learningOutcomes.reduce((n, o) => n + o.components.length, 0)} kazanım
                    </p>
                  </div>
                  <button
                    onClick={() => setComparePreviewOpen(true)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 text-xs font-bold hover:bg-indigo-500/20"
                  >
                    {importMode === 'update' ? '📊 DB ile Karşılaştır' : '🔍 Önizle ve Onayla'}
                  </button>
                </div>

                {importMode && previewTopicDiffs && previewTopicDiffs.length > 0 && (
                  <>
                    {importMode === 'new' && previewTopicDiffs.some((d) => d.topicExists) && (
                      <p className="mt-3 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                        ⚠️ &quot;Yeni Ekle&quot; seçtin ama bu ünitenin bazı/tüm konuları DB&apos;de ZATEN VAR — bu aslında bir güncelleme olacak. Emin
                        değilsen &quot;Eskisini Güncelle&quot;yi seç.
                      </p>
                    )}
                    {importMode === 'update' && previewTopicDiffs.every((d) => !d.topicExists) && (
                      <p className="mt-3 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                        ⚠️ &quot;Eskisini Güncelle&quot; seçtin ama eşleşen HİÇBİR konu bulunamadı — bu tamamen YENİ bir kayıt oluşturacak. Emin
                        değilsen &quot;Yeni Yıllık Plan Ekle&quot;yi seç.
                      </p>
                    )}
                  </>
                )}
                {saveErr && <p className="text-sm text-red-600 dark:text-red-400 mt-3">❌ {saveErr}</p>}
              </div>
            )}

            {saveResult && (
              <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 mb-1">✅ &quot;{saveResult.unitTitle}&quot; kaydedildi (ünite #{saveResult.unitId})</p>
                  <button
                    onClick={() => setInspecting({ unitId: saveResult.unitId, tymmUrl: saveResult.sourceUrl, unitTitle: saveResult.unitTitle })}
                    className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 text-[11px] font-bold hover:bg-indigo-500/20"
                  >
                    🔍 İncele
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {saveResult.topicsCreated} yeni konu · {saveResult.outcomesCreated} yeni kazanım
                  {saveResult.outcomesSkipped > 0 && ` · ${saveResult.outcomesSkipped} zaten vardı`}
                </p>
                <p className="text-[11px] text-indigo-600 dark:text-indigo-300 mt-2">Ünite #{saveResult.unitId}, &quot;Hafta Ata&quot; sekmesine otomatik dolduruldu.</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-3">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">TYMM Ders/Sınıf Sayfası URL&apos;i</label>
              <input
                value={bulkPageUrl}
                onChange={(e) => setBulkPageUrl(e.target.value)}
                placeholder="https://tymm.meb.gov.tr/ogretim-programlari/din-kulturu-ve-ahlak-bilgisi-dersi/6"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-indigo-400"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Bu sayfadaki tüm üniteler bulunup çekilir — hiçbiri otomatik kaydedilmez, ünite ünite onaylarsın.</p>
            </div>

            <button
              onClick={runTymmBulkFetch}
              disabled={bulkFetching || !bulkPageUrl.trim()}
              className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {bulkFetching ? 'Bulunuyor…' : '👁 Üniteleri Bul ve Önizle'}
            </button>

            {bulkFetchErr && <p className="text-sm text-red-600 dark:text-red-400 mt-3">❌ {bulkFetchErr}</p>}

            {bulkItems && (
              <div className="mt-4 space-y-3">
                {(() => {
                  const aiItems = bulkItems
                    .map((it, bulkIndex) => (it.unit && it.rawSections ? { bulkIndex, unitTitle: it.title, contentFramework: it.unit.contentFramework, rawLearningOutcomes: it.rawSections.learningOutcomes } : null))
                    .filter((it): it is { bulkIndex: number; unitTitle: string; contentFramework: string[]; rawLearningOutcomes: string } => it != null);
                  return aiItems.length > 0 ? (
                    <AiBulkAssistPanel
                      items={aiItems}
                      onFillOne={(bulkIndex, jsonText) =>
                        setBulkAiPrefill((prev) => ({ ...prev, [bulkIndex]: { text: jsonText, version: (prev[bulkIndex]?.version ?? 0) + 1 } }))
                      }
                    />
                  ) : null;
                })()}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all"
                      style={{ width: `${(bulkItems.filter((it) => it.saveResult).length / bulkItems.length) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs font-bold text-muted-foreground flex-shrink-0">
                    {bulkItems.filter((it) => it.saveResult).length}/{bulkItems.length} kaydedildi
                  </p>
                </div>
                {bulkItems.map((item, idx) => {
                  const topicCount = item.unit ? new Set(item.unit.learningOutcomes.map((o) => o.topicTitle)).size : 0;
                  const outcomeCount = item.unit?.learningOutcomes.reduce((n, o) => n + o.components.length, 0) ?? 0;
                  return (
                  <div
                    key={item.url}
                    className={`rounded-xl border p-4 transition-colors ${item.saveResult ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-border bg-surface'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                            item.saveResult ? 'border-emerald-400 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-border text-muted-foreground'
                          }`}
                        >
                          {item.saveResult ? '✓' : idx + 1}
                        </span>
                        <p className="text-sm font-bold text-foreground truncate">{item.title}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {item.saveResult ? (
                          <button
                            onClick={() => setInspecting({ unitId: item.saveResult!.unitId, tymmUrl: item.url, unitTitle: item.title })}
                            className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 text-[10px] font-bold hover:bg-indigo-500/20 transition-colors"
                          >
                            🔍 İncele
                          </button>
                        ) : (
                          item.unit && (
                            <button
                              onClick={() => setBulkCompareIndex(idx)}
                              className="px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 text-[10px] font-bold hover:bg-indigo-500/20 transition-colors"
                            >
                              🔍 Karşılaştır ve Onayla
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {item.unit && (
                      <p className="text-[11px] text-muted-foreground mt-1 ml-[34px]">
                        {topicCount} konu · {outcomeCount} kazanım
                      </p>
                    )}

                    {item.unit && item.rawSections && !item.saveResult && (
                      <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-2 items-start">
                        <AiAssistPanel
                          key={`ai-assist-${idx}-${bulkAiPrefill[idx]?.version ?? 0}`}
                          unitTitle={item.unit.unitTitle}
                          contentFramework={item.unit.contentFramework}
                          rawLearningOutcomes={item.rawSections.learningOutcomes}
                          initialPasteValue={bulkAiPrefill[idx]?.text}
                          initiallyOpen
                          onApply={(learningOutcomes) => updateBulkItemUnit(idx, (u) => ({ ...u, learningOutcomes }))}
                        />
                        <AiVerifyPanel
                          unitTitle={item.unit.unitTitle}
                          contentFramework={item.unit.contentFramework}
                          rawLearningOutcomes={item.rawSections.learningOutcomes}
                          currentLearningOutcomes={item.unit.learningOutcomes}
                          initiallyOpen
                        />
                      </div>
                    )}

                    {item.fetchError && <p className="text-xs text-red-600 dark:text-red-400 mt-2">❌ {item.fetchError}</p>}

                    {item.saveResult ? (
                      <p className="text-xs text-muted-foreground mt-1.5 ml-[34px]">
                        ✅ Kaydedildi (ünite #{item.saveResult.unitId}) · {item.saveResult.topicsCreated} yeni konu ·{' '}
                        {item.saveResult.outcomesCreated} yeni kazanım
                        {item.saveResult.outcomesSkipped > 0 && ` · ${item.saveResult.outcomesSkipped} zaten vardı`}
                      </p>
                    ) : (
                      item.saveErr && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 ml-[34px]">❌ {item.saveErr}</p>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Card>
      )}

      {activeTab === 'weeks' && (
      <Card title="Hafta Ata (DOCX/XLSX)">
        <p className="text-xs text-muted-foreground mb-4">
          Yukarıda TYMM&apos;den aktarılmış bir ünitenin konu/kazanımlarına, yüklenen DOCX/XLSX&apos;ten çıkan hafta sırasını atar. Metin benzerliğine değil, konu/kazanım SAYISININ birebir
          eşleşmesine dayanır — sayılar uyuşmazsa hiçbir şey kaydedilmez.
        </p>

        {!rows || rows.length === 0 ? (
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
            ⚠️ Önce yukarıda bir DOCX/XLSX yükleyin — bu araç, kazanımları dosyadan çıkan hafta sırasıyla
            eşleştirdiği için o veriye ihtiyaç duyuyor.
          </p>
        ) : (
        <>
          <div className="mb-3">
            <PickList
              label="Hafta atanacak ünite (yukarıda seçili sınıf/derse ait)"
              items={weekUnits.map((u) => ({ id: u.id, name: u.title }))}
              selectedId={weekUnitId ? Number(weekUnitId) : null}
              onSelect={(id) => setWeekUnitId(String(id))}
              disabled={!lessonId || !gradeId}
              emptyMessage={!lessonId || !gradeId ? 'Önce yukarıda Sınıf ve Ders seçin' : 'Bu sınıf/derste ünite bulunamadı — önce TYMM\'den Aktar ile içe aktarın'}
            />
          </div>

          <div className="mb-4">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Bu ünite DOCX&apos;teki hangi üniteye denk geliyor?</label>
            <div className="flex flex-wrap gap-1.5">
              {uniteler.map((u) => (
                <button
                  key={u}
                  onClick={() => setWeekUniteName(u)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    weekUniteName === u ? 'border-indigo-400 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'border-border text-muted-foreground hover:border-border'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={runWeekPreview}
            disabled={weekPreviewing || !weekUnitId.trim() || !weekUniteName}
            className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {weekPreviewing ? 'Kontrol ediliyor…' : '🔍 Eşleşmeyi Önizle'}
          </button>

          {weekPreviewErr && <p className="text-sm text-red-600 dark:text-red-400 mt-3">❌ {weekPreviewErr}</p>}

          {weekPreview && (
            <div className="mt-4">
              {weekPreview.result.ok && weekPreview.preview ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-3">
                    ✅ Sayılar uyuştu — {weekPreview.preview.length} konu, hazır
                  </p>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {weekPreview.preview.map((t) => (
                      <div key={t.topicId} className="rounded-lg border border-border bg-surface p-2.5">
                        <p className="text-xs font-bold text-foreground">{t.topicTitle}</p>
                        <ul className="mt-1 space-y-0.5">
                          {t.outcomes.map((o) => (
                            <li key={o.id} className="text-[11px] text-muted-foreground">
                              {o.code && <span className="text-indigo-600 dark:text-indigo-300 font-mono">{o.code}) </span>}{o.description}
                              <span className="text-muted-foreground"> — hafta {o.startWeek === o.endWeek ? o.startWeek : `${o.startWeek}-${o.endWeek}`}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={runWeekCommit}
                    disabled={weekCommitting}
                    className="mt-4 px-4 py-2 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {weekCommitting ? 'Kaydediliyor…' : '💾 Haftaları Kaydet'}
                  </button>
                </div>
              ) : !weekPreview.result.ok ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                  <p className="text-sm font-bold text-red-600 dark:text-red-400 mb-2">
                    ❌ Sayılar uyuşmuyor — hiçbir şey kaydedilmedi
                  </p>
                  {weekPreview.result.reason === 'topic-count-mismatch' && (
                    <div className="text-xs text-muted-foreground space-y-2">
                      <p>DB&apos;de {weekPreview.result.tymmCount} konu, DOCX&apos;te {weekPreview.result.docxCount} konu var.</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div><p className="font-bold text-muted-foreground mb-1">DB</p>{weekPreview.result.dbTopicTitles.map((t, i) => <p key={i}>{t}</p>)}</div>
                        <div><p className="font-bold text-muted-foreground mb-1">DOCX</p>{weekPreview.result.docxTitles.map((t, i) => <p key={i}>{t}</p>)}</div>
                      </div>
                    </div>
                  )}
                  {weekPreview.result.reason === 'outcome-count-mismatch' && (
                    <p className="text-xs text-muted-foreground">
                      &quot;{weekPreview.result.dbTopicTitle}&quot; ({weekPreview.result.dbCount} kazanım) ile DOCX&apos;teki
                      &quot;{weekPreview.result.docxTopicTitle}&quot; ({weekPreview.result.docxCount} kazanım) sayıca uyuşmuyor.
                      Muhtemelen DOCX&apos;te bu konuya sınav haftası gibi kazanım-olmayan bir satır karışmış olabilir —
                      yukarıdaki düzenleyiciden kontrol edin.
                    </p>
                  )}
                  {weekPreview.result.reason === 'no-docx-rows' && (
                    <p className="text-xs text-muted-foreground">DOCX&apos;te &quot;{weekPreview.result.uniteName}&quot; adında bir ünite bulunamadı.</p>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {weekCommitErr && <p className="text-sm text-red-600 dark:text-red-400 mt-3">❌ {weekCommitErr}</p>}
          {weekCommitResult && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-3">✅ {weekCommitResult.weeksWritten} hafta kaydı yazıldı</p>
          )}
        </>
        )}
      </Card>
      )}

      {activeTab === 'compare' && (
      <Card title="DB'yi Güncel TYMM ile Kontrol Et">
        <p className="text-xs text-muted-foreground mb-4">
          Yukarıda seçili ders/sınıfın TYMM sayfasındaki TÜM üniteleri canlı çeker ve aynı ders/sınıfın DB&apos;deki
          mevcut ünite/konu/kazanımlarıyla tek seferde kıyaslar. Hiçbir şey yazmaz — sadece hangi ünitelerin/konuların/
          kazanımların TYMM&apos;deki güncel haliyle aynı olmadığını gösterir. Eşleştirme ünite/konu başlığının,
          kazanım ise açıklama metninin birebir aynı olmasına dayanır.
        </p>

        {(!lessonId || !gradeId) && (
          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
            ⚠️ Önce yukarıda Ders ve Sınıf seçin.
          </p>
        )}

        <div className="mb-3">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">TYMM Ders/Sınıf Sayfası URL&apos;i</label>
          <input
            value={comparePageUrl}
            onChange={(e) => setComparePageUrl(e.target.value)}
            placeholder="https://tymm.meb.gov.tr/ogretim-programlari/din-kulturu-ve-ahlak-bilgisi-dersi/6"
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-indigo-400"
          />
        </div>

        <button
          onClick={runCompare}
          disabled={comparing || !comparePageUrl.trim() || !lessonId || !gradeId}
          className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {comparing ? 'Kıyaslanıyor…' : '🔍 Karşılaştır'}
        </button>

        {compareErr && <p className="text-sm text-red-600 dark:text-red-400 mt-3">❌ {compareErr}</p>}

        {compareResult && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <Stat label="TYMM Ünite" value={compareResult.unitsFound} />
              <Stat label="Aynı" value={compareResult.results.filter((r) => r.status === 'same').length} />
              <Stat label="Farklı" value={compareResult.results.filter((r) => r.status === 'changed').length} />
              <Stat
                label="Eşleşmedi"
                value={compareResult.results.filter((r) => r.status === 'tymm-only' || r.status === 'db-only').length}
              />
            </div>

            <div className="flex items-center gap-3">
              {lessonGrades.find((lg) => lg.lesson_id === lessonId && lg.grade_id === gradeId)?.tymm_verified ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  ✅ Doğrulandı
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Henüz doğrulanmadı</span>
              )}
              <button
                onClick={() => patchLessonGrade({ tymmVerified: true })}
                className="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold hover:bg-emerald-500/20 transition-colors"
              >
                ✅ Doğru olarak işaretle
              </button>
            </div>

            {compareResult.fetchErrors.length > 0 && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400">
                {compareResult.fetchErrors.map((e) => (
                  <p key={e.url}>⚠️ &quot;{e.title}&quot; çekilemedi: {e.error}</p>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {compareResult.results.map((r, idx) => (
                <CompareUnitCard
                  key={`${r.tymmUrl}-${r.dbUnitId ?? idx}`}
                  diff={r}
                  expanded={compareExpanded.has(idx)}
                  onToggle={() => toggleCompareExpanded(idx)}
                  onInspect={
                    r.dbUnitId != null && r.tymmUrl
                      ? () => setInspecting({ unitId: r.dbUnitId as number, tymmUrl: r.tymmUrl, unitTitle: r.dbUnitTitle || r.tymmTitle, topicDiffs: r.topics })
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        )}
      </Card>
      )}

      {inspecting && <TymmInspectModal key={inspecting.unitId} target={inspecting} onClose={() => setInspecting(null)} />}

      {comparePreviewOpen && previewUnit && (
        <TymmPreviewCompareModal
          tymmUrl={tymmUrl.trim()}
          unit={previewUnit}
          unmatchedLines={previewUnmatched}
          boundaryWarnings={previewBoundaryWarnings}
          rawSections={previewRawSections}
          topicDiffs={previewTopicDiffs}
          manualOutcomeMerges={manualOutcomeMerges}
          onManualMergeChange={setManualOutcomeMerges}
          unresolvedArchiveCount={importMode === 'update' ? unresolvedArchiveCount : 0}
          archiveReviewConfirmed={archiveReviewConfirmed}
          onArchiveReviewChange={setArchiveReviewConfirmed}
          importMode={importMode}
          onChange={(mutator) => setPreviewUnit((u) => (u ? mutator(u) : u))}
          onClose={() => setComparePreviewOpen(false)}
          saving={saving}
          saveErr={saveErr}
          canSave={!!lessonId && !!gradeId && !needsArchiveReview}
          onSave={async () => {
            const ok = await runTymmSave();
            if (ok) setComparePreviewOpen(false);
          }}
        />
      )}

      {bulkCompareIndex != null && bulkItems?.[bulkCompareIndex]?.unit && (
        <TymmPreviewCompareModal
          tymmUrl={bulkItems[bulkCompareIndex].url}
          unit={bulkItems[bulkCompareIndex].unit as TymmUnit}
          unmatchedLines={bulkItems[bulkCompareIndex].unmatchedLines}
          boundaryWarnings={bulkItems[bulkCompareIndex].boundaryWarnings}
          rawSections={bulkItems[bulkCompareIndex].rawSections}
          onChange={(mutator) => updateBulkItemUnit(bulkCompareIndex, mutator)}
          onClose={() => setBulkCompareIndex(null)}
          saving={bulkItems[bulkCompareIndex].saving}
          saveErr={bulkItems[bulkCompareIndex].saveErr}
          canSave={!!lessonId && !!gradeId}
          onSave={async () => {
            const idx = bulkCompareIndex;
            if (idx == null) return;
            const ok = await saveBulkItem(idx);
            if (ok) setBulkCompareIndex(null);
          }}
        />
      )}
    </div>
  );
}

// ==================== ALT BİLEŞENLER ====================

// TYMM'den çekilmiş bir ünitenin (henüz DB'ye yazılmamış) önizlemesini elle düzeltmeye
// yarar — ufak metin hataları, yanlış ayrıştırılmış bir satır vb. için. `onChange` bir
// mutator alır (mevcut unit'i alıp yenisini döner) ki hem tekli hem toplu moddaki
// bağımsız state'lere aynı bileşen üzerinden yazılabilsin.
function TymmUnitEditor({
  unit,
  unmatchedLines,
  boundaryWarnings,
  rawSections,
  onChange,
}: {
  unit: TymmUnit;
  unmatchedLines: string[];
  boundaryWarnings: string[];
  rawSections: TymmRawSections | null;
  onChange: (mutator: (u: TymmUnit) => TymmUnit) => void;
}) {
  // Varsayılan görünüm SALT OKUNUR ve derli toplu — bir konuyu düzeltmek gerekirse sadece
  // o konunun kalem ikonuna tıklanır, tüm ünite tek seferde düzenlenebilir hâle gelmiyor.
  const [editingTopic, setEditingTopic] = useState<number | null>(null);
  const [editingKeyConcepts, setEditingKeyConcepts] = useState(false);
  // Sürükle-bırakla bir kazanımı başka bir konuya taşırken hangi konu satırının üzerinde
  // olduğumuzu göstermek için (bkz. bileşen sürükleme handle'ı ve Konular listesi drop hedefi).
  const [dragOverTopic, setDragOverTopic] = useState<number | null>(null);

  function moveComponent(fromTopic: number, fromComp: number, toTopic: number) {
    if (fromTopic === toTopic) return;
    onChange((u) => {
      const comp = u.learningOutcomes[fromTopic]?.components[fromComp];
      if (!comp) return u;
      return {
        ...u,
        learningOutcomes: u.learningOutcomes.map((o, i) => {
          if (i === fromTopic) return { ...o, components: o.components.filter((_, j) => j !== fromComp) };
          if (i === toTopic) return { ...o, components: [...o.components, comp] };
          return o;
        }),
      };
    });
  }

  return (
    <div className="space-y-3">
      {boundaryWarnings.length > 0 && (
        <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/10 p-3.5">
          <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1.5">
            ⚠️ Konu/kazanım sınırı TAHMİN edildi — mutlaka kontrol edin
          </p>
          <div className="space-y-1">
            {boundaryWarnings.map((w, i) => (
              <p key={i} className="text-[11px] text-amber-700/90 dark:text-amber-300/90 leading-relaxed">{w}</p>
            ))}
          </div>
          <p className="text-[10px] text-amber-700/70 dark:text-amber-400/70 mt-1.5">
            Aşağıda bir kazanımı yanlış konuda görürseniz, sürükleyip doğru konunun üzerine bırakarak taşıyabilirsiniz —
            ya da altındaki &quot;AI ile Ayrıştır&quot; ile tüm eşleştirmeyi tek seferde yeniden yaptırabilirsiniz.
          </p>
        </div>
      )}

      {rawSections && (
        <AiAssistPanel
          unitTitle={unit.unitTitle}
          contentFramework={unit.contentFramework}
          rawLearningOutcomes={rawSections.learningOutcomes}
          onApply={(learningOutcomes) => onChange((u) => ({ ...u, learningOutcomes }))}
        />
      )}

      {rawSections && (
        <AiVerifyPanel
          unitTitle={unit.unitTitle}
          contentFramework={unit.contentFramework}
          rawLearningOutcomes={rawSections.learningOutcomes}
          currentLearningOutcomes={unit.learningOutcomes}
        />
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Ünite Başlığı</label>
          <input
            value={unit.unitTitle}
            onChange={(e) => { const v = e.target.value; onChange((u) => ({ ...u, unitTitle: v })); }}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-indigo-400"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Ders Saati</label>
          <input
            type="number"
            value={unit.durationHours ?? ''}
            onChange={(e) => { const v = e.target.value ? Number(e.target.value) : null; onChange((u) => ({ ...u, durationHours: v })); }}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-indigo-400"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Anahtar Kavramlar</label>
          <button onClick={() => setEditingKeyConcepts((v) => !v)} className="text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors text-xs" title="Düzenle">
            {editingKeyConcepts ? '✓ Bitti' : '✏️'}
          </button>
        </div>
        {editingKeyConcepts ? (
          <input
            value={unit.keyConcepts.join(', ')}
            onChange={(e) => {
              const list = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
              onChange((u) => ({ ...u, keyConcepts: list }));
            }}
            placeholder="virgülle ayır"
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-indigo-400"
          />
        ) : unit.keyConcepts.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {unit.keyConcepts.map((k, i) => (
              <span key={i} className="px-2 py-1 rounded-md text-[10px] font-semibold bg-muted text-foreground border border-border">{k}</span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground italic">yok</p>
        )}
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Konular ({new Set(unit.learningOutcomes.map((o) => o.topicTitle)).size})
          </label>
          <span className="text-[10px] text-muted-foreground">
            toplam {unit.learningOutcomes.reduce((n, o) => n + o.components.length, 0)} kazanım
          </span>
        </div>
        <ol className="space-y-0.5 rounded-lg border border-border bg-surface p-2">
          {(() => {
            // Bir konuya birden fazla öğrenme çıktısı düşebiliyor (bkz. topic_learning_outcomes
            // notu) — bu listede her benzersiz konu (topicTitle) TEK satır olarak görünmeli,
            // aksi halde admin "4 öğrenme çıktısı" ile "4 konu"yu karıştırıyor (2026-09-20
            // kullanıcı bildirimi: "hala 4 konu diyor" — aslında 3 konu, 4 öğrenme çıktısıydı).
            const groups: { topicTitle: string; indices: number[] }[] = [];
            const groupByTitle = new Map<string, number>();
            unit.learningOutcomes.forEach((o, oi) => {
              const gi = groupByTitle.get(o.topicTitle);
              if (gi == null) {
                groupByTitle.set(o.topicTitle, groups.length);
                groups.push({ topicTitle: o.topicTitle, indices: [oi] });
              } else {
                groups[gi].indices.push(oi);
              }
            });
            return groups.map((g, gi) => {
              const totalComponents = g.indices.reduce((n, i) => n + unit.learningOutcomes[i].components.length, 0);
              const isOpen = g.indices.includes(editingTopic ?? -1);
              const isDragOver = g.indices.includes(dragOverTopic ?? -1);
              return (
                <li
                  key={gi}
                  onDragOver={(e) => { e.preventDefault(); setDragOverTopic(g.indices[0]); }}
                  onDragLeave={() => setDragOverTopic((v) => (g.indices.includes(v ?? -1) ? null : v))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverTopic(null);
                    const raw = e.dataTransfer.getData('application/x-tymm-component');
                    if (!raw) return;
                    try {
                      const { topicIndex, compIndex } = JSON.parse(raw) as { topicIndex: number; compIndex: number };
                      moveComponent(topicIndex, compIndex, g.indices[0]);
                    } catch {
                      // sürüklenen veri bizim formatımızda değil — yoksay
                    }
                  }}
                >
                  <button
                    onClick={() => setEditingTopic(g.indices[0])}
                    className={`w-full text-left text-xs px-1.5 py-1 rounded-md flex items-center gap-1.5 transition-colors ${
                      isDragOver
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-400'
                        : isOpen
                          ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                          : 'text-foreground hover:bg-accent hover:text-indigo-600 dark:hover:text-indigo-300'
                    }`}
                  >
                    <span className="text-muted-foreground font-mono flex-shrink-0">{gi + 1}.</span>
                    <span className="flex-1 truncate">{g.topicTitle || <span className="italic text-muted-foreground">(başlıksız)</span>}</span>
                    {g.indices.length > 1 && (
                      <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                        {g.indices.length} çıktı
                      </span>
                    )}
                    <span
                      className={`flex-shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        totalComponents === 0 ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10' : 'text-muted-foreground bg-muted'
                      }`}
                    >
                      {totalComponents}
                    </span>
                  </button>
                </li>
              );
            });
          })()}
        </ol>
        <p className="text-[10px] text-muted-foreground mt-1">Bir kazanımı taşımak için aşağıda açık konudaki ⠿ tutamacını sürükleyip buradaki hedef konunun üzerine bırakın.</p>
        <button
          onClick={() => {
            const newIndex = unit.learningOutcomes.length;
            onChange((u) => ({
              ...u,
              learningOutcomes: [...u.learningOutcomes, { code: '', title: '', topicTitle: '', components: [] }],
            }));
            setEditingTopic(newIndex);
          }}
          className="mt-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-300 hover:text-indigo-500 dark:hover:text-indigo-200 transition-colors"
        >
          ➕ Konu Ekle
        </button>
      </div>

      <div className="space-y-2">
        {unit.learningOutcomes.map((outcome, oi) => {
          // Bir öncekiyle aynı konuysa (bkz. yukarıdaki Konular listesi grubu), bunun ayrı bir
          // konu değil aynı konunun İKİNCİ öğrenme çıktısı olduğunu belirt — yoksa aynı başlık
          // iki kez üst üste görünüp "iki ayrı konu" izlenimi veriyor.
          const isContinuation = oi > 0 && outcome.topicTitle !== '' && unit.learningOutcomes[oi - 1].topicTitle === outcome.topicTitle;
          const continuationBadge = isContinuation && (
            <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-300 mb-1">
              ↳ &quot;{outcome.topicTitle}&quot; konusunun 2. (veya sonraki) öğrenme çıktısı — ayrı bir konu DEĞİL
            </p>
          );
          return editingTopic === oi ? (
            <div key={oi}>
            {continuationBadge}
            <div className="rounded-lg border border-indigo-400/40 bg-indigo-500/[0.04] p-3">
              <div className="flex items-start gap-2 mb-1.5">
                <div className="flex-1 space-y-1.5">
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Konu Başlığı (İçerik Çerçevesi)</label>
                    <input
                      value={outcome.topicTitle}
                      onChange={(e) => {
                        const v = e.target.value;
                        onChange((u) => ({ ...u, learningOutcomes: u.learningOutcomes.map((o, i) => (i === oi ? { ...o, topicTitle: v } : o)) }));
                      }}
                      className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-xs font-bold text-foreground outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
                      Öğrenme Çıktısı {outcome.code && <span className="font-mono normal-case text-muted-foreground">({outcome.code})</span>}
                    </label>
                    <textarea
                      value={outcome.title}
                      onChange={(e) => {
                        const v = e.target.value;
                        onChange((u) => ({ ...u, learningOutcomes: u.learningOutcomes.map((o, i) => (i === oi ? { ...o, title: v } : o)) }));
                      }}
                      rows={2}
                      className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-indigo-400 resize-y"
                    />
                  </div>
                </div>
                <button
                  onClick={() => {
                    onChange((u) => ({ ...u, learningOutcomes: u.learningOutcomes.filter((_, i) => i !== oi) }));
                    setEditingTopic(null);
                  }}
                  className="flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 transition-colors text-sm mt-4"
                  title="Bu konuyu sil"
                >
                  🗑
                </button>
              </div>
              <div className="space-y-1.5 pl-4 mt-2">
                {outcome.components.map((comp, ci) => (
                  <div key={ci} className="flex items-start gap-1.5">
                    <span
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/x-tymm-component', JSON.stringify({ topicIndex: oi, compIndex: ci }));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      title="Başka bir konuya taşımak için yukarıdaki Konular listesine sürükle"
                      className="flex-shrink-0 text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-300 cursor-grab active:cursor-grabbing select-none mt-1 text-xs"
                    >
                      ⠿
                    </span>
                    <input
                      value={comp.letter}
                      onChange={(e) => {
                        const v = e.target.value;
                        onChange((u) => ({
                          ...u,
                          learningOutcomes: u.learningOutcomes.map((o, i) =>
                            i === oi ? { ...o, components: o.components.map((c, j) => (j === ci ? { ...c, letter: v } : c)) } : o
                          ),
                        }));
                      }}
                      className="w-16 flex-shrink-0 bg-surface border border-border rounded px-1.5 py-1 text-[11px] text-indigo-600 dark:text-indigo-300 font-mono outline-none focus:border-indigo-400 text-center"
                    />
                    <textarea
                      value={comp.text}
                      onChange={(e) => {
                        const v = e.target.value;
                        onChange((u) => ({
                          ...u,
                          learningOutcomes: u.learningOutcomes.map((o, i) =>
                            i === oi ? { ...o, components: o.components.map((c, j) => (j === ci ? { ...c, text: v } : c)) } : o
                          ),
                        }));
                      }}
                      rows={1}
                      className="flex-1 bg-surface border border-border rounded px-2 py-1 text-[11px] text-foreground outline-none focus:border-indigo-400 resize-y"
                    />
                    <button
                      onClick={() =>
                        onChange((u) => ({
                          ...u,
                          learningOutcomes: u.learningOutcomes.map((o, i) =>
                            i === oi ? { ...o, components: o.components.filter((_, j) => j !== ci) } : o
                          ),
                        }))
                      }
                      className="flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 transition-colors text-xs mt-1"
                      title="Bu kazanımı sil"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-0.5">
                  <button
                    onClick={() =>
                      onChange((u) => ({
                        ...u,
                        learningOutcomes: u.learningOutcomes.map((o, i) =>
                          i === oi ? { ...o, components: [...o.components, { letter: '', text: '' }] } : o
                        ),
                      }))
                    }
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300 hover:text-indigo-500 dark:hover:text-indigo-200 transition-colors"
                  >
                    ➕ Kazanım Ekle
                  </button>
                  <button onClick={() => setEditingTopic(null)} className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors ml-auto">
                    ✓ Bitti
                  </button>
                </div>
              </div>
            </div>
            </div>
          ) : (
            <div key={oi}>
            {continuationBadge}
            <div className="group rounded-lg border border-border bg-surface hover:border-border transition-colors p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground">{outcome.topicTitle || <span className="italic text-muted-foreground">(başlıksız)</span>}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {outcome.code && <span className="font-mono text-muted-foreground">{outcome.code}. </span>}
                    {outcome.title}
                  </p>
                </div>
                <button
                  onClick={() => setEditingTopic(oi)}
                  className="flex-shrink-0 text-muted-foreground group-hover:text-foreground hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors text-sm"
                  title="Bu konuyu düzenle"
                >
                  ✏️
                </button>
              </div>
              <ul className="mt-2 space-y-1 pl-1 border-l border-border">
                {outcome.components.map((comp, ci) => (
                  <li key={ci} className="text-[11px] text-foreground leading-relaxed pl-2">
                    <span className="text-indigo-600 dark:text-indigo-300 font-mono">{comp.letter}) </span>
                    {comp.text || <span className="italic text-muted-foreground">(boş)</span>}
                  </li>
                ))}
                {outcome.components.length === 0 && <li className="text-[11px] text-amber-600 dark:text-amber-400/80 italic pl-2">⚠️ kazanım yok</li>}
              </ul>
            </div>
            </div>
          );
        })}
      </div>

      {unmatchedLines.length > 0 && (
        <details>
          <summary className="text-[11px] font-bold text-amber-600 dark:text-amber-400 cursor-pointer">⚠️ {unmatchedLines.length} satır ayrıştırılamadı</summary>
          <div className="mt-1 text-[11px] text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
            {unmatchedLines.map((l, i) => <p key={i}>{l}</p>)}
          </div>
        </details>
      )}
    </div>
  );
}

function buildAiTopicPrompt(unitTitle: string, contentFramework: string[], rawLearningOutcomes: string): string {
  return `Aşağıda bir MEB müfredat ünitesinin "İçerik Çerçevesi" (konu başlıkları) ile "Öğrenme Çıktıları ve Süreç Bileşenleri" (kazanımlar) metni var. Görevin: her öğrenme çıktısını (ve süreç bileşenlerini hiç bölmeden, bütün hâlde) İçerik Çerçevesi'ndeki DOĞRU konuya atamak ve SADECE aşağıdaki JSON formatında, öncesinde/sonrasında hiçbir açıklama veya markdown kod bloğu olmadan döndürmek.

Ünite: ${unitTitle}

İçerik Çerçevesi (konular, bu sırayla — sonu ":" ile biten satırlar bir grup başlığıdır, gerçek konu DEĞİLDİR, atlanmalı):
${contentFramework.map((l, i) => `${i + 1}. ${l}`).join('\n')}

Öğrenme Çıktıları ve Süreç Bileşenleri (ham metin — her paragraf bir öğrenme çıktısı, altındaki a) b) c)... satırları o çıktının süreç bileşenleridir):
${rawLearningOutcomes}

İstenen JSON formatı (düz bir dizi, her eleman BİR öğrenme çıktısı):
[
  {
    "topicTitle": "İçerik Çerçevesi'ndeki birebir konu başlığı (yukarıdaki listeden aynen kopyala)",
    "code": "orijinal kod, ör. MAT.6.1.2 (yoksa boş string)",
    "title": "öğrenme çıktısının kendi cümlesi",
    "components": [ { "letter": "a", "text": "süreç bileşeni metni" } ]
  }
]

Kurallar:
- Bir konuya birden fazla öğrenme çıktısı ait olabilir — aynı topicTitle ile birden fazla obje üret, hepsi o konu altında birleşir.
- ÇIKTI DİZİSİNİN SIRASI, öğrenme çıktılarının ham metindeki ORİJİNAL SIRASIYLA AYNI olmalı — asla yeniden sıralama. Bir konudan bir sonraki konuya geçtikten sonra bir önceki konuya ASLA geri dönme: ör. 5 öğrenme çıktısı 3 konuya dağılıyorsa "1,2 → konu A / 3 → konu B / 4,5 → konu C" gibi ardışık bloklar halinde olmalı — "1,2 → A / 4,5 → C / 3 → B" gibi sırayı bozan, bir konuyu ikiye bölen bir dağılım YANLIŞTIR.
- Her öğrenme çıktısının süreç bileşenlerini (a/b/c...) OLDUĞU GİBİ, bölmeden/birleştirmeden/metnini değiştirmeden components dizisine koy.
- topicTitle mutlaka yukarıdaki İçerik Çerçevesi listesinden BİREBİR bir satır olmalı (grup başlıkları hariç).
- Hiçbir öğrenme çıktısını atlama, hepsini bir konuya ata.
- SADECE JSON döndür.`;
}

type AiTopicJsonItem = { topicTitle: string; code?: string; title?: string; components?: { letter: string; text: string }[] };

// Bazen AI, isteğe rağmen ```json ... ``` kod bloğuna sarıp gönderiyor — kullanıcı ham
// yanıtı olduğu gibi yapıştırabilsin diye burada ayıklıyoruz.
function stripJsonFence(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
}

function parseLearningOutcomesArray(arr: unknown[], errorPrefix = ''): TymmLearningOutcome[] {
  return arr.map((item, i) => {
    const o = item as AiTopicJsonItem;
    if (typeof o.topicTitle !== 'string' || !o.topicTitle.trim()) {
      throw new Error(`${errorPrefix}${i + 1}. öğede geçerli bir "topicTitle" yok.`);
    }
    const components = Array.isArray(o.components)
      ? o.components.map((c) => ({ letter: typeof c.letter === 'string' ? c.letter : '', text: typeof c.text === 'string' ? c.text : '' }))
      : [];
    return { topicTitle: o.topicTitle.trim(), code: typeof o.code === 'string' ? o.code : '', title: typeof o.title === 'string' ? o.title : '', components };
  });
}

// AI'dan istediğimiz "orijinal sırayı bozma" kuralına (bkz. buildAiTopicPrompt) gerçekten
// uyulmuş mu kontrol eder: aynı topicTitle'a ait öğeler HER ZAMAN ardışık olmalı — bir
// konudan ayrılıp başka konuya geçtikten sonra ilk konuya bir daha dönülmüşse (ör. 1,2→A /
// 4,5→C / 3→B gibi) bu, öğrenme çıktısı sırasının bozulduğu ve/veya yanlış konuya
// atandığı anlamına gelir (2026-09-20 kullanıcı isteği: "sıralamayı bozmasın").
function assertLearningOutcomeOrderPreserved(items: TymmLearningOutcome[], errorPrefix = ''): void {
  const seenAndClosed = new Set<string>();
  let currentTitle: string | null = null;
  for (const item of items) {
    if (item.topicTitle === currentTitle) continue;
    if (seenAndClosed.has(item.topicTitle)) {
      throw new Error(
        `${errorPrefix}Öğrenme çıktısı sırası bozulmuş: "${item.topicTitle}" konusuna ait bir öğrenme çıktısı, başka bir konuya geçildikten SONRA tekrar görünüyor. AI'dan orijinal sırayı bozmadan, konuları ardışık bloklar hâlinde döndürmesini iste.`
      );
    }
    if (currentTitle != null) seenAndClosed.add(currentTitle);
    currentTitle = item.topicTitle;
  }
}

// AI'a "bir konuya birden fazla öğrenme çıktısı ait olabilir, aynı topicTitle ile birden
// fazla obje üret" dedirtiyoruz (bkz. buildAiTopicPrompt) — bunlar ARTIK BİRLEŞTİRİLMİYOR:
// her öğrenme çıktısı kendi kod+başlığıyla ayrı bir dizi öğesi olarak kalıyor (aynı topicTitle'ı
// paylaşabilirler), tıpkı tymmParser.ts'nin ürettiği veri gibi — çünkü kaydetme aşamasında
// (importUnit.ts) her öğrenme çıktısı artık kendi topic_learning_outcomes grubuna yazılıyor;
// eskiden burada tek objede birleştirilip (code: "A / B") grup ayrımı kayboluyordu (2026-09-20
// kullanıcı bildirimi). Konu kartlarının ("Konular (N)") sayısını unique topicTitle'a göre
// göstermek gerekiyor, ham dizi uzunluğuna göre değil — bkz. aşağıdaki render.
function parseAiTopicJson(raw: string): TymmLearningOutcome[] {
  const parsed: unknown = JSON.parse(stripJsonFence(raw));
  if (!Array.isArray(parsed)) throw new Error('Kök eleman bir dizi olmalı.');
  const items = parseLearningOutcomesArray(parsed);
  assertLearningOutcomeOrderPreserved(items);
  return items;
}

function buildAiBulkTopicPrompt(
  units: { unitIndex: number; unitTitle: string; contentFramework: string[]; rawLearningOutcomes: string }[]
): string {
  const unitBlocks = units
    .map(
      (u) => `--- ÜNİTE ${u.unitIndex}: ${u.unitTitle} ---
İçerik Çerçevesi (konular, bu sırayla — sonu ":" ile biten satırlar grup başlığıdır, gerçek konu DEĞİLDİR):
${u.contentFramework.map((l, i) => `${i + 1}. ${l}`).join('\n')}

Öğrenme Çıktıları ve Süreç Bileşenleri (ham metin):
${u.rawLearningOutcomes}`
    )
    .join('\n\n');

  return `Aşağıda BİRDEN FAZLA MEB müfredat ünitesinin "İçerik Çerçevesi" ve "Öğrenme Çıktıları ve Süreç Bileşenleri" metni var. Her ünite için AYRI AYRI: her öğrenme çıktısını (ve süreç bileşenlerini hiç bölmeden, bütün hâlde) o ünitenin İçerik Çerçevesi'ndeki DOĞRU konuya ata. SADECE aşağıdaki JSON formatında, öncesinde/sonrasında hiçbir açıklama veya markdown kod bloğu olmadan döndür.

${unitBlocks}

İstenen JSON formatı (düz bir dizi, her eleman BİR ünite, sırası ve unitIndex değerleri yukarıdakiyle AYNI olmalı):
[
  {
    "unitIndex": 1,
    "unitTitle": "ünitenin adı (yukarıdan aynen kopyala)",
    "learningOutcomes": [
      { "topicTitle": "İçerik Çerçevesi'ndeki birebir konu başlığı", "code": "orijinal kod, ör. MAT.6.1.2 (yoksa boş string)", "title": "öğrenme çıktısının kendi cümlesi", "components": [ { "letter": "a", "text": "süreç bileşeni metni" } ] }
    ]
  }
]

Kurallar:
- TÜM üniteler için sonuç üret, hiçbirini atlama.
- Bir konuya birden fazla öğrenme çıktısı ait olabilir — aynı topicTitle ile birden fazla obje üret, hepsi o konu altında birleşir.
- HER ÜNİTE İÇİNDE, learningOutcomes DİZİSİNİN SIRASI ham metindeki ORİJİNAL SIRAYLA AYNI olmalı — asla yeniden sıralama. Bir konudan sonraki konuya geçtikten sonra bir önceki konuya ASLA geri dönme: ör. 5 öğrenme çıktısı 3 konuya dağılıyorsa "1,2 → konu A / 3 → konu B / 4,5 → konu C" gibi ardışık bloklar halinde olmalı — "1,2 → A / 4,5 → C / 3 → B" gibi sırayı bozan, bir konuyu ikiye bölen bir dağılım YANLIŞTIR.
- Her öğrenme çıktısının süreç bileşenlerini (a/b/c...) OLDUĞU GİBİ, bölmeden/birleştirmeden/metnini değiştirmeden components dizisine koy.
- topicTitle mutlaka o ünitenin İçerik Çerçevesi listesinden BİREBİR bir satır olmalı (grup başlıkları hariç).
- unitIndex değerlerini olduğu gibi koru, değiştirme.
- SADECE JSON döndür.`;
}

function parseAiBulkTopicJson(raw: string): { unitIndex: number; learningOutcomes: TymmLearningOutcome[] }[] {
  const parsed: unknown = JSON.parse(stripJsonFence(raw));
  if (!Array.isArray(parsed)) throw new Error('Kök eleman bir dizi olmalı.');
  return parsed.map((item, i) => {
    const o = item as { unitIndex?: number; learningOutcomes?: unknown };
    if (typeof o.unitIndex !== 'number') throw new Error(`${i + 1}. öğede geçerli bir "unitIndex" yok.`);
    if (!Array.isArray(o.learningOutcomes)) throw new Error(`Ünite ${o.unitIndex}: "learningOutcomes" dizisi yok.`);
    const learningOutcomes = parseLearningOutcomesArray(o.learningOutcomes, `Ünite ${o.unitIndex}, `);
    assertLearningOutcomeOrderPreserved(learningOutcomes, `Ünite ${o.unitIndex}: `);
    return { unitIndex: o.unitIndex, learningOutcomes };
  });
}

// Konu/kazanım eşleştirmesi belirsiz kaldığında (bkz. boundaryWarnings) admin İçerik
// Çerçevesi + ham öğrenme çıktısı metnini bir prompt olarak kopyalayıp harici bir AI'ya
// (ChatGPT/Claude) yapıştırabiliyor, AI'ın döndürdüğü JSON'u da buraya yapıştırınca
// unit.learningOutcomes'un TAMAMI o JSON ile değiştiriliyor — API çağrısı YOK, kopyala/
// yapıştır tabanlı, admin her adımı gözden geçirip elle onaylıyor (bkz. proje sohbeti
// 2026-09-20: "ben manuel bunu yapsam ve ai bana ... json formatında verse").
function AiAssistPanel({
  unitTitle,
  contentFramework,
  rawLearningOutcomes,
  onApply,
  initialPasteValue,
  initiallyOpen,
}: {
  unitTitle: string;
  contentFramework: string[];
  rawLearningOutcomes: string;
  onApply: (learningOutcomes: TymmLearningOutcome[]) => void;
  // Toplu "Tüm Üniteleri AI ile Ayrıştır" panelinden bu ünitenin JSON payı doldurulduğunda
  // kullanılır — çağıran taraf bu bileşeni yeni bir `key` ile yeniden monte ederek pasteValue'yu
  // bu başlangıç değerine sıfırlar (bkz. AiBulkAssistPanel altındaki kullanım).
  initialPasteValue?: string;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen ?? false);
  const [copied, setCopied] = useState(false);
  const [pasteValue, setPasteValue] = useState(initialPasteValue ?? '');
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const prompt = buildAiTopicPrompt(unitTitle, contentFramework, rawLearningOutcomes);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setApplyError('Panoya kopyalanamadı — tarayıcı izni engellemiş olabilir.');
    }
  }

  function applyPaste() {
    setApplyError(null);
    setApplied(false);
    try {
      const learningOutcomes = parseAiTopicJson(pasteValue);
      if (learningOutcomes.length === 0) throw new Error('Dizi boş.');
      onApply(learningOutcomes);
      setApplied(true);
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : 'Geçersiz JSON');
    }
  }

  return (
    <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/[0.03]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left"
      >
        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-300">🤖 AI ile Ayrıştır (konu eşleştirmesini yeniden yaptır)</span>
        <span className="text-muted-foreground text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 space-y-2.5">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            1) Aşağıdaki promptu kopyala → 2) ChatGPT/Claude gibi bir AI&apos;ya yapıştır → 3) AI&apos;ın döndürdüğü JSON&apos;u aşağıya
            yapıştırıp uygula. Bu, aşağıdaki tüm konuların/kazanımların yerini AI&apos;ın önerdiği eşleştirmeyle DEĞİŞTİRİR —
            uygulamadan önceki hâl kaybolur, kaydetmeden önce sonucu mutlaka gözden geçir.
          </p>
          <button
            onClick={copyPrompt}
            className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-400 transition-colors"
          >
            {copied ? '✓ Kopyalandı' : '📋 Prompt\'u Kopyala'}
          </button>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">AI&apos;ın döndürdüğü JSON&apos;u buraya yapıştır</label>
            <textarea
              value={pasteValue}
              onChange={(e) => { setPasteValue(e.target.value); setApplied(false); setApplyError(null); }}
              rows={6}
              spellCheck={false}
              placeholder='[ { "topicTitle": "...", "code": "...", "title": "...", "components": [...] } ]'
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs font-mono text-emerald-600 dark:text-emerald-300 resize-y outline-none focus:border-indigo-400"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={applyPaste}
              disabled={!pasteValue.trim()}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ✅ JSON&apos;u Uygula
            </button>
            {applied && <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Uygulandı — aşağıdaki Konular listesini kontrol edin.</span>}
            {applyError && <span className="text-xs text-red-600 dark:text-red-400">❌ {applyError}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function buildAiVerifyPrompt(unitTitle: string, contentFramework: string[], rawLearningOutcomes: string, currentJson: TymmLearningOutcome[]): string {
  return `Aşağıda bir MEB müfredat ünitesinin İçerik Çerçevesi (konu başlıkları), ham Öğrenme Çıktıları ve Süreç Bileşenleri metni, ve BAŞKA BİR AI'nın bunları konulara dağıttığı JSON var. Görevin: bu JSON'daki İÇERİK/ANLAM doğruluğunu denetlemek. Noktalama, yazım, kelime sırası gibi küçük farkları YOK SAY — sadece her öğrenme çıktısının/süreç bileşeninin GERÇEKTEN doğru konu (topicTitle) altına yerleştirilip yerleştirilmediğine bak.

Ünite: ${unitTitle}

İçerik Çerçevesi (konular):
${contentFramework.map((l, i) => `${i + 1}. ${l}`).join('\n')}

Ham Öğrenme Çıktıları ve Süreç Bileşenleri (kaynak metin — doğruluk buna göre ölçülecek):
${rawLearningOutcomes}

Kontrol edilecek JSON (bir başka AI'nın ürettiği, konulara dağıtılmış hâli):
${JSON.stringify(currentJson, null, 2)}

Şunları kontrol et:
1. JSON'daki her component/outcome metni, ham metindeki gerçek içerikle anlamca örtüşüyor mu (uydurulmuş/çarpıtılmış bir şey yok mu)?
2. Her öğrenme çıktısı/süreç bileşeni, İÇERİK olarak GERÇEKTEN atandığı topicTitle'a mı ait, yoksa başka bir konuya mı ait olmalıydı?
3. Ham metinde var olup JSON'da hiç yer almayan (atlanmış) bir öğrenme çıktısı/bileşen var mı?
4. JSON'da olup ham metinde karşılığı bulunmayan (uydurma) bir satır var mı?

SADECE aşağıdaki JSON formatında, başka hiçbir açıklama olmadan yanıt ver:
{
  "allCorrect": true veya false,
  "issues": [
    { "topicTitle": "JSON'daki mevcut (yanlış olduğunu düşündüğün) konu başlığı", "code": "ilgili öğrenme çıktısı/bileşen kodu (varsa, yoksa boş)", "text": "sorunlu metnin kendisi", "problem": "kısa açıklama, ör: bu aslında X konusuna ait, Y'ye değil", "suggestedTopicTitle": "doğru olması gereken konu başlığı (varsa)" }
  ]
}
Sorun yoksa "issues" boş dizi ve "allCorrect": true olsun.`;
}

type AiVerifyIssue = { topicTitle: string; code?: string; text?: string; problem: string; suggestedTopicTitle?: string };
type AiVerifyResult = { allCorrect: boolean; issues: AiVerifyIssue[] };

function parseAiVerifyJson(raw: string): AiVerifyResult {
  const parsed = JSON.parse(stripJsonFence(raw)) as { allCorrect?: unknown; issues?: unknown };
  if (typeof parsed.allCorrect !== 'boolean') throw new Error('"allCorrect" (true/false) alanı yok.');
  if (!Array.isArray(parsed.issues)) throw new Error('"issues" dizisi yok.');
  const issues = parsed.issues.map((item, i) => {
    const o = item as AiVerifyIssue;
    if (typeof o.topicTitle !== 'string' || typeof o.problem !== 'string') {
      throw new Error(`${i + 1}. sorunda "topicTitle" veya "problem" eksik.`);
    }
    return {
      topicTitle: o.topicTitle,
      code: typeof o.code === 'string' ? o.code : undefined,
      text: typeof o.text === 'string' ? o.text : undefined,
      problem: o.problem,
      suggestedTopicTitle: typeof o.suggestedTopicTitle === 'string' ? o.suggestedTopicTitle : undefined,
    };
  });
  return { allCorrect: parsed.allCorrect, issues };
}

// İlk AI'nın (veya elle) yaptığı konu/kazanım eşleştirmesinin İÇERİK olarak doğru olup
// olmadığını, BAĞIMSIZ bir ikinci AI'ya kontrol ettiren panel — kopyala/yapıştır tabanlı,
// aynı AiAssistPanel gibi API çağrısı yapmıyor. Sonuç OTOMATİK uygulanmıyor: "issues"
// listesi sadece raporlanıyor, admin sürükle-bırakla (bkz. moveComponent) kendi elleriyle
// düzeltiyor — bir metin eşleştirmesiyle otomatik taşımak (component metnini issue.text ile
// eşleştirip bulmaya çalışmak) yanlış eşleşme riski taşır, bu yüzden bilerek insan onayına
// bırakıldı (bkz. proje sohbeti 2026-09-20: "bu 2. ai bu verileri kontrol etsin").
function AiVerifyPanel({
  unitTitle,
  contentFramework,
  rawLearningOutcomes,
  currentLearningOutcomes,
  initiallyOpen,
}: {
  unitTitle: string;
  contentFramework: string[];
  rawLearningOutcomes: string;
  currentLearningOutcomes: TymmLearningOutcome[];
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen ?? false);
  const [copied, setCopied] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [checkError, setCheckError] = useState<string | null>(null);
  const [result, setResult] = useState<AiVerifyResult | null>(null);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(buildAiVerifyPrompt(unitTitle, contentFramework, rawLearningOutcomes, currentLearningOutcomes));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCheckError('Panoya kopyalanamadı — tarayıcı izni engellemiş olabilir.');
    }
  }

  function checkPaste() {
    setCheckError(null);
    setResult(null);
    try {
      setResult(parseAiVerifyJson(pasteValue));
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : 'Geçersiz JSON');
    }
  }

  return (
    <div className="rounded-xl border border-purple-400/30 bg-purple-500/[0.03]">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left">
        <span className="text-xs font-bold text-purple-600 dark:text-purple-300">🔎 Eşleştirmeyi Başka Bir AI&apos;ya Doğrulat</span>
        <span className="text-muted-foreground text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 space-y-2.5">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Aşağıdaki AN durumun (şu an bu ünitede görünen konu/kazanım eşleştirmesinin) tamamını, ham metinle birlikte bir
            promptta paketler. Bunu FARKLI bir AI&apos;ya (ilk eşleştirmeyi yapandan tercihen farklı bir modele) yapıştırıp
            yanıtı geri yapıştırın — sadece yazım/noktalama değil, İÇERİK olarak yanlış yere konmuş bir kazanım varsa bulur.
            Sonuç otomatik uygulanmaz; sorun bulunursa aşağıda listelenir, siz sürükle-bırakla düzeltirsiniz.
          </p>
          <button onClick={copyPrompt} className="px-3 py-1.5 rounded-lg bg-purple-500 text-white text-xs font-bold hover:bg-purple-400 transition-colors">
            {copied ? '✓ Kopyalandı' : '📋 Doğrulama Promptu\'nu Kopyala'}
          </button>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">AI&apos;ın döndürdüğü JSON&apos;u buraya yapıştır</label>
            <textarea
              value={pasteValue}
              onChange={(e) => { setPasteValue(e.target.value); setResult(null); setCheckError(null); }}
              rows={6}
              spellCheck={false}
              placeholder='{ "allCorrect": true, "issues": [] }'
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs font-mono text-emerald-600 dark:text-emerald-300 resize-y outline-none focus:border-indigo-400"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={checkPaste}
              disabled={!pasteValue.trim()}
              className="px-3 py-1.5 rounded-lg bg-purple-500 text-white text-xs font-bold hover:bg-purple-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              🔍 Sonucu Göster
            </button>
            {checkError && <span className="text-xs text-red-600 dark:text-red-400">❌ {checkError}</span>}
          </div>

          {result && (
            result.allCorrect && result.issues.length === 0 ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">✅ İkinci AI eşleştirmede sorun bulmadı.</p>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-red-500/40 bg-red-500/5 p-3">
                <p className="text-xs font-black text-red-700 dark:text-red-400 uppercase tracking-wide mb-1.5">
                  ⚠️ {result.issues.length} sorun bulundu — sürükle-bırakla düzeltin
                </p>
                <div className="space-y-2">
                  {result.issues.map((issue, i) => (
                    <div key={i} className="rounded-md bg-surface border border-border p-2 text-[11px]">
                      <p className="text-foreground">
                        {issue.code && <span className="font-mono text-muted-foreground">{issue.code}) </span>}
                        {issue.text || <span className="italic text-muted-foreground">(metin belirtilmedi)</span>}
                      </p>
                      <p className="text-muted-foreground mt-0.5">
                        şu an: <span className="font-semibold text-foreground">{issue.topicTitle}</span>
                        {issue.suggestedTopicTitle && (
                          <> → olması gereken: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{issue.suggestedTopicTitle}</span></>
                        )}
                      </p>
                      <p className="text-muted-foreground/80 mt-0.5 italic">{issue.problem}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// Toplu moddaki (Ders/Sınıf Sayfası) AiAssistPanel karşılığı — tek ünite yerine bulkItems'taki
// TÜM üniteleri (İçerik Çerçevesi + ham öğrenme çıktısı) tek bir promptta birleştirip AI'ya
// tek seferde verdiriyor, dönen JSON'daki her ünite kendi unitIndex'i üzerinden ilgili
// bulkItem'a uygulanıyor (bkz. proje sohbeti 2026-09-20: "tek tek karşılaştır ve onayla
// diyerek değil de ... tüm üniteleri ... tek seferde alıp ai ye versem"). Kaydetme burada
// yapılmaz — admin her ünitenin sonucunu yine "🔍 Karşılaştır ve Onayla" ile tek tek açıp
// kontrol ettikten sonra kaydeder.
function AiBulkAssistPanel({
  items,
  onFillOne,
}: {
  items: { bulkIndex: number; unitTitle: string; contentFramework: string[]; rawLearningOutcomes: string }[];
  // Bulk JSON'u doğrudan unit state'ine YAZMIYOR — her ünitenin KENDİ AiAssistPanel'indeki
  // JSON kutusunu, o ünitenin payına düşen metinle dolduruyor (bkz. proje sohbeti 2026-09-20:
  // "istediğim şey tek tek ünitelerin json alanının dolması"). Admin sonra her ünitenin
  // kendi "✅ JSON'u Uygula" düğmesine basarak, tek tek elle yapıştırmış gibi onaylıyor —
  // hiçbir şey görünmeden/gözden geçirilmeden değişmiyor.
  onFillOne: (bulkIndex: number, jsonText: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [fillError, setFillError] = useState<string | null>(null);
  const [fillSummary, setFillSummary] = useState<string | null>(null);

  const prompt = buildAiBulkTopicPrompt(
    items.map((it, i) => ({ unitIndex: i + 1, unitTitle: it.unitTitle, contentFramework: it.contentFramework, rawLearningOutcomes: it.rawLearningOutcomes }))
  );

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setFillError('Panoya kopyalanamadı — tarayıcı izni engellemiş olabilir.');
    }
  }

  function fillFields() {
    setFillError(null);
    setFillSummary(null);
    try {
      const results = parseAiBulkTopicJson(pasteValue);
      let filled = 0;
      for (const r of results) {
        const item = items[r.unitIndex - 1];
        if (!item) continue;
        onFillOne(item.bulkIndex, JSON.stringify(r.learningOutcomes, null, 2));
        filled += 1;
      }
      if (filled === 0) throw new Error('Hiçbir unitIndex eşleşmedi — prompt sırasını/numaralarını değiştirmediğinizden emin olun.');
      setFillSummary(`${filled}/${items.length} ünitenin JSON kutusu dolduruldu — aşağıda her birini açıp "JSON'u Uygula"ya basarak onaylayın.`);
    } catch (e) {
      setFillError(e instanceof Error ? e.message : 'Geçersiz JSON');
    }
  }

  return (
    <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/[0.03]">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left">
        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-300">🤖 Tüm Üniteleri AI ile Ayrıştır ({items.length} ünite)</span>
        <span className="text-muted-foreground text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 space-y-2.5">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            1) Promptu kopyala ({items.length} ünitenin TAMAMINI içerir) → 2) ChatGPT/Claude gibi bir AI&apos;ya yapıştır → 3) dönen
            JSON&apos;u aşağıya yapıştırıp doldur. Bu HİÇBİR ŞEYİ doğrudan kaydetmez — sadece aşağıdaki her ünite kartının kendi
            &quot;AI ile Ayrıştır&quot; kutusuna, o ünitenin payını yazar; siz her birini tek tek açıp kontrol edip kendi
            &quot;JSON&apos;u Uygula&quot; düğmesine basarsınız.
          </p>
          <button onClick={copyPrompt} className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-400 transition-colors">
            {copied ? '✓ Kopyalandı' : `📋 Prompt'u Kopyala (${items.length} ünite)`}
          </button>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">AI&apos;ın döndürdüğü JSON&apos;u buraya yapıştır</label>
            <textarea
              value={pasteValue}
              onChange={(e) => { setPasteValue(e.target.value); setFillSummary(null); setFillError(null); }}
              rows={6}
              spellCheck={false}
              placeholder='[ { "unitIndex": 1, "unitTitle": "...", "learningOutcomes": [...] } ]'
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs font-mono text-emerald-600 dark:text-emerald-300 resize-y outline-none focus:border-indigo-400"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fillFields}
              disabled={!pasteValue.trim()}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ⬇️ Ünitelerin JSON Kutularını Doldur
            </button>
            {fillSummary && <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{fillSummary}</span>}
            {fillError && <span className="text-xs text-red-600 dark:text-red-400">❌ {fillError}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// Solda içerik (DB'deki kayıt ya da henüz kaydedilmemiş önizleme), sağda gerçek TYMM
// sayfası — admin kafasından karşılaştırmak yerine ikisini yan yana görüp öyle
// onaylayabilsin diye (bkz. proje sohbeti: "kafamdan kontrol edemem").
function SplitCompareView({
  title,
  tymmUrl,
  onClose,
  left,
  right,
}: {
  title: string;
  tymmUrl: string;
  onClose: () => void;
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full h-full max-w-[1400px] flex flex-col sm:flex-row overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full sm:w-1/2 h-1/2 sm:h-full overflow-y-auto p-5 border-b sm:border-b-0 sm:border-r border-border">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h3 className="text-sm font-bold text-foreground truncate">{title}</h3>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-lg leading-none"
            >
              ✕
            </button>
          </div>
          {left}
        </div>

        <div className="w-full sm:w-1/2 h-1/2 sm:h-full overflow-y-auto p-5">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h3 className="text-sm font-bold text-muted-foreground">TYMM&apos;den çekilen bölümler</h3>
            <a href={tymmUrl} target="_blank" rel="noreferrer" className="flex-shrink-0 text-[11px] text-indigo-600 dark:text-indigo-300 hover:text-indigo-500 dark:hover:text-indigo-200">
              Tam sayfayı aç ↗
            </a>
          </div>
          {right}
        </div>
      </div>
    </div>
  );
}

// Canlı TYMM sayfasının TAMAMI yerine sadece bizim çektiğimiz üç alanı düz metin olarak
// gösterir — admin sayfada gezinip ilgili yeri aramak zorunda kalmasın diye (bkz. proje
// sohbeti: "ekran görüntüsü gibi ama sadece çektiğimiz bölümler"). Stil önemli değil,
// okunabilir olması yeterli.
function TymmRawSectionsView({ rawSections }: { rawSections: TymmRawSections | null }) {
  if (!rawSections) return <p className="text-xs text-muted-foreground">Yükleniyor…</p>;
  const sections: { label: string; value: string }[] = [
    { label: 'İçerik Çerçevesi', value: rawSections.contentFramework },
    { label: 'Anahtar Kavramlar', value: rawSections.keyConcepts },
    { label: 'Öğrenme Çıktıları ve Süreç Bileşenleri', value: rawSections.learningOutcomes },
  ];
  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <div key={s.label}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{s.label}</p>
          <div className="rounded-lg border border-border bg-surface p-3 text-[11px] text-foreground leading-relaxed whitespace-pre-wrap">
            {s.value || <span className="italic text-muted-foreground">bulunamadı</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// KAYDETMEDEN ÖNCE karşılaştırma: sol tarafta düzenlenebilir önizleme (TymmUnitEditor),
// sağda TYMM'den çektiğimiz ham bölümler — admin düzeltmeleri doğrudan burada, kaynağa
// bakarak yapabilir.
// Kaydetmeden ÖNCE gösterilen özet kart — hangi konuların aktarılacağını ve her birinde
// saveTymmUnit'in ne yapacağını (aynı kalacak / yeni / arşivlenecek) tek bakışta gösterir.
// Sayılar API'den (bkz. app/api/admin/tymm/fetch/route.ts → buildTopicDiffs) geliyor, o da
// saveTymmUnit ile AYNI (topic_id, description) eşleşme kuralını kullanıyor — burası ayrı
// bir hesap YAPMIYOR, sadece gösteriyor.
function TymmSaveDiffSummary({
  topicDiffs,
  manualOutcomeMerges,
  onManualMergeChange,
}: {
  topicDiffs: TymmTopicDiff[];
  manualOutcomeMerges: Record<string, number>;
  onManualMergeChange?: (next: Record<string, number>) => void;
}) {
  const totalToArchive = topicDiffs.reduce((n, d) => n + d.toArchive, 0);

  function setMerge(newDescription: string, oldOutcomeId: number | null) {
    if (!onManualMergeChange) return;
    const next = { ...manualOutcomeMerges };
    if (oldOutcomeId == null) delete next[newDescription];
    else next[newDescription] = oldOutcomeId;
    onManualMergeChange(next);
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3.5 mb-3">
      <p className="text-[11px] font-black text-foreground uppercase tracking-wide mb-2">
        📋 {topicDiffs.length} konu aktarılacak
        {totalToArchive > 0 && (
          <span className="ml-1.5 text-amber-600 dark:text-amber-400">— {totalToArchive} kazanım arşivlenecek, kontrol edin</span>
        )}
      </p>
      <ul className="space-y-2">
        {topicDiffs.map((d) => (
          <li key={d.topicTitle} className="text-[11px] leading-relaxed">
            <span className="font-semibold text-foreground">{d.topicTitle}</span>
            {' — '}
            {!d.topicExists ? (
              <span className="text-indigo-600 dark:text-indigo-300 font-semibold">Yeni konu</span>
            ) : (
              <>
                {d.unchanged > 0 && <span className="text-muted-foreground">{d.unchanged} kazanım aynı kalacak</span>}
                {d.unchanged > 0 && (d.new > 0 || d.toArchive > 0) && <span className="text-muted-foreground"> · </span>}
                {d.new > 0 && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{d.new} yeni</span>}
                {d.new > 0 && d.toArchive > 0 && <span className="text-muted-foreground"> · </span>}
                {d.toArchive > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">{d.toArchive} arşivlenecek</span>
                )}
                {d.unchanged === 0 && d.new === 0 && d.toArchive === 0 && (
                  <span className="text-muted-foreground">değişiklik yok</span>
                )}
              </>
            )}

            {/* Ham metin karşılaştırması: hem yeni (TYMM) hem eski (DB) kazanımların TAM metnini
                yan yana gösteriyoruz — kırpılmış/gizli hiçbir şey yok, admin 1-2 kelimelik farkı
                gözle görebilsin diye (kullanıcının 2026-09-22 ısrarı: "nereden karşılaştıracam"). */}
            {d.topicExists && (d.newDescriptions.length > 0 || d.toArchiveOutcomes.length > 0) && (
              <div className="mt-2 ml-3 space-y-2.5">
                {d.newDescriptions.length > 0 && d.toArchiveOutcomes.length > 0 && onManualMergeChange && (
                  <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
                    <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      Bunlardan biri eski bir kazanımın güncellenmiş hali olabilir — TAM metinleri karşılaştır ve eşleştir:
                    </p>
                    {d.newDescriptions.map((desc) => {
                      const mergedId = manualOutcomeMerges[desc];
                      const mergedOld = mergedId != null ? d.toArchiveOutcomes.find((o) => o.id === mergedId) : null;
                      return (
                        <div key={desc} className="rounded-md border border-border bg-background p-2 space-y-1.5">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400">TYMM&apos;den yeni</p>
                            <p className="text-foreground">{desc}</p>
                          </div>
                          <select
                            value={mergedId ?? ''}
                            onChange={(e) => setMerge(desc, e.target.value ? Number(e.target.value) : null)}
                            className="w-full rounded border border-border bg-surface px-1.5 py-1 text-[10px] text-foreground"
                          >
                            <option value="">— Eşleşme yok, yeni kazanım olarak ekle</option>
                            {d.toArchiveOutcomes.map((o) => (
                              <option key={o.id} value={o.id}>
                                DB&apos;deki #{o.id} ile eşleştir (güncelle)
                              </option>
                            ))}
                          </select>
                          {mergedOld && (
                            <div className="rounded bg-amber-500/10 p-1.5">
                              <p className="text-[9px] font-black uppercase tracking-wide text-amber-700 dark:text-amber-300">
                                Eşleştirdiğin DB&apos;deki eski metin
                              </p>
                              <p className="text-foreground/80">{mergedOld.description}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {d.newDescriptions.length > 0 && (d.toArchiveOutcomes.length === 0 || !onManualMergeChange) && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Yeni eklenecek kazanımlar</p>
                    {d.newDescriptions.map((desc) => (
                      <p key={desc} className="text-foreground/80">{desc}</p>
                    ))}
                  </div>
                )}
                {(() => {
                  const mergedIds = new Set(Object.values(manualOutcomeMerges));
                  const unmatched = d.toArchiveOutcomes.filter((o) => !mergedIds.has(o.id));
                  if (!unmatched.length) return null;
                  return (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2 space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-wide text-red-700 dark:text-red-300">
                        Hiçbir yeniyle eşleştirilmedi — arşivlenecek (DB&apos;deki tam metin)
                      </p>
                      {unmatched.map((o) => (
                        <p key={o.id} className="text-foreground/80">{o.description}</p>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TymmPreviewCompareModal({
  tymmUrl,
  unit,
  unmatchedLines,
  boundaryWarnings,
  rawSections,
  topicDiffs,
  manualOutcomeMerges,
  onManualMergeChange,
  unresolvedArchiveCount,
  archiveReviewConfirmed,
  onArchiveReviewChange,
  importMode,
  onChange,
  onClose,
  saving,
  saveErr,
  canSave,
  onSave,
}: {
  tymmUrl: string;
  unit: TymmUnit;
  unmatchedLines: string[];
  boundaryWarnings: string[];
  rawSections: TymmRawSections | null;
  topicDiffs?: TymmTopicDiff[];
  manualOutcomeMerges?: Record<string, number>;
  onManualMergeChange?: (next: Record<string, number>) => void;
  unresolvedArchiveCount?: number;
  archiveReviewConfirmed?: boolean;
  onArchiveReviewChange?: (v: boolean) => void;
  importMode?: 'new' | 'update' | null;
  onChange: (mutator: (u: TymmUnit) => TymmUnit) => void;
  onClose: () => void;
  saving: boolean;
  saveErr: string | null;
  canSave: boolean;
  onSave: () => void;
}) {
  // "Eskisini Güncelle" GERÇEKTEN 2 aşamalı: önce SADECE karşılaştırma (kaydetme butonu
  // görünmez bile), admin "İncelemeyi Bitirdim" deyip geçmeden kaydetme adımına ulaşamaz.
  // "Yeni Ekle"de karşılaştıracak eski bir şey olmadığı için tek adım yeterli (kullanıcının
  // 2026-09-22 ısrarı: "onayla ve kaydet yerine önce db ile karşılaştır butonu olsa").
  const [step, setStep] = useState<'compare' | 'save'>(importMode === 'update' ? 'compare' : 'save');
  const readyToProceed = !unresolvedArchiveCount || archiveReviewConfirmed;

  return (
    <SplitCompareView
      title={`${unit.unitTitle} — ${step === 'compare' ? 'DB ile Karşılaştır' : 'Onayla ve Kaydet'}`}
      tymmUrl={tymmUrl}
      onClose={onClose}
      left={
        <>
          {topicDiffs && topicDiffs.length > 0 && (
            <TymmSaveDiffSummary topicDiffs={topicDiffs} manualOutcomeMerges={manualOutcomeMerges || {}} onManualMergeChange={onManualMergeChange} />
          )}

          {step === 'compare' ? (
            <>
              <TymmUnitEditor unit={unit} unmatchedLines={unmatchedLines} boundaryWarnings={boundaryWarnings} rawSections={rawSections} onChange={onChange} />
              {!!unresolvedArchiveCount && onArchiveReviewChange && (
                <label className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!archiveReviewConfirmed}
                    onChange={(e) => onArchiveReviewChange(e.target.checked)}
                    className="mt-0.5 accent-amber-500"
                  />
                  <span>
                    <strong>{unresolvedArchiveCount} kazanım arşivlenecek</strong> (yukarıda eşleştirilmemiş olanlar) — bunların gerçekten
                    farklı/eski kazanımlar olduğunu, birer kelime farkıyla aynı kazanım olmadığını yukarıdaki tam metinlerden kontrol ettim.
                  </span>
                </label>
              )}
              <button
                onClick={() => setStep('save')}
                disabled={!readyToProceed}
                className="mt-4 px-4 py-2 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                İncelemeyi Bitirdim, Kaydetmeye Geç →
              </button>
            </>
          ) : (
            <>
              {importMode === 'update' && (
                <button onClick={() => setStep('compare')} className="mb-3 text-[11px] font-bold text-indigo-600 dark:text-indigo-300 hover:underline">
                  ← Karşılaştırmaya dön
                </button>
              )}
              <p className="text-[11px] text-muted-foreground mb-3">
                {unit.unitTitle} — {new Set(unit.learningOutcomes.map((o) => o.topicTitle)).size} konu ·{' '}
                {unit.learningOutcomes.reduce((n, o) => n + o.components.length, 0)} kazanım DB&apos;ye yazılacak.
              </p>
              {!canSave && !unresolvedArchiveCount && (
                <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
                  ⚠️ Kaydetmeden önce Sınıf ve Ders seçin.
                </p>
              )}
              {saveErr && <p className="text-sm text-red-600 dark:text-red-400 mb-3">❌ {saveErr}</p>}
              <button
                onClick={onSave}
                disabled={saving || !canSave}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {saving ? 'Kaydediliyor…' : '✅ Onayla ve Kaydet'}
              </button>
            </>
          )}
        </>
      }
      right={<TymmRawSectionsView rawSections={rawSections} />}
    />
  );
}

// KAYDEDİLDİKTEN SONRA kontrol: sol tarafta DB'deki güncel hâli (salt okunur), sağda
// TYMM'den çektiğimiz ham bölümler (canlı sayfadan taze çekilir).
function TymmInspectModal({ target, onClose }: { target: InspectTarget; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UnitContentResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rawSections, setRawSections] = useState<TymmRawSections | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/admin/tymm/unit-content?unitId=${target.unitId}`).then(async (res) => ({ ok: res.ok, data: await res.json() })),
      fetch('/api/admin/tymm/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tymmUrl: target.tymmUrl }),
      }).then(async (res) => ({ ok: res.ok, data: await res.json() })),
    ])
      .then(([content, fetched]) => {
        if (cancelled) return;
        if (!content.ok) { setErr(content.data?.error || 'Yüklenemedi'); return; }
        setData(content.data as UnitContentResponse);
        if (fetched.ok) setRawSections(fetched.data.rawSections as TymmRawSections);
      })
      .catch(() => { if (!cancelled) setErr('İstek başarısız (ağ hatası)'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [target.unitId, target.tymmUrl]);

  return (
    <SplitCompareView
      title={`${target.unitTitle} — DB'deki İçerik`}
      tymmUrl={target.tymmUrl}
      onClose={onClose}
      right={<TymmRawSectionsView rawSections={rawSections} />}
      left={
        <>
          {loading && <p className="text-xs text-muted-foreground">Yükleniyor…</p>}
          {err && <p className="text-xs text-red-600 dark:text-red-400">❌ {err}</p>}
          {data && (
            <div className="space-y-3">
              {data.unit.key_concepts && data.unit.key_concepts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {data.unit.key_concepts.map((k) => (
                    <span key={k} className="px-2 py-1 rounded-md text-[10px] font-semibold bg-muted text-foreground border border-border">{k}</span>
                  ))}
                </div>
              )}
              {data.topics.map((t, ti) => {
                const topicDiff = target.topicDiffs?.find((td) => td.dbTopicId === t.id) || null;
                const mismatchedIds = new Set((topicDiff?.outcomesRemoved || []).map((o) => o.id));
                const overriddenIds = new Set((topicDiff?.outcomesOverridden || []).map((o) => o.id));

                const renderOutcome = (o: { id: number; code: string | null; description: string }) => {
                  if (!topicDiff) {
                    return (
                      <li key={o.id} className="text-[11px] text-muted-foreground pl-2">
                        {o.code && <span className="text-indigo-600 dark:text-indigo-300 font-mono">{o.code}) </span>}{o.description}
                      </li>
                    );
                  }
                  if (overriddenIds.has(o.id)) {
                    return (
                      <li key={o.id} className="pl-2">
                        <OverriddenOutcomeRow outcome={o} />
                      </li>
                    );
                  }
                  if (!mismatchedIds.has(o.id)) {
                    return (
                      <li key={o.id} className="text-[11px] text-emerald-600 dark:text-emerald-400 pl-2">
                        ✓ {o.code && <span className="font-mono">{o.code}) </span>}{o.description}
                      </li>
                    );
                  }
                  return (
                    <li key={o.id} className="pl-2">
                      <EditableOutcomeRow outcome={o} tymmTexts={topicDiff.tymmOutcomeTexts} />
                    </li>
                  );
                };

                return (
                <div key={t.id} className="rounded-lg border border-border bg-surface p-3">
                  <p className="text-xs font-bold text-foreground">
                    <span className="text-muted-foreground font-mono">{ti + 1}.</span> {t.title}
                  </p>
                  {t.learningOutcomeGroups.length === 0 && t.learningOutcome && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 mb-1.5">{t.learningOutcome}</p>
                  )}
                  {topicDiff?.learningOutcomeChanged && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-1.5">✏️ Öğrenme çıktısı metni TYMM&apos;de farklı.</p>
                  )}
                  {t.learningOutcomeGroups.length > 0 ? (
                    <div className="space-y-2 mt-1.5">
                      {t.learningOutcomeGroups.map((g) => (
                        <div key={g.id} className="pl-2 border-l border-border">
                          <p className="text-[11px] font-semibold text-foreground">
                            {g.code && <span className="font-mono text-indigo-600 dark:text-indigo-300">{g.code}. </span>}
                            {g.title}
                          </p>
                          <ul className="space-y-1 mt-1 pl-2 border-l border-border">{g.outcomes.map(renderOutcome)}</ul>
                        </div>
                      ))}
                      {t.ungroupedOutcomes.length > 0 && (
                        <ul className="space-y-1 pl-2 border-l border-border">{t.ungroupedOutcomes.map(renderOutcome)}</ul>
                      )}
                    </div>
                  ) : (
                    <ul className="space-y-1 mt-1.5 border-l border-border">
                      {t.outcomes.map(renderOutcome)}
                      {t.outcomes.length === 0 && <li className="text-[11px] text-amber-600 dark:text-amber-400/80 italic pl-2">⚠️ kazanım yok</li>}
                    </ul>
                  )}
                  <MoveTopicOutcomesButton
                    sourceTopicId={t.id}
                    siblingTopics={data.topics.filter((x) => x.id !== t.id).map((x) => ({ id: x.id, title: x.title }))}
                  />
                </div>
                );
              })}
            </div>
          )}
        </>
      }
    />
  );
}

function TabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex gap-1.5 p-1 rounded-xl bg-muted border border-border overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onSelect(t.key)}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
            active === t.key
              ? 'bg-card text-indigo-600 dark:text-indigo-300 shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 sm:p-6">
      <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted rounded-xl border border-border p-3 text-center">
      <div className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

const COMPARE_STATUS_STYLE: Record<CompareUnitDiff['status'], { badge: string; label: string; border: string }> = {
  same: { badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', label: '✅ Aynı', border: 'border-border' },
  changed: { badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', label: '⚠️ Farklı', border: 'border-amber-500/20' },
  'tymm-only': { badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/20', label: '🆕 TYMM’de var, DB’de yok', border: 'border-indigo-500/20' },
  'db-only': { badge: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', label: '❌ DB’de var, TYMM’de yok', border: 'border-red-500/20' },
};

// DB'de olup TYMM'de karşılığı bulunamayan bir kazanım — admin burada DOĞRUDAN metni
// düzenleyip kaydedebilir (kullanıcının 2026-09-20 isteği: "karşılaştırıp manuel düzenleme
// yapabileceğim bi sayfa"). Kaydettikten SONRA yeni metni tymmTexts ile CANLI karşılaştırıp
// gerçekten eşleşiyor mu diye kontrol ediyoruz — kör bir şekilde "✓ Güncellendi" gösterip
// yanlış bir onay hissi vermek yerine (kullanıcının 2026-09-20 raporu: "kaydet dediğimde
// otomatik yeşil oluyor halbuki saçma sapan bişey yazdım"). Metin gerçekten eşleşmiyorsa
// (ör. TYMM'in ifadesi kasıtlı olarak farklı ama admin içerik olarak doğru buluyorsa) "✓
// Doğru Kabul Et" ile kalıcı olarak override edilebilir.
function EditableOutcomeRow({ outcome, tymmTexts }: { outcome: { id: number; code: string | null; description: string }; tymmTexts: string[] }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(outcome.description);
  const [saving, setSaving] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [result, setResult] = useState<'matched' | 'mismatched' | 'overridden' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!value.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/manage/outcomes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [outcome.id], patch: { description: value.trim() } }),
      });
      if (!res.ok) { setError('Kaydedilemedi'); return; }
      setEditing(false);
      const matches = tymmTexts.some((t) => tymmNorm(t) === tymmNorm(value.trim()));
      setResult(matches ? 'matched' : 'mismatched');
    } finally {
      setSaving(false);
    }
  }

  async function handleOverride() {
    setOverriding(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/tymm/outcome-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcomeId: outcome.id, tymmText: tymmTexts.join(' | ') }),
      });
      if (!res.ok) { setError('İşaretlenemedi'); return; }
      setResult('overridden');
    } finally {
      setOverriding(false);
    }
  }

  if (result === 'matched') {
    return <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">✓ Güncellendi, TYMM ile eşleşiyor: {value}</p>;
  }
  if (result === 'overridden') {
    return <p className="text-[11px] text-muted-foreground mt-1 italic">✓ Doğru kabul edildi (manuel onay): {value}</p>;
  }

  if (!editing) {
    return (
      <div className="mt-1">
        {result === 'mismatched' && (
          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mb-1">⚠️ Kaydedildi ama TYMM metniyle hâlâ eşleşmiyor.</p>
        )}
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] text-red-600 dark:text-red-400 min-w-0">− {value}</p>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => setEditing(true)}
              className="text-[10px] font-bold text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
            >
              Düzenle
            </button>
            <button
              onClick={handleOverride}
              disabled={overriding}
              className="text-[10px] font-bold text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors disabled:opacity-40"
            >
              {overriding ? '…' : '✓ Doğru Kabul Et'}
            </button>
          </div>
        </div>
        {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-1 space-y-1.5">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        className="w-full text-[11px] rounded-md border border-border bg-surface px-2 py-1.5 outline-none focus:border-indigo-400"
      />
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      <div className="flex gap-1.5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-2 py-0.5 rounded-md bg-indigo-500 text-white text-[10px] font-bold hover:bg-indigo-400 transition-colors disabled:opacity-40"
        >
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button
          onClick={() => { setEditing(false); setValue(outcome.description); setError(null); }}
          className="px-2 py-0.5 rounded-md border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}

// Daha önce "✓ Doğru Kabul Et" ile onaylanmış bir kazanım — tekrar açıldığında (yeni bir
// karşılaştırmada) burada gösterilir; admin fikrini değiştirirse "Kaldır" ile override'ı
// silip satırı tekrar normal "farklı" durumuna döndürebilir.
function OverriddenOutcomeRow({ outcome }: { outcome: { id: number; code: string | null; description: string } }) {
  const [removing, setRemoving] = useState(false);
  const [removed, setRemoved] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    try {
      const res = await fetch(`/api/admin/tymm/outcome-override?outcomeId=${outcome.id}`, { method: 'DELETE' });
      if (res.ok) setRemoved(true);
    } finally {
      setRemoving(false);
    }
  }

  if (removed) {
    return <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">− {outcome.description} (onay kaldırıldı, tekrar farklı sayılacak)</p>;
  }

  return (
    <div className="flex items-start justify-between gap-2 mt-1">
      <p className="text-[11px] text-muted-foreground italic min-w-0">✓ Manuel onaylandı: {outcome.description}</p>
      <button
        onClick={handleRemove}
        disabled={removing}
        className="shrink-0 text-[10px] font-bold text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-40"
      >
        {removing ? '…' : 'Kaldır'}
      </button>
    </div>
  );
}

// Bazı konuların öğrenme çıktısı (ve altındaki TÜM kazanımlar) yanlış konu satırına
// bağlanmış olabiliyor — admin burada aynı ünitedeki doğru konuyu seçip taşıyabiliyor
// (kullanıcının 2026-09-20 isteği: "öğrenme çıktısını taşısak tüm kazanımlar da taşınır
// değil mi"). Kazanım id'leri değişmediği için soru/içerik bağlantıları bozulmaz.
function MoveTopicOutcomesButton({ sourceTopicId, siblingTopics }: { sourceTopicId: number; siblingTopics: { id: number; title: string }[] }) {
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleMove() {
    if (!targetId) return;
    const targetTitle = siblingTopics.find((t) => t.id === targetId)?.title || '';
    if (!confirm(`Bu konunun öğrenme çıktısı ve TÜM kazanımları "${targetTitle}" konusuna taşınacak. Emin misiniz?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/manage/outcomes/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceTopicId, targetTopicId: targetId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error || 'Taşınamadı'); return; }
      setResult(`✓ "${targetTitle}" konusuna taşındı (${data.movedCount} kazanım)`);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (result) return <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2">{result}</p>;
  if (!siblingTopics.length) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 text-[10px] font-bold text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
      >
        ↔ Öğrenme Çıktısını Başka Konuya Taşı
      </button>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <select
        value={targetId}
        onChange={(e) => setTargetId(e.target.value ? Number(e.target.value) : '')}
        className="text-[11px] rounded-md border border-border bg-surface px-2 py-1 outline-none focus:border-indigo-400"
      >
        <option value="">Hedef konu seçin…</option>
        {siblingTopics.map((t) => (
          <option key={t.id} value={t.id}>{t.title}</option>
        ))}
      </select>
      <button
        onClick={handleMove}
        disabled={!targetId || saving}
        className="px-2 py-0.5 rounded-md bg-indigo-500 text-white text-[10px] font-bold hover:bg-indigo-400 transition-colors disabled:opacity-40"
      >
        {saving ? 'Taşınıyor…' : 'Taşı'}
      </button>
      <button
        onClick={() => { setOpen(false); setTargetId(''); setError(null); }}
        className="px-2 py-0.5 rounded-md border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors"
      >
        Vazgeç
      </button>
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  );
}

// TYMM'de olup DB'de karşılığı bulunamayan bir kazanım adayı — admin bunu tek tıkla
// ilgili konuya yeni bir kazanım satırı olarak ekleyebilir.
function AddedOutcomeRow({ description, topicId }: { description: string; topicId: number | null }) {
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!topicId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/manage/outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, description }),
      });
      if (!res.ok) { setError('Eklenemedi'); return; }
      setAdded(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-start justify-between gap-2 mt-1">
      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 min-w-0">+ {description}</p>
      {added ? (
        <span className="shrink-0 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">✓ eklendi</span>
      ) : topicId ? (
        <button
          onClick={handleAdd}
          disabled={saving}
          className="shrink-0 text-[10px] font-bold text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors disabled:opacity-40"
        >
          {saving ? 'Ekleniyor…' : 'Kazanım Olarak Ekle'}
        </button>
      ) : null}
      {error && <span className="shrink-0 text-[10px] text-red-500">{error}</span>}
    </div>
  );
}

// Toplu kontrol raporundaki tek bir ünitenin özet satırı — "Farklı" ise tıklanınca konu/kazanım
// bazında hangi metnin eklendiğini/kaldırıldığını gösterir.
function CompareUnitCard({
  diff,
  expanded,
  onToggle,
  onInspect,
}: {
  diff: CompareUnitDiff;
  expanded: boolean;
  onToggle: () => void;
  onInspect?: () => void;
}) {
  const style = COMPARE_STATUS_STYLE[diff.status];
  const title = diff.dbUnitTitle || diff.tymmTitle;
  const changedTopics = diff.topics.filter((t) => t.status !== 'same');
  const canExpand = diff.status === 'changed' || diff.status === 'db-only';

  return (
    <div className={`rounded-xl border ${style.border} bg-surface p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex-shrink-0 ${style.badge}`}>{style.label}</span>
          <p className="text-sm font-bold text-foreground truncate">{title}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onInspect && (
            <button
              onClick={onInspect}
              className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 text-[10px] font-bold hover:bg-indigo-500/20 transition-colors"
            >
              🔍 Yan Yana Gör
            </button>
          )}
          {canExpand && (
            <button onClick={onToggle} className="text-xs font-bold text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">
              {expanded ? '▲' : '▼'}
            </button>
          )}
        </div>
      </div>

      {diff.status === 'changed' && !expanded && (
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {diff.durationHoursChanged && 'ders saati değişmiş · '}
          {(diff.keyConceptsAdded.length > 0 || diff.keyConceptsRemoved.length > 0) && 'anahtar kavramlar değişmiş · '}
          {changedTopics.length > 0 && `${changedTopics.length} konu/kazanım farklı`}
        </p>
      )}

      {expanded && (
        <div className="mt-3 space-y-2">
          {diff.durationHoursChanged && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">⏱ Ders saati DB ile TYMM arasında farklı.</p>
          )}
          {diff.keyConceptsAdded.length > 0 && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400">+ Yeni anahtar kavram: {diff.keyConceptsAdded.join(', ')}</p>
          )}
          {diff.keyConceptsRemoved.length > 0 && (
            <p className="text-[11px] text-red-600 dark:text-red-400">− DB&apos;de olup TYMM&apos;de olmayan anahtar kavram: {diff.keyConceptsRemoved.join(', ')}</p>
          )}
          {changedTopics.map((t, i) => (
            <div key={i} className="rounded-lg border border-border bg-muted/40 p-2.5">
              <p className="text-xs font-bold text-foreground">
                {t.status === 'tymm-only' && '🆕 '}
                {t.status === 'db-only' && '❌ '}
                {t.title}
                {t.status === 'tymm-only' && <span className="ml-1.5 font-normal text-[10px] text-indigo-600 dark:text-indigo-300">TYMM&apos;de var, DB&apos;de yok</span>}
                {t.status === 'db-only' && <span className="ml-1.5 font-normal text-[10px] text-red-600 dark:text-red-400">DB&apos;de var, TYMM&apos;de yok</span>}
              </p>
              {t.learningOutcomeChanged && t.learningOutcomeDiffs.length === 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">✏️ Öğrenme çıktısı metni değişmiş.</p>
              )}
              {t.learningOutcomeDiffs.length > 0 ? (
                <div className="mt-1.5 space-y-2">
                  {t.learningOutcomeDiffs.map((lo, li) => (
                    <div key={li} className="pl-2 border-l border-border">
                      <p className="text-[11px] font-semibold text-foreground">
                        {lo.code && <span className="font-mono text-indigo-600 dark:text-indigo-300">{lo.code}. </span>}
                        {lo.title}
                        {lo.status === 'tymm-only' && <span className="ml-1.5 font-normal text-[10px] text-indigo-600 dark:text-indigo-300">TYMM&apos;de var, DB&apos;de yok</span>}
                        {lo.status === 'db-only' && <span className="ml-1.5 font-normal text-[10px] text-red-600 dark:text-red-400">DB&apos;de var, TYMM&apos;de yok</span>}
                      </p>
                      {lo.learningOutcomeChanged && <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">✏️ Öğrenme çıktısı metni değişmiş.</p>}
                      {lo.outcomesAdded.map((o, oi) => (
                        <AddedOutcomeRow key={`a${oi}`} description={o} topicId={t.dbTopicId} />
                      ))}
                      {lo.outcomesRemoved.map((o) => (
                        <EditableOutcomeRow key={`r${o.id}`} outcome={o} tymmTexts={lo.tymmOutcomeTexts} />
                      ))}
                      {lo.outcomesOverridden.map((o) => (
                        <OverriddenOutcomeRow key={`o${o.id}`} outcome={o} />
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {t.outcomesAdded.map((o, oi) => (
                    <AddedOutcomeRow key={`a${oi}`} description={o} topicId={t.dbTopicId} />
                  ))}
                  {t.outcomesRemoved.map((o) => (
                    <EditableOutcomeRow key={`r${o.id}`} outcome={o} tymmTexts={t.tymmOutcomeTexts} />
                  ))}
                  {t.outcomesOverridden.map((o) => (
                    <OverriddenOutcomeRow key={`o${o.id}`} outcome={o} />
                  ))}
                </>
              )}
              {t.dbTopicId != null && (
                <MoveTopicOutcomesButton
                  sourceTopicId={t.dbTopicId}
                  siblingTopics={diff.topics
                    .filter((x): x is typeof x & { dbTopicId: number } => x.dbTopicId != null && x.dbTopicId !== t.dbTopicId)
                    .map((x) => ({ id: x.dbTopicId, title: x.title }))}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StepFlow({ rows, results }: { rows: EditableRow[] | null; results: Record<StepKey, StepResult | null> }) {
  const steps: { key: string; label: string; done: boolean }[] = [
    { key: 'docx', label: 'DOCX→JSON', done: !!rows },
    { key: 'units', label: 'Üniteler', done: !!results.units },
    { key: 'topics', label: 'Konular', done: !!results.topics },
    { key: 'outcomes', label: 'Kazanımlar', done: !!results.outcomes },
  ];
  return (
    <div className="flex items-center">
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                s.done ? 'border-emerald-400 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-border text-muted-foreground'
              }`}
            >
              {s.done ? '✓' : i + 1}
            </div>
            <span className={`text-[11px] font-bold ${s.done ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-3 max-w-10 ${s.done ? 'bg-emerald-400' : 'bg-border'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function PickList<T extends { id: number; name: string }>({
  label,
  items,
  selectedId,
  onSelect,
  disabled = false,
  emptyMessage = 'Yükleniyor…',
  verifiedIds,
}: {
  label: string;
  items: T[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  disabled?: boolean;
  emptyMessage?: string;
  // TYMM ile karşılaştırıldığında tam eşleşen (veya elle "doğru" işaretlenen) öğelerin
  // yanında yeşil tik göstermek için — bkz. YillikPlanPanel'deki Ders PickList kullanımı.
  verifiedIds?: Set<number>;
}) {
  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : undefined}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
        {items.length === 0 && <p className="text-xs text-muted-foreground py-2 text-center">{emptyMessage}</p>}
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm font-semibold transition-colors ${
              selectedId === item.id
                ? 'border-indigo-400 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                : 'border-border text-muted-foreground hover:border-border hover:text-foreground'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selectedId === item.id ? 'bg-indigo-400' : 'bg-muted-foreground/40'}`} />
            <span className="flex-1 truncate">{item.name}</span>
            {verifiedIds?.has(item.id) && (
              <span className="text-emerald-500 flex-shrink-0" title="TYMM ile doğrulandı">✅</span>
            )}
            <span className="text-[10px] font-mono text-muted-foreground">#{item.id}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepRunner({
  title,
  description,
  ready,
  running,
  logs,
  result,
  onRun,
}: {
  step: StepKey;
  title: string;
  description: string;
  ready: boolean;
  running: boolean;
  logs: LogEntry[];
  result: StepResult | null;
  onRun: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-bold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <button
          onClick={onRun}
          disabled={!ready || running}
          className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
        >
          {running ? 'Çalışıyor…' : `▶ ${title} Yükle`}
        </button>
      </div>

      {result && (
        <div className="flex gap-4 mt-3 text-xs font-mono">
          <span className="text-emerald-600 dark:text-emerald-400">✅ {result.basarili}</span>
          <span className="text-muted-foreground">⊘ {result.atlanmis}</span>
          <span className="text-red-600 dark:text-red-400">❌ {result.hata}</span>
          {result.hafta_atlanmis != null && <span className="text-muted-foreground">📅 ⊘{result.hafta_atlanmis}</span>}
        </div>
      )}

      {logs.length > 0 && (
        <div className="mt-3 bg-surface-elevated rounded-lg border border-border p-3 max-h-56 overflow-y-auto font-mono text-[11px] leading-relaxed">
          {logs.map((l, i) => (
            <div
              key={i}
              className={
                l.level === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
                l.level === 'error' ? 'text-red-600 dark:text-red-400' :
                l.level === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
              }
            >
              {l.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RowTable({
  rows,
  onUpdate,
  onUpdateKazanim,
  onDelete,
  onAdd,
}: {
  rows: EditableRow[];
  onUpdate: (id: number, field: keyof ParsedRow, value: string) => void;
  onUpdateKazanim: (id: number, value: string) => void;
  onDelete: (id: number) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="max-h-[600px] overflow-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th className="text-left font-bold text-muted-foreground p-2 w-16">Hafta</th>
              <th className="text-left font-bold text-muted-foreground p-2 min-w-[140px]">Ünite</th>
              <th className="text-left font-bold text-muted-foreground p-2 min-w-[140px]">Konu</th>
              <th className="text-left font-bold text-muted-foreground p-2 min-w-[480px]">Kazanımlar (JSON)</th>
              <th className="p-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id} className="border-t border-border">
                <td className="p-1.5">
                  <input
                    type="number"
                    value={r.week_no ?? ''}
                    onChange={(e) => onUpdate(r._id, 'week_no', e.target.value)}
                    className="w-14 bg-surface border border-border rounded px-1.5 py-1 text-foreground outline-none focus:border-indigo-400"
                  />
                </td>
                <td className="p-1.5">
                  <input
                    value={r.ünite}
                    onChange={(e) => onUpdate(r._id, 'ünite', e.target.value)}
                    className="w-full bg-surface border border-border rounded px-1.5 py-1 text-foreground outline-none focus:border-indigo-400"
                  />
                </td>
                <td className="p-1.5">
                  <input
                    value={r.konu}
                    onChange={(e) => onUpdate(r._id, 'konu', e.target.value)}
                    className="w-full bg-surface border border-border rounded px-1.5 py-1 text-foreground outline-none focus:border-indigo-400"
                  />
                </td>
                <td className="p-1.5">
                  <textarea
                    defaultValue={JSON.stringify(r.kazanım, null, 2)}
                    onBlur={(e) => onUpdateKazanim(r._id, e.target.value)}
                    rows={6}
                    className="w-full min-w-[460px] bg-surface border border-border rounded px-2 py-1.5 text-foreground font-mono text-xs leading-relaxed outline-none focus:border-indigo-400 resize-y"
                  />
                </td>
                <td className="p-1.5 text-center">
                  <button onClick={() => onDelete(r._id)} className="text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 text-sm" title="Satırı sil">
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={onAdd} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold hover:bg-emerald-500/20">
        ➕ Satır Ekle
      </button>
    </div>
  );
}
