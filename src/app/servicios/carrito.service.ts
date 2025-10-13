import { computed, effect, Injectable, signal } from '@angular/core';

export interface CartItem {
  id: string;                    
  productoId: string;           
  nombre: string;               
  tipo: 'comida' | 'bebida' | 'postre';    
  tiempoElaboracion : string;
  precioUnitario: number;       
  cantidad: number;             
  observaciones?: string;       
  imagen?: string;              
  precioTotal: number;          
}

export interface Pedido {
  cliente_id : string
  comidas : any[]
  bebidas : any[]
  postres : any[]
  precio : number        
  tiempo_estimado : number
  confirmado : boolean
  mesa : string
  estado: 'pendiente' | 'en preparacion' | 'listo' | 'entregado' | 'cancelado' | 'rechazado' | 'finalizado'
  estado_comida : 'listo' | 'en preparacion' | 'cancelado' | 'pendiente'
  estado_bebida : 'listo' | 'en preparacion' | 'cancelado' | 'pendiente'
  estado_postre : 'listo' | 'en preparacion' | 'cancelado' | 'pendiente'
  recepcion : boolean
  pagado : number
  cuenta: number               
  fecha_pedido: any
  motivo_rechazo : string
  observaciones_generales?: string; 
  solicita_cuenta?: boolean
  cuenta_habilitada?: boolean
}



@Injectable({
  providedIn: 'root'
})
export class CarritoService {

  private readonly CART_STORAGE_KEY = 'restaurant_carrito';

  private cartItems = signal<CartItem[]>(this.cargarCarritoDesdeStorage());

  totalItems = computed(() => 
    this.cartItems().reduce((total, item) => total + item.cantidad, 0)
  );

  totalPrecio = computed(() =>
    this.cartItems().reduce((total, item) => total + item.precioTotal, 0)
  );

  isEmpty = computed(() => this.cartItems().length === 0);

  
  
  constructor() {
    // EFECTO - Guardar automáticamente cuando cambia el carrito
    effect(() => {
      const items = this.cartItems();
      this.guardarCarritoEnStorage(items);
    });
  }
  
  obtenerItems = () => this.cartItems();

  // agregarProducto(producto: any, cantidad: number = 1, observaciones?: string): void {
  //   const nuevoItem: CartItem = {
  //     id: this.generarIdUnico(),
  //     productoId: producto.id,
  //     nombre: producto.nombre,
  //     tipo: producto.tipo, 
  //     precioUnitario: producto.precio,
  //     cantidad: cantidad,
  //     observaciones: observaciones,
  //     imagen: producto.imagenes?.[0] || producto.foto1,
  //     precioTotal: producto.precio * cantidad
  //   };
  //   this.cartItems.update(items => [...items, nuevoItem]);
  // }
  agregarProducto(producto: any, cantidad: number = 1, observaciones?: string): void {
    const items = this.cartItems();
    
    const itemExistente = items.find(item => item.productoId === producto.id);
    
    if (itemExistente) {
      this.actualizarCantidad(
        itemExistente.id, 
        itemExistente.cantidad + cantidad
      );
    } else {
      const nuevoItem: CartItem = {
        id: this.generarIdUnico(),
        productoId: producto.id,
        nombre: producto.nombre,
        tipo: producto.tipo, 
        tiempoElaboracion: producto.tiempo_elaboracion,
        precioUnitario: producto.precio,
        cantidad: cantidad,
        observaciones: observaciones,
        imagen: producto.imagenes?.[0] || producto.foto1,
        precioTotal: producto.precio * cantidad
      };
      this.cartItems.update(items => [...items, nuevoItem]);
    }
  }

  eliminarProducto(itemId: string): void {
    this.cartItems.update(items => items.filter(item => item.id !== itemId));
  }

  private cargarCarritoDesdeStorage(): CartItem[] {
    try {
      const stored = localStorage.getItem(this.CART_STORAGE_KEY);
      if (stored) {
        const items = JSON.parse(stored);
        
        
        if (Array.isArray(items)) {
          console.log('Carrito cargado desde storage:', items.length, 'items');
          return items;
        }
      }
    } catch (error) {
      console.error('Error cargando carrito desde storage:', error);
    }
    
    return []; 
  }

  private guardarCarritoEnStorage(items: CartItem[]): void {
    try {
      localStorage.setItem(this.CART_STORAGE_KEY, JSON.stringify(items));
      console.log('Carrito guardado en storage:', items.length, 'items');
      console.log('items', items);
    } catch (error) {
      console.error('Error guardando carrito en storage:', error);
    }
  }


  actualizarCantidad(itemId: string, nuevaCantidad: number): void {
    if (nuevaCantidad <= 0) {
      this.eliminarProducto(itemId);
      return;
    }

    this.cartItems.update(items =>
      items.map(item =>
        item.id === itemId
          ? {
              ...item,
              cantidad: nuevaCantidad,
              precioTotal: item.precioUnitario * nuevaCantidad
            }
          : item
      )
    );
  }

  limpiarCarrito(): void {
    this.cartItems.set([]);
  }

  forzarGuardado(): void {
    this.guardarCarritoEnStorage(this.cartItems());
  }

  

  private generarIdUnico(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }


  generarPedidoParaConfirmacion(clienteId: string, mesa: string = '1', observaciones : string): Pedido {
    const items = this.obtenerItems();
    
    const comidas = items.filter(item => item.tipo === 'comida');
    const bebidas = items.filter(item => item.tipo === 'bebida');
    const postres = items.filter(item => item.tipo === 'postre'); 
    
    const tiempoElaboracion = this.calcularTiempoElaboracionNumerico(items);
    
    const total = this.totalPrecio();
    console.log(clienteId)
    const pedido: Pedido = {
      cliente_id: clienteId,
      comidas: comidas,
      bebidas: bebidas,
      postres: postres, 
      precio: total,
      tiempo_estimado: tiempoElaboracion,
      confirmado: false,
      mesa: mesa,
      estado: 'pendiente',
      estado_comida: 'pendiente',
      estado_bebida: 'pendiente',
      estado_postre: 'pendiente', 
      recepcion: false,
      pagado: 0,
      cuenta: total,
      fecha_pedido: new Date().toISOString(),
      motivo_rechazo: '',
      observaciones_generales: observaciones
    };

    return pedido;
  }

  private calcularTiempoElaboracionNumerico(items: CartItem[]): number {
    if (items.length === 0) return 0;
    
    const tiempos = items.map(item => parseInt(item.tiempoElaboracion) || 0);
    return Math.max(...tiempos);
  }

  cargarPedidoAlCarrito(pedido: Pedido) {
    this.limpiarCarrito();
    
    pedido.comidas.forEach(comida => {
      const cartItem: CartItem = {
        id: this.generarIdUnico(),
        productoId: comida.id,
        nombre: comida.nombre,
        tipo: 'comida' as const,
        tiempoElaboracion: comida.tiempoElaboracion,
        precioUnitario: comida.precioUnitario,
        cantidad: comida.cantidad,
        observaciones: comida.observaciones,
        imagen: comida.imagen, 
        precioTotal: comida.precioTotal
      };
      this.cartItems.update(items => [...items, cartItem]);
    });

    pedido.bebidas.forEach(bebida => {
      const cartItem: CartItem = {
        id: this.generarIdUnico(),
        productoId: bebida.id,
        nombre: bebida.nombre,
        tipo: 'bebida' as const,
        tiempoElaboracion: bebida.tiempoElaboracion,
        precioUnitario: bebida.precioUnitario,
        cantidad: bebida.cantidad,
        observaciones: bebida.observaciones,
        imagen: bebida.imagen,
        precioTotal: bebida.precioTotal
      };
      this.cartItems.update(items => [...items, cartItem]);
    });

    pedido.postres.forEach(postre => {
      const cartItem: CartItem = {
        id: this.generarIdUnico(),
        productoId: postre.id,
        nombre: postre.nombre,
        tipo: 'postre' as const,
        tiempoElaboracion: postre.tiempoElaboracion,
        precioUnitario: postre.precioUnitario,
        cantidad: postre.cantidad,
        observaciones: postre.observaciones,
        imagen: postre.imagen,
        precioTotal: postre.precioTotal
      };
      this.cartItems.update(items => [...items, cartItem]);
    });

    console.log('🔄 Pedido cargado al carrito:', this.cartItems().length, 'items');
  }





}
