const Dashboard = ({ setView }) => {
    const { currentUser, journal, tasaBCV, isLocked, setIsInit, setCurrentUser } = useContext(AppContext);
    
    // ESTADO PARA EL MODO OSCURO
    const [isDarkMode, setIsDarkMode] = useState(false);
    
    const nombreEmp = currentUser?.nombre_empresa || currentUser?.nombre || NOMBRE_EMPRESA_DEFAULT;
    const tema = currentUser?.color_tema || 'blue';

    // EFECTO PARA CAMBIAR EL FONDO DE TODA LA PÁGINA (BODY)
    useEffect(() => {
        if (isDarkMode) {
            document.body.style.backgroundColor = "#0f172a"; // slate-900
        } else {
            document.body.style.backgroundColor = "#f8fafc"; // slate-50
        }
    }, [isDarkMode]);

    // VARIABLES DE ESTILO DINÁMICO
    const bgContainer = isDarkMode ? 'bg-slate-900' : 'bg-slate-50';
    const cardClass = isDarkMode 
        ? 'bg-slate-800 border-slate-700 shadow-2xl' 
        : 'bg-white border-slate-100 shadow-sm';
    const textMain = isDarkMode ? 'text-white' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-500';

    const stats = useMemo(() => {
        let usd = 0, bsFisico = 0, bancosFisico = 0, cxc = 0, gastos = 0;
        journal.forEach(r => {
            const debe = parseFloat(r.debe_usd || r.Debe || 0);
            const haber = parseFloat(r.haber_usd || r.Haber || 0);
            const neto = debe - haber;
            const tH = parseFloat(r.tasa || r.Tasa) || tasaBCV;
            const cta = String(r.codigo_cuenta || r.Cuenta || '').trim();

            if (cta === CTA.CAJA_USD || cta.includes('$')) usd += neto;
            if (cta === CTA.CAJA_BS || cta.includes('Bs')) bsFisico += (neto * tH);
            if (cta === CTA.BANCOS || cta.includes('Banco')) bancosFisico += (neto * tH);
            if (cta === CTA.CXC || cta.toUpperCase().includes('COBRAR')) cxc += neto;
            if (cta.startsWith('5.') || cta.startsWith('6.') && debe > 0) gastos += debe;
        });
        return { usd, bsFisico, bancosFisico, cxc, gastos };
    }, [journal, tasaBCV]);

    const recentActivity = useMemo(() => {
        const grouped = {};
        const reversed = [...journal].reverse();
        reversed.forEach(r => {
            const rRef = String(r.ref_doc || r.Ref || '');
            if (!rRef) return;

            if (!grouped[rRef]) {
                let type = 'Registro'; let icon = 'Circle'; let color = 'text-slate-500'; let bg = 'bg-slate-100';
                
                if (rRef.startsWith('VTA')) { type = 'Venta'; icon = 'ShoppingCart'; color = 'text-emerald-600'; bg = 'bg-emerald-100'; }
                else if (rRef.startsWith('GST')) { type = 'Gasto'; icon = 'TrendingDown'; color = 'text-rose-600'; bg = 'bg-rose-100'; }
                else if (rRef.startsWith('REC')) { type = 'Compra'; icon = 'Truck'; color = 'text-blue-600'; bg = 'bg-blue-100'; }
                else if (rRef.startsWith('RCP')) { type = 'Abono'; icon = 'UserCheck'; color = 'text-orange-600'; bg = 'bg-orange-100'; }

                const conceptoStr = String(r.concepto || r.Concepto || '');
                const timeStr = r.fecha_local ? new Date(r.fecha_local).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : String(r.Hora || '');
                grouped[rRef] = { ref: rRef, time: timeStr, type, icon, color, bg, desc: conceptoStr.split('|')[0].trim(), amount: 0 };
            }
            const g = grouped[rRef];
            const cta = String(r.codigo_cuenta || r.Cuenta || '').trim();
            const debe = parseFloat(r.debe_usd || r.Debe || 0);
            const haber = parseFloat(r.haber_usd || r.Haber || 0);

            if (rRef.startsWith('VTA') && (cta === CTA.VENTAS || cta.includes('VENTA'))) g.amount += haber;
            else if (rRef.startsWith('GST') && (cta.startsWith('6.') || cta.includes('GASTO'))) g.amount += debe;
            else if (rRef.startsWith('REC') && cta === CTA.INVENTARIO) g.amount += debe;
            else if (rRef.startsWith('RCP') && cta === CTA.CXC) g.amount += haber;
        });
        return Object.values(grouped).slice(0, 8); 
    }, [journal]);

    const topDebtors = useMemo(() => {
        const balances = {};
        journal.filter(t => {
            const cta = String(t.codigo_cuenta || t.Cuenta || '').trim();
            return cta === CTA.CXC || cta.includes('COBRAR');
        }).forEach(t => {
            const conceptoStr = String(t.concepto || t.Concepto || '');
            let cliente = String(t.entidad || t.Entidad || "DESCONOCIDO");
            if (cliente === "GENERAL" && conceptoStr.includes("Cliente:")) cliente = conceptoStr.split("Cliente:")[1].trim();
            
            if (!balances[cliente]) balances[cliente] = 0;
            balances[cliente] += (parseFloat(t.debe_usd || t.Debe || 0)) - (parseFloat(t.haber_usd || t.Haber || 0));
        });
        return Object.entries(balances).filter(([_, bal]) => bal > 0.01).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, total]) => ({ name, total }));
    }, [journal]);

    const topProducts = useMemo(() => {
        const salesMap = {};
        journal.filter(row => String(row.codigo_cuenta || row.Cuenta || '').trim() === CTA.VENTAS).forEach(row => {
            const conceptoStr = String(row.concepto || row.Concepto || '');
            const parts = conceptoStr.split('|').map(s => s.trim());
            let name = parts[0].replace(/^(VENTA|Venta de)\s*:?\s*/i, '').trim().toUpperCase();
            if (!name) return;
            const qtyStr = parts[0].match(/(\d+(\.\d+)?)/);
            const qty = parseFloat(row.cantidad || row.Cantidad || 0) || (qtyStr ? parseFloat(qtyStr[0]) : 0);
            
            if (!salesMap[name]) salesMap[name] = { name, totalQty: 0 };
            salesMap[name].totalQty += qty;
        });
        return Object.values(salesMap).sort((a, b) => b.totalQty - a.totalQty).slice(0, 5); 
    }, [journal]);

    const handleLogout = () => {
        if(confirm("¿Seguro que desea cerrar sesión?")) { setIsInit(false); setCurrentUser(null); }
    };

    return (
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in p-4 rounded-[3rem] transition-colors duration-500 ${bgContainer}`}>
            <div className="lg:col-span-8 flex flex-col gap-6">
                
                {/* TARJETA SUPERIOR */}
                <div className="flex justify-between items-end bg-slate-900 text-white p-8 rounded-[3rem] shadow-xl relative overflow-hidden">
                    <div className="relative z-10">
                        <h1 className="text-4xl font-black italic tracking-tighter uppercase">LegalYa <span className={`text-${tema}-500`}>Comercios</span></h1>
                        <p className={`text-${tema}-200 font-bold mt-1 text-sm uppercase tracking-widest`}>{nombreEmp}</p>
                    </div>
                    <div className="text-right relative z-10 flex flex-col items-end">
                        <div className="flex gap-2 mb-4">
                            {/* INTERRUPTOR MODO NOCTURNO */}
                            <button 
                                onClick={() => setIsDarkMode(!isDarkMode)} 
                                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-2xl backdrop-blur-sm border border-white/5 transition-all text-white text-[10px] font-black uppercase"
                            >
                                <Icon name={isDarkMode ? "Sun" : "Moon"} size={14} />
                                {isDarkMode ? 'Modo Normal' : 'Modo Nocturno'}
                            </button>
                            {/* ELIMINADO EL BOTON DE CERRAR SESION DOBLE AQUI PARA LIMPIEZA VISUAL, AHORA ESTA EN EL SIDEBAR */}
                        </div>

                        {isLocked && <span className="bg-rose-500 text-white px-3 py-1 rounded-full font-black text-[10px] uppercase mb-2 animate-pulse shadow-rose-500/50 shadow-lg">Caja Cerrada</span>}
                        <div className="bg-white/10 px-5 py-3 rounded-2xl backdrop-blur-sm border border-white/5 mb-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Tasa Hoy</span>
                            <span className={`text-xl font-black text-${tema}-400`}>{tasaBCV.toFixed(2)} Bs</span>
                        </div>
                    </div>
                    <Icon name="Activity" size={200} className="absolute -right-10 -bottom-10 text-white/5" />
                </div>

                {/* MODULOS: TAMAÑO UNIFORME FORZADO */}
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 auto-rows-fr [&_button]:h-32 [&_button]:w-full">
                    <div className={isLocked ? "opacity-30 pointer-events-none" : ""}><MenuButton onClick={() => setView('pos')} label="Ventas" icon="ShoppingCart" color={`bg-${tema}-600 text-white hover:bg-${tema}-700`}/></div>
                    <div className={isLocked ? "opacity-30 pointer-events-none" : ""}><MenuButton onClick={() => setView('purchase')} label="Compras" icon="Truck" color="bg-slate-800 text-white hover:bg-slate-700"/></div>
                    <div className={isLocked ? "opacity-30 pointer-events-none" : ""}><MenuButton onClick={() => setView('debts')} label="Cobranzas" icon="UserCheck" color="bg-orange-500 text-white hover:bg-orange-600"/></div>
                    <MenuButton onClick={() => setView('contacts')} label="Contactos" icon="Users" color="bg-indigo-600 text-white hover:bg-indigo-700"/>
                    <div className={isLocked ? "opacity-30 pointer-events-none" : ""}><MenuButton onClick={() => setView('expenses')} label="Gastos" icon="Receipt" color="bg-rose-500 text-white hover:bg-rose-600"/></div>
                    <MenuButton onClick={() => setView('inventory')} label="Stock" icon="Package" color={isDarkMode ? "bg-slate-700 text-white border-slate-600" : "bg-white border border-slate-200 text-slate-800 hover:bg-slate-50"}/>
                    <MenuButton onClick={() => setView('close')} label={isLocked ? "Exportar" : "Cierre"} icon={isLocked ? "Download" : "Lock"} color="bg-amber-400 text-white hover:bg-amber-500"/>
                </div>

                {/* TARJETAS DE ESTADISTICAS */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <StatCard label="Usd" val={`$${stats.usd.toFixed(2)}`} icon="DollarSign" color={`text-${tema}-600`} bg={cardClass}/>
                    <StatCard label="Bs" val={`${stats.bsFisico.toFixed(2)}`} icon="Coins" color="text-blue-600" bg={cardClass}/>
                    <StatCard label="Bancos" val={`${stats.bancosFisico.toFixed(2)}`} icon="Landmark" color="text-indigo-600" bg={cardClass}/>
                    <StatCard label="Fiao" val={`$${stats.cxc.toFixed(2)}`} icon="Users" color="text-orange-600" bg={isDarkMode ? cardClass : "bg-orange-50"}/>
                    <StatCard label="Gastos" val={`$${stats.gastos.toFixed(2)}`} icon="TrendingDown" color="text-rose-600" bg={isDarkMode ? cardClass : "bg-rose-50"}/>
                </div>

                {/* RANKINGS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className={`${cardClass} p-6 rounded-[2.5rem] border flex flex-col transition-all`}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className={`font-black text-sm uppercase ${textMain} flex items-center gap-2`}><Icon name="Award" size={16} className={`text-${tema}-600`}/> Top Vendidos</h3>
                        </div>
                        <div className="space-y-2 flex-1">
                            {topProducts.length === 0 ? <p className="text-xs text-slate-400 text-center font-bold py-4 uppercase">Sin datos</p> : topProducts.map((p, i) => (
                                <div key={i} className={`flex justify-between items-center ${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-50'} p-3 rounded-2xl`}>
                                    <div className="flex items-center gap-3">
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${i===0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-600'}`}>{i+1}</span>
                                        <span className={`font-black text-xs uppercase truncate max-w-[150px] ${textMain}`}>{p.name}</span>
                                    </div>
                                    <span className={`font-black text-${tema}-600 text-xs`}>{p.totalQty} unid</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={`${cardClass} p-6 rounded-[2.5rem] border flex flex-col transition-all`}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className={`font-black text-sm uppercase ${textMain} flex items-center gap-2`}><Icon name="AlertCircle" size={16} className="text-rose-600"/> Mayores Deudores</h3>
                        </div>
                        <div className="space-y-3 flex-1">
                            {topDebtors.length === 0 ? <p className="text-xs text-emerald-500 text-center font-bold py-4 uppercase">No hay deudas</p> : topDebtors.map((d, i) => (
                                <div key={i} className={`flex justify-between items-center ${isDarkMode ? 'bg-orange-900/20 border-orange-900/30' : 'bg-orange-50/50 border-orange-100'} p-4 rounded-2xl border`}>
                                    <div className="flex flex-col">
                                        <span className={`font-black text-xs uppercase truncate max-w-[150px] ${textMain}`}>{d.name}</span>
                                        <span className="text-[10px] font-bold text-slate-400">Cliente</span>
                                    </div>
                                    <span className="font-black text-rose-600 text-lg">${d.total.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* LATERAL: ACTIVIDAD RECIENTE */}
            <div className={`lg:col-span-4 ${cardClass} border rounded-[3rem] p-8 flex flex-col h-[calc(100vh-5rem)] min-h-[600px] transition-all`}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className={`font-black text-lg uppercase ${textMain}`}>Actividad Reciente</h3>
                    <div className={`p-3 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-50'} rounded-2xl`}><Icon name="List" size={20} className="text-slate-400"/></div>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-hide">
                    {recentActivity.length === 0 ? <p className="text-center text-slate-400 font-bold text-sm uppercase mt-10">Sin transacciones</p> : recentActivity.map((act, i) => (
                        <div key={i} className="flex gap-4 items-start relative">
                            {i !== recentActivity.length -1 && <div className={`absolute left-6 top-10 bottom-[-24px] w-[2px] ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}></div>}
                            
                            <div className={`p-3 rounded-2xl ${act.bg} ${act.color} flex-shrink-0 relative z-10`}>
                                <Icon name={act.icon} size={20} />
                            </div>
                            <div className="flex-1 min-w-0 pt-1">
                                <div className="flex justify-between items-baseline mb-1">
                                    <p className={`font-black text-sm uppercase ${textMain}`}>{act.type}</p>
                                    <p className="text-[10px] font-bold text-slate-400 flex-shrink-0">{act.time}</p>
                                </div>
                                <p className={`text-xs ${textSub} font-bold leading-tight line-clamp-2`}>{act.desc}</p>
                                <div className="flex justify-between items-center mt-2">
                                    <p className="text-[9px] font-black text-slate-300 uppercase">{act.ref}</p>
                                    {act.amount > 0 && <p className={`text-xs font-black ${act.color}`}>${act.amount.toFixed(2)}</p>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

