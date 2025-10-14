/**
 * Barrel file principal del módulo Core
 * Exporta todos los servicios y guards para fácil importación
 * 
 * Uso:
 * import { AuthService, TransactionService, AuthGuard } from '@app/core';
 */

// ========================================
// SERVICIOS
// ========================================

export { AuthService } from './services/auth.service';
export { FirestoreService } from './services/firestore.service';
export { ImageUploadService, UploadResult } from './services/image-upload.service';
export { TransactionService } from './services/transaction.service';
export { CategoryService } from './services/category.service';
export { BudgetService } from './services/budget.service';

// ========================================
// GUARDS
// ========================================

export { AuthGuard } from './guards/auth.guard';
export { NoAuthGuard } from './guards/no-auth.guard';
export { EmailVerifiedGuard } from './guards/email-verified.guard';