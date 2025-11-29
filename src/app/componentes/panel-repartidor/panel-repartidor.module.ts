import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { PanelRepartidorComponent, MapaRutaComponent } from './panel-repartidor.component';
import { FritosSpinnerComponent } from '../fritos-spinner/fritos-spinner.component';

const routes: Routes = [
  {
    path: '',
    component: PanelRepartidorComponent
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild(routes),
    FritosSpinnerComponent
  ],
  declarations: [
    PanelRepartidorComponent,
    MapaRutaComponent
  ]
})
export class PanelRepartidorModule { }

