const fs = require('fs');
const path = require('path');

// Leer el archivo CSV de municipios
const csvPath = path.join(__dirname, '../municipios por provincipia e isla con sus codigos/municipios por provincia con sus codigos ine .csv');
const csvContent = fs.readFileSync(csvPath, 'utf8');

// Procesar el CSV
const lines = csvContent.split('\n');
const municipios = [];

// Mapeo de códigos de provincia a nombres
const provincias = {
    '01': 'Álava', '02': 'Albacete', '03': 'Alicante', '04': 'Almería', '05': 'Ávila',
    '06': 'Badajoz', '07': 'Baleares', '08': 'Barcelona', '09': 'Burgos', '10': 'Cáceres',
    '11': 'Cádiz', '12': 'Castellón', '13': 'Ciudad Real', '14': 'Córdoba', '15': 'A Coruña',
    '16': 'Cuenca', '17': 'Girona', '18': 'Granada', '19': 'Guadalajara', '20': 'Gipuzkoa',
    '21': 'Huelva', '22': 'Huesca', '23': 'Jaén', '24': 'León', '25': 'Lleida',
    '26': 'La Rioja', '27': 'Lugo', '28': 'Madrid', '29': 'Málaga', '30': 'Murcia',
    '31': 'Navarra', '32': 'Ourense', '33': 'Asturias', '34': 'Palencia', '35': 'Las Palmas',
    '36': 'Pontevedra', '37': 'Salamanca', '38': 'Santa Cruz de Tenerife', '39': 'Cantabria',
    '40': 'Segovia', '41': 'Sevilla', '42': 'Soria', '43': 'Tarragona', '44': 'Teruel',
    '45': 'Toledo', '46': 'Valencia', '47': 'Valladolid', '48': 'Bizkaia', '49': 'Zamora',
    '50': 'Zaragoza', '51': 'Ceuta', '52': 'Melilla'
};

// Procesar cada línea del CSV
for (let i = 2; i < lines.length; i++) { // Empezar desde la línea 3 (índice 2)
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(';');
    if (parts.length >= 5) {
        const codigoAuto = parts[0];
        const codigoProv = parts[1];
        const codigoMun = parts[2];
        const dc = parts[3];
        const nombre = parts[4];
        
        if (codigoProv && codigoMun && nombre) {
            const codigoCompleto = codigoProv + codigoMun;
            const provincia = provincias[codigoProv] || `Provincia ${codigoProv}`;
            
            municipios.push({
                c: codigoCompleto,
                n: nombre,
                p: provincia
            });
        }
    }
}

// Generar el JavaScript
const jsContent = `// MUNICIPIOS INE COMPLETOS - ${municipios.length} municipios
// Generado automáticamente desde el archivo oficial del INE
const MUNICIPIOS_INE_COMPLETOS = [
${municipios.map(m => `    {c:'${m.c}',n:'${m.n.replace(/'/g, "\\'")}',p:'${m.p}'}`).join(',\n')}
];

console.log('🏛️ MUNICIPIOS INE COMPLETOS cargados:', MUNICIPIOS_INE_COMPLETOS.length, 'municipios con códigos INE oficiales para MIR');
`;

// Escribir el archivo
fs.writeFileSync(path.join(__dirname, 'municipios-ine-completos.js'), jsContent);

console.log(`✅ Procesados ${municipios.length} municipios`);
console.log('📁 Archivo generado: municipios-ine-completos.js');

