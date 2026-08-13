'use client';

import { SectionContentEditModal } from '@/app/src/components/admin/AdminTopicSectionsPanel';

const mockSection = {
  id: 21,
  topic_content_id: 1,
  order_no: 0,
  heading: 'Grup Kavramı ve Özellikleri',
  body_markdown:
    "- **Grup**: ortak özellikleri, amaçları veya ilgileri olan, birbiriyle etkileşim hâlinde bulunan iki veya daha fazla kişinin bir araya gelmesiyle oluşan topluluktur.\n- **Ortak amaç**: grup üyelerinin birlikte ulaşmaya çalıştığı hedeftir.\n- **Etkileşim**: grup üyelerinin birbiriyle iletişim kurması ve birbirini etkilemesidir.\n- **Aidiyet duygusu**: bireyin kendini bir gruba ait hissetmesidir.\n- **Kurallar**: grup üyelerinin uyması gereken ortak davranış ilkeleridir.\n- **Üye**: bir gruba dâhil olan kişidir.\n- Bir kişi aynı anda birden fazla gruba dâhil olabilir.\n- Bireyin dâhil olduğu gruplar, yaşamı boyunca değişebilir.",
  image_url: 'https://pwzbjhgrhkcdyowknmhe.supabase.co/storage/v1/object/public/topic-content-images/sections/21-1786436703180.webp',
  image_prompt: 'test prompt',
  status: 'content_ready' as const,
  outcomes: [],
};

export default function ScratchTestEditPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0c12' }}>
      <SectionContentEditModal section={mockSection} onClose={() => {}} onSaved={() => {}} />
    </div>
  );
}
