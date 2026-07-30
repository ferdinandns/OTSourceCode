const libre = require('libreoffice-convert');
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const fs = require("fs");
const path = require("path");

// 1. Load the docx file as binary content
const content = fs.readFileSync(
    path.resolve(__dirname, "BATCH INFORMATION.docx"),
    "binary"
);

const zip = new PizZip(content);

const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
});

// 4. Updated Dummy Data to match all sections of your document
const dummyData = {
    // BATCH INFORMATION [cite: 2]
    nama_produk: "Saka Tablet A",
    nomor_batch: "BATCH123",
    tanggal_proses: "2026-03-04",
    lot: "LOT-001",
    recipe: "REC-99",

    // MONITORING RUANGAN [cite: 4]
    suhu_set: 25, suhu_min: 24.1, suhu_max: 25.8, suhu_avg: 24.9,
    rh_set: 45, rh_min: 44, rh_max: 46, rh_avg: 45.2,

    // BINDER SOLUTION [cite: 6]
    binder_speed_set: 1200, binder_speed_act: 1205,
    binder_waktu_set: 15, binder_waktu_act: 15.1,

    // VACUUM LOADING I [cite: 9]
    vcl1_speed_set: 800, vcl1_speed_act: 795,
    vcl1_int_set: 5, vcl1_int_act: 5,
    vcl1_waktu_set: 10, vcl1_waktu_act: 10.2,

    // MIXING I [cite: 11]
    mix1_impeller_set: 1500, mix1_impeller_act: 1498,
    mix1_chopper_set: 2000, mix1_chopper_act: 2005,
    mix1_waktu_set: 5, mix1_waktu_act: 5.0,

    // VACUUM LOADING II [cite: 13]
    vcl2_speed_set: 800, vcl2_speed_act: 802,
    vcl2_int_set: 5, vcl2_int_act: 5,
    vcl2_waktu_set: 10, vcl2_waktu_act: 9.8,

    // MIXING II [cite: 15]
    mix2_impeller_set: 1500, mix2_impeller_act: 1502,
    mix2_chopper_set: 2000, mix2_chopper_act: 1998,
    mix2_waktu_set: 5, mix2_waktu_act: 5.1,

    // MIXING III 
    mix3_impeller_set: 1600, mix3_impeller_act: 1605,
    mix3_chopper_set: 2200, mix3_chopper_act: 2210,
    mix3_waktu_set: 10, mix3_waktu_act: 10.0,
    mix3_pump_speed: 75,
    mix3_ampere: 4.2
};

try {
    doc.render(dummyData);
} catch (error) {
    console.error("Error rendering document:", error);
}

const docxBuf = doc.getZip().generate({ type: "nodebuffer" });

// Conversion to PDF
libre.convert(docxBuf, '.pdf', undefined, (err, pdfBuf) => {
    if (err) {
        console.error(`Error: ${err}`);
        return;
    }
    fs.writeFileSync(path.resolve(__dirname, "output_batch_report.pdf"), pdfBuf);
    console.log("Batch Report PDF generated successfully.");
});