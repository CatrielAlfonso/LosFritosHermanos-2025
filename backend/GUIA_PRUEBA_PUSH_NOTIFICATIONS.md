# Guía de Prueba de Push Notifications

## 📱 Cómo Probar las Push Notifications

Esta guía te ayudará a verificar que las push notifications están funcionando correctamente en tu aplicación.

## 🔍 Verificación de Funcionamiento

### 1. Verificar Tokens FCM en la Base de Datos

Las push notifications funcionan mediante tokens FCM (Firebase Cloud Messaging) que se almacenan en Supabase. Para verificar si hay tokens:

#### Opción A: Desde Supabase Dashboard
1. Ve a tu proyecto en Supabase
2. Navega a la sección "Table Editor"
3. Verifica las tablas: `clientes`, `empleados`, `supervisores`
4. Busca la columna `fcm_token` y verifica que haya valores no nulos

#### Opción B: Desde SQL Query
```sql
-- Ver clientes con tokens FCM
SELECT correo, nombre, apellido, fcm_token 
FROM clientes 
WHERE fcm_token IS NOT NULL;

-- Ver empleados con tokens FCM
SELECT correo, nombre, apellido, perfil, fcm_token 
FROM empleados 
WHERE fcm_token IS NOT NULL;

-- Ver supervisores con tokens FCM
SELECT correo, nombre, apellido, fcm_token 
FROM supervisores 
WHERE fcm_token IS NOT NULL;
```

### 2. Verificar que la App Móvil Está Registrando Tokens

1. **Inicia sesión en la app móvil** (cliente, empleado o supervisor)
2. **La app debería registrar automáticamente el token FCM** cuando:
   - El usuario inicia sesión
   - La app se inicia
   - Se otorgan permisos de notificaciones

3. **Verifica en los logs de la app** que se está registrando el token:
   - Busca mensajes como "FCM Token obtenido: ..."
   - Verifica que el token se está actualizando en Supabase

### 3. Probar Envío de Notificaciones con curl

Una vez que tengas tokens FCM en la base de datos, puedes probar el envío de notificaciones:

#### Prueba 1: Notificar a Empleados (Maitre)
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
    "responses": [
      {
        "success": true,
        "messageId": "projects/fritos-hermanos/messages/0:..."
      }
    ],
    "successCount": 3,
    "failureCount": 0
  }
}
```

**Indicadores de éxito:**
- ✅ `"success": true`
- ✅ `"successCount"` > 0 (indica cuántas notificaciones se enviaron)
- ✅ `"failureCount": 0` (indica que no hubo errores)
- ✅ `"messageId"` presente (cada ID confirma que la notificación se envió)

#### Prueba 2: Notificar a Cliente (Mesa Asignada)
```bash
curl -X POST http://localhost:8080/notify-client-table-assigned \
  -H "Content-Type: application/json" \
  -d '{
    "clienteEmail": "cliente@example.com",
    "mesaNumero": 5,
    "clienteNombre": "Juan",
    "clienteApellido": "Perez"
  }'
```

**Nota:** Reemplaza `"cliente@example.com"` con el email de un cliente que tenga un token FCM registrado.

#### Prueba 3: Notificar a Mozos (Consulta de Cliente)
```bash
curl -X POST http://localhost:8080/notify-mozos-client-query \
  -H "Content-Type: application/json" \
  -d '{
    "clienteNombre": "Juan",
    "clienteApellido": "Perez",
    "mesaNumero": 5,
    "consulta": "¿Puedo pedir más agua?"
  }'
```

#### Prueba 4: Notificar a Bartender (Nuevo Pedido)
```bash
curl -X POST http://localhost:8080/notify-bartender-new-order \
  -H "Content-Type: application/json" \
  -d '{
    "mesaNumero": 5,
    "bebidas": ["Coca Cola", "Agua"]
  }'
```

#### Prueba 5: Notificar a Cocinero (Nuevo Pedido)
```bash
curl -X POST http://localhost:8080/notify-cocinero-new-order \
  -H "Content-Type: application/json" \
  -d '{
    "mesaNumero": 5,
    "comidas": ["Hamburguesa", "Papas fritas"],
    "postres": ["Flan"]
  }'
```

#### Prueba 6: Notificar a Mozo (Pedido Listo)
```bash
curl -X POST http://localhost:8080/notify-mozo-order-ready \
  -H "Content-Type: application/json" \
  -d '{
    "mesaNumero": 5,
    "tipoProducto": "Comida",
    "productos": ["Hamburguesa", "Papas fritas"],
    "pedidoId": 1
  }'
```

#### Prueba 7: Notificar a Mozo (Solicitud de Cuenta)
```bash
curl -X POST http://localhost:8080/notify-mozo-request-bill \
  -H "Content-Type: application/json" \
  -d '{
    "mesaNumero": 5,
    "clienteNombre": "Juan",
    "clienteApellido": "Perez"
  }'
```

#### Prueba 8: Notificar a Supervisores (Nuevo Cliente)
```bash
curl -X POST http://localhost:8080/notify-supervisors-new-client \
  -H "Content-Type: application/json" \
  -d '{
    "clienteNombre": "Juan",
    "clienteApellido": "Perez"
  }'
```

#### Prueba 9: Notificar Pago Exitoso
```bash
curl -X POST http://localhost:8080/notify-payment-success \
  -H "Content-Type: application/json" \
  -d '{
    "mesaNumero": 5,
    "montoTotal": 1500
  }'
```

## 🎯 Cómo Saber si Funcionan

### Verificación en el Backend

1. **Respuesta HTTP 200**: El endpoint responde correctamente
2. **successCount > 0**: Indica que se enviaron notificaciones
3. **failureCount = 0**: Indica que no hubo errores
4. **messageId presente**: Cada ID confirma el envío

### Verificación en la App Móvil

1. **Notificación aparece en el dispositivo**: La notificación debería aparecer en la pantalla
2. **Notificación en la bandeja**: Debería aparecer en el centro de notificaciones
3. **Sonido/Vibración**: Si está configurado, debería sonar/vibrar
4. **Logs de la app**: Verifica en los logs que la notificación fue recibida

### Verificación en los Logs del Backend

Revisa los logs del servidor para ver mensajes como:
```
Successfully sent message: { responses: [...], successCount: 3, failureCount: 0 }
```

## ⚠️ Problemas Comunes

### 1. "No empleados found" o "No tokens found"

**Causa:** No hay usuarios con tokens FCM en la base de datos.

**Solución:**
- Verifica que la app móvil esté registrando tokens FCM
- Verifica que los usuarios tengan permisos de notificaciones
- Verifica en Supabase que haya tokens FCM no nulos

### 2. "failureCount > 0"

**Causa:** Algunos tokens FCM son inválidos o han expirado.

**Solución:**
- Los tokens FCM pueden expirar, la app debería renovarlos automáticamente
- Verifica que los tokens en la base de datos sean válidos
- Limpia tokens inválidos con el endpoint `/clear-fcm-token`

### 3. "successCount = 0"

**Causa:** No hay usuarios con tokens FCM para notificar.

**Solución:**
- Verifica que haya usuarios con tokens FCM en la base de datos
- Verifica que los filtros (perfil, rol) sean correctos
- Verifica que los usuarios estén activos

### 4. Notificación no aparece en el dispositivo

**Causa:** Permisos de notificaciones no otorgados o token FCM no registrado.

**Solución:**
- Verifica que la app tenga permisos de notificaciones
- Verifica que el token FCM esté registrado en Supabase
- Verifica que el dispositivo esté conectado a internet
- Reinicia la app para renovar el token FCM

## 🧪 Script de Prueba Completo

Crea un archivo `test-push-notifications.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:8080"

echo "=== PRUEBA DE PUSH NOTIFICATIONS ==="
echo ""

echo "1. Probando notificación a empleados (maitre)..."
curl -X POST $BASE_URL/notify-maitre-new-client \
  -H "Content-Type: application/json" \
  -d '{"clienteNombre":"Juan","clienteApellido":"Perez"}' \
  | jq '.'
echo ""

echo "2. Probando notificación a mozos (consulta)..."
curl -X POST $BASE_URL/notify-mozos-client-query \
  -H "Content-Type: application/json" \
  -d '{"clienteNombre":"Juan","clienteApellido":"Perez","mesaNumero":5,"consulta":"¿Puedo pedir más agua?"}' \
  | jq '.'
echo ""

echo "3. Probando notificación a mozos (pedido listo)..."
curl -X POST $BASE_URL/notify-mozo-order-ready \
  -H "Content-Type: application/json" \
  -d '{"mesaNumero":5,"tipoProducto":"Comida","productos":["Hamburguesa","Papas fritas"],"pedidoId":1}' \
  | jq '.'
echo ""

echo "4. Probando notificación a supervisores..."
curl -X POST $BASE_URL/notify-supervisors-new-client \
  -H "Content-Type: application/json" \
  -d '{"clienteNombre":"Juan","clienteApellido":"Perez"}' \
  | jq '.'
echo ""

echo "=== PRUEBAS COMPLETADAS ==="
```

## 📊 Verificación de Tokens FCM

### Endpoint para Verificar Tokens

**✅ Ya está implementado en el backend!**

Puedes usar el endpoint `/test-fcm-tokens` para verificar tokens FCM:

**Uso:**
```bash
# Ver tokens de clientes
curl http://localhost:8080/test-fcm-tokens?role=cliente

# Ver tokens de empleados
curl http://localhost:8080/test-fcm-tokens?role=empleado

# Ver tokens de supervisores
curl http://localhost:8080/test-fcm-tokens?role=supervisor
```

**Respuesta esperada:**
```json
{
  "role": "cliente",
  "table": "clientes",
  "count": 1,
  "tokens": [
    {
      "email": "cliente@example.com",
      "name": "Juan Perez",
      "perfil": "cliente",
      "hasToken": true,
      "tokenLength": 152,
      "tokenPreview": "dK8x9yZ2aB3cD4eF5g..."
    }
  ]
}
```

**Indicadores:**
- ✅ `count > 0`: Hay usuarios con tokens FCM
- ✅ `hasToken: true`: El usuario tiene un token válido
- ✅ `tokenLength > 0`: El token tiene una longitud válida

## 🔧 Endpoints de Prueba de Notificación Individual

**✅ Ya están implementados en el backend!**

### 1. Probar Notificación por Token FCM

**Endpoint:** `POST /test-notification`

**Uso:**
```bash
curl -X POST http://localhost:8080/test-notification \
  -H "Content-Type: application/json" \
  -d '{
    "token": "TU_TOKEN_FCM_AQUI",
    "title": "Prueba de Notificación",
    "body": "Esta es una notificación de prueba"
  }'
```

### 2. Probar Notificación por Email (Más fácil)

**Endpoint:** `POST /test-notification-by-email`

**Uso:**
```bash
curl -X POST http://localhost:8080/test-notification-by-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente@example.com",
    "title": "Prueba de Notificación",
    "body": "Esta es una notificación de prueba",
    "role": "cliente"
  }'
```

**Ventajas:**
- ✅ No necesitas conocer el token FCM
- ✅ Busca automáticamente el token en la base de datos
- ✅ Valida que el usuario existe y tiene token
- ✅ Roles disponibles: `cliente`, `empleado`, `supervisor`

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "Notification sent successfully.",
  "user": {
    "email": "cliente@example.com",
    "name": "Juan Perez"
  },
  "messageId": "projects/fritos-hermanos/messages/0:..."
}
```

## 📝 Checklist de Verificación

- [ ] Tokens FCM están registrados en Supabase
- [ ] La app móvil está registrando tokens FCM
- [ ] Los permisos de notificaciones están otorgados
- [ ] El backend está funcionando (puerto 8080)
- [ ] Firebase Admin está configurado correctamente
- [ ] Las notificaciones aparecen en el dispositivo
- [ ] Los logs del backend muestran envíos exitosos
- [ ] `successCount > 0` en las respuestas
- [ ] `failureCount = 0` en las respuestas

## 🎓 Resumen

Para verificar que las push notifications funcionan:

1. **Verifica tokens FCM** en la base de datos
2. **Prueba los endpoints** con curl
3. **Revisa las respuestas** (`successCount`, `failureCount`)
4. **Verifica en el dispositivo** que las notificaciones aparezcan
5. **Revisa los logs** del backend para confirmar el envío

Si `successCount > 0` y `failureCount = 0`, las notificaciones están funcionando correctamente. Si las notificaciones no aparecen en el dispositivo, verifica los permisos y el registro del token FCM en la app móvil.

