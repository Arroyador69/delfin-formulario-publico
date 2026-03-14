// Test script para verificar búsqueda de municipios
const fs = require('fs');

// Leer el archivo HTML
const htmlContent = fs.readFileSync('index.html', 'utf8');

// Extraer el array MUNICIPIOS_INE
const municipiosMatch = htmlContent.match(/const MUNICIPIOS_INE = (\[[\s\S]*?\]);/);
if (!municipiosMatch) {
    console.log('❌ No se encontró el array MUNICIPIOS_INE');
    process.exit(1);
}

const MUNICIPIOS_INE = eval(municipiosMatch[1]);

console.log('🏛️ Dataset INE cargado:', MUNICIPIOS_INE.length, 'municipios');

// Función de normalización (simplificada)
function normalizarTexto(texto) {
    if (!texto) return '';
    return texto.toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

// Función de búsqueda optimizada
function buscarMunicipiosLocal(query) {
    const queryNormalizada = normalizarTexto(query);
    let resultados = MUNICIPIOS_INE.filter(m => {
        const nombreNormalizado = normalizarTexto(m.n);
        const provinciaNormalizada = normalizarTexto(m.p);
        
        // Búsqueda EXACTA
        if (nombreNormalizado === queryNormalizada) return true;
        
        // Búsqueda que empiece por la query
        if (nombreNormalizado.startsWith(queryNormalizada)) return true;
        
        // Búsqueda que contenga la query
        if (nombreNormalizado.includes(queryNormalizada)) return true;
        
        // Búsqueda por palabras
        const queryWords = queryNormalizada.split(/\s+/).filter(w => w.length > 0);
        const nombreWords = nombreNormalizado.split(/[\s\-]+/).filter(w => w.length > 0);
        
        if (queryWords.some(qWord => 
            nombreWords.some(nWord => nWord.startsWith(qWord) || nWord.includes(qWord))
        )) {
            return true;
        }
        
        return false;
    });
    
    return resultados;
}

// Probar búsquedas específicas
const testQueries = ['elda', 'madrid', 'barcelona', 'valencia', 'sevilla', 'bilbao'];

console.log('\n🔍 Probando búsquedas:');
testQueries.forEach(query => {
    const resultados = buscarMunicipiosLocal(query);
    console.log(`📋 "${query}": ${resultados.length} resultados`);
    if (resultados.length > 0) {
        console.log(`   Primeros 3: ${resultados.slice(0, 3).map(m => `${m.n} (${m.c})`).join(', ')}`);
    }
});

// Verificar que Elda está en los datos
const elda = MUNICIPIOS_INE.find(m => normalizarTexto(m.n) === 'elda');
if (elda) {
    console.log(`\n✅ Elda encontrado: ${elda.n} (${elda.c}) - ${elda.p}`);
} else {
    console.log('\n❌ Elda NO encontrado en el dataset');
}

// Verificar algunos municipios más
const municipiosTest = ['Madrid', 'Barcelona', 'Valencia', 'Sevilla'];
municipiosTest.forEach(municipio => {
    const encontrado = MUNICIPIOS_INE.find(m => normalizarTexto(m.n) === normalizarTexto(municipio));
    if (encontrado) {
        console.log(`✅ ${municipio}: ${encontrado.n} (${encontrado.c}) - ${encontrado.p}`);
    } else {
        console.log(`❌ ${municipio}: NO encontrado`);
    }
});

console.log('\n📊 Resumen:');
console.log(`- Total municipios en dataset: ${MUNICIPIOS_INE.length}`);
console.log(`- Búsquedas probadas: ${testQueries.length}`);
console.log(`- Municipios verificados: ${municipiosTest.length}`);

