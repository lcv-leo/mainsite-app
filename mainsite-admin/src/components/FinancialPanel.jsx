// Module: mainsite-admin/src/components/FinancialPanel.jsx
// Version: v1.11.0
// Description: Dynamic Y-axis positioning for all modals (Refund, Cancel, Delete) based on mouse click coordinates (e.clientY). Status colors swapped as requested (Refunded = Red, Cancelled/Rejected = Orange). Blood-red trash icon preserved.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom'; // ADDED REACT PORTAL
import { X, DollarSign, RefreshCw, Loader2, RotateCcw, AlertCircle, Check, Ban, Wallet, Trash2, ArrowLeft, Download } from 'lucide-react';

const SUMUP_FILTERS_STORAGE_KEY = 'mainsite_sumup_filters_v1';
const MP_FILTERS_STORAGE_KEY = 'mainsite_mp_filters_v1';

const FinancialPanel = ({ onClose, secret, API_URL, styles, activePalette, isDarkBase }) => {
  const [logs, setLogs] = useState([]);
  const [balance, setBalance] = useState({ available: 0, unavailable: 0 });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const [modalType, setModalType] = useState(null);
  const [activeTx, setActiveTx] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [panelToast, setPanelToast] = useState({ show: false, message: '', type: 'info' });
  const [logCount, setLogCount] = useState(0);
  const [paymentProvider, setPaymentProvider] = useState('mercadopago');
  const [expandedRow, setExpandedRow] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sumupInsights, setSumupInsights] = useState({
    loading: false,
    error: '',
    paymentMethods: [],
    transactions: null,
    advancedTransactions: [],
    payouts: null,
    lastUpdated: null,
  });
  const [sumupAdvancedPagination, setSumupAdvancedPagination] = useState({
    nextCursor: null,
    prevCursor: null,
    lastMove: 'initial',
    page: 1,
  });
  const [mpInsights, setMpInsights] = useState({
    loading: false,
    error: '',
    paymentMethods: [],
    paymentTypes: [],
    transactions: null,
    advancedTransactions: [],
    lastUpdated: null,
  });
  const [mpAdvancedPagination, setMpAdvancedPagination] = useState({
    nextOffset: null,
    prevOffset: null,
    offset: 0,
    page: 1,
  });
  const [sumupFilters, setSumupFilters] = useState(() => {
    const defaults = { statuses: [], types: [], limit: 50 };
    if (typeof window === 'undefined') return defaults;
    try {
      const raw = window.localStorage.getItem(SUMUP_FILTERS_STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return {
        statuses: Array.isArray(parsed?.statuses) ? parsed.statuses : defaults.statuses,
        types: Array.isArray(parsed?.types) ? parsed.types : defaults.types,
        limit: Number(parsed?.limit) || defaults.limit,
      };
    } catch {
      return defaults;
    }
  });
  const [mpFilters, setMpFilters] = useState(() => {
    const defaults = { statuses: [], types: [], limit: 50 };
    if (typeof window === 'undefined') return defaults;
    try {
      const raw = window.localStorage.getItem(MP_FILTERS_STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return {
        statuses: Array.isArray(parsed?.statuses) ? parsed.statuses : defaults.statuses,
        types: Array.isArray(parsed?.types) ? parsed.types : defaults.types,
        limit: Number(parsed?.limit) || defaults.limit,
      };
    } catch {
      return defaults;
    }
  });
  const [toastTop, setToastTop] = useState(30);
  const lastPointerYRef = useRef(null);

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const showPanelToast = useCallback((message, type = 'info') => {
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const pointerY = lastPointerYRef.current;
    const baseY = pointerY != null ? pointerY : (viewportH * 0.5);
    const nextTop = clamp(baseY - 36, 16, Math.max(16, viewportH - 90));
    setToastTop(nextTop);
    setPanelToast({ show: true, message, type });
    setTimeout(() => setPanelToast(prev => ({ ...prev, show: false })), 4000);
  }, []);

  // Rastreia a última posição de interação do usuário no viewport,
  // para exibir o toast próximo à região em foco.
  useEffect(() => {
    const trackPointer = (e) => {
      if (typeof e?.clientY === 'number') lastPointerYRef.current = e.clientY;
    };
    window.addEventListener('pointerdown', trackPointer, { passive: true });
    return () => window.removeEventListener('pointerdown', trackPointer);
  }, []);

  const fetchFinanceData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const logsEndpoint = paymentProvider === 'sumup' ? '/sumup-financial-logs' : '/financial-logs';
      const balanceEndpoint = paymentProvider === 'sumup' ? '/sumup-balance' : '/mp-balance';

      const resLogs = await fetch(`${API_URL}${logsEndpoint}`, { headers: { 'Authorization': `Bearer ${secret}` } });
      if (resLogs.ok) {
        const data = await resLogs.json();
        setLogs(data);
        setLogCount(data.length);
      }

      const resBalance = await fetch(`${API_URL}${balanceEndpoint}`, { headers: { 'Authorization': `Bearer ${secret}` } });
      if (resBalance.ok) {
        const balData = await resBalance.json();
        setBalance({ available: balData.available_balance || 0, unavailable: balData.unavailable_balance || 0 });
      }
    } catch (err) {
      console.error("Erro ao sincronizar dados financeiros", err);
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  }, [API_URL, secret, paymentProvider]);

  useEffect(() => { fetchFinanceData(); }, [fetchFinanceData]);

  useEffect(() => {
    const intervalId = setInterval(() => fetchFinanceData(false), 600000);
    return () => clearInterval(intervalId);
  }, [fetchFinanceData]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SUMUP_FILTERS_STORAGE_KEY, JSON.stringify(sumupFilters));
    } catch {
      // ignore write failures (private mode/quota)
    }
  }, [sumupFilters]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(MP_FILTERS_STORAGE_KEY, JSON.stringify(mpFilters));
    } catch {
      // ignore write failures (private mode/quota)
    }
  }, [mpFilters]);

  useEffect(() => {
    const checkWebhook = async () => {
      try {
        const checkEndpoint = paymentProvider === 'sumup' ? '/sumup-financial-logs/check' : '/financial-logs/check';
        const res = await fetch(`${API_URL}${checkEndpoint}`, { headers: { 'Authorization': `Bearer ${secret}` } });
        if (res.ok) {
          const data = await res.json();
          if (logCount !== 0 && data.count > logCount) {
            showPanelToast(`Novo registro processado via ${paymentProvider === 'sumup' ? 'SumUp' : 'Mercado Pago'}! Atualizando...`, "success");
            fetchFinanceData(true);
          }
          setLogCount(data.count);
        }
      } catch { 
          /* silent fail for background ping */ 
       }
    };
    const pingId = setInterval(checkWebhook, 15000);
    return () => clearInterval(pingId);
  }, [API_URL, secret, logCount, fetchFinanceData, paymentProvider, showPanelToast]);

  const executeAction = async () => {
    const { id, dbId } = activeTx;
    const isRefund = modalType === 'refund';
    const isDelete = modalType === 'delete';

    setProcessingId(id);

    // Reset modal states
    setModalType(null);

    try {
      let url;
      let options;

      if (isDelete) {
        const deleteEndpoint = paymentProvider === 'sumup' ? '/sumup-financial-logs' : '/financial-logs';
        url = `${API_URL}${deleteEndpoint}/${dbId}`;
        options = { method: 'DELETE', headers: { 'Authorization': `Bearer ${secret}` } };
      } else {
        const actionBase = paymentProvider === 'sumup' ? '/sumup-payment' : '/mp-payment';
        url = `${API_URL}${actionBase}/${id}/${isRefund ? 'refund' : 'cancel'}`;
        options = { method: isRefund ? 'POST' : 'PUT', headers: { 'Authorization': `Bearer ${secret}`, 'Content-Type': 'application/json' } };

        if (isRefund && refundAmount) {
          const amt = parseFloat(refundAmount.replace(',', '.'));
          if (amt > 0 && amt <= activeTx.amount) options.body = JSON.stringify({ amount: amt });
        }
      }

      const res = await fetch(url, options);
      if (res.ok) {
        showPanelToast(isDelete ? 'Registro excluído do banco com sucesso!' : 'Ação concluída com sucesso!', 'success');
        fetchFinanceData(true);
      } else {
        const errData = await res.json();
        showPanelToast(`Falha: ${errData.error}`, 'error');
      }
    } catch { 
      showPanelToast('Ocorreu um erro de rede.', 'error'); 
    } finally { 
      setProcessingId(null); setRefundAmount(''); 
    }
  };

  const syncSumupCheckouts = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_URL}/sumup/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${secret}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha na sincronização.');
      showPanelToast(`Sincronizado: ${data.inserted} novo(s), ${data.updated} atualizado(s) de ${data.total} checkout(s).`, 'success');
      fetchFinanceData(true);
    } catch (err) {
      showPanelToast(`Erro ao sincronizar: ${err.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [API_URL, secret, fetchFinanceData, showPanelToast]);

  const syncMercadoPagoCheckouts = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_URL}/mp/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${secret}` },
      });
      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(raw || 'Resposta inválida da sincronização do Mercado Pago.');
      }
      if (!res.ok) throw new Error(data.error || 'Falha na sincronização.');
      showPanelToast(`Sincronizado: ${data.inserted} novo(s), ${data.updated} atualizado(s), ${data.scanned} verificada(s).`, 'success');
      fetchFinanceData(true);
    } catch (err) {
      showPanelToast(`Erro ao sincronizar: ${err.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [API_URL, secret, fetchFinanceData, showPanelToast]);

  const fetchSumupInsights = useCallback(async (filters = sumupFilters, cursor = null, move = 'initial') => {
    if (paymentProvider !== 'sumup') return;
    setSumupInsights(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const headers = { Authorization: `Bearer ${secret}` };
      const qs = new URLSearchParams({
        limit: String(filters.limit || 50),
        order: 'descending',
      });
      if (filters.statuses.length) qs.set('statuses', filters.statuses.join(','));
      if (filters.types.length) qs.set('types', filters.types.join(','));
      if (cursor?.newest_time) qs.set('newest_time', cursor.newest_time);
      if (cursor?.newest_ref) qs.set('newest_ref', cursor.newest_ref);
      if (cursor?.oldest_time) qs.set('oldest_time', cursor.oldest_time);
      if (cursor?.oldest_ref) qs.set('oldest_ref', cursor.oldest_ref);

      const [methodsRes, txRes, txAdvRes, payoutsRes] = await Promise.all([
        fetch(`${API_URL}/sumup/payment-methods?amount=10&currency=BRL`, { headers }),
        fetch(`${API_URL}/sumup/transactions-summary?limit=50`, { headers }),
        fetch(`${API_URL}/sumup/transactions-advanced?${qs.toString()}`, { headers }),
        fetch(`${API_URL}/sumup/payouts-summary`, { headers }),
      ]);

      const [methodsData, txData, txAdvancedData, payoutsData] = await Promise.all([
        methodsRes.json(),
        txRes.json(),
        txAdvRes.json(),
        payoutsRes.json(),
      ]);

      if (!methodsRes.ok) throw new Error(methodsData.error || 'Falha ao carregar métodos SumUp.');
      if (!txRes.ok) throw new Error(txData.error || 'Falha ao carregar resumo de transações SumUp.');
      if (!txAdvRes.ok) throw new Error(txAdvancedData.error || 'Falha ao carregar transações avançadas SumUp.');
      if (!payoutsRes.ok) throw new Error(payoutsData.error || 'Falha ao carregar resumo de payouts SumUp.');

      setSumupInsights({
        loading: false,
        error: '',
        paymentMethods: methodsData.methods || [],
        transactions: txData,
        advancedTransactions: txAdvancedData.items || [],
        payouts: payoutsData,
        lastUpdated: new Date().toISOString(),
      });
      setSumupAdvancedPagination((prev) => ({
        nextCursor: txAdvancedData?.cursors?.next || null,
        prevCursor: txAdvancedData?.cursors?.prev || null,
        lastMove: move,
        page: move === 'next'
          ? (prev.page + 1)
          : move === 'prev'
            ? Math.max(1, prev.page - 1)
            : 1,
      }));
    } catch (err) {
      setSumupInsights(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Erro ao carregar insights SumUp.',
      }));
    }
  }, [API_URL, secret, paymentProvider, sumupFilters]);

  const fetchMercadoPagoInsights = useCallback(async (filters = mpFilters, offset = 0) => {
    if (paymentProvider !== 'mercadopago') return;
    setMpInsights(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const headers = { Authorization: `Bearer ${secret}` };
      const qs = new URLSearchParams({
        limit: String(filters.limit || 50),
        offset: String(Number(offset) || 0),
        order: 'desc',
      });
      if (filters.statuses.length) qs.set('statuses', filters.statuses.join(','));
      if (filters.types.length) qs.set('types', filters.types.join(','));

      const [methodsRes, txRes, txAdvRes] = await Promise.all([
        fetch(`${API_URL}/mp/payment-methods?limit=100`, { headers }),
        fetch(`${API_URL}/mp/transactions-summary?limit=50`, { headers }),
        fetch(`${API_URL}/mp/transactions-advanced?${qs.toString()}`, { headers }),
      ]);

      const [methodsData, txData, txAdvancedData] = await Promise.all([
        methodsRes.json(),
        txRes.json(),
        txAdvRes.json(),
      ]);

      if (!methodsRes.ok) throw new Error(methodsData.error || 'Falha ao carregar métodos do Mercado Pago.');
      if (!txRes.ok) throw new Error(txData.error || 'Falha ao carregar resumo de transações do Mercado Pago.');
      if (!txAdvRes.ok) throw new Error(txAdvancedData.error || 'Falha ao carregar transações avançadas do Mercado Pago.');

      setMpInsights({
        loading: false,
        error: '',
        paymentMethods: methodsData.methods || [],
        paymentTypes: methodsData.types || [],
        transactions: txData,
        advancedTransactions: txAdvancedData.items || [],
        lastUpdated: new Date().toISOString(),
      });

      const paging = txAdvancedData?.paging || {};
      const currentOffset = Number(paging.offset || 0);
      const currentLimit = Number(paging.limit || (filters.limit || 50));
      setMpAdvancedPagination({
        nextOffset: paging.hasNext ? Number(paging.nextOffset) : null,
        prevOffset: paging.hasPrev ? Number(paging.prevOffset) : null,
        offset: currentOffset,
        page: Math.floor(currentOffset / Math.max(1, currentLimit)) + 1,
      });
    } catch (err) {
      setMpInsights(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Erro ao carregar insights Mercado Pago.',
      }));
    }
  }, [API_URL, secret, paymentProvider, mpFilters]);

  // Quando a aba for ativada, sincroniza automaticamente com a API
  // para garantir que transações recusadas, expiradas ou pendentes apareçam corretamente.
  useEffect(() => {
    if (paymentProvider === 'sumup') {
      syncSumupCheckouts();
      fetchSumupInsights(sumupFilters, null, 'initial');
    } else if (paymentProvider === 'mercadopago') {
      syncMercadoPagoCheckouts();
      fetchMercadoPagoInsights(mpFilters, 0);
    }
  }, [paymentProvider, syncSumupCheckouts, syncMercadoPagoCheckouts, fetchSumupInsights, fetchMercadoPagoInsights, sumupFilters, mpFilters]);

  const exportSumupAdvancedCsv = useCallback(() => {
    const rows = Array.isArray(sumupInsights.advancedTransactions) ? sumupInsights.advancedTransactions : [];
    if (!rows.length) {
      showPanelToast('Nenhuma transação avançada para exportar.', 'error');
      return;
    }

    const escapeCsv = (value) => {
      const text = String(value ?? '');
      if (text.includes('"') || text.includes(',') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const headers = [
      'id',
      'transactionCode',
      'amount',
      'currency',
      'status',
      'type',
      'paymentType',
      'cardType',
      'timestamp',
      'user',
      'refundedAmount',
    ];

    const lines = [headers.join(',')];
    rows.forEach((tx) => {
      const line = headers.map((h) => escapeCsv(tx?.[h] ?? '')).join(',');
      lines.push(line);
    });

    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `sumup-transacoes-avancadas-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showPanelToast('CSV exportado com sucesso.', 'success');
  }, [sumupInsights.advancedTransactions, showPanelToast]);

  const exportMpAdvancedCsv = useCallback(() => {
    const rows = Array.isArray(mpInsights.advancedTransactions) ? mpInsights.advancedTransactions : [];
    if (!rows.length) {
      showPanelToast('Nenhuma transação avançada para exportar.', 'error');
      return;
    }

    const escapeCsv = (value) => {
      const text = String(value ?? '');
      if (text.includes('"') || text.includes(',') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const headers = [
      'id',
      'transactionCode',
      'amount',
      'currency',
      'status',
      'type',
      'paymentType',
      'cardType',
      'timestamp',
      'user',
      'refundedAmount',
    ];

    const lines = [headers.join(',')];
    rows.forEach((tx) => {
      const line = headers.map((h) => escapeCsv(tx?.[h] ?? '')).join(',');
      lines.push(line);
    });

    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `mercadopago-transacoes-avancadas-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showPanelToast('CSV exportado com sucesso.', 'success');
  }, [mpInsights.advancedTransactions, showPanelToast]);

  const closeAndResetModal = () => {
    setModalType(null);
    setRefundAmount('');
  };

  // Extrai campos relevantes do raw_payload da SumUp (@sumup/sdk ou REST API)
  // Compatível com SDK oficial v0.1.2+ e respostas HTTP legadas
  const parseSumupPayload = (rawPayload) => {
    if (!rawPayload) return {};
    try {
      const p = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
      const tx = p?.transactions?.[0] || p?.transaction || {};
      
      // Fallbacks para compatibilidade SDK oficial vs REST API legada
      const transactionId = tx?.id || tx?.transaction_id || p?.id;
      const paymentType = tx?.payment_type || tx?.paymentType || p?.payment_type || '—';
      const txStatus = tx?.status || p?.status || '—';
      
      return {
        checkoutStatus: p?.status || '—',
        checkoutRef: p?.checkout_reference || p?.checkoutReference || '—',
        transactionCode: tx?.transaction_code || tx?.transactionCode || p?.transaction_code || '—',
        transactionUUID: transactionId || '—',
        paymentType: paymentType,
        authCode: tx?.auth_code || tx?.authCode || '—',
        entryMode: tx?.entry_mode || tx?.entryMode || '—',
        currency: tx?.currency || p?.currency || 'BRL',
        txTimestamp: tx?.timestamp || tx?.created_at || null,
        internalId: tx?.internal_id || tx?.internalId || '—',
        txStatus: txStatus,
      };
    } catch { return {}; }
  };

  // Config de status para todos os estados SumUp conhecidos (normalizado para MAIÚSCULAS)
  const getSumupStatusConfig = (status) => {
    const s = (status || '').toUpperCase();
    if (['PAID', 'SUCCESSFUL', 'APPROVED'].includes(s))
      return { color: '#10b981', bg: 'rgba(16,185,129,0.15)', label: 'APROVADO', canRefund: true, canCancel: false };
    if (['PENDING', 'IN_PROCESS', 'PROCESSING'].includes(s))
      return { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'PENDENTE', canRefund: false, canCancel: true };
    if (['FAILED', 'FAILURE'].includes(s))
      return { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'FALHOU', canRefund: false, canCancel: false };
    if (s === 'EXPIRED')
      return { color: '#6b7280', bg: 'rgba(107,114,128,0.15)', label: 'EXPIRADO', canRefund: false, canCancel: false };
    if (s === 'REFUNDED')
      return { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', label: 'ESTORNADO', canRefund: false, canCancel: false };
    if (s === 'PARTIALLY_REFUNDED')
      return { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', label: 'EST. PARCIAL', canRefund: true, canCancel: false };
    if (['CANCELLED', 'CANCEL', 'CANCELED'].includes(s))
      return { color: '#f97316', bg: 'rgba(249,115,22,0.15)', label: 'CANCELADO', canRefund: false, canCancel: false };
    if (s.includes('CHARGEBACK') || s.includes('CHARGE_BACK'))
      return { color: '#dc2626', bg: 'rgba(220,38,38,0.15)', label: 'CHARGEBACK', canRefund: false, canCancel: false };
    return { color: '#6b7280', bg: 'rgba(107,114,128,0.15)', label: s || '?', canRefund: false, canCancel: false };
  };

  // Extrai campos relevantes do raw_payload do Mercado Pago
  const parseMPPayload = (rawPayload) => {
    if (!rawPayload) return {};
    try {
      const p = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
      const card = p.card || {};
      const td = p.transaction_details || {};
      const fees = p.fee_details || [];
      const payer = p.payer || {};
      const identification = payer.identification || {};
      return {
        statusDetail: p.status_detail,
        paymentMethodId: p.payment_method_id,
        paymentTypeId: p.payment_type_id,
        installments: p.installments,
        lastFour: card.last_four_digits,
        firstSix: card.first_six_digits,
        cardholderName: card.cardholder?.name,
        netReceivedAmount: td.net_received_amount,
        totalPaidAmount: td.total_paid_amount,
        acquirerRef: td.acquirer_reference,
        feeAmount: fees[0]?.amount,
        dateApproved: p.date_approved,
        moneyReleaseDate: p.money_release_date,
        moneyReleaseStatus: p.money_release_status,
        authCode: p.authorization_code,
        externalRef: p.external_reference,
        processingMode: p.processing_mode,
        netAmount: p.net_amount,
        payerName: [payer.first_name, payer.last_name].filter(Boolean).join(' ') || null,
        payerDoc: identification.number ? `${identification.type}: ${identification.number}` : null,
      };
    } catch { return {}; }
  };

  // Config de status para todos os estados do Mercado Pago
  const getMPStatusConfig = (status, statusDetail) => {
    const s = (status || '').toLowerCase();
    const d = (statusDetail || '').toLowerCase();
    if (s === 'approved') {
      if (d === 'partially_refunded')
        return { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', label: 'EST. PARCIAL', canRefund: true, canCancel: false };
      return { color: '#10b981', bg: 'rgba(16,185,129,0.15)', label: 'APROVADO', canRefund: true, canCancel: false };
    }
    if (s === 'in_process')
      return { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', label: 'EM ANÁLISE', canRefund: false, canCancel: true };
    if (s === 'pending')
      return { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'PENDENTE', canRefund: false, canCancel: true };
    if (s === 'rejected') {
      if (d.includes('insufficient_amount'))
        return { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'SEM SALDO', canRefund: false, canCancel: false };
      if (d.includes('call_for_authorize'))
        return { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'LIGUE AO BANCO', canRefund: false, canCancel: false };
      if (d.includes('bad_filled') || d.includes('form_error'))
        return { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'DADOS INVÁLIDOS', canRefund: false, canCancel: false };
      if (d.includes('duplicated'))
        return { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'DUPLICADO', canRefund: false, canCancel: false };
      if (d.includes('max_attempts'))
        return { color: '#dc2626', bg: 'rgba(220,38,38,0.15)', label: 'LIMITE ATINGIDO', canRefund: false, canCancel: false };
      return { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'RECUSADO', canRefund: false, canCancel: false };
    }
    if (s === 'refunded')
      return { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', label: 'ESTORNADO', canRefund: false, canCancel: false };
    if (s === 'cancelled')
      return { color: '#f97316', bg: 'rgba(249,115,22,0.15)', label: 'CANCELADO', canRefund: false, canCancel: false };
    if (s === 'charged_back')
      return { color: '#dc2626', bg: 'rgba(220,38,38,0.15)', label: 'CHARGEBACK', canRefund: false, canCancel: false };
    return { color: '#6b7280', bg: 'rgba(107,114,128,0.15)', label: (status || '?').toUpperCase(), canRefund: false, canCancel: false };
  };

  // Glassmorphism local styles
  const glassCard = { background: isDarkBase ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)', border: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: '24px', padding: '30px', marginBottom: '24px', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' };
  const actionBtnStyle = (colorBase) => ({ background: isDarkBase ? `rgba(${colorBase}, 0.15)` : `rgba(${colorBase}, 0.1)`, color: `rgb(${colorBase})`, border: `1px solid rgba(${colorBase}, 0.3)`, borderRadius: '12px', padding: '8px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: `0 4px 12px rgba(${colorBase}, 0.15)` });

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>

      {/* Toast Notification — posicionamento inteligente por área de interação no viewport */}
      <div style={{ ...styles.toast, top: `${toastTop}px`, bottom: 'auto', transform: panelToast.show ? 'translate(-50%, 0)' : 'translate(-50%, -28px)', opacity: panelToast.show ? 1 : 0, backgroundColor: panelToast.type === 'error' ? 'var(--semantic-error)' : (isDarkBase ? '#1e1e1e' : '#fff'), color: panelToast.type === 'error' ? '#fff' : activePalette.fontColor, zIndex: 10005 }}>
        {panelToast.type === 'error' ? <AlertCircle size={18} /> : <Check size={18} />} <span>{panelToast.message}</span>
      </div>

      {/* DYNAMIC MODAL USING REACT PORTALS FOR PERFECT VIEWPORT CENTERING */}
      {modalType && createPortal(
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, margin: 0 }}>
            <AlertCircle size={48} color={modalType === 'delete' ? 'var(--semantic-error)' : (modalType === 'cancel' ? 'var(--semantic-warning)' : 'var(--semantic-error)')} style={{ marginBottom: '20px', margin: '0 auto' }} />
            
            {modalType === 'delete' ? ( 
              <p style={styles.modalText}>Tem certeza de que deseja <strong>EXCLUIR</strong> este registro de log permanentemente do banco de dados?</p> 
            ) : modalType === 'cancel' ? ( 
              <p style={styles.modalText}>Tem certeza de que deseja <strong>CANCELAR</strong> o pagamento pendente {activeTx.id} no {paymentProvider === 'sumup' ? 'SumUp' : 'Mercado Pago'}?</p> 
            ) : (
              <div>
                <p style={styles.modalText}>Estorno do pagamento <strong>{activeTx.id}</strong> ({paymentProvider === 'sumup' ? 'SumUp' : 'Mercado Pago'}).</p>
                <input type="text" placeholder={`R$ Máximo: ${activeTx.amount.toFixed(2)}`} value={refundAmount} onChange={(e) => setRefundAmount(e.target.value.replace(/[^0-9.,]/g, ''))} style={{ ...styles.textInput, width: '100%', marginBottom: '20px', textAlign: 'center', fontSize: '16px' }} />
              </div>
            )}

            <div style={styles.modalActions}>
              <button onClick={closeAndResetModal} style={styles.modalBtnCancel}>VOLTAR</button>
              <button onClick={executeAction} style={{...styles.modalBtnConfirm, background: modalType === 'delete' ? 'var(--semantic-error)' : (modalType === 'cancel' ? 'var(--semantic-warning)' : 'var(--semantic-error)')}}>
                {modalType === 'delete' ? 'EXCLUIR REGISTRO' : (modalType === 'cancel' ? 'CONFIRMAR CANCELAMENTO' : 'CONFIRMAR ESTORNO')}
              </button>
            </div>
          </div>
        </div>,
        document.body // Prevents Glassmorphism CSS from trapping the modal
      )}

      {/* Standardized Back Button */}
      <button onClick={onClose} style={styles.backButton}>
        <ArrowLeft size={16} /> Voltar ao Console
      </button>

      <div style={{ ...glassCard, marginBottom: '20px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setPaymentProvider('mercadopago')}
            style={{
              ...actionBtnStyle('14, 165, 233'),
              background: paymentProvider === 'mercadopago' ? 'rgba(14, 165, 233, 0.22)' : (isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
              borderColor: paymentProvider === 'mercadopago' ? 'rgba(14, 165, 233, 0.55)' : (isDarkBase ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'),
              color: paymentProvider === 'mercadopago' ? '#0ea5e9' : activePalette.fontColor,
            }}
          >
            Mercado Pago
          </button>
          <button
            onClick={() => setPaymentProvider('sumup')}
            style={{
              ...actionBtnStyle('79, 70, 229'),
              background: paymentProvider === 'sumup' ? 'rgba(79, 70, 229, 0.22)' : (isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
              borderColor: paymentProvider === 'sumup' ? 'rgba(79, 70, 229, 0.55)' : (isDarkBase ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'),
              color: paymentProvider === 'sumup' ? '#4f46e5' : activePalette.fontColor,
            }}
          >
            SumUp
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div style={{ ...glassCard, marginBottom: 0, borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '13px', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><Wallet size={16} /> Saldo Disponível ({paymentProvider === 'sumup' ? 'SumUp' : 'MP'})</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: activePalette.titleColor }}>R$ {balance.available.toFixed(2)}</div>
        </div>
        <div style={{ ...glassCard, marginBottom: 0, borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '13px', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><RefreshCw size={16} /> Saldo a Liberar ({paymentProvider === 'sumup' ? 'SumUp' : 'MP'})</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: activePalette.titleColor }}>R$ {balance.unavailable.toFixed(2)}</div>
        </div>
      </div>

      {paymentProvider === 'sumup' && (
        <div style={{ ...glassCard, marginBottom: '24px', borderLeft: '4px solid #4f46e5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', color: activePalette.titleColor }}>
              Insights SumUp (SDK Oficial)
            </h3>
            <button
              onClick={() => fetchSumupInsights(sumupFilters, null, 'initial')}
              disabled={sumupInsights.loading}
              style={{
                background: 'transparent',
                border: '1px solid rgba(79,70,229,0.35)',
                color: '#4f46e5',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: sumupInsights.loading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: sumupInsights.loading ? 0.65 : 1,
              }}
            >
              <RefreshCw size={14} className={sumupInsights.loading ? 'animate-spin' : ''} />
              {sumupInsights.loading ? 'ATUALIZANDO...' : 'ATUALIZAR INSIGHTS'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <select
              value={sumupFilters.statuses[0] || ''}
              onChange={(e) => setSumupFilters(prev => ({ ...prev, statuses: e.target.value ? [e.target.value] : [] }))}
              style={{ ...styles.textInput, width: 'auto', minWidth: '180px', fontSize: '12px', padding: '8px 10px' }}
            >
              <option value="">Status (todos)</option>
              <option value="successful">SUCCESSFUL</option>
              <option value="pending">PENDING</option>
              <option value="failed">FAILED</option>
              <option value="cancelled">CANCELLED</option>
              <option value="refunded">REFUNDED</option>
              <option value="charge_back">CHARGE_BACK</option>
            </select>

            <select
              value={sumupFilters.types[0] || ''}
              onChange={(e) => setSumupFilters(prev => ({ ...prev, types: e.target.value ? [e.target.value] : [] }))}
              style={{ ...styles.textInput, width: 'auto', minWidth: '180px', fontSize: '12px', padding: '8px 10px' }}
            >
              <option value="">Tipo (todos)</option>
              <option value="payment">PAYMENT</option>
              <option value="refund">REFUND</option>
              <option value="charge_back">CHARGE_BACK</option>
            </select>

            <select
              value={sumupFilters.limit}
              onChange={(e) => setSumupFilters(prev => ({ ...prev, limit: Number(e.target.value) || 50 }))}
              style={{ ...styles.textInput, width: 'auto', minWidth: '120px', fontSize: '12px', padding: '8px 10px' }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={75}>75</option>
              <option value={100}>100</option>
            </select>

            <button
              onClick={() => fetchSumupInsights(sumupFilters, null, 'initial')}
              disabled={sumupInsights.loading}
              style={{
                background: 'transparent',
                border: '1px solid rgba(79,70,229,0.35)',
                color: '#4f46e5',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: sumupInsights.loading ? 'wait' : 'pointer',
              }}
            >
              Aplicar Filtros
            </button>

            <button
              onClick={() => fetchSumupInsights(sumupFilters, sumupAdvancedPagination.prevCursor, 'prev')}
              disabled={sumupInsights.loading || !sumupAdvancedPagination.prevCursor}
              style={{
                background: 'transparent',
                border: '1px solid rgba(107,114,128,0.35)',
                color: '#6b7280',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: (sumupInsights.loading || !sumupAdvancedPagination.prevCursor) ? 'not-allowed' : 'pointer',
                opacity: (sumupInsights.loading || !sumupAdvancedPagination.prevCursor) ? 0.55 : 1,
              }}
            >
              Página Anterior
            </button>

            <button
              onClick={() => fetchSumupInsights(sumupFilters, sumupAdvancedPagination.nextCursor, 'next')}
              disabled={sumupInsights.loading || !sumupAdvancedPagination.nextCursor}
              style={{
                background: 'transparent',
                border: '1px solid rgba(79,70,229,0.35)',
                color: '#4f46e5',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: (sumupInsights.loading || !sumupAdvancedPagination.nextCursor) ? 'not-allowed' : 'pointer',
                opacity: (sumupInsights.loading || !sumupAdvancedPagination.nextCursor) ? 0.55 : 1,
              }}
            >
              Próxima Página
            </button>

            <button
              onClick={() => fetchSumupInsights(sumupFilters, null, 'initial')}
              disabled={sumupInsights.loading || sumupAdvancedPagination.page === 1}
              style={{
                background: 'transparent',
                border: '1px solid rgba(56,189,248,0.35)',
                color: '#38bdf8',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: (sumupInsights.loading || sumupAdvancedPagination.page === 1) ? 'not-allowed' : 'pointer',
                opacity: (sumupInsights.loading || sumupAdvancedPagination.page === 1) ? 0.55 : 1,
              }}
            >
              Voltar ao Início
            </button>

            <button
              onClick={exportSumupAdvancedCsv}
              disabled={sumupInsights.loading || !sumupInsights.advancedTransactions?.length}
              style={{
                background: 'transparent',
                border: '1px solid rgba(16,185,129,0.35)',
                color: '#10b981',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: (sumupInsights.loading || !sumupInsights.advancedTransactions?.length) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: (sumupInsights.loading || !sumupInsights.advancedTransactions?.length) ? 0.55 : 1,
              }}
            >
              <Download size={14} /> Exportar CSV
            </button>
          </div>

          {sumupInsights.error ? (
            <div style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.35)',
              color: '#ef4444',
              borderRadius: '10px',
              padding: '10px 12px',
              fontSize: '12px',
            }}>
              {sumupInsights.error}
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                <div style={{ background: isDarkBase ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: '10px', padding: '10px' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.6, marginBottom: '4px' }}>Métodos disponíveis</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: activePalette.titleColor }}>
                    {sumupInsights.paymentMethods.length > 0 ? sumupInsights.paymentMethods.join(', ') : '—'}
                  </div>
                </div>

                <div style={{ background: isDarkBase ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: '10px', padding: '10px' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.6, marginBottom: '4px' }}>Transações analisadas</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 800, color: activePalette.titleColor }}>
                    {sumupInsights.transactions?.scanned ?? 0}
                  </div>
                </div>

                <div style={{ background: isDarkBase ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: '10px', padding: '10px' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.6, marginBottom: '4px' }}>Volume transações</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 800, color: activePalette.titleColor }}>
                    R$ {Number(sumupInsights.transactions?.totalAmount || 0).toFixed(2)}
                  </div>
                </div>

                <div style={{ background: isDarkBase ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: '10px', padding: '10px' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.6, marginBottom: '4px' }}>Payouts (30 dias)</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 800, color: activePalette.titleColor }}>
                    R$ {Number(sumupInsights.payouts?.totalAmount || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                {Object.entries(sumupInsights.transactions?.byStatus || {}).map(([status, count]) => (
                  <span key={`tx-${status}`} style={{ padding: '4px 8px', borderRadius: '999px', fontSize: '11px', border: '1px solid rgba(79,70,229,0.25)', background: isDarkBase ? 'rgba(79,70,229,0.12)' : 'rgba(79,70,229,0.08)', color: '#4f46e5', fontWeight: 700 }}>
                    TX {status}: {count}
                  </span>
                ))}
                {Object.entries(sumupInsights.payouts?.byStatus || {}).map(([status, count]) => (
                  <span key={`po-${status}`} style={{ padding: '4px 8px', borderRadius: '999px', fontSize: '11px', border: '1px solid rgba(16,185,129,0.25)', background: isDarkBase ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)', color: '#10b981', fontWeight: 700 }}>
                    PO {status}: {count}
                  </span>
                ))}
              </div>

              <div style={{ marginTop: '10px', fontSize: '10px', opacity: 0.55 }}>
                Última atualização: {sumupInsights.lastUpdated ? new Date(sumupInsights.lastUpdated).toLocaleString('pt-BR') : '—'}
              </div>
              <div style={{ marginTop: '4px', fontSize: '10px', opacity: 0.55 }}>
                Navegação: {sumupAdvancedPagination.lastMove === 'next' ? 'próxima página' : sumupAdvancedPagination.lastMove === 'prev' ? 'página anterior' : 'página inicial'}
              </div>
              <div style={{ marginTop: '2px', fontSize: '10px', opacity: 0.55 }}>
                Página atual: {sumupAdvancedPagination.page}
              </div>

              <div style={{ marginTop: '12px', border: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ padding: '8px 10px', fontSize: '11px', fontWeight: 700, opacity: 0.8, borderBottom: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
                  Transações Avançadas (filtro SDK)
                </div>
                <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  {(sumupInsights.advancedTransactions || []).slice(0, 25).map((tx, idx) => (
                    <div key={`${tx.id || 'tx'}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.7fr 0.7fr', gap: '8px', padding: '8px 10px', borderBottom: `1px dashed ${isDarkBase ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, fontSize: '11px' }}>
                      <span style={{ fontFamily: 'monospace', opacity: 0.8 }}>{tx.transactionCode || tx.id || '—'}</span>
                      <span style={{ fontWeight: 700 }}>R$ {Number(tx.amount || 0).toFixed(2)}</span>
                      <span>{tx.type || '—'}</span>
                      <span>{tx.status || '—'}</span>
                    </div>
                  ))}
                  {(!sumupInsights.advancedTransactions || sumupInsights.advancedTransactions.length === 0) && (
                    <div style={{ padding: '10px', fontSize: '11px', opacity: 0.65 }}>Nenhuma transação encontrada com os filtros atuais.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {paymentProvider === 'mercadopago' && (
        <div style={{ ...glassCard, marginBottom: '24px', borderLeft: '4px solid #0ea5e9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', color: activePalette.titleColor }}>
              Insights Mercado Pago (SDK Oficial)
            </h3>
            <button
              onClick={() => fetchMercadoPagoInsights(mpFilters, mpAdvancedPagination.offset || 0)}
              disabled={mpInsights.loading}
              style={{
                background: 'transparent',
                border: '1px solid rgba(14,165,233,0.35)',
                color: '#0ea5e9',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: mpInsights.loading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: mpInsights.loading ? 0.65 : 1,
              }}
            >
              <RefreshCw size={14} className={mpInsights.loading ? 'animate-spin' : ''} />
              {mpInsights.loading ? 'ATUALIZANDO...' : 'ATUALIZAR INSIGHTS'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <select
              value={mpFilters.statuses[0] || ''}
              onChange={(e) => setMpFilters(prev => ({ ...prev, statuses: e.target.value ? [e.target.value] : [] }))}
              style={{ ...styles.textInput, width: 'auto', minWidth: '180px', fontSize: '12px', padding: '8px 10px' }}
            >
              <option value="">Status (todos)</option>
              <option value="approved">APPROVED</option>
              <option value="pending">PENDING</option>
              <option value="in_process">IN_PROCESS</option>
              <option value="rejected">REJECTED</option>
              <option value="refunded">REFUNDED</option>
              <option value="cancelled">CANCELLED</option>
              <option value="charged_back">CHARGED_BACK</option>
            </select>

            <select
              value={mpFilters.types[0] || ''}
              onChange={(e) => setMpFilters(prev => ({ ...prev, types: e.target.value ? [e.target.value] : [] }))}
              style={{ ...styles.textInput, width: 'auto', minWidth: '180px', fontSize: '12px', padding: '8px 10px' }}
            >
              <option value="">Tipo (todos)</option>
              <option value="credit_card">CREDIT_CARD</option>
              <option value="debit_card">DEBIT_CARD</option>
              <option value="pix">PIX</option>
              <option value="ticket">TICKET</option>
              <option value="account_money">ACCOUNT_MONEY</option>
            </select>

            <select
              value={mpFilters.limit}
              onChange={(e) => setMpFilters(prev => ({ ...prev, limit: Number(e.target.value) || 50 }))}
              style={{ ...styles.textInput, width: 'auto', minWidth: '120px', fontSize: '12px', padding: '8px 10px' }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={75}>75</option>
              <option value={100}>100</option>
            </select>

            <button
              onClick={() => fetchMercadoPagoInsights(mpFilters, mpAdvancedPagination.offset || 0)}
              disabled={mpInsights.loading}
              style={{
                background: 'transparent',
                border: '1px solid rgba(14,165,233,0.35)',
                color: '#0ea5e9',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: mpInsights.loading ? 'wait' : 'pointer',
              }}
            >
              Aplicar Filtros
            </button>

            <button
              onClick={() => fetchMercadoPagoInsights(mpFilters, mpAdvancedPagination.prevOffset || 0)}
              disabled={mpInsights.loading || mpAdvancedPagination.prevOffset === null}
              style={{
                background: 'transparent',
                border: '1px solid rgba(107,114,128,0.35)',
                color: '#6b7280',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: (mpInsights.loading || mpAdvancedPagination.prevOffset === null) ? 'not-allowed' : 'pointer',
                opacity: (mpInsights.loading || mpAdvancedPagination.prevOffset === null) ? 0.55 : 1,
              }}
            >
              Página Anterior
            </button>

            <button
              onClick={() => fetchMercadoPagoInsights(mpFilters, mpAdvancedPagination.nextOffset || 0)}
              disabled={mpInsights.loading || mpAdvancedPagination.nextOffset === null}
              style={{
                background: 'transparent',
                border: '1px solid rgba(14,165,233,0.35)',
                color: '#0ea5e9',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: (mpInsights.loading || mpAdvancedPagination.nextOffset === null) ? 'not-allowed' : 'pointer',
                opacity: (mpInsights.loading || mpAdvancedPagination.nextOffset === null) ? 0.55 : 1,
              }}
            >
              Próxima Página
            </button>

            <button
              onClick={() => fetchMercadoPagoInsights(mpFilters, 0)}
              disabled={mpInsights.loading || mpAdvancedPagination.page === 1}
              style={{
                background: 'transparent',
                border: '1px solid rgba(56,189,248,0.35)',
                color: '#38bdf8',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: (mpInsights.loading || mpAdvancedPagination.page === 1) ? 'not-allowed' : 'pointer',
                opacity: (mpInsights.loading || mpAdvancedPagination.page === 1) ? 0.55 : 1,
              }}
            >
              Voltar ao Início
            </button>

            <button
              onClick={exportMpAdvancedCsv}
              disabled={mpInsights.loading || !mpInsights.advancedTransactions?.length}
              style={{
                background: 'transparent',
                border: '1px solid rgba(16,185,129,0.35)',
                color: '#10b981',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: (mpInsights.loading || !mpInsights.advancedTransactions?.length) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: (mpInsights.loading || !mpInsights.advancedTransactions?.length) ? 0.55 : 1,
              }}
            >
              <Download size={14} /> Exportar CSV
            </button>
          </div>

          {mpInsights.error ? (
            <div style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.35)',
              color: '#ef4444',
              borderRadius: '10px',
              padding: '10px 12px',
              fontSize: '12px',
            }}>
              {mpInsights.error}
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                <div style={{ background: isDarkBase ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '10px', padding: '10px' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.6, marginBottom: '4px' }}>Métodos disponíveis</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: activePalette.titleColor }}>
                    {mpInsights.paymentMethods.length > 0 ? mpInsights.paymentMethods.join(', ') : '—'}
                  </div>
                </div>

                <div style={{ background: isDarkBase ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '10px', padding: '10px' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.6, marginBottom: '4px' }}>Transações analisadas</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 800, color: activePalette.titleColor }}>
                    {mpInsights.transactions?.scanned ?? 0}
                  </div>
                </div>

                <div style={{ background: isDarkBase ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '10px', padding: '10px' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.6, marginBottom: '4px' }}>Volume transações</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 800, color: activePalette.titleColor }}>
                    R$ {Number(mpInsights.transactions?.totalAmount || 0).toFixed(2)}
                  </div>
                </div>

                <div style={{ background: isDarkBase ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '10px', padding: '10px' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.6, marginBottom: '4px' }}>Volume líquido</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 800, color: activePalette.titleColor }}>
                    R$ {Number(mpInsights.transactions?.totalNetAmount || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                {Object.entries(mpInsights.transactions?.byStatus || {}).map(([status, count]) => (
                  <span key={`mp-tx-${status}`} style={{ padding: '4px 8px', borderRadius: '999px', fontSize: '11px', border: '1px solid rgba(14,165,233,0.25)', background: isDarkBase ? 'rgba(14,165,233,0.12)' : 'rgba(14,165,233,0.08)', color: '#0ea5e9', fontWeight: 700 }}>
                    TX {status}: {count}
                  </span>
                ))}
                {Object.entries(mpInsights.transactions?.byType || {}).map(([type, count]) => (
                  <span key={`mp-ty-${type}`} style={{ padding: '4px 8px', borderRadius: '999px', fontSize: '11px', border: '1px solid rgba(16,185,129,0.25)', background: isDarkBase ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)', color: '#10b981', fontWeight: 700 }}>
                    TY {type}: {count}
                  </span>
                ))}
              </div>

              <div style={{ marginTop: '10px', fontSize: '10px', opacity: 0.55 }}>
                Última atualização: {mpInsights.lastUpdated ? new Date(mpInsights.lastUpdated).toLocaleString('pt-BR') : '—'}
              </div>
              <div style={{ marginTop: '2px', fontSize: '10px', opacity: 0.55 }}>
                Página atual: {mpAdvancedPagination.page}
              </div>

              <div style={{ marginTop: '12px', border: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ padding: '8px 10px', fontSize: '11px', fontWeight: 700, opacity: 0.8, borderBottom: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
                  Transações Avançadas (filtro SDK)
                </div>
                <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  {(mpInsights.advancedTransactions || []).slice(0, 25).map((tx, idx) => (
                    <div key={`${tx.id || 'tx'}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.7fr 0.7fr', gap: '8px', padding: '8px 10px', borderBottom: `1px dashed ${isDarkBase ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, fontSize: '11px' }}>
                      <span style={{ fontFamily: 'monospace', opacity: 0.8 }}>{tx.transactionCode || tx.id || '—'}</span>
                      <span style={{ fontWeight: 700 }}>R$ {Number(tx.amount || 0).toFixed(2)}</span>
                      <span>{tx.type || '—'}</span>
                      <span>{tx.status || '—'}</span>
                    </div>
                  ))}
                  {(!mpInsights.advancedTransactions || mpInsights.advancedTransactions.length === 0) && (
                    <div style={{ padding: '10px', fontSize: '11px', opacity: 0.65 }}>Nenhuma transação encontrada com os filtros atuais.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div style={glassCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <h2 style={{ fontSize: '16px', margin: 0, color: activePalette.titleColor, display: 'flex', alignItems: 'center', gap: '10px' }}><DollarSign size={20} /> Histórico de Transações e Logs ({paymentProvider === 'sumup' ? 'SumUp' : 'Mercado Pago'})</h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {paymentProvider === 'sumup' && (
              <button onClick={syncSumupCheckouts} disabled={isSyncing} style={{ background: 'transparent', border: '1px solid rgba(79,70,229,0.35)', color: '#4f46e5', padding: '6px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: isSyncing ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', opacity: isSyncing ? 0.6 : 1 }}>
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} /> {isSyncing ? 'SINCRONIZANDO...' : 'SINCRONIZAR SUMUP'}
              </button>
            )}
            {paymentProvider === 'mercadopago' && (
              <button onClick={syncMercadoPagoCheckouts} disabled={isSyncing} style={{ background: 'transparent', border: '1px solid rgba(0,158,85,0.35)', color: '#009e55', padding: '6px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: isSyncing ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', opacity: isSyncing ? 0.6 : 1 }}>
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} /> {isSyncing ? 'SINCRONIZANDO...' : 'SINCRONIZAR MERCADO PAGO'}
              </button>
            )}
            <button onClick={() => fetchFinanceData(true)} style={{ background: 'transparent', border: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, color: activePalette.fontColor, padding: '6px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> {isRefreshing ? 'ATUALIZANDO...' : 'ATUALIZAR AGORA'}
            </button>
          </div>
        </div>

        {/* Legenda de status */}
        {!loading && logs.length > 0 && (() => {
          const counts = {};
          logs.forEach(log => {
            let cfg;
            if (paymentProvider === 'sumup') {
              cfg = getSumupStatusConfig(log.status);
            } else {
              const mpRaw = parseMPPayload(log.raw_payload);
              cfg = getMPStatusConfig(log.status, mpRaw.statusDetail);
            }
            counts[cfg.label] = counts[cfg.label] || { color: cfg.color, bg: cfg.bg, n: 0, sum: 0 };
            counts[cfg.label].n++;
            counts[cfg.label].sum += Number(log.amount || 0);
          });
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '18px' }}>
              {Object.entries(counts).map(([label, { color, bg, n, sum }]) => (
                <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: bg, color, border: `1px solid ${color}40` }}>
                  {label} <span style={{ opacity: 0.75 }}>× {n}</span> <span style={{ opacity: 0.6 }}>R$ {sum.toFixed(2)}</span>
                </span>
              ))}
            </div>
          );
        })()}

        {loading ? (<div style={{ display: 'flex', justifyContent: 'center', padding: '30px' }}><Loader2 className="animate-spin" size={24} /></div>
        ) : logs.length === 0 ? (<p style={{ fontSize: '13px', opacity: 0.6, textAlign: 'center' }}>Nenhum log financeiro registrado ainda.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
                  <th style={{ padding: '12px' }}>Data</th>
                  <th style={{ padding: '12px' }}>ID</th>
                  {paymentProvider === 'sumup' && <th style={{ padding: '12px' }}>Código TX</th>}
                  {paymentProvider === 'sumup' && <th style={{ padding: '12px' }}>Tipo</th>}
                  {paymentProvider === 'mercadopago' && <th style={{ padding: '12px' }}>Método</th>}
                  {paymentProvider === 'mercadopago' && <th style={{ padding: '12px' }}>Parcelas</th>}
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px' }}>Valor (R$)</th>
                  <th style={{ padding: '12px' }}>E-mail / Ações</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const txId = log.payment_id || log.id;
                  const amount = Number(log.amount || 0);
                  const isExpanded = expandedRow === log.id;

                  // Config de status por provedor
                  const mpInfo = paymentProvider === 'mercadopago' ? parseMPPayload(log.raw_payload) : {};
                  const sumupInfo = paymentProvider === 'sumup' ? parseSumupPayload(log.raw_payload) : {};
                  const statusCfg = paymentProvider === 'sumup'
                    ? getSumupStatusConfig(log.status)
                    : getMPStatusConfig(log.status, mpInfo.statusDetail);
                  const isApproved = statusCfg.canRefund;
                  const isPending = statusCfg.canCancel;

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        style={{ borderBottom: isExpanded ? 'none' : `1px dashed ${isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`, cursor: 'pointer', background: isExpanded ? (isDarkBase ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : 'transparent' }}
                        onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                      >
                        <td style={{ padding: '12px', opacity: 0.8, whiteSpace: 'nowrap' }}>
                          {new Date(log.created_at.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                        </td>
                        <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '11px', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={txId}>
                          {txId}
                        </td>
                        {paymentProvider === 'sumup' && (
                          <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: activePalette.titleColor }}>
                            {sumupInfo.transactionCode}
                          </td>
                        )}
                        {paymentProvider === 'sumup' && (
                          <td style={{ padding: '12px', fontSize: '11px', opacity: 0.8 }}>
                            {sumupInfo.paymentType}
                          </td>
                        )}
                        {paymentProvider === 'mercadopago' && (
                          <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '11px', fontWeight: 'bold', color: activePalette.titleColor }}>
                            {mpInfo.paymentMethodId || '—'}
                          </td>
                        )}
                        {paymentProvider === 'mercadopago' && (
                          <td style={{ padding: '12px', fontSize: '11px', textAlign: 'center', opacity: 0.8 }}>
                            {mpInfo.installments ? `${mpInfo.installments}×` : '—'}
                          </td>
                        )}
                        <td style={{ padding: '12px' }}>
                          <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', background: statusCfg.bg, color: statusCfg.color, whiteSpace: 'nowrap' }}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                          {amount.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                            <span style={{ opacity: 0.7, fontSize: '12px' }}>{log.payer_email !== 'N/A' ? log.payer_email : '—'}</span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {isApproved && (
                                <button onClick={() => { setActiveTx({ id: txId, dbId: log.id, amount }); setModalType('refund'); }} disabled={processingId === txId} style={actionBtnStyle('245, 158, 11')} title={paymentProvider === 'sumup' ? 'Pode levar até 24h para estar disponível após a liquidação' : ''}>
                                  <RotateCcw size={14} /> Estornar
                                </button>
                              )}
                              {isPending && (
                                <button onClick={() => { setActiveTx({ id: txId, dbId: log.id, amount }); setModalType('cancel'); }} disabled={processingId === txId} style={actionBtnStyle('239, 68, 68')}>
                                  <Ban size={14} /> Cancelar
                                </button>
                              )}
                              <button onClick={() => { setActiveTx({ id: txId, dbId: log.id, amount }); setModalType('delete'); }} disabled={processingId === txId} style={actionBtnStyle('179, 0, 0')} title="Excluir registro">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Painel de detalhes expansível */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} style={{ padding: '0', borderBottom: `1px dashed ${isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                            {paymentProvider === 'sumup' ? (
                              <div style={{ padding: '16px 20px', background: isDarkBase ? 'rgba(79,70,229,0.08)' : 'rgba(79,70,229,0.04)', borderLeft: '3px solid #4f46e5', margin: '0 12px 12px 12px', borderRadius: '0 8px 8px 0', fontSize: '12px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                  {[
                                    ['Checkout UUID', txId],
                                    ['Transação UUID', sumupInfo.transactionUUID],
                                    ['Código TX', sumupInfo.transactionCode],
                                    ['Auth Code', sumupInfo.authCode],
                                    ['Tipo de Pagamento', sumupInfo.paymentType],
                                    ['Entry Mode', sumupInfo.entryMode],
                                    ['Status Checkout', sumupInfo.checkoutStatus],
                                    ['Status Transação', sumupInfo.txStatus],
                                    ['Moeda', sumupInfo.currency],
                                    ['ID Interno', String(sumupInfo.internalId)],
                                    ['Checkout Ref', sumupInfo.checkoutRef],
                                    ['Data TX (UTC)', sumupInfo.txTimestamp ? new Date(sumupInfo.txTimestamp).toLocaleString('pt-BR') : '—'],
                                  ].map(([label, value]) => (
                                    <div key={label}>
                                      <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.5px', marginBottom: '2px' }}>{label}</div>
                                      <div style={{ fontFamily: 'monospace', fontWeight: '600', wordBreak: 'break-all', color: activePalette.titleColor }}>{value || '—'}</div>
                                    </div>
                                  ))}
                                </div>
                                {statusCfg.canRefund && (
                                  <div style={{ marginTop: '12px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <AlertCircle size={13} /> Estornos SumUp só ficam disponíveis após a liquidação da transação (geralmente em até 24h).
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ padding: '16px 20px', background: isDarkBase ? 'rgba(14,165,233,0.08)' : 'rgba(14,165,233,0.04)', borderLeft: '3px solid #0ea5e9', margin: '0 12px 12px 12px', borderRadius: '0 8px 8px 0', fontSize: '12px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                  {[
                                    ['Payment ID', txId],
                                    ['Ref. Externa', mpInfo.externalRef],
                                    ['Método de Pgto.', mpInfo.paymentMethodId],
                                    ['Tipo de Pgto.', mpInfo.paymentTypeId],
                                    ['Detalhe do Status', mpInfo.statusDetail],
                                    ['Parcelas', mpInfo.installments ? String(mpInfo.installments) : null],
                                    ['Cartão (Primeiros 6)', mpInfo.firstSix],
                                    ['Cartão (Últimos 4)', mpInfo.lastFour],
                                    ['Titular do Cartão', mpInfo.cardholderName],
                                    ['Pagador', mpInfo.payerName],
                                    ['Doc. Pagador', mpInfo.payerDoc],
                                    ['Cód. Autorização', mpInfo.authCode],
                                    ['Valor Total Pago', mpInfo.totalPaidAmount != null ? `R$ ${Number(mpInfo.totalPaidAmount).toFixed(2)}` : null],
                                    ['Valor Líquido Recebido', mpInfo.netReceivedAmount != null ? `R$ ${Number(mpInfo.netReceivedAmount).toFixed(2)}` : null],
                                    ['Taxa MP', mpInfo.feeAmount != null ? `R$ ${Number(mpInfo.feeAmount).toFixed(2)}` : null],
                                    ['Data de Aprovação', mpInfo.dateApproved ? new Date(mpInfo.dateApproved).toLocaleString('pt-BR') : null],
                                    ['Previsão de Liberação', mpInfo.moneyReleaseDate ? new Date(mpInfo.moneyReleaseDate).toLocaleDateString('pt-BR') : null],
                                    ['Status de Liberação', mpInfo.moneyReleaseStatus],
                                    ['Modo de Processamento', mpInfo.processingMode],
                                    ['Ref. Adquirente', mpInfo.acquirerRef],
                                  ].filter(([, value]) => value != null && value !== '').map(([label, value]) => (
                                    <div key={label}>
                                      <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.5px', marginBottom: '2px' }}>{label}</div>
                                      <div style={{ fontFamily: 'monospace', fontWeight: '600', wordBreak: 'break-all', color: activePalette.titleColor }}>{value || '—'}</div>
                                    </div>
                                  ))}
                                </div>
                                {statusCfg.canRefund && (
                                  <div style={{ marginTop: '12px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.3)', color: '#0ea5e9', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <AlertCircle size={13} /> O valor líquido recebido já desconta as taxas do Mercado Pago.
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            <p style={{ fontSize: '11px', opacity: 0.45, textAlign: 'center', marginTop: '12px' }}>Clique em uma linha para ver os detalhes completos da transação.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialPanel;