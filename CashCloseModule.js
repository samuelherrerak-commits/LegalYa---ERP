const CashCloseModule = ({ onBack }) => {
    const { currentUser, setCurrentUser, journal, setJournal, tasaBCV, setTasaBCV, isLocked, setIsLocked, setIsInit } = useContext(AppContext);
    const [fisico, setFisico] = useState({ usd: '', bs: '', banco: '' });
    const [mostrarResultados, setMostrarResultados] = useState(false);
    
    const nombreEmp = currentUser?.nombre_empresa || currentUser?.nombre || NOMBRE_EMPRESA_DEFAULT;
    const tema = currentUser?.color_tema || 'blue';

    const sistema = useMemo(() => {
        const totales = { usd: 0, bs: 0, banco: 0 };
        journal.forEach(r => {
            const debe = parseFloat(r.debe_usd || r.Debe || 0);
            const haber = parseFloat(r.haber_usd || r.Haber || 0);
            const tasaH = parseFloat(r.tasa || r.Tasa || tasaBCV);
            const cta = String(r.codigo_cuenta || r.Cuenta || '').trim();

            if (cta === CTA.CAJA_USD || cta.includes('Divisa') || cta.includes('$')) totales.usd += (debe - haber);
            if (cta === CTA.CAJA_BS || cta.includes('Bolívar') || cta.includes('Bs')) totales.bs += (debe - haber) * tasaH;
            if (cta === CTA.BANCOS || cta.includes('Banco')) totales.banco += (debe - haber) * tasaH;
        });
        return totales;
    }, [journal, tasaBCV]);

    const handleExportExcel = () => {
        if (!window.XLSX) return alert("Error: La librería XLSX no está cargada en tu HTML.");

        const headers = ["Empresa", "RIF", "Fecha", "Cuenta", "Código", "Concepto", "Debe ($)", "Haber ($)", "Debe (Bs)", "Haber (Bs)", "Tasa", "Ref/Doc", "Cant.", "Unidad", "P. Venta", "Entidad"];

        const rows = (journal || []).map(entry => {
            const tasa = parseFloat(entry.tasa || entry.Tasa) || tasaBCV || 1;
            const d$ = parseFloat(entry.debe_usd || entry.Debe) || 0;
            const h$ = parseFloat(entry.haber_usd || entry.Haber) || 0;
            
            let entidad = String(entry.entidad || entry.Entidad || "GENERAL");
            const conceptoStr = String(entry.concepto || entry.Concepto || '');

            let cantidad = parseFloat(entry.cantidad || entry.Cantidad) || 0;

            const fechaFormat = entry.fecha_local ? new Date(entry.fecha_local).toLocaleDateString() : (entry.Fecha || new Date().toLocaleDateString());

            return [
                String(entry.empresa || entry.Empresa || nombreEmp), String(entry.rif || RIF_DEFAULT), fechaFormat, String(entry.cuenta_contable || entry.Nombre || "Cuenta"), String(entry.codigo_cuenta || entry.Cuenta || "0.0.00"), conceptoStr, d$, h$, Number((d$ * tasa).toFixed(2)), Number((h$ * tasa).toFixed(2)), tasa, String(entry.ref_doc || entry.Ref || ""), cantidad, String(entry.unidad || entry.Unidad_Medida || "und"), parseFloat(entry.precio_venta || entry.Precio_Venta) || 0, entidad 
            ];
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        ws['!cols'] = [{wch: 25}, {wch: 15}, {wch: 12}, {wch: 20}, {wch: 12}, {wch: 40}, {wch: 12}, {wch: 12}, {wch: 12}, {wch: 12}, {wch: 10}, {wch: 15}, {wch: 10}, {wch: 10}, {wch: 12}, {wch: 25}];
        XLSX.utils.book_append_sheet(wb, ws, "Libro Diario 16C");
        XLSX.writeFile(wb, `Libro_Diario_${nombreEmp.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleCerrarTurno = () => {
        if (confirm("¿Confirmas el cierre del turno? El sistema se bloqueará y se descargará el respaldo Excel.")) {
            handleExportExcel();
            setIsLocked(true);
        }
    };

    const handleNuevoCiclo = () => {
        if (confirm("¿Deseas borrar TODOS los datos operativos (Libro Diario y Tasa) y volver a la pantalla de inicio?")) {
            if (confirm("ADVERTENCIA: Esta acción es irreversible. ¿Seguro que ya descargaste el Libro Diario en Excel?")) {
                setJournal([]); setTasaBCV(0); setIsLocked(false); setIsInit(false); 
                onBack(); 
                localStorage.removeItem('legaly_tasa'); localStorage.setItem('legaly_locked', 'false'); localStorage.setItem('legaly_init', 'false');
                alert("Ciclo cerrado con éxito. Tu base de datos de contactos se mantiene segura en la nube.");
            }
        }
    };

    const handleCerrarSesion = () => {
        if (confirm("¿Está seguro de cerrar la sesión de esta empresa? Deberá ingresar sus credenciales nuevamente.")) {
            setCurrentUser(null);
            setIsInit(false);
            localStorage.removeItem('legaly_init');
        }
    };

    const difUSD = (parseFloat(fisico.usd) || 0) - sistema.usd;
    const difBs = (parseFloat(fisico.bs) || 0) - sistema.bs;
    const difBanco = (parseFloat(fisico.banco) || 0) - sistema.banco;

    return (
        <div className="animate-in space-y-6 pb-20">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {/* BOTON GLOBAL MANEJA EL RETROCESO */}
                    <h2 className="font-black uppercase italic tracking-tighter text-xl text-slate-800">Finalización de Ciclo</h2>
                </div>
                <button onClick={handleCerrarSesion} className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-4 py-3 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all border border-rose-200"><Icon name="LogOut" size={14}/> Cerrar Sesión</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 space-y-6">
                    <div className={`${isLocked ? 'opacity-40 pointer-events-none' : ''} bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 transition-opacity`}>
                        <h3 className="text-xs font-black uppercase text-slate-400 mb-6">1. Arqueo Físico de Caja</h3>
                        <div className="space-y-4">
                            <InputField label="Efectivo Dólares ($)" icon="DollarSign" color={`bg-${tema}-500`} value={fisico.usd} onChange={v => setFisico({...fisico, usd: v})} />
                            <InputField label="Efectivo Bolívares (Bs)" icon="Coins" color="bg-blue-600" value={fisico.bs} onChange={v => setFisico({...fisico, bs: v})} />
                            <InputField label="Portal Bancario (Bs)" icon="Landmark" color="bg-indigo-600" value={fisico.banco} onChange={v => setFisico({...fisico, banco: v})} />
                        </div>
                        {!mostrarResultados && <button onClick={() => setMostrarResultados(true)} className="w-full mt-6 py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-sm shadow-lg hover:bg-slate-800 transition-all">Comparar con Sistema</button>}
                    </div>

                    <div className="bg-rose-50 p-8 rounded-[3rem] border border-rose-100">
                        <div className="flex items-center gap-2 mb-4"><div className="bg-rose-600 text-white p-2 rounded-lg"><Icon name="Trash2" size={16}/></div><h3 className="text-xs font-black uppercase text-rose-600">Reinicio Maestro</h3></div>
                        <p className="text-xs text-rose-800/60 mb-6 font-medium leading-relaxed">Esta acción eliminará el Libro Diario actual de la memoria del navegador. Sin embargo, su historial quedará resguardado en la nube y su Excel.</p>
                        <button onClick={handleNuevoCiclo} className="w-full py-5 bg-white border-2 border-rose-200 text-rose-600 rounded-2xl font-black uppercase text-xs hover:bg-rose-600 hover:text-white transition-all flex justify-center items-center gap-2 shadow-sm"><Icon name="RefreshCw" size={16}/> Iniciar Nuevo Ciclo Contable</button>
                    </div>
                </div>

                <div className="lg:col-span-5">
                    {mostrarResultados || isLocked ? (
                        <div className="bg-slate-900 rounded-[3rem] p-8 text-white shadow-2xl sticky top-4">
                            <h3 className="text-xs font-black uppercase text-slate-500 mb-8">Auditoría de Cierre</h3>
                            <div className="space-y-6">
                                <ResultRow label="Caja USD" system={sistema.usd} diff={difUSD} isUsd={true} />
                                <ResultRow label="Caja Bs" system={sistema.bs} diff={difBs} />
                                <ResultRow label="Banco Bs" system={sistema.banco} diff={difBanco} />
                            </div>

                            {!isLocked ? (
                                <button onClick={handleCerrarTurno} className="w-full mt-10 py-6 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] font-black uppercase italic transition-all flex justify-center items-center gap-3"><Icon name="FileDown" size={20}/> Cerrar Turno y Exportar (Excel)</button>
                            ) : (
                                <div className="mt-10 p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl text-center">
                                    <p className="text-emerald-400 font-black uppercase text-[10px] tracking-widest">Turno Cerrado Correctamente</p>
                                    <p className="text-white/40 text-[10px] mt-2">Puede iniciar un nuevo ciclo o cerrar sesión.</p>
                                    <button onClick={handleExportExcel} className="mt-4 text-[10px] text-blue-400 font-bold uppercase underline">Descargar Excel Nuevamente</button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-12 border-4 border-dashed border-slate-100 rounded-[3rem] text-slate-300"><Icon name="SearchCheck" size={48} className="mb-4 opacity-20"/><p className="font-bold text-xs uppercase tracking-tighter">Declare el efectivo para conciliar</p></div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ==========================================
// MÓDULO DE GESTIÓN CONTABLE (NUEVO)
// ==========================================

// ==========================================
// AUDITOR: FUNCIONES DE DATOS
// ==========================================
const auditGetEmpresas = async () => {
    const data = await sbFetch('journal?select=empresa,rif,fecha_local,debe_usd,haber_usd,codigo_cuenta,ref_doc&order=fecha_local.desc&limit=10000');
    const map = {};
    (data || []).forEach(r => {
        const k = r.rif || r.empresa;
        if (!map[k]) map[k] = { empresa: r.empresa, rif: r.rif, movimientos: 0, ventas: 0, compras: 0, gastos: 0, ultimaOp: r.fecha_local };
        map[k].movimientos++;
        if (r.fecha_local > map[k].ultimaOp) map[k].ultimaOp = r.fecha_local;
        if (r.codigo_cuenta === '4.1.01.01') map[k].ventas += parseFloat(r.haber_usd || 0);
        if (r.codigo_cuenta === '1.1.03.01' && parseFloat(r.debe_usd) > 0) map[k].compras += parseFloat(r.debe_usd || 0);
        if (r.codigo_cuenta && r.codigo_cuenta.startsWith('6.')) map[k].gastos += parseFloat(r.debe_usd || 0);
    });
    return Object.values(map);
};

const auditGetMovs = async (rif) => sbFetch(`journal?rif=eq.${encodeURIComponent(rif)}&order=fecha_local.desc&limit=5000`);

const auditLibroMayor = (journal, cod) => {
    let debe = 0, haber = 0;
    const movs = journal.filter(r => r.codigo_cuenta === cod).map(r => {
        debe += parseFloat(r.debe_usd || 0); haber += parseFloat(r.haber_usd || 0);
        return { ...r, saldoAcum: debe - haber };
    });
    return { movs, debeTotal: debe, haberTotal: haber, saldo: debe - haber };
};

const auditBalance = (journal) => {
    const s = (cod) => { let d=0,h=0; journal.filter(r=>r.codigo_cuenta===cod).forEach(r=>{d+=parseFloat(r.debe_usd||0);h+=parseFloat(r.haber_usd||0);}); return d-h; };
    return {
        activos: { caja_usd: s('1.1.01.01'), caja_bs: s('1.1.01.02'), bancos: s('1.1.01.03'), inventario: s('1.1.03.01'), cxc: s('1.1.02.01') },
        pasivos: { proveedores: Math.abs(s('2.1.01.01')), cxp: Math.abs(s('2.1.02.01')) },
        patrimonio: s('3.1.01.01')
    };
};

const auditEstadoResultados = (journal) => {
    const sum = (cod, f) => journal.filter(r=>r.codigo_cuenta===cod).reduce((a,r)=>a+parseFloat(r[f]||0),0);
    const ventas = sum('4.1.01.01','haber_usd'), costo = sum('5.1.01.01','debe_usd');
    const gastos = journal.filter(r=>r.codigo_cuenta&&r.codigo_cuenta.startsWith('6.')).reduce((a,r)=>a+parseFloat(r.debe_usd||0),0);
    return { ventas, costo, utilidadBruta: ventas-costo, gastos, utilidadNeta: ventas-costo-gastos };
};

const auditAlertas = (journal) => {
    const alertas = [], refs = {};
    journal.forEach(r => {
        const ref = r.ref_doc || '';
        if (!refs[ref]) refs[ref] = { debe:0, haber:0 };
        refs[ref].debe += parseFloat(r.debe_usd||0);
        refs[ref].haber += parseFloat(r.haber_usd||0);
    });
    Object.entries(refs).forEach(([ref, v]) => {
        const dif = Math.abs(v.debe - v.haber);
        if (dif > 0.05 && ref) alertas.push({ nivel:'critico', msg:`Asiento descuadrado en ${ref}: dif. $${dif.toFixed(2)}` });
    });
    journal.filter(r => !r.ref_doc).slice(0,5).forEach(r => alertas.push({ nivel:'medio', msg:`Sin referencia: ${(r.concepto||'').substring(0,40)}` }));
    return alertas.slice(0,20);
};

// ── AUDITOR COMPONENTES UI ──
const AuditBadge = ({ label, color='slate' }) => {
    const map = { green:'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', red:'bg-rose-500/10 text-rose-400 border-rose-500/20', yellow:'bg-amber-500/10 text-amber-400 border-amber-500/20', blue:'bg-blue-500/10 text-blue-400 border-blue-500/20', slate:'bg-slate-700 text-slate-300 border-slate-600' };
    return <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${map[color]||map.slate}`}>{label}</span>;
};

const AuditKPI = ({ label, value, sub, icon, color='text-white' }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 w-max"><Icon name={icon} size={14} className="text-slate-400" /></div>
        <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
            <p className={`text-2xl font-black tracking-tight ${color}`}>{value}</p>
            {sub && <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{sub}</p>}
        </div>
    </div>
);

const AuditTable = ({ cols, rows, onRow }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800">{cols.map(c=><th key={c.key} className="text-left py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">{c.label}</th>)}</tr></thead>
            <tbody>
                {rows.length===0 && <tr><td colSpan={cols.length} className="py-10 text-center text-slate-600 text-xs font-bold uppercase">Sin datos</td></tr>}
                {rows.map((row,i)=>(
                    <tr key={i} onClick={()=>onRow&&onRow(row)} className={`border-b border-slate-800/40 transition-colors ${onRow?'cursor-pointer hover:bg-slate-800/50':''}`}>
                        {cols.map(c=><td key={c.key} className="py-3 px-4 text-slate-300 font-medium">{c.render?c.render(row[c.key],row):(row[c.key]??'—')}</td>)}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

// ── VISTAS AUDITOR ──
const AuditDashboard = ({ empresas }) => {
    const totalVentas = empresas.reduce((a,e)=>a+e.ventas,0);
    const totalCompras = empresas.reduce((a,e)=>a+e.compras,0);
    const utilidad = totalVentas - totalCompras;
    const top5 = [...empresas].sort((a,b)=>b.ventas-a.ventas).slice(0,5);
    return (
        <div className="space-y-8">
            <div><p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Panel de Control</p><h1 className="text-3xl font-black text-white tracking-tight">Dashboard General</h1></div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <AuditKPI label="Empresas" value={empresas.length} icon="Building2" />
                <AuditKPI label="Facturación Total" value={`$${totalVentas.toFixed(2)}`} icon="TrendingUp" color="text-emerald-400" />
                <AuditKPI label="Total Movimientos" value={empresas.reduce((a,e)=>a+e.movimientos,0).toLocaleString()} icon="Activity" color="text-blue-400" />
                <AuditKPI label="Utilidad Estimada" value={`$${utilidad.toFixed(2)}`} icon="BarChart2" color={utilidad>=0?'text-emerald-400':'text-rose-400'} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6">Top Empresas por Ventas</h3>
                    {top5.length===0 ? <p className="text-slate-600 text-xs text-center py-8 font-bold uppercase">Sin datos</p> : (
                        <div className="space-y-4">{top5.map((e,i)=>{
                            const pct = totalVentas>0?(e.ventas/totalVentas)*100:0;
                            return <div key={i}><div className="flex justify-between mb-1"><span className="text-xs font-black text-white uppercase truncate max-w-[180px]">{e.empresa}</span><span className="text-xs font-black text-emerald-400">${e.ventas.toFixed(2)}</span></div><div className="w-full bg-slate-800 rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full" style={{width:`${pct}%`}}></div></div></div>;
                        })}</div>
                    )}
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6">Resumen Financiero Consolidado</h3>
                    <div className="space-y-4">{[
                        {label:'Ventas Totales',val:totalVentas,color:'text-emerald-400',dot:'bg-emerald-500'},
                        {label:'Compras / Costos',val:totalCompras,color:'text-blue-400',dot:'bg-blue-500'},
                        {label:'Gastos Operativos',val:empresas.reduce((a,e)=>a+e.gastos,0),color:'text-amber-400',dot:'bg-amber-500'},
                        {label:'Resultado Neto',val:utilidad,color:utilidad>=0?'text-emerald-400':'text-rose-400',dot:utilidad>=0?'bg-emerald-500':'bg-rose-500'},
                    ].map((r,i)=>(
                        <div key={i} className="flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${r.dot}`}></div><span className="text-xs text-slate-400 font-bold flex-1">{r.label}</span><span className={`text-sm font-black ${r.color}`}>${r.val.toFixed(2)}</span></div>
                    ))}</div>
                </div>
            </div>
        </div>
    );
};

const AuditEmpresas = ({ empresas, onSelect }) => {
    const [q, setQ] = useState('');
    const filtered = empresas.filter(e=>e.empresa?.toLowerCase().includes(q.toLowerCase())||e.rif?.includes(q));
    const cols = [
        {key:'empresa',label:'Empresa',render:v=><span className="font-black text-white uppercase">{v}</span>},
        {key:'rif',label:'RIF',render:v=><AuditBadge label={v||'S/RIF'} />},
        {key:'ultimaOp',label:'Última Op.',render:v=>v?new Date(v).toLocaleDateString('es'):'—'},
        {key:'movimientos',label:'Movimientos',render:v=><span className="font-black text-blue-400">{v}</span>},
        {key:'ventas',label:'Ventas $',render:v=><span className="font-black text-emerald-400">${v.toFixed(2)}</span>},
        {key:'compras',label:'Compras $',render:v=><span className="font-black text-amber-400">${v.toFixed(2)}</span>},
        {key:'rif',label:'Estado',render:(_,r)=><AuditBadge label={r.movimientos>0?'Activa':'Sin mov.'} color={r.movimientos>0?'green':'slate'} />},
    ];
    return (
        <div className="space-y-6">
            <div><p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Directorio</p><h1 className="text-3xl font-black text-white">Empresas</h1></div>
            <div className="flex gap-3">
                <div className="relative flex-1 max-w-sm"><Icon name="Search" size={14} className="absolute left-3 top-3 text-slate-500" /><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar empresa o RIF..." className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 text-white text-sm rounded-xl outline-none focus:border-blue-500 font-medium transition-colors" /></div>
                <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-xs font-black text-slate-400 uppercase flex items-center">{filtered.length} empresa{filtered.length!==1?'s':''}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"><AuditTable cols={cols} rows={filtered} onRow={onSelect} /></div>
        </div>
    );
};

const AuditEmpresaDetalle = ({ empresa, onBack, setView, setEmpresaActiva }) => {
    const [journal, setJournal] = useState([]); const [loading, setLoading] = useState(true);
    useEffect(() => { auditGetMovs(empresa.rif).then(d=>{setJournal(d||[]);setLoading(false);}); }, [empresa.rif]);
    const er = auditEstadoResultados(journal), alertas = auditAlertas(journal);
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-800 text-slate-400 rounded-xl transition-colors border border-slate-800"><Icon name="ArrowLeft" size={16}/></button>
                <div><p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Perfil</p><h1 className="text-2xl font-black text-white">{empresa.empresa}</h1></div>
                <AuditBadge label={empresa.rif||'S/RIF'} color="blue" />
            </div>
            {loading ? <div className="flex items-center gap-2 text-slate-500 text-sm font-bold"><Icon name="Loader" size={16} className="animate-spin"/>Cargando...</div> : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <AuditKPI label="Movimientos" value={journal.length} icon="Activity" />
                        <AuditKPI label="Ventas" value={`$${er.ventas.toFixed(2)}`} icon="TrendingUp" color="text-emerald-400" />
                        <AuditKPI label="Utilidad Neta" value={`$${er.utilidadNeta.toFixed(2)}`} icon="BarChart2" color={er.utilidadNeta>=0?'text-emerald-400':'text-rose-400'} />
                        <AuditKPI label="Alertas" value={alertas.length} icon="AlertTriangle" color={alertas.length>0?'text-rose-400':'text-emerald-400'} />
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <button onClick={()=>{setEmpresaActiva(empresa);setView('audit-auditoria');}} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase rounded-xl transition-colors"><Icon name="Search" size={14}/> Auditoría</button>
                        <button onClick={()=>{setEmpresaActiva(empresa);setView('audit-libros');}} className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase rounded-xl transition-colors border border-slate-700"><Icon name="BookOpen" size={14}/> Libros</button>
                        <button onClick={()=>{setEmpresaActiva(empresa);setView('audit-estados');}} className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase rounded-xl transition-colors border border-slate-700"><Icon name="FileText" size={14}/> Estados</button>
                        <button onClick={()=>{setEmpresaActiva(empresa);setView('audit-analisis');}} className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase rounded-xl transition-colors border border-slate-700"><Icon name="Brain" size={14}/> Análisis</button>
                    </div>
                    {alertas.length>0 && <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3"><h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Alertas detectadas</h3>{alertas.slice(0,5).map((a,i)=><div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${a.nivel==='critico'?'bg-rose-500/5 border-rose-500/20':'bg-amber-500/5 border-amber-500/20'}`}><Icon name="AlertTriangle" size={14} className={a.nivel==='critico'?'text-rose-400':'text-amber-400'}/><span className={`text-xs font-bold ${a.nivel==='critico'?'text-rose-300':'text-amber-300'}`}>{a.msg}</span></div>)}</div>}
                </>
            )}
        </div>
    );
};

const AuditAuditoria = ({ empresas, empresaActiva }) => {
    const [filtros, setFiltros] = useState({ rif: empresaActiva?.rif||'', fechaIni:'', fechaFin:'', tipo:'' });
    const [journal, setJournal] = useState([]); const [loading, setLoading] = useState(false);
    const buscar = async () => {
        setLoading(true);
        try {
            let q = `journal?order=fecha_local.desc&limit=500`;
            if(filtros.rif) q+=`&rif=eq.${encodeURIComponent(filtros.rif)}`;
            let data = await sbFetch(q) || [];
            if(filtros.fechaIni) data=data.filter(r=>r.fecha_local>=filtros.fechaIni);
            if(filtros.fechaFin) data=data.filter(r=>r.fecha_local<=filtros.fechaFin+'T23:59:59');
            if(filtros.tipo==='venta') data=data.filter(r=>r.ref_doc?.startsWith('VTA'));
            if(filtros.tipo==='compra') data=data.filter(r=>r.ref_doc?.startsWith('REC'));
            if(filtros.tipo==='gasto') data=data.filter(r=>r.ref_doc?.startsWith('GST'));
            if(filtros.tipo==='cobro') data=data.filter(r=>r.ref_doc?.startsWith('RCP'));
            setJournal(data);
        } catch(e){console.error(e);} finally{setLoading(false);}
    };
    useEffect(()=>{if(empresaActiva) setFiltros(f=>({...f,rif:empresaActiva.rif}));},[empresaActiva]);
    const alertas = auditAlertas(journal);
    const descuadradas = alertas.filter(a=>a.nivel==='critico').map(a=>a.msg.split(' en ')[1]?.split(':')[0]);
    const cols = [
        {key:'fecha_local',label:'Fecha',render:v=>v?new Date(v).toLocaleDateString('es'):'—'},
        {key:'ref_doc',label:'Ref',render:v=>v?<AuditBadge label={v} color={v.startsWith('VTA')?'green':v.startsWith('GST')?'red':v.startsWith('REC')?'blue':'slate'}/>:<AuditBadge label="Sin ref" color="red"/>},
        {key:'concepto',label:'Concepto',render:v=><span className="truncate max-w-[180px] block text-xs">{v?.substring(0,40)||'—'}</span>},
        {key:'codigo_cuenta',label:'Cuenta',render:(v,r)=><span className="text-[11px] font-mono text-blue-400">{v}</span>},
        {key:'debe_usd',label:'Debe $',render:v=>parseFloat(v)>0?<span className="font-black text-white">${parseFloat(v).toFixed(2)}</span>:'—'},
        {key:'haber_usd',label:'Haber $',render:v=>parseFloat(v)>0?<span className="font-black text-white">${parseFloat(v).toFixed(2)}</span>:'—'},
        {key:'entidad',label:'Estado',render:(_,row)=>descuadradas.includes(row.ref_doc)?<AuditBadge label="⚠ Descuadrado" color="red"/>:<AuditBadge label="OK" color="green"/>},
    ];
    return (
        <div className="space-y-6">
            <div><p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Revisión</p><h1 className="text-3xl font-black text-white">Auditoría Contable</h1></div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Filtros</p>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <select value={filtros.rif} onChange={e=>setFiltros({...filtros,rif:e.target.value})} className="bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2.5 outline-none font-bold col-span-2 lg:col-span-1">
                        <option value="">Todas las empresas</option>
                        {empresas.map(e=><option key={e.rif} value={e.rif}>{e.empresa}</option>)}
                    </select>
                    <input type="date" value={filtros.fechaIni} onChange={e=>setFiltros({...filtros,fechaIni:e.target.value})} className="bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2.5 outline-none font-bold" />
                    <input type="date" value={filtros.fechaFin} onChange={e=>setFiltros({...filtros,fechaFin:e.target.value})} className="bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2.5 outline-none font-bold" />
                    <select value={filtros.tipo} onChange={e=>setFiltros({...filtros,tipo:e.target.value})} className="bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2.5 outline-none font-bold">
                        <option value="">Todos</option><option value="venta">Ventas</option><option value="compra">Compras</option><option value="gasto">Gastos</option><option value="cobro">Cobros</option>
                    </select>
                    <button onClick={buscar} disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 justify-center disabled:opacity-50">
                        {loading?<><Icon name="Loader" size={12} className="animate-spin"/>Buscando...</>:<><Icon name="Search" size={12}/>Buscar</>}
                    </button>
                </div>
            </div>
            {alertas.length>0 && <div className="flex gap-3 flex-wrap">{[{n:'critico',l:'Crítico',c:'rose'},{n:'medio',l:'Aviso',c:'amber'}].map(({n,l,c})=>{const cnt=alertas.filter(a=>a.nivel===n).length; return cnt>0?<div key={n} className={`flex items-center gap-2 px-4 py-2 bg-slate-900 border border-${c}-500/20 rounded-xl`}><Icon name="AlertTriangle" size={14} className={`text-${c}-400`}/><span className={`text-xs font-black text-${c}-400`}>{cnt} {l}</span></div>:null;})}</div>}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                {journal.length>0&&<div className="px-4 py-3 border-b border-slate-800"><span className="text-xs font-black text-slate-500 uppercase">{journal.length} registros</span></div>}
                <AuditTable cols={cols} rows={journal} />
            </div>
        </div>
    );
};

const AuditLibros = ({ empresas, empresaActiva }) => {
    const [rif, setRif] = useState(empresaActiva?.rif||''); const [libro, setLibro] = useState('diario');
    const [cta, setCta] = useState('1.1.01.01'); const [journal, setJournal] = useState([]); const [loading, setLoading] = useState(false);
    const cuentas = [{cod:'1.1.01.01',nom:'Caja USD'},{cod:'1.1.01.02',nom:'Caja Bs'},{cod:'1.1.01.03',nom:'Bancos'},{cod:'1.1.03.01',nom:'Inventario'},{cod:'1.1.02.01',nom:'CxC Clientes'},{cod:'2.1.01.01',nom:'Proveedores'},{cod:'4.1.01.01',nom:'Ventas'},{cod:'5.1.01.01',nom:'Costo Ventas'}];
    useEffect(()=>{ if(rif){setLoading(true); auditGetMovs(rif).then(d=>{setJournal(d||[]);setLoading(false);});} },[rif]);
    const mayor = useMemo(()=>auditLibroMayor(journal,cta),[journal,cta]);
    const colsDiario = [
        {key:'fecha_local',label:'Fecha',render:v=>v?new Date(v).toLocaleDateString('es'):'—'},
        {key:'ref_doc',label:'Ref',render:v=>v?<AuditBadge label={v} />:'—'},
        {key:'codigo_cuenta',label:'Código',render:v=><span className="font-mono text-blue-400 text-xs">{v}</span>},
        {key:'cuenta_contable',label:'Cuenta',render:v=><span className="text-xs">{v?.substring(0,22)}</span>},
        {key:'concepto',label:'Concepto',render:v=><span className="text-xs text-slate-400">{v?.substring(0,32)}</span>},
        {key:'debe_usd',label:'Debe $',render:v=>parseFloat(v)>0?<span className="font-black text-white">${parseFloat(v).toFixed(2)}</span>:''},
        {key:'haber_usd',label:'Haber $',render:v=>parseFloat(v)>0?<span className="font-black text-white">${parseFloat(v).toFixed(2)}</span>:''},
    ];
    return (
        <div className="space-y-6">
            <div><p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Contabilidad</p><h1 className="text-3xl font-black text-white">Libros Contables</h1></div>
            <div className="flex flex-wrap gap-3 items-center">
                <select value={rif} onChange={e=>setRif(e.target.value)} className="bg-slate-900 border border-slate-800 text-white text-xs rounded-xl px-3 py-2.5 outline-none font-bold focus:border-blue-500 transition-colors">
                    <option value="">Seleccionar empresa...</option>{empresas.map(e=><option key={e.rif} value={e.rif}>{e.empresa}</option>)}
                </select>
                <div className="flex bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    {[{id:'diario',l:'Diario'},{id:'mayor',l:'Mayor'}].map(t=><button key={t.id} onClick={()=>setLibro(t.id)} className={`px-4 py-2.5 text-xs font-black uppercase transition-colors ${libro===t.id?'bg-blue-600 text-white':'text-slate-400 hover:text-white hover:bg-slate-800'}`}>{t.l}</button>)}
                </div>
                {libro==='mayor'&&<select value={cta} onChange={e=>setCta(e.target.value)} className="bg-slate-900 border border-slate-800 text-white text-xs rounded-xl px-3 py-2.5 outline-none font-bold focus:border-blue-500 transition-colors">{cuentas.map(c=><option key={c.cod} value={c.cod}>{c.nom}</option>)}</select>}
                {loading&&<div className="flex items-center gap-2 text-slate-500 text-xs font-bold"><Icon name="Loader" size={12} className="animate-spin"/>Cargando...</div>}
            </div>
            {libro==='mayor'&&journal.length>0&&<div className="grid grid-cols-3 gap-4">{[{l:'Debe Acum.',v:`$${mayor.debeTotal.toFixed(2)}`,c:'text-white'},{l:'Haber Acum.',v:`$${mayor.haberTotal.toFixed(2)}`,c:'text-white'},{l:'Saldo Final',v:`$${mayor.saldo.toFixed(2)}`,c:mayor.saldo>=0?'text-emerald-400':'text-rose-400'}].map((s,i)=><div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4"><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{s.l}</p><p className={`text-xl font-black ${s.c}`}>{s.v}</p></div>)}</div>}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <AuditTable cols={colsDiario} rows={libro==='diario'?journal:mayor.movs} />
            </div>
        </div>
    );
};

const AuditEstados = ({ empresas, empresaActiva }) => {
    const [rif, setRif] = useState(empresaActiva?.rif||''); const [journal, setJournal] = useState([]); const [loading, setLoading] = useState(false);
    useEffect(()=>{ if(rif){setLoading(true); auditGetMovs(rif).then(d=>{setJournal(d||[]);setLoading(false);});} },[rif]);
    const bg = auditBalance(journal), er = auditEstadoResultados(journal);
    const totalA = Object.values(bg.activos).reduce((a,v)=>a+Math.max(0,v),0);
    const totalP = Object.values(bg.pasivos).reduce((a,v)=>a+Math.max(0,v),0);
    const LineaBG = ({label,val,sub=false,total=false})=>(
        <div className={`flex justify-between items-center py-2 ${total?'border-t border-slate-700 mt-1 pt-3':'border-b border-slate-800/50'}`}>
            <span className={`${sub?'ml-4 text-slate-400':'text-white'} ${total?'font-black':'font-medium'} text-xs`}>{label}</span>
            <span className={`font-black text-sm ${total?(val>=0?'text-emerald-400':'text-rose-400'):'text-white'}`}>${Math.abs(val).toFixed(2)}</span>
        </div>
    );
    return (
        <div className="space-y-6">
            <div><p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Reportes</p><h1 className="text-3xl font-black text-white">Estados Financieros</h1></div>
            <div className="flex gap-3 items-center">
                <select value={rif} onChange={e=>setRif(e.target.value)} className="bg-slate-900 border border-slate-800 text-white text-xs rounded-xl px-3 py-2.5 outline-none font-bold focus:border-blue-500 transition-colors">
                    <option value="">Seleccionar empresa...</option>{empresas.map(e=><option key={e.rif} value={e.rif}>{e.empresa}</option>)}
                </select>
                {loading&&<div className="flex items-center gap-2 text-slate-500 text-xs font-bold"><Icon name="Loader" size={12} className="animate-spin"/>Cargando...</div>}
            </div>
            {journal.length>0&&(
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-800"><h3 className="text-xs font-black text-white uppercase tracking-widest">Balance General</h3><AuditBadge label="NIC Pymes" color="blue"/></div>
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">ACTIVOS</p>
                        <LineaBG label="Caja (USD)" val={bg.activos.caja_usd} sub/><LineaBG label="Caja (Bs)" val={bg.activos.caja_bs} sub/><LineaBG label="Bancos" val={bg.activos.bancos} sub/><LineaBG label="Inventario" val={bg.activos.inventario} sub/><LineaBG label="CxC Clientes" val={bg.activos.cxc} sub/><LineaBG label="TOTAL ACTIVOS" val={totalA} total/>
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest pt-2">PASIVOS</p>
                        <LineaBG label="Proveedores" val={bg.pasivos.proveedores} sub/><LineaBG label="TOTAL PASIVOS" val={totalP} total/>
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest pt-2">PATRIMONIO</p>
                        <LineaBG label="PATRIMONIO NETO" val={totalA-totalP} total/>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-800"><h3 className="text-xs font-black text-white uppercase tracking-widest">Estado de Resultados</h3></div>
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">INGRESOS</p>
                        <LineaBG label="Ventas de Mercancía" val={er.ventas} sub/><LineaBG label="TOTAL INGRESOS" val={er.ventas} total/>
                        <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest pt-2">COSTOS</p>
                        <LineaBG label="Costo de Ventas" val={er.costo} sub/><LineaBG label="UTILIDAD BRUTA" val={er.utilidadBruta} total/>
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest pt-2">GASTOS</p>
                        <LineaBG label="Gastos Operativos" val={er.gastos} sub/><LineaBG label="UTILIDAD NETA" val={er.utilidadNeta} total/>
                        <div className="grid grid-cols-2 gap-3 pt-2">{[{l:'Margen Bruto',v:er.ventas>0?((er.utilidadBruta/er.ventas)*100):0},{l:'Margen Neto',v:er.ventas>0?((er.utilidadNeta/er.ventas)*100):0}].map((m,i)=><div key={i} className="bg-slate-800 rounded-xl p-3 text-center"><p className="text-[10px] font-black text-slate-500 uppercase mb-1">{m.l}</p><p className={`text-lg font-black ${m.v>=0?'text-emerald-400':'text-rose-400'}`}>{m.v.toFixed(1)}%</p></div>)}</div>
                    </div>
                </div>
            )}
            {!rif&&<div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center"><Icon name="FileBarChart" size={32} className="text-slate-700 mx-auto mb-3"/><p className="text-slate-600 text-xs font-black uppercase">Selecciona una empresa para ver sus estados financieros</p></div>}
        </div>
    );
};

const AuditAnalisis = ({ empresas, empresaActiva }) => {
    const [rif, setRif] = useState(empresaActiva?.rif||''); const [journal, setJournal] = useState([]); const [loading, setLoading] = useState(false);
    useEffect(()=>{ if(rif){setLoading(true); auditGetMovs(rif).then(d=>{setJournal(d||[]);setLoading(false);});} },[rif]);
    const er = auditEstadoResultados(journal), bg = auditBalance(journal);
    const totalA = Object.values(bg.activos).reduce((a,v)=>a+Math.max(0,v),0);
    const totalP = Object.values(bg.pasivos).reduce((a,v)=>a+Math.max(0,v),0);
    const kw = totalA-totalP, mb = er.ventas>0?(er.utilidadBruta/er.ventas)*100:0, mn = er.ventas>0?(er.utilidadNeta/er.ventas)*100:0, ri = er.costo>0&&bg.activos.inventario>0?er.costo/bg.activos.inventario:0;
    const recs = useMemo(()=>{
        const r=[];
        if(er.ventas===0) r.push({t:'critico',m:'No se registran ventas en el período analizado.'});
        if(mn<10&&er.ventas>0) r.push({t:'medio',m:`Margen neto bajo (${mn.toFixed(1)}%). Evalúe reducción de gastos.`});
        if(bg.activos.cxc>er.ventas*0.3) r.push({t:'medio',m:'CxC elevada. Más del 30% de ventas pendiente de cobro.'});
        if(kw<0) r.push({t:'critico',m:'Capital de trabajo negativo. Pasivos superan activos corrientes.'});
        if(ri<1&&bg.activos.inventario>0) r.push({t:'bajo',m:'Baja rotación de inventario. Ajuste precios o estrategia.'});
        if(mb>30&&mn>15) r.push({t:'positivo',m:'Salud financiera sólida. Buenos márgenes de rentabilidad.'});
        if(er.ventas>0&&er.utilidadNeta>0) r.push({t:'positivo',m:'Empresa rentable en el período analizado.'});
        return r;
    },[er,bg]);
    const Ind=({l,v,d,c='text-white'})=><div className="bg-slate-800 border border-slate-700 rounded-xl p-4"><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{l}</p><p className={`text-2xl font-black mb-1 ${c}`}>{v}</p><p className="text-[11px] text-slate-500">{d}</p></div>;
    return (
        <div className="space-y-6">
            <div><p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Inteligencia</p><h1 className="text-3xl font-black text-white">Análisis Financiero</h1></div>
            <select value={rif} onChange={e=>setRif(e.target.value)} className="bg-slate-900 border border-slate-800 text-white text-xs rounded-xl px-3 py-2.5 outline-none font-bold focus:border-blue-500 transition-colors">
                <option value="">Seleccionar empresa...</option>{empresas.map(e=><option key={e.rif} value={e.rif}>{e.empresa}</option>)}
            </select>
            {loading&&<div className="flex items-center gap-2 text-slate-500 text-sm font-bold"><Icon name="Loader" size={14} className="animate-spin"/>Cargando...</div>}
            {journal.length>0&&<>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Ind l="Capital de Trabajo" v={`$${kw.toFixed(2)}`} d="Activos - Pasivos" c={kw>=0?'text-emerald-400':'text-rose-400'}/>
                    <Ind l="Margen Bruto" v={`${mb.toFixed(1)}%`} d="(Ventas-Costo)/Ventas" c={mb>20?'text-emerald-400':'text-amber-400'}/>
                    <Ind l="Margen Neto" v={`${mn.toFixed(1)}%`} d="Utilidad/Ventas" c={mn>10?'text-emerald-400':'text-rose-400'}/>
                    <Ind l="Rotación Inventario" v={`${ri.toFixed(2)}x`} d="Costo/Inventario" c={ri>1?'text-emerald-400':'text-amber-400'}/>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest mb-4">Recomendaciones Automáticas</h3>
                    {recs.map((r,i)=>{const cm={critico:'rose',medio:'amber',bajo:'blue',positivo:'emerald'}[r.t]||'blue';return<div key={i} className={`flex items-start gap-3 p-4 rounded-xl bg-${cm}-500/5 border border-${cm}-500/20`}><Icon name={r.t==='positivo'?'CheckCircle':'AlertTriangle'} size={14} className={`text-${cm}-400 mt-0.5 flex-shrink-0`}/><p className={`text-xs font-medium text-${cm}-300`}>{r.m}</p></div>;})}
                </div>
            </>}
        </div>
    );
};

const AuditAlertas = ({ empresas }) => {
    const [all, setAll] = useState([]); const [loading, setLoading] = useState(false);
    const escanear = async () => {
        setLoading(true); const res=[];
        for(const e of empresas.slice(0,10)){ try{ const d=await auditGetMovs(e.rif); auditAlertas(d||[]).forEach(a=>res.push({...a,empresa:e.empresa})); }catch(err){} }
        setAll(res); setLoading(false);
    };
    const crit=all.filter(a=>a.nivel==='critico'), med=all.filter(a=>a.nivel==='medio');
    return (
        <div className="space-y-6">
            <div><p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Monitoreo</p><h1 className="text-3xl font-black text-white">Centro de Alertas</h1></div>
            <div className="grid grid-cols-3 gap-4">{[{l:'Críticas',c:crit.length,col:'rose'},{l:'Advertencias',c:med.length,col:'amber'},{l:'Total Empresas',c:empresas.length,col:'blue'}].map((s,i)=><div key={i} className={`bg-slate-900 border border-${s.col}-500/20 rounded-2xl p-5`}><p className={`text-[10px] font-black text-${s.col}-400 uppercase tracking-widest mb-2`}>{s.l}</p><p className="text-3xl font-black text-white">{s.c}</p></div>)}</div>
            <button onClick={escanear} disabled={loading} className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase rounded-xl transition-colors disabled:opacity-50">
                {loading?<><Icon name="Loader" size={14} className="animate-spin"/>Escaneando...</>:<><Icon name="Scan" size={14}/>Escanear Todas las Empresas</>}
            </button>
            {all.length>0&&<div className="space-y-3">{all.map((a,i)=>{const cm={critico:'rose',medio:'amber',bajo:'blue'}[a.nivel]||'blue'; return<div key={i} className={`bg-slate-900 border border-${cm}-500/20 rounded-xl p-4 flex items-start gap-4`}><div className={`p-2 rounded-lg bg-${cm}-500/10 flex-shrink-0`}><Icon name="AlertTriangle" size={14} className={`text-${cm}-400`}/></div><div><div className="flex items-center gap-2 mb-1"><AuditBadge label={a.nivel.toUpperCase()} color={a.nivel==='critico'?'red':a.nivel==='medio'?'yellow':'blue'}/><span className="text-xs font-black text-white uppercase">{a.empresa}</span></div><p className={`text-xs text-${cm}-300 font-medium`}>{a.msg}</p></div></div>;})}
            </div>}
            {all.length===0&&!loading&&<div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center"><Icon name="ShieldCheck" size={32} className="text-slate-700 mx-auto mb-3"/><p className="text-slate-600 text-xs font-black uppercase">Haz clic en "Escanear" para analizar las empresas</p></div>}
        </div>
    );
};

// ==========================================
// PANEL AUDITOR COMPLETO
// ==========================================
