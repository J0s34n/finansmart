import { Injectable } from '@angular/core';
import { 
  CanActivate, 
  ActivatedRouteSnapshot, 
  RouterStateSnapshot, 
  Router,
  UrlTree 
} from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/**
 * Guard para proteger rutas que requieren email verificado
 * Si el email NO está verificado, redirige a /verify-email
 * 
 * Uso en el routing:
 * {
 *   path: 'some-important-feature',
 *   component: ImportantPage,
 *   canActivate: [AuthGuard, EmailVerifiedGuard]
 * }
 */
@Injectable({
  providedIn: 'root'
})
export class EmailVerifiedGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    
    return this.authService.isAuthenticated$.pipe(
      take(1),
      map(isAuthenticated => {
        if (!isAuthenticated) {
          // No autenticado, redirigir a login
          console.log('EmailVerifiedGuard: Usuario no autenticado');
          return this.router.createUrlTree(['/login']);
        }

        // Verificar si el email está verificado
        const isEmailVerified = this.authService.isEmailVerified();
        
        if (isEmailVerified) {
          // Email verificado, permitir acceso
          return true;
        } else {
          // Email NO verificado, redirigir a página de verificación
          console.log('EmailVerifiedGuard: Email no verificado, redirigiendo a /verify-email');
          
          return this.router.createUrlTree(['/verify-email'], {
            queryParams: { returnUrl: state.url }
          });
        }
      })
    );
  }
}