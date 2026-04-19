// src/screens/FinancialReportScreen.tsx
// Full financial report across all files — filterable by client, service, status

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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

import supabase from '../lib/supabase';

interface Transaction {
  id: string;
  type: 'expense' | 'revenue';
  description: string;
  amount_usd: number;
  amount_lbp: number;
  created_at: string;
  creator?: { name: string };
}

interface ReportRow {
  taskId: string;
  clientName: string;
  serviceName: string;
  status: string;
  isArchived: boolean;
  createdAt: string;
  contractPriceUSD: number;
  contractPriceLBP: number;
  receivedUSD: number;   // actual payments received
  receivedLBP: number;
  outstandingUSD: number; // contract - received
  outstandingLBP: number;
  expenseUSD: number;
  expenseLBP: number;
  balanceUSD: number;    // received - expenses
  balanceLBP: number;
}

const fmtUSD = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtLBP = (n: number) =>
  `LBP ${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function FinancialReportScreen() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState('');
  const [filterService, setFilterService] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [filterArchive, setFilterArchive] = useState<'all' | 'active' | 'archived'>('all');

  // Available options for pickers
  const [serviceOptions, setServiceOptions] = useState<string[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);

  // Payment history detail modal
  const [detailRow, setDetailRow] = useState<ReportRow | null>(null);
  const [detailTxs, setDetailTxs] = useState<Transaction[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPriceHistory, setDetailPriceHistory] = useState<Array<{id:string;old_price_usd:number;new_price_usd:number;note?:string;changer?:{name:string};created_at:string}>>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Fetch tasks with client + service
    const { data: tasks, error: tasksErr } = await supabase
      .from('tasks')
      .select('id, current_status, is_archived, price_usd, price_lbp, created_at, client:clients(name), service:services(name)')
      .order('created_at', { ascending: false });

    if (tasksErr || !tasks) {
      setLoading(false);
      return;
    }

    // Fetch all transactions in one shot
    const { data: txs } = await supabase
      .from('file_transactions')
      .select('task_id, type, amount_usd, amount_lbp');

    // Group transactions by task_id
    const txMap: Record<string, { revenueUSD: number; revenueLBP: number; expenseUSD: number; expenseLBP: number }> = {};
    for (const tx of txs ?? []) {
      if (!txMap[tx.task_id]) txMap[tx.task_id] = { revenueUSD: 0, revenueLBP: 0, expenseUSD: 0, expenseLBP: 0 };
      if (tx.type === 'revenue') {
        txMap[tx.task_id].revenueUSD += tx.amount_usd ?? 0;
        txMap[tx.task_id].revenueLBP += tx.amount_lbp ?? 0;
      } else {
        txMap[tx.task_id].expenseUSD += tx.amount_usd ?? 0;
        txMap[tx.task_id].expenseLBP += tx.amount_lbp ?? 0;
      }
    }

    const built: ReportRow[] = tasks.map((t: any) => {
      const tg = txMap[t.id] ?? { revenueUSD: 0, revenueLBP: 0, expenseUSD: 0, expenseLBP: 0 };
      const contractUSD = t.price_usd ?? 0;
      const contractLBP = t.price_lbp ?? 0;
      return {
        taskId: t.id,
        clientName: t.client?.name ?? '—',
        serviceName: t.service?.name ?? '—',
        status: t.current_status ?? '—',
        isArchived: t.is_archived ?? false,
        createdAt: t.created_at,
        contractPriceUSD: contractUSD,
        contractPriceLBP: contractLBP,
        receivedUSD: tg.revenueUSD,
        receivedLBP: tg.revenueLBP,
        outstandingUSD: contractUSD - tg.revenueUSD,
        outstandingLBP: contractLBP - tg.revenueLBP,
        expenseUSD: tg.expenseUSD,
        expenseLBP: tg.expenseLBP,
        balanceUSD: tg.revenueUSD - tg.expenseUSD,
        balanceLBP: tg.revenueLBP - tg.expenseLBP,
      };
    });

    setRows(built);

    // Collect unique options
    setServiceOptions([...new Set(built.map((r) => r.serviceName))].sort());
    setStatusOptions([...new Set(built.map((r) => r.status))].sort());

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openDetail = async (row: ReportRow) => {
    setDetailRow(row);
    setDetailLoading(true);
    const [txRes, phRes] = await Promise.all([
      supabase
        .from('file_transactions')
        .select('*, creator:team_members!created_by(name)')
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

  // ─── Filtered rows ───────────────────────────────────────────
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch = !q || r.clientName.toLowerCase().includes(q) || r.serviceName.toLowerCase().includes(q);
      const matchService = !filterService || r.serviceName === filterService;
      const matchStatus = !filterStatus || r.status === filterStatus;
      const matchArchive =
        filterArchive === 'all' ||
        (filterArchive === 'archived' && r.isArchived) ||
        (filterArchive === 'active' && !r.isArchived);
      return matchSearch && matchService && matchStatus && matchArchive;
    });
  }, [rows, search, filterService, filterStatus, filterArchive]);

  // ─── Totals ──────────────────────────────────────────────────
  const totals = useMemo(() => ({
    contractUSD: filtered.reduce((s, r) => s + r.contractPriceUSD, 0),
    contractLBP: filtered.reduce((s, r) => s + r.contractPriceLBP, 0),
    receivedUSD: filtered.reduce((s, r) => s + r.receivedUSD, 0),
    receivedLBP: filtered.reduce((s, r) => s + r.receivedLBP, 0),
    outstandingUSD: filtered.reduce((s, r) => s + r.outstandingUSD, 0),
    outstandingLBP: filtered.reduce((s, r) => s + r.outstandingLBP, 0),
    expenseUSD: filtered.reduce((s, r) => s + r.expenseUSD, 0),
    expenseLBP: filtered.reduce((s, r) => s + r.expenseLBP, 0),
    balanceUSD: filtered.reduce((s, r) => s + r.balanceUSD, 0),
    balanceLBP: filtered.reduce((s, r) => s + r.balanceLBP, 0),
  }), [filtered]);

  // ─── PDF Export ─────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);

  const exportPDF = useCallback(async () => {
    setExporting(true);
    try {
      const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

      const filterDesc = [
        filterService ? `Service: ${filterService}` : '',
        filterStatus  ? `Status: ${filterStatus}`   : '',
        search        ? `Search: "${search}"`         : '',
        filterArchive !== 'all' ? (filterArchive === 'active' ? 'Active files only' : 'Archived files only') : '',
      ].filter(Boolean).join(' · ') || 'All files';

      const tableRows = filtered.map((r) => `
        <tr>
          <td>${r.clientName}</td>
          <td>${r.serviceName}</td>
          <td class="status">${r.status}</td>
          <td class="num">${r.contractPriceUSD > 0 ? fmtUSD(r.contractPriceUSD) : '—'}<br/>${r.contractPriceLBP > 0 ? `<span class="sub">${fmtLBP(r.contractPriceLBP)}</span>` : ''}</td>
          <td class="num green">${fmtUSD(r.receivedUSD)}<br/>${r.receivedLBP > 0 ? `<span class="sub">${fmtLBP(r.receivedLBP)}</span>` : ''}</td>
          <td class="num ${r.outstandingUSD > 0 ? 'red' : 'green'}">${fmtUSD(r.outstandingUSD)}<br/>${r.outstandingLBP !== 0 ? `<span class="sub">${fmtLBP(r.outstandingLBP)}</span>` : ''}</td>
          <td class="num red">${r.expenseUSD > 0 ? fmtUSD(r.expenseUSD) : '—'}<br/>${r.expenseLBP > 0 ? `<span class="sub">${fmtLBP(r.expenseLBP)}</span>` : ''}</td>
          <td class="num ${r.balanceUSD >= 0 ? 'green' : 'red'}">${r.balanceUSD >= 0 ? '+' : ''}${fmtUSD(r.balanceUSD)}<br/>${r.balanceLBP !== 0 ? `<span class="sub">${r.balanceLBP >= 0 ? '+' : ''}${fmtLBP(r.balanceLBP)}</span>` : ''}</td>
        </tr>`).join('');

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body { font-family: -apple-system, Arial, sans-serif; margin: 0; padding: 24px; background: #fff; color: #1e293b; font-size: 12px; }
  h1 { font-size: 20px; font-weight: 700; margin: 0 0 4px; color: #0f172a; }
  .meta { color: #64748b; font-size: 11px; margin-bottom: 16px; }
  .totals { display: flex; gap: 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 20px; }
  .tot-cell { flex: 1; padding: 10px 12px; border-right: 1px solid #e2e8f0; }
  .tot-cell:last-child { border-right: none; }
  .tot-label { font-size: 9px; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 4px; }
  .tot-val { font-size: 13px; font-weight: 700; }
  .tot-sub { font-size: 9px; color: #64748b; margin-top: 2px; }
  .green { color: #10b981; }
  .red   { color: #ef4444; }
  .blue  { color: #6366f1; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #f1f5f9; }
  th { padding: 8px 6px; text-align: left; font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 2px solid #e2e8f0; }
  td { padding: 8px 6px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .num { text-align: right; font-weight: 600; }
  .status { font-size: 10px; }
  .sub { font-size: 9px; color: #94a3b8; display: block; margin-top: 2px; }
  tfoot tr { background: #f8fafc; font-weight: 700; border-top: 2px solid #e2e8f0; }
  tfoot td { padding: 10px 6px; }
</style>
</head>
<body>
  <h1>Financial Report</h1>
  <div class="meta">Generated ${dateStr} · ${filterDesc} · ${filtered.length} file${filtered.length !== 1 ? 's' : ''}</div>

  <div class="totals">
    <div class="tot-cell">
      <div class="tot-label">${filtered.length} Files · Contract</div>
      <div class="tot-val blue">${fmtUSD(totals.contractUSD)}</div>
      ${totals.contractLBP > 0 ? `<div class="tot-sub">${fmtLBP(totals.contractLBP)}</div>` : ''}
    </div>
    <div class="tot-cell">
      <div class="tot-label">Received</div>
      <div class="tot-val green">${fmtUSD(totals.receivedUSD)}</div>
      ${totals.receivedLBP > 0 ? `<div class="tot-sub green">${fmtLBP(totals.receivedLBP)}</div>` : ''}
    </div>
    <div class="tot-cell">
      <div class="tot-label">Due</div>
      <div class="tot-val ${totals.outstandingUSD > 0 ? 'red' : 'green'}">${fmtUSD(totals.outstandingUSD)}</div>
      ${totals.outstandingLBP !== 0 ? `<div class="tot-sub">${fmtLBP(totals.outstandingLBP)}</div>` : ''}
    </div>
    <div class="tot-cell">
      <div class="tot-label">Expenses</div>
      <div class="tot-val red">${fmtUSD(totals.expenseUSD)}</div>
      ${totals.expenseLBP > 0 ? `<div class="tot-sub red">${fmtLBP(totals.expenseLBP)}</div>` : ''}
    </div>
    <div class="tot-cell">
      <div class="tot-label">Balance</div>
      <div class="tot-val ${totals.balanceUSD >= 0 ? 'green' : 'red'}">${totals.balanceUSD >= 0 ? '+' : ''}${fmtUSD(totals.balanceUSD)}</div>
      ${totals.balanceLBP !== 0 ? `<div class="tot-sub">${totals.balanceLBP >= 0 ? '+' : ''}${fmtLBP(totals.balanceLBP)}</div>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Client</th>
        <th>Service</th>
        <th>Status</th>
        <th style="text-align:right">Contract</th>
        <th style="text-align:right">Received</th>
        <th style="text-align:right">Due</th>
        <th style="text-align:right">Expenses</th>
        <th style="text-align:right">Balance</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="3">TOTAL (${filtered.length} files)</td>
        <td class="num blue">${fmtUSD(totals.contractUSD)}</td>
        <td class="num green">${fmtUSD(totals.receivedUSD)}</td>
        <td class="num ${totals.outstandingUSD > 0 ? 'red' : 'green'}">${fmtUSD(totals.outstandingUSD)}</td>
        <td class="num red">${totals.expenseUSD > 0 ? fmtUSD(totals.expenseUSD) : '—'}</td>
        <td class="num ${totals.balanceUSD >= 0 ? 'green' : 'red'}">${totals.balanceUSD >= 0 ? '+' : ''}${fmtUSD(totals.balanceUSD)}</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });

      // Move to a named file in cache so the share sheet shows a clean filename
      const reportName = `financial-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      const dest = (FileSystem.cacheDirectory ?? '') + reportName;
      await FileSystem.copyAsync({ from: uri, to: dest });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(dest, { mimeType: 'application/pdf', dialogTitle: 'Export Financial Report' });
      } else {
        Alert.alert('Sharing unavailable', 'Cannot share files on this device.');
      }
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Unknown error');
    } finally {
      setExporting(false);
    }
  }, [filtered, totals, filterService, filterStatus, search, filterArchive]);

  // ─── Render row ──────────────────────────────────────────────
  const renderRow = ({ item: r }: { item: ReportRow }) => (
    <TouchableOpacity style={s.row} onPress={() => openDetail(r)} activeOpacity={0.75}>
      <View style={s.rowTop}>
        <View style={{ flex: 1 }}>
          <View style={s.rowClientRow}>
            <Text style={s.rowClient} numberOfLines={1}>{r.clientName}</Text>
            {(r.contractPriceUSD > 0 || r.contractPriceLBP > 0) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                {r.contractPriceUSD > 0 && (
                  <Text style={s.rowContractBadge}>{fmtUSD(r.contractPriceUSD)}</Text>
                )}
                {r.contractPriceLBP > 0 && (
                  <Text style={s.rowContractBadgeLBP}>{fmtLBP(r.contractPriceLBP)}</Text>
                )}
              </View>
            )}
          </View>
          <Text style={s.rowService}>{r.serviceName}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={[s.statusPill, { backgroundColor: r.status === 'Done' ? theme.color.success + '22' : theme.color.primary + '22' }]}>
            <Text style={[s.statusPillText, { color: r.status === 'Done' ? theme.color.success : theme.color.primaryText }]}>
              {r.status}
            </Text>
          </View>
          {r.isArchived && (
            <View style={[s.statusPill, { backgroundColor: theme.color.textMuted + '22' }]}>
              <Text style={[s.statusPillText, { color: theme.color.textMuted }]}>📦 Archived</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={s.rowDate}>{formatDate(r.createdAt)}</Text>
      <View style={s.rowFinRow}>
        <View style={s.rowFinCell}>
          <Text style={s.rowFinLabel}>RECEIVED</Text>
          <Text style={[s.rowFinValue, { color: theme.color.success }]}>{fmtUSD(r.receivedUSD)}</Text>
          {r.receivedLBP > 0 && <><View style={s.rowCurrencyDivider} /><Text style={[s.rowFinSub, { color: theme.color.success }]}>{fmtLBP(r.receivedLBP)}</Text></>}
        </View>
        <View style={s.rowFinCell}>
          <Text style={s.rowFinLabel}>DUE</Text>
          <Text style={[s.rowFinValue, r.outstandingUSD > 0 ? s.negative : s.positive]}>
            {fmtUSD(r.outstandingUSD)}
          </Text>
          {r.outstandingLBP !== 0 && <><View style={s.rowCurrencyDivider} /><Text style={[s.rowFinSub, r.outstandingLBP > 0 ? s.negative : s.positive]}>{fmtLBP(r.outstandingLBP)}</Text></>}
        </View>
        <View style={s.rowFinCell}>
          <Text style={s.rowFinLabel}>EXPENSES</Text>
          <Text style={[s.rowFinValue, { color: theme.color.danger }]}>{fmtUSD(r.expenseUSD)}</Text>
          {r.expenseLBP > 0 && <><View style={s.rowCurrencyDivider} /><Text style={[s.rowFinSub, { color: theme.color.danger }]}>{fmtLBP(r.expenseLBP)}</Text></>}
        </View>
        <View style={s.rowFinCell}>
          <Text style={s.rowFinLabel}>BALANCE</Text>
          <Text style={[s.rowFinValue, r.balanceUSD >= 0 ? s.positive : s.negative]}>
            {r.balanceUSD >= 0 ? '+' : '-'}{fmtUSD(r.balanceUSD)}
          </Text>
          {r.balanceLBP !== 0 && (
            <><View style={s.rowCurrencyDivider} /><Text style={[s.rowFinSub, r.balanceLBP >= 0 ? s.positive : s.negative]}>
              {r.balanceLBP >= 0 ? '+' : '-'}{fmtLBP(r.balanceLBP)}
            </Text></>
          )}
        </View>
      </View>
      <Text style={s.rowTapHint}>Tap to view payment history ›</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {/* ── Filters ── */}
      <View style={s.filters}>
        <TextInput
          style={s.searchInput}
          placeholder="Search client or service..."
          placeholderTextColor={theme.color.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        <View style={s.filterRow}>
          <TouchableOpacity
            style={[s.filterChip, filterService ? s.filterChipActive : null]}
            onPress={() => setShowServicePicker(true)}
          >
            <Text style={[s.filterChipText, filterService ? s.filterChipTextActive : null]}>
              {filterService || 'All Services'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.filterChip, filterStatus ? s.filterChipActive : null]}
            onPress={() => setShowStatusPicker(true)}
          >
            <Text style={[s.filterChipText, filterStatus ? s.filterChipTextActive : null]}>
              {filterStatus || 'All Statuses'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.filterChip, filterArchive !== 'all' && s.filterChipActive]}
            onPress={() => setFilterArchive((v) => v === 'all' ? 'active' : v === 'active' ? 'archived' : 'all')}
          >
            <Text style={[s.filterChipText, filterArchive !== 'all' && s.filterChipTextActive]}>
              {filterArchive === 'all' ? '📋 All Files' : filterArchive === 'active' ? '📋 Active' : '📦 Archived'}
            </Text>
          </TouchableOpacity>
          {(filterService || filterStatus || search || filterArchive !== 'all') ? (
            <TouchableOpacity style={s.clearBtn} onPress={() => { setSearch(''); setFilterService(''); setFilterStatus(''); setFilterArchive('all'); }}>
              <Text style={s.clearBtnText}>✕ Clear</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[s.exportBtn, exporting && { opacity: 0.5 }]}
            onPress={exportPDF}
            disabled={exporting || filtered.length === 0}
          >
            <Text style={s.exportBtnText}>{exporting ? '...' : '📄 PDF'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Totals summary bar ── */}
      <View style={s.totalsBar}>
        <View style={s.totalCell}>
          <Text style={s.totalLabel}>{filtered.length} FILES</Text>
          <Text style={s.totalValueNeutral}>{fmtUSD(totals.contractUSD)}</Text>
          {totals.contractLBP > 0 && <><View style={s.currencyDivider} /><Text style={s.totalValueSubNeutral}>{fmtLBP(totals.contractLBP)}</Text></>}
        </View>
        <View style={s.totalCell}>
          <Text style={s.totalLabel}>RECEIVED</Text>
          <Text style={[s.totalValue, s.positive]}>{fmtUSD(totals.receivedUSD)}</Text>
          {totals.receivedLBP > 0 && <><View style={s.currencyDivider} /><Text style={[s.totalValueSub, s.positive]}>{fmtLBP(totals.receivedLBP)}</Text></>}
        </View>
        <View style={s.totalCell}>
          <Text style={s.totalLabel}>DUE</Text>
          <Text style={[s.totalValue, totals.outstandingUSD > 0 ? s.negative : s.positive]}>
            {fmtUSD(totals.outstandingUSD)}
          </Text>
          {totals.outstandingLBP !== 0 && <><View style={s.currencyDivider} /><Text style={[s.totalValueSub, totals.outstandingLBP > 0 ? s.negative : s.positive]}>{fmtLBP(totals.outstandingLBP)}</Text></>}
        </View>
        <View style={s.totalCell}>
          <Text style={s.totalLabel}>BALANCE</Text>
          <Text style={[s.totalValue, totals.balanceUSD >= 0 ? s.positive : s.negative]}>
            {totals.balanceUSD >= 0 ? '+' : ''}{fmtUSD(totals.balanceUSD)}
          </Text>
          {totals.balanceLBP !== 0 && <><View style={s.currencyDivider} /><Text style={[s.totalValueSub, totals.balanceLBP >= 0 ? s.positive : s.negative]}>{totals.balanceLBP >= 0 ? '+' : ''}{fmtLBP(totals.balanceLBP)}</Text></>}
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
          getItemLayout={(_data, index) => ({ length: 160, offset: 160 * index, index })}
          contentContainerStyle={s.list}
        />
      )}

      {/* ── Service picker ── */}
      <Modal visible={showServicePicker} transparent animationType="fade" onRequestClose={() => setShowServicePicker(false)}>
        <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={() => setShowServicePicker(false)}>
          <View style={s.pickerSheet}>
            <Text style={s.pickerTitle}>Filter by Service</Text>
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
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Status picker ── */}
      <Modal visible={showStatusPicker} transparent animationType="fade" onRequestClose={() => setShowStatusPicker(false)}>
        <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={() => setShowStatusPicker(false)}>
          <View style={s.pickerSheet}>
            <Text style={s.pickerTitle}>Filter by Status</Text>
            <TouchableOpacity style={s.pickerRow} onPress={() => { setFilterStatus(''); setShowStatusPicker(false); }}>
              <Text style={[s.pickerLabel, !filterStatus && s.pickerLabelSelected]}>All Statuses</Text>
              {!filterStatus && <Text style={s.pickerCheck}>✓</Text>}
            </TouchableOpacity>
            {statusOptions.map((st) => (
              <TouchableOpacity key={st} style={s.pickerRow} onPress={() => { setFilterStatus(st); setShowStatusPicker(false); }}>
                <Text style={[s.pickerLabel, filterStatus === st && s.pickerLabelSelected]}>{st}</Text>
                {filterStatus === st && <Text style={s.pickerCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Payment History Detail Modal ── */}
      <Modal
        visible={detailRow !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailRow(null)}
      >
        <View style={s.detailOverlay}>
          <View style={s.detailSheet}>
            {/* Header */}
            <View style={s.detailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.detailClient}>{detailRow?.clientName}</Text>
                <Text style={s.detailService}>{detailRow?.serviceName}</Text>
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
                  <Text style={s.detailSummaryLabel}>DUE</Text>
                  <Text style={[s.detailSummaryValue, detailRow.outstandingUSD > 0 ? s.negative : s.positive]}>{fmtUSD(detailRow.outstandingUSD)}</Text>
                  {detailRow.outstandingLBP !== 0 && <Text style={[s.detailSummarySub, detailRow.outstandingLBP > 0 ? s.negative : s.positive]}>{fmtLBP(detailRow.outstandingLBP)}</Text>}
                </View>
                <View style={s.detailSummaryCell}>
                  <Text style={s.detailSummaryLabel}>BALANCE</Text>
                  <Text style={[s.detailSummaryValue, detailRow.balanceUSD >= 0 ? s.positive : s.negative]}>
                    {detailRow.balanceUSD >= 0 ? '+' : '-'}{fmtUSD(detailRow.balanceUSD)}
                  </Text>
                  {detailRow.balanceLBP !== 0 && <Text style={[s.detailSummarySub, detailRow.balanceLBP >= 0 ? s.positive : s.negative]}>{detailRow.balanceLBP >= 0 ? '+' : '-'}{fmtLBP(detailRow.balanceLBP)}</Text>}
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

                {/* Transactions */}
                <View style={s.detailSection}>
                  <Text style={s.detailSectionTitle}>TRANSACTIONS</Text>
                  {detailTxs.length === 0 ? (
                    <Text style={s.detailEmpty}>No transactions recorded</Text>
                  ) : (
                    detailTxs.map((tx) => (
                      <View key={tx.id} style={s.detailTxRow}>
                        <View style={[s.detailTxDot, { backgroundColor: tx.type === 'revenue' ? theme.color.success : theme.color.danger }]} />
                        <View style={{ flex: 1 }}>
                          <View style={s.detailTxAmounts}>
                            <Text style={[s.detailTxNew, { color: tx.type === 'revenue' ? theme.color.success : theme.color.danger }]}>
                              {tx.type === 'expense' ? '- ' : '+ '}{fmtUSD(tx.amount_usd)}
                            </Text>
                            {tx.amount_lbp > 0 && (
                              <Text style={[s.detailTxSub, { color: tx.type === 'revenue' ? theme.color.success : theme.color.danger }]}>
                                {'  '}{tx.type === 'expense' ? '- ' : '+ '}{fmtLBP(tx.amount_lbp)}
                              </Text>
                            )}
                          </View>
                          <Text style={s.detailTxDesc}>{tx.description}</Text>
                          <Text style={s.detailTxMeta}>
                            {tx.creator?.name ?? 'Unknown'} · {formatDate(tx.created_at)}
                          </Text>
                        </View>
                        <View style={[s.detailTxTypePill, { backgroundColor: tx.type === 'revenue' ? theme.color.success + '22' : theme.color.danger + '22' }]}>
                          <Text style={[s.detailTxTypeText, { color: tx.type === 'revenue' ? theme.color.success : theme.color.danger }]}>
                            {tx.type === 'revenue' ? 'Payment' : 'Expense'}
                          </Text>
                        </View>
                      </View>
                    ))
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.bgBase },

  filters: {
    padding:           theme.spacing.space4,
    paddingBottom:     theme.spacing.space2,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgSurface,
  },
  searchInput: {
    backgroundColor:   theme.color.bgSurface,
    color:             theme.color.textPrimary,
    borderRadius:      theme.radius.md,
    padding:           theme.spacing.space3,
    ...theme.typography.body,
    borderWidth:       1,
    borderColor:       theme.color.border,
    marginBottom:      theme.spacing.space2 + 2,
  },
  filterRow:         { flexDirection: 'row', gap: theme.spacing.space2, alignItems: 'center', flexWrap: 'wrap' },
  filterChip: {
    backgroundColor:   theme.color.bgSurface,
    borderRadius:      theme.radius.full,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space1 + 2,
    borderWidth:       1,
    borderColor:       theme.color.border,
    minHeight:         theme.touchTarget.min,
    justifyContent:    'center',
  },
  filterChipActive:     { borderColor: theme.color.primary, backgroundColor: theme.color.primaryDim },
  filterChipText:       { ...theme.typography.label, color: theme.color.textMuted },
  filterChipTextActive: { color: theme.color.primaryText },
  clearBtn:             { paddingHorizontal: theme.spacing.space2 + 2, paddingVertical: theme.spacing.space1 + 2, minHeight: theme.touchTarget.min, justifyContent: 'center' },
  clearBtnText:         { ...theme.typography.label, color: theme.color.danger },
  exportBtn: {
    marginStart:       'auto' as any,
    backgroundColor:   theme.color.primary,
    borderRadius:      theme.radius.full,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space1 + 2,
    minHeight:         theme.touchTarget.min,
    justifyContent:    'center',
  },
  exportBtnText: { ...theme.typography.label, color: theme.color.white, fontWeight: '700' },

  totalsBar: {
    flexDirection:     'row',
    backgroundColor:   theme.color.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    zIndex:            theme.zIndex.sticky,
  },
  totalCell: {
    flex:              1,
    padding:           theme.spacing.space3,
    alignItems:        'center',
    borderRightWidth:  1,
    borderRightColor:  theme.color.border,
  },
  totalLabel:           { ...theme.typography.sectionDivider, marginBottom: theme.spacing.space1 },
  totalValue:           { ...theme.typography.label, fontWeight: '700' },
  totalValueNeutral:    { ...theme.typography.label, color: theme.color.textSecondary, fontWeight: '700' },
  totalValueSub:        { ...theme.typography.caption, fontWeight: '600' },
  totalValueSubNeutral: { ...theme.typography.caption, color: theme.color.textSecondary, fontWeight: '600' },
  currencyDivider:      { height: 1, backgroundColor: theme.color.hairline, width: '100%', marginVertical: theme.spacing.space1 },
  rowCurrencyDivider:   { height: 1, backgroundColor: theme.color.hairline, width: '100%', marginVertical: theme.spacing.space1 - 1 },
  positive:             { color: theme.color.success },
  negative:             { color: theme.color.danger },

  list: { padding: theme.spacing.space3, gap: theme.spacing.space2, paddingBottom: theme.spacing.space10 },

  row: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.space3 + 2,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  rowTop:          { flexDirection: 'row', alignItems: 'flex-start', marginBottom: theme.spacing.space1 - 2 },
  rowClientRow:    { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.space2, flexWrap: 'wrap' },
  rowClient:       { ...theme.typography.heading, fontSize: 15 },
  rowContractBadge:    { ...theme.typography.body, color: theme.color.primaryText, fontWeight: '700' },
  rowContractBadgeLBP: { ...theme.typography.caption, color: theme.color.primary, fontWeight: '600' },
  rowService:      { ...theme.typography.caption, marginTop: theme.spacing.space1 - 2 },
  rowDate:         { ...theme.typography.caption, marginBottom: theme.spacing.space2 + 2 },
  statusPill: {
    borderRadius:      theme.radius.sm,
    paddingHorizontal: theme.spacing.space2,
    paddingVertical:   theme.spacing.space1 - 1,
    marginStart:       theme.spacing.space2,
    alignSelf:         'flex-start',
  },
  statusPillText: { ...theme.typography.caption, fontWeight: '700' },

  rowFinRow:   { flexDirection: 'row', gap: theme.spacing.space1 },
  rowFinCell:  { flex: 1, backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md, padding: theme.spacing.space2 },
  rowFinLabel: { ...theme.typography.sectionDivider, marginBottom: theme.spacing.space1 - 1 },
  rowFinValue: { ...theme.typography.caption, fontWeight: '700', fontSize: 11 },
  rowFinSub:   { ...theme.typography.caption, marginTop: theme.spacing.space1 - 3 },

  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...theme.typography.body, color: theme.color.textMuted },

  pickerOverlay: {
    flex:            1,
    backgroundColor: theme.color.overlayDark,
    justifyContent:  'center',
    alignItems:      'center',
    zIndex:          theme.zIndex.dropdown,
  },
  pickerSheet: {
    backgroundColor: theme.color.bgElevated,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.space4,
    width:           '80%',
    maxHeight:       '70%',
    ...theme.shadow.modal,
  },
  pickerTitle: {
    ...theme.typography.heading,
    marginBottom: theme.spacing.space3,
    textAlign:    'center',
  },
  pickerRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   theme.spacing.space2 + 3,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    minHeight:         theme.touchTarget.min,
  },
  pickerLabel:         { ...theme.typography.body, color: theme.color.textSecondary, flex: 1 },
  pickerLabelSelected: { color: theme.color.textPrimary, fontWeight: '600' },
  pickerCheck:         { ...theme.typography.body, color: theme.color.primary, fontWeight: '700' },

  rowTapHint: { ...theme.typography.caption, color: theme.color.border, marginTop: theme.spacing.space2, textAlign: 'right' },

  // Detail modal
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end', zIndex: theme.zIndex.modal },
  detailSheet: {
    backgroundColor:      theme.color.bgSurface,
    borderTopLeftRadius:  theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    maxHeight:            '90%',
    paddingBottom:        Platform.OS === 'ios' ? theme.spacing.space8 + 2 : theme.spacing.space4,
  },
  detailHeader: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    padding:           theme.spacing.space5,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  detailClient:  { ...theme.typography.heading },
  detailService: { ...theme.typography.caption, marginTop: theme.spacing.space1 - 2 },
  detailClose: {
    ...theme.typography.heading,
    color:     theme.color.textMuted,
    paddingStart: theme.spacing.space3,
    minWidth:  theme.touchTarget.min,
    minHeight: theme.touchTarget.min,
    textAlign: 'center',
  },

  detailSummary: {
    flexDirection:     'row',
    backgroundColor:   theme.color.bgBase,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  detailSummaryCell:  { flex: 1, padding: theme.spacing.space3, alignItems: 'center', borderRightWidth: 1, borderRightColor: theme.color.border },
  detailSummaryLabel: { ...theme.typography.sectionDivider, marginBottom: theme.spacing.space1 },
  detailSummaryValue: { ...theme.typography.label, fontWeight: '700' },
  detailSummarySub:   { ...theme.typography.caption, marginTop: theme.spacing.space1 - 2 },

  detailScroll:       { padding: theme.spacing.space4, paddingBottom: theme.spacing.space8 },
  detailSection:      { marginBottom: theme.spacing.space5 },
  detailSectionTitle: { ...theme.typography.sectionDivider, marginBottom: theme.spacing.space2 + 2 },
  detailEmpty:        { ...theme.typography.body, color: theme.color.border, fontStyle: 'italic' },

  detailTxRow: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    gap:               theme.spacing.space2 + 2,
    paddingVertical:   theme.spacing.space2 + 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgBase,
  },
  detailTxDot:       { width: 10, height: 10, borderRadius: theme.radius.full, marginTop: theme.spacing.space1 },
  detailTxAmounts:   { flexDirection: 'row', alignItems: 'center' },
  detailTxNew:       { ...theme.typography.body, fontSize: 15, fontWeight: '700' },
  detailTxOld:       { ...theme.typography.body, color: theme.color.textMuted },
  detailTxArrow:     { ...theme.typography.label, color: theme.color.textMuted },
  detailTxSub:       { ...theme.typography.caption },
  detailTxDesc:      { ...theme.typography.body, marginTop: theme.spacing.space1 - 1 },
  detailTxMeta:      { ...theme.typography.caption, marginTop: theme.spacing.space1 - 2 },
  detailTxTypePill:  { borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing.space2, paddingVertical: theme.spacing.space1 - 1, alignSelf: 'flex-start' },
  detailTxTypeText:  { ...theme.typography.caption, fontWeight: '700' },
});
