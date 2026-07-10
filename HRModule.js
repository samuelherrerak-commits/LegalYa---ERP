// ==========================================
// HRMODULE.JS — LegalYa ERP v3.1
// Módulo de Recursos Humanos Integrado
// ==========================================

const HRModule = ({ subView = 'dashboard', currentUser }) => {
    const { addTransaction, tasaBCV: tasaSistema, journal } = React.useContext(AppContext);
    const { useState, useEffect, useMemo, useCallback, useRef } = React;

    const rif   = currentUser?.rif || '';
    const chart = window.CHART_OF_ACCOUNTS || {};

    // Data states
    const [empleados, setEmpleados] = useState([]);
    const [pagos,     setPagos]     = useState([]);
    const [config,    setConfig]    = useState({ dias_utilidades: 120 });
    
    // UI states
    const [loading,   setLoading]   = useState(false);
    const [msg,       setMsg]       = useState({ text:'', type:'' });

    const notify = (text, type='ok') => { setMsg({ text, type }); setTimeout(()=>setMsg({text:'',type:''}),3500); };

    const sbGet   = ep     => window.sbFetch(ep);
    const sbPost  = (ep,b) => window.sbFetch(ep,{method:'POST', prefer:'return=minimal',body:JSON.stringify(b)});
    const sbPatch = (ep,b) => window.sbFetch(ep,{method:'PATCH',prefer:'return=minimal',body:JSON.stringify(b)});

    // ════════════════════════════════════════
    // CARGA DE DATOS
    // ════════════════════════════════════════
    const cargar = useCallback(async () => {
        if (!rif) return;
        setLoading(true);
        try {
            const [emps, pays, conf] = await Promise.all([
                sbGet(`employees?rif_empresa=eq.${encodeURIComponent(rif)}&order=nombre.asc`),
                sbGet(`payroll_payments?rif_empresa=eq.${encodeURIComponent(rif)}&order=fecha.desc&limit=2000`),
                sbGet(`payroll_config?rif_empresa=eq.${encodeURIComponent(rif)}`)
            ]);
            setEmpleados(emps||[]);
            setPagos(pays||[]);
            if (conf && conf.length > 0) setConfig(conf[0]);
        } catch(e) { notify('Error cargando datos: '+e.message,'err'); }
        setLoading(false);
    }, [rif]);

    useEffect(()=>{ cargar(); },[cargar]);

    // ════════════════════════════════════════
    // UTILIDADES Y CÁLCULOS
    // ════════════════════════════════════════
    const fmt    = (n,d=2)  => (n||0).toLocaleString('es-VE',{minimumFractionDigits:d,maximumFractionDigits:d});
    const fmtD   = s        => s ? new Date(s+'T00:00:00').toLocaleDateString('es-VE') : '—';
    const hoyStr = ()       => new Date().toISOString().split('T')[0];

    const diasDesde  = (desde, hasta = Date.now()) => {
        if (!desde) return 0;
        return Math.max(0, Math.floor((new Date(hasta).getTime() - new Date(desde+'T00:00:00').getTime())/86400000));
    };

    const getCuenta = prefijo => {
        const e = Object.entries(chart).find(([c])=>c.startsWith(prefijo));
        return e ? {codigo:e[0],nombre:e[1].nombre} : {codigo:prefijo,nombre:prefijo};
    };

    const activos = useMemo(()=>empleados.filter(e=>e.estado==='activo'),[empleados]);

    const pagadoMap = useMemo(()=>{
        const m = {};
        pagos.forEach(p => {
            if (!m[p.empleado_id]) m[p.empleado_id] = {salario:0, vacaciones:0, bono_vacacional:0, prestaciones:0, utilidades:0};
            const tipo = p.tipo || 'salario';
            if (m[p.empleado_id][tipo] !== undefined) m[p.empleado_id][tipo] += parseFloat(p.monto_usd)||0;
        });
        return m;
    },[pagos]);

    const calcPasivos = useCallback((emp) => {
        const sal     = parseFloat(emp.salario_base||0);
        const diario  = sal / 30;
        const diasAntiguedad = diasDesde(emp.fecha_ingreso);
        const meses   = Math.floor(diasAntiguedad / 30);
        const anios   = Math.floor(diasAntiguedad / 365);
        const pagEmp  = pagadoMap[emp.cedula] || {};

        // Salario Pendiente (Descuenta los días de vacaciones pagados para no generar deuda doble)
        const ultimoPagoSal = pagos
            .filter(p=>p.empleado_id===emp.cedula && p.tipo==='salario')
            .sort((a,b)=>new Date(b.fecha)-new Date(a.fecha))[0];
        
        const fechaInicioSalario = ultimoPagoSal ? ultimoPagoSal.fecha : emp.fecha_ingreso;
        
        // Buscar vacaciones tomadas y pagadas en este mismo período para descontar esos días
        const vacTomadasRecientes = pagos.filter(p => p.empleado_id === emp.cedula && p.tipo === 'vacaciones' && new Date(p.fecha) >= new Date(fechaInicioSalario));
        let diasVacDescontar = 0;
        vacTomadasRecientes.forEach(p => {
            const match = p.referencia?.match(/\|DIAS:(\d+)/); // Extraemos los días incrustados en la referencia
            if(match) diasVacDescontar += parseInt(match[1], 10);
        });

        const diasDesdeUltimoPago = Math.max(0, diasDesde(fechaInicioSalario) - diasVacDescontar);
        const salarioPendiente = Math.max(0, diario * diasDesdeUltimoPago);

        // Vacaciones y Bono Vacacional (Acumulado)
        const diasVacPorAnio = Math.min(15 + Math.max(0, anios - 1), 30);
        const vacAcumuladas  = anios > 0 ? (diario * diasVacPorAnio * anios) : 0;
        const vacPendiente   = Math.max(0, vacAcumuladas - (pagEmp.vacaciones||0));

        const diasBonoVac    = Math.min(15 + Math.max(0, anios - 1), 45);
        const bonoVacAcum    = anios > 0 ? (diario * diasBonoVac * anios) : 0;
        const bonoPendiente  = Math.max(0, bonoVacAcum - (pagEmp.bono_vacacional||0));

        // Prestaciones Sociales
        const semestres      = Math.floor(meses / 6);
        const diasPrest      = semestres <= 4 ? semestres * 15 : (semestres - 4) * 45 + 60;
        const alicuotaUtil   = (sal * (config.dias_utilidades||120)) / 360;
        const alicuotaBono   = (sal * diasBonoVac) / 360;
        const salIntegral    = diario + (alicuotaUtil/30) + (alicuotaBono/30);
        const prestAcum      = salIntegral * diasPrest;
        const prestPendiente = Math.max(0, prestAcum - (pagEmp.prestaciones||0));

        // Utilidades
        const fechaInicioAño = `${new Date().getFullYear()}-01-01`;
        const fechaCalculoUtilidades = new Date(emp.fecha_ingreso) > new Date(fechaInicioAño) ? emp.fecha_ingreso : fechaInicioAño;
        const mesesUtilidades = Math.floor(diasDesde(fechaCalculoUtilidades) / 30);
        
        const utilAcumTotal = (sal / 360) * (config.dias_utilidades||120) * meses;
        const utilPendiente = Math.max(0, utilAcumTotal - (pagEmp.utilidades||0));

        const totalPasivo = salarioPendiente + vacPendiente + bonoPendiente + prestPendiente + utilPendiente;

        return {
            sal, diario, diasAntiguedad, meses, anios, diasVacPorAnio, diasBonoVac,
            salarioPendiente, vacPendiente, vacAcumuladas,
            bonoPendiente, bonoVacAcum, prestPendiente, prestAcum, salIntegral,
            utilPendiente, totalPasivo,
        };
    },[pagadoMap, pagos, config.dias_utilidades]);

    const pasivosMap = useMemo(()=>{
        const m = {};
        activos.forEach(e=>{ m[e.cedula] = calcPasivos(e); });
        return m;
    },[activos, calcPasivos]);

    // ════════════════════════════════════════
    // GESTIÓN DE EMPLEADOS (ESTADOS)
    // ════════════════════════════════════════
    const EMPTY_EMP = {cedula:'',nombre:'',apellido:'',telefono:'',correo:'',cargo:'',departamento:'',fecha_ingreso:'',tipo_contrato:'FIJO',salario_base:'',cuenta_bdv:'',estado:'activo'};
    const [empForm,     setEmpForm]     = useState(EMPTY_EMP);
    const [editEmp,     setEditEmp]     = useState(null);
    const [showEmpForm, setShowEmpForm] = useState(false);
    const [perfilEmp,   setPerfilEmp]   = useState(null);

    const abrirEmpForm = (emp=null) => { setEditEmp(emp); setEmpForm(emp?{...emp}:EMPTY_EMP); setShowEmpForm(true); };

    const guardarEmpleado = async () => {
        if (!empForm.nombre||!empForm.cedula||!empForm.cargo||!empForm.salario_base||!empForm.fecha_ingreso) {
            notify('Nombre, cédula, cargo, salario y fecha de ingreso son obligatorios.','err'); return;
        }
        try {
            const payload = {...empForm, rif_empresa:rif, salario_base:parseFloat(empForm.salario_base)};
            if (editEmp) { 
                await sbPatch(`employees?cedula=eq.${editEmp.cedula}`,payload); 
                notify('Empleado actualizado.'); 
            } else { 
                await sbPost('employees',payload); 
                notify('Empleado registrado.'); 
            }
            setShowEmpForm(false); 
            cargar();
        } catch(e) { notify('Error: '+e.message,'err'); }
    };

    const desactivar = async (cedula) => {
        if (!confirm('¿Retirar este empleado?')) return;
        await sbPatch(`employees?cedula=eq.${cedula}`,{estado:'inactivo'});
        notify('Empleado retirado.'); cargar();
    };

    // ════════════════════════════════════════
    // NÓMINA — CONCEPTOS Y PAGO (ESTADOS)
    // ════════════════════════════════════════
    const CONCEPTOS = [
        {id:'salario',                label:'Salario',                 pasivo:'2.1.02.01', gasto:'6.1.01.01'},
        {id:'prestaciones',           label:'Prestaciones Soc.',       pasivo:'2.1.02.03', gasto:'6.4.01.02'},
        {id:'utilidades',             label:'Utilidades',              pasivo:'2.1.02.04', gasto:'6.4.01.01'},
        {id:'liquidacion',            label:'Liquidación',             pasivo:'2.1.02.03', gasto:'6.1.01.01'},
        {id:'vacaciones_anticipadas', label:'Vacaciones Anticipadas',  pasivo:'2.1.02.02', gasto:'6.4.01.02'},
    ];

    const [nominaConcepto, setNominaConcepto] = useState(null);
    const [nominaSel,      setNominaSel]      = useState([]);
    const [pagoPayload,    setPagoPayload]    = useState(null);
    const [showPago,       setShowPago]       = useState(false);

    const conceptoActual = CONCEPTOS.find(c=>c.id===nominaConcepto);

    const montoConcepto = useCallback((cedula) => {
        if(nominaConcepto === 'vacaciones_anticipadas') return pagoPayload?.total || 0;
        const p = pasivosMap[cedula]; if (!p) return 0;
        switch(nominaConcepto) {
            case 'salario':         return p.salarioPendiente;
            case 'prestaciones':    return p.prestPendiente;
            case 'utilidades':      return p.utilPendiente;
            case 'liquidacion':     return p.totalPasivo;
            default: return 0;
        }
    },[pasivosMap, nominaConcepto, pagoPayload]);

    const conMonto    = useMemo(()=>activos.filter(e=>montoConcepto(e.cedula)>0),[activos,montoConcepto,nominaConcepto]);
    const totalNomina = nominaSel.reduce((s,ced)=>s+montoConcepto(ced),0);

    const PASOS = { METODO:1, BANCO:2, CONFIRMAR:3 };
    const [paso,          setPaso]          = useState(PASOS.METODO);
    const [pagando,       setPagando]       = useState(false);
    const [pagoForm,      setPagoForm]      = useState({ metodo: 'usd', banco: '1.1.01.03', tasa: '', referencia: '' });
    const tasaPago = parseFloat(pagoForm.tasa) || tasaSistema || 1;
    const totalNominaBS = totalNomina * tasaPago;

    const abrirPago = () => {
        setPaso(PASOS.METODO);
        setPagoForm({ metodo:'usd', banco:'1.1.01.03', tasa: String(tasaSistema||''), referencia:'' });
        setShowPago(true);
    };

    const generarTXT = () => {
        const fechaHoy   = new Date().toLocaleDateString('es-VE').replace(/\//g,'/').padStart(10,'0');
        const rifLimpio  = (rif||'J-00000000').replace(/\s/g,'');
        const concepto   = (conceptoActual?.label||'NOMINA').toUpperCase().replace(/\s+/g,'_').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
        const empsSelec  = nominaSel.map(ced=>empleados.find(e=>e.cedula===ced)).filter(Boolean);
        const total      = empsSelec.reduce((s,e)=>s+montoConcepto(e.cedula)*tasaPago,0).toFixed(2);
        
        const header = `H;${rifLimpio};${concepto};${fechaHoy};${String(empsSelec.length).padStart(5,'0')};${total}`;
        const detalles = empsSelec.map(emp => {
            const cedSolo = emp.cedula.replace(/[VEve\-\s]/g,'');
            const nac = /^[Ee]/i.test(emp.cedula) ? 'E' : 'V';
            const nombreLim = `${emp.nombre} ${emp.apellido}`.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').substring(0,40);
            return `D;${nac};${cedSolo};${nombreLim};${(emp.cuenta_bdv||'01020000000000000000').replace(/\s/g,'')};${(montoConcepto(emp.cedula)*tasaPago).toFixed(2)};${emp.correo||''}`;
        });
        return [header, ...detalles].join('\n');
    };

    const pagarEnBanco = () => {
        const blob = new Blob([generarTXT()], {type:'text/plain;charset=utf-8'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `nomina_bdv_${hoyStr()}.txt`; a.click();
        URL.revokeObjectURL(url);
        window.open('https://www.bancodevenezuela.com/index.html', 'BDV', 'width=1000,height=700,resizable=yes,scrollbars=yes');
        setPaso(PASOS.CONFIRMAR);
    };

    const procesarPago = async () => {
        if (!nominaSel.length) { notify('Selecciona empleados.','err'); return; }
        if (pagoForm.metodo==='bs'&&!pagoForm.tasa) { notify('Ingresa la tasa de cambio.','err'); return; }
        setPagando(true);
        try {
            const fecha = hoyStr();
            const esUSD = pagoForm.metodo==='usd';
            const cPasivo = getCuenta(conceptoActual.pasivo);
            const cGasto  = getCuenta(conceptoActual.gasto);
            const cHaber  = esUSD ? getCuenta('1.1.01.01') : getCuenta(pagoForm.banco);

            for (const ced of nominaSel) {
                const emp = empleados.find(e=>e.cedula===ced);
                const mUSD = montoConcepto(ced);
                if (!emp || mUSD <= 0) continue;
                const label = `${emp.nombre} ${emp.apellido} | ${conceptoActual.label}`;

                // Asiento Contable
                await addTransaction([
                    { cuenta_contable:cGasto.nombre,  codigo_cuenta:cGasto.codigo, concepto:`Devengo ${label}`, debe_usd:mUSD, haber_usd:0, tasa:esUSD?(tasaSistema||1):tasaPago, ref_doc:pagoForm.referencia, entidad:emp.nombre },
                    { cuenta_contable:cPasivo.nombre, codigo_cuenta:cPasivo.codigo, concepto:`Devengo ${label}`, debe_usd:0, haber_usd:mUSD, tasa:esUSD?(tasaSistema||1):tasaPago, ref_doc:pagoForm.referencia, entidad:emp.nombre },
                    { cuenta_contable:cPasivo.nombre, codigo_cuenta:cPasivo.codigo, concepto:`Pago ${label}`, debe_usd:mUSD, haber_usd:0, tasa:esUSD?(tasaSistema||1):tasaPago, ref_doc:pagoForm.referencia, entidad:emp.nombre },
                    { cuenta_contable:cHaber.nombre,  codigo_cuenta:cHaber.codigo, concepto:`Pago ${label}`, debe_usd:0, haber_usd:mUSD, tasa:esUSD?(tasaSistema||1):tasaPago, ref_doc:pagoForm.referencia, entidad:emp.nombre },
                ]);

                if (nominaConcepto === 'vacaciones_anticipadas' && pagoPayload) {
                    // Dividimos la base de datos en 2 para mantener los libros perfectos y registramos los días para que no afecte nómina regular
                    const refMontoVac = `${pagoForm.referencia||'AUTO'} |DIAS:${pagoPayload.dias}`;
                    await sbPost('payroll_payments', { rif_empresa: rif, fecha, empleado_id: ced, tipo: 'vacaciones', monto_usd: pagoPayload.montoVac, monto_bs: esUSD?0:pagoPayload.montoVac*tasaPago, tasa_cambio: esUSD?null:tasaPago, moneda: esUSD?'USD':'BS', metodo_pago: esUSD?'Efectivo':cHaber.nombre, estado: 'pagado', referencia: refMontoVac });
                    await sbPost('payroll_payments', { rif_empresa: rif, fecha, empleado_id: ced, tipo: 'bono_vacacional', monto_usd: pagoPayload.montoBono, monto_bs: esUSD?0:pagoPayload.montoBono*tasaPago, tasa_cambio: esUSD?null:tasaPago, moneda: esUSD?'USD':'BS', metodo_pago: esUSD?'Efectivo':cHaber.nombre, estado: 'pagado', referencia: pagoForm.referencia||'' });
                } else {
                    // Pago Standard
                    await sbPost('payroll_payments', { rif_empresa: rif, fecha, empleado_id: ced, tipo: nominaConcepto, monto_usd: mUSD, monto_bs: esUSD ? 0 : mUSD * tasaPago, tasa_cambio: esUSD ? null : tasaPago, moneda: esUSD ? 'USD' : 'BS', metodo_pago: esUSD ? 'Efectivo' : cHaber.nombre, estado: 'pagado', referencia: pagoForm.referencia||'' });
                }

                if (nominaConcepto==='liquidacion') await sbPatch(`employees?cedula=eq.${ced}`,{estado:'inactivo'});
            }

            notify(`Pago de ${conceptoActual.label} procesado.`);
            setNominaSel([]); setPagoPayload(null); setShowPago(false); setPaso(PASOS.METODO); cargar();
        } catch(e) { notify('Error procesando: '+e.message,'err'); }
        setPagando(false);
    };

    // ════════════════════════════════════════
    // GENERADOR DE RECIBOS PDF
    // ════════════════════════════════════════
    const generarRecibo = (pago) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const emp = empleados.find(e => e.cedula === pago.empleado_id);
        
        doc.setFontSize(18);
        doc.setTextColor(5, 150, 105); // Verde esmeralda (marca LegalYa)
        doc.text("RECIBO DE PAGO - LEGALYA", 105, 20, { align: "center" });
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.text(`Empresa RIF: ${rif}`, 20, 35);
        doc.text(`Fecha de Emisión: ${fmtD(pago.fecha)}`, 140, 35);
        
        doc.setLineWidth(0.5);
        doc.line(20, 40, 190, 40);

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Datos del Trabajador", 20, 50);
        doc.setFont("helvetica", "normal");
        doc.text(`Nombres: ${emp ? emp.nombre + ' ' + emp.apellido : pago.empleado_id}`, 20, 60);
        doc.text(`Cédula de Identidad: V-${pago.empleado_id}`, 20, 70);
        if(emp) doc.text(`Cargo / Dpto: ${emp.cargo} - ${emp.departamento}`, 20, 80);
        
        doc.setFont("helvetica", "bold");
        doc.text("Detalles del Pago", 20, 100);
        doc.setFont("helvetica", "normal");
        doc.text(`Concepto Abonado: ${pago.tipo.toUpperCase().replace('_', ' ')}`, 20, 110);
        doc.text(`Vía de Pago: ${pago.metodo_pago} (${pago.moneda})`, 20, 120);
        doc.text(`Referencia N°: ${pago.referencia?.split('|')[0] || 'N/A'}`, 20, 130);
        
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`MONTO NETO A PAGAR: $${fmt(pago.monto_usd)}`, 20, 150);
        if (pago.monto_bs) doc.text(`Equivalente BCV: Bs ${fmt(pago.monto_bs)} (Tasa: ${fmt(pago.tasa_cambio, 2)})`, 20, 160);
        
        doc.line(20, 200, 80, 200);
        doc.line(130, 200, 190, 200);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("Firma del Trabajador", 35, 205);
        doc.text("Sello / Empresa", 145, 205);
        
        doc.save(`Recibo_Pago_${pago.empleado_id}_${pago.fecha}.pdf`);
    };

    // ════════════════════════════════════════
    // VISTAS
    // ════════════════════════════════════════
    const Card = ({label,val,icon,color,bg}) => (
        <div className={`${bg} border rounded-2xl p-4 space-y-2 flex flex-col justify-between`}>
            <div className={color}><Icon name={icon} size={20}/></div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                <p className={`text-xl font-black ${color}`}>{val}</p>
            </div>
        </div>
    );

    const renderDashboard = () => {
        const totSal  = activos.reduce((s,e)=>s+(pasivosMap[e.cedula]?.salarioPendiente||0),0);
        const totVac  = activos.reduce((s,e)=>s+(pasivosMap[e.cedula]?.vacPendiente||0)+ (pasivosMap[e.cedula]?.bonoPendiente||0),0);
        const totPres = activos.reduce((s,e)=>s+(pasivosMap[e.cedula]?.prestPendiente||0),0);
        const totUtil = activos.reduce((s,e)=>s+(pasivosMap[e.cedula]?.utilPendiente||0),0);
        const totPas  = activos.reduce((s,e)=>s+(pasivosMap[e.cedula]?.totalPasivo||0),0);

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <Card label="Empleados Activos"    val={activos.length}     icon="Users"       color="text-emerald-600"    bg="bg-emerald-500/10 border-emerald-200"/>
                    <Card label="Pasivo Acumulado"     val={`$${fmt(totPas)}`}  icon="AlertCircle" color="text-rose-600"    bg="bg-rose-500/10 border-rose-500/20"/>
                    <Card label="Nómina Regulada"      val={`$${fmt(totSal)}`}  icon="DollarSign"  color="text-amber-600"   bg="bg-amber-500/10 border-amber-500/20"/>
                    <Card label="Vacaciones"           val={`$${fmt(totVac)}`}  icon="Umbrella"    color="text-cyan-600"    bg="bg-cyan-500/10 border-cyan-500/20"/>
                    <Card label="Utilidades"           val={`$${fmt(totUtil)}`} icon="TrendingUp"  color="text-emerald-600" bg="bg-emerald-500/10 border-emerald-500/20"/>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
                        <p className="text-xs font-black text-slate-900 uppercase">Provisión de Empleados</p>
                        <span className="text-[10px] text-slate-400 font-bold">Al {fmtD(hoyStr())}</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead><tr className="border-b border-slate-200 bg-emerald-50/60">
                                {['Empleado','Salario Deuda','Vacaciones','Prestaciones','Utilidades','Total'].map(h=><th key={h} className="px-5 py-3.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {activos.map(e=>{ const p=pasivosMap[e.cedula]||{}; return (
                                    <tr key={e.cedula} onClick={()=>{setPerfilEmp(e);}} className="border-t border-slate-100 hover:bg-emerald-50 cursor-pointer">
                                        <td className="px-5 py-3.5"><p className="text-slate-900 font-black">{e.nombre} {e.apellido}</p><p className="text-slate-400 text-[10px]">{e.cargo}</p></td>
                                        <td className="px-5 py-3.5 text-amber-600 font-bold">${fmt(p.salarioPendiente)}</td>
                                        <td className="px-5 py-3.5 text-cyan-600 font-bold">${fmt(p.vacPendiente + p.bonoPendiente)}</td>
                                        <td className="px-5 py-3.5 text-violet-600 font-bold">${fmt(p.prestPendiente)}</td>
                                        <td className="px-5 py-3.5 text-emerald-600 font-bold">${fmt(p.utilPendiente)}</td>
                                        <td className="px-5 py-3.5 text-rose-600 font-black">${fmt(p.totalPasivo)}</td>
                                    </tr>
                                );})}
                                {!activos.length&&<tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400 font-black uppercase">Sin empleados activos</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderEmpleados = () => perfilEmp ? (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
            <button onClick={()=>setPerfilEmp(null)} className="flex items-center gap-2 text-slate-400 hover:text-slate-900 text-xs font-black uppercase transition-colors">
                <Icon name="ArrowLeft" size={14}/> Volver al listado
            </button>
            <div className="grid lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6">
                    <div className="flex items-center gap-5 mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center text-2xl font-black text-slate-900 shadow-lg shadow-emerald-900/10">
                            {perfilEmp.nombre?.charAt(0)}{perfilEmp.apellido?.charAt(0)}
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-black text-slate-900 uppercase">{perfilEmp.nombre} {perfilEmp.apellido}</h2>
                            <p className="text-emerald-600 text-sm font-bold uppercase tracking-wide">{perfilEmp.cargo}</p>
                        </div>
                        <button onClick={()=>abrirEmpForm(perfilEmp)} className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wide transition-all border border-slate-300">
                            <Icon name="Pencil" size={14} className="inline mr-1"/> Editar
                        </button>
                    </div>
                    {/* Detalles del empleado */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {[
                            {l:'Cédula',       v:perfilEmp.cedula},
                            {l:'Teléfono',     v:perfilEmp.telefono||'—'},
                            {l:'Correo',       v:perfilEmp.correo||'—'},
                            {l:'Contrato',     v:perfilEmp.tipo_contrato},
                            {l:'Ingreso',      v:fmtD(perfilEmp.fecha_ingreso)},
                            {l:'Salario Base', v:`$${fmt(perfilEmp.salario_base)} / mes`},
                        ].map((r,i)=>(
                            <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{r.l}</p>
                                <p className="text-slate-900 font-bold text-xs truncate">{r.v}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    ) : (
        <div className="space-y-5 animate-in fade-in">
            <div className="flex justify-between items-center">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{activos.length} activos · {empleados.length} registrados</p>
                <button onClick={()=>abrirEmpForm()} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-900 rounded-xl text-xs font-black uppercase shadow-lg">
                    <Icon name="UserPlus" size={14}/> Registrar Empleado
                </button>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-200 bg-emerald-50/60">
                        {['Empleado','Cargo','Ingreso','Salario Base','Pasivo Acum.','Acciones'].map(h=><th key={h} className="px-5 py-4 text-left text-[10px] font-black text-slate-400 uppercase">{h}</th>)}
                    </tr></thead>
                    <tbody>
                        {empleados.map(emp=>{ const p=pasivosMap[emp.cedula]||{}; return (
                            <tr key={emp.cedula} className="border-t border-slate-100 hover:bg-emerald-50">
                                <td className="px-5 py-3.5"><p className="text-slate-900 font-black">{emp.nombre} {emp.apellido}</p><p className="text-slate-400 text-[10px]">V-{emp.cedula}</p></td>
                                <td className="px-5 py-3.5"><p className="text-slate-600 font-bold">{emp.cargo}</p></td>
                                <td className="px-5 py-3.5 text-slate-400">{fmtD(emp.fecha_ingreso)}</td>
                                <td className="px-5 py-3.5 text-slate-900 font-bold">${fmt(emp.salario_base)}</td>
                                <td className="px-5 py-3.5 font-black text-rose-600">${fmt(p.totalPasivo)}</td>
                                <td className="px-5 py-3.5 flex gap-1.5">
                                    <button onClick={()=>setPerfilEmp(emp)} className="p-2 hover:bg-emerald-500/20 text-emerald-600 rounded-lg"><Icon name="Eye" size={14}/></button>
                                    <button onClick={()=>abrirEmpForm(emp)} className="p-2 hover:bg-slate-100 text-slate-400 rounded-lg"><Icon name="Pencil" size={14}/></button>
                                    {emp.estado==='activo'&&<button onClick={()=>desactivar(emp.cedula)} className="p-2 hover:bg-rose-500/20 text-rose-600 rounded-lg"><Icon name="UserX" size={14}/></button>}
                                </td>
                            </tr>
                        );})}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderNomina = () => {
        if (!nominaConcepto) return (
            <div className="space-y-6 animate-in fade-in">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">¿Qué concepto de compensación desea procesar?</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {CONCEPTOS.filter(c=>c.id!=='vacaciones_anticipadas').map(c=>{
                        const total = activos.reduce((s,e)=>{ 
                            const p=pasivosMap[e.cedula]||{}; 
                            switch(c.id){ case 'salario':return s+p.salarioPendiente; case 'prestaciones':return s+p.prestPendiente; case 'utilidades':return s+p.utilPendiente; case 'liquidacion':return s+p.totalPasivo; default:return s; } 
                        },0);
                        return (
                            <button key={c.id} onClick={()=>{setNominaConcepto(c.id);setNominaSel([]);}} className="bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 rounded-2xl p-6 text-left transition-all group">
                                <p className="text-xs font-black text-slate-600 uppercase tracking-wider mb-2 group-hover:text-emerald-700 transition-colors">{c.label}</p>
                                <p className="text-2xl font-black text-amber-600 mb-1">${fmt(total)}</p>
                            </button>
                        );
                    })}
                </div>
            </div>
        );

        return (
            <div className="space-y-5 animate-in fade-in">
                <div className="flex items-center gap-3">
                    <button onClick={()=>{setNominaConcepto(null);setNominaSel([]);}} className="flex items-center gap-2 text-slate-400 hover:text-slate-900 text-xs font-black uppercase"><Icon name="ArrowLeft" size={14}/> Atrás</button>
                    <span className="text-slate-600">|</span>
                    <span className="text-xs font-black text-emerald-600 uppercase">Procesar {conceptoActual?.label}</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-emerald-50/60">
                        <div className="flex items-center gap-4">
                            <input type="checkbox" checked={nominaSel.length===conMonto.length&&conMonto.length>0} onChange={()=>setNominaSel(nominaSel.length===conMonto.length?[]:conMonto.map(e=>e.cedula))} className="w-4 h-4 accent-emerald-600 cursor-pointer"/>
                            <span className="text-xs font-black text-slate-900 uppercase">{conMonto.length} Trabajadores con saldo</span>
                        </div>
                        {nominaSel.length>0&&(
                            <div className="flex items-center gap-4">
                                <div className="text-right"><p className="text-[10px] text-slate-400 font-black uppercase">Total a Pagar</p><p className="text-lg font-black text-amber-600">${fmt(totalNomina)}</p></div>
                                <button onClick={abrirPago} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-900 rounded-xl text-xs font-black uppercase shadow-lg"><Icon name="CreditCard" size={14} className="inline mr-2"/>Procesar Pago</button>
                            </div>
                        )}
                    </div>
                    <div className="divide-y divide-slate-800/50">
                        {conMonto.map(emp=>(
                            <label key={emp.cedula} className="flex items-center gap-5 px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer group">
                                <input type="checkbox" checked={nominaSel.includes(emp.cedula)} onChange={()=>setNominaSel(p=>p.includes(emp.cedula)?p.filter(x=>x!==emp.cedula):[...p,emp.cedula])} className="w-4 h-4 accent-emerald-600 rounded"/>
                                <div className="flex-1 min-w-0"><p className="text-slate-900 font-black text-sm">{emp.nombre} {emp.apellido}</p></div>
                                <p className="text-amber-600 font-black text-base flex-shrink-0">${fmt(montoConcepto(emp.cedula))}</p>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const [vacForm, setVacForm] = useState({ cedula: '', dias: '' });
    const renderVacaciones = () => {
        const emp = empleados.find(e => e.cedula === vacForm.cedula);
        const p = emp ? pasivosMap[emp.cedula] : null;
        
        const diasTotalesDisp = p ? Math.floor(p.vacPendiente / p.diario) : 0;
        const diasSol = parseInt(vacForm.dias) || 0;
        
        const montoVac  = p ? (p.diario * diasSol) : 0;
        const bonoXDia  = p && diasTotalesDisp > 0 ? (p.bonoPendiente / diasTotalesDisp) : 0;
        const montoBono = bonoXDia * diasSol;
        const totalVac  = montoVac + montoBono;

        const processAnticipado = () => {
            if(!emp || diasSol <= 0) return;
            if(diasSol > diasTotalesDisp) { notify('No posee tantos días acumulados.', 'err'); return; }
            setNominaConcepto('vacaciones_anticipadas');
            setPagoPayload({ cedula: emp.cedula, dias: diasSol, montoVac, montoBono, total: totalVac });
            setNominaSel([emp.cedula]);
            abrirPago();
        };

        return (
            <div className="space-y-5 animate-in fade-in max-w-3xl mx-auto">
                <div className="bg-emerald-500/5 border border-emerald-200 rounded-2xl p-5 text-xs text-emerald-600 font-bold">
                    📌 <strong>Liquidación Anticipada de Vacaciones.</strong> Ingrese el empleado y los días que tomará. El sistema calculará el salario y bono proporcional, y detendrá la deuda regular por esos días.
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Seleccionar Empleado</label>
                        <select value={vacForm.cedula} onChange={e=>{setVacForm({cedula:e.target.value, dias:''});}} className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500">
                            <option value="">— Trabajador —</option>
                            {activos.map(e=><option key={e.cedula} value={e.cedula}>{e.nombre} {e.apellido}</option>)}
                        </select>
                    </div>

                    {emp && p && (
                        <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl flex justify-between items-center">
                            <div><p className="text-[10px] text-slate-400 font-black uppercase">Días Totales Acumulados</p><p className="text-xl font-black text-slate-900">{diasTotalesDisp} Días</p></div>
                            <div className="text-right"><p className="text-[10px] text-slate-400 font-black uppercase">Equivalente Dólares</p><p className="text-xl font-black text-cyan-600">${fmt(p.vacPendiente + p.bonoPendiente)}</p></div>
                        </div>
                    )}

                    {emp && p && (
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Días a Disfrutar (Solicitados)</label>
                            <input type="number" min="1" max={diasTotalesDisp} value={vacForm.dias} onChange={e=>setVacForm(v=>({...v, dias:e.target.value}))} className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-cyan-500"/>
                        </div>
                    )}
                </div>

                {emp && diasSol > 0 && (
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl">
                        <div className="p-6 space-y-2">
                            <div className="flex justify-between items-center py-2"><p className="text-sm text-slate-600 font-bold">Salario Diario</p><p className="font-black text-slate-600">${fmt(p.diario)}</p></div>
                            <div className="flex justify-between items-center py-2"><p className="text-sm text-slate-600 font-bold">Salario Vacacional ({diasSol} días)</p><p className="font-black text-cyan-600">${fmt(montoVac)}</p></div>
                            <div className="flex justify-between items-center py-2"><p className="text-sm text-slate-600 font-bold">Bono Vacacional ({diasSol} días)</p><p className="font-black text-sky-600">${fmt(montoBono)}</p></div>
                            <div className="flex justify-between items-center pt-4 border-t border-slate-200"><p className="text-sm font-black text-slate-900 uppercase">Monto Anticipado a Pagar</p><p className="text-2xl font-black text-emerald-600">${fmt(totalVac)}</p></div>
                        </div>
                        <div className="p-6 bg-emerald-50/60">
                            <button onClick={processAnticipado} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-slate-900 rounded-xl font-black uppercase text-sm shadow-lg"><Icon name="Zap" size={16} className="inline mr-2"/> Aprobar y Pagar Vacaciones</button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderPrestaciones = () => (
        <div className="space-y-5 animate-in fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-200 bg-emerald-50/60">
                        {['Trabajador','Ingreso','Semestres','Sal. Integral/día','Acumulado','Monto Pendiente','Acción'].map(h=><th key={h} className="px-5 py-4 text-left text-[10px] font-black text-slate-400 uppercase">{h}</th>)}
                    </tr></thead>
                    <tbody>
                        {activos.map(e=>{ const p=pasivosMap[e.cedula]||{}; return (
                            <tr key={e.cedula} className="border-t border-slate-100 hover:bg-emerald-50">
                                <td className="px-5 py-3.5 text-slate-900 font-black">{e.nombre} {e.apellido}</td>
                                <td className="px-5 py-3.5 text-slate-400">{fmtD(e.fecha_ingreso)}</td>
                                <td className="px-5 py-3.5 text-slate-600 font-bold">{Math.floor((p.meses||0)/6)}</td>
                                <td className="px-5 py-3.5 text-slate-600">${fmt(p.salIntegral)}</td>
                                <td className="px-5 py-3.5 text-slate-400">${fmt(p.prestAcum)}</td>
                                <td className="px-5 py-3.5 text-violet-600 font-black">${fmt(p.prestPendiente)}</td>
                                <td className="px-5 py-3.5">
                                    {p.prestPendiente>0&&<button onClick={()=>{setNominaConcepto('prestaciones');setNominaSel([e.cedula]);abrirPago();}} className="px-4 py-1.5 bg-violet-500/10 text-violet-600 rounded-lg text-[10px] font-black uppercase">Pagar</button>}
                                </td>
                            </tr>
                        );})}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderUtilidades = () => (
        <div className="space-y-5 animate-in fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-200 bg-emerald-50/60">
                        {['Trabajador','Salario/mes','Utilidades Acum.','Ya Pagado','Saldo Pendiente','Acción'].map(h=><th key={h} className="px-5 py-4 text-left text-[10px] font-black text-slate-400 uppercase">{h}</th>)}
                    </tr></thead>
                    <tbody>
                        {activos.map(e=>{ const p=pasivosMap[e.cedula]||{}; const pagEmp=pagadoMap[e.cedula]||{}; return (
                            <tr key={e.cedula} className="border-t border-slate-100 hover:bg-emerald-50">
                                <td className="px-5 py-3.5 text-slate-900 font-black">{e.nombre} {e.apellido}</td>
                                <td className="px-5 py-3.5 text-slate-600">${fmt(e.salario_base)}</td>
                                <td className="px-5 py-3.5 text-slate-600 font-bold">${fmt((sal=> (sal/360)*config.dias_utilidades*p.meses)(e.salario_base))}</td>
                                <td className="px-5 py-3.5 text-slate-400">${fmt(pagEmp.utilidades||0)}</td>
                                <td className="px-5 py-3.5 text-emerald-600 font-black">${fmt(p.utilPendiente)}</td>
                                <td className="px-5 py-3.5">
                                    {p.utilPendiente>0&&<button onClick={()=>{setNominaConcepto('utilidades');setNominaSel([e.cedula]);abrirPago();}} className="px-4 py-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg text-[10px] font-black uppercase">Pagar</button>}
                                </td>
                            </tr>
                        );})}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderLiquidaciones = () => (
        <div className="space-y-5 animate-in fade-in max-w-3xl mx-auto">
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Egreso de Trabajador</p>
                <select value={perfilEmp?.cedula||''} onChange={e=>setPerfilEmp(empleados.find(emp=>emp.cedula===e.target.value))}
                    className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-4 py-3.5 text-sm font-bold outline-none focus:border-emerald-500">
                    <option value="">— Seleccionar trabajador a liquidar —</option>
                    {activos.map(e=><option key={e.cedula} value={e.cedula}>{e.nombre} {e.apellido}</option>)}
                </select>
            </div>
            {perfilEmp&&(
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl">
                    <div className="px-6 py-5 border-b border-slate-200 bg-emerald-50/60">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cálculo de Liquidación</p>
                        <h3 className="text-xl font-black text-slate-900 mt-1">{perfilEmp.nombre} {perfilEmp.apellido}</h3>
                    </div>
                    {(()=>{ const liq = pasivosMap[perfilEmp.cedula]; return liq ? (
                        <>
                            <div className="p-6 space-y-2">
                                {[{l:'Salario Pend.',v:liq.salarioPendiente,c:'text-amber-600'},{l:'Vac. Fraccionadas',v:liq.vacPendiente,c:'text-cyan-600'},{l:'Bono Vac. Frac.',v:liq.bonoPendiente,c:'text-sky-600'},{l:'Prestaciones Soc.',v:liq.prestPendiente,c:'text-violet-600'},{l:'Util. Fraccionadas',v:liq.utilPendiente,c:'text-emerald-600'}].map((r,i)=>(
                                    <div key={i} className="flex justify-between items-center py-3.5 border-b border-slate-100"><p className="text-sm text-slate-600 font-bold">{r.l}</p><p className={`font-black ${r.c}`}>${fmt(r.v)}</p></div>
                                ))}
                                <div className="flex justify-between items-center pt-5 border-t-2 border-rose-500/30"><p className="text-sm font-black text-slate-900 uppercase">Monto Total Liquidación</p><p className="text-3xl font-black text-rose-600">${fmt(liq.totalPasivo)}</p></div>
                            </div>
                            <div className="p-6 bg-emerald-50/60"><button onClick={()=>{setNominaConcepto('liquidacion');setNominaSel([perfilEmp.cedula]);abrirPago();}} className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-slate-900 rounded-xl font-black uppercase text-sm"><Icon name="FileText" size={16} className="inline mr-2"/> Procesar Egreso</button></div>
                        </>
                    ) : null; })()}
                </div>
            )}
        </div>
    );

    const renderReportes = () => {
        const pagosMes = pagos.filter(p=>{const d=new Date(p.fecha);return d.getMonth()===new Date().getMonth()&&d.getFullYear()===new Date().getFullYear();});
        return (
            <div className="space-y-6 animate-in fade-in">
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-emerald-50/60">
                        <p className="text-xs font-black text-slate-900 uppercase">Historial Analítico y Recibos</p>
                        <span className="bg-white text-slate-400 text-[10px] font-black px-3 py-1.5 rounded-full uppercase">{pagos.length} Transacciones</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead><tr className="border-b border-slate-200">
                                {['Fecha','Empleado','Concepto','Monto USD','Referencia','Recibo'].map(h=><th key={h} className="px-5 py-3.5 text-left text-[10px] font-black text-slate-400 uppercase whitespace-nowrap">{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {pagos.map((p,i)=>{ const emp=empleados.find(e=>e.cedula===p.empleado_id); return (
                                    <tr key={i} className="border-t border-slate-100 hover:bg-emerald-50 transition-colors">
                                        <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap">{fmtD(p.fecha)}</td>
                                        <td className="px-5 py-3.5 text-slate-900 font-bold">{emp?`${emp.nombre} ${emp.apellido}`:p.empleado_id}</td>
                                        <td className="px-5 py-3.5"><span className="bg-white text-slate-600 border border-slate-300 text-[9px] font-black px-2.5 py-1 rounded-full uppercase">{p.tipo}</span></td>
                                        <td className="px-5 py-3.5 text-emerald-600 font-black">${fmt(p.monto_usd)}</td>
                                        <td className="px-5 py-3.5 font-mono text-slate-400 text-[10px]">{p.referencia?.split('|')[0]||'—'}</td>
                                        <td className="px-5 py-3.5"><button onClick={()=>generarRecibo(p)} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600/10 text-emerald-600 hover:bg-emerald-700/20 rounded-lg text-[10px] font-black uppercase transition-colors"><Icon name="Printer" size={12}/> PDF</button></td>
                                    </tr>
                                );})}
                                {!pagos.length&&<tr><td colSpan={6} className="px-5 py-16 text-center text-slate-400 text-xs font-black uppercase">Sin operaciones</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    // ════════════════════════════════════════
    // CONSTRUCCIÓN DE LAS VENTANAS EMERGENTES (MODALES)
    // ════════════════════════════════════════
    const modalEmp = showEmpForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in" onClick={()=>setShowEmpForm(false)}>
            <div className="bg-white border border-slate-300 rounded-[2rem] p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e=>e.stopPropagation()}>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">{editEmp?'Modificar Expediente':'Alta de Trabajador'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        {l:'Nombres *',            k:'nombre',       t:'text',  p:'JUAN'},
                        {l:'Apellidos *',          k:'apellido',     t:'text',  p:'PÉREZ'},
                        {l:'Cédula Identidad *',   k:'cedula',       t:'text',  p:'12345678', disabled: !!editEmp},
                        {l:'Fecha de Ingreso *',   k:'fecha_ingreso',t:'date',  p:''},
                        {l:'Teléfono',             k:'telefono',     t:'text',  p:'0412-0000000'},
                        {l:'Correo Electrónico',   k:'correo',       t:'email', p:'correo@empresa.com'},
                        {l:'Cargo *',              k:'cargo',        t:'text',  p:'Analista'},
                        {l:'Departamento',         k:'departamento', t:'text',  p:'Operaciones'},
                        {l:'Salario Mensual USD *',k:'salario_base', t:'number',p:'500'},
                        {l:'Cuenta BDV (20 dígitos)',k:'cuenta_bdv', t:'text',  p:'01020000000000000000'},
                    ].map(f=>(
                        <div key={f.k}>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">{f.l}</label>
                            <input type={f.t} placeholder={f.p} value={empForm[f.k]||''} disabled={f.disabled}
                                onChange={e=>setEmpForm(p=>({...p,[f.k]:['nombre','apellido','cargo','departamento'].includes(f.k)?e.target.value.toUpperCase():e.target.value}))}
                                className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"/>
                        </div>
                    ))}
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Tipo Contrato</label>
                        <select value={empForm.tipo_contrato} onChange={e=>setEmpForm(p=>({...p,tipo_contrato:e.target.value}))}
                            className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 transition-colors">
                            {['FIJO','TEMPORAL','DESTAJO','POR OBRA'].map(t=><option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex gap-4 mt-8">
                    <button onClick={()=>setShowEmpForm(false)} className="flex-1 py-3.5 bg-white hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-300 transition-colors">Cancelar</button>
                    <button onClick={guardarEmpleado} className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-slate-900 rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-lg shadow-emerald-900/10">{editEmp?'Actualizar':'Guardar'}</button>
                </div>
            </div>
        </div>
    );

    const modalPago = showPago && conceptoActual && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in" onClick={()=>setShowPago(false)}>
            <div className="bg-white border border-slate-300 rounded-[2rem] p-8 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e=>e.stopPropagation()}>

                <div className="flex items-center justify-between mb-8 relative">
                    <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-white -z-10" />
                    {[{n:1,l:'Vía'},{n:2,l:'Portal'},{n:3,l:'Validar'}].map(s=>(
                        <div key={s.n} className="flex flex-col items-center gap-2 bg-white px-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-colors ${paso>=s.n?'bg-emerald-600 text-slate-900 shadow-lg shadow-emerald-900/10':'bg-white text-slate-400 border border-slate-300'}`}>{s.n}</div>
                            <span className={`text-[9px] font-black uppercase tracking-widest ${paso>=s.n?'text-emerald-600':'text-slate-400'}`}>{s.l}</span>
                        </div>
                    ))}
                </div>

                <div className="text-center mb-6">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider">{conceptoActual.label}</h3>
                    <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-widest">{nominaSel.length} Empleados seleccionados</p>
                </div>

                {paso===PASOS.METODO&&(
                    <div className="space-y-5 animate-in slide-in-from-right-4">
                        <div className="grid grid-cols-2 gap-3">
                            {[{v:'usd',l:'Caja USD',i:'DollarSign'},{v:'bs',l:'Bancos Bs.',i:'Landmark'}].map(m=>(
                                <button key={m.v} onClick={()=>setPagoForm(p=>({...p,metodo:m.v}))}
                                    className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 text-xs font-black uppercase tracking-widest transition-all ${pagoForm.metodo===m.v?'border-emerald-500 bg-emerald-500/10 text-emerald-600':'border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50'}`}>
                                    <Icon name={m.i} size={24}/>{m.l}
                                </button>
                            ))}
                        </div>

                        {pagoForm.metodo==='bs'&&(
                            <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                                <div>
                                    <div className="flex justify-between items-end mb-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Tasa (Bs/$)</label>
                                        <button onClick={()=>setPagoForm(p=>({...p,tasa:String(tasaSistema||'')}))} className="text-[9px] text-emerald-600 font-black uppercase tracking-widest hover:underline">Usar BCV: {tasaSistema}</button>
                                    </div>
                                    <input type="number" value={pagoForm.tasa} onChange={e=>setPagoForm(p=>({...p,tasa:e.target.value}))} placeholder={String(tasaSistema||'0.00')} className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 transition-colors"/>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Banco Origen</label>
                                    <select value={pagoForm.banco} onChange={e=>setPagoForm(p=>({...p,banco:e.target.value}))} className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 transition-colors">
                                        {Object.entries(chart).filter(([k])=>k.startsWith('1.1.01')||k.startsWith('1.1.02')).map(([code,c])=>(<option key={code} value={code}>{c.nombre}</option>))}
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-inner">
                            <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total USD</span><span className="text-2xl font-black text-emerald-600">${fmt(totalNomina)}</span></div>
                            {pagoForm.metodo==='bs'&&tasaPago>0&&(<div className="flex justify-between items-center pt-3 border-t border-slate-200"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Equivalente</span><span className="text-lg font-black text-amber-600">Bs {fmt(totalNominaBS)}</span></div>)}
                        </div>

                        <div className="flex gap-3">
                            <button onClick={()=>setShowPago(false)} className="flex-1 py-3.5 bg-white hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-colors">Cancelar</button>
                            <button onClick={()=>{ if(pagoForm.metodo==='bs'&&!pagoForm.tasa){notify('Ingresa la tasa','err');return;} setPaso(pagoForm.metodo==='bs'?PASOS.BANCO:PASOS.CONFIRMAR); }} className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-slate-900 rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/10">Continuar <Icon name="ArrowRight" size={14}/></button>
                        </div>
                    </div>
                )}

                {paso===PASOS.BANCO&&(
                    <div className="space-y-6 animate-in slide-in-from-right-4">
                        <div className="bg-emerald-500/10 border border-emerald-200 rounded-2xl p-6">
                            <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-4">Integración Banco de Venezuela</h4>
                            <ol className="space-y-4 text-xs text-slate-600 font-bold list-none">
                                <li className="flex gap-3"><span className="w-5 h-5 rounded-full bg-emerald-600 text-slate-900 flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5 shadow-md shadow-emerald-900/10">1</span> Presiona el botón para descargar el archivo TXT y abrir la ventana del banco automáticamente.</li>
                                <li className="flex gap-3"><span className="w-5 h-5 rounded-full bg-white text-slate-400 border border-slate-300 flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5">2</span> Sube el TXT en el portal BDV y ejecuta el pago (Total: Bs {fmt(totalNominaBS)}).</li>
                                <li className="flex gap-3"><span className="w-5 h-5 rounded-full bg-white text-slate-400 border border-slate-300 flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5">3</span> Descarga tu comprobante de operación.</li>
                            </ol>
                        </div>

                        <button onClick={pagarEnBanco} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-slate-900 rounded-2xl font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/50">
                            <Icon name="ExternalLink" size={16}/> Descargar TXT y Abrir BDV
                        </button>

                        <div className="flex gap-3">
                            <button onClick={()=>setPaso(PASOS.METODO)} className="flex-1 py-3.5 bg-white hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-colors">Regresar</button>
                            <button onClick={()=>setPaso(PASOS.CONFIRMAR)} className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2">Ya realicé el pago <Icon name="ArrowRight" size={14}/></button>
                        </div>
                    </div>
                )}

                {paso===PASOS.CONFIRMAR&&(
                    <div className="space-y-6 animate-in slide-in-from-right-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Ref. Bancaria / Operación</label>
                            <input value={pagoForm.referencia} onChange={e=>setPagoForm(p=>({...p,referencia:e.target.value}))} placeholder="Ej. 000123456" className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 font-mono transition-colors"/>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                            <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumen</span><span className="text-xs font-black text-slate-900 uppercase">{conceptoActual.label}</span></div>
                            <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Afectados</span><span className="text-xs font-black text-slate-900">{nominaSel.length} Trab.</span></div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-200"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto Final</span><span className="text-xl font-black text-emerald-600">${fmt(totalNomina)}</span></div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={()=>setPaso(pagoForm.metodo==='bs'?PASOS.BANCO:PASOS.METODO)} className="flex-1 py-3.5 bg-white hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-colors">Revisar</button>
                            <button onClick={procesarPago} disabled={pagando||(pagoForm.metodo==='bs'&&!pagoForm.referencia)}
                                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-900 rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/50">
                                {pagando?<><Icon name="Loader" size={14} className="animate-spin"/>Grabando...</>:<><Icon name="CheckCircle" size={14}/>Contabilizar Pago</>}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const RENDERS = { dashboard: renderDashboard, empleados: renderEmpleados, nomina: renderNomina, vacaciones: renderVacaciones, prestaciones: renderPrestaciones, utilidades: renderUtilidades, liquidaciones: renderLiquidaciones, reportes: renderReportes };

    return (
        <div className="flex flex-col h-full font-sans text-slate-600 relative animate-in fade-in">
            {msg.text&&(
                <div className={`absolute top-0 left-0 right-0 z-30 mb-6 p-4 rounded-xl text-xs font-black uppercase tracking-widest text-center border shadow-lg animate-in slide-in-from-top-2 ${msg.type==='err'?'bg-rose-50 text-rose-700 border-rose-200':'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {msg.text}
                </div>
            )}
            <div className={msg.text ? "mt-16" : ""}>
                <div className="flex items-center gap-3 mb-6 border-b border-slate-200 pb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-slate-900"><Icon name="Briefcase" size={20}/></div>
                    <div><h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Recursos Humanos</h2><p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{subView.replace('_',' ')}</p></div>
                </div>
                {loading ? <div className="flex flex-col items-center justify-center py-32 text-emerald-600 gap-4"><Icon name="Loader" size={32} className="animate-spin"/><p className="text-xs font-black uppercase tracking-widest">Sincronizando...</p></div> : (RENDERS[subView]||renderDashboard)()}
            </div>
            
            {/* Aquí están los modales que faltaban */}
            {modalEmp}
            {modalPago}
        </div>
    );
};

window.HRModule = HRModule;