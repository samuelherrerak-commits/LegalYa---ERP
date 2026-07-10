function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
    );
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < breakpoint);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [breakpoint]);
    return { isMobile };
}

const DeviceManager = ({ onBack, currentUser }) => {
    const rif = currentUser?.rif || RIF_DEFAULT;
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newToken, setNewToken] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const data = await sbFetch(`devices?rif_empresa=eq.${encodeURIComponent(rif)}&order=fecha_conexion.desc`);
            setDevices(data||[]);
        } catch(e) { console.error(e); }
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const generateToken = () => `LY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2,6).toUpperCase()}`;

    const addDevice = async () => {
        const nombre = prompt('Nombre del dispositivo (ej: iPhone de Juan):');
        if (!nombre) return;
        const token = generateToken();
        try {
            await sbFetch('devices', {
                method: 'POST', prefer: 'return=minimal',
                body: JSON.stringify({ rif_empresa: rif, nombre_dispositivo: nombre, usuario: currentUser?.nombre || 'Admin', token, activo: true, fecha_conexion: new Date().toISOString() })
            });
            setNewToken(token);
            await load();
        } catch(e) { alert('Error: ' + e.message); }
    };

    const revokeDevice = async (id) => {
        if (!confirm('¿Revocar acceso a este dispositivo?')) return;
        try {
            await sbFetch(`devices?id=eq.${id}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ activo: false }) });
            await load();
        } catch(e) { console.error(e); }
    };

    const qrTokenUrl = (token) => `${window.location.origin}${window.location.pathname}?device_token=${token}`;

    return (
        <div className="animate-in space-y-5 pb-20">
            <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl"><Icon name="ArrowLeft" size={18}/></button>
                    <div><h2 className="font-black uppercase italic text-xl">Dispositivos Conectados</h2><p className="text-[10px] font-bold text-slate-400 uppercase">{devices.filter(d=>d.activo).length} activos</p></div>
                </div>
                <button onClick={addDevice} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-colors">
                    <Icon name="Plus" size={14}/> Vincular Dispositivo
                </button>
            </div>

            {newToken && (
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-[2rem] p-6 text-center animate-in">
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3">Dispositivo creado — Escanea este QR desde el móvil</p>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrTokenUrl(newToken))}`} alt="QR" className="w-40 h-40 mx-auto rounded-2xl border-4 border-white shadow-lg mb-3"/>
                    <p className="font-mono text-xs text-indigo-600 font-bold bg-white rounded-lg px-3 py-1.5 inline-block border border-indigo-200">{newToken}</p>
                    <button onClick={()=>setNewToken('')} className="block mt-4 mx-auto text-[10px] font-black text-indigo-400 uppercase underline">Cerrar</button>
                </div>
            )}

            {loading ? <div className="flex justify-center py-10"><Icon name="Loader" size={24} className="animate-spin text-slate-400"/></div> : (
                <div className="space-y-3">
                    {devices.length === 0 && <div className="bg-white border border-slate-100 rounded-[2rem] p-12 text-center"><Icon name="Smartphone" size={32} className="text-slate-200 mx-auto mb-3"/><p className="text-slate-400 font-bold text-xs uppercase">Sin dispositivos vinculados</p></div>}
                    {devices.map(d => (
                        <div key={d.id} className={`bg-white border rounded-[1.5rem] p-5 flex items-center justify-between shadow-sm ${d.activo?'border-slate-100':'border-slate-100 opacity-50'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl ${d.activo?'bg-emerald-100':'bg-slate-100'}`}><Icon name="Smartphone" size={20} className={d.activo?'text-emerald-600':'text-slate-400'}/></div>
                                <div>
                                    <p className="font-black text-sm uppercase text-slate-900">{d.nombre_dispositivo}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{d.usuario} · {d.fecha_conexion ? new Date(d.fecha_conexion).toLocaleDateString('es') : '—'}</p>
                                    <p className="font-mono text-[9px] text-slate-300 mt-0.5">{d.token}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${d.activo?'bg-emerald-100 text-emerald-600':'bg-slate-100 text-slate-400'}`}>{d.activo?'Activo':'Revocado'}</span>
                                {d.activo && <button onClick={()=>revokeDevice(d.id)} className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl transition-colors"><Icon name="X" size={16}/></button>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ==========================================
// PAYMENT GATEWAY — arquitectura preparada
// ==========================================
const PaymentGateway = ({ monto, ventaId, rif, onSuccess, onClose }) => {
    const [method, setMethod] = useState('efectivo');
    const [ref, setRef] = useState('');
    const [loading, setLoading] = useState(false);
    const [estado, setEstado] = useState('');

    const methods = [
        { id:'efectivo', label:'Efectivo', icon:'Banknote', color:'text-emerald-600', bg:'bg-emerald-50', border:'border-emerald-200' },
        { id:'transferencia', label:'Transferencia', icon:'ArrowLeftRight', color:'text-blue-600', bg:'bg-blue-50', border:'border-blue-200' },
        { id:'tarjeta', label:'Tarjeta', icon:'CreditCard', color:'text-purple-600', bg:'bg-purple-50', border:'border-purple-200' },
        { id:'punto', label:'Punto de Venta', icon:'Nfc', color:'text-indigo-600', bg:'bg-indigo-50', border:'border-indigo-200' },
    ];

    const handleProcess = async () => {
        setLoading(true); setEstado('pendiente');
        try {
            await sbFetch('payment_transactions', {
                method: 'POST', prefer: 'return=minimal',
                body: JSON.stringify({ rif_empresa: rif, venta_id: ventaId, monto, metodo: method, estado: 'aprobado', referencia: ref || `AUTO-${Date.now().toString().slice(-6)}`, fecha: new Date().toISOString() })
            });
            setEstado('aprobado');
            setTimeout(() => { onSuccess(method, ref); }, 900);
        } catch(e) { setEstado('rechazado'); console.error(e); }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
            <div className="bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] w-full max-w-sm shadow-2xl">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <div><p className="text-[10px] font-black text-slate-400 uppercase">Total a cobrar</p><p className="text-3xl font-black text-slate-900 tracking-tight">${monto.toFixed(2)}</p></div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><Icon name="X" size={18} className="text-slate-400"/></button>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Método de pago</p>
                    <div className="grid grid-cols-2 gap-2">
                        {methods.map(m => (
                            <button key={m.id} onClick={()=>setMethod(m.id)}
                                className={`p-3 rounded-2xl border-2 flex flex-col items-center gap-2 text-[10px] font-black uppercase transition-all ${method===m.id ? `${m.bg} ${m.border} ${m.color}` : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>
                                <Icon name={m.icon} size={20}/>
                                {m.label}
                            </button>
                        ))}
                    </div>
                    {(method==='transferencia'||method==='tarjeta'||method==='punto') && (
                        <input value={ref} onChange={e=>setRef(e.target.value)} placeholder="Nº de referencia / aprobación" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition-colors"/>
                    )}
                    {estado==='aprobado' && <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3"><Icon name="CheckCircle" size={16} className="text-emerald-500"/><span className="text-xs font-black text-emerald-600 uppercase">Pago Aprobado</span></div>}
                    {estado==='rechazado' && <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3"><Icon name="XCircle" size={16} className="text-rose-500"/><span className="text-xs font-black text-rose-600 uppercase">Error — Intenta de nuevo</span></div>}
                    <button onClick={handleProcess} disabled={loading||estado==='aprobado'} className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-black uppercase text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading ? <><Icon name="Loader" size={16} className="animate-spin"/>Procesando...</> : <><Icon name="Zap" size={16}/>Confirmar Pago</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// MOBILE POS — POS simplificado para móvil
// ==========================================
const MobilePOS = ({ onBack, currentUser }) => {
    const { inventory, tasaBCV, addTransaction, contacts } = useContext(AppContext);
    const rif = currentUser?.rif || RIF_DEFAULT;
    const [dbProducts, setDbProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [client, setClient] = useState({ name:'CONTADO', id:'V-00000000' });
    const [scannerOpen, setScannerOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [step, setStep] = useState('products'); // 'products' | 'cart' | 'payment'
    const [gatewayOpen, setGatewayOpen] = useState(false);
    const [feedbackMsg, setFeedbackMsg] = useState('');

    useEffect(() => {
        sbFetch(`products?rif_empresa=eq.${encodeURIComponent(rif)}&activo=eq.true&order=nombre.asc`)
            .then(d => setDbProducts(d||[])).catch(()=>{});
    }, []);

    // Combinar productos de BD y de inventario contable
    const allProducts = useMemo(() => {
        const map = {};
        // primero los del inventario contable
        inventory.forEach(p => { map[p.name] = { id:p.id, name:p.name, precio_venta:p.sellPrice, stock:p.stock, unit:p.unit, costo:p.cost, source:'journal' }; });
        // sobreescribir/complementar con los de la BD de productos
        dbProducts.forEach(p => { map[p.nombre] = { id:`db-${p.id}`, name:p.nombre, precio_venta:p.precio_venta, stock:p.stock, unit:p.unidad||'unidades', costo:p.costo, codigo_qr:p.codigo_qr, codigo_barra:p.codigo_barra, codigo_producto:p.codigo_producto, source:'products' }; });
        return Object.values(map).filter(p=>p.stock>0);
    }, [inventory, dbProducts]);

    const filtered = allProducts.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));
    const total = cart.reduce((a,c)=>a+(c.qty*c.precio_venta),0);

    const addToCart = (prod, qty=1) => {
        setCart(prev => {
            const ex = prev.find(c=>c.id===prod.id);
            if (ex) return prev.map(c=>c.id===prod.id?{...c,qty:c.qty+qty}:c);
            return [...prev, {...prod, qty}];
        });
        setFeedbackMsg(`✓ ${prod.name}`);
        setTimeout(()=>setFeedbackMsg(''),1500);
    };

    const handleScanResult = async (code) => {
        setScannerOpen(false);
        // buscar en products de BD
        const prod = dbProducts.find(p=>p.codigo_qr===code||p.codigo_barra===code||p.codigo_producto===code);
        if (prod) {
            addToCart({ id:`db-${prod.id}`, name:prod.nombre, precio_venta:prod.precio_venta, stock:prod.stock, unit:prod.unidad||'unidades', costo:prod.costo });
        } else {
            // buscar en inventario contable
            const invProd = inventory.find(p=>p.name===code||p.id===code);
            if (invProd) addToCart({ id:invProd.id, name:invProd.name, precio_venta:invProd.sellPrice, stock:invProd.stock, unit:invProd.unit, costo:invProd.cost });
            else alert(`Producto no encontrado: ${code}`);
        }
    };

    const handlePaymentSuccess = (method, ref) => {
        setGatewayOpen(false);
        const refId = `VTA-${Date.now().toString().slice(-4)}`;
        const rows = [];
        cart.forEach(item => {
            rows.push({ codigo_cuenta: CTA.VENTAS, cuenta_contable:'Ventas de Mercancía', concepto:`Venta ${item.name} | ${client.name}`, debe_usd:0, haber_usd:item.qty*item.precio_venta, unidad:item.unit, ref_doc:refId, precio_venta:item.precio_venta, entidad:client.name.toUpperCase(), cantidad:item.qty });
            rows.push({ codigo_cuenta: CTA.INVENTARIO, cuenta_contable:'Inventario', concepto:`Costo Venta ${item.name}`, debe_usd:0, haber_usd:item.qty*item.costo, unidad:item.unit, ref_doc:refId, precio_venta:item.precio_venta, entidad:client.name.toUpperCase(), cantidad:item.qty });
            rows.push({ codigo_cuenta: CTA.COSTO_VTA, cuenta_contable:'Costo de Ventas', concepto:`Costo Venta ${item.name}`, debe_usd:item.qty*item.costo, haber_usd:0, unidad:item.unit, ref_doc:refId, entidad:client.name.toUpperCase(), cantidad:item.qty });
        });
        const cuentaMap = { efectivo:CTA.CAJA_USD, transferencia:CTA.BANCOS, tarjeta:CTA.BANCOS, punto:CTA.BANCOS };
        rows.push({ codigo_cuenta:cuentaMap[method]||CTA.CAJA_USD, cuenta_contable:'Cobro Venta', concepto:`Cobro ${method} ${refId}`, debe_usd:total, haber_usd:0, unidad:'monto', ref_doc:refId, entidad:client.name.toUpperCase() });
        addTransaction(rows);
        setCart([]); setStep('products');
        setFeedbackMsg(`✅ Venta ${refId} procesada`);
        setTimeout(()=>setFeedbackMsg(''),3000);
    };

    const { isMobile } = useIsMobile();

    return (
        <div className="animate-in h-screen flex flex-col bg-slate-50 md:bg-white">
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between flex-shrink-0">
                <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><Icon name="ArrowLeft" size={18}/></button>
                <div className="text-center">
                    <p className="font-black uppercase text-sm tracking-tight">Mobile POS</p>
                    <p className="text-[10px] text-slate-400 font-bold">Tasa: {tasaBCV} Bs/$</p>
                </div>
                <div className="flex items-center gap-2">
                    {cart.length>0 && <span className="bg-blue-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">{cart.length}</span>}
                    <button onClick={()=>setStep(step==='cart'?'products':'cart')} className="p-2 hover:bg-white/10 rounded-xl transition-colors relative">
                        <Icon name="ShoppingCart" size={18}/>
                    </button>
                </div>
            </div>

            {/* Feedback toast */}
            {feedbackMsg && <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-black uppercase z-50 shadow-xl animate-in">{feedbackMsg}</div>}

            {/* Tabs mobile */}
            <div className="flex bg-white border-b border-slate-100 flex-shrink-0">
                {[{id:'products',label:'Productos',icon:'Grid3x3'},{id:'cart',label:`Carrito (${cart.length})`,icon:'ShoppingCart'},{id:'payment',label:'Cobrar',icon:'Zap'}].map(t=>(
                    <button key={t.id} onClick={()=>setStep(t.id)} className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-[10px] font-black uppercase transition-colors ${step===t.id?'text-blue-600 border-b-2 border-blue-600':'text-slate-400'}`}>
                        <Icon name={t.icon} size={16}/>{t.label}
                    </button>
                ))}
            </div>

            {/* Step: Productos */}
            {step==='products' && (
                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="p-3 flex gap-2 bg-white border-b border-slate-100 flex-shrink-0">
                        <div className="relative flex-1">
                            <Icon name="Search" size={14} className="absolute left-3 top-2.5 text-slate-400"/>
                            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar producto..." className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-500 transition-colors"/>
                        </div>
                        <button onClick={()=>setScannerOpen(true)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-colors flex-shrink-0">
                            <Icon name="ScanLine" size={14}/> QR
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 content-start">
                        {filtered.map(p=>(
                            <button key={p.id} onClick={()=>addToCart(p)} className="bg-white border-2 border-slate-100 hover:border-blue-400 rounded-2xl p-3 text-left transition-all active:scale-95 flex flex-col justify-between h-28">
                                <div>
                                    <p className="font-black text-[11px] uppercase text-slate-900 leading-tight line-clamp-2">{p.name}</p>
                                    <p className="text-[9px] text-slate-400 font-bold mt-0.5">{p.stock} {p.unit}</p>
                                </div>
                                <p className="font-black text-base text-emerald-600">${p.precio_venta?.toFixed(2)}</p>
                            </button>
                        ))}
                        {filtered.length===0 && <div className="col-span-full py-10 text-center text-slate-400 text-xs font-bold uppercase">Sin productos disponibles</div>}
                    </div>
                </div>
            )}

            {/* Step: Carrito */}
            {step==='cart' && (
                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="p-3 bg-white border-b border-slate-100 flex-shrink-0">
                        <div className="flex gap-2">
                            <input value={client.name} onChange={e=>setClient({...client,name:e.target.value.toUpperCase()})} placeholder="NOMBRE CLIENTE" className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none"/>
                            <input value={client.id} onChange={e=>setClient({...client,id:e.target.value.toUpperCase()})} placeholder="CÉDULA" className="w-28 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none"/>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {cart.length===0 && <div className="py-16 text-center"><Icon name="ShoppingCart" size={32} className="text-slate-200 mx-auto mb-3"/><p className="text-slate-400 text-xs font-bold uppercase">Carrito vacío</p></div>}
                        {cart.map(item=>(
                            <div key={item.id} className="bg-white border border-slate-100 rounded-2xl p-3 flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-xs uppercase text-slate-900 truncate">{item.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold">${item.precio_venta?.toFixed(2)} c/u</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={()=>setCart(c=>c.map(x=>x.id===item.id?{...x,qty:Math.max(1,x.qty-1)}:x))} className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"><Icon name="Minus" size={12}/></button>
                                    <span className="font-black text-sm w-6 text-center">{item.qty}</span>
                                    <button onClick={()=>setCart(c=>c.map(x=>x.id===item.id?{...x,qty:x.qty+1}:x))} className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"><Icon name="Plus" size={12}/></button>
                                </div>
                                <p className="font-black text-sm text-emerald-600 w-16 text-right">${(item.qty*item.precio_venta).toFixed(2)}</p>
                                <button onClick={()=>setCart(c=>c.filter(x=>x.id!==item.id))} className="p-1.5 hover:bg-rose-50 text-slate-300 hover:text-rose-400 rounded-lg transition-colors"><Icon name="Trash2" size={14}/></button>
                            </div>
                        ))}
                    </div>
                    {cart.length>0 && (
                        <div className="p-4 bg-white border-t border-slate-100 flex-shrink-0">
                            <div className="flex justify-between items-center mb-3">
                                <span className="font-bold text-slate-500 text-sm uppercase">Total</span>
                                <div className="text-right"><p className="text-2xl font-black text-slate-900">${total.toFixed(2)}</p><p className="text-xs text-blue-500 font-bold">{(total*tasaBCV).toFixed(2)} Bs</p></div>
                            </div>
                            <button onClick={()=>setStep('payment')} className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-black uppercase transition-colors flex items-center justify-center gap-2">
                                <Icon name="Zap" size={16}/> Proceder al Cobro
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Step: Cobro */}
            {step==='payment' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="bg-slate-900 rounded-[2rem] p-6 text-center text-white">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total a Cobrar</p>
                        <p className="text-5xl font-black tracking-tight">${total.toFixed(2)}</p>
                        <p className="text-blue-400 font-bold text-sm mt-1">{(total*tasaBCV).toFixed(2)} Bs</p>
                        <p className="text-slate-500 text-[10px] mt-2 font-bold uppercase">{cart.length} producto{cart.length!==1?'s':''} · {client.name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {[{id:'efectivo',label:'Efectivo',icon:'Banknote',color:'bg-emerald-600'},{id:'transferencia',label:'Transferencia',icon:'ArrowLeftRight',color:'bg-blue-600'},{id:'tarjeta',label:'Tarjeta',icon:'CreditCard',color:'bg-purple-600'},{id:'punto',label:'Punto POS',icon:'Nfc',color:'bg-indigo-600'}].map(m=>(
                            <button key={m.id} onClick={()=>setGatewayOpen(true)} className={`${m.color} hover:opacity-90 text-white rounded-2xl p-5 flex flex-col items-center gap-2 text-xs font-black uppercase transition-all active:scale-95 shadow-sm`}>
                                <Icon name={m.icon} size={24}/>{m.label}
                            </button>
                        ))}
                    </div>
                    <button onClick={()=>setStep('cart')} className="w-full py-3 border border-slate-200 text-slate-500 rounded-2xl font-black uppercase text-xs hover:bg-slate-50 transition-colors">← Volver al carrito</button>
                </div>
            )}

            {scannerOpen && <QRScanner onDetected={handleScanResult} onClose={()=>setScannerOpen(false)}/>}
            {gatewayOpen && <PaymentGateway monto={total} ventaId={`VTA-${Date.now().toString().slice(-4)}`} rif={rif} onSuccess={handlePaymentSuccess} onClose={()=>setGatewayOpen(false)}/>}
        </div>
    );
};


// ==========================================
// COMERCIOS: SIDEBAR Y APP RAÍZ
// ==========================================
// ==========================================
// RESPONSIVE LAYOUT — SIDEBAR + MOBILE NAV
// ==========================================

// Navegación inferior para móvil
const MobileBottomNav = ({ view, setView, tema='blue' }) => {
    const tabs = [
        { id:'dashboard', icon:'home', label:'Inicio' },
        { id:'pos', icon:'shopping-cart', label:'Ventas' },
        { id:'inventory', icon:'boxes', label:'Stock' },
        { id:'purchase', icon:'truck', label:'Compras' },
        { id:'more', icon:'grid', label:'Más' },
    ];
    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 flex md:hidden shadow-2xl">
            {tabs.map(t => (
                <button key={t.id} onClick={()=>setView(t.id)}
                    className={`flex-1 flex flex-col items-center gap-1 py-3 text-[9px] font-black uppercase transition-colors ${view===t.id?`text-${tema}-600`:'text-slate-400'}`}>
                    <i data-lucide={t.icon} style={{width:20,height:20}}></i>
                    {t.label}
                </button>
            ))}
        </nav>
    );
};

// Header móvil
const MobileHeader = ({ currentUser, setView, onLogout, view }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const tema = currentUser?.color_tema || 'blue';
    useEffect(()=>{ if(window.lucide) window.lucide.createIcons(); },[menuOpen]);
    return (
        <>
            <header className="fixed top-0 left-0 right-0 bg-slate-900 text-white z-40 flex items-center justify-between px-4 py-3 md:hidden shadow-xl">
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl bg-${tema}-600 flex items-center justify-center flex-shrink-0`}>
                        <i data-lucide="zap" style={{width:16,height:16}}></i>
                    </div>
                    <div>
                        <p className="text-[11px] font-black uppercase leading-none tracking-tight">LegalYa</p>
                        <p className={`text-[9px] text-${tema}-400 font-bold uppercase truncate max-w-[130px]`}>{currentUser?.nombre_empresa||currentUser?.nombre||'Comercio'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={()=>setMenuOpen(!menuOpen)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                        <i data-lucide={menuOpen?'x':'menu'} style={{width:20,height:20}}></i>
                    </button>
                </div>
            </header>
            {menuOpen && (
                <div className="fixed inset-0 bg-slate-900/95 z-50 flex flex-col md:hidden animate-in">
                    <div className="flex items-center justify-between p-4 border-b border-slate-800">
                        <p className="font-black text-white uppercase">Menú</p>
                        <button onClick={()=>setMenuOpen(false)} className="p-2 hover:bg-white/10 rounded-xl"><i data-lucide="x" style={{width:20,height:20}} className="text-white"></i></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-1">
                        {[
                            {id:'dashboard',icon:'layout-dashboard',label:'Dashboard',group:'Operaciones'},
                            {id:'pos',icon:'shopping-cart',label:'Ventas',group:'Operaciones'},
                            {id:'inventory',icon:'boxes',label:'Inventario',group:'Operaciones'},
                            {id:'purchase',icon:'truck',label:'Compras',group:'Administración'},
                            {id:'expenses',icon:'receipt',label:'Gastos',group:'Administración'},
                            {id:'debts',icon:'user-check',label:'Cobranzas',group:'Administración'},
                            {id:'contacts',icon:'users',label:'Contactos',group:'Administración'},
                            {id:'accounting',icon:'book-open',label:'Contabilidad',group:'Administración'},
                            {id:'hr',icon:'briefcase',label:'RRHH',group:'Administración'},
                            {id:'products',icon:'package',label:'Productos',group:'Catálogo'},
                            {id:'labels',icon:'qr-code',label:'Etiquetas QR',group:'Catálogo'},
                            {id:'devices',icon:'wifi',label:'Dispositivos',group:'Mobile'},
                            {id:'close',icon:'lock',label:'Cierre',group:'Cierre'},
                        ].map((item,i,arr) => {
                            const prevGroup = i > 0 ? arr[i-1].group : null;
                            return (
                                <React.Fragment key={item.id}>
                                    {item.group !== prevGroup && <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-4 mb-1 ml-3">{item.group}</p>}
                                    <button onClick={()=>{setView(item.id);setMenuOpen(false);}}
                                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold uppercase transition-colors ${view===item.id?`bg-${tema}-600 text-white`:'text-slate-300 hover:bg-white/5'}`}>
                                        <i data-lucide={item.icon} style={{width:18,height:18}}></i>{item.label}
                                    </button>
                                </React.Fragment>
                            );
                        })}
                    </div>
                    <div className="p-4 border-t border-slate-800">
                        <button onClick={()=>{onLogout();setMenuOpen(false);}} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-rose-400 font-black uppercase text-sm hover:bg-rose-500/10 transition-colors">
                            <i data-lucide="log-out" style={{width:18,height:18}}></i>Cerrar Sesión
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

// Sidebar desktop (solo visible en md+)
const ComerciosSidebar = ({ currentView, setView, currentUser, onLogout }) => {
    const tema = currentUser?.color_tema || 'blue';
    useEffect(() => { const t = setTimeout(()=>{ if(window.lucide) window.lucide.createIcons(); },100); return ()=>clearTimeout(t); }, [currentView]);
    const NavBtn = ({ id, icon, label }) => (
        <button onClick={()=>setView(id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase transition-all ${currentView===id?`bg-${tema}-600 text-white shadow-lg`:'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <i data-lucide={icon} style={{width:18,height:18}}></i>{label}
        </button>
    );
    return (
        <aside className="hidden md:flex w-64 bg-slate-900 h-screen sticky top-0 flex-col p-6 text-white shrink-0 shadow-2xl">
            <div className="mb-8 px-2">
                <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">
                    LegalYa <span className={`text-${tema}-500 block text-xs tracking-widest not-italic`}>Comercios</span>
                </h1>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto pr-2">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-4">Operaciones</p>
                <NavBtn id="dashboard" icon="layout-dashboard" label="Inicio"/>
                <NavBtn id="pos" icon="shopping-cart" label="Ventas"/>
                <NavBtn id="inventory" icon="boxes" label="Inventario"/>
                <div className="pt-4 mt-4 border-t border-slate-800">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-4">Administración</p>
                    <NavBtn id="purchase" icon="truck" label="Compras"/>
                    <NavBtn id="expenses" icon="receipt" label="Gastos"/>
                    <NavBtn id="debts" icon="user-check" label="Cobranzas"/>
                    <NavBtn id="contacts" icon="users" label="Contactos"/>
                    <NavBtn id="accounting" icon="book-open" label="Contabilidad"/>
                    <NavBtn id="hr" icon="briefcase" label="RRHH"/>
                </div>
                <div className="pt-4 mt-4 border-t border-slate-800">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-4">Catálogo</p>
                    <NavBtn id="products" icon="package" label="Productos"/>
                    <NavBtn id="labels" icon="qr-code" label="Etiquetas QR"/>
                </div>
                <div className="pt-4 mt-4 border-t border-slate-800">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-4">Mobile</p>
                    <NavBtn id="devices" icon="wifi" label="Dispositivos"/>
                </div>
                <div className="pt-4 mt-4 border-t border-slate-800">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-4">Cierre</p>
                    <NavBtn id="close" icon="lock" label="Cierre / Exportar"/>
                </div>
            </nav>
            <div className="pt-6 mt-6 border-t border-slate-800">
                <div className="flex items-center gap-3 px-2 mb-4">
                    <div className={`w-10 h-10 rounded-full bg-${tema}-600 flex items-center justify-center font-black text-sm uppercase flex-shrink-0`}>{currentUser?.nombre?.charAt(0)||'U'}</div>
                    <div className="overflow-hidden"><p className="text-xs font-black truncate uppercase">{currentUser?.nombre||'Usuario'}</p><p className="text-[9px] font-bold text-slate-500 truncate uppercase">{currentUser?.nombre_empresa||currentUser?.rif||''}</p></div>
                </div>
                <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase text-rose-400 hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-500/20">
                    <i data-lucide="log-out" style={{width:16,height:16}}></i>Cerrar Sesión
                </button>
            </div>
        </aside>
    );
};

// Drawer "Más" para mobile — módulos extra
const MobileMoreDrawer = ({ setView, onClose, currentUser }) => {
    const tema = currentUser?.color_tema || 'blue';
    useEffect(()=>{ if(window.lucide) window.lucide.createIcons(); },[]);
    const items = [
        {id:'expenses',icon:'receipt',label:'Gastos',color:'text-rose-500'},
        {id:'debts',icon:'user-check',label:'Cobranzas',color:'text-orange-500'},
        {id:'contacts',icon:'users',label:'Contactos',color:'text-indigo-500'},
        {id:'products',icon:'package',label:'Productos',color:'text-blue-500'},
        {id:'labels',icon:'qr-code',label:'Etiquetas QR',color:'text-violet-500'},
        {id:'devices',icon:'wifi',label:'Dispositivos',color:'text-cyan-500'},
        {id:'close',icon:'lock',label:'Cierre',color:'text-amber-500'},
        {id:'accounting',icon:'book-open',label:'Contabilidad',color:'text-emerald-500'},
        {id:'hr',icon:'briefcase',label:'RRHH',color:'text-amber-500'},
    ];
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:hidden" onClick={onClose}>
            <div className="bg-white w-full rounded-t-[2rem] p-6 pb-10 animate-in" onClick={e=>e.stopPropagation()}>
                <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-6"></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Módulos</p>
                <div className="grid grid-cols-4 gap-4">
                    {items.map(item=>(
                        <button key={item.id} onClick={()=>{setView(item.id);onClose();}}
                            className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                                <i data-lucide={item.icon} style={{width:22,height:22}} className={item.color}></i>
                            </div>
                            <span className="text-[9px] font-black uppercase text-slate-600 text-center leading-tight">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ComerciosApp = ({ currentUser, onLogout }) => {
    const { isInit } = useContext(AppContext);
    const [view, setView] = useState('dashboard');
    const [showMore, setShowMore] = useState(false);
    const { isMobile } = useIsMobile();

    useEffect(()=>{ if(window.lucide) window.lucide.createIcons(); },[view, showMore]);

    // Interceptar "more" en mobile para abrir drawer
    const handleSetView = (v) => {
        if (v === 'more') { setShowMore(true); return; }
        setShowMore(false);
        setView(v);
    };

    if(!isInit) return <StartScreen currentUser={currentUser} onLogout={onLogout}/>;
    if (view === 'mobilepos') return <MobilePOS onBack={()=>setView('dashboard')} currentUser={currentUser}/>;

    return (
        <div className="flex min-h-screen bg-slate-50">
            {/* Desktop sidebar */}
            <ComerciosSidebar currentView={view} setView={handleSetView} currentUser={currentUser} onLogout={onLogout}/>

            {/* Mobile header */}
            <MobileHeader currentUser={currentUser} setView={handleSetView} onLogout={onLogout} view={view}/>

            <main className="flex-1 overflow-y-auto pt-[60px] md:pt-0 pb-[72px] md:pb-0">
                <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-10">
                    {view==='dashboard' && <Dashboard setView={handleSetView}/>}
                    {view==='pos' && <POSModule onBack={()=>setView('dashboard')}/>}
                    {view==='purchase' && <InventoryModule onBack={()=>setView('dashboard')} initialTab="reception"/>}
                    {view==='debts' && <DebtModule onBack={()=>setView('dashboard')}/>}
                    {view==='expenses' && <ExpensesModule onBack={()=>setView('dashboard')}/>}
                    {view==='contacts' && <ContactModule onBack={()=>setView('dashboard')}/>}
                    {view==='inventory' && <InventoryModule onBack={()=>setView('dashboard')} initialTab="stock"/>}
                    {view==='close' && <CashCloseModule onBack={()=>setView('dashboard')}/>}
                    {view==='products' && <ProductManager onBack={()=>setView('dashboard')} currentUser={currentUser}/>}
                    {view==='labels' && <LabelGenerator onBack={()=>setView('dashboard')} currentUser={currentUser}/>}
                    {view==='devices' && <DeviceManager onBack={()=>setView('dashboard')} currentUser={currentUser}/>}
                    {view==='accounting' && <AccountingModule onBack={()=>setView('dashboard')} currentUser={currentUser}/>}
                    {view==='hr' && <HRModule subView="dashboard" currentUser={currentUser}/>}
                </div>
            </main>

            {/* Mobile bottom nav */}
            <MobileBottomNav view={view} setView={handleSetView} tema={currentUser?.color_tema||'blue'}/>

            {/* More drawer */}
            {showMore && <MobileMoreDrawer setView={handleSetView} onClose={()=>setShowMore(false)} currentUser={currentUser}/>}
        </div>
    );
};


// ==========================================
// ROOT: ENRUTADOR POR ROL
// ==========================================