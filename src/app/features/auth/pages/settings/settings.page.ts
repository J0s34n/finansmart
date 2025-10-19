import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { SettingsService } from '@app/core/services/settings.service';
import { UserModel } from '@app/models/user.model';

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
  settingsForm: FormGroup | null = null;
  loading = true;

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private settingsService: SettingsService,
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
        if (user) {
          this.user = user;
          this.initializeForm();
          this.loading = false;
        }
      });
  }

  /**
   * Inicializa el formulario reactivo CON valores por defecto
   */
  private initializeForm(): void {
    if (!this.user) return;

    // Crear formulario con valores iniciales AHORA
    this.settingsForm = this.formBuilder.group({
      currency: [
        this.user.preferences?.currency || 'MXN',
        [Validators.required]
      ],
      language: [
        this.user.preferences?.language || 'es',
        [Validators.required]
      ],
      theme: [
        this.user.preferences?.theme || 'auto',
        [Validators.required]
      ],
      notificationsEnabled: [
        this.user.preferences?.notifications?.enabled ?? true
      ],
      budgetAlerts: [
        this.user.preferences?.notifications?.budgetAlerts ?? true
      ],
      dailyReminders: [
        this.user.preferences?.notifications?.dailyReminders ?? true
      ],
      weeklyReports: [
        this.user.preferences?.notifications?.weeklyReports ?? true
      ],
      budgetAlertThreshold: [
        this.user.preferences?.budgetAlertThreshold || 80,
        [Validators.required, Validators.min(50), Validators.max(100)]
      ]
    });

    console.log('Formulario inicializado:', this.settingsForm.value);
  }

  /**
   * Maneja cambio de moneda
   */
  async onCurrencyChange(event: any): Promise<void> {
    const currency = event.detail.value;
    await this.updatePreference('currency', currency);
    this.settingsService.updateCurrency(currency);
  }

  /**
   * Maneja cambio de idioma
   */
  async onLanguageChange(event: any): Promise<void> {
    const language = event.detail.value;
    await this.updatePreference('language', language);
    this.settingsService.updateLanguage(language);
  }

  /**
   * Maneja cambio de tema
   */
  async onThemeChange(event: any): Promise<void> {
    const theme = event.detail.value;
    await this.updatePreference('theme', theme);
    this.settingsService.updateTheme(theme);
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
    this.settingsService.updateNotifications({
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
    this.settingsService.updateNotifications({
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
    this.settingsService.updateNotifications({
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
    this.settingsService.updateNotifications({
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
    this.settingsService.updateBudgetAlertThreshold(threshold);
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

      // Recargar usuario DESPUÉS de actualizar
      await this.authService.reloadCurrentUser();
      
      await this.showToast('Configuración actualizada', 'success');

    } catch (error: any) {
      console.error('Error al actualizar preferencia:', error);
      await this.showToast('Error al actualizar configuración', 'danger');
    }
  }

  /**
   * Abre la política de privacidad
   */
  openPrivacyPolicy(): void {
    console.log('Abrir política de privacidad');
  }

  /**
   * Abre los términos de servicio
   */
  openTermsOfService(): void {
    console.log('Abrir términos de servicio');
  }
  async onSubmit(): Promise<void> {
  if (!this.settingsForm?.valid) {
    await this.showToast('Completa los campos requeridos', 'warning');
    return;
  }

  try {
    const values = this.settingsForm.value;
    await this.authService.updatePreferences(values);
    await this.authService.reloadCurrentUser();
    await this.showToast('Configuración guardada correctamente', 'success');
  } catch (error: any) {
    console.error('Error al guardar configuración:', error);
    await this.showToast('Error al guardar configuración', 'danger');
  }
}
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