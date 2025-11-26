import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  
  {
    path: '',
    redirectTo: 'screen',
    pathMatch: 'full'
  },
  {
    path: 'screen',
    loadChildren: () => import('./pages/screen/screen.module').then( m => m.ScreenPageModule)
  },
  {
    path: 'screen-splash',
    loadChildren: () => import('./pages/screen-splash/screen-splash.module').then( m => m.ScreenSplashPageModule)
  },
  {
    path: 'login',
    loadComponent: () => import('./componentes/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'home',
    loadChildren: () => import('./home/home.module').then( m => m.HomePageModule)
  },
  {
    path: 'registro',
    loadComponent: () => import('./componentes/registro/registro.component').then(m => m.RegistroComponent)
  },
  {
    path: 'bebidas',
    loadComponent: () => import('./componentes/bebidas/bebidas.component').then(m => m.BebidasComponent)

  },
  {
    path: 'menu',
    loadComponent: () => import('./componentes/menu/menu.component').then(m => m.MenuComponent)
  },
  {
    path: 'registro-empleados',
    loadComponent: () => import('./componentes/registro-empleados/registro-empleados.component').then(m => m.RegistroEmpleadosComponent)
  },
  {
    path: 'registro-supervisor',
    loadComponent: () => import('./componentes/registro-supervisor/registro-supervisor.component').then(m => m.RegistroSupervisorComponent)
  },
  {
    path: 'bienvenida',
    loadComponent: () => import('./componentes/bienvenida/bienvenida.component').then(m => m.BienvenidaComponent)
  }, 
  {
    path:'anonimo',
    loadComponent: () => import('./componentes/anonimo/anonimo.component').then(m => m.AnonimoComponent)
  },
  {
    path: 'supervisor',
    loadComponent: () => import('./componentes/supervisor/supervisor.component').then(m => m.SupervisorComponent),
    children: [
      {
        path: 'registro-mesa',
        loadComponent: () => import('./componentes/registro-mesa/registro-mesa.component').then(m => m.RegistroMesaComponent)
      },
      {
        path: 'verificar-clientes',
        loadComponent: () => import('./componentes/aprobacion-clientes/aprobacion-clientes.component').then(m => m.AprobacionClientesComponent)
      },
      {
        path: '',
        redirectTo: 'mesas',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: 'registro-mesa',
    loadComponent: () => import('./componentes/registro-mesa/registro-mesa.component').then(m => m.RegistroMesaComponent)
  },
  {
    path: 'verificar-clientes',
    loadComponent: () => import('./componentes/aprobacion-clientes/aprobacion-clientes.component').then(m => m.AprobacionClientesComponent)
  },
  {
    path: 'registro-plato',
    loadComponent: () => import('./componentes/platos/platos.component').then(m => m.PlatosComponent)
  },
  {
    path: 'aprobacion-clientes',
    loadComponent: () => import('./componentes/aprobacion-clientes/aprobacion-clientes.component').then(m => m.AprobacionClientesComponent)
  },
  {
    path: 'carrito',
    loadComponent: () => import('./componentes/carrito/carrito.component').then(m => m.CarritoComponent)
  },
  {
    path: 'maitre',
    loadComponent: () => import('./componentes/maitre-mesas/maitre-mesas.component').then(m => m.MaitreMesasComponent)
  },
  {
    path: 'pedidos-mozo',
    loadComponent: () => import('./componentes/pedidos-mozo/pedidos-mozo.component').then(m => m.PedidosMozoComponent)
  },
  {
    path: 'pedidos',
    loadComponent: () => import('./componentes/pedidos/pedidos.component').then(m => m.PedidosComponent)
  },
  {
    path: 'escaner',
    loadChildren: () => import('./componentes/escaner/escaner.component').then( m => m.EscanerComponent)
  },
   {
    path: 'lista-espera',
    loadComponent: () => import('./componentes/lista-espera/lista-espera.component').then(m => m.ListaEsperaComponent)
  },
  {
    path:'game-selector',
    loadComponent: () => import('./game-selector/game-selector.component').then(m => m.GameSelectorComponent)
  },
  {
    path: 'atrapa-el-pollo',
    loadComponent: () => import('./games/atrapa-el-pollo/atrapa-el-pollo.component').then(m => m.AtrapaElPolloComponent)
  },
  {
    path: 'memoria-de-sabores',
    loadComponent: () => import('./games/memoria-de-sabores/memoria-de-sabores.component').then(m => m.MemoriaDeSaboresComponent)
  },
  {
    path:'mozo-equilibrio',
    loadComponent: () => import('./games/extragame/extragame.component').then(m => m.ExtraGameComponent)
  }
  ,
  {
    path: 'cocina',
    loadComponent: () => import('./componentes/cocina/cocina.component').then(m => m.CocinaComponent)
  },
  {
    path: 'bar',
    loadComponent: () => import('./componentes/bar/bar.component').then(m => m.BarComponent)
  },
 {
    path: 'encuestas',
    loadComponent: () => import('./componentes/encuestas/encuestas.component').then(m => m.EncuestasComponent)
  },
  {
    path: 'mayor-menor',
    loadComponent: () => import('./games/mayor-menor/mayor-menor.component').then(m => m.MayorMenorComponent)
  }, 
  {
    path: 'pagos/:mesa',
    loadComponent: () => import('./componentes/pagos/pagos.component').then(m => m.PagosComponent)
  },
  {
    path: 'consulta-mozo',
    loadComponent: () => import('./componentes/consulta-mozo/consulta-mozo.component').then(m => m.ConsultaMozoComponent)
  },
  {
    path: 'consultas-lista',
    loadComponent: () => import('./componentes/consultas-lista/consultas-lista.component').then(m => m.ConsultasListaComponent)
  },
  {
    path: 'reservas',
    loadComponent: () => import('./componentes/reservas/reservas.component').then(m => m.ReservasComponent)
  },
  {
    path: 'gestionar-reservas',
    loadComponent: () => import('./componentes/gestionar-reservas/gestionar-reservas.component').then(m => m.GestionarReservasComponent)
  },
  {
    path: 'delivery',
    loadComponent: () => import('./componentes/delivery/delivery.component').then(m => m.DeliveryComponent)
  },
  {
    path: 'gestionar-delivery',
    loadComponent: () => import('./componentes/gestionar-delivery/gestionar-delivery.component').then(m => m.GestionarDeliveryComponent)
  },
  {
    path: 'panel-repartidor',
    loadChildren: () => import('./componentes/panel-repartidor/panel-repartidor.module').then(m => m.PanelRepartidorModule)
  },
  {
    path: 'chat-delivery/:pedidoId',
    loadComponent: () => import('./componentes/chat-delivery/chat-delivery.component').then(m => m.ChatDeliveryComponent)
  },
  {
    path: 'confirmar-entrega/:pedidoId',
    loadComponent: () => import('./componentes/confirmar-entrega/confirmar-entrega.component').then(m => m.ConfirmarEntregaComponent)
  },
  {
    path: 'mis-pedidos-delivery',
    loadComponent: () => import('./componentes/mis-pedidos-delivery/mis-pedidos-delivery.component').then(m => m.MisPedidosDeliveryComponent)
  },
  {
    path: 'extra-game',
    loadComponent: () => import('./games/extragame/extragame.component').then(m => m.ExtraGameComponent)
  },
 



];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
