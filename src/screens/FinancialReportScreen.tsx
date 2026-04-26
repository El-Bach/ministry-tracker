// src/screens/FinancialReportScreen.tsx
// Financial report with: date range (closed_at), My Files / All Files, status group,
// stage filter, C/V USD column, and exchange rate edit.
// Session 30: full filter overhaul + C/V USD

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { theme } from '../theme';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Calendar } from 'react-native-calendars';

import supabase from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

// ─── Terminal statuses ───────────────────────────────────────
const TERMINAL = ['Done', 'Rejected', 'Received & Closed'];
const ACTIVE_LABELS = ['Submitted', 'In Review', 'Pending', 'Pending Signature'];

// ─── Types ───────────────────────────────────────────────────
interface Transaction {
  id: string;
  type: 'expense' | 'revenue';
  description: string;
  amount_usd: number;
  amount_lbp: number;
  stop_id?: string | null;
  stop_ministry_id?: string | null;
  created_at: string;
  creator?: { name: string };
}

interface ReportRow {
  taskId: string;
  clientName: string;
  serviceName: string;
  status: string;
  isArchived: boolean;
  closedAt: string | null;
  createdAt: string;
  assignedTo: string | null;
  contractPriceUSD: number;
  contractPriceLBP: number;
  // received (revenue)
  receivedUSD: number;
  receivedLBP: number;
  // expenses
  expenseUSD: number;
  expenseLBP: number;
  // derived
  outstandingUSD: number;
  outstandingLBP: number;
  balanceUSD: number;
  balanceLBP: number;
  // C/V USD (all amounts converted to USD using org rate)
  cvReceivedUSD: number;
  cvExpenseUSD: number;
  cvBalanceUSD: number;
}

// ─── Helpers ─────────────────────────────────────────────────
const fmtUSD = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtLBP = (n: number) =>
  `LBP ${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const cvFmt = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function isoToYMD(iso: string) { return iso.slice(0, 10); }

// ─── Main screen ─────────────────────────────────────────────
export default function FinancialReportScreen() {
  const { teamMember, organization } = useAuth();

  // Exchange rate
  const orgRate = organization?.usd_to_lbp_rate ?? 89500;
  const [rate, setRate] = useState(orgRate);
  const [showRateModal, setShowRateModal] = useState(false);
  const [rateInput, setRateInput] = useState(orgRate.toLocaleString('en-US'));
  const [savingRate, setSavingRate] = useState(false);

  const handleSaveRate = async () => {
    const parsed = parseInt(rateInput.replace(/,/g, ''), 10);
    if (!parsed || parsed < 1000) { Alert.alert('Invalid', 'Enter a valid rate.'); return; }
    setRate(parsed);
    setRateInput(parsed.toLocaleString('en-US'));
    // Also persist to org
    if (teamMember?.org_id) {
      setSavingRate(true);
      await supabase.from('organizations').update({ usd_to_lbp_rate: parsed }).eq('id', teamMember.org_id);
      setSavingRate(false);
    }
    setShowRateModal(false);
  };

  // ── Data ─────────────────────────────────────────────────
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageOptions, setStageOptions] = useState<{ id: string; name: string }[]>([]);
  const [serviceOptions, setServiceOptions] = useState<string[]>([]);

  // ── Filters ──────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [filterService, setFilterService] = useState('');
  const [filterStatusGroup, setFilterStatusGroup] = useState<'terminal' | 'active' | 'all'>('terminal');
  const [filterScope, setFilterScope] = useState<'all' | 'mine'>('all');
  const [filterStage, setFilterStage] = useState(''); // ministry id
  const [filterStageName, setFilterStageName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ── Picker visibility ─────────────────────────────────────
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [showStagePicker, setShowStagePicker] = useState(false);
  const [showDateFrom, setShowDateFrom] = useState(false);
  const [showDateTo, setShowDateTo] = useState(false);

  // ── Detail modal ──────────────────────────────────────────
  const [detailRow, setDetailRow] = useState<ReportRow | null>(null);
  const [detailTxs, setDetailTxs] = useState<Transaction[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPriceHistory, setDetailPriceHistory] = useState<any[]>([]);

  // ── Fetch ─────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);

    // Tasks with client, service, closed_at
    const { data: tasks, error: tasksErr } = await supabase
      .from('tasks')
      .select('id, current_status, is_archived, price_usd, price_lbp, created_at, closed_at, assigned_to, client:clients(name), service:services(name)')
      .order('created_at', { ascending: false });

    if (tasksErr || !tasks) { setLoading(false); return; }

    // Transactions with stop → ministry (for stage filter)
    const { data: txs } = await supabase
      .from('file_transactions')
      .select('task_id, type, amount_usd, amount_lbp, stop_id, stop:task_route_stops(ministry_id)');

    // Ministry options for stage filter
    const { data: ministries } = await supabase
      .from('ministries')
      .select('id, name')
      .order('name');
    if (ministries) setStageOptions(ministries as { id: string; name: string }[]);

    // Build txMap — keyed by task_id, optionally filtered by ministry
    type TxGroup = { revenueUSD: number; revenueLBP: number; expenseUSD: number; expenseLBP: number };
    const buildTxMap = (ministryFilter: string): Record<string, TxGroup> => {
      const map: Record<string, TxGroup> = {};
      for (const tx of txs ?? []) {
        if (ministryFilter) {
          const mid = (tx.stop as any)?.ministry_id;
          if (mid !== ministryFilter) continue;
        }
        if (!map[tx.task_id]) map[tx.task_id] = { revenueUSD: 0, revenueLBP: 0, expenseUSD: 0, expenseLBP: 0 };
        if (tx.type === 'revenue') {
          map[tx.task_id].revenueUSD += tx.amount_usd ?? 0;
          map[tx.task_id].revenueLBP += tx.amount_lbp ?? 0;
        } else {
          map[tx.task_id].expenseUSD += tx.amount_usd ?? 0;
          map[tx.task_id].expenseLBP += tx.amount_lbp ?? 0;
        }
      }
      return map;
    };

    const txMap = buildTxMap(''); // full map; stage filter applied in useMemo

    const built: ReportRow[] = tasks.map((t: any) => {
      const tg = txMap[t.id] ?? { revenueUSD: 0, revenueLBP: 0, expenseUSD: 0, expenseLBP: 0 };
      const cUSD = t.price_usd ?? 0;
      const cLBP = t.price_lbp ?? 0;
      const cvRec = tg.revenueUSD + tg.revenueLBP / rate;
      const cvExp = tg.expenseUSD + tg.expenseLBP / rate;
      return {
        taskId:          t.id,
        clientName:      t.client?.name ?? '—',
        serviceName:     t.service?.name ?? '—',
        status:          t.current_status ?? '—',
        isArchived:      t.is_archived ?? false,
        closedAt:        t.closed_at ?? null,
        createdAt:       t.created_at,
        assignedTo:      t.assigned_to ?? null,
        contractPriceUSD: cUSD,
        contractPriceLBP: cLBP,
        receivedUSD:     tg.revenueUSD,
        receivedLBP:     tg.revenueLBP,
        expenseUSD:      tg.expenseUSD,
        expenseLBP:      tg.expenseLBP,
        outstandingUSD:  cUSD - tg.revenueUSD,
        outstandingLBP:  cLBP - tg.revenueLBP,
        balanceUSD:      tg.revenueUSD - tg.expenseUSD,
        balanceLBP:      tg.revenueLBP - tg.expenseLBP,
        cvReceivedUSD:   cvRec,
        cvExpenseUSD:    cvExp,
        cvBalanceUSD:    cvRec - cvExp,
      };
    });

    setRows(built);
    setServiceOptions([...new Set(built.map((r) => r.serviceName))].sort());
    setLoading(false);
  }, [rate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Stage filter rebuilds txMap ───────────────────────────
  const [stagedRows, setStagedRows] = useState<ReportRow[]>([]);
  useEffect(() => {
    if (!filterStage) { setStagedRows(rows); return; }
    // Re-fetch transactions filtered by selected ministry
    (async () => {
      const { data: txs } = await supabase
        .from('file_transactions')
        .select('task_id, type, amount_usd, amount_lbp, stop:task_route_stops(ministry_id)');

      const map: Record<string, { revenueUSD: number; revenueLBP: number; expenseUSD: number; expenseLBP: number }> = {};
      for (const tx of txs ?? []) {
        const mid = (tx.stop as any)?.ministry_id;
        if (mid !== filterStage) continue;
        if (!map[tx.task_id]) map[tx.task_id] = { revenueUSD: 0, revenueLBP: 0, expenseUSD: 0, expenseLBP: 0 };
        if (tx.type === 'revenue') { map[tx.task_id].revenueUSD += tx.amount_usd ?? 0; map[tx.task_id].revenueLBP += tx.amount_lbp ?? 0; }
        else { map[tx.task_id].expenseUSD += tx.amount_usd ?? 0; map[tx.task_id].expenseLBP += tx.amount_lbp ?? 0; }
      }

      // Only show files that have at least one transaction in this stage
      const updated = rows
        .filter((r) => !!map[r.taskId])
        .map((r) => {
          const tg = map[r.taskId];
          const cvRec = tg.revenueUSD + tg.revenueLBP / rate;
          const cvExp = tg.expenseUSD + tg.expenseLBP / rate;
          return {
            ...r,
            receivedUSD:   tg.revenueUSD,  receivedLBP:  tg.revenueLBP,
            expenseUSD:    tg.expenseUSD,   expenseLBP:   tg.expenseLBP,
            outstandingUSD: r.contractPriceUSD - tg.revenueUSD,
            outstandingLBP: r.contractPriceLBP - tg.revenueLBP,
            balanceUSD:    tg.revenueUSD - tg.expenseUSD,
            balanceLBP:    tg.revenueLBP - tg.expenseLBP,
            cvReceivedUSD: cvRec, cvExpenseUSD: cvExp, cvBalanceUSD: cvRec - cvExp,
          };
        });
      setStagedRows(updated);
    })();
  }, [filterStage, rows, rate]);

  // ── Apply all filters ─────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return stagedRows.filter((r) => {
      if (q && !r.clientName.toLowerCase().includes(q) && !r.serviceName.toLowerCase().includes(q)) return false;
      if (filterService && r.serviceName !== filterService) return false;
      if (filterScope === 'mine' && r.assignedTo !== teamMember?.id) return false;
      // Status group
      if (filterStatusGroup === 'terminal' && !TERMINAL.includes(r.status)) return false;
      if (filterStatusGroup === 'active'   && TERMINAL.includes(r.status))  return false;
      // Date range — filter by closed_at
      if (dateFrom || dateTo) {
        const closedYMD = r.closedAt ? isoToYMD(r.closedAt) : null;
        if (!closedYMD) return false; // no closed_at → exclude from date-filtered results
        if (dateFrom && closedYMD < dateFrom) return false;
        if (dateTo   && closedYMD > dateTo)   return false;
      }
      return true;
    });
  }, [stagedRows, search, filterService, filterScope, filterStatusGroup, dateFrom, dateTo, teamMember]);

  // ── Totals ────────────────────────────────────────────────
  const totals = useMemo(() => ({
    contractUSD:    filtered.reduce((s, r) => s + r.contractPriceUSD, 0),
    contractLBP:    filtered.reduce((s, r) => s + r.contractPriceLBP, 0),
    receivedUSD:    filtered.reduce((s, r) => s + r.receivedUSD,   0),
    receivedLBP:    filtered.reduce((s, r) => s + r.receivedLBP,   0),
    expenseUSD:     filtered.reduce((s, r) => s + r.expenseUSD,    0),
    expenseLBP:     filtered.reduce((s, r) => s + r.expenseLBP,    0),
    outstandingUSD: filtered.reduce((s, r) => s + r.outstandingUSD, 0),
    outstandingLBP: filtered.reduce((s, r) => s + r.outstandingLBP, 0),
    balanceUSD:     filtered.reduce((s, r) => s + r.balanceUSD,    0),
    balanceLBP:     filtered.reduce((s, r) => s + r.balanceLBP,    0),
    cvReceived:     filtered.reduce((s, r) => s + r.cvReceivedUSD, 0),
    cvExpense:      filtered.reduce((s, r) => s + r.cvExpenseUSD,  0),
    cvBalance:      filtered.reduce((s, r) => s + r.cvBalanceUSD,  0),
  }), [filtered]);

  // ── Detail modal ──────────────────────────────────────────
  const openDetail = async (row: ReportRow) => {
    setDetailRow(row);
    setDetailLoading(true);
    const [txRes, phRes] = await Promise.all([
      supabase
        .from('file_transactions')
        .select('*, creator:team_members!created_by(name), stop:task_route_stops(ministry:ministries(name))')
        .eq('task_id', row.taskId)
        .order('created_at', { ascending: false }),
      supabase
        .from('task_price_history')
        .select('*, changer:team_members!changed_by(name)')
        .eq('task_id', row.taskId)
        .order('created_at', { ascending: false }),
    ]);
    setDetailTxs((txRes.data ?? []) as Transaction[]);
    setDetailPriceHistory((phRes.data ?? []) as any[]);
    setDetailLoading(false);
  };

  // ── Clear all filters ────────────────────────────────────
  const hasFilters = !!(search || filterService || filterStage || dateFrom || dateTo || filterScope !== 'all' || filterStatusGroup !== 'terminal');

  const clearFilters = () => {
    setSearch(''); setFilterService(''); setFilterStage(''); setFilterStageName('');
    setDateFrom(''); setDateTo(''); setFilterScope('all'); setFilterStatusGroup('terminal');
  };

  // ── PDF export ────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);
  const exportPDF = useCallback(async () => {
    setExporting(true);
    try {
      const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const filterDesc = [
        filterService   ? `Service: ${filterService}` : '',
        filterStageName ? `Stage: ${filterStageName}`  : '',
        dateFrom        ? `From: ${dateFrom}`           : '',
        dateTo          ? `To: ${dateTo}`               : '',
        filterScope === 'mine'     ? 'My Files only'   : '',
        filterStatusGroup === 'terminal' ? 'Closed files' : filterStatusGroup === 'active' ? 'Active files' : '',
        search          ? `Search: "${search}"`         : '',
      ].filter(Boolean).join(' · ') || 'All files';

      const tableRows = filtered.map((r) => `
        <tr>
          <td>${r.clientName}</td>
          <td>${r.serviceName}</td>
          <td class="status">${r.status}</td>
          <td class="date">${r.closedAt ? formatDate(r.closedAt) : '—'}</td>
          <td class="num">${r.contractPriceUSD > 0 ? fmtUSD(r.contractPriceUSD) : '—'}<br/>${r.contractPriceLBP > 0 ? `<span class="sub">${fmtLBP(r.contractPriceLBP)}</span>` : ''}</td>
          <td class="num green">${fmtUSD(r.receivedUSD)}<br/>${r.receivedLBP > 0 ? `<span class="sub">${fmtLBP(r.receivedLBP)}</span>` : ''}</td>
          <td class="num green">${cvFmt(r.cvReceivedUSD)}</td>
          <td class="num ${r.outstandingUSD > 0 ? 'red' : 'green'}">${fmtUSD(r.outstandingUSD)}</td>
          <td class="num red">${r.expenseUSD > 0 ? fmtUSD(r.expenseUSD) : '—'}<br/>${r.expenseLBP > 0 ? `<span class="sub">${fmtLBP(r.expenseLBP)}</span>` : ''}</td>
          <td class="num red">${cvFmt(r.cvExpenseUSD)}</td>
          <td class="num ${r.cvBalanceUSD >= 0 ? 'green' : 'red'}">${r.cvBalanceUSD >= 0 ? '+' : ''}${cvFmt(r.cvBalanceUSD)}</td>
        </tr>`).join('');

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  body{font-family:-apple-system,Arial,sans-serif;margin:0;padding:24px;background:#fff;color:#1e293b;font-size:11px}
  h1{font-size:18px;font-weight:700;margin:0 0 4px}
  .meta{color:#64748b;font-size:10px;margin-bottom:4px}
  .rate{color:#6366f1;font-size:10px;margin-bottom:14px}
  .totals{display:flex;gap:0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:18px}
  .tot-cell{flex:1;padding:8px 10px;border-right:1px solid #e2e8f0}
  .tot-cell:last-child{border-right:none}
  .tot-label{font-size:8px;font-weight:700;color:#94a3b8;letter-spacing:.5px;text-transform:uppercase;margin-bottom:3px}
  .tot-val{font-size:12px;font-weight:700}.tot-sub{font-size:8px;color:#64748b;margin-top:1px}
  .green{color:#10b981}.red{color:#ef4444}.blue{color:#6366f1}
  table{width:100%;border-collapse:collapse}
  thead tr{background:#f1f5f9}
  th{padding:6px 4px;text-align:left;font-size:8px;font-weight:700;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0}
  td{padding:6px 4px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  .num{text-align:right;font-weight:600}.date{font-size:9px}.status{font-size:9px}
  .sub{font-size:8px;color:#94a3b8;display:block;margin-top:1px}
  tfoot tr{background:#f8fafc;font-weight:700;border-top:2px solid #e2e8f0}
  tfoot td{padding:8px 4px}
</style></head><body>
  <h1>Financial Report</h1>
  <div class="meta">Generated ${dateStr} · ${filterDesc} · ${filtered.length} file${filtered.length !== 1 ? 's' : ''}</div>
  <div class="rate">Exchange rate: 1 USD = ${rate.toLocaleString('en-US')} LBP</div>
  <div class="totals">
    <div class="tot-cell"><div class="tot-label">${filtered.length} Files · Contract</div><div class="tot-val blue">${fmtUSD(totals.contractUSD)}</div>${totals.contractLBP > 0 ? `<div class="tot-sub">${fmtLBP(totals.contractLBP)}</div>` : ''}</div>
    <div class="tot-cell"><div class="tot-label">Received</div><div class="tot-val green">${fmtUSD(totals.receivedUSD)}</div>${totals.receivedLBP > 0 ? `<div class="tot-sub green">${fmtLBP(totals.receivedLBP)}</div>` : ''}</div>
    <div class="tot-cell"><div class="tot-label">C/V Received</div><div class="tot-val green">${cvFmt(totals.cvReceived)}</div></div>
    <div class="tot-cell"><div class="tot-label">Due</div><div class="tot-val ${totals.outstandingUSD > 0 ? 'red' : 'green'}">${fmtUSD(totals.outstandingUSD)}</div></div>
    <div class="tot-cell"><div class="tot-label">Expenses</div><div class="tot-val red">${fmtUSD(totals.expenseUSD)}</div>${totals.expenseLBP > 0 ? `<div class="tot-sub red">${fmtLBP(totals.expenseLBP)}</div>` : ''}</div>
    <div class="tot-cell"><div class="tot-label">C/V Expense</div><div class="tot-val red">${cvFmt(totals.cvExpense)}</div></div>
    <div class="tot-cell"><div class="tot-label">Balance C/V</div><div class="tot-val ${totals.cvBalance >= 0 ? 'green' : 'red'}">${totals.cvBalance >= 0 ? '+' : ''}${cvFmt(totals.cvBalance)}</div></div>
  </div>
  <table>
    <thead><tr>
      <th>Client</th><th>Service</th><th>Status</th><th>Closed</th>
      <th style="text-align:right">Contract</th>
      <th style="text-align:right">Received</th><th style="text-align:right">C/V Rec.</th>
      <th style="text-align:right">Due</th>
      <th style="text-align:right">Expenses</th><th style="text-align:right">C/V Exp.</th>
      <th style="text-align:right">C/V Balance</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
    <tfoot><tr>
      <td colspan="4">TOTAL (${filtered.length} files)</td>
      <td class="num blue">${fmtUSD(totals.contractUSD)}</td>
      <td class="num green">${fmtUSD(totals.receivedUSD)}</td>
      <td class="num green">${cvFmt(totals.cvReceived)}</td>
      <td class="num ${totals.outstandingUSD > 0 ? 'red' : 'green'}">${fmtUSD(totals.outstandingUSD)}</td>
      <td class="num red">${totals.expenseUSD > 0 ? fmtUSD(totals.expenseUSD) : '—'}</td>
      <td class="num red">${cvFmt(totals.cvExpense)}</td>
      <td class="num ${totals.cvBalance >= 0 ? 'green' : 'red'}">${totals.cvBalance >= 0 ? '+' : ''}${cvFmt(totals.cvBalance)}</td>
    </tr></tfoot>
  </table>
</body></html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const reportName = `financial-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      const dest = (FileSystem.cacheDirectory ?? '') + reportName;
      await FileSystem.copyAsync({ from: uri, to: dest });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(dest, { mimeType: 'application/pdf', dialogTitle: 'Export Financial Report' });
      else Alert.alert('Sharing unavailable', 'Cannot share files on this device.');
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Unknown error');
    } finally {
      setExporting(false);
    }
  }, [filtered, totals, rate, filterService, filterStageName, filterStatusGroup, filterScope, dateFrom, dateTo, search]);

  // ── Render row ────────────────────────────────────────────
  const renderRow = ({ item: r }: { item: ReportRow }) => (
    <TouchableOpacity style={s.row} onPress={() => openDetail(r)} activeOpacity={0.75}>
      <View style={s.rowTop}>
        <View style={{ flex: 1 }}>
          <View style={s.rowClientRow}>
            <Text style={s.rowClient} numberOfLines={1}>{r.clientName}</Text>
            {r.contractPriceUSD > 0 && <Text style={s.rowContractBadge}>{fmtUSD(r.contractPriceUSD)}</Text>}
            {r.contractPriceLBP > 0 && <Text style={s.rowContractBadgeLBP}>{fmtLBP(r.contractPriceLBP)}</Text>}
          </View>
          <Text style={s.rowService}>{r.serviceName}</Text>
          {r.closedAt && <Text style={s.rowDate}>Closed {formatDate(r.closedAt)}</Text>}
        </View>
        <View style={[s.statusPill, { backgroundColor: TERMINAL.includes(r.status) ? theme.color.success + '22' : theme.color.primary + '22' }]}>
          <Text style={[s.statusPillText, { color: TERMINAL.includes(r.status) ? theme.color.success : theme.color.primaryText }]}>{r.status}</Text>
        </View>
      </View>

      {/* 4-column C/V grid */}
      <View style={s.rowFinRow}>
        <View style={s.rowFinCell}>
          <Text style={s.rowFinLabel}>RECEIVED</Text>
          <Text style={[s.rowFinValue, s.positive]}>{fmtUSD(r.receivedUSD)}</Text>
          {r.receivedLBP > 0 && <Text style={[s.rowFinSub, s.positive]}>{fmtLBP(r.receivedLBP)}</Text>}
        </View>
        <View style={s.rowFinCell}>
          <Text style={s.rowFinLabel}>C/V USD</Text>
          <Text style={[s.rowFinValue, s.positive]}>{cvFmt(r.cvReceivedUSD)}</Text>
        </View>
        <View style={s.rowFinCell}>
          <Text style={s.rowFinLabel}>EXPENSES</Text>
          <Text style={[s.rowFinValue, s.negative]}>{fmtUSD(r.expenseUSD)}</Text>
          {r.expenseLBP > 0 && <Text style={[s.rowFinSub, s.negative]}>{fmtLBP(r.expenseLBP)}</Text>}
        </View>
        <View style={s.rowFinCell}>
          <Text style={s.rowFinLabel}>BALANCE</Text>
          <Text style={[s.rowFinValue, r.cvBalanceUSD >= 0 ? s.positive : s.negative]}>
            {r.cvBalanceUSD >= 0 ? '+' : '-'}{cvFmt(Math.abs(r.cvBalanceUSD))}
          </Text>
        </View>
      </View>
      <Text style={s.rowTapHint}>Tap for details ›</Text>
    </TouchableOpacity>
  );

  // ── Main render ───────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {/* ── Filters ── */}
      <ScrollView style={s.filtersScroll} contentContainerStyle={s.filtersContent} horizontal={false} showsVerticalScrollIndicator={false}>

        {/* Search */}
        <TextInput
          style={s.searchInput}
          placeholder="Search client or service..."
          placeholderTextColor={theme.color.textMuted}
          value={search}
          onChangeText={setSearch}
        />

        {/* Row 1: Status group */}
        <View style={s.filterRow}>
          <Text style={s.filterGroupLabel}>STATUS</Text>
          {(['terminal', 'active', 'all'] as const).map((g) => (
            <TouchableOpacity
              key={g}
              style={[s.filterChip, filterStatusGroup === g && s.filterChipActive]}
              onPress={() => setFilterStatusGroup(g)}
            >
              <Text style={[s.filterChipText, filterStatusGroup === g && s.filterChipTextActive]}>
                {g === 'terminal' ? '✓ Closed' : g === 'active' ? '⏳ Active' : '📋 All'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Row 2: Scope + Service + Stage */}
        <View style={s.filterRow}>
          <TouchableOpacity
            style={[s.filterChip, filterScope === 'mine' && s.filterChipActive]}
            onPress={() => setFilterScope((v) => v === 'all' ? 'mine' : 'all')}
          >
            <Text style={[s.filterChipText, filterScope === 'mine' && s.filterChipTextActive]}>
              {filterScope === 'mine' ? '👤 My Files' : '👥 All Files'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.filterChip, !!filterService && s.filterChipActive]}
            onPress={() => setShowServicePicker(true)}
          >
            <Text style={[s.filterChipText, !!filterService && s.filterChipTextActive]}>
              {filterService || '🔧 Service'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.filterChip, !!filterStage && s.filterChipActive]}
            onPress={() => setShowStagePicker(true)}
          >
            <Text style={[s.filterChipText, !!filterStage && s.filterChipTextActive]}>
              {filterStageName || '📋 Stage'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Row 3: Date range + Rate + Clear + PDF */}
        <View style={s.filterRow}>
          <TouchableOpacity
            style={[s.filterChip, !!dateFrom && s.filterChipActive]}
            onPress={() => setShowDateFrom(true)}
          >
            <Text style={[s.filterChipText, !!dateFrom && s.filterChipTextActive]}>
              📅 {dateFrom || 'From'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.filterChip, !!dateTo && s.filterChipActive]}
            onPress={() => setShowDateTo(true)}
          >
            <Text style={[s.filterChipText, !!dateTo && s.filterChipTextActive]}>
              📅 {dateTo || 'To'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.rateChip}
            onPress={() => { setRateInput(rate.toLocaleString('en-US')); setShowRateModal(true); }}
          >
            <Text style={s.rateChipText}>💱 {rate.toLocaleString('en-US')}</Text>
          </TouchableOpacity>

          {hasFilters && (
            <TouchableOpacity style={s.clearBtn} onPress={clearFilters}>
              <Text style={s.clearBtnText}>✕ Clear</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[s.exportBtn, (exporting || filtered.length === 0) && { opacity: 0.5 }]}
            onPress={exportPDF}
            disabled={exporting || filtered.length === 0}
          >
            <Text style={s.exportBtnText}>{exporting ? '...' : '📄 PDF'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Totals bar ── */}
      <View style={s.totalsBar}>
        <View style={s.totalCell}>
          <Text style={s.totalLabel}>{filtered.length} FILES</Text>
          <Text style={s.totalValueNeutral}>{fmtUSD(totals.contractUSD)}</Text>
          {totals.contractLBP > 0 && <Text style={s.totalValueSubNeutral}>{fmtLBP(totals.contractLBP)}</Text>}
        </View>
        <View style={s.totalCell}>
          <Text style={s.totalLabel}>RECEIVED</Text>
          <Text style={[s.totalValue, s.positive]}>{fmtUSD(totals.receivedUSD)}</Text>
          {totals.receivedLBP > 0 && <Text style={[s.totalValueSub, s.positive]}>{fmtLBP(totals.receivedLBP)}</Text>}
        </View>
        <View style={s.totalCell}>
          <Text style={s.totalLabel}>C/V USD</Text>
          <Text style={[s.totalValue, s.positive]}>{cvFmt(totals.cvReceived)}</Text>
        </View>
        <View style={s.totalCell}>
          <Text style={s.totalLabel}>BALANCE</Text>
          <Text style={[s.totalValue, totals.cvBalance >= 0 ? s.positive : s.negative]}>
            {totals.cvBalance >= 0 ? '+' : '-'}{cvFmt(Math.abs(totals.cvBalance))}
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.color.primary} style={{ marginTop: 60 }} size="large" />
      ) : filtered.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>No files match your filters</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.taskId}
          renderItem={renderRow}
          contentContainerStyle={s.list}
        />
      )}

      {/* ── Service picker ── */}
      <Modal visible={showServicePicker} transparent animationType="fade" onRequestClose={() => setShowServicePicker(false)}>
        <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={() => setShowServicePicker(false)}>
          <View style={s.pickerSheet}>
            <Text style={s.pickerTitle}>Filter by Service</Text>
            <ScrollView>
              <TouchableOpacity style={s.pickerRow} onPress={() => { setFilterService(''); setShowServicePicker(false); }}>
                <Text style={[s.pickerLabel, !filterService && s.pickerLabelSelected]}>All Services</Text>
                {!filterService && <Text style={s.pickerCheck}>✓</Text>}
              </TouchableOpacity>
              {serviceOptions.map((svc) => (
                <TouchableOpacity key={svc} style={s.pickerRow} onPress={() => { setFilterService(svc); setShowServicePicker(false); }}>
                  <Text style={[s.pickerLabel, filterService === svc && s.pickerLabelSelected]}>{svc}</Text>
                  {filterService === svc && <Text style={s.pickerCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Stage picker ── */}
      <Modal visible={showStagePicker} transparent animationType="fade" onRequestClose={() => setShowStagePicker(false)}>
        <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={() => setShowStagePicker(false)}>
          <View style={s.pickerSheet}>
            <Text style={s.pickerTitle}>Filter by Stage</Text>
            <ScrollView>
              <TouchableOpacity style={s.pickerRow} onPress={() => { setFilterStage(''); setFilterStageName(''); setShowStagePicker(false); }}>
                <Text style={[s.pickerLabel, !filterStage && s.pickerLabelSelected]}>All Stages</Text>
                {!filterStage && <Text style={s.pickerCheck}>✓</Text>}
              </TouchableOpacity>
              {stageOptions.map((st) => (
                <TouchableOpacity key={st.id} style={s.pickerRow} onPress={() => { setFilterStage(st.id); setFilterStageName(st.name); setShowStagePicker(false); }}>
                  <Text style={[s.pickerLabel, filterStage === st.id && s.pickerLabelSelected]}>{st.name}</Text>
                  {filterStage === st.id && <Text style={s.pickerCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Date From picker ── */}
      <Modal visible={showDateFrom} transparent animationType="fade" onRequestClose={() => setShowDateFrom(false)}>
        <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={() => setShowDateFrom(false)}>
          <TouchableOpacity activeOpacity={1} style={s.calendarSheet}>
            <Text style={s.pickerTitle}>From Date (closed)</Text>
            <Calendar
              current={dateFrom || undefined}
              onDayPress={(d: { dateString: string }) => { setDateFrom(d.dateString); setShowDateFrom(false); }}
              markedDates={dateFrom ? { [dateFrom]: { selected: true, selectedColor: theme.color.primary } } : {}}
              theme={{ calendarBackground: theme.color.bgSurface, dayTextColor: theme.color.textPrimary, monthTextColor: theme.color.textPrimary, arrowColor: theme.color.primary, todayTextColor: theme.color.primary, textDisabledColor: theme.color.textMuted }}
            />
            {dateFrom && (
              <TouchableOpacity style={s.clearDateBtn} onPress={() => { setDateFrom(''); setShowDateFrom(false); }}>
                <Text style={s.clearDateBtnText}>✕ Clear date</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Date To picker ── */}
      <Modal visible={showDateTo} transparent animationType="fade" onRequestClose={() => setShowDateTo(false)}>
        <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={() => setShowDateTo(false)}>
          <TouchableOpacity activeOpacity={1} style={s.calendarSheet}>
            <Text style={s.pickerTitle}>To Date (closed)</Text>
            <Calendar
              current={dateTo || undefined}
              onDayPress={(d: { dateString: string }) => { setDateTo(d.dateString); setShowDateTo(false); }}
              markedDates={dateTo ? { [dateTo]: { selected: true, selectedColor: theme.color.primary } } : {}}
              theme={{ calendarBackground: theme.color.bgSurface, dayTextColor: theme.color.textPrimary, monthTextColor: theme.color.textPrimary, arrowColor: theme.color.primary, todayTextColor: theme.color.primary, textDisabledColor: theme.color.textMuted }}
            />
            {dateTo && (
              <TouchableOpacity style={s.clearDateBtn} onPress={() => { setDateTo(''); setShowDateTo(false); }}>
                <Text style={s.clearDateBtnText}>✕ Clear date</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Exchange Rate Modal ── */}
      <Modal visible={showRateModal} transparent animationType="fade" onRequestClose={() => setShowRateModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={() => setShowRateModal(false)}>
            <TouchableOpacity activeOpacity={1} style={s.rateSheet}>
              <Text style={s.pickerTitle}>💱 Exchange Rate</Text>
              <Text style={s.rateSubtext}>1 USD = ? LBP — used for C/V calculations</Text>
              <View style={s.rateInputRow}>
                <Text style={s.rateLabel}>1 USD =</Text>
                <TextInput
                  style={s.rateInput}
                  value={rateInput}
                  onChangeText={setRateInput}
                  keyboardType="number-pad"
                  placeholder="89500"
                  placeholderTextColor={theme.color.textMuted}
                  autoFocus
                />
                <Text style={s.rateLabel}>LBP</Text>
              </View>
              <TouchableOpacity
                style={[s.rateSaveBtn, savingRate && { opacity: 0.6 }]}
                onPress={handleSaveRate}
                disabled={savingRate}
              >
                {savingRate
                  ? <ActivityIndicator color={theme.color.white} />
                  : <Text style={s.rateSaveBtnText}>Save & Apply</Text>
                }
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Payment History Detail Modal ── */}
      <Modal visible={detailRow !== null} transparent animationType="slide" onRequestClose={() => setDetailRow(null)}>
        <View style={s.detailOverlay}>
          <View style={s.detailSheet}>
            <View style={s.detailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.detailClient}>{detailRow?.clientName}</Text>
                <Text style={s.detailService}>{detailRow?.serviceName}</Text>
                {detailRow?.closedAt && <Text style={s.detailService}>Closed {formatDate(detailRow.closedAt)}</Text>}
              </View>
              <TouchableOpacity onPress={() => setDetailRow(null)}>
                <Text style={s.detailClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Summary strip */}
            {detailRow && (
              <View style={s.detailSummary}>
                <View style={s.detailSummaryCell}>
                  <Text style={s.detailSummaryLabel}>CONTRACT</Text>
                  <Text style={s.detailSummaryValue}>{fmtUSD(detailRow.contractPriceUSD)}</Text>
                  {detailRow.contractPriceLBP > 0 && <Text style={s.detailSummarySub}>{fmtLBP(detailRow.contractPriceLBP)}</Text>}
                </View>
                <View style={s.detailSummaryCell}>
                  <Text style={s.detailSummaryLabel}>RECEIVED</Text>
                  <Text style={[s.detailSummaryValue, s.positive]}>{fmtUSD(detailRow.receivedUSD)}</Text>
                  {detailRow.receivedLBP > 0 && <Text style={[s.detailSummarySub, s.positive]}>{fmtLBP(detailRow.receivedLBP)}</Text>}
                </View>
                <View style={s.detailSummaryCell}>
                  <Text style={s.detailSummaryLabel}>C/V USD</Text>
                  <Text style={[s.detailSummaryValue, s.positive]}>{cvFmt(detailRow.cvReceivedUSD)}</Text>
                </View>
                <View style={s.detailSummaryCell}>
                  <Text style={s.detailSummaryLabel}>BALANCE</Text>
                  <Text style={[s.detailSummaryValue, detailRow.cvBalanceUSD >= 0 ? s.positive : s.negative]}>
                    {detailRow.cvBalanceUSD >= 0 ? '+' : '-'}{cvFmt(Math.abs(detailRow.cvBalanceUSD))}
                  </Text>
                </View>
              </View>
            )}

            {detailLoading ? (
              <ActivityIndicator color={theme.color.primary} style={{ marginTop: 40 }} />
            ) : (
              <ScrollView contentContainerStyle={s.detailScroll}>
                {/* Contract price history */}
                {detailPriceHistory.length > 0 && (
                  <View style={s.detailSection}>
                    <Text style={s.detailSectionTitle}>CONTRACT PRICE HISTORY</Text>
                    {detailPriceHistory.map((h) => (
                      <View key={h.id} style={s.detailTxRow}>
                        <View style={[s.detailTxDot, { backgroundColor: theme.color.primary }]} />
                        <View style={{ flex: 1 }}>
                          <View style={s.detailTxAmounts}>
                            <Text style={s.detailTxOld}>{fmtUSD(h.old_price_usd)}</Text>
                            <Text style={s.detailTxArrow}> → </Text>
                            <Text style={[s.detailTxNew, { color: theme.color.primary }]}>{fmtUSD(h.new_price_usd)}</Text>
                          </View>
                          <Text style={s.detailTxMeta}>
                            {h.changer?.name ?? 'Unknown'} · {formatDate(h.created_at)}
                            {h.note ? `  —  ${h.note}` : ''}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Transactions with C/V */}
                <View style={s.detailSection}>
                  <Text style={s.detailSectionTitle}>TRANSACTIONS (÷ {rate.toLocaleString('en-US')} LBP/USD)</Text>
                  {detailTxs.length === 0 ? (
                    <Text style={s.detailEmpty}>No transactions recorded</Text>
                  ) : (
                    <>
                      {/* C/V table header */}
                      <View style={[s.cvMiniRow, s.cvMiniHeader]}>
                        <Text style={[s.cvMiniDesc, s.cvMiniHeaderText]}>DESCRIPTION</Text>
                        <Text style={[s.cvMiniNum, s.cvMiniHeaderText]}>USD</Text>
                        <Text style={[s.cvMiniNum, s.cvMiniHeaderText]}>LBP</Text>
                        <Text style={[s.cvMiniNum, s.cvMiniHeaderText]}>C/V USD</Text>
                      </View>
                      {detailTxs.map((tx) => {
                        const cv = tx.amount_usd > 0 ? tx.amount_usd : tx.amount_lbp / rate;
                        const sign = tx.type === 'revenue' ? '+' : '-';
                        const col = tx.type === 'revenue' ? theme.color.success : theme.color.danger;
                        const stageName = (tx as any).stop?.ministry?.name;
                        return (
                          <View key={tx.id} style={s.cvMiniRow}>
                            <View style={s.cvMiniDescCell}>
                              <Text style={[s.cvMiniDescText, { color: col }]}>{sign} {tx.description || '—'}</Text>
                              {stageName && <Text style={s.cvMiniStagePill}>📌 {stageName}</Text>}
                              <Text style={s.cvMiniMeta}>{tx.creator?.name ?? '—'} · {formatDate(tx.created_at)}</Text>
                            </View>
                            <Text style={[s.cvMiniNum, { color: tx.amount_usd > 0 ? col : theme.color.textMuted }]}>
                              {tx.amount_usd > 0 ? `${sign}${fmtUSD(tx.amount_usd)}` : '—'}
                            </Text>
                            <Text style={[s.cvMiniNum, { color: tx.amount_lbp > 0 ? col : theme.color.textMuted }]}>
                              {tx.amount_lbp > 0 ? `${sign}${fmtLBP(tx.amount_lbp)}` : '—'}
                            </Text>
                            <Text style={[s.cvMiniNum, { color: col, fontWeight: '700' }]}>
                              {sign}{cvFmt(cv)}
                            </Text>
                          </View>
                        );
                      })}
                      {/* Totals row */}
                      {(() => {
                        const totRec = detailTxs.filter(t => t.type === 'revenue').reduce((s, t) => s + (t.amount_usd > 0 ? t.amount_usd : t.amount_lbp / rate), 0);
                        const totExp = detailTxs.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount_usd > 0 ? t.amount_usd : t.amount_lbp / rate), 0);
                        const net = totRec - totExp;
                        return (
                          <View style={[s.cvMiniRow, s.cvMiniTotalRow]}>
                            <Text style={[s.cvMiniDesc, s.cvMiniTotalText]}>TOTAL</Text>
                            <Text style={[s.cvMiniNum, s.cvMiniTotalText]}></Text>
                            <Text style={[s.cvMiniNum, s.cvMiniTotalText]}></Text>
                            <Text style={[s.cvMiniNum, s.cvMiniTotalText, net >= 0 ? s.positive : s.negative]}>
                              {net >= 0 ? '+' : '-'}{cvFmt(Math.abs(net))}
                            </Text>
                          </View>
                        );
                      })()}
                    </>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.bgBase },
  positive: { color: theme.color.success },
  negative: { color: theme.color.danger },

  // Filters
  filtersScroll:  { flexGrow: 0 },
  filtersContent: { padding: theme.spacing.space3, gap: 8, borderBottomWidth: 1, borderBottomColor: theme.color.bgSurface },
  searchInput: {
    backgroundColor: theme.color.bgSurface,
    color:           theme.color.textPrimary,
    borderRadius:    theme.radius.md,
    padding:         theme.spacing.space3,
    ...theme.typography.body,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  filterRow:      { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  filterGroupLabel: { ...theme.typography.sectionDivider, marginEnd: 4 },
  filterChip: {
    backgroundColor:   theme.color.bgSurface,
    borderRadius:      theme.radius.full,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   6,
    borderWidth:       1,
    borderColor:       theme.color.border,
  },
  filterChipActive:     { borderColor: theme.color.primary, backgroundColor: theme.color.primaryDim },
  filterChipText:       { ...theme.typography.label, color: theme.color.textMuted, fontSize: 12 },
  filterChipTextActive: { color: theme.color.primaryText },
  rateChip: {
    backgroundColor: theme.color.primary + '18',
    borderRadius:    theme.radius.full,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 6,
    borderWidth:     1,
    borderColor:     theme.color.primary + '44',
  },
  rateChipText: { ...theme.typography.label, color: theme.color.primaryText, fontSize: 12 },
  clearBtn:     { paddingHorizontal: 8, paddingVertical: 6 },
  clearBtnText: { ...theme.typography.label, color: theme.color.danger },
  exportBtn: {
    marginStart:       'auto' as any,
    backgroundColor:   theme.color.primary,
    borderRadius:      theme.radius.full,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   6,
  },
  exportBtnText: { ...theme.typography.label, color: theme.color.white, fontWeight: '700' },

  // Totals bar
  totalsBar: {
    flexDirection:     'row',
    backgroundColor:   theme.color.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  totalCell:            { flex: 1, padding: theme.spacing.space3, alignItems: 'center', borderRightWidth: 1, borderRightColor: theme.color.border },
  totalLabel:           { ...theme.typography.sectionDivider, marginBottom: 2 },
  totalValue:           { ...theme.typography.label, fontWeight: '700', fontSize: 11 },
  totalValueNeutral:    { ...theme.typography.label, color: theme.color.textSecondary, fontWeight: '700', fontSize: 11 },
  totalValueSub:        { ...theme.typography.caption, fontWeight: '600' },
  totalValueSubNeutral: { ...theme.typography.caption, color: theme.color.textSecondary },

  list:  { padding: theme.spacing.space3, gap: theme.spacing.space2, paddingBottom: 60 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...theme.typography.body, color: theme.color.textMuted },

  // Row card
  row: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.space3,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  rowTop:            { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  rowClientRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  rowClient:         { ...theme.typography.heading, fontSize: 14 },
  rowContractBadge:  { ...theme.typography.body, color: theme.color.primaryText, fontWeight: '700', fontSize: 13 },
  rowContractBadgeLBP: { ...theme.typography.caption, color: theme.color.primary },
  rowService:        { ...theme.typography.caption, marginTop: 2 },
  rowDate:           { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 2 },
  statusPill: {
    borderRadius:      theme.radius.sm,
    paddingHorizontal: theme.spacing.space2,
    paddingVertical:   2,
    marginStart:       theme.spacing.space2,
    alignSelf:         'flex-start',
  },
  statusPillText: { ...theme.typography.caption, fontWeight: '700', fontSize: 10 },
  rowFinRow:   { flexDirection: 'row', gap: 4 },
  rowFinCell:  { flex: 1, backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md, padding: 6 },
  rowFinLabel: { ...theme.typography.sectionDivider, marginBottom: 2, fontSize: 8 },
  rowFinValue: { fontSize: 11, fontWeight: '700' },
  rowFinSub:   { ...theme.typography.caption, fontSize: 9 },
  rowTapHint:  { ...theme.typography.caption, color: theme.color.border, marginTop: 6, textAlign: 'right' },

  // Pickers
  pickerOverlay: { flex: 1, backgroundColor: theme.color.overlayDark, justifyContent: 'center', alignItems: 'center' },
  pickerSheet: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.space4,
    width:           '82%',
    maxHeight:       '70%',
  },
  calendarSheet: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.space3,
    width:           '95%',
  },
  pickerTitle: { ...theme.typography.heading, marginBottom: theme.spacing.space3, textAlign: 'center' },
  pickerRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   theme.spacing.space2 + 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    minHeight:         44,
  },
  pickerLabel:         { ...theme.typography.body, color: theme.color.textSecondary, flex: 1 },
  pickerLabelSelected: { color: theme.color.textPrimary, fontWeight: '600' },
  pickerCheck:         { ...theme.typography.body, color: theme.color.primary, fontWeight: '700' },
  clearDateBtn:        { alignItems: 'center', paddingVertical: 10 },
  clearDateBtnText:    { color: theme.color.danger, fontWeight: '600' },

  // Rate modal
  rateSheet: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.xl,
    padding:         theme.spacing.space5,
    width:           '85%',
    gap:             12,
  },
  rateSubtext:   { ...theme.typography.caption, color: theme.color.textMuted, textAlign: 'center' },
  rateInputRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  rateLabel:     { ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '600' },
  rateInput: {
    backgroundColor:   theme.color.bgBase,
    borderWidth:       1,
    borderColor:       theme.color.primary,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   10,
    color:             theme.color.textPrimary,
    fontSize:          18,
    fontWeight:        '700',
    textAlign:         'center',
    minWidth:          120,
  },
  rateSaveBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.lg,
    paddingVertical: 14,
    alignItems:      'center',
    marginTop:       4,
  },
  rateSaveBtnText: { color: theme.color.white, fontSize: 15, fontWeight: '700' },

  // Detail modal
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  detailSheet: {
    backgroundColor:      theme.color.bgSurface,
    borderTopLeftRadius:  theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    maxHeight:            '92%',
    paddingBottom:        Platform.OS === 'ios' ? 32 : theme.spacing.space4,
  },
  detailHeader: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    padding:           theme.spacing.space4,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  detailClient:  { ...theme.typography.heading },
  detailService: { ...theme.typography.caption, marginTop: 2 },
  detailClose:   { ...theme.typography.heading, color: theme.color.textMuted, paddingStart: 12, minWidth: 40, textAlign: 'center' },
  detailSummary: { flexDirection: 'row', backgroundColor: theme.color.bgBase, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  detailSummaryCell:  { flex: 1, padding: theme.spacing.space3, alignItems: 'center', borderRightWidth: 1, borderRightColor: theme.color.border },
  detailSummaryLabel: { ...theme.typography.sectionDivider, marginBottom: 2, fontSize: 8 },
  detailSummaryValue: { ...theme.typography.label, fontWeight: '700', fontSize: 12 },
  detailSummarySub:   { ...theme.typography.caption, marginTop: 1 },
  detailScroll:       { padding: theme.spacing.space4, paddingBottom: 40 },
  detailSection:      { marginBottom: theme.spacing.space5 },
  detailSectionTitle: { ...theme.typography.sectionDivider, marginBottom: 10 },
  detailEmpty:        { ...theme.typography.body, color: theme.color.border, fontStyle: 'italic' },
  detailTxRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.color.bgBase },
  detailTxDot:   { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  detailTxAmounts: { flexDirection: 'row', alignItems: 'center' },
  detailTxNew:   { ...theme.typography.body, fontSize: 14, fontWeight: '700' },
  detailTxOld:   { ...theme.typography.body, color: theme.color.textMuted },
  detailTxArrow: { ...theme.typography.label, color: theme.color.textMuted },
  detailTxMeta:  { ...theme.typography.caption, marginTop: 2 },

  // C/V mini table inside detail modal
  cvMiniRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    gap: 4,
  },
  cvMiniHeader:     { backgroundColor: theme.color.bgBase },
  cvMiniHeaderText: { color: theme.color.textMuted, fontWeight: '700', fontSize: 9 },
  cvMiniTotalRow:   { backgroundColor: theme.color.bgBase, borderBottomWidth: 0 },
  cvMiniTotalText:  { fontWeight: '700', fontSize: 12 },
  cvMiniDesc:       { flex: 2, fontSize: 11 },
  cvMiniDescCell:   { flex: 2, gap: 2 },
  cvMiniDescText:   { fontSize: 11, fontWeight: '600' },
  cvMiniStagePill:  { ...theme.typography.caption, color: theme.color.textMuted, fontSize: 9 },
  cvMiniMeta:       { ...theme.typography.caption, color: theme.color.textMuted, fontSize: 9 },
  cvMiniNum:        { flex: 1, textAlign: 'right', fontSize: 11 },
});
