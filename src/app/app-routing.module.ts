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
  // {
  //   path: 'login',
  //   loadChildren: () => import('./componentes/login/login.page').then( m => m.LoginPageModule)
  // },


 
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
