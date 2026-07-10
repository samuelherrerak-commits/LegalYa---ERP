const AuditorContext = React.createContext();

const SIN_DATOS = [];

const fetchConTimeout = async (url, timeoutMs = 8000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
            },
            signal: controller.signal,
        });
        clearTimeout(id);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        return text ? JSON.parse(text) : [];
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
};

const AuditorProvider = ({ children, currentUser }) => {
    const [empresaActiva, setEmpresaActiva] = useState(() => {
        try {
            const saved = localStorage.getItem('auditor_empresa');
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    });

    const [empresas, setEmpresas] = useState(() => {
        try {
            const cached = localStorage.getItem('auditor_empresas_cache');
            return cached ? JSON.parse(cached) : [];
        } catch { return []; }
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (empresaActiva) {
            localStorage.setItem('auditor_empresa', JSON.stringify(empresaActiva));
        } else {
            localStorage.removeItem('auditor_empresa');
        }
    }, [empresaActiva]);

    useEffect(() => {
        let cancelled = false;
        const cargarEmpresas = async () => {
            setLoading(true);
            try {
                const baseUrl = SUPABASE_URL.replace(/\/+$/, '');
                const data = await fetchConTimeout(
                    `${baseUrl}/rest/v1/empresas_ly?select=*&estado=eq.activa&order=razon_social.asc`
                );
                if (!cancelled && data && data.length > 0) {
                    setEmpresas(data);
                    localStorage.setItem('auditor_empresas_cache', JSON.stringify(data));
                } else if (!cancelled) {
                    setEmpresas(SIN_DATOS);
                }
            } catch (err) {
                console.warn('Supabase no disponible, usando datos locales:', err.message);
                const cached = localStorage.getItem('auditor_empresas_cache');
                if (!cancelled) {
                    if (cached) {
                        try { setEmpresas(JSON.parse(cached)); } catch { setEmpresas(SIN_DATOS); }
                    } else {
                        setEmpresas(SIN_DATOS);
                    }
                }
            }
            if (!cancelled) setLoading(false);
        };
        if (empresas.length > 0) {
            setLoading(false);
            cargarEmpresas();
        } else {
            cargarEmpresas();
        }
        return () => { cancelled = true; };
    }, []);

    const selectEmpresa = useCallback((empresa) => {
        setEmpresaActiva(empresa);
    }, []);

    const clearEmpresa = useCallback(() => {
        setEmpresaActiva(null);
    }, []);

    const contextValue = useMemo(() => ({
        empresaActiva,
        empresas,
        loading,
        selectEmpresa,
        clearEmpresa,
    }), [empresaActiva, empresas, loading, selectEmpresa, clearEmpresa]);

    return (
        <AuditorContext.Provider value={contextValue}>
            {children}
        </AuditorContext.Provider>
    );
};

const useAuditor = () => React.useContext(AuditorContext);

window.AuditorContext = AuditorContext;
window.AuditorProvider = AuditorProvider;
window.useAuditor = useAuditor;
