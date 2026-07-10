const AuditorDiarioView = ({ empresa }) => {
    const empresaRif = empresa?.rif || '';
    const [journal, setJournal] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [filtroCuenta, setFiltroCuenta] = React.useState('');
    const [filtroTexto, setFiltroTexto] = React.useState('');
    const [cuentas, setCuentas] = React.useState([]);

    React.useEffect(() => {
        if (!empresaRif) { setLoading(false); return; }
        setLoading(true);
        Promise.all([
            sbFetch(`journal?rif=eq.${encodeURIComponent(empresaRif)}&order=fecha_local.desc&limit=5000`),
            sbFetch(`cuentas_contables?rif_empresa=eq.${encodeURIComponent(empresaRif)}&select=codigo,nombre&order=codigo.asc`),
        ]).then(([j, c]) => {
            setJournal(j || []);
            setCuentas(c || []);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [empresaRif]);

    const getNombreCuenta = (codigo) => {
        const c = cuentas.find(c => c.codigo === codigo);
        return c ? c.nombre : codigo;
    };

    const filtradas = journal.filter(r => {
        if (filtroCuenta && r.codigo_cuenta !== filtroCuenta) return false;
        if (filtroTexto) {
            const t = filtroTexto.toLowerCase();
            const concepto = (r.concepto || '').toLowerCase();
            const ref = (r.ref_doc || '').toLowerCase();
            if (!concepto.includes(t) && !ref.includes(t)) return false;
        }
        return true;
    });

    const $fmt = (n) => (n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const $fecha2 = (s) => s ? new Date(s).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

    const totalDebe = filtradas.reduce((s, r) => s + parseFloat(r.debe_usd || 0), 0);
    const totalHaber = filtradas.reduce((s, r) => s + parseFloat(r.haber_usd || 0), 0);

    if (loading) return <div className="h-40 bg-slate-800/50 rounded-2xl animate-pulse" />;

    return (
        <main className="flex-1 h-full overflow-hidden flex flex-col bg-slate-950 relative">
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 z-10">
                <div className="max-w-6xl mx-auto space-y-5 animate-in">

                    <div className="flex items-center justify-between gap-4 mb-2">
                        <div>
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Diario Contable</p>
                            <h1 className="text-xl font-black text-white tracking-tight mt-0.5">
                                {empresa?.razon_social || empresa?.rif}
                            </h1>
                        </div>
                        <p className="text-xs text-slate-500 font-bold">{journal.length} asientos</p>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="relative flex-1 max-w-xs">
                            <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                            <input type="text" value={filtroTexto} onChange={e => setFiltroTexto(e.target.value)}
                                placeholder="Buscar por concepto o referencia..."
                                className="w-full bg-slate-800/50 border border-slate-700/50 text-white rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold outline-none focus:border-blue-500 placeholder:text-slate-600" />
                        </div>
                        <select value={filtroCuenta} onChange={e => setFiltroCuenta(e.target.value)}
                            className="bg-slate-800/50 border border-slate-700/50 text-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-blue-500">
                            <option value="">Todas las cuentas</option>
                            {cuentas.map(c => (
                                <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>
                            ))}
                        </select>
                        <div className="flex gap-4 text-[10px] font-bold text-slate-500">
                            <span>Debe: <span className="text-blue-400">${$fmt(totalDebe)}</span></span>
                            <span>Haber: <span className="text-emerald-400">${$fmt(totalHaber)}</span></span>
                        </div>
                    </div>

                    {/* Journal Table */}
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-[9px] font-black text-slate-500 uppercase tracking-wider bg-slate-900/50">
                                        <th className="px-4 py-3">Fecha</th>
                                        <th className="px-4 py-3">Concepto</th>
                                        <th className="px-4 py-3">Cuenta</th>
                                        <th className="px-4 py-3 text-right">Debe ($)</th>
                                        <th className="px-4 py-3 text-right">Haber ($)</th>
                                        <th className="px-4 py-3">Ref.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtradas.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-5 py-12 text-center text-xs text-slate-600 font-bold">
                                                {journal.length === 0 ? 'No hay asientos contables para esta empresa' : 'No se encontraron resultados con los filtros aplicados'}
                                            </td>
                                        </tr>
                                    ) : filtradas.slice(0, 200).map((r, i) => (
                                        <tr key={r.id || i} className="border-t border-slate-700/30 text-[10px] text-slate-300 hover:bg-slate-800/30 transition-colors">
                                            <td className="px-4 py-2 font-mono text-slate-500 whitespace-nowrap">{$fecha2(r.fecha_local)}</td>
                                            <td className="px-4 py-2 font-bold max-w-[250px] truncate">{r.concepto || '—'}</td>
                                            <td className="px-4 py-2">
                                                <span className="font-mono text-slate-500" title={getNombreCuenta(r.codigo_cuenta)}>{r.codigo_cuenta || '—'}</span>
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono">
                                                {parseFloat(r.debe_usd || 0) > 0 && <span className="text-blue-400 font-bold">${$fmt(r.debe_usd)}</span>}
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono">
                                                {parseFloat(r.haber_usd || 0) > 0 && <span className="text-emerald-400 font-bold">${$fmt(r.haber_usd)}</span>}
                                            </td>
                                            <td className="px-4 py-2 font-mono text-slate-600">{r.ref_doc || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {filtradas.length > 200 && (
                            <div className="text-center py-4 text-[10px] text-slate-600 font-bold border-t border-slate-700/50">
                                Mostrando 200 de {filtradas.length} asientos
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
};

window.AuditorDiarioView = AuditorDiarioView;
