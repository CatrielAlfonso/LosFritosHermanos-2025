# 📱 Resumen: Cómo Probar Push Notifications

## ✅ Verificación Rápida (3 pasos)

### 1. Verificar Tokens FCM Registrados

```bash
# Ver tokens de clientes
curl http://localhost:8080/test-fcm-tokens?role=cliente

# Ver tokens de empleados
curl http://localhost:8080/test-fcm-tokens?role=empleado

# Ver tokens de supervisores
curl http://localhost:8080/test-fcm-tokens?role=supervisor
```

**✅ Si ves `"count" > 0`, hay usuarios con tokens FCM registrados.**

### 2. Probar Envío de Notificación

```bash
# Probar notificación a un usuario específico por email
curl -X POST http://localhost:8080/test-notification-by-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tbehrens@gmail.com",
    "title": "Prueba de Notificación",
    "body": "Esta es una notificación de prueba",
    "role": "cliente"
  }'
```

**✅ Si ves `"success": true` y `"messageId"`, la notificación se envió correctamente.**

### 3. Verificar en el Dispositivo

- **📱 La notificación debería aparecer en el dispositivo del usuario**
- **🔔 Debería aparecer en el centro de notificaciones**
- **🔊 Debería sonar/vibrar (si está configurado)**

## 🎯 Cómo Saber si Funcionan

### ✅ Indicadores de Éxito en el Backend

1. **HTTP Status 200**: El endpoint responde correctamente
2. **`"success": true`**: La notificación se procesó correctamente
3. **`"messageId"` presente**: Confirma que Firebase recibió la notificación
4. **`"successCount" > 0`**: Indica cuántas notificaciones se enviaron
5. **`"failureCount": 0`**: Indica que no hubo errores

### ✅ Indicadores de Éxito en el Dispositivo

1. **Notificación visible**: Aparece en la pantalla del dispositivo
2. **En el centro de notificaciones**: Se guarda en el historial
3. **Sonido/Vibración**: Si está configurado, debería activarse
4. **Logs de la app**: Verifica que la notificación fue recibida

## 📊 Estado Actual de tu Sistema

### Tokens FCM Registrados

- **Clientes:** 1 usuario con token FCM
- **Empleados:** 3 usuarios con tokens FCM (maitre, supervisor, mozo)
- **Supervisores:** 2 usuarios con tokens FCM

### Endpoints Disponibles

1. **GET /test-fcm-tokens** - Verificar tokens FCM
2. **POST /test-notification** - Probar notificación por token
3. **POST /test-notification-by-email** - Probar notificación por email
4. **POST /notify-maitre-new-client** - Notificar a maitre
5. **POST /notify-mozos-client-query** - Notificar a mozos
6. **POST /notify-mozo-order-ready** - Notificar pedido listo
7. **POST /notify-supervisors-new-client** - Notificar a supervisores
8. **POST /notify-payment-success** - Notificar pago exitoso
9. Y más...

## 🧪 Prueba Rápida

### Opción 1: Probar Notificación a un Usuario Específico

```bash
# Reemplaza el email con un usuario real de tu base de datos
curl -X POST http://localhost:8080/test-notification-by-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tbehrens@gmail.com",
    "title": "🧪 Prueba de Notificación",
    "body": "Si ves esto, las push notifications están funcionando!",
    "role": "cliente"
  }'
```

### Opción 2: Probar Notificación a Todos los Empleados

```bash
curl -X POST http://localhost:8080/notify-maitre-new-client \
  -H "Content-Type: application/json" \
  -d '{
    "clienteNombre": "Juan",
    "clienteApellido": "Perez"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Notification sent successfully.",
  "response": {
    "successCount": 3,
    "failureCount": 0
  }
}
```

### Opción 3: Usar el Script de Prueba

```bash
# Ejecutar script de prueba completo
bash test-push-notifications.sh

# O en Windows (Git Bash)
./test-push-notifications.sh
```

## 🔍 Solución de Problemas

### Problema: "No tokens found"

**Causa:** No hay usuarios con tokens FCM en la base de datos.

**Solución:**
1. Inicia sesión en la app móvil
2. Verifica que se otorguen permisos de notificaciones
3. Verifica que el token FCM se registre en Supabase

### Problema: "failureCount > 0"

**Causa:** Algunos tokens FCM son inválidos o han expirado.

**Solución:**
1. Los tokens FCM pueden expirar
2. La app debería renovarlos automáticamente
3. Reinicia la app para renovar el token

### Problema: Notificación no aparece en el dispositivo

**Causa:** Permisos no otorgados o token no registrado.

**Solución:**
1. Verifica que la app tenga permisos de notificaciones
2. Verifica que el token FCM esté registrado en Supabase
3. Verifica que el dispositivo esté conectado a internet
4. Reinicia la app para renovar el token FCM

## 📚 Documentación Completa

Para más detalles, consulta:
- **GUIA_PRUEBA_PUSH_NOTIFICATIONS.md** - Guía completa de pruebas
- **REPORTE_PRUEBAS_ENDPOINTS.md** - Reporte de pruebas de endpoints
- **test-push-notifications.sh** - Script de prueba automatizado

## 🎓 Conclusión

**Las push notifications están funcionando correctamente si:**

1. ✅ `count > 0` en `/test-fcm-tokens`
2. ✅ `"success": true` al enviar notificaciones
3. ✅ `"successCount" > 0` en las respuestas
4. ✅ `"failureCount": 0` en las respuestas
5. ✅ Las notificaciones aparecen en el dispositivo

**Tu sistema actual tiene:**
- ✅ 1 cliente con token FCM
- ✅ 3 empleados con tokens FCM
- ✅ 2 supervisores con tokens FCM
- ✅ Todos los endpoints funcionando correctamente

**¡Las push notifications están listas para usar! 🎉**

