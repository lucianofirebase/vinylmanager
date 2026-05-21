'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  username?: string;
  onboardingComplete?: boolean;
  interests?: string[];
  createdAt?: any;
  avatar?: string | null;
  avatarType?: 'preset' | 'upload' | null;
  discogsUser?: string | null;
  currency?: string | null;
  whatsappPhone?: string | null;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  loginWithGoogle: async () => {},
  logout: async () => {},
  refreshUserData: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Helper to fetch user data from Firestore
  const fetchUserData = async (uid: string): Promise<UserData | null> => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as UserData;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user data from Firestore:', error);
      return null;
    }
  };

  const refreshUserData = async () => {
    if (auth.currentUser) {
      const data = await fetchUserData(auth.currentUser.uid);
      if (data) {
        setUserData(data);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        let data = await fetchUserData(firebaseUser.uid);
        
        if (!data) {
          // Initialize user in Firestore if not exist
          const initialData: UserData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            onboardingComplete: false,
            createdAt: new Date(),
          };
          try {
            await setDoc(doc(db, 'users', firebaseUser.uid), initialData);
            data = initialData;
          } catch (err) {
            console.error('Error initializing user profile:', err);
          }
        }
        setUserData(data);
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Router guards
  useEffect(() => {
    if (loading) return;

    const isLoginPath = pathname === '/login';
    const isPublicShowcasePath = pathname === '/v' || pathname?.startsWith('/v/');
    const isOnboardingPath = pathname === '/onboarding';

    // Public showcase page should never trigger any redirect guards
    if (isPublicShowcasePath) {
      return;
    }

    if (!user) {
      if (!isLoginPath) {
        router.push('/login');
      }
    } else {
      const hasCompletedOnboarding = userData?.onboardingComplete === true;
      if (!hasCompletedOnboarding) {
        if (!isOnboardingPath) {
          router.push('/onboarding');
        }
      } else {
        if (isLoginPath || isOnboardingPath || pathname === '/') {
          router.push('/dashboard');
        }
      }
    }
  }, [user, userData, loading, pathname, router]);

  const loginWithGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    // Prompt to select account
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Google Auth Error:', error);
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Logout Error:', error);
      setLoading(false);
    }
  };

  const isPublicShowcasePath = pathname === '/v' || pathname?.startsWith('/v/');

  return (
    <AuthContext.Provider value={{ user, userData, loading, loginWithGoogle, logout, refreshUserData }}>
      <AnimatePresence mode="wait">
        {loading && !isPublicShowcasePath ? (
          <motion.div
            key="auth-loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#030712] overflow-hidden"
          >
            {/* Background Orbs */}
            <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-indigo-500/10 blur-[80px] animate-orb-slow-1 pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-500/10 blur-[100px] animate-orb-slow-2 pointer-events-none" />

            <div className="relative flex flex-col items-center z-10">
              {/* Premium Logo Concept */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, cubicBezier: [0.16, 1, 0.3, 1] }}
                className="mb-8 flex items-center justify-center"
              >
                <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/30">
                  <span className="text-3xl font-bold text-white select-none">💿</span>
                  <div className="absolute inset-0 rounded-2xl border border-white/20 animate-ping opacity-25 duration-1000" />
                </div>
              </motion.div>

              <h1 className="text-2xl font-bold tracking-tight text-white mb-2 font-sans select-none">
                VinylStock <span className="text-indigo-400 font-medium">Pro</span>
              </h1>
              <p className="text-gray-400 text-sm mb-6 select-none">Cargando tu colección...</p>

              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            </div>
          </motion.div>
        ) : (
          <div key="app-content">{children}</div>
        )}
      </AnimatePresence>
    </AuthContext.Provider>
  );
};
