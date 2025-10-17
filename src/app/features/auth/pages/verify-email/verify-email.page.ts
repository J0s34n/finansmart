import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  IonSpinner,
  ToastController,
  LoadingController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  mailOutline,
  checkmarkCircleOutline,
  warningOutline
} from 'ionicons/icons';
import { Subject, takeUntil, interval } from 'rxjs';
import { AuthService } from '@app/core/services/auth.service';

/**
 * Página para Verificar Email
 * Guía al usuario a través del proceso de verificación de email
 */
@Component({
  selector: 'app-verify-email',
  templateUrl: './verify-email.page.html',
  styleUrls: ['./verify-email.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
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
    IonSpinner
  ]
})
export class VerifyEmailPage implements OnInit, OnDestroy {
  userEmail = '';
  loading = false;
  errorMessage = '';
  resendCooldown = 0;

  private destroy$ = new Subject<void>();
  private readonly RESEND_COOLDOWN = 60; // segundos

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastController: ToastController,
    private loadingController: LoadingController
  ) {
    addIcons({
      arrowBackOutline,
      mailOutline,
      checkmarkCircleOutline,
      warningOutline
    });
  }

  ngOnInit() {
    this.loadUserEmail();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga el email del usuario actual
   */
  private loadUserEmail(): void {
    const currentUser = this.authService.getCurrentUser();
    this.userEmail = currentUser?.email || '';
  }

  /**
   * Verifica si el email está verificado
   */
  isEmailVerified(): boolean {
    return this.authService.isEmailVerified();
  }

  /**
   * Verifica el estado de verificación del email
   */
  async checkVerificationStatus(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      // Recargar datos del usuario
      await this.authService.reloadCurrentUser();

      // Verificar si ahora está verificado
      if (this.isEmailVerified()) {
        await this.showToast('¡Email verificado correctamente!', 'success');
        this.goBack();
      } else {
        this.errorMessage = 'El email aún no ha sido verificado. Por favor revisa tu bandeja de entrada.';
        await this.showToast('Email no verificado aún', 'warning');
      }

    } catch (error: any) {
      console.error('Error al verificar email:', error);
      this.errorMessage = 'Error al verificar el email. Intenta nuevamente.';
      await this.showToast('Error al verificar', 'danger');

    } finally {
      this.loading = false;
    }
  }

  /**
   * Reenvía el email de verificación
   */
  async resendVerificationEmail(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      await this.authService.resendVerificationEmail();

      // Iniciar cooldown
      this.startResendCooldown();

      await this.showToast('Email de verificación reenviado', 'success');

    } catch (error: any) {
      console.error('Error al reenviar email:', error);

      if (error.message.includes('too-many-requests')) {
        this.errorMessage = 'Demasiados intentos. Intenta más tarde.';
      } else {
        this.errorMessage = error.message || 'Error al reenviar el email';
      }

      await this.showToast(this.errorMessage, 'danger');

    } finally {
      this.loading = false;
    }
  }

  /**
   * Inicia el cooldown para reenviar email
   */
  private startResendCooldown(): void {
    this.resendCooldown = this.RESEND_COOLDOWN;

    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.resendCooldown > 0) {
          this.resendCooldown--;
        }
      });
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