const AuditorAuditoriasView = ({ empresa }) => {
    const empresaRif = empresa?.rif || '';
    const [journal, setJournal] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [filtroSeveridad, setFiltroSeveridad] = React.useState('');

    React.useEffect(() => {
        if (!empresaRif) { setLoading(false); return; }
        sbFetch(`journal?rif=eq.${encodeURIComponent(empresaRif)}&order=fecha_local.desc&limit=5000`)
            .then(data => { setJournal(data || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [empresaRif]);

    const AccountingEngine = window.AccountingEngine || {
        analizar: () => [], calcularBIE: () => ({ score: 0, categoria: 'D', indicadores: {} }),
    };

    const hallazgos = React.useMemo(() => AccountingEngine.analizar(journal, empresaRif), [journal, empresaRif, AccountingEngine]);
    const bie = React.useMemo(() => AccountingEngine.calcularBIE(journal, hallazgos), [journal, hallazgos, AccountingEngine]);

    const filtrados = filtroSeveridad ? hallazgos.filter(h => h.nivel === filtroSeveridad) : hallazgos;
    const criticos = hallazgos.filter(h => h.nivel === 'critico').length;
    const altos = hallazgos.filter(h => h.nivel === 'alto').length;
    const medios = hallazgos.filter(h => h.nivel === 'medio').length;
    const info = hallazgos.filter(h => h.nivel === 'info').length;

    const $fecha2 = (s) => s ? new Date(s).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
    const badgeNivel = (nivel) => {
        const map = {
            critico: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
            alto: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
            medio: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
            info: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        };
        return map[nivel] || 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    };

    if (loading) return <div className="h-40 bg-slate-800/50 rounded-2xl animate-pulse" />;

    return (
        <main className="flex-1 h-full overflow-hidden flex flex-col bg-slate-950 relative">
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 z-10">
                <div className="max-w-6xl mx-auto space-y-6 animate-in">

                    <div className="flex items-center justify-between gap-4 mb-2">
                        <div>
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Auditoría</p>
                            <h1 className="text-xl font-black text-white tracking-tight mt-0.5">
                                {empresa?.razon_social || empresaRif}
                            </h1>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">BIE Score</p>
                            <p className={`text-lg font-black ${
                                bie.categoria === 'A' ? 'text-emerald-400' :
                                bie.categoria === 'B' ? 'text-blue-400' :
                                bie.categoria === 'C' ? 'text-amber-400' : 'text-rose-400'
                            }`}>{bie.score} <span className="text-sm text-slate-600">/{bie.categoria}</span></p>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Críticos', value: criticos, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', icon: 'AlertTriangle' },
                            { label: 'Altos', value: altos, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', icon: 'AlertCircle' },
                            { label: 'Medios', value: medios, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: 'Info' },
                            { label: 'Informativos', value: info, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: 'MessageCircle' },
                        ].map((s, i) => (
                            <div key={i} className={`${s.bg} rounded-2xl p-5 border`}>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{s.label}</p>
                                    <Icon name={s.icon} size={16} className={s.color} />
                                </div>
                                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="flex gap-2 flex-wrap">
                        {[
                            { id: '', label: 'Todos', count: hallazgos.length },
                            { id: 'critico', label: 'Críticos', count: criticos },
                            { id: 'alto', label: 'Altos', count: altos },
                            { id: 'medio', label: 'Medios', count: medios },
                            { id: 'info', label: 'Info', count: info },
                        ].map(f => (
                            <button key={f.id} onClick={() => setFiltroSeveridad(f.id)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                                    filtroSeveridad === f.id
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                                        : 'bg-slate-800/50 text-slate-400 hover:text-white border border-slate-700/50'
                                }`}>
                                {f.label} ({f.count})
                            </button>
                        ))}
                    </div>

                    {/* Hallazgos */}
                    {filtrados.length === 0 ? (
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center">
                            <Icon name="CheckCircle" size={40} className="text-emerald-500 mx-auto mb-3" />
                            <p className="text-sm font-black text-white uppercase">Sin hallazgos</p>
                            <p className="text-xs text-slate-500 font-bold mt-1">No se detectaron inconsistencias en el journal</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filtrados.map((h, i) => (
                                <div key={`${h.ref}-${i}`} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 hover:border-slate-600/50 transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${badgeNivel(h.nivel)}`}>
                                                    {h.nivel}
                                                </span>
                                                <span className="text-[10px] font-black text-white uppercase">{h.tipo}</span>
                                            </div>
                                            <p className="text-xs text-slate-300 font-bold">{h.msg}</p>
                                            <div className="flex items-center gap-3 mt-1.5 text-[9px] text-slate-600 font-bold">
                                                {h.ref && <span>Ref: {h.ref}</span>}
                                                {h.fecha && <span>{$fecha2(h.fecha)}</span>}
                                            </div>
                                        </div>
                                        <Icon name="ChevronRight" size={16} className="text-slate-600 flex-shrink-0" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Summary */}
                    <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-5">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Resumen de indicadores</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {Object.entries(bie.indicadores || {}).map(([k, v]) => (
                                <div key={k} className="text-center">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{k.replace(/([A-Z])/g, ' $1').trim()}</p>
                                    <p className="text-sm font-black text-white mt-0.5">{v}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

window.AuditorAuditoriasView = AuditorAuditoriasView;
