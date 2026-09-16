import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import { Database, RefreshCw, Plus, Trash2, Edit2, Search, X, Save, AlertTriangle, CheckCircle } from 'lucide-react';

export default function SuperAdminDbPanel() {
  const [tables, setTables] = useState<string[]>([]);
  const [activeTable, setActiveTable] = useState<string>('');
  const [rows, setRows] = useState<any[]>([]);
  const [schema, setSchema] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(25);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [editJson, setEditJson] = useState('');
  const [creating, setCreating] = useState(false);
  const [createJson, setCreateJson] = useState('{\n  \n}');

  const fetchTables = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/admin/tables`);
      const d = await r.json();
      if (d.success) {
        setTables(d.tables || []);
        if (!activeTable && d.tables?.length) setActiveTable(d.tables[0]);
      } else setStatus({ ok: false, msg: d.error || 'Failed to load tables' });
    } catch (e: any) { setStatus({ ok: false, msg: String(e) }); }
  };
  useEffect(() => { fetchTables(); }, []);

  const fetchRows = async () => {
    if (!activeTable) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (q.trim()) params.set('q', q.trim());
      const r = await fetch(`${API_BASE}/api/admin/${activeTable}?${params}`);
      const d = await r.json();
      if (d.success) { setRows(d.rows || []); setStatus(null); }
      else setStatus({ ok: false, msg: d.error || 'Failed' });
    } catch (e: any) { setStatus({ ok: false, msg: String(e) }); }
    setLoading(false);
  };
  const fetchSchema = async () => {
    if (!activeTable) return;
    try {
      const r = await fetch(`${API_BASE}/api/admin/schema/${activeTable}`);
      const d = await r.json();
      if (d.success) setSchema(d.schema || []);
    } catch {}
  };
  useEffect(() => { if (activeTable) { fetchRows(); fetchSchema(); } }, [activeTable]);

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete ${activeTable} / ${id} ?`)) return;
    try {
      const r = await fetch(`${API_BASE}/api/admin/${activeTable}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const d = await r.json();
      if (d.success) { setStatus({ ok: true, msg: `Deleted ${id}` }); fetchRows(); }
      else setStatus({ ok: false, msg: d.error || 'Delete failed' });
    } catch (e: any) { setStatus({ ok: false, msg: String(e) }); }
  };

  const openEdit = (row: any) => {
    setEditing(row);
    setEditJson(JSON.stringify(row, null, 2));
  };
  const handleUpdate = async () => {
    if (!editing) return;
    let body: any;
    try { body = JSON.parse(editJson); } catch { setStatus({ ok: false, msg: 'Invalid JSON' }); return; }
    const id = editing.id || editing.ID || body.id;
    if (!id) { setStatus({ ok: false, msg: 'Row has no id' }); return; }
    try {
      const r = await fetch(`${API_BASE}/api/admin/${activeTable}/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.success) { setStatus({ ok: true, msg: `Updated ${id}` }); setEditing(null); fetchRows(); }
      else setStatus({ ok: false, msg: d.error || 'Update failed' });
    } catch (e: any) { setStatus({ ok: false, msg: String(e) }); }
  };

  const handleCreate = async () => {
    let body: any;
    try { body = JSON.parse(createJson); } catch { setStatus({ ok: false, msg: 'Invalid JSON' }); return; }
    try {
      const r = await fetch(`${API_BASE}/api/admin/${activeTable}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.success) { setStatus({ ok: true, msg: `Created ${d.row?.id || ''}`.trim() }); setCreating(false); setCreateJson('{\n  \n}'); fetchRows(); }
      else setStatus({ ok: false, msg: d.error || 'Create failed' });
    } catch (e: any) { setStatus({ ok: false, msg: String(e) }); }
  };

  const cols = rows.length ? Object.keys(rows[0]).slice(0, 8) : schema.map((s: any) => s.column_name).slice(0, 8);

  return (
    <div className="bg-white border border-red-100 rounded-3xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-amber-600 text-white flex items-center justify-center"><Database className="h-4 w-4" /></div>
          <div>
            <h3 className="font-black text-sm text-gray-900">Database — Full CRUD</h3>
            <p className="text-[11px] text-gray-500">Superadmin live editor · every table, instant updates</p>
          </div>
        </div>
        <button onClick={() => { fetchTables(); if (activeTable) fetchRows(); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-black"><RefreshCw className="h-3.5 w-3.5" />Refresh</button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tables.map(t => (
          <button key={t} onClick={() => setActiveTable(t)} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${activeTable === t ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-700 border-red-100 hover:border-amber-300'}`}>{t}</button>
        ))}
        {tables.length === 0 && <span className="text-xs text-gray-400">No tables — is Postgres ready? Login as superadmin.</span>}
      </div>

      {activeTable && (
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1.5 flex-1 min-w-[180px] border border-red-100 rounded-xl px-3 py-1.5 bg-red-50/40">
            <Search className="h-3.5 w-3.5 text-gray-400" />
            <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchRows()} placeholder="search (q)" className="flex-1 bg-transparent outline-none text-xs" />
          </div>
          <select value={limit} onChange={e => setLimit(Number(e.target.value))} className="border border-red-100 rounded-xl px-2 py-1.5 text-xs bg-white">
            <option value={25}>25 rows</option><option value={50}>50</option><option value={100}>100</option><option value={200}>200</option>
          </select>
          <button onClick={fetchRows} className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700">Search</button>
          <button onClick={() => setCreating(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"><Plus className="h-3.5 w-3.5" />Add row</button>
        </div>
      )}

      {status && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border ${status.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          {status.ok ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{status.msg}
        </div>
      )}

      {schema.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-gray-600 font-semibold">Schema: {activeTable} ({schema.length} cols) — click to view</summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {schema.map((c: any) => <span key={c.column_name} className="px-2 py-1 rounded-full bg-gray-100 border text-[11px]">{c.column_name} <span className="text-gray-400">{c.data_type}</span></span>)}
          </div>
        </details>
      )}

      <div className="overflow-auto border border-red-100 rounded-2xl max-h-[520px]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-amber-50">
            <tr>{cols.map(c => <th key={c} className="text-left px-3 py-2 font-black text-gray-700 whitespace-nowrap border-b border-red-100">{c}</th>)}<th className="px-3 py-2 text-right border-b border-red-100">Actions</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={cols.length + 1} className="px-3 py-8 text-center text-gray-400">Loading…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={cols.length + 1} className="px-3 py-8 text-center text-gray-400">No rows</td></tr>
                : rows.map((r: any, i: number) => (
                  <tr key={r.id || i} className="hover:bg-amber-50/40 border-b border-red-50">
                    {cols.map(c => <td key={c} className="px-3 py-2 max-w-[180px] truncate text-gray-800" title={String(r[c] ?? '')}>{String(r[c] ?? '').slice(0, 120)}</td>)}
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(r)} className="inline-flex p-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 mr-1"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDelete(r.id)} className="inline-flex p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400">Tip: Edit opens full JSON — change any field, Save does <code>PUT /api/admin/{activeTable}/:id</code>. Table list is live from Postgres <code>information_schema</code>.</p>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-2xl shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-black text-sm">Edit {activeTable} — {editing.id}</h4>
              <button onClick={() => setEditing(null)} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <textarea value={editJson} onChange={e => setEditJson(e.target.value)} rows={18} className="w-full font-mono text-xs border border-red-100 rounded-xl p-3 bg-gray-50 outline-none focus:ring-2 focus:ring-amber-500" />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl border text-xs font-bold">Cancel</button>
              <button onClick={handleUpdate} className="flex items-center gap-1 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700"><Save className="h-3.5 w-3.5" />Save</button>
            </div>
          </div>
        </div>
      )}
      {creating && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setCreating(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-2xl shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-black text-sm">Add row — {activeTable}</h4>
              <button onClick={() => setCreating(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-2">Paste JSON for the new row. Requires <code>id</code> if table is not auto-generated.</p>
            <textarea value={createJson} onChange={e => setCreateJson(e.target.value)} rows={14} className="w-full font-mono text-xs border border-red-100 rounded-xl p-3 bg-gray-50 outline-none focus:ring-2 focus:ring-emerald-500" />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setCreating(false)} className="px-4 py-2 rounded-xl border text-xs font-bold">Cancel</button>
              <button onClick={handleCreate} className="flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"><Plus className="h-3.5 w-3.5" />Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
