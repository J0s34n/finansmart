import { Injectable } from '@angular/core';
import { 
  CanActivate, 
  ActivatedRouteSnapshot, 
  RouterStateSnapshot, 
  Router,
  UrlTree 
} from '@angular/router';
import { Observable } from 'rxjs';
import { map, skipWhile, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/**
 * Guard para proteger rutas que requieren autenticación
 * Si el usuario NO está autenticado, redirige a /login
 * 
 * Espera a que Firebase termine de inicializar antes de verificar
 * 
 * Uso en el routing:
 * {
 *   path: 'dashboard',
 *   component: DashboardPage,
 *   canActivate: [AuthGuard]
 * }
 */
@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    
    // ✅ Esperar a que Firebase termine de inicializar (loading$ = false)
    return this.authService.loading$.pipe(
      // Saltar mientras loading sea true, tomar el primer false
      skipWhile(loading => loading),
      take(1),
      // Ahora verificar autenticación
      map(() => {
        if (this.authService.isAuthenticated()) {
          // Usuario autenticado, permitir acceso
          console.log('AuthGuard: Usuario autenticado, permitiendo acceso');
          return true;
        } else {
          // Usuario no autenticado, redirigir a login
          console.log('AuthGuard: Usuario no autenticado, redirigiendo a /login');
          
          // Guardar la URL intentada para redirigir después del login
          const returnUrl = state.url;
          
          return this.router.createUrlTree(['/login'], {
            queryParams: { returnUrl }
          });
        }
      })
    );
  }
}