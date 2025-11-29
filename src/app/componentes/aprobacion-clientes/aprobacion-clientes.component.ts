import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SupabaseService } from '../../servicios/supabase.service';
import { PushNotificationService } from '../../servicios/push-notification.service';
import { Router } from '@angular/router';
import { FritosSpinnerComponent } from '../fritos-spinner/fritos-spinner.component';

@Component({
  selector: 'app-aprobacion-clientes',
  templateUrl: './aprobacion-clientes.component.html',
  styleUrls: ['./aprobacion-clientes.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FritosSpinnerComponent]
})
export class AprobacionClientesComponent implements OnInit {
  clientesPendientes: any[] = [];
  cargandoClientes: boolean = false;

  constructor(
    private supabase: SupabaseService,
    private pushNotificationService: PushNotificationService,
    private router: Router
  ) {}

  ngOnInit() {
    this.cargarClientesPendientes();
  }

  async cargarClientesPendientes() {
    try {
      this.cargandoClientes = true;
      const { data: clientes, error } = await this.supabase.supabase
        .from('clientes')
        .select('id, nombre, apellido, correo, dni, imagenPerfil')
        .is('validado', null);

      if (error) {
        console.error('Error al cargar clientes pendientes:', error);
        return;
      }

      this.clientesPendientes = clientes || [];
      console.log('Clientes pendientes cargados:', this.clientesPendientes.length);
    } catch (error) {
      console.error('Error inesperado al cargar clientes pendientes:', error);
    } finally {
      this.cargandoClientes = false;
    }
  }

  async aprobarCliente(cliente: any) {
    try {
      const { error } = await this.supabase.supabase
        .from('clientes')
        .update({
          validado: true,
        })
        .eq('id', cliente.id);

      if (error) {
        console.error('Error al aprobar cliente:', error);
        return;
      }

      try {
        await this.pushNotificationService.notificarEstadoCliente(
          cliente.correo,
          cliente.nombre,
          cliente.apellido,
          'aceptado'
        );
      } catch (notifyError) {
        console.error('Error al notificar al cliente:', notifyError);
      }

      await this.cargarClientesPendientes();
    } catch (error) {
      console.error('Error inesperado al aprobar cliente:', error);
    }
  }

  async rechazarCliente(cliente: any) {
    try {
      const { error } = await this.supabase.supabase
        .from('clientes')
        .update({
          validado: false,
        })
        .eq('id', cliente.id);

      if (error) {
        console.error('Error al rechazar cliente:', error);
        return;
      }


      try {
        await this.pushNotificationService.notificarEstadoCliente(
          cliente.correo,
          cliente.nombre,
          cliente.apellido,
          'rechazado'
        );
      } catch (notifyError) {
        console.error('Error al notificar al cliente:', notifyError);
      }

      await this.cargarClientesPendientes();
    } catch (error) {
      console.error('Error inesperado al rechazar cliente:', error);
    }
  }

  volverAlHome() {
    this.router.navigate(['/home']);
  }
}
