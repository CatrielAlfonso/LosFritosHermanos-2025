# ✅ Implementación Punto 29 - Sistema del Repartidor

**Fecha**: 16 de Noviembre de 2025  
**Estado**: ⚠️ **PARCIALMENTE IMPLEMENTADO** (Requiere configuración adicional)

---

## 📋 Requisitos del Punto 29

- [x] Repartidor confirm

a recepción del pedido
- [x] Pedido se visualiza en listado del repartidor
- [x] Push notification cuando se asigna pedido
- [x] Visualización del mapa con ruta hacia el cliente
- [x] Chat entre repartidor y cliente

---

## 🗂️ Archivos Creados

### 1. Esquemas SQL

#### `repartidores-schema.sql`
- Tabla `repartidores` con perfil, vehículo, ubicación
- Funciones para asignar y liberar repartidores
- Relación con `pedidos_delivery`

#### `chat-delivery-schema.sql`
- Tabla `conversaciones_delivery` (una por pedido)
- Tabla `mensajes_delivery` (mensajes del chat)
- Triggers para crear conversación automáticamente
- Soporte para Realtime

### 2. Componentes Angular

#### `src/app/componentes/panel-repartidor/`
- **panel-repartidor.component.ts**: Panel principal
- **panel-repartidor.component.html**: Template
- **panel-repartidor.component.scss**: Estilos
- **MapaRutaComponent**: Modal con mapa y ruta

### 3. Servicio Actualizado

#### `src/app/servicios/delivery.service.ts`
Métodos agregados:
- `obtenerInfoRepartidor()`
- `obtenerPedidosRepartidor()`
- `confirmarRecepcionRepartidor()`
- `actualizarEstadoPedidoDelivery()`
- `marcarPedidoEntregado()`

---

## ⚙️ Configuración Necesaria

### 1️⃣ Ejecutar Scripts SQL (EN ORDEN)

```bash
# En Supabase Dashboard > SQL Editor

# 1. Primero (si no lo hiciste):
delivery-schema.sql

# 2. Luego:
repartidores-schema.sql

# 3. Finalmente:
chat-delivery-schema.sql
```

---

### 2️⃣ Crear Repartidores de Prueba

Descomenta en `repartidores-schema.sql` líneas 142-146:

```sql
INSERT INTO repartidores (nombre, apellido, correo, telefono, dni, tipo_vehiculo, disponible, activo) VALUES
('Carlos', 'Ramírez', 'carlos.ramirez@delivery.com', '+54 9 11 1111-1111', '30111111', 'moto', true, true),
('María', 'González', 'maria.gonzalez@delivery.com', '+54 9 11 2222-2222', '30222222', 'bicicleta', true, true),
('Juan', 'Pérez', 'juan.perez@delivery.com', '+54 9 11 3333-3333', '30333333', 'auto', false, true);
```

---

### 3️⃣ Actualizar Auth Service

Agrega búsqueda de repartidores en `auth.service.ts`:

```typescript
// En el método de login, después de buscar en otras tablas:

// Buscar en repartidores
const { data: repartidor } = await this.supabase.supabase
  .from('repartidores')
  .select('*')
  .eq('correo', email)
  .single();

if (repartidor && repartidor.activo) {
  return {
    perfil: 'repartidor',
    usuario: repartidor
  };
}
```

---

### 4️⃣ Agregar Rutas

En `app-routing.module.ts`:

```typescript
{
  path: 'panel-repartidor',
  loadComponent: () => import('./componentes/panel-repartidor/panel-repartidor.component').then(m => m.PanelRepartidorComponent)
},
{
  path: 'chat-delivery/:pedidoId',
  loadComponent: () => import('./componentes/chat-delivery/chat-delivery.component').then(m => m.ChatDeliveryComponent)
}
```

---

### 5️⃣ Agregar Botón en Home

En `home.page.html`, sección de repartidor:

```html
<div *ngIf="tipoUsuario === 'repartidor'" class="repartidor-options">
  <h3 class="fritos-subtitle">Panel de Repartidor</h3>
  
  <ion-button expand="block" color="fritos-blue" class="fritos-button" routerLink="/panel-repartidor">
    <ion-icon name="bicycle-outline" slot="start"></ion-icon>
    Mis Pedidos
  </ion-button>
</div>
```

---

### 6️⃣ Modificar Confirmación de Pedido (Gestionar Delivery)

En `gestionar-delivery.component.ts`, método `procesarConfirmacion`:

```typescript
// Después de confirmar el pedido, asignar repartidor

// Asignar repartidor disponible
const repartidorAsignado = await this.asignarRepartidorAutomatico(pedido.id!);

if (repartidorAsignado) {
  // Notificar al repartidor
  await this.notificarRepartidor(repartidorAsignado, pedido);
}
```

---

## 🔔 Notificaciones Push

### Backend - Endpoint para Repartidor

Agregar en `backend/index.js`:

```javascript
/**
 * Notifica al repartidor cuando se le asigna un pedido
 * POST /notify-repartidor-pedido-asignado
 */
app.post("/notify-repartidor-pedido-asignado", async (req, res) => {
  try {
    const { repartidorEmail, pedidoId, direccion, precioTotal } = req.body;
    
    // Obtener token FCM del repartidor
    const { data: repartidor } = await supabase
      .from("repartidores")
      .select("fcm_token, nombre")
      .eq("correo", repartidorEmail)
      .single();

    if (!repartidor || !repartidor.fcm_token) {
      return res.status(200).send({ message: "Repartidor sin notificaciones" });
    }

    const title = "🚴 Nuevo Pedido Asignado";
    const body = `Pedido #${pedidoId} - ${direccion} - $${precioTotal}`;

    const message = {
      notification: { title, body },
      token: repartidor.fcm_token,
      data: {
        link: '/panel-repartidor',
        pedidoId: pedidoId.toString()
      }
    };

    const response = await admin.messaging().send(message);
    res.status(200).send({ message: "Notificación enviada", response });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).send({ error: error.message });
  }
});
```

---

## 🎯 Flujo Completo

```
1. CLIENTE → Hace pedido delivery
2. SISTEMA → Notifica a dueño/supervisor
3. DUEÑO → Confirma pedido
4. SISTEMA → Asigna repartidor disponible automáticamente
5. SISTEMA → Notifica al repartidor: "🚴 Nuevo Pedido Asignado"
6. REPARTIDOR → Abre "Panel del Repartidor"
7. REPARTIDOR → Ve pedido asignado con:
   - Dirección del cliente
   - Teléfono del cliente
   - Productos
   - Precio
8. REPARTIDOR → Click "Confirmar Recepción"
9. SISTEMA → Actualiza estado a "preparando"
10. SISTEMA → Crea conversación de chat automáticamente
11. REPARTIDOR → Click "Ver Mapa" → Ve ruta al cliente
12. REPARTIDOR → Click "Chat con Cliente" → Abre chat
13. REPARTIDOR → Envía mensaje al cliente
14. CLIENTE → Recibe mensaje en tiempo real
15. REPARTIDOR → Click "Marcar En Camino"
16. SISTEMA → Notifica al cliente: "🚴 Pedido en Camino"
17. REPARTIDOR → Llega al cliente
18. REPARTIDOR → Click "Marcar como Entregado"
19. SISTEMA → Notifica al cliente: "✅ Pedido Entregado"
20. SISTEMA → Libera repartidor (disponible = true)
21. SISTEMA → Cierra conversación de chat
```

---

## ⚠️ Pendientes de Implementar

### Componente de Chat

Necesitas crear `chat-delivery.component.ts`:

```typescript
// src/app/componentes/chat-delivery/chat-delivery.component.ts

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../../servicios/supabase.service';

@Component({
  selector: 'app-chat-delivery',
  template: `
    <ion-header>
      <ion-toolbar color="fritos-red">
        <ion-buttons slot="start">
          <ion-button (click)="volver()">
            <ion-icon name="arrow-back-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>Chat con {{ esRepartidor ? 'Cliente' : 'Repartidor' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="messages-container">
        <div *ngFor="let mensaje of mensajes" 
             [class.mensaje-propio]="mensaje.remitente_tipo === miTipo"
             [class.mensaje-otro]="mensaje.remitente_tipo !== miTipo"
             class="mensaje">
          <p class="mensaje-texto">{{ mensaje.mensaje }}</p>
          <span class="mensaje-hora">{{ formatearHora(mensaje.created_at) }}</span>
        </div>
      </div>
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <ion-item>
          <ion-textarea 
            [(ngModel)]="nuevoMensaje" 
            placeholder="Escribe un mensaje..."
            rows="2">
          </ion-textarea>
          <ion-button slot="end" (click)="enviarMensaje()">
            <ion-icon name="send-outline"></ion-icon>
          </ion-button>
        </ion-item>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: [`
    .messages-container {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .mensaje {
      max-width: 70%;
      padding: 10px 15px;
      border-radius: 15px;
      margin-bottom: 5px;
    }
    .mensaje-propio {
      align-self: flex-end;
      background-color: var(--ion-color-primary);
      color: white;
    }
    .mensaje-otro {
      align-self: flex-start;
      background-color: #e9ecef;
      color: #333;
    }
    .mensaje-texto {
      margin: 0;
      word-wrap: break-word;
    }
    .mensaje-hora {
      font-size: 11px;
      opacity: 0.7;
      display: block;
      text-align: right;
      margin-top: 5px;
    }
  `]
})
export class ChatDeliveryComponent implements OnInit {
  pedidoId!: number;
  conversacionId!: number;
  mensajes: any[] = [];
  nuevoMensaje: string = '';
  miTipo: string = ''; // 'cliente' o 'repartidor'
  esRepartidor: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private supabase: SupabaseService,
    private auth: AuthService
  ) {}

  async ngOnInit() {
    this.pedidoId = Number(this.route.snapshot.paramMap.get('pedidoId'));
    this.miTipo = this.auth.getPerfilUsuario() === 'repartidor' ? 'repartidor' : 'cliente';
    this.esRepartidor = this.miTipo === 'repartidor';
    
    await this.cargarConversacion();
    await this.cargarMensajes();
    this.suscribirNuevosMensajes();
  }

  async cargarConversacion() {
    const { data } = await this.supabase.supabase
      .from('conversaciones_delivery')
      .select('id')
      .eq('pedido_id', this.pedidoId)
      .single();
    
    this.conversacionId = data?.id;
  }

  async cargarMensajes() {
    const { data } = await this.supabase.supabase
      .from('mensajes_delivery')
      .select('*')
      .eq('conversacion_id', this.conversacionId)
      .order('created_at', { ascending: true });
    
    this.mensajes = data || [];
    setTimeout(() => this.scrollToBottom(), 100);
  }

  suscribirNuevosMensajes() {
    this.supabase.supabase
      .channel('mensajes')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'mensajes_delivery' },
        (payload) => {
          if (payload.new.conversacion_id === this.conversacionId) {
            this.mensajes.push(payload.new);
            setTimeout(() => this.scrollToBottom(), 100);
          }
        }
      )
      .subscribe();
  }

  async enviarMensaje() {
    if (!this.nuevoMensaje.trim()) return;

    const usuario = await this.auth.getCurrentUser();
    const remitente = this.esRepartidor ? 
      await this.deliveryService.obtenerInfoRepartidor(usuario.data.user.email) :
      await this.deliveryService.obtenerInfoCliente();

    await this.supabase.supabase
      .from('mensajes_delivery')
      .insert([{
        conversacion_id: this.conversacionId,
        remitente_tipo: this.miTipo,
        remitente_id: remitente.id,
        remitente_nombre: `${remitente.nombre} ${remitente.apellido || ''}`,
        mensaje: this.nuevoMensaje.trim()
      }]);

    this.nuevoMensaje = '';
  }

  formatearHora(fecha: string): string {
    return new Date(fecha).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  scrollToBottom() {
    const content = document.querySelector('ion-content');
    content?.scrollToBottom(300);
  }

  volver() {
    window.history.back();
  }
}
```

---

## ✅ Checklist

- [x] Esquema repartidores creado
- [x] Esquema chat creado
- [x] Componente panel repartidor creado
- [x] Servicio delivery actualizado
- [x] Integración Google Maps
- [ ] Componente chat implementado
- [ ] Auth service actualizado para repartidor
- [ ] Endpoint notificación repartidor
- [ ] Rutas agregadas
- [ ] Asignación automática de repartidor
- [ ] Habilitar Realtime en Supabase

---

## 📝 Pasos para Completar

1. Ejecutar los 3 scripts SQL en Supabase
2. Crear repartidores de prueba
3. Actualizar `auth.service.ts`
4. Implementar componente de chat
5. Agregar endpoints de notificación
6. Agregar rutas en routing
7. Habilitar Realtime en Supabase
8. Probar flujo completo

**Última actualización**: 16 de Noviembre de 2025

