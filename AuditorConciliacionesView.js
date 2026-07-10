const AuditorConciliacionesView = ({ empresa }) => {
    const empresaRif = empresa?.rif || '';
    const [cuentas, setCuentas] = React.useState([]);
    const [conciliaciones, setConciliaciones] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedId, setSelectedId] = React.useState(null);
    const [agentResult, setAgentResult] = React.useState(null);
    const [executing, setExecuting] = React.useState(false);
    const [procesando, setProcesando] = React.useState(false);
    const [processedPdf, setProcessedPdf] = React.useState(null);
    const [mensaje, setMensaje] = React.useState('');
    const [mappingConfig, setMappingConfig] = React.useState({});
    const [mappingFilaInicio, setMappingFilaInicio] = React.useState(null);
    const [mappingFormatoNumero, setMappingFormatoNumero] = React.useState(null);
    const [movimientosLibro, setMovimientosLibro] = React.useState([]);
    const [movimientosBanco, setMovimientosBanco] = React.useState(null);
    const [previewLoading, setPreviewLoading] = React.useState(false);
    const [selectLibroIdx, setSelectLibroIdx] = React.useState(null);
    const [selectBancoIdx, setSelectBancoIdx] = React.useState(null);

    const periodo = AuditorAgents.obtenerPeriodoAnterior();
    const labelPeriodo = AuditorAgents.labelPeriodo(periodo);
    const $fecha = (s) => s ? new Date(s).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
    const $fmt = (n) => (n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const badgeEst = (est) => {
        const map = {
            conciliado: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
            en_conciliacion: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
            entregado: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
            vencido: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
            pendiente: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
        };
        return map[est] || 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    };

    const labelEst = (est) => {
        const map = { conciliado: 'Conciliado', en_conciliacion: 'En Conciliación', entregado: 'Entregado', vencido: 'Vencido' };
        return map[est] || 'Pendiente';
    };

    const cargar = React.useCallback(async () => {
        if (!empresaRif) { setLoading(false); return; }
        try {
            const [ctas, concs] = await Promise.all([
                sbFetch(`cuentas_contables?rif_empresa=eq.${encodeURIComponent(empresaRif)}&order=codigo.asc`),
                sbFetch(`conciliaciones?empresa_rif=eq.${encodeURIComponent(empresaRif)}&order=periodo.desc`),
            ]);
            const bancarias = (ctas || []).filter(c => (c.tipo_especifico || '').toLowerCase() === 'banco');
            setCuentas(bancarias);
            setConciliaciones(concs || []);
            setLoading(false);
        } catch (_) { setLoading(false); }
    }, [empresaRif]);

    React.useEffect(() => { cargar(); }, [cargar]);

    const getConciliacion = (codigoCuenta) =>
        (conciliaciones || []).find(c => c.codigo_cuenta === codigoCuenta && c.periodo === periodo);

    const ejecutarAgente = async (codigoCuenta) => {
        const conc = getConciliacion(codigoCuenta);
        if (!conc) { alert('No hay registro de conciliación para esta cuenta en el período.'); return; }
        setExecuting(true);
        setAgentResult(null);
        setProcessedPdf(null);
        setMensaje('');
        try {
            const result = await AuditorAgents.agenteConciliador(
                empresaRif, codigoCuenta, periodo, conc.archivos
            );
            if (result._error) {
                setMensaje(result._error);
                setExecuting(false);
                return;
            }
            if (result.needsMapping) {
                setAgentResult(result);
                setSelectedId(codigoCuenta);
                setMappingConfig({});
                setMappingFilaInicio(result.filaInicioSugerida || result.filaEncabezados + 1);
                setMensaje('El formato del extracto no se reconoció automáticamente. Configurá el mapeo de columnas abajo.');
                setExecuting(false);
                return;
            }
            setAgentResult(result);
            setSelectedId(codigoCuenta);
            setMensaje(`Agente completado: ${(result.cruces || []).length} cruces encontrados`);
        } catch (e) {
            setMensaje('Error: ' + e.message);
        }
        setExecuting(false);
    };

    const seleccionarCuenta = async (codigoCuenta) => {
        setSelectedId(codigoCuenta);
        setAgentResult(null);
        setProcessedPdf(null);
        setMensaje('');
        setPreviewLoading(true);
        setMovimientosBanco(null);
        try {
            const [libro, conc] = await Promise.all([
                AuditorAgents.obtenerMovimientosLibro(empresaRif, codigoCuenta, periodo),
                Promise.resolve(getConciliacion(codigoCuenta)),
            ]);
            setMovimientosLibro(libro);
            if (conc?.archivos?.length > 0) {
                const banco = await AuditorAgents.obtenerMovimientosBancoPreview(conc.archivos);
                setMovimientosBanco(banco);
                if (banco._error) setMensaje(banco._error);
            }
        } catch (e) {
            setMensaje('Error al cargar vista previa: ' + e.message);
        }
        setPreviewLoading(false);
    };

    const cruzarManual = () => {
        if (!agentResult || selectLibroIdx === null || selectBancoIdx === null) return;
        const nuevo = { ...agentResult };
        const libroItem = nuevo.pendientesLibro[selectLibroIdx];
        const bancoItem = nuevo.pendientesBanco[selectBancoIdx];
        if (!libroItem || !bancoItem) return;
        const montoBanco = parseFloat(bancoItem.monto || 0);
        nuevo.cruces = [...nuevo.cruces, { banco: bancoItem, libro: libroItem, score: 100, aceptado: true, manual: true }];
        nuevo.pendientesLibro = nuevo.pendientesLibro.filter((_, i) => i !== selectLibroIdx);
        nuevo.pendientesBanco = nuevo.pendientesBanco.filter((_, i) => i !== selectBancoIdx);
        setAgentResult(nuevo);
        setSelectLibroIdx(null);
        setSelectBancoIdx(null);
        setMensaje('Cruce manual agregado');
    };

    const toggleCruce = (index) => {
        if (!agentResult) return;
        const nuevo = { ...agentResult };
        nuevo.cruces = [...nuevo.cruces];
        nuevo.cruces[index] = { ...nuevo.cruces[index], aceptado: !nuevo.cruces[index].aceptado };
        setAgentResult(nuevo);
    };

    const aceptarTodos = () => {
        if (!agentResult) return;
        const nuevo = { ...agentResult, cruces: agentResult.cruces.map(c => ({ ...c, aceptado: true })) };
        setAgentResult(nuevo);
        setMensaje('Todos los cruces aceptados');
    };

    const rechazarTodos = () => {
        if (!agentResult) return;
        const nuevo = { ...agentResult, cruces: agentResult.cruces.map(c => ({ ...c, aceptado: false })) };
        setAgentResult(nuevo);
        setMensaje('Todos los cruces rechazados');
    };

    const verPDFpreview = () => {
        const pdfDoc = window.AuditorPDF.generarConciliacionPDF(
            agentResult, empresa, empresa?.auditor || 'Auditor',
            cuentas.find(c => c.codigo === selectedId)?.nombre || selectedId
        );
        const pdfFile = window.AuditorPDF.guardarPDF(pdfDoc, `conciliacion_${selectedId}_${periodo}.pdf`);
        setProcessedPdf(pdfFile);
        window.open(pdfFile.contenido, '_blank');
    };

    const procesar = async () => {
        if (!agentResult) return;
        setProcesando(true);
        try {
            const conc = getConciliacion(selectedId);
            if (!conc) { alert('Error: conciliación no encontrada'); setProcesando(false); return; }

            let pdfFile = processedPdf;
            if (!pdfFile) {
                const pdfDoc = window.AuditorPDF.generarConciliacionPDF(
                    agentResult, empresa, empresa?.auditor || 'Auditor',
                    cuentas.find(c => c.codigo === selectedId)?.nombre || selectedId
                );
                pdfFile = window.AuditorPDF.guardarPDF(pdfDoc, `conciliacion_${selectedId}_${periodo}.pdf`);
                setProcessedPdf(pdfFile);
            }

            const archivos = [...(conc.archivos || []), pdfFile];

            await sbFetch(`conciliaciones?id=eq.${conc.id}`, {
                method: 'PATCH', prefer: 'return=minimal',
                body: JSON.stringify({
                    estado: 'conciliado',
                    archivos,
                }),
            });

            setMensaje('Conciliación confirmada y PDF guardado exitosamente');
            await cargar();
        } catch (e) {
            setMensaje('Error al procesar: ' + e.message);
        }
        setProcesando(false);
    };

    const descargarPDF = (archivo) => {
        const link = document.createElement('a');
        link.href = archivo.contenido;
        link.download = archivo.nombre;
        link.click();
    };

    const setColRol = (indice, rol) => {
        setMappingConfig(prev => ({ ...prev, [indice]: rol }));
    };

    const aplicarMappingManual = async () => {
        if (!agentResult?.needsMapping) return;
        setProcesando(true);
        try {
            const conc = getConciliacion(selectedId);
            if (!conc) { alert('Error: conciliación no encontrada'); setProcesando(false); return; }

            const mapping = { formatoNumero: mappingFormatoNumero || agentResult.formatoNumero || 'US' };
            agentResult.columnas.forEach(col => {
                const rol = mappingConfig[col.indice] || col.rol;
                if (rol === 'fecha') mapping.fecha = col.indice;
                if (rol === 'concepto') mapping.concepto = col.indice;
                if (rol === 'monto') mapping.monto = col.indice;
                if (rol === 'debe') mapping.debe = col.indice;
                if (rol === 'haber') mapping.haber = col.indice;
                if (rol === 'ref') mapping.ref = col.indice;
            });

            const filaInicio = mappingFilaInicio !== null ? mappingFilaInicio : agentResult.filaInicioSugerida;

            const result = await AuditorAgents.aplicarMapping(
                empresaRif, selectedId, periodo, conc.archivos, mapping, filaInicio
            );
            if (result._error) {
                setMensaje(result._error);
                setProcesando(false);
                return;
            }
            setAgentResult(result);
            setMappingConfig({});
            setMappingFormatoNumero(null);
            setMensaje(`Agente completado: ${(result.cruces || []).length} cruces encontrados`);
        } catch (e) {
            setMensaje('Error: ' + e.message);
        }
        setProcesando(false);
    };

    if (loading) return <div className="h-40 bg-slate-800/50 rounded-2xl animate-pulse" />;

    const cuentaSelected = cuentas.find(c => c.codigo === selectedId);
    const concSelected = getConciliacion(selectedId);

    return (
        <main className="flex-1 h-full overflow-hidden flex flex-col bg-slate-950 relative">
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 z-10">
                <div className="max-w-6xl mx-auto space-y-6 animate-in">

                    {/* Header */}
                    <div className="flex items-center justify-between gap-4 mb-2">
                        <div>
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Conciliaciones Bancarias</p>
                            <h1 className="text-xl font-black text-white tracking-tight mt-0.5">Período: {labelPeriodo}</h1>
                        </div>
                        <p className="text-xs text-slate-500 font-bold">{cuentas.length} cuenta(s)</p>
                    </div>

                    {mensaje && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-5 py-3 text-xs font-bold text-blue-400 animate-in flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                            {mensaje}
                            <button onClick={() => setMensaje('')} className="ml-auto text-slate-600 hover:text-white">
                                <Icon name="X" size={14} />
                            </button>
                        </div>
                    )}

                    {selectedId && (
                        <button onClick={() => { setSelectedId(null); setAgentResult(null); setProcessedPdf(null); setMappingConfig({}); setMappingFilaInicio(null); setMappingFormatoNumero(null); setMovimientosLibro([]); setMovimientosBanco(null); setSelectLibroIdx(null); setSelectBancoIdx(null); }}
                            className="text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-wider flex items-center gap-1.5 transition-colors">
                            <Icon name="ArrowLeft" size={14} /> Volver a lista
                        </button>
                    )}

                    {/* Detail View */}
                    {selectedId ? (
                        <div className="space-y-5">

                            {/* Account Header */}
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="text-sm font-black text-white">{cuentaSelected?.nombre || selectedId}</p>
                                        <p className="text-[10px] font-mono text-slate-500">{selectedId}</p>
                                    </div>
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${badgeEst(concSelected?.estado || 'pendiente')}`}>
                                        {labelEst(concSelected?.estado || 'pendiente')}
                                    </span>
                                </div>
                                {concSelected?.archivos?.length > 0 && (
                                    <div className="flex gap-2 flex-wrap mt-2">
                                        {concSelected.archivos.filter(a => a.tipo !== 'application/pdf').map((a, i) => (
                                            <button key={i} onClick={() => descargarPDF(a)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 rounded-xl text-[10px] font-bold text-blue-400 hover:bg-slate-700 transition-colors border border-slate-700/50">
                                                <Icon name="File" size={12} /> {a.nombre}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {agentResult ? (
                            <>
                            {/* ── Mapping UI ── */}
                            {agentResult.needsMapping ? (
                                <div className="space-y-5">
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Icon name="Settings2" size={16} className="text-amber-400" />
                                            <p className="text-[10px] font-black text-amber-400 uppercase tracking-wider">Configuración de Columnas</p>
                                        </div>
                                        <p className="text-xs text-slate-400 font-bold mb-4">
                                            El sistema no reconoció automáticamente las columnas del extracto.
                                            Seleccioná el rol de cada columna y la fila donde empiezan los datos.
                                        </p>

                                        {/* Columnas */}
                                        <div className="overflow-x-auto mb-5">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="text-[9px] font-black text-slate-500 uppercase tracking-wider bg-slate-900/50">
                                                        <th className="px-3 py-2">Columna</th>
                                                        <th className="px-3 py-2">Encabezado</th>
                                                        <th className="px-3 py-2">Vista Previa</th>
                                                        <th className="px-3 py-2">Rol Detectado</th>
                                                        <th className="px-3 py-2">Rol Manual</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(agentResult.columnas || []).map(col => (
                                                        <tr key={col.indice} className="border-t border-slate-700/30 text-[10px] text-slate-300">
                                                            <td className="px-3 py-2 font-mono text-slate-500">#{col.indice + 1}</td>
                                                            <td className="px-3 py-2 font-bold">{col.header || '—'}</td>
                                                            <td className="px-3 py-2 font-mono text-slate-400">{(col.preview || []).join(', ').substring(0, 40) || '—'}</td>
                                                            <td className="px-3 py-2">
                                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                                                    col.confianza >= 60 ? 'text-emerald-400 bg-emerald-500/10' :
                                                                    col.confianza >= 40 ? 'text-amber-400 bg-amber-500/10' :
                                                                    'text-slate-500 bg-slate-800'
                                                                }`}>{col.rol} ({col.confianza}%)</span>
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <select value={mappingConfig[col.indice] || col.rol}
                                                                    onChange={e => setColRol(col.indice, e.target.value)}
                                                                    className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:border-amber-500 min-w-[90px]">
                                                                    {['fecha', 'concepto', 'monto', 'debe', 'haber', 'ref', 'ignorar'].map(r => (
                                                                        <option key={r} value={r}>{r}</option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Fila de inicio */}
                                        <div className="flex items-center gap-4 mb-5">
                                            <div>
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">Fila de Encabezados</p>
                                                <p className="text-xs font-mono text-slate-400">{agentResult.filaEncabezados !== undefined ? agentResult.filaEncabezados + 1 : '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">Fila de Inicio (datos)</p>
                                                <input type="number" min={1}
                                                    value={(mappingFilaInicio !== null ? mappingFilaInicio : (agentResult.filaInicioSugerida || 1)) + 1}
                                                    onChange={e => setMappingFilaInicio(Math.max(0, parseInt(e.target.value) - 1))}
                                                    className="w-20 bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs font-bold text-center outline-none focus:border-amber-500" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">Formato Número</p>
                                                <select value={mappingFormatoNumero || agentResult.formatoNumero || 'US'}
                                                    onChange={e => setMappingFormatoNumero(e.target.value)}
                                                    className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none focus:border-amber-500">
                                                    <option value="US">1,234.56 (US)</option>
                                                    <option value="VE">1.234,56 (VE)</option>
                                                </select>
                                            </div>
                                        </div>

                                        <button onClick={aplicarMappingManual} disabled={procesando}
                                            className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-amber-900/30">
                                            {procesando ? <><Icon name="Loader" size={14} className="animate-spin" /> Procesando...</> : <><Icon name="Check" size={16} /> Aplicar Mapeo y Ejecutar</>}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                            <>
                            /* ── Saldos Panel ── */
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[
                                    { label: 'Saldo según Libro', value: agentResult.saldoLibro, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
                                    { label: 'Saldo según Banco', value: agentResult.saldoBanco, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                                    { label: 'Diferencia', value: agentResult.diferencia, color: Math.abs(agentResult.diferencia) > 0.01 ? 'text-rose-400' : 'text-emerald-400', bg: Math.abs(agentResult.diferencia) > 0.01 ? 'bg-rose-500/10 border-rose-500/20' : 'bg-emerald-500/10 border-emerald-500/20' },
                                ].map((s, i) => (
                                    <div key={i} className={`${s.bg} rounded-2xl p-5 border text-center`}>
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{s.label}</p>
                                        <p className={`text-2xl font-black ${s.color}`}>${(s.value || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                ))}
                            </div>

                            {agentResult._fuente === 'nvidia-vision' && (
                                <div className="flex items-center gap-2 justify-end">
                                    <span className="text-[8px] font-black text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest">NVIDIA Vision</span>
                                    {agentResult.moneda && <span className="text-[8px] font-black text-slate-500 uppercase">{agentResult.moneda}</span>}
                                </div>
                            )}
                            {agentResult._validacion && !agentResult._validacion.valida && (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                                    <p className="text-[9px] font-bold text-rose-400">{agentResult._validacion.error}</p>
                                </div>
                            )}
                            {agentResult._validacion && agentResult._validacion._warning && (
                                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                    <p className="text-[9px] font-bold text-amber-400">{agentResult._validacion._warning}</p>
                                </div>
                            )}

                            /* Cruces Table */
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
                                    <div className="flex items-center gap-3">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Cruces Propuestos</p>
                                        <span className="text-[10px] font-bold text-slate-600">
                                            {(agentResult.cruces || []).filter(c => c.aceptado).length} / {(agentResult.cruces || []).length} aceptados
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={aceptarTodos}
                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors flex items-center gap-1">
                                            <Icon name="Check" size={12} /> Aceptar Todos
                                        </button>
                                        <button onClick={rechazarTodos}
                                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors flex items-center gap-1">
                                            <Icon name="X" size={12} /> Rechazar Todos
                                        </button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="text-[9px] font-black text-slate-500 uppercase tracking-wider bg-slate-900/50">
                                                <th className="px-4 py-3 w-10"> </th>
                                                <th className="px-4 py-3">Fecha Libro</th>
                                                <th className="px-4 py-3">Fecha Banco</th>
                                                <th className="px-4 py-3">Concepto</th>
                                                <th className="px-4 py-3 text-right">Monto ($)</th>
                                                <th className="px-4 py-3 text-right">Confianza</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {agentResult.cruces.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-5 py-10 text-center text-xs text-slate-600 font-bold">
                                                        No se encontraron cruces automáticos
                                                    </td>
                                                </tr>
                                            ) : agentResult.cruces.map((c, i) => {
                                                const monto = parseFloat(c.libro?.debe_bs || c.libro?.haber_bs || c.banco?.monto || 0);
                                                return (
                                                    <tr key={i} className={`border-t border-slate-700/30 text-xs ${c.aceptado ? 'text-slate-200' : 'text-slate-500'}`}>
                                                        <td className="px-4 py-2.5">
                                                            <button onClick={() => toggleCruce(i)}
                                                                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${c.aceptado ? 'bg-emerald-500 border-emerald-400 text-white' : 'border-slate-600 hover:border-slate-500'}`}>
                                                                {c.aceptado && <Icon name="Check" size={12} />}
                                                            </button>
                                                        </td>
                                                        <td className="px-4 py-2.5 font-mono text-[10px]">{$fecha(c.libro?.fecha_local)}</td>
                                                        <td className="px-4 py-2.5 font-mono text-[10px]">{$fecha(c.banco?.fecha)}</td>
                                                        <td className="px-4 py-2.5 font-bold text-[10px] max-w-[200px] truncate">
                                                            {String(c.libro?.concepto || c.banco?.concepto || '').substring(0, 50)}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right font-mono font-bold">${(monto).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                                                        <td className="px-4 py-2.5 text-right">
                                                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                                                c.score >= 80 ? 'text-emerald-400 bg-emerald-500/10' :
                                                                c.score >= 60 ? 'text-amber-400 bg-amber-500/10' :
                                                                'text-rose-400 bg-rose-500/10'
                                                            }`}>
                                                                {c.score}%
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            /* Pendientes */
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Icon name="BookOpen" size={14} className="text-amber-400" />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                            Pendientes en Libro ({agentResult.pendientesLibro.length})
                                        </p>
                                    </div>
                                    {agentResult.pendientesLibro.length === 0 ? (
                                        <p className="text-[10px] text-slate-600 font-bold text-center py-4">Sin pendientes</p>
                                    ) : (
                                        <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                                            {agentResult.pendientesLibro.map((r, i) => (
                                                <div key={i}
                                                    onClick={() => setSelectLibroIdx(selectLibroIdx === i ? null : i)}
                                                    className={`flex items-center justify-between rounded-xl px-3 py-2 cursor-pointer transition-all ${selectLibroIdx === i ? 'bg-blue-600/30 border border-blue-500/50' : 'bg-slate-900/50 border border-transparent hover:border-slate-600'}`}>
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${selectLibroIdx === i ? 'bg-blue-400 border-blue-400' : 'border-slate-600'}`} />
                                                        <span className="text-[9px] font-mono text-slate-500">{$fecha(r.fecha_local)}</span>
                                                        <span className="text-[10px] font-bold text-slate-300 truncate">{String(r.concepto || '').substring(0, 25)}</span>
                                                    </div>
                                                    <span className="text-[10px] font-mono font-bold text-slate-400">${parseFloat(r.debe_bs || r.haber_bs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Icon name="Landmark" size={14} className="text-amber-400" />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                            Pendientes en Banco ({agentResult.pendientesBanco.length})
                                        </p>
                                    </div>
                                    {agentResult.pendientesBanco.length === 0 ? (
                                        <p className="text-[10px] text-slate-600 font-bold text-center py-4">Sin pendientes</p>
                                    ) : (
                                        <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                                            {agentResult.pendientesBanco.map((t, i) => (
                                                <div key={i}
                                                    onClick={() => setSelectBancoIdx(selectBancoIdx === i ? null : i)}
                                                    className={`flex items-center justify-between rounded-xl px-3 py-2 cursor-pointer transition-all ${selectBancoIdx === i ? 'bg-emerald-600/30 border border-emerald-500/50' : 'bg-slate-900/50 border border-transparent hover:border-slate-600'}`}>
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${selectBancoIdx === i ? 'bg-emerald-400 border-emerald-400' : 'border-slate-600'}`} />
                                                        <span className="text-[9px] font-mono text-slate-500">{$fecha(t.fecha)}</span>
                                                        <span className="text-[10px] font-bold text-slate-300 truncate">{String(t.concepto || '').substring(0, 25)}</span>
                                                    </div>
                                                    <span className="text-[10px] font-mono font-bold text-slate-400">${(t.monto || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {selectLibroIdx !== null && selectBancoIdx !== null && (
                                        <div className="mt-3 flex justify-center">
                                            <button onClick={cruzarManual}
                                                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all">
                                                <Icon name="Link2" size={14} /> Cruzar Seleccionados
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            </>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3 justify-end">
                                {processedPdf ? (
                                    <>
                                        <button onClick={() => window.open(processedPdf.contenido, '_blank')}
                                            className="flex items-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all">
                                            <Icon name="Eye" size={14} /> Ver PDF
                                        </button>
                                        <button onClick={() => descargarPDF(processedPdf)}
                                            className="flex items-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all">
                                            <Icon name="FileDown" size={14} /> Descargar PDF
                                        </button>
                                        <button onClick={procesar} disabled={procesando}
                                            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-900/30">
                                            {procesando ? <><Icon name="Loader" size={14} className="animate-spin" /> Guardando...</> : <><Icon name="CheckCircle" size={16} /> Confirmar Conciliación</>}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => ejecutarAgente(selectedId)} disabled={executing}
                                            className="flex items-center gap-2 px-5 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all">
                                            {executing ? <><Icon name="Loader" size={14} className="animate-spin" /> Ejecutando...</> : <><Icon name="RefreshCw" size={14} /> Re-ejecutar Agente</>}
                                        </button>
                                        <button onClick={verPDFpreview}
                                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-900/30">
                                            <Icon name="FileSearch" size={16} /> Vista Previa PDF
                                        </button>
                                    </>
                                )}
                            </div>
                            </>
                            ) : (
                            /* ── Preview: Libro vs Banco ── */
                            <>
                            {previewLoading ? (
                                <div className="h-40 bg-slate-800/50 rounded-2xl animate-pulse" />
                            ) : (
                                <div className="space-y-5">

                                    {/* Book movements */}
                                    <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Icon name="BookOpen" size={14} className="text-blue-400" />
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider">
                                                Movimientos del Libro ({movimientosLibro.length})
                                            </p>
                                        </div>
                                        {movimientosLibro.length === 0 ? (
                                            <p className="text-[10px] text-slate-600 font-bold text-center py-4">Sin movimientos en el libro para este período</p>
                                        ) : (
                                            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="text-[9px] font-black text-slate-500 uppercase tracking-wider bg-slate-900/50 sticky top-0">
                                                            <th className="px-3 py-2">Fecha</th>
                                                            <th className="px-3 py-2">Concepto</th>
                                                            <th className="px-3 py-2 text-right">Debe Bs</th>
                                                            <th className="px-3 py-2 text-right">Haber Bs</th>
                                                            <th className="px-3 py-2 text-right">Saldo</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {movimientosLibro.map((r, i) => (
                                                            <tr key={i} className="border-t border-slate-700/30 text-[10px] text-slate-300">
                                                                <td className="px-3 py-1.5 font-mono">{$fecha(r.fecha_local)}</td>
                                                                <td className="px-3 py-1.5 font-bold truncate max-w-[200px]">{String(r.concepto || '').substring(0, 40)}</td>
                                                                <td className="px-3 py-1.5 text-right font-mono">{(parseFloat(r.debe_bs || 0)).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                                                                <td className="px-3 py-1.5 text-right font-mono">{(parseFloat(r.haber_bs || 0)).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                                                                <td className="px-3 py-1.5 text-right font-mono font-bold text-white">{(r._saldoCorriente || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Bank movements */}
                                    <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Icon name="Landmark" size={14} className="text-emerald-400" />
                                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                                                Movimientos del Banco{movimientosBanco?.transacciones ? ` (${movimientosBanco.transacciones.length})` : ''}
                                            </p>
                                            {movimientosBanco?._fuente === 'nvidia-vision' && (
                                                <span className="ml-auto text-[8px] font-black text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                                    NVIDIA Vision
                                                </span>
                                            )}
                                        </div>
                                        {movimientosBanco?._validacionError && (
                                            <div className="mb-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                                                <p className="text-[9px] font-bold text-rose-400">{movimientosBanco._validacionError}</p>
                                            </div>
                                        )}
                                        {movimientosBanco?._validacionWarning && (
                                            <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                                <p className="text-[9px] font-bold text-amber-400">{movimientosBanco._validacionWarning}</p>
                                            </div>
                                        )}
                                        {movimientosBanco?._iaError && (
                                            <div className="mb-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                                                <p className="text-[9px] font-bold text-rose-400">⚠️ NVIDIA no disponible. Usando parser automático.</p>
                                                <p className="text-[8px] text-rose-400/70 mt-1 font-mono">{movimientosBanco._iaError}</p>
                                            </div>
                                        )}
                                        {!movimientosBanco ? (
                                            <p className="text-[10px] text-slate-600 font-bold text-center py-4">No hay extracto bancario adjunto. Subí un archivo Excel/CSV en la conciliación.</p>
                                        ) : movimientosBanco._error ? (
                                            <p className="text-[10px] text-rose-400 font-bold text-center py-4">{movimientosBanco._error}</p>
                                        ) : movimientosBanco.needsMapping ? (
                                            <div className="text-center py-4">
                                                <p className="text-[10px] text-amber-400 font-bold mb-3">El formato del extracto no se reconoció automáticamente.</p>
                                                <button onClick={() => ejecutarAgente(selectedId)} disabled={executing}
                                                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all">
                                                    Configurar Mapeo
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="text-[9px] font-black text-slate-500 uppercase tracking-wider bg-slate-900/50 sticky top-0">
                                                            <th className="px-3 py-2">Fecha</th>
                                                            <th className="px-3 py-2">Concepto</th>
                                                            <th className="px-3 py-2 text-right">Monto Bs</th>
                                                            <th className="px-3 py-2">Tipo</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {movimientosBanco.transacciones.map((t, i) => (
                                                            <tr key={i} className="border-t border-slate-700/30 text-[10px] text-slate-300">
                                                                <td className="px-3 py-1.5 font-mono">{$fecha(t.fecha)}</td>
                                                                <td className="px-3 py-1.5 font-bold truncate max-w-[200px]">{String(t.concepto || '').substring(0, 40)}</td>
                                                                <td className="px-3 py-1.5 text-right font-mono">{(t.monto || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                                                                <td className="px-3 py-1.5">
                                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${t.tipo === 'debe' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                                                                        {t.tipo === 'debe' ? 'Depósito' : 'Retiro'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Ejecutar */}
                                    <div className="flex items-center gap-3 justify-end">
                                        <button onClick={() => { setSelectedId(null); setAgentResult(null); setProcessedPdf(null); setMappingConfig({}); setMappingFilaInicio(null); setMappingFormatoNumero(null); setMovimientosLibro([]); setMovimientosBanco(null); setSelectLibroIdx(null); setSelectBancoIdx(null); }}
                                            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all">
                                            <Icon name="ArrowLeft" size={14} /> Volver
                                        </button>
                                        {concSelected?.archivos?.length > 0 && (
                                            <button onClick={() => ejecutarAgente(selectedId)} disabled={executing}
                                                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-900/30">
                                                {executing ? <><Icon name="Loader" size={14} className="animate-spin" /> Ejecutando...</> : <><Icon name="Bot" size={16} /> Ejecutar Agente</>}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                            </>
                            )}
                        </div>
                    ) : (
                        /* ── List View ── */
                        <div className="space-y-4">
                            {cuentas.length === 0 ? (
                                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center">
                                    <Icon name="Landmark" size={40} className="text-slate-700 mx-auto mb-3" />
                                    <p className="text-sm font-black text-slate-400 uppercase">Sin cuentas bancarias</p>
                                    <p className="text-xs text-slate-600 font-bold mt-1">Clasifica una cuenta como "Banco" en el Plan de Cuentas</p>
                                </div>
                            ) : cuentas.map(cuenta => {
                                const conc = getConciliacion(cuenta.codigo);
                                const est = conc?.estado || 'pendiente';
                                const archivos = conc?.archivos || [];
                                const extractos = archivos.filter(a => a.tipo !== 'application/pdf');
                                const pdfs = archivos.filter(a => a.tipo === 'application/pdf');
                                const yaConciliado = est === 'conciliado';
                                const tieneResultados = conc?.resultados;

                                return (
                                    <div key={cuenta.codigo}
                                        onClick={() => seleccionarCuenta(cuenta.codigo)}
                                        className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 hover:border-blue-500/50 transition-all cursor-pointer">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-1.5">
                                                    <p className="text-sm font-black text-white">{cuenta.nombre}</p>
                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${badgeEst(est)}`}>{labelEst(est)}</span>
                                                </div>
                                                <p className="text-[10px] font-mono text-slate-500 mb-3">{cuenta.codigo} · {labelPeriodo}</p>

                                                {extractos.length > 0 && (
                                                    <div className="flex gap-2 flex-wrap mb-3">
                                                        {extractos.map((a, i) => (
                                                             <button key={i} onClick={(e) => { e.stopPropagation(); descargarPDF(a); }}
                                                                 className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/80 rounded-lg text-[9px] font-bold text-blue-400 hover:bg-slate-800 transition-colors border border-slate-700/50">
                                                                <Icon name="File" size={10} /> {a.nombre}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {tieneResultados && (
                                                    <div className="flex gap-3 text-[9px] text-slate-500 font-bold">
                                                        <span>{conc.resultados.totalCruces || 0} cruces</span>
                                                        <span>·</span>
                                                        <span>{conc.resultados.totalPendientesLibro || 0} pend. libro</span>
                                                        <span>·</span>
                                                        <span>{conc.resultados.totalPendientesBanco || 0} pend. banco</span>
                                                    </div>
                                                )}

                                                {pdfs.length > 0 && (
                                                    <div className="flex gap-2 flex-wrap mt-2">
                                                        {pdfs.map((a, i) => (
                                                             <button key={i} onClick={(e) => { e.stopPropagation(); descargarPDF(a); }}
                                                                 className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 rounded-lg text-[9px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20">
                                                                <Icon name="FileDown" size={10} /> {a.nombre}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-shrink-0">
                                                <button onClick={(e) => { e.stopPropagation(); ejecutarAgente(cuenta.codigo); }} disabled={executing}
                                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                                        yaConciliado
                                                            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                                            : extractos.length > 0
                                                                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30'
                                                                : 'bg-slate-700 text-slate-400'
                                                    }`}>
                                                    {executing ? (
                                                        <><Icon name="Loader" size={14} className="animate-spin" /> Ejecutando...</>
                                                    ) : yaConciliado ? (
                                                        <><Icon name="CheckCircle" size={14} /> Conciliado</>
                                                    ) : extractos.length > 0 ? (
                                                        <><Icon name="Bot" size={14} /> Ejecutar Agente</>
                                                    ) : (
                                                        <><Icon name="File" size={14} /> Sin Extracto</>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
};

window.AuditorConciliacionesView = AuditorConciliacionesView;
