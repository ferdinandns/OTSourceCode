"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Eye, EyeOff, Search } from "lucide-react";
import SimpleCard from "@/components/simpleCard";
import QcTerimaSampleCard from "@/components/qcTerimaSampleCard";
import ScanBarcodeStorageCard from "@/components/scanBarcodeStorageCard";
import QaReleaseCard from "@/components/qaReleaseCard";
import DropdownTankCard from "@/components/dropdownTankCard";
import ProduksiFillingCard from "@/components/produksiFillingCard";
import QcReleaseCard from "@/components/qcReleaseCard";
import QcAnalisaCompleteCard from "@/components/qcAnalisaCompleteCard";
import EndPackagingCard from "@/components/endPackagingCard";
import SerahTerimaBppCard from "@/components/serahTerimaBppCard";
import TerimaBrRapCard from "@/components/terimaBrRapCard";
import ShipmentCard from "@/components/shipmentCard";
import { API_BASE_URL, apiFetch } from "@/lib/api";
import { QcTerimaSampleData, SimpleData, ScanStorageData, QaReleaseData, FillingData, QcAnalisaCompleteData, QcReleaseData, EndPackagingData, ShipmentData, SerahTerimaBppData } from "@/types";

/**
 * Halaman Dashboard Utama (Home Page).
 * 
 * **Konsep Arsitektural:**
 * - **Data Fetching Terpusat**: Mengambil data `dashboardData` satu kali melalui `apiFetch` 
 *   lalu mendistribusikannya (prop drilling) ke semua komponen Card (Produksi, QC, Gudang).
 * - **Auto Refresh**: Menggunakan polling via `setInterval` untuk memanggil fungsi `fetchData` 
 *   secara berkala. Ini mempertahankan *real-time feel* tanpa memerlukan koneksi WebSocket.
 * - **RBAC Distribution**: Objek akses diekstrak dari respon API dan diteruskan ke masing-masing 
 *   komponen Card agar komponen UI dapat mengunci dirinya sendiri jika user tidak berwenang.
 */
export default function HomePage() {
    const [activeTab, setActiveTab] = useState<"preparation" | "production" | "shipment">("preparation");
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<SimpleData | null>(null);
    const [deleteApiUrl, setDeleteApiUrl] = useState<string>("");
    const [deleteTitle, setDeleteTitle] = useState<string>("");
    const [deleteForm, setDeleteForm] = useState({
        id: "",
        username: "",
        password: "",
        keterangan: ""
    });
    const [isDeleting, setIsDeleting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isAnimating, setIsAnimating] = useState(true);
    const animTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [globalSearch, setGlobalSearch] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [dataPpic, setDataPpic] = useState<SimpleData[]>([]);
    const [dataPotongStock, setDataPotongStock] = useState<SimpleData[]>([]);
    const [dataPreparasi, setDataPreparasi] = useState<SimpleData[]>([]);
    const [dataTimbang, setDataTimbang] = useState<SimpleData[]>([]);
    const [dataValidasi1, setDataValidasi1] = useState<SimpleData[]>([]);
    const [dataValidasi2, setDataValidasi2] = useState<SimpleData[]>([]);
    const [dataCompounding, setDataCompounding] = useState<SimpleData[]>([]);
    const [mixingTanksMap, setMixingTanksMap] = useState<Record<string, { id: string | number, label: string }[]>>({});

    // State Produksi
    const [dataTransferStorage, setDataTransferStorage] = useState<SimpleData[]>([]);
    const [dataQcTerimaSample, setDataQcTerimaSample] = useState<QcTerimaSampleData[]>([]);
    const [dataQcAnalisaComplete, setDataQcAnalisaComplete] = useState<QcAnalisaCompleteData[]>([]);
    const [dataQcRelease, setDataQcRelease] = useState<QcReleaseData[]>([]);
    const [dataScanStorage, setDataScanStorage] = useState<ScanStorageData[]>([]);
    const [dataFillingLiquid, setDataFillingLiquid] = useState<FillingData[]>([]);
    const [dataFillingPowder, setDataFillingPowder] = useState<FillingData[]>([]);
    const [dataSampleFg, setDataSampleFg] = useState<SimpleData[]>([]);
    const [dataEndPackaging, setDataEndPackaging] = useState<EndPackagingData[]>([]);
    const [dataSerahTerimaBpp, setDataSerahTerimaBpp] = useState<SerahTerimaBppData[]>([]);

    // State Shipment
    const [dataTerimaBr, setDataTerimaBr] = useState<SimpleData[]>([]);
    const [dataTerimaRap, setDataTerimaRap] = useState<SimpleData[]>([]);
    const [dataQaRelease, setDataQaRelease] = useState<QaReleaseData[]>([]);
    const [dataShipment, setDataShipment] = useState<ShipmentData[]>([]);

    useEffect(() => {
        const lastTab = localStorage.getItem("activeSection") as any;
        if (lastTab && ["preparation", "production", "shipment"].includes(lastTab)) {
            setActiveTab(lastTab);
        }
        fetchAllData();

        // Gunakan ref untuk timer agar bisa dibersihkan
        animTimerRef.current = setTimeout(() => setIsAnimating(false), 1000);
        return () => {
            if (animTimerRef.current) clearTimeout(animTimerRef.current);
        };
    }, []);

    const handleTabChange = (tab: "preparation" | "production" | "shipment") => {
        setActiveTab(tab);
        localStorage.setItem("activeSection", tab);

        setIsAnimating(true);

        // Bersihkan timer sebelumnya jika user mengklik tab dengan cepat (Race Condition Fix)
        if (animTimerRef.current) clearTimeout(animTimerRef.current);
        animTimerRef.current = setTimeout(() => setIsAnimating(false), 1000);
    };

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            const headers = {
                "Content-Type": "application/json"
            };
            const baseUrl = `${API_BASE_URL}/api/v1/produksi`;

            const apiConfigs = [
                { path: "/kirim-ppic", action: (data: any) => setDataPpic(data || []) },
                { path: "/potong-stock", action: (data: any) => setDataPotongStock(data || []) },
                { path: "/wh-preparasi", action: (data: any) => setDataPreparasi(data || []) },
                { path: "/timbang", action: (data: any) => setDataTimbang(data || []) },
                { path: "/validasi-1", action: (data: any) => setDataValidasi1(data || []) },
                { path: "/validasi-2", action: (data: any) => setDataValidasi2(data || []) },
                { path: "/pr-compounding", action: (data: any) => setDataCompounding(data || []) },
                {
                    path: "/get-mixing-tank", action: (data: any) => {
                        const formattedMap: Record<string, { id: string | number, label: string }[]> = {};
                        if (data) {
                            Object.keys(data).forEach(kode => {
                                formattedMap[kode] = data[kode].map((tank: any) => ({
                                    id: tank.tank_id,
                                    label: tank.nama
                                }));
                            });
                        }
                        setMixingTanksMap(formattedMap);
                    }
                },
                { path: "/to-storage", action: (data: any) => setDataTransferStorage(data || []) },
                { path: "/qc-analisa", action: (data: any) => setDataQcTerimaSample(data || []) },
                { path: "/qc-release", action: (data: any) => setDataQcAnalisaComplete(data || []) },
                { path: "/kirim-ke-scan-barcode", action: (data: any) => setDataQcRelease(data || []) },
                { path: "/scan-storage", action: (data: any) => setDataScanStorage(data || []) },
                {
                    path: "/kirim-ke-sample-fg", action: (data: any) => {
                        setDataFillingLiquid(data?.table_liquid || []);
                        setDataFillingPowder(data?.table_powder || []);
                    }
                },
                { path: "/kirim-ke-end-packaging", action: (data: any) => setDataSampleFg(data || []) },
                { path: "/scan-end-packaging", action: (data: any) => setDataEndPackaging(data || []) },
                { path: "/scan-serah-terima-bpp", action: (data: any) => setDataSerahTerimaBpp(data || []) },
                { path: "/setor-br-complete", action: (data: any) => setDataTerimaBr(data || []) },
                { path: "/setor-rap-complete", action: (data: any) => setDataTerimaRap(data || []) },
                { path: "/send-to-shipment", action: (data: any) => setDataQaRelease(data || []) },
                { path: "/receive-shipment", action: (data: any) => setDataShipment(data || []) }
            ];

            await Promise.all(
                apiConfigs.map(async ({ path, action }) => {
                    const res = await apiFetch(`${baseUrl}${path}`, { headers });
                    if (res.ok) {
                        const json = await res.json();
                        action(json.data);
                    }
                })
            );

        } catch (error) {
            console.error("Terjadi kesalahan saat memuat data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchStorageTanks = async (batchId: number | string) => {
        try {
            const res = await apiFetch(`${API_BASE_URL}/api/v1/produksi/get-storage-tank/${batchId}`, {
                headers: {
                    "Content-Type": "application/json"
                }
            });
            if (res.ok) {
                const json = await res.json();
                return (json.data || []).map((tank: any) => ({
                    id: tank.tank_id,
                    label: `${tank.mixing_tank} - ${tank.kode_tank}`
                }));
            }
        } catch (error) {
            console.error("Gagal menarik data tangki:", error);
        }
        return [];
    };

    const handleDeleteRequest = (batch: SimpleData, apiUrl: string, title: string) => {
        setDeleteTarget(batch);
        setDeleteApiUrl(apiUrl);
        setDeleteTitle(title);
        setDeleteForm({ id: "", username: "", password: "", keterangan: "" });
        setIsDeleting(false);
        setIsDeleteModalOpen(true);
        setShowPassword(false);
    };

    const executeDelete = async () => {
        if (!deleteTarget || !deleteApiUrl) return;

        if (!deleteForm.username || !deleteForm.password) {
            alert("Username dan Password wajib diisi!");
            return;
        }

        setIsDeleting(true);

        try {
            const targetUrl = `${deleteApiUrl}/${deleteTarget.id}`;

            const response = await apiFetch(targetUrl, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    id: deleteTarget.id,
                    username: deleteForm.username,
                    password: deleteForm.password,
                    keterangan: deleteForm.keterangan
                })
            });

            if (response.ok) {
                setIsDeleteModalOpen(false);
                fetchAllData();
                alert("Data berhasil dihapus!");
            } else {
                const errData = await response.json();
                alert(`Gagal: ${errData.message || "Gagal menghapus data"}`);
            }
        } catch (error) {
            console.error("Error deleting data:", error);
            alert("Koneksi ke server gagal.");
        } finally {
            setIsDeleting(false);
        }
    };

    const isSearching = globalSearch.trim() !== "";

    interface SearchableItem {
        no_batch?: string;
        kode_ruah?: string;
        kode_produk?: string;
        [key: string]: any;
    }

    const {
        prep_Ppic, prep_potongStock, prep_preparasi, prep_Timbang, prep_validasi1, prep_validasi2, prep_compounding,
        prod_transfer, prod_qcTerima, prod_qcAnalisa, prod_qcRelease, prod_scanStorage, prod_fillingLiquid, prod_fillingPowder, prod_sampleFg, prod_endPackaging, prod_serahTerimaBpp,
        ship_terimaBr, ship_terimaRap, ship_qaRelease, ship_shipment
    } = useMemo(() => {
        const filterData = <T extends SearchableItem>(data: T[]): T[] => {
            if (!isSearching) return data;
            const q = globalSearch.toLowerCase();

            return data.filter(item =>
                (item.no_batch && String(item.no_batch).toLowerCase().includes(q)) ||
                (item.kode_ruah && String(item.kode_ruah).toLowerCase().includes(q)) ||
                (item.kode_produk && String(item.kode_produk).toLowerCase().includes(q))
            );
        };

        return {
            prep_Ppic: filterData(dataPpic),
            prep_potongStock: filterData(dataPotongStock),
            prep_preparasi: filterData(dataPreparasi),
            prep_Timbang: filterData(dataTimbang),
            prep_validasi1: filterData(dataValidasi1),
            prep_validasi2: filterData(dataValidasi2),
            prep_compounding: filterData(dataCompounding),

            prod_transfer: filterData(dataTransferStorage),
            prod_qcTerima: filterData(dataQcTerimaSample),
            prod_qcAnalisa: filterData(dataQcAnalisaComplete),
            prod_qcRelease: filterData(dataQcRelease),
            prod_scanStorage: filterData(dataScanStorage),
            prod_fillingLiquid: filterData(dataFillingLiquid),
            prod_fillingPowder: filterData(dataFillingPowder),
            prod_sampleFg: filterData(dataSampleFg),
            prod_endPackaging: filterData(dataEndPackaging),
            prod_serahTerimaBpp: filterData(dataSerahTerimaBpp),

            ship_terimaBr: filterData(dataTerimaBr),
            ship_terimaRap: filterData(dataTerimaRap),
            ship_qaRelease: filterData(dataQaRelease),
            ship_shipment: filterData(dataShipment),
        };
    }, [
        isSearching, globalSearch,
        dataPpic, dataPotongStock, dataPreparasi, dataTimbang, dataValidasi1, dataValidasi2, dataCompounding,
        dataTransferStorage, dataQcTerimaSample, dataQcAnalisaComplete, dataQcRelease, dataScanStorage, dataFillingLiquid, dataFillingPowder, dataSampleFg, dataEndPackaging, dataSerahTerimaBpp,
        dataTerimaBr, dataTerimaRap, dataQaRelease, dataShipment
    ]);

    // Visibility Checks
    const showPrepPpic = !isSearching || prep_Ppic.length > 0;
    const showPrepPotongStock = !isSearching || prep_potongStock.length > 0;
    const showPrepPreparasi = !isSearching || prep_preparasi.length > 0;
    const showPrepTimbang = !isSearching || prep_Timbang.length > 0;
    const showPrepVal1 = !isSearching || prep_validasi1.length > 0;
    const showPrepVal2 = !isSearching || prep_validasi2.length > 0;
    const showPrepCompounding = !isSearching || prep_compounding.length > 0;

    const showProdTransfer = !isSearching || prod_transfer.length > 0;
    const showProdQcTerima = !isSearching || prod_qcTerima.length > 0;
    const showProdQcAnalisa = !isSearching || prod_qcAnalisa.length > 0;
    const showProdQcRelease = !isSearching || prod_qcRelease.length > 0;
    const showProdScanStorage = !isSearching || prod_scanStorage.length > 0;
    const showProdSampleFg = !isSearching || prod_sampleFg.length > 0;
    const showProdFilling = !isSearching || prod_fillingLiquid.length > 0 || prod_fillingPowder.length > 0;
    const showProdEndPackaging = !isSearching || prod_endPackaging.length > 0;
    const showProdSerahTerima = !isSearching || prod_serahTerimaBpp.length > 0;

    const showShipTerimaBr = !isSearching || ship_terimaBr.length > 0;
    const showShipTerimaRap = !isSearching || ship_terimaRap.length > 0;
    const showShipQaRelease = !isSearching || ship_qaRelease.length > 0;
    const showShipShipment = !isSearching || ship_shipment.length > 0;

    if (isLoading) {
        return (
            <div className="w-full h-[calc(100vh-100px)] flex flex-col items-center justify-center bg-transparent">
                <div className="w-12 h-12 border-4 border-[#eaf4d5] border-t-[#8cc63f] rounded-full animate-spin"></div>
                <p className="mt-4 text-[#104c97] font-bold animate-pulse tracking-wide">
                    Menarik Data Real-Time...
                </p>
            </div>
        );
    }

    return (
        <div className="w-full md:w-[95%] mx-auto bg-transparent min-h-125">
            {/* CSS KEYFRAMES UNTUK ANIMASI (SLIDE UP, FADE IN, POP IN)                   */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes slideUpFade {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slideUpFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes popIn {
                    from { opacity: 0; transform: scale(0.95) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .animate-pop-in {
                    animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in {
                    animation: fadeIn 0.2s ease-out forwards;
                }
            `}} />

            <div className={`bg-white shadow-sm rounded-lg ${isAnimating ? 'animate-slide-up' : ''}`} style={{ animationFillMode: 'both' }}>

                <div className="flex flex-col lg:flex-row bg-white border-b border-gray-200 sticky top-16 z-30 rounded-t-lg justify-between items-center pr-0 lg:pr-4">
                    <div className="flex w-full lg:w-2/3">
                        {[
                            { id: "preparation", label: "Preparation" },
                            { id: "production", label: "Production" },
                            { id: "shipment", label: "Shipment" }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id as any)}
                                className={`flex-1 text-center py-4 text-sm font-medium transition-colors duration-200 ${activeTab === tab.id
                                    ? "bg-[#c7d6ab] text-black border-b-[3px] border-gray-400"
                                    : "text-gray-600 hover:bg-[#eaf4ff] cursor-pointer"
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="w-full lg:w-1/3 p-3 lg:p-0 lg:pl-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Cari Kode Ruah/Kode Produk/No Batch..."
                                value={globalSearch}
                                onChange={(e) => setGlobalSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#c7d6ab] bg-gray-50 transition-all"
                            />
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-[#f8faf5]">

                    {/* ========================================================================= */}
                    {/* TAB: PREPARATION                                                          */}
                    {/* ========================================================================= */}
                    {activeTab === "preparation" && (
                        <div id="preparation" key="tab-prep" className={`flex flex-col gap-y-6 w-full ${isAnimating ? 'animate-slide-up' : ''}`}>
                            {(showPrepPpic || showPrepPotongStock || showPrepPreparasi) && (
                                <div className={`grid grid-cols-1 lg:grid-cols-3 gap-4 items-start mb-4 ${isAnimating ? 'animate-slide-up' : ''}`} style={{ animationDelay: '0.05s', animationFillMode: 'both' }}>
                                    {showPrepPpic && (
                                        <div className="w-full">
                                            <SimpleCard
                                                title="PPIC CWO"
                                                subtitle="Departement PPIC"
                                                count={prep_Ppic.length}
                                                countOver={0}
                                                batches={prep_Ppic}
                                                apiPostUrl={`${API_BASE_URL}/api/v1/produksi/kirim-ppic`}
                                                onSuccess={fetchAllData}
                                                showDelete={true}
                                                onDeleteClick={(batch) => handleDeleteRequest(batch, `${API_BASE_URL}/api/v1/produksi/kirim-ppic`, "WO")}
                                                access={{
                                                    areas: ["Administrator", "PPIC"],
                                                    levels: ["administrator", "manager", "supervisor", "staff_ppic"],
                                                    detailAreas: ["Administrator", "PPIC Site"],
                                                }}
                                            />
                                        </div>
                                    )}
                                    {showPrepPotongStock && (
                                        <div className="w-full">
                                            <SimpleCard
                                                title="WAREHOUSE POTONG STOCK"
                                                subtitle="Departement Warehouse"
                                                count={prep_potongStock.length}
                                                countOver={prep_potongStock.filter(b => b.status_lead === "OVER").length}
                                                batches={prep_potongStock}
                                                apiPostUrl={`${API_BASE_URL}/api/v1/produksi/potong-stock`}
                                                onSuccess={fetchAllData}
                                                showDelete={true}
                                                onDeleteClick={(batch) => handleDeleteRequest(batch, `${API_BASE_URL}/api/v1/produksi/potong-stock`, "POTONG STOCK")}
                                                access={{
                                                    areas: ["Administrator", "Warehouse"],
                                                    levels: ["administrator", "manager", "supervisor", "staff_wh"],
                                                    detailAreas: ["Administrator", "WH WG Admin"]
                                                }}
                                            />
                                        </div>
                                    )}
                                    {showPrepPreparasi && (
                                        <div className="w-full">
                                            <SimpleCard
                                                title="WAREHOUSE PREPARASI"
                                                subtitle="Departement Warehouse"
                                                count={prep_preparasi.length}
                                                countOver={0}
                                                batches={prep_preparasi}
                                                onSuccess={fetchAllData}
                                                showDelete={true}
                                                onDeleteClick={(batch) => handleDeleteRequest(batch, `${API_BASE_URL}/api/v1/produksi/wh-preparasi`, "PREPARASI")}
                                                showBottomRefresh={true}
                                                hideSubmit={true}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {(showPrepTimbang || showPrepVal1 || showPrepVal2) && (
                                <div className={`grid grid-cols-1 lg:grid-cols-3 gap-4 items-start mb-4 ${isAnimating ? 'animate-slide-up' : ''}`} style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
                                    {showPrepTimbang && (
                                        <div className="w-full">
                                            <SimpleCard
                                                title="WAREHOUSE TIMBANG"
                                                subtitle="Department Warehouse"
                                                count={prep_Timbang.length}
                                                countOver={dataTimbang.filter(b => b.status_lead === 'OVER').length}
                                                batches={prep_Timbang}
                                                apiPostUrl={`${API_BASE_URL}/api/v1/produksi/timbang`}
                                                onSuccess={fetchAllData}
                                                showDelete={true}
                                                onDeleteClick={(batch) => handleDeleteRequest(batch, `${API_BASE_URL}/api/v1/produksi/timbang`, "WEIGHING")}
                                                hideLeadTime={true}
                                                access={{
                                                    areas: ["Administrator"]
                                                }}
                                            />
                                        </div>
                                    )}
                                    {showPrepVal1 && (
                                        <div className="w-full">
                                            <SimpleCard
                                                title="WAREHOUSE (VALIDASI 1)"
                                                subtitle="Departement Warehouse"
                                                count={prep_validasi1.length}
                                                countOver={0}
                                                batches={prep_validasi1}
                                                onSuccess={fetchAllData}
                                                showBottomRefresh={true}
                                                hideSubmit={true}
                                            />
                                        </div>
                                    )}
                                    {showPrepVal2 && (
                                        <div className="w-full">
                                            <SimpleCard
                                                title="PRODUKSI (VALIDASI 2)"
                                                subtitle="Departement Produksi"
                                                count={prep_validasi2.length}
                                                countOver={prep_validasi2.filter(b => b.status_lead === 'OVER').length}
                                                batches={prep_validasi2}
                                                apiPostUrl={`${API_BASE_URL}/api/v1/produksi/validasi-2`}
                                                onSuccess={fetchAllData}
                                                access={{
                                                    areas: ["Administrator", "Production"],
                                                    levels: ["administrator", "manager", "supervisor", "staff_prod"],
                                                    detailAreas: ["Administrator", "Op Compounding"]
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {showPrepCompounding && (
                                <div className={`grid grid-cols-1 lg:grid-cols-3 gap-4 items-start mb-4 ${isAnimating ? 'animate-slide-up' : ''}`} style={{ animationDelay: '0.15s', animationFillMode: 'both' }}>
                                    <div className="w-full">
                                        <DropdownTankCard
                                            title="COMPOUNDING (MIXING TANK)"
                                            subtitle="Departement Produksi"
                                            data={prep_compounding}
                                            apiPostUrl={`${API_BASE_URL}/api/v1/produksi/pr-compounding`}
                                            onSuccess={fetchAllData}
                                            dropdownOptionsMap={mixingTanksMap}
                                            access={{
                                                areas: ["Administrator", "Production"],
                                                levels: ["administrator", "manager", "supervisor", "staff_prod"],
                                                detailAreas: ["Administrator", "Op Compounding"]
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {!showPrepPpic && !showPrepPotongStock && !showPrepPreparasi && !showPrepTimbang && !showPrepVal1 && !showPrepVal2 && !showPrepCompounding && (
                                <div className={`col-span-full p-8 text-center text-gray-400 border-2 border-dashed border-gray-300 rounded-lg ${isAnimating ? 'animate-slide-up' : ''}`}>
                                    Pencarian <strong>"{globalSearch}"</strong> tidak ditemukan di Tahap Preparation.
                                </div>
                            )}
                        </div>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB: PRODUCTION                                                           */}
                    {/* ========================================================================= */}
                    {activeTab === "production" && (
                        <div id="production" key="tab-prod" className={`flex flex-col gap-y-6 w-full ${isAnimating ? 'animate-slide-up' : ''}`}>
                            {(showProdTransfer || showProdQcTerima) && (
                                <div className={`flex flex-col lg:flex-row gap-4 items-start mb-4 ${isAnimating ? 'animate-slide-up' : ''}`} style={{ animationDelay: '0.05s', animationFillMode: 'both' }}>
                                    {showProdTransfer && (
                                        <div className="w-full lg:w-3/10 shrink-0">
                                            <DropdownTankCard
                                                title="Transfer Storage"
                                                subtitle="Departement Produksi"
                                                data={prod_transfer}
                                                apiPostUrl={`${API_BASE_URL}/api/v1/produksi/to-storage`}
                                                onSuccess={fetchAllData}
                                                fetchDynamicOptions={fetchStorageTanks}
                                                access={{
                                                    areas: ["Administrator", "Production"],
                                                    levels: ["administrator", "manager", "supervisor", "staff_prod"],
                                                    detailAreas: ["Administrator", "Op Compounding"]
                                                }}
                                            />
                                        </div>
                                    )}
                                    {showProdQcTerima && (
                                        <div className="w-full flex-1 min-w-0">
                                            <QcTerimaSampleCard
                                                data={prod_qcTerima}
                                                apiPostUrl={`${API_BASE_URL}/api/v1/produksi/qc-analisa`}
                                                onSuccess={fetchAllData}
                                                access={{
                                                    areas: ["Administrator", "Quality Control", "Production"],
                                                    levels: ["administrator", "manager", "supervisor", "staff_qc", "staff_prod"],
                                                    detailAreas: ["Administrator", "Op Compounding", "Analis"]
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {showProdQcAnalisa && (
                                <div className={`flex flex-col lg:flex-row gap-4 items-start mb-4 ${isAnimating ? 'animate-slide-up' : ''}`} style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
                                    <div className="w-full">
                                        <QcAnalisaCompleteCard
                                            data={prod_qcAnalisa}
                                            apiPostUrl={`${API_BASE_URL}/api/v1/produksi/qc-release`}
                                            onSuccess={fetchAllData}
                                            access={{
                                                areas: ["Administrator", "Quality Control"],
                                                levels: ["administrator", "manager", "supervisor", "staff_qc"],
                                                detailAreas: ["Administrator", "Analis"]
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {(showProdQcRelease || showProdScanStorage) && (
                                <div className={`flex flex-col lg:flex-row gap-4 items-start mb-4 ${isAnimating ? 'animate-slide-up' : ''}`} style={{ animationDelay: '0.15s', animationFillMode: 'both' }}>
                                    {showProdQcRelease && (
                                        <div className="w-full lg:w-3/10 shrink-0">
                                            <QcReleaseCard
                                                data={prod_qcRelease}
                                                apiPostUrl={`${API_BASE_URL}/api/v1/produksi/kirim-ke-scan-barcode`}
                                                onSuccess={fetchAllData}
                                                access={{
                                                    areas: ["Administrator", "Quality Control"],
                                                    levels: ["administrator", "manager", "supervisor", "staff_qc"],
                                                    detailAreas: ["Administrator"]
                                                }}
                                            />
                                        </div>
                                    )}
                                    {showProdScanStorage && (
                                        <div className="w-full flex-1 min-w-0">
                                            <ScanBarcodeStorageCard
                                                data={prod_scanStorage}
                                                apiPostUrl={`${API_BASE_URL}/api/v1/produksi/scan-storage`}
                                                onSuccess={fetchAllData}
                                                access={{
                                                    areas: ["Administrator", "Quality Control"],
                                                    levels: ["administrator", "manager", "supervisor", "staff_qc"],
                                                    detailAreas: ["Administrator", "Analis"]
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {(showProdFilling || showProdSampleFg) && (
                                <div className={`flex flex-col lg:flex-row gap-4 items-start mb-4 ${isAnimating ? 'animate-slide-up' : ''}`} style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
                                    {showProdFilling && (
                                        <div className="w-full lg:w-6/10 shrink-0">
                                            <ProduksiFillingCard
                                                liquidData={prod_fillingLiquid}
                                                powderData={prod_fillingPowder}
                                                apiPostUrl={`${API_BASE_URL}/api/v1/produksi/kirim-ke-sample-fg`}
                                                onSuccess={fetchAllData}
                                                mesinOptions={["SIG 5", "SIG 6", "JOYEA"]}
                                            />
                                        </div>
                                    )}
                                    {showProdSampleFg && (
                                        <div className="w-full">
                                            <SimpleCard
                                                title="SAMPLE FG"
                                                subtitle="Departement QC"
                                                count={prod_sampleFg.length}
                                                countOver={0}
                                                batches={prod_sampleFg}
                                                apiPostUrl={`${API_BASE_URL}/api/v1/produksi/kirim-ke-end-packaging`}
                                                onSuccess={fetchAllData}
                                                showTopRefresh={true}
                                                selectionMode="radio"
                                                submitText="Kirim Batch Terpilih"
                                                access={{
                                                    areas: ["Administrator", "Quality Control"],
                                                    levels: ["administrator", "manager", "supervisor", "staff_qc"],
                                                    detailAreas: ["Administrator", "Analis"]
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {showProdEndPackaging && (
                                <div className={`flex flex-col lg:flex-row gap-4 items-start mb-4 ${isAnimating ? 'animate-slide-up' : ''}`} style={{ animationDelay: '0.25s', animationFillMode: 'both' }}>
                                    <div className="w-full">
                                        <EndPackagingCard
                                            title="END PACKAGING"
                                            subtitle="Departement Produksi"
                                            data={prod_endPackaging}
                                            apiPostUrl={`${API_BASE_URL}/api/v1/produksi/scan-end-packaging`}
                                            onSuccess={fetchAllData}
                                            access={{
                                                areas: ["Administrator", "Production"],
                                                levels: ["administrator", "manager", "supervisor", "staff_prod"],
                                                detailAreas: ["Administrator", "Admin BR"]
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {showProdSerahTerima && (
                                <div className={`flex flex-col lg:flex-row gap-4 items-start mb-4 ${isAnimating ? 'animate-slide-up' : ''}`} style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
                                    <div className="w-full">
                                        <SerahTerimaBppCard
                                            title="SERAH TERIMA BPP"
                                            subtitle="Departement Warehouse"
                                            data={prod_serahTerimaBpp}
                                            apiPostUrl={`${API_BASE_URL}/api/v1/produksi/scan-serah-terima-bpp`}
                                            onSuccess={fetchAllData}
                                            access={{
                                                areas: ["Administrator", "Warehouse"],
                                                levels: ["administrator", "manager", "supervisor", "staff_wh"],
                                                detailAreas: ["Administrator", "WH OMC Admin", "WH OMC Operator"]
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {!showProdTransfer && !showProdQcTerima && !showProdQcAnalisa && !showProdQcRelease && !showProdScanStorage && !showProdFilling && !showProdSampleFg && !showProdEndPackaging && !showProdSerahTerima && (
                                <div className={`col-span-full p-8 text-center text-gray-400 border-2 border-dashed border-gray-300 rounded-lg ${isAnimating ? 'animate-slide-up' : ''}`}>
                                    Pencarian <strong>"{globalSearch}"</strong> tidak ditemukan di Tahap Production.
                                </div>
                            )}
                        </div>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB: SHIPMENT                                                             */}
                    {/* ========================================================================= */}
                    {activeTab === "shipment" && (
                        <div id="shipment" key="tab-ship" className={`flex flex-col gap-y-6 w-full ${isAnimating ? 'animate-slide-up' : ''}`}>
                            {(showShipTerimaBr || showShipTerimaRap) && (
                                <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 items-start mb-4 ${isAnimating ? 'animate-slide-up' : ''}`} style={{ animationDelay: '0.05s', animationFillMode: 'both' }}>
                                    {showShipTerimaBr && (
                                        <div className="w-full">
                                            <TerimaBrRapCard
                                                title="TERIMA BR"
                                                subtitle="Departement QA"
                                                type="BR"
                                                count={ship_terimaBr.length}
                                                countOver={0}
                                                batches={ship_terimaBr}
                                                apiPostUrl={`${API_BASE_URL}/api/v1/produksi/setor-br-complete`}
                                                onSuccess={fetchAllData}
                                                submitText="Selesaikan Setor BR"
                                                access={{
                                                    areas: ["Administrator", "Quality Assurance"],
                                                    levels: ["administrator", "manager", "supervisor", "staff_qa"],
                                                    detailAreas: ["Administrator", "QA BR"]
                                                }}
                                            />
                                        </div>
                                    )}
                                    {showShipTerimaRap && (
                                        <div className="w-full">
                                            <TerimaBrRapCard
                                                title="TERIMA RAP"
                                                subtitle="Departement QA"
                                                type="RAP"
                                                count={ship_terimaRap.length}
                                                countOver={0}
                                                batches={ship_terimaRap}
                                                apiPostUrl={`${API_BASE_URL}/api/v1/produksi/setor-rap-complete`}
                                                onSuccess={fetchAllData}
                                                submitText="Selesaikan Setor RAP"
                                                access={{
                                                    areas: ["Administrator", "Quality Assurance"],
                                                    levels: ["administrator", "manager", "supervisor", "staff_qa"],
                                                    detailAreas: ["Administrator", "QA BR"]
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {showShipQaRelease && (
                                <div className={`w-full ${isAnimating ? 'animate-slide-up' : ''}`} style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
                                    <QaReleaseCard
                                        data={ship_qaRelease}
                                        apiPostUrl={`${API_BASE_URL}/api/v1/produksi/send-to-shipment`}
                                        onSuccess={fetchAllData}
                                        access={{
                                            areas: ["Administrator", "Quality Assurance"],
                                            levels: ["administrator", "manager", "supervisor", "staff_qa"],
                                            detailAreas: ["Administrator"]
                                        }}
                                    />
                                </div>
                            )}

                            {showShipShipment && (
                                <div className={`w-full ${isAnimating ? 'animate-slide-up' : ''}`} style={{ animationDelay: '0.15s', animationFillMode: 'both' }}>
                                    <ShipmentCard
                                        data={ship_shipment}
                                        apiPostUrl={`${API_BASE_URL}/api/v1/produksi/receive-shipment`}
                                        onSuccess={fetchAllData}
                                        access={{
                                            areas: ["Administrator", "Warehouse"],
                                            levels: ["administrator", "manager", "supervisor", "staff_wh"],
                                            detailAreas: ["Administrator", "WH OMC Admin", "WH OMC Operator"]
                                        }}
                                    />
                                </div>
                            )}

                            {!showShipTerimaBr && !showShipTerimaRap && !showShipQaRelease && !showShipShipment && (
                                <div className={`col-span-full p-8 text-center text-gray-400 border-2 border-dashed border-gray-300 rounded-lg ${isAnimating ? 'animate-slide-up' : ''}`}>
                                    Pencarian <strong>"{globalSearch}"</strong> tidak ditemukan di Tahap Shipment.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Konfirmasi Hapus */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 animate-fade-in backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-2xl w-125 overflow-hidden animate-pop-in">
                        <div className="px-4 py-3 border-b flex justify-between items-center">
                            <h5 className="font-bold text-lg text-black">Konfirmasi Hapus</h5>
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="text-gray-400 hover:text-black font-bold text-xl leading-none transition-colors"
                            >
                                ×
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            <div className="text-gray-800 whitespace-pre-line leading-relaxed">
                                Yakin hapus data {deleteTitle}?
                                {deleteTarget && (
                                    <>
                                        <br />Kode Ruah: <span className="font-medium">{deleteTarget.kode_ruah}</span>
                                        <br />Kode Produk: <span className="font-medium">{deleteTarget.kode_produk}</span>
                                        <br />No Batch: <span className="font-medium">{deleteTarget.no_batch}</span>
                                    </>
                                )}
                            </div>

                            <input
                                type="text"
                                placeholder="Username"
                                required
                                value={deleteForm.username}
                                onChange={(e) => setDeleteForm({ ...deleteForm, username: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 text-black rounded focus:outline-none focus:ring-2 focus:ring-[#c7d6ab] focus:border-transparent transition-all"
                            />

                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Password"
                                    required
                                    value={deleteForm.password}
                                    onChange={(e) => setDeleteForm({ ...deleteForm, password: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 text-black rounded focus:outline-none focus:ring-2 focus:ring-[#c7d6ab] focus:border-transparent transition-all pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700 cursor-pointer transition-colors"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>

                            <textarea
                                rows={3}
                                placeholder="Tambahkan Catatan Disini"
                                value={deleteForm.keterangan}
                                onChange={(e) => setDeleteForm({ ...deleteForm, keterangan: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 text-black rounded focus:outline-none focus:ring-2 focus:ring-[#c7d6ab] focus:border-transparent transition-all resize-none"
                            />
                        </div>

                        <div className="px-4 py-3 border-t flex justify-end gap-2 bg-gray-50">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 transition-colors cursor-pointer"
                            >
                                Batal
                            </button>
                            <button
                                onClick={executeDelete}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                            >
                                {isDeleting ? "Menghapus..." : "Hapus"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}