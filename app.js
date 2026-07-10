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

// ==========================================
// LOGIN + REGISTRO (DESDE SUPABASE)
// ==========================================
const AuthScreen = ({ onLogin }) => {
    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [form, setForm] = useState({ usuario: '', clave: '', nombre: '', rol: 'CLIENTE', nombre_empresa: '', rif: '', color_tema: 'blue', clave_admin: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const CLAVE_REGISTRO = 'legalya2024';

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            const data = await sbFetch(
                `usuarios?nombre=eq.${encodeURIComponent(form.usuario)}&password_hash=eq.${encodeURIComponent(form.clave)}&activo=eq.true&select=*,empresa:empresa_id(*)`
            );
            if (!data || data.length === 0) { setError('Usuario o contraseña incorrectos.'); setLoading(false); return; }
            const u = data[0];
            const emp = u.empresa || {};
            const user = {
                id: u.id,
                nombre: u.nombre,
                email: u.email,
                rol: u.rol,
                rif: emp.rif || '',
                nombre_empresa: emp.razon_social || emp.nombre_comercial || '',
                color_tema: 'blue',
                empresa_id: u.empresa_id,
                empresa: emp,
            };
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
        if (form.rol === 'CLIENTE' && !form.rif) { setError('El RIF es obligatorio para cuentas de comercio.'); return; }
        setLoading(true);
        try {
            const existe = await sbFetch(`usuarios?nombre=eq.${encodeURIComponent(form.usuario)}&select=id`);
            if (existe && existe.length > 0) { setError('Este nombre de usuario ya está en uso.'); setLoading(false); return; }

            let empresaId;
            if (form.rol === 'CLIENTE') {
                const empCreada = await sbFetch('empresas_ly', {
                    method: 'POST',
                    body: JSON.stringify({
                        rif: form.rif.toUpperCase().trim(),
                        razon_social: form.nombre_empresa.toUpperCase().trim() || form.nombre.toUpperCase().trim(),
                        nombre_comercial: form.nombre_empresa.toUpperCase().trim() || form.nombre.toUpperCase().trim(),
                        actividad_economica: 'Comercio',
                        estado: 'activa',
                        plan: 'basico',
                        cantidad_usuarios: 1,
                    })
                });
                empresaId = empCreada[0]?.id;
            } else {
                const legalya = await sbFetch(`empresas_ly?rif=eq.V305803231&select=id`);
                empresaId = legalya[0]?.id;
            }

            if (!empresaId) throw new Error('No se pudo determinar la empresa');

            await sbFetch('usuarios', {
                method: 'POST',
                prefer: 'return=minimal',
                body: JSON.stringify({
                    empresa_id: empresaId,
                    nombre: form.usuario.toLowerCase().trim(),
                    email: (form.usuario.toLowerCase().trim() + '@legalya.com'),
                    password_hash: form.clave,
                    rol: form.rol,
                    activo: true
                })
            });
            setSuccess(`¡Usuario "${form.usuario}" creado con éxito! Ya puede iniciar sesión.`);
            setForm({ usuario: '', clave: '', nombre: '', rol: 'CLIENTE', nombre_empresa: '', rif: '', color_tema: 'blue', clave_admin: '' });
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
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-blue-500/30">
                        <Icon name="Shield" size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-white uppercase tracking-tight">LegalYa</h1>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">Sistema Contable Inteligente</p>
                </div>

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
                            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
                                <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2 block">🔑 Clave de Registro (requerida)</label>
                                <input type="password" placeholder="Clave proporcionada por el admin" value={form.clave_admin} onChange={e => setForm({...form, clave_admin: e.target.value})}
                                    className="w-full px-4 py-2.5 bg-slate-800 border border-amber-500/30 text-white rounded-lg font-bold text-sm outline-none focus:border-amber-500 transition-colors" />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Tipo de Cuenta</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[{ val: 'CLIENTE', icon: 'Store', label: 'Comercio' }, { val: 'AUDITOR', icon: 'ShieldCheck', label: 'Auditor' }].map(r => (
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

                            {form.rol === 'CLIENTE' && (
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
            if (!stockMap[name]) stockMap[name] = { name, totalEntradas: 0, totalSalidas: 0, unit: row.unidad || 'unidades', cost: 0, sellPrice: parseFloat(row.precio_venta) || 0, codigo_barra: row.codigo_barra || '' };
            const debe = parseFloat(row.debe_usd) || 0, haber = parseFloat(row.haber_usd) || 0, precio = parseFloat(row.precio_venta) || 0;
            if (row.codigo_barra) stockMap[name].codigo_barra = row.codigo_barra;
            if (debe > 0) { stockMap[name].totalEntradas += qty; stockMap[name].cost = qty > 0 ? debe/qty : 0; }
            if (haber > 0) stockMap[name].totalSalidas += qty;
            if (precio > 0) stockMap[name].sellPrice = precio;
        });
        return Object.values(stockMap).map(p => ({ ...p, id: `p-${p.name}`, stock: p.totalEntradas - p.totalSalidas }));
    };

    useEffect(() => { if (journal.length > 0) setInventory(updateInventory(journal)); }, [journal]);
    // Auto-sincronizar al refrescar si la jornada ya estaba iniciada
    useEffect(() => {
        if (!isInit || !currentUser) return;
        const rif = currentUser?.rif || RIF_DEFAULT;
        Promise.all([
            sbFetch(`journal?rif=eq.${encodeURIComponent(rif)}&order=id.asc&limit=5000`),
            sbFetch(`contacts?rif_empresa=eq.${encodeURIComponent(rif)}&order=name.asc`)
        ]).then(([movs, conts]) => {
            const movsData = movs || [], contsData = conts || [];
            setJournal(movsData);
            setContacts(contsData);
            setInventory(updateInventory(movsData));
        }).catch(e => console.error('Auto-sync error:', e));
    }, []); // solo al montar

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
            codigo_barra: String(row.codigo_barra || ''),
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
        return (
            <AuditorProvider currentUser={currentUser}>
                <AuditorRouter onLogout={handleLogout} />
            </AuditorProvider>
        );
    }

    return (
        <AppProvider currentUser={currentUser}>
            <ComerciosApp currentUser={currentUser} onLogout={handleLogout}/>
        </AppProvider>
    );
};

// ==========================================
// EXPONER GLOBALS EN window
// Necesario porque cada <script type="text/babel"> tiene scope aislado.
// ==========================================
window.sbFetch                = sbFetch;
window.CTA                    = CTA;
window.RIF_DEFAULT            = RIF_DEFAULT;
window.NOMBRE_EMPRESA_DEFAULT = NOMBRE_EMPRESA_DEFAULT;
window.AppContext              = AppContext;
window.Icon                   = Icon;
window.Spinner                = Spinner;
window.MenuButton             = MenuButton;
window.StatCard               = StatCard;
window.InputField             = InputField;
window.ResultRow              = ResultRow;
window.RootApp                = RootApp;
// Módulos nuevos — se exponen desde sus propios archivos
// AccountingModule → window.AccountingModule (en AccountingModule.js)
// HRModule         → window.HRModule         (en HRModule.js)

// El render lo hace index.html después de cargar todos los módulos.