'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────────

type TabKey = 'seasons' | 'themes' | 'achievements' | 'ranks' | 'h2h-tiers' | 'quests' | 'xp-config' | 'changelog';

interface TabDef {
  key: TabKey;
  label: string;
  endpoint: string;
  idField: string;           // which field is the primary key
  idIsManual: boolean;       // admin types the ID (vs auto-increment)
  columns: ColDef[];
  formFields: FieldDef[];
}

interface ColDef {
  key: string;
  label: string;
  render?: (val: unknown, row: Record<string, unknown>) => React.ReactNode;
}

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'date' | 'textarea' | 'color-grid' | 'color';
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  defaultValue?: unknown;
}

// ── Helpers ────────────────────────────────────────────────────────

const API_BASE = '/api/admin/content';

const STATUS_COLORS: Record<string, string> = {
  active: 'text-[var(--c-primary)]',
  ended: 'text-red-500',
  upcoming: 'text-amber-400',
};

const RARITY_COLORS: Record<string, string> = {
  common: 'text-gray-400',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  legendary: 'text-purple-400',
  mythic: 'text-amber-400',
};

const ACHIEVEMENT_CATEGORIES = [
  'progression', 'skill', 'streak', 'speed', 'investigation', 'xp', 'daily', 'h2h', 'season',
];

const ACHIEVEMENT_RARITIES = ['common', 'uncommon', 'rare', 'legendary', 'mythic'];

const THEME_COLOR_KEYS = ['primary', 'secondary', 'muted', 'dark', 'bg', 'bgAlt', 'accent', 'accentDim'] as const;

const inputCls = 'w-full bg-transparent border border-[color-mix(in_srgb,var(--c-primary)_25%,transparent)] px-2 py-1.5 text-[var(--c-primary)] font-mono text-sm focus:outline-none focus:border-[color-mix(in_srgb,var(--c-primary)_60%,transparent)]';
const btnCls = 'term-border px-3 py-1 font-mono text-xs tracking-widest transition-all';
const btnPrimary = `${btnCls} text-[var(--c-primary)] hover:bg-[color-mix(in_srgb,var(--c-primary)_8%,transparent)]`;
const btnDanger = `${btnCls} text-red-500 border-red-500/30 hover:bg-red-500/10`;

// ── Tab definitions ────────────────────────────────────────────────

function buildTabs(seasons: Record<string, unknown>[]): TabDef[] {
  const seasonOpts = seasons.map(s => ({ value: s.id as string, label: s.name as string }));

  return [
    {
      key: 'seasons',
      label: 'SEASONS',
      endpoint: `${API_BASE}/seasons`,
      idField: 'id',
      idIsManual: true,
      columns: [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'NAME' },
        {
          key: 'status', label: 'STATUS',
          render: (v) => (
            <span className={`font-bold uppercase ${STATUS_COLORS[v as string] ?? 'text-[var(--c-muted)]'}`}>
              {v as string}
            </span>
          ),
        },
        { key: 'start_date', label: 'START' },
        { key: 'end_date', label: 'END' },
        { key: 'sort_order', label: 'ORD' },
      ],
      formFields: [
        { key: 'id', label: 'ID', type: 'text', required: true, placeholder: 's1' },
        { key: 'name', label: 'NAME', type: 'text', required: true },
        { key: 'status', label: 'STATUS', type: 'select', required: true, options: [{ value: 'upcoming', label: 'upcoming' }, { value: 'active', label: 'active' }, { value: 'ended', label: 'ended' }] },
        { key: 'start_date', label: 'START DATE', type: 'date' },
        { key: 'end_date', label: 'END DATE', type: 'date' },
        { key: 'sort_order', label: 'SORT ORDER', type: 'number', defaultValue: 0 },
      ],
    },
    {
      key: 'themes',
      label: 'THEMES',
      endpoint: `${API_BASE}/themes`,
      idField: 'id',
      idIsManual: true,
      columns: [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'NAME' },
        { key: 'subtitle', label: 'SUBTITLE' },
        { key: 'unlock_level', label: 'LVL' },
        {
          key: 'colors', label: 'COLORS',
          render: (v) => {
            const c = v as Record<string, string> | null;
            if (!c) return '—';
            return (
              <div className="flex gap-0.5">
                {THEME_COLOR_KEYS.map(k => (
                  <div key={k} className="w-4 h-4 border border-white/10" style={{ backgroundColor: c[k] ?? '#000' }} title={`${k}: ${c[k]}`} />
                ))}
              </div>
            );
          },
        },
      ],
      formFields: [
        { key: 'id', label: 'ID', type: 'text', required: true, placeholder: 'matrix' },
        { key: 'name', label: 'NAME', type: 'text', required: true },
        { key: 'subtitle', label: 'SUBTITLE', type: 'text', required: true },
        { key: 'unlock_level', label: 'UNLOCK LEVEL', type: 'number', required: true, defaultValue: 1 },
        { key: 'unlock_label', label: 'UNLOCK LABEL', type: 'text', required: true, placeholder: 'Reach Level 5' },
        { key: 'requires_graduation', label: 'REQUIRES GRADUATION', type: 'checkbox', defaultValue: false },
        { key: 'colors', label: 'COLORS', type: 'color-grid' },
        { key: 'sort_order', label: 'SORT ORDER', type: 'number', defaultValue: 0 },
      ],
    },
    {
      key: 'achievements',
      label: 'ACHIEVEMENTS',
      endpoint: `${API_BASE}/achievements`,
      idField: 'id',
      idIsManual: true,
      columns: [
        { key: 'icon', label: '' },
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'NAME' },
        { key: 'category', label: 'CATEGORY' },
        {
          key: 'rarity', label: 'RARITY',
          render: (v) => (
            <span className={`font-bold uppercase ${RARITY_COLORS[v as string] ?? ''}`}>{v as string}</span>
          ),
        },
        { key: 'season_id', label: 'SEASON' },
      ],
      formFields: [
        { key: 'id', label: 'ID', type: 'text', required: true, placeholder: 'first-blood' },
        { key: 'name', label: 'NAME', type: 'text', required: true },
        { key: 'description', label: 'DESCRIPTION', type: 'text', required: true },
        { key: 'category', label: 'CATEGORY', type: 'select', required: true, options: ACHIEVEMENT_CATEGORIES.map(c => ({ value: c, label: c })) },
        { key: 'rarity', label: 'RARITY', type: 'select', required: true, options: ACHIEVEMENT_RARITIES.map(r => ({ value: r, label: r })) },
        { key: 'icon', label: 'ICON (emoji)', type: 'text', required: true, placeholder: '\u{1F3AF}' },
        { key: 'season_id', label: 'SEASON', type: 'select', options: [{ value: '', label: '(none)' }, ...seasonOpts] },
        { key: 'sort_order', label: 'SORT ORDER', type: 'number', defaultValue: 0 },
      ],
    },
    {
      key: 'ranks',
      label: 'RANKS',
      endpoint: `${API_BASE}/ranks`,
      idField: 'id',
      idIsManual: false,
      columns: [
        {
          key: 'label', label: 'LABEL',
          render: (v, row) => <span style={{ color: (row.color as string) || undefined }} className="font-bold">{v as string}</span>,
        },
        { key: 'min_level', label: 'MIN LVL' },
        { key: 'max_level', label: 'MAX LVL' },
        { key: 'color', label: 'COLOR', render: (v) => <div className="flex items-center gap-1"><div className="w-3 h-3 border border-white/10" style={{ backgroundColor: v as string }} /><span className="text-[var(--c-muted)]">{v as string}</span></div> },
        { key: 'sort_order', label: 'ORD' },
      ],
      formFields: [
        { key: 'label', label: 'LABEL', type: 'text', required: true },
        { key: 'min_level', label: 'MIN LEVEL', type: 'number', required: true },
        { key: 'max_level', label: 'MAX LEVEL', type: 'number', required: true },
        { key: 'color', label: 'COLOR', type: 'color', required: true },
        { key: 'sort_order', label: 'SORT ORDER', type: 'number', defaultValue: 0 },
      ],
    },
    {
      key: 'h2h-tiers',
      label: 'H2H TIERS',
      endpoint: `${API_BASE}/h2h-tiers`,
      idField: 'tier',
      idIsManual: true,
      columns: [
        { key: 'tier', label: 'TIER' },
        {
          key: 'label', label: 'LABEL',
          render: (v, row) => <span style={{ color: (row.color as string) || undefined }} className="font-bold">{v as string}</span>,
        },
        { key: 'icon', label: 'ICON' },
        { key: 'min_points', label: 'MIN PTS' },
        { key: 'season_id', label: 'SEASON' },
        { key: 'color', label: 'COLOR', render: (v) => <div className="flex items-center gap-1"><div className="w-3 h-3 border border-white/10" style={{ backgroundColor: v as string }} /><span className="text-[var(--c-muted)]">{v as string}</span></div> },
      ],
      formFields: [
        { key: 'tier', label: 'TIER KEY', type: 'text', required: true, placeholder: 'gold' },
        { key: 'season_id', label: 'SEASON', type: 'select', required: true, options: seasonOpts },
        { key: 'label', label: 'LABEL', type: 'text', required: true },
        { key: 'icon', label: 'ICON (emoji)', type: 'text', required: true },
        { key: 'min_points', label: 'MIN POINTS', type: 'number', required: true },
        { key: 'color', label: 'COLOR', type: 'color', required: true },
        { key: 'sort_order', label: 'SORT ORDER', type: 'number', defaultValue: 0 },
      ],
    },
    {
      key: 'quests',
      label: 'QUESTS',
      endpoint: `${API_BASE}/quests`,
      idField: 'id',
      idIsManual: true,
      columns: [
        { key: 'icon', label: '' },
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'NAME' },
        { key: 'target_count', label: 'TARGET' },
        { key: 'reward_text', label: 'REWARD' },
        { key: 'xp_reward', label: 'XP' },
      ],
      formFields: [
        { key: 'id', label: 'ID', type: 'text', required: true, placeholder: 'daily-5' },
        { key: 'name', label: 'NAME', type: 'text', required: true },
        { key: 'description', label: 'DESCRIPTION', type: 'text', required: true },
        { key: 'detail', label: 'DETAIL', type: 'textarea' },
        { key: 'target_count', label: 'TARGET COUNT', type: 'number', required: true },
        { key: 'reward_text', label: 'REWARD TEXT', type: 'text', required: true },
        { key: 'xp_reward', label: 'XP REWARD', type: 'number', required: true, defaultValue: 0 },
        { key: 'icon', label: 'ICON (emoji)', type: 'text', required: true, placeholder: '\u{1F3AF}' },
        { key: 'sort_order', label: 'SORT ORDER', type: 'number', defaultValue: 0 },
      ],
    },
    {
      key: 'xp-config',
      label: 'XP CONFIG',
      endpoint: `${API_BASE}/xp-config`,
      idField: 'key',
      idIsManual: true,
      columns: [
        { key: 'key', label: 'KEY' },
        {
          key: 'value_int', label: 'VALUE',
          render: (v, row) => {
            if (v != null) return <span className="font-bold">{String(v)}</span>;
            if (row.value_json != null) return <span className="text-[var(--c-muted)] text-xs">JSON</span>;
            return '—';
          },
        },
        { key: 'description', label: 'DESCRIPTION' },
      ],
      formFields: [
        { key: 'key', label: 'KEY', type: 'text', required: true },
        { key: 'value_int', label: 'VALUE (int)', type: 'number' },
        { key: 'value_json', label: 'VALUE (JSON)', type: 'textarea', placeholder: '{"key": "value"}' },
        { key: 'description', label: 'DESCRIPTION', type: 'text' },
      ],
    },
    {
      key: 'changelog',
      label: 'CHANGELOG',
      endpoint: `${API_BASE}/changelog`,
      idField: 'id',
      idIsManual: false,
      columns: [
        { key: 'date', label: 'DATE' },
        { key: 'category', label: 'CAT', render: (v) => <span className="uppercase">{v as string}</span> },
        { key: 'title', label: 'TITLE' },
        {
          key: 'highlight', label: 'HL',
          render: (v) => v ? <span className="text-amber-400 font-bold">*</span> : null,
        },
      ],
      formFields: [
        { key: 'date', label: 'DATE', type: 'date', required: true },
        { key: 'category', label: 'CATEGORY', type: 'select', required: true, options: [{ value: 'milestone', label: 'milestone' }, { value: 'update', label: 'update' }] },
        { key: 'title', label: 'TITLE', type: 'text', required: true },
        { key: 'body', label: 'BODY', type: 'textarea' },
        { key: 'highlight', label: 'HIGHLIGHT', type: 'checkbox', defaultValue: false },
        { key: 'sort_order', label: 'SORT ORDER', type: 'number', defaultValue: 0 },
      ],
    },
  ];
}

// ── Field Renderer ─────────────────────────────────────────────────

function FormField({ field, value, onChange }: {
  field: FieldDef;
  value: unknown;
  onChange: (key: string, val: unknown) => void;
}) {
  if (field.type === 'color-grid') {
    const colors = (value as Record<string, string>) || {};
    return (
      <div className="space-y-1">
        <label className="text-[var(--c-muted)] text-xs font-mono tracking-widest">{field.label}</label>
        <div className="grid grid-cols-2 gap-2">
          {THEME_COLOR_KEYS.map(k => (
            <div key={k} className="flex items-center gap-2">
              <input
                type="color"
                value={colors[k] || '#000000'}
                onChange={e => onChange(field.key, { ...colors, [k]: e.target.value })}
                className="w-8 h-8 bg-transparent border border-[color-mix(in_srgb,var(--c-primary)_25%,transparent)] cursor-pointer"
              />
              <div className="flex-1">
                <div className="text-[var(--c-muted)] text-[10px] font-mono">{k}</div>
                <input
                  type="text"
                  value={colors[k] || ''}
                  onChange={e => onChange(field.key, { ...colors, [k]: e.target.value })}
                  placeholder="#000000"
                  className={inputCls + ' text-xs py-0.5'}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!value}
          onChange={e => onChange(field.key, e.target.checked)}
          className="w-4 h-4 accent-[var(--c-primary)]"
        />
        <span className="text-[var(--c-muted)] text-xs font-mono tracking-widest">{field.label}</span>
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <div className="space-y-1">
        <label className="text-[var(--c-muted)] text-xs font-mono tracking-widest">{field.label}</label>
        <select
          value={(value as string) ?? ''}
          onChange={e => onChange(field.key, e.target.value || null)}
          className={inputCls}
        >
          {!field.required && <option value="">—</option>}
          {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  if (field.type === 'textarea') {
    const strVal = typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : ((value as string) ?? '');
    return (
      <div className="space-y-1">
        <label className="text-[var(--c-muted)] text-xs font-mono tracking-widest">{field.label}</label>
        <textarea
          value={strVal}
          onChange={e => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className={inputCls + ' resize-y'}
        />
      </div>
    );
  }

  if (field.type === 'color') {
    return (
      <div className="space-y-1">
        <label className="text-[var(--c-muted)] text-xs font-mono tracking-widest">{field.label}</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={(value as string) || '#00ff41'}
            onChange={e => onChange(field.key, e.target.value)}
            className="w-8 h-8 bg-transparent border border-[color-mix(in_srgb,var(--c-primary)_25%,transparent)] cursor-pointer"
          />
          <input
            type="text"
            value={(value as string) ?? ''}
            onChange={e => onChange(field.key, e.target.value)}
            placeholder="#00ff41"
            className={inputCls}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label className="text-[var(--c-muted)] text-xs font-mono tracking-widest">{field.label}</label>
      <input
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        value={(value as string | number) ?? ''}
        onChange={e => onChange(field.key, field.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
        placeholder={field.placeholder}
        required={field.required}
        className={inputCls}
      />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────

export default function ContentAdminPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('seasons');
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<Record<string, unknown>[]>([]);

  // Editing state
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});

  // Adding state
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState<Record<string, unknown>>({});

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  // Expanded rows (for changelog body)
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());

  // H2H season filter
  const [h2hSeasonFilter, setH2hSeasonFilter] = useState<string>('');

  // Saving / busy state
  const [saving, setSaving] = useState(false);

  const tabs = buildTabs(seasons);
  const currentTab = tabs.find(t => t.key === activeTab)!;

  // Fetch seasons for dropdown references
  useEffect(() => {
    fetch(`${API_BASE}/seasons`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setSeasons(d))
      .catch(() => {});
  }, []);

  // Fetch data when tab changes
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEditingId(null);
    setIsAdding(false);
    setDeletingId(null);
    setExpandedRows(new Set());
    try {
      const tab = tabs.find(t => t.key === activeTab)!;
      let url = tab.endpoint;
      if (activeTab === 'h2h-tiers' && h2hSeasonFilter) {
        url += `?season_id=${encodeURIComponent(h2hSeasonFilter)}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(Array.isArray(json) ? json : []);
    } catch (e) {
      setError((e as Error).message);
      setData([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, h2hSeasonFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── CRUD helpers ───────────────────────────────────────────────

  function resetForms() {
    setEditingId(null);
    setEditForm({});
    setIsAdding(false);
    setAddForm({});
    setDeletingId(null);
    setDeleteConfirm('');
  }

  function initAddForm() {
    const defaults: Record<string, unknown> = {};
    for (const f of currentTab.formFields) {
      if (f.defaultValue !== undefined) defaults[f.key] = f.defaultValue;
    }
    if (activeTab === 'h2h-tiers' && h2hSeasonFilter) {
      defaults.season_id = h2hSeasonFilter;
    }
    setAddForm(defaults);
    setIsAdding(true);
    setEditingId(null);
    setDeletingId(null);
  }

  function startEdit(row: Record<string, unknown>) {
    setEditingId(row[currentTab.idField] as string | number);
    setEditForm({ ...row });
    setIsAdding(false);
    setDeletingId(null);
  }

  function prepareBody(form: Record<string, unknown>): Record<string, unknown> {
    const body = { ...form };
    // Parse JSON textarea for xp-config value_json
    if (activeTab === 'xp-config' && typeof body.value_json === 'string') {
      const str = (body.value_json as string).trim();
      if (str === '') {
        body.value_json = null;
      } else {
        try { body.value_json = JSON.parse(str); } catch { /* leave as string, server will error */ }
      }
    }
    // Strip empty strings to null for optional fields
    for (const [k, v] of Object.entries(body)) {
      if (v === '') body[k] = null;
    }
    return body;
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const body = prepareBody(addForm);

      if (activeTab === 'xp-config') {
        // XP config uses bulk PUT
        const res = await fetch(currentTab.endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([body]),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
      } else {
        const res = await fetch(currentTab.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
      }
      resetForms();
      await fetchData();
      // Refresh seasons if we added one
      if (activeTab === 'seasons') {
        const res = await fetch(`${API_BASE}/seasons`);
        if (res.ok) setSeasons(await res.json());
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    setSaving(true);
    try {
      const body = prepareBody(editForm);
      let url: string;
      let method = 'PUT';

      if (activeTab === 'xp-config') {
        url = currentTab.endpoint;
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([body]),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
      } else {
        url = `${currentTab.endpoint}/${encodeURIComponent(editingId as string | number)}`;
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
      }
      resetForms();
      await fetchData();
      if (activeTab === 'seasons') {
        const res = await fetch(`${API_BASE}/seasons`);
        if (res.ok) setSeasons(await res.json());
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string | number) {
    if (activeTab === 'xp-config') return; // no individual delete for xp-config
    setSaving(true);
    try {
      const url = `${currentTab.endpoint}/${encodeURIComponent(id)}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      resetForms();
      await fetchData();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────

  function renderFormFields(fields: FieldDef[], form: Record<string, unknown>, setForm: (f: Record<string, unknown>) => void, isEdit: boolean) {
    return (
      <div className="space-y-3 py-3 px-3 border border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] bg-[color-mix(in_srgb,var(--c-primary)_2%,transparent)]">
        {fields.map(field => {
          // Don't show ID field when editing, or when auto-generated
          if (isEdit && field.key === currentTab.idField) return null;
          if (!isEdit && !currentTab.idIsManual && field.key === currentTab.idField) return null;
          return (
            <FormField
              key={field.key}
              field={field}
              value={form[field.key]}
              onChange={(k, v) => setForm({ ...form, [k]: v })}
            />
          );
        })}
        <div className="flex gap-2 pt-2">
          <button
            onClick={isEdit ? handleUpdate : handleCreate}
            disabled={saving}
            className={btnPrimary + (saving ? ' opacity-50' : '')}
          >
            {saving ? 'SAVING...' : isEdit ? '[ SAVE ]' : '[ CREATE ]'}
          </button>
          <button onClick={resetForms} className={btnCls + ' text-[var(--c-muted)] hover:text-[var(--c-secondary)]'}>
            [ CANCEL ]
          </button>
        </div>
      </div>
    );
  }

  function renderRow(row: Record<string, unknown>, idx: number) {
    const rowId = row[currentTab.idField] as string | number;
    const isEditing = editingId === rowId;
    const isDeleting = deletingId === rowId;
    const isExpanded = expandedRows.has(rowId);

    if (isEditing) {
      return (
        <div key={String(rowId)} className="border-b border-[color-mix(in_srgb,var(--c-primary)_10%,transparent)]">
          {renderFormFields(currentTab.formFields, editForm, setEditForm, true)}
        </div>
      );
    }

    return (
      <div key={String(rowId)} className="border-b border-[color-mix(in_srgb,var(--c-primary)_10%,transparent)]">
        <div className="flex items-center gap-2 px-3 py-2 hover:bg-[color-mix(in_srgb,var(--c-primary)_3%,transparent)]">
          {/* Data columns */}
          <div className="flex-1 flex items-center gap-3 overflow-x-auto min-w-0">
            {currentTab.columns.map(col => {
              const val = row[col.key];
              return (
                <div key={col.key} className="shrink-0 text-sm font-mono">
                  {col.label && <span className="text-[var(--c-muted)] text-[10px] tracking-widest mr-1 hidden sm:inline">{col.label}:</span>}
                  <span className="text-[var(--c-secondary)]">
                    {col.render ? col.render(val, row) : (val == null ? '—' : String(val))}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex gap-1 shrink-0">
            {activeTab === 'changelog' && (row.body as string) && (
              <button
                onClick={() => {
                  const next = new Set(expandedRows);
                  next.has(rowId) ? next.delete(rowId) : next.add(rowId);
                  setExpandedRows(next);
                }}
                className={btnCls + ' text-[var(--c-muted)] hover:text-[var(--c-secondary)] text-[10px]'}
              >
                {isExpanded ? '[-]' : '[+]'}
              </button>
            )}
            <button onClick={() => startEdit(row)} className={btnCls + ' text-[var(--c-secondary)] hover:text-[var(--c-primary)] text-[10px]'}>
              EDIT
            </button>
            {activeTab !== 'xp-config' && (
              <button
                onClick={() => { setDeletingId(rowId); setDeleteConfirm(''); }}
                className={btnCls + ' text-red-500/50 hover:text-red-500 text-[10px]'}
              >
                DEL
              </button>
            )}
          </div>
        </div>

        {/* Changelog body expand */}
        {activeTab === 'changelog' && isExpanded && (row.body as string) && (
          <div className="px-3 pb-2 text-sm font-mono text-[var(--c-muted)] whitespace-pre-wrap border-t border-[color-mix(in_srgb,var(--c-primary)_5%,transparent)]">
            {row.body as string}
          </div>
        )}

        {/* Delete confirmation */}
        {isDeleting && (
          <div className="px-3 py-2 bg-red-500/5 border-t border-red-500/20 flex items-center gap-2">
            <span className="text-red-500 text-xs font-mono">Type DELETE to confirm:</span>
            <input
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              className="bg-transparent border border-red-500/30 px-2 py-1 text-red-500 font-mono text-sm focus:outline-none w-24"
              autoFocus
            />
            <button
              onClick={() => deleteConfirm === 'DELETE' && handleDelete(rowId)}
              disabled={deleteConfirm !== 'DELETE' || saving}
              className={`${btnDanger} text-[10px] ${deleteConfirm !== 'DELETE' ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              {saving ? '...' : '[ CONFIRM ]'}
            </button>
            <button onClick={() => { setDeletingId(null); setDeleteConfirm(''); }} className={btnCls + ' text-[var(--c-muted)] text-[10px]'}>
              [ CANCEL ]
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--c-bg)] p-4 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-4 mt-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-[var(--c-primary)] text-xs font-mono tracking-widest">CONTENT_REGISTRY</span>
          <Link href="/admin" className="text-[var(--c-muted)] text-xs font-mono hover:text-[var(--c-primary)] transition-colors">
            &larr; DASHBOARD
          </Link>
        </div>

        {/* Tab bar */}
        <div className="term-border bg-[var(--c-bg)]">
          <div className="flex overflow-x-auto border-b border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)]">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-2 text-xs font-mono tracking-widest whitespace-nowrap transition-all ${
                  activeTab === tab.key
                    ? 'text-[var(--c-primary)] border-b-2 border-[var(--c-primary)]'
                    : 'text-[var(--c-muted)] hover:text-[var(--c-secondary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="min-h-[200px]">
            {/* H2H season filter */}
            {activeTab === 'h2h-tiers' && seasons.length > 0 && (
              <div className="px-3 py-2 border-b border-[color-mix(in_srgb,var(--c-primary)_10%,transparent)] flex items-center gap-2">
                <span className="text-[var(--c-muted)] text-xs font-mono tracking-widest">SEASON:</span>
                <select
                  value={h2hSeasonFilter}
                  onChange={e => setH2hSeasonFilter(e.target.value)}
                  className={inputCls + ' w-auto'}
                >
                  <option value="">ALL</option>
                  {seasons.map(s => (
                    <option key={s.id as string} value={s.id as string}>{s.name as string}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Count badge */}
            <div className="px-3 py-2 border-b border-[color-mix(in_srgb,var(--c-primary)_10%,transparent)] flex items-center justify-between">
              <span className="text-[var(--c-muted)] text-xs font-mono tracking-widest">
                {loading ? 'LOADING...' : `${data.length} ${currentTab.label} REGISTERED`}
              </span>
              {error && <span className="text-red-500 text-xs font-mono">{error}</span>}
            </div>

            {/* Loading */}
            {loading && (
              <div className="px-3 py-8 text-center">
                <span className="text-[var(--c-primary)] text-xs font-mono animate-pulse">FETCHING DATA...</span>
              </div>
            )}

            {/* Rows */}
            {!loading && data.map((row, i) => renderRow(row, i))}

            {/* Empty state */}
            {!loading && data.length === 0 && !error && (
              <div className="px-3 py-8 text-center text-[var(--c-muted)] text-xs font-mono">
                NO RECORDS FOUND
              </div>
            )}

            {/* Add form */}
            {isAdding && (
              <div className="border-t border-[color-mix(in_srgb,var(--c-primary)_10%,transparent)]">
                {renderFormFields(currentTab.formFields, addForm, setAddForm, false)}
              </div>
            )}

            {/* Add button */}
            {!loading && !isAdding && (
              <div className="px-3 py-3">
                <button onClick={initAddForm} className={btnPrimary}>
                  [ + ADD NEW ]
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
