/**
 * Barrel file para exportar todos los modelos
 * Permite importar todos los modelos desde un solo lugar
 * 
 * Uso:
 * import { UserModel, TransactionModel, CategoryModel, BudgetModel } from '@app/models';
 */

// User exports
export { 
  User, 
  UserPreferences, 
  NotificationSettings, 
  UserModel 
} from './user.model';

// Category exports
export { 
  Category, 
  CategoryType, 
  CategoryModel 
} from './category.model';

// Transaction exports
export { 
  Transaction, 
  TransactionFilters, 
  TransactionStats, 
  TransactionModel 
} from './transaction.model';

// Budget exports
export { 
  Budget, 
  BudgetStatus, 
  BudgetPeriod, 
  BudgetSummary, 
  BudgetModel 
} from './budget.model';