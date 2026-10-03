// Başarılı giriş/kayıt/şifre yenilemeden sonra tarayıcının şifre yöneticisine (Chrome, Edge)
// "bu şifreyi kaydet" teklifini açıkça tetikler. Form fetch ile gönderilip sayfa SPA olarak
// değiştiği için tarayıcı başarılı girişi her zaman kendi kendine anlayamıyor. Credential
// Management API desteklenmiyorsa (Safari, Firefox) sessizce geçilir — o tarayıcılar formdaki
// autocomplete="username"/"new-password" alanlarından yine teklif eder.
type PasswordCredentialCtor = new (data: { id: string; password: string; name?: string }) => Credential;

export async function offerToSaveCredential(email: string, password: string, name?: string): Promise<void> {
  try {
    const Ctor = (window as unknown as { PasswordCredential?: PasswordCredentialCtor }).PasswordCredential;
    if (!Ctor || !navigator.credentials?.store) return;
    await navigator.credentials.store(new Ctor({ id: email, password, name: name || undefined }));
  } catch {
    /* kullanıcı reddetti ya da tarayıcı izin vermedi — akışı etkilemez */
  }
}
