const InventoryModule = ({ onBack, initialTab = 'stock' }) => {
    const { inventory, tasaBCV, currentUser, contacts, addTransaction, addContact } = useContext(AppContext);
    const [activeTab, setActiveTab] = useState(initialTab);

    // ── Stock tab ──────────────────────────────────────────────
    const [stockSearch, setStockSearch] = useState('');
    const [etiqueta, setEtiqueta] = useState(null);
    const qrRef = React.useRef(null);

    const filteredInventory = inventory.filter(p =>
        p.name.toLowerCase().includes(stockSearch.toLowerCase())
    );

    React.useEffect(() => {
        if (!etiqueta || !qrRef.current) return;
        qrRef.current.innerHTML = '';
        new QRCode(qrRef.current, {
            text: etiqueta.name,
            width: 220, height: 220,
            correctLevel: QRCode.CorrectLevel.M,
        });
    }, [etiqueta]);

    const obtenerDataURL = () => {
        if (!qrRef.current) return null;
        const canvas = qrRef.current.querySelector('canvas');
        if (canvas) return canvas.toDataURL('image/png');
        const img = qrRef.current.querySelector('img');
        if (img) return img.src;
        return null;
    };

    const descargarQR = () => {
        const dataUrl = obtenerDataURL();
        if (!dataUrl) return;
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `QR_${etiqueta.name.replace(/\s+/g, '_')}.png`;
        link.click();
    };

    const imprimirEtiqueta = () => {
        const dataUrl = obtenerDataURL();
        if (!dataUrl || !etiqueta) return;
        const ventana = window.open('', '_blank', 'width=400,height=500');
        ventana.document.write(`
            <!DOCTYPE html>
            <html><head>
                <meta charset="UTF-8"/>
                <title>Etiqueta — ${etiqueta.name}</title>
                <style>
                    * { margin:0; padding:0; box-sizing:border-box; }
                    body { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:white; padding:24px; }
                    .etiqueta { display:flex; flex-direction:column; align-items:center; gap:12px; border:2px solid #e2e8f0; border-radius:16px; padding:24px; max-width:280px; width:100%; }
                    img { width:200px; height:200px; border-radius:8px; }
                    .nombre { font-size:15px; font-weight:900; text-transform:uppercase; text-align:center; color:#0f172a; letter-spacing:-0.02em; line-height:1.2; }
                    .precio-usd { font-size:22px; font-weight:900; color:#1d4ed8; letter-spacing:-0.03em; }
                    .precio-bs { font-size:13px; font-weight:700; color:#64748b; margin-top:-8px; }
                    .divider { width:100%; height:1px; background:#e2e8f0; }
                    @media print { body { padding:0; } .etiqueta { border:1.5px solid #ccc; } }
                </style>
            </head><body>
                <div class="etiqueta">
                    <img src="${dataUrl}" alt="QR ${etiqueta.name}" />
                    <div class="divider"></div>
                    <p class="nombre">${etiqueta.name}</p>
                    <p class="precio-usd">$${etiqueta.sellPrice.toFixed(2)}</p>
                    <p class="precio-bs">${(etiqueta.sellPrice * tasaBCV).toFixed(2)} Bs</p>
                </div>
                <script>window.onload=()=>{setTimeout(()=>{window.print();window.close()},400)};<\/script>
            </body></html>
        `);
        ventana.document.close();
    };

    // ── Reception tab ─────────────────────────────────────────
    const providers = contacts.filter(c => c.type === 'proveedor' || c.type === 'ambos');
    const [provider, setProvider] = useState({ name: '', rif: '', phone: '' });
    const [cart, setCart] = useState([]);
    const [item, setItem] = useState({ name: '', qty: '', unit: 'unidades', costTotal: '', sellPrice: '', barcode: '' });
    const [payMethod, setPayMethod] = useState('usd');
    const [payForm, setPayForm] = useState({ tasa: tasaBCV.toString(), banco: '1.1.01.03', referencia: '' });
    const [scannerBarcode, setScannerBarcode] = useState(false);

    const totalCompra = cart.reduce((s, c) => s + c.costTotal, 0);

    const providerExists = provider.rif && provider.name
        ? providers.find(c => (c.id === provider.rif) || (c.name === provider.name))
        : null;

    const addItem = () => {
        if (!item.name || !item.qty || !item.costTotal) return;
        setCart(prev => [...prev, {
            ...item,
            qty: parseFloat(item.qty),
            costTotal: parseFloat(item.costTotal),
            sellPrice: parseFloat(item.sellPrice) || 0,
            id: Date.now()
        }]);
        setItem({ name: '', qty: '', unit: 'unidades', costTotal: '', sellPrice: '', barcode: '' });
    };

    const syncProductos = async (cartItems, providerName, rif) => {
        for (const c of cartItems) {
            const nombre = c.name.toUpperCase().trim();
            const costUnitario = c.qty > 0 ? c.costTotal / c.qty : 0;
            try {
                const existing = await sbFetch(`products?rif_empresa=eq.${encodeURIComponent(rif)}&nombre=eq.${encodeURIComponent(nombre)}&activo=eq.true`);
                if (existing && existing.length > 0) {
                    const prod = existing[0];
                    const newStock = parseFloat(prod.stock || 0) + parseFloat(c.qty);
                    await sbFetch(`products?id=eq.${prod.id}`, {
                        method: 'PATCH', prefer: 'return=minimal',
                        body: JSON.stringify({ stock: newStock, costo: costUnitario, precio_venta: parseFloat(c.sellPrice) || prod.precio_venta, proveedor: providerName.toUpperCase(), ultima_compra: new Date().toISOString(), codigo_barra: c.barcode || prod.codigo_barra || '' })
                    });
                } else {
                    const countRes = await sbFetch(`products?rif_empresa=eq.${encodeURIComponent(rif)}&select=id`);
                    const count = (countRes?.length || 0) + 1;
                    const codigoProd = `PROD-${String(count).padStart(5, '0')}`;
                    await sbFetch('products', {
                        method: 'POST', prefer: 'return=minimal',
                        body: JSON.stringify({ rif_empresa: rif, codigo_producto: codigoProd, codigo_qr: `LEGALYA-${codigoProd}`, nombre, categoria: 'GENERAL', unidad: c.unit || 'unidades', costo: costUnitario, precio_venta: parseFloat(c.sellPrice) || 0, stock: parseFloat(c.qty), proveedor: providerName.toUpperCase(), ultima_compra: new Date().toISOString(), codigo_barra: c.barcode || '', activo: true })
                    });
                }
            } catch (e) { console.warn('Error sync producto:', nombre, e.message); }
        }
    };

    const handleRegisterContact = async () => {
        if (!provider.rif || !provider.name) return;
        await addContact({ id: provider.rif, name: provider.name.toUpperCase(), type: 'proveedor', phone: provider.phone || '' });
    };

    const handleFinalizar = async () => {
        if (!provider.name || cart.length === 0) return;
        const ref = `REC-${Date.now().toString().slice(-4)}`;
        let rows = [];

        cart.forEach(c => {
            const concepto = `Recepcion: ${c.name} | Cant: ${c.qty.toFixed(c.unit === 'kg' ? 3 : 0)} ${c.unit} | Prov: ${provider.name}`;
            rows.push({
                codigo_cuenta: CTA.INVENTARIO,
                cuenta_contable: 'Inventario de Mercancía',
                concepto,
                debe_usd: c.costTotal,
                haber_usd: 0,
                unidad: c.unit,
                ref_doc: ref,
                precio_venta: parseFloat(c.sellPrice) || 0,
                entidad: provider.name.toUpperCase(),
                cantidad: c.qty,
                codigo_barra: c.barcode || '',
            });
        });

        let habAccount, habName;
        switch (payMethod) {
            case 'usd':
                habAccount = CTA.CAJA_USD;
                habName = 'Caja Principal ($)';
                break;
            case 'bs':
                habAccount = CTA.CAJA_BS;
                habName = 'Caja Principal (Bs)';
                break;
            case 'transfer':
                habAccount = payForm.banco;
                const chart = window.CHART_OF_ACCOUNTS || {};
                habName = (chart[payForm.banco] || {}).nombre || 'Bancos Nacionales';
                break;
            case 'credit':
                habAccount = CTA.CXP;
                habName = 'Proveedores por Pagar';
                break;
        }

        const tasaUsar = (payMethod === 'bs' || payMethod === 'transfer') ? (parseFloat(payForm.tasa) || tasaBCV) : 0;
        rows.push({
            codigo_cuenta: habAccount,
            cuenta_contable: habName,
            concepto: `Pago Prov: ${provider.name} | Ref: ${ref}`,
            debe_usd: 0,
            haber_usd: totalCompra,
            unidad: 'monto',
            ref_doc: ref,
            entidad: provider.name.toUpperCase(),
            cantidad: 0,
            tasa: tasaUsar,
        });

        const dif = rows.reduce((a, r) => a + (parseFloat(r.debe_usd) || 0), 0) - rows.reduce((a, r) => a + (parseFloat(r.haber_usd) || 0), 0);
        if (Math.abs(dif) > 0.009) {
            rows.push({
                codigo_cuenta: CTA.DIF_CAMB,
                cuenta_contable: 'Diferencial Cambiario',
                concepto: `Ajuste Redondeo en Compra ${ref}`,
                debe_usd: dif < 0 ? Math.abs(dif) : 0,
                haber_usd: dif > 0 ? dif : 0,
                unidad: 'monto',
                ref_doc: ref,
                entidad: provider.name.toUpperCase(),
            });
        }

        await addTransaction(rows);

        const rif = currentUser?.rif || RIF_DEFAULT;
        syncProductos(cart, provider.name, rif).catch(e => console.warn('Sync products error:', e));

        if (payMethod === 'transfer') {
            window.open('https://www.bancodevenezuela.com/index.html', 'BDV', 'width=1000,height=700,resizable=yes,scrollbars=yes');
        }

        onBack();
    };

    const chartAccounts = window.CHART_OF_ACCOUNTS || {};
    const bancos = Object.entries(chartAccounts).filter(([k]) => k.startsWith('1.1.01') || k.startsWith('1.1.02'));

    const canConfirm = provider.name && cart.length > 0 &&
        (payMethod !== 'bs' || (payForm.tasa && parseFloat(payForm.tasa) > 0)) &&
        (payMethod !== 'transfer' || payForm.banco);

    // ── Barcode scanner modal (reception) ──
    const BarcodeScanner = () => {
        const qrRef2 = React.useRef(null);
        const [camError, setCamError] = useState('');

        React.useEffect(() => {
            let instance = null;
            (async () => {
                try {
                    instance = new Html5Qrcode('barcode-reader-reception');
                    await instance.start(
                        { facingMode: 'environment' },
                        { fps: 10, qrbox: { width: 300, height: 100 } },
                        (code) => {
                            setItem(prev => ({ ...prev, barcode: code }));
                            const found = inventory.find(p =>
                                p.codigo_barra === code || p.name === code.toUpperCase()
                            );
                            if (found) setItem(prev => ({
                                ...prev,
                                name: found.name,
                                sellPrice: found.sellPrice.toString(),
                                barcode: code,
                            }));
                            if (instance) { instance.stop().catch(() => {}); }
                            setScannerBarcode(false);
                        },
                        () => {}
                    );
                } catch (err) {
                    setCamError('No se pudo acceder a la cámara. Verifica permisos HTTPS/localhost.');
                }
            })();
            return () => {
                if (instance) { instance.stop().then(() => instance.clear()).catch(() => {}); }
            };
        }, []);

        return (
            <div className="fixed inset-0 bg-black z-50 flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 bg-black/80">
                    <p className="text-white font-black uppercase text-sm">Escanear código</p>
                    <button onClick={() => setScannerBarcode(false)} className="px-4 py-2 bg-white/10 text-white rounded-xl text-xs font-black uppercase">Cerrar</button>
                </div>
                <div className="flex-1 relative">
                    <div id="barcode-reader-reception" className="w-full h-full" />
                    {camError && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
                            <p className="text-rose-300 text-xs font-bold text-center whitespace-pre-line">{camError}</p>
                        </div>
                    )}
                    <style>{`
                        #barcode-reader-reception video { width:100% !important; height:100% !important; object-fit:cover !important; }
                        #barcode-reader-reception > img, #barcode-reader-reception__header_message,
                        #barcode-reader-reception__status_span, #barcode-reader-reception__camera_selection,
                        #barcode-reader-reception__dashboard { display:none !important; }
                    `}</style>
                </div>
            </div>
        );
    };

    // ── RENDER ──
    return (
        <div className="animate-in space-y-6">
            {/* Tab bar */}
            <div className="bg-white p-1.5 rounded-[2rem] shadow-sm border border-slate-100 flex gap-1 w-max">
                <button onClick={() => setActiveTab('stock')}
                    className={`px-6 py-3 rounded-[1.5rem] font-black uppercase text-xs tracking-wider transition-all ${activeTab === 'stock' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-700'}`}>
                    <Icon name="Package" size={14} className="inline mr-2" />Stock
                </button>
                <button onClick={() => setActiveTab('reception')}
                    className={`px-6 py-3 rounded-[1.5rem] font-black uppercase text-xs tracking-wider transition-all ${activeTab === 'reception' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-700'}`}>
                    <Icon name="Truck" size={14} className="inline mr-2" />Recepción
                </button>
            </div>

            {/* ════════════════════════════════════════════════════ */}
            {/* STOCK TAB */}
            {/* ════════════════════════════════════════════════════ */}
            {activeTab === 'stock' && (
                <div className="space-y-6">
                    <div className="bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <h2 className="font-black uppercase italic tracking-tighter text-xl flex-1">Stock Actual</h2>
                        <div className="relative w-full sm:w-72">
                            <Icon name="Search" size={16} className="absolute left-3 top-3 text-slate-400" />
                            <input type="text" placeholder="BUSCAR PRODUCTO..." value={stockSearch}
                                onChange={e => setStockSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold uppercase outline-none focus:border-blue-500 transition-colors" />
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
                        <table className="w-full text-sm font-bold">
                            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                                <tr>
                                    <th className="p-4 md:p-6 text-left">Producto</th>
                                    <th className="p-4 md:p-6 text-center">Existencia</th>
                                    <th className="p-4 md:p-6 text-center">Unidad</th>
                                    <th className="p-4 md:p-6 text-right">Precio</th>
                                    <th className="p-4 md:p-6 text-center">Etiqueta</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredInventory.length === 0 && (
                                    <tr><td colSpan={5} className="p-12 text-center text-slate-300 font-bold uppercase text-sm">Sin productos en inventario</td></tr>
                                )}
                                {filteredInventory.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 md:p-6 uppercase font-black">{p.name}</td>
                                        <td className="p-4 md:p-6 text-center text-blue-600">{p.stock.toFixed(p.unit === 'kg' ? 3 : 0)}</td>
                                        <td className="p-4 md:p-6 text-center uppercase text-[10px] text-slate-400">{p.unit}</td>
                                        <td className="p-4 md:p-6 text-right font-black">${p.sellPrice.toFixed(2)}</td>
                                        <td className="p-4 md:p-6 text-center">
                                            <button onClick={() => setEtiqueta(p)}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-black active:scale-95 text-white rounded-xl text-[10px] font-black uppercase transition-all"
                                                title={`Generar etiqueta QR para ${p.name}`}>
                                                <Icon name="QrCode" size={13} />
                                                <span className="hidden sm:inline">Etiqueta</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {etiqueta && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                            onClick={e => { if (e.target === e.currentTarget) setEtiqueta(null); }}>
                            <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 max-w-sm w-full flex flex-col items-center gap-5 animate-in">
                                <div className="w-full flex items-center justify-between">
                                    <h3 className="font-black uppercase text-sm text-slate-400 tracking-widest">Etiqueta QR</h3>
                                    <button onClick={() => setEtiqueta(null)}
                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors">
                                        <Icon name="X" size={16} className="text-slate-500" />
                                    </button>
                                </div>
                                <div ref={qrRef} className="p-3 bg-white border-2 border-slate-100 rounded-2xl shadow-inner flex items-center justify-center"
                                    style={{ minWidth: 228, minHeight: 228 }} />
                                <div className="text-center space-y-1">
                                    <p className="font-black uppercase text-lg text-slate-900 leading-tight">{etiqueta.name}</p>
                                    <p className="font-black text-2xl text-blue-600">${etiqueta.sellPrice.toFixed(2)}</p>
                                    <p className="font-bold text-sm text-slate-400">{(etiqueta.sellPrice * tasaBCV).toFixed(2)} Bs</p>
                                </div>
                                <div className="w-full flex gap-3">
                                    <button onClick={descargarQR}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-2xl font-black uppercase text-xs transition-all">
                                        <Icon name="Download" size={15} />Descargar
                                    </button>
                                    <button onClick={imprimirEtiqueta}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-black active:scale-95 text-white rounded-2xl font-black uppercase text-xs transition-all shadow-lg">
                                        <Icon name="Printer" size={15} />Imprimir
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ════════════════════════════════════════════════════ */}
            {/* RECEPTION TAB */}
            {/* ════════════════════════════════════════════════════ */}
            {activeTab === 'reception' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* ── LEFT COLUMN ── */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* Provider */}
                        <div className="bg-white p-6 md:p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-4">
                            <h3 className="font-black uppercase text-xs text-slate-400 tracking-widest">Proveedor</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative">
                                    <Icon name="Search" size={16} className="absolute left-4 top-4 text-slate-400" />
                                    <input placeholder="BUSCAR RIF / CÉDULA..."
                                        className="w-full pl-10 p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none border-2 border-transparent focus:border-blue-500 transition-all"
                                        value={provider.rif}
                                        onChange={e => {
                                            const v = e.target.value.toUpperCase();
                                            setProvider(prev => ({ ...prev, rif: v }));
                                            const found = providers.find(c => c.id?.includes(v));
                                            if (found && v.length > 3) setProvider({ name: found.name, rif: found.id, phone: found.phone || '' });
                                        }} />
                                </div>
                                <div>
                                    <input list="reception-providers"
                                        placeholder="NOMBRE PROVEEDOR *"
                                        className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none border-2 border-transparent focus:border-blue-500 transition-all"
                                        value={provider.name}
                                        onChange={e => {
                                            const v = e.target.value.toUpperCase();
                                            const found = providers.find(c => c.name === v);
                                            if (found) setProvider({ name: found.name, rif: found.id, phone: found.phone || '' });
                                            else setProvider(prev => ({ ...prev, name: v }));
                                        }} />
                                    <datalist id="reception-providers">
                                        {providers.map(c => <option key={c.id} value={c.name} />)}
                                    </datalist>
                                </div>
                            </div>
                            {provider.rif && provider.name && !providerExists && (
                                <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl text-xs font-bold text-amber-700">
                                    Proveedor no registrado. Al finalizar la compra podrás registrarlo como contacto.
                                </div>
                            )}
                        </div>

                        {/* Product form */}
                        <div className="bg-white p-6 md:p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-4">
                            <h3 className="font-black uppercase text-xs text-slate-400 tracking-widest">Producto</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <input list="reception-products"
                                        placeholder="NOMBRE PRODUCTO *"
                                        className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none border-2 border-transparent focus:border-blue-500 transition-all"
                                        value={item.name}
                                        onChange={e => {
                                            const v = e.target.value.toUpperCase();
                                            const found = inventory.find(p => p.name === v);
                                            if (found) setItem(prev => ({ ...prev, name: found.name, sellPrice: found.sellPrice.toString(), barcode: found.codigo_barra || '' }));
                                            else setItem(prev => ({ ...prev, name: v }));
                                        }} />
                                    <datalist id="reception-products">
                                        {inventory.map(p => <option key={p.id} value={p.name} />)}
                                    </datalist>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Cant / Peso</label>
                                    <input type="number" step={item.unit === 'kg' ? "0.001" : "1"}
                                        className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none"
                                        value={item.qty} onChange={e => setItem(prev => ({ ...prev, qty: e.target.value }))} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Unidad</label>
                                    <select className="w-full p-4 bg-blue-50 text-blue-600 rounded-2xl font-black uppercase outline-none"
                                        value={item.unit}
                                        onChange={e => setItem(prev => ({ ...prev, unit: e.target.value }))}>
                                        <option value="unidades">unidades</option>
                                        <option value="kg">kg</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Costo Total ($)</label>
                                    <input type="number" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none"
                                        value={item.costTotal} onChange={e => setItem(prev => ({ ...prev, costTotal: e.target.value }))} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Precio Venta ($)</label>
                                    <input type="number" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none"
                                        value={item.sellPrice} onChange={e => setItem(prev => ({ ...prev, sellPrice: e.target.value }))} />
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Código de Barra</label>
                                    <div className="flex gap-2">
                                        <input placeholder="0 00000 00000 0"
                                            className="flex-1 p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none border-2 border-transparent focus:border-blue-500 transition-all"
                                            value={item.barcode} onChange={e => setItem(prev => ({ ...prev, barcode: e.target.value }))} />
                                        <button onClick={() => setScannerBarcode(true)}
                                            className="px-5 py-4 bg-slate-900 hover:bg-black active:scale-95 text-white rounded-2xl font-black uppercase text-xs transition-all flex items-center gap-2 shadow-lg">
                                            <Icon name="ScanLine" size={16} />Escanear
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <button onClick={addItem}
                                className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase italic shadow-lg hover:bg-black transition-all">
                                Añadir a Recepción
                            </button>
                        </div>

                        {/* Cart table */}
                        <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                            <table className="w-full text-xs font-bold">
                                <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                                    <tr>
                                        <th className="p-4 text-left">Item</th>
                                        <th className="p-4 text-center">Cant.</th>
                                        <th className="p-4 text-right">Costo Unit.</th>
                                        <th className="p-4 text-right">Precio Vta</th>
                                        <th className="p-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {cart.length === 0 && (
                                        <tr><td colSpan={5} className="p-12 text-center text-slate-300 font-bold uppercase text-sm">Carrito vacío</td></tr>
                                    )}
                                    {cart.map(c => (
                                        <tr key={c.id}>
                                            <td className="p-4 uppercase font-black">{c.name}</td>
                                            <td className="p-4 text-center">{c.qty} {c.unit}</td>
                                            <td className="p-4 text-right">{c.qty > 0 ? `$${(c.costTotal / c.qty).toFixed(2)}` : '$0.00'}</td>
                                            <td className="p-4 text-right text-blue-600">${c.sellPrice.toFixed(2)}</td>
                                            <td className="p-4 text-center">
                                                <button onClick={() => setCart(prev => prev.filter(x => x.id !== c.id))}
                                                    className="text-rose-400 hover:text-rose-600 transition-colors">
                                                    <Icon name="Trash2" size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ── RIGHT COLUMN — Payment ── */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-slate-900 p-6 md:p-8 rounded-[3rem] text-white shadow-xl space-y-6">
                            <h3 className="font-black uppercase italic text-sm border-b border-white/10 pb-4 text-blue-400">Total Compra</h3>
                            <div className="text-right">
                                <p className="text-5xl font-black tracking-tighter italic">${totalCompra.toFixed(2)}</p>
                            </div>

                            {/* Payment method */}
                            <div className="space-y-3">
                                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Método de Pago</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: 'usd', label: 'Efectivo USD', icon: 'DollarSign' },
                                        { id: 'bs', label: 'Efectivo Bs', icon: 'Coins' },
                                        { id: 'transfer', label: 'Transferencia / PM', icon: 'Landmark' },
                                        { id: 'credit', label: 'Crédito', icon: 'CreditCard' },
                                    ].map(m => (
                                        <button key={m.id} onClick={() => setPayMethod(m.id)}
                                            className={`p-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all border-2 flex flex-col items-center gap-1 ${payMethod === m.id
                                                ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                                                : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'}`}>
                                            <Icon name={m.icon} size={18} />
                                            {m.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Extra fields per method */}
                                {payMethod === 'bs' && (
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Tasa Bs/$</label>
                                        <input type="number" placeholder="0.00"
                                            className="w-full p-3 bg-white/5 rounded-2xl text-center font-bold outline-none border border-white/10"
                                            value={payForm.tasa} onChange={e => setPayForm(prev => ({ ...prev, tasa: e.target.value }))} />
                                    </div>
                                )}

                                {payMethod === 'transfer' && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Tasa Bs/$</label>
                                            <input type="number" placeholder="0.00"
                                                className="w-full p-3 bg-white/5 rounded-2xl text-center font-bold outline-none border border-white/10"
                                                value={payForm.tasa} onChange={e => setPayForm(prev => ({ ...prev, tasa: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Banco Origen</label>
                                            <select className="w-full p-3 bg-white/5 text-white rounded-2xl font-bold outline-none border border-white/10"
                                                value={payForm.banco} onChange={e => setPayForm(prev => ({ ...prev, banco: e.target.value }))}>
                                                <option value="">Seleccionar banco...</option>
                                                {bancos.map(([code, acct]) => (
                                                    <option key={code} value={code} className="text-slate-900">{acct.nombre}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Referencia</label>
                                            <input placeholder="N° de referencia"
                                                className="w-full p-3 bg-white/5 rounded-2xl font-bold outline-none border border-white/10 uppercase"
                                                value={payForm.referencia} onChange={e => setPayForm(prev => ({ ...prev, referencia: e.target.value }))} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Confirm */}
                            <button onClick={handleFinalizar} disabled={!canConfirm}
                                className={`w-full py-5 rounded-[2rem] font-black uppercase italic shadow-lg transition-all flex items-center justify-center gap-2 ${canConfirm
                                    ? 'bg-blue-500 hover:bg-blue-600 active:scale-[0.98]'
                                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
                                <Icon name="CheckCircle" size={18} /> Confirmar Compra
                            </button>

                            {/* Register contact (shown after confirm or independently) */}
                            {provider.rif && provider.name && !providerExists && (
                                <button onClick={handleRegisterContact}
                                    className="w-full py-3 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-2xl font-black uppercase text-[10px] transition-all hover:bg-amber-500/30 flex items-center justify-center gap-2">
                                    <Icon name="UserPlus" size={14} /> Registrar Proveedor como Contacto
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Barcode scanner overlay */}
            {scannerBarcode && <BarcodeScanner />}
        </div>
    );
};
