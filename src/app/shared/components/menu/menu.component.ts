import { Component, OnInit, inject } from '@angular/core';
import { UtilsService } from '../../../servicios/utils.service';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
  standalone: false,
})
export class MenuComponent  implements OnInit {

  constructor() { }

  ngOnInit() {}

  utilsSvc = inject(UtilsService);
  firebaseSvc = inject(UtilsService);

  logout() {
    //this.utilsSvc.signOut(); // 👈 acá pones tu lógica de cerrar sesión
  }

  // cerrarSesion() {
  //   this.firebaseSvc

}
