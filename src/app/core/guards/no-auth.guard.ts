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
 * Guard para proteger rutas que NO deben ser accesibles si el usuario YA está autenticado
 * Si el usuario está autenticado, redirige a /dashboard
 * 
 * Uso en el routing:
 * {
 *   path: 'login',
 *   component: LoginPage,
 *   canActivate: [NoAuthGuard]
 * }
 */
@Injectable({
  providedIn: 'root'
})
export class NoAuthGuard implements CanActivate {

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
          // Usuario NO autenticado, permitir acceso (puede ver login/register)
          return true;
        } else {
          // Usuario YA autenticado, redirigir a dashboard
          console.log('NoAuthGuard: Usuario ya autenticado, redirigiendo a /dashboard');
          
          return this.router.createUrlTree(['/dashboard']);
        }
      })
    );
  }
}