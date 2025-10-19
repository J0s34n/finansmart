import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonBackButton,
  IonButtons,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonSelect,
  IonSelectOption,
  IonToggle,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonRange,
  IonSpinner,
  AlertController,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  settingsOutline,
  notificationsOutline,
  informationCircleOutline,
  logOutOutline,
  sunnyOutline,
  moonOutline,
  documentTextOutline
} from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '@app/core/services/auth.service';
import { UserModel } from '@app/models/user.model';

/**
 * Página de Configuración
 * Permite al usuario personalizar la aplicación
 */
@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonBackButton,
    IonButtons,
    IonButton,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonRange,
    IonSpinner
  ]
})
export class SettingsPage implements OnInit, OnDestroy {
  user: UserModel | null = null;
  settingsForm!: FormGroup;
  loading = true;

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private formBuilder: FormBuilder,
    private router: Router,
    private alertController: AlertController,
    private toastController: ToastController
  ) {
    addIcons({
      arrowBackOutline,
      settingsOutline,
      notificationsOutline,
      informationCircleOutline,
      logOutOutline,
      sunnyOutline,
      moonOutline,
      documentTextOutline
    });
  }

  ngOnInit() {
    this.loadSettings();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga la configuración del usuario
   */
  private loadSettings(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.user = user;
        this.initializeForm();
        this.loading = false;
      });
  }

  /**
   * Inicializa el formulario reactivo
   */
  private initializeForm(): void {
    if (!this.user) return;

    this.settingsForm = this.formBuilder.group({
      currency: [this.user.preferences.currency],
      language: [this.user.preferences.language],
      theme: [this.user.preferences.theme],
      notificationsEnabled: [this.user.preferences.notifications.enabled],
      budgetAlerts: [this.user.preferences.notifications.budgetAlerts],
      dailyReminders: [this.user.preferences.notifications.dailyReminders],
      weeklyReports: [this.user.preferences.notifications.weeklyReports],
      budgetAlertThreshold: [this.user.preferences.budgetAlertThreshold]
    });
  }

  /**
   * Maneja cambio de moneda
   */
  async onCurrencyChange(event: any): Promise<void> {
    const currency = event.detail.value;
    await this.updatePreference('currency', currency);
  }

  /**
   * Maneja cambio de idioma
   */
  async onLanguageChange(event: any): Promise<void> {
    const language = event.detail.value;
    await this.updatePreference('language', language);
  }

  /**
   * Maneja cambio de tema
   */
  async onThemeChange(event: any): Promise<void> {
    const theme = event.detail.value;
    await this.updatePreference('theme', theme);
    this.applyTheme(theme);
  }

  /**
   * Maneja toggle de notificaciones
   */
  async onNotificationsToggle(event: any): Promise<void> {
    const enabled = event.detail.checked;
    
    await this.updatePreference('notifications', {
      ...this.user?.preferences.notifications,
      enabled
    });
  }

  /**
   * Maneja toggle de alertas de presupuesto
   */
  async onBudgetAlertsToggle(event: any): Promise<void> {
    const budgetAlerts = event.detail.checked;

    await this.updatePreference('notifications', {
      ...this.user?.preferences.notifications,
      budgetAlerts
    });
  }

  /**
   * Maneja toggle de recordatorios diarios
   */
  async onDailyRemindersToggle(event: any): Promise<void> {
    const dailyReminders = event.detail.checked;

    await this.updatePreference('notifications', {
      ...this.user?.preferences.notifications,
      dailyReminders
    });
  }

  /**
   * Maneja toggle de reportes semanales
   */
  async onWeeklyReportsToggle(event: any): Promise<void> {
    const weeklyReports = event.detail.checked;

    await this.updatePreference('notifications', {
      ...this.user?.preferences.notifications,
      weeklyReports
    });
  }

  /**
   * Maneja cambio de umbral de alerta
   */
  async onBudgetThresholdChange(event: any): Promise<void> {
    const threshold = event.detail.value;
    await this.updatePreference('budgetAlertThreshold', threshold);
  }

  /**
   * Actualiza una preferencia del usuario
   */
  private async updatePreference(key: string, value: any): Promise<void> {
   try {
    if (key === 'notifications') {
      await this.authService.updatePreferences({ notifications: value });
    } else {
      await this.authService.updatePreferences({ [key]: value });
    }

    // ✅ Recargar usuario
    await this.authService.reloadCurrentUser();
    
    await this.showToast('Configuración actualizada', 'success');

  } catch (error: any) {
    console.error('Error al actualizar preferencia:', error);
    await this.showToast('Error al actualizar configuración', 'danger');
  }
}

  /**
   * Aplica el tema seleccionado
   */
  private applyTheme(theme: 'light' | 'dark' | 'auto'): void {
    const isDark = theme === 'dark' || 
                   (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      document.body.setAttribute('color-scheme', 'dark');
    } else {
      document.body.setAttribute('color-scheme', 'light');
    }
  }

  /**
   * Abre la política de privacidad
   */
  openPrivacyPolicy(): void {
    // TODO: Implementar apertura de documento
    console.log('Abrir política de privacidad');
  }

  /**
   * Abre los términos de servicio
   */
  openTermsOfService(): void {
    // TODO: Implementar apertura de documento
    console.log('Abrir términos de servicio');
  }

  /**
   * Cierra la sesión del usuario
   */
  async logout(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Cerrar Sesión',
      message: '¿Estás seguro de que deseas cerrar sesión?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Cerrar Sesión',
          role: 'destructive',
          handler: async () => {
            await this.performLogout();
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Realiza el logout
   */
  private async performLogout(): Promise<void> {
    try {
      await this.authService.logout();
      await this.showToast('Sesión cerrada', 'success');
      this.router.navigate(['/login']);

    } catch (error: any) {
      console.error('Error al cerrar sesión:', error);
      await this.showToast('Error al cerrar sesión', 'danger');
    }
  }

  /**
   * Vuelve atrás
   */
  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  /**
   * Muestra un toast
   */
  private async showToast(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color
    });
    await toast.present();
  }
}