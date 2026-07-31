'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, API_BASE } from '@/lib/api';

function dataURLtoFile(dataURL: string, filename: string): File {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}

interface ChecklistItem {
  ParameterID: number;
  Title: string;
  Description: string;
  Status: 'OK' | 'NOK' | null;
  Photo: File | null;
  PhotoPreview: string | null;
  Notes: string;
  Editable: boolean;
  RefillInfo: string;
}

interface ModalProps {
  type: 'success' | 'error' | 'confirm';
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

function Modal({
  type,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
}: ModalProps) {
  const icons = {
    success: (
      <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    ),
    error: (
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    ),
    confirm: (
      <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
    ),
  };

  const confirmBtnColor = {
    success: 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100',
    error: 'bg-red-500 hover:bg-red-600 shadow-red-100',
    confirm: 'bg-amber-500 hover:bg-amber-600 shadow-amber-100',
  }[type];

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
        {icons[type]}
        <h3 className="text-center text-lg font-black text-gray-900 tracking-tight mb-2">{title}</h3>
        <p className="text-center text-gray-400 text-sm font-medium mb-8 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-xs font-black uppercase text-gray-400 hover:bg-gray-50 transition-all"
            >
              {cancelText}
            </button>
          )}
          {onConfirm && (
            <button
              onClick={onConfirm}
              className={`flex-1 py-3 text-white rounded-xl text-xs font-black uppercase shadow-lg transition-all ${confirmBtnColor}`}
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChecklistContent({ inspectionId }: { inspectionId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scheduleId = searchParams.get('scheduleId');

  const [userId, setUserId] = useState<number | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(true);

  // Key draft menggunakan userId agar persisten per user
  const DRAFT_KEY = userId ? `checklist_draft_${userId}_${inspectionId}` : null;

  const [isLoading, setIsLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [sarprasInfo, setSarprasInfo] = useState({ code: '', name: '' });
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
  const [modal, setModal] = useState<ModalProps | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  const [activeCameraId, setActiveCameraId] = useState<number | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const id = sessionStorage.getItem('user_id') || localStorage.getItem('user_id');
    if (id) {
      setUserId(Number(id));
      setUserLoading(false);
    } else {
      apiFetch(`${API_BASE}/users/me`)
        .then(res => res.json())
        .then(data => {
          const uid = data.data?.id;
          if (uid) {
            sessionStorage.setItem('user_id', uid.toString());
            setUserId(uid);
          }
          setUserLoading(false);
        })
        .catch(() => {
          setUserLoading(false);
        });
    }
  }, []);

  useEffect(() => {
    if (!userLoading && userId === null) {
      router.push('/login');
    }
  }, [userLoading, userId, router]);

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(console.error);
      };
    }
  }, [cameraStream]);

  // Fetch form and restore draft if available
  useEffect(() => {
    if (!inspectionId || inspectionId === 'undefined' || !DRAFT_KEY || userLoading) return;

    const fetchForm = async () => {
      setFormLoading(true);
      setEligibilityError(null);
      try {
        const res = await apiFetch(`${API_BASE}/inspections/form/${inspectionId}`);
        if (res.ok) {
          const json = await res.json();
          setSarprasInfo({ code: json.data.sarpras_code, name: json.data.sarpras_name });
          const initialItems: ChecklistItem[] = json.data.parameters.map((p: any) => ({
            ParameterID: p.id,
            Title: p.name,
            Description: p.desc,
            Status: null,
            Photo: null,
            PhotoPreview: null,
            Notes: '',
            Editable: p.editable !== undefined ? p.editable : true,
            RefillInfo: p.refill_info || '',
          }));

          // Restore from local draft
          const saved = localStorage.getItem(DRAFT_KEY);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              const merged = initialItems.map(item => {
                const savedItem = parsed.find((p: any) => p.ParameterID === item.ParameterID);
                if (savedItem) {
                  return {
                    ...item,
                    Status: savedItem.Status,
                    Notes: savedItem.Notes,
                    PhotoPreview: savedItem.PhotoPreview || null,
                  };
                }
                return item;
              });
              setChecklists(merged);
              setHasDraft(true);
              setIsDirty(true);
            } catch (e) {
              console.error('Gagal parse draft', e);
              setChecklists(initialItems);
            }
          } else {
            setChecklists(initialItems);
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          const msg = errData.message || errData.error || 'Kamu tidak bisa memeriksa sarpras ini';
          setEligibilityError(msg);
        }
      } catch (err) {
        console.error('Gagal load form:', err);
        setEligibilityError('Terjadi kesalahan jaringan. Silakan coba lagi.');
      } finally {
        setFormLoading(false);
      }
    };
    fetchForm();
  }, [inspectionId, DRAFT_KEY, userLoading]);

  // Block page unload regardless of dirty state
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Block browser back/forward navigation
  useEffect(() => {
    const onPopState = () => {
      window.history.pushState(null, '', window.location.href);
      setModal({
        type: 'confirm',
        title: 'Tinggalkan Halaman?',
        message: 'Apakah Anda yakin ingin meninggalkan halaman ini?',
        confirmText: 'Tetap di sini',
        cancelText: 'Batalkan Pemeriksaan',
        onConfirm: () => setModal(null),
        onCancel: () => {
          setModal(null);
          handleCancelInspection();
        },
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
  }, []);

  // Block internal anchor clicks and treat them as leaving the page
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      if (!link) return;
      const href = link.getAttribute('href');
      if (
        href &&
        !href.startsWith('#') &&
        !href.startsWith('http') &&
        !href.startsWith('mailto:') &&
        !href.startsWith('tel:')
      ) {
        e.preventDefault();
        e.stopPropagation();
        setModal({
          type: 'confirm',
          title: 'Tinggalkan Halaman?',
          message: 'Apakah Anda yakin ingin meninggalkan halaman ini? Proses pemeriksaan akan dibatalkan.',
          confirmText: 'Ya, tinggalkan',
          cancelText: 'Tetap di sini',
          onConfirm: () => {
            setModal(null);
            window.location.href = href;
          },
          onCancel: () => setModal(null),
        });
      }
    };
    document.addEventListener('click', handleLinkClick, true);
    return () => document.removeEventListener('click', handleLinkClick, true);
  }, []);

  // Auto-save draft with debounce
  const saveDraft = useCallback(() => {
    if (!DRAFT_KEY) return;
    try {
      const dataToSave = checklists.map(({ Photo, ...rest }) => ({
        ...rest,
      }));
      localStorage.setItem(DRAFT_KEY, JSON.stringify(dataToSave));
    } catch (err) {
      console.error('Gagal menyimpan draft', err);
    }
  }, [checklists, DRAFT_KEY]);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(saveDraft, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [checklists, saveDraft]);

  const handleOpenCamera = async (id: number) => {
    setActiveCameraId(id);
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      setCameraStream(stream);
    } catch (err: any) {
      setCameraError('Tidak dapat mengakses kamera. Pastikan izin diberikan.');
      console.error(err);
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current || activeCameraId === null) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setCapturedPreview(reader.result as string);
          (window as any)._capturedFile = file;
        };
        reader.readAsDataURL(blob);
      },
      'image/jpeg',
      0.9
    );
  };

  const handleConfirmCapture = () => {
    if (!capturedPreview || activeCameraId === null) return;
    const file = (window as any)._capturedFile;
    setChecklists((prev) =>
      prev.map((item) =>
        item.ParameterID === activeCameraId
          ? { ...item, Photo: file, PhotoPreview: capturedPreview }
          : item
      )
    );
    setIsDirty(true);
    setCapturedPreview(null);
    closeCamera();
  };

  const handleRetake = () => {
    setCapturedPreview(null);
    setTimeout(() => {
      if (videoRef.current && cameraStream) {
        videoRef.current.srcObject = cameraStream;
        videoRef.current.play().catch(console.error);
      }
    }, 50);
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setActiveCameraId(null);
    setCapturedPreview(null);
  };

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  const handleRemovePhoto = (id: number) => {
    setChecklists((prev) =>
      prev.map((item) =>
        item.ParameterID === id ? { ...item, Photo: null, PhotoPreview: null } : item
      )
    );
    setIsDirty(true);
  };

  const handleCancelInspection = async () => {
    setIsCancelling(true);
    try {
      if (scheduleId) {
        await apiFetch(`${API_BASE}/inspections/${scheduleId}/cancel`, {
          method: 'POST',
        });
      }
      if (DRAFT_KEY) localStorage.removeItem(DRAFT_KEY);
      setIsDirty(false);
      router.push('/dashboard/inspection');
    } catch (err) {
      console.error('Cancel error:', err);
      setModal({
        type: 'error',
        title: 'Gagal Membatalkan',
        message: 'Terjadi kesalahan saat membatalkan pemeriksaan. Coba lagi.',
        onConfirm: () => setModal(null),
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleToggleStatus = (id: number, status: 'OK' | 'NOK') => {
    setChecklists((prev) =>
      prev.map((item) => (item.ParameterID === id ? { ...item, Status: status } : item))
    );
    setIsDirty(true);
  };

  const handleNotesChange = (id: number, value: string) => {
    setChecklists((prev) =>
      prev.map((item) => (item.ParameterID === id ? { ...item, Notes: value } : item))
    );
    setIsDirty(true);
  };

  const handleSubmit = async () => {
    const editableItems = checklists.filter(item => item.Editable === true);

    for (let i = 0; i < editableItems.length; i++) {
      const item = editableItems[i];
      const displayIndex = checklists.findIndex(c => c.ParameterID === item.ParameterID) + 1;

      if (!item.Status) {
        setModal({
          type: 'error',
          title: 'Validasi Gagal',
          message: `Status (OK/NOK) pada parameter "${displayIndex}. ${item.Title}" belum dipilih.`,
          confirmText: 'Lengkapi Data',
          onConfirm: () => setModal(null),
        });
        return;
      }

      if (!item.Photo && !item.PhotoPreview) {
        setModal({
          type: 'error',
          title: 'Validasi Gagal',
          message: `Lampiran foto wajib diisi pada parameter "${displayIndex}. ${item.Title}".`,
          confirmText: 'Lengkapi Foto',
          onConfirm: () => setModal(null),
        });
        return;
      }

      if (item.Status === 'NOK' && (!item.Notes || item.Notes.trim() === '')) {
        setModal({
          type: 'error',
          title: 'Validasi Gagal',
          message: `Keterangan wajib diisi pada parameter "${displayIndex}. ${item.Title}" karena berstatus NOK.`,
          confirmText: 'Isi Keterangan',
          onConfirm: () => setModal(null),
        });
        return;
      }
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append('sarpras_id', inspectionId);

    for (let idx = 0; idx < editableItems.length; idx++) {
      const item = editableItems[idx];
      formData.append(`items[${idx}][parameter_id]`, item.ParameterID.toString());
      formData.append(`items[${idx}][status]`, item.Status || '');
      formData.append(`items[${idx}][notes]`, item.Notes || '');

      let fileToSend = item.Photo;
      if (!fileToSend && item.PhotoPreview) {
        fileToSend = dataURLtoFile(item.PhotoPreview, `photo_${item.ParameterID}_${Date.now()}.jpg`);
      }
      if (fileToSend) {
        formData.append(`items[${idx}][photo]`, fileToSend);
      }
    }

    try {
      const res = await apiFetch(`${API_BASE}/inspections/submit`, {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (res.ok) {
        if (DRAFT_KEY) localStorage.removeItem(DRAFT_KEY);
        setIsDirty(false);
        setModal({
          type: 'success',
          title: 'Pemeriksaan Berhasil!',
          message: 'Hasil pemeriksaan telah berhasil dikirim dan dicatat dalam sistem.',
          confirmText: 'Selesai',
          onConfirm: () => {
            setModal(null);
            router.push('/dashboard/inspection');
          },
        });
      } else {
        const errorMsg = result.errors ? result.errors.join('\n') : result.message;
        setModal({
          type: 'error',
          title: 'Gagal Mengirim',
          message: errorMsg || 'Terjadi kesalahan saat mengirim data.',
          confirmText: 'Coba Lagi',
          onConfirm: () => setModal(null),
        });
      }
    } catch (err) {
      setModal({
        type: 'error',
        title: 'Koneksi Gagal',
        message: 'Tidak dapat terhubung ke server. Periksa koneksi internet kamu.',
        confirmText: 'Tutup',
        onConfirm: () => setModal(null),
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (userLoading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat user...</div>;
  }

  if (userId === null) {
    return <div className="min-h-screen flex items-center justify-center">Silakan login terlebih dahulu.</div>;
  }

  if (eligibilityError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fafbfc] p-6">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-xl border border-gray-100 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="text-lg font-black text-gray-900 mb-2">Akses Ditolak</h3>
          <p className="text-sm text-gray-500 mb-8">{eligibilityError}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-3 bg-[#003d7a] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#002d5a] transition-all"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (formLoading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat form...</div>;
  }

  return (
    <div className="min-h-screen bg-[#fafbfc] py-10 px-6">
      {hasDraft && (
        <div className="max-w-3xl mx-auto mb-4">
          <div className="bg-amber-50 text-amber-800 p-3 rounded-xl text-sm font-medium border border-amber-200">
            ⚠️ Ada draft pemeriksaan sebelumnya. Data sudah dikembalikan.
          </div>
        </div>
      )}

      {modal && <Modal {...modal} />}

      {activeCameraId !== null && (
        <div className="fixed inset-0 z-[300] bg-black flex flex-col">
          <div className="flex justify-between items-center p-4 bg-black/50 text-white">
            <h3 className="text-lg font-bold">Ambil Foto</h3>
            <button onClick={closeCamera} className="text-white hover:text-red-300 p-2">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 bg-black flex items-center justify-center overflow-hidden">
            {cameraError ? (
              <div className="text-white text-center p-4">
                <p className="mb-4">{cameraError}</p>
                <button onClick={closeCamera} className="bg-white text-black px-4 py-2 rounded font-bold">
                  Kembali
                </button>
              </div>
            ) : capturedPreview ? (
              <img src={capturedPreview} alt="Preview" className="w-full h-full object-contain" />
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%' }}
                  className={cameraStream ? 'block' : 'hidden'}
                />
                {!cameraStream && (
                  <p className="text-white animate-pulse">Mengaktifkan kamera...</p>
                )}
              </>
            )}
          </div>

          {cameraStream && (
            <div className="p-6 bg-black flex justify-center items-center gap-8">
              {capturedPreview ? (
                <>
                  <button
                    onClick={handleRetake}
                    className="px-6 py-3 bg-gray-700 text-white rounded-xl font-bold text-sm"
                  >
                    Ulangi
                  </button>
                  <button
                    onClick={handleConfirmCapture}
                    className="px-8 py-3 bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg"
                  >
                    Gunakan Foto
                  </button>
                </>
              ) : (
                <button
                  onClick={handleCapture}
                  className="w-20 h-20 bg-white rounded-full border-4 border-gray-400 hover:bg-gray-200 transition-all"
                />
              )}
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        <div className="mb-8 flex items-start gap-4">
          <button
            onClick={() => {
              setModal({
                type: 'confirm',
                title: 'Batalkan Pemeriksaan?',
                message: 'Apakah Anda yakin ingin membatalkan pemeriksaan ini?',
                confirmText: 'Ya, batalkan',
                cancelText: 'Lanjutkan',
                onConfirm: () => {
                  setModal(null);
                  handleCancelInspection();
                },
                onCancel: () => setModal(null),
              });
            }}
            disabled={isCancelling}
            className="bg-white p-2 rounded-lg border border-gray-200 disabled:opacity-50 hover:bg-gray-50 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-black text-gray-900">{sarprasInfo.name}</h1>
            <p className="text-xs font-bold text-[#003d7a] uppercase tracking-wider">
              Code : {sarprasInfo.code}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {checklists.map((item, index) => {
            if (!item.Editable) {
              return (
                <div
                  key={item.ParameterID}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 space-y-6"
                >
                  <div>
                    <h2 className="text-xl font-black text-gray-900">
                      {index + 1}. {item.Title}
                    </h2>
                    <p className="text-sm text-gray-400 font-medium">{item.Description}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <p className="text-sm font-semibold text-[#003d7a]">{item.RefillInfo || 'Sedang dalam proses pengisian ulang oleh GA'}</p>
                    <p className="text-xs text-gray-500 mt-1">Parameter ini tidak perlu dinilai saat ini</p>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={item.ParameterID}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 space-y-6"
              >
                <div>
                  <h2 className="text-xl font-black text-gray-900">
                    {index + 1}. {item.Title}
                  </h2>
                  <p className="text-sm text-gray-400 font-medium">{item.Description}</p>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => handleToggleStatus(item.ParameterID, 'OK')}
                    className={`flex-1 py-3.5 rounded-lg font-black text-sm border-2 transition-all ${
                      item.Status === 'OK'
                        ? 'bg-[#22c55e] border-[#22c55e] text-white shadow-lg shadow-green-100'
                        : 'bg-white border-gray-100 text-gray-300'
                    }`}
                  >
                    OK
                  </button>
                  <button
                    onClick={() => handleToggleStatus(item.ParameterID, 'NOK')}
                    className={`flex-1 py-3.5 rounded-lg font-black text-sm border-2 transition-all ${
                      item.Status === 'NOK'
                        ? 'bg-[#ef4444] border-[#ef4444] text-white shadow-lg shadow-red-100'
                        : 'bg-white border-gray-100 text-gray-300'
                    }`}
                  >
                    NOK
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-700">
                    Lampiran Foto <span className="text-red-500">*</span> :
                  </label>
                  <div
                    onClick={() => {
                      if (!item.PhotoPreview) handleOpenCamera(item.ParameterID);
                    }}
                    className={`relative flex flex-col items-center justify-center w-full h-44 bg-[#f8fafc] border-2 border-dashed border-gray-200 rounded-xl overflow-hidden ${
                      item.PhotoPreview ? '' : 'cursor-pointer hover:bg-gray-50'
                    }`}
                  >
                    {item.PhotoPreview ? (
                      <>
                        <img src={item.PhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemovePhoto(item.ParameterID);
                          }}
                          className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest text-center">
                          Tap untuk Ambil Foto<br />Pemeriksaan
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {item.Status === 'NOK' && (
                  <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                    <label className="block text-[10px] font-black text-gray-700 uppercase tracking-widest">
                      Keterangan NOK <span className="text-red-500">*</span> :
                    </label>
                    <textarea
                      className="w-full bg-[#f8fafc] border border-gray-200 rounded-xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-red-500 transition-all resize-none"
                      rows={3}
                      placeholder="Contoh: Tabung berkarat berat..."
                      value={item.Notes}
                      onChange={(e) => handleNotesChange(item.ParameterID, e.target.value)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full mt-10 bg-[#0ea5e9] hover:bg-[#0284c7] text-white py-4 rounded-xl font-black text-sm shadow-xl shadow-blue-100 transition-all disabled:opacity-50"
        >
          {isLoading ? 'Sedang Memproses...' : 'Submit Hasil Pemeriksaan'}
        </button>
      </div>
    </div>
  );
}

export default function ChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params);
  const inspectionId = unwrappedParams.id;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm font-bold text-gray-400">
          Loading...
        </div>
      }
    >
      <ChecklistContent inspectionId={inspectionId} />
    </Suspense>
  );
}
