import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SupabaseService } from '../../servicios/supabase.service';
import { PushNotificationService } from '../../servicios/push-notification.service';
import { Router } from '@angular/router';
import { FritosSpinnerComponent } from '../fritos-spinner/fritos-spinner.component';
import { CustomLoader } from 'src/app/servicios/custom-loader.service';
import { FeedbackService } from 'src/app/servicios/feedback-service.service';

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
    private feedback: FeedbackService,
    private customLoader: CustomLoader,
    private pushNotificationService: PushNotificationService,
    private router: Router
  ) {}

  ngOnInit() {
    this.cargarClientesPendientes();
  }

  async cargarClientesPendientes() {
    try {
      this.customLoader.show('Cargando clientes pendientes...');
      this.cargandoClientes = true;
      const { data: clientes, error } = await this.supabase.supabase
        .from('clientes')
        .select('id, nombre, apellido, correo, dni, imagenPerfil')
        .is('validado', null);

      if (error) {
        this.customLoader.hide();
        console.error('Error al cargar clientes pendientes:', error);
        return;
      }

      this.clientesPendientes = clientes || [];

      console.log('Clientes pendientes cargados:', this.clientesPendientes.length);
      this.feedback.showToast("exito", `✅ ${this.clientesPendientes.length} clientes pendientes cargados.`);
      this.customLoader.hide();
      
    } catch (error) {
      console.error('Error inesperado al cargar clientes pendientes:', error);
      this.customLoader.hide();
    } finally {
      this.cargandoClientes = false;
      this.customLoader.hide();
      this.feedback.hide();
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
      this.customLoader.show('Rechazando cliente...');
      const { error } = await this.supabase.supabase
        .from('clientes')
        .update({
          validado: false,
        })
        .eq('id', cliente.id);

      if (error) {
        this.customLoader.hide();
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
        this.customLoader.hide();
        console.error('Error al notificar al cliente:', notifyError);
      }

      await this.cargarClientesPendientes();
      this.customLoader.hide();
    } catch (error) {
      this.customLoader.hide();
      console.error('Error inesperado al rechazar cliente:', error);
    }
  }

  volverAlHome() {
    this.router.navigate(['/home']);
  }
}
