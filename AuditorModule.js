const AuditorRouter = ({ onLogout }) => {
    const { empresaActiva } = useAuditor();

    if (!empresaActiva) {
        return <EmpresasList />;
    }

    return <AuditorLayout onLogout={onLogout} />;
};

window.AuditorRouter = AuditorRouter;
