import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA  } from '@angular/core';
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
  AlertController,
  LoadingController,
  ToastController
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
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
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
    IonChip
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

  private loadTransactionDetail(): void {
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(async params => {
        this.transactionId = params['id'];
        
        console.log('TransactionDetailPage - ID recibido:', this.transactionId);
        
        if (!this.transactionId || this.transactionId.trim() === '') {
          console.error('ID de transacción inválido');
          await this.showToast('ID de transacción inválido', 'danger');
          this.goBack();
          return;
        }

        try {
          console.log('Buscando transacción con ID:', this.transactionId);
          
          // DEBUG: Ver todas las transacciones disponibles
          const allTxns = this.transactionService.getAllTransactions();
          console.log('Todas las transacciones disponibles:', allTxns);
          console.log('IDs disponibles:', allTxns.map(t => t.id));
          
          const transaction = await this.transactionService.getTransactionById(
            this.transactionId
          );

          console.log('Transacción encontrada:', transaction);

          if (transaction) {
            this.transaction = transaction;
            console.log('Transacción cargada exitosamente:', this.transaction);
          } else {
            console.warn('No se encontró transacción con ID:', this.transactionId);
            console.log('Transacciones disponibles:', this.transactionService.transactions$);
            
            await this.showToast('Transacción no encontrada', 'danger');
            
            // Esperar 1 segundo antes de ir atrás
            setTimeout(() => this.goBack(), 1000);
          }
        } catch (error: any) {
          console.error('Error al cargar transacción:', error);
          console.error('Stack:', error.stack);
          
          await this.showToast('Error al cargar la transacción: ' + error.message, 'danger');
          
          setTimeout(() => this.goBack(), 1000);
        } finally {
          this.loading = false;
        }
      });
  }

  goBack(): void {
    console.log('Navegando de vuelta a transacciones');
    this.router.navigate(['/transactions']);
  }

  async editTransaction(): Promise<void> {
    await this.showToast('Edición próximamente disponible', 'warning');
  }

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

  toggleReceipt(): void {
    this.showReceipt = !this.showReceipt;
  }

  openReceiptFullscreen(): void {
    if (this.transaction?.receiptUrl) {
      window.open(this.transaction.receiptUrl, '_blank');
    }
  }

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

  formatAmount(amount: number, type: CategoryType): string {
    const currency = this.authService.getCurrentUser()?.preferences.currency || 'MXN';
    const formatted = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency
    }).format(amount);

    return `${type === CategoryType.INCOME ? '+' : '-'}${formatted}`;
  }

  getTypeColor(type: CategoryType): string {
    return type === CategoryType.INCOME ? 'success' : 'danger';
  }

  getTypeIcon(type: CategoryType): string {
    return type === CategoryType.INCOME ? 'arrow-up-outline' : 'arrow-down-outline';
  }

  getTypeLabel(type: CategoryType): string {
    return type === CategoryType.INCOME ? 'Ingreso' : 'Gasto';
  }

  hasReceipt(): boolean {
    return !!this.transaction?.receiptUrl;
  }

  hasNotes(): boolean {
    return !!this.transaction?.notes && this.transaction.notes.trim().length > 0;
  }

  hasTags(): boolean {
    return !!this.transaction?.tags && this.transaction.tags.length > 0;
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color
    });
    await toast.present();
  }

  getTransactionAge(): string {
    if (!this.transaction) return '';
    return this.transaction.getRelativeTime(this.transaction.date);
  }

  isToday(): boolean {
    if (!this.transaction) return false;
    return this.transaction.isToday();
  }

  isThisMonth(): boolean {
    if (!this.transaction) return false;
    return this.transaction.isThisMonth();
  }
}