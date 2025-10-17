import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
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
  IonText,
  IonBadge,
  IonGrid,
  IonRow,
  IonCol,
  IonSpinner,
  IonChip,
  IonAlert,
  AlertController,
  LoadingController,
  ToastController,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  trashOutline,
  pencilOutline,
  shareOutline,
  imageOutline,
  calendarOutline,
  pricetagOutline,
  documentOutline,
  timeOutline,
  checkmarkCircleOutline,
  alertCircleOutline
} from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';
import { TransactionService } from '@app/core/services/transaction.service';
import { AuthService } from '@app/core/services/auth.service';
import { TransactionModel, CategoryType } from '@app/models';

@Component({
  selector: 'app-transaction-detail',
  templateUrl: './transaction-detail.page.html',
  styleUrls: ['./transaction-detail.page.scss'],
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
    IonText,
    IonBadge,
    IonGrid,
    IonRow,
    IonCol,
    IonSpinner,
    IonChip,
    IonAlert
  ]
})
export class TransactionDetailPage implements OnInit, OnDestroy {
  transaction: TransactionModel | null = null;
  loading = true;
  showReceipt = false;

  private destroy$ = new Subject<void>();
  private transactionId: string = '';

  constructor(
    private transactionService: TransactionService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {
    // Registrar iconos
    addIcons({
      arrowBackOutline,
      trashOutline,
      pencilOutline,
      shareOutline,
      imageOutline,
      calendarOutline,
      pricetagOutline,
      documentOutline,
      timeOutline,
      checkmarkCircleOutline,
      alertCircleOutline
    });
  }

  ngOnInit() {
    this.loadTransactionDetail();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga el detalle de la transacción
   */
  private loadTransactionDetail(): void {
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(async params => {
        this.transactionId = params['id'];
        
        if (this.transactionId) {
          try {
            const transaction = await this.transactionService.getTransactionById(
              this.transactionId
            );

            if (transaction) {
              this.transaction = transaction;
            } else {
              await this.showToast('Transacción no encontrada', 'danger');
              this.goBack();
            }
          } catch (error) {
            console.error('Error al cargar transacción:', error);
            await this.showToast('Error al cargar la transacción', 'danger');
            this.goBack();
          } finally {
            this.loading = false;
          }
        }
      });
  }

  /**
   * Vuelve atrás
   */
  goBack(): void {
    this.router.navigate(['/transactions']);
  }

  /**
   * Edita la transacción
   */
  async editTransaction(): Promise<void> {
    // Implementar en próxima versión
    await this.showToast('Edición próximamente disponible', 'warning');
  }

  /**
   * Elimina la transacción
   */
  async deleteTransaction(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Eliminar Transacción',
      message: '¿Estás seguro de que deseas eliminar esta transacción?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            await this.performDelete();
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Realiza la eliminación
   */
  private async performDelete(): Promise<void> {
    if (!this.transaction) return;

    const loading = await this.loadingController.create({
      message: 'Eliminando...'
    });

    await loading.present();

    try {
      await this.transactionService.deleteTransaction(this.transaction.id);
      await this.showToast('Transacción eliminada correctamente', 'success');
      this.goBack();
    } catch (error: any) {
      console.error('Error al eliminar:', error);
      await this.showToast('Error al eliminar la transacción', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  /**
   * Comparte la transacción
   */
  async shareTransaction(): Promise<void> {
    if (!this.transaction) return;

    const text = `
Transacción: ${this.transaction.description}
Monto: ${this.formatAmount(this.transaction.amount, this.transaction.type)}
Categoría: ${this.transaction.categoryName}
Fecha: ${this.transaction.getFormattedDate()}
    `.trim();

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Mi Transacción',
          text: text
        });
      } catch (error) {
        console.error('Error al compartir:', error);
      }
    } else {
      await this.showToast('Compartir no disponible en tu dispositivo', 'warning');
    }
  }

  /**
   * Abre/cierra la vista de recibo
   */
  toggleReceipt(): void {
    this.showReceipt = !this.showReceipt;
  }

  /**
   * Abre el recibo en pantalla completa
   */
  openReceiptFullscreen(): void {
    if (this.transaction?.receiptUrl) {
      window.open(this.transaction.receiptUrl, '_blank');
    }
  }

  /**
   * Copia el monto al portapapeles
   */
  async copyAmount(): Promise<void> {
    if (!this.transaction) return;

    const text = this.transaction.amount.toString();

    try {
      await navigator.clipboard.writeText(text);
      await this.showToast('Monto copiado al portapapeles', 'success');
    } catch (error) {
      console.error('Error al copiar:', error);
      await this.showToast('Error al copiar', 'danger');
    }
  }

  /**
   * Copia la descripción al portapapeles
   */
  async copyDescription(): Promise<void> {
    if (!this.transaction) return;

    try {
      await navigator.clipboard.writeText(this.transaction.description);
      await this.showToast('Descripción copiada al portapapeles', 'success');
    } catch (error) {
      console.error('Error al copiar:', error);
      await this.showToast('Error al copiar', 'danger');
    }
  }

  /**
   * Formatea un monto
   */
  formatAmount(amount: number, type: CategoryType): string {
    const currency = this.authService.getCurrentUser()?.preferences.currency || 'MXN';
    const formatted = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency
    }).format(amount);

    return `${type === CategoryType.INCOME ? '+' : '-'}${formatted}`;
  }

  /**
   * Obtiene el color del tipo
   */
  getTypeColor(type: CategoryType): string {
    return type === CategoryType.INCOME ? 'success' : 'danger';
  }

  /**
   * Obtiene el icono del tipo
   */
  getTypeIcon(type: CategoryType): string {
    return type === CategoryType.INCOME ? 'arrow-up-outline' : 'arrow-down-outline';
  }

  /**
   * Obtiene el texto del tipo
   */
  getTypeLabel(type: CategoryType): string {
    return type === CategoryType.INCOME ? 'Ingreso' : 'Gasto';
  }

  /**
   * Verifica si la transacción tiene recibo
   */
  hasReceipt(): boolean {
    return !!this.transaction?.receiptUrl;
  }

  /**
   * Verifica si la transacción tiene notas
   */
  hasNotes(): boolean {
    return !!this.transaction?.notes && this.transaction.notes.trim().length > 0;
  }

  /**
   * Verifica si la transacción tiene tags
   */
  hasTags(): boolean {
    return !!this.transaction?.tags && this.transaction.tags.length > 0;
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

  /**
   * Obtiene la edad de la transacción
   */
  getTransactionAge(): string {
    if (!this.transaction) return '';
    return this.transaction.getRelativeTime(this.transaction.date);
  }

  /**
   * Verifica si es de hoy
   */
  isToday(): boolean {
    if (!this.transaction) return false;
    return this.transaction.isToday();
  }

  /**
   * Verifica si es de este mes
   */
  isThisMonth(): boolean {
    if (!this.transaction) return false;
    return this.transaction.isThisMonth();
  }
}