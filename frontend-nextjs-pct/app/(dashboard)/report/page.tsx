import FilterReport from '@/components/filterReport';
import LeadtimeLineChart from '@/components/leadtimeLineChart';
import LeadtimeBarChart from '@/components/leadtimeBarChart';
import LeadtimeTable from '@/components/leadtimeTable';
import ProductLineCharts from '@/components/productLineChart';
import ProductBarCharts from '@/components/productBarChart';
import GroupCharts from '@/components/groupChart';
import GroupBarCharts from '@/components/groupBarChart';
import { cookies } from 'next/headers';
import { API_BASE_URL, apiFetch } from '@/lib/api';

export default async function ReportingPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> 
}) {
  
  const params = await searchParams;
  
  const filterType = params.filter_type as string || 'batch';
  const startProcess = params.start_process as string;
  const endProcess = params.end_process as string;

  let reportData = null;
  
  // Data threshold sementara (Nanti bisa di-fetch juga ke API Master Threshold Go)
  let dummyThresholds = [
    { color: 'biru', max_value: 5 },
    { color: 'hijau tua', max_value: 15 },
    { color: 'kuning', max_value: 25 },
    { color: 'merah', max_value: 100 }
  ];

  if (startProcess && endProcess) {
    const query = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(val => query.append(key, val));
      } else if (value) {
        query.append(key, value);
      }
    });

    const queryStr = query.toString();
    let endpoint = '';
    
    if (filterType === 'batch') endpoint = '/api/v1/reports/batch';
    else if (filterType === 'produk') endpoint = '/api/v1/reports/product';
    else if (filterType === 'group') endpoint = '/api/v1/reports/group';

    if (endpoint) {
        try {
            // Mengambil token dari Cookies di sisi Server Next.js 
            const cookieStore = await cookies();
            const token = cookieStore.get('token')?.value;
            
            const res = await apiFetch(`${API_BASE_URL}${endpoint}?${queryStr}`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                cache: 'no-store' // Wajib agar filter selalu menghasilkan data fresh
            });

            if (res.ok) {
               const json = await res.json();
               reportData = json.data;
            } else {
               console.error("Gagal mengambil data dari API, Status:", res.status);
            }
        } catch (error) {
            console.error("Terjadi kesalahan fetch API:", error);
        }
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* LAYER FILTER */}
      <FilterReport />

      {/* LAYER VISUALISASI GRAFIK */}
      {reportData && reportData.length > 0 ? (
        <div className="space-y-8">
           
           {/* 1. BATCH REPORT: Line chart per batch */}
           {filterType === 'batch' && (
              <LeadtimeLineChart 
                leadtimeData={reportData} 
                startProcess={startProcess} 
                endProcess={endProcess} 
              />
           )}

           {/* 2. PRODUCT REPORT: Line chart + Bar chart per produk */}
           {filterType === 'produk' && (
              <>
                <ProductLineCharts 
                  leadtimeData={reportData} 
                  startProcess={startProcess} 
                  endProcess={endProcess} 
                />
                <ProductBarCharts 
                  leadtimeData={reportData} 
                  startProcess={startProcess} 
                  endProcess={endProcess} 
                />
              </>
           )}

           {/* 3. GROUP REPORT: Perbandingan Pharma vs Herbal */}
           {filterType === 'group' && (
            <>
              <GroupCharts 
                leadtimeData={reportData} 
                startProcess={startProcess} 
                endProcess={endProcess} 
              />
              <GroupBarCharts 
              leadtimeData={reportData} 
              startProcess={startProcess} 
              endProcess={endProcess} 
              />
            </>
           )}

           {/* 4. BATCH BAR CHART DENGAN THRESHOLD (Selalu muncul di semua report) */}
           <LeadtimeBarChart 
              leadtimeData={reportData}
              thresholdRanges={dummyThresholds}
              startProcess={startProcess}
              endProcess={endProcess}
           />
           
           {/* TABEL SELALU MUNCUL DI BAWAH */}
           <LeadtimeTable 
              leadtimeData={reportData} 
              filterType={filterType} 
           />

        </div>
      ) : (
        reportData && reportData.length === 0 && (
          <div className="bg-white p-8 text-center text-gray-500 rounded-lg border shadow-sm">
            Tidak ada data yang ditemukan untuk filter tersebut.
          </div>
        )
      )}
    </div>
  );
}