'use client';

import React, { useState } from 'react';
import RiskBadge from '@/components/RiskBadge';

interface Requester {
  id: number;
  name: string;
  email: string;
  department_name: string;
}

interface Reviewer {
  id: number;
  name: string;
  email: string;
  department_name: string;
}

export interface ApprovalData {
  id: number;
  entity_type: string;
  action: string;
  status: string;
  payload_json: string;
  notes: string;
  created_at: string;
  reviewed_at?: string;
  requester: Requester;
  reviewer?: Reviewer;
}

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ApprovalData | null;
  onAction: (id: number, actionType: 'approve' | 'reject', notes: string) => Promise<void>;
}

const ENTITY_META: Record<string, { label: string; color: string; icon: string }> = {
  Sarpras: { label: 'Sarpras', color: 'text-blue-600', icon: '🔧' },
  SarprasBulk: { label: 'Import Sarpras', color: 'text-indigo-600', icon: '📊' },
  SarprasType: { label: 'Jenis Sarpras', color: 'text-purple-600', icon: '📦' },
  Site: { label: 'Site', color: 'text-green-600', icon: '🏢' },
  Department: { label: 'Departemen', color: 'text-orange-600', icon: '🏛️' },
  User: { label: 'User', color: 'text-cyan-600', icon: '👤' },
};

const ACTION_META: Record<string, { label: string; bg: string; icon: string }> = {
  create: { label: 'Buat Baru', bg: 'bg-green-50 text-green-700 border-green-200', icon: '➕' },
  edit: { label: 'Ubah', bg: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: '✏️' },
  delete: { label: 'Hapus', bg: 'bg-red-50 text-red-700 border-red-200', icon: '🗑️' },
};

const STATUS_META: Record<string, { label: string; bg: string; icon: string }> = {
  pending: { label: 'Pending', bg: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '⏳' },
  approved: { label: 'Disetujui', bg: 'bg-green-100 text-green-800 border-green-200', icon: '✅' },
  rejected: { label: 'Ditolak', bg: 'bg-red-100 text-red-800 border-red-200', icon: '❌' },
};

function computeRiskLevel(isCritical: boolean, hasAlternative: boolean, hasRiskLocation: boolean): string {
  const score = (isCritical ? 1 : 0) + (hasAlternative ? 0 : 1) + (hasRiskLocation ? 1 : 0);
  if (score >= 3) return 'CRITICAL';
  if (score === 2) return 'HIGH';
  if (score === 1) return 'MEDIUM';
  return 'LOW';
}

const RenderParameters = ({ parameters }: { parameters: any[] }) => {
  if (!parameters || parameters.length === 0) return null;
  return (
    <div>
      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">
        Parameter Inspeksi ({parameters.length})
      </p>
      <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar pr-1">
        {parameters
          .sort((a: any, b: any) => (a.order_no || 0) - (b.order_no || 0))
          .map((param: any, idx: number) => (
            <div key={idx} className="flex items-start gap-3 bg-white p-3 rounded-md border border-gray-100 hover:border-blue-200 transition-colors group">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-50 text-[11px] font-bold text-blue-600 flex items-center justify-center mt-0.5 group-hover:bg-blue-100 transition-colors">
                {param.order_no || idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">{param.name}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{param.desc}</p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

const RenderSarprasCreate = ({ payload, notes }: { payload: any; notes: string }) => {
  return (
    <div className="bg-white border border-gray-100 rounded-md overflow-hidden shadow-sm">
      <table className="w-full text-left text-sm">
        <tbody className="divide-y divide-gray-100">
          <tr className="bg-gray-50/50">
            <td className="py-3.5 px-5 font-semibold text-gray-500 w-1/3 text-xs uppercase tracking-wider">Kode Sarpras</td>
            <td className="py-3.5 px-5 font-bold text-gray-900">{payload.code || '-'}</td>
          </tr>
          <tr>
            <td className="py-3.5 px-5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Tipe Sarpras</td>
            <td className="py-3.5 px-5 font-medium text-gray-800">{payload.sarpras_type__name || '-'}</td>
          </tr>
          <tr className="bg-gray-50/50">
            <td className="py-3.5 px-5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Lokasi Departemen</td>
            <td className="py-3.5 px-5 font-medium text-gray-800">{payload.location_dept_name || '-'}</td>
           </tr>
          <tr>
            <td className="py-3.5 px-5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Lokasi Detail</td>
            <td className="py-3.5 px-5 font-medium text-gray-800">{payload.location_detail || '-'}</td>
           </tr>
          <tr className="bg-gray-50/50">
            <td className="py-3.5 px-5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Risk Level</td>
            <td className="py-3.5 px-5">
              <RiskBadge risk={payload.risk_level || '-'} />
            </td>
           </tr>
          <tr>
            <td className="py-3.5 px-5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Risk Score</td>
            <td className="py-3.5 px-5">
              <span className="inline-flex items-center gap-1 font-bold text-red-600">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                </svg>
                {payload.risk_score || 0} Points
              </span>
            </td>
           </tr>
          {payload.expired_date && (
            <tr className="bg-gray-50/50">
              <td className="py-3.5 px-5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Tanggal Kadaluarsa</td>
              <td className="py-3.5 px-5 font-medium text-gray-800">{new Date(payload.expired_date).toLocaleDateString('id-ID')}</td>
             </tr>
          )}
          {notes && (
            <tr className="bg-gray-50/50">
              <td className="py-3.5 px-5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Catatan Pemohon</td>
              <td className="py-3.5 px-5 font-medium text-gray-700 italic">"{notes}"</td>
            </tr>
          )}
        </tbody>
       </table>
    </div>
  );
};

const RenderSarprasBulk = ({ payload, notes }: { payload: any; notes: string }) => {
  const items = payload.items || [];
  const totalItems = items.length;
  const sampleItems = items.slice(0, 5);
  const hasMore = items.length > 5;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-md overflow-hidden shadow-sm">
        <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-100">
          <p className="text-xs font-bold text-indigo-700 flex items-center gap-1">
            <span>📦</span> Import Multi Baris
          </p>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Total Baris Data</p>
              <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Status Semua Baris</p>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-green-100 text-green-700">
                ✅ Valid 
              </span>
            </div>
          </div>
          {notes && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Catatan Pemohon</p>
              <p className="text-sm text-gray-700 italic">"{notes}"</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-md overflow-hidden shadow-sm">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            Total data : {totalItems} data
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/50 text-[10px] font-semibold text-gray-400 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Jenis Sarpras</th>
                <th className="px-4 py-2 text-left">Dept</th>
                <th className="px-4 py-2 text-left">Site</th>
                <th className="px-4 py-2 text-left">Lokasi Detail</th>
                <th className="px-4 py-2 text-left">Kritis</th>
                <th className="px-4 py-2 text-left">Alternatif</th>
                <th className="px-4 py-2 text-left">Area Risiko</th>
                <th className="px-4 py-2 text-left">Expired</th>
                <th className="px-4 py-2 text-left">Risk Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-xs">
              {sampleItems.map((item: any, idx: number) => {
                const riskLevel = computeRiskLevel(
                  item.is_critical ?? false,
                  item.has_alternative ?? false,
                  item.has_risk_location ?? false,
                );
                return (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-2 font-medium text-gray-800">{item.sarpras_type_code}</td>
                    <td className="px-4 py-2 text-gray-600">{item.location_dept_code}</td>
                    <td className="px-4 py-2 text-gray-600">{item.site_code}</td>
                    <td className="px-4 py-2 text-gray-600 max-w-[180px] truncate">{item.location_detail}</td>
                    <td className="px-4 py-2 text-center">{item.is_critical ? '✓' : '✗'}</td>
                    <td className="px-4 py-2 text-center">{item.has_alternative ? '✓' : '✗'}</td>
                    <td className="px-4 py-2 text-center">{item.has_risk_location ? '✓' : '✗'}</td>
                    <td className="px-4 py-2 text-gray-500 font-mono">{item.expired_date || '—'}</td>
                    <td className="px-4 py-2">
                      <RiskBadge risk={riskLevel} />
                    </td>
                  </tr>
                );
              })}
              {hasMore && (
                <tr className="bg-gray-50 text-gray-400 text-center">
                  <td colSpan={10} className="px-4 py-2 text-[11px]">... dan {totalItems - 5} baris lainnya</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const RenderSarprasEdit = ({ payload, notes }: { payload: any; notes: string }) => {
  return (
    <div className="bg-white border border-gray-100 rounded-md overflow-hidden shadow-sm">
      <div className="bg-amber-50 px-4 py-2 border-b border-amber-200">
        <p className="text-xs font-bold text-amber-700 flex items-center gap-1">
          <span>✏️</span> Perubahan yang diajukan
        </p>
      </div>
      <table className="w-full text-left text-sm">
        <tbody className="divide-y divide-gray-100">
          <tr className="bg-gray-50/50">
            <td className="py-3.5 px-5 font-semibold text-gray-500 w-1/3 text-xs uppercase tracking-wider">Kode Sarpras</td>
            <td className="py-3.5 px-5 font-bold text-gray-900">{payload.code || '-'}</td>
           </tr>
           <tr>
            <td className="py-3.5 px-5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Lokasi Detail (Lama)</td>
            <td className="py-3.5 px-5 font-medium text-gray-800 bg-yellow-50 border border-yellow-200 rounded">
              {payload.old_location_detail}
            </td>
           </tr>
          <tr>
            <td className="py-3.5 px-5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Lokasi Detail (Baru)</td>
            <td className="py-3.5 px-5 font-medium text-gray-800 bg-yellow-50 border border-yellow-200 rounded">
              {payload.new_location_detail}
            </td>
           </tr>
          <tr className="bg-gray-50/50">
            <td className="py-3.5 px-5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Risk Level</td>
            <td className="py-3.5 px-5">
              <RiskBadge risk={payload.risk_level} />
            </td>
           </tr>
          {notes && (
            <tr className="bg-gray-50/50">
              <td className="py-3.5 px-5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Catatan Pemohon</td>
              <td className="py-3.5 px-5 font-medium text-gray-700 italic">"{notes}"</td>
             </tr>
          )}
        </tbody>
       </table>
    </div>
  );
};

const RenderSarprasDelete = ({ payload, notes }: { payload: any; notes: string }) => {
  return (
    <div className="bg-white border border-gray-100 rounded-md overflow-hidden shadow-sm">
      <div className="bg-red-50 px-4 py-2 border-b border-red-200">
        <p className="text-xs font-bold text-red-700 flex items-center gap-1">
          <span>⚠️</span> Data berikut akan dihapus secara permanen
        </p>
      </div>
      <table className="w-full text-left text-sm">
        <tbody className="divide-y divide-gray-100">
          <tr className="bg-gray-50/50">
            <td className="py-3.5 px-5 font-semibold text-gray-500 w-1/3 text-xs uppercase tracking-wider">Kode Sarpras</td>
            <td className="py-3.5 px-5 font-bold text-gray-900">{payload.code || '-'}</td>
           </tr>
          <tr>
            <td className="py-3.5 px-5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Lokasi Detail</td>
            <td className="py-3.5 px-5 font-medium text-gray-800">{payload.location_detail || '-'}</td>
           </tr>
          {notes && (
            <tr className="bg-gray-50/50">
              <td className="py-3.5 px-5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Catatan Pemohon</td>
              <td className="py-3.5 px-5 font-medium text-gray-700 italic">"{notes}"</td>
             </tr>
          )}
        </tbody>
       </table>
    </div>
  );
};

const RenderSite = ({ payload }: { payload: any }) => (
  <div className="bg-white border border-gray-100 rounded-md overflow-hidden shadow-sm">
    <table className="w-full text-left text-sm">
      <tbody className="divide-y divide-gray-100">
        <tr className="bg-gray-50/50">
          <td className="py-3.5 px-5 font-semibold text-gray-500 w-1/3 text-xs uppercase tracking-wider">Nama Site</td>
          <td className="py-3.5 px-5 font-bold text-gray-900">{payload.name || '-'}</td>
         </tr>
        {payload.code && (
          <tr>
            <td className="py-3.5 px-5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Kode</td>
            <td className="py-3.5 px-5 font-medium text-gray-800">{payload.code}</td>
           </tr>
        )}
        {payload.address && (
          <tr className="bg-gray-50/50">
            <td className="py-3.5 px-5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Alamat</td>
            <td className="py-3.5 px-5 font-medium text-gray-800">{payload.address}</td>
           </tr>
        )}
      </tbody>
     </table>
  </div>
);

const RenderDepartment = ({ payload }: { payload: any }) => (
  <div className="bg-white border border-gray-100 rounded-md overflow-hidden shadow-sm">
    <table className="w-full text-left text-sm">
      <tbody className="divide-y divide-gray-100">
        <tr className="bg-gray-50/50">
          <td className="py-3.5 px-5 font-semibold text-gray-500 w-1/3 text-xs uppercase tracking-wider">Nama Departemen</td>
          <td className="py-3.5 px-5 font-bold text-gray-900">{payload.name || '-'}</td>
         </tr>
        {payload.code && (
          <tr>
            <td className="py-3.5 px-5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Kode</td>
            <td className="py-3.5 px-5 font-medium text-gray-800">{payload.code}</td>
           </tr>
        )}
      </tbody>
     </table>
  </div>
);

const RenderGeneric = ({ payload }: { payload: any }) => {
  const entries = Object.entries(payload).filter(([_, v]) => v !== null && v !== undefined);
  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-xs font-medium">Tidak ada data</p>
      </div>
    );
  }
  return (
    <div className="bg-white border border-gray-100 rounded-md overflow-hidden shadow-sm">
      <table className="w-full text-left text-sm">
        <tbody className="divide-y divide-gray-100">
          {entries.map(([key, value]: [string, any], idx: number) => (
            <tr key={key} className={idx % 2 === 0 ? 'bg-gray-50/50' : ''}>
              <td className="py-3 px-5 font-semibold text-gray-500 w-1/3 text-xs uppercase tracking-wider">
                {key.replace(/_/g, ' ')}
              </td>
              <td className="py-3 px-5 font-medium text-gray-800 break-words">
                {typeof value === 'object' && value !== null ? (
                  <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto max-h-32">
                    {JSON.stringify(value, null, 2)}
                  </pre>
                ) : (
                  String(value)
                )}
              </td>
             </tr>
          ))}
        </tbody>
       </table>
    </div>
  );
};

export default function ApprovalModal({ isOpen, onClose, data, onAction }: ApprovalModalProps) {
  const [reviewNotes, setReviewNotes] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  if (!isOpen || !data) return null;

  let payload: any = {};
  try {
    payload = JSON.parse(data.payload_json);
  } catch (e) {
    console.error('Gagal memparsing payload_json', e);
  }

  const entityMeta = ENTITY_META[data.entity_type] || { label: data.entity_type, color: 'text-gray-600', icon: '📄' };
  const actionMeta = ACTION_META[data.action] || { label: data.action, bg: 'bg-gray-50 text-gray-700 border-gray-200', icon: '📝' };
  const statusMeta = STATUS_META[data.status] || { label: data.status, bg: 'bg-gray-100 text-gray-600 border-gray-200', icon: '❓' };
  const isProcessed = data.status !== 'pending';

  const handleAction = async (actionType: 'approve' | 'reject') => {
    setIsLoading(true);
    try {
      await onAction(data.id, actionType, reviewNotes);
      setReviewNotes('');
    } catch (err) {
      console.error('Gagal memproses approval', err);
    } finally {
      setIsLoading(false);
    }
  };

  const renderPayloadContent = () => {
    if (data.entity_type === 'Sarpras') {
      switch (data.action) {
        case 'create': return <RenderSarprasCreate payload={payload} notes={data.notes} />;
        case 'edit': return <RenderSarprasEdit payload={payload} notes={data.notes} />;
        case 'delete': return <RenderSarprasDelete payload={payload} notes={data.notes} />;
        default: return <RenderGeneric payload={payload} />;
      }
    }
    if (data.entity_type === 'SarprasBulk') {
      return <RenderSarprasBulk payload={payload} notes={data.notes} />;
    }
    switch (data.entity_type) {
      case 'SarprasType':
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-md border border-gray-100 shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Nama Jenis</p>
                <p className="text-base font-bold text-gray-900">{payload.name || '-'}</p>
              </div>
              <div className="bg-white p-4 rounded-md border border-gray-100 shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Interval Inspeksi</p>
                <p className="text-base font-bold text-blue-600">{payload.insp_interval_months || '-'} Bulan</p>
              </div>
              <div className="bg-white p-4 rounded-md border border-gray-100 shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Departemen PIC</p>
                <p className="text-base font-bold text-gray-900">{payload.pic_dept_name || '-'}</p>
              </div>
            </div>
            {payload.description && (
              <div className="bg-white p-4 rounded-md border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Deskripsi</p>
                <p className="text-sm text-gray-700">{payload.description}</p>
              </div>
            )}
            <RenderParameters parameters={payload.parameters} />
          </div>
        );
      case 'Site':
        return <RenderSite payload={payload} />;
      case 'Department':
        return <RenderDepartment payload={payload} />;
      default:
        return <RenderGeneric payload={payload} />;
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm transition-all p-4">
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden border-t-[5px] border-[#003d7a] flex flex-col max-h-[92vh] animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-start bg-white shrink-0">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-xl ${statusMeta.bg} border`}>
              {statusMeta.icon}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-black text-gray-900">Approval Request</h2>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold border ${statusMeta.bg}`}>
                  {statusMeta.icon} {statusMeta.label}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">#{data.id}</p>
                <span className="text-gray-300">•</span>
                <p className="text-[10px] font-medium text-gray-500">
                  {new Date(data.created_at).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
                </p>
              </div>
            </div>
          </div>
          <button  onClick={(e) => {
                e.stopPropagation();
                onClose();
              }} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-colors flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-8 py-6 overflow-y-auto no-scrollbar flex-1 bg-[#fafbfc] space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pemohon</p>
              </div>
              <p className="text-sm font-bold text-gray-900">{data.requester.name}</p>
              <p className="text-[11px] font-medium text-gray-500 mt-1">{data.requester.department_name}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{data.requester.email}</p>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Data</p>
              </div>
              <p className={`text-sm font-black uppercase ${entityMeta.color}`}>
                {entityMeta.icon} {entityMeta.label}
              </p>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-600 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aksi</p>
              </div>
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold border ${actionMeta.bg}`}>
                {actionMeta.icon} {actionMeta.label}
              </span>
            </div>
          </div>

          {data.reviewer && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-100 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-purple-200 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Direview Oleh</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center text-sm font-bold text-purple-700">
                  {data.reviewer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-purple-900">{data.reviewer.name}</p>
                  <p className="text-xs text-purple-600">{data.reviewer.department_name}</p>
                  {data.reviewed_at && (
                    <p className="text-[10px] text-purple-500 mt-0.5">
                      {new Date(data.reviewed_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#003d7a]" />
              <h3 className="text-[11px] font-black text-[#64748b] tracking-widest uppercase">
                Detail Data Perubahan
              </h3>
            </div>
            {renderPayloadContent()}
          </div>

          {data.notes && data.entity_type !== 'Sarpras' && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Catatan Pemohon</p>
              </div>
              <p className="text-sm text-amber-800 italic leading-relaxed">"{data.notes}"</p>
            </div>
          )}

          {!isProcessed && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#003d7a]" />
                <h3 className="text-[11px] font-black text-[#64748b] tracking-widest uppercase">
                  Catatan Reviewer
                </h3>
                <span className="text-[9px] text-gray-400 font-medium">(Opsional)</span>
              </div>
              <textarea
                rows={4}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Tulis alasan atau catatan tambahan mengapa Anda menyetujui atau menolak request ini..."
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm font-medium text-gray-800 outline-none focus:ring-2 focus:ring-[#003d7a] focus:border-transparent resize-none shadow-sm transition-all placeholder:text-gray-400"
              />
            </div>
          )}
        </div>

        <div className="px-8 py-5 border-t border-gray-100 bg-white flex items-center justify-between shrink-0">
          <p className="text-[10px] text-gray-400 font-medium">
            {isProcessed ? 'Request ini sudah selesai diproses.' : 'Pilih tindakan untuk request ini.'}
          </p>
          {!isProcessed ? (
            <div className="flex gap-3">
              <button
                onClick={() => handleAction('reject')}
                disabled={isLoading}
                className="px-6 py-3 rounded-lg text-[13px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                {isLoading ? 'Memproses...' : 'Tolak'}
              </button>
              <button
                onClick={() => handleAction('approve')}
                disabled={isLoading}
                className="px-8 py-3 rounded-lg text-[13px] font-bold text-white bg-[#003d7a] hover:bg-[#002d5a] shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {isLoading ? 'Memproses...' : 'Setujui'}
              </button>
            </div>
          ) : (
            <button onClick={(e) => {
                e.stopPropagation();
                onClose();
              }} className="px-6 py-3 rounded-lg text-[13px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all">
              Tutup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
