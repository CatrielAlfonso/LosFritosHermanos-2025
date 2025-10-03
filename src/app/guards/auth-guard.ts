import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../servicios/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const perfilRequerido = route.data?.['perfil'] as string;
  const usuario = authService.getCurrentUser();
  const perfilUsuario = authService.obtenerPerfil();

  // 1. Si no hay usuario → al login
  if (!usuario) {
    router.navigate(['/login']);
    return false;
  }

  // 2. Si hay perfil requerido y no coincide → redirect
  if (perfilRequerido && perfilUsuario !== perfilRequerido) {
    router.navigate(['/bienvenida']); // o a una página "acceso denegado"
    return false;
  }

  return true; // acceso permitido
};