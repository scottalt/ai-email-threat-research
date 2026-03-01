import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get('format') ?? 'json';
  const version = req.nextUrl.searchParams.get('version') ?? 'v1';

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cards_real')
    .select('*')
    .eq('dataset_version', version)
    .order('approved_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (format === 'csv') {
    if (!data || data.length === 0) return new NextResponse('', { status: 200, headers: { 'Content-Type': 'text/csv' } });
    const headers = Object.keys(data[0]).map((k) => `"${k}"`).join(',');
    const rows = data.map((row) =>
      Object.values(row).map((v) =>
        v === null ? '' : typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : String(v)
      ).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="retro-phish-dataset-${version}.csv"`,
      },
    });
  }

  return NextResponse.json(data, {
    headers: {
      'Content-Disposition': `attachment; filename="retro-phish-dataset-${version}.json"`,
    },
  });
}
