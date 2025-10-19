import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButton,
  IonIcon,
  IonBackButton,
  IonButtons,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonList,
  IonItem,
  IonLabel,
  IonAvatar,
  IonText,
  IonBadge,
  IonRefresher,
  IonRefresherContent,
  IonFab,
  IonFabButton,
  IonDatetime,
  IonModal,
  IonGrid,
  IonRow,
  IonCol,
  IonChip,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  AlertController,
  LoadingController,
  ToastController,
  RefresherCustomEvent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  trashOutline,
  filterOutline,
  searchOutline,
  timeOutline,
  arrowUpOutline,
  arrowDownOutline,
  closeOutline,
  checkmarkOutline
} from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';
import { TransactionService } from '@app/core/services/transaction.service';
import { CategoryService } from '@app/core/services/category.service';
import { AuthService } from '@app/core/services/auth.service';
import { TransactionModel, CategoryModel, CategoryType, TransactionFilters } from '@app/models';

@Component({
  selector: 'app-transactions',
  templateUrl: './transactions.page.html',
  styleUrls: ['./transactions.page.scss'],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButton,
    IonIcon,
    IonBackButton,
    IonButtons,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonList,
    IonItem,
    IonLabel,
    IonAvatar,
    IonText,
    IonBadge,
    IonRefresher,
    IonRefresherContent,
    IonFab,
    IonFabButton,
    IonDatetime,
    IonModal,
    IonGrid,
    IonRow,
    IonCol,
    IonChip,
    IonItemSliding,
    IonItemOptions,
    IonItemOption
  ]
})
export class TransactionsPage implements OnInit, OnDestroy {
  allTransactions: TransactionModel[] = [];
  filteredTransactions: TransactionModel[] = [];
  categories: CategoryModel[] = [];
  CategoryType = CategoryType;
  
  searchText = '';
  selectedType: CategoryType | 'all' = 'all';
  selectedCategory: string | 'all' = 'all';
  dateFrom: string | undefined;
  dateTo: string | undefined;

  loading = true;
  isFiltering = false;
  showFilters = false;

  itemsPerPage = 20;
  currentPage = 1;

  private destroy$ = new Subject<void>();

  constructor(
    private transactionService: TransactionService,
    private categoryService: CategoryService,
    private authService: AuthService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {
    addIcons({
      addOutline,
      trashOutline,
      filterOutline,
      searchOutline,
      timeOutline,
      arrowUpOutline,
      arrowDownOutline,
      closeOutline,
      checkmarkOutline
    });
  }

  ngOnInit() {
    this.loadTransactions();
    this.loadCategories();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadTransactions(): void {
    this.transactionService.transactions$
      .pipe(takeUntil(this.destroy$))
      .subscribe(transactions => {
        this.allTransactions = transactions;
        this.applyFilters();
        this.loading = false;
      });
  }

  private loadCategories(): void {
    this.categoryService.categories$
      .pipe(takeUntil(this.destroy$))
      .subscribe(categories => {
        this.categories = categories;
      });
  }

  public applyFilters(): void {
    let filtered = this.allTransactions;

    if (this.searchText.trim()) {
      const search = this.searchText.toLowerCase();
      filtered = filtered.filter(t =>
        t.description.toLowerCase().includes(search) ||
        t.categoryName?.toLowerCase().includes(search) ||
        t.notes?.toLowerCase().includes(search)
      );
    }

    if (this.selectedType !== 'all') {
      filtered = filtered.filter(t => t.type === this.selectedType);
    }

    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.categoryId === this.selectedCategory);
    }

    if (this.dateFrom) {
      const from = new Date(this.dateFrom);
      filtered = filtered.filter(t => t.date >= from);
    }

    if (this.dateTo) {
      const to = new Date(this.dateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => t.date <= to);
    }

    this.filteredTransactions = filtered;
  }

  onSearchChange(event: any): void {
    this.searchText = event.detail.value;
    this.currentPage = 1;
    this.applyFilters();
  }

  onTypeChange(event: any): void {
    this.selectedType = event.detail.value;
    this.currentPage = 1;
    this.applyFilters();
  }

  onCategoryChange(event: any): void {
    this.selectedCategory = event.detail.value;
    this.currentPage = 1;
    this.applyFilters();
  }

  resetFilters(): void {
    this.searchText = '';
    this.selectedType = 'all';
    this.selectedCategory = 'all';
    this.dateFrom = undefined;
    this.dateTo = undefined;
    this.currentPage = 1;
    this.applyFilters();
    this.showFilters = false;
  }

  closeFiltersModal(): void {
    this.showFilters = false;
  }

  async handleRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await this.transactionService.reloadTransactions();
    } catch (error) {
      console.error('Error al refrescar:', error);
    } finally {
      event.target.complete();
    }
  }

  getPaginatedTransactions(): TransactionModel[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredTransactions.slice(start, end);
  }

  loadMore(event: any): void {
    const totalPages = Math.ceil(this.filteredTransactions.length / this.itemsPerPage);
    
    if (this.currentPage < totalPages) {
      this.currentPage++;
      event.target.complete();
    } else {
      event.target.disabled = true;
    }
  }

  goToTransactionDetail(transaction: TransactionModel): void {
    this.router.navigate(['/transaction-detail', transaction.id]);
  }

  goToAddTransaction(): void {
    this.router.navigate(['/add-transaction']);
  }

  async deleteTransaction(transaction: TransactionModel, event: any): Promise<void> {
    event.target.closest('ion-item-sliding').closeOpened();

    const alert = await this.alertController.create({
      header: 'Eliminar Transacción',
      message: `¿Estás seguro de que deseas eliminar esta transacción?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            await this.performDelete(transaction);
          }
        }
      ]
    });

    await alert.present();
  }

  private async performDelete(transaction: TransactionModel): Promise<void> {
    const loading = await this.loadingController.create({
      message: 'Eliminando...'
    });

    await loading.present();

    try {
      await this.transactionService.deleteTransaction(transaction.id);
      await this.showToast('Transacción eliminada correctamente', 'success');
    } catch (error: any) {
      console.error('Error al eliminar:', error);
      await this.showToast('Error al eliminar la transacción', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  async editTransaction(transaction: TransactionModel, event: any): Promise<void> {
    event.target.closest('ion-item-sliding').closeOpened();
    await this.showToast('Edición próximamente disponible', 'warning');
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

  formatAmount(amount: number, type: CategoryType): string {
    const currency = this.authService.getCurrentUser()?.preferences.currency || 'MXN';
    const formatted = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency
    }).format(amount);
    
    return `${type === CategoryType.INCOME ? '+' : '-'}${formatted}`;
  }

  getIconColor(type: CategoryType): string {
    return type === CategoryType.INCOME ? 'success' : 'danger';
  }

  getRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
      return date.toLocaleDateString('es-MX');
    } else if (days > 0) {
      return `Hace ${days} día${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `Hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    } else {
      return 'Hace un momento';
    }
  }

  getTransactionCount(): string {
    if (this.filteredTransactions.length === 0) {
      return 'Sin transacciones';
    }
    return `${this.filteredTransactions.length} transacción${this.filteredTransactions.length > 1 ? 'es' : ''}`;
  }

  hasActiveFilters(): boolean {
    return this.searchText !== '' || 
           this.selectedType !== 'all' || 
           this.selectedCategory !== 'all' || 
           !!this.dateFrom || 
           !!this.dateTo;
  }

  hasTransactions(): boolean {
    return this.filteredTransactions.length > 0;
  }
}