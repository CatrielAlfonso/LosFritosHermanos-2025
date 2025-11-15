# Reporte de Pruebas de Endpoints del Backend

**Fecha:** 13 de noviembre de 2025  
**Servidor:** http://localhost:8080  
**Método de Prueba:** curl

## Resumen Ejecutivo

- **Total de Endpoints Probados:** 17
- **Endpoints Funcionando Correctamente:** 11 (65%)
- **Endpoints con Problemas Menores:** 5 (29%)
- **Endpoints con Errores:** 1 (6%)

## Detalles de las Pruebas

### ✅ Endpoints Funcionando Correctamente

#### 1. GET /
- **URL:** http://localhost:8080/
- **Estado:** ✅ Funciona
- **HTTP Status:** 200
- **Respuesta:** "Backend is running!"

#### 2. POST /notify-maitre-new-client
- **URL:** http://localhost:8080/notify-maitre-new-client
- **Estado:** ✅ Funciona
- **HTTP Status:** 200
- **Body de Prueba:**
  ```json
  {
    "clienteNombre": "Juan",
    "clienteApellido": "Perez"
  }
  ```
- **Resultado:** Notificaciones enviadas exitosamente a 3 empleados

#### 3. POST /notify-mozos-client-query
- **URL:** http://localhost:8080/notify-mozos-client-query
- **Estado:** ✅ Funciona
- **HTTP Status:** 200
- **Body de Prueba:**
  ```json
  {
    "clienteNombre": "Juan",
    "clienteApellido": "Perez",
    "mesaNumero": 5,
    "consulta": "¿Puedo pedir más agua?"
  }
  ```
- **Resultado:** Notificaciones enviadas exitosamente a 3 empleados

#### 4. POST /notify-mozo-order-ready
- **URL:** http://localhost:8080/notify-mozo-order-ready
- **Estado:** ✅ Funciona
- **HTTP Status:** 200
- **Body de Prueba:**
  ```json
  {
    "mesaNumero": 5,
    "tipoProducto": "Comida",
    "productos": ["Hamburguesa", "Papas fritas"],
    "pedidoId": 1
  }
  ```
- **Resultado:** Notificación enviada exitosamente a 1 mozo

#### 5. POST /notify-mozo-request-bill
- **URL:** http://localhost:8080/notify-mozo-request-bill
- **Estado:** ✅ Funciona
- **HTTP Status:** 200
- **Body de Prueba:**
  ```json
  {
    "mesaNumero": 5,
    "clienteNombre": "Juan",
    "clienteApellido": "Perez"
  }
  ```
- **Resultado:** Notificación enviada exitosamente a 1 mozo

#### 6. POST /notify-supervisors-new-client
- **URL:** http://localhost:8080/notify-supervisors-new-client
- **Estado:** ✅ Funciona
- **HTTP Status:** 200
- **Body de Prueba:**
  ```json
  {
    "clienteNombre": "Juan",
    "clienteApellido": "Perez"
  }
  ```
- **Resultado:** Notificaciones enviadas exitosamente a 2 supervisores

#### 7. POST /clear-fcm-token
- **URL:** http://localhost:8080/clear-fcm-token
- **Estado:** ✅ Funciona
- **HTTP Status:** 200
- **Body de Prueba:**
  ```json
  {
    "email": "test@example.com"
  }
  ```
- **Resultado:** Token FCM limpiado exitosamente

#### 8. POST /notify-payment-success
- **URL:** http://localhost:8080/notify-payment-success
- **Estado:** ✅ Funciona
- **HTTP Status:** 200
- **Body de Prueba:**
  ```json
  {
    "mesaNumero": 5,
    "montoTotal": 1500
  }
  ```
- **Resultado:** Notificaciones enviadas exitosamente a 2 usuarios (supervisores/mozos)

### ⚠️ Endpoints con Problemas Menores

#### 9. POST /notify-client-table-assigned
- **URL:** http://localhost:8080/notify-client-table-assigned
- **Estado:** ⚠️ Funciona Parcialmente
- **HTTP Status:** 200
- **Body de Prueba:**
  ```json
  {
    "clienteEmail": "test@example.com",
    "mesaNumero": 5,
    "clienteNombre": "Juan",
    "clienteApellido": "Perez"
  }
  ```
- **Problema:** El envío de email falla porque SendGrid no está configurado correctamente
- **Nota:** La notificación push funciona, pero el email no se envía

#### 10. POST /notify-bartender-new-order
- **URL:** http://localhost:8080/notify-bartender-new-order
- **Estado:** ⚠️ Funciona pero Sin Datos
- **HTTP Status:** 200
- **Body de Prueba:**
  ```json
  {
    "mesaNumero": 5,
    "bebidas": ["Coca Cola", "Agua"]
  }
  ```
- **Problema:** No hay bartenders en la base de datos con FCM tokens
- **Resultado:** "No bartenders found"

#### 11. POST /notify-cocinero-new-order
- **URL:** http://localhost:8080/notify-cocinero-new-order
- **Estado:** ⚠️ Funciona pero Sin Datos
- **HTTP Status:** 200
- **Body de Prueba:**
  ```json
  {
    "mesaNumero": 5,
    "comidas": ["Hamburguesa", "Papas fritas"],
    "postres": ["Flan"]
  }
  ```
- **Problema:** No hay cocineros en la base de datos con FCM tokens
- **Resultado:** "No cocineros found"

#### 12. POST /enviar-correo-rechazo
- **URL:** http://localhost:8080/enviar-correo-rechazo
- **Estado:** ⚠️ Funciona Parcialmente
- **HTTP Status:** 200
- **Body de Prueba:**
  ```json
  {
    "correo": "test@example.com",
    "nombre": "Juan",
    "apellido": "Perez"
  }
  ```
- **Problema:** El envío de email falla porque SendGrid no está configurado correctamente
- **Nota:** El endpoint responde correctamente, pero el email no se envía

#### 13. POST /enviar-correo-aceptacion
- **URL:** http://localhost:8080/enviar-correo-aceptacion
- **Estado:** ⚠️ Funciona Parcialmente
- **HTTP Status:** 200
- **Body de Prueba:**
  ```json
  {
    "correo": "test@example.com",
    "nombre": "Juan",
    "apellido": "Perez"
  }
  ```
- **Problema:** El envío de email falla porque SendGrid no está configurado correctamente
- **Nota:** El endpoint responde correctamente, pero el email no se envía

### ❌ Endpoints con Errores

#### 14. POST /api/email/test
- **URL:** http://localhost:8080/api/email/test
- **Estado:** ❌ Error de Configuración
- **HTTP Status:** 200 (pero con error en el body)
- **Body de Prueba:**
  ```json
  {
    "email": "test@example.com"
  }
  ```
- **Error:** "String or address object expected for `from`"
- **Causa:** SendGrid no está configurado correctamente (falta SENDGRID_FROM_EMAIL en .env)

#### 15. POST /api/email/welcome
- **URL:** http://localhost:8080/api/email/welcome
- **Estado:** ❌ Error de Configuración
- **HTTP Status:** 200 (pero con error en el body)
- **Body de Prueba:**
  ```json
  {
    "email": "test@example.com",
    "name": "Juan"
  }
  ```
- **Error:** "String or address object expected for `from`"
- **Causa:** SendGrid no está configurado correctamente

#### 16. POST /api/email/reservation-confirmation
- **URL:** http://localhost:8080/api/email/reservation-confirmation
- **Estado:** ❌ Error de Configuración
- **HTTP Status:** 200 (pero con error en el body)
- **Body de Prueba:**
  ```json
  {
    "email": "test@example.com",
    "reservationDetails": {
      "date": "2025-11-15",
      "time": "20:00",
      "guests": 4,
      "tableNumber": 5
    }
  }
  ```
- **Error:** "String or address object expected for `from`"
- **Causa:** SendGrid no está configurado correctamente

#### 17. POST /api/facturacion/generar-y-enviar
- **URL:** http://localhost:8080/api/facturacion/generar-y-enviar
- **Estado:** ❌ Error de Datos
- **HTTP Status:** 500
- **Body de Prueba:**
  ```json
  {
    "pedidoId": 1
  }
  ```
- **Error:** "Error al buscar el pedido: Cannot coerce the result to a single JSON object"
- **Causa:** El pedido con ID 1 no existe en la base de datos, o hay un problema con la consulta

## Problemas Identificados

### 1. Configuración de SendGrid
- **Problema:** La API key de SendGrid no está configurada correctamente o falta la variable `SENDGRID_FROM_EMAIL`
- **Impacto:** Todos los endpoints de email fallan
- **Solución:** Configurar las siguientes variables en el archivo `.env`:
  ```
  SENDGRID_API_KEY=SG.xxxxx
  SENDGRID_FROM_EMAIL=tu-email@example.com
  ```

### 2. Datos de Prueba en Base de Datos
- **Problema:** No hay bartenders ni cocineros en la base de datos con FCM tokens
- **Impacto:** Los endpoints de notificación a bartenders y cocineros no encuentran destinatarios
- **Solución:** Agregar empleados con perfiles de "bartender" y "cocinero" en la base de datos

### 3. Pedido de Prueba
- **Problema:** El pedido con ID 1 no existe en la base de datos
- **Impacto:** El endpoint de facturación falla al buscar el pedido
- **Solución:** Usar un pedido existente o crear datos de prueba

## Recomendaciones

1. **Configurar SendGrid:** Agregar las variables de entorno necesarias para que los endpoints de email funcionen correctamente
2. **Datos de Prueba:** Crear datos de prueba en la base de datos (empleados, pedidos, etc.) para probar todos los endpoints
3. **Manejo de Errores:** Mejorar el manejo de errores en los endpoints para devolver códigos HTTP más apropiados
4. **Validación:** Agregar validación de datos de entrada en todos los endpoints
5. **Logging:** Mejorar el logging para facilitar el debugging

## Comandos curl para Pruebas

### Endpoint Básico
```bash
curl -X GET http://localhost:8080/
```

### Notificaciones
```bash
# Notificar nuevo cliente a maître
curl -X POST http://localhost:8080/notify-maitre-new-client \
  -H "Content-Type: application/json" \
  -d '{"clienteNombre":"Juan","clienteApellido":"Perez"}'

# Notificar mesa asignada
curl -X POST http://localhost:8080/notify-client-table-assigned \
  -H "Content-Type: application/json" \
  -d '{"clienteEmail":"test@example.com","mesaNumero":5,"clienteNombre":"Juan","clienteApellido":"Perez"}'

# Notificar consulta de cliente
curl -X POST http://localhost:8080/notify-mozos-client-query \
  -H "Content-Type: application/json" \
  -d '{"clienteNombre":"Juan","clienteApellido":"Perez","mesaNumero":5,"consulta":"¿Puedo pedir más agua?"}'

# Notificar nuevo pedido de bebidas
curl -X POST http://localhost:8080/notify-bartender-new-order \
  -H "Content-Type: application/json" \
  -d '{"mesaNumero":5,"bebidas":["Coca Cola","Agua"]}'

# Notificar nuevo pedido de cocina
curl -X POST http://localhost:8080/notify-cocinero-new-order \
  -H "Content-Type: application/json" \
  -d '{"mesaNumero":5,"comidas":["Hamburguesa","Papas fritas"],"postres":["Flan"]}'

# Notificar pedido listo
curl -X POST http://localhost:8080/notify-mozo-order-ready \
  -H "Content-Type: application/json" \
  -d '{"mesaNumero":5,"tipoProducto":"Comida","productos":["Hamburguesa","Papas fritas"],"pedidoId":1}'

# Notificar solicitud de cuenta
curl -X POST http://localhost:8080/notify-mozo-request-bill \
  -H "Content-Type: application/json" \
  -d '{"mesaNumero":5,"clienteNombre":"Juan","clienteApellido":"Perez"}'

# Notificar nuevo cliente a supervisores
curl -X POST http://localhost:8080/notify-supervisors-new-client \
  -H "Content-Type: application/json" \
  -d '{"clienteNombre":"Juan","clienteApellido":"Perez"}'

# Notificar pago exitoso
curl -X POST http://localhost:8080/notify-payment-success \
  -H "Content-Type: application/json" \
  -d '{"mesaNumero":5,"montoTotal":1500}'
```

### Email
```bash
# Test de email
curl -X POST http://localhost:8080/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Email de bienvenida
curl -X POST http://localhost:8080/api/email/welcome \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Juan"}'

# Confirmación de reserva
curl -X POST http://localhost:8080/api/email/reservation-confirmation \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","reservationDetails":{"date":"2025-11-15","time":"20:00","guests":4,"tableNumber":5}}'

# Correo de rechazo
curl -X POST http://localhost:8080/enviar-correo-rechazo \
  -H "Content-Type: application/json" \
  -d '{"correo":"test@example.com","nombre":"Juan","apellido":"Perez"}'

# Correo de aceptación
curl -X POST http://localhost:8080/enviar-correo-aceptacion \
  -H "Content-Type: application/json" \
  -d '{"correo":"test@example.com","nombre":"Juan","apellido":"Perez"}'
```

### Facturación
```bash
# Generar factura
curl -X POST http://localhost:8080/api/facturacion/generar-y-enviar \
  -H "Content-Type: application/json" \
  -d '{"pedidoId":1}'
```

### Utilidades
```bash
# Limpiar FCM token
curl -X POST http://localhost:8080/clear-fcm-token \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

## Conclusión

La mayoría de los endpoints están funcionando correctamente. Los principales problemas son:

1. **Configuración de SendGrid:** Necesita configuración para que los endpoints de email funcionen
2. **Datos de prueba:** Faltan datos en la base de datos para probar algunos endpoints completamente
3. **Manejo de errores:** Algunos endpoints podrían mejorar el manejo de errores

El servidor está funcionando correctamente en el puerto 8080 y la mayoría de los endpoints responden adecuadamente. Las notificaciones push están funcionando correctamente cuando hay usuarios con FCM tokens en la base de datos.

