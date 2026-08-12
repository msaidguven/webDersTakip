import type { Metadata } from 'next';
import { StaticPageLayout } from '@/app/src/components/StaticPageLayout';

const canonicalPath = '/gizlilik-politikasi';
const CONTACT_EMAIL = 'info@derstakip.net';
const LAST_UPDATED = '12 Ağustos 2026';

export const metadata: Metadata = {
  title: 'Gizlilik Politikası',
  description: 'Ders Takip gizlilik politikası: hangi verileri topluyoruz, nasıl kullanıyoruz ve verilerinizle ilgili haklarınız.',
  alternates: { canonical: canonicalPath },
  openGraph: { title: 'Gizlilik Politikası | Ders Takip', url: canonicalPath },
};

export default function PrivacyPolicyPage() {
  return (
    <StaticPageLayout title="Gizlilik Politikası" updatedAt={LAST_UPDATED}>
      <p>
        Bu sayfa, Ders Takip (&quot;biz&quot;, &quot;platform&quot;) olarak hangi kişisel verileri topladığımızı, bunları
        nasıl kullandığımızı ve verileriniz üzerindeki haklarınızı açıklar.
      </p>

      <h2>Topladığımız veriler</h2>
      <ul>
        <li>
          <strong>Hesap bilgileri:</strong> Kayıt olurken verdiğiniz ad soyad, e-posta adresi ve şifre
          (şifreniz tarafımızca okunamayacak şekilde saklanır).
        </li>
        <li>
          <strong>Kullanım verileri:</strong> Çözdüğünüz testler, ilerleme durumunuz ve platform içi
          aktiviteniz gibi hizmeti sunmak için gerekli veriler.
        </li>
        <li>
          <strong>Teknik veriler:</strong> Oturumunuzu açık tutmak için gerekli çerezler ve tema tercihiniz
          (açık/koyu mod) gibi tarayıcınızda tutulan ayarlar.
        </li>
      </ul>

      <h2>Verilerinizi nasıl kullanıyoruz</h2>
      <p>
        Verileriniz yalnızca hesabınızı oluşturmak, oturumunuzu yönetmek, ilerlemenizi kaydetmek ve size
        hizmeti sunmak için kullanılır. Verilerinizi pazarlama amacıyla üçüncü taraflarla paylaşmıyor veya
        satmıyoruz.
      </p>

      <h2>Veri barındırma ve alt yükleniciler</h2>
      <p>
        Hesap ve içerik verileriniz Supabase altyapısında saklanır, site Vercel üzerinde barındırılır. Bu
        sağlayıcılar yalnızca teknik altyapı hizmeti sunar, verilerinizi kendi amaçları için kullanmaz.
        Yayın tarihi itibarıyla platformda üçüncü taraf reklam veya analiz (tracking) betiği
        kullanılmamaktadır.
      </p>

      <h2>Çerezler</h2>
      <p>
        Platform, oturumunuzu açık tutmak için zorunlu oturum çerezleri kullanır. Bunlar dışında, tema
        tercihiniz gibi ayarlar tarayıcınızın yerel depolamasında (localStorage) tutulur ve sunucularımıza
        gönderilmez.
      </p>

      <h2>Çocukların gizliliği</h2>
      <p>
        Platform 5-8. sınıf öğrencilerine yönelik içerik sunar. Reşit olmayan kullanıcıların hesap
        oluştururken bir veli/vasi gözetiminde olması önerilir.
      </p>

      <h2>Haklarınız</h2>
      <p>
        Verilerinize erişme, düzeltme veya silinmesini talep etme hakkına sahipsiniz. Bu tür talepleriniz
        için <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> adresinden bize ulaşabilirsiniz.
      </p>

      <h2>Değişiklikler</h2>
      <p>
        Bu politikada değişiklik yapıldığında bu sayfa güncellenir ve sayfanın üst kısmındaki güncelleme
        tarihi değiştirilir.
      </p>
    </StaticPageLayout>
  );
}
