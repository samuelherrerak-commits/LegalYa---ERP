const AccountingEngine = {
    analizar: (journal, empresaRif) => {
        const hallazgos = [];
        const refs = {};

        journal.forEach(r => {
            const ref = r.ref_doc || 'SIN-REF';
            if (!refs[ref]) refs[ref] = { debe: 0, haber: 0, concepto: r.concepto || '', fecha: r.fecha_local };
            refs[ref].debe += parseFloat(r.debe_usd) || 0;
            refs[ref].haber += parseFloat(r.haber_usd) || 0;
        });

        Object.entries(refs).forEach(([ref, v]) => {
            const dif = Math.abs(v.debe - v.haber);
            if (dif > 0.05 && ref !== 'SIN-REF') {
                hallazgos.push({
                    nivel: 'critico',
                    tipo: 'Asiento descuadrado',
                    ref,
                    msg: `Diferencia de $${dif.toFixed(2)}`,
                    fecha: v.fecha,
                });
            }
        });

        journal.filter(r => !r.ref_doc).slice(0, 8).forEach(r =>
            hallazgos.push({
                nivel: 'medio',
                tipo: 'Sin referencia',
                ref: r.id || '—',
                msg: (r.concepto || '').substring(0, 50),
                fecha: r.fecha_local,
            })
        );

        const cuentasSaldoNeg = {};
        journal.forEach(r => {
            const cc = r.codigo_cuenta || '';
            if (!cuentasSaldoNeg[cc]) cuentasSaldoNeg[cc] = { debe: 0, haber: 0, nombre: cc };
            cuentasSaldoNeg[cc].debe += parseFloat(r.debe_usd) || 0;
            cuentasSaldoNeg[cc].haber += parseFloat(r.haber_usd) || 0;
        });
        Object.entries(cuentasSaldoNeg).forEach(([cc, v]) => {
            if (v.debe < v.haber && ['1.1.01.01', '1.1.01.02', '1.1.01.03'].includes(cc)) {
                hallazgos.push({
                    nivel: 'info',
                    tipo: 'Saldo negativo',
                    ref: cc,
                    msg: `Cuenta ${cc} tiene saldo negativo ($${(v.debe - v.haber).toFixed(2)})`,
                    fecha: null,
                });
            }
        });

        return hallazgos.sort((a, b) => {
            const orden = { critico: 0, medio: 1, info: 2 };
            return (orden[a.nivel] || 0) - (orden[b.nivel] || 0);
        }).slice(0, 20);
    },

    calcularBIE: (journal, hallazgos) => {
        if (!journal || journal.length === 0) return { score: 0, categoria: 'D', indicadores: {} };
        const totalMovs = journal.length;
        const fechas = journal.map(r => r.fecha_local).filter(Boolean).sort();
        const ultimaFecha = fechas.length > 0 ? new Date(fechas[fechas.length - 1]) : null;
        const diasDesdeUltima = ultimaFecha ? Math.floor((Date.now() - ultimaFecha.getTime()) / 86400000) : 999;
        const descuadres = hallazgos.filter(h => h.nivel === 'critico').length;
        const sinRef = hallazgos.filter(h => h.nivel === 'medio').length;

        let score = 50;
        if (totalMovs > 0) score += Math.min(20, totalMovs / 10);
        if (diasDesdeUltima <= 1) score += 10;
        else if (diasDesdeUltima <= 7) score += 5;
        else if (diasDesdeUltima > 30) score -= 10;
        if (descuadres === 0) score += 10;
        else score -= Math.min(15, descuadres * 5);
        if (sinRef === 0) score += 5;
        else score -= Math.min(5, sinRef);
        score = Math.max(0, Math.min(100, Math.round(score)));

        const categoria = score >= 85 ? 'A' : score >= 65 ? 'B' : score >= 40 ? 'C' : 'D';
        return { score, categoria, indicadores: { totalMovs, descuadres, sinRef, diasDesdeUltima } };
    }
};

window.AccountingEngine = AccountingEngine;

const NAV_ITEMS = [
    { id: 'dashboard', icon: 'LayoutDashboard', label: 'Dashboard' },
    { id: 'diario', icon: 'BookOpen', label: 'Diario' },
    { id: 'solicitudes', icon: 'FileText', label: 'Solicitudes' },
    { id: 'obligaciones', icon: 'Receipt', label: 'Obligaciones' },
    { id: 'conciliaciones', icon: 'Landmark', label: 'Conciliaciones' },
    { id: 'ef', icon: 'FileBarChart', label: 'E. Financieros' },
    { id: 'auditorias', icon: 'Search', label: 'Auditorías' },
    { id: 'documentos', icon: 'FolderOpen', label: 'Documentos' },
    { id: 'historial', icon: 'Clock', label: 'Historial' },
    { id: 'config', icon: 'Settings', label: 'Configuración' },
];

const AuditorSidebar = ({ currentView, onNavigate, onCambiarEmpresa, onLogout, empresa }) => {
    const empresaName = empresa?.razon_social || empresa?.nombre_comercial || 'Empresa';
    const codigo = empresa?.codigo_registro;

    return (
        <aside className="w-64 flex-shrink-0 bg-black/40 border-r border-white/[0.05] flex flex-col h-screen backdrop-blur-xl">
            <div className="h-20 flex items-center px-6 border-b border-white/[0.05]">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/50">
                        <Icon name="Shield" size={18} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-white tracking-wider leading-none">LEGALYA</h1>
                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mt-0.5">Auditor Suite</p>
                    </div>
                </div>
            </div>

            <div className="px-4 py-4 border-b border-white/[0.05]">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">{empresaName}</p>
                {codigo && <p className="text-[9px] font-mono text-slate-600 mt-0.5">{codigo}</p>}
            </div>

            <div className="flex-1 overflow-y-auto py-4 px-4 space-y-1">
                {NAV_ITEMS.map(item => {
                    const isActive = currentView === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                                isActive
                                    ? 'bg-blue-600/10 text-blue-400 shadow-sm'
                                    : 'text-slate-400 hover:bg-white/[0.02] hover:text-slate-200'
                            }`}
                        >
                            <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                                <Icon name={item.icon} size={18} />
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-wider mt-0.5">{item.label}</span>
                            {isActive && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="p-4 border-t border-white/[0.05] space-y-2">
                <button
                    onClick={onCambiarEmpresa}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider text-slate-500 hover:bg-white/[0.02] hover:text-amber-400 transition-all duration-200"
                >
                    <Icon name="Building2" size={16} />
                    Cambiar Empresa
                </button>
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider text-slate-500 hover:bg-white/[0.02] hover:text-rose-400 transition-all duration-200"
                >
                    <Icon name="LogOut" size={16} />
                    Cerrar Sesión
                </button>
            </div>
        </aside>
    );
};

const DashboardSkeleton = () => (
    <div className="p-8 space-y-6 animate-in">
        <div className="h-8 w-64 bg-slate-800/50 rounded-lg animate-pulse" />
        <div className="h-4 w-48 bg-slate-800/50 rounded-lg animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-800/50 rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-52 bg-slate-800/50 rounded-2xl animate-pulse" />
    </div>
);

const HallazgoItem = ({ hallazgo, index }) => {
    const cfg = {
        critico: { color: 'text-rose-400', bg: 'bg-rose-500/5', border: 'border-rose-500/20', dot: 'bg-rose-400', label: 'CRÍTICO' },
        medio: { color: 'text-amber-400', bg: 'bg-amber-500/5', border: 'border-amber-500/20', dot: 'bg-amber-400', label: 'MEDIO' },
        info: { color: 'text-blue-400', bg: 'bg-blue-500/5', border: 'border-blue-500/20', dot: 'bg-blue-400', label: 'INFO' },
    };
    const c = cfg[hallazgo.nivel] || cfg.info;

    return (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${c.bg} ${c.border}`}
            style={{ animation: `fadeIn 0.3s ease forwards`, animationDelay: `${index * 50}ms`, opacity: 0 }}>
            <div className={`w-2 h-2 rounded-full ${c.dot} mt-1.5 flex-shrink-0`} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[9px] font-black uppercase tracking-wider ${c.color}`}>{c.label}</span>
                    <span className="text-[9px] font-mono text-slate-600">{hallazgo.ref}</span>
                </div>
                <p className="text-xs font-bold text-slate-300">{hallazgo.msg}</p>
                <p className="text-[9px] text-slate-600 font-bold mt-0.5">{hallazgo.tipo}</p>
            </div>
        </div>
    );
};

const VencimientoItem = ({ label, fecha, empresa, urgente }) => (
    <div className="flex items-center gap-4 px-5 py-3.5 bg-slate-900 border border-slate-800 rounded-2xl hover:border-slate-600 transition-colors">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
            urgente ? 'bg-rose-500/10 border-rose-500/20' : 'bg-slate-800 border-slate-700'
        }`}>
            <p className={`text-[9px] font-black text-center leading-tight ${urgente ? 'text-rose-400' : 'text-slate-400'}`}>{fecha}</p>
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-white">{label}</p>
            <p className="text-[10px] text-slate-500 truncate font-bold">{empresa}</p>
        </div>
        {urgente && (
            <span className="text-[9px] font-black text-rose-400 uppercase bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 flex-shrink-0">
                Urgente
            </span>
        )}
    </div>
);

const DashboardView = ({ empresa }) => {
    const [journal, setJournal] = useState([]);
    const [loading, setLoading] = useState(true);
    const empresaRif = empresa?.rif || '';
    const empresaName = empresa?.razon_social || empresa?.nombre_comercial || empresaRif;
    const codigo = empresa?.codigo_registro;
    const bieAlmacenado = parseFloat(empresa?.bie_actual) || null;
    const iccAlmacenado = parseFloat(empresa?.icc_actual) || null;

    useEffect(() => {
        setLoading(true);
        if (!empresaRif) { setLoading(false); return; }
        sbFetch(`journal?rif=eq.${encodeURIComponent(empresaRif)}&order=fecha_local.desc&limit=5000`)
            .then(data => { setJournal(data || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [empresaRif]);

    const hallazgos = useMemo(() => AccountingEngine.analizar(journal, empresaRif), [journal, empresaRif]);
    const bieCalculado = useMemo(() => AccountingEngine.calcularBIE(journal, hallazgos), [journal, hallazgos]);
    const criticos = hallazgos.filter(h => h.nivel === 'critico').length;
    const medios = hallazgos.filter(h => h.nivel === 'medio').length;

    const bieDisplay = bieAlmacenado !== null
        ? { score: bieAlmacenado, categoria: bieAlmacenado >= 85 ? 'A' : bieAlmacenado >= 65 ? 'B' : bieAlmacenado >= 40 ? 'C' : 'D' }
        : bieCalculado;

    const ultimaSync = empresa?.ultima_sincronizacion
        ? (() => {
            const d = new Date(empresa.ultima_sincronizacion);
            const diff = Math.floor((Date.now() - d.getTime()) / 60000);
            if (diff < 1) return 'Ahora';
            if (diff < 60) return `Hace ${diff} min`;
            const h = Math.floor(diff / 60);
            if (h < 24) return `Hace ${h} h`;
            return `${Math.floor(h / 24)} días atrás`;
        })()
        : (() => {
            const fechas = journal.map(r => r.fecha_local).filter(Boolean).sort();
            const ultima = fechas.length > 0 ? new Date(fechas[fechas.length - 1]) : null;
            if (!ultima) return 'Sin datos';
            const diff = Math.floor((Date.now() - ultima.getTime()) / 60000);
            if (diff < 1) return 'Ahora';
            if (diff < 60) return `Hace ${diff} min`;
            const h = Math.floor(diff / 60);
            if (h < 24) return `Hace ${h} h`;
            return `${Math.floor(h / 24)} días atrás`;
        })();

    const vencimientos = [
        { label: 'IVA Mensual', fecha: '08/07', empresa: empresaName, urgente: true },
        { label: 'ISLR Estimada', fecha: '15/07', empresa: empresaName, urgente: false },
        { label: 'Retenciones IVA', fecha: '15/07', empresa: empresaName, urgente: false },
        { label: 'Estados Financieros', fecha: '30/07', empresa: empresaName, urgente: false },
    ];

    if (loading) return <DashboardSkeleton />;

    return (
        <main className="flex-1 h-full overflow-hidden flex flex-col bg-slate-950 relative">
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 z-10">
                <div className="max-w-6xl mx-auto animate-in">
                    <div className="flex items-start justify-between gap-4 mb-8">
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Empresa Activa</p>
                            <h1 className="text-2xl font-black text-white tracking-tight">{empresaName}</h1>
                            <p className="text-xs font-bold text-slate-500">
                                RIF: {empresaRif}
                                {codigo && <span className="ml-4 text-slate-600">{codigo}</span>}
                            </p>
                            {empresa?.nombre_comercial && empresa.nombre_comercial !== empresa.razon_social && (
                                <p className="text-[10px] font-bold text-slate-600">{empresa.nombre_comercial}</p>
                            )}
                        </div>
                        <div className="text-right flex items-center gap-4">
                            <div className={`px-3 py-1.5 rounded-xl border font-black text-sm ${
                                bieDisplay.categoria === 'A' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                                bieDisplay.categoria === 'B' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                                bieDisplay.categoria === 'C' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }`}>
                                <span className="text-[10px] font-black uppercase tracking-wider">BIE</span>
                                <span className="text-lg ml-2">{bieDisplay.score}</span>
                                <span className="text-[9px] text-slate-500 ml-1">/{bieCalculado.score}</span>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Últ. sinc</p>
                                <p className="text-xs font-bold text-slate-300">{ultimaSync}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <KpiCard label="Solicitudes" value="0" icon="FileText" color="text-blue-400" sub="pendientes" />
                        <KpiCard label="Declaraciones" value="0" icon="Receipt" color="text-amber-400" sub="pendientes" />
                        <KpiCard label="Conciliaciones" value="0" icon="Landmark" color="text-emerald-400" sub="pendientes" />
                        <KpiCard label="Hallazgos" value={hallazgos.length} icon="AlertTriangle" color={criticos > 0 ? 'text-rose-400' : 'text-slate-400'} sub={`${criticos} críticos · ${medios} medios`} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Alertas y Hallazgos</p>
                                <span className="text-[10px] font-bold text-slate-600">{hallazgos.length} detectados</span>
                            </div>
                            {hallazgos.length === 0 ? (
                                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
                                    <Icon name="CheckCircle" size={32} className="text-emerald-500 mx-auto mb-3" />
                                    <p className="text-sm font-black text-white uppercase">Sin hallazgos</p>
                                    <p className="text-xs text-slate-500 font-bold mt-1">No se detectaron inconsistencias en el journal</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {hallazgos.map((h, i) => (
                                        <HallazgoItem key={`${h.ref}-${i}`} hallazgo={h} index={i} />
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Vencimientos</p>
                                <span className="text-[10px] font-bold text-slate-600">{vencimientos.filter(v => v.urgente).length} urgentes</span>
                            </div>
                            <div className="space-y-2 mb-6">
                                {vencimientos.map((v, i) => (
                                    <VencimientoItem key={i} {...v} />
                                ))}
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Resumen de actividad</p>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { label: 'Movimientos', value: journal.length, color: 'text-blue-400' },
                                        { label: 'Última actividad', value: `${bieCalculado.indicadores.diasDesdeUltima}d`, color: 'text-slate-300' },
                                        { label: 'Críticos', value: criticos, color: criticos > 0 ? 'text-rose-400' : 'text-emerald-400' },
                                        { label: 'ICC', value: iccAlmacenado !== null ? iccAlmacenado : '—', color: 'text-slate-300' },
                                    ].map((s, i) => (
                                        <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
                                            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mt-1">{s.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

const PlaceholderView = ({ title, icon }) => (
    <main className="flex-1 h-full overflow-hidden flex flex-col bg-slate-950 relative">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 z-10">
            <div className="max-w-6xl mx-auto animate-in">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center">
                    <Icon name={icon || 'FileText'} size={48} className="text-slate-700 mx-auto mb-4" />
                    <h2 className="text-xl font-black text-slate-400 uppercase tracking-widest mb-2">{title}</h2>
                    <p className="text-sm text-slate-600 font-bold">Disponible en una próxima fase</p>
                </div>
            </div>
        </div>
    </main>
);

const AuditorLayout = ({ onLogout }) => {
    const { empresaActiva, clearEmpresa } = useAuditor();
    const [currentView, setCurrentView] = useState('dashboard');
    const [viewKey, setViewKey] = useState(0);

    const handleNavigate = (view) => {
        setCurrentView(view);
        setViewKey(p => p + 1);
    };

    const renderContent = () => {
        switch (currentView) {
            case 'dashboard': return <DashboardView key={viewKey} empresa={empresaActiva} />;
            case 'diario': return <AuditorDiarioView key={viewKey} empresa={empresaActiva} />;
            case 'solicitudes': return <PlaceholderView title="Solicitudes" icon="FileText" />;
            case 'obligaciones': return <AuditorDeclaracionesView key={viewKey} empresa={empresaActiva} />;
            case 'conciliaciones': return <AuditorConciliacionesView key={viewKey} empresa={empresaActiva} />;
            case 'ef': return <PlaceholderView title="Estados Financieros" icon="FileBarChart" />;
            case 'auditorias': return <AuditorAuditoriasView key={viewKey} empresa={empresaActiva} />;
            case 'documentos': return <PlaceholderView title="Documentos" icon="FolderOpen" />;
            case 'historial': return <PlaceholderView title="Historial" icon="Clock" />;
            case 'config': return <PlaceholderView title="Configuración" icon="Settings" />;
            default: return <DashboardView key={viewKey} empresa={empresaActiva} />;
        }
    };

    return (
        <div className="flex h-screen w-full bg-slate-950 text-slate-300 font-sans overflow-hidden">
            <AuditorSidebar
                currentView={currentView}
                onNavigate={handleNavigate}
                onCambiarEmpresa={clearEmpresa}
                onLogout={onLogout}
                empresa={empresaActiva}
            />
            {renderContent()}
        </div>
    );
};

window.AuditorLayout = AuditorLayout;
