import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonText,
  IonSpinner,
  IonIcon,
  IonBackButton,
  IonButtons,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonToggle,
  IonChip,
  IonGrid,
  IonRow,
  IonCol,
  IonSegment,
  IonSegmentButton,
  IonAlert,
  AlertController,
  LoadingController,
  ToastController,
  IonBadge
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  arrowDownOutline,
  arrowUpOutline,
  cameraOutline,
  closeOutline,
  checkmarkOutline,
  imageOutline,
  trashOutline
} from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { AuthService } from '@app/core/services/auth.service';
import { TransactionService } from '@app/core/services/transaction.service';
import { CategoryService } from '@app/core/services/category.service';
import { ImageUploadService } from '@app/core/services/image-upload.service';
import { TransactionModel, CategoryModel, CategoryType } from '@app/models';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-add-transaction',
  templateUrl: './add-transaction.page.html',
  styleUrls: ['./add-transaction.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonText,
    IonSpinner,
    IonIcon,
    IonBackButton,
    IonButtons,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonToggle,
    IonChip,
    IonGrid,
    IonRow,
    IonCol,
    IonSegment,
    IonSegmentButton,
    IonAlert,
    IonBadge
  ]
})
export class AddTransactionPage implements OnInit, OnDestroy {
  transactionForm!: FormGroup;
  transactionType: CategoryType = CategoryType.EXPENSE;
  categories: CategoryModel[] = [];
  selectedCategory: CategoryModel | null = null;
  receiptUrl: string | null = null;
  receiptDeleteUrl: string | null = null;
  isLoading = false;
  isUploading = false;

  private formDisabled = false;

/**
 * Compara categorías por ID
 */
compareCategories(c1: CategoryModel, c2: CategoryModel): boolean {
  return c1 && c2 ? c1.id === c2.id : c1 === c2;
}

  private destroy$ = new Subject<void>();

  constructor(
    private formBuilder: FormBuilder,
    private transactionService: TransactionService,
    private categoryService: CategoryService,
    private authService: AuthService,
    private imageUploadService: ImageUploadService,
    private router: Router,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private alertController: AlertController
  ) {
    // Registrar iconos
    addIcons({
      addOutline,
      arrowDownOutline,
      arrowUpOutline,
      cameraOutline,
      closeOutline,
      checkmarkOutline,
      imageOutline,
      trashOutline
    });
  }

  ngOnInit() {
    this.initializeForm();
    this.loadCategories();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicializa el formulario
   */
  private initializeForm(): void {
    this.transactionForm = this.formBuilder.group({
      amount: ['', [
        Validators.required,
        Validators.min(0.01),
        Validators.max(9999999.99)
      ]],
      description: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(100)
      ]],
      notes: ['', [
        Validators.maxLength(500)
      ]],
      date: [new Date().toISOString().split('T')[0], [
        Validators.required
      ]],
      category: ['', [Validators.required]]
    });
  }

  /**
   * Carga las categorías según el tipo seleccionado
   */
  private loadCategories(): void {
    this.categoryService.getCategoriesByType$(this.transactionType)
      .pipe(takeUntil(this.destroy$))
      .subscribe(categories => {
        this.categories = categories;
        // Seleccionar la primera categoría por defecto
        if (categories.length > 0 && !this.selectedCategory) {
          this.selectedCategory = categories[0];
        }
      });
  }

  /**
   * Cambia el tipo de transacción
   */
  onTransactionTypeChange(event: any): void {
    this.transactionType = event.detail.value;
    this.selectedCategory = null;
    this.loadCategories();
  }

  /**
   * Selecciona una categoría
   */
  onCategoryChange(event: any): void {
    const categoryId = event.detail.value;
    this.selectedCategory = this.categories.find(c => c.id === categoryId) || null;
  }

  /**
   * Abre la cámara para tomar foto
   */
  async takePhoto(): Promise<void> {
    try {
      const image = await Camera.getPhoto({
        quality: 60,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        width: 1024,
        height: 1024
      });

      if (image.dataUrl) {
        await this.uploadReceipt(image.dataUrl);
      }
    } catch (error: any) {
      console.error('Error al tomar foto:', error);
      // No mostrar error si el usuario canceló
      if (error.message !== 'User cancelled photos app') {
        await this.showToast('Error al tomar foto', 'danger');
      }
    }
  }

  /**
   * Selecciona una imagen de la galería
   */
  async selectPhotoFromGallery(): Promise<void> {
    try {
      const image = await Camera.getPhoto({
        quality: 60,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        width: 1024,
        height: 1024
      });

      if (image.dataUrl) {
        await this.uploadReceipt(image.dataUrl);
      }
    } catch (error: any) {
      console.error('Error al seleccionar foto:', error);
      // No mostrar error si el usuario canceló
      if (error.message !== 'User cancelled photos app') {
        await this.showToast('Error al seleccionar foto', 'danger');
      }
    }
  }

  /**
   * Sube el recibo a ImgBB
   */
  private async uploadReceipt(dataUrl: string): Promise<void> {
    this.isUploading = true;

    try {
      const result = await this.imageUploadService.uploadBase64(
        dataUrl,
        `receipt_${Date.now()}`
      );

      this.receiptUrl = result.url;
      this.receiptDeleteUrl = result.deleteUrl;

      await this.showToast('Recibo adjuntado correctamente', 'success');
    } catch (error: any) {
      console.error('Error al subir recibo:', error);
      await this.showToast(
        `Error al subir recibo: ${error.message}`,
        'danger'
      );
    } finally {
      this.isUploading = false;
    }
  }

  /**
   * Elimina el recibo
   */
  async removeReceipt(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Eliminar Recibo',
      message: 'Estás seguro de que deseas eliminar el recibo?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            this.receiptUrl = null;
            this.receiptDeleteUrl = null;
            await this.showToast('Recibo eliminado', 'success');
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Maneja el submit del formulario
   */
  async onSubmit(): Promise<void> {
    if (this.transactionForm.invalid || !this.selectedCategory) {
      this.markFormGroupTouched(this.transactionForm);
      await this.showToast('Por favor completa todos los campos requeridos', 'warning');
      return;
    }

    await this.saveTransaction();
  }

  /**
   * Guarda la transacción
   */
  private async saveTransaction(): Promise<void> {
    const loading = await this.loadingController.create({
      message: 'Guardando transacción...',
      spinner: 'crescent'
    });

    await loading.present();
    this.isLoading = true;
    this.disableForm();

    try {
      const { amount, description, notes, date } = this.transactionForm.value;
      const userId = this.authService.getCurrentUserId();

      if (!userId) {
        throw new Error('Usuario no autenticado');
      }

      const transaction = new TransactionModel({
        userId,
        type: this.transactionType as CategoryType,
        amount: parseFloat(amount),
        currency: this.authService.getCurrentUser()?.preferences.currency || 'MXN',
        categoryId: this.selectedCategory!.id,
        categoryName: this.selectedCategory!.name,
        categoryIcon: this.selectedCategory!.icon,
        categoryColor: this.selectedCategory!.color,
        description,
        notes: notes || undefined,
        date: new Date(date),
        receiptUrl: this.receiptUrl || undefined,
        receiptDeleteUrl: this.receiptDeleteUrl || undefined
      });

      await this.transactionService.addTransaction(transaction);

      await loading.dismiss();
      this.enableForm();
      await this.showToast('Transacción guardada correctamente!', 'success');

      // Redirigir al dashboard
      this.router.navigate(['/dashboard']);

    } catch (error: any) {
      await loading.dismiss();
      console.error('Error al guardar transacción:', error);
      await this.showToast(
        error.message || 'Error al guardar la transacción',
        'danger'
      );
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Cancela y vuelve atrás
   */
  goBack(): void {
    if (this.transactionForm.dirty || this.receiptUrl) {
      this.showCancelAlert();
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  /**
   * Muestra alerta de cancelación
   */
  private async showCancelAlert(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Descartar Cambios',
      message: 'Descartas los cambios realizados?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Descartar',
          role: 'destructive',
          handler: () => {
            this.router.navigate(['/dashboard']);
          }
        }
      ]
    });

    await alert.present();
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
   * Marca todos los campos como touched
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Obtiene mensaje de error para un campo
   */
  getErrorMessage(fieldName: string): string {
    const control = this.transactionForm.get(fieldName);

    if (!control || !control.touched || !control.errors) {
      return '';
    }

    if (control.errors['required']) {
      return 'Este campo es requerido';
    }

    if (control.errors['min']) {
      return 'El monto debe ser mayor a 0';
    }

    if (control.errors['max']) {
      return 'El monto es demasiado grande';
    }

    if (control.errors['minlength']) {
      return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
    }

    if (control.errors['maxlength']) {
      return `Máximo ${control.errors['maxlength'].requiredLength} caracteres`;
    }

    return '';
  }

  /**
   * Verifica si un campo es inválido
   */
  isFieldInvalid(fieldName: string): boolean {
    const control = this.transactionForm.get(fieldName);
    return !!(control && control.invalid && control.touched);
  }

  /**
   * Obtiene el color del icono de tipo de transacción
   */
  getTransactionTypeColor(): string {
    return this.transactionType === CategoryType.EXPENSE ? 'danger' : 'success';
  }

  /**
   * Obtiene el icono del tipo de transacción
   */
  getTransactionTypeIcon(): string {
    return this.transactionType === CategoryType.EXPENSE ? 'arrow-down-outline' : 'arrow-up-outline';
  }
/**
 * Deshabilita todos los controles del formulario
 */
private disableForm(): void {
  if (!this.formDisabled) {
    Object.keys(this.transactionForm.controls).forEach(key => {
      this.transactionForm.get(key)?.disable();
    });
    this.formDisabled = true;
  }
}
/**
 * Habilita todos los controles del formulario
 */
private enableForm(): void {
  if (this.formDisabled) {
    Object.keys(this.transactionForm.controls).forEach(key => {
      this.transactionForm.get(key)?.enable();
    });
    this.formDisabled = false;
  }
}
}