import { useState } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';

type AuthMode = 'signin' | 'signup';

interface AuthPageProps {
   mode: AuthMode;
   onSubmit: (payload: {
      fullName?: string;
      email: string;
      password: string;
   }) => Promise<void> | void;
   onSwitchMode: () => void;
}

interface FormErrors {
   fullName?: string;
   email?: string;
   password?: string;
   confirmPassword?: string;
   agreement?: string;
}

function isEmailValid(email: string) {
   return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function AuthPage({ mode, onSubmit, onSwitchMode }: AuthPageProps) {
   const isSignUp = mode === 'signup';
   const [fullName, setFullName] = useState('');
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [confirmPassword, setConfirmPassword] = useState('');
   const [agree, setAgree] = useState(false);
   const [showPassword, setShowPassword] = useState(false);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [formErrors, setFormErrors] = useState<FormErrors>({});
   const [submitError, setSubmitError] = useState('');

   const validate = () => {
      const nextErrors: FormErrors = {};

      if (isSignUp && fullName.trim().length < 2) {
         nextErrors.fullName = 'Please enter your full name.';
      }
      if (!isEmailValid(email.trim())) {
         nextErrors.email = 'Please enter a valid email address.';
      }
      if (password.length < 6) {
         nextErrors.password = 'Password must be at least 6 characters.';
      }
      if (isSignUp && confirmPassword !== password) {
         nextErrors.confirmPassword = 'Passwords do not match.';
      }
      if (isSignUp && !agree) {
         nextErrors.agreement = 'You must accept the terms to continue.';
      }

      setFormErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
   };

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError('');
      if (!validate()) {
         return;
      }

      setIsSubmitting(true);
      try {
         await onSubmit({
            fullName: fullName.trim(),
            email: email.trim(),
            password,
         });
      } catch (err) {
         setSubmitError(
            err instanceof Error ? err.message : 'Unable to continue right now.'
         );
      } finally {
         setIsSubmitting(false);
      }
   };

   return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-page-bg)] p-5">
         <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-[var(--app-shell-border)] bg-[var(--app-shell-bg)] shadow-[0_24px_80px_rgba(6,8,18,0.5)] md:grid-cols-2">
            <div className="relative hidden min-h-[680px] overflow-hidden bg-gradient-to-br from-[#2a2f58] via-[#1f2346] to-[#161a33] p-10 text-white md:flex md:flex-col md:justify-between">
               <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs">
                     <ShieldCheck className="h-4 w-4 text-indigo-300" />
                     Secure Workspace
                  </div>
                  <h1 className="text-4xl font-bold leading-tight">
                     {isSignUp
                        ? 'Create your Assistly account'
                        : 'Welcome back to Assistly'}
                  </h1>
                  <p className="max-w-sm text-sm text-indigo-100/85">
                     {isSignUp
                        ? 'Manage conversations, keep history, and personalize your workflow.'
                        : 'Sign in to continue your chats, projects, and saved settings.'}
                  </p>
               </div>
               <div className="rounded-2xl border border-white/15 bg-white/5 p-5 text-sm text-indigo-100">
                  Fast access, secure sessions, and clean productivity UI.
               </div>
            </div>

            <div className="p-7 md:p-10">
               <div className="mb-8">
                  <h2 className="text-2xl font-bold text-(--app-text-strong)">
                     {isSignUp ? 'Sign Up' : 'Sign In'}
                  </h2>
                  <p className="mt-1 text-sm text-(--app-text-muted)">
                     {isSignUp
                        ? 'Create an account to start chatting.'
                        : 'Sign in to your account and continue.'}
                  </p>
               </div>

               <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                  {isSignUp && (
                     <div>
                        <label
                           htmlFor="full_name"
                           className="mb-1 block text-sm text-(--app-text-muted)"
                        >
                           Full name
                        </label>
                        <input
                           id="full_name"
                           name="full_name"
                           autoComplete="name"
                           value={fullName}
                           onChange={(e) => setFullName(e.target.value)}
                           className="w-full rounded-xl border border-(--app-input-border) bg-[var(--app-soft-surface)] px-4 py-3 text-sm text-(--app-text-strong) outline-none focus:border-indigo-400"
                           placeholder="Jeoffrey N."
                        />
                        {formErrors.fullName && (
                           <p className="mt-1 text-xs text-red-400">
                              {formErrors.fullName}
                           </p>
                        )}
                     </div>
                  )}

                  <div>
                     <label
                        htmlFor="email"
                        className="mb-1 block text-sm text-(--app-text-muted)"
                     >
                        Email
                     </label>
                     <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-xl border border-(--app-input-border) bg-[var(--app-soft-surface)] px-4 py-3 text-sm text-(--app-text-strong) outline-none focus:border-indigo-400"
                        placeholder="name@example.com"
                     />
                     {formErrors.email && (
                        <p className="mt-1 text-xs text-red-400">
                           {formErrors.email}
                        </p>
                     )}
                  </div>

                  <div>
                     <label
                        htmlFor={isSignUp ? 'new-password' : 'current-password'}
                        className="mb-1 block text-sm text-(--app-text-muted)"
                     >
                        Password
                     </label>
                     <div className="relative">
                        <input
                           id={isSignUp ? 'new-password' : 'current-password'}
                           name="password"
                           type={showPassword ? 'text' : 'password'}
                           autoComplete={
                              isSignUp ? 'new-password' : 'current-password'
                           }
                           value={password}
                           onChange={(e) => setPassword(e.target.value)}
                           className="w-full rounded-xl border border-(--app-input-border) bg-[var(--app-soft-surface)] px-4 py-3 pr-12 text-sm text-(--app-text-strong) outline-none focus:border-indigo-400"
                           placeholder="Enter password"
                        />
                        <button
                           type="button"
                           onClick={() => setShowPassword((v) => !v)}
                           className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-(--app-text-muted)"
                        >
                           {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                           ) : (
                              <Eye className="h-4 w-4" />
                           )}
                        </button>
                     </div>
                     {formErrors.password && (
                        <p className="mt-1 text-xs text-red-400">
                           {formErrors.password}
                        </p>
                     )}
                  </div>

                  {isSignUp && (
                     <div>
                        <label
                           htmlFor="confirm_password"
                           className="mb-1 block text-sm text-(--app-text-muted)"
                        >
                           Confirm password
                        </label>
                        <input
                           id="confirm_password"
                           name="confirm_password"
                           type={showPassword ? 'text' : 'password'}
                           autoComplete="new-password"
                           value={confirmPassword}
                           onChange={(e) => setConfirmPassword(e.target.value)}
                           className="w-full rounded-xl border border-(--app-input-border) bg-[var(--app-soft-surface)] px-4 py-3 text-sm text-(--app-text-strong) outline-none focus:border-indigo-400"
                           placeholder="Repeat password"
                        />
                        {formErrors.confirmPassword && (
                           <p className="mt-1 text-xs text-red-400">
                              {formErrors.confirmPassword}
                           </p>
                        )}
                     </div>
                  )}

                  {isSignUp && (
                     <label className="flex items-start gap-2 text-sm text-(--app-text-muted)">
                        <input
                           type="checkbox"
                           checked={agree}
                           onChange={(e) => setAgree(e.target.checked)}
                           className="mt-1 h-4 w-4 rounded border-(--app-input-border) bg-[var(--app-soft-surface)]"
                        />
                        <span>I agree to the terms and privacy policy.</span>
                     </label>
                  )}
                  {formErrors.agreement && (
                     <p className="mt-1 text-xs text-red-400">
                        {formErrors.agreement}
                     </p>
                  )}

                  {submitError && (
                     <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                        {submitError}
                     </p>
                  )}

                  <button
                     type="submit"
                     disabled={isSubmitting}
                     className="mt-2 w-full rounded-xl bg-gradient-to-r from-[#5f67ff] to-[#4f58dd] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
                  >
                     {isSubmitting
                        ? isSignUp
                           ? 'Creating account...'
                           : 'Signing in...'
                        : isSignUp
                          ? 'Create Account'
                          : 'Sign In'}
                  </button>
               </form>

               <p className="mt-5 text-center text-sm text-(--app-text-muted)">
                  {isSignUp
                     ? 'Already have an account?'
                     : "Don't have an account yet?"}{' '}
                  <button
                     className="font-semibold text-indigo-400 hover:text-indigo-300"
                     type="button"
                     onClick={onSwitchMode}
                  >
                     {isSignUp ? 'Sign In' : 'Create one'}
                  </button>
               </p>
            </div>
         </div>
      </div>
   );
}
