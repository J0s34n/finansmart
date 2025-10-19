import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { map, distinctUntilChanged } from 'rxjs/operators';

/**
 * Servicio centralizado para gestionar las preferencias del usuario
 * Propaga cambios a toda la aplicación
 */
@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  // Observables de preferencias individuales
  private currencySubject = new BehaviorSubject<string>('MXN');
  public currency$ = this.currencySubject.asObservable();

  private languageSubject = new BehaviorSubject<string>('es');
  public language$ = this.languageSubject.asObservable();

  private themeSubject = new BehaviorSubject<'light' | 'dark' | 'auto'>('auto');
  public theme$ = this.themeSubject.asObservable();

  private notificationsSubject = new BehaviorSubject<any>(null);
  public notifications$ = this.notificationsSubject.asObservable();

  private budgetAlertThresholdSubject = new BehaviorSubject<number>(80);
  public budgetAlertThreshold$ = this.budgetAlertThresholdSubject.asObservable();

  constructor(private authService: AuthService) {
    this.initializeSettings();
  }

  /**
   * Inicializa las preferencias desde el usuario actual
   */
  private initializeSettings(): void {
    this.authService.currentUser$.subscribe(user => {
      if (user?.preferences) {
        this.currencySubject.next(user.preferences.currency || 'MXN');
        this.languageSubject.next(user.preferences.language || 'es');
        this.themeSubject.next(user.preferences.theme || 'auto');
        this.notificationsSubject.next(user.preferences.notifications);
        this.budgetAlertThresholdSubject.next(user.preferences.budgetAlertThreshold || 80);

        // Aplicar tema inmediatamente
        this.applyTheme(user.preferences.theme || 'auto');
      }
    });
  }

  /**
   * Actualiza la moneda y propaga el cambio
   */
  updateCurrency(currency: string): void {
    this.currencySubject.next(currency);
  }

  /**
   * Actualiza el idioma y propaga el cambio
   */
  updateLanguage(language: string): void {
    this.languageSubject.next(language);
  }

  /**
   * Actualiza el tema y lo aplica inmediatamente
   */
  updateTheme(theme: 'light' | 'dark' | 'auto'): void {
    this.themeSubject.next(theme);
    this.applyTheme(theme);
  }

  /**
   * Actualiza las notificaciones
   */
  updateNotifications(notifications: any): void {
    this.notificationsSubject.next(notifications);
  }

  /**
   * Actualiza el umbral de alerta
   */
  updateBudgetAlertThreshold(threshold: number): void {
    this.budgetAlertThresholdSubject.next(threshold);
  }

  /**
   * Obtiene la moneda actual (snapshot)
   */
  getCurrency(): string {
    return this.currencySubject.value;
  }

  /**
   * Obtiene el idioma actual (snapshot)
   */
  getLanguage(): string {
    return this.languageSubject.value;
  }

  /**
   * Obtiene el tema actual (snapshot)
   */
  getTheme(): 'light' | 'dark' | 'auto' {
    return this.themeSubject.value;
  }

  /**
   * Obtiene el umbral de alerta (snapshot)
   */
  getBudgetAlertThreshold(): number {
    return this.budgetAlertThresholdSubject.value;
  }

  /**
   * Aplica el tema seleccionado al DOM
   */
public applyTheme(theme: 'light' | 'dark' | 'auto'): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'auto' && prefersDark);
  const html = document.documentElement;
  if (isDark) {
    html.classList.add('dark');
    html.style.colorScheme = 'dark';
  } else {
    html.classList.remove('dark');
    html.style.colorScheme = 'light';
  }
}

  /**
   * Observable que emite el símbolo de moneda
   */
  getCurrencySymbol$(): Observable<string> {
    return this.currency$.pipe(
      map(currency => this.getCurrencySymbolMap()[currency] || '$'),
      distinctUntilChanged()
    );
  }

  /**
   * Obtiene el símbolo de moneda actual
   */
  getCurrencySymbol(): string {
    const symbolMap = this.getCurrencySymbolMap();
    return symbolMap[this.getCurrency()] || '$';
  }

  /**
   * Mapa de monedas a símbolos
   */
  private getCurrencySymbolMap(): { [key: string]: string } {
    return {
      'MXN': '$',
      'USD': '$',
      'EUR': '€',
      'GBP': '£'
    };
  }

  /**
   * Observable que emite si el tema es oscuro
   */
  isDarkTheme$(): Observable<boolean> {
    return this.theme$.pipe(
      map(theme => theme === 'dark' || 
          (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)),
      distinctUntilChanged()
    );
  }
}