// src/screens/Create/hooks/useDocsActions.ts
//
// Documents-required handlers extracted from CreateScreen — Phase 5b.
// Owns: per-service document checklist + sub-requirements + Excel import +
// WhatsApp share. State stays in the parent.

import { Alert, Linking } from 'react-native';
import supabase from '../../../lib/supabase';
import { ServiceDocument, ServiceDocumentRequirement } from '../../../types';

export interface UseDocsActionsOptions {
  orgId: string;
  t: (key: any) => string;
  teamMember: { name?: string } | null;

  // Doc list state
  expandedDocSvcId: string | null;
  setExpandedDocSvcId: (v: string | null) => void;
  serviceDocs: Record<string, ServiceDocument[]>;
  setServiceDocs: (
    updater: Record<string, ServiceDocument[]>
      | ((prev: Record<string, ServiceDocument[]>) => Record<string, ServiceDocument[]>),
  ) => void;

  // Add doc inline
  newDocTitle: string;
  setNewDocTitle: (v: string) => void;
  setSavingDoc: (v: boolean) => void;

  // Sub-requirements
  expandedDocReqId: string | null;
  setExpandedDocReqId: (v: string | null) => void;
  docReqs: Record<string, ServiceDocumentRequirement[]>;
  setDocReqs: (
    updater: Record<string, ServiceDocumentRequirement[]>
      | ((prev: Record<string, ServiceDocumentRequirement[]>) => Record<string, ServiceDocumentRequirement[]>),
  ) => void;
  setLoadingDocReqs: (v: string | null) => void;
  docReqNewTitle: string;
  setDocReqNewTitle: (v: string) => void;
  setSavingDocReq: (v: boolean) => void;

  // Excel import (per-service)
  docImportSvcId: string | null;
  docImportTitles: string[];
  setDocImportSvcId: (v: string | null) => void;
  setDocImportRaw: (v: string) => void;
  setDocImportTitles: (v: string[]) => void;
  setImportingDocs: (v: boolean) => void;
}

export function useDocsActions(opts: UseDocsActionsOptions) {
  const {
    orgId, t, teamMember,
    expandedDocSvcId, setExpandedDocSvcId,
    serviceDocs, setServiceDocs,
    newDocTitle, setNewDocTitle, setSavingDoc,
    expandedDocReqId, setExpandedDocReqId,
    docReqs, setDocReqs, setLoadingDocReqs,
    docReqNewTitle, setDocReqNewTitle, setSavingDocReq,
    docImportSvcId, docImportTitles,
    setDocImportSvcId, setDocImportRaw, setDocImportTitles, setImportingDocs,
  } = opts;

  // Fetch documents for a service + pre-fetch sub-req counts (fire-and-forget
  // for the per-doc badges).
  const fetchServiceDocs = async (serviceId: string) => {
    const { data } = await supabase.from('service_documents').select('*').eq('service_id', serviceId).order('sort_order');
    setServiceDocs(prev => ({ ...prev, [serviceId]: (data ?? []) as ServiceDocument[] }));
    for (const doc of data ?? []) {
      supabase.from('service_document_requirements').select('id').eq('doc_id', doc.id)
        .then(({ data: rd }) => {
          if (rd) setDocReqs(prev => ({ ...prev, [doc.id]: rd as ServiceDocumentRequirement[] }));
        });
    }
  };

  const handleToggleDocExpand = async (serviceId: string) => {
    if (expandedDocSvcId === serviceId) { setExpandedDocSvcId(null); return; }
    setExpandedDocSvcId(serviceId);
    await fetchServiceDocs(serviceId);
  };

  const handleAddDoc = async (serviceId: string) => {
    const title = newDocTitle.trim();
    if (!title) return;
    setSavingDoc(true);
    const docs = serviceDocs[serviceId] ?? [];
    const maxOrder = docs.length > 0 ? Math.max(...docs.map(d => d.sort_order)) : 0;
    const { data } = await supabase.from('service_documents')
      .insert({ service_id: serviceId, title, sort_order: maxOrder + 1, org_id: orgId })
      .select().single();
    setSavingDoc(false);
    if (data) {
      setServiceDocs(prev => ({ ...prev, [serviceId]: [...(prev[serviceId] ?? []), data as ServiceDocument] }));
      setNewDocTitle('');
    }
  };

  const handleToggleDocCheck = async (doc: ServiceDocument) => {
    const next = !doc.is_checked;
    await supabase.from('service_documents').update({ is_checked: next }).eq('id', doc.id);
    setServiceDocs(prev => ({
      ...prev,
      [doc.service_id]: (prev[doc.service_id] ?? []).map(d => d.id === doc.id ? { ...d, is_checked: next } : d),
    }));
  };

  const handleDeleteDoc = async (doc: ServiceDocument) => {
    await supabase.from('service_documents').delete().eq('id', doc.id);
    setServiceDocs(prev => ({ ...prev, [doc.service_id]: (prev[doc.service_id] ?? []).filter(d => d.id !== doc.id) }));
  };

  const handleResetChecks = async (serviceId: string) => {
    await supabase.from('service_documents').update({ is_checked: false }).eq('service_id', serviceId);
    setServiceDocs(prev => ({ ...prev, [serviceId]: (prev[serviceId] ?? []).map(d => ({ ...d, is_checked: false })) }));
  };

  const handleShareServiceDocsWhatsApp = (svcName: string, docs: any[]) => {
    if (docs.length === 0) return;
    const lines = [`📋 *${svcName}* — Required Documents:\n`];
    docs.forEach((doc, idx) => {
      lines.push(`${idx + 1}. *${doc.title}*`);
      (docReqs[doc.id] ?? []).forEach((r: any) => lines.push(`   • ${r.title}`));
    });
    if (teamMember?.name) lines.push(`\n_Generated by ${teamMember.name}_`);
    lines.push('_GovPilot, Powered by KTS_');
    const msg = encodeURIComponent(lines.join('\n'));
    Linking.openURL(`https://wa.me/?text=${msg}`).catch(() =>
      Alert.alert(t('error'), t('somethingWrong')),
    );
  };

  // ── Sub-requirements ──────────────────────────────────────
  const fetchDocReqs = async (docId: string) => {
    setLoadingDocReqs(docId);
    const { data } = await supabase
      .from('service_document_requirements')
      .select('*')
      .eq('doc_id', docId)
      .order('sort_order');
    setDocReqs(prev => ({ ...prev, [docId]: (data ?? []) as ServiceDocumentRequirement[] }));
    setLoadingDocReqs(null);
  };

  const handleToggleDocReqExpand = async (docId: string) => {
    if (expandedDocReqId === docId) { setExpandedDocReqId(null); return; }
    setExpandedDocReqId(docId);
    if (!docReqs[docId]) await fetchDocReqs(docId);
  };

  const handleAddDocReq = async (docId: string) => {
    const trimmed = docReqNewTitle.trim();
    if (!trimmed) return;
    setSavingDocReq(true);
    const reqs = docReqs[docId] ?? [];
    const { data } = await supabase
      .from('service_document_requirements')
      .insert({ doc_id: docId, title: trimmed, sort_order: reqs.length + 1, org_id: orgId })
      .select().single();
    setSavingDocReq(false);
    if (data) {
      setDocReqs(prev => ({ ...prev, [docId]: [...(prev[docId] ?? []), data as ServiceDocumentRequirement] }));
      setDocReqNewTitle('');
    }
  };

  const handleDeleteDocReq = async (docId: string, reqId: string) => {
    await supabase.from('service_document_requirements').delete().eq('id', reqId);
    setDocReqs(prev => ({ ...prev, [docId]: (prev[docId] ?? []).filter(r => r.id !== reqId) }));
  };

  // ── Excel import ──────────────────────────────────────────
  const parseDocImport = (raw: string): string[] =>
    raw.split(/\r?\n/).map(l => l.split('\t')[0].trim()).filter(Boolean);

  const handleImportDocs = async () => {
    if (!docImportSvcId || !docImportTitles.length) return;
    setImportingDocs(true);
    const docs = serviceDocs[docImportSvcId] ?? [];
    const maxOrder = docs.length > 0 ? Math.max(...docs.map(d => d.sort_order)) : 0;
    const inserts = docImportTitles.map((title, i) => ({
      service_id: docImportSvcId,
      title,
      sort_order: maxOrder + i + 1,
      is_checked: false,
      org_id: orgId,
    }));
    const { data, error } = await supabase.from('service_documents').insert(inserts).select();
    setImportingDocs(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    if (data) {
      const svcId = docImportSvcId;
      setServiceDocs(prev => ({ ...prev, [svcId]: [...(prev[svcId] ?? []), ...(data as ServiceDocument[])] }));
    }
    setDocImportSvcId(null);
    setDocImportRaw('');
    setDocImportTitles([]);
    Alert.alert(t('success'), `${inserts.length} ${t('documents')}`);
  };

  return {
    handleToggleDocExpand,
    handleAddDoc,
    handleToggleDocCheck,
    handleDeleteDoc,
    handleResetChecks,
    handleShareServiceDocsWhatsApp,
    handleToggleDocReqExpand,
    handleAddDocReq,
    handleDeleteDocReq,
    parseDocImport,
    handleImportDocs,
  };
}
