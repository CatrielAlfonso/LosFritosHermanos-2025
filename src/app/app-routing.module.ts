import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  
  {
    path: '',
    redirectTo: 'screen',
    pathMatch: 'full'
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
    path: 'screen',
    loadChildren: () => import('./pages/screen/screen.module').then( m => m.ScreenPageModule)
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
    path: 'registro-plato',
    loadComponent: () => import('./componentes/platos/platos.component').then(m => m.PlatosComponent)
  },


 
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
