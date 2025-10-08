/**
 * Modelo de Usuario
 * Representa un usuario registrado en la aplicación
 */

export interface User {
  uid: string;                    // ID único de Firebase Auth
  email: string;                  // Email del usuario
  displayName?: string;           // Nombre para mostrar (opcional)
  photoURL?: string;              // URL de foto de perfil (opcional)
  createdAt: Date;                // Fecha de registro
  updatedAt: Date;                // Última actualización
  preferences: UserPreferences;   // Preferencias del usuario
}

/**
 * Preferencias personalizables del usuario
 */
export interface UserPreferences {
  currency: string;               // Moneda principal (ej: 'MXN', 'USD')
  language: string;               // Idioma de la app ('es', 'en')
  theme: 'light' | 'dark' | 'auto'; // Tema visual
  notifications: NotificationSettings;
  budgetAlertThreshold: number;   // % para alertas de presupuesto (ej: 80)
}

/**
 * Configuración de notificaciones
 */
export interface NotificationSettings {
  enabled: boolean;               // Notificaciones activadas
  budgetAlerts: boolean;          // Alertas de presupuesto
  dailyReminders: boolean;        // Recordatorios diarios
  weeklyReports: boolean;         // Reportes semanales
}

/**
 * Clase User con métodos útiles
 */
export class UserModel implements User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: Date;
  updatedAt: Date;
  preferences: UserPreferences;

  constructor(data: Partial<User>) {
    this.uid = data.uid || '';
    this.email = data.email || '';
    this.displayName = data.displayName;
    this.photoURL = data.photoURL;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.preferences = data.preferences || UserModel.getDefaultPreferences();
  }

  /**
   * Obtiene las preferencias por defecto
   */
  static getDefaultPreferences(): UserPreferences {
    return {
      currency: 'MXN',
      language: 'es',
      theme: 'auto',
      budgetAlertThreshold: 80,
      notifications: {
        enabled: true,
        budgetAlerts: true,
        dailyReminders: false,
        weeklyReports: true
      }
    };
  }

  /**
   * Convierte el usuario a formato JSON para Firebase
   */
  toJSON(): any {
    return {
      uid: this.uid,
      email: this.email,
      displayName: this.displayName,
      photoURL: this.photoURL,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      preferences: this.preferences
    };
  }

  /**
   * Crea un User desde datos de Firebase
   */
  static fromFirebase(data: any): UserModel {
    return new UserModel({
      ...data,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date()
    });
  }

  /**
   * Obtiene las iniciales del nombre
   */
  getInitials(): string {
    if (this.displayName) {
      return this.displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }
    return this.email.substring(0, 2).toUpperCase();
  }
}