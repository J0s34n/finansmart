import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { where, orderBy } from '@angular/fire/firestore';
import { FirestoreService } from './firestore.service';
import { AuthService } from './auth.service';
import { 
  CategoryModel, 
  Category, 
  CategoryType 
} from '@app/models';

/**
 * Servicio para gestionar categorías de transacciones
 * Maneja categorías predeterminadas y personalizadas del usuario
 */
@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private readonly COLLECTION_PATH = 'categories';

  // Cache de categorías
  private categoriesSubject = new BehaviorSubject<CategoryModel[]>([]);
  public categories$ = this.categoriesSubject.asObservable();

  // Categorías predeterminadas (locales)
  private defaultCategories: CategoryModel[] = [];

  // Estado de carga
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  // Inicialización completada
  private initializedSubject = new BehaviorSubject<boolean>(false);
  public initialized$ = this.initializedSubject.asObservable();

  constructor(
    private firestoreService: FirestoreService,
    private authService: AuthService
  ) {
    this.initCategories();
  }

  // ========================================
  // INICIALIZACIÓN
  // ========================================

  /**
   * Inicializa las categorías (predeterminadas + personalizadas del usuario)
   */
  private async initCategories(): Promise<void> {
    this.loadingSubject.next(true);

    try {
      // Cargar categorías predeterminadas desde el modelo
      this.defaultCategories = CategoryModel.getDefaultCategories();

      // Verificar si existen en Firestore, si no, crearlas
      await this.ensureDefaultCategoriesExist();

      // Iniciar listener de categorías
      this.initCategoriesListener();

      this.initializedSubject.next(true);
    } catch (error) {
      console.error('Error al inicializar categorías:', error);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Asegura que las categorías predeterminadas existan en Firestore
   */
  private async ensureDefaultCategoriesExist(): Promise<void> {
    try {
      // Verificar si ya existen categorías predeterminadas
      const existingDefaults = await this.firestoreService.getWhere<Category>(
        this.COLLECTION_PATH,
        where('isDefault', '==', true)
      );

      // Si no existen o son pocas, crear/actualizar
      if (existingDefaults.length < this.defaultCategories.length) {
        const operations = this.defaultCategories.map(category => ({
          type: 'set' as const,
          collectionPath: this.COLLECTION_PATH,
          documentId: category.id,
          data: category.toJSON()
        }));

        await this.firestoreService.executeBatch(operations);
        console.log('Categorías predeterminadas creadas/actualizadas');
      }
    } catch (error) {
      console.error('Error al crear categorías predeterminadas:', error);
      // No lanzar error, las categorías locales seguirán funcionando
    }
  }

  /**
   * Inicializa el listener de categorías (predeterminadas + del usuario)
   */
  private initCategoriesListener(): void {
    combineLatest([
      this.authService.currentUser$,
      // Escuchar categorías predeterminadas
      this.firestoreService.watchQuery<Category>(
        this.COLLECTION_PATH,
        where('isDefault', '==', true)
      )
    ]).pipe(
      switchMap(([user, defaultCats]) => {
        if (user) {
          // Usuario autenticado, obtener también sus categorías personalizadas
          return combineLatest([
            new Observable<Category[]>(observer => observer.next(defaultCats)),
            this.firestoreService.watchQuery<Category>(
              this.COLLECTION_PATH,
              where('userId', '==', user.uid),
              where('isDefault', '==', false)
            )
          ]);
        } else {
          // Sin usuario, solo categorías predeterminadas
          return new Observable<[Category[], Category[]]>(observer => {
            observer.next([defaultCats, []]);
          });
        }
      }),
      map(([defaultCats, userCats]) => {
        // Combinar y convertir a modelos
        const allCategories = [...defaultCats, ...userCats];
        return allCategories.map(cat => CategoryModel.fromFirebase(cat));
      })
    ).subscribe(categories => {
      this.categoriesSubject.next(categories);
    });
  }

  // ========================================
  // MÉTODOS DE ESCRITURA (Solo para categorías personalizadas)
  // ========================================

  /**
   * Crea una nueva categoría personalizada
   */
  async createCategory(category: CategoryModel): Promise<string> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      throw new Error('Usuario no autenticado');
    }

    // Validar categoría
    if (!category.isValid()) {
      throw new Error('Categoría inválida. Verifica los campos requeridos.');
    }

    // Asegurar que sea una categoría personalizada
    category.userId = userId;
    category.isDefault = false;
    category.createdAt = new Date();

    try {
      // Usar el ID generado por el modelo o crear uno nuevo
      const categoryId = category.id || this.firestoreService.generateId(this.COLLECTION_PATH);
      
      await this.firestoreService.set(
        this.COLLECTION_PATH,
        categoryId,
        category.toJSON()
      );

      console.log('Categoría creada:', categoryId);
      return categoryId;
    } catch (error) {
      console.error('Error al crear categoría:', error);
      throw error;
    }
  }

  /**
   * Actualiza una categoría personalizada
   */
  async updateCategory(categoryId: string, updates: Partial<CategoryModel>): Promise<void> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      throw new Error('Usuario no autenticado');
    }

    try {
      // Verificar que la categoría exista y pertenezca al usuario
      const existing = await this.getCategoryById(categoryId);
      
      if (!existing) {
        throw new Error('Categoría no encontrada');
      }

      if (existing.isDefault) {
        throw new Error('No se pueden modificar las categorías predeterminadas');
      }

      if (existing.userId !== userId) {
        throw new Error('No tienes permiso para modificar esta categoría');
      }

      await this.firestoreService.update(
        this.COLLECTION_PATH,
        categoryId,
        updates
      );

      console.log('Categoría actualizada:', categoryId);
    } catch (error) {
      console.error('Error al actualizar categoría:', error);
      throw error;
    }
  }

  /**
   * Elimina una categoría personalizada
   */
  async deleteCategory(categoryId: string): Promise<void> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      throw new Error('Usuario no autenticado');
    }

    try {
      // Verificar que la categoría exista y pertenezca al usuario
      const existing = await this.getCategoryById(categoryId);
      
      if (!existing) {
        throw new Error('Categoría no encontrada');
      }

      if (existing.isDefault) {
        throw new Error('No se pueden eliminar las categorías predeterminadas');
      }

      if (existing.userId !== userId) {
        throw new Error('No tienes permiso para eliminar esta categoría');
      }

      // TODO: Verificar si hay transacciones usando esta categoría
      // y decidir qué hacer (eliminar, reasignar, etc.)

      await this.firestoreService.delete(this.COLLECTION_PATH, categoryId);

      console.log('Categoría eliminada:', categoryId);
    } catch (error) {
      console.error('Error al eliminar categoría:', error);
      throw error;
    }
  }

  // ========================================
  // MÉTODOS DE LECTURA
  // ========================================

  /**
   * Obtiene una categoría por ID
   */
  async getCategoryById(categoryId: string): Promise<CategoryModel | null> {
    try {
      const data = await this.firestoreService.getById<Category>(
        this.COLLECTION_PATH,
        categoryId
      );

      return data ? CategoryModel.fromFirebase(data) : null;
    } catch (error) {
      console.error('Error al obtener categoría:', error);
      throw error;
    }
  }

  /**
   * Obtiene todas las categorías (snapshot)
   */
  getAllCategories(): CategoryModel[] {
    return this.categoriesSubject.value;
  }

  /**
   * Obtiene categorías predeterminadas
   */
  getDefaultCategories(): CategoryModel[] {
    return this.categoriesSubject.value.filter(cat => cat.isDefault);
  }

  /**
   * Obtiene categorías personalizadas del usuario
   */
  getUserCategories(): CategoryModel[] {
    const userId = this.authService.getCurrentUserId();
    return this.categoriesSubject.value.filter(
      cat => !cat.isDefault && cat.userId === userId
    );
  }

  /**
   * Obtiene categorías por tipo (ingreso o gasto)
   */
  getCategoriesByType(type: CategoryType): CategoryModel[] {
    return this.categoriesSubject.value.filter(cat => cat.type === type);
  }

  /**
   * Obtiene categorías de ingresos
   */
  getIncomeCategories(): CategoryModel[] {
    return this.getCategoriesByType(CategoryType.INCOME);
  }

  /**
   * Obtiene categorías de gastos
   */
  getExpenseCategories(): CategoryModel[] {
    return this.getCategoriesByType(CategoryType.EXPENSE);
  }

  /**
   * Busca una categoría por nombre
   */
  findCategoryByName(name: string): CategoryModel | undefined {
    const nameLower = name.toLowerCase();
    return this.categoriesSubject.value.find(
      cat => cat.name.toLowerCase() === nameLower
    );
  }

  // ========================================
  // OBSERVABLES PERSONALIZADOS
  // ========================================

  /**
   * Observable de categorías por tipo
   */
  getCategoriesByType$(type: CategoryType): Observable<CategoryModel[]> {
    return this.categories$.pipe(
      map(categories => categories.filter(cat => cat.type === type))
    );
  }

  /**
   * Observable de categorías de ingresos
   */
  getIncomeCategories$(): Observable<CategoryModel[]> {
    return this.getCategoriesByType$(CategoryType.INCOME);
  }

  /**
   * Observable de categorías de gastos
   */
  getExpenseCategories$(): Observable<CategoryModel[]> {
    return this.getCategoriesByType$(CategoryType.EXPENSE);
  }

  /**
   * Observable de categorías personalizadas del usuario
   */
  getUserCategories$(): Observable<CategoryModel[]> {
    return combineLatest([
      this.categories$,
      this.authService.currentUser$
    ]).pipe(
      map(([categories, user]) => {
        if (!user) return [];
        return categories.filter(cat => !cat.isDefault && cat.userId === user.uid);
      })
    );
  }

  // ========================================
  // MÉTODOS AUXILIARES
  // ========================================

  /**
   * Verifica si una categoría existe
   */
  async categoryExists(categoryId: string): Promise<boolean> {
    return this.firestoreService.exists(this.COLLECTION_PATH, categoryId);
  }

  /**
   * Obtiene la cantidad total de categorías
   */
  getCategoryCount(): number {
    return this.categoriesSubject.value.length;
  }

  /**
   * Obtiene la cantidad de categorías personalizadas
   */
  getUserCategoryCount(): number {
    return this.getUserCategories().length;
  }

  /**
   * Verifica si el usuario puede crear más categorías
   * (Opcional: limitar cantidad)
   */
  canCreateMoreCategories(maxCategories: number = 50): boolean {
    return this.getUserCategoryCount() < maxCategories;
  }

  /**
   * Verifica si un nombre de categoría ya existe
   */
  categoryNameExists(name: string, excludeId?: string): boolean {
    const existing = this.findCategoryByName(name);
    if (!existing) return false;
    if (excludeId && existing.id === excludeId) return false;
    return true;
  }

  /**
   * Obtiene categorías más usadas (requiere contar transacciones)
   * Esta función debería usarse en combinación con TransactionService
   */
  getMostUsedCategories(transactionCounts: { [categoryId: string]: number }): CategoryModel[] {
    const categories = this.categoriesSubject.value;
    
    return categories
      .map(cat => ({
        category: cat,
        count: transactionCounts[cat.id] || 0
      }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .map(item => item.category);
  }

  /**
   * Obtiene una categoría aleatoria por tipo (útil para demos)
   */
  getRandomCategory(type: CategoryType): CategoryModel | null {
    const categories = this.getCategoriesByType(type);
    if (categories.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * categories.length);
    return categories[randomIndex];
  }

  /**
   * Valida que una categoría pueda ser eliminada
   * Retorna true si no tiene transacciones asociadas
   */
  async canDeleteCategory(categoryId: string): Promise<{ canDelete: boolean; reason?: string }> {
    const category = await this.getCategoryById(categoryId);
    
    if (!category) {
      return { canDelete: false, reason: 'Categoría no encontrada' };
    }

    if (category.isDefault) {
      return { canDelete: false, reason: 'No se pueden eliminar categorías predeterminadas' };
    }

    const userId = this.authService.getCurrentUserId();
    if (category.userId !== userId) {
      return { canDelete: false, reason: 'No tienes permiso para eliminar esta categoría' };
    }

    // TODO: Verificar si hay transacciones usando esta categoría
    // Por ahora, permitir eliminación
    return { canDelete: true };
  }

  /**
   * Recarga las categorías (forzar actualización)
   */
  async reloadCategories(): Promise<void> {
    this.loadingSubject.next(true);

    try {
      const userId = this.authService.getCurrentUserId();
      
      // Obtener categorías predeterminadas
      const defaultCats = await this.firestoreService.getWhere<Category>(
        this.COLLECTION_PATH,
        where('isDefault', '==', true)
      );

      // Obtener categorías del usuario si está autenticado
      let userCats: Category[] = [];
      if (userId) {
        userCats = await this.firestoreService.getWhere<Category>(
          this.COLLECTION_PATH,
          where('userId', '==', userId),
          where('isDefault', '==', false)
        );
      }

      // Combinar y actualizar
      const allCategories = [...defaultCats, ...userCats];
      const categories = allCategories.map(cat => CategoryModel.fromFirebase(cat));
      this.categoriesSubject.next(categories);

    } catch (error) {
      console.error('Error al recargar categorías:', error);
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Limpia el cache de categorías
   */
  clearCache(): void {
    this.categoriesSubject.next([]);
  }

  /**
   * Resetea las categorías predeterminadas (útil para desarrollo)
   */
  async resetDefaultCategories(): Promise<void> {
    try {
      this.defaultCategories = CategoryModel.getDefaultCategories();
      
      const operations = this.defaultCategories.map(category => ({
        type: 'set' as const,
        collectionPath: this.COLLECTION_PATH,
        documentId: category.id,
        data: category.toJSON()
      }));

      await this.firestoreService.executeBatch(operations);
      await this.reloadCategories();
      
      console.log('Categorías predeterminadas reseteadas');
    } catch (error) {
      console.error('Error al resetear categorías:', error);
      throw error;
    }
  }
}