import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

type ProfileRoleRow = { role: string | null };

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if ((profile as ProfileRoleRow | null)?.role !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 });
  }

  const promptPath = path.join(process.cwd(), 'app', 'prompt', 'lesson_prompt_v2.md');
  const prompt = await readFile(promptPath, 'utf8');

  return NextResponse.json({ prompt });
}
