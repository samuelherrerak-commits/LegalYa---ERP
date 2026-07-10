# LegalYa Auditor Suite — Blueprint v1.0

> **Constitución del sistema.** Toda decisión técnica, todo código, toda integración debe poder rastrearse hasta una sección de este documento. Si no está aquí, no existe.

---

## Índice

1. [Filosofía del Sistema](#1-filosofía-del-sistema)
2. [Reglas Inmutables](#2-reglas-inmutables)
3. [Arquitectura General](#3-arquitectura-general)
4. [Catálogo de Procesos de Negocio](#4-catálogo-de-procesos-de-negocio)
5. [Dependencias entre Procesos](#5-dependencias-entre-procesos)
6. [Modelo de Datos](#6-modelo-de-datos)
7. [Catálogo de Agentes](#7-catálogo-de-agentes)
8. [Workflow Base de Todos los Agentes](#8-workflow-base-de-todos-los-agentes)
9. [ICC — Índice de Confiabilidad Contable](#9-icc--índice-de-confiabilidad-contable)
10. [Estados de Proceso](#10-estados-de-proceso)
11. [Reglas de Negocio](#11-reglas-de-negocio)
12. [Integración con LegalYa Comercios](#12-integración-con-legalya-comercios)
13. [Professional Library](#13-professional-library)
14. [LLM — Alcance y Límites](#14-llm--alcance-y-límites)

---

## 1. Filosofía del Sistema

### 1.1 Qué es LegalYa Auditor Suite

LegalYa Auditor Suite es un sistema de **análisis, validación, automatización y emisión de documentos profesionales** para despachos contables. No registra transacciones, no modifica la contabilidad, no lleva libros contables.

### 1.2 Qué NO es

- No es un ERP.
- No es un módulo de contabilidad.
- No es un generador de dashboards bonitos.
- No es un experimento de IA.

### 1.3 Principios rectores

| Principio | Significado |
|-----------|------------|
| **Procesos, no módulos** | El sistema se organiza por flujos de trabajo, no por pantallas. |
| **Journal es la fuente única de verdad** | Auditor solo lee datos de `empresas` y `journal`. No los modifica. |
| **Sin proceso definido, no hay código** | No se escribe ni una línea sin un workflow real que la justifique. |
| **Datos reales primero** | No se crean dashboards, tablas ni agentes con data ficticia. |
| **Un agente, una responsabilidad** | Cada agente IA hace exactamente una cosa. |
| **El ICC es el termómetro del despacho** | Todo proceso alimenta o es alimentado por el ICC. |

---

## 2. Reglas Inmutables

1. **Regla de Oro:** Ningún código puede escribirse si no existe un flujo de trabajo real que lo justifique.
2. **Regla de los Datos:** Toda pantalla debe funcionar con datos reales desde el primer momento. No se construyen vistas sin fuente de datos conectada.
3. **Regla del Journal:** Auditor nunca escribe en `journal`. Solo lee.
4. **Regla de la IA:** El LLM solo hace redacción, resúmenes y explicaciones. Nunca hace cálculos, estados financieros, IVA, prestaciones ni ninguna operación numérica.
5. **Regla de Dependencia:** Ningún proceso puede ejecutarse si sus procesos predecesores no están completos (ver [sección 5](#5-dependencias-entre-procesos)).
6. **Regla de la Biblioteca:** Todo conocimiento normativo (leyes, normas, plantillas) vive en la Professional Library escrito por humanos, no generado por IA.
7. **Regla de Consistencia:** Todos los agentes siguen exactamente el mismo patrón de workflow.

---

## 3. Arquitectura General

```
┌─────────────────────────────────────────────────┐
│                   app.js                         │
│    (Auth → Ruteo → RootApp)                     │
└──────────────────┬──────────────────────────────┘
                   │ rol === 'AUDITOR'
                   ▼
┌─────────────────────────────────────────────────┐
│              AuditorPanel                        │
│    Provider + Layout + Sidebar + Router          │
└──────────────────┬──────────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
┌────────┐  ┌────────────┐  ┌──────────┐
│  Auth  │  │   Layout   │  │  Router  │
│  (ya   │  │  Sidebar   │  │          │
│ existe)│  │  Header    │  │          │
└────────┘  └────────────┘  └──────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │   Dashboard  │   │  Centro de   │   │   Empresa    │
   │  Profesional │   │ Operaciones  │   │  (Expediente)│
   └──────────────┘   └──────────────┘   └──────────────┘
          │                   │
          ▼                   ▼
   ┌──────────────┐   ┌──────────────┐
   │   Business   │   │  Servicios   │
   │ Intelligence │   │ Profesionales│
   └──────────────┘   └──────────────┘
          │                   │
          ▼                   ▼
   ┌──────────────┐   ┌──────────────┐
   │  Agentes IA  │   │ Obligaciones │
   └──────────────┘   └──────────────┘
          │                   │
          ▼                   ▼
   ┌──────────────┐   ┌──────────────┐
   │  Auditorías  │   │ Configuración│
   └──────────────┘   └──────────────┘
```

### 3.1 Capas

```
┌──────────────────────────────────────────────┐
│              UI Layer (React)                  │
│   Componentes puros, sin lógica de negocio    │
├──────────────────────────────────────────────┤
│           Process Layer (Workflows)            │
│   Orquestación de pasos, estados, reglas      │
├──────────────────────────────────────────────┤
│            Agent Layer (IA)                    │
│   Agentes especializados, un solo propósito   │
├──────────────────────────────────────────────┤
│           Data Layer (Supabase)                │
│   Lectura: empresas, journal                   │
│   Escritura: tablas propias de Auditor         │
└──────────────────────────────────────────────┘
```

---

## 4. Catálogo de Procesos de Negocio

### 4.1 Dashboard Profesional

**Propósito:** Responder "¿qué debo hacer hoy?"

**Workflow:**
```
1. Cargar conteos de todos los procesos pendientes
   → Solicitudes pendientes
   → Declaraciones pendientes
   → Estados Financieros pendientes
   → Conciliaciones pendientes
   → Empresas con ICC crítico (C/D)
   → Alertas activas
   → Vencimientos del día
2. Calcular ICC global del despacho
3. Mostrar actividad reciente (últimos 7 días)
4. Mostrar agenda de vencimientos
5. Mostrar alertas activas
```

**Output:** Pantalla única, sin navegación interna. Cada item es un link directo al proceso correspondiente.

---

### 4.2 Centro de Operaciones

**Propósito:** Gestionar todas las tareas pendientes del despacho desde un solo lugar.

**Workflow:**
```
1. Listar tareas pendientes agrupadas por proceso:
   - Declaraciones pendientes
   - Conciliaciones pendientes
   - Solicitudes pendientes
   - Estados Financieros pendientes
   - Auditorías pendientes
2. Cada tarea muestra:
   - Empresa
   - Tipo de proceso
   - Fecha límite
   - Estado actual
   - Prioridad (calculada por ICC + vencimiento)
3. Al seleccionar una tarea → abre el proceso correspondiente
```

**Reglas:**
- Las tareas se ordenan por prioridad (no por fecha).
- La prioridad se calcula: `(1 / días_restantes) * (100 - ICC_score)`.

---

### 4.3 Empresas → Expediente

**Propósito:** Acceder a la información completa de una empresa.

**Workflow:**
```
1. Listar empresas (búsqueda + filtro por ICC)
2. Seleccionar empresa → abrir expediente
3. Expediente contiene:
   └── Datos generales (razón social, RIF, última operación)
   └── ICC (score, categoría, indicadores, histórico)
   └── Estados Financieros (emitidos + pendientes)
   └── Declaraciones (IVA, ISLR, IGTF, Retenciones)
   └── Conciliaciones Bancarias (por banco)
   └── Auditorías (historial de auditorías)
   └── Historial (actividad cronológica)
```

---

### 4.4 Servicios Profesionales

**Propósito:** Gestionar solicitudes de documentos profesionales que no son obligaciones fiscales.

**Workflow:**
```
1. Cliente solicita servicio
2. Contador recibe la solicitud en Centro de Operaciones
3. Contador verifica requisitos:
   - La empresa debe estar activa
   - El ICC mínimo requerido depende del servicio:
     - Certificación de Ingresos: ICC ≥ 40
     - Carta Bancaria: ICC ≥ 40
     - Informe Especial: ICC ≥ 65
     - Constancias: sin restricción
     - Asesorías: sin restricción
4. Si cumple → Agente correspondiente procesa
5. Si no cumple → Notificar al cliente + tareas correctivas
6. Documento generado → Contador revisa y firma
7. Documento finalizado → Entregar (descarga QR)
```

**Catálogo de Servicios:**
| Servicio | ICC Mínimo | Agente Encargado |
|----------|-----------|-----------------|
| Certificación de Ingresos | 40 | Certification Agent |
| Carta Bancaria | 40 | Certification Agent |
| Informe Especial | 65 | Audit Master Agent |
| Constancia | 0 | Certification Agent |
| Asesoría | 0 | HR Agent / Tax Agent |
| Estados Financieros Certificados | 65 | Financial Statements Agent |

---

### 4.5 Obligaciones — Declaraciones

**Propósito:** Gestionar el ciclo completo de declaraciones tributarias.

**Workflow IVA:**
```
1. Seleccionar empresa + período
2. Leer journal del período
3. Calcular débito fiscal (ventas gravadas)
4. Calcular crédito fiscal (compras gravadas)
5. Determinar si hay conciliaciones bancarias pendientes
6. Si hay conciliaciones pendientes → BLOQUEAR emisión
7. Tax Agent revisa inconsistencias
8. Generar declaración
9. Contador aprueba
10. Declaración finalizada → actualizar ICC
```

**Workflow ISLR:**
```
1. Seleccionar empresa + ejercicio fiscal
2. Leer journal del ejercicio
3. Calcular enriquecimiento neto
4. Verificar conciliaciones bancarias del período
5. Si hay conciliaciones pendientes → BLOQUEAR emisión
6. Tax Agent revisa
7. Generar declaración
8. Contador aprueba
9. Declaración finalizada → actualizar ICC
```

**Workflow IGTF:**
```
1. Seleccionar empresa + período
2. Leer transacciones en divisas del journal
3. Calcular IGTF
4. Tax Agent revisa
5. Generar declaración
6. Contador aprueba
```

---

### 4.6 Obligaciones — Conciliaciones Bancarias

**Propósito:** Conciliar movimientos bancarios con el journal contable.

**Workflow:**
```
1. Cliente sube estado bancario (PDF, Excel, CSV)
2. OCR extrae movimientos
3. Buscar movimientos correspondientes en journal
   - Por monto
   - Por fecha aproximada (±3 días)
   - Por referencia
4. Marcar coincidencias
5. Listar diferencias
6. Contador revisa diferencias
7. Por cada diferencia:
   - Si es error en journal → marcar para corrección
   - Si es error bancario → notificar al cliente
   - Si es timing → arrastrar al próximo período
8. Contador aprueba conciliación
9. Conciliación finalizada → actualizar ICC
```

**Regla crítica:** No pueden emitirse declaraciones si hay conciliaciones pendientes del mismo período.

---

### 4.7 Obligaciones — Estados Financieros

**Propósito:** Emisión de Estados Financieros certificados.

**Workflow:**
```
1. Seleccionar empresa + período
2. Verificar conciliaciones bancarias del período
3. Si hay conciliaciones pendientes → BLOQUEAR emisión
4. Leer journal del período
5. Financial Statements Agent genera borrador
6. Calcular indicadores financieros
7. Contador revisa y ajusta
8. Contador aprueba
9. Estados Financieros finalizados → actualizar ICC
```

---

### 4.8 Obligaciones — RRHH

**Propósito:** Cálculo de prestaciones, vacaciones, parafiscales y utilidades.

**Workflow:**
```
1. Seleccionar empresa
2. Cargar data de nómina del período
3. HR Agent calcula:
   - Prestaciones sociales
   - Vacaciones
   - Utilidades
   - Aportes parafiscales (IVSS, FAOV, INCES, LPH)
4. Contador revisa
5. Contador aprueba
6. Documentos generados → actualizar ICC
```

---

### 4.9 Auditorías

**Propósito:** Ejecutar auditorías contables, tributarias, laborales, de inventario, documentales y bancarias.

**Workflow General:**
```
1. Seleccionar empresa + tipo de auditoría
2. Definir alcance (período, áreas)
3. Audit Master Agent orquesta agentes específicos
4. Cada agente ejecuta su análisis
5. Consolidar hallazgos
6. Generar informe de auditoría
7. Contador revisa
8. Informe finalizado → entregar
```

**Tipos de Auditoría:**
| Tipo | Agente | Propósito |
|------|--------|-----------|
| Contable | Accounting Agent | Asientos, cuentas, partidas descuadradas |
| Tributaria | Tax Agent | Cumplimiento de obligaciones |
| Laboral | HR Agent | Prestaciones, nómina, parafiscales |
| Inventario | Inventory Agent | Diferencias con journal |
| Documental | Certification Agent | Expediente y requisitos |
| Bancaria | Bank Agent | Conciliaciones |

---

### 4.10 Business Intelligence

**Propósito:** Proveer indicadores claves del despacho y de cada empresa.

**Indicadores:**
| Indicador | Fuente | Cálculo |
|-----------|--------|---------|
| ICC Global | Promedio ICC de todas las empresas | `Σ(ICC_score) / n_empresas` |
| Empresas en Riesgo | Conteo ICC C/D | `empresas.filter(icc.categoria in [C,D])` |
| Tiempo promedio por proceso | Log de procesos | `Σ(tiempo_finalizacion - tiempo_inicio) / n_procesos` |
| Productividad por contador | Log de procesos por usuario | `n_procesos_completados / período` |
| Cumplimiento ICC | Evolución mensual | `ICC_score(período_actual) - ICC_score(período_anterior)` |
| Alertas activas | Sistema de alertas | `alertas.filter(estado == 'activa').count` |

---

### 4.11 Configuración

**Propósito:** Parámetros del despacho.

**Secciones:**
- Usuarios y roles (contador, administrador, auxiliar)
- Tarifas por servicio y categoría ICC
- Plantillas de documentos (Professional Library)
- Parámetros de agentes IA (umbrales, reglas)
- Configuración de ICC (pesos por indicador)

---

## 5. Dependencias entre Procesos

```
                        ┌─────────────────┐
                        │   Empresa dada  │
                        │   de alta en    │
                        │ LegalYa Comercio│
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Tiene movtos   │
                        │  en journal     │
                        └────────┬────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │  ICC calculado (base)    │
                    └────────┬────────────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ Conciliación │ │  RRHH        │ │  Auditoría   │
    │  Bancaria    │ │  (nómina)    │ │  Inicial     │
    └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
           │                │                │
           ▼                ▼                ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ Declaración  │ │  Estados     │ │  Servicios   │
    │  IVA / ISLR  │ │  Financieros │ │  (si aplica) │
    │  / IGTF      │ │              │ │              │
    └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
           │                │                │
           └────────────────┼────────────────┘
                            ▼
                    ┌─────────────────┐
                    │  ICC actualizado │
                    │  (post-procesos) │
                    └─────────────────┘
```

### Reglas de dependencia explícitas:

1. **ICC base** debe existir antes de cualquier proceso.
2. **Conciliaciones Bancarias** deben estar completas antes de emitir **Declaraciones** o **Estados Financieros** del mismo período.
3. **RRHH** es independiente de conciliaciones, pero requiere datos de nómina cargados.
4. **Auditorías** pueden ejecutarse en cualquier momento, pero su alcance depende del ICC actual.
5. **Servicios Profesionales** tienen requisitos de ICC mínimo según el tipo.
6. **Estados Financieros** requieren que todas las declaraciones del período estén completas.

---

## 6. Modelo de Datos

### 6.1 Tablas existentes (solo lectura)

| Tabla | Propósito | Columnas relevantes |
|-------|-----------|-------------------|
| `empresas` | Empresas afiliadas | `id, rif, nombre, created_at` |
| `journal` | Libro diario | `id, empresa_id, fecha, codigo_cuenta, debe, haber, concepto, ref_doc` |

### 6.2 Tablas nuevas de Auditor (escritura)

**`auditor_procesos`** — Registro de todos los procesos ejecutados.
```
id              UUID (PK)
empresa_id      UUID (FK → empresas)
tipo_proceso    ENUM: declaracion_iva, declaracion_islr, declaracion_igtf,
                      conciliacion_bancaria, estados_financieros, rrhh,
                      auditoria_contable, auditoria_tributaria, auditoria_laboral,
                      auditoria_inventario, auditoria_documental, auditoria_bancaria,
                      certificacion_ingresos, carta_bancaria, informe_especial,
                      constancia, asesoria
estado          ENUM: pendiente, en_proceso, revision, aprobado, rechazado, archivado
banco           VARCHAR(100) NULL  -- solo para conciliaciones
periodo_inicio  DATE
periodo_fin     DATE
fecha_limite    DATE
prioridad       INTEGER (calculada)
asignado_a      UUID (FK → usuarios)
created_at      TIMESTAMP
updated_at      TIMESTAMP
completed_at    TIMESTAMP NULL
metadata        JSONB  -- datos específicos del proceso
```

**`auditor_icc_historico`** — Historial de ICC por empresa.
```
id              UUID (PK)
empresa_id      UUID (FK → empresas)
score           INTEGER (0-100)
categoria       CHAR(1): A, B, C, D
indicadores     JSONB
periodo         DATE (mes/año)
created_at      TIMESTAMP
```

**`auditor_conciliaciones`** — Detalle de conciliaciones bancarias.
```
id              UUID (PK)
proceso_id      UUID (FK → auditor_procesos)
banco           VARCHAR(100)
fecha_estado    DATE
movimientos_banco  JSONB  -- movimientos extraídos del estado
movimientos_journal JSONB -- movimientos correspondientes en journal
coincidencias   INTEGER
diferencias     INTEGER
estado          ENUM: en_curso, revisando, aprobada
metadata        JSONB
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

**`auditor_documentos`** — Documentos emitidos.
```
id              UUID (PK)
proceso_id      UUID (FK → auditor_procesos)
empresa_id      UUID (FK → empresas)
tipo            VARCHAR(100)
contenido       TEXT  -- documento generado
hash            VARCHAR(64)  -- para verificación
qr_code         TEXT  -- URL de verificación
estado          ENUM: borrador, revisado, firmado, entregado
firmado_por     UUID (FK → usuarios) NULL
fecha_firma     TIMESTAMP NULL
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

**`auditor_alertas`** — Alertas generadas por agentes.
```
id              UUID (PK)
empresa_id      UUID (FK → empresas)
proceso_id      UUID (FK → auditor_procesos) NULL
tipo            VARCHAR(50): critico, medio, informativo
titulo          VARCHAR(255)
descripcion     TEXT
agente          VARCHAR(100)  -- agente que generó la alerta
estado          ENUM: activa, resuelta, ignorada
created_at      TIMESTAMP
resolved_at     TIMESTAMP NULL
```

**`auditor_usuarios`** — Usuarios del despacho (separado de auth de Comercios).
```
id              UUID (PK)
nombre          VARCHAR(255)
email           VARCHAR(255)
rol             ENUM: administrador, contador, auxiliar
activo          BOOLEAN DEFAULT true
created_at      TIMESTAMP
```

**`auditor_professional_library`** — Biblioteca de conocimiento (ver sección 13).

**`auditor_workflow_log`** — Log de ejecución de workflows.
```
id              UUID (PK)
proceso_id      UUID (FK → auditor_procesos)
agente          VARCHAR(100)
paso            VARCHAR(255)
entrada         JSONB
salida          JSONB
duracion_ms     INTEGER
error           TEXT NULL
created_at      TIMESTAMP
```

---

## 7. Catálogo de Agentes

### 7.1 Accounting Agent

**Responsabilidad:** Analizar asientos contables y detectar errores.

**Input:** `journal` de una empresa + período.
**Output:** Hallazgos contables (asientos descuadrados, cuentas mal clasificadas, saldos inconsistentes).
**Acción sobre ICC:** Actualiza indicador `contable`.

### 7.2 Tax Agent

**Responsabilidad:** Revisar obligaciones fiscales.

**Input:** `journal` + datos de la empresa + normativa vigente.
**Output:** Cálculos de IVA, ISLR, IGTF, retenciones; detección de incumplimientos.
**Acción sobre ICC:** Actualiza indicador `tributaria`.

### 7.3 Financial Statements Agent

**Responsabilidad:** Generar Estados Financieros.

**Input:** `journal` de una empresa + período.
**Output:** Balance General, Estado de Resultados, Flujo de Efectivo, notas.
**Acción sobre ICC:** Actualiza indicador `contable`.

### 7.4 Bank Agent

**Responsabilidad:** Conciliar movimientos bancarios.

**Input:** Estado bancario (OCR) + `journal`.
**Output:** Coincidencias, diferencias, hallazgos.
**Acción sobre ICC:** Actualiza indicador `bancaria`.

### 7.5 Inventory Agent

**Responsabilidad:** Analizar diferencias de inventario.

**Input:** Conteo físico + `journal` (compras, ventas, ajustes).
**Output:** Diferencias, pérdidas, ajustes necesarios.
**Acción sobre ICC:** Actualiza indicador `inventario`.

### 7.6 HR Agent

**Responsabilidad:** Calcular prestaciones, vacaciones, utilidades, parafiscales.

**Input:** Data de nómina + normativa LOTTT.
**Output:** Cálculos de prestaciones, recibos, declaraciones.
**Acción sobre ICC:** Actualiza indicador `laboral`.

### 7.7 Certification Agent

**Responsabilidad:** Emitir certificaciones y constancias.

**Input:** Datos de la empresa + `journal` + plantilla.
**Output:** Documento certificado con QR.
**Acción sobre ICC:** Ninguna (no modifica indicadores).

### 7.8 Audit Master Agent

**Responsabilidad:** Orquestar auditorías completas.

**Input:** Empresa + tipo de auditoría + alcance.
**Output:** Informe de auditoría consolidado.
**Acción sobre ICC:** Actualiza indicador `documental`.

---

## 8. Workflow Base de Todos los Agentes

```
┌─────────────────────────────────────────────┐
│          1. Seleccionar empresa               │
│          2. Leer journal del período          │
│          3. Leer datos auxiliares             │
│             (según tipo de agente)            │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│          4. Procesar                          │
│             (lógica pura, sin LLM)            │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│          5. Generar hallazgos                │
│          6. Si hay alertas →                 │
│             crear alerta en auditor_alertas  │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│          7. Actualizar ICC                   │
│             (solo si aplica)                 │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│          8. Generar documento                │
│             (LLM solo aquí, si aplica)        │
│          9. Contador revisa y aprueba        │
│          10. Proceso finalizado              │
└─────────────────────────────────────────────┘
```

---

## 9. ICC — Índice de Confiabilidad Contable

### 9.1 Definición

El ICC es un score de 0 a 100 que mide la salud contable de una empresa basado exclusivamente en los datos del `journal` y los procesos completados en Auditor.

### 9.2 Indicadores y Pesos

| Indicador | Peso | Fuente |
|-----------|------|--------|
| Salud Tributaria | 25% | Tax Agent + declaraciones al día |
| Salud Contable | 20% | Accounting Agent + Estados Financieros emitidos |
| Salud Bancaria | 20% | Bank Agent + conciliaciones al día |
| Salud Inventario | 10% | Inventory Agent |
| Salud Laboral | 10% | HR Agent + obligaciones laborales al día |
| Salud Documental | 10% | Certification Agent + expediente completo |
| Riesgo Financiero | 5% | Financial Statements Agent |

### 9.3 Categorías

| Categoría | Rango | Significado |
|-----------|-------|-------------|
| A | 85-100 | Excelente. La empresa cumple con todas sus obligaciones. |
| B | 65-84 | Bueno. La empresa está al día pero con oportunidades de mejora. |
| C | 40-64 | Regular. Requiere atención en áreas específicas. |
| D | 0-39 | Crítico. Incumplimientos que requieren acción inmediata. |

### 9.4 Cuándo se actualiza

Al completar cualquiera de estos procesos:
- Declaración IVA → actualiza `tributaria`
- Declaración ISLR → actualiza `tributaria`
- Declaración IGTF → actualiza `tributaria`
- Conciliación Bancaria → actualiza `bancaria`
- Estados Financieros → actualiza `contable`
- RRHH (cálculo completo) → actualiza `laboral`
- Auditoría → actualiza `documental` + indicador correspondiente
- Certificación → no actualiza ICC

---

## 10. Estados de Proceso

### 10.1 Estados universales

```
PENDIENTE → EN_PROCESO → REVISION → APROBADO → ARCHIVADO
                              │
                              ▼
                         RECHAZADO
```

| Estado | Significado |
|--------|-------------|
| `PENDIENTE` | Creado pero no iniciado. Visible en Centro de Operaciones. |
| `EN_PROCESO` | El agente está trabajando. |
| `REVISION` | Procesado por el agente, esperando revisión del contador. |
| `APROBADO` | Contador aprobó. Documento emitido si aplica. |
| `RECHAZADO` | Contador rechazó. Se requiere corrección. |
| `ARCHIVADO` | Proceso completado y archivado. |

### 10.2 Estados específicos por proceso

**Conciliación Bancaria:**
```
EN_CURSO → REVISANDO → APROBADA
```

**Documento emitido:**
```
BORRADOR → REVISADO → FIRMADO → ENTREGADO
```

**Alerta:**
```
ACTIVA → RESUELTA | IGNORADA
```

---

## 11. Reglas de Negocio

### 11.1 Reglas de proceso

1. **RN-001:** Toda empresa debe tener ICC calculado antes de procesar cualquier servicio.
2. **RN-002:** No se pueden emitir declaraciones si el período tiene conciliaciones bancarias pendientes.
3. **RN-003:** No se pueden emitir Estados Financieros si hay declaraciones pendientes del período.
4. **RN-004:** Los Servicios Profesionales requieren ICC mínimo según el tipo.
5. **RN-005:** Toda alerta crítica debe resolverse antes de aprobar el proceso relacionado.
6. **RN-006:** El contador siempre debe revisar y aprobar antes de emitir un documento final.
7. **RN-007:** Los agentes IA proponen, el contador dispone.
8. **RN-008:** Un proceso rechazado vuelve a `PENDIENTE` con la nota de rechazo como referencia.

### 11.2 Reglas del ICC

9. **RN-009:** El ICC inicial de una empresa nueva es 0 (categoría D).
10. **RN-010:** El ICC solo puede aumentar completando procesos reales. No hay "puntos bonus".
11. **RN-011:** El ICC se recalcula cada vez que se completa un proceso que afecta sus indicadores.
12. **RN-012:** Un indicador cae si su proceso correspondiente no se ejecuta en más de 90 días.

### 11.3 Reglas de datos

13. **RN-013:** Auditor nunca escribe en `empresas` ni en `journal`.
14. **RN-014:** Toda interacción con datos externos debe pasar por una API o capa de datos centralizada.
15. **RN-015:** Todo log de workflow debe persistirse en `auditor_workflow_log`.

---

## 12. Integración con LegalYa Comercios

### 12.1 Dependencias

Auditor requiere que LegalYa Comercios provea:

1. **Autenticación compartida** (o al menos SSO). Los usuarios son los mismos.
2. **Acceso a `empresas`** — lista de empresas afiliadas.
3. **Acceso a `journal`** — libro diario completo.
4. **Webhooks** (opcional) para notificar cuando una empresa nueva se da de alta o cuando hay movimientos nuevos en journal.

### 12.2 Separación

- Los usuarios de Comercios no necesariamente tienen acceso a Auditor (y viceversa).
- La configuración del despacho (tarifas, plantillas, agentes) es propia de Auditor.
- El ICC es propio de Auditor. Comercios puede consultarlo (solo lectura) si necesita mostrarlo.

### 12.3 Tabla puente sugerida

```
auditor_empresas_vinculadas
───────────────────────────
id              UUID (PK)
empresa_id      UUID (FK → empresas)
activa_para_auditor BOOLEAN DEFAULT false
icc_automatico  BOOLEAN DEFAULT true  -- calcular ICC automáticamente?
config_icc      JSONB  -- pesos personalizados (opcional)
created_at      TIMESTAMP
```

---

## 13. Professional Library

### 13.1 Propósito

Repositorio de conocimiento normativo, legal y técnico escrito **exclusivamente por humanos**. La IA nunca genera este contenido.

### 13.2 Contenido

| Categoría | Contenido |
|-----------|-----------|
| Normas Laborales | LOTTT, Reglamento, Convenciones Colectivas |
| Normas Tributarias | Código Orgánico Tributario, Ley IVA, Ley ISLR, Ley IGTF |
| Normas Contables | PCGA, VEN-NIF, Código de Comercio |
| Plantillas | Modelos de certificaciones, constancias, informes |
| Procedimientos | Pasos documentados para cada proceso |
| Tarifas | Aranceles recomendados por servicio y categoría ICC |

### 13.3 Estructura

```
professional_library/
├── laboral/
│   ├── lottt.md
│   ├── parafiscales.md
│   └── prestaciones.md
├── tributario/
│   ├── iva.md
│   ├── islr.md
│   ├── igtf.md
│   └── retenciones.md
├── contable/
│   ├── p cga.md
│   ├── ven-nif.md
│   └── catalogo_cuentas.md
├── plantillas/
│   ├── certificacion_ingresos.md
│   ├── constancia_trabajo.md
│   ├── informe_auditoria.md
│   └── carta_bancaria.md
└── procedimientos/
    ├── conciliacion_bancaria.md
    ├── emision_ef.md
    └── auditoria_contable.md
```

### 13.4 Uso

- Los agentes pueden **consultar** la Professional Library para fundamentar sus hallazgos.
- El LLM puede **referenciar** la biblioteca para redactar informes, pero nunca modificarla.

---

## 14. LLM — Alcance y Límites

### 14.1 Qué puede hacer el LLM

- Redactar informes de auditoría en lenguaje natural.
- Resumir hallazgos técnicos para el cliente.
- Explicar conceptos contables/tributarios al contador.
- Sugerir redacción de notas a los Estados Financieros.
- Generar resúmenes ejecutivos.

### 14.2 Qué NO puede hacer el LLM

- Calcular IVA.
- Calcular ISLR.
- Calcular prestaciones sociales.
- Emitir Estados Financieros.
- Determinar categorías ICC.
- Modificar reglas de negocio.
- Escribir en la Professional Library.
- Tomar decisiones de aprobación.

### 14.3 Principio

> **La IA redacta, el contador decide.**
> **Los cálculos son lógica dura, no IA.**
> **El conocimiento normativo es humano, no generado.**

---

## Apéndice A: Glosario

| Término | Definición |
|---------|-----------|
| ICC | Índice de Confiabilidad Contable. Score 0-100. |
| Proceso | Unidad atómica de trabajo en Auditor. Tiene un inicio, fin y estado. |
| Agente | Programa especializado que ejecuta un paso de un proceso. |
| Workflow | Secuencia de pasos que define cómo se completa un proceso. |
| Journal | Libro diario contable. Única fuente de verdad del sistema. |
| Professional Library | Biblioteca de conocimiento normativo escrita por humanos. |
| Hallazgo | Resultado del análisis de un agente. Puede generar alertas. |
| Despacho | Entidad que usa LegalYa Auditor. Estudio contable. |

---

## Apéndice B: Convenciones de Código

- **Nombres de componentes:** `PascalCase` (ej. `AuditorPanel`, `CentroOperaciones`).
- **Nombres de funciones:** `camelCase` (ej. `calcularICC`, `generarDeclaracion`).
- **Nombres de tablas:** `snake_case` con prefijo `auditor_`.
- **Nombres de columnas:** `snake_case`.
- **Estados:** `MAYUSCULAS` con guion bajo (ej. `EN_PROCESO`, `APROBADO`).
- **Agentes:** `PascalCase` + `Agent` (ej. `TaxAgent`, `BankAgent`).
- **Archivos JS:** `PascalCase` para componentes (ej. `AuditorPanel.js`).
- **Archivos de lógica:** `camelCase` (ej. `calcularICC.js`).

---

*LegalYa Auditor Suite Blueprint v1.0 — Julio 2026*
