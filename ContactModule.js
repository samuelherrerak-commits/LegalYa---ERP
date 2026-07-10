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
// MÓDULO INVENTARIO + ETIQUETAS QR
// ==========================================
