# Arquitectura Funcional — Sistema de Subastas Industriales
La arquitectura funcional del sistema se organiza en dos grandes áreas: **Módulos de Administración** y **Módulos de Cliente**, cada una con submódulos que permiten cubrir las operaciones principales de la plataforma.

- Ordenados por prioridad

### MÓDULOS ADMIN (Ruta: `/admin-subastas`)

1. **Gestión de Subastas**
    
    Permite crear, editar y gestionar subastas con estados completos:
    
    - Registro de datos de subasta + activo en un solo paso
    - Asignación de ganador y cálculo automático de garantía (8%)
    - Control de estados: activa → pendiente → en_validacion → finalizada → ganada/perdida/penalizada → facturada
    - Gestión de competencia externa (BOB vs otras empresas)

2. **Validación de Transacciones**
    
    Interfaz para gestionar transacciones (Movement) realizadas por clientes:
    
    - Lista de transacciones pendientes de validación con priorización
    - Visualización de comprobantes desde Cloudinary
    - Aprobación o rechazo con actualización automática de cache de saldos
    - Validaciones automáticas (monto, fecha, voucher, número operación)

3. **Gestión de Competencia Externa**
    
    Control del resultado de BOB en competencia con otras empresas:
    
    - Registro de resultado (BOB ganó/perdió/cliente no pagó vehículo)
    - Activación automática de procesos según resultado
    - Gestión de penalidades cuando cliente no completa pago del vehículo
    - Notificaciones automáticas a clientes según resultado

4. **Gestión de Facturación**
    
    Administración de facturas generadas cuando BOB gana:
    
    - Visualización de facturas creadas por clientes ganadores
    - Seguimiento de aplicación de saldos a compras de vehículos
    - Gestión del estado facturada de subastas

5. **Gestión de Reembolsos**
    
    Procesamiento de solicitudes de reembolso de clientes:
    
    - Lista de solicitudes con estados (solicitado/confirmado/procesado/rechazado)
    - Confirmación telefónica de solicitudes
    - Procesamiento con datos bancarios (devolver dinero) o aplicación interna (mantener saldo)
    - Creación de Movement correspondiente según tipo de reembolso

6. **Gestión de Saldos con Transacciones**
    
    Consulta y administración del saldo calculado desde transacciones:
    
    - Saldos calculados en tiempo real: Total - Retenido - Aplicado
    - Movimientos detallados desde entidad Movement central
    - Cache automático actualizado vía lógica de aplicación
    - Resumen financiero de todos los clientes

7. **Panel de Notificaciones**
    
    Centro de notificaciones administrativas con priorización:
    
    - Notificaciones de alta prioridad (pagos registrados, solicitudes reembolso)
    - Notificaciones informativas (billing generado, penalidades procesadas)
    - Acciones directas desde notificaciones a módulos correspondientes
    - Sistema dual (UI + correo vía EmailJS)


### MÓDULOS CLIENTE (Ruta: `/pago-subastas`)

1. **Identificación de Cliente**
    
    Pantalla de ingreso con validación y carga de saldo desde cache automático:
    
    - Validación por documento (DNI/CE/RUC/Pasaporte)
    - Carga de datos y saldo desde cache (User.saldo_total, User.saldo_retenido)
    - Cálculo de saldo disponible usando nueva fórmula
    - Gestión de sesión temporal (1 hora)

2. **Registro de Pago de Garantía**
    
    Formulario paso a paso para registro de transacciones tipo pago_garantia:
    
    - Flujo 4 pasos: validación datos → selección subasta → datos pago → confirmación
    - Campos Movement: monto, número operación, voucher, concepto, moneda
    - Creación automática de Movement con referencias (auction/offer)
    - Notificaciones automáticas (cliente + admin)

3. **Mi Saldo**
    
    Dashboard de saldo calculado en tiempo real:
    
    - Desglose completo: Total - Retenido - Aplicado = Disponible
    - Información desde cache automático + cálculo Billing
    - Enlaces rápidos a historial y solicitar reembolso
    - Visualización clara de componentes del saldo

4. **Historial de Transacciones**
    
    Listado completo de Movement del cliente:
    
    - Todas las transacciones: pago_garantia, reembolso, penalidad, ajuste_manual
    - Filtros por tipo, estado, fecha, monto
    - Enlaces contextuales a detalles (comprobantes, seguimientos)
    - Información adicional según tipo de transacción

5. **Gestión de Reembolsos**
    
    Sistema completo de solicitud y seguimiento de reembolsos:
    
    - Solicitar reembolso (monto + tipo: mantener_saldo/devolver_dinero)
    - Historial de solicitudes con estados
    - Detalle de cada solicitud con timeline visual
    - Descarga de comprobantes cuando aplica

6. **Completar Facturación**
    
    Formulario para clientes ganadores cuando BOB gana competencia:
    
    - Formulario con datos billing (documento, nombre/razón social)
    - Creación automática de Billing y cambio a estado facturada
    - Aplicación de saldo retenido al pago del vehículo
    - Liberación de saldo_retenido cuando se completa

7. **Panel de Notificaciones**
    
    Centro de notificaciones del cliente:
    
    - 8 tipos de eventos automáticos (ganador, pago validado/rechazado, competencia, penalidad, reembolso)
    - Badge dinámico con contador de no leídas
    - Navegación contextual directa a acciones correspondientes
    - Sistema dual (UI + correo vía EmailJS)


### **CARACTERÍSTICAS TÉCNICAS IMPLEMENTADAS**

1. **Sistema de Transacciones Central**
    
    Arquitectura basada en entidad Movement como registro único:
    
    - Todas las operaciones financieras registradas en Movement
    - Referencias genéricas vía Movement_References
    - Cache automático de saldos actualizado vía lógica de aplicación
    - Eliminación de entidades obsoletas (Guarantee_Payment, User_Balance)

2. **Flujo de Competencia Externa**
    
    Gestión completa del proceso BOB vs otras empresas:
    
    - Estados específicos: finalizada → ganada/perdida/penalizada → facturada
    - Activación automática de procesos según resultado
    - Penalidades correctas (30% cuando cliente no paga vehículo completo)
    - Facturación separada del registro de pago

3. **Sistema de Notificaciones Dual**
    
    Notificaciones automáticas UI + correo electrónico:
    
    - 8 tipos de eventos automáticos identificados
    - Integración con EmailJS (200 correos/mes plan gratuito)
    - Registro en base de datos + envío por correo simultáneo
    - Sistema de reintentos para correos fallidos

4. **Arquitectura de Saldos Redefinida**
    
    Cálculo dinámico desde múltiples fuentes:
    
    - Fórmula única: Saldo Disponible = Total - Retenido - Aplicado
    - Movement para transacciones reales
    - Billing para saldo aplicado (ventas)
    - Cache en User actualizado en tiempo real

5. **Sistema de Reembolsos Robusto**
    
    Flujo completo de gestión de reembolsos:
    
    - Entidad Refund para solicitudes
    - Flujo: solicitado → confirmado → procesado
    - Dos tipos: mantener_saldo (entrada) vs devolver_dinero (salida)
    - Confirmación telefónica obligatoria antes de procesar