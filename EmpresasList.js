const EmpresasList = () => {
    const { empresas, loading, selectEmpresa } = useAuditor();
    const [search, setSearch] = useState('');
    const [hoveredId, setHoveredId] = useState(null);

    const filtered = useMemo(() => {
        if (!search) return empresas;
        const q = search.toLowerCase();
        return empresas.filter(e =>
            (e.razon_social || '').toLowerCase().includes(q) ||
            (e.nombre_comercial || '').toLowerCase().includes(q) ||
            (e.rif || '').toLowerCase().includes(q) ||
            (e.codigo_registro || '').toLowerCase().includes(q)
        );
    }, [empresas, search]);

    const displayName = (e) => e.razon_social || e.nombre_comercial || e.rif || 'Sin nombre';

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col">
            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-800 bg-black/40 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/50">
                        <Icon name="Shield" size={18} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-white tracking-wider leading-none">LEGALYA</h1>
                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mt-0.5">Auditor Suite</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{empresas.length} empresa{empresas.length !== 1 ? 's' : ''}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-700" />
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">v1.0</span>
                </div>
            </div>

            <div className="flex-1 flex items-start justify-center p-8 relative">
                <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />

                <div className="w-full max-w-2xl relative z-10 animate-in">
                    <div className="mb-8">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Selección de empresa</p>
                        <h1 className="text-2xl font-black text-white tracking-tight">Elige la empresa a auditar</h1>
                    </div>

                    <div className="relative mb-6">
                        <Icon name="Search" size={16} className="absolute left-4 top-3.5 text-slate-600" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar empresa, RIF o código..."
                            className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-800 text-white text-sm rounded-xl outline-none focus:border-blue-500 transition-colors font-medium placeholder:text-slate-600"
                        />
                    </div>

                    {loading ? (
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-16 rounded-xl bg-slate-800/50 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                            <Icon name="Building2" size={40} className="text-slate-700 mx-auto mb-4" />
                            <p className="text-sm font-black text-slate-400 uppercase">
                                {search ? 'Sin resultados' : 'No hay empresas activas'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filtered.map((empresa, index) => {
                                const name = displayName(empresa);
                                const rif = empresa.rif || '—';
                                const isHovered = hoveredId === empresa.id;
                                return (
                                    <button
                                        key={empresa.id}
                                        onClick={() => selectEmpresa(empresa)}
                                        onMouseEnter={() => setHoveredId(empresa.id)}
                                        onMouseLeave={() => setHoveredId(null)}
                                        className="w-full flex items-center gap-4 px-5 py-4 bg-slate-900 border border-slate-800 hover:border-blue-500/30 hover:bg-slate-800/80 rounded-2xl transition-all duration-200 text-left group"
                                        style={{
                                            animation: `fadeIn 0.3s ease forwards`,
                                            animationDelay: `${index * 60}ms`,
                                            opacity: 0,
                                        }}
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-black transition-all ${
                                            isHovered
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                                        }`}>
                                            {name.charAt(0)}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-white uppercase truncate">{name}</p>
                                            <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                                                RIF: {rif}
                                                {empresa.codigo_registro && (
                                                    <span className="ml-3 text-slate-600">{empresa.codigo_registro}</span>
                                                )}
                                            </p>
                                        </div>

                                        <div className={`flex items-center gap-2 transition-all duration-200 ${
                                            isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-3'
                                        }`}>
                                            <span className="text-[10px] font-black text-blue-400 uppercase">Abrir</span>
                                            <Icon name="ArrowRight" size={14} className="text-blue-400" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {!loading && filtered.length > 0 && (
                        <p className="text-[10px] font-bold text-slate-600 text-center mt-5 uppercase tracking-wider">
                            {filtered.length} empresa{filtered.length !== 1 ? 's' : ''} activa{filtered.length !== 1 ? 's' : ''}
                            {search !== '' && filtered.length !== empresas.length && ` (${empresas.length} en total)`}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

window.EmpresasList = EmpresasList;
