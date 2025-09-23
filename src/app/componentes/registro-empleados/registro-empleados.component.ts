import { Component, OnInit } from '@angular/core';
import { IonButton, IonLabel } from "@ionic/angular/standalone";
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IonicModule, LoadingController } from '@ionic/angular';
//import { IonCheckbox, IonTextarea } from '@ionic/angular/standalone';
import { Router, ActivatedRoute } from '@angular/router';
import { LoadingService } from 'src/app/servicios/loading.service';
import { SupabaseService } from '../../servicios/supabase.service';
import { AuthService } from 'src/app/servicios/auth.service';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

@Component({
  selector: 'app-registro-empleados',
  templateUrl: './registro-empleados.component.html',
  imports: [CommonModule, IonicModule, ReactiveFormsModule, FormsModule],
  styleUrls: ['./registro-empleados.component.scss'],
})
export class RegistroEmpleadosComponent  implements OnInit {

  empleadoForm: FormGroup

  mensajeExito: string = '';
  mensajeError: string = '';

  empleadoNombreError: string = '';
  empleadoApellidoError: string = '';
  empleadoCorreoError: string = '';
  empleadoContraseniaError: string = '';
  empleadoDniError: string = '';
  empleadoCuilError: string = '';
  empleadoImagenError: string = '';
  empleadoPerfilError: string = '';

  imagenEmpleadoURL: string | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private loadingService: LoadingService,
    private loadingCtrl: LoadingController,
    private sb: SupabaseService,
    private authService: AuthService,

  ) {
      this.empleadoForm = this.fb.group({
        nombre: ['', [Validators.required, Validators.pattern(/^[A-Za-zÀ-ÿ\s]+$/)]],
        apellido: ['', [Validators.required, Validators.pattern(/^[A-Za-zÀ-ÿ\s]+$/)]],
        correo: ['', [Validators.required, Validators.email]],
        contrasenia: ['', [Validators.required, Validators.minLength(6)]],
        dni: ['', [Validators.required, Validators.pattern(/^\d{7,8}$/)]],
        cuil: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
        imagenPerfil: [null, Validators.required],
        perfil: ['cocinero', Validators.required] 
      });

      this.setupFormValidation();
   }
  

  ngOnInit() {}

  setupFormValidation() {
    this.empleadoForm.get('nombre')?.valueChanges.subscribe(() => this.validarCampoEmpleado('nombre'));
    this.empleadoForm.get('apellido')?.valueChanges.subscribe(() => this.validarCampoEmpleado('apellido'));
    this.empleadoForm.get('correo')?.valueChanges.subscribe(() => this.validarCampoEmpleado('correo'));
    this.empleadoForm.get('contrasenia')?.valueChanges.subscribe(() => this.validarCampoEmpleado('contrasenia'));
    this.empleadoForm.get('dni')?.valueChanges.subscribe(() => this.validarCampoEmpleado('dni'));
    this.empleadoForm.get('cuil')?.valueChanges.subscribe(() => this.validarCampoEmpleado('cuil'));
  }

  validarCampoEmpleado(campo: string) {
    const control = this.empleadoForm.get(campo);
    if (!control) return;

    switch(campo) {
      case 'nombre': this.empleadoNombreError = ''; break;
      case 'apellido': this.empleadoApellidoError = ''; break;
      case 'correo': this.empleadoCorreoError = ''; break;
      case 'contrasenia': this.empleadoContraseniaError = ''; break;
      case 'dni': this.empleadoDniError = ''; break;
      case 'cuil': this.empleadoCuilError = ''; break;
    }

    if (control.value || control.touched) {
      switch(campo) {
        case 'nombre':
          if (control.errors?.['required']) {
            this.empleadoNombreError = 'El nombre es requerido';
          } else if (control.errors?.['pattern']) {
            this.empleadoNombreError = 'El nombre solo puede contener letras';
          }
          break;
        case 'apellido':
          if (control.errors?.['required']) {
            this.empleadoApellidoError = 'El apellido es requerido';
          } else if (control.errors?.['pattern']) {
            this.empleadoApellidoError = 'El apellido solo puede contener letras';
          }
          break;
        case 'correo':
          if (control.errors?.['required']) {
            this.empleadoCorreoError = 'El correo electrónico es requerido';
          } else if (control.errors?.['email']) {
            this.empleadoCorreoError = 'Ingrese un correo electrónico válido';
          }
          break;
        case 'contrasenia':
          if (control.errors?.['required']) {
            this.empleadoContraseniaError = 'La contraseña es requerida';
          } else if (control.errors?.['minlength']) {
            this.empleadoContraseniaError = 'La contraseña debe tener al menos 6 caracteres';
          }
          break;
        case 'dni':
          if (control.errors?.['required']) {
            this.empleadoDniError = 'El DNI es requerido';
          } else if (control.errors?.['pattern']) {
            this.empleadoDniError = 'El DNI debe tener 7 u 8 dígitos';
          }
          break;
        case 'cuil':
          if (control.errors?.['required']) {
            this.empleadoCuilError = 'El CUIL es requerido';
          } else if (control.errors?.['pattern']) {
            this.empleadoCuilError = 'El CUIL debe tener 11 dígitos';
          }
          break;
      }
    }
  }


  async registrarEmpleado() {
    if (this.empleadoForm.invalid) {
      this.mensajeError = 'Por favor completa todos los campos correctamente';
      return;
    }

    this.loadingService.show();

    try {
      const { nombre, apellido, correo, contrasenia, dni, cuil, perfil } = this.empleadoForm.value;
      const archivo: File = this.empleadoForm.value.imagenPerfil;


      const { data: empleadoExistente } = await this.sb.supabase
        .from('empleados')
        .select('id')
        .eq('correo', correo)
        .single();

      if (empleadoExistente) {
        this.mensajeError = 'Este correo electrónico ya está registrado';
        this.loadingService.hide();
        return;
      }


      const usuario = await this.authService.registro(correo, contrasenia);
      if (!usuario) {
        this.mensajeError = 'Error al crear el usuario';
        this.loadingService.hide();
        return;
      }

      let imagenPerfil = '';
      if (archivo) {
        const path = await this.sb.subirImagenPerfil(archivo);
        imagenPerfil = this.sb.supabase.storage.from('usuarios.img').getPublicUrl(path).data.publicUrl;
      }


      const nuevoEmpleado = {
        nombre,
        apellido,
        correo,
        dni,
        cuil,
        imagenPerfil,
        perfil
      };

      const { error } = await this.sb.supabase.from('empleados').insert([nuevoEmpleado]);
      if (error) {
        this.mensajeError = 'Error al registrar empleado: ' + error.message;
        this.loadingService.hide();
        return;
      }

      this.mensajeExito = 'Empleado registrado exitosamente!';
      this.empleadoForm.reset();
      this.imagenEmpleadoURL = null;
      this.loadingService.hide();
      this.router.navigateByUrl('/home')

    } catch (e) {
      this.mensajeError = 'Error inesperado: ' + (e as Error).message;
      this.loadingService.hide();
    }
  }

  async escanearDNI() {
    try {
      const result = await BarcodeScanner.scan();

      if (result.barcodes.length > 0) {
        const codigo = result.barcodes[0].rawValue;
        this.procesarDatosDNI(codigo);
      } else {
        this.mensajeError = 'No se detectó ningún código.';
      }
    } catch (error) {
      this.mensajeError = 'Error al escanear DNI';
    }
  }

  procesarDatosDNI(codigo: string) {
    const partes = codigo.split('@');
    if (partes.length > 5) {
      const apellido = this.capitalizar(partes[1]);
      const nombre = this.capitalizar(partes[2]);
      const dni = this.capitalizar(partes[4]);

      this.empleadoForm.patchValue({ nombre, apellido, dni });

    } else {
      this.mensajeError = 'El formato del DNI no es válido.';
    }
  }

  private capitalizar(str: string): string {
    return str
      .toLowerCase()
      .replace(/(^|\s)\S/g, l => l.toUpperCase());
  }

  tomarFoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';

    input.onchange = (event: any) => {
      const archivo = event.target.files[0];
      if (archivo) {
        this.procesarImagenUnica(archivo);
      }
    };

    input.click();
  }

  procesarImagenUnica(archivo: File) {
    const reader = new FileReader();
    reader.onload = () => {
      this.imagenEmpleadoURL = reader.result as string;
      this.empleadoForm.patchValue({ imagenPerfil: archivo });
    };
    reader.readAsDataURL(archivo);
  }


}
