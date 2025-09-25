import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-supervisor',
  templateUrl: './supervisor.component.html',
  styleUrls: ['./supervisor.component.scss'],
})
export class SupervisorComponent  implements OnInit {

  // Funcionalidades: 
  // ❏ Crear una nueva mesa, 
  //   ❏ Se agrega el número, la cantidad de comensales, el tipo (VIP, estándar, para comensales
  //    con movilidad reducida) y foto (tomada desde el celular).
  //   ❏ Generar el código QR correspondiente.
  //   ❏ Validar todos los campos. TODOS. Formatos, campos vacíos, tipos de datos, etc.
  //   ❏ Se verifica la existencia de la nueva mesa.

  constructor() { }

  ngOnInit() {}

}
