# COMANDO PARA MODELO DE CODIFICACIÓN

## **TAREA PRINCIPAL:**
Actualizar código existente para reflejar la documentación actualizada. El código actual fue desarrollado con documentación anterior y NO cumple con los cambios críticos implementados.

## **OBJETIVOS:**
1. **MIGRAR** entidades obsoletas (Guarantee_Payment, User_Balance) → arquitectura Movement central
2. **IMPLEMENTAR** nuevas funcionalidades: competencia externa, sistema reembolsos, notificaciones duales
3. **CORREGIR** lógica de saldos con nueva fórmula y cache automático
4. **CREAR** controllers/services/routes faltantes para nuevas entidades

## **DOCUMENTOS DE REFERENCIA OBLIGATORIOS:**
- **`doc/RESUMEN_CAMBIOS_PARA_CODIFICACION.md`** - **GUÍA PRINCIPAL** con mapeo exacto de cambios
- **`doc/DocumentacionCambios.md`** - Cambios críticos de arquitectura
- **`doc/Prerequisitos.md`** - Definición actual de entidades y reglas de negocio  
- **`doc/DocumentacionAPI.md`** - Endpoints y contratos actualizados
- **`doc/Notificaciones.md`** - Sistema de notificaciones duales
- **`doc/HU Detalladas`** - Documentacion de todas las HU
- **`doc/HU Detalladas/VERIFICACION_CONSISTENCIA.md`** - Validación de flujos


## **PRIORIDADES DE IMPLEMENTACIÓN:**
1. **CRÍTICO:** Migrar Prisma schema + crear Movement central + funciones cache saldos
2. **IMPORTANTE:** Sistema notificaciones + competencia externa + reembolsos  
3. **COMPLEMENTARIO:** Facturación + paneles UI

## **VALIDACIÓN DE ÉXITO:**
- ❌ Cero referencias a `GuaranteePayment` o `UserBalance` en código
- ✅ Fórmula única `Saldo Disponible = Total - Retenido - Aplicado` funcionando
- ✅ 19 HU Detalladas reflejadas en código funcional
- ✅ 8 tipos de notificaciones automáticas operativas