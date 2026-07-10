const DebtModule = ({ onBack }) => {
    const { journal, addTransaction, tasaBCV } = useContext(AppContext);

    const [selectedClient, setSelectedClient] = useState(null);
    const [payModal, setPayModal] = useState(false);
    const [payData, setPayData] = useState({ usd: '', bs: '', banco: '', ref: '' });

    const clientBalances = useMemo(() => {
        const balances = {};
        journal.filter(t => String(t.codigo_cuenta || t.Cuenta||'').trim() === CTA.CXC || String(t.codigo_cuenta || t.Cuenta||'').includes('COBRAR')).forEach(t => {
            const conceptoStr = String(t.concepto || t.Concepto || '');
            let cliente = String(t.entidad || t.Entidad || "DESCONOCIDO");
            if (cliente === "GENERAL" && conceptoStr.includes("Cliente:")) cliente = conceptoStr.split("Cliente:")[1].trim();

            if (!balances[cliente]) balances[cliente] = { name: cliente, total: 0 };
            balances[cliente].total += (parseFloat(t.debe_usd || t.Debe) || 0) - (parseFloat(t.haber_usd || t.Haber) || 0);
        });
        return Object.values(balances).filter(b => b.total > 0.01);
    }, [journal]);

    const totalToPayUSD = (parseFloat(payData.usd) || 0) + ((parseFloat(payData.bs) || 0) / tasaBCV) + ((parseFloat(payData.banco) || 0) / tasaBCV);

    const handleProcessPayment = () => {
        if (totalToPayUSD <= 0) return;
        const ref = `RCP-${Date.now().toString().slice(-4)}`;
        let rows = [{ codigo_cuenta: CTA.CXC, cuenta_contable: 'Cuentas por Cobrar Clientes', concepto: `Abono Deuda | Cliente: ${selectedClient.name}`, debe_usd: 0, haber_usd: totalToPayUSD, unidad: 'monto', ref_doc: ref, entidad: selectedClient.name.toUpperCase() }];
        
        if (parseFloat(payData.usd) > 0) rows.push({ ...rows[0], codigo_cuenta: CTA.CAJA_USD, cuenta_contable: 'Caja Principal ($)', concepto: `Cobro a ${selectedClient.name}`, debe_usd: parseFloat(payData.usd), haber_usd: 0 });
        if (parseFloat(payData.bs) > 0) rows.push({ ...rows[0], codigo_cuenta: CTA.CAJA_BS, cuenta_contable: 'Caja Principal (Bs)', concepto: `Cobro a ${selectedClient.name}`, debe_usd: parseFloat(payData.bs)/tasaBCV, haber_usd: 0 });
        if (parseFloat(payData.banco) > 0) rows.push({ ...rows[0], codigo_cuenta: CTA.BANCOS, cuenta_contable: 'Bancos Nacionales', concepto: `Cobro a ${selectedClient.name} (Ref: ${payData.ref})`, debe_usd: parseFloat(payData.banco)/tasaBCV, haber_usd: 0 });
        
        addTransaction(rows);
        setPayModal(false); setPayData({ usd: '', bs: '', banco: '', ref: '' }); setSelectedClient(null);
    };

    return (
        <div className="animate-in space-y-6 pb-20">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm flex items-center gap-4">
                {/* BOTON GLOBAL MANEJA EL RETROCESO */}
                <h2 className="font-black uppercase italic text-xl text-blue-600">Cobranzas (Clientes Fiao)</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {clientBalances.length === 0 ? <div className="col-span-full p-10 text-center font-bold text-slate-400 uppercase">Sin cuentas pendientes</div> : clientBalances.map(client => (
                    <div key={client.name} className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-sm text-center">
                        <h3 className="font-black text-lg text-slate-800 uppercase mb-4">{client.name}</h3>
                        <div className="bg-slate-50 p-4 rounded-2xl mb-4"><p className="text-[10px] font-black text-slate-400 uppercase">Saldo Pendiente</p><p className="text-3xl font-black text-rose-600">${client.total.toFixed(2)}</p></div>
                        <button onClick={() => { setSelectedClient(client); setPayModal(true); }} className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-xs hover:scale-[1.02] transition-transform">Registrar Pago</button>
                    </div>
                ))}
            </div>
            {payModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white p-8 rounded-[3rem] shadow-2xl max-w-sm w-full border-4 border-emerald-500">
                        <h3 className="text-xl font-black uppercase mb-6 text-center">Abono: {selectedClient?.name}</h3>
                        <div className="space-y-3 mb-6">
                            <input placeholder="Efectivo $" type="number" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:border-emerald-500 border-2 border-transparent" value={payData.usd} onChange={e => setPayData({...payData, usd: e.target.value})} />
                            <input placeholder="Efectivo Bs" type="number" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:border-emerald-500 border-2 border-transparent" value={payData.bs} onChange={e => setPayData({...payData, bs: e.target.value})} />
                            <div className="flex gap-2">
                                <input placeholder="Banco Bs" type="number" className="flex-1 p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:border-emerald-500 border-2 border-transparent" value={payData.banco} onChange={e => setPayData({...payData, banco: e.target.value})} />
                                <input placeholder="Ref" className="w-24 p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none focus:border-emerald-500 border-2 border-transparent" value={payData.ref} onChange={e => setPayData({...payData, ref: e.target.value})} />
                            </div>
                        </div>
                        <button onClick={handleProcessPayment} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase shadow-lg mb-2">Pagar a Sistema</button>
                        <button onClick={() => setPayModal(false)} className="w-full py-4 font-bold text-slate-400 uppercase">Cancelar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

