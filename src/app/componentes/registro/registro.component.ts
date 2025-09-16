import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, LoadingController } from '@ionic/angular';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../../servicios/supabase.service';
import { AuthService } from 'src/app/servicios/auth.service';
import { LoadingService } from 'src/app/servicios/loading.service';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { toDataURL } from 'qrcode';
import { IonCheckbox, IonTextarea } from '@ionic/angular/standalone';
import { HttpClient } from '@angular/common/http';
import { PushNotificationService } from 'src/app/servicios/push-notification.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule, FormsModule, IonCheckbox, IonTextarea],
  templateUrl: './registro.component.html',
  styleUrls: ['./registro.component.scss']
})
export class RegistroComponent implements OnInit {
  empleadoForm: FormGroup;
  supervisorForm: FormGroup;
  productoForm: FormGroup;
  bebidaForm: FormGroup;
  mesaForm: FormGroup;
  clienteForm: FormGroup;

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

  supervisorNombreError: string = '';
  supervisorApellidoError: string = '';
  supervisorCorreoError: string = '';
  supervisorContraseniaError: string = '';
  supervisorDniError: string = '';
  supervisorCuilError: string = '';
  supervisorImagenError: string = '';
  supervisorPerfilError: string = '';

  clienteNombreError: string = '';
  clienteApellidoError: string = '';
  clienteCorreoError: string = '';
  clienteContraseniaError: string = '';
  clienteDniError: string = '';
  clienteImagenError: string = '';

  mesaNumeroError: string = '';
  mesaComensalesError: string = '';
  mesaTipoError: string = '';
  mesaImagenError: string = '';

  productoNombreError: string = '';
  productoDescripcionError: string = '';
  productoTiempoError: string = '';
  productoPrecioError: string = '';
  productoImagenesError: string = '';

  bebidaNombreError: string = '';
  bebidaDescripcionError: string = '';
  bebidaTiempoError: string = '';
  bebidaPrecioError: string = '';
  bebidaImagenesError: string = '';

  imagenEmpleadoURL: string | null = null;
  imagenSupervisorURL: string | null = null;
  imagenMesaURL: string | null = null;
  imagenClienteURL: string | null = null;
  imagenesProductoURLs: string[] = [];
  imagenesBebidaURLs: string[] = [];
  imagenesProductoArchivos: File[] = [];
  imagenesBebidaArchivos: File[] = [];

  qrMesaURL: string | null = null;


  tipoRegistro = 'cliente' as 'empleado' | 'supervisor' | 'producto' | 'bebida' | 'mesa' | 'cliente';


  esAdmin: boolean = false;
  esMaitre: boolean = false;
  esCocinero: boolean = false;
  esBartender: boolean = false;
  perfilUsuario: string = '';
  estaAutenticado: boolean = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private sb: SupabaseService,
    private authService: AuthService,
    private loadingCtrl: LoadingController,
    private loadingService: LoadingService,
    private http: HttpClient,
    private pushNotificationService: PushNotificationService
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


 
    this.productoForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.pattern(/^[A-Za-zÀ-ÿ\s]+$/)]],
      descripcion: ['', [Validators.required, Validators.minLength(10)]],
      tiempoElaboracion: ['', [Validators.required, Validators.min(1), Validators.max(60)]],
      precio: ['', [Validators.required, Validators.min(0.01)]],
      tipo: ['comida', Validators.required],
      imagenes: [null, [Validators.required, this.validarTresImagenes.bind(this)]]
    });

    this.bebidaForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.pattern(/^[A-Za-zÀ-ÿ\s]+$/)]],
      descripcion: ['', [Validators.required, Validators.minLength(10)]],
      tiempoElaboracion: ['', [Validators.required, Validators.min(1), Validators.max(60)]],
      precio: ['', [Validators.required, Validators.min(0.01)]],
      tipo: ['bebida', Validators.required],
      imagenes: [null, [Validators.required, this.validarTresImagenes.bind(this)]]
    });

    this.mesaForm = this.fb.group({
      numero: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
      comensales: ['', [Validators.required, Validators.min(1), Validators.max(20)]],
      tipo: ['', Validators.required],
      imagen: [null, Validators.required]
    });

    this.clienteForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.pattern(/^[A-Za-zÀ-ÿ\s]+$/)]],
      apellido: ['', [Validators.required, Validators.pattern(/^[A-Za-zÀ-ÿ\s]+$/)]],
      correo: ['', [Validators.required, Validators.email]],
      contrasenia: ['', [Validators.required, Validators.minLength(6)]],
      dni: ['', [Validators.required, Validators.pattern(/^\d{7,8}$/)]],
      imagenPerfil: [null, Validators.required]
    });



 
    this.esAdmin = this.authService.esUsuarioAdmin();
    this.esMaitre = this.authService.esUsuarioMaitre();
    this.perfilUsuario = this.authService.getPerfilUsuario();
    this.esCocinero = this.perfilUsuario === 'cocinero';
    this.esBartender = this.perfilUsuario === 'bartender';
    this.estaAutenticado = this.authService.estaAutenticado();

    if (this.esMaitre && !this.esAdmin) {
      this.tipoRegistro = 'cliente';
    } else if (this.esAdmin && (this.perfilUsuario === 'dueño' || this.perfilUsuario === 'supervisor')) {
      this.tipoRegistro = 'supervisor';
    } else if (this.esCocinero && !this.esAdmin && !this.esMaitre) {
      this.tipoRegistro = 'producto';
    } else if (this.esBartender && !this.esAdmin && !this.esMaitre) {
      this.tipoRegistro = 'bebida';
    } else if (this.esAdmin) {
      this.tipoRegistro = 'empleado';
    }

 
    this.empleadoForm.get('nombre')?.valueChanges.subscribe(() => this.validarCampoEmpleado('nombre'));
    this.empleadoForm.get('apellido')?.valueChanges.subscribe(() => this.validarCampoEmpleado('apellido'));
    this.empleadoForm.get('correo')?.valueChanges.subscribe(() => this.validarCampoEmpleado('correo'));
    this.empleadoForm.get('contrasenia')?.valueChanges.subscribe(() => this.validarCampoEmpleado('contrasenia'));
    this.empleadoForm.get('dni')?.valueChanges.subscribe(() => this.validarCampoEmpleado('dni'));
    this.empleadoForm.get('cuil')?.valueChanges.subscribe(() => this.validarCampoEmpleado('cuil'));
    this.empleadoForm.get('imagenPerfil')?.valueChanges.subscribe(() => this.validarCampoEmpleado('imagenPerfil'));
    this.empleadoForm.get('perfil')?.valueChanges.subscribe(() => this.validarCampoEmpleado('perfil'));

    this.supervisorForm.get('nombre')?.valueChanges.subscribe(() => this.validarCampoSupervisor('nombre'));
    this.supervisorForm.get('apellido')?.valueChanges.subscribe(() => this.validarCampoSupervisor('apellido'));
    this.supervisorForm.get('correo')?.valueChanges.subscribe(() => this.validarCampoSupervisor('correo'));
    this.supervisorForm.get('contrasenia')?.valueChanges.subscribe(() => this.validarCampoSupervisor('contrasenia'));
    this.supervisorForm.get('dni')?.valueChanges.subscribe(() => this.validarCampoSupervisor('dni'));
    this.supervisorForm.get('cuil')?.valueChanges.subscribe(() => this.validarCampoSupervisor('cuil'));
    this.supervisorForm.get('imagenPerfil')?.valueChanges.subscribe(() => this.validarCampoSupervisor('imagenPerfil'));
    this.supervisorForm.get('perfil')?.valueChanges.subscribe(() => this.validarCampoSupervisor('perfil'));

   

    this.mesaForm.get('numero')?.valueChanges.subscribe(() => this.validarCampoMesa('numero'));
    this.mesaForm.get('comensales')?.valueChanges.subscribe(() => this.validarCampoMesa('comensales'));
    this.mesaForm.get('tipo')?.valueChanges.subscribe(() => this.validarCampoMesa('tipo'));
    this.mesaForm.get('imagen')?.valueChanges.subscribe(() => this.validarCampoMesa('imagen'));

 
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tipo']) {
        this.setTipoRegistro(params['tipo']);
      }
    });
  }


  validarTresImagenes(control: any) {
    const imagenes = control.value;
    if (imagenes && imagenes.length !== 3) {
      return { validarTresImagenes: true };
    }
    return null;
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

    } catch (e) {
      this.mensajeError = 'Error inesperado: ' + (e as Error).message;
      this.loadingService.hide();
    }
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
        .from('supervisores')
        .select('id')
        .eq('correo', correo)
        .single();

      if (supervisorExistente) {
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

      const nuevoSupervisor = {
        nombre,
        apellido,
        correo,
        dni,
        cuil,
        imagenPerfil,
        perfil
      };

      const { error } = await this.sb.supabase.from('supervisores').insert([nuevoSupervisor]);
      if (error) {
        this.mensajeError = 'Error al registrar supervisor: ' + error.message;
        this.loadingService.hide();
        return;
      }

      this.mensajeExito = 'Supervisor registrado exitosamente!';
      this.supervisorForm.reset();
      this.imagenSupervisorURL = null;
      this.loadingService.hide();

    } catch (e) {
      this.mensajeError = 'Error inesperado: ' + (e as Error).message;
      this.loadingService.hide();
    }
  }

  async registrarProducto() {
    if (this.productoForm.invalid || this.imagenesProductoArchivos.length !== 3) {
      this.mensajeError = 'Por favor completa todos los campos y selecciona 3 imágenes';
      return;
    }
    this.loadingService.show();
    try {
      const { nombre, descripcion, tiempoElaboracion, precio, tipo } = this.productoForm.value;
      const imagenesURLs: string[] = [];
      for (let i = 0; i < 3; i++) {
        const archivo = this.imagenesProductoArchivos[i];
        const { data, error } = await this.sb.supabase.storage.from('imagenes').upload(`producto-${nombre}-${i}-${archivo.name}`, archivo, { upsert: true });
        if (error) throw new Error(error.message);
        imagenesURLs.push(this.sb.supabase.storage.from('imagenes').getPublicUrl(data.path).data.publicUrl);
      }
      const { error } = await this.sb.supabase.from('productos').insert([{ nombre, descripcion, tiempo_elaboracion: tiempoElaboracion, precio: parseFloat(precio), tipo, imagenes: imagenesURLs }]);
      if (error) throw new Error(error.message);
      this.mensajeExito = 'Producto registrado exitosamente!';
      this.productoForm.reset();
      this.imagenesProductoURLs = [];
      this.imagenesProductoArchivos = [];
      this.loadingService.hide();
    } catch (e) {
      this.mensajeError = 'Error: ' + (e as Error).message;
      this.loadingService.hide();
    }
  }

  async registrarBebida() {
    if (this.bebidaForm.invalid || this.imagenesBebidaArchivos.length !== 3) {
      this.mensajeError = 'Por favor completa todos los campos y selecciona 3 imágenes';
      return;
    }
    this.loadingService.show();
    try {
      const { nombre, descripcion, tiempoElaboracion, precio, tipo } = this.bebidaForm.value;
      const imagenesURLs: string[] = [];
      for (let i = 0; i < 3; i++) {
        const archivo = this.imagenesBebidaArchivos[i];
        const { data, error } = await this.sb.supabase.storage.from('imagenes').upload(`bebida-${nombre}-${i}-${archivo.name}`, archivo, { upsert: true });
        if (error) throw new Error(error.message);
        imagenesURLs.push(this.sb.supabase.storage.from('imagenes').getPublicUrl(data.path).data.publicUrl);
      }
      const { error } = await this.sb.supabase.from('productos').insert([{ nombre, descripcion, tiempo_elaboracion: tiempoElaboracion, precio: parseFloat(precio), tipo, imagenes: imagenesURLs }]);
      if (error) throw new Error(error.message);
      this.mensajeExito = 'Bebida registrada exitosamente!';
      this.bebidaForm.reset();
      this.imagenesBebidaURLs = [];
      this.imagenesBebidaArchivos = [];
      this.loadingService.hide();
    } catch (e) {
      this.mensajeError = 'Error: ' + (e as Error).message;
      this.loadingService.hide();
    }
  }

  async registrarCliente() {
    if (this.clienteForm.invalid) {
      this.mensajeError = 'Por favor completa todos los campos correctamente';
      return;
    }
    this.loadingService.show();
    try {
      const { nombre, apellido, correo, contrasenia, dni } = this.clienteForm.value;
      const archivo: File = this.clienteForm.value.imagenPerfil;
      const { data: clienteExistente } = await this.sb.supabase.from('clientes').select('id').eq('correo', correo).single();
      if (clienteExistente) {
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
      const { error } = await this.sb.supabase.from('clientes').insert([{ nombre, apellido, correo, dni, imagenPerfil, validado: null, aceptado: null }]);
      if (error) throw new Error(error.message);
      try {
        await this.pushNotificationService.notificarSupervisoresNuevoCliente(nombre, apellido);
      } catch (error) {
        console.error('Error al enviar notificación:', error);
      }
      this.mensajeExito = 'Cliente registrado exitosamente! Estado: Pendiente de aprobación.';
      this.clienteForm.reset();
      this.imagenClienteURL = null;
      this.loadingService.hide();
    } catch (e) {
      this.mensajeError = 'Error: ' + (e as Error).message;
      this.loadingService.hide();
    }
  }

  async registrarMesa() {
    if (this.mesaForm.invalid) {
      this.mensajeError = 'Por favor completa todos los campos correctamente';
      return;
    }

    this.loadingService.show();

    try {
      const { numero, comensales, tipo } = this.mesaForm.value;
      const archivo: File = this.mesaForm.value.imagen;


      const { data: mesaExistente } = await this.sb.supabase
        .from('mesas')
        .select('id')
        .eq('numero', numero)
        .single();

      if (mesaExistente) {
        this.mensajeError = 'Esta mesa ya existe';
        this.loadingService.hide();
        return;
      }


      let imagenMesa = '';
      if (archivo) {
        const { data, error } = await this.sb.supabase.storage
          .from('imagenes')
          .upload(`mesa-${numero}-${archivo.name}`, archivo, { upsert: true });

        if (error) throw new Error(error.message);

        imagenMesa = this.sb.supabase.storage
          .from('imagenes')
          .getPublicUrl(data.path).data.publicUrl;
      }
 
      const qrData = JSON.stringify({ numeroMesa: numero });
      const qrDataUrl = await toDataURL(qrData, { width: 512 });
      const qrBlob = dataURLtoBlob(qrDataUrl);
      const qrFileName = `mesa-${numero}-qr.png`;
      const { data: qrUpload, error: qrError } = await this.sb.supabase.storage
        .from('qrs')
        .upload(qrFileName, qrBlob, { upsert: true });
      if (qrError) throw new Error(qrError.message);
      const qrUrl = this.sb.supabase.storage.from('qrs').getPublicUrl(qrFileName).data.publicUrl;


      const nuevaMesa = {
        numero,
        comensales,
        tipo,
        imagen: imagenMesa,
        qr: qrUrl
      };

      const { error } = await this.sb.supabase.from('mesas').insert([nuevaMesa]);
      if (error) {
        this.mensajeError = 'Error al registrar mesa: ' + error.message;
        this.loadingService.hide();
        return;
      }

      this.mensajeExito = 'Mesa registrada exitosamente!';
      this.mesaForm.reset();
      this.imagenMesaURL = null;
      this.qrMesaURL = qrUrl;
      this.loadingService.hide();

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

      if (this.tipoRegistro === 'cliente') {
        this.clienteForm.patchValue({ nombre, apellido, dni });
      } else if (this.tipoRegistro === 'empleado') {
        this.empleadoForm.patchValue({ nombre, apellido, dni });
      } else if (this.tipoRegistro === 'supervisor') {
        this.supervisorForm.patchValue({ nombre, apellido, dni });
      }
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

    if (this.tipoRegistro === 'producto' || this.tipoRegistro === 'bebida') {
      input.multiple = true;
    }

    input.onchange = (event: any) => {
      if (this.tipoRegistro === 'producto') {
        const files = event.target.files;
        for (let i = 0; i < files.length && this.imagenesProductoArchivos.length < 3; i++) {
          this.agregarFotoProducto(files[i]);
        }
      } else if (this.tipoRegistro === 'bebida') {
        const files = event.target.files;
        for (let i = 0; i < files.length && this.imagenesBebidaArchivos.length < 3; i++) {
          this.agregarFotoBebida(files[i]);
        }
      } else {
        const archivo = event.target.files[0];
        if (archivo) {
          this.procesarImagenUnica(archivo);
        }
      }
    };

    input.click();
  }

  procesarImagenUnica(archivo: File) {
    const reader = new FileReader();
    reader.onload = () => {
      switch(this.tipoRegistro) {
        case 'empleado':
          this.imagenEmpleadoURL = reader.result as string;
          this.empleadoForm.patchValue({ imagenPerfil: archivo });
          break;
        case 'supervisor':
          this.imagenSupervisorURL = reader.result as string;
          this.supervisorForm.patchValue({ imagenPerfil: archivo });
          break;
        case 'mesa':
          this.imagenMesaURL = reader.result as string;
          this.mesaForm.patchValue({ imagen: archivo });
          break;
        case 'cliente':
          this.imagenClienteURL = reader.result as string;
          this.clienteForm.patchValue({ imagenPerfil: archivo });
          break;
      }
    };
    reader.readAsDataURL(archivo);
  }

  agregarFotoProducto(archivo: File) {
    if (this.imagenesProductoArchivos.length >= 3) {
      this.mensajeError = 'Ya tienes 3 imágenes seleccionadas';
      return;
    }
    this.imagenesProductoArchivos.push(archivo);
    this.actualizarPreviewProducto();
  }

  agregarFotoBebida(archivo: File) {
    if (this.imagenesBebidaArchivos.length >= 3) {
      this.mensajeError = 'Ya tienes 3 imágenes seleccionadas';
      return;
    }
    this.imagenesBebidaArchivos.push(archivo);
    this.actualizarPreviewBebida();
  }

  actualizarPreviewProducto() {
    this.imagenesProductoURLs = [];
    this.imagenesProductoArchivos.forEach((archivo, index) => {
      const reader = new FileReader();
      reader.onload = () => {
        this.imagenesProductoURLs[index] = reader.result as string;
      };
      reader.readAsDataURL(archivo);
    });
  }

  actualizarPreviewBebida() {
    this.imagenesBebidaURLs = [];
    this.imagenesBebidaArchivos.forEach((archivo, index) => {
      const reader = new FileReader();
      reader.onload = () => {
        this.imagenesBebidaURLs[index] = reader.result as string;
      };
      reader.readAsDataURL(archivo);
    });
  }

  // Cambiar tipo de registro
  setTipoRegistro(tipo: 'empleado' | 'supervisor' | 'producto' | 'bebida' | 'mesa' | 'cliente') {
    this.tipoRegistro = tipo;
    this.mensajeError = '';
    this.mensajeExito = '';
    this.limpiarImagenes();
  }

  limpiarImagenes() {
    this.imagenEmpleadoURL = null;
    this.imagenSupervisorURL = null;
    this.imagenMesaURL = null;
    this.imagenClienteURL = null;
    this.imagenesProductoURLs = [];
    this.imagenesBebidaURLs = [];
    this.imagenesProductoArchivos = [];
    this.imagenesBebidaArchivos = [];
    this.qrMesaURL = null;
  }

  volverAlHome() {
    this.router.navigate(['/home']);
  }

  // Método para validar campos de empleado en tiempo real
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
      case 'imagenPerfil': this.empleadoImagenError = ''; break;
      case 'perfil': this.empleadoPerfilError = ''; break;
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
        case 'imagenPerfil':
          if (control.errors?.['required']) {
            this.empleadoImagenError = 'La imagen de perfil es requerida';
          }
          break;
        case 'perfil':
          if (control.errors?.['required']) {
            this.empleadoPerfilError = 'Debe seleccionar un perfil';
          }
          break;
      }
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
      case 'imagenPerfil': this.supervisorImagenError = ''; break;
      case 'perfil': this.supervisorPerfilError = ''; break;
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
        case 'imagenPerfil':
          if (control.errors?.['required']) {
            this.supervisorImagenError = 'La imagen de perfil es requerida';
          }
          break;
        case 'perfil':
          if (control.errors?.['required']) {
            this.supervisorPerfilError = 'Debe seleccionar un perfil';
          }
          break;
      }
    }
  }

  

  validarCampoMesa(campo: string) {
    const control = this.mesaForm.get(campo);
    if (!control) return;

    switch(campo) {
      case 'numero': this.mesaNumeroError = ''; break;
      case 'comensales': this.mesaComensalesError = ''; break;
      case 'tipo': this.mesaTipoError = ''; break;
      case 'imagen': this.mesaImagenError = ''; break;
    }

    if (control.value || control.touched) {
      switch(campo) {
        case 'numero':
          if (control.errors?.['required']) {
            this.mesaNumeroError = 'El número de mesa es requerido';
          } else if (control.errors?.['pattern']) {
            this.mesaNumeroError = 'El número debe ser válido';
          }
          break;
        case 'comensales':
          if (control.errors?.['required']) {
            this.mesaComensalesError = 'La cantidad de comensales es requerida';
          } else if (control.errors?.['min']) {
            this.mesaComensalesError = 'Mínimo 1 comensal';
          } else if (control.errors?.['max']) {
            this.mesaComensalesError = 'Máximo 20 comensales';
          }
          break;
        case 'tipo':
          if (control.errors?.['required']) {
            this.mesaTipoError = 'Debe seleccionar un tipo de mesa';
          }
          break;
        case 'imagen':
          if (control.errors?.['required']) {
            this.mesaImagenError = 'La imagen de la mesa es requerida';
          }
          break;
      }
    }
  }

  

  

  irAlLogin() {
    this.router.navigate(['/login']);
  }

  async crearDuenoInicial() {
    try {
      const dueno = {
        nombre: 'Dueño',
        apellido: 'Fritos Hermanos',
        imagenPerfil: '',
        dni: '12345678',
        cuil: '20123456789',
        perfil: 'dueño',
        correo: 'dueno@fritoshermanos.com',
        fcm_token: ''
      };

      const { data, error } = await this.sb.supabase
        .from('supervisores')
        .insert([dueno])
        .select();

      if (error) {
        this.mensajeError = 'Error al crear dueño: ' + error.message;
      } else {
        this.mensajeExito = 'Dueño creado exitosamente!';
        console.log('Dueño creado:', data);
      }
    } catch (e) {
      this.mensajeError = 'Error inesperado: ' + (e as Error).message;
    }
  }

}

function dataURLtoBlob(dataurl: string) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}