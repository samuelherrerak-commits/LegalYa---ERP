const { useState, useMemo, useEffect, createContext, useContext, useCallback } = React;

// ==========================================
// SUPABASE CLIENT
// ==========================================
const SUPABASE_URL = 'https://vkywtdrmcsecwfvlfpnb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZreXd0ZHJtY3NlY3dmdmxmcG5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5ODA2MTQsImV4cCI6MjA5NzU1NjYxNH0.KrvTNcTPA_W6RCsJn5G21ViOHwgOMUTF4LfYU7VdNts';

const sbFetch = async (endpoint, options = {}) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': options.prefer || 'return=representation',
            ...options.headers
        },
        ...options
    });
    if (!res.ok) { const err = await res.text(); throw new Error(`Supabase: ${res.status} - ${err}`); }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
};

// ==========================================
// CONSTANTES CONTABLES
// ==========================================
const fallbackCuentas = {
    CAJA_USD: '1.1.01.01', CAJA_BS: '1.1.01.02', BANCOS: '1.1.01.03',
    CXC: '1.1.02.01', INVENTARIO: '1.1.03.01', CXP: '2.1.01.01',
    VENTAS: '4.1.01.01', DIF_CAMB: '4.1.03.01', COSTO_VTA: '5.1.01.01'
};
const CTA = (typeof window !== 'undefined' && window.CUENTAS) ? window.CUENTAS : fallbackCuentas;
const NOMBRE_EMPRESA_DEFAULT = (typeof window !== 'undefined' && window.EMPRESA) ? window.EMPRESA.NOMBRE : 'INVERSIONES KEYDAN';
const RIF_DEFAULT = (typeof window !== 'undefined' && window.EMPRESA) ? window.EMPRESA.RIF : 'J30580323';

// ==========================================
// COMPONENTES UI COMPARTIDOS
// ==========================================
const Icon = ({ name, size = 20, className = '' }) => {
    useEffect(() => { if (window.lucide) window.lucide.createIcons(); }, [name]);
    return <i data-lucide={name.toLowerCase()} style={{ width: size, height: size }} className={className}></i>;
};

const Spinner = () => (
    <div className="flex items-center justify-center gap-2 text-slate-400 text-xs font-bold uppercase">
        <Icon name="Loader" size={16} className="animate-spin" /> Cargando...
    </div>
);

// ==========================================
// LOGIN + REGISTRO (DESDE SUPABASE)
// ==========================================
const AuthScreen = ({ onLogin }) => {
    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [form, setForm] = useState({ usuario: '', clave: '', nombre: '', rol: 'COMERCIO', nombre_empresa: '', rif: '', color_tema: 'blue', clave_admin: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const CLAVE_REGISTRO = 'legalya2024'; // clave maestra para poder registrar usuarios

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            const data = await sbFetch(`usuarios?usuario=eq.${encodeURIComponent(form.usuario)}&clave=eq.${encodeURIComponent(form.clave)}&activo=eq.true`);
            if (!data || data.length === 0) { setError('Usuario o contraseña incorrectos.'); setLoading(false); return; }
            const user = data[0];
            localStorage.setItem('legaly_user', JSON.stringify(user));
            onLogin(user);
        } catch(err) { setError('Error de conexión. Verifica tu internet.'); }
        setLoading(false);
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');
        if (form.clave_admin !== CLAVE_REGISTRO) { setError('Clave de registro incorrecta.'); return; }
        if (!form.usuario || !form.clave || !form.nombre) { setError('Usuario, contraseña y nombre son obligatorios.'); return; }
        if (form.rol === 'COMERCIO' && !form.rif) { setError('El RIF es obligatorio para cuentas de comercio.'); return; }
        setLoading(true);
        try {
            const existe = await sbFetch(`usuarios?usuario=eq.${encodeURIComponent(form.usuario)}`);
            if (existe && existe.length > 0) { setError('Este nombre de usuario ya está en uso.'); setLoading(false); return; }
            await sbFetch('usuarios', {
                method: 'POST',
                prefer: 'return=minimal',
                body: JSON.stringify({
                    usuario: form.usuario.toLowerCase().trim(),
                    clave: form.clave,
                    nombre: form.nombre.toUpperCase().trim(),
                    rol: form.rol,
                    nombre_empresa: form.nombre_empresa.toUpperCase().trim() || form.nombre.toUpperCase().trim(),
                    rif: form.rif.toUpperCase().trim(),
                    color_tema: form.color_tema,
                    activo: true
                })
            });
            setSuccess(`¡Usuario "${form.usuario}" creado con éxito! Ya puede iniciar sesión.`);
            setForm({ usuario: '', clave: '', nombre: '', rol: 'COMERCIO', nombre_empresa: '', rif: '', color_tema: 'blue', clave_admin: '' });
            setTimeout(() => { setMode('login'); setSuccess(''); }, 2500);
        } catch(err) { setError('Error al crear usuario: ' + err.message); }
        setLoading(false);
    };

    const colores = [
        { val: 'blue', label: 'Azul', hex: '#3b82f6' }, { val: 'emerald', label: 'Verde', hex: '#10b981' },
        { val: 'violet', label: 'Violeta', hex: '#8b5cf6' }, { val: 'rose', label: 'Rojo', hex: '#f43f5e' },
        { val: 'amber', label: 'Naranja', hex: '#f59e0b' }, { val: 'cyan', label: 'Cyan', hex: '#06b6d4' },
    ];

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="w-full max-w-md relative z-10">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-blue-500/30">
                        <Icon name="Shield" size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-white uppercase tracking-tight">LegalYa</h1>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">Sistema Contable Inteligente</p>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1 mb-6">
                    <button onClick={() => { setMode('login'); setError(''); }} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${mode === 'login' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                        Iniciar Sesión
                    </button>
                    <button onClick={() => { setMode('register'); setError(''); }} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${mode === 'register' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                        Registrar Usuario
                    </button>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 shadow-2xl">
                    {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-xs font-bold mb-5 text-center">{error}</div>}
                    {success && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-xs font-bold mb-5 text-center">{success}</div>}

                    {mode === 'login' ? (
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Usuario</label>
                                <div className="relative">
                                    <Icon name="User" size={16} className="absolute left-4 top-3.5 text-slate-600" />
                                    <input required type="text" placeholder="tu_usuario" value={form.usuario} onChange={e => setForm({...form, usuario: e.target.value})}
                                        className="w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition-colors" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Contraseña</label>
                                <div className="relative">
                                    <Icon name="Lock" size={16} className="absolute left-4 top-3.5 text-slate-600" />
                                    <input required type="password" placeholder="••••••••" value={form.clave} onChange={e => setForm({...form, clave: e.target.value})}
                                        className="w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition-colors" />
                                </div>
                            </div>
                            <button type="submit" disabled={loading} className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-black uppercase text-sm shadow-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-2 mt-2">
                                {loading ? <><Icon name="Loader" size={16} className="animate-spin" /> Verificando...</> : <><Icon name="ArrowRight" size={16} /> Entrar al Sistema</>}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleRegister} className="space-y-4">
                            {/* Clave maestra */}
                            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
                                <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2 block">🔑 Clave de Registro (requerida)</label>
                                <input type="password" placeholder="Clave proporcionada por el admin" value={form.clave_admin} onChange={e => setForm({...form, clave_admin: e.target.value})}
                                    className="w-full px-4 py-2.5 bg-slate-800 border border-amber-500/30 text-white rounded-lg font-bold text-sm outline-none focus:border-amber-500 transition-colors" />
                            </div>

                            {/* Rol */}
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Tipo de Cuenta</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[{ val: 'COMERCIO', icon: 'Store', label: 'Comercio' }, { val: 'AUDITOR', icon: 'ShieldCheck', label: 'Auditor' }].map(r => (
                                        <button key={r.val} type="button" onClick={() => setForm({...form, rol: r.val})}
                                            className={`p-3 rounded-xl border-2 flex items-center gap-2 text-xs font-black uppercase transition-all ${form.rol === r.val ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slate-700 text-slate-500 hover:border-slate-600'}`}>
                                            <Icon name={r.icon} size={16} /> {r.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-1.5 block">Usuario *</label>
                                    <input required placeholder="usuario123" value={form.usuario} onChange={e => setForm({...form, usuario: e.target.value.toLowerCase()})}
                                        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition-colors" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-1.5 block">Contraseña *</label>
                                    <input required type="password" placeholder="••••••••" value={form.clave} onChange={e => setForm({...form, clave: e.target.value})}
                                        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition-colors" />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-1.5 block">Nombre Completo *</label>
                                <input required placeholder="CARLOS PÉREZ" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value.toUpperCase()})}
                                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition-colors" />
                            </div>

                            {form.rol === 'COMERCIO' && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-1.5 block">Nombre Empresa</label>
                                            <input placeholder="MI COMERCIO C.A." value={form.nombre_empresa} onChange={e => setForm({...form, nombre_empresa: e.target.value.toUpperCase()})}
                                                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition-colors" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-1.5 block">RIF *</label>
                                            <input placeholder="J-12345678" value={form.rif} onChange={e => setForm({...form, rif: e.target.value.toUpperCase()})}
                                                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition-colors" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Color del Panel</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {colores.map(c => (
                                                <button key={c.val} type="button" onClick={() => setForm({...form, color_tema: c.val})}
                                                    title={c.label}
                                                    style={{ background: c.hex }}
                                                    className={`w-8 h-8 rounded-lg transition-all ${form.color_tema === c.val ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'opacity-60 hover:opacity-100'}`}>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            <button type="submit" disabled={loading} className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-black uppercase text-sm shadow-lg transition-all flex items-center justify-center gap-2 mt-2">
                                {loading ? <><Icon name="Loader" size={16} className="animate-spin" /> Creando usuario...</> : <><Icon name="UserPlus" size={16} /> Crear Usuario</>}
                            </button>
                        </form>
                    )}
                </div>

                <p className="text-center text-[10px] text-slate-600 mt-4 font-bold uppercase tracking-widest">
                    LegalYa © 2024 — Sistema Contable Inteligente
                </p>
            </div>
        </div>
    );
};

// ==========================================
// COMERCIOS: CONTEXTO Y PROVIDER
// ==========================================
const AppContext = createContext();

const AppProvider = ({ children, currentUser }) => {
    const getSaved = (key, fallback) => { try { const i = localStorage.getItem(key); return i ? JSON.parse(i) : fallback; } catch { return fallback; } };

    const [isInit, setIsInit] = useState(() => localStorage.getItem('legaly_init') === 'true');
    const [tasaBCV, setTasaBCV] = useState(() => parseFloat(localStorage.getItem('legaly_tasa')) || 0);
    const [isLocked, setIsLocked] = useState(() => localStorage.getItem('legaly_locked') === 'true');
    const [journal, setJournal] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [inventory, setInventory] = useState([]);

    useEffect(() => {
        localStorage.setItem('legaly_init', isInit);
        localStorage.setItem('legaly_tasa', tasaBCV.toString());
        localStorage.setItem('legaly_locked', isLocked);
    }, [isInit, tasaBCV, isLocked]);

    const updateInventory = (rows) => {
        const stockMap = {};
        rows.forEach(row => {
            const cuenta = String(row.codigo_cuenta || '').trim();
            const concepto = row.concepto || '';
            if (cuenta !== CTA.INVENTARIO || !concepto) return;
            let name = '', qty = parseFloat(row.cantidad) || 0;
            if (!qty) { const m = concepto.match(/Cant:\s*([\d.]+)/i); if (m) qty = parseFloat(m[1]); }
            if (concepto.includes('Recepcion:')) name = concepto.split('|')[0].replace(/Recepcion:\s*/i,'').trim().toUpperCase();
            else if (concepto.includes('Costo Venta')) { const m = concepto.match(/Cant:.*?de\s+(.*?)(?:\s*\||$)/i); if (m) name = m[1].trim().toUpperCase(); }
            else { name = concepto.split('|')[0].replace(/^(Compra|Venta|Costo|Entrada|Recepcion):\s*/i,'').trim().toUpperCase(); }
            if (!name) return;
            if (!stockMap[name]) stockMap[name] = { name, totalEntradas: 0, totalSalidas: 0, unit: row.unidad || 'unidades', cost: 0, sellPrice: parseFloat(row.precio_venta) || 0 };
            const debe = parseFloat(row.debe_usd) || 0, haber = parseFloat(row.haber_usd) || 0, precio = parseFloat(row.precio_venta) || 0;
            if (debe > 0) { stockMap[name].totalEntradas += qty; stockMap[name].cost = qty > 0 ? debe/qty : 0; }
            if (haber > 0) stockMap[name].totalSalidas += qty;
            if (precio > 0) stockMap[name].sellPrice = precio;
        });
        return Object.values(stockMap).map(p => ({ ...p, id: `p-${p.name}`, stock: p.totalEntradas - p.totalSalidas }));
    };

    useEffect(() => { if (journal.length > 0) setInventory(updateInventory(journal)); }, [journal]);

    const addTransaction = async (newRows) => {
        if (isLocked) return alert('SISTEMA BLOQUEADO. Inicie un nuevo ciclo.');
        const rowsArray = Array.isArray(newRows) ? newRows : [newRows];
        setJournal(prev => [...prev, ...rowsArray]);
        const rif = currentUser?.rif || RIF_DEFAULT;
        const empresa = currentUser?.nombre_empresa || NOMBRE_EMPRESA_DEFAULT;
        const payload = rowsArray.map(row => ({
            empresa, rif,
            cuenta_contable: String(row.cuenta_contable || ''),
            codigo_cuenta: String(row.codigo_cuenta || ''),
            concepto: String(row.concepto || ''),
            debe_usd: Number(row.debe_usd || 0),
            haber_usd: Number(row.haber_usd || 0),
            debe_bs: Number((row.debe_usd || 0) * tasaBCV),
            haber_bs: Number((row.haber_usd || 0) * tasaBCV),
            tasa: Number(row.tasa || tasaBCV || 0),
            ref_doc: String(row.ref_doc || ''),
            cantidad: Number(row.cantidad || 0),
            unidad: String(row.unidad || 'und'),
            precio_venta: Number(row.precio_venta || 0),
            entidad: String(row.entidad || 'GENERAL'),
            fecha_local: new Date().toISOString()
        }));
        try { await sbFetch('journal', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(payload) }); }
        catch (err) { console.error('Error Supabase:', err); }
    };

    const addContact = async (data) => {
        const nuevo = { id: data.id, name: data.name, type: data.type || 'cliente', email: data.email || '', phone: data.phone || '', rif_empresa: currentUser?.rif || RIF_DEFAULT };
        try {
            await sbFetch('contacts', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(nuevo) });
            setContacts(prev => [...prev, nuevo]);
        } catch(err) { console.error('Error contacto:', err); alert('No se pudo guardar el contacto.'); }
    };

    const value = { isInit, setIsInit, tasaBCV, setTasaBCV, currentUser, journal, setJournal, contacts, setContacts, isLocked, setIsLocked, inventory, setInventory, updateInventory, addTransaction, addContact };
    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// ==========================================
// COMERCIOS: PANTALLA APERTURA (StartScreen)
// ==========================================
const StartScreen = ({ currentUser, onLogout }) => {
    const { setTasaBCV, setJournal, setContacts, setIsInit, updateInventory, setInventory } = useContext(AppContext);
    const [tasa, setTasa] = useState('');
    const [loading, setLoading] = useState(false);
    const [listo, setListo] = useState(false);
    const [stats, setStats] = useState({ movs: 0, conts: 0 });
    const [error, setError] = useState('');
    const tema = currentUser?.color_tema || 'blue';

    const cargarNube = async () => {
        setLoading(true); setError('');
        const rif = currentUser?.rif || RIF_DEFAULT;
        try {
            const [movs, conts] = await Promise.all([
                sbFetch(`journal?rif=eq.${encodeURIComponent(rif)}&order=id.asc&limit=5000`),
                sbFetch(`contacts?rif_empresa=eq.${encodeURIComponent(rif)}&order=name.asc`)
            ]);
            const movsData = movs || [], contsData = conts || [];
            setJournal(movsData); setContacts(contsData);
            setInventory(updateInventory(movsData));
            setStats({ movs: movsData.length, conts: contsData.length });
            setListo(true);
        } catch(e) { setError('Error de conexión con Supabase.'); console.error(e); }
        finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-slate-800 p-10 rounded-[2.5rem] w-full max-w-md border border-slate-700 shadow-2xl">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <p className={`text-${tema}-500 font-black tracking-widest text-[10px] uppercase mb-1`}>Apertura de Jornada</p>
                        <h1 className="text-2xl font-black text-white uppercase leading-tight">{currentUser?.nombre_empresa || currentUser?.nombre}</h1>
                        <p className="text-slate-400 text-xs font-bold mt-1 uppercase">RIF: {currentUser?.rif || '—'}</p>
                    </div>
                    <button onClick={onLogout} className="p-2 hover:bg-slate-700 text-slate-500 rounded-xl transition-colors" title="Cerrar sesión">
                        <Icon name="LogOut" size={16} />
                    </button>
                </div>
                <div className="space-y-5">
                    <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700">
                        <label className="block text-slate-500 text-[10px] font-black uppercase mb-2 tracking-widest">Tasa BCV del Día (Bs/$)</label>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-black text-lg">Bs/</span>
                            <input type="number" value={tasa} onChange={e => setTasa(e.target.value)} placeholder="0.00"
                                className="flex-1 bg-transparent text-white text-4xl font-black outline-none focus:text-blue-400 transition-colors" />
                        </div>
                    </div>
                    <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700">
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Sincronización Supabase</label>
                            {listo && <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-1 rounded-full font-black border border-emerald-500/20">✓ Listo</span>}
                        </div>
                        {error && <p className="text-rose-400 text-xs font-bold mb-3 text-center">{error}</p>}
                        {!listo ? (
                            <button onClick={cargarNube} disabled={loading} className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 border border-slate-700 transition-colors">
                                {loading ? <><Icon name="Loader" size={14} className="animate-spin" /> Conectando...</> : <><Icon name="CloudDownload" size={14} /> Sincronizar datos</>}
                            </button>
                        ) : (
                            <div className="bg-slate-800 p-3 rounded-xl space-y-2">
                                <div className="flex justify-between text-xs font-bold text-slate-400"><span>Movimientos:</span><span className="text-white">{stats.movs}</span></div>
                                <div className="flex justify-between text-xs font-bold text-slate-400"><span>Contactos:</span><span className="text-white">{stats.conts}</span></div>
                                <button onClick={cargarNube} disabled={loading} className="w-full mt-1 text-[10px] text-blue-400 font-black uppercase underline text-center">Volver a sincronizar</button>
                            </div>
                        )}
                    </div>
                    <button disabled={!tasa || !listo || parseFloat(tasa) <= 0}
                        onClick={() => { setTasaBCV(parseFloat(tasa)); setIsInit(true); }}
                        className={`w-full py-5 rounded-[1.5rem] font-black uppercase italic shadow-lg transition-all disabled:opacity-20 hover:scale-[1.02] text-white bg-${tema}-600 hover:bg-${tema}-500`}>
                        Iniciar Operaciones →
                    </button>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// COMERCIOS: COMPONENTES UI
// ==========================================
const MenuButton = ({ onClick, label, icon, color }) => (
    <button onClick={onClick} className={`p-4 rounded-[2rem] flex flex-col items-center justify-center gap-2 shadow-sm hover:scale-105 transition-all ${color}`}>
        <Icon name={icon} size={24}/><span className="font-black uppercase text-[9px] tracking-wider text-center">{label}</span>
    </button>
);
const StatCard = ({ label, val, icon, color, bg }) => (
    <div className={`${bg} p-6 rounded-[2rem] flex flex-col gap-3 border border-white/50 shadow-sm`}>
        <div className={`p-3 rounded-2xl ${color} bg-white shadow-sm w-max`}><Icon name={icon} size={20}/></div>
        <div><p className="text-[10px] font-black uppercase text-slate-500">{label}</p><p className={`text-xl font-black ${color}`}>{val}</p></div>
    </div>
);
const InputField = ({ label, icon, color, value, onChange }) => (
    <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border-2 border-transparent focus-within:border-slate-200 transition-all">
        <div className={`${color} text-white p-3 rounded-2xl shadow-sm`}><Icon name={icon}/></div>
        <div className="flex-1"><p className="text-[10px] font-black text-slate-400 uppercase">{label}</p><input type="number" placeholder="0.00" className="w-full bg-transparent text-xl font-black outline-none" value={value} onChange={e=>onChange(e.target.value)}/></div>
    </div>
);
const ResultRow = ({ label, system, diff, isUsd=false }) => (
    <div className="flex justify-between items-center border-b border-white/5 pb-4">
        <div><p className="text-[10px] font-bold text-slate-500 uppercase">{label}</p><p className="text-xs opacity-50">Sistema: {isUsd?'$':''}{system.toFixed(2)}</p></div>
        <div className="text-right"><p className={`text-lg font-black ${diff>=0?'text-emerald-400':'text-rose-400'}`}>{diff>=0?'+':''}{diff.toFixed(2)} {isUsd?'$':'Bs'}</p></div>
    </div>
);
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
    const handleScanQR = async (code) => {
        const now = Date.now();
        // Debounce: mismo código en menos de 1500ms → ignorar
        if (code === lastScanRef.current.code && now - lastScanRef.current.time < 1500) return;
        lastScanRef.current = { code, time: now };

        const rif = currentUser?.rif || RIF_DEFAULT;
        let prodToAdd = null;
        let feedback  = { nombre: '', precio: 0, status: 'ok' };

        try {
            const results = await sbFetch(
                `products?rif_empresa=eq.${encodeURIComponent(rif)}&or=(codigo_qr.eq.${encodeURIComponent(code)},codigo_barra.eq.${encodeURIComponent(code)},codigo_producto.eq.${encodeURIComponent(code)})&activo=eq.true`
            );
            if (results && results.length > 0) {
                const p = results[0];
                const invProd = inventory.find(i => i.name === p.nombre);
                prodToAdd = {
                    id: `db-${p.id}`,
                    name: p.nombre,
                    sellPrice: parseFloat(p.precio_venta) || 0,
                    cost: invProd?.cost || parseFloat(p.costo) || 0,
                    stock: invProd?.stock ?? parseFloat(p.stock) ?? 0,
                    unit: p.unidad || 'unidades'
                };
            } else {
                // Fallback: inventario contable
                const inv = inventory.find(i => i.name === code || i.id === code);
                if (inv) prodToAdd = inv;
            }
        } catch(e) { console.error('Scan error:', e); }

        if (prodToAdd) {
            addToCart(prodToAdd, 1);
            feedback = { nombre: prodToAdd.name, precio: prodToAdd.sellPrice, status: 'ok' };
        } else {
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

const ReceptionModule = ({ onBack }) => {
    const { addTransaction, contacts } = useContext(AppContext);
    
    const providers = contacts.filter(c => c.type === 'proveedor' || c.type === 'ambos');

    const [provider, setProvider] = useState({ name: '', rif: '' });
    const [cart, setCart] = useState([]);
    const [payments, setPayments] = useState({ usd: '', bs: '', banco: '', cxp: '' });
    const [item, setItem] = useState({ name: '', qty: '', unit: 'unidades', costTotal: '', sellPrice: '' });

    const addItem = () => {
        if (!item.name || !item.qty || !item.costTotal) return;
        setCart([...cart, { ...item, qty: parseFloat(item.qty), costTotal: parseFloat(item.costTotal), sellPrice: parseFloat(item.sellPrice), id: Date.now() }]);
        setItem({ name: '', qty: '', unit: 'unidades', costTotal: '', sellPrice: '' });
    };

    const total = cart.reduce((acc, c) => acc + c.costTotal, 0);

    const totalPagado = (parseFloat(payments.usd) || 0) + (parseFloat(payments.bs) || 0) + (parseFloat(payments.banco) || 0) + (parseFloat(payments.cxp) || 0);
    const canProcessCompra = total > 0 && provider.name && Math.abs(total - totalPagado) < 0.05;

    const syncProductos = async (cartItems, providerName, rif) => {
        for (const c of cartItems) {
            const nombre = c.name.toUpperCase().trim();
            const costUnitario = c.qty > 0 ? c.costTotal / c.qty : 0;
            try {
                // Buscar si ya existe
                const existing = await sbFetch(`products?rif_empresa=eq.${encodeURIComponent(rif)}&nombre=eq.${encodeURIComponent(nombre)}&activo=eq.true`);
                if (existing && existing.length > 0) {
                    // Actualizar stock, costo y ultima_compra
                    const prod = existing[0];
                    const newStock = parseFloat(prod.stock || 0) + parseFloat(c.qty);
                    await sbFetch(`products?id=eq.${prod.id}`, {
                        method: 'PATCH', prefer: 'return=minimal',
                        body: JSON.stringify({ stock: newStock, costo: costUnitario, precio_venta: parseFloat(c.sellPrice) || prod.precio_venta, proveedor: providerName.toUpperCase(), ultima_compra: new Date().toISOString() })
                    });
                } else {
                    // Crear nuevo producto
                    const countRes = await sbFetch(`products?rif_empresa=eq.${encodeURIComponent(rif)}&select=id`);
                    const count = (countRes?.length || 0) + 1;
                    const codigoProd = `PROD-${String(count).padStart(5,'0')}`;
                    const codigoQR = `LEGALYA-${codigoProd}`;
                    await sbFetch('products', {
                        method: 'POST', prefer: 'return=minimal',
                        body: JSON.stringify({ rif_empresa: rif, codigo_producto: codigoProd, codigo_qr: codigoQR, nombre, categoria: 'GENERAL', unidad: c.unit || 'unidades', costo: costUnitario, precio_venta: parseFloat(c.sellPrice) || 0, stock: parseFloat(c.qty), proveedor: providerName.toUpperCase(), ultima_compra: new Date().toISOString(), activo: true })
                    });
                }
            } catch(e) { console.warn('Error sync producto:', nombre, e.message); }
        }
    };

    const handleFinalizar = async () => {
        if (!canProcessCompra) return;
        const ref = `REC-${Date.now().toString().slice(-4)}`;
        let rows = [];
        
        cart.forEach(c => {
            const concepto = `Recepcion: ${c.name} | Cant: ${c.qty.toFixed(c.unit === 'kg' ? 3 : 0)} ${c.unit} | Prov: ${provider.name}`;
            rows.push({ codigo_cuenta: CTA.INVENTARIO, cuenta_contable: 'Inventario de Mercancía', concepto: concepto, debe_usd: c.costTotal, haber_usd: 0, unidad: c.unit, ref_doc: ref, precio_venta: c.sellPrice, entidad: provider.name.toUpperCase(), cantidad: c.qty });
        });

        const pMap = [
            { k: 'usd', c: CTA.CAJA_USD, n: 'Caja Principal ($)' }, { k: 'bs', c: CTA.CAJA_BS, n: 'Caja Principal (Bs)' },
            { k: 'banco', c: CTA.BANCOS, n: 'Bancos Nacionales' }, { k: 'cxp', c: CTA.CXP, n: 'Proveedores por Pagar' }
        ];
        pMap.forEach(p => {
            if (parseFloat(payments[p.k]) > 0) rows.push({ codigo_cuenta: p.c, cuenta_contable: p.n, concepto: `Pago Prov: ${provider.name} | Ref: ${ref}`, debe_usd: 0, haber_usd: parseFloat(payments[p.k]), unidad: 'monto', ref_doc: ref, entidad: provider.name.toUpperCase(), cantidad: 0 });
        });
        const dif = rows.reduce((acc, r) => acc + (parseFloat(r.debe_usd) || 0), 0) - rows.reduce((acc, r) => acc + (parseFloat(r.haber_usd) || 0), 0);
        if (Math.abs(dif) > 0.009) rows.push({ codigo_cuenta: CTA.DIF_CAMB, cuenta_contable: 'Diferencial Cambiario', concepto: `Ajuste Redondeo en Compra ${ref}`, debe_usd: dif < 0 ? Math.abs(dif) : 0, haber_usd: dif > 0 ? dif : 0, unidad: 'monto', ref_doc: ref, entidad: provider.name.toUpperCase() });

        addTransaction(rows);
        // Sync automático a tabla products (no bloquea el flujo contable)
        const rif = currentUser?.rif || RIF_DEFAULT;
        syncProductos(cart, provider.name, rif).catch(e => console.warn('Sync products error:', e));
        onBack();
    };

    return (
        <div className="animate-in space-y-6 pb-20">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
                {/* BOTON GLOBAL MANEJA EL RETROCESO */}
                <h2 className="font-black uppercase italic tracking-tighter text-xl">Recepción de Mercancía</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 grid grid-cols-2 gap-4">
                        <div className="relative">
                            <Icon name="Search" size={16} className="absolute left-4 top-5 text-slate-400" />
                            <input 
                                placeholder="BUSCAR RIF / CÉDULA..." 
                                className="w-full pl-10 p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none focus:border-blue-500 border-2 border-transparent transition-all" 
                                value={provider.rif} 
                                onChange={e => {
                                    const val = e.target.value.toUpperCase();
                                    setProvider({...provider, rif: val});
                                    const found = providers.find(p => (p.id || p.rif_entidad)?.includes(val) && val.length > 3);
                                    if(found) setProvider({ name: found.name, rif: found.id });
                                }} 
                            />
                        </div>
                        <div>
                            <input 
                                list="reception-providers"
                                placeholder="NOMBRE PROVEEDOR *" 
                                className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none focus:border-blue-500 border-2 border-transparent transition-all" 
                                value={provider.name} 
                                onChange={e => {
                                    const val = e.target.value.toUpperCase();
                                    const found = providers.find(p => p.name === val);
                                    if(found) setProvider({ name: found.name, rif: found.id });
                                    else setProvider({...provider, name: val});
                                }} 
                            />
                            <datalist id="reception-providers">
                                {providers.map(p => <option key={p.id} value={p.name} />)}
                            </datalist>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <input placeholder="NOMBRE PRODUCTO" className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none" value={item.name} onChange={e => setItem({...item, name: e.target.value.toUpperCase()})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Cant / Peso</label>
                                <input type="number" step={item.unit === 'kg' ? "0.001" : "1"} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" value={item.qty} onChange={e => setItem({...item, qty: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Unidad</label>
                                <select className="w-full p-4 bg-blue-50 text-blue-600 rounded-2xl font-black uppercase outline-none" value={item.unit} onChange={e => setItem({...item, unit: e.target.value})}>
                                    <option value="unidades">unidades</option>
                                    <option value="kg">kg</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Costo Total ($)</label>
                                <input type="number" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" value={item.costTotal} onChange={e => setItem({...item, costTotal: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Precio Venta Sugerido ($)</label>
                                <input type="number" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" value={item.sellPrice} onChange={e => setItem({...item, sellPrice: e.target.value})} />
                            </div>
                        </div>
                        <button onClick={addItem} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase italic shadow-lg hover:bg-black transition-all">Añadir a Recepción</button>
                    </div>

                    <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                        <table className="w-full text-xs font-bold">
                            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr><th className="p-4 text-left">Item</th><th className="p-4 text-center">Cant.</th><th className="p-4 text-right">Costo Unit.</th><th className="p-4"></th></tr></thead>
                            <tbody className="divide-y divide-slate-50">
                                {cart.map(c => <tr key={c.id}><td className="p-4 uppercase">{c.name}</td><td className="p-4 text-center">{c.qty} {c.unit}</td><td className="p-4 text-right">${(c.costTotal / c.qty).toFixed(2)}</td><td className="p-4 text-center"><button onClick={() => setCart(cart.filter(item => item.id !== c.id))} className="text-rose-400 hover:text-rose-600"><Icon name="Trash2" size={16}/></button></td></tr>)}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-xl space-y-6">
                        <h3 className="font-black uppercase italic text-sm border-b border-white/10 pb-4 text-blue-400">Total Compra</h3>
                        <div className="text-right">
                            <p className="text-5xl font-black tracking-tighter italic">${total.toFixed(2)}</p>
                        </div>
                        <div className="space-y-3">
                            <input placeholder="Pago USD $" type="number" className="w-full p-4 bg-white/5 rounded-2xl text-center font-bold outline-none border border-white/10" value={payments.usd} onChange={e => setPayments({...payments, usd: e.target.value})} />
                            <input placeholder="Pago BS ($ eq)" type="number" className="w-full p-4 bg-white/5 rounded-2xl text-center font-bold outline-none border border-white/10" value={payments.bs} onChange={e => setPayments({...payments, bs: e.target.value})} />
                            <input placeholder="BANCO ($ eq)" type="number" className="w-full p-4 bg-white/5 rounded-2xl text-center font-bold outline-none border border-white/10" value={payments.banco} onChange={e => setPayments({...payments, banco: e.target.value})} />
                            <input placeholder="CRÉDITO CXP ($)" type="number" className="w-full p-4 bg-orange-500/10 text-orange-400 rounded-2xl text-center font-bold outline-none border border-orange-500/20" value={payments.cxp} onChange={e => setPayments({...payments, cxp: e.target.value})} />
                        </div>
                        <button onClick={handleFinalizar} disabled={!canProcessCompra} className={`w-full py-6 rounded-[2rem] font-black uppercase italic shadow-lg transition-all ${canProcessCompra ? 'bg-blue-500 hover:bg-blue-600' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>Confirmar Compra</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

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

const ContactModule = ({ onBack }) => {
    const { contacts, addContact } = useContext(AppContext);
    const [form, setForm] = useState({ id: '', name: '', email: '', phone: '', type: 'cliente' });

    const handleSave = (e) => {
        e.preventDefault();
        if (!form.id || !form.name) return alert("Cédula/RIF y Nombre son obligatorios");
        
        const existe = contacts.find(c => c.id === form.id || c.rif_entidad === form.id);
        if (existe) return alert("Este contacto ya se encuentra registrado.");
        
        addContact(form);
        setForm({ id: '', name: '', email: '', phone: '', type: 'cliente' });
        alert("¡Contacto afiliado con éxito!");
    };

    const handleExport = () => {
        if (contacts.length === 0) return alert("No hay contactos registrados.");
        const headers = ["Cedula_RIF", "Nombre_Completo", "Tipo", "Email", "Telefono"];
        const rows = contacts.map(c => [c.id || c.rif_entidad, `"${c.name}"`, c.type.toUpperCase(), c.email, c.phone]);
        const csvContent = [headers, ...rows].map(e => e.join(";")).join("\n");
        
        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = `Directorio_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    return (
        <div className="animate-in space-y-6 pb-20">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {/* BOTON GLOBAL MANEJA EL RETROCESO */}
                    <h2 className="font-black uppercase italic tracking-tighter text-xl text-indigo-600">Gestión de Contactos</h2>
                </div>
                <button onClick={handleExport} className="bg-indigo-50 text-indigo-600 px-4 py-3 rounded-xl text-xs font-black uppercase flex items-center gap-2 hover:bg-indigo-100 transition-all"><Icon name="Download" size={14}/> Exportar BD</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-5">
                    <form onSubmit={handleSave} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-4">
                        <h3 className="text-xs font-black uppercase text-slate-400 mb-6 flex items-center gap-2"><Icon name="UserPlus" size={14}/> Nuevo Registro</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Rol del Contacto *</label>
                                <select className="w-full p-4 bg-indigo-50 text-indigo-700 rounded-2xl font-black uppercase outline-none cursor-pointer text-sm border-2 border-transparent focus:border-indigo-500" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                                    <option value="cliente">Cliente (Para Ventas)</option>
                                    <option value="proveedor">Proveedor (Para Compras/Gastos)</option>
                                    <option value="ambos">Ambos (Cliente y Proveedor)</option>
                                </select>
                            </div>
                            <div><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Cédula / RIF *</label><input required placeholder="Ej: V-12345678" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold uppercase focus:border-indigo-500 border-2 border-transparent" value={form.id} onChange={e => setForm({...form, id: e.target.value.toUpperCase()})} /></div>
                            <div><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nombre / Razón Social *</label><input required placeholder="Nombre Completo" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold uppercase focus:border-indigo-500 border-2 border-transparent" value={form.name} onChange={e => setForm({...form, name: e.target.value.toUpperCase()})} /></div>
                            <div><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Correo (Opcional)</label><input type="email" placeholder="contacto@correo.com" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold focus:border-indigo-500 border-2 border-transparent" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
                            <div><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Teléfono / WhatsApp</label><input placeholder="0414-0000000" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold focus:border-indigo-500 border-2 border-transparent" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
                        </div>
                        <button type="submit" className="w-full mt-4 py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase italic shadow-lg shadow-indigo-200 hover:scale-[1.02] transition-all">Guardar Contacto</button>
                    </form>
                </div>

                <div className="lg:col-span-7">
                    <div className="bg-slate-900 rounded-[3rem] p-8 text-white h-[600px] flex flex-col shadow-2xl">
                        <div className="flex justify-between items-center mb-6"><h3 className="text-xs font-black uppercase text-slate-400 italic">Directorio General</h3><span className="bg-indigo-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase">Total: {contacts.length}</span></div>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                            {contacts.length === 0 && <div className="h-full flex items-center justify-center text-slate-600 font-bold text-sm uppercase"><p>Sin contactos registrados</p></div>}
                            {contacts.map((c, i) => (
                                <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center hover:bg-white/10 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${c.type === 'proveedor' ? 'bg-orange-500' : 'bg-indigo-500'}`}>{c.name.charAt(0)}</div>
                                        <div>
                                            <div className="flex items-center gap-2"><p className="font-black text-sm uppercase">{c.name}</p><span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${c.type === 'proveedor' ? 'bg-orange-500/20 text-orange-400' : c.type === 'ambos' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'}`}>{c.type}</span></div>
                                            <p className="text-[10px] text-slate-400 font-bold tracking-wider">{c.id || c.rif_entidad} {c.phone && `• ${c.phone}`}</p>
                                        </div>
                                    </div>
                                    {c.email && <Icon name="Mail" size={16} className="text-slate-500"/>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// MÓDULO INVENTARIO
// ==========================================
const InventoryModule = ({ onBack }) => {
    const { inventory } = useContext(AppContext);
    const [search, setSearch] = useState("");

    const filteredInventory = inventory.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="animate-in space-y-6">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
                {/* BOTON GLOBAL MANEJA EL RETROCESO */}
                <h2 className="font-black uppercase italic tracking-tighter text-xl">Stock Actual</h2>
            </div>
            <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
                <table className="w-full text-sm font-bold">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr><th className="p-6 text-left">Producto</th><th className="p-6 text-center">Existencia</th><th className="p-6 text-center">Unidad</th><th className="p-6 text-right">Precio</th></tr></thead>
                    <tbody className="divide-y divide-slate-50">
                        {inventory.map(p => (
                            <tr key={p.id}>
                                <td className="p-6 uppercase font-black">{p.name}</td>
                                <td className="p-6 text-center text-blue-600">{p.stock.toFixed(p.unit === 'kg' ? 3 : 0)}</td>
                                <td className="p-6 text-center uppercase text-[10px] text-slate-400">{p.unit}</td>
                                <td className="p-6 text-right font-black">${p.sellPrice.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

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
const AuditorPanel = ({ currentUser, onLogout }) => {
    const [view, setView] = useState('audit-dashboard');
    const [empresas, setEmpresas] = useState([]); const [loading, setLoading] = useState(true);
    const [empresaActiva, setEmpresaActiva] = useState(null); const [empresaDetalle, setEmpresaDetalle] = useState(null);

    useEffect(()=>{ auditGetEmpresas().then(d=>{setEmpresas(d||[]);setLoading(false);}).catch(()=>setLoading(false)); },[]);
    useEffect(()=>{ if(window.lucide) window.lucide.createIcons(); },[view]);

    const nav = [
        {id:'audit-dashboard',icon:'LayoutDashboard',label:'Dashboard'},
        {id:'audit-empresas',icon:'Building2',label:'Empresas'},
        {id:'audit-auditoria',icon:'Search',label:'Auditoría'},
        {id:'audit-libros',icon:'BookOpen',label:'Libros Contables'},
        {id:'audit-estados',icon:'FileBarChart',label:'Estados Financieros'},
        {id:'audit-analisis',icon:'Brain',label:'Análisis'},
        {id:'audit-alertas',icon:'Bell',label:'Alertas'},
    ];

    const renderView = () => {
        if(loading) return <div className="flex items-center justify-center h-64"><div className="text-center space-y-3"><Icon name="Loader" size={32} className="text-blue-500 animate-spin mx-auto"/><p className="text-slate-500 text-xs font-black uppercase">Conectando con Supabase...</p></div></div>;
        if(view==='audit-empresa-detalle'&&empresaDetalle) return <AuditEmpresaDetalle empresa={empresaDetalle} onBack={()=>{setView('audit-empresas');setEmpresaDetalle(null);}} setView={setView} setEmpresaActiva={setEmpresaActiva}/>;
        const views = {
            'audit-dashboard':<AuditDashboard empresas={empresas}/>,
            'audit-empresas':<AuditEmpresas empresas={empresas} onSelect={e=>{setEmpresaDetalle(e);setView('audit-empresa-detalle');}}/>,
            'audit-auditoria':<AuditAuditoria empresas={empresas} empresaActiva={empresaActiva}/>,
            'audit-libros':<AuditLibros empresas={empresas} empresaActiva={empresaActiva}/>,
            'audit-estados':<AuditEstados empresas={empresas} empresaActiva={empresaActiva}/>,
            'audit-analisis':<AuditAnalisis empresas={empresas} empresaActiva={empresaActiva}/>,
            'audit-alertas':<AuditAlertas empresas={empresas}/>,
        };
        return views[view] || views['audit-dashboard'];
    };

    return (
        <div className="flex min-h-screen bg-slate-950 font-sans">
            {/* SIDEBAR AUDITOR */}
            <aside className="w-56 bg-black border-r border-slate-800 h-screen sticky top-0 flex flex-col shrink-0">
                <div className="p-5 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center"><Icon name="Shield" size={14} className="text-white"/></div>
                        <div><p className="text-[11px] font-black text-white uppercase tracking-tight leading-none">LegalYa</p><p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Auditor</p></div>
                    </div>
                </div>
                <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
                    {nav.map(item=>(
                        <button key={item.id} onClick={()=>{setView(item.id);setEmpresaDetalle(null);}}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all ${view===item.id||view==='audit-empresa-detalle'&&item.id==='audit-empresas'?'bg-blue-600 text-white':'text-slate-500 hover:text-white hover:bg-slate-800'}`}>
                            <Icon name={item.icon} size={14}/>{item.label}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-slate-800 space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-[11px] font-black text-white">{currentUser?.nombre?.charAt(0)||'A'}</div>
                        <div className="overflow-hidden"><p className="text-[10px] font-black text-white uppercase truncate">{currentUser?.nombre||'Admin'}</p><p className="text-[9px] text-slate-500 font-bold">AUDITOR</p></div>
                    </div>
                    <div className={`flex items-center gap-1.5 text-[9px] font-bold ${empresas.length>0?'text-emerald-400':'text-slate-600'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${empresas.length>0?'bg-emerald-400':'bg-slate-600'}`}></div>
                        {empresas.length} empresa{empresas.length!==1?'s':''} conectada{empresas.length!==1?'s':''}
                    </div>
                    <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-black uppercase text-rose-400 hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-500/20">
                        <Icon name="LogOut" size={12}/> Cerrar Sesión
                    </button>
                </div>
            </aside>
            <main className="flex-1 overflow-y-auto"><div className="max-w-6xl mx-auto p-8">{renderView()}</div></main>
        </div>
    );
};


// ==========================================
// UTILIDADES MOBILE / RESPONSIVE
// ==========================================
const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [isTablet, setIsTablet] = useState(window.innerWidth >= 768 && window.innerWidth < 1024);
    useEffect(() => {
        const handler = () => {
            setIsMobile(window.innerWidth < 768);
            setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
        };
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);
    return { isMobile, isTablet, isDesktop: !isMobile && !isTablet };
};

// ==========================================
// PRODUCT MANAGER — gestión tabla products
// ==========================================
const ProductManager = ({ onBack, currentUser }) => {
    const rif = currentUser?.rif || RIF_DEFAULT;
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ nombre:'', categoria:'GENERAL', unidad:'unidades', costo:'', precio_venta:'', stock:'' });
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const data = await sbFetch(`products?rif_empresa=eq.${encodeURIComponent(rif)}&activo=eq.true&order=nombre.asc`);
            setProducts(data || []);
        } catch(e) { console.error(e); }
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const handleSave = async () => {
        if (!form.nombre) return alert('El nombre es obligatorio');
        setSaving(true);
        try {
            const count = products.length + 1;
            const codigo = `PROD-${String(count).padStart(5,'0')}`;
            const qr = `LEGALYA-${codigo}`;
            await sbFetch('products', {
                method: 'POST', prefer: 'return=minimal',
                body: JSON.stringify({
                    rif_empresa: rif,
                    codigo_producto: codigo,
                    codigo_qr: qr,
                    nombre: form.nombre.toUpperCase().trim(),
                    categoria: form.categoria.toUpperCase().trim(),
                    unidad: form.unidad,
                    costo: parseFloat(form.costo) || 0,
                    precio_venta: parseFloat(form.precio_venta) || 0,
                    stock: parseFloat(form.stock) || 0,
                    activo: true
                })
            });
            setForm({ nombre:'', categoria:'GENERAL', unidad:'unidades', costo:'', precio_venta:'', stock:'' });
            setShowForm(false);
            await load();
        } catch(e) { alert('Error al guardar: ' + e.message); }
        setSaving(false);
    };

    const handleToggle = async (prod) => {
        try {
            await sbFetch(`products?id=eq.${prod.id}`, {
                method: 'PATCH', prefer: 'return=minimal',
                body: JSON.stringify({ activo: !prod.activo })
            });
            await load();
        } catch(e) { console.error(e); }
    };

    const filtered = products.filter(p => p.nombre?.toLowerCase().includes(search.toLowerCase()) || p.codigo_producto?.includes(search));

    return (
        <div className="animate-in space-y-5 pb-20">
            <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl"><Icon name="ArrowLeft" size={18}/></button>
                    <div>
                        <h2 className="font-black uppercase italic tracking-tight text-xl text-slate-900">Gestión de Productos</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{products.length} productos activos</p>
                    </div>
                </div>
                <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-colors">
                    <Icon name="Plus" size={14}/> Nuevo Producto
                </button>
            </div>

            {showForm && (
                <div className="bg-white border border-blue-200 rounded-[2rem] p-6 space-y-4 shadow-sm animate-in">
                    <h3 className="text-sm font-black uppercase text-blue-600 flex items-center gap-2"><Icon name="Package" size={16}/> Nuevo Producto</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2"><label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Nombre *</label><input placeholder="HARINA PAN 1KG" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value.toUpperCase()})} className="w-full p-3 bg-slate-50 rounded-xl font-bold outline-none focus:ring-2 ring-blue-500 border border-transparent transition-all uppercase"/></div>
                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Categoría</label><input placeholder="ALIMENTOS" value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value.toUpperCase()})} className="w-full p-3 bg-slate-50 rounded-xl font-bold outline-none focus:ring-2 ring-blue-500 border border-transparent transition-all uppercase"/></div>
                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Unidad</label>
                            <select value={form.unidad} onChange={e=>setForm({...form,unidad:e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl font-bold outline-none cursor-pointer">
                                <option value="unidades">Unidades</option><option value="kg">Kilogramos</option><option value="litros">Litros</option><option value="cajas">Cajas</option>
                            </select>
                        </div>
                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Costo ($)</label><input type="number" placeholder="0.00" value={form.costo} onChange={e=>setForm({...form,costo:e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl font-bold outline-none focus:ring-2 ring-blue-500 border border-transparent transition-all"/></div>
                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Precio Venta ($)</label><input type="number" placeholder="0.00" value={form.precio_venta} onChange={e=>setForm({...form,precio_venta:e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl font-bold outline-none focus:ring-2 ring-blue-500 border border-transparent transition-all"/></div>
                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Stock Inicial</label><input type="number" placeholder="0" value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl font-bold outline-none focus:ring-2 ring-blue-500 border border-transparent transition-all"/></div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                            {saving ? <><Icon name="Loader" size={14} className="animate-spin"/>Guardando...</> : <><Icon name="Save" size={14}/>Guardar Producto</>}
                        </button>
                        <button onClick={()=>setShowForm(false)} className="px-5 py-3 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-sm hover:bg-slate-200 transition-colors">Cancelar</button>
                    </div>
                </div>
            )}

            <div className="relative">
                <Icon name="Search" size={16} className="absolute left-4 top-3.5 text-slate-400"/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre o código..." className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 transition-colors"/>
            </div>

            {loading ? <div className="flex justify-center py-10"><Icon name="Loader" size={24} className="animate-spin text-slate-400"/></div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(p => (
                        <div key={p.id} className="bg-white border border-slate-100 rounded-[1.5rem] p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-sm uppercase text-slate-900 truncate">{p.nombre}</p>
                                    <p className="text-[10px] font-black text-blue-500 uppercase mt-0.5">{p.codigo_producto}</p>
                                </div>
                                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ml-2 flex-shrink-0 ${p.stock > 5 ? 'bg-emerald-100 text-emerald-600' : p.stock > 0 ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
                                    {p.stock > 5 ? 'En Stock' : p.stock > 0 ? 'Bajo Stock' : 'Agotado'}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-3">
                                <div className="bg-slate-50 rounded-lg p-2 text-center"><p className="text-[9px] font-black text-slate-400 uppercase">Stock</p><p className="font-black text-slate-900 text-sm">{p.stock}</p></div>
                                <div className="bg-slate-50 rounded-lg p-2 text-center"><p className="text-[9px] font-black text-slate-400 uppercase">Costo</p><p className="font-black text-blue-600 text-sm">${p.costo}</p></div>
                                <div className="bg-emerald-50 rounded-lg p-2 text-center"><p className="text-[9px] font-black text-emerald-500 uppercase">Precio</p><p className="font-black text-emerald-600 text-sm">${p.precio_venta}</p></div>
                            </div>
                            <div className="flex items-center justify-between">
                                <p className="text-[9px] font-black text-slate-300 font-mono">{p.codigo_qr}</p>
                                <div className="flex gap-2">
                                    <button onClick={()=>handleToggle(p)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><Icon name="Power" size={14}/></button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {filtered.length===0 && <div className="col-span-full py-12 text-center text-slate-400 font-bold uppercase text-xs">No hay productos registrados</div>}
                </div>
            )}
        </div>
    );
};

// ==========================================
// LABEL GENERATOR — Etiquetas QR para impresión
// ==========================================
const LabelGenerator = ({ onBack, currentUser }) => {
    const rif = currentUser?.rif || RIF_DEFAULT;
    const empresa = currentUser?.nombre_empresa || currentUser?.nombre || NOMBRE_EMPRESA_DEFAULT;
    const [products, setProducts] = useState([]);
    const [selected, setSelected] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [copies, setCopies] = useState(1);

    useEffect(() => {
        sbFetch(`products?rif_empresa=eq.${encodeURIComponent(rif)}&activo=eq.true&order=nombre.asc`)
            .then(d => { setProducts(d||[]); setLoading(false); }).catch(()=>setLoading(false));
    }, []);

    const toggleSelect = (id) => setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s, id]);
    const selAll = () => setSelected(products.map(p=>p.id));

    const generateQRDataURL = (text) => {
        // QR simple usando API pública
        return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(text)}`;
    };

    const printLabels = () => {
        const prods = products.filter(p => selected.includes(p.id));
        if (!prods.length) return alert('Selecciona al menos un producto');
        const win = window.open('', '_blank');
        const labelsHTML = prods.flatMap(p => Array(copies).fill(p)).map(p => `
            <div class="label">
                <div class="header">LegalYa</div>
                <div class="name">${p.nombre}</div>
                <img class="qr" src="${generateQRDataURL(p.codigo_qr)}" alt="QR"/>
                <div class="code">${p.codigo_producto}</div>
                <div class="price">$${parseFloat(p.precio_venta).toFixed(2)}</div>
            </div>
        `).join('');
        win.document.write(`<!DOCTYPE html><html><head><style>
            *{margin:0;padding:0;box-sizing:border-box;}
            body{font-family:Arial,sans-serif;background:#fff;}
            .grid{display:flex;flex-wrap:wrap;gap:8px;padding:16px;}
            .label{width:160px;border:1.5px solid #000;border-radius:6px;padding:8px;text-align:center;page-break-inside:avoid;}
            .header{font-size:8px;font-weight:900;color:#2563eb;text-transform:uppercase;letter-spacing:2px;margin-bottom:3px;}
            .name{font-size:9px;font-weight:900;text-transform:uppercase;margin-bottom:5px;min-height:22px;display:flex;align-items:center;justify-content:center;}
            .qr{width:90px;height:90px;margin:4px auto;display:block;}
            .code{font-size:8px;color:#666;font-family:monospace;margin-top:3px;}
            .price{font-size:14px;font-weight:900;color:#059669;margin-top:3px;}
            @media print{@page{margin:5mm;}.grid{padding:0;}}
        </style></head><body><div class="grid">${labelsHTML}</div>
        <script>window.onload=()=>{setTimeout(()=>{window.print();window.close();},1200);}<\/script></body></html>`);
        win.document.close();
    };

    const filtered = products.filter(p => p.nombre?.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="animate-in space-y-5 pb-20">
            <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl"><Icon name="ArrowLeft" size={18}/></button>
                    <div><h2 className="font-black uppercase italic tracking-tight text-xl">Etiquetas QR</h2><p className="text-[10px] font-bold text-slate-400 uppercase">{selected.length} seleccionados</p></div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-black text-slate-500 uppercase">Copias:</span>
                        <input type="number" min="1" max="10" value={copies} onChange={e=>setCopies(parseInt(e.target.value)||1)} className="w-10 bg-transparent font-black text-center outline-none text-sm"/>
                    </div>
                    <button onClick={selAll} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase transition-colors">Selec. Todos</button>
                    <button onClick={printLabels} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-colors">
                        <Icon name="Printer" size={14}/> Imprimir
                    </button>
                </div>
            </div>

            <div className="relative">
                <Icon name="Search" size={16} className="absolute left-4 top-3.5 text-slate-400"/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar producto..." className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 transition-colors"/>
            </div>

            {loading ? <div className="flex justify-center py-10"><Icon name="Loader" size={24} className="animate-spin text-slate-400"/></div> : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filtered.map(p => (
                        <div key={p.id} onClick={()=>toggleSelect(p.id)}
                            className={`cursor-pointer border-2 rounded-[1.5rem] p-4 text-center transition-all ${selected.includes(p.id) ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-100' : 'border-slate-100 bg-white hover:border-slate-300'}`}>
                            <div className={`w-5 h-5 rounded-full border-2 mx-auto mb-3 flex items-center justify-center transition-colors ${selected.includes(p.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                                {selected.includes(p.id) && <Icon name="Check" size={12} className="text-white"/>}
                            </div>
                            <img src={generateQRDataURL(p.codigo_qr || p.codigo_producto)} alt="QR" className="w-20 h-20 mx-auto mb-2 rounded-lg"/>
                            <p className="font-black text-[10px] uppercase text-slate-900 leading-tight mb-1">{p.nombre}</p>
                            <p className="text-[9px] font-mono text-blue-500">{p.codigo_producto}</p>
                            <p className="font-black text-emerald-600 text-sm mt-1">${parseFloat(p.precio_venta||0).toFixed(2)}</p>
                        </div>
                    ))}
                    {filtered.length===0 && <div className="col-span-full py-12 text-center text-slate-400 font-bold uppercase text-xs">Sin productos. Agrégalos en Gestión de Productos.</div>}
                </div>
            )}
        </div>
    );
};

// ==========================================
// QR SCANNER — escáner de cámara
// ==========================================
const QRScanner = ({ onDetected, onClose }) => {
    const videoRef = React.useRef(null);
    const [error, setError] = useState('');
    const [scanning, setScanning] = useState(false);
    const streamRef = React.useRef(null);
    const intervalRef = React.useRef(null);

    const startCamera = async () => {
        setError('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
            setScanning(true);
            // Usar BarcodeDetector si está disponible
            if ('BarcodeDetector' in window) {
                const detector = new BarcodeDetector({ formats: ['qr_code','ean_13','ean_8','code_128','code_39','upc_a','upc_e'] });
                intervalRef.current = setInterval(async () => {
                    if (videoRef.current && videoRef.current.readyState === 4) {
                        try {
                            const barcodes = await detector.detect(videoRef.current);
                            if (barcodes.length > 0) {
                                stopCamera();
                                onDetected(barcodes[0].rawValue);
                            }
                        } catch(e) {}
                    }
                }, 300);
            } else {
                setError('Tu navegador no soporta escáner nativo. Ingresa el código manualmente.');
            }
        } catch(e) {
            setError('No se pudo acceder a la cámara. Verifica los permisos.');
        }
    };

    const stopCamera = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop());
        setScanning(false);
    };

    useEffect(() => { startCamera(); return () => stopCamera(); }, []);

    const [manualCode, setManualCode] = useState('');

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-[2rem] w-full max-w-sm overflow-hidden border border-slate-700 shadow-2xl">
                <div className="flex justify-between items-center p-5 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <Icon name="ScanLine" size={18} className="text-blue-400"/>
                        <h3 className="font-black uppercase text-white text-sm">Escanear Producto</h3>
                    </div>
                    <button onClick={()=>{stopCamera();onClose();}} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"><Icon name="X" size={16}/></button>
                </div>
                <div className="relative bg-black aspect-square">
                    <video ref={videoRef} className="w-full h-full object-cover" playsInline muted/>
                    {scanning && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-48 h-48 border-2 border-blue-400 rounded-2xl relative">
                                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-lg"></div>
                                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-lg"></div>
                                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-lg"></div>
                                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-lg"></div>
                                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-blue-400/60 animate-pulse"></div>
                            </div>
                        </div>
                    )}
                    {error && <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6"><p className="text-rose-400 text-xs font-bold text-center">{error}</p></div>}
                </div>
                <div className="p-5 space-y-3">
                    <p className="text-[10px] font-black text-slate-500 uppercase text-center">O ingresa el código manualmente</p>
                    <div className="flex gap-2">
                        <input value={manualCode} onChange={e=>setManualCode(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&manualCode&&(stopCamera(),onDetected(manualCode))}
                            placeholder="LEGALYA-PROD-00001" className="flex-1 px-3 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-xl text-xs font-bold outline-none focus:border-blue-500 transition-colors"/>
                        <button onClick={()=>{if(manualCode){stopCamera();onDetected(manualCode);}}} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase transition-colors">
                            OK
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// DEVICE MANAGER — dispositivos vinculados
// ==========================================
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
                    {view==='purchase' && <ReceptionModule onBack={()=>setView('dashboard')}/>}
                    {view==='debts' && <DebtModule onBack={()=>setView('dashboard')}/>}
                    {view==='expenses' && <ExpensesModule onBack={()=>setView('dashboard')}/>}
                    {view==='contacts' && <ContactModule onBack={()=>setView('dashboard')}/>}
                    {view==='inventory' && <InventoryModule onBack={()=>setView('dashboard')}/>}
                    {view==='close' && <CashCloseModule onBack={()=>setView('dashboard')}/>}
                    {view==='products' && <ProductManager onBack={()=>setView('dashboard')} currentUser={currentUser}/>}
                    {view==='labels' && <LabelGenerator onBack={()=>setView('dashboard')} currentUser={currentUser}/>}
                    {view==='devices' && <DeviceManager onBack={()=>setView('dashboard')} currentUser={currentUser}/>}
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
const RootApp = () => {
    const [currentUser, setCurrentUser] = useState(() => {
        try { const u = localStorage.getItem('legaly_user'); return u ? JSON.parse(u) : null; } catch { return null; }
    });

    const handleLogin = (user) => { setCurrentUser(user); };
    const handleLogout = () => {
        localStorage.removeItem('legaly_user');
        localStorage.setItem('legaly_init','false');
        localStorage.setItem('legaly_locked','false');
        setCurrentUser(null);
    };

    if (!currentUser) return <AuthScreen onLogin={handleLogin}/>;

    if (currentUser.rol === 'AUDITOR') {
        return <AuditorPanel currentUser={currentUser} onLogout={handleLogout}/>;
    }

    return (
        <AppProvider currentUser={currentUser}>
            <ComerciosApp currentUser={currentUser} onLogout={handleLogout}/>
        </AppProvider>
    );
};

const rootElement = document.getElementById('root');
if (rootElement) ReactDOM.createRoot(rootElement).render(<RootApp/>);