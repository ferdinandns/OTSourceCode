'use client';

import React, { useState } from 'react';
import Cookies from "js-cookie";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_BASE_URL, apiFetch } from '@/lib/api';

const PROCESS_LIST = [
  "CWO", "Potong Stock", "Preparasi", "Timbang", "Validasi 1", "Validasi 2", "Compounding",
  "Terima Sample", "Analisa Complete", "Release QC", "Tempel Label Rilis",
  "Filling", "Sample FG", "End Packaging", "Setor BR", "Setor RAP",
  "Terima BR", "Terima RAP", "QA Release", "Shipment"
];

/**
 * Komponen "Leadtime Table" dengan Fitur "Add/Edit Reason" (Catatan Keterlambatan).
 * 
 * **Konsep Arsitektural:**
 * - **Expandable Rows**: Memanfaatkan state `expandedRows` untuk memunculkan detail "reasons" 
 *   (Sub-tabel/akordion) di bawah baris utama. 
 * - **Dialog-driven CRUD**: Segala aksi *Create/Update* untuk *Reason* dilakukan via Modal Dialog 
 *   (Shadcn UI). Form data (`formReason`) dipisahkan dari tabel utama untuk mencegah re-render berat.
 * - **Optimistic-ish Reload**: Setelah sukses mutasi via `apiFetch`, menggunakan `window.location.reload()` 
 *   untuk memaksa Next.js Server Components mengambil ulang data terbaru (pola sederhana tanpa library state management eksternal).
 */
export default function LeadtimeTable({ leadtimeData, filterType }: { leadtimeData: any[], filterType: string }) {
  const isBatchReport = filterType === 'batch';
  
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [selectedBatch, setSelectedBatch] = useState({ id: 0, no_batch: '' });
  const [formReason, setFormReason] = useState({ id: 0, process_name: '', reason: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleRow = (id: number) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

  const openAddModal = (batchId: number, noBatch: string) => {
    setDialogMode('add');
    setSelectedBatch({ id: batchId, no_batch: noBatch });
    setFormReason({ id: 0, process_name: '', reason: '' });
    setIsDialogOpen(true);
  };

  const openEditModal = (batchId: number, noBatch: string, reasonData: any) => {
    setDialogMode('edit');
    setSelectedBatch({ id: batchId, no_batch: noBatch });
    setFormReason({ id: reasonData.id, process_name: reasonData.process_name, reason: reasonData.reason });
    setIsDialogOpen(true);
  };

  const handleSaveReason = async () => {
    setIsSubmitting(true);
    const token = Cookies.get("token");
    
    const url = dialogMode === 'add' 
      ? `${API_BASE_URL}/api/v1/master/batch-reason` 
      : `${API_BASE_URL}/api/v1/master/batch-reason/${formReason.id}`;
    
    const method = dialogMode === 'add' ? 'POST' : 'PUT';

    const payload = {
      batch_id: selectedBatch.id,
      process_name: formReason.process_name,
      reason: formReason.reason
    };

    try {
        const res = await apiFetch(url, {
            method: method,
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            alert(`Reason berhasil di${dialogMode === 'add' ? 'simpan' : 'update'}!`);
            setIsDialogOpen(false);
            window.location.reload(); // Refresh halaman agar data terbaru ter-load dari Server Component
        } else {
            const data = await res.json();
            alert(data.meta?.message || 'Gagal menyimpan reason.');
        }
    } catch (error) {
        console.error(error);
        alert('Terjadi kesalahan jaringan.');
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDelete = async (reasonId: number) => {
    if (!confirm('Yakin ingin menghapus reason ini?')) return;
    
    const token = Cookies.get("token");
    
    try {
        const res = await apiFetch(`${API_BASE_URL}/api/v1/master/batch-reason/${reasonId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            alert('Reason berhasil dihapus');
            window.location.reload();
        } else {
            alert('Gagal menghapus reason');
        }
    } catch(e) { 
        console.error(e); 
        alert('Terjadi kesalahan jaringan.');
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border mt-8">
      
      <div className="max-h-[500px] overflow-auto border rounded-md relative">
        <Table>
          <TableHeader className="bg-gray-800 sticky top-0 z-20 shadow-md outline outline-gray-800">
            <TableRow className="hover:bg-gray-800 border-none">
              <TableHead className="text-white text-center">Batch</TableHead>
              <TableHead className="text-white text-center">Menit</TableHead>
              <TableHead className="text-white text-center">Jam</TableHead>
              <TableHead className="text-white text-center">Hari</TableHead>
              {isBatchReport && <TableHead className="text-white text-center">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {leadtimeData.map((row) => {
              const menit = row.total_range || 0;
              const jam = (menit / 60).toFixed(1);
              const hari = (menit / 1440).toFixed(1);
              const reasons = row.reasons || [];
              const isExpanded = expandedRows[row.id];

              return (
                <React.Fragment key={row.id}>
                  <TableRow className="text-center hover:bg-gray-50">
                    <TableCell className="font-bold text-black">{row.no_batch}</TableCell>
                    <TableCell className='text-black'>{menit.toLocaleString('id-ID')}</TableCell>
                    <TableCell className='text-black'>{jam}</TableCell>
                    <TableCell className='text-black'>{hari}</TableCell>
                    {isBatchReport && (
                      <TableCell>
                        <div className="flex gap-2 justify-center">
                          <Button size="sm" variant="outline" className="bg-amber-100 hover:bg-amber-200 hover:text-amber-900 text-amber-800 border-amber-300 cursor-pointer"
                                  onClick={() => openAddModal(row.id, row.no_batch)}>
                            Tambah Reason
                          </Button>
                          {reasons.length > 0 && (
                            <Button size="sm" variant="secondary" className="bg-blue-100 hover:bg-blue-200 hover:text-cover-900 text-blue-800 cursor-pointer"
                                    onClick={() => toggleRow(row.id)}>
                              {isExpanded ? 'Tutup Reason' : `Lihat Reason (${reasons.length})`}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>

                  {isExpanded && reasons.length > 0 && (
                    <TableRow className="bg-gray-50">
                      <TableCell colSpan={isBatchReport ? 5 : 4} className="p-4">
                        <div className="border rounded-md p-4 bg-white shadow-inner text-left">
                          <ul className="space-y-4">
                            {reasons.map((r: any) => (
                              <li key={r.id} className="border-b pb-3 last:border-0 last:pb-0">
                                <div>
                                  <span className="font-bold text-gray-800">{r.process_name}</span> — 
                                  <span className="text-gray-700 ml-1">{r.reason}</span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1 mb-2">
                                  {r.nama || 'Unknown'} | {r.department || '-'} | {new Date(r.created_at).toLocaleString('id-ID')}
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" className="h-7 text-xs" 
                                          onClick={() => openEditModal(row.id, row.no_batch, r)}>
                                    Edit
                                  </Button>
                                  <Button size="sm" variant="destructive" className="h-7 text-xs" 
                                          onClick={() => handleDelete(r.id)}>
                                    Hapus
                                  </Button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* MODAL DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className='bg-white text-black'>
          <DialogHeader>
            <DialogTitle>{dialogMode === 'add' ? 'Tambah Reason Batch' : 'Edit Reason Batch'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>No Batch</Label>
              <Input value={selectedBatch.no_batch} readOnly className="bg-gray-100" />
            </div>
            <div>
              <Label>Proses</Label>
              <select className="w-full border p-2 rounded-md mt-1" 
                      value={formReason.process_name} 
                      onChange={(e) => setFormReason({...formReason, process_name: e.target.value})}>
                <option value="">-- pilih proses --</option>
                {PROCESS_LIST.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <Label>Reason (Keterlambatan/Kendala)</Label>
              <textarea className="w-full border p-2 rounded-md mt-1 min-h-[100px]" 
                        value={formReason.reason}
                        onChange={(e) => setFormReason({...formReason, reason: e.target.value})}
                        placeholder="Tulis alasan di sini..." />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsDialogOpen(false)} disabled={isSubmitting} className='bg-gray-500 hover:bg-gray-600 cursor-pointer text-white'>Batal</Button>
            <Button onClick={handleSaveReason} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white cursor-pointer">
              {isSubmitting ? 'Menyimpan...' : (dialogMode === 'add' ? 'Simpan Reason' : 'Update Reason')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}