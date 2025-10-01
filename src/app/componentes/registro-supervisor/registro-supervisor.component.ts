import { Component, OnInit } from '@angular/core';
import { IonItem, IonIcon, IonLabel, IonContent, IonCheckbox, IonButton, IonInput } from "@ionic/angular/standalone";
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IonicModule, LoadingController } from '@ionic/angular';
import { Router, ActivatedRoute } from '@angular/router';
import { LoadingService } from 'src/app/servicios/loading.service';
import { SupabaseService } from '../../servicios/supabase.service';
import { AuthService } from 'src/app/servicios/auth.service';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Toast } from '@capacitor/toast';


@Component({
  selector: 'app-registro-supervisor',
  templateUrl: './registro-supervisor.component.html',
  imports: [CommonModule, IonicModule, ReactiveFormsModule, FormsModule],
  styleUrls: ['./registro-supervisor.component.scss'],
})
export class RegistroSupervisorComponent  implements OnInit {

  supervisorForm: FormGroup;
  mensajeExito: string = '';
  mensajeError: string = '';
  supervisorNombreError: string = '';
  supervisorApellidoError: string = '';
  supervisorCorreoError: string = '';
  supervisorContraseniaError: string = '';
  supervisorDniError: string = '';
  supervisorCuilError: string = '';
  supervisorImagenError: string = '';
  supervisorPerfilError: string = '';
  imagenSupervisorURL: string | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private loadingService: LoadingService,
    private loadingCtrl: LoadingController,
    private sb: SupabaseService,
    private authService: AuthService,
  ) { 

      this.supervisorForm = this.fb.group({
        nombre: ['', [Validators.required, Validators.pattern(/^[A-Za-zÀ-ÿ\s]+$/)]],
        apellido: ['', [Validators.required, Validators.pattern(/^[A-Za-zÀ-ÿ\s]+$/)]],
        correo: ['', [Validators.required, Validators.email]],
        contrasenia: ['', [Validators.required, Validators.minLength(6)]],
        dni: ['', [Validators.required, Validators.pattern(/^\d{7,8}$/)]],
        cuil: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
        imagenPerfil: [null, Validators.required],
        perfil: ['', Validators.required]
      });

      this.setupFormValidation();

  }

  ngOnInit() {
  }

  setupFormValidation(){
    this.supervisorForm.get('nombre')?.valueChanges.subscribe(() => this.validarCampoSupervisor('nombre'));
    this.supervisorForm.get('apellido')?.valueChanges.subscribe(() => this.validarCampoSupervisor('apellido'));
    this.supervisorForm.get('correo')?.valueChanges.subscribe(() => this.validarCampoSupervisor('correo'));
    this.supervisorForm.get('contrasenia')?.valueChanges.subscribe(() => this.validarCampoSupervisor('contrasenia'));
    this.supervisorForm.get('dni')?.valueChanges.subscribe(() => this.validarCampoSupervisor('dni'));
    this.supervisorForm.get('cuil')?.valueChanges.subscribe(() => this.validarCampoSupervisor('cuil'));
  }



  async registrarSupervisor() {
    if (this.supervisorForm.invalid) {
      this.mensajeError = 'Por favor completa todos los campos correctamente';
      return;
    }

    this.loadingService.show();

    try {
      const { nombre, apellido, correo, contrasenia, dni, cuil, perfil } = this.supervisorForm.value;
      const archivo: File = this.supervisorForm.value.imagenPerfil;


      const { data: supervisorExistente } = await this.sb.supabase
        .from('empleados')
        .select('id')
        .eq('correo', correo)
        .single();

      if (supervisorExistente) {
        this.mensajeError = 'Este correo electrónico ya está registrado';
        this.loadingService.hide();
        return;
      }


      const usuario = await this.authService.registro(correo, contrasenia, perfil, nombre);
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

      const nuevoSupervisor = {
        nombre,
        apellido,
        correo,
        dni,
        cuil,
        imagenPerfil,
        perfil
      };

      const { error } = await this.sb.supabase.from('empleados').insert([nuevoSupervisor]);
      if (error) {
        this.mensajeError = 'Error al registrar supervisor: ' + error.message;
        this.loadingService.hide();
        return;
      }

      this.mensajeExito = 'Supervisor registrado exitosamente!';
      this.showToast('Supervisor registrado exitosamente')
      this.router.navigateByUrl('/home')
      this.supervisorForm.reset();
      this.imagenSupervisorURL = null;
      this.loadingService.hide();

    } catch (e) {
      this.mensajeError = 'Error inesperado: ' + (e as Error).message;
      this.loadingService.hide();
    }
  }

  validarCampoSupervisor(campo: string) {
    const control = this.supervisorForm.get(campo);
    if (!control) return;

    switch(campo) {
      case 'nombre': this.supervisorNombreError = ''; break;
      case 'apellido': this.supervisorApellidoError = ''; break;
      case 'correo': this.supervisorCorreoError = ''; break;
      case 'contrasenia': this.supervisorContraseniaError = ''; break;
      case 'dni': this.supervisorDniError = ''; break;
      case 'cuil': this.supervisorCuilError = ''; break;
    }

    if (control.value || control.touched) {
      switch(campo) {
        case 'nombre':
          if (control.errors?.['required']) {
            this.supervisorNombreError = 'El nombre es requerido';
          } else if (control.errors?.['pattern']) {
            this.supervisorNombreError = 'El nombre solo puede contener letras';
          }
          break;
        case 'apellido':
          if (control.errors?.['required']) {
            this.supervisorApellidoError = 'El apellido es requerido';
          } else if (control.errors?.['pattern']) {
            this.supervisorApellidoError = 'El apellido solo puede contener letras';
          }
          break;
        case 'correo':
          if (control.errors?.['required']) {
            this.supervisorCorreoError = 'El correo electrónico es requerido';
          } else if (control.errors?.['email']) {
            this.supervisorCorreoError = 'Ingrese un correo electrónico válido';
          }
          break;
        case 'contrasenia':
          if (control.errors?.['required']) {
            this.supervisorContraseniaError = 'La contraseña es requerida';
          } else if (control.errors?.['minlength']) {
            this.supervisorContraseniaError = 'La contraseña debe tener al menos 6 caracteres';
          }
          break;
        case 'dni':
          if (control.errors?.['required']) {
            this.supervisorDniError = 'El DNI es requerido';
          } else if (control.errors?.['pattern']) {
            this.supervisorDniError = 'El DNI debe tener 7 u 8 dígitos';
          }
          break;
        case 'cuil':
          if (control.errors?.['required']) {
            this.supervisorCuilError = 'El CUIL es requerido';
          } else if (control.errors?.['pattern']) {
            this.supervisorCuilError = 'El CUIL debe tener 11 dígitos';
          }
          break;
      }
    }
  }


  async showToast(texto : string){
    await Toast.show({
      text: texto,
      duration : 'short',
      position: 'top'
    })
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

      this.supervisorForm.patchValue({ nombre, apellido, dni });

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
    console.log('se ejecuta el tomar foto')
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
      this.imagenSupervisorURL = reader.result as string;
      this.supervisorForm.patchValue({ imagenPerfil: archivo });
    };
    reader.readAsDataURL(archivo);
  }



}
