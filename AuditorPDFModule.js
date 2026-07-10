const AuditorPDF = {
    _fmt: (n) => (n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    _fecha: (s) => s ? new Date(s).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—',
    _centro: (doc, texto, y, size, style, color) => {
        doc.setFontSize(size); doc.setFont('Helvetica', style || 'normal');
        doc.setTextColor(color?.[0] || 255, color?.[1] || 255, color?.[2] || 255);
        doc.text(texto, doc.internal.pageSize.width / 2, y, { align: 'center' });
    },

    generarConciliacionPDF: (data, empresa, auditor, cuentaNombre, callback) => {
        const doc = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pw = doc.internal.pageSize.width;
        const ph = doc.internal.pageSize.height;
        const ML = 20;
        const colW = pw - ML * 2;
        let y = 20;

        const write = (x, txt, size, style, color) => {
            doc.setFontSize(size || 9);
            doc.setFont('Helvetica', style || 'normal');
            doc.setTextColor(color?.[0] || 0, color?.[1] || 0, color?.[2] || 0);
            doc.text(txt, x, y);
        };
        const writeR = (x, txt, size, style, color) => {
            doc.setFontSize(size || 9);
            doc.setFont('Helvetica', style || 'normal');
            doc.setTextColor(color?.[0] || 0, color?.[1] || 0, color?.[2] || 0);
            doc.text(txt, x + colW, y, { align: 'right' });
        };
        const writeC = (txt, size, style, color) => {
            doc.setFontSize(size || 9);
            doc.setFont('Helvetica', style || 'normal');
            doc.setTextColor(color?.[0] || 0, color?.[1] || 0, color?.[2] || 0);
            doc.text(txt, pw / 2, y, { align: 'center' });
        };
        const salto = (h) => { y += h || 5; };
        const headerLine = () => {
            doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5);
            doc.line(ML, y, ML + colW, y); salto(7);
        };

        const cruces = data.cruces?.filter(c => c.aceptado) || [];
        const pendLibro = data.pendientesLibro || [];
        const pendBanco = data.pendientesBanco || [];
        const saldoLibroParsed = parseFloat(data.saldoLibro) || 0;
        const saldoBancoParsed = parseFloat(data.saldoBanco) || 0;
        const difParsed = parseFloat(data.diferencia) || 0;

        // ═══ PAGE 1 - PORTADA ═══
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pw, ph, 'F');

        doc.setLineWidth(1);
        doc.setDrawColor(0, 0, 0);
        doc.line(ML, 30, ML + colW, 30);
        salto(12);

        writeC('LEGALYA AUDITOR SUITE', 22, 'bold', [0, 0, 0]);
        salto(8);
        writeC('CONCILIACIÓN BANCARIA', 13, 'normal', [80, 80, 80]);

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(pw / 2 - 35, y, pw / 2 + 35, y);
        salto(6);

        const refNum = `CONC-${data.periodo}-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`;
        writeC(`N° de Referencia: ${refNum}`, 9, 'normal', [100, 100, 100]);

        y = 75;
        const info = [
            ['Empresa:', empresa?.razon_social || empresa?.nombre_comercial || '—'],
            ['RIF:', empresa?.rif || '—'],
            ['Cuenta Bancaria:', cuentaNombre || data.codigo_cuenta || '—'],
            ['Código:', data.codigo_cuenta || '—'],
            ['Período:', AuditorAgents.labelPeriodo(data.periodo)],
            ['Fecha de emisión:', AuditorPDF._fecha(new Date().toISOString())],
            ['Auditor:', auditor || '—'],
        ];
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(ML, y - 3, ML + colW, y - 3);
        salto(3);
        info.forEach(([l, v]) => {
            write(ML, l, 9, 'bold', [0, 0, 0]);
            write(ML + 45, v, 9, 'normal', [60, 60, 60]);
            salto(7);
        });
        doc.setDrawColor(200, 200, 200);
        doc.line(ML, y + 2, ML + colW, y + 2);

        // ═══ PAGE 2 - RESUMEN DE SALDOS ═══
        doc.addPage();
        y = 25;
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pw, ph, 'F');

        headerLine();
        write(ML, 'RESUMEN DE SALDOS', 14, 'bold', [0, 0, 0]);
        salto(4);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.line(ML, y, ML + colW, y);
        salto(8);

        [
            ['Saldo según Libro:', '$ ' + AuditorPDF._fmt(saldoLibroParsed), false],
            ['Saldo según Extracto:', '$ ' + AuditorPDF._fmt(saldoBancoParsed), false],
            ['', '', false],
            ['Diferencia:', '$ ' + AuditorPDF._fmt(difParsed), true],
        ].forEach(([l, v, isBold]) => {
            if (l) {
                write(ML + 5, l, 11, isBold ? 'bold' : 'normal', [0, 0, 0]);
                writeR(ML, v, 11, isBold ? 'bold' : 'normal', isBold ? [180, 40, 40] : [0, 0, 0]);
            }
            salto(8);
        });

        // ═══ PAGE 3 - MOVIMIENTOS PENDIENTES ═══
        doc.addPage();
        y = 25;
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pw, ph, 'F');

        headerLine();
        write(ML, 'MOVIMIENTOS PENDIENTES', 14, 'bold', [0, 0, 0]);
        salto(4);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.line(ML, y, ML + colW, y);
        salto(6);

        // Pendientes Libro
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Pendientes en Libro', ML + 2, y);
        salto(6);

        if (pendLibro.length > 0) {
            doc.setFillColor(245, 245, 245);
            doc.rect(ML, y - 3, colW, 5, 'F');
            doc.setFontSize(7);
            doc.setFont('Helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text('#', ML + 2, y);
            doc.text('Fecha', ML + 10, y);
            doc.text('Concepto', ML + 32, y);
            doc.text('Debe Bs', ML + 115, y);
            doc.text('Haber Bs', ML + 142, y);
            doc.text('Ref', ML + 169, y);
            salto(5);

            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(7);
            for (let i = 0; i < pendLibro.length; i++) {
                if (y > ph - 18) {
                    doc.setFont('Helvetica', 'italic');
                    doc.text(`... y ${pendLibro.length - i} más`, ML + 2, y);
                    salto(4);
                    break;
                }
                const r = pendLibro[i];
                doc.text(`${i + 1}`, ML + 2, y);
                doc.text(AuditorPDF._fecha(r.fecha_local), ML + 10, y);
                doc.text(String(r.concepto || '').substring(0, 35), ML + 32, y);
                doc.text(AuditorPDF._fmt(parseFloat(r.debe_bs || 0)), ML + 115, y);
                doc.text(AuditorPDF._fmt(parseFloat(r.haber_bs || 0)), ML + 142, y);
                doc.text((r.ref_doc || '').substring(0, 14), ML + 169, y);
                salto(4.5);
            }
        } else {
            doc.setFont('Helvetica', 'italic');
            doc.text('No hay transacciones pendientes en libro', ML + 5, y);
            salto(6);
        }

        salto(4);
        // Pendientes Banco
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Pendientes en Banco', ML + 2, y);
        salto(6);

        if (pendBanco.length > 0) {
            doc.setFillColor(245, 245, 245);
            doc.rect(ML, y - 3, colW, 5, 'F');
            doc.setFontSize(7);
            doc.setFont('Helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text('#', ML + 2, y);
            doc.text('Fecha', ML + 10, y);
            doc.text('Concepto', ML + 32, y);
            doc.text('Monto', ML + 115, y);
            doc.text('Tipo', ML + 142, y);
            doc.text('Ref', ML + 169, y);
            salto(5);

            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(7);
            for (let i = 0; i < pendBanco.length; i++) {
                if (y > ph - 18) {
                    doc.setFont('Helvetica', 'italic');
                    doc.text(`... y ${pendBanco.length - i} más`, ML + 2, y);
                    salto(4);
                    break;
                }
                const t = pendBanco[i];
                doc.text(`${i + 1}`, ML + 2, y);
                doc.text(AuditorPDF._fecha(t.fecha), ML + 10, y);
                doc.text(String(t.concepto || '').substring(0, 35), ML + 32, y);
                doc.text(AuditorPDF._fmt(t.monto), ML + 115, y);
                doc.text(t.tipo === 'debe' ? 'Débito' : 'Crédito', ML + 142, y);
                doc.text((t.ref || '').substring(0, 14), ML + 169, y);
                salto(4.5);
            }
        } else {
            doc.setFont('Helvetica', 'italic');
            doc.text('No hay transacciones pendientes en banco', ML + 5, y);
            salto(6);
        }

        // ═══ PAGE 4 - CRUCES CONCILIADOS + FIRMA ═══
        doc.addPage();
        y = 25;
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pw, ph, 'F');

        headerLine();
        write(ML, 'CRUCES CONCILIADOS', 14, 'bold', [0, 0, 0]);
        salto(4);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.line(ML, y, ML + colW, y);
        salto(6);

        if (cruces.length > 0) {
            const headers = ['#', 'F. Libro', 'F. Banco', 'Concepto', 'Monto ($)', 'Conf.'];
            const cw = [7, 18, 18, 0, 24, 14];
            const availW = colW - cw[0] - cw[1] - cw[2] - cw[4] - cw[5] - 10;
            cw[3] = Math.max(availW, 40);

            doc.setFillColor(245, 245, 245);
            doc.rect(ML, y - 3, colW, 5, 'F');
            let xPos = ML + 2;
            doc.setFontSize(7);
            doc.setFont('Helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            headers.forEach((h, i) => { doc.text(h, xPos, y); xPos += cw[i] + 2; });
            salto(5);

            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(0, 0, 0);

            for (let i = 0; i < cruces.length; i++) {
                if (y > ph - 20) {
                    doc.setFont('Helvetica', 'italic');
                    doc.text(`... y ${cruces.length - i} cruces más`, ML + 2, y);
                    break;
                }
                const c = cruces[i];
                const fechaL = AuditorPDF._fecha(c.libro?.fecha_local);
                const fechaB = AuditorPDF._fecha(c.banco?.fecha);
                const conc = String(c.libro?.concepto || c.banco?.concepto || '').substring(0, 35);
                const monto = parseFloat(c.libro?.debe_bs || c.libro?.haber_bs || c.banco?.monto || 0);

                xPos = ML + 2;
                doc.text(`${i + 1}`, xPos, y); xPos += cw[0] + 2;
                doc.text(fechaL, xPos, y); xPos += cw[1] + 2;
                doc.text(fechaB, xPos, y); xPos += cw[2] + 2;
                doc.text(conc, xPos, y); xPos += cw[3] + 2;
                doc.text('$ ' + AuditorPDF._fmt(monto), xPos, y); xPos += cw[4] + 2;

                const confColor = c.score >= 80 ? [0, 140, 50] : c.score >= 60 ? [200, 150, 0] : [200, 50, 50];
                doc.setTextColor(confColor[0], confColor[1], confColor[2]);
                doc.text(c.score + '%', xPos, y);
                doc.setTextColor(0, 0, 0);
                salto(4.5);
            }
        } else {
            doc.setFont('Helvetica', 'italic');
            doc.text('No se encontraron cruces automáticos', ML + 5, y);
            salto(8);
        }

        // Firma
        salto(10);
        if (y > ph - 25) { doc.addPage(); y = 25; doc.setFillColor(255, 255, 255); doc.rect(0, 0, pw, ph, 'F'); }
        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(0.5);
        doc.line(ML, y, ML + 80, y);
        salto(6);
        write(ML, auditor || 'Auditor', 10, 'bold', [0, 0, 0]);
        write(ML, 'Firma del Auditor', 8, 'normal', [100, 100, 100]);

        if (callback) callback(doc);
        return doc;
    },

    generarDeclaracionPDF: (data, empresa, auditor, callback) => {
        const doc = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pw = doc.internal.pageSize.width;
        const ph = doc.internal.pageSize.height;
        let y = 20;
        const ML = 20;
        const colW = pw - ML * 2;

        const write = (x, txt, size, style, color) => {
            doc.setFontSize(size || 8); doc.setFont('Helvetica', style || 'normal');
            doc.setTextColor(color?.[0] || 200, color?.[1] || 200, color?.[2] || 200);
            doc.text(txt, x, y);
        };
        const writeR = (x, txt, size, style, color) => {
            doc.setFontSize(size || 8); doc.setFont('Helvetica', style || 'normal');
            doc.setTextColor(color?.[0] || 200, color?.[1] || 200, color?.[2] || 200);
            doc.text(txt, x + colW, y, { align: 'right' });
        };
        const linea = (h) => { y += h || 5; };

        doc.setFillColor(15, 23, 42); doc.rect(0, 0, pw, ph, 'F');
        doc.setTextColor(255, 255, 255);

        doc.setFontSize(20); doc.setFont('Helvetica', 'bold');
        doc.text('LEGALYA AUDITOR SUITE', pw / 2, 40, { align: 'center' });

        doc.setFontSize(10); doc.setFont('Helvetica', 'normal');
        doc.setTextColor(96, 165, 250);
        doc.text(`DECLARACIÓN DE ${data.tipo}`, pw / 2, 50, { align: 'center' });

        doc.setDrawColor(59, 130, 246); doc.setLineWidth(0.5);
        doc.line(pw / 2 - 40, 55, pw / 2 + 40, 55);

        doc.setTextColor(200, 200, 200); doc.setFontSize(9);
        const info = [
            ['Empresa:', empresa?.razon_social || empresa?.nombre_comercial || '—'],
            ['RIF:', empresa?.rif || '—'],
            ['Período:', AuditorAgents.labelPeriodo(data.periodo)],
            ['Tipo:', data.tipo],
            ['Tasa aplicada:', data.tasa],
            ['Fecha de emisión:', AuditorPDF._fecha(new Date().toISOString())],
        ];
        info.forEach(([l, v], i) => {
            doc.setFont('Helvetica', 'bold'); doc.text(l, ML, 70 + i * 7);
            doc.setFont('Helvetica', 'normal'); doc.text(v, ML + 45, 70 + i * 7);
        });

        linea(18);
        doc.setDrawColor(59, 130, 246); doc.setLineWidth(0.3);
        doc.line(ML, y, ML + colW, y); linea(4);

        if (data.tipo === 'IVA') {
            write(ML, 'CÁLCULO DE IVA', 11, 'bold', [255, 255, 255]); linea(8);

            const rows = [
                ['Total Ventas:', '$' + AuditorPDF._fmt(data.totalVentas)],
                ['Base Imponible Ventas:', '$' + AuditorPDF._fmt(data.baseVentas)],
                ['IVA Débito (16%):', '$' + AuditorPDF._fmt(data.ivaDebito)],
                ['', ''],
                ['Total Gastos:', '$' + AuditorPDF._fmt(data.totalGastos)],
                ['Base Imponible Gastos:', '$' + AuditorPDF._fmt(data.baseGastos)],
                ['IVA Crédito (16%):', '$' + AuditorPDF._fmt(data.ivaCredito)],
                ['', ''],
                ['IVA a Pagar:', '$' + AuditorPDF._fmt(data.ivaAPagar)],
            ];
            rows.forEach(([l, v]) => {
                if (l) {
                    const isTotal = l === 'IVA a Pagar:';
                    doc.setFont('Helvetica', isTotal ? 'bold' : 'normal');
                    doc.setTextColor(isTotal ? [255, 255, 255] : [200, 200, 200]);
                    doc.text(l, ML + 5, y);
                    doc.setFont('Helvetica', isTotal ? 'bold' : 'normal');
                    doc.text(v, ML + 5 + 80, y);
                }
                linea(6);
            });
        } else if (data.tipo === 'ISLR') {
            write(ML, 'CÁLCULO DE ISLR', 11, 'bold', [255, 255, 255]); linea(8);

            const rows = [
                ['Ingresos:', '$' + AuditorPDF._fmt(data.ingresos)],
                ['Costos:', '$' + AuditorPDF._fmt(data.costos)],
                ['Gastos:', '$' + AuditorPDF._fmt(data.gastos)],
                ['', ''],
                ['Renta Neta:', '$' + AuditorPDF._fmt(data.rentaNeta)],
                ['Tasa:', '25%'],
                ['', ''],
                ['ISLR Estimado:', '$' + AuditorPDF._fmt(data.islrEstimado)],
            ];
            rows.forEach(([l, v]) => {
                if (l) {
                    const isTotal = l === 'ISLR Estimado:';
                    doc.setFont('Helvetica', isTotal ? 'bold' : 'normal');
                    doc.setTextColor(isTotal ? [255, 255, 255] : [200, 200, 200]);
                    doc.text(l, ML + 5, y);
                    doc.setFont('Helvetica', isTotal ? 'bold' : 'normal');
                    doc.text(v, ML + 5 + 80, y);
                }
                linea(6);
            });
        }

        linea(10);
        doc.setDrawColor(100, 116, 139); doc.setLineWidth(0.3);
        doc.line(ML, y, ML + 80, y); linea(6);
        write(ML, auditor || 'Auditor', 9, 'bold', [255, 255, 255]);
        write(ML, 'Firma del Auditor', 7, 'normal', [148, 163, 184]);

        if (callback) callback(doc);
        return doc;
    },

    guardarPDF: (doc, filename) => {
        const pdfBase64 = doc.output('datauristring');
        return { nombre: filename, contenido: pdfBase64, fecha: new Date().toISOString(), tipo: 'application/pdf' };
    },
};

window.AuditorPDF = AuditorPDF;
