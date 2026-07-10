const ExpensesModule = ({ onBack }) => {
    const { addTransaction, tasaBCV, journal, contacts } = useContext(AppContext);
    
    const expenseAccounts = useMemo(() => {
        if (typeof window !== 'undefined' && window.CHART_OF_ACCOUNTS) {
            return Object.entries(window.CHART_OF_ACCOUNTS)
                .filter(([code, data]) => data.visibilidad && data.visibilidad.includes('expenses') && code.startsWith('6.'))
                .map(([code, data]) => ({ id: code, nombre: data.nombre }));
        }
        return [{ id: '6.1.01.01', nombre: 'Gastos Generales' }]; 
    }, []);

    const providers = contacts.filter(c => c.type === 'proveedor' || c.type === 'ambos');

    const [expense, setExpense] = useState({ beneficiarioId: '', beneficiario: '', categoria: expenseAccounts[0]?.id || '', concepto: '', monto: '' });
    const [payments, setPayments] = useState({ usd: '', bs: '', banco: '', cxp: '' });

    const recentExpenses = useMemo(() => journal.filter(r => String(r.codigo_cuenta||r.Cuenta||'').startsWith('6.') && (parseFloat(r.debe_usd || r.Debe) > 0)).slice(-5).reverse(), [journal]);

    const totalMonto = parseFloat(expense.monto) || 0;
    const totalPagado = (parseFloat(payments.usd) || 0) + ((parseFloat(payments.bs) || 0) / tasaBCV) + ((parseFloat(payments.banco) || 0) / tasaBCV) + ((parseFloat(payments.cxp) || 0) / tasaBCV);
    const canProcess = totalMonto > 0 && expense.beneficiario.trim() !== '' && expense.concepto.trim() !== '' && Math.abs(totalMonto - totalPagado) < 0.05;

    const handleRegistrarGasto = () => {
        if (!canProcess) return;
        const ref = `GST-${Date.now().toString().slice(-4)}`;
        let rows = [];

        const accountName = expenseAccounts.find(a => a.id === expense.categoria)?.nombre || 'Gasto Operativo';
        const conceptoDetallado = `Pago a: ${expense.beneficiario} | Ref: ${ref} | ${expense.concepto}`;

        rows.push({ codigo_cuenta: expense.categoria, cuenta_contable: accountName, concepto: conceptoDetallado, debe_usd: totalMonto, haber_usd: 0, unidad: 'monto', ref_doc: ref, entidad: expense.beneficiario.toUpperCase() });

        const pMap = [
            { k: 'usd', c: CTA.CAJA_USD, n: 'Caja Principal ($)' }, { k: 'bs', c: CTA.CAJA_BS, n: 'Caja Principal (Bs)' },
            { k: 'banco', c: CTA.BANCOS, n: 'Bancos Nacionales' }, { k: 'cxp', c: CTA.CXP, n: 'Proveedores por Pagar' }
        ];

        pMap.forEach(p => {
            if (parseFloat(payments[p.k]) > 0) {
                const montoHaber = p.k === 'usd' ? parseFloat(payments[p.k]) : (parseFloat(payments[p.k]) / tasaBCV);
                rows.push({ codigo_cuenta: p.c, cuenta_contable: p.n, concepto: conceptoDetallado, debe_usd: 0, haber_usd: montoHaber, unidad: 'monto', ref_doc: ref, entidad: expense.beneficiario.toUpperCase() });
            }
        });

        const dif = rows.reduce((acc, r) => acc + (parseFloat(r.debe_usd) || 0), 0) - rows.reduce((acc, r) => acc + (parseFloat(r.haber_usd) || 0), 0);
        if (Math.abs(dif) > 0.009) rows.push({ codigo_cuenta: CTA.DIF_CAMB, cuenta_contable: 'Diferencial Cambiario', concepto: `Ajuste Redondeo en Gasto ${ref}`, debe_usd: dif < 0 ? Math.abs(dif) : 0, haber_usd: dif > 0 ? dif : 0, unidad: 'monto', ref_doc: ref, entidad: expense.beneficiario.toUpperCase() });

        addTransaction(rows);
        setExpense({ beneficiarioId: '', beneficiario: '', categoria: expenseAccounts[0]?.id || '', concepto: '', monto: '' });
        setPayments({ usd: '', bs: '', banco: '', cxp: '' });
        onBack();
    };

    return (
        <div className="animate-in space-y-6">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
                {/* BOTON GLOBAL MANEJA EL RETROCESO */}
                <h2 className="font-black uppercase italic tracking-tighter text-xl text-rose-600">Registro de Gastos Operativos</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 flex flex-col space-y-6">
                    <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1 relative">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Buscar RIF / Cédula</label>
                                <Icon name="Search" size={16} className="absolute left-4 top-9 text-slate-400" />
                                <input placeholder="J-00000000" className="w-full pl-10 p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none focus:border-rose-300 border-2 border-transparent transition-all" value={expense.beneficiarioId} onChange={e => { const valor = e.target.value.toUpperCase(); setExpense({...expense, beneficiarioId: valor}); const found = providers.find(p => (p.id || p.rif_entidad)?.includes(valor) && valor.length > 3); if (found) setExpense(prev => ({...prev, beneficiario: found.name, beneficiarioId: found.id})); }} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nombre Proveedor *</label>
                                <input list="expense-providers" placeholder="Pedro Pérez, Corpoelec..." className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none focus:border-rose-300 border-2 border-transparent transition-all" value={expense.beneficiario} onChange={e => { const valor = e.target.value.toUpperCase(); const found = providers.find(p => p.name === valor); if (found) setExpense(prev => ({...prev, beneficiario: found.name, beneficiarioId: found.id})); else setExpense(prev => ({...prev, beneficiario: valor})); }} />
                                <datalist id="expense-providers">{providers.map(p => <option key={p.id} value={p.name} />)}</datalist>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Cuenta Contable (Gasto) *</label>
                                <select className="w-full p-4 bg-rose-50 text-rose-700 rounded-2xl font-black uppercase outline-none cursor-pointer text-sm" value={expense.categoria} onChange={e => setExpense({...expense, categoria: e.target.value})}>{expenseAccounts.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}</select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Concepto / Motivo *</label>
                                <input placeholder="Detalle del gasto..." className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:border-rose-300 border-2 border-transparent transition-all" value={expense.concepto} onChange={e => setExpense({...expense, concepto: e.target.value})} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex-1">
                        <h3 className="text-xs font-black uppercase text-slate-400 mb-4 ml-2">Últimos Gastos Registrados</h3>
                        <div className="overflow-hidden rounded-2xl border border-slate-100">
                            <table className="w-full text-xs font-bold">
                                <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr><th className="p-3 text-left">Ref</th><th className="p-3 text-left">Cuenta</th><th className="p-3 text-left truncate max-w-[150px]">Concepto</th><th className="p-3 text-right">Monto</th></tr></thead>
                                <tbody className="divide-y divide-slate-50">
                                    {recentExpenses.length === 0 && <tr><td colSpan="4" className="p-6 text-center text-slate-400 italic">No hay gastos recientes</td></tr>}
                                    {recentExpenses.map((r, i) => <tr key={i} className="hover:bg-slate-50"><td className="p-3 text-slate-500">{r.ref_doc || r.Ref}</td><td className="p-3 uppercase text-rose-600">{r.cuenta_contable || r.Nombre}</td><td className="p-3 truncate max-w-[150px] text-slate-600">{r.concepto || r.Concepto}</td><td className="p-3 text-right font-black">${parseFloat(r.debe_usd || r.Debe).toFixed(2)}</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-xl space-y-6">
                        <div className="space-y-1 border-b border-white/10 pb-6">
                            <label className="text-[10px] font-black uppercase text-rose-400">Monto Total del Gasto ($) *</label>
                            <input type="number" placeholder="0.00" className="w-full text-5xl font-black bg-transparent outline-none text-right italic tracking-tighter placeholder-white/20 text-rose-400" value={expense.monto} onChange={e => setExpense({...expense, monto: e.target.value})} />
                            <p className="text-right text-xs font-bold text-slate-400 mt-2">Equivalente: {(totalMonto * tasaBCV).toFixed(2)} Bs</p>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center"><p className="text-[10px] font-black uppercase text-white/40 italic">¿De dónde sale el dinero?</p><p className={`text-[10px] font-black ${Math.abs(totalMonto - totalPagado) > 0.05 ? 'text-rose-400' : 'text-emerald-400'}`}>Falta justificar: ${(totalMonto - totalPagado).toFixed(2)}</p></div>
                            <div className="relative"><span className="absolute left-4 top-4 text-slate-400 text-xs font-bold">Caja $</span><input type="number" className="w-full pl-16 p-4 bg-white/5 rounded-2xl text-right font-bold outline-none border border-white/10 focus:border-rose-400 transition-colors" value={payments.usd} onChange={e => setPayments({...payments, usd: e.target.value})} /></div>
                            <div className="relative"><span className="absolute left-4 top-4 text-slate-400 text-xs font-bold">Caja Bs</span><input type="number" className="w-full pl-16 p-4 bg-white/5 rounded-2xl text-right font-bold outline-none border border-white/10 focus:border-rose-400 transition-colors" value={payments.bs} onChange={e => setPayments({...payments, bs: e.target.value})} /></div>
                            <div className="relative"><span className="absolute left-4 top-4 text-slate-400 text-xs font-bold">Banco Bs</span><input type="number" className="w-full pl-20 p-4 bg-white/5 rounded-2xl text-right font-bold outline-none border border-white/10 focus:border-rose-400 transition-colors" value={payments.banco} onChange={e => setPayments({...payments, banco: e.target.value})} /></div>
                            <div className="relative mt-4"><span className="absolute left-4 top-4 text-orange-400 text-xs font-bold">CxP (Crédito) Bs</span><input type="number" className="w-full pl-32 p-4 bg-orange-500/10 text-orange-400 rounded-2xl text-right font-bold outline-none border border-orange-500/20 focus:border-orange-400 transition-colors" value={payments.cxp} onChange={e => setPayments({...payments, cxp: e.target.value})} /></div>
                        </div>
                        <button onClick={handleRegistrarGasto} disabled={!canProcess} className={`w-full py-6 rounded-[2rem] font-black uppercase italic shadow-lg transition-all flex justify-center items-center gap-2 ${canProcess ? 'bg-rose-600 hover:bg-rose-700 text-white hover:-translate-y-1' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}><Icon name="Receipt" size={20}/> Registrar Salida</button>
                    </div>
                </div>
            </div>
        </div>
    );
};