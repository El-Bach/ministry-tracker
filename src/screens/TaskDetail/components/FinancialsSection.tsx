// src/screens/TaskDetail/components/FinancialsSection.tsx
//
// Financials section: contract price + history, P&L summary, C/V USD conversion
// table, add/edit transaction forms, transaction list.
// Phase 2 extraction (parallel module — does not yet replace the monolith).
//
// NOTE: Parent owns all state (transactions, edit form fields, contract price
// totals, exchange rate, etc.) and passes them in. This component is purely
// presentational — every action goes back to the parent via callbacks.

import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import { theme } from '../../../theme';
import { useTranslation } from '../../../lib/i18n';
import { Task, OrgPermissions } from '../../../types';

export interface FileTransaction {
  id: string;
  task_id: string;
  type: 'expense' | 'revenue';
  description: string;
  amount_usd: number;
  amount_lbp: number;
  rate_usd_lbp?: number | null;
  stop_id?: string | null;
  stop?: { id: string; ministry?: { name: string } } | null;
  created_by?: string;
  creator?: { name: string };
  created_at: string;
}

export interface PriceHistoryEntry {
  id: string;
  old_price_usd: number;
  new_price_usd: number;
  old_price_lbp: number;
  new_price_lbp: number;
  note?: string | null;
  created_at: string;
  changer?: { name: string };
}

interface Props {
  task: Task | null;
  permissions: OrgPermissions;

  // Contract price
  contractPriceUSD: number;
  contractPriceLBP: number;
  outstandingUSD: number;
  outstandingLBP: number;
  showPriceHistory: boolean;
  setShowPriceHistory: (v: boolean | ((prev: boolean) => boolean)) => void;
  priceHistory: PriceHistoryEntry[];
  onOpenEditPrice: () => void;

  // P&L summary
  totalRevenueUSD: number;
  totalRevenueLBP: number;
  totalExpenseUSD: number;
  totalExpenseLBP: number;
  balanceUSD: number;
  balanceLBP: number;
  totalCombinedUSD: number;

  // Exchange rate (editable inline)
  exchangeRate: number;
  setExchangeRate: (v: number) => void;
  editingRate: boolean;
  setEditingRate: (v: boolean) => void;
  rateInput: string;
  setRateInput: (v: string) => void;

  // Transactions
  transactions: FileTransaction[];

  // Add transaction form
  showAddTransaction: boolean;
  setShowAddTransaction: (v: boolean | ((prev: boolean) => boolean)) => void;
  txType: 'expense' | 'revenue';
  setTxType: (v: 'expense' | 'revenue') => void;
  txDescription: string;
  setTxDescription: (v: string) => void;
  txAmountUSD: string;
  setTxAmountUSD: (v: string) => void;
  txAmountLBP: string;
  setTxAmountLBP: (v: string) => void;
  txStopId: string | null;
  setTxStopId: (v: string | null) => void;
  showTxStagePicker: boolean;
  setShowTxStagePicker: (v: boolean | ((prev: boolean) => boolean)) => void;
  savingTx: boolean;
  onAddTransaction: () => void;

  // Edit transaction form
  editingTx: FileTransaction | null;
  setEditingTx: (v: FileTransaction | null) => void;
  editTxType: 'expense' | 'revenue';
  setEditTxType: (v: 'expense' | 'revenue') => void;
  editTxDescription: string;
  setEditTxDescription: (v: string) => void;
  editTxAmountUSD: string;
  setEditTxAmountUSD: (v: string) => void;
  editTxAmountLBP: string;
  setEditTxAmountLBP: (v: string) => void;
  editTxStopId: string | null;
  setEditTxStopId: (v: string | null) => void;
  showEditTxStagePicker: boolean;
  setShowEditTxStagePicker: (v: boolean | ((prev: boolean) => boolean)) => void;
  savingEditTx: boolean;
  onSaveEditTransaction: () => void;

  // Delete transaction
  deletingTxId: string | null;
  onDeleteTransaction: (tx: FileTransaction) => void;

  // Formatters
  fmtUSD: (n: number) => string;
  fmtLBP: (n: number) => string;
  formatDate: (iso: string) => string;
}

export function FinancialsSection(props: Props) {
  const { t } = useTranslation();
  const {
    task, permissions,
    contractPriceUSD, contractPriceLBP, outstandingUSD, outstandingLBP,
    showPriceHistory, setShowPriceHistory, priceHistory, onOpenEditPrice,
    totalRevenueUSD, totalRevenueLBP, totalExpenseUSD, totalExpenseLBP,
    balanceUSD, balanceLBP, totalCombinedUSD,
    exchangeRate, setExchangeRate, editingRate, setEditingRate, rateInput, setRateInput,
    transactions,
    showAddTransaction, setShowAddTransaction,
    txType, setTxType, txDescription, setTxDescription,
    txAmountUSD, setTxAmountUSD, txAmountLBP, setTxAmountLBP,
    txStopId, setTxStopId, showTxStagePicker, setShowTxStagePicker,
    savingTx, onAddTransaction,
    editingTx, setEditingTx,
    editTxType, setEditTxType, editTxDescription, setEditTxDescription,
    editTxAmountUSD, setEditTxAmountUSD, editTxAmountLBP, setEditTxAmountLBP,
    editTxStopId, setEditTxStopId, showEditTxStagePicker, setShowEditTxStagePicker,
    savingEditTx, onSaveEditTransaction,
    deletingTxId, onDeleteTransaction,
    fmtUSD, fmtLBP, formatDate,
  } = props;

  const showSection =
    permissions.can_see_file_financials || permissions.can_see_contract_price ||
    permissions.can_add_expenses || permissions.can_add_revenue;

  if (!showSection) return null;

  const cvFmt = (n: number) =>
    `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  // Plain number formatters for the cvTable rows (no symbol prefix — the
  // column header already says USD / LBP, so we don't repeat).
  const numFmt = (n: number) =>
    Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const cvOf = (tx: FileTransaction) => {
    const r = tx.rate_usd_lbp ?? exchangeRate;
    return tx.amount_usd + tx.amount_lbp / r;
  };

  // ─── Currency cell helper ──────────────────────────────────────────
  // Renders a fixed-width cell with the currency symbol left-anchored and
  // the (optional sign +) number right-anchored, with whitespace between.
  // The sign sits BETWEEN the symbol and the amount — i.e. it moves with
  // the right-aligned number, not pinned to the symbol on the left.
  //   width=80, currency='USD', value=750               → "$         750"
  //   width=80, currency='USD', value=50, sign='-'      → "$        - 50"
  //   width=80, currency='USD', value=750, sign='+'     → "$       + 750"
  //   width=120, currency='LBP', value=2000, sign='-'   → "LBP    - 2,000"
  // The textStyle prop gets applied to BOTH the symbol and the number so
  // they share color, fontSize, fontWeight (matches the row's existing style).
  const AmountCell: React.FC<{
    width:         number;
    marginStart?:  number;
    leftDivider?:  boolean;
    currency:      'USD' | 'LBP';
    value:         number;
    sign?:         '' | '+' | '-';
    decimals?:     number;
    /** when false, only the number renders — caller must show $/LBP elsewhere
        (e.g. a column header). Used by the P&L summary to avoid repeating the
        symbol on every row. Default true. */
    showSymbol?:   boolean;
    textStyle?:    any;
  }> = ({ width, marginStart = 0, leftDivider, currency, value, sign = '', decimals = 0, showSymbol = true, textStyle }) => {
    const symbol = currency === 'USD' ? '$' : 'LBP';
    const number = Math.abs(value).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return (
      <View style={[
        { width, marginStart, flexDirection: 'row', alignItems: 'baseline', paddingLeft: leftDivider ? 10 : 0 },
        leftDivider && { borderLeftWidth: 1, borderLeftColor: theme.color.border },
      ]}>
        <Text style={[textStyle, { flex: 1, textAlign: 'right', marginRight: showSymbol ? 4 : 0 }]} numberOfLines={1}>
          {sign ? `${sign} ` : ''}{number}
        </Text>
        {showSymbol && <Text style={textStyle}>{symbol}</Text>}
      </View>
    );
  };

  return (
    <View style={s.section}>
      <View style={s.sectionTitleRow}>
        <Text style={s.sectionTitle}>{t('financialsSection').toUpperCase()}</Text>
      </View>

      {/* Contract price card */}
      {permissions.can_see_contract_price && (
        <View style={s.contractPriceRow}>
          <View style={s.contractPriceHeaderRow}>
            <TouchableOpacity onPress={() => setShowPriceHistory(v => !v)} activeOpacity={0.7} style={{ flex: 1 }}>
              <Text style={[s.balanceLabel, { fontSize: 14 }]}>{t('contractPrice').toUpperCase()} {showPriceHistory ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {permissions.can_edit_contract_price && (
              <TouchableOpacity style={s.editPriceBtn} onPress={onOpenEditPrice}>
                <Text style={s.editPriceBtnText}>✎ {t('edit')}</Text>
              </TouchableOpacity>
            )}
          </View>
          {/* Contract price row — uses the same column layout as the P&L
              rows below so $/LBP align vertically across all rows. */}
          <View style={[s.balanceRow, { marginTop: theme.spacing.space1 }]}>
            <View style={{ flex: 1 }} />
            <AmountCell width={80} currency="USD" value={contractPriceUSD} textStyle={s.contractPriceVal} />
            <AmountCell width={150} leftDivider currency="LBP" value={contractPriceLBP} textStyle={s.contractPriceValLBP} />
          </View>
          {contractPriceUSD > 0 && (
            <View style={[s.balanceRow, { marginTop: theme.spacing.space2 }]}>
              <Text style={[s.balanceLabel, { fontSize: 14 }]}>{t('balance').toUpperCase()}</Text>
              <AmountCell
                width={80}
                currency="USD"
                value={outstandingUSD}
                textStyle={[s.balanceColTxt, { fontSize: 14 }, outstandingUSD > 0 ? s.negative : s.positive]}
              />
              <AmountCell
                width={150}
                leftDivider
                currency="LBP"
                value={outstandingLBP}
                textStyle={[
                  s.balanceColLBPTxt,
                  { fontSize: 14 },
                  contractPriceLBP > 0
                    ? (outstandingLBP > 0 ? s.negative : s.positive)
                    : s.balanceRevenueLBP,
                ]}
              />
            </View>
          )}
        </View>
      )}

      {/* Price history (collapsible) */}
      {showPriceHistory && (
        <View style={s.priceHistoryBlock}>
          <Text style={s.priceHistoryLabel}>CONTRACT PRICE CHANGES</Text>
          {priceHistory.length === 0 ? (
            <Text style={s.priceHistoryEmpty}>No changes recorded yet</Text>
          ) : (
            priceHistory.map((h) => (
              <View key={h.id} style={s.priceHistoryRow}>
                <View style={s.stopHistoryDot} />
                <View style={{ flex: 1 }}>
                  <View style={s.stopHistoryTextRow}>
                    <Text style={s.stopHistoryOld}>{fmtUSD(h.old_price_usd)}</Text>
                    <Text style={s.stopHistoryArrow}> → </Text>
                    <Text style={s.stopHistoryNew}>{fmtUSD(h.new_price_usd)}</Text>
                    {h.old_price_lbp > 0 && (
                      <Text style={[s.stopHistoryOld, { marginStart: 8 }]}>{fmtLBP(h.old_price_lbp)}</Text>
                    )}
                    {h.old_price_lbp > 0 && <Text style={s.stopHistoryArrow}> → </Text>}
                    {h.new_price_lbp > 0 && <Text style={s.stopHistoryNew}>{fmtLBP(h.new_price_lbp)}</Text>}
                  </View>
                  <Text style={s.stopHistoryMeta}>
                    Changed by <Text style={{ color: theme.color.primaryText }}>{h.changer?.name ?? 'Unknown'}</Text>
                    {' · '}{formatDate(h.created_at)}
                    {h.note ? `\n"${h.note}"` : ''}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* P&L summary */}
      {permissions.can_see_file_financials && (
        <View style={s.balanceSummary}>
          {/* Column headers — $/LBP shown here so the rows below stay clean */}
          <View style={[s.balanceRow, s.balanceHeaderRow]}>
            <Text style={[s.balanceLabel, { flex: 1 }]}> </Text>
            <Text style={s.balanceHeaderUSD}>USD</Text>
            <Text style={s.balanceHeaderLBP}>LBP</Text>
          </View>
          <View style={s.balanceRow}>
            <Text style={s.balanceLabel}>{t('paymentsReceived').toUpperCase()}</Text>
            <AmountCell width={80} currency="USD" value={totalRevenueUSD} showSymbol={false} textStyle={[s.balanceColTxt, s.balanceRevenue]} />
            <AmountCell width={150} leftDivider currency="LBP" value={totalRevenueLBP} showSymbol={false} textStyle={[s.balanceColLBPTxt, s.balanceRevenueLBP]} />
          </View>
          <View style={s.balanceRow}>
            <Text style={s.balanceLabel}>{t('expense').toUpperCase()}S</Text>
            <AmountCell width={80} currency="USD" value={totalExpenseUSD} sign="-" showSymbol={false} textStyle={[s.balanceColTxt, s.balanceExpense]} />
            <AmountCell width={150} leftDivider currency="LBP" value={totalExpenseLBP} sign="-" showSymbol={false} textStyle={[s.balanceColLBPTxt, s.balanceExpenseLBP]} />
          </View>
          <View style={s.balanceDivider} />
          <View style={s.balanceRow}>
            <Text style={s.balanceTotalLabel}>{t('netBalance')}</Text>
            <AmountCell
              width={80}
              currency="USD"
              value={balanceUSD}
              sign={balanceUSD >= 0 ? '+' : '-'}
              showSymbol={false}
              textStyle={[s.balanceColTxt, s.balanceTotal, balanceUSD >= 0 ? s.positive : s.negative]}
            />
            <AmountCell
              width={150}
              leftDivider
              currency="LBP"
              value={balanceLBP}
              sign={balanceLBP >= 0 ? '+' : '-'}
              showSymbol={false}
              textStyle={[s.balanceColLBPTxt, s.balanceTotalLBP, balanceLBP >= 0 ? s.positive : s.negative]}
            />
          </View>
          <View style={s.balanceDivider} />
          <View style={s.balanceRow}>
            <Text style={s.balanceTotalLabel}>{t('cvUSD')}</Text>
            <AmountCell
              width={80}
              currency="USD"
              value={totalCombinedUSD}
              sign={totalCombinedUSD >= 0 ? '+' : '-'}
              decimals={2}
              showSymbol={false}
              textStyle={[s.balanceColTxt, s.balanceTotal, totalCombinedUSD >= 0 ? s.positive : s.negative]}
            />
            <View style={{ width: 150, alignItems: 'flex-end', paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: theme.color.border }}>
              {editingRate ? (
                <TextInput
                  style={s.rateInput}
                  value={rateInput}
                  onChangeText={setRateInput}
                  keyboardType="number-pad"
                  autoFocus
                  onBlur={() => {
                    const v = parseInt(rateInput.replace(/,/g, ''), 10);
                    if (!isNaN(v) && v > 0) { setExchangeRate(v); setRateInput(v.toLocaleString('en-US')); }
                    setEditingRate(false);
                  }}
                  onSubmitEditing={() => {
                    const v = parseInt(rateInput.replace(/,/g, ''), 10);
                    if (!isNaN(v) && v > 0) { setExchangeRate(v); setRateInput(v.toLocaleString('en-US')); }
                    setEditingRate(false);
                  }}
                />
              ) : (
                <TouchableOpacity onPress={() => { setRateInput(exchangeRate.toLocaleString('en-US')); setEditingRate(true); }}>
                  <Text style={s.rateDisplay}>÷ {exchangeRate.toLocaleString('en-US')} ✎</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}

      {/* C/V USD conversion table */}
      {permissions.can_see_file_financials && transactions.length > 0 && (() => {
        const totalCvUSD = transactions.reduce((sum, tx) =>
          sum + (tx.type === 'revenue' ? cvOf(tx) : -cvOf(tx)), 0);
        const totalTxUSD = transactions.reduce((sum, tx) =>
          sum + (tx.type === 'revenue' ? tx.amount_usd : -tx.amount_usd), 0);
        const totalTxLBP = transactions.reduce((sum, tx) =>
          sum + (tx.type === 'revenue' ? tx.amount_lbp : -tx.amount_lbp), 0);

        return (
          <View style={s.cvTable}>
            <View style={[s.cvRow, s.cvHeader]}>
              <Text style={[s.cvCell, s.cvCellDesc, s.cvHeaderText]}>DESCRIPTION</Text>
              <Text style={[s.cvCell, s.cvCellNum, s.cvHeaderText]}>USD</Text>
              <Text style={[s.cvCell, s.cvCellNumLBP, s.cvHeaderText]}>LBP</Text>
              <Text style={[s.cvCell, s.cvCellNumCV, s.cvHeaderText]}>C/V USD</Text>
            </View>
            {transactions.map((tx) => {
              const cv = cvOf(tx);
              const sign = tx.type === 'revenue' ? '+' : '-';
              const col = tx.type === 'revenue' ? theme.color.success : theme.color.danger;
              return (
                <View key={tx.id} style={s.cvRow}>
                  <View style={[s.cvCell, s.cvCellDesc]}>
                    <Text style={[s.cvDescText, { color: col }]}>{sign} {tx.description || '—'}</Text>
                    {tx.stop?.ministry?.name && (
                      <Text style={s.cvStagePill}>📌 {tx.stop.ministry.name}</Text>
                    )}
                  </View>
                  <Text style={[s.cvCell, s.cvCellNum, { color: tx.amount_usd > 0 ? col : theme.color.textMuted }]}>
                    {tx.amount_usd > 0 ? `${sign}${numFmt(tx.amount_usd)}` : '—'}
                  </Text>
                  <Text style={[s.cvCell, s.cvCellNumLBP, { color: tx.amount_lbp > 0 ? col : theme.color.textMuted }]}>
                    {tx.amount_lbp > 0 ? `${sign}${numFmt(tx.amount_lbp)}` : '—'}
                  </Text>
                  <Text style={[s.cvCell, s.cvCellNumCV, { color: col, fontWeight: '700' }]}>
                    {sign}{cvFmt(cv)}
                  </Text>
                </View>
              );
            })}
            <View style={[s.cvRow, s.cvTotalRow]}>
              <Text style={[s.cvCell, s.cvCellDesc, s.cvTotalText]}>TOTAL</Text>
              <Text style={[s.cvCell, s.cvCellNum, s.cvTotalText, totalTxUSD >= 0 ? s.positive : s.negative]}>
                {totalTxUSD >= 0 ? '+' : '-'}{numFmt(totalTxUSD)}
              </Text>
              <Text style={[s.cvCell, s.cvCellNumLBP, s.cvTotalText, totalTxLBP >= 0 ? s.positive : s.negative]}>
                {totalTxLBP >= 0 ? '+' : '-'}{numFmt(totalTxLBP)}
              </Text>
              <Text style={[s.cvCell, s.cvCellNumCV, s.cvTotalText, totalCvUSD >= 0 ? s.positive : s.negative]}>
                {totalCvUSD >= 0 ? '+' : '-'}{cvFmt(Math.abs(totalCvUSD))}
              </Text>
            </View>
            <Text style={s.cvRateNote}>
              * C/V calculated using each transaction's locked rate
              {transactions.some(tx => !tx.rate_usd_lbp)
                ? ` (legacy rows use current rate: ${exchangeRate.toLocaleString('en-US')} LBP/$1)`
                : ''}
            </Text>
          </View>
        );
      })()}

      {/* + Add Transaction button */}
      {(permissions.can_add_expenses || permissions.can_add_revenue) && (
        <TouchableOpacity style={s.addTxBtn} onPress={() => setShowAddTransaction((v) => !v)}>
          <Text style={s.addTxBtnText}>{showAddTransaction ? `✕ ${t('cancel')}` : `+ ${t('transaction')}`}</Text>
        </TouchableOpacity>
      )}

      {/* Add transaction form */}
      {showAddTransaction && (
        <View style={s.txForm}>
          <View style={s.txTypeRow}>
            {permissions.can_add_expenses && (
              <TouchableOpacity
                style={[s.txTypeBtn, txType === 'expense' && s.txTypeBtnExpense]}
                onPress={() => setTxType('expense')}
              >
                <Text style={[s.txTypeBtnText, txType === 'expense' && s.txTypeBtnTextExpense]}>
                  ↑ {t('expense')}
                </Text>
              </TouchableOpacity>
            )}
            {permissions.can_add_revenue && (
              <TouchableOpacity
                style={[s.txTypeBtn, txType === 'revenue' && s.txTypeBtnRevenue]}
                onPress={() => setTxType('revenue')}
              >
                <Text style={[s.txTypeBtnText, txType === 'revenue' && s.txTypeBtnTextRevenue]}>
                  ↓ {t('revenue')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <TextInput
            style={s.txInput}
            value={txDescription}
            onChangeText={setTxDescription}
            placeholder={`${t('description')} *`}
            placeholderTextColor={theme.color.textMuted}
          />

          <View style={s.txAmountsRow}>
            <View style={s.txAmountField}>
              <Text style={s.txAmountLabel}>USD ($)</Text>
              <TextInput
                style={s.txInput}
                value={txAmountUSD}
                onChangeText={setTxAmountUSD}
                placeholder="0.00"
                placeholderTextColor={theme.color.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={s.txAmountField}>
              <Text style={s.txAmountLabel}>LBP (ل.ل)</Text>
              <TextInput
                style={s.txInput}
                value={txAmountLBP}
                onChangeText={(v) => {
                  const digits = v.replace(/,/g, '');
                  if (digits === '' || /^\d*$/.test(digits)) {
                    setTxAmountLBP(digits === '' ? '' : parseInt(digits, 10).toLocaleString('en-US'));
                  }
                }}
                placeholder="0"
                placeholderTextColor={theme.color.textMuted}
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* Stage link (expense only) */}
          {txType === 'expense' && task?.route_stops && task.route_stops.length > 0 && (
            <View style={s.txStageSection}>
              <TouchableOpacity style={s.txStageTrigger} onPress={() => setShowTxStagePicker(v => !v)}>
                <Text style={s.txStageTriggerText}>
                  {txStopId
                    ? `📌 ${task.route_stops.find(rs => rs.id === txStopId)?.ministry?.name ?? 'Stage'}`
                    : '📌 Link to stage (optional)'}
                </Text>
                {txStopId && (
                  <TouchableOpacity onPress={() => { setTxStopId(null); setShowTxStagePicker(false); }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Text style={s.txStageRemove}>✕</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
              {showTxStagePicker && (
                <View style={s.txStageDropdown}>
                  {task.route_stops.map(rs => (
                    <TouchableOpacity
                      key={rs.id}
                      style={[s.txStageItem, txStopId === rs.id && s.txStageItemActive]}
                      onPress={() => { setTxStopId(rs.id); setShowTxStagePicker(false); }}
                    >
                      <Text style={[s.txStageItemText, txStopId === rs.id && { color: theme.color.primary, fontWeight: '700' }]}>
                        {rs.stop_order}. {rs.ministry?.name}
                      </Text>
                      {txStopId === rs.id && <Text style={{ color: theme.color.primary }}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[s.txSaveBtn, txType === 'expense' ? s.txSaveBtnExpense : s.txSaveBtnRevenue, savingTx && s.disabledBtn]}
            onPress={onAddTransaction}
            disabled={savingTx}
          >
            {savingTx ? (
              <ActivityIndicator color={theme.color.white} size="small" />
            ) : (
              <Text style={s.txSaveBtnText}>
                {t('save')} {txType === 'expense' ? t('expense') : t('revenue')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Transaction list */}
      {permissions.can_see_file_financials && (transactions.length === 0 ? (
        <Text style={s.emptyText}>No transactions yet</Text>
      ) : (
        transactions.map((tx) => {
          // Inline edit form
          if (editingTx?.id === tx.id) {
            return (
              <View key={tx.id} style={s.txEditForm}>
                <View style={s.txTypeRow}>
                  <TouchableOpacity
                    style={[s.txTypeBtn, editTxType === 'expense' && s.txTypeBtnExpense]}
                    onPress={() => setEditTxType('expense')}
                  >
                    <Text style={[s.txTypeBtnText, editTxType === 'expense' && s.txTypeBtnTextExpense]}>
                      ↑ {t('expense')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.txTypeBtn, editTxType === 'revenue' && s.txTypeBtnRevenue]}
                    onPress={() => setEditTxType('revenue')}
                  >
                    <Text style={[s.txTypeBtnText, editTxType === 'revenue' && s.txTypeBtnTextRevenue]}>
                      ↓ {t('revenue')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={s.txInput}
                  value={editTxDescription}
                  onChangeText={setEditTxDescription}
                  placeholder={t('description')}
                  placeholderTextColor={theme.color.textMuted}
                  returnKeyType="done"
                />

                <View style={s.txAmountsRow}>
                  <View style={s.txAmountField}>
                    <Text style={s.txAmountLabel}>USD</Text>
                    <TextInput
                      style={s.txInput}
                      value={editTxAmountUSD}
                      onChangeText={setEditTxAmountUSD}
                      placeholder="0.00"
                      placeholderTextColor={theme.color.textMuted}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={s.txAmountField}>
                    <Text style={s.txAmountLabel}>LBP</Text>
                    <TextInput
                      style={s.txInput}
                      value={editTxAmountLBP}
                      onChangeText={(v) => {
                        const raw = v.replace(/,/g, '');
                        const n = parseInt(raw, 10);
                        setEditTxAmountLBP(isNaN(n) ? '' : n.toLocaleString('en-US'));
                      }}
                      placeholder="0"
                      placeholderTextColor={theme.color.textMuted}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>

                {editTxType === 'expense' && task?.route_stops && task.route_stops.length > 0 && (
                  <View style={s.txStageSection}>
                    <TouchableOpacity style={s.txStageTrigger} onPress={() => setShowEditTxStagePicker(v => !v)}>
                      <Text style={s.txStageTriggerText}>
                        {editTxStopId
                          ? `📌 ${task.route_stops.find(rs => rs.id === editTxStopId)?.ministry?.name ?? 'Stage'}`
                          : '📌 Link to stage (optional)'}
                      </Text>
                      {editTxStopId && (
                        <TouchableOpacity onPress={() => { setEditTxStopId(null); setShowEditTxStagePicker(false); }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <Text style={s.txStageRemove}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                    {showEditTxStagePicker && (
                      <View style={s.txStageDropdown}>
                        {task.route_stops.map(rs => (
                          <TouchableOpacity
                            key={rs.id}
                            style={[s.txStageItem, editTxStopId === rs.id && s.txStageItemActive]}
                            onPress={() => { setEditTxStopId(rs.id); setShowEditTxStagePicker(false); }}
                          >
                            <Text style={[s.txStageItemText, editTxStopId === rs.id && { color: theme.color.primary, fontWeight: '700' }]}>
                              {rs.stop_order}. {rs.ministry?.name}
                            </Text>
                            {editTxStopId === rs.id && <Text style={{ color: theme.color.primary }}>✓</Text>}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                <View style={s.txEditActions}>
                  <TouchableOpacity style={s.txCancelBtn} onPress={() => setEditingTx(null)}>
                    <Text style={s.txCancelBtnText}>{t('cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.txSaveBtn, editTxType === 'expense' ? s.txSaveBtnExpense : s.txSaveBtnRevenue, savingEditTx && s.disabledBtn, { flex: 1 }]}
                    onPress={onSaveEditTransaction}
                    disabled={savingEditTx}
                  >
                    {savingEditTx ? (
                      <ActivityIndicator color={theme.color.white} size="small" />
                    ) : (
                      <Text style={s.txSaveBtnText}>
                        {t('save')} {editTxType === 'expense' ? t('expense') : t('revenue')}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          }

          // Normal display row
          return (
            <View key={tx.id} style={[s.txRow, tx.type === 'expense' ? s.txRowExpense : s.txRowRevenue]}>
              <View style={[s.txTypeDot, tx.type === 'expense' ? s.txDotExpense : s.txDotRevenue]} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={s.txDesc}>{tx.description}</Text>
                {tx.stop?.ministry?.name && (
                  <Text style={s.txStageTag}>📌 {tx.stop.ministry.name}</Text>
                )}
                <View style={s.txAmountDisplay}>
                  {tx.amount_usd > 0 && (
                    <Text style={[s.txAmt, tx.type === 'expense' ? s.txAmtExpense : s.txAmtRevenue]}>
                      {tx.type === 'expense' ? '- ' : '+ '}{fmtUSD(tx.amount_usd)}
                    </Text>
                  )}
                  {tx.amount_lbp > 0 && (
                    <Text style={[s.txAmt, tx.type === 'expense' ? s.txAmtExpense : s.txAmtRevenue]}>
                      {tx.type === 'expense' ? '- ' : '+ '}{fmtLBP(tx.amount_lbp)}
                    </Text>
                  )}
                </View>
                <Text style={s.txMeta}>
                  Added by <Text style={s.txMetaName}>{tx.creator?.name ?? 'Unknown'}</Text>
                  {' · '}{formatDate(tx.created_at)}
                </Text>
              </View>
              <View style={s.txRowActions}>
                <TouchableOpacity
                  onPress={() => {
                    setEditingTx(tx);
                    setEditTxType(tx.type);
                    setEditTxDescription(tx.description);
                    setEditTxAmountUSD(tx.amount_usd > 0 ? tx.amount_usd.toString() : '');
                    setEditTxAmountLBP(tx.amount_lbp > 0 ? tx.amount_lbp.toLocaleString('en-US') : '');
                    setEditTxStopId(tx.stop_id ?? null);
                    setShowEditTxStagePicker(false);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={s.txEdit}>✎</Text>
                </TouchableOpacity>
                {permissions.can_delete_transactions && (
                  <TouchableOpacity
                    onPress={() => onDeleteTransaction(tx)}
                    disabled={deletingTxId === tx.id}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {deletingTxId === tx.id ? (
                      <ActivityIndicator size="small" color={theme.color.danger} />
                    ) : (
                      <Text style={s.txDelete}>✕</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginHorizontal: theme.spacing.space4, marginBottom: theme.spacing.space4 },
  sectionTitle: { ...theme.typography.label, color: theme.color.textMuted, fontWeight: '700', fontSize: 11, letterSpacing: 0.5 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.space2 },
  emptyText: { ...theme.typography.body, color: theme.color.textMuted, fontStyle: 'italic' },

  // Contract price card
  contractPriceRow: { backgroundColor: theme.color.bgBase, padding: 14, borderRadius: theme.radius.md, marginBottom: theme.spacing.space2, gap: 6 },
  contractPriceHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceLabel: { fontSize: 13, fontWeight: '700', color: theme.color.textMuted, letterSpacing: 0.5, flex: 1 },
  editPriceBtn: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: theme.color.primary + '22', borderRadius: theme.radius.sm },
  editPriceBtnText: { color: theme.color.primary, fontSize: 14, fontWeight: '700' },
  balanceAmounts: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contractPriceVal: { fontSize: 14, fontWeight: '700', color: theme.color.primary },
  contractPriceValLBP: { fontSize: 14, fontWeight: '700', color: theme.color.primary },

  // P&L summary
  balanceSummary: { backgroundColor: theme.color.bgBase, padding: 14, borderRadius: theme.radius.md, marginBottom: theme.spacing.space2, gap: 6 },
  balanceHeaderRow: { paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  balanceHeaderUSD: { width: 80, textAlign: 'right', fontSize: 13, fontWeight: '700', color: theme.color.textMuted, letterSpacing: 0.5 },
  balanceHeaderLBP: { width: 150, textAlign: 'right', paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: theme.color.border, fontSize: 13, fontWeight: '700', color: theme.color.textMuted, letterSpacing: 0.5 },
  balanceRow: { flexDirection: 'row', alignItems: 'center' },
  balanceCol: { fontSize: 14, fontWeight: '700', minWidth: 80, textAlign: 'right' },
  balanceColLBP: { fontSize: 13, color: theme.color.textSecondary, minWidth: 120, textAlign: 'right' },
  // Text-only variants for AmountCell — no width (the wrapper View owns
  // width). Inherit typography weight/size from balanceCol/balanceColLBP.
  balanceColTxt:    { fontSize: 13, fontWeight: '700' },
  balanceColLBPTxt: { fontSize: 13, color: theme.color.textSecondary },
  balanceRevenue: { color: theme.color.success },
  balanceRevenueLBP: { color: theme.color.success },
  balanceExpense: { color: theme.color.danger },
  balanceExpenseLBP: { color: theme.color.danger },
  balanceDivider: { height: 1, backgroundColor: theme.color.border, marginVertical: 4 },
  balanceTotalLabel: { fontSize: 13, fontWeight: '700', color: theme.color.textPrimary, flex: 1 },
  balanceTotal: { fontSize: 13 },
  balanceTotalLBP: { fontSize: 13, fontWeight: '700' },
  positive: { color: theme.color.success },
  negative: { color: theme.color.danger },
  rateInput: { borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.sm, paddingHorizontal: 6, paddingVertical: 2, color: theme.color.textPrimary, fontSize: 12, minWidth: 100, textAlign: 'right' },
  rateDisplay: { fontSize: 11, color: theme.color.textMuted },

  // Price history
  priceHistoryBlock: { backgroundColor: theme.color.bgBase, padding: 12, borderRadius: theme.radius.md, marginBottom: theme.spacing.space2 },
  priceHistoryLabel: { fontSize: 10, fontWeight: '700', color: theme.color.textMuted, letterSpacing: 0.5, marginBottom: 8 },
  priceHistoryEmpty: { fontSize: 12, color: theme.color.textMuted, fontStyle: 'italic' },
  priceHistoryRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  stopHistoryDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.primary, marginTop: 6 },
  stopHistoryTextRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  stopHistoryOld: { fontSize: 12, color: theme.color.textMuted, textDecorationLine: 'line-through' },
  stopHistoryArrow: { fontSize: 12, color: theme.color.textMuted },
  stopHistoryNew: { fontSize: 12, color: theme.color.primary, fontWeight: '700' },
  stopHistoryMeta: { fontSize: 11, color: theme.color.textMuted, marginTop: 2 },

  // C/V table
  cvTable: { backgroundColor: theme.color.bgBase, padding: 8, borderRadius: theme.radius.md, marginBottom: theme.spacing.space2 },
  cvRow: { flexDirection: 'row' as const, alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.color.border + '55' },
  cvHeader: { borderBottomWidth: 2, borderBottomColor: theme.color.border, paddingBottom: 6 },
  cvHeaderText: { fontSize: 10, fontWeight: '700', color: theme.color.textMuted, letterSpacing: 0.5 },
  cvCell: { paddingHorizontal: 4 },
  cvCellDesc: { flex: 2 },
  cvCellNum: { flex: 0.8, fontSize: 11, textAlign: 'right' },
  cvCellNumLBP: { flex: 1.6, fontSize: 11, textAlign: 'right' },
  cvCellNumCV: { flex: 1.4, fontSize: 11, textAlign: 'right' },
  cvDescText: { fontSize: 12, fontWeight: '600' },
  cvStagePill: { fontSize: 10, color: theme.color.primary, marginTop: 2 },
  cvTotalRow: { borderTopWidth: 2, borderTopColor: theme.color.border, paddingTop: 6, marginTop: 4 },
  cvTotalText: { fontSize: 12, fontWeight: '700' },
  cvRateNote: { fontSize: 10, color: theme.color.textMuted, marginTop: 6, fontStyle: 'italic' },

  // Add/edit transaction
  addTxBtn: { backgroundColor: theme.color.primary + '22', padding: 10, borderRadius: theme.radius.sm, alignItems: 'center', marginBottom: theme.spacing.space2 },
  addTxBtnText: { color: theme.color.primary, fontWeight: '700', fontSize: 13 },
  txForm: { backgroundColor: theme.color.bgBase, padding: 12, borderRadius: theme.radius.md, marginBottom: theme.spacing.space2, gap: 8 },
  txEditForm: { backgroundColor: theme.color.bgBase, padding: 12, borderRadius: theme.radius.md, marginBottom: theme.spacing.space2, gap: 8, borderWidth: 1, borderColor: theme.color.primary + '55' },
  txTypeRow: { flexDirection: 'row', gap: 6 },
  txTypeBtn: { flex: 1, paddingVertical: 8, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.color.border, alignItems: 'center', backgroundColor: theme.color.bgSurface },
  txTypeBtnExpense: { backgroundColor: theme.color.danger + '22', borderColor: theme.color.danger },
  txTypeBtnRevenue: { backgroundColor: theme.color.success + '22', borderColor: theme.color.success },
  txTypeBtnText: { fontSize: 13, fontWeight: '600', color: theme.color.textPrimary },
  txTypeBtnTextExpense: { color: theme.color.danger, fontWeight: '700' },
  txTypeBtnTextRevenue: { color: theme.color.success, fontWeight: '700' },
  txInput: { borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.sm, paddingHorizontal: 10, paddingVertical: 8, color: theme.color.textPrimary, fontSize: 14, backgroundColor: theme.color.bgSurface },
  txAmountsRow: { flexDirection: 'row', gap: 8 },
  txAmountField: { flex: 1, gap: 4 },
  txAmountLabel: { fontSize: 11, fontWeight: '700', color: theme.color.textMuted, letterSpacing: 0.5 },
  txStageSection: { gap: 4 },
  txStageTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.sm, backgroundColor: theme.color.bgSurface },
  txStageTriggerText: { fontSize: 13, color: theme.color.textPrimary, flex: 1 },
  txStageRemove: { color: theme.color.danger, fontSize: 16, paddingHorizontal: 4 },
  txStageDropdown: { borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.sm, backgroundColor: theme.color.bgSurface, marginTop: 4 },
  txStageItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderBottomWidth: 1, borderBottomColor: theme.color.border + '55' },
  txStageItemActive: { backgroundColor: theme.color.primary + '11' },
  txStageItemText: { fontSize: 13, color: theme.color.textPrimary, flex: 1 },
  txSaveBtn: { padding: 10, borderRadius: theme.radius.sm, alignItems: 'center' },
  txSaveBtnExpense: { backgroundColor: theme.color.danger },
  txSaveBtnRevenue: { backgroundColor: theme.color.success },
  txSaveBtnText: { color: theme.color.white, fontWeight: '700', fontSize: 13 },
  txEditActions: { flexDirection: 'row', gap: 6 },
  txCancelBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.color.border, alignItems: 'center' },
  txCancelBtnText: { color: theme.color.textMuted, fontWeight: '600', fontSize: 13 },
  disabledBtn: { opacity: 0.5 },

  // Transaction row
  txRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 10, backgroundColor: theme.color.bgBase, borderRadius: theme.radius.sm, marginBottom: 6, borderLeftWidth: 3 },
  txRowExpense: { borderLeftColor: theme.color.danger },
  txRowRevenue: { borderLeftColor: theme.color.success },
  txTypeDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  txDotExpense: { backgroundColor: theme.color.danger },
  txDotRevenue: { backgroundColor: theme.color.success },
  txDesc: { fontSize: 14, color: theme.color.textPrimary, fontWeight: '600' },
  txStageTag: { fontSize: 11, color: theme.color.primary },
  txAmountDisplay: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  txAmt: { fontSize: 13, fontWeight: '700' },
  txAmtExpense: { color: theme.color.danger },
  txAmtRevenue: { color: theme.color.success },
  txMeta: { fontSize: 11, color: theme.color.textMuted },
  txMetaName: { color: theme.color.textSecondary, fontWeight: '600' },
  txRowActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  txEdit: { fontSize: 16, color: theme.color.primary },
  txDelete: { fontSize: 16, color: theme.color.danger },
});
