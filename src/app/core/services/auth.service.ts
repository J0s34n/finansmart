import { Injectable } from '@angular/core';
import { 
  Auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  User,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  updatePassword,
  deleteUser
} from '@angular/fire/auth';
import { 
  Firestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  deleteDoc
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { UserModel } from '../../models/user.model';

/**
 * Servicio de Autenticación
 * Maneja login, registro, logout y gestión de usuarios
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Usuario actual (Firebase Auth)
  private currentFirebaseUser: User | null = null;
  
  // Usuario actual (modelo de la app)
  private currentUserSubject = new BehaviorSubject<UserModel | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  // Estado de autenticación
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  // Estado de carga
  private loadingSubject = new BehaviorSubject<boolean>(true);
  public loading$ = this.loadingSubject.asObservable();

  constructor(
    private auth: Auth,
    private firestore: Firestore
  ) {
    this.initAuthListener();
  }

  /**
   * Inicializa el listener de estado de autenticación
   */
  private initAuthListener(): void {
    onAuthStateChanged(this.auth, async (firebaseUser) => {
      this.currentFirebaseUser = firebaseUser;
      
      if (firebaseUser) {
        // Usuario autenticado, cargar datos de Firestore
        await this.loadUserData(firebaseUser.uid);
        this.isAuthenticatedSubject.next(true);
      } else {
        // Usuario no autenticado
        this.currentUserSubject.next(null);
        this.isAuthenticatedSubject.next(false);
      }
      
      this.loadingSubject.next(false);
    });
  }

  /**
   * Carga los datos del usuario desde Firestore
   */
  private async loadUserData(uid: string): Promise<void> {
    try {
      const userDoc = await getDoc(doc(this.firestore, 'users', uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const user = UserModel.fromFirebase({ ...userData, uid });
        this.currentUserSubject.next(user);
      } else {
        // Si no existe el documento, crear uno básico
        await this.createUserDocument(this.currentFirebaseUser!);
      }
    } catch (error) {
      console.error('Error al cargar datos del usuario:', error);
      throw error;
    }
  }

  /**
   * Registra un nuevo usuario
   */
  async register(email: string, password: string, displayName: string): Promise<UserModel> {
    try {
      // Crear usuario en Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        this.auth,
        email,
        password
      );

      const firebaseUser = userCredential.user;

      // Actualizar perfil con nombre
      await updateProfile(firebaseUser, { displayName });

      // Crear documento en Firestore
      const user = await this.createUserDocument(firebaseUser, displayName);

      // Enviar email de verificación
      await sendEmailVerification(firebaseUser);

      return user;
    } catch (error: any) {
      console.error('Error en registro:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Inicia sesión con email y contraseña
   */
  async login(email: string, password: string): Promise<UserModel> {
    try {
      const userCredential = await signInWithEmailAndPassword(
        this.auth,
        email,
        password
      );

      // Los datos se cargarán automáticamente por el listener
      await this.loadUserData(userCredential.user.uid);
      
      return this.currentUserSubject.value!;
    } catch (error: any) {
      console.error('Error en login:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Cierra la sesión del usuario
   */
  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
      this.currentUserSubject.next(null);
      this.isAuthenticatedSubject.next(false);
    } catch (error) {
      console.error('Error en logout:', error);
      throw error;
    }
  }

  /**
   * Envía email para restablecer contraseña
   */
  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth, email);
    } catch (error: any) {
      console.error('Error al enviar email:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Cambia la contraseña del usuario actual
   */
  async changePassword(newPassword: string): Promise<void> {
    if (!this.currentFirebaseUser) {
      throw new Error('No hay usuario autenticado');
    }

    try {
      await updatePassword(this.currentFirebaseUser, newPassword);
    } catch (error: any) {
      console.error('Error al cambiar contraseña:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Actualiza el perfil del usuario
   */
  async updateUserProfile(data: Partial<UserModel>): Promise<void> {
    if (!this.currentFirebaseUser || !this.currentUserSubject.value) {
      throw new Error('No hay usuario autenticado');
    }

    try {
      const userId = this.currentFirebaseUser.uid;
      const userRef = doc(this.firestore, 'users', userId);

      // Actualizar en Firestore
      await updateDoc(userRef, {
        ...data,
        updatedAt: new Date().toISOString()
      });

      // Actualizar displayName en Firebase Auth si cambió
      if (data.displayName && data.displayName !== this.currentFirebaseUser.displayName) {
        await updateProfile(this.currentFirebaseUser, {
          displayName: data.displayName
        });
      }

      // Recargar datos
      await this.loadUserData(userId);
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      throw error;
    }
  }

  /**
   * Actualiza las preferencias del usuario
   */
  async updatePreferences(preferences: Partial<UserModel['preferences']>): Promise<void> {
    if (!this.currentFirebaseUser || !this.currentUserSubject.value) {
      throw new Error('No hay usuario autenticado');
    }

    try {
      const userId = this.currentFirebaseUser.uid;
      const userRef = doc(this.firestore, 'users', userId);

      const currentUser = this.currentUserSubject.value;
      const updatedPreferences = {
        ...currentUser.preferences,
        ...preferences
      };

      await updateDoc(userRef, {
        preferences: updatedPreferences,
        updatedAt: new Date().toISOString()
      });

      // Recargar datos
      await this.loadUserData(userId);
    } catch (error) {
      console.error('Error al actualizar preferencias:', error);
      throw error;
    }
  }

  /**
   * Elimina la cuenta del usuario actual
   */
  async deleteAccount(): Promise<void> {
    if (!this.currentFirebaseUser) {
      throw new Error('No hay usuario autenticado');
    }

    try {
      const userId = this.currentFirebaseUser.uid;

      // Eliminar documento de Firestore
      await deleteDoc(doc(this.firestore, 'users', userId));

      // TODO: Aquí deberías eliminar también:
      // - Todas las transacciones del usuario
      // - Todos los presupuestos del usuario
      // - Todas las categorías personalizadas
      // - Imágenes de recibos en ImgBB

      // Eliminar cuenta de Firebase Auth
      await deleteUser(this.currentFirebaseUser);

      // Limpiar estado
      this.currentUserSubject.next(null);
      this.isAuthenticatedSubject.next(false);
    } catch (error: any) {
      console.error('Error al eliminar cuenta:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Reenvía el email de verificación
   */
  async resendVerificationEmail(): Promise<void> {
    if (!this.currentFirebaseUser) {
      throw new Error('No hay usuario autenticado');
    }

    try {
      await sendEmailVerification(this.currentFirebaseUser);
    } catch (error: any) {
      console.error('Error al reenviar email:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Verifica si el email del usuario está verificado
   */
  isEmailVerified(): boolean {
    return this.currentFirebaseUser?.emailVerified || false;
  }

  /**
   * Obtiene el usuario actual (snapshot)
   */
  getCurrentUser(): UserModel | null {
    return this.currentUserSubject.value;
  }

  /**
   * Obtiene el UID del usuario actual
   */
  getCurrentUserId(): string | null {
    return this.currentFirebaseUser?.uid || null;
  }

  /**
   * Obtiene el email del usuario actual
   */
  getCurrentUserEmail(): string | null {
    return this.currentFirebaseUser?.email || null;
  }

  /**
   * Crea el documento del usuario en Firestore
   */
  private async createUserDocument(
    firebaseUser: User,
    displayName?: string
  ): Promise<UserModel> {
    const user = new UserModel({
      uid: firebaseUser.uid,
      email: firebaseUser.email!,
      displayName: displayName || firebaseUser.displayName || undefined,
      photoURL: firebaseUser.photoURL || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      preferences: UserModel.getDefaultPreferences()
    });

    try {
      await setDoc(doc(this.firestore, 'users', user.uid), user.toJSON());
      this.currentUserSubject.next(user);
      return user;
    } catch (error) {
      console.error('Error al crear documento de usuario:', error);
      throw error;
    }
  }

  /**
   * Maneja errores de Firebase Auth y los convierte a mensajes legibles
   */
  private handleAuthError(error: any): Error {
    let message = 'Ha ocurrido un error';

    switch (error.code) {
      case 'auth/email-already-in-use':
        message = 'Este email ya está registrado';
        break;
      case 'auth/invalid-email':
        message = 'Email inválido';
        break;
      case 'auth/operation-not-allowed':
        message = 'Operación no permitida';
        break;
      case 'auth/weak-password':
        message = 'La contraseña es muy débil. Debe tener al menos 6 caracteres';
        break;
      case 'auth/user-disabled':
        message = 'Esta cuenta ha sido deshabilitada';
        break;
      case 'auth/user-not-found':
        message = 'No existe una cuenta con este email';
        break;
      case 'auth/wrong-password':
        message = 'Contraseña incorrecta';
        break;
      case 'auth/invalid-credential':
        message = 'Credenciales inválidas';
        break;
      case 'auth/too-many-requests':
        message = 'Demasiados intentos fallidos. Intenta más tarde';
        break;
      case 'auth/network-request-failed':
        message = 'Error de conexión. Verifica tu internet';
        break;
      case 'auth/requires-recent-login':
        message = 'Esta operación requiere que inicies sesión nuevamente';
        break;
      default:
        message = error.message || 'Error desconocido';
    }

    return new Error(message);
  }

  /**
   * Verifica si hay un usuario autenticado (snapshot)
   */
  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  /**
   * Recarga los datos del usuario actual
   */
  async reloadCurrentUser(): Promise<void> {
    if (this.currentFirebaseUser) {
      await this.loadUserData(this.currentFirebaseUser.uid);
    }
  }
}