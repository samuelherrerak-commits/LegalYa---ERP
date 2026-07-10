    const POSModule = ({ onBack }) => {
    const { currentUser, inventory, tasaBCV, addTransaction, contacts } = useContext(AppContext);
    const validClients = contacts.filter(c => c.type === 'cliente' || c.type === 'ambos');

    // ── Estado original sin cambios ──
    const [client, setClient]     = useState({ name: '', id: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart]         = useState([]);
    const [weightModal, setWeightModal] = useState({ isOpen: false, product: null, weight: '' });
    const [payments, setPayments] = useState({ usd: '', bs: '', banco: '', refBanco: '', fiao: '' });
    const [change, setChange]     = useState({ usd: '', bs: '', banco: '', refBanco: '' });

    // ── Estado escáner continuo ──
    const [scannerOpen, setScannerOpen] = useState(false);
    const [scanLog, setScanLog]   = useState([]);   // historial de productos escaneados
    const lastScanRef = React.useRef({ code: '', time: 0 }); // debounce

    // ── Inventario filtrado (sin cambios) ──
    const filteredInventory = useMemo(() =>
        inventory.filter(p => p.stock > 0 && p.name.includes(searchTerm.toUpperCase())),
    [inventory, searchTerm]);

    const totalUSD = cart.reduce((acc, c) => acc + (c.qty * c.sellPrice), 0);
    const totalBS  = totalUSD * tasaBCV;
    const paidUSD  = (parseFloat(payments.usd) || 0)
                   + ((parseFloat(payments.bs)    || 0) / tasaBCV)
                   + ((parseFloat(payments.banco) || 0) / tasaBCV)
                   + ((parseFloat(payments.fiao)  || 0) / tasaBCV);
    const isOverpaid          = paidUSD > totalUSD && totalUSD > 0;
    const pendingChangeUSD    = Math.max(0, paidUSD - totalUSD);
    const pendingChangeBS     = pendingChangeUSD * tasaBCV;
    const totalChangeGivenUSD = (parseFloat(change.usd)   || 0)
                              + ((parseFloat(change.bs)    || 0) / tasaBCV)
                              + ((parseFloat(change.banco) || 0) / tasaBCV);
    const isChangeBalanceOk = !isOverpaid || Math.abs(pendingChangeUSD - totalChangeGivenUSD) <= 0.05;
    const canProcess = client.name && client.id && cart.length > 0 && paidUSD >= totalUSD && isChangeBalanceOk;

    // ── addToCart (sin cambios en lógica) ──
    const handleProductClick = (prod) => {
        if (prod.unit === 'kg') setWeightModal({ isOpen: true, product: prod, weight: '' });
        else addToCart(prod, 1);
    };

    const addToCart = (prod, specificQty = null) => {
        const step = specificQty !== null ? specificQty : (prod.unit === 'kg' ? 0.100 : 1);
        setCart(prev => {
            const exists = prev.find(c => c.name === prod.name);
            if (exists) {
                if (exists.qty + step > prod.stock) { alert(`Stock insuficiente. Disponible: ${prod.stock.toFixed(3)}`); return prev; }
                return prev.map(c => c.name === prod.name ? { ...c, qty: c.qty + step } : c);
            }
            if (prod.stock < step) { alert(`Stock insuficiente. Disponible: ${prod.stock.toFixed(3)}`); return prev; }
            return [...prev, { ...prod, qty: step }];
        });
    };

    const updateQty = (name, val) => {
        const prod = inventory.find(p => p.name === name);
        let newVal = parseFloat(val); if (isNaN(newVal)) newVal = 0;
        newVal = Math.max(0, Math.min(prod ? prod.stock : 9999, newVal));
        if (newVal === 0) setCart(prev => prev.filter(c => c.name !== name));
        else setCart(prev => prev.map(c => c.name === name ? { ...c, qty: newVal } : c));
    };

    // ── Escaneo QR — continuo, con debounce 1.5s por código ──
    const handleScanQR = (code) => {
        const now = Date.now();
        // Debounce: mismo código en menos de 1500ms → ignorar
        if (code === lastScanRef.current.code && now - lastScanRef.current.time < 1500) return;
        lastScanRef.current = { code, time: now };

        let prodToAdd = null;
        let feedback  = { nombre: '', precio: 0, status: 'ok' };

        const codeTrim = code.trim();
        const codeUpper = codeTrim.toUpperCase();
        // Buscar por: codigo_barra → name → id
        const inv = inventory.find(
            i => (i.codigo_barra && i.codigo_barra === codeTrim) || i.name === codeUpper || i.id === codeTrim || i.name === codeTrim
        );
        if (inv) prodToAdd = inv;

      if (prodToAdd) {
    addToCart(prodToAdd, 1);
    playBeep('ok');   // ← línea nueva
    feedback = { nombre: prodToAdd.name, precio: prodToAdd.sellPrice, status: 'ok' };
} else {
    playBeep('error'); // ← línea nueva
    feedback = { nombre: code.substring(0, 24), precio: 0, status: 'error' };
}

        // Agregar al log de escaneo (máx 5 entradas visibles)
        setScanLog(prev => [{ ...feedback, ts: now }, ...prev].slice(0, 5));
    };

    // ── PDF ticket (sin cambios) ──
    const generatePDF = (ref, date, time) => {
        if (!window.jspdf) return;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 200] });
        doc.setFont("helvetica", "bold"); doc.setFontSize(14);
        doc.text(currentUser?.nombre_empresa || currentUser?.nombre || 'Empresa', 40, 10, { align: "center" });
        doc.setFontSize(10); doc.text(`RIF: ${currentUser?.rif || ""}`, 40, 15, { align: "center" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(8);
        doc.text(`Fecha: ${date} ${time}`, 5, 25); doc.text(`Ticket: ${ref}`, 5, 29);
        doc.text(`Cliente: ${client.name}`, 5, 33); doc.text(`CI/RIF: ${client.id}`, 5, 37);
        doc.text(`Tasa BCV: ${tasaBCV.toFixed(2)} Bs/$`, 5, 41);
        doc.setLineWidth(0.5); doc.line(5, 44, 75, 44);
        let y = 49;
        doc.setFont("helvetica", "bold");
        doc.text("CANT", 5, y); doc.text("DESCRIPCIÓN", 20, y); doc.text("TOTAL", 65, y);
        y += 5; doc.setFont("helvetica", "normal");
        cart.forEach(item => {
            const cantStr  = `${item.qty.toFixed(item.unit === 'kg' ? 3 : 0)}${item.unit === 'kg' ? 'kg' : 'u'}`;
            const lineTotal = (item.qty * item.sellPrice).toFixed(2);
            doc.text(cantStr, 5, y); doc.text(item.name.substring(0, 18), 20, y); doc.text(`$${lineTotal}`, 65, y);
            y += 5;
        });
        doc.line(5, y, 75, y); y += 5;
        doc.setFont("helvetica", "bold"); doc.setFontSize(12);
        doc.text("TOTAL A PAGAR:", 5, y); doc.text(`$${totalUSD.toFixed(2)}`, 55, y);
        y += 5; doc.text(`(Bs ${totalBS.toFixed(2)})`, 55, y);
        doc.save(`Ticket_${ref}.pdf`);
    };

    // ── handleVenta (sin cambios en lógica contable) ──
    const handleVenta = () => {
        if (!canProcess) return;
        const ref = `VTA-${Date.now().toString().slice(-4)}`;
        let rows = [];
        cart.forEach(item => {
            const conceptoVenta = `Venta de ${item.qty.toFixed(item.unit === 'kg' ? 3 : 0)} ${item.unit} de ${item.name} | Cliente: ${client.name}`;
            const conceptoCosto = `Costo Venta | Cant: ${item.qty.toFixed(3)} ${item.unit} de ${item.name}`;
            rows.push({ codigo_cuenta: CTA.VENTAS,     cuenta_contable: 'Ventas de Mercancía',    concepto: conceptoVenta, debe_usd: 0,              haber_usd: item.qty * item.sellPrice, unidad: item.unit, ref_doc: ref, precio_venta: item.sellPrice, entidad: client.name.toUpperCase(), cantidad: item.qty });
            rows.push({ codigo_cuenta: CTA.INVENTARIO, cuenta_contable: 'Inventario de Mercancía', concepto: conceptoCosto, debe_usd: 0,              haber_usd: item.qty * item.cost,      unidad: item.unit, ref_doc: ref, precio_venta: item.sellPrice, entidad: client.name.toUpperCase(), cantidad: item.qty });
            rows.push({ codigo_cuenta: CTA.COSTO_VTA,  cuenta_contable: 'Costo de Ventas',         concepto: conceptoCosto, debe_usd: item.qty * item.cost, haber_usd: 0,                  unidad: item.unit, ref_doc: ref, precio_venta: 0,              entidad: client.name.toUpperCase(), cantidad: item.qty });
        });
        if (parseFloat(payments.usd)   > 0) rows.push({ codigo_cuenta: CTA.CAJA_USD, cuenta_contable: 'Caja Principal ($)',          concepto: `Cobro Venta ${ref} (Efectivo $)`,        debe_usd: parseFloat(payments.usd),             haber_usd: 0, unidad: 'monto', ref_doc: ref, entidad: client.name.toUpperCase(), cantidad: 0 });
        if (parseFloat(payments.bs)    > 0) rows.push({ codigo_cuenta: CTA.CAJA_BS,  cuenta_contable: 'Caja Principal (Bs)',         concepto: `Cobro Venta ${ref} (Efectivo Bs)`,       debe_usd: parseFloat(payments.bs) / tasaBCV,    haber_usd: 0, unidad: 'monto', ref_doc: ref, entidad: client.name.toUpperCase(), cantidad: 0 });
        if (parseFloat(payments.banco) > 0) rows.push({ codigo_cuenta: CTA.BANCOS,   cuenta_contable: 'Bancos Nacionales',           concepto: `Cobro Venta ${ref} (Ref: ${payments.refBanco})`, debe_usd: parseFloat(payments.banco) / tasaBCV, haber_usd: 0, unidad: 'monto', ref_doc: ref, entidad: client.name.toUpperCase(), cantidad: 0 });
        if (parseFloat(payments.fiao)  > 0) rows.push({ codigo_cuenta: CTA.CXC,      cuenta_contable: 'Cuentas por Cobrar Clientes', concepto: `Crédito Venta ${ref} | Cliente: ${client.name}`, debe_usd: parseFloat(payments.fiao) / tasaBCV, haber_usd: 0, unidad: 'monto', ref_doc: ref, entidad: client.name.toUpperCase(), cantidad: 0 });
        if (isOverpaid) {
            if (parseFloat(change.usd)   > 0) rows.push({ codigo_cuenta: CTA.CAJA_USD, cuenta_contable: 'Caja Principal ($)',  concepto: `Vuelto Venta ${ref} (Efectivo $)`,  debe_usd: 0, haber_usd: parseFloat(change.usd),             unidad: 'monto', ref_doc: ref, entidad: client.name.toUpperCase(), cantidad: 0 });
            if (parseFloat(change.bs)    > 0) rows.push({ codigo_cuenta: CTA.CAJA_BS,  cuenta_contable: 'Caja Principal (Bs)', concepto: `Vuelto Venta ${ref} (Efectivo Bs)`, debe_usd: 0, haber_usd: parseFloat(change.bs) / tasaBCV,    unidad: 'monto', ref_doc: ref, entidad: client.name.toUpperCase(), cantidad: 0 });
            if (parseFloat(change.banco) > 0) rows.push({ codigo_cuenta: CTA.BANCOS,   cuenta_contable: 'Bancos Nacionales',   concepto: `Vuelto Venta ${ref} (Ref: ${change.refBanco})`, debe_usd: 0, haber_usd: parseFloat(change.banco) / tasaBCV, unidad: 'monto', ref_doc: ref, entidad: client.name.toUpperCase(), cantidad: 0 });
        }
        const dif = rows.reduce((a,r) => a + (parseFloat(r.debe_usd)||0), 0) - rows.reduce((a,r) => a + (parseFloat(r.haber_usd)||0), 0);
        if (Math.abs(dif) > 0.009) rows.push({ codigo_cuenta: CTA.DIF_CAMB, cuenta_contable: 'Diferencial Cambiario', concepto: `Ajuste Redondeo en Venta ${ref}`, debe_usd: dif < 0 ? Math.abs(dif) : 0, haber_usd: dif > 0 ? dif : 0, unidad: 'monto', ref_doc: ref, entidad: client.name.toUpperCase() });
        generatePDF(ref, new Date().toLocaleDateString(), new Date().toLocaleTimeString());
        addTransaction(rows);
        onBack();
    };
// ── Pitido de escáner via Web Audio API ──
// No necesita archivos de audio externos — genera el tono matemáticamente.
// Funciona en Chrome, Safari iOS, Firefox.
// NOTA: iOS requiere que el AudioContext sea creado tras una interacción
// del usuario (tap). Como el modal se abre con un botón, esto se cumple.
const beepRef = React.useRef(null); // reutilizamos el AudioContext entre escaneos

const playBeep = (tipo = 'ok') => {
    try {
        // Crear o reutilizar el AudioContext
        if (!beepRef.current) {
            beepRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = beepRef.current;

        // Si el contexto está suspendido (política de iOS), reanudarlo
        if (ctx.state === 'suspended') ctx.resume();

        const oscillator = ctx.createOscillator();
        const gainNode   = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        if (tipo === 'ok') {
            // Pitido corto y agudo — producto encontrado (igual que un escáner real)
            oscillator.frequency.setValueAtTime(1850, ctx.currentTime);
            gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.12);
        } else {
            // Doble pitido grave — producto no encontrado
            oscillator.frequency.setValueAtTime(400, ctx.currentTime);
            gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.08);

            // Segundo pitido 150ms después
            const osc2  = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.setValueAtTime(400, ctx.currentTime + 0.15);
            gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.23);
            osc2.start(ctx.currentTime + 0.15);
            osc2.stop(ctx.currentTime + 0.23);
        }
    } catch (e) {
        console.warn('No se pudo reproducir el pitido:', e);
    }
};
    // ── MODAL ESCÁNER CONTINUO ──
   const ScannerModal = () => {
    const qrInstanceRef = React.useRef(null);   // instancia de Html5Qrcode
    const [camError, setCamError]   = useState('');
    const [scanning, setScanning]   = useState(false);
    const [manualCode, setManualCode] = useState('');

    useEffect(() => {
        // ── IMPORTANTE PARA iOS/SAFARI ──
        // html5-qrcode maneja internamente getUserMedia + detección
        // de QR/códigos de barras sin necesidad de BarcodeDetector nativo.
        // Funciona en: Chrome desktop, Chrome Android, Safari iOS, Firefox.
        // REQUISITO: HTTPS (o localhost). En HTTP el navegador bloquea la cámara.

        const startScanner = async () => {
            try {
                // Creamos la instancia apuntando al div vacío "qr-reader-pos"
                qrInstanceRef.current = new Html5Qrcode('qr-reader-pos');

                await qrInstanceRef.current.start(
                    { facingMode: 'environment' }, // cámara trasera
                    {
                        fps: 10,                              // lecturas por segundo
                        qrbox: { width: 260, height: 260 },  // zona de enfoque
                        aspectRatio: 1.0,
                        // html5-qrcode soporta: qr_code, ean_13, ean_8,
                        // code_128, code_39, upc_a, upc_e, itf, etc.
                        // No hace falta configurarlos: los detecta todos por defecto.
                    },
                    (codigoLeido) => {
                        // Callback de lectura exitosa → misma función que tenías
                        handleScanQR(codigoLeido);
                    },
                    () => {
                        // Errores frame-a-frame (QR fuera de foco, etc.) → ignorar
                    }
                );

                setScanning(true);
            } catch (err) {
                console.error('Error abriendo cámara:', err);
                setCamError(
                    'No se pudo acceder a la cámara.\n' +
                    'Verifica que el sitio corra en HTTPS o localhost\n' +
                    'y que hayas dado permiso de cámara al navegador.'
                );
            }
        };

        startScanner();

        // Limpieza al desmontar: detener cámara y liberar stream
        // (Crítico en iOS — si no se hace, la próxima apertura falla)
        return () => {
            if (qrInstanceRef.current) {
                qrInstanceRef.current
                    .stop()
                    .then(() => qrInstanceRef.current.clear())
                    .catch(err => console.warn('Error cerrando escáner:', err));
            }
        };
    }, []); // ← sin dependencias: se ejecuta solo al montar/desmontar

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                    <p className="text-white font-black uppercase text-sm tracking-tight">Escáner Activo</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="bg-blue-500 text-white text-[10px] font-black px-2 py-1 rounded-full">
                        {cart.length} producto{cart.length !== 1 ? 's' : ''}
                    </span>
                    <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded-full">
                        ${totalUSD.toFixed(2)}
                    </span>
                </div>
            </div>

            {/* ── Visor de cámara ── */}
            <div className="relative flex-1 bg-black overflow-hidden">

                {/* html5-qrcode monta el <video> dentro de este div */}
                <div
                    id="qr-reader-pos"
                    style={{
                        width: '100%',
                        height: '100%',
                        // Ocultamos los controles nativos que inyecta html5-qrcode
                        // (botón de cambiar cámara, texto de estado, etc.)
                        // El video en sí queda visible a través del CSS de abajo
                    }}
                />

                {/* Ocultar via CSS los controles internos de html5-qrcode
                    que no queremos mostrar (ya tenemos nuestra propia UI) */}
                <style>{`
                    #qr-reader-pos > img { display: none !important; }
                    #qr-reader-pos__header_message { display: none !important; }
                    #qr-reader-pos__status_span { display: none !important; }
                    #qr-reader-pos__camera_selection { display: none !important; }
                    #qr-reader-pos__dashboard { display: none !important; }
                    #qr-reader-pos video {
                        width: 100% !important;
                        height: 100% !important;
                        object-fit: cover !important;
                    }
                    @keyframes scanLine {
                        0%, 100% { transform: translateY(-80px); opacity: 0.4; }
                        50%       { transform: translateY(80px);  opacity: 1;   }
                    }
                `}</style>

                {/* Marco de enfoque tipo escáner (decorativo, igual que antes) */}
                {scanning && !camError && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="relative w-64 h-64">
                            <div className="absolute top-0 left-0  w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-lg"></div>
                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-lg"></div>
                            <div className="absolute bottom-0 left-0  w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-lg"></div>
                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-lg"></div>
                            <div
                                className="absolute left-2 right-2 h-0.5 bg-blue-400/80 rounded-full"
                                style={{ animation: 'scanLine 1.8s ease-in-out infinite', top: '50%' }}
                            />
                        </div>
                        <div
                            className="absolute inset-0 -z-10"
                            style={{ background: 'radial-gradient(ellipse 300px 300px at center, transparent 45%, rgba(0,0,0,0.6) 55%)' }}
                        />
                    </div>
                )}

                {/* Error de cámara */}
                {camError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
                        <div className="bg-slate-800 rounded-2xl p-6 text-center max-w-xs">
                            <Icon name="CameraOff" size={32} className="text-rose-400 mx-auto mb-3" />
                            <p className="text-rose-300 text-xs font-bold leading-relaxed whitespace-pre-line">
                                {camError}
                            </p>
                        </div>
                    </div>
                )}

                {/* Log de productos escaneados — sobre la cámara, igual que antes */}
                <div className="absolute top-3 right-3 left-3 space-y-2 pointer-events-none">
                    {scanLog.map((entry, i) => (
                        <div
                            key={entry.ts}
                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl backdrop-blur-md shadow-xl transition-all
                                ${entry.status === 'ok' ? 'bg-emerald-500/90' : 'bg-rose-500/90'}
                                ${i > 0 ? 'opacity-40' : 'opacity-100'}`}
                        >
                            <Icon
                                name={entry.status === 'ok' ? 'CheckCircle' : 'XCircle'}
                                size={18}
                                className="text-white flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-black text-xs uppercase truncate">{entry.nombre}</p>
                                {entry.status === 'ok'
                                    ? <p className="text-white/80 text-[10px] font-bold">${entry.precio.toFixed(2)} por unidad</p>
                                    : <p className="text-white/80 text-[10px] font-bold">Producto no encontrado</p>
                                }
                            </div>
                            {i === 0 && entry.status === 'ok' && (
                                <span className="text-white font-black text-sm bg-white/20 px-2 py-0.5 rounded-lg">
                                    x{cart.find(c => c.name === entry.nombre)?.qty || 1}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Footer — entrada manual + botón LISTO ── */}
            <div className="bg-slate-900 px-4 pt-4 pb-6 flex-shrink-0 space-y-3">
                <p className="text-[10px] font-black text-slate-500 uppercase text-center tracking-widest">
                    O ingresa el código manualmente
                </p>
                <div className="flex gap-2">
                    <input
                        value={manualCode}
                        onChange={e => setManualCode(e.target.value.toUpperCase())}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && manualCode.trim()) {
                                handleScanQR(manualCode.trim());
                                setManualCode('');
                            }
                        }}
                        placeholder="LEGALYA-PROD-00001"
                        className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-2xl text-sm font-bold outline-none focus:border-blue-500 transition-colors uppercase"
                    />
                    <button
                        onClick={() => {
                            if (manualCode.trim()) {
                                handleScanQR(manualCode.trim());
                                setManualCode('');
                            }
                        }}
                        className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-sm transition-colors"
                    >
                        Agregar
                    </button>
                </div>
                <button
                    onClick={() => { setScannerOpen(false); setScanLog([]); }}
                    className="w-full py-4 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-black uppercase text-sm transition-colors flex items-center justify-center gap-2 shadow-lg"
                >
                    <Icon name="CheckCircle" size={18} className="text-emerald-600" />
                    LISTO — Ver Carrito ({cart.length})
                </button>
            </div>
        </div>
    );
};

    // ── RENDER PRINCIPAL ──
    return (
        <div className="relative">
            {/* Modal escáner continuo */}
            {scannerOpen && <ScannerModal />}

            {/* Modal balanza KG */}
            {weightModal.isOpen && weightModal.product && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in">
                    <div className="bg-white p-8 rounded-[3rem] shadow-2xl max-w-md w-full border-4 border-blue-500">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-3xl font-black uppercase text-slate-900">{weightModal.product.name}</h3>
                                <p className="text-sm font-bold text-slate-400 mt-1">Precio x Kg: ${weightModal.product.sellPrice.toFixed(2)}</p>
                            </div>
                            <div className="bg-blue-100 text-blue-600 px-3 py-1 rounded-xl font-black text-xs uppercase">Balanza</div>
                        </div>
                        <div className="space-y-6 mb-8 bg-slate-50 p-6 rounded-3xl border-2 border-slate-200">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-4">Ingrese Peso Exacto (Kg)</label>
                                <input type="number" step="0.001" autoFocus className="w-full text-center text-6xl font-black p-4 bg-transparent outline-none text-slate-900 placeholder-slate-300" placeholder="0.000" value={weightModal.weight} onChange={e => setWeightModal({...weightModal, weight: e.target.value})} />
                            </div>
                            <div className="border-t-2 border-dashed border-slate-200 pt-4 flex justify-between items-end">
                                <span className="text-xs font-black uppercase text-slate-400">Subtotal:</span>
                                <div className="text-right">
                                    <p className="text-3xl font-black text-emerald-500">${((parseFloat(weightModal.weight)||0)*weightModal.product.sellPrice).toFixed(2)}</p>
                                    <p className="text-sm font-bold text-emerald-700">{(((parseFloat(weightModal.weight)||0)*weightModal.product.sellPrice)*tasaBCV).toFixed(2)} Bs</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setWeightModal({isOpen:false,product:null,weight:''})} className="flex-1 py-4 rounded-2xl font-bold uppercase text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">Cancelar</button>
                            <button onClick={() => { addToCart(weightModal.product, parseFloat(weightModal.weight)||0); setWeightModal({isOpen:false,product:null,weight:''}); }} disabled={!weightModal.weight || parseFloat(weightModal.weight)<=0} className="flex-[2] py-4 rounded-2xl font-black uppercase bg-blue-600 text-white shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">Añadir al Carrito</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── POS PRINCIPAL ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 animate-in min-h-[90vh]">

                {/* COLUMNA IZQUIERDA — productos */}
                <div className="lg:col-span-7 flex flex-col gap-4">

                    {/* Barra búsqueda + botón QR */}
                    <div className="bg-white p-3 md:p-4 rounded-[2rem] shadow-sm border border-slate-100 flex gap-2 md:gap-3 items-center">
                        <div className="flex-1 relative">
                            <Icon name="Search" className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                            <input
                                type="text"
                                placeholder="BUSCAR PRODUCTO..."
                                className="w-full bg-slate-50 pl-10 md:pl-12 pr-3 py-3 md:py-4 rounded-2xl font-black uppercase text-sm outline-none border-2 border-transparent focus:border-blue-500 transition-all"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {/* BOTÓN ESCANEAR QR */}
                        <button
                            onClick={() => { setScanLog([]); setScannerOpen(true); }}
                            className="flex items-center gap-2 bg-slate-900 hover:bg-black active:scale-95 text-white px-3 md:px-5 py-3 md:py-4 rounded-2xl text-[10px] md:text-xs font-black uppercase transition-all flex-shrink-0 shadow-lg"
                        >
                            <Icon name="ScanLine" size={18}/>
                            <span className="hidden sm:inline">Escanear QR</span>
                        </button>
                        <div className="text-right px-2 md:px-3 border-l border-slate-100 flex-shrink-0">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Tasa</p>
                            <p className="font-black text-blue-600 text-xs md:text-sm">{tasaBCV} Bs</p>
                        </div>
                    </div>

                    {/* Grid de productos */}
                    <div className="flex-1 overflow-y-auto pb-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
                            {filteredInventory.map(p => (
                                <button key={p.id} onClick={() => handleProductClick(p)}
                                    className="bg-white p-3 md:p-5 rounded-2xl md:rounded-3xl border-2 border-slate-100 shadow-sm hover:border-blue-500 active:scale-95 text-left transition-all flex flex-col justify-between h-28 md:h-36 relative overflow-hidden">
                                    <div className={`absolute top-0 right-0 ${p.unit==='kg'?'bg-orange-50 text-orange-600':'bg-blue-50 text-blue-600'} px-2 py-0.5 rounded-bl-xl font-black text-[9px] uppercase flex items-center gap-1`}>
                                        {p.unit==='kg' && <Icon name="Scale" size={9}/>}
                                        {p.stock.toFixed(p.unit==='kg'?3:0)} {p.unit}
                                    </div>
                                    <p className="font-black uppercase text-xs md:text-sm text-slate-800 leading-tight pr-8 mt-1">{p.name}</p>
                                    <div>
                                        <p className="font-black text-base md:text-xl text-slate-900">${p.sellPrice.toFixed(2)}</p>
                                        <p className="font-bold text-[10px] text-slate-400">{(p.sellPrice * tasaBCV).toFixed(2)} Bs</p>
                                    </div>
                                </button>
                            ))}
                            {filteredInventory.length === 0 && (
                                <div className="col-span-full py-12 text-center text-slate-300">
                                    <Icon name="Package" size={32} className="mx-auto mb-3"/>
                                    <p className="font-bold text-sm uppercase">Sin productos en stock</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* COLUMNA DERECHA — carrito + pagos */}
                <div className="lg:col-span-5 flex flex-col gap-4 min-h-[500px] lg:h-[90vh]">
                    <div className="bg-slate-900 rounded-[2rem] lg:rounded-[2.5rem] flex flex-col shadow-2xl overflow-hidden flex-1">

                        {/* Datos del cliente */}
                        <div className="p-4 md:p-6 bg-slate-800 border-b border-white/10 space-y-3">
                            <div className="flex justify-between items-center">
                                <h3 className="font-black uppercase italic text-xs text-blue-400">Datos del Cliente *</h3>
                                <span className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md font-black uppercase">Afiliados: {validClients.length}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 md:gap-3">
                                <div className="relative">
                                    <Icon name="Search" size={14} className="absolute left-3 top-3.5 text-white/40"/>
                                    <input
                                        placeholder="CÉDULA / RIF..."
                                        className="w-full pl-9 p-3 bg-white/10 text-white placeholder-white/40 rounded-xl font-bold uppercase outline-none text-xs focus:bg-white/20 border border-transparent focus:border-blue-500 transition-all"
                                        value={client.id}
                                        onChange={e => {
                                            const v = e.target.value.toUpperCase();
                                            setClient({...client, id: v});
                                            const af = validClients.find(c => (c.id||'').includes(v) && v.length > 3);
                                            if (af) setClient({ name: af.name, id: af.id });
                                        }}
                                    />
                                </div>
                                <input
                                    placeholder="NOMBRE CLIENTE"
                                    className="p-3 bg-white/10 text-white placeholder-white/40 rounded-xl font-bold uppercase outline-none text-xs focus:bg-white/20 transition-all"
                                    value={client.name}
                                    onChange={e => setClient({...client, name: e.target.value.toUpperCase()})}
                                />
                            </div>
                        </div>

                        {/* Carrito */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
                            {cart.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-white/20 py-10">
                                    <Icon name="ShoppingCart" size={40}/>
                                    <p className="mt-3 font-black text-sm uppercase">Carrito Vacío</p>
                                    <p className="text-[10px] mt-1 opacity-60">Toca un producto o escanea QR</p>
                                </div>
                            )}
                            {cart.map(item => (
                                <div key={item.id} className="flex items-center gap-3 bg-white/5 p-3 md:p-4 rounded-2xl">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-black text-white uppercase truncate">{item.name}</p>
                                        <div className="flex items-center gap-1.5 mt-2">
                                            <button onClick={() => updateQty(item.name, item.qty-(item.unit==='kg'?0.1:1))} className="w-7 h-7 flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 rounded-lg text-white transition-all"><Icon name="Minus" size={12}/></button>
                                            <input type="number" className="bg-transparent font-black w-14 text-center text-white outline-none text-sm" value={item.unit==='kg'?item.qty.toFixed(3):item.qty} step={item.unit==='kg'?'0.001':'1'} onChange={e => updateQty(item.name, e.target.value)}/>
                                            <button onClick={() => updateQty(item.name, item.qty+(item.unit==='kg'?0.1:1))} className="w-7 h-7 flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 rounded-lg text-white transition-all"><Icon name="Plus" size={12}/></button>
                                            <span className="text-[9px] font-black uppercase text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">{item.unit}</span>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="font-black text-base md:text-lg text-emerald-400">${(item.qty*item.sellPrice).toFixed(2)}</p>
                                        <button onClick={() => setCart(prev => prev.filter(c => c.name !== item.name))} className="text-white/20 hover:text-rose-400 transition-colors mt-1">
                                            <Icon name="Trash2" size={12}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagos y total */}
                        <div className="bg-white p-4 md:p-6 rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
                            <div className="flex justify-between items-end mb-4">
                                <span className="text-xs font-black uppercase text-slate-400">Total a Cobrar</span>
                                <div className="text-right">
                                    <p className="text-3xl md:text-4xl font-black italic tracking-tighter text-slate-900">${totalUSD.toFixed(2)}</p>
                                    <p className="text-sm font-bold text-blue-600">{totalBS.toFixed(2)} Bs</p>
                                </div>
                            </div>

                            <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                                {isOverpaid && (
                                    <div className="bg-emerald-100 border-2 border-emerald-400 p-3 rounded-2xl text-center">
                                        <p className="font-black text-emerald-700 uppercase text-xs">¡Devolver al Cliente!</p>
                                        <p className="font-black text-emerald-600 text-lg">${pendingChangeUSD.toFixed(2)} / {pendingChangeBS.toFixed(2)} Bs</p>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center border-b pb-1">
                                        <p className="text-[10px] font-black uppercase text-slate-400">Forma de Pago</p>
                                        <p className="text-[10px] font-black text-blue-600">Pagado: ${paidUSD.toFixed(2)}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="relative"><span className="absolute left-3 top-3 text-slate-400 text-xs font-bold">$</span><input placeholder="Efectivo USD" type="number" className="w-full pl-7 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500" value={payments.usd} onChange={e => setPayments({...payments, usd: e.target.value})}/></div>
                                        <div className="relative"><span className="absolute left-3 top-3 text-slate-400 text-xs font-bold">Bs</span><input placeholder="Efectivo BS" type="number" className="w-full pl-8 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500" value={payments.bs} onChange={e => setPayments({...payments, bs: e.target.value})}/></div>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1"><span className="absolute left-3 top-3 text-slate-400 text-xs font-bold">Bs</span><input placeholder="Banco/PM" type="number" className="w-full pl-8 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500" value={payments.banco} onChange={e => setPayments({...payments, banco: e.target.value})}/></div>
                                        <input placeholder="Referencia" type="text" className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none uppercase" value={payments.refBanco} onChange={e => setPayments({...payments, refBanco: e.target.value})}/>
                                    </div>
                                    <div className="relative"><span className="absolute left-3 top-3 text-orange-400 text-xs font-bold">Bs</span><input placeholder="Crédito / Fiao" type="number" className="w-full pl-8 p-3 bg-orange-50 border border-orange-200 text-orange-700 rounded-xl text-sm font-bold outline-none focus:border-orange-500" value={payments.fiao} onChange={e => setPayments({...payments, fiao: e.target.value})}/></div>
                                </div>

                                {isOverpaid && (
                                    <div className="space-y-2 bg-rose-50 p-4 rounded-2xl border border-rose-200 animate-in">
                                        <p className="text-[10px] font-black uppercase text-rose-500 border-b border-rose-200 pb-1 mb-2">Registro de Vuelto</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="relative"><span className="absolute left-3 top-3 text-rose-400 text-xs font-bold">$</span><input placeholder="Vuelto USD" type="number" className="w-full pl-7 p-3 bg-white border border-rose-200 rounded-xl text-sm font-bold outline-none focus:border-rose-500" value={change.usd} onChange={e => setChange({...change, usd: e.target.value})}/></div>
                                            <div className="relative"><span className="absolute left-3 top-3 text-rose-400 text-xs font-bold">Bs</span><input placeholder="Vuelto BS" type="number" className="w-full pl-8 p-3 bg-white border border-rose-200 rounded-xl text-sm font-bold outline-none focus:border-rose-500" value={change.bs} onChange={e => setChange({...change, bs: e.target.value})}/></div>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="flex-1 relative"><span className="absolute left-3 top-3 text-rose-400 text-xs font-bold">Bs</span><input placeholder="Vuelto PM" type="number" className="w-full pl-8 p-3 bg-white border border-rose-200 rounded-xl text-sm font-bold outline-none focus:border-rose-500" value={change.banco} onChange={e => setChange({...change, banco: e.target.value})}/></div>
                                            <input placeholder="Ref PM" type="text" className="flex-1 p-3 bg-white border border-rose-200 rounded-xl text-sm font-bold outline-none uppercase" value={change.refBanco} onChange={e => setChange({...change, refBanco: e.target.value})}/>
                                        </div>
                                    </div>
                                )}

                                <button onClick={handleVenta} disabled={!canProcess}
                                    className={`w-full py-4 md:py-5 rounded-2xl font-black uppercase italic shadow-lg transition-all flex justify-center items-center gap-2 ${canProcess?'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]':'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                                    <Icon name="Printer" size={18}/> Procesar Venta
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};