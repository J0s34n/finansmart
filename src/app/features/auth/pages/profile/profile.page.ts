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
  IonItem,
  IonLabel,
  IonInput,
  IonSpinner,
  IonBadge,
  AlertController,
  ToastController,
  LoadingController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  pencilOutline,
  closeOutline,
  cameraOutline,
  personOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  settingsOutline,
  warningOutline,
  lockClosedOutline,
  trashOutline,
  createOutline
} from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '@app/core/services/auth.service';
import { UserModel } from '@app/models/user.model';

/**
 * Página de Perfil del Usuario
 * Permite ver y editar información del perfil
 */
@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
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
    IonItem,
    IonLabel,
    IonInput,
    IonSpinner,
    IonBadge
  ]
})
export class ProfilePage implements OnInit, OnDestroy {
  user: UserModel | null = null;
  profileForm!: FormGroup;
  loading = true;
  isEditMode = false;
  errorMessage = '';
  touchedFields = new Set<string>();

  private destroy$ = new Subject<void>();

  private readonly avatarColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
  ];

  constructor(
    private authService: AuthService,
    private formBuilder: FormBuilder,
    private router: Router,
    private alertController: AlertController,
    private toastController: ToastController,
    private loadingController: LoadingController
  ) {
    addIcons({
      arrowBackOutline,
      pencilOutline,
      closeOutline,
      cameraOutline,
      personOutline,
      checkmarkCircleOutline,
      alertCircleOutline,
      settingsOutline,
      warningOutline,
      lockClosedOutline,
      trashOutline,
      createOutline
    });
  }

  ngOnInit() {
    this.loadProfile();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga el perfil del usuario
   */
  private loadProfile(): void {
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
    this.profileForm = this.formBuilder.group({
      displayName: [
        this.user?.displayName || '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(50)
        ]
      ]
    });
  }

  /**
   * Obtiene el color del avatar
   */
  getAvatarColor(): string {
    if (!this.user) return this.avatarColors[0];
    
    // Usar el email para generar un color consistente
    const index = this.user.email.charCodeAt(0) % this.avatarColors.length;
    return this.avatarColors[index];
  }

  /**
   * Verifica si el email está verificado
   */
  isEmailVerified(): boolean {
    return this.authService.isEmailVerified();
  }

  /**
   * Alterna modo de edición
   */
  toggleEditMode(): void {
    if (this.isEditMode) {
      this.initializeForm();
      this.touchedFields.clear();
      this.errorMessage = '';
    }
    this.isEditMode = !this.isEditMode;
  }

  /**
   * Marca un campo como tocado
   */
  markFieldAsTouched(fieldName: string): void {
    this.touchedFields.add(fieldName);
  }

  /**
   * Verifica si un campo tiene error
   */
  hasError(fieldName: string): boolean {
    const field = this.profileForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || this.touchedFields.has(fieldName)));
  }

  /**
   * Obtiene el mensaje de error de un campo
   */
  getErrorMessage(fieldName: string): string {
    const control = this.profileForm.get(fieldName);

    if (!control || !control.errors) {
      return '';
    }

    if (control.errors['required']) {
      return 'Este campo es requerido';
    }

    if (control.errors['minlength']) {
      return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
    }

    if (control.errors['maxlength']) {
      return `Máximo ${control.errors['maxlength'].requiredLength} caracteres`;
    }

    return 'Error desconocido';
  }

  /**
   * Guarda los cambios del perfil
   */
  async onSubmit(): Promise<void> {
    if (this.profileForm.invalid) {
      this.markAllFieldsAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      const displayName = this.profileForm.get('displayName')?.value.trim();

      await this.authService.updateUserProfile({
        displayName
      });

      await this.showToast('Perfil actualizado correctamente', 'success');
      this.toggleEditMode();

    } catch (error: any) {
      console.error('Error al actualizar perfil:', error);
      this.errorMessage = error.message || 'Error al actualizar el perfil';
      await this.showToast(this.errorMessage, 'danger');

    } finally {
      this.loading = false;
    }
  }

  /**
   * Cambia la contraseña del usuario
   */
  async changePassword(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Cambiar Contraseña',
      message: 'Te enviaremos un email para cambiar tu contraseña',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Enviar Email',
          handler: async () => {
            await this.sendPasswordResetEmail();
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Envía email para cambiar contraseña
   */
  private async sendPasswordResetEmail(): Promise<void> {
    const loading = await this.loadingController.create({
      message: 'Enviando email...'
    });

    await loading.present();

    try {
      if (!this.user?.email) {
        throw new Error('No se puede obtener el email del usuario');
      }

      await this.authService.resetPassword(this.user.email);
      await this.showToast('Email de cambio de contraseña enviado', 'success');

    } catch (error: any) {
      console.error('Error al enviar email:', error);
      await this.showToast('Error al enviar el email', 'danger');

    } finally {
      await loading.dismiss();
    }
  }

  /**
   * Elimina la cuenta del usuario
   */
  async deleteAccount(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Eliminar Cuenta',
      message: '¿Estás seguro? Esta acción no se puede deshacer. Se eliminarán todos tus datos, transacciones y presupuestos.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            await this.performDeleteAccount();
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Realiza la eliminación de la cuenta
   */
  private async performDeleteAccount(): Promise<void> {
    const loading = await this.loadingController.create({
      message: 'Eliminando cuenta...'
    });

    await loading.present();

    try {
      await this.authService.deleteAccount();
      await this.showToast('Cuenta eliminada', 'success');
      this.router.navigate(['/login']);

    } catch (error: any) {
      console.error('Error al eliminar cuenta:', error);
      await this.showToast(error.message || 'Error al eliminar la cuenta', 'danger');

    } finally {
      await loading.dismiss();
    }
  }

  /**
   * Va a la página de configuración
   */
  goToSettings(): void {
    this.router.navigate(['/settings']);
  }

  /**
   * Vuelve atrás
   */
  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  /**
   * Marca todos los campos como tocados
   */
  private markAllFieldsAsTouched(): void {
    Object.keys(this.profileForm.controls).forEach(key => {
      this.touchedFields.add(key);
    });
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