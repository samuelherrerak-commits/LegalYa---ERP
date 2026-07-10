const AuditorDeclaracionesView = ({ empresa }) => {
    const empresaRif = empresa?.rif || '';
    const [declaraciones, setDeclaraciones] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [ejecutando, setEjecutando] = React.useState(false);
    const [tipoSeleccionado, setTipoSeleccionado] = React.useState('IVA');
    const [resultadoAgente, setResultadoAgente] = React.useState(null);
    const [procesando, setProcesando] = React.useState(false);
    const [processedPdf, setProcessedPdf] = React.useState(null);
    const [mensaje, setMensaje] = React.useState('');
    const [editable, setEditable] = React.useState(null);

    const periodo = AuditorAgents.obtenerPeriodoAnterior();
    const labelPeriodo = AuditorAgents.labelPeriodo(periodo);

    React.useEffect(() => {
        if (!empresaRif) { setLoading(false); return; }
        sbFetch(`declaraciones?empresa_rif=eq.${encodeURIComponent(empresaRif)}&order=fecha_emision.desc`)
            .then(data => { setDeclaraciones(data || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [empresaRif]);

    const ejecutarAgente = async () => {
        setEjecutando(true);
        setResultadoAgente(null);
        setProcessedPdf(null);
        setMensaje('');
        setEditable(null);
        try {
            const result = await AuditorAgents.agenteDeclaraciones(empresaRif, periodo, tipoSeleccionado);
            if (result) {
                setResultadoAgente(result);
                setEditable({
                    ...(tipoSeleccionado === 'IVA' ? { ivaAPagar: result.ivaAPagar } : { islrEstimado: result.islrEstimado }),
                });
                setMensaje(`Cálculo de ${tipoSeleccionado} completado`);
            } else {
                setMensaje('No se pudieron calcular las declaraciones');
            }
        } catch (e) {
            setMensaje('Error: ' + e.message);
        }
        setEjecutando(false);
    };

    const handleEditChange = (campo, valor) => {
        setEditable(prev => ({ ...prev, [campo]: parseFloat(valor) || 0 }));
    };

    const procesar = async () => {
        setProcesando(true);
        try {
            const dataFinal = { ...resultadoAgente };
            if (tipoSeleccionado === 'IVA') dataFinal.ivaAPagar = editable?.ivaAPagar || dataFinal.ivaAPagar;
            else dataFinal.islrEstimado = editable?.islrEstimado || dataFinal.islrEstimado;

            const pdfDoc = window.AuditorPDF.generarDeclaracionPDF(dataFinal, empresa, empresa?.auditor || 'Auditor');
            const pdfFile = window.AuditorPDF.guardarPDF(pdfDoc, `declaracion_${tipoSeleccionado}_${periodo}.pdf`);

            await sbFetch('declaraciones', {
                method: 'POST', prefer: 'return=minimal',
                body: JSON.stringify({
                    empresa_rif: empresaRif,
                    tipo: tipoSeleccionado,
                    periodo,
                    estado: 'emitida',
                    fecha_emision: new Date().toISOString(),
                    monto: tipoSeleccionado === 'IVA' ? dataFinal.ivaAPagar : dataFinal.islrEstimado,
                    archivos: [pdfFile],
                    detalle: dataFinal,
                }),
            });

            setProcessedPdf(pdfFile);
            setMensaje(`Declaración de ${tipoSeleccionado} emitida exitosamente`);

            const updated = await sbFetch(`declaraciones?empresa_rif=eq.${encodeURIComponent(empresaRif)}&order=fecha_emision.desc`);
            setDeclaraciones(updated || []);
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

    const $fmt = (n) => (n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const $fecha2 = (s) => s ? new Date(s).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

    if (loading) return <div className="h-40 bg-slate-800/50 rounded-2xl animate-pulse" />;

    const tiposIVA = [...new Set(declaraciones.filter(d => d.tipo === 'IVA').map(d => d.periodo))];
    const tiposISLR = [...new Set(declaraciones.filter(d => d.tipo === 'ISLR').map(d => d.periodo))];
    const yaExisteIVA = tiposIVA.includes(periodo);
    const yaExisteISLR = tiposISLR.includes(periodo);

    return (
        <main className="flex-1 h-full overflow-hidden flex flex-col bg-slate-950 relative">
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 z-10">
                <div className="max-w-6xl mx-auto space-y-6 animate-in">

                    <div className="flex items-center justify-between gap-4 mb-2">
                        <div>
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Declaraciones y Obligaciones</p>
                            <h1 className="text-xl font-black text-white tracking-tight mt-0.5">Período: {labelPeriodo}</h1>
                        </div>
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

                    {/* Agent Controls */}
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-3">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Agente Declaraciones</p>
                                <div className="flex gap-1.5">
                                    {['IVA', 'ISLR'].map(t => (
                                        <button key={t} onClick={() => { setTipoSeleccionado(t); setResultadoAgente(null); setProcessedPdf(null); }}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                                                tipoSeleccionado === t
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                                                    : 'bg-slate-700 text-slate-400 hover:text-white'
                                            }`}>
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button onClick={ejecutarAgente} disabled={ejecutando}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                    ejecutando
                                        ? 'bg-slate-700 text-slate-500'
                                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30'
                                }`}>
                                {ejecutando ? (
                                    <><Icon name="Loader" size={14} className="animate-spin" /> Calculando...</>
                                ) : (
                                    <><Icon name="Bot" size={14} /> Ejecutar Agente {tipoSeleccionado}</>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Agent Results */}
                    {resultadoAgente && (
                        <div className="space-y-4">
                            {tipoSeleccionado === 'IVA' ? (
                                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                                    <p className="text-[10px] font-black text-white uppercase tracking-wider mb-4">Cálculo de IVA — {labelPeriodo}</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                                        {[
                                            { label: 'Total Ventas', value: resultadoAgente.totalVentas, color: 'text-blue-400' },
                                            { label: 'IVA Débito (16%)', value: resultadoAgente.ivaDebito, color: 'text-amber-400' },
                                            { label: 'Total Gastos', value: resultadoAgente.totalGastos, color: 'text-slate-400' },
                                            { label: 'IVA Crédito (16%)', value: resultadoAgente.ivaCredito, color: 'text-amber-400' },
                                        ].map((s, i) => (
                                            <div key={i} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{s.label}</p>
                                                <p className={`text-lg font-black ${s.color}`}>${$fmt(s.value)}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-5 mb-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider">IVA a Pagar</p>
                                                <p className="text-xs text-blue-300 font-bold mt-0.5">Monto calculado: ${$fmt(resultadoAgente.ivaAPagar)}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <p className="text-[9px] font-black text-slate-500 uppercase">Monto Final:</p>
                                                <input type="number" step="0.01" value={editable?.ivaAPagar || 0}
                                                    onChange={e => handleEditChange('ivaAPagar', e.target.value)}
                                                    className="w-36 bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm font-black text-right outline-none focus:border-blue-500" />
                                            </div>
                                        </div>
                                        <p className="text-[9px] text-slate-600 mt-2 font-bold">Puedes modificar el monto final antes de procesar</p>
                                    </div>

                                    {resultadoAgente.detalle?.length > 0 && (
                                        <div>
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2">Detalle de transacciones</p>
                                            <div className="overflow-x-auto max-h-[250px] overflow-y-auto">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="text-[9px] font-black text-slate-500 uppercase tracking-wider bg-slate-900/50">
                                                            <th className="px-3 py-2">Fecha</th>
                                                            <th className="px-3 py-2">Concepto</th>
                                                            <th className="px-3 py-2">Cuenta</th>
                                                            <th className="px-3 py-2 text-right">Monto ($)</th>
                                                            <th className="px-3 py-2">Tipo</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {resultadoAgente.detalle.map((r, i) => (
                                                            <tr key={i} className="border-t border-slate-700/30 text-[10px] text-slate-300">
                                                                <td className="px-3 py-1.5 font-mono">{$fecha2(r.fecha)}</td>
                                                                <td className="px-3 py-1.5 font-bold max-w-[150px] truncate">{r.concepto}</td>
                                                                <td className="px-3 py-1.5 font-mono text-slate-500">{r.codigo}</td>
                                                                <td className="px-3 py-1.5 text-right font-mono">${$fmt(r.monto)}</td>
                                                                <td className="px-3 py-1.5">
                                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${r.tipo === 'Venta' ? 'text-blue-400 bg-blue-500/10' : 'text-orange-400 bg-orange-500/10'}`}>
                                                                        {r.tipo}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                                    <p className="text-[10px] font-black text-white uppercase tracking-wider mb-4">Cálculo de ISLR — {labelPeriodo}</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                                        {[
                                            { label: 'Ingresos', value: resultadoAgente.ingresos, color: 'text-emerald-400' },
                                            { label: 'Costos', value: resultadoAgente.costos, color: 'text-rose-400' },
                                            { label: 'Gastos', value: resultadoAgente.gastos, color: 'text-rose-400' },
                                            { label: 'Renta Neta', value: resultadoAgente.rentaNeta, color: resultadoAgente.rentaNeta > 0 ? 'text-emerald-400' : 'text-slate-400' },
                                        ].map((s, i) => (
                                            <div key={i} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{s.label}</p>
                                                <p className={`text-lg font-black ${s.color}`}>${$fmt(s.value)}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-5 mb-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider">ISLR Estimado</p>
                                                <p className="text-xs text-blue-300 font-bold mt-0.5">Tasa: 25% · Calculado: ${$fmt(resultadoAgente.islrEstimado)}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <p className="text-[9px] font-black text-slate-500 uppercase">Monto Final:</p>
                                                <input type="number" step="0.01" value={editable?.islrEstimado || 0}
                                                    onChange={e => handleEditChange('islrEstimado', e.target.value)}
                                                    className="w-36 bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm font-black text-right outline-none focus:border-blue-500" />
                                            </div>
                                        </div>
                                        <p className="text-[9px] text-slate-600 mt-2 font-bold">Puedes modificar el monto final antes de procesar</p>
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3 justify-end">
                                {processedPdf ? (
                                    <button onClick={() => descargarPDF(processedPdf)}
                                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all">
                                        <Icon name="FileDown" size={16} /> Descargar PDF
                                    </button>
                                ) : (
                                    <button onClick={procesar} disabled={procesando}
                                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-900/30">
                                        {procesando ? <><Icon name="Loader" size={14} className="animate-spin" /> Emitiendo...</> : <><Icon name="CheckCircle" size={16} /> Emitir Declaración y Generar PDF</>}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Historical Declarations */}
                    {declaraciones.length > 0 && (
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3">Declaraciones emitidas</p>
                            <div className="space-y-2">
                                {declaraciones.map(d => (
                                    <div key={d.id} className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs font-black text-white uppercase">{d.tipo}</span>
                                            <span className="text-[10px] font-mono text-slate-500">{d.periodo}</span>
                                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border text-blue-400 bg-blue-500/10 border-blue-500/20">{d.estado}</span>
                                            {d.monto && <span className="text-[10px] font-mono font-bold text-slate-400">${$fmt(d.monto)}</span>}
                                            <span className="text-[9px] text-slate-600 font-bold">{$fecha2(d.fecha_emision)}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            {(d.archivos || []).map((a, i) => (
                                                <button key={i} onClick={() => descargarPDF(a)}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 rounded-lg text-[9px] font-bold text-blue-400 hover:bg-slate-700 transition-colors border border-slate-700/50">
                                                    <Icon name="FileDown" size={10} /> {a.nombre}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
};

window.AuditorDeclaracionesView = AuditorDeclaracionesView;
