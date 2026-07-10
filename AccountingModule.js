// ==========================================================
// ACCOUNTING MODULE — LegalYa Comercios
// Plan de Cuentas · Mi ICC · Servicios Profesionales ·
// Conciliaciones Bancarias · Declaraciones
// ==========================================================

// ─── Utilities ───
const $fmt = (n, d = 2) => (n || 0).toLocaleString('es-VE', { minimumFractionDigits: d, maximumFractionDigits: d });
const $fecha = (s) => s ? new Date(s).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const $fechaHora = (s) => s ? new Date(s).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const ESTADOS_SP = ['pendiente', 'aceptada', 'esperando_info', 'en_proceso', 'en_revision', 'finalizada', 'entregada', 'cancelada'];
const ESTADOS_SP_LABEL = { pendiente: 'Pendiente', aceptada: 'Aceptada', esperando_info: 'Esperando Info', en_proceso: 'En Proceso', en_revision: 'En Revisión', finalizada: 'Finalizada', entregada: 'Entregada', cancelada: 'Cancelada' };
const ESTADOS_SP_COLOR = { pendiente: 'text-amber-400 bg-amber-500/10 border-amber-500/20', aceptada: 'text-blue-400 bg-blue-500/10 border-blue-500/20', esperando_info: 'text-orange-400 bg-orange-500/10 border-orange-500/20', en_proceso: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20', en_revision: 'text-violet-400 bg-violet-500/10 border-violet-500/20', finalizada: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', entregada: 'text-slate-400 bg-slate-500/10 border-slate-500/20', cancelada: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };

const PRIORIDAD = { baja: 'text-slate-400', normal: 'text-blue-400', alta: 'text-amber-400', urgente: 'text-rose-400' };

const Badge = ({ children, color }) => (
    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${color || 'text-slate-500 bg-slate-500/10 border-slate-500/20'}`}>{children}</span>
);

const KodigoBadge = ({ codigo }) => (
    <span className="font-mono text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-md">{codigo}</span>
);

// ─── Cálculo de ICC ───
const actualizarICC = async (userRif) => {
    if (!userRif) return null;
    try {
        const [concs, servicios] = await Promise.all([
            sbFetch(`conciliaciones?empresa_rif=eq.${encodeURIComponent(userRif)}&select=estado`),
            sbFetch(`servicios_profesionales?empresa_rif=eq.${encodeURIComponent(userRif)}&select=requerimientos`),
        ]);
        const vencidos = (concs || []).filter(c => c.estado === 'vencido').length;
        const reqsPend = (servicios || []).reduce((sum, s) =>
            sum + (s.requerimientos || []).filter(r => r.estado === 'pendiente').length, 0
        );
        const icc = Math.max(0, Math.min(100, 100 - vencidos * 15 - reqsPend * 5));
        await sbFetch(`empresas_ly?rif=eq.${encodeURIComponent(userRif)}`, {
            method: 'PATCH', prefer: 'return=minimal',
            body: JSON.stringify({ icc_actual: icc }),
        });
        return icc;
    } catch (_) { return null; }
};

// ─── Plan de Cuentas (desde DB cuentas_contables + CRUD) ───
const PlanDeCuentasView = ({ journal, chart, userRif }) => {
    const [cuentas, setCuentas] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [filterTipo, setFilterTipo] = React.useState('');
    const [expanded, setExpanded] = React.useState({});
    const [showModal, setShowModal] = React.useState(null); // null | {type:'nueva'} | {type:'auxiliar', grupo, tipo} | {type:'sub', parent}
    const [editing, setEditing] = React.useState({});

    const TIPO_ORDER = ['Activo', 'Pasivo', 'Patrimonio', 'Ingreso', 'Costo', 'Gasto'];
    const TIPO_LABELS = { Activo: '1 — ACTIVOS', Pasivo: '2 — PASIVOS', Patrimonio: '3 — PATRIMONIO', Ingreso: '4 — INGRESOS', Costo: '5 — COSTOS', Gasto: '6 — GASTOS / EGRESOS' };
    const TIPO_COLORS = { Activo: 'text-emerald-400', Pasivo: 'text-amber-400', Patrimonio: 'text-violet-400', Ingreso: 'text-cyan-400', Costo: 'text-orange-400', Gasto: 'text-rose-400' };
    const TIPO_ESPECIFICO = {
        Activo: ['', 'Banco', 'Efectivo', 'Clientes', 'Inventario', 'Edificio', 'Vehículo', 'Mobiliario', 'Equipo', 'Terreno', 'Otros'],
        Pasivo: ['', 'Proveedores', 'Préstamos', 'Impuestos', 'Ctas por Pagar', 'Beneficios Sociales', 'Otros'],
        Ingreso: ['', 'Ventas', 'Servicios', 'Financieros', 'Otros'],
        Costo: ['', 'Costo Venta', 'Mano de Obra', 'Materiales', 'Otros'],
        Gasto: ['', 'Sueldos', 'Alquiler', 'Servicios', 'Publicidad', 'Transporte', 'Reparaciones', 'Seguros', 'Bancarios', 'Oficina', 'Otros'],
        Patrimonio: ['', 'Capital', 'Reservas', 'Resultados', 'Otros'],
    };

    const inferirTipo = (codigo) =>
        codigo.startsWith('1') ? 'Activo' : codigo.startsWith('2') ? 'Pasivo' : codigo.startsWith('3') ? 'Patrimonio' : codigo.startsWith('4') ? 'Ingreso' : codigo.startsWith('5') ? 'Costo' : 'Gasto';

    const cargarCuentas = React.useCallback(async () => {
        if (!userRif) { setLoading(false); return; }
        try {
            const data = await sbFetch(`cuentas_contables?rif_empresa=eq.${encodeURIComponent(userRif)}&order=codigo.asc`);
            if (data && data.length > 0) {
                setCuentas(data);
                setLoading(false);
                return;
            }
            // Seed desde CHART_OF_ACCOUNTS si la empresa no tiene cuentas
            const chartData = window.CHART_OF_ACCOUNTS || {};
            const entries = Object.entries(chartData);
            for (const [codigo, c] of entries) {
                try {
                    await sbFetch('cuentas_contables', {
                        method: 'POST', prefer: 'return=minimal',
                        body: JSON.stringify({
                            codigo, nombre: c.nombre, tipo: inferirTipo(codigo),
                            grupo: c.grupo || '', naturaleza: c.naturaleza || 'Deudora',
                            rif_empresa: userRif,
                        }),
                    });
                } catch (_) {}
            }
            const seeded = await sbFetch(`cuentas_contables?rif_empresa=eq.${encodeURIComponent(userRif)}&order=codigo.asc`);
            setCuentas(seeded || []);
        } catch (_) {}
        setLoading(false);
    }, [userRif]);

    React.useEffect(() => { cargarCuentas(); }, [cargarCuentas]);

    const guardarCampo = async (codigo, field, value) => {
        try {
            await sbFetch(`cuentas_contables?codigo=eq.${encodeURIComponent(codigo)}&rif_empresa=eq.${encodeURIComponent(userRif)}`, {
                method: 'PATCH', prefer: 'return=minimal',
                body: JSON.stringify({ [field]: value }),
            });
            setCuentas(prev => prev.map(c => c.codigo === codigo ? { ...c, [field]: value } : c));
        } catch (e) { alert('Error al guardar: ' + e.message); }
    };

    const grupos = React.useMemo(() => {
        const map = {};
        TIPO_ORDER.forEach(t => map[t] = []);
        cuentas.forEach(c => {
            const t = c.tipo || inferirTipo(c.codigo);
            if (map[t]) map[t].push(c);
        });
        return map;
    }, [cuentas]);

    const byGrupo = (items) => {
        const m = {};
        items.forEach(i => { (m[i.grupo || 'Sin Grupo'] = m[i.grupo || 'Sin Grupo'] || []).push(i); });
        return m;
    };

    const natBadge = (nat) => nat === 'Deudora' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

    const startEdit = (codigo, field, currentValue) => {
        setEditing(p => ({ ...p, [codigo]: { field, value: currentValue } }));
    };

    const commitEdit = (codigo) => {
        const e = editing[codigo];
        if (!e) return;
        guardarCampo(codigo, e.field, e.value);
        setEditing(p => { const n = { ...p }; delete n[codigo]; return n; });
    };

    const sugerirCodigo = (items) => {
        const codes = items.map(c => c.codigo);
        const sufijos = codes.map(c => {
            const parts = c.split('.').pop();
            return parseInt(parts, 10);
        }).filter(n => !isNaN(n));
        const max = sufijos.length > 0 ? Math.max(...sufijos) : 0;
        const prefix = items.length > 0 ? items[0].codigo.split('.').slice(0, -1).join('.') : '0';
        return prefix + '.' + (max + 1).toString().padStart(2, '0');
    };

    if (loading) return <div className="h-32 bg-slate-800/50 rounded-2xl animate-pulse" />;

    return (
        <div className="space-y-4">
            {/* Header + filtros */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex gap-2 flex-wrap">
                    {['', ...TIPO_ORDER].map(t => (
                        <button key={t || 'todos'} onClick={() => setFilterTipo(t)}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${!filterTipo && !t ? 'bg-blue-600 text-white' : filterTipo === t ? 'bg-slate-700 text-white border border-slate-500' : 'bg-slate-800/50 text-slate-500 hover:text-white border border-slate-700'}`}>
                            {t || 'Todos'}
                        </button>
                    ))}
                </div>
                <button onClick={() => setShowModal({ type: 'nueva' })}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase transition-all flex-shrink-0">
                    <Icon name="Plus" size={14} /> Nueva Cuenta
                </button>
            </div>

            {TIPO_ORDER.filter(t => !filterTipo || filterTipo === t).map(tipo => {
                const items = grupos[tipo] || [];
                if (!items.length) return null;
                const subgrupos = byGrupo(items);
                const isOpen = expanded[tipo] !== false;
                return (
                    <div key={tipo} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
                        <button onClick={() => setExpanded(p => ({ ...p, [tipo]: !isOpen }))}
                            className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-800 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className={`text-sm font-black uppercase tracking-widest ${TIPO_COLORS[tipo]}`}>{TIPO_LABELS[tipo]}</span>
                                <span className="bg-slate-700 text-slate-400 text-[10px] font-black px-2 py-0.5 rounded-full">{items.length}</span>
                            </div>
                            <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-slate-500" />
                        </button>
                        {isOpen && (
                            <div className="border-t border-slate-700/50">
                                {Object.entries(subgrupos).map(([grupo, cuentasG]) => (
                                    <div key={grupo}>
                                        <div className="flex items-center justify-between px-6 py-2 bg-slate-900/40">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{grupo}</span>
                                            <button onClick={() => setShowModal({ type: 'auxiliar', grupo, tipo })}
                                                className="text-[9px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-wider flex items-center gap-1 transition-colors">
                                                <Icon name="Plus" size={10} /> Auxiliar
                                            </button>
                                        </div>
                                        <table className="w-full text-xs">
                                            <tbody>
                                                {cuentasG.map(c => {
                                                    const edit = editing[c.codigo];
                                                    return (
                                                        <tr key={c.codigo} className="border-t border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                                                            <td className="px-6 py-3 font-mono text-slate-400 w-28">{c.codigo}</td>
                                                            <td className="py-3 text-white font-bold">
                                                                {edit && edit.field === 'nombre' ? (
                                                                    <input value={edit.value}
                                                                        onChange={e => setEditing(p => ({ ...p, [c.codigo]: { ...p[c.codigo], value: e.target.value } }))}
                                                                        onBlur={() => commitEdit(c.codigo)}
                                                                        onKeyDown={e => e.key === 'Enter' && commitEdit(c.codigo)}
                                                                        className="bg-slate-900 border border-slate-600 text-white rounded-lg px-2 py-1 text-xs font-bold w-full outline-none"
                                                                        autoFocus />
                                                                ) : (
                                                                    <button onClick={() => startEdit(c.codigo, 'nombre', c.nombre)}
                                                                        className="hover:text-blue-400 transition-colors text-left">{c.nombre}</button>
                                                                )}
                                                            </td>
                                                            <td className="py-3 hidden md:table-cell">
                                                                {edit && edit.field === 'tipo_especifico' ? (
                                                                    <select value={edit.value || ''}
                                                                        onChange={e => setEditing(p => ({ ...p, [c.codigo]: { ...p[c.codigo], value: e.target.value } }))}
                                                                        onBlur={() => commitEdit(c.codigo)}
                                                                        className="bg-slate-900 border border-slate-600 text-white rounded-lg px-2 py-1 text-[10px] font-bold outline-none">
                                                                        {(TIPO_ESPECIFICO[c.tipo || inferirTipo(c.codigo)] || []).map(opt => <option key={opt} value={opt}>{opt || '—'}</option>)}
                                                                    </select>
                                                                ) : (
                                                                    <button onClick={() => startEdit(c.codigo, 'tipo_especifico', c.tipo_especifico || '')}
                                                                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${c.tipo_especifico ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'text-slate-600 border-slate-700 hover:text-slate-400 hover:border-slate-500'}`}>
                                                                        {c.tipo_especifico || 'Clasificar'}
                                                                    </button>
                                                                )}
                                                            </td>
                                                            <td className="py-3 hidden lg:table-cell">
                                                                {edit && edit.field === 'grupo' ? (
                                                                    <input value={edit.value}
                                                                        onChange={e => setEditing(p => ({ ...p, [c.codigo]: { ...p[c.codigo], value: e.target.value } }))}
                                                                        onBlur={() => commitEdit(c.codigo)}
                                                                        onKeyDown={e => e.key === 'Enter' && commitEdit(c.codigo)}
                                                                        className="bg-slate-900 border border-slate-600 text-white rounded-lg px-2 py-1 text-[10px] font-bold w-32 outline-none"
                                                                        autoFocus />
                                                                ) : (
                                                                    <button onClick={() => startEdit(c.codigo, 'grupo', c.grupo || '')}
                                                                        className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors font-bold">{c.grupo || <span className="text-slate-700">—</span>}</button>
                                                                )}
                                                            </td>
                                                            <td className="py-3 pr-4 text-right hidden lg:table-cell">
                                                                {edit && edit.field === 'naturaleza' ? (
                                                                    <select value={edit.value}
                                                                        onChange={e => setEditing(p => ({ ...p, [c.codigo]: { ...p[c.codigo], value: e.target.value } }))}
                                                                        onBlur={() => commitEdit(c.codigo)}
                                                                        className="bg-slate-900 border border-slate-600 text-white rounded-lg px-2 py-1 text-[10px] font-bold outline-none">
                                                                        <option value="Deudora">Deudora</option>
                                                                        <option value="Acreedora">Acreedora</option>
                                                                    </select>
                                                                ) : (
                                                                    <button onClick={() => startEdit(c.codigo, 'naturaleza', c.naturaleza || 'Deudora')}
                                                                        className={`text-[10px] font-black px-2 py-0.5 rounded-full ${natBadge(c.naturaleza)}`}>{c.naturaleza}</button>
                                                                )}
                                                            </td>
                                                            <td className="py-3 pr-2 text-right w-10">
                                                                <button onClick={() => setShowModal({ type: 'sub', parent: c.codigo, tipo: c.tipo || inferirTipo(c.codigo) })}
                                                                    className="text-slate-600 hover:text-blue-400 transition-colors">
                                                                    <Icon name="Plus" size={12} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}

            {showModal && (
                <CrearCuentaModal
                    {...showModal}
                    cuentas={cuentas}
                    userRif={userRif}
                    onClose={() => setShowModal(null)}
                    onCreado={() => { setShowModal(null); cargarCuentas(); }}
                />
            )}
        </div>
    );
};

// ─── Modal Crear Cuenta Contable ───
const CrearCuentaModal = ({ type, grupo, tipo, parent, cuentas, userRif, onClose, onCreado }) => {
    const codigoSugerido = React.useMemo(() => {
        if (type === 'auxiliar' && grupo) {
            const items = cuentas.filter(c => (c.grupo || 'Sin Grupo') === grupo);
            const codes = items.map(c => c.codigo);
            const sufijos = codes.map(c => { const p = c.split('.').pop(); return parseInt(p, 10); }).filter(n => !isNaN(n));
            const max = sufijos.length > 0 ? Math.max(...sufijos) : 0;
            const prefix = codes.length > 0 ? codes[0].split('.').slice(0, -1).join('.') : '0';
            return prefix + '.' + (max + 1).toString().padStart(2, '0');
        }
        if (type === 'sub' && parent) {
            const hijos = cuentas.filter(c => c.codigo.startsWith(parent + '.'));
            const sufijos = hijos.map(c => { const p = c.codigo.slice(parent.length + 1).split('.')[0]; return parseInt(p, 10); }).filter(n => !isNaN(n));
            const max = sufijos.length > 0 ? Math.max(...sufijos) : 0;
            return parent + '.' + (max + 1).toString().padStart(2, '0');
        }
        return '';
    }, [type, grupo, parent, cuentas]);

    const tipoInferido = tipo || (codigoSugerido ? (codigoSugerido.startsWith('1') ? 'Activo' : codigoSugerido.startsWith('2') ? 'Pasivo' : codigoSugerido.startsWith('3') ? 'Patrimonio' : codigoSugerido.startsWith('4') ? 'Ingreso' : codigoSugerido.startsWith('5') ? 'Costo' : 'Gasto') : 'Activo');

    const [codigo, setCodigo] = React.useState(codigoSugerido);
    const [nombre, setNombre] = React.useState('');
    const [tipoSel, setTipoSel] = React.useState(tipoInferido);
    const [grupoSel, setGrupoSel] = React.useState(grupo || '');
    const [naturaleza, setNaturaleza] = React.useState('Deudora');
    const [saving, setSaving] = React.useState(false);

    const handleCrear = async () => {
        if (!codigo.trim() || !nombre.trim()) { alert('Código y nombre son obligatorios'); return; }
        setSaving(true);
        try {
            await sbFetch('cuentas_contables', {
                method: 'POST', prefer: 'return=minimal',
                body: JSON.stringify({
                    codigo: codigo.trim(),
                    nombre: nombre.trim(),
                    tipo: tipoSel,
                    grupo: grupoSel.trim(),
                    naturaleza,
                    rif_empresa: userRif,
                }),
            });
            onCreado();
        } catch (e) { alert('Error: ' + e.message); }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 animate-in" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-sm font-black text-white uppercase tracking-wide">
                        {type === 'auxiliar' ? 'Nueva Cuenta Auxiliar' : type === 'sub' ? 'Sub-Cuenta' : 'Nueva Cuenta'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl text-slate-500"><Icon name="X" size={16} /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Código</label>
                        <input value={codigo} onChange={e => setCodigo(e.target.value)}
                            placeholder="Ej: 1.1.04.01"
                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm font-mono font-bold outline-none focus:border-blue-500" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Nombre</label>
                        <input value={nombre} onChange={e => setNombre(e.target.value)}
                            placeholder="Ej: Inversiones Temporales"
                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Tipo</label>
                            <select value={tipoSel} onChange={e => setTipoSel(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500">
                                {['Activo', 'Pasivo', 'Patrimonio', 'Ingreso', 'Costo', 'Gasto'].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Naturaleza</label>
                            <select value={naturaleza} onChange={e => setNaturaleza(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500">
                                <option value="Deudora">Deudora</option>
                                <option value="Acreedora">Acreedora</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Grupo</label>
                        <input value={grupoSel} onChange={e => setGrupoSel(e.target.value)}
                            placeholder="Ej: Activo Corriente"
                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500" />
                    </div>
                    <button onClick={handleCrear} disabled={saving}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-black uppercase text-sm transition-all flex items-center justify-center gap-2">
                        {saving ? <><Icon name="Loader" size={14} className="animate-spin" /> Creando...</> : <><Icon name="Check" size={14} /> Crear Cuenta</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Mi ICC ───
const MiICCView = ({ icc, bie, userRif }) => {
    const [iccCalc, setIccCalc] = React.useState(icc);

    React.useEffect(() => {
        if (userRif) actualizarICC(userRif).then(nuevo => { if (nuevo !== null) setIccCalc(nuevo); });
    }, [userRif]);

    const valIcc = iccCalc;
    const recomendaciones = [];
    if (valIcc < 40) recomendaciones.push('Tu ICC es bajo. Registra todas las operaciones diariamente y evita omitir documentos.');
    if (valIcc < 60) recomendaciones.push('Mejora el control interno. Revisa los saldos de tus cuentas bancarias vs el libro mayor.');
    if (bie < 50) recomendaciones.push('Tu BIE requiere atención. Revisa los hallazgos críticos en el módulo de contabilidad.');
    if (bie >= 80) recomendaciones.push('Excelente desempeño. Sigue manteniendo tus registros al día.');
    if (recomendaciones.length === 0) recomendaciones.push('Tus indicadores están saludables. Sigue así.');

    const categoriaICC = valIcc >= 85 ? { label: 'Con fianza', color: 'text-emerald-400', bar: 'bg-emerald-500' } : valIcc >= 60 ? { label: 'Aceptable', color: 'text-blue-400', bar: 'bg-blue-500' } : valIcc >= 30 ? { label: 'Regular', color: 'text-amber-400', bar: 'bg-amber-500' } : { label: 'Bajo', color: 'text-rose-400', bar: 'bg-rose-500' };
    const categoriaBIE = bie >= 85 ? { label: 'Óptimo', color: 'text-emerald-400' } : bie >= 60 ? { label: 'Bueno', color: 'text-blue-400' } : bie >= 30 ? { label: 'Regular', color: 'text-amber-400' } : { label: 'Crítico', color: 'text-rose-400' };

    return (
        <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-white uppercase tracking-wide">ICC</h3>
                    <Badge color={categoriaICC.color + ' ' + categoriaICC.color.replace('text', 'bg').replace('-400', '-500/10') + ' border ' + categoriaICC.color.replace('text', 'border').replace('-400', '-500/20')}>{categoriaICC.label}</Badge>
                </div>
                <div className="relative h-4 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${categoriaICC.bar}`} style={{ width: `${Math.min(100, valIcc)}%` }} />
                </div>
                <p className="text-4xl font-black text-white">{valIcc}<span className="text-lg text-slate-500 ml-1">/100</span></p>
                <p className="text-xs text-slate-400 font-bold">Índice de Confiabilidad Contable</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-white uppercase tracking-wide">BIE</h3>
                    <Badge color={categoriaBIE.color + ' ' + categoriaBIE.color.replace('text', 'bg').replace('-400', '-500/10') + ' border ' + categoriaBIE.color.replace('text', 'border').replace('-400', '-500/20')}>{categoriaBIE.label}</Badge>
                </div>
                <div className="relative h-4 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${categoriaICC.bar}`} style={{ width: `${Math.min(100, bie)}%` }} />
                </div>
                <p className="text-4xl font-black text-white">{bie}<span className="text-lg text-slate-500 ml-1">/100</span></p>
                <p className="text-xs text-slate-400 font-bold">Business Intelligence Empresarial</p>
            </div>
            <div className="md:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Recomendaciones</h3>
                <div className="space-y-3">
                    {recomendaciones.map((r, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-slate-900/60 rounded-xl">
                            <Icon name="Lightbulb" size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs font-bold text-slate-300">{r}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ─── Conciliaciones Bancarias — Periodo único por mes anterior ───
const ConciliacionesView = ({ userRif }) => {
    const [cuentas, setCuentas] = React.useState([]);
    const [conciliaciones, setConciliaciones] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [subiendo, setSubiendo] = React.useState(null);
    const [iccMsg, setIccMsg] = React.useState('');

    const getTercerDiaHabil = (year, month) => {
        let count = 0, day = 1;
        while (count < 3) {
            const d = new Date(year, month, day);
            if (d.getDay() !== 0 && d.getDay() !== 6) count++;
            if (count < 3) day++;
        }
        return new Date(year, month, day);
    };

    const hoy = new Date();
    const periodoAnterior = (hoy.getFullYear()) + '-' + String(hoy.getMonth()).padStart(2, '0');
    const labelPeriodo = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
        .toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
    const fechaLimite = getTercerDiaHabil(hoy.getFullYear(), hoy.getMonth());

    const cargar = React.useCallback(async () => {
        if (!userRif) { setLoading(false); return; }
        try {
            const [ctas, concs] = await Promise.all([
                sbFetch(`cuentas_contables?rif_empresa=eq.${encodeURIComponent(userRif)}&order=codigo.asc`),
                sbFetch(`conciliaciones?empresa_rif=eq.${encodeURIComponent(userRif)}&order=periodo.desc`),
            ]);
            const bancarias = (ctas || []).filter(c => (c.tipo_especifico || '').toLowerCase() === 'banco');
            setCuentas(bancarias);
            setConciliaciones(concs || []);
            setLoading(false);

            // Background: limpiar periodos que no sean el mes anterior
            const aEliminar = (concs || []).filter(c => c.periodo !== periodoAnterior);
            if (aEliminar.length > 0) {
                const ids = aEliminar.map(c => c.id);
                await sbFetch(`conciliaciones?id=in.(${ids.map(id => `"${id}"`).join(',')})`, {
                    method: 'DELETE',
                }).catch(() => {});
            }

            // Background: crear periodo del mes anterior si no existe
            const existe = (concs || []).find(c => c.periodo === periodoAnterior);
            if (!existe) {
                for (const cuenta of bancarias) {
                    await sbFetch('conciliaciones', {
                        method: 'POST', prefer: 'return=minimal',
                        body: JSON.stringify({
                            empresa_rif: userRif, codigo_cuenta: cuenta.codigo,
                            nombre_cuenta: cuenta.nombre, periodo: periodoAnterior,
                            estado: 'pendiente',
                            fecha_limite: fechaLimite.toISOString().split('T')[0],
                        }),
                    }).catch(() => {});
                }
                const finales = await sbFetch(`conciliaciones?empresa_rif=eq.${encodeURIComponent(userRif)}&order=periodo.desc`);
                setConciliaciones(finales || []);
            }

            // Background: marcar vencidos si pasó la fecha límite
            const hoyNum = new Date();
            const updates = [];
            for (const c of (concs || [])) {
                if (c.periodo === periodoAnterior && c.estado === 'pendiente' && c.fecha_limite && hoyNum > new Date(c.fecha_limite + 'T23:59:59')) {
                    updates.push(
                        sbFetch(`conciliaciones?id=eq.${c.id}`, {
                            method: 'PATCH', prefer: 'return=minimal',
                            body: JSON.stringify({ estado: 'vencido' }),
                        }).catch(() => {})
                    );
                }
            }
            if (updates.length > 0) {
                await Promise.all(updates);
                const finales = await sbFetch(`conciliaciones?empresa_rif=eq.${encodeURIComponent(userRif)}&order=periodo.desc`);
                setConciliaciones(finales || []);
            }
        } catch (_) { setLoading(false); }
    }, [userRif, periodoAnterior, fechaLimite]);

    React.useEffect(() => { cargar(); }, [cargar]);

    const subirArchivo = async (concId, codigoCuenta, nombreCuenta) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,.xlsx,.xls,.csv,.jpg,.png';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            setSubiendo(concId);
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            try {
                if (concId) {
                    const r = conciliaciones.find(c => c.id === concId);
                    const archivos = [...(r?.archivos || []), { nombre: file.name, contenido: base64, fecha: new Date().toISOString(), tipo: file.type }];
                    await sbFetch(`conciliaciones?id=eq.${concId}`, {
                        method: 'PATCH', prefer: 'return=minimal',
                        body: JSON.stringify({ estado: 'entregado', archivos, fecha_entrega: new Date().toISOString().split('T')[0] }),
                    });
                } else {
                    await sbFetch('conciliaciones', {
                        method: 'POST', prefer: 'return=minimal',
                        body: JSON.stringify({
                            empresa_rif: userRif, codigo_cuenta: codigoCuenta, nombre_cuenta: nombreCuenta,
                            periodo: periodoAnterior, estado: 'entregado', fecha_entrega: new Date().toISOString().split('T')[0],
                            archivos: [{ nombre: file.name, contenido: base64, fecha: new Date().toISOString(), tipo: file.type }],
                        }),
                    });
                }
                await cargar();
                const nuevoIcc = await actualizarICC(userRif);
                if (nuevoIcc !== null) setIccMsg('ICC actualizado: ' + nuevoIcc + '/100');
                setTimeout(() => setIccMsg(''), 4000);
            } catch (err) { alert('Error: ' + err.message); }
            setSubiendo(null);
        };
        input.click();
    };

    const badgeEst = (est) => {
        const map = {
            conciliado: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
            en_conciliacion: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
            entregado: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
            vencido: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
        };
        return map[est] || 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    };
    const labelEst = (est) => {
        const map = { conciliado: 'Conciliado', en_conciliacion: 'En Conciliación', entregado: 'Entregado', vencido: 'Vencido' };
        return map[est] || 'Pendiente';
    };

    if (loading) return <div className="h-32 bg-slate-800/50 rounded-2xl animate-pulse" />;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs font-bold text-slate-500">{cuentas.length} cuenta(s) bancaria(s)</p>
                <p className="text-[9px] text-slate-600 font-bold">Sube el extracto de {labelPeriodo} antes del {$fecha(fechaLimite.toISOString())}</p>
            </div>
            {iccMsg && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2 text-[10px] font-bold text-emerald-400 animate-in">{iccMsg}</div>
            )}
            {cuentas.length === 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-10 text-center">
                    <Icon name="Landmark" size={40} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-sm font-black text-slate-400 uppercase">Sin cuentas bancarias</p>
                    <p className="text-xs text-slate-600 font-bold mt-1">Clasifica una cuenta como "Banco" en el Plan de Cuentas</p>
                </div>
            )}
            {cuentas.map(cuenta => {
                const conc = conciliaciones.find(c => c.codigo_cuenta === cuenta.codigo && c.periodo === periodoAnterior);
                const est = conc?.estado || 'pendiente';
                return (
                    <div key={cuenta.codigo} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-xs font-black text-white">{cuenta.nombre}</p>
                                <p className="text-[10px] font-mono text-slate-500">{cuenta.codigo}</p>
                            </div>
                            <Badge color={badgeEst(est)}>{labelEst(est)}</Badge>
                        </div>
                        <div className="flex items-center justify-between bg-slate-900/60 rounded-xl p-4">
                            <div>
                                <p className="text-xs font-bold text-white">{labelPeriodo}</p>
                                <p className="text-[10px] text-slate-500 font-bold mt-0.5">Límite: {conc?.fecha_limite ? $fecha(conc.fecha_limite) : $fecha(fechaLimite.toISOString())}</p>
                                {(est === 'entregado' || est === 'en_conciliacion' || est === 'conciliado') && (conc?.archivos || []).length > 0 && (
                                    <div className="flex gap-1 mt-2">
                                        {conc.archivos.map((a, i) => (
                                            <a key={i} href={a.contenido || a.url} download={a.nombre}
                                                className="text-[10px] text-blue-400 font-black underline">{a.nombre}</a>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                {(est === 'pendiente' || est === 'vencido') && (
                                    <button onClick={() => subirArchivo(conc?.id, cuenta.codigo, cuenta.nombre)}
                                        disabled={subiendo === conc?.id}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase transition-all">
                                        {subiendo === conc?.id ? <Icon name="Loader" size={14} className="animate-spin" /> : <Icon name="Upload" size={14} />}
                                        Subir Extracto
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ─── Declaraciones ───
const DeclaracionesView = ({ userRif }) => {
    const [declaraciones, setDeclaraciones] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [filtro, setFiltro] = React.useState('');

    React.useEffect(() => {
        if (!userRif) { setLoading(false); return; }
        sbFetch(`declaraciones?empresa_rif=eq.${encodeURIComponent(userRif)}&order=fecha_emision.desc`)
            .then(data => { setDeclaraciones(data || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [userRif]);

    const tipos = [...new Set(declaraciones.map(d => d.tipo))];
    const filtradas = filtro ? declaraciones.filter(d => d.tipo === filtro) : declaraciones;

    return (
        <div className="space-y-4">
            {tipos.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setFiltro('')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${!filtro ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}>
                        Todas
                    </button>
                    {tipos.map(t => (
                        <button key={t} onClick={() => setFiltro(t)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${filtro === t ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}>
                            {t}
                        </button>
                    ))}
                </div>
            )}
            {filtradas.length === 0 ? (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-10 text-center">
                    <Icon name="FileText" size={40} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-sm font-black text-slate-400 uppercase">Sin declaraciones</p>
                    <p className="text-xs text-slate-600 font-bold mt-1">Las declaraciones son emitidas por tu contador</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtradas.map(d => (
                        <div key={d.id} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-black text-white uppercase">{d.tipo}</span>
                                    <KodigoBadge codigo={d.periodo} />
                                    <Badge color={d.estado === 'emitida' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' : 'text-slate-400 bg-slate-500/10 border-slate-500/20'}>{d.estado}</Badge>
                                </div>
                                <span className="text-[10px] text-slate-500 font-bold">{$fecha(d.fecha_emision)}</span>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                                {(d.archivos || []).map((a, i) => (
                                                    <a key={i} href={a.contenido || a.url} download={a.nombre}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 rounded-xl text-[10px] font-bold text-blue-400 hover:bg-slate-700 transition-colors">
                                                        <Icon name="Download" size={12} /> {a.nombre}
                                                    </a>
                                                ))}
                                {(!d.archivos || d.archivos.length === 0) && (
                                    <span className="text-[10px] text-slate-600 font-bold">Sin archivos adjuntos</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Servicios Profesionales ───
const ServiciosListView = ({ userRif, onAbrir }) => {
    const [servicios, setServicios] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [filtro, setFiltro] = React.useState('');
    const [showCrear, setShowCrear] = React.useState(false);
    const [tipos, setTipos] = React.useState([]);

    const cargar = React.useCallback(() => {
        if (!userRif) { setLoading(false); return; }
        Promise.all([
            sbFetch(`servicios_profesionales?empresa_rif=eq.${encodeURIComponent(userRif)}&order=created_at.desc`),
            sbFetch('servicios_profesionales_tipos?activo=eq.true&order=nombre.asc'),
        ]).then(([s, t]) => { setServicios(s || []); setTipos(t || []); setLoading(false); });
    }, [userRif]);

    React.useEffect(() => { cargar(); }, [cargar]);

    const filtrados = filtro ? servicios.filter(s => s.estado === filtro) : servicios;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex gap-2 flex-wrap">
                    {['', ...ESTADOS_SP].map(e => (
                        <button key={e || 'todas'} onClick={() => setFiltro(e)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${!filtro && !e ? 'bg-blue-600 text-white' : filtro === e ? 'bg-slate-700 text-white border border-slate-500' : 'bg-slate-800/50 text-slate-500 hover:text-white border border-slate-700'}`}>
                            {e ? ESTADOS_SP_LABEL[e] : 'Todas'}
                        </button>
                    ))}
                </div>
                <button onClick={() => setShowCrear(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase transition-all flex-shrink-0">
                    <Icon name="Plus" size={14} /> Nueva Solicitud
                </button>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-800/50 rounded-2xl animate-pulse" />)}
                </div>
            ) : filtrados.length === 0 ? (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center">
                    <Icon name="Inbox" size={40} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-sm font-black text-slate-400 uppercase">Sin solicitudes</p>
                    <p className="text-xs text-slate-600 font-bold mt-1">Crea tu primera solicitud de servicio profesional</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filtrados.map(s => (
                        <button key={s.id} onClick={() => onAbrir(s)}
                            className="bg-slate-800/50 border border-slate-700/50 hover:border-blue-500/30 hover:bg-slate-800/80 rounded-2xl p-5 text-left transition-all group">
                            <div className="flex items-start justify-between gap-2 mb-3">
                                <div>
                                    <p className="text-xs font-black text-white uppercase truncate">{s.tipo}</p>
                                    <KodigoBadge codigo={s.codigo} />
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <Badge color={ESTADOS_SP_COLOR[s.estado] || ESTADOS_SP_COLOR.pendiente}>{ESTADOS_SP_LABEL[s.estado] || s.estado}</Badge>
                                </div>
                            </div>
                            {s.descripcion && <p className="text-[11px] text-slate-400 font-bold mb-3 line-clamp-2">{s.descripcion}</p>}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold">
                                    {s.fecha_estimada && <span>Est: {$fecha(s.fecha_estimada)}</span>}
                                    {s.prioridad && <span className={`${PRIORIDAD[s.prioridad] || 'text-slate-500'} uppercase`}>{s.prioridad}</span>}
                                </div>
                                <span className="text-blue-400 text-[10px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity">Abrir →</span>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {showCrear && <CrearServicioModal tipos={tipos} userRif={userRif} userNombre={''} onClose={() => setShowCrear(false)} onCreado={() => { setShowCrear(false); cargar(); }} />}
        </div>
    );
};

const CrearServicioModal = ({ tipos, userRif, userNombre, onClose, onCreado }) => {
    const [tipo, setTipo] = React.useState(tipos[0]?.nombre || '');
    const [descripcion, setDescripcion] = React.useState('');
    const [prioridad, setPrioridad] = React.useState('normal');
    const [saving, setSaving] = React.useState(false);

    const handleCrear = async () => {
        if (!tipo) { alert('Selecciona un tipo de servicio'); return; }
        if (!descripcion) { alert('Describe tu solicitud'); return; }
        setSaving(true);
        try {
            const ahora = new Date().toISOString();
            await sbFetch('servicios_profesionales', {
                method: 'POST', prefer: 'return=minimal',
                body: JSON.stringify({
                    tipo,
                    estado: 'pendiente',
                    prioridad,
                    empresa_rif: userRif,
                    descripcion,
                    timeline: [{ fecha: ahora, evento: 'Solicitud creada', usuario: userNombre || 'Cliente', observaciones: descripcion }],
                }),
            });
            onCreado();
        } catch (e) { alert('Error: ' + e.message); }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 animate-in" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-sm font-black text-white uppercase tracking-wide">Nueva Solicitud</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl text-slate-500"><Icon name="X" size={16} /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Tipo de Servicio</label>
                        <select value={tipo} onChange={e => setTipo(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500">
                            {tipos.map(t => <option key={t.id || t.nombre} value={t.nombre}>{t.nombre}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Prioridad</label>
                        <div className="flex gap-2">
                            {['baja', 'normal', 'alta', 'urgente'].map(p => (
                                <button key={p} onClick={() => setPrioridad(p)}
                                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide border transition-all ${prioridad === p ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}>
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Descripción</label>
                        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)}
                            placeholder="Describe el servicio que necesitas..."
                            rows={4}
                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 resize-none" />
                    </div>
                    <button onClick={handleCrear} disabled={saving}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-black uppercase text-sm transition-all flex items-center justify-center gap-2">
                        {saving ? <><Icon name="Loader" size={14} className="animate-spin" /> Creando...</> : <><Icon name="Send" size={14} /> Enviar Solicitud</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Detalle de Servicio Profesional ───
const ServicioDetalleView = ({ servicio, userRif, userNombre, userRol, onBack, onActualizar }) => {
    const [data, setData] = React.useState(servicio);
    const [tab, setTab] = React.useState('timeline');
    const [nuevoMsg, setNuevoMsg] = React.useState('');
    const [reqTitulo, setReqTitulo] = React.useState('');
    const [reqDesc, setReqDesc] = React.useState('');
    const [obsTexto, setObsTexto] = React.useState('');

    React.useEffect(() => { setData(servicio); }, [servicio]);

    const actualizar = async (nuevosCampos) => {
        try {
            await sbFetch(`servicios_profesionales?id=eq.${data.id}`, {
                method: 'PATCH', prefer: 'return=minimal',
                body: JSON.stringify(nuevosCampos),
            });
            const [updated] = await sbFetch(`servicios_profesionales?id=eq.${data.id}`);
            if (updated) setData(updated);
            if (onActualizar) onActualizar();
        } catch (e) { alert('Error: ' + e.message); }
    };

    const cambiarEstado = async (nuevoEstado) => {
        const timeline = [...(data.timeline || [])];
        timeline.push({ fecha: new Date().toISOString(), evento: 'Estado cambiado a ' + (ESTADOS_SP_LABEL[nuevoEstado] || nuevoEstado), usuario: userNombre || 'Cliente', observaciones: '' });
        await actualizar({ estado: nuevoEstado, timeline });
    };

    const enviarMensaje = async () => {
        if (!nuevoMsg.trim()) return;
        const mensajes = [...(data.mensajes || [])];
        mensajes.push({ fecha: new Date().toISOString(), remitente: userNombre || 'Cliente', texto: nuevoMsg.trim(), archivos: [] });
        const timeline = [...(data.timeline || [])];
        timeline.push({ fecha: new Date().toISOString(), evento: 'Mensaje enviado', usuario: userNombre || 'Cliente', observaciones: nuevoMsg.trim().substring(0, 100) });
        await actualizar({ mensajes, timeline });
        setNuevoMsg('');
    };

    const agregarRequerimiento = async () => {
        if (!reqTitulo.trim()) return;
        const reqs = [...(data.requerimientos || [])];
        const req = { id: Date.now().toString(), titulo: reqTitulo.trim(), descripcion: reqDesc.trim(), estado: 'pendiente', respuesta: '', archivos: [], fecha: new Date().toISOString() };
        reqs.push(req);
        const timeline = [...(data.timeline || [])];
        timeline.push({ fecha: new Date().toISOString(), evento: 'Información solicitada', usuario: userNombre || 'Cliente', observaciones: reqTitulo.trim() });
        await actualizar({ requerimientos: reqs, timeline });
        setReqTitulo(''); setReqDesc('');
    };

    const responderRequerimiento = async (reqId) => {
        const respuesta = prompt('Escribe tu respuesta:');
        if (!respuesta) return;
        const reqs = (data.requerimientos || []).map(r => r.id === reqId ? { ...r, estado: 'respondido', respuesta } : r);
        const timeline = [...(data.timeline || [])];
        timeline.push({ fecha: new Date().toISOString(), evento: 'Requerimiento respondido', usuario: userNombre || 'Cliente', observaciones: respuesta.substring(0, 100) });
        await actualizar({ requerimientos: reqs, timeline });
    };

    const agregarObservacion = async () => {
        if (!obsTexto.trim()) return;
        const obs = [...(data.observaciones || [])];
        obs.push({ fecha: new Date().toISOString(), usuario: userNombre || 'Cliente', texto: obsTexto.trim() });
        const timeline = [...(data.timeline || [])];
        timeline.push({ fecha: new Date().toISOString(), evento: 'Observación agregada', usuario: userNombre || 'Cliente', observaciones: obsTexto.trim().substring(0, 100) });
        await actualizar({ observaciones: obs, timeline });
        setObsTexto('');
    };

    const reqsPendientes = (data.requerimientos || []).filter(r => r.estado === 'pendiente').length;

    const TABS_DETALLE = [
        { key: 'timeline', label: 'Timeline', icon: 'Clock' },
        { key: 'chat', label: 'Chat' + ((data.mensajes || []).length > 0 ? ` (${data.mensajes.length})` : ''), icon: 'MessageCircle' },
        { key: 'requerimientos', label: 'Requerimientos' + (reqsPendientes > 0 ? ` (${reqsPendientes})` : ''), icon: 'ClipboardCheck' },
        { key: 'documentos', label: 'Documentos' + ((data.documentos_emitidos || []).length > 0 ? ` (${data.documentos_emitidos.length})` : ''), icon: 'FileText' },
        { key: 'observaciones', label: 'Obs.' + ((data.observaciones || []).length > 0 ? ` (${data.observaciones.length})` : ''), icon: 'FileEdit' },
    ];

    return (
        <div className="space-y-4">
            {/* Encabezado */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                    <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400"><Icon name="ArrowLeft" size={16} /></button>
                    <div>
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider">{data.tipo}</p>
                        <h3 className="text-lg font-black text-white">{data.codigo}</h3>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <Badge color={ESTADOS_SP_COLOR[data.estado] || ESTADOS_SP_COLOR.pendiente}>{ESTADOS_SP_LABEL[data.estado] || data.estado}</Badge>
                        {data.prioridad && <Badge color={PRIORIDAD[data.prioridad] + ' bg-slate-800 border-slate-600'}>{data.prioridad}</Badge>}
                    </div>
                </div>
                {data.descripcion && <p className="text-xs text-slate-400 font-bold mb-3">{data.descripcion}</p>}
                {data.fecha_estimada && <p className="text-[10px] text-slate-500 font-bold">Estimada: {$fecha(data.fecha_estimada)}</p>}

                {userRol !== 'CLIENTE' && (
                    <div className="flex gap-2 mt-4 flex-wrap">
                        {['aceptada', 'en_proceso', 'en_revision', 'finalizada'].map(e => (
                            data.estado !== e && (
                                <button key={e} onClick={() => cambiarEstado(e)}
                                    className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700">
                                    → {ESTADOS_SP_LABEL[e]}
                                </button>
                            )
                        ))}
                        {data.estado !== 'cancelada' && (
                            <button onClick={() => cambiarEstado('cancelada')}
                                className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors border border-rose-500/20">
                                Cancelar
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Tabs internas */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
                <div className="flex gap-1 px-4 pt-4 pb-0 overflow-x-auto">
                    {TABS_DETALLE.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-[10px] font-black uppercase tracking-wide transition-all whitespace-nowrap ${tab === t.key ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}>
                            <Icon name={t.icon} size={12} /> {t.label}
                        </button>
                    ))}
                </div>
                <div className="p-5 border-t border-slate-700/50">
                    {tab === 'timeline' && (
                        <div className="space-y-0">
                            {(data.timeline || []).length === 0 ? (
                                <p className="text-xs text-slate-600 font-bold text-center py-8">Sin eventos registrados</p>
                            ) : (
                                [...(data.timeline || [])].reverse().map((ev, i, arr) => (
                                    <div key={i} className="flex gap-4 pb-6 relative">
                                        {i < arr.length - 1 && <div className="absolute left-[13px] top-7 bottom-0 w-px bg-slate-700" />}
                                        <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 z-10">
                                            <div className="w-2 h-2 rounded-full bg-blue-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-white">{ev.evento}</p>
                                            <p className="text-[10px] text-slate-500 font-bold">{ev.usuario} · {$fechaHora(ev.fecha)}</p>
                                            {ev.observaciones && <p className="text-[10px] text-slate-400 mt-1">{ev.observaciones}</p>}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {tab === 'chat' && (
                        <div className="space-y-3">
                            <div className="max-h-80 overflow-y-auto space-y-3 mb-4 pr-2">
                                {(data.mensajes || []).length === 0 ? (
                                    <p className="text-xs text-slate-600 font-bold text-center py-8">Sin mensajes aún</p>
                                ) : (
                                    [...(data.mensajes || [])].map((m, i) => (
                                        <div key={i} className={`flex ${m.remitente === userNombre ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] p-3 rounded-2xl ${m.remitente === userNombre ? 'bg-blue-600/20 border border-blue-500/30' : 'bg-slate-800 border border-slate-700'}`}>
                                                <p className="text-xs font-bold text-white">{m.texto}</p>
                                                <p className="text-[9px] text-slate-500 font-bold mt-1">{m.remitente} · {$fechaHora(m.fecha)}</p>
                                                {(m.archivos || []).map((a, j) => (
                                                    <a key={j} href={a.contenido || a.url} download className="text-[10px] text-blue-400 underline block mt-1">{a.nombre}</a>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="flex gap-2">
                                <input value={nuevoMsg} onChange={e => setNuevoMsg(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && enviarMensaje()}
                                    placeholder="Escribe un mensaje..."
                                    className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500" />
                                <button onClick={enviarMensaje}
                                    className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors">
                                    <Icon name="Send" size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {tab === 'requerimientos' && (
                        <div className="space-y-4">
                            {reqsPendientes > 0 && (
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                                    <Icon name="Bell" size={20} className="text-amber-400 mx-auto mb-2" />
                                    <p className="text-xs font-black text-amber-400 uppercase">{reqsPendientes} requerimiento(s) pendiente(s)</p>
                                </div>
                            )}
                            <div className="space-y-2">
                                {(data.requerimientos || []).length === 0 ? (
                                    <p className="text-xs text-slate-600 font-bold text-center py-6">Sin requerimientos</p>
                                ) : (
                                    (data.requerimientos || []).map(r => (
                                        <div key={r.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <p className="text-xs font-black text-white">{r.titulo}</p>
                                                <Badge color={r.estado === 'pendiente' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'}>{r.estado}</Badge>
                                            </div>
                                            {r.descripcion && <p className="text-[10px] text-slate-400 font-bold mb-2">{r.descripcion}</p>}
                                            {r.estado === 'pendiente' && (
                                                <button onClick={() => responderRequerimiento(r.id)}
                                                    className="text-[10px] font-black text-blue-400 underline">Responder requerimiento</button>
                                            )}
                                            {r.respuesta && <p className="text-[10px] text-slate-500 mt-2 font-bold">Respuesta: {r.respuesta}</p>}
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="border-t border-slate-700/50 pt-4">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Nuevo requerimiento</p>
                                <div className="space-y-2">
                                    <input value={reqTitulo} onChange={e => setReqTitulo(e.target.value)}
                                        placeholder="Título (ej: Subir Estado Bancario)"
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-blue-500" />
                                    <textarea value={reqDesc} onChange={e => setReqDesc(e.target.value)}
                                        placeholder="Descripción detallada..."
                                        rows={2}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-blue-500 resize-none" />
                                    <button onClick={agregarRequerimiento}
                                        className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2">
                                        <Icon name="ClipboardCheck" size={14} /> Solicitar Información
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'documentos' && (
                        <div className="space-y-3">
                            {(data.documentos_emitidos || []).length === 0 ? (
                                <div className="text-center py-10">
                                    <Icon name="FileText" size={32} className="text-slate-700 mx-auto mb-3" />
                                    <p className="text-xs font-black text-slate-400 uppercase">Sin documentos emitidos</p>
                                    <p className="text-[10px] text-slate-600 font-bold mt-1">El contador subirá los documentos aquí</p>
                                </div>
                            ) : (
                                (data.documentos_emitidos || []).map((doc, i) => (
                                    <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-black text-white">{doc.nombre}</p>
                                            <p className="text-[10px] text-slate-500 font-bold">
                                                v{doc.version || 1} · {$fecha(doc.fecha)}
                                                {doc.descripcion && <span className="ml-2">{doc.descripcion}</span>}
                                            </p>
                                        </div>
                                        <a href={doc.contenido || doc.url} download={doc.nombre}
                                            className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase transition-all">
                                            <Icon name="Download" size={12} /> Descargar
                                        </a>
                                    </div>
                                ))
                            )}
                            {(data.documentos_emitidos || []).length > 1 && (
                                <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-3">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Historial de versiones</p>
                                    {[...(data.documentos_emitidos || [])].reverse().map((doc, i) => (
                                        <div key={i} className="flex items-center justify-between py-1.5 text-[10px]">
                                            <span className="text-slate-400 font-bold">v{doc.version || (i + 1)}</span>
                                            <span className="text-slate-500">{doc.nombre}</span>
                                            <span className="text-slate-600">{$fecha(doc.fecha)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'observaciones' && (
                        <div className="space-y-4">
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {(data.observaciones || []).length === 0 ? (
                                    <p className="text-xs text-slate-600 font-bold text-center py-8">Sin observaciones</p>
                                ) : (
                                    [...(data.observaciones || [])].reverse().map((o, i) => (
                                        <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                                            <p className="text-xs font-bold text-white">{o.texto}</p>
                                            <p className="text-[9px] text-slate-500 font-bold mt-1">{o.usuario} · {$fechaHora(o.fecha)}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="flex gap-2">
                                <textarea value={obsTexto} onChange={e => setObsTexto(e.target.value)}
                                    placeholder="Agregar observación..."
                                    rows={2}
                                    className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 resize-none" />
                                <button onClick={agregarObservacion}
                                    className="self-end px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all flex-shrink-0">
                                    <Icon name="Save" size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Pendientes para el Contador ───
const PendientesView = ({ userRif }) => {
    const [servicios, setServicios] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!userRif) { setLoading(false); return; }
        sbFetch(`servicios_profesionales?empresa_rif=eq.${encodeURIComponent(userRif)}&order=created_at.desc`)
            .then(data => {
                const todos = data || [];
                const pendientes = todos.filter(s => ['pendiente', 'esperando_info', 'en_proceso', 'en_revision'].includes(s.estado));
                setServicios(pendientes);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [userRif]);

    if (loading) return <div className="h-32 bg-slate-800/50 rounded-2xl animate-pulse" />;
    if (servicios.length === 0) return (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-10 text-center">
            <Icon name="CheckCircle" size={40} className="text-emerald-500 mx-auto mb-3" />
            <p className="text-sm font-black text-white uppercase">Sin pendientes</p>
            <p className="text-xs text-slate-500 font-bold mt-1">Todo está al día con el contador</p>
        </div>
    );

    return (
        <div className="space-y-2">
            {servicios.map(s => (
                <div key={s.id} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black text-white">{s.tipo}</p>
                        <p className="text-[10px] text-slate-500 font-bold">{s.codigo} · {$fecha(s.created_at)}</p>
                    </div>
                    <Badge color={ESTADOS_SP_COLOR[s.estado] || ESTADOS_SP_COLOR.pendiente}>{ESTADOS_SP_LABEL[s.estado] || s.estado}</Badge>
                </div>
            ))}
        </div>
    );
};

// ─── Dashboard del Módulo ───
const DashboardContable = ({ journal, userRif, icc, bie }) => {
    const [servicios, setServicios] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [iccCalc, setIccCalc] = React.useState(icc);

    React.useEffect(() => {
        if (!userRif) { setLoading(false); return; }
        Promise.all([
            sbFetch(`servicios_profesionales?empresa_rif=eq.${encodeURIComponent(userRif)}&order=created_at.desc`),
            actualizarICC(userRif).then(nuevo => { if (nuevo !== null) setIccCalc(nuevo); }),
        ]).then(([data]) => { setServicios(data || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [userRif]);

    const activas = servicios.filter(s => !['finalizada', 'entregada', 'cancelada'].includes(s.estado));
    const pendientesReq = servicios.reduce((sum, s) => sum + (s.requerimientos || []).filter(r => r.estado === 'pendiente').length, 0);
    const totalMovs = journal.length;

    const iccFinal = iccCalc;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Solicitudes Activas" value={activas.length} icon="FileText" color="text-blue-400" sub={servicios.length + ' totales'} />
                <KpiCard label="Mov. Contables" value={totalMovs} icon="BookOpen" color="text-emerald-400" sub="en el período" />
                <KpiCard label="ICC" value={iccFinal || 0} icon="Shield" color={iccFinal >= 60 ? 'text-emerald-400' : 'text-amber-400'} sub="/100" />
                {pendientesReq > 0 && <KpiCard label="Req. Pendientes" value={pendientesReq} icon="Bell" color="text-amber-400" sub="responder" />}
            </div>

            {activas.length > 0 && (
                <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Solicitudes Activas</p>
                    <div className="space-y-2">
                        {activas.slice(0, 5).map(s => (
                            <div key={s.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-white">{s.tipo}</span>
                                    <KodigoBadge codigo={s.codigo} />
                                </div>
                                <Badge color={ESTADOS_SP_COLOR[s.estado] || ESTADOS_SP_COLOR.pendiente}>{ESTADOS_SP_LABEL[s.estado] || s.estado}</Badge>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const KpiCard = ({ label, value, icon, color, sub }) => (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 flex flex-col gap-3">
        <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 w-max">
            <Icon name={icon} size={16} className={color || 'text-slate-400'} />
        </div>
        <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
            <p className={`text-2xl font-black tracking-tight ${color || 'text-white'} mt-0.5`}>{value}</p>
            {sub && <p className="text-[10px] text-slate-500 font-bold mt-0.5">{sub}</p>}
        </div>
    </div>
);

// ─── MAIN ───
const AccountingModule = ({ onBack, currentUser }) => {
    const { journal, tasaBCV } = React.useContext(AppContext);
    const userRif = currentUser?.rif || '';
    const userName = currentUser?.nombre || 'Cliente';
    const userRol = currentUser?.rol || 'CLIENTE';
    const chart = window.CHART_OF_ACCOUNTS || {};

    const [tab, setTab] = React.useState('dashboard');
    const [detalle, setDetalle] = React.useState(null);
    const [icc, setIcc] = React.useState(75);
    const [bie, setBie] = React.useState(70);

    React.useEffect(() => {
        if (!userRif) return;
        Promise.all([
            sbFetch(`empresas_ly?rif=eq.${encodeURIComponent(userRif)}&select=icc_actual,bie_actual`),
        ]).then(([emp]) => {
            if (emp && emp.length > 0) {
                if (emp[0].icc_actual !== null) setIcc(parseFloat(emp[0].icc_actual));
                if (emp[0].bie_actual !== null) setBie(parseFloat(emp[0].bie_actual));
            }
        }).catch(() => {});
    }, [userRif]);

    const TABS = [
        { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
        { key: 'plan', label: 'Plan de Cuentas', icon: 'BookOpen' },
        { key: 'icc', label: 'Mi ICC', icon: 'Shield' },
        { key: 'pendientes', label: 'Pendientes', icon: 'Bell' },
        { key: 'servicios', label: 'Servicios Prof.', icon: 'FileText' },
        { key: 'conciliaciones', label: 'Conciliaciones', icon: 'Landmark' },
        { key: 'declaraciones', label: 'Declaraciones', icon: 'FileBarChart' },
    ];

    const handleAbrirDetalle = (s) => setDetalle(s);
    const handleVolverLista = () => setDetalle(null);

    const renderContent = () => {
        if (detalle) {
            return <ServicioDetalleView servicio={detalle} userRif={userRif} userNombre={userName} userRol={userRol} onBack={handleVolverLista} onActualizar={() => {}} />;
        }
        switch (tab) {
            case 'dashboard': return <DashboardContable journal={journal} userRif={userRif} icc={icc} bie={bie} />;
            case 'plan': return <PlanDeCuentasView journal={journal} chart={chart} userRif={userRif} />;
            case 'icc': return <MiICCView icc={icc} bie={bie} userRif={userRif} />;
            case 'pendientes': return <PendientesView userRif={userRif} />;
            case 'servicios': return <ServiciosListView userRif={userRif} onAbrir={handleAbrirDetalle} />;
            case 'conciliaciones': return <ConciliacionesView userRif={userRif} />;
            case 'declaraciones': return <DeclaracionesView userRif={userRif} />;
            default: return <DashboardContable journal={journal} userRif={userRif} icc={icc} bie={bie} />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white">
                    <Icon name="ArrowLeft" size={18} />
                </button>
                <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">LegalYa ERP</p>
                    <h1 className="text-lg font-black text-white uppercase">Módulo Contable</h1>
                </div>
                <div className="ml-auto">
                    <span className="text-[10px] text-slate-500 font-bold hidden md:block">{currentUser?.nombre_empresa || currentUser?.nombre}</span>
                </div>
            </div>

            {/* Tabs */}
            {!detalle && (
                <div className="bg-slate-900/50 border-b border-slate-800 px-6 overflow-x-auto">
                    <div className="flex gap-1 py-2 min-w-max">
                        {TABS.map(t => (
                            <button key={t.key} onClick={() => setTab(t.key)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all whitespace-nowrap ${tab === t.key ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}>
                                <Icon name={t.icon} size={13} /> {t.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Back button when in detail */}
            {detalle && (
                <div className="bg-slate-900/30 border-b border-slate-800 px-6 py-2">
                    <button onClick={handleVolverLista}
                        className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-wide hover:text-blue-300 transition-colors">
                        <Icon name="ArrowLeft" size={14} /> Volver a Servicios Profesionales
                    </button>
                </div>
            )}

            {/* Content */}
            <div className="p-6 max-w-6xl mx-auto animate-in">
                {renderContent()}
            </div>
        </div>
    );
};

window.AccountingModule = AccountingModule;
