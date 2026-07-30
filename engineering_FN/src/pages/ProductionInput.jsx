import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useSelector } from "react-redux";
import { useColorModeValue, Select, Input } from "@chakra-ui/react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import React from 'react'; // ADDED: Required for modern React/JSX

import CanvasJSReact from "../canvasjs.react";
import moment from "moment-timezone";

const CanvasJSChart = CanvasJSReact.CanvasJSChart; 


const ProductionInput = () => {
    // State for form input
    const [formData, setFormData] = useState({
        shift: '1',
        tanggal: new Date().toISOString().split('T')[0], // Default ke format yyyy-mm-dd
        machine: 'HM1'
    });

    // State for table data
    const [tableData, setTableData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const userGlobal = useSelector((state) => state.user.user);

    // State for chart
    const [downtimeChartOptions, setDowntimeChartOptions] = useState({});
    const [ downtimeChartDataPoints, setDowntimeChartDataPoints] = useState([]);

    const borderColor = useColorModeValue("rgba(var(--color-border))", "rgba(var(--color-border))");
    const hoverBorderColor = useColorModeValue("rgba(var(--color-border2))", "rgba(var(--color-border2))");
    const buatSiSelect = useColorModeValue("rgba(var(--color-text))", "rgba(var(--color-text))");

    const [isDarkMode, setIsDarkMode] = useState(
        document.documentElement.getAttribute("data-theme") === "dark"
    );
    
    // State for downtime options
    const [downtimeOptions, setDowntimeOptions] = useState({
        Minor: [], Planned: [], Unplanned: []
    });

        // Fungsi untuk mengkonversi waktu format HH:MM menjadi menit
    const convertTimeToMinutes = (timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    };

    // Fungsi untuk mengkonversi menit menjadi format waktu HH:MM
    const convertMinutesToTime = (totalMinutes) => {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };

    // Fungsi untuk mendapatkan waktu berikutnya
    const getNextTime = (startTime, durationMinutes) => {
        const startMinutes = convertTimeToMinutes(startTime);
        const endMinutes = startMinutes + durationMinutes;
        return convertMinutesToTime(endMinutes);
    };

    // Fungsi buat memastikan waktu berada dalam range
    const ensureTimeInRange = (timeStr, minTimeStr, maxTimeStr) => {
        const time = convertTimeToMinutes(timeStr);
        const minTime = convertTimeToMinutes(minTimeStr);
        const maxTime = convertTimeToMinutes(maxTimeStr);
        
        if (time < minTime) return minTimeStr;
        if (time > maxTime) return maxTimeStr;
        return timeStr;
    };

        // Fungsi untuk membuat sub-row dengan durasi penuh dari main row
    const createSubRowWithFullDuration = (mainRow) => {
        return {
            start: mainRow.start,
            finish: mainRow.finish,
            total_menit: mainRow.total_menit,
            downtime_type: '',
            detail: '',
            keterangan: ''
        };
    };
    
        // Handle perubahan input form
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };



    // ... (utility functions: formatDate, handleInputChange, etc. - UNCHANGED)

    // ✅ IMPROVED: Process Data for CanvasJS Chart
    const processDowntimeData = useCallback((data, isDarkMode) => {
        try {
            if (!Array.isArray(data)) { throw new Error("Invalid data format: Expected array"); }

            // 1. Filter & Aggregate: Only sum up submitted downtime records (downtime_type is NOT NULL)
// --- Inside your processDowntimeData function ---
const UNCLASSIFIED_LABEL = 'Uncategorized/Unsubmitted'; // Define a label for the chart

const aggregation = data.reduce((acc, record) => {
    // Determine the category type
    let type;
    
    // Check if the record HAS been classified (downtime_type is NOT null/empty)
    if (record?.downtime_type) {
        type = record.downtime_type;
    } else {
        // If downtime_type is NULL or empty, assign it to the UNCLASSIFIED group
        type = UNCLASSIFIED_LABEL;
    }

    // Process the minutes
    const minutes = Number(record?.total_menit) || 0; 
    
    if (!isNaN(minutes)) {
        acc[type] = (acc[type] || 0) + minutes;
    }
    
    return acc;
}, {});

// ... (The rest of your code that converts 'aggregation' to 'dataPoints' follows)
            
            // 2. Format: Convert to CanvasJS dataPoints array
            const dataPoints = Object.keys(aggregation).map(type => ({
                label: type,
                y: aggregation[type]
            }));

            // If there are no submitted records, dataPoints will be empty
            if (dataPoints.length === 0) {
                setDowntimeChartOptions({});
                setDowntimeChartDataPoints([]);
                return;
            }

            const colorPalette = ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#FF9F40"];
            
            // 3. Set the Options for the chart
            setDowntimeChartOptions({
                theme: isDarkMode ? "dark2" : "light2",
                animationEnabled: true,
                responsive: true,
                title: {
                    text: `Total Downtime by Type (${formData.machine} - Shift ${formData.shift} - ${formData.tanggal})`,
                    fontColor: isDarkMode ? "white" : "black",
                },
                backgroundColor: isDarkMode ? "#171717" : "#ffffff",
                toolTip: {
                    content: "{label}: {y} Minutes"
                },
                data: [{
                    type: "column",
                    showInLegend: false,
                    dataPoints: dataPoints.sort((a, b) => b.y - a.y),
                    colorSet: colorPalette
                }],
            });
            
            setDowntimeChartDataPoints(dataPoints);
        } catch (error) {
            console.error('Error processing downtime data:', error);
            setDowntimeChartOptions({});
            setDowntimeChartDataPoints([]);
        }
    }, [formData.machine, formData.shift, formData.tanggal, isDarkMode]); // Added dependencies

    // Load opsi downtime saat komponen dimuat
    useEffect(() => {
        const fetchDowntimeOptions = async () => {
            try {
                // Fetch semua opsi downtime sekali di awal
                const [minorRes, plannedRes, unplannedRes] = await Promise.all([
                    axios.get("http://10.126.15.197:8002/part/alldowntime", { params: { type: 'Minor' } }),
                    axios.get("http://10.126.15.197:8002/part/alldowntime", { params: { type: 'Planned' } }),
                    axios.get("http://10.126.15.197:8002/part/alldowntime", { params: { type: 'Unplanned' } })
                ]);

                setDowntimeOptions({
                    Minor: minorRes.data,
                    Planned: plannedRes.data,
                    Unplanned: unplannedRes.data
                });
            } catch (err) {
                console.error('Error fetching downtime options:', err);
            }
        };

        fetchDowntimeOptions();
    }, []);

// 🔴 THE KEY FUNCTION TO USE EXISTING DATA
const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError('');
    setTableData([]); 
    setDowntimeChartDataPoints([]);
    setDowntimeChartOptions({});

    if (!formData.machine || !formData.tanggal || !formData.shift) {
        setError('Machine, Shift, and Date are required.');
        setIsLoading(false);
        return;
    }
    
    try {
        // --- STEP 1: Fetch ALL data (Submitted and Unsubmitted) ---
        const response = await axios.get("http://10.126.15.197:8002/part/HM1Report", {
            params: {
                shift: formData.shift,
                tanggal: formData.tanggal, 
                area: formData.machine 
            }
        });
        
        const rawData = response.data;
        
        // 2. Populate the Table
        const initialTableData = rawData.map(row => ({
            ...row,
            showSubRows: false, 
            subRows: null,
        }));
        setTableData(initialTableData);

        // 3. Process the SAME DATA for the Chart
        // This function will automatically find any rows that are already classified 
        // (downtime_type is NOT NULL) and aggregate their total_menit.
        processDowntimeData(rawData, isDarkMode); 
        
        // 4. Handle Case: No data at all
        if (rawData.length === 0) {
            setError(`No records found for Machine: ${formData.machine} on ${formData.tanggal}.`);
        }

    } catch (err) {
        setError('Gagal mengambil data. Silakan cek koneksi server.');
        console.error(err.response ? err.response.data : err.message);
    } finally {
        setIsLoading(false);
    }
};
    

// 1. Toggle untuk menampilkan/menyembunyikan sub-rows
const handleToggleSubRows = (index) => {
    setTableData(prevData => {
        const newData = [...prevData];
        // Toggle showSubRows property
        const showSubRows = !newData[index].showSubRows;
        
        newData[index] = {
            ...newData[index],
            showSubRows
        };
        
        // Inisialisasi sub-rows jika belum ada atau showSubRows is true
        if (showSubRows && (!newData[index].subRows || newData[index].subRows.length === 0)) {
            // Inisialisasi dengan 1 sub-row yang memiliki total_menit sama dengan main row
            newData[index].subRows = [createSubRowWithFullDuration(newData[index])];
        }
        
        return newData;
    });
};

    // Tambah sub-row baru (maksimum 5) dengan mempertimbangkan waktu yang tersisa
    const handleAddSubRow = (rowIndex) => {
        setTableData(prevData => {
            const newData = [...prevData];
            const mainRow = newData[rowIndex];
            if (!mainRow.subRows) mainRow.subRows = [];

            if (mainRow.subRows.length >= 5) {
                toast.info('Maksimum 5 sub-row diperbolehkan');
                return newData;
            }

            // Hitung total menit yang sudah dialokasikan di sub-rows
            const allocatedMinutes = mainRow.subRows.reduce(
                (sum, subRow) => sum + subRow.total_menit, 0
            );
            const remainingMinutes = mainRow.total_menit - allocatedMinutes;

            if (remainingMinutes < 1) {
                toast.warning('Tidak ada waktu tersisa untuk sub-row baru');
                return newData;
            }

            // Dapatkan finish dari sub-row terakhir, atau start dari main row jika belum ada sub-row
            let prevFinish = mainRow.start;
            if (mainRow.subRows.length > 0) {
                prevFinish = mainRow.subRows[mainRow.subRows.length - 1].finish;
            }

            // Sub-row baru: start=prevFinish, finish=mainRow.finish atau +remainingMinutes, total_menit=remainingMinutes
            // Pakai getNextTime untuk cari finish
            const maxFinish = convertTimeToMinutes(mainRow.finish);
            const startMinutes = convertTimeToMinutes(prevFinish);
            let finishMinutes = startMinutes + remainingMinutes;
            if (finishMinutes > maxFinish) finishMinutes = maxFinish;

            const newSubRow = {
                start: prevFinish,
                finish: convertMinutesToTime(finishMinutes),
                total_menit: finishMinutes - startMinutes,
                downtime_type: '',
                detail: '',
                keterangan: ''
            };

            mainRow.subRows.push(newSubRow);
            return newData;
        });
    };

    // 5. Hapus sub-row dan realokasi waktunya
    const handleRemoveSubRow = (rowIndex, subRowIndex) => {
        setTableData(prevData => {
            const newData = [...prevData];
            const mainRow = newData[rowIndex];
            if (!mainRow.subRows || mainRow.subRows.length <= 1) {
                toast.info('Minimal harus ada 1 sub-row');
                return newData;
            }
            const removedDuration = mainRow.subRows[subRowIndex].total_menit || 0;
            const removedStart = mainRow.subRows[subRowIndex].start;
            mainRow.subRows.splice(subRowIndex, 1);
            if (subRowIndex < mainRow.subRows.length) {
                mainRow.subRows[subRowIndex].start = removedStart;
                mainRow.subRows[subRowIndex].total_menit += removedDuration;
                mainRow.subRows[subRowIndex].finish = getNextTime(
                    mainRow.subRows[subRowIndex].start,
                    mainRow.subRows[subRowIndex].total_menit
                );
            } else if (mainRow.subRows.length > 0) {
                const last = mainRow.subRows.length - 1;
                mainRow.subRows[last].total_menit += removedDuration;
                mainRow.subRows[last].finish = getNextTime(
                    mainRow.subRows[last].start,
                    mainRow.subRows[last].total_menit
                );
            }
            // Refix start/finish for all subsequent sub-rows
            for (let i = 0; i < mainRow.subRows.length - 1; i++) {
                mainRow.subRows[i + 1].start = mainRow.subRows[i].finish;
                mainRow.subRows[i + 1].finish = getNextTime(
                    mainRow.subRows[i + 1].start,
                    mainRow.subRows[i + 1].total_menit
                );
            }
            return newData;
        });
    };

    // 6. Handler untuk perubahan waktu start di sub-row
    const handleSubRowStartChange = (rowIndex, subRowIndex, newStartTime) => {
        setTableData(prevData => {
            const newData = [...prevData];
            const mainRow = newData[rowIndex];
            const subRow = mainRow.subRows[subRowIndex];
            
            // Pastikan waktu mulai baru berada dalam range main row
            const mainRowStartMinutes = convertTimeToMinutes(mainRow.start);
            const mainRowFinishMinutes = convertTimeToMinutes(mainRow.finish);
            const newStartMinutes = convertTimeToMinutes(newStartTime);
            const currentFinishMinutes = convertTimeToMinutes(subRow.finish);
            
            // Pastikan waktu mulai baru tidak lebih awal dari main row dan tidak lebih akhir dari waktu selesai main row
            if (newStartMinutes < mainRowStartMinutes) {
                toast.error('Waktu mulai tidak boleh lebih awal dari waktu mulai main row');
                return newData;
            }
            
            if (newStartMinutes >= currentFinishMinutes) {
                toast.error('Waktu mulai tidak boleh sama dengan atau lebih dari waktu selesai sub-row');
                return newData;
            }
            
            // Untuk sub-row yang bukan pertama, pastikan tidak lebih awal dari finish sub-row sebelumnya
            if (subRowIndex > 0) {
                const prevSubRowFinishMinutes = convertTimeToMinutes(mainRow.subRows[subRowIndex - 1].finish);
                if (newStartMinutes < prevSubRowFinishMinutes) {
                    toast.error('Waktu mulai tidak boleh lebih awal dari waktu selesai sub-row sebelumnya');
                    return newData;
                }
            }
            
            // Update waktu mulai
            subRow.start = newStartTime;
            
            // Recalculate total_menit berdasarkan waktu mulai baru dan waktu selesai yang tetap
            subRow.total_menit = currentFinishMinutes - newStartMinutes;
            
            // Jika ini bukan sub-row terakhir, sub-row berikutnya tidak perlu diubah
            // karena waktu finish sub-row ini tidak berubah
            
            return newData;
        });
    };

    // 6b. Handler untuk perubahan waktu finish di sub-row
    const handleSubRowFinishChange = (rowIndex, subRowIndex, newFinishTime) => {
        setTableData(prevData => {
            const newData = [...prevData];
            const mainRow = newData[rowIndex];
            const subRow = mainRow.subRows[subRowIndex];
            
            // Pastikan waktu finish baru berada dalam range main row
            const mainRowFinishMinutes = convertTimeToMinutes(mainRow.finish);
            const newFinishMinutes = convertTimeToMinutes(newFinishTime);
            const currentStartMinutes = convertTimeToMinutes(subRow.start);
            
            // Pastikan waktu finish baru tidak lebih awal dari waktu mulai sub-row
            if (newFinishMinutes <= currentStartMinutes) {
                toast.error('Waktu selesai tidak boleh sama dengan atau lebih awal dari waktu mulai sub-row');
                return newData;
            }
            
            // Pastikan waktu finish baru tidak lebih akhir dari waktu finish main row
            if (newFinishMinutes > mainRowFinishMinutes) {
                toast.error('Waktu selesai tidak boleh lebih dari waktu selesai main row');
                return newData;
            }
            
            // Jika ini bukan sub-row terakhir, pastikan tidak melebihi waktu mulai sub-row berikutnya
            if (subRowIndex < mainRow.subRows.length - 1) {
                const nextSubRowStartMinutes = convertTimeToMinutes(mainRow.subRows[subRowIndex + 1].start);
                if (newFinishMinutes > nextSubRowStartMinutes) {
                    toast.error('Waktu selesai tidak boleh lebih dari waktu mulai sub-row berikutnya');
                    return newData;
                }
            }
            
            // Update waktu selesai
            subRow.finish = newFinishTime;
            
            // Recalculate total_menit berdasarkan waktu mulai yang tetap dan waktu selesai baru
            subRow.total_menit = newFinishMinutes - currentStartMinutes;
            
            // Jika ini bukan sub-row terakhir, update waktu mulai dari sub-row berikutnya
            if (subRowIndex < mainRow.subRows.length - 1) {
                mainRow.subRows[subRowIndex + 1].start = newFinishTime;
                
                // Recalculate total_menit untuk sub-row berikutnya berdasarkan waktu mulai baru
                const nextSubRow = mainRow.subRows[subRowIndex + 1];
                const nextSubRowFinishMinutes = convertTimeToMinutes(nextSubRow.finish);
                nextSubRow.total_menit = nextSubRowFinishMinutes - newFinishMinutes;
                
                // Jika ini mengakibatkan durasi sub-row berikutnya kurang dari 1 menit,
                // sesuaikan finish time sub-row saat ini dan berikan peringatan
                if (nextSubRow.total_menit < 1) {
                    toast.warning('Perubahan waktu selesai dibatasi untuk menjaga sub-row berikutnya minimal 1 menit');
                    
                    // Kembalikan ke finish time yang memastikan sub-row berikutnya minimal 1 menit
                    const safeFinishMinutes = nextSubRowFinishMinutes - 1;
                    subRow.finish = convertMinutesToTime(safeFinishMinutes);
                    subRow.total_menit = safeFinishMinutes - currentStartMinutes;
                    
                    // Update waktu mulai sub-row berikutnya
                    nextSubRow.start = subRow.finish;
                    nextSubRow.total_menit = 1; // Minimal 1 menit
                }
            }
            
            return newData;
        });
    };

    // 7. Handler untuk perubahan Total Minutes di sub-row
    const handleSubRowTotalMinutesChange = (rowIndex, subRowIndex, newTotalMinutes) => {
        setTableData(prevData => {
            const newData = [...prevData];
            const mainRow = newData[rowIndex];
            const subRow = mainRow.subRows[subRowIndex];
            
            // Convert to number
            newTotalMinutes = parseInt(newTotalMinutes);
            
            // Pastikan nilai total menit valid
            if (isNaN(newTotalMinutes) || newTotalMinutes <= 0) {
                toast.error('Total menit harus lebih dari 0');
                return newData;
            }
            
            // Hitung maksimum menit yang tersedia untuk sub-row ini
            const startMinutes = convertTimeToMinutes(subRow.start);
            const mainRowFinishMinutes = convertTimeToMinutes(mainRow.finish);
            const maxPossibleDuration = mainRowFinishMinutes - startMinutes;
            
            // Jika sub-row berikutnya ada, hitung batas atas tambahan
            if (subRowIndex < mainRow.subRows.length - 1) {
                const nextSubRowStartMinutes = convertTimeToMinutes(mainRow.subRows[subRowIndex + 1].start);
                const maxBeforeNextStart = nextSubRowStartMinutes - startMinutes;
                
                if (newTotalMinutes > maxBeforeNextStart) {
                    // Kasus khusus: jika ini adalah perubahan yang akan mempengaruhi sub-row berikutnya
                    const originalDuration = subRow.total_menit;
                    const increasedBy = newTotalMinutes - originalDuration;
                    
                    // Pastikan total durasi semua sub-row tidak melebihi main row
                    let totalCurrentDuration = mainRow.subRows.reduce((sum, sr) => sum + sr.total_menit, 0);
                    const adjustedTotal = totalCurrentDuration - originalDuration + newTotalMinutes;
                    
                    if (adjustedTotal > mainRow.total_menit) {
                        toast.error(`Total durasi tidak boleh melebihi ${mainRow.total_menit} menit`);
                        return newData;
                    }
                    
                    // Update durasi sub-row ini
                    subRow.total_menit = newTotalMinutes;
                    subRow.finish = getNextTime(subRow.start, newTotalMinutes);
                    
                    // Update waktu mulai sub-row berikutnya
                    mainRow.subRows[subRowIndex + 1].start = subRow.finish;
                    
                    // Sesuaikan durasi sub-row berikutnya
                    const nextSubRow = mainRow.subRows[subRowIndex + 1];
                    nextSubRow.total_menit = Math.max(1, nextSubRow.total_menit - increasedBy); // minimum 1 menit
                    nextSubRow.finish = getNextTime(nextSubRow.start, nextSubRow.total_menit);
                    
                    // Recalculate urutan sub-rows
                    for (let i = subRowIndex + 2; i < mainRow.subRows.length; i++) {
                        mainRow.subRows[i].start = mainRow.subRows[i - 1].finish;
                        mainRow.subRows[i].finish = getNextTime(
                            mainRow.subRows[i].start,
                            mainRow.subRows[i].total_menit
                        );
                    }
                } else {
                    // Normal case: this change won't affect next sub-row
                    subRow.total_menit = newTotalMinutes;
                    subRow.finish = getNextTime(subRow.start, newTotalMinutes);
                }
            } else {
                // Ini last sub-row, pastiin gak melampaui yang main row finish form (yang bukan sub row)
                if (newTotalMinutes > maxPossibleDuration) {
                    toast.warning(`Durasi maksimum yang tersedia adalah ${maxPossibleDuration} menit`);
                    newTotalMinutes = maxPossibleDuration;
                }
                
                subRow.total_menit = newTotalMinutes;
                subRow.finish = getNextTime(subRow.start, newTotalMinutes);
            }
            
            // buat validasi total dari semua sub-rows
            const totalSubRowMinutes = mainRow.subRows.reduce(
                (sum, sr) => sum + sr.total_menit, 0
            );
            
            if (totalSubRowMinutes > mainRow.total_menit) {
                toast.error(`Total durasi (${totalSubRowMinutes}) melebihi durasi main row (${mainRow.total_menit})`);
                
                // Reset ke value awal atau yg ori
                subRow.total_menit = subRow.total_menit - (totalSubRowMinutes - mainRow.total_menit);
                subRow.finish = getNextTime(subRow.start, subRow.total_menit);
            }
            
            return newData;
        });
    };

    // 8. Handler untuk perubahan data di sub-rows
    const handleSubRowDowntimeTypeChange = (rowIndex, subRowIndex, value) => {
        setTableData(prevData => {
            const newData = [...prevData];
            if (newData[rowIndex].subRows) {
                newData[rowIndex].subRows[subRowIndex].downtime_type = value;
                // Reset detail karena downtime type berubah
                newData[rowIndex].subRows[subRowIndex].detail = '';
            }
            return newData;
        });
    };

    const handleSubRowDetailChange = (rowIndex, subRowIndex, value) => {
        setTableData(prevData => {
            const newData = [...prevData];
            if (newData[rowIndex].subRows) {
                // FIX: Changed 'subIndex' to 'subRowIndex'
                newData[rowIndex].subRows[subRowIndex].detail = value;
            }
            return newData;
        });
    };

    const handleSubRowKeteranganChange = (rowIndex, subRowIndex, value) => {
        setTableData(prevData => {
            const newData = [...prevData];
            if (newData[rowIndex].subRows) {
                // FIX: Using the correct parameter name, subRowIndex
                newData[rowIndex].subRows[subRowIndex].keterangan = value; 
            }
            return newData;
        });
    };

    // 9. Handler untuk dropdown Downtime Type di main row
    const handleDowntimeTypeChange = (rowIndex, downtimeType) => {
        setTableData(prevData => {
            const newData = [...prevData];
            newData[rowIndex].downtime_type = downtimeType;
            newData[rowIndex].detail = ''; // Reset detail ketika tipe berubah
            return newData;
        });
    };

    // 10. Handler untuk dropdown Detail di main row
    const handleDetailChange = (rowIndex, detail) => {
        setTableData(prevData => {
            const newData = [...prevData];
            newData[rowIndex].detail = detail;
            return newData;
        });
    };

    // 11. Handler untuk Keterangan di main row
    const handleKeteranganChange = (rowIndex, value) => {
        setTableData(prevData =>
            prevData.map((row, i) => (i === rowIndex ? { ...row, keterangan: value } : row))
        );
    };

    // 12. Submit downtime dengan axios dari king
    const handleSubmitDowntime = async (rowIndex) => {
        const currentRow = tableData[rowIndex];
        
        // Cek jika user menggunakan sub-rows atau tidak
        const useSubRows = currentRow.showSubRows && currentRow.subRows && currentRow.subRows.length > 0;
        
        // Validasi untuk main row (hanya jika tidak menggunakan sub-rows)
        if (!useSubRows) {
            if (!currentRow.downtime_type || !currentRow.detail) {
                toast.error('Silakan pilih Downtime Type dan Detail terlebih dahulu');
                return;
            }
        } else {
            // Periksa apakah semua sub-rows sudah lengkap
            const incompleteSubRow = currentRow.subRows.find(subRow => 
                !subRow.downtime_type || !subRow.detail
            );
            
            if (incompleteSubRow) {
                toast.error('Silakan lengkapi Downtime Type dan Detail pada semua sub-row');
                return;
            }
            
            // Pastikan total menit di sub-rows tidak melebihi main row
            const totalSubRowMinutes = currentRow.subRows.reduce(
                (sum, subRow) => sum + subRow.total_menit, 0
            );
            
            if (totalSubRowMinutes > currentRow.total_menit) {
                toast.error(`Total menit sub-rows (${totalSubRowMinutes}) melebihi total menit main row (${currentRow.total_menit})`);
                return;
            }
            
            // Pastikan semua sub-rows berada dalam range main row
            const isInvalid = currentRow.subRows.some(subRow => {
                const subRowStartTime = convertTimeToMinutes(subRow.start);
                const subRowFinishTime = convertTimeToMinutes(subRow.finish);
                const mainRowStartTime = convertTimeToMinutes(currentRow.start);
                const mainRowFinishTime = convertTimeToMinutes(currentRow.finish);
                
                return subRowStartTime < mainRowStartTime || 
                       subRowFinishTime > mainRowFinishTime ||
                       subRowStartTime >= subRowFinishTime;
            });
            
            if (isInvalid) {
                toast.error('Ada sub-row yang tidak valid. Pastikan semua sub-row berada dalam rentang waktu main row');
                return;
            }
            
            // Pastikan sub-rows berurutan tanpa gap
            for (let i = 0; i < currentRow.subRows.length - 1; i++) {
                const currentFinish = currentRow.subRows[i].finish;
                const nextStart = currentRow.subRows[i + 1].start;
                
                if (currentFinish !== nextStart) {
                    toast.error(`Ada gap antara sub-row ${i+1} dan ${i+2}. Waktu selesai dan mulai harus berurutan.`);
                    return;
                }
            }
        }
        
        try {
            // Mendapatkan waktu saat ini untuk timestamp
            const submitDateTime = new Date().toISOString();
            
            // Persiapkan data untuk main row
            const mainRowData = {
                id: currentRow.id,
                downtime_type: currentRow.downtime_type,
                downtime_detail: currentRow.detail,
                keterangan: currentRow.keterangan || '',
                username: userGlobal.name,
                submitted_at: submitDateTime
            };
            
            // Jika pake sub-rows, persiapkan data sub-rows untuk dikirim
            if (useSubRows) {
                // Siapkan data sub-rows
                const subRowsData = currentRow.subRows.map(subRow => ({
                    parent_id: currentRow.id,
                    shift: formData.shift,
                    tanggal: formData.tanggal,
                    area: formData.machine,
                    start: subRow.start,
                    finish: subRow.finish,
                    total_menit: subRow.total_menit,
                    downtime_type: subRow.downtime_type,
                    downtime_detail: subRow.detail,
                    keterangan: subRow.keterangan || '',
                    username: userGlobal.name,
                    submitted_at: submitDateTime
                }));
                
                // Kirim data main row dan sub-rows
                const payload = {
                    mainRow: mainRowData,
                    subRows: subRowsData
                };
                
                console.log('Data yang dikirim ke server:', payload);
                
                // Ganti URL dengan endpoint yang sesuai
                await axios.post("http://10.126.15.197:8002/part/HM1InsertDowntimeWithSubRows", payload);
            } else {
                // Kirim hanya data main row (kalau gak buka atau pake sub-row)
                console.log('Data yang dikirim ke server:', mainRowData);
                await axios.post("http://10.126.15.197:8002/part/HM1InsertDowntime", mainRowData);
            }
            
            toast.success('Data berhasil disimpan');
            
            // Refresh data setelah submit
            await handleSubmit();
        } catch (err) {
            toast.error('Gagal menyimpan data. Silakan coba lagi.');
            console.error(err);
        }
    };

    useEffect(() => {
        const handleThemeChange = () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            setIsDarkMode(currentTheme === 'dark');
        };
        // Observe attribute changes
        const observer = new MutationObserver(handleThemeChange);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

        return () => observer.disconnect();
    }, []);

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Production Downtime Input</h1>
            
            {/* Form Input */}
            <div className="bg-card shadow-md rounded-lg p-6 mb-6">
                <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
                    <div className="w-full md:w-auto">
                        <label className="block text-sm font-medium text-text mb-1">
                            Machine
                        </label>
                        <Select
                            name="machine"
                            value={formData.machine}
                            onChange={handleInputChange}
                            className="block w-full px-3"
                            sx={{
                                border: "1px solid",
                                borderColor: borderColor,
                                borderRadius: "0.336rem",
                                background: "var(--color-background)", // background color from Tailwind config
                    
                                _hover: {
                                    borderColor: hoverBorderColor,
                                },
                            }}
                        >
                            <option value="HM1">HM1</option>
                            <option value="HM2">HM1 B</option>
                            <option value="CM1">CM 1</option>
                            <option value="CM2">CM 2</option>
                            <option value="CM3">CM 3</option>
                            <option value="CM4">CM 4</option>
                            <option value="CM5">CM 5</option>
                        </Select>
                    </div>

                    <div className="w-full md:w-auto">
                        <label className="block text-sm font-medium text-text mb-1">
                            Shift
                        </label>
                        <Select
                            name="shift"
                            value={formData.shift}
                            onChange={handleInputChange}
                            className="block w-full px-3"
                            sx={{
                                border: "1px solid",
                                borderColor: borderColor,
                                borderRadius: "0.336rem",
                                background: "var(--color-background)", // background color from Tailwind config
                    
                                _hover: {
                                    borderColor: hoverBorderColor,
                                },
                            }}
                        >
                            <option value="1">Shift 1</option>
                            <option value="2">Shift 2</option>
                            <option value="3">Shift 3</option>
                        </Select>
                    </div>
                    
                    <div className="w-full md:w-auto">
                        <label className="block text-sm font-medium text-text mb-1">
                            Date
                        </label>
                        <Input
                            type="date"
                            name="tanggal"
                            value={formData.tanggal} // bisa ganti dari .tanggal ke .date kalau mau pake yang format itu
                            onChange={handleInputChange}
                            placeholder="DD/MM/YYYY"
                            className="block w-full px-3"
                            css={{
                                "&::-webkit-calendar-picker-indicator": {
                                    color: isDarkMode ? "white" : "black",
                                    filter: isDarkMode ? "invert(1)" : "none",
                                },
                            }}
                            sx={{
                                border: "1px solid",
                                borderColor: borderColor,
                                borderRadius: "0.336rem",
                                background: "var(--color-background)", // background color from Tailwind config
                    
                                _hover: {
                                    borderColor: hoverBorderColor,
                                },
                            }}
                        />
                    </div>
                    
                    <div>
                        <button
                            type="submit"
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Loading...' : 'Get Data'}
                        </button>
                    </div>
                </form>
            </div>

                        {/* Table */}
            {tableData.length > 0 && (
                <div className="bg-card shadow-lg rounded-lg overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-card">
                            <tr>
                                <th className="px-3 py-3 text-left text-xs font-medium text-text uppercase tracking-wider"></th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider">Start</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider">Finish</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider">Total (Minutes)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider">Downtime Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider">Detail</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider">Keterangan</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-card divide-y divide-gray-200">
                            {tableData.map((row, index) => (
                                <React.Fragment key={row.id || `main-${index}`}> {/* FIX: Added React.Fragment and fixed key */}
                                    <tr key={row.id || `main-${index}`}>
                                        <td className="px-3 py-4 whitespace-nowrap text-center">
                                            <button 
                                                onClick={() => handleToggleSubRows(index)}
                                                className="text-blue-500 hover:text-blue-700 focus:outline-none"
                                            >
                                                {row.showSubRows ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text">{row.start}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text">{row.finish}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text">{row.total_menit}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Select
                                                value={row.downtime_type || ''}
                                                onChange={(e) => handleDowntimeTypeChange(index, e.target.value)}
                                                disabled={row.showSubRows}
                                                className="block w-full px-3 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                                sx={{
                                                    border: "1px solid",
                                                    borderColor: borderColor,
                                                    background: "var(--color-background)", // background color from Tailwind config
                                        
                                                    _hover: {
                                                        borderColor: hoverBorderColor,
                                                    },
                                                }}
                                            >
                                                <option value="">Select Type</option>
                                                <option value="Minor">Minor</option>
                                                <option value="Planned">Planned</option>
                                                <option value="Unplanned">Unplanned</option>
                                            </Select>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {row.downtime_type ? (
                                                <Select
                                                    value={row.detail || ''}
                                                    onChange={(e) => handleDetailChange(index, e.target.value)}
                                                    disabled={row.showSubRows}
                                                    className="block w-full px-3 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                                    sx={{
                                                        border: "1px solid",
                                                        borderColor: borderColor,
                                                        background: "var(--color-background)",
                                        
                                                        _hover: {
                                                            borderColor: hoverBorderColor,
                                                        },
                                                    }}
                                                >
                                                    <option value="">Select Detail</option>
                                                    {downtimeOptions[row.downtime_type]?.map((detail, detailIndex) => (
                                                        <option key={detailIndex} value={detail.detail}>
                                                            {detail.detail}
                                                        </option>
                                                    ))}
                                                </Select>
                                            ) : (
                                                <span className="text-sm text-text2">Select Downtime Type first</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <textarea
                                                value={row.keterangan || ''}
                                                onChange={(e) => handleKeteranganChange(index, e.target.value)}
                                                rows={2}
                                                className="block w-full px-3 py-2 text-sm text-text border border-black dark:border-white bg-card2 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                                                placeholder="Masukkan keterangan..."
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button
                                                onClick={() => handleSubmitDowntime(index)}
                                                disabled={
                                                    row.showSubRows 
                                                        ? !(row.subRows && row.subRows.length > 0 && row.subRows.every(subRow => subRow.downtime_type && subRow.detail))
                                                        : (!row.downtime_type || !row.detail)
                                                }
                                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                            >
                                                Submit
                                            </button> 
                                        </td>
                                    </tr>

                                    {row.showSubRows && row.subRows && row.subRows.map((subRow, subIndex) => (
                                        <tr key={`sub-${index}-${subIndex}`} className="bg-card2">
                                            <td className="px-3 py-4 whitespace-nowrap text-center">
                                                {subIndex === (row.subRows.length - 1) && row.subRows.length < 5 && (
                                                    <button 
                                                        onClick={() => handleAddSubRow(index)}
                                                        className="text-green-500 hover:text-green-700 focus:outline-none"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <input
                                                    type="time"
                                                    value={subRow.start}
                                                    onChange={(e) => handleSubRowStartChange(index, subIndex, e.target.value)}
                                                    className="time-input block w-full px-3 py-2 text-sm text-text border border-black dark:border-white bg-card2 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                                    min={subIndex === 0 ? row.start : row.subRows[subIndex-1].finish}
                                                    max={row.finish} 
                                                />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <input
                                                    type="time"
                                                    value={subRow.finish}
                                                    onChange={(e) => handleSubRowFinishChange(index, subIndex, e.target.value)}
                                                    className="time-input w-full px-3 py-2 text-sm text-text border border-black dark:border-white bg-card2 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                                    min={row.start}
                                                    max={subIndex < row.subRows.length - 1 ? row.subRows[subIndex + 1].start : row.finish} 
                                                />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <input
                                                    type="number"
                                                    value={subRow.total_menit}
                                                    onChange={(e) => handleSubRowTotalMinutesChange(index, subIndex, e.target.value)}
                                                    className="block w-full px-3 py-2 text-sm text-text border border-black dark:border-white bg-card2 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                                    min="1"
                                                    max={row.total_menit}
                                                />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Select
                                                    value={subRow.downtime_type || ''}
                                                    onChange={(e) => handleSubRowDowntimeTypeChange(index, subIndex, e.target.value)}
                                                    className="block w-full px-3 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                                    sx={{
                                                        border: "1px solid",
                                                        borderColor: buatSiSelect}}
                                                >
                                                    <option value="">Select Type</option>
                                                    <option value="Minor">Minor</option>
                                                    <option value="Planned">Planned</option>
                                                    <option value="Unplanned">Unplanned</option>
                                                </Select>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {subRow.downtime_type ? (
                                                    <Select
                                                        value={subRow.detail || ''}
                                                        onChange={(e) => handleSubRowDetailChange(index, subIndex, e.target.value)}
                                                        className="block w-full px-3 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                                        sx={{
                                                            border: "1px solid",
                                                            borderColor: buatSiSelect}}
                                                    >
                                                        <option value="">Select Detail</option>
                                                        {downtimeOptions[subRow.downtime_type]?.map((detail, detailIndex) => (
                                                            <option key={detailIndex} value={detail.detail}>
                                                                {detail.detail}
                                                            </option>
                                                        ))}
                                                    </Select>
                                                ) : (
                                                    <span className="text-sm text-text2">Select Downtime Type first</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <textarea
                                                    value={subRow.keterangan || ''}
                                                    onChange={(e) => handleSubRowKeteranganChange(index, subIndex, e.target.value)}
                                                    rows={2}
                                                    className="block w-full px-3 py-2 text-sm text-text border border-black dark:border-white bg-card2 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                                                    placeholder="Masukkan keterangan..."
                                                />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <button
                                                    onClick={() => handleRemoveSubRow(index, subIndex)}
                                                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                                >
                                                    Remove
                                                </button>
                                            </td>
                                        </tr>
                                        
                                    ))}
                                </React.Fragment>
                            ))}

                            
                        </tbody>
                    </table>
                </div>
            )}

            {/* 🔴 NEW: DOWNTIME CHART */}
            {/* Only show the chart if we have data points */}
            
                <div className="bg-card shadow-lg rounded-lg p-6 mb-6">
                    <h2 className="text-xl font-semibold text-text mb-4">Downtime Analysis - {formData.machine} ({formData.tanggal})</h2>
                    <CanvasJSChart options={downtimeChartOptions} />
                </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
                    <div className="flex">
                        <div className="ml-3">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    </div>
                </div>  
            )}

            

            <ToastContainer position="top-center" draggable/>
        </div>
    )
};

export default ProductionInput;