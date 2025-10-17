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
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonSpinner,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  mailUnreadOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  warningOutline
} from 'ionicons/icons';
import { Subject } from 'rxjs';
import { AuthService } from '@app/core/services/auth.service';

/**
 * Página para recuperar contraseña
 * Permite al usuario solicitar un email de recuperación
 */
@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
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
    IonCardContent,
    IonItem,
    IonLabel,
    IonInput,
    IonSpinner
  ]
})
export class ForgotPasswordPage implements OnInit, OnDestroy {
  forgotPasswordForm!: FormGroup;
  loading = false;
  successMessage = '';
  errorMessage = '';
  touchedFields = new Set<string>();

  private destroy$ = new Subject<void>();

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastController: ToastController
  ) {
    addIcons({
      arrowBackOutline,
      mailUnreadOutline,
      checkmarkCircleOutline,
      alertCircleOutline,
      warningOutline
    });
  }

  ngOnInit() {
    this.initializeForm();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicializa el formulario reactivo
   */
  private initializeForm(): void {
    this.forgotPasswordForm = this.formBuilder.group({
      email: [
        '',
        [
          Validators.required,
          Validators.email
        ]
      ]
    });
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
    const field = this.forgotPasswordForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || this.touchedFields.has(fieldName)));
  }

  /**
   * Obtiene el mensaje de error de un campo
   */
  getErrorMessage(fieldName: string): string {
    const control = this.forgotPasswordForm.get(fieldName);

    if (!control || !control.errors) {
      return '';
    }

    if (control.errors['required']) {
      return 'El email es requerido';
    }

    if (control.errors['email']) {
      return 'Por favor ingresa un email válido';
    }

    return 'Error desconocido';
  }

  /**
   * Envía el email de recuperación
   */
  async onSubmit(): Promise<void> {
    if (this.forgotPasswordForm.invalid) {
      this.markAllFieldsAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      const email = this.forgotPasswordForm.get('email')?.value.trim();

      // Llamar al servicio de autenticación
      await this.authService.resetPassword(email);

      // Mostrar mensaje de éxito
      this.successMessage = `Se ha enviado un enlace de recuperación a ${email}`;

      // Log para debugging
      console.log('Email de recuperación enviado a:', email);

    } catch (error: any) {
      console.error('Error al enviar email de recuperación:', error);

      // Mostrar error específico
      if (error.message.includes('user-not-found')) {
        this.errorMessage = 'No existe una cuenta registrada con este email';
      } else if (error.message.includes('too-many-requests')) {
        this.errorMessage = 'Demasiados intentos. Intenta más tarde';
      } else {
        this.errorMessage = error.message || 'Error al enviar el email de recuperación';
      }

      await this.showToast(this.errorMessage, 'danger');

    } finally {
      this.loading = false;
    }
  }

  /**
   * Reinicia el formulario
   */
  resetForm(): void {
    this.forgotPasswordForm.reset();
    this.touchedFields.clear();
    this.errorMessage = '';
    this.successMessage = '';
  }

  /**
   * Marca todos los campos como tocados
   */
  private markAllFieldsAsTouched(): void {
    Object.keys(this.forgotPasswordForm.controls).forEach(key => {
      this.touchedFields.add(key);
    });
  }

  /**
   * Vuelve atrás
   */
  goBack(): void {
    this.router.navigate(['/login']);
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