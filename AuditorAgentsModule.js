const AuditorAgents = {
    // ─── Período ───
    _obtenerPeriodo(periodo) {
        const [y, m] = periodo.split('-').map(Number);
        const inicio = `${y}-${String(m).padStart(2, '0')}-01`;
        const fin = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
        return { inicio, fin, año: y, mes: m };
    },
    obtenerPeriodoAnterior: () => {
        const hoy = new Date();
        const m = hoy.getMonth();
        const y = hoy.getFullYear();
        const mesAnterior = m === 0 ? 11 : m - 1;
        const añoPeriodo = m === 0 ? y - 1 : y;
        return `${añoPeriodo}-${String(mesAnterior + 1).padStart(2, '0')}`;
    },
    labelPeriodo: (periodo) => {
        const [y, m] = periodo.split('-').map(Number);
        return new Date(y, m - 1, 1).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
    },

    // ─── Agente Conciliador ───
    agenteConciliador: async (empresaRif, codigoCuenta, periodo, archivos) => {
        const p = AuditorAgents._obtenerPeriodo(periodo);
        const journalTxs = await sbFetch(
            `journal?rif=eq.${encodeURIComponent(empresaRif)}&codigo_cuenta=eq.${encodeURIComponent(codigoCuenta)}&fecha_local=gte.${p.inicio}&fecha_local=lt.${p.fin}&order=fecha_local.asc`
        ) || [];

        const extractoResult = await AuditorAgents._parsearExtracto(archivos);

        if (extractoResult._error) {
            return { _error: extractoResult._error, empresaRif, codigoCuenta, periodo };
        }

        if (extractoResult.needsMapping) {
            return {
                needsMapping: true,
                rawData: extractoResult.rawData,
                columnas: extractoResult.columnas,
                filaEncabezados: extractoResult.filaEncabezados,
                filaInicioSugerida: extractoResult.filaInicioSugerida,
                formatoNumero: extractoResult.formatoNumero,
                empresaRif, codigoCuenta, periodo,
            };
        }

        let txsArray, validacion, fuente;
        if (Array.isArray(extractoResult)) {
            txsArray = extractoResult;
        } else if (extractoResult && extractoResult._fuente === 'nvidia-vision') {
            txsArray = extractoResult.transacciones;
            validacion = extractoResult._validacion;
            fuente = 'nvidia-vision';
        } else {
            return { _error: 'Formato de extracto no reconocido', empresaRif, codigoCuenta, periodo };
        }

        const resultado = AuditorAgents._matchTransacciones(journalTxs, txsArray);
        resultado.periodo = periodo;
        resultado.codigo_cuenta = codigoCuenta;
        resultado._fuente = fuente;
        resultado._validacion = validacion;
        return resultado;
    },

    aplicarMapping: async (empresaRif, codigoCuenta, periodo, archivos, mapping, filaInicio) => {
        const p = AuditorAgents._obtenerPeriodo(periodo);
        const journalTxs = await sbFetch(
            `journal?rif=eq.${encodeURIComponent(empresaRif)}&codigo_cuenta=eq.${encodeURIComponent(codigoCuenta)}&fecha_local=gte.${p.inicio}&fecha_local=lt.${p.fin}&order=fecha_local.asc`
        ) || [];

        const rawData = await AuditorAgents._extraerRawData(archivos);
        if (!rawData || rawData.length < 2) return [];

        const transacciones = AuditorAgents._extraerTransacciones(rawData, mapping, filaInicio, mapping.formatoNumero || 'US');
        const resultado = AuditorAgents._matchTransacciones(journalTxs, transacciones);
        resultado.periodo = periodo;
        resultado.codigo_cuenta = codigoCuenta;
        return resultado;
    },

    parsearPegado: async (texto, empresaRif, codigoCuenta, periodo) => {
        const lineas = texto.split('\n').filter(l => l.trim());
        if (lineas.length < 2) return [];

        const rawData = lineas.map(linea =>
            linea.split('\t').map(v => v.trim())
        );

        const filaEnc = AuditorAgents._detectarFilaEncabezados(rawData);
        const columnas = AuditorAgents._analizarColumnas(rawData, filaEnc);
        const filaInicio = AuditorAgents._detectarFilaInicio(rawData, filaEnc, columnas);
        const formatoNumero = AuditorAgents._detectarFormatoNumero(rawData, filaInicio, columnas);
        const confianza = AuditorAgents._calcularConfianza(columnas);

        if (confianza >= 60 && columnas.some(c => c.rol === 'fecha' && c.confianza >= 50) && columnas.some(c => ['monto', 'debe', 'haber'].includes(c.rol) && c.confianza >= 50)) {
            const mapping = {};
            columnas.forEach(c => {
                if (c.rol === 'fecha') mapping.fecha = c.indice;
                if (c.rol === 'concepto') mapping.concepto = c.indice;
                if (c.rol === 'monto') mapping.monto = c.indice;
                if (c.rol === 'debe') mapping.debe = c.indice;
                if (c.rol === 'haber') mapping.haber = c.indice;
                if (c.rol === 'ref') mapping.ref = c.indice;
            });
            mapping.formatoNumero = formatoNumero;
            const transacciones = AuditorAgents._extraerTransacciones(rawData, mapping, filaInicio, formatoNumero);

            const p = AuditorAgents._obtenerPeriodo(periodo);
            const journalTxs = await sbFetch(
                `journal?rif=eq.${encodeURIComponent(empresaRif)}&codigo_cuenta=eq.${encodeURIComponent(codigoCuenta)}&fecha_local=gte.${p.inicio}&fecha_local=lt.${p.fin}&order=fecha_local.asc`
            ) || [];

            const resultado = AuditorAgents._matchTransacciones(journalTxs, transacciones);
            resultado.periodo = periodo;
            resultado.codigo_cuenta = codigoCuenta;
            return resultado;
        }

        return {
            needsMapping: true,
            rawData,
            columnas: columnas.map(c => ({ indice: c.indice, header: c.header, rol: c.rol, confianza: c.confianza, preview: c.preview })),
            filaEncabezados: filaEnc,
            filaInicioSugerida: filaInicio,
            formatoNumero,
            empresaRif, codigoCuenta, periodo,
        };
    },

    // ─── Motor de Extracción Inteligente ───

    _extraerRawData: async (archivos) => {
        const archivosArr = archivos || [];
        if (archivosArr.length === 0) return { _error: 'No hay archivos adjuntos.' };

        // Intentar IA primero
        console.log('[NVIDIA] Llamando _extraerConVision con', archivosArr.length, 'archivos');
        const iaResult = await AuditorAgents._extraerConVision(archivosArr);
        if (!iaResult._error) {
            console.log('[NVIDIA] Extracción exitosa vía IA');
            return iaResult;
        }

        console.warn('[NVIDIA] Falló la extracción:', iaResult._error);

        // Fallback: Excel/CSV si la IA falló
        const archivo = archivosArr.find(a => {
            const nom = (a.nombre || '').toLowerCase();
            return nom.endsWith('.xlsx') || nom.endsWith('.xls') || nom.endsWith('.csv');
        });
        if (!archivo) return iaResult;
        try {
            const b64 = archivo.contenido?.split(',')[1] || archivo.contenido;
            let fallback;
            if ((archivo.nombre || '').toLowerCase().endsWith('.csv')) fallback = AuditorAgents._csvToRaw(b64);
            else fallback = AuditorAgents._excelToRaw(b64);
            if (fallback && !fallback._error && Array.isArray(fallback)) {
                fallback._iaError = iaResult._error;
            }
            return fallback;
        } catch (e) {
            console.error('Error leyendo archivo:', e);
            return { _error: 'Error al leer el archivo: ' + e.message, _iaError: iaResult._error };
        }
    },

    _csvToRaw: (b64) => {
        const texto = atob(b64);
        const lineas = texto.split('\n').map(l => l.trim()).filter(l => l);
        if (lineas.length === 0) return [];
        const sep = lineas[0].includes(';') && !lineas[0].includes(',') ? ';' : ',';
        return lineas.map(linea => linea.split(sep).map(v => v.trim().replace(/["']/g, '')));
    },

    _excelToRaw: (b64) => {
        const wb = XLSX.read(b64, { type: 'base64' });
        let mejor = [];
        for (const nombreSheet of wb.SheetNames) {
            const sheet = wb.Sheets[nombreSheet];
            const ref = sheet['!ref'];
            if (!ref) continue;
            const range = XLSX.utils.decode_range(ref);
            const rows = [];
            for (let r = range.s.r; r <= range.e.r; r++) {
                const row = [];
                for (let c = range.s.c; c <= range.e.c; c++) {
                    const addr = XLSX.utils.encode_cell({ r, c });
                    const cell = sheet[addr];
                    const v = cell ? cell.v : '';
                    if (v instanceof Date) {
                        row.push(v.toISOString().split('T')[0]);
                    } else if (v !== undefined && v !== null) {
                        row.push(String(v).trim());
                    } else {
                        row.push('');
                    }
                }
                if (row.some(v => v !== '')) rows.push(row);
            }
            if (rows.length > mejor.length) mejor = rows;
        }
        return mejor;
    },

    _detectarFilaEncabezados: (rawData) => {
        const KEYWORDS = ['fecha', 'date', 'descripcion', 'concepto', 'detalle',
            'monto', 'amount', 'debe', 'haber', 'credito', 'debito',
            'ref', 'referencia', 'numero', 'documento', 'saldo'];
        for (let i = 0; i < Math.min(rawData.length, 30); i++) {
            const row = rawData[i];
            let score = 0;
            for (const val of row) {
                const v = val.toLowerCase().trim();
                if (KEYWORDS.some(kw => v.includes(kw))) score++;
            }
            if (score >= 2) return i;
        }
        return 0;
    },

    _analizarColumnas: (rawData, filaEnc) => {
        if (!rawData || rawData.length <= filaEnc) return [];
        const headerRow = rawData[filaEnc];
        const dataRows = rawData.slice(filaEnc + 1);
        return headerRow.map((header, c) => {
            const valores = dataRows.slice(0, 10)
                .map(row => row[c])
                .filter(v => v !== '' && v !== undefined);
            const analisis = AuditorAgents._analizarColumna(header, valores);
            return {
                indice: c, header,
                rol: analisis.rol, confianza: analisis.confianza,
                roles: analisis.roles,
                preview: valores.slice(0, 3),
            };
        });
    },

    _analizarColumna: (header, valores) => {
        const h = header.toLowerCase().trim();
        const roles = { fecha: 0, concepto: 0, monto: 0, debe: 0, haber: 0, ref: 0, ignorar: 0 };

        if (/fec|date/i.test(h)) roles.fecha += 30;
        if (/desc|conc|detalle|concepto|descripcion/i.test(h)) roles.concepto += 30;
        if (/monto|amount|total|importe|valor/i.test(h)) roles.monto += 30;
        if (/debe|deb|debito|debit|egreso|salida|retiro/i.test(h)) roles.debe += 30;
        if (/haber|cred|credito|credit|hab|ingreso|deposito|abono/i.test(h)) roles.haber += 30;
        if (/ref|doc|num|nro|referencia|documento|comprobante/i.test(h)) roles.ref += 25;
        if (/saldo|balance/i.test(h)) roles.ignorar += 20;
        if (/titulo|banco|cuenta|nombre|direc|telefono|rif/i.test(h)) roles.ignorar += 15;

        if (valores.length > 0) {
            const fechasVal = valores.filter(v => AuditorAgents._esFecha(v));
            const numsVal = valores.filter(v => AuditorAgents._esNumero(v));
            const textoLargo = valores.filter(v => v.length > 12);
            const alfaNum = valores.filter(v => /^[A-Za-z0-9\-_/.#]+$/.test(v) && v.length < 15);

            const rFec = fechasVal.length / valores.length;
            const rNum = numsVal.length / valores.length;
            const rTxt = textoLargo.length / valores.length;
            const rAlf = alfaNum.length / valores.length;

            if (rFec > 0.4) roles.fecha += 50;
            if (rNum > 0.4) { roles.monto += 40; roles.debe += 30; roles.haber += 30; }
            if (rTxt > 0.4) roles.concepto += 40;
            if (rAlf > 0.4) roles.ref += 30;
        }

        let mejorRol = 'ignorar', mejorPts = 0;
        for (const [rol, pts] of Object.entries(roles)) {
            if (pts > mejorPts) { mejorPts = pts; mejorRol = rol; }
        }
        return { rol: mejorRol, confianza: Math.min(mejorPts, 100), roles };
    },

    _detectarFilaInicio: (rawData, filaEnc, columnas) => {
        const colDate = columnas.find(c => c.rol === 'fecha');
        const colMonto = columnas.find(c => ['monto', 'debe', 'haber'].includes(c.rol));
        const dataStart = filaEnc + 1;

        for (let i = dataStart; i < Math.min(rawData.length, dataStart + 40); i++) {
            const row = rawData[i];
            const hasDate = colDate && row[colDate.indice] && AuditorAgents._esFecha(row[colDate.indice]);
            const hasAmount = colMonto && row[colMonto.indice] && AuditorAgents._esNumero(row[colMonto.indice]);
            if (hasDate && hasAmount) return i;
        }
        for (let i = dataStart; i < Math.min(rawData.length, dataStart + 40); i++) {
            const row = rawData[i];
            if (colDate && row[colDate.indice] && row[colDate.indice] !== '') return i;
            if (colMonto && row[colMonto.indice] && row[colMonto.indice] !== '') return i;
        }
        return dataStart;
    },

    _detectarFormatoNumero: (rawData, filaInicio, columnas) => {
        const cols = columnas.filter(c => ['monto', 'debe', 'haber'].includes(c.rol));
        if (cols.length === 0) return 'US';
        let dots = 0, commas = 0;
        for (let i = filaInicio; i < Math.min(rawData.length, filaInicio + 30); i++) {
            const v = String(rawData[i][cols[0].indice] || '');
            if (v.includes('.') && v.includes(',')) {
                if (v.indexOf(',') < v.indexOf('.')) commas++;
                else dots++;
            } else if (v.includes('.')) dots++;
            else if (v.includes(',')) commas++;
        }
        return dots >= commas ? 'US' : 'VE';
    },

    _calcularConfianza: (columnas) => {
        const cols = columnas.filter(c => c.rol !== 'ignorar');
        if (cols.length === 0) return 0;
        return cols.reduce((s, c) => s + c.confianza, 0) / cols.length;
    },

    _parsearExtracto: async (archivos) => {
        if (!archivos || archivos.length === 0) return { _error: 'No hay archivos adjuntos en la conciliación. Subí el extracto bancario primero.' };

        const rawData = await AuditorAgents._extraerRawData(archivos);
        if (rawData && rawData._error) return rawData;
        if (rawData && rawData._fuente === 'nvidia-vision') return {
            _fuente: 'nvidia-vision',
            transacciones: rawData.transacciones,
            _validacion: rawData._validacion,
            moneda: rawData.moneda,
        };
        if (!rawData || rawData.length < 2) return { _error: 'El archivo no contiene datos suficientes (mínimo 2 filas).' };

        const filaEnc = AuditorAgents._detectarFilaEncabezados(rawData);
        const columnas = AuditorAgents._analizarColumnas(rawData, filaEnc);
        const filaInicio = AuditorAgents._detectarFilaInicio(rawData, filaEnc, columnas);
        const formatoNumero = AuditorAgents._detectarFormatoNumero(rawData, filaInicio, columnas);
        const confianza = AuditorAgents._calcularConfianza(columnas);

        const tieneFecha = columnas.some(c => c.rol === 'fecha' && c.confianza >= 50);
        const tieneMonto = columnas.some(c => ['monto', 'debe', 'haber'].includes(c.rol) && c.confianza >= 50);

        // Check if a saved template matches
        const plantilla = AuditorAgents._detectarPlantilla(rawData);
        if (plantilla && confianza < 60) {
            const transacciones = AuditorAgents._extraerTransacciones(
                rawData, plantilla.mapping, plantilla.mapping._filaInicio || filaInicio, plantilla.mapping.formatoNumero || formatoNumero
            );
            if (transacciones.length > 0) return transacciones;
        }

        if (tieneFecha && tieneMonto && confianza >= 55) {
            const mapping = {};
            columnas.forEach(c => {
                if (c.rol === 'fecha') mapping.fecha = c.indice;
                if (c.rol === 'concepto') mapping.concepto = c.indice;
                if (c.rol === 'monto') mapping.monto = c.indice;
                if (c.rol === 'debe') mapping.debe = c.indice;
                if (c.rol === 'haber') mapping.haber = c.indice;
                if (c.rol === 'ref') mapping.ref = c.indice;
            });
            return AuditorAgents._extraerTransacciones(rawData, mapping, filaInicio, formatoNumero);
        }

        return {
            needsMapping: true,
            rawData,
            columnas: columnas.map(c => ({ indice: c.indice, header: c.header, rol: c.rol, confianza: c.confianza, preview: c.preview })),
            filaEncabezados: filaEnc,
            filaInicioSugerida: filaInicio,
            formatoNumero,
        };
    },

    _extraerTransacciones: (rawData, mapping, filaInicio, formatoNumero) => {
        const transacciones = [];
        const fmt = formatoNumero || 'US';

        for (let i = filaInicio; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.every(v => !v || v === '')) continue;

            const fechaVal = mapping.fecha !== undefined ? row[mapping.fecha] : '';
            if (!fechaVal) continue;

            let montoVal = 0, tipoVal = 'debe';

            if (mapping.monto !== undefined) {
                const m = AuditorAgents._normalizarNumero(row[mapping.monto], fmt);
                if (m < 0) { montoVal = Math.abs(m); tipoVal = 'haber'; }
                else if (m > 0) { montoVal = m; tipoVal = 'debe'; }
            }
            if (montoVal === 0 && mapping.debe !== undefined && mapping.haber !== undefined) {
                const debe = AuditorAgents._normalizarNumero(row[mapping.debe], fmt);
                const haber = AuditorAgents._normalizarNumero(row[mapping.haber], fmt);
                if (debe > 0) { montoVal = debe; tipoVal = 'haber'; }
                else if (haber > 0) { montoVal = haber; tipoVal = 'debe'; }
            }
            if (montoVal === 0 && mapping.monto === undefined) {
                if (mapping.debe !== undefined) {
                    const d = AuditorAgents._normalizarNumero(row[mapping.debe], fmt);
                    if (d > 0) { montoVal = d; tipoVal = 'haber'; }
                }
                if (montoVal === 0 && mapping.haber !== undefined) {
                    const h = AuditorAgents._normalizarNumero(row[mapping.haber], fmt);
                    if (h > 0) { montoVal = h; tipoVal = 'debe'; }
                }
            }

            if (montoVal <= 0) continue;

            transacciones.push({
                fecha: AuditorAgents._normalizarFecha(fechaVal),
                concepto: mapping.concepto !== undefined ? row[mapping.concepto] : '',
                ref: mapping.ref !== undefined ? row[mapping.ref] : '',
                monto: montoVal,
                tipo: tipoVal,
            });
        }
        return transacciones;
    },

    _esFecha: (val) => {
        if (!val) return false;
        if (typeof val === 'number') {
            return val >= 40000 && val <= 200000 && Number.isInteger(val);
        }
        const s = String(val).trim();
        if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(s)) return true;
        if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(s)) return true;
        return !isNaN(Date.parse(s));
    },

    _esNumero: (val) => {
        if (val === '' || val === undefined || val === null) return false;
        if (typeof val === 'number') return true;
        const s = String(val).trim().replace(/[$€Bs\s.,]/g, '');
        if (s === '' || s === '-' || s === '+') return false;
        return !isNaN(parseFloat(s));
    },

    _normalizarNumero: (val, formato) => {
        if (val === '' || val === undefined || val === null) return 0;
        let s = String(val).trim().replace(/[$€Bs\s]/g, '').trim();
        if (s === '' || s === '-' || s === '+') return 0;

        if (formato === 'VE') {
            const lastComma = s.lastIndexOf(',');
            const lastDot = s.lastIndexOf('.');
            if (lastComma > lastDot && lastComma >= 0) {
                s = s.replace(/\./g, '').replace(',', '.');
            } else if (lastComma >= 0 && lastDot >= 0) {
                s = s.replace(/,/g, '');
            }
        } else {
            s = s.replace(/,/g, '');
        }
        return parseFloat(s) || 0;
    },

    _normalizarFecha: (fecha) => {
        if (!fecha) return '';
        if (typeof fecha === 'number') {
            const d = new Date((fecha - 25569) * 86400 * 1000);
            return d.toISOString().split('T')[0];
        }
        const f = String(fecha).replace(/\//g, '-');
        const partes = f.split('-');
        if (partes.length === 3) {
            if (partes[0].length === 4) return f;
            if (partes[2].length === 4) return `${partes[2]}-${partes[1]}-${partes[0]}`;
        }
        return fecha;
    },

    // ─── Plantillas ───
    _guardarPlantilla: (nombre, mapping, rawData, filaEnc) => {
        try {
            const plantillas = JSON.parse(localStorage.getItem('auditor_plantillas') || '{}');
            const headers = rawData?.[filaEnc ?? AuditorAgents._detectarFilaEncabezados(rawData)] || [];
            plantillas[nombre] = {
                ...mapping,
                _headerFingerprint: headers.join('|').toLowerCase().trim(),
                _headerSample: headers.slice(0, 5),
                _creado: new Date().toISOString(),
            };
            localStorage.setItem('auditor_plantillas', JSON.stringify(plantillas));
            return true;
        } catch (e) { return false; }
    },

    _cargarPlantillas: () => {
        try { return JSON.parse(localStorage.getItem('auditor_plantillas') || '{}'); }
        catch (e) { return {}; }
    },

    _detectarPlantilla: (rawData) => {
        const filaEnc = AuditorAgents._detectarFilaEncabezados(rawData);
        if (!rawData[filaEnc]) return null;
        const fingerprint = rawData[filaEnc].join('|').toLowerCase().trim();
        const plantillas = AuditorAgents._cargarPlantillas();
        for (const [nombre, mapping] of Object.entries(plantillas)) {
            if (mapping._headerFingerprint === fingerprint) return { nombre, mapping };
        }
        return null;
    },

    // ─── IA Vision Extraction (NVIDIA) ───

    _pdfToBase64Images: async (b64) => {
        try {
            const pdfData = atob(b64);
            const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
            const images = [];
            const maxPages = Math.min(pdf.numPages, 10);
            for (let i = 1; i <= maxPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 2 });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');
                await page.render({ canvasContext: ctx, viewport }).promise;
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                images.push({ mimeType: 'image/jpeg', data: dataUrl.split(',')[1] });
            }
            return images;
        } catch (e) {
            return { _error: 'Error al procesar PDF: ' + e.message };
        }
    },

    _llamarNVIDIA: async (images, prompt) => {
        const apiKey = window.NVIDIA_API_KEY;
        if (!apiKey) return { _error: 'NVIDIA_API_KEY no configurada. Revisá config.js.' };

        const esVision = images.length > 0;
        const modelosVision = ['meta-llama/llama-4-scout-17b-16e-instruct'];
        const modelosTexto = ['z-ai/glm-5.2', 'z-ai/glm-5.1'];
        const modelos = esVision ? modelosVision : modelosTexto;
        let lastError;

        for (const modelo of modelos) {
            console.log(`[NVIDIA] Probando modelo: ${modelo}`);
            const mensajes = [];
            if (esVision) {
                const content = [{ type: 'text', text: prompt }];
                for (const img of images) {
                    content.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.data}` } });
                }
                mensajes.push({ role: 'user', content });
            } else {
                mensajes.push({ role: 'user', content: prompt });
            }
            try {
                const res = await fetch('http://localhost:3000/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: modelo,
                        messages: mensajes,
                        temperature: 0.1,
                        max_tokens: 4096,
                    }),
                });
                if (!res.ok) {
                    const err = await res.text();
                    lastError = `NVIDIA API error (${res.status}): ${err}`;
                    console.warn(`[NVIDIA] ${modelo} falló:`, lastError);
                    continue;
                }
                const data = await res.json();
                let text = data?.choices?.[0]?.message?.content;
                if (!text) {
                    lastError = 'NVIDIA no devolvió contenido';
                    console.warn(`[NVIDIA] ${modelo} sin contenido`);
                    continue;
                }
                console.log(`[NVIDIA] ${modelo} respondió OK (${text.length} chars)`);
                const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                const jsonStr = jsonMatch ? jsonMatch[1] : text.trim();
                try { return JSON.parse(jsonStr); }
                catch (e) {
                    lastError = 'NVIDIA devolvió JSON inválido: ' + text.substring(0, 200);
                    console.warn(`[NVIDIA] ${modelo} JSON inválido`);
                    continue;
                }
            } catch (e) {
                lastError = 'Error de red NVIDIA: ' + e.message;
                console.warn(`[NVIDIA] ${modelo} excepción:`, e.message);
            }
        }
        return { _error: `NVIDIA no disponible. Último error: ${lastError}` };
    },

    _visionToTransacciones: (visionResult) => {
        if (!visionResult.movimientos || !Array.isArray(visionResult.movimientos)) {
            return { _error: 'La IA no devolvió movimientos válidos' };
        }
        const transacciones = [];
        for (const m of visionResult.movimientos) {
            let monto = 0, tipo = 'debe';
            if (m.cargo != null && m.cargo > 0) {
                monto = m.cargo; tipo = 'haber';
            } else if (m.abono != null && m.abono > 0) {
                monto = m.abono; tipo = 'debe';
            }
            if (monto <= 0) continue;
            transacciones.push({
                fecha: m.fecha || '',
                concepto: m.descripcion || '',
                ref: m.ref || '',
                monto,
                tipo,
            });
        }
        if (transacciones.length === 0) {
            return { _error: 'La IA devolvió movimientos pero ninguno tiene monto válido' };
        }
        const saldoInicial = visionResult.saldo_inicial != null ? visionResult.saldo_inicial : null;
        const saldoFinal = visionResult.saldo_final != null ? visionResult.saldo_final : null;
        const validacion = AuditorAgents._validarSaldo(transacciones, saldoInicial, saldoFinal);
        return {
            transacciones,
            saldoInicial,
            saldoFinal,
            moneda: visionResult.moneda || null,
            entidad: visionResult.entidad_bancaria || '',
            _fuente: 'nvidia-vision',
            _validacion: validacion,
        };
    },

    _validarSaldo: (transacciones, saldoInicial, saldoFinal) => {
        if (saldoInicial == null || saldoFinal == null) {
            return { valida: false, error: 'No se identificó saldo inicial/final. Revisión manual requerida.' };
        }
        const saldoCalculado = transacciones.reduce((s, t) =>
            s + (t.tipo === 'debe' ? t.monto : -t.monto), saldoInicial
        );
        const diff = Math.abs(saldoCalculado - saldoFinal);
        const diffPct = saldoFinal !== 0 ? diff / Math.abs(saldoFinal) : diff;
        if (diff < 0.01) return { valida: true, saldoCalculado, saldoFinal, diff: 0 };
        if (diffPct < 0.01) {
            return { valida: true, saldoCalculado, saldoFinal, diff, _warning: `Diferencia de ${diff.toFixed(2)} (${(diffPct * 100).toFixed(2)}%)` };
        }
        return {
            valida: false,
            saldoCalculado,
            saldoFinal,
            diff,
            error: `Los saldos no cuadran: inicial ${saldoInicial} + movimientos = ${saldoCalculado.toFixed(2)}, pero el final es ${saldoFinal.toFixed(2)} (diferencia: ${diff.toFixed(2)}). Revisión manual requerida.`,
        };
    },

    _extraerConVision: async (archivos) => {
        const images = [];
        let textData = null;
        for (const archivo of archivos) {
            const nom = (archivo.nombre || '').toLowerCase();
            const b64 = archivo.contenido?.split(',')[1] || archivo.contenido;
            if (!b64) continue;
            if (nom.endsWith('.pdf')) {
                const pdfImgs = await AuditorAgents._pdfToBase64Images(b64);
                if (pdfImgs._error) return pdfImgs;
                images.push(...pdfImgs);
            } else if (nom.endsWith('.jpg') || nom.endsWith('.jpeg') || nom.endsWith('.png')) {
                images.push({ mimeType: nom.endsWith('.png') ? 'image/png' : 'image/jpeg', data: b64 });
            } else if (nom.endsWith('.xlsx') || nom.endsWith('.xls') || nom.endsWith('.csv')) {
                const raw = nom.endsWith('.csv')
                    ? AuditorAgents._csvToRaw(b64)
                    : AuditorAgents._excelToRaw(b64);
                if (raw && !raw._error && raw.length > 0) {
                    textData = raw.map(r => r.join('\t')).join('\n');
                }
            }
        }

        if (images.length === 0 && !textData) {
            return { _error: 'No se encontraron archivos válidos (PDF, imagen, Excel o CSV) en los adjuntos.' };
        }

        const promptBase = `Extraé los movimientos bancarios de este estado de cuenta venezolano.

REGLAS:
- Fecha en formato YYYY-MM-DD (ej: "10/01/24" → "2024-01-10")
- Si un campo no es legible, poné null. NO inventes ni adivines.
- cargo = egreso/retiro (lo que el banco resta del saldo)
- abono = ingreso/depósito (lo que el banco suma al saldo)
- Si solo hay una columna de "monto" con positivos y negativos: positivo → abono, negativo → cargo (valor absoluto)
- Si hay columnas separadas Débito/Crédito: cargo = débito, abono = crédito
- ref = número de referencia, cheque, documento o transferencia
- saldo_inicial = saldo antes del primer movimiento
- saldo_final = saldo después del último movimiento
- moneda = "BS" si es bolívares, "USD" si es dólares`;

        const promptBaseJSON = `Respondé SOLO con JSON válido (sin markdown, sin explicaciones). Usá este formato exacto:
{
  "entidad_bancaria": "...",
  "numero_cuenta": "...",
  "periodo": "...",
  "moneda": "BS",
  "saldo_inicial": 0,
  "saldo_final": 0,
  "movimientos": [
    {"fecha": "YYYY-MM-DD", "descripcion": "...", "cargo": null, "abono": 100.50, "saldo": null, "ref": null}
  ]
}`;

        if (textData) {
            const prompt = `Acá están los datos del extracto bancario en formato tabla (valores separados por tabulador, filas separadas por salto de línea). Interpretá esta tabla como un estado de cuenta y extraé los movimientos.\n\n${textData}\n\n${promptBase}\n\n${promptBaseJSON}`;
            const result = await AuditorAgents._llamarNVIDIA([], prompt);
            if (result._error) return result;
            return AuditorAgents._visionToTransacciones(result);
        }

        const prompt = `${promptBase}\n- Si son varias páginas, mantené la secuencia de saldos entre páginas\n\n${promptBaseJSON}`;
        const result = await AuditorAgents._llamarNVIDIA(images, prompt);
        if (result._error) return result;
        return AuditorAgents._visionToTransacciones(result);
    },

    _probarNVIDIA: async () => {
        const apiKey = window.NVIDIA_API_KEY;
        if (!apiKey) {
            console.error('[NVIDIA] ERROR: NVIDIA_API_KEY no está definida en window. Revisá config.js.');
            return { ok: false, error: 'API key no configurada en window.NVIDIA_API_KEY' };
        }
        console.log('[NVIDIA] Probando conexión...');
        const modelos = ['z-ai/glm-5.2', 'z-ai/glm-5.1'];
        for (const modelo of modelos) {
            console.log(`[NVIDIA] Probando ${modelo}...`);
            try {
                const res = await fetch('http://localhost:3000/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: modelo,
                        messages: [{ role: 'user', content: 'Respondé solo: OK' }],
                        temperature: 0,
                        max_tokens: 10,
                    }),
                });
                const data = await res.json();
                if (res.ok) {
                    const texto = data?.choices?.[0]?.message?.content || '';
                    console.log(`[NVIDIA] ${modelo} OK:`, texto);
                    return { ok: true, modelo, respuesta: texto };
                }
                console.warn(`[NVIDIA] ${modelo} falló:`, data?.error?.message || res.status);
            } catch (e) {
                console.warn(`[NVIDIA] ${modelo} excepción:`, e.message);
            }
        }
        return { ok: false, error: 'Ningún modelo NVIDIA respondió' };
    },

    // ─── Previsualización ───
    obtenerMovimientosLibro: async (empresaRif, codigoCuenta, periodo) => {
        const p = AuditorAgents._obtenerPeriodo(periodo);
        const txs = await sbFetch(
            `journal?rif=eq.${encodeURIComponent(empresaRif)}&codigo_cuenta=eq.${encodeURIComponent(codigoCuenta)}&fecha_local=gte.${p.inicio}&fecha_local=lt.${p.fin}&order=fecha_local.asc`
        ) || [];
        let saldo = 0;
        return txs.map(t => {
            const debe = parseFloat(t.debe_bs || 0);
            const haber = parseFloat(t.haber_bs || 0);
            saldo += debe - haber;
            return { ...t, _saldoCorriente: saldo };
        });
    },

    obtenerMovimientosBancoPreview: async (archivos) => {
        if (!archivos || archivos.length === 0) return { _error: 'No hay archivos adjuntos' };
        const rawData = await AuditorAgents._extraerRawData(archivos);
        if (rawData && rawData._error) return rawData;
        if (rawData && rawData._fuente === 'nvidia-vision') {
            const preview = {
                transacciones: rawData.transacciones,
                _fuente: 'nvidia-vision',
                saldoInicial: rawData.saldoInicial,
                saldoFinal: rawData.saldoFinal,
                moneda: rawData.moneda,
            };
            if (rawData._validacion && !rawData._validacion.valida) preview._validacionError = rawData._validacion.error;
            if (rawData._validacion && rawData._validacion._warning) preview._validacionWarning = rawData._validacion._warning;
            return preview;
        }
        if (!rawData || rawData.length < 2) return { _error: 'El archivo no contiene datos suficientes' };

        // Propagar _iaError si el fallback se usó
        const iaError = rawData._iaError;

        const filaEnc = AuditorAgents._detectarFilaEncabezados(rawData);
        const columnas = AuditorAgents._analizarColumnas(rawData, filaEnc);
        const filaInicio = AuditorAgents._detectarFilaInicio(rawData, filaEnc, columnas);
        const formatoNumero = AuditorAgents._detectarFormatoNumero(rawData, filaInicio, columnas);
        const confianza = AuditorAgents._calcularConfianza(columnas);

        const tieneFecha = columnas.some(c => c.rol === 'fecha' && c.confianza >= 50);
        const tieneMonto = columnas.some(c => ['monto', 'debe', 'haber'].includes(c.rol) && c.confianza >= 50);

        if (tieneFecha && tieneMonto && confianza >= 55) {
            const mapping = {};
            columnas.forEach(c => {
                if (c.rol === 'fecha') mapping.fecha = c.indice;
                if (c.rol === 'concepto') mapping.concepto = c.indice;
                if (c.rol === 'monto') mapping.monto = c.indice;
                if (c.rol === 'debe') mapping.debe = c.indice;
                if (c.rol === 'haber') mapping.haber = c.indice;
                if (c.rol === 'ref') mapping.ref = c.indice;
            });
            const transacciones = AuditorAgents._extraerTransacciones(rawData, mapping, filaInicio, formatoNumero);
            return { transacciones, rawData, columnas, filaEnc, filaInicio, formatoNumero, confianza, _iaError: iaError };
        }

        return {
            needsMapping: true,
            rawData,
            columnas: columnas.map(c => ({ indice: c.indice, header: c.header, rol: c.rol, confianza: c.confianza, preview: c.preview })),
            filaEncabezados: filaEnc,
            filaInicioSugerida: filaInicio,
            formatoNumero,
            _iaError: iaError,
        };
    },

    // ─── Matching ───
    _matchTransacciones: (journalTxs, extractoTxs) => {
        const cruces = [];
        const pendientesLibro = [...journalTxs];
        const pendientesBanco = [...extractoTxs];

        for (let i = extractoTxs.length - 1; i >= 0; i--) {
            const btx = extractoTxs[i];
            let bestIdx = -1, bestScore = 0;
            for (let j = 0; j < pendientesLibro.length; j++) {
                const score = AuditorAgents._matchScore(btx, pendientesLibro[j]);
                if (score > bestScore) { bestScore = score; bestIdx = j; }
            }
            if (bestIdx !== -1 && bestScore >= 50) {
                cruces.push({ banco: btx, libro: pendientesLibro[bestIdx], score: bestScore, aceptado: true });
                pendientesLibro.splice(bestIdx, 1);
                pendientesBanco.splice(i, 1);
            }
        }

        const saldoLibro = journalTxs.reduce((s, t) => s + parseFloat(t.debe_bs || 0) - parseFloat(t.haber_bs || 0), 0);
        const saldoBanco = extractoTxs.reduce((s, t) => s + (t.tipo === 'debe' ? t.monto : -t.monto), 0);

        return {
            cruces: cruces.sort((a, b) => b.score - a.score),
            pendientesLibro, pendientesBanco,
            saldoLibro, saldoBanco,
            diferencia: saldoLibro - saldoBanco,
            totalJournal: journalTxs.length,
            totalExtracto: extractoTxs.length,
        };
    },

    _matchScore: (bancoTxn, journalTxn) => {
        let score = 0;
        const montoBanco = parseFloat(bancoTxn.monto || 0);
        const debeJournal = parseFloat(journalTxn.debe_bs || 0);
        const haberJournal = parseFloat(journalTxn.haber_bs || 0);

        if (Math.abs(debeJournal - montoBanco) < 0.01 || Math.abs(haberJournal - montoBanco) < 0.01) score += 55;
        else if (Math.abs(debeJournal - montoBanco) < 1 || Math.abs(haberJournal - montoBanco) < 1) score += 30;

        const bancoRef = String(bancoTxn.ref || '').trim().toLowerCase();
        const journalRef = String(journalTxn.ref_doc || '').trim().toLowerCase();
        if (bancoRef && journalRef) {
            if (bancoRef === journalRef) score += 30;
            else if (bancoRef.includes(journalRef) || journalRef.includes(bancoRef)) score += 15;
        }

        if (bancoTxn.fecha && journalTxn.fecha_local) {
            const diff = Math.abs(new Date(bancoTxn.fecha) - new Date(journalTxn.fecha_local)) / 86400000;
            if (diff <= 1) score += 15;
            else if (diff <= 3) score += 10;
            else if (diff <= 7) score += 5;
        }
        return Math.min(score, 100);
    },

    // ─── Agente Declaraciones ───
    agenteDeclaraciones: async (empresaRif, periodo, tipo) => {
        const p = AuditorAgents._obtenerPeriodo(periodo);
        const journal = await sbFetch(
            `journal?rif=eq.${encodeURIComponent(empresaRif)}&fecha_local=gte.${p.inicio}&fecha_local=lt.${p.fin}&limit=10000`
        ) || [];
        if (tipo === 'IVA') return AuditorAgents._calcularIVA(journal, periodo);
        if (tipo === 'ISLR') return AuditorAgents._calcularISLR(journal, periodo);
        return null;
    },

    _calcularIVA: (journal, periodo) => {
        const tasaIVA = 0.16;
        const ventas = journal.filter(r => r.codigo_cuenta === '4.1.01.01');
        const gastos = journal.filter(r => r.codigo_cuenta && r.codigo_cuenta.startsWith('6.'));
        const totalVentas = ventas.reduce((s, r) => s + parseFloat(r.haber_usd || r.debe_usd || 0), 0);
        const totalGastos = gastos.reduce((s, r) => s + parseFloat(r.debe_usd || 0), 0);
        const baseVentas = totalVentas / (1 + tasaIVA);
        const baseGastos = totalGastos / (1 + tasaIVA);
        return {
            tipo: 'IVA', periodo, tasa: '16%',
            totalVentas, totalGastos, baseVentas, baseGastos,
            ivaDebito: baseVentas * tasaIVA,
            ivaCredito: baseGastos * tasaIVA,
            ivaAPagar: Math.max(0, baseVentas * tasaIVA - baseGastos * tasaIVA),
            detalle: [...ventas, ...gastos].map(r => ({
                fecha: r.fecha_local, concepto: r.concepto,
                codigo: r.codigo_cuenta, monto: parseFloat(r.debe_usd || r.haber_usd || 0),
                tipo: r.codigo_cuenta === '4.1.01.01' ? 'Venta' : 'Gasto',
            })).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')),
        };
    },

    _calcularISLR: (journal, periodo) => {
        const ingresos = journal.filter(r => r.codigo_cuenta?.startsWith('4.')).reduce((s, r) => s + parseFloat(r.haber_usd || 0), 0);
        const costos = journal.filter(r => r.codigo_cuenta?.startsWith('5.')).reduce((s, r) => s + parseFloat(r.debe_usd || 0), 0);
        const gastos = journal.filter(r => r.codigo_cuenta?.startsWith('6.')).reduce((s, r) => s + parseFloat(r.debe_usd || 0), 0);
        const rentaNeta = ingresos - costos - gastos;
        return {
            tipo: 'ISLR', periodo, tasa: '25%',
            ingresos, costos, gastos, rentaNeta,
            islrEstimado: rentaNeta > 0 ? rentaNeta * 0.25 : 0,
            detalle: { ingresos, costos, gastos },
        };
    },
};

window.AuditorAgents = AuditorAgents;

// Auto-test NVIDIA al cargar el módulo
setTimeout(() => {
    if (!window.NVIDIA_API_KEY) {
        console.warn('[NVIDIA] ⚠️ NVIDIA_API_KEY no encontrada. La extracción por IA no estará disponible.');
        console.warn('[NVIDIA] Agregala en config.js como: const NVIDIA_API_KEY = \'tu-api-key\';');
    } else {
        console.log('[NVIDIA] API key presente. Ejecutá AuditorAgents._probarNVIDIA() para probar la conexión.');
    }
}, 500);
