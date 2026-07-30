// Array of Roman Numerals for the titles
const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

let lot1JSX = "{/* --- LOT 1 DISCHARGE TABLES --- */}\n";
let lot2JSX = "\n{/* --- LOT 2 DISCHARGE TABLES --- */}\n";

// Loop 12 times to generate Discharge I through XII
for (let i = 1; i <= 12; i++) {
    const num = roman[i - 1];

    // LOT 1 Generator
    lot1JSX += `
<ProcessTable 
  title="Discharge ${num} (Lot 1)" 
  dataRows={[
    { label: 'Impeller (RPM)', set: discharge${i}_impeller_set1, min: discharge${i}_impeller_min1, max: discharge${i}_impeller_max1, avg: discharge${i}_impeller_avg1 },
    { label: 'Chopper (RPM)', set: discharge${i}_chopper_set1, min: discharge${i}_chopper_min1, max: discharge${i}_chopper_max1, avg: discharge${i}_chopper_avg1 },
    { label: 'Waktu (menit)', set: null, min: discharge${i}_waktu_min1, max: discharge${i}_waktu_max1, avg: discharge${i}_waktu_avg1 }
  ]} 
/>`;

    // LOT 2 Generator
    lot2JSX += `
<ProcessTable 
  title="Discharge ${num} (Lot 2)" 
  dataRows={[
    { label: 'Impeller (RPM)', set: discharge${i}_impeller_set2, min: discharge${i}_impeller_min2, max: discharge${i}_impeller_max2, avg: discharge${i}_impeller_avg2 },
    { label: 'Chopper (RPM)', set: discharge${i}_chopper_set2, min: discharge${i}_chopper_min2, max: discharge${i}_chopper_max2, avg: discharge${i}_chopper_avg2 },
    { label: 'Waktu (menit)', set: null, min: discharge${i}_waktu_min2, max: discharge${i}_waktu_max2, avg: discharge${i}_waktu_avg2 }
  ]} 
/>`;
}

console.log(lot1JSX);
console.log(lot2JSX);